import type { GameState, PlayerState } from './types';

const STAND_HIT_STATE = 5000;
const AIR_HIT_STATE = 5030;
const FALLBACK_HIT_RECOVERY_FRAMES = 28;

export function applyFallbackHitRecovery(state: GameState, diagnosticsEnabled = true): GameState {
  const p1 = recoverPlayer(state.players[0], diagnosticsEnabled);
  const p2 = recoverPlayer(state.players[1], diagnosticsEnabled);
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

function recoverPlayer(player: PlayerState, diagnosticsEnabled: boolean): { player: PlayerState; diagnosticLines: string[] } {
  if (!player.hitStun && player.hitReactionElapsed !== undefined) {
    if (player.moveType === 'H' || player.stateType === 'A' || player.stateType === 'L') {
      return { player: { ...player, hitReactionElapsed: player.hitReactionElapsed + 1 }, diagnosticLines: [] };
    }
    return { player: {
      ...player,
      hitReactionElapsed: undefined,
      hitFall: undefined,
      fallRecover: undefined,
      fallRecoverTime: undefined,
      hitFallVelocity: undefined,
      hitVelX: undefined,
      hitVelY: undefined,
      getHitVars: undefined,
      getHitVarUnsupportedKeys: undefined,
      comboHitCount: undefined,
    }, diagnosticLines: [] };
  }
  if (!player.hitStun && !isFallbackHitState(player)) {
    return { player, diagnosticLines: [] };
  }

  if (player.hitPause > 0) {
    const hitStun = player.hitStun;
    const diagnosticLines = diagnosticsEnabled && hitStun ? [
      `raw.hitstun_tick target=p${player.id}`,
      `  activeHitDefId=${hitStun.activeHitDefId ?? 'none'} elapsed=${hitStun.elapsed} remaining=${Math.max(0, hitStun.selectedHitTime - hitStun.elapsed)} state=${player.stateNo} ctrl=0 ctrlSource=hitstun stateChanged=${hitStun.lastStateNo !== player.stateNo ? 1 : 0} hitPause=${player.hitPause}`,
    ] : [];
    return {
      player: {
        ...player,
        ctrl: false,
        hitStun: hitStun ? { ...hitStun, lastStateNo: player.stateNo } : hitStun,
      },
      diagnosticLines,
    };
  }

  const selectedHitTime = player.hitStun?.selectedHitTime ?? FALLBACK_HIT_RECOVERY_FRAMES;
  const elapsed = player.hitStun?.elapsed ?? player.stateTime;
  if (elapsed < selectedHitTime) {
    const nextElapsed = elapsed + 1;
    const stateChanged = player.hitStun ? player.hitStun.lastStateNo !== player.stateNo : false;
    const diagnosticLines = diagnosticsEnabled && player.hitStun ? [
      `raw.hitstun_tick target=p${player.id}`,
      `  activeHitDefId=${player.hitStun.activeHitDefId ?? 'none'} elapsed=${nextElapsed} remaining=${Math.max(0, selectedHitTime - nextElapsed)} state=${player.stateNo} ctrl=0 ctrlSource=${player.ctrl ? 'common_state' : 'hitstun'} stateChanged=${stateChanged ? 1 : 0}`,
      ...(player.ctrl ? [
        `raw.hitstun_violation target=p${player.id}`,
        `  activeHitDefId=${player.hitStun.activeHitDefId ?? 'none'} event=ctrl_enabled_early state=${player.stateNo} forcedCtrl=0`,
      ] : []),
      ...((player.stateNo === 0 || player.stateNo === 52) ? [
        `raw.hitstun_violation target=p${player.id}`,
        `  activeHitDefId=${player.hitStun.activeHitDefId ?? 'none'} event=early_state_exit state=${player.stateNo} forcedCtrl=0`,
      ] : []),
    ] : [];
    return {
      player: {
        ...player,
        ctrl: false,
        hitStun: player.hitStun ? { ...player.hitStun, elapsed: nextElapsed, lastStateNo: player.stateNo } : player.hitStun,
      },
      diagnosticLines,
    };
  }

  const diagnosticLines = player.hitStun ? [
    `raw.hitstun target=p${player.id}`,
    `  activeHitDefId=${player.hitStun.activeHitDefId ?? 'none'} event=end selectedHitTime=${selectedHitTime} elapsed=${elapsed} recoveryPath=existing`,
  ] : [];
  if (player.getHitVars?.guarded) {
    return { player: {
      ...player,
      hitStun: undefined,
      hitReactionElapsed: undefined,
      hitVelX: undefined,
      hitVelY: undefined,
      getHitVars: undefined,
      getHitVarUnsupportedKeys: undefined,
    }, diagnosticLines: diagnosticLines.map((line) => line.replace('recoveryPath=existing', 'recoveryPath=common_guard')) };
  }
  if (player.hitStun?.targetStateTypeAtHit === 'A') {
    return { player: {
      ...player,
      ctrl: false,
      hitStun: undefined,
      hitReactionElapsed: elapsed,
    }, diagnosticLines: diagnosticLines.map((line) => line.replace('recoveryPath=existing', 'recoveryPath=common_air')) };
  }
  if (isCommonFallLifecycle(player)) {
    return { player: {
      ...player,
      ctrl: false,
      hitStun: undefined,
      hitReactionElapsed: elapsed,
    }, diagnosticLines: diagnosticLines.map((line) => line.replace('recoveryPath=existing', 'recoveryPath=common_fall')) };
  }
  if (isBorrowedCustomState(player)) {
    return { player: {
      ...player,
      hitStun: undefined,
      hitReactionElapsed: elapsed,
    }, diagnosticLines: diagnosticLines.map((line) => line.replace('recoveryPath=existing', 'recoveryPath=custom_state')) };
  }
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
    getHitVars: undefined,
    getHitVarUnsupportedKeys: undefined,
    comboHitCount: undefined,
    hitFall: undefined,
    fallRecover: undefined,
    fallRecoverTime: undefined,
    hitFallVelocity: undefined,
    hitVelX: undefined,
    hitVelY: undefined,
  }, diagnosticLines };
}

function isBorrowedCustomState(player: PlayerState): boolean {
  const selfOwnerId = player.selfStateOwnerId ?? player.id;
  return (player.stateOwnerId ?? selfOwnerId) !== selfOwnerId;
}

function isFallbackHitState(player: PlayerState): boolean {
  return player.moveType === 'H' || player.stateNo === STAND_HIT_STATE || player.stateNo === AIR_HIT_STATE;
}

function isCommonFallLifecycle(player: PlayerState): boolean {
  return player.hitFall === true
    || player.stateType === 'A'
    || player.stateType === 'L'
    || (player.stateNo >= AIR_HIT_STATE && player.stateNo <= 5120);
}
