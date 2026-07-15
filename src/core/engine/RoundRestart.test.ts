import { describe, expect, it } from 'vitest';
import { createInitialHitFeedbackState } from './HitFeedback';
import { createInitialRoundState } from './RoundState';
import { canRestartRound, restartRound } from './RoundRestart';

describe('RoundRestart', () => {
  it('allows restart after KO', () => {
    expect(canRestartRound({ ...createInitialRoundState(), phase: 'ko' })).toBe(true);
  });

  it('does not allow restart while fighting', () => {
    expect(canRestartRound({ ...createInitialRoundState(), phase: 'fight' })).toBe(false);
  });

  it('creates fresh runtime state for next round', () => {
    const restarted = restartRound(1);

    expect(restarted.roundState.roundNo).toBe(2);
    expect(restarted.roundState.phase).toBe('intro');
    expect(restarted.gameState.players[0].life).toBe(1000);
    expect(restarted.gameState.players[0].targets).toEqual([]);
    expect(restarted.gameState.explods).toEqual({ entries: [], nextRuntimeId: 1 });
    expect(restarted.hitFeedbackState).toEqual(createInitialHitFeedbackState());
  });

  it('resets current power while preserving the character power maximum', () => {
    const restarted = restartRound(1, undefined, 9000);

    expect(restarted.gameState.players.map((player) => [player.power, player.powerMax])).toEqual([
      [0, 9000],
      [0, 9000],
    ]);
  });
});
