import type { GameState, PlayerState } from '../engine/types';
import { readPlayerPowerMax } from './PowerGauge';

export type InfinitePowerMode = 'off' | 'p1' | 'p2' | 'both';

export function applyInfinitePowerAtFrameStart(state: GameState, mode: InfinitePowerMode): GameState {
  const players: [PlayerState, PlayerState] = [
    applyPlayerInfinitePower(state.players[0], mode === 'p1' || mode === 'both'),
    applyPlayerInfinitePower(state.players[1], mode === 'p2' || mode === 'both'),
  ];
  const changed = players.some((player, index) => player !== state.players[index]);
  if (!changed) return state;

  const diagnostics = players.flatMap((player, index) => {
    const before = state.players[index];
    if (player.power === before.power && player.infinitePower === before.infinitePower) return [];
    return [`raw.power_infinite timing=frame_start mode=${mode} entity=p${player.id} before=${before.power ?? 0} after=${player.power ?? 0} max=${readPlayerPowerMax(player)} enabled=${player.infinitePower ? 1 : 0}`];
  });
  return {
    ...state,
    players,
    hitDiagnosticLines: diagnostics.length > 0
      ? [...(state.hitDiagnosticLines ?? []), ...diagnostics]
      : state.hitDiagnosticLines,
  };
}

function applyPlayerInfinitePower(player: PlayerState, enabled: boolean): PlayerState {
  const power = enabled ? readPlayerPowerMax(player) : player.power;
  if (player.power === power && Boolean(player.infinitePower) === enabled) return player;
  return { ...player, power, infinitePower: enabled };
}
