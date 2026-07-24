import { describe, expect, it } from 'vitest';
import { createInitialGameState } from './GameState';
import { createInitialRoundScore } from './RoundScore';
import { createInitialRoundState } from './RoundState';
import {
  applyRoundFlowStateEntries,
  isMatchOver,
  ROUND_RESULT_FRAMES,
  shouldStartNextRound,
  winMugenRoundState,
} from './RoundFlow';

describe('Issue #93 WinMUGEN Round Flow coordinator', () => {
  it('enters PreIntro State 190 for both players and exposes RoundState 0 then 1', () => {
    const round = createInitialRoundState();
    const entered = applyRoundFlowStateEntries(createInitialGameState(), round);
    expect(entered.players.map((player) => player.stateNo)).toEqual([190, 190]);
    expect(entered.players.every((player) => player.ctrl === false && player.stateTime === 0)).toBe(true);
    expect(winMugenRoundState(round)).toBe(0);
    expect(winMugenRoundState({ ...round, frameInPhase: 1 })).toBe(1);
  });

  it('enters winner State 180, loser State 170, and draw State 175 symmetrically', () => {
    const initial = createInitialGameState();
    const p1Win = applyRoundFlowStateEntries(initial, {
      ...createInitialRoundState(), phase: 'ko', winner: 1, endReason: 'ko', frameInPhase: 0,
    });
    expect(p1Win.players.map((player) => player.stateNo)).toEqual([180, 170]);
    const p2Win = applyRoundFlowStateEntries(initial, {
      ...createInitialRoundState(), phase: 'timeOver', winner: 2, endReason: 'time_over', frameInPhase: 0,
    });
    expect(p2Win.players.map((player) => player.stateNo)).toEqual([170, 180]);
    const draw = applyRoundFlowStateEntries(initial, {
      ...createInitialRoundState(), phase: 'ko', winner: 'draw', endReason: 'double_ko', frameInPhase: 0,
    });
    expect(draw.players.map((player) => player.stateNo)).toEqual([175, 175]);
  });

  it('does not restart a character-owned intro or result substate while the round clock is paused at frame zero', () => {
    const initial = createInitialGameState();
    const intro = applyRoundFlowStateEntries({
      ...initial,
      players: [{ ...initial.players[0], stateNo: 195, stateTime: 7 }, initial.players[1]],
    }, createInitialRoundState());
    expect(intro.players[0]).toMatchObject({ stateNo: 195, stateTime: 7 });

    const result = applyRoundFlowStateEntries({
      ...initial,
      players: [{ ...initial.players[0], stateNo: 183, stateTime: 9 }, { ...initial.players[1], stateNo: 170, stateTime: 9 }],
    }, { ...createInitialRoundState(), phase: 'ko', winner: 1, frameInPhase: 0 });
    expect(result.players.map((player) => [player.stateNo, player.stateTime])).toEqual([[183, 9], [170, 9]]);
  });

  it('advances after the result presentation unless either player has won the match', () => {
    const round = { ...createInitialRoundState(), phase: 'ko' as const, winner: 1 as const, frameInPhase: ROUND_RESULT_FRAMES };
    expect(shouldStartNextRound(round, { ...createInitialRoundScore(), p1Wins: 1 })).toBe(true);
    const matchScore = { ...createInitialRoundScore(), p1Wins: 2 };
    expect(isMatchOver(matchScore)).toBe(true);
    expect(shouldStartNextRound(round, matchScore)).toBe(false);
    expect(winMugenRoundState(round, true)).toBe(4);
  });
});
