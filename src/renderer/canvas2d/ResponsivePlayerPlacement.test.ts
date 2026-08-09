import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../../core/engine/GameState';
import { applyExplodCreateEvents, type ExplodCreateRequest } from '../../core/explod/ExplodSystem';
import {
  resolveBuiltInStageGroundReferenceYs,
  resolveBuiltInStageWorldVisualOffset,
  shiftBuiltInStageWorldVisuals,
  usesResponsiveBuiltInStagePlacement,
} from './ResponsivePlayerPlacement';

describe('responsive built-in stage world placement', () => {
  it.each(['fresh', 'cyber', 'fresh-clasic', 'cyber-clasic'] as const)(
    'applies the stable visual floor to %s',
    (theme) => expect(usesResponsiveBuiltInStagePlacement(theme)).toBe(true),
  );

  it('preserves external Stage DEF placement', () => {
    expect(usesResponsiveBuiltInStagePlacement('external')).toBe(false);
  });

  it('keeps the intentional extended-view ground line without a second player-only offset', () => {
    const offset = resolveBuiltInStageWorldVisualOffset([285, 285], 65, 240);

    expect(offset).toBe(2);
    expect(285 + offset - 65).toBe(222);
  });

  it('moves the wide-view Cyber ground toward the same lower presentation used by Fresh', () => {
    const offset = resolveBuiltInStageWorldVisualOffset([285, 285], 0, 540);

    expect(offset).toBe(180);
    expect(285 + offset).toBe(465);
  });

  it('does not move a standing player when a lying opponent uses below-floor bounce coordinates', () => {
    const state = createInitialGameState();
    const players = [
      { ...state.players[0], stateType: 'S' as const, y: 285 },
      { ...state.players[1], stateType: 'L' as const, y: 305 },
    ];

    const groundReferenceYs = resolveBuiltInStageGroundReferenceYs(players);
    const offset = resolveBuiltInStageWorldVisualOffset(groundReferenceYs, 65, 240);

    expect(groundReferenceYs).toEqual([285]);
    expect(offset).toBe(2);
  });

  it('retains the prior visual floor when every player is airborne or lying down', () => {
    const state = createInitialGameState();
    const players = [
      { ...state.players[0], stateType: 'A' as const, y: 180 },
      { ...state.players[1], stateType: 'L' as const, y: 305 },
    ];

    expect(resolveBuiltInStageGroundReferenceYs(players)).toEqual([]);
  });

  it('keeps stage-space p1/p2 Explods aligned while leaving screen-space Explods fixed', () => {
    let state = createInitialGameState(undefined, {}, [380, 580]);
    state = applyExplodCreateEvents(state, [
      { type: 'create', request: request({ position: { x: 400, y: 235 }, postype: 'p1', coordinateSpace: 'stage' }) },
      { type: 'create', request: request({ position: { x: 0, y: 40 }, postype: 'left', coordinateSpace: 'screen' }) },
    ]);

    const shifted = shiftBuiltInStageWorldVisuals(state, 32);

    expect(shifted.players[0].y).toBe(state.players[0].y + 32);
    expect(shifted.explods.entries[0].position.y).toBe(267);
    expect(shifted.explods.entries[0].position.y - shifted.players[0].y)
      .toBe(state.explods.entries[0].position.y - state.players[0].y);
    expect(shifted.explods.entries[1].position).toEqual({ x: 0, y: 40 });
  });
});

function request(overrides: Partial<ExplodCreateRequest>): ExplodCreateRequest {
  const owner = { entityId: 1, rootPlayerId: 1 as const };
  return {
    mugenId: 1,
    owner,
    animationOwner: owner,
    animationSource: 'owner',
    animNo: 100,
    position: { x: 380, y: 285 },
    offset: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    acceleration: { x: 0, y: 0 },
    facing: 1,
    verticalFacing: 1,
    postype: 'p1',
    coordinateSpace: 'stage',
    bind: null,
    removeTime: -2,
    spritePriority: 0,
    onTop: false,
    pauseMoveTime: 0,
    superMoveTime: 0,
    removeOnGetHit: false,
    random: { x: 0, y: 0 },
    render: {
      transparency: null,
      alpha: null,
      scaleX: 1,
      scaleY: 1,
      ownPalette: false,
      shadow: { red: 0, green: 0, blue: 0 },
    },
    ...overrides,
  };
}
