import type { GameState, PlayerState } from '../engine/types';

export const FULL_LIFE = 1000;

export function applyPracticeModeRecovery(state: GameState, enabled: boolean): GameState {
  if (!enabled) return state;

  const players = state.players.map(recoverPlayer) as GameState['players'];
  if (players.every((player, index) => player === state.players[index])) return state;

  const diagnostics = players.flatMap((player, index) => {
    const before = state.players[index];
    if (player === before) return [];
    return [`raw.practice_mode timing=before_round entity=p${player.id} before=${before.life} after=${player.life} result=full_recovery`];
  });

  return {
    ...state,
    players,
    hitDiagnosticLines: [...(state.hitDiagnosticLines ?? []), ...diagnostics],
  };
}

function recoverPlayer(player: PlayerState): PlayerState {
  if (player.life > 0) return player;
  return {
    ...player,
    life: FULL_LIFE,
    koReason: undefined,
  };
}
