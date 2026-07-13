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

const cns = parseCnsText(readFileSync('src/core/explod/fixtures/explod-bindtime.cns', 'utf8'));
const air = parseAirText(readFileSync('src/core/explod/fixtures/modify-explod.air', 'utf8'));

describe('ExplodBindTime explicit-ID compatibility fixture', () => {
  it('changes every owner-scoped duplicate and diagnoses missing or omitted ids', () => {
    const initial = createInitialGameState();
    let state: GameState = { ...initial, players: [{ ...initial.players[0], stateNo: 920 }, initial.players[1]] };
    state = applyExplodCreateEvents(state, [{ type: 'create', request: createRequest(2, 90) }]);
    state = execute(state);

    const ownerOne = state.explods.entries.filter((entry) => entry.owner.entityId === 1);
    expect(ownerOne).toHaveLength(2);
    expect(ownerOne.every((entry) => entry.bind?.remaining === 3)).toBe(true);
    expect(state.explods.entries.find((entry) => entry.owner.entityId === 2)?.bind).toBeNull();
    expect(state.hitDiagnosticLines).toEqual(expect.arrayContaining([
      expect.stringContaining('raw.explod_bindtime owner=p1 id=90 matched=2'),
      expect.stringContaining('internalId=2 old=1 new=3'),
      expect.stringContaining('internalId=3 old=1 new=3'),
      expect.stringContaining('id=999 matched=0 reason=not_found'),
      expect.stringContaining('id=- matched=0 reason=id_missing'),
    ]));
  });

  it('handles zero and missing time without guessing', () => {
    const unbound = executeState(922);
    expect(unbound.explods.entries[0].bind).toBeNull();
    expect(unbound.hitDiagnosticLines?.join('\n')).toContain('internalId=1 old=-1 new=0');

    const missing = execute(seededState(925));
    expect(missing.explods.entries[0].bind).toBeNull();
    expect(missing.hitDiagnosticLines?.join('\n')).toContain('id=90 matched=0 reason=time_missing');
  });

  it('supports indefinite rebinding and follows owner movement', () => {
    let state = { ...seededState(923), frame: 10 };
    state = { ...state, players: [{ ...state.players[0], x: 300 }, state.players[1]] };
    state = stepExplodRuntime(execute(state), () => air);
    expect(state.explods.entries[0]).toMatchObject({ bind: { remaining: -1 }, position: { x: 305, y: 280 } });

    state = { ...state, frame: 11, players: [{ ...state.players[0], x: 330 }, state.players[1]] };
    state = stepExplodRuntime(state, () => air);
    expect(state.explods.entries[0]).toMatchObject({ bind: { remaining: -1 }, position: { x: 335, y: 280 } });
  });

  it('rebinds an unbound Explod, then holds its last world position after expiry', () => {
    let state = { ...seededState(924), frame: 10 };
    state = { ...state, players: [{ ...state.players[0], x: 300 }, state.players[1]] };
    state = stepExplodRuntime(execute(state), () => air);
    expect(state.explods.entries[0]).toMatchObject({ bind: { remaining: 1 }, position: { x: 305, y: 280 } });

    const drawImage = vi.fn();
    const diagnostics = renderer(drawImage).render(state);
    expect(drawImage).toHaveBeenCalledTimes(2);
    expect(diagnostics.join('\n')).toContain('screen=(305,280)');

    state = { ...state, frame: 11, players: [{ ...state.players[0], x: 360 }, state.players[1]] };
    state = stepExplodRuntime(state, () => air);
    expect(state.explods.entries[0]).toMatchObject({ bind: null, position: { x: 305, y: 280 } });
  });

  it('honors false triggers, controller removal order, and empty round reset', () => {
    const untouched = execute(seededState(921));
    expect(untouched.explods.entries[0].bind).toBeNull();
    expect(untouched.hitDiagnosticLines?.join('\n')).not.toContain('raw.explod_bindtime');

    const removed = executeState(926);
    expect(removed.explods.entries).toHaveLength(0);
    expect(removed.hitDiagnosticLines?.join('\n')).toContain('raw.explod_bindtime owner=p1 id=90 matched=0 reason=not_found');
    expect(createInitialGameState().explods.entries).toHaveLength(0);
  });
});

function executeState(stateNo: number): GameState {
  const initial = createInitialGameState();
  return execute({ ...initial, players: [{ ...initial.players[0], stateNo }, initial.players[1]] });
}

function seededState(stateNo: number): GameState {
  const initial = createInitialGameState();
  return applyExplodCreateEvents(
    { ...initial, players: [{ ...initial.players[0], stateNo }, initial.players[1]] },
    [{ type: 'create', request: createRequest(1, 90) }],
  );
}

function execute(state: GameState): GameState {
  const events: ExplodControllerEvent[] = [];
  const result = stepCnsStateRuntime(state, cns, {
    onExplodCreate: (event) => events.push(event),
    onExplodModify: (event) => events.push(event),
    onExplodRemove: (event) => events.push(event),
    onExplodBindTime: (event) => events.push(event),
  });
  return applyExplodControllerEvents(result.state, events);
}

function createRequest(ownerId: 1 | 2, mugenId: number): ExplodCreateRequest {
  const owner = { entityId: ownerId, rootPlayerId: ownerId };
  return {
    mugenId, owner, animationOwner: owner, animationSource: 'owner', animNo: 100,
    position: { x: ownerId === 1 ? 225 : 420, y: 280 }, offset: { x: 5, y: -5 }, velocity: { x: 0, y: 0 }, acceleration: { x: 0, y: 0 },
    facing: ownerId === 1 ? 1 : -1, verticalFacing: 1, postype: 'p1', coordinateSpace: 'stage', bind: null, removeTime: null,
    spritePriority: 0, onTop: false, pauseMoveTime: 0, superMoveTime: 0, removeOnGetHit: false, random: { x: 0, y: 0 },
    render: { transparency: null, alpha: null, scaleX: 1, scaleY: 1, ownPalette: false, shadow: { red: 0, green: 0, blue: 0 } },
  };
}

function renderer(drawImage: ReturnType<typeof vi.fn>): CanvasRenderer {
  const context = {
    clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(),
    beginPath: vi.fn(), arc: vi.fn(), ellipse: vi.fn(), fill: vi.fn(), fillText: vi.fn(), drawImage, scale: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
  const canvas = { width: 640, height: 360, getContext: () => context } as unknown as HTMLCanvasElement;
  const image = {} as HTMLImageElement;
  const sprites: SpritePack = { sprites: new Map([['100,0', { groupNo: 100, imageNo: 0, src: '', xAxis: 0, yAxis: 0, image }]]) };
  return new CanvasRenderer(canvas, air, null, null, { 1: { airDocument: air, spritePack: sprites } });
}
