import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { parseAirText } from '../../parser/air/AirParser';
import { parseCnsText } from '../../parser/cns/CnsParser';
import type { SpritePack } from '../sprite/SpriteTypes';
import { CanvasRenderer } from '../../renderer/canvas2d/CanvasRenderer';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { createInitialGameState } from '../engine/GameState';
import type { GameState } from '../engine/types';
import {
  applyExplodCreateEvents,
  applyExplodModifyEvents,
  stepExplodRuntime,
  type ExplodCreateRequest,
  type ExplodModifyEvent,
} from './ExplodSystem';

const cns = parseCnsText(readFileSync('src/core/explod/fixtures/modify-explod.cns', 'utf8'));
const air = parseAirText(readFileSync('src/core/explod/fixtures/modify-explod.air', 'utf8'));

describe('ModifyExplod explicit-ID compatibility fixture', () => {
  it('partially updates every owner-scoped duplicate and reaches the renderer in the same frame', () => {
    const initial = createInitialGameState();
    const p1 = { ...initial.players[0], stateNo: 900 };
    const p2 = { ...initial.players[1], x: 500, y: 300, facing: -1 as const };
    let state: GameState = { ...initial, players: [p1, p2] };
    state = applyExplodCreateEvents(state, [{ type: 'create', request: createRequest(2, 77) }]);

    const creates = [] as Parameters<typeof applyExplodCreateEvents>[1][number][];
    const modifies: ExplodModifyEvent[] = [];
    stepCnsStateRuntime(state, cns, {
      onExplodCreate: (event) => creates.push(event),
      onExplodModify: (event) => modifies.push(event),
    });
    state = applyExplodCreateEvents(state, creates);
    state = applyExplodModifyEvents(state, modifies);
    state = stepExplodRuntime(state, () => air);

    const ownerOne = state.explods.entries.filter((entry) => entry.owner.entityId === 1 && entry.mugenId === 77);
    const ownerTwo = state.explods.entries.find((entry) => entry.owner.entityId === 2 && entry.mugenId === 77);
    expect(ownerOne).toHaveLength(2);
    expect(ownerOne).toEqual(expect.arrayContaining([
      expect.objectContaining({
        position: { x: 460, y: 250 }, offset: { x: 40, y: -50 }, postype: 'p2', coordinateSpace: 'stage',
        facing: 1, verticalFacing: -1, velocity: { x: 6, y: 7 }, acceleration: { x: 0.6, y: 0.7 }, random: { x: 8, y: 9 },
        bind: { targetEntityId: 2, remaining: 5, offsetX: 40, offsetY: -50 }, removeTime: 12, removeTimeElapsed: 0,
        pauseMoveTime: 11, superMoveTime: 10, spritePriority: 7, onTop: true, removeOnGetHit: true,
        render: {
          transparency: 'addalpha', alpha: { source: 200, destination: 56 }, scaleX: 2, scaleY: 3,
          ownPalette: true, shadow: { red: 4, green: 5, blue: 6 },
        },
      }),
    ]));
    expect(ownerOne.every((entry) => entry.animNo === 100)).toBe(true);
    expect(ownerTwo).toMatchObject({ position: { x: 220, y: 285 }, postype: 'p1', render: { scaleX: 1, scaleY: 1 } });
    expect(state.hitDiagnosticLines).toEqual(expect.arrayContaining([
      expect.stringContaining('id=77 matched=2'),
      expect.stringContaining('id=999 matched=0 reason=not_found'),
      expect.stringContaining('id=- matched=0 reason=id_missing'),
    ]));

    const drawImage = vi.fn();
    const scale = vi.fn();
    const renderer = rendererForFixture(drawImage, scale);
    const diagnostics = renderer.render(state);
    expect(scale).toHaveBeenCalledWith(2, -3);
    expect(drawImage).toHaveBeenCalledTimes(2);
    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.stringContaining('screen=(460,250)'),
      expect.stringContaining('scale=(2,3)'),
      expect.stringContaining('priority=7 ontop=1 result=drawn'),
    ]));
  });

  it('keeps omitted fields and animation progress unless the animation changes', () => {
    let unchanged = seededState(904, { animTime: 7, animElement: 1 });
    unchanged = applyControllerModifications(unchanged);
    expect(unchanged.explods.entries[0]).toMatchObject({ animNo: 100, animTime: 7, animElement: 1, velocity: { x: 1, y: 2 } });

    let changed = seededState(902, { animTime: 7, animElement: 1 });
    changed = applyControllerModifications(changed);
    expect(changed.explods.entries[0]).toMatchObject({ animNo: 101, animTime: 0, animElement: 0, velocity: { x: 1, y: 2 } });
  });

  it('starts a changed removetime clock on the modification frame', () => {
    let state = seededState(903, { age: 8, removeTimeElapsed: 8, removeTimeStartFrame: 0 });
    state = { ...state, frame: 10 };
    state = applyControllerModifications(state);
    expect(state.explods.entries[0]).toMatchObject({ removeTime: 3, removeTimeElapsed: 0, removeTimeStartFrame: 10 });

    state = stepExplodRuntime(state, () => air);
    expect(state.explods.entries).toHaveLength(1);
    for (const frame of [11, 12]) {
      state = stepExplodRuntime({ ...state, frame }, () => air);
      expect(state.explods.entries).toHaveLength(1);
    }
    state = stepExplodRuntime({ ...state, frame: 13 }, () => air);
    expect(state.explods.entries).toHaveLength(0);
  });

  it('honors false triggers without emitting a modification', () => {
    const state = seededState(901);
    const events: ExplodModifyEvent[] = [];
    stepCnsStateRuntime(state, cns, { onExplodModify: (event) => events.push(event) });
    expect(events).toHaveLength(0);
  });
});

