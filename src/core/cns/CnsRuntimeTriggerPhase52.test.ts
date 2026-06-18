import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../engine/GameState';
import { evaluateExtendedCnsTrigger } from './CnsRuntimeTriggerPhase52';

describe('Phase52 extended CNS triggers', () => {
  const state = createInitialGameState();
  const player = { ...state.players[0], x: 100, y: 360, facing: 1 as const };
  const opponent = { ...state.players[1], x: 140, y: 350 };

  it('evaluates distance/contact/count triggers', () => {
    expect(evaluateExtendedCnsTrigger('P2BodyDist X < 50', { player, opponent })).toBe(true);
    expect(evaluateExtendedCnsTrigger('P2BodyDist Y = -10', { player, opponent })).toBe(true);
    expect(evaluateExtendedCnsTrigger('FrontEdgeBodyDist > 800', { player, stage: { left: 0, right: 960 } })).toBe(true);
    expect(evaluateExtendedCnsTrigger('BackEdgeBodyDist = 100', { player, stage: { left: 0, right: 960 } })).toBe(true);
    expect(evaluateExtendedCnsTrigger('MoveContact', { player, moveContact: true })).toBe(true);
    expect(evaluateExtendedCnsTrigger('HitShakeOver', { player, hitShakeOver: true })).toBe(true);
    expect(evaluateExtendedCnsTrigger('NumHelper(1000) = 2', { player, helperCount: 2 })).toBe(true);
    expect(evaluateExtendedCnsTrigger('NumProj > 0', { player, projectileCount: 1 })).toBe(true);
  });
});
