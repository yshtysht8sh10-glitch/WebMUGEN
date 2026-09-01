import { describe, expect, it } from 'vitest';
import { createInitialGameState } from './GameState';
import { createInitialRoundScore } from './RoundScore';
import { createInitialRoundState } from './RoundState';
import {
  applyRoundFlowStateEntries,
  isMatchOver,
  isCharacterIntroInputActive,
  isIntroSkipButtonHeld,
  ROUND_INITIALIZE_STATE,
  ROUND_RESULT_FRAMES,
  shouldStartNextRound,
  shouldStartNextMatch,
  requestRoundResultSkip,
  skipRoundIntro,
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

  it('locks KO winner control and waits for State 0 before entering the victory state', () => {
    const initial = createInitialGameState();
    const round = { ...createInitialRoundState(), phase: 'ko' as const, winner: 1 as const, endReason: 'ko' as const };
    const airborne = { ...initial, players: [{ ...initial.players[0], stateNo: 50, stateType: 'A' as const, y: -40, ctrl: true }, { ...initial.players[1], life: 0, stateNo: 5150 }] as typeof initial.players };
    expect(applyRoundFlowStateEntries(airborne, round).players[0]).toMatchObject({ stateNo: 50, ctrl: false });
    const landing = { ...airborne, players: [{ ...airborne.players[0], stateNo: 52, stateType: 'S' as const, y: 0, ctrl: true }, airborne.players[1]] as typeof initial.players };
    expect(applyRoundFlowStateEntries(landing, round).players[0]).toMatchObject({ stateNo: 52, ctrl: false });
    const neutral = { ...landing, players: [{ ...landing.players[0], stateNo: 0 }, landing.players[1]] as typeof initial.players };
    expect(applyRoundFlowStateEntries(neutral, round).players[0]).toMatchObject({ stateNo: 180, ctrl: false });
  });

  it('skips character intro states after initialization while retaining presentation flow', () => {
    const initial = createInitialGameState();
    const intro = {
      ...initial,
      players: [
        { ...initial.players[0], stateNo: 191, ctrl: false },
        {
          ...initial.players[1], stateNo: 193, stateType: 'A' as const, physics: 'N' as const,
          y: 183.17, vx: 1.5, vy: 0.41, ctrl: false,
        },
      ] as typeof initial.players,
      projectiles: [{} as (typeof initial.projectiles)[number]],
      helpers: {
        ...initial.helpers,
        entries: [{} as (typeof initial.helpers.entries)[number]],
      },
      explods: {
        ...initial.explods,
        entries: [{} as (typeof initial.explods.entries)[number]],
      },
    };
    const round = { ...createInitialRoundState(), frameInPhase: 1 };
    const skipped = skipRoundIntro(intro, round);
    expect(skipped.players.map((player) => player.stateNo)).toEqual([0, 0]);
    expect(skipped.players.every((player) => player.ctrl)).toBe(true);
    expect(skipped.players[1]).toMatchObject({
      y: 285, vx: 0, vy: 0, stateType: 'S', physics: 'S', animNo: 0,
    });
    expect(skipped.projectiles).toHaveLength(0);
    expect(skipped.helpers.entries).toHaveLength(0);
    expect(skipped.explods.entries).toHaveLength(0);
  });

  it('reserves only attack and Start buttons for character intro skipping', () => {
    const neutral = { left: false, right: false, up: false, down: false, attack: false };
    expect(isIntroSkipButtonHeld({ ...neutral, left: true }, neutral)).toBe(false);
    expect(isIntroSkipButtonHeld(neutral, { ...neutral, up: true })).toBe(false);
    expect(isIntroSkipButtonHeld({ ...neutral, attack: true, buttons: ['a'] }, neutral)).toBe(true);
    expect(isIntroSkipButtonHeld(neutral, { ...neutral, buttons: new Set(['x']) })).toBe(true);
    expect(isIntroSkipButtonHeld(neutral, { ...neutral, buttons: ['s'] })).toBe(true);
  });

  it('enables character commands only during the character-owned part of the intro', () => {
    const initial = createInitialGameState();
    const round = { ...createInitialRoundState(), frameInPhase: 1 };
    const characterIntro = {
      ...initial,
      players: [{ ...initial.players[0], stateNo: 191 }, initial.players[1]] as typeof initial.players,
    };
    expect(isCharacterIntroInputActive(characterIntro, round)).toBe(true);
    expect(isCharacterIntroInputActive(initial, { ...round, introPresentationFrame: 1 })).toBe(false);
    expect(isCharacterIntroInputActive(characterIntro, { ...round, phase: 'fight' })).toBe(false);
  });

  it('does not clear rebuilt effects when input arrives after both character intros have ended', () => {
    const initial = createInitialGameState();
    const presentation = {
      ...initial,
      helpers: {
        ...initial.helpers,
        entries: [{} as (typeof initial.helpers.entries)[number]],
      },
    };
    const round = { ...createInitialRoundState(), frameInPhase: 80 };
    expect(skipRoundIntro(presentation, round)).toBe(presentation);
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
    const round = { ...createInitialRoundState(), phase: 'ko' as const, winner: 1 as const, frameInPhase: ROUND_RESULT_FRAMES, resultStateEntered: true };
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
    expect(shouldStartNextMatch(round, matchScore, state)).toBe(true);
    expect(winMugenRoundState({ ...round, frameInPhase: 0 })).toBe(3);
    expect(winMugenRoundState({ ...round, frameInPhase: 1 })).toBe(4);
  });

  it('lets a new result-phase input skip victory presentation and roundnotover', () => {
    const round = { ...createInitialRoundState(), phase: 'ko' as const, winner: 1 as const, resultStateEntered: true, frameInPhase: 12 };
    const skipped = requestRoundResultSkip(round);
    const state = createInitialGameState();
    const heldVictory = { ...state, players: [{ ...state.players[0], assertSpecialFlags: ['roundnotover'] }, state.players[1]] as typeof state.players };
    expect(skipped).toMatchObject({ frameInPhase: ROUND_RESULT_FRAMES, resultSkipRequested: true });
    expect(shouldStartNextRound(skipped, { ...createInitialRoundScore(), p1Wins: 1 }, heldVictory)).toBe(true);
  });
});
