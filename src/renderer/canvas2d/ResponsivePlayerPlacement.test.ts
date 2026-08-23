import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../../core/engine/GameState';
import { applyExplodCreateEvents, type ExplodCreateRequest } from '../../core/explod/ExplodSystem';
import {
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

  it('does not offset the authored world in a WinMUGEN logical viewport', () => {
    const offset = resolveBuiltInStageWorldVisualOffset(240);

    expect(offset).toBe(0);
  });

  it('moves the wide-view ground from the fixed stage axis instead of a player position', () => {
    const offset = resolveBuiltInStageWorldVisualOffset(540);

    expect(offset).toBe(180);
    expect(285 + offset).toBe(465);
  });

  it('does not let a standing-typed special-state position change the fixed offset', () => {
    expect(resolveBuiltInStageWorldVisualOffset(240)).toBe(0);
    expect(resolveBuiltInStageWorldVisualOffset(540)).toBe(180);
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
