import type { RoundScore } from './RoundScore';
import type { RoundState } from './RoundState';
import type { GameState, PlayerState } from './types';

export const ROUND_RESULT_FRAMES = 180;
export const ROUNDS_TO_WIN = 2;

export function applyRoundFlowStateEntries(state: GameState, round: RoundState): GameState {
  if (round.frameInPhase !== 0) return state;
  if (round.phase === 'intro') return enterPlayers(state, [190, 190]);
  if ((round.phase === 'ko' || round.phase === 'timeOver') && round.winner !== null) {
    if (round.winner === 'draw') return enterPlayers(state, [175, 175]);
    return enterPlayers(state, round.winner === 1 ? [180, 170] : [170, 180]);
  }
  return state;
}

export function winMugenRoundState(round: RoundState, matchOver: boolean = false): 0 | 1 | 2 | 3 | 4 {
  if (matchOver) return 4;
  if (round.phase === 'intro') return round.frameInPhase === 0 ? 0 : 1;
  if (round.phase === 'fight') return 2;
  return 3;
}

export function isMatchOver(score: RoundScore): boolean {
  return score.p1Wins >= ROUNDS_TO_WIN || score.p2Wins >= ROUNDS_TO_WIN;
}

export function shouldStartNextRound(round: RoundState, score: RoundScore): boolean {
  return (round.phase === 'ko' || round.phase === 'timeOver')
    && round.frameInPhase >= ROUND_RESULT_FRAMES
    && !isMatchOver(score);
}

function enterPlayers(state: GameState, stateNos: readonly [number, number]): GameState {
  return {
    ...state,
    players: state.players.map((player, index) => isInEntryFamily(player.stateNo, stateNos[index])
      ? player
      : enterRoundState(player, stateNos[index])) as GameState['players'],
    projectiles: [],
    hitEvents: [],
  };
}

function isInEntryFamily(current: number, entry: number): boolean {
  if (entry === 190) return current >= 190 && current <= 199;
  if (entry === 180) return current >= 180 && current <= 189;
  return current >= 170 && current <= 179;
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
    ctrl: false,
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
