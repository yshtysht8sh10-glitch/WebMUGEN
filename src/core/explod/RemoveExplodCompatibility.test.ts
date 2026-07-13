import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { parseAirText } from '../../parser/air/AirParser';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { CanvasRenderer } from '../../renderer/canvas2d/CanvasRenderer';
import type { SpritePack } from '../sprite/SpriteTypes';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { createInitialGameState } from '../engine/GameState';
import type { GameState } from '../engine/types';
import {
  applyExplodControllerEvents,
  applyExplodCreateEvents,
  stepExplodRuntime,
  type ExplodControllerEvent,
  type ExplodCreateRequest,
} from './ExplodSystem';

const fixtureCns = parseCnsText(readFileSync('src/core/explod/fixtures/remove-explod.cns', 'utf8'));
const fixtureAir = parseAirText(readFileSync('src/core/explod/fixtures/modify-explod.air', 'utf8'));

describe('RemoveExplod explicit-ID compatibility fixture', () => {
  it('removes every owner-scoped duplicate before lifecycle and same-frame rendering', () => {
    const initial = createInitialGameState();
    let state: GameState = {
      ...initial,
      players: [{ ...initial.players[0], stateNo: 910 }, initial.players[1]],
    };
    state = applyExplodCreateEvents(state, [{ type: 'create', request: createRequest(2, 88) }]);
    state = executeExplodControllers(state, fixtureCns);

    expect(state.explods.entries).toHaveLength(1);
    expect(state.explods.entries[0]).toMatchObject({ owner: { entityId: 2 }, mugenId: 88 });
    expect(state.hitDiagnosticLines).toEqual(expect.arrayContaining([
      expect.stringContaining('id=88 matched=2 internalIds=[2,3] reason=removeexplod'),
      expect.stringContaining('id=999 matched=0 internalIds=[-] reason=not_found'),
      expect.stringContaining('id=- matched=0 reason=id_missing'),
    ]));

    state = stepExplodRuntime(state, () => fixtureAir);
    expect(state.explods.entries).toHaveLength(1);
    const drawImage = vi.fn();
    const diagnostics = rendererForFixture(drawImage).render(state);
    expect(drawImage).toHaveBeenCalledTimes(2);
    expect(diagnostics.filter((line) => line.includes('raw.explod_draw'))).toHaveLength(1);
    expect(diagnostics.join('\n')).not.toContain('internalId=2');
    expect(diagnostics.join('\n')).not.toContain('internalId=3');
  });

  it('preserves controller order for remove-before-modify and modify-before-remove', () => {
    const removedFirst = executeState(912);
    expect(removedFirst.explods.entries).toHaveLength(0);
    expect(removedFirst.hitDiagnosticLines?.join('\n')).toContain('raw.explod_modify owner=p1 id=88 matched=0 reason=not_found');

    const modifiedFirst = executeState(913);
    expect(modifiedFirst.explods.entries).toHaveLength(0);
    expect(modifiedFirst.hitDiagnosticLines?.join('\n')).toContain('raw.explod_modify owner=p1 id=88 matched=1');
    expect(modifiedFirst.hitDiagnosticLines?.join('\n')).toContain('raw.explod_remove owner=p1 id=88 matched=1');
  });

  it('honors false triggers and leaves round reset empty after a removal', () => {
    let state = seededState(911, 88);
    state = executeExplodControllers(state, fixtureCns);
    expect(state.explods.entries).toHaveLength(1);
    expect(state.hitDiagnosticLines?.join('\n')).not.toContain('raw.explod_remove');

    state = executeState(910);
    expect(state.explods.entries).toHaveLength(0);
    expect(createInitialGameState().explods).toEqual({ entries: [], nextRuntimeId: 1 });
  });

  it('executes an explicit RemoveExplod from bundled character CNS data', () => {
    const realCns = parseCnsText(readFileSync('public/chars/T-H-M-A/T-H-M-A/T-H-M-Atokusyudousa.cns', 'utf8'));
    let state = seededState(60, 999);
    state = executeExplodControllers(state, realCns);
    expect(state.explods.entries).toHaveLength(0);
    expect(state.hitDiagnosticLines?.join('\n')).toContain('raw.explod_remove owner=p1 id=999 matched=1');
  });
});

function executeState(stateNo: number): GameState {
  const initial = createInitialGameState();
  return executeExplodControllers({ ...initial, players: [{ ...initial.players[0], stateNo }, initial.players[1]] }, fixtureCns);
}

function seededState(stateNo: number, mugenId: number): GameState {
  const initial = createInitialGameState();
  return applyExplodCreateEvents(
    { ...initial, players: [{ ...initial.players[0], stateNo }, initial.players[1]] },
    [{ type: 'create', request: createRequest(1, mugenId) }],
  );
}

function executeExplodControllers(state: GameState, cns: ReturnType<typeof parseCnsText>): GameState {
  const events: ExplodControllerEvent[] = [];
  const result = stepCnsStateRuntime(state, cns, {
    onExplodCreate: (event) => events.push(event),
    onExplodModify: (event) => events.push(event),
    onExplodRemove: (event) => events.push(event),
  });
  return applyExplodControllerEvents(result.state, events);
}

function createRequest(ownerId: 1 | 2, mugenId: number): ExplodCreateRequest {
  const owner = { entityId: ownerId, rootPlayerId: ownerId };
  return {
    mugenId, owner, animationOwner: owner, animationSource: 'owner', animNo: 100,
    position: { x: ownerId === 1 ? 220 : 420, y: 285 }, offset: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, acceleration: { x: 0, y: 0 },
    facing: ownerId === 1 ? 1 : -1, verticalFacing: 1, postype: 'p1', coordinateSpace: 'stage',
    bind: { targetEntityId: ownerId, remaining: -1, offsetX: 0, offsetY: 0 }, removeTime: null,
    spritePriority: 0, onTop: false, pauseMoveTime: 0, superMoveTime: 0, removeOnGetHit: false, random: { x: 0, y: 0 },
    render: { transparency: null, alpha: null, scaleX: 1, scaleY: 1, ownPalette: false, shadow: { red: 0, green: 0, blue: 0 } },
  };
}

function rendererForFixture(drawImage: ReturnType<typeof vi.fn>): CanvasRenderer {
  const context = {
    clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(),
    beginPath: vi.fn(), arc: vi.fn(), ellipse: vi.fn(), fill: vi.fn(), fillText: vi.fn(), drawImage, scale: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
  const canvas = { width: 640, height: 360, getContext: () => context } as unknown as HTMLCanvasElement;
  const image = {} as HTMLImageElement;
  const sprites: SpritePack = { sprites: new Map([['100,0', { groupNo: 100, imageNo: 0, src: '', xAxis: 0, yAxis: 0, image }]]) };
  return new CanvasRenderer(canvas, fixtureAir, null, null, {
    1: { airDocument: fixtureAir, spritePack: sprites },
    2: { airDocument: fixtureAir, spritePack: sprites },
  });
}
