import type { GameState, PlayerState } from './types';

const STAND_HIT_STATE = 5000;
const AIR_HIT_STATE = 5030;
const FALLBACK_HIT_RECOVERY_FRAMES = 28;

export function applyFallbackHitRecovery(state: GameState): GameState {
  const p1 = recoverPlayer(state.players[0]);
  const p2 = recoverPlayer(state.players[1]);
  return {
    ...state,
    players: [p1.player, p2.player],
    hitDiagnosticLines: [
      ...(state.hitDiagnosticLines ?? []),
      ...p1.diagnosticLines,
      ...p2.diagnosticLines,
    ],
  };
}

function recoverPlayer(player: PlayerState): { player: PlayerState; diagnosticLines: string[] } {
  if (!isFallbackHitState(player)) {
    return { player, diagnosticLines: [] };
  }

  if (player.hitPause > 0) {
    return { player: { ...player, ctrl: false }, diagnosticLines: [] };
  }

  const selectedHitTime = player.hitStun?.selectedHitTime ?? FALLBACK_HIT_RECOVERY_FRAMES;
  if (player.stateTime < selectedHitTime) {
    return { player: { ...player, ctrl: false }, diagnosticLines: [] };
  }

  const diagnosticLines = player.hitStun ? [
    `raw.hitstun target=p${player.id}`,
    `  activeHitDefId=${player.hitStun.activeHitDefId ?? 'none'} event=end selectedHitTime=${selectedHitTime} elapsed=${player.stateTime} recoveryPath=existing`,
  ] : [];
  return { player: {
    ...player,
    stateNo: 0,
    animNo: 0,
    stateTime: 0,
    animTime: 0,
    stateType: 'S',
    moveType: 'I',
    physics: 'S',
    ctrl: true,
    vx: 0,
    vy: 0,
    hitDefUsed: false,
    activeHitDef: null,
    hitStun: undefined,
  }, diagnosticLines };
}

function isFallbackHitState(player: PlayerState): boolean {
  return player.moveType === 'H' || player.stateNo === STAND_HIT_STATE || player.stateNo === AIR_HIT_STATE;
}
