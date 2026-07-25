import type { RoundScore } from './RoundScore';
import type { RoundState } from './RoundState';
import type { GameState, PlayerState } from './types';

export const ROUND_RESULT_FRAMES = 180;
export const ROUNDS_TO_WIN = 2;
export const ROUND_INITIALIZE_STATE = 5900;

export function applyRoundFlowStateEntries(state: GameState, round: RoundState): GameState {
  if (round.frameInPhase !== 0) return state;
  if (round.phase === 'intro') return enterPlayers(state, [ROUND_INITIALIZE_STATE, ROUND_INITIALIZE_STATE]);
  if (round.phase === 'fight') return finishRoundInitialization(state);
  if ((round.phase === 'ko' || round.phase === 'timeOver') && round.winner !== null) {
    if (round.phase === 'ko') {
      if (round.winner === 'draw') return enterPlayers(state, [null, null]);
      return enterPlayers(state, round.winner === 1 ? [180, null] : [null, 180]);
    }
    if (round.winner === 'draw') return enterPlayers(state, [175, 175]);
    return enterPlayers(state, round.winner === 1 ? [180, 170] : [170, 180]);
  }
  return state;
}

export function winMugenRoundState(round: RoundState): 0 | 1 | 2 | 3 | 4 {
  if (round.phase === 'intro') return round.frameInPhase === 0 ? 0 : 1;
  if (round.phase === 'fight') return 2;
  return round.frameInPhase === 0 ? 3 : 4;
}

export function isMatchOver(score: RoundScore): boolean {
  return score.p1Wins >= ROUNDS_TO_WIN || score.p2Wins >= ROUNDS_TO_WIN;
}

export function shouldStartNextRound(round: RoundState, score: RoundScore, state?: GameState): boolean {
  return (round.phase === 'ko' || round.phase === 'timeOver')
    && round.frameInPhase >= ROUND_RESULT_FRAMES
    && !isMatchOver(score)
    && !state?.players.some((player) => player.assertSpecialFlags?.some((flag) => flag.toLowerCase() === 'roundnotover'));
}

function enterPlayers(state: GameState, stateNos: readonly [number | null, number | null]): GameState {
  return {
    ...state,
    players: state.players.map((player, index) => stateNos[index] === null || isInEntryFamily(player.stateNo, stateNos[index])
      ? player
      : enterRoundState(player, stateNos[index])) as GameState['players'],
    projectiles: [],
    hitEvents: [],
  };
}

function isInEntryFamily(current: number, entry: number): boolean {
  if (entry === ROUND_INITIALIZE_STATE) {
    return current === ROUND_INITIALIZE_STATE || (current >= 190 && current <= 199);
  }
  if (entry === 190) return current >= 190 && current <= 199;
  if (entry === 180) return current >= 180 && current <= 189;
  return current >= 170 && current <= 179;
}

function finishRoundInitialization(state: GameState): GameState {
  const players = state.players.map((player) => (
    player.stateNo === ROUND_INITIALIZE_STATE || (player.stateNo >= 190 && player.stateNo <= 199)
      ? enterRoundState(player, 0)
      : player
  )) as GameState['players'];
  return players.every((player, index) => player === state.players[index])
    ? state
    : { ...state, players };
}

function enterRoundState(player: PlayerState, stateNo: number): PlayerState {
  const selfOwnerId = (player.selfStateOwnerId ?? player.id) as 1 | 2;
  return {
    ...player,
    prevStateNo: player.stateNo,
    stateNo,
    stateTime: 0,
    stateHeaderAppliedStateNo: undefined,
    animTime: 0,
    ctrl: stateNo === 0,
    moveType: 'I',
    hitPause: 0,
    activeHitDef: null,
    hitDefUsed: false,
    hitTargets: [],
    targets: [],
    moveContact: undefined,
    stateOwnerId: selfOwnerId,
    animationOwnerId: selfOwnerId,
  };
}
