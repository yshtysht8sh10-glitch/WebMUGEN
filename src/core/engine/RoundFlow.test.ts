import { describe, expect, it } from 'vitest';
import { createInitialGameState } from './GameState';
import { createInitialRoundScore } from './RoundScore';
import { createInitialRoundState } from './RoundState';
import {
  applyRoundFlowStateEntries,
  isMatchOver,
  ROUND_INITIALIZE_STATE,
  ROUND_RESULT_FRAMES,
  shouldStartNextRound,
  winMugenRoundState,
} from './RoundFlow';

describe('Issue #93 WinMUGEN Round Flow coordinator', () => {
  it('enters Initialize State 5900 for both players and exposes RoundState 0 then 1', () => {
    const round = createInitialRoundState();
    const entered = applyRoundFlowStateEntries(createInitialGameState(), round);
    expect(entered.players.map((player) => player.stateNo)).toEqual([ROUND_INITIALIZE_STATE, ROUND_INITIALIZE_STATE]);
    expect(entered.players.every((player) => player.ctrl === false && player.stateTime === 0)).toBe(true);
    expect(winMugenRoundState(round)).toBe(0);
    expect(winMugenRoundState({ ...round, frameInPhase: 1 })).toBe(1);
  });

  it('finishes a later-round Initialize State at State 0 when no Intro route is selected', () => {
    const initial = createInitialGameState();
    const initialized = {
      ...initial,
      players: initial.players.map((player) => ({ ...player, stateNo: ROUND_INITIALIZE_STATE })) as typeof initial.players,
    };
    const fight = applyRoundFlowStateEntries(initialized, {
      ...createInitialRoundState(), phase: 'fight', roundNo: 2, frameInPhase: 0,
    });
    expect(fight.players.map((player) => player.stateNo)).toEqual([0, 0]);
    expect(fight.players.every((player) => player.ctrl === true && player.stateTime === 0)).toBe(true);
  });

  it('keeps KO losers down while time-over still uses State 170/175', () => {
    const initial = createInitialGameState();
    const koState = {
      ...initial,
      players: [initial.players[0], { ...initial.players[1], life: 0, stateNo: 5150, animNo: 5150 }] as typeof initial.players,
    };
    const p1Win = applyRoundFlowStateEntries(koState, {
      ...createInitialRoundState(), phase: 'ko', winner: 1, endReason: 'ko', frameInPhase: 0,
    });
    expect(p1Win.players.map((player) => player.stateNo)).toEqual([180, 5150]);
    const p2Win = applyRoundFlowStateEntries(initial, {
      ...createInitialRoundState(), phase: 'timeOver', winner: 2, endReason: 'time_over', frameInPhase: 0,
    });
    expect(p2Win.players.map((player) => player.stateNo)).toEqual([170, 180]);
    const draw = applyRoundFlowStateEntries(initial, {
      ...createInitialRoundState(), phase: 'timeOver', winner: 'draw', endReason: 'time_over', frameInPhase: 0,
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
    const state = createInitialGameState();
    expect(shouldStartNextRound(round, { ...createInitialRoundScore(), p1Wins: 1 }, state)).toBe(true);
    const heldVictory = {
      ...state,
      players: [{ ...state.players[0], assertSpecialFlags: ['roundnotover'] }, state.players[1]] as typeof state.players,
    };
    expect(shouldStartNextRound(round, { ...createInitialRoundScore(), p1Wins: 1 }, heldVictory)).toBe(false);
    const matchScore = { ...createInitialRoundScore(), p1Wins: 2 };
    expect(isMatchOver(matchScore)).toBe(true);
    expect(shouldStartNextRound(round, matchScore, state)).toBe(false);
    expect(winMugenRoundState({ ...round, frameInPhase: 0 })).toBe(3);
    expect(winMugenRoundState({ ...round, frameInPhase: 1 })).toBe(4);
  });
});