function applyControllerModifications(state: GameState): GameState {
  const events: ExplodModifyEvent[] = [];
  stepCnsStateRuntime(state, cns, { onExplodModify: (event) => events.push(event) });
  return applyExplodModifyEvents(state, events);
}

function seededState(stateNo: number, overrides: Record<string, unknown> = {}): GameState {
  const initial = createInitialGameState();
  let state = applyExplodCreateEvents(
    { ...initial, players: [{ ...initial.players[0], stateNo }, initial.players[1]] },
    [{ type: 'create', request: createRequest(1, 77) }],
  );
  state.explods.entries[0] = { ...state.explods.entries[0], ...overrides };
  return state;
}

function createRequest(ownerId: 1 | 2, mugenId: number): ExplodCreateRequest {
  const owner = { entityId: ownerId, rootPlayerId: ownerId };
  return {
    mugenId, owner, animationOwner: owner, animationSource: 'owner', animNo: 100,
    position: { x: 220, y: 285 }, offset: { x: 0, y: 0 }, velocity: { x: 1, y: 2 }, acceleration: { x: 0.1, y: 0.2 },
    facing: 1, verticalFacing: 1, postype: 'p1', coordinateSpace: 'stage', bind: null, removeTime: 30,
    spritePriority: 0, onTop: false, pauseMoveTime: 0, superMoveTime: 0, removeOnGetHit: false, random: { x: 0, y: 0 },
    render: {
      transparency: 'addalpha', alpha: { source: 200, destination: 56 }, scaleX: 1, scaleY: 1,
      ownPalette: false, shadow: { red: 0, green: 0, blue: 0 },
    },
  };
}

function rendererForFixture(drawImage: ReturnType<typeof vi.fn>, scale: ReturnType<typeof vi.fn>): CanvasRenderer {
  const context = {
    clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(),
    beginPath: vi.fn(), arc: vi.fn(), ellipse: vi.fn(), fill: vi.fn(), fillText: vi.fn(), drawImage, scale,
  } as unknown as CanvasRenderingContext2D;
  const canvas = { width: 640, height: 360, getContext: () => context } as unknown as HTMLCanvasElement;
  const image = {} as HTMLImageElement;
  const sprites: SpritePack = {
    sprites: new Map([
      ['100,0', { groupNo: 100, imageNo: 0, src: '', xAxis: 0, yAxis: 0, image }],
      ['101,0', { groupNo: 101, imageNo: 0, src: '', xAxis: 0, yAxis: 0, image }],
    ]),
  };
  return new CanvasRenderer(canvas, air, null, null, { 1: { airDocument: air, spritePack: sprites } });
}
