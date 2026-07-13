import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../engine/GameState';
import type { GameState } from '../engine/types';
import type { ExplodRuntimeEntry } from './ExplodSystem';
import { stepExplodRuntime } from './ExplodSystem';
import type { AirDocument } from '../../parser/air/AirTypes';

describe('Explod lifecycle', () => {
  it.each([
    { removeTime: 0, expectedAfterCreation: 0 },
    { removeTime: 1, expectedAfterCreation: 1 },
    { removeTime: null, expectedAfterCreation: 1 },
    { removeTime: -2, expectedAfterCreation: 1 },
  ])('handles creation-frame removetime $removeTime', ({ removeTime, expectedAfterCreation }) => {
    const state = withEntries([entry({ removeTime })]);
    expect(stepExplodRuntime(state, () => finiteAir()).explods.entries).toHaveLength(expectedAfterCreation);
  });

  it('removes a positive removetime after exactly that many displayed ticks', () => {
    let state = stepExplodRuntime(withEntries([entry({ removeTime: 2 })]), () => finiteAir());
    state = { ...state, frame: 1 };
    state = stepExplodRuntime(state, () => finiteAir());
    expect(state.explods.entries[0]).toMatchObject({ age: 1, animTime: 1, animElement: 1 });
    state = { ...state, frame: 2 };
    state = stepExplodRuntime(state, () => finiteAir());
    expect(state.explods.entries).toEqual([]);
    expect(state.hitDiagnosticLines?.join('\n')).toContain('reason=removetime age=2');
  });

  it('keeps -1 indefinitely and removes -2 when a finite AIR AnimTime reaches zero', () => {
    let state = stepExplodRuntime(withEntries([entry({ runtimeId: 1, removeTime: null }), entry({ runtimeId: 2, removeTime: -2 })]), () => finiteAir());
    for (let frame = 1; frame <= 3; frame += 1) {
      state = stepExplodRuntime({ ...state, frame }, () => finiteAir());
    }
    expect(state.explods.entries.map((candidate) => candidate.runtimeId)).toEqual([1]);
    expect(state.explods.entries[0]).toMatchObject({ age: 3, animTime: 3, animElement: 2 });
    expect(state.hitDiagnosticLines?.join('\n')).toContain('internalId=2 mugenId=1 result=removed reason=animtime_zero');
  });

  it('does not remove -2 for LoopStart or an infinite AIR element', () => {
    let loopState = stepExplodRuntime(withEntries([entry({ removeTime: -2 })]), () => loopAir());
    let infiniteState = stepExplodRuntime(withEntries([entry({ removeTime: -2 })]), () => infiniteAir());
    for (let frame = 1; frame <= 10; frame += 1) {
      loopState = stepExplodRuntime({ ...loopState, frame }, () => loopAir());
      infiniteState = stepExplodRuntime({ ...infiniteState, frame }, () => infiniteAir());
    }
    expect(loopState.explods.entries).toHaveLength(1);
    expect(infiniteState.explods.entries).toHaveLength(1);
  });

  it('follows the bind owner only during bindtime and then keeps the last world position', () => {
    let state = withEntries([entry({ bind: { targetEntityId: 1, remaining: 3, offsetX: 10, offsetY: -20 }, position: { x: 110, y: 180 } })]);
    state = stepExplodRuntime(state, () => finiteAir());
    state = { ...state, frame: 1, players: [{ ...state.players[0], x: 120, y: 210 }, state.players[1]] };
    state = stepExplodRuntime(state, () => finiteAir());
    expect(state.explods.entries[0]).toMatchObject({ position: { x: 130, y: 190 }, bind: { remaining: 2 } });
    state = { ...state, frame: 2, players: [{ ...state.players[0], x: 140, y: 220 }, state.players[1]] };
    state = stepExplodRuntime(state, () => finiteAir());
    expect(state.explods.entries[0]).toMatchObject({ position: { x: 150, y: 200 }, bind: { remaining: 1 } });
    state = { ...state, frame: 3, players: [{ ...state.players[0], x: 160, y: 230 }, state.players[1]] };
    state = stepExplodRuntime(state, () => finiteAir());
    expect(state.explods.entries[0]).toMatchObject({ position: { x: 150, y: 200 }, bind: null });
  });

  it('keeps bindtime -1 and releases safely when the target disappears', () => {
    let state = stepExplodRuntime(withEntries([entry({ bind: { targetEntityId: 1, remaining: -1, offsetX: 5, offsetY: -5 } })]), () => finiteAir());
    state = { ...state, frame: 1, players: [{ ...state.players[0], x: 130, y: 220 }, state.players[1]] };
    state = stepExplodRuntime(state, () => finiteAir());
    expect(state.explods.entries[0]).toMatchObject({ position: { x: 135, y: 215 }, bind: { remaining: -1 } });
    state = { ...state, frame: 2, players: [state.players[1], { ...state.players[1], id: 2 }] };
    state = stepExplodRuntime(state, () => finiteAir());
    expect(state.explods.entries[0]).toMatchObject({ position: { x: 135, y: 215 }, bind: null });
    expect(state.hitDiagnosticLines?.join('\n')).toContain('bindResult=released_owner_missing');
  });
});

function withEntries(entries: ExplodRuntimeEntry[]): GameState {
  const state = createInitialGameState();
  return { ...state, players: [{ ...state.players[0], x: 100, y: 200 }, state.players[1]], explods: { entries, nextRuntimeId: 10 } };
}

function entry(overrides: Partial<ExplodRuntimeEntry> = {}): ExplodRuntimeEntry {
  return {
    runtimeId: 1, mugenId: 1, owner: { entityId: 1, rootPlayerId: 1 }, animationOwner: { entityId: 1, rootPlayerId: 1 },
    animationSource: 'owner', animNo: 100, animTime: 0, animElement: 0, creationFrame: 0, age: 0,
    position: { x: 100, y: 200 }, offset: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, acceleration: { x: 0, y: 0 },
    facing: 1, verticalFacing: 1, postype: 'p1', coordinateSpace: 'stage', bind: null, removeTime: null, removalReason: null,
    spritePriority: 0, onTop: false, pauseMoveTime: 0, superMoveTime: 0, removeOnGetHit: false, random: { x: 0, y: 0 },
    render: { transparency: null, alpha: null, scaleX: 1, scaleY: 1, ownPalette: false, shadow: 0 },
    ...overrides,
  };
}

function finiteAir(): AirDocument {
  return { actions: [{ actionNo: 100, elements: [element(2, 0), element(1, 1)], defaultClsn1: [], defaultClsn2: [] }] };
}

function loopAir(): AirDocument {
  return { actions: [{ actionNo: 100, loopStartIndex: 1, elements: [element(1, 0), element(1, 1)], defaultClsn1: [], defaultClsn2: [] }] };
}

function infiniteAir(): AirDocument {
  return { actions: [{ actionNo: 100, elements: [element(-1, 0)], defaultClsn1: [], defaultClsn2: [] }] };
}

function element(duration: number, imageNo: number) {
  return { groupNo: 100, imageNo, offsetX: 0, offsetY: 0, duration, clsn1: [], clsn2: [] };
}
