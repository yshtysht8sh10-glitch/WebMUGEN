import type { GameState, HelperEntity, PlayerState } from '../engine/types';
import { DEFAULT_GROUND_Y } from '../engine/GroundClamp';
import type { CnsDocument, CnsStateDefinition } from '../../mugen/common/cnsTypes';
import { findCnsState } from '../../mugen/common/CnsStateIndex';
import { readCnsConst } from './CnsConstants';
import { advanceMoveContact } from '../hitdef/MoveContactState';
import { stepBgPalFx } from '../palfx/BgPalFxSystem';
import { snapshotPresentedAnimation } from '../animation/PresentedAnimation';

const COMMON_JUMP_LAND_STATE = 52;
// WinMUGEN keeps cornerpush as a separate position offset and damps that
// offset with a hardcoded coefficient rather than character ground friction.
const WINMUGEN_CORNER_PUSH_FRICTION = 0.7;
const WINMUGEN_CORNER_PUSH_STOP_SPEED = 1;

export function stepCnsPhysicsMotion(state: GameState, cns?: CnsDocument | null): GameState {
  const beforePlayers = state.players;
  const movedPlayers = [
    stepPlayerCnsPhysics(state.players[0], cns),
    stepPlayerCnsPhysics(state.players[1], cns),
  ] as [PlayerState, PlayerState];
  const clampedPlayers = [
    clampPlayerAfterCnsPhysics(movedPlayers[0], beforePlayers[0]),
    clampPlayerAfterCnsPhysics(movedPlayers[1], beforePlayers[1]),
  ] as [PlayerState, PlayerState];

  const landedPlayers = [
    applyCnsAirLandingState(clampedPlayers[0], clampedPlayers[1], cns),
    applyCnsAirLandingState(clampedPlayers[1], clampedPlayers[0], cns),
  ] as [PlayerState, PlayerState];
  const recoveredPlayers = [
    applyCommonDownRecovery(landedPlayers[0], cns, state.players[0].hitPause > 0),
    applyCommonDownRecovery(landedPlayers[1], cns, state.players[1].hitPause > 0),
  ] as [PlayerState, PlayerState];
  const nextHelpers = state.helpers.entries.map((helper) => ({
    ...helper,
    player: helper.hasCompletedInitialStatePass === false ? helper.player : stepPlayerCnsPhysics(helper.player, cns),
  }));
  const finalPlayers = applyTargetBindMaintenance(recoveredPlayers, state.players, nextHelpers, state.helpers.entries);
  const nextFrame = state.frame + 1;

  return {
    ...state,
    frame: nextFrame,
    helpers: {
      ...state.helpers,
      entries: nextHelpers,
    },
    players: finalPlayers,
    // These diagnostics describe one game tick. Replacing instead of appending
    // prevents old frame-position records from being mixed into a later
    // AI_RUNTIME snapshot. Stage, push, facing and camera diagnostics append to
    // this fresh list later in the same tick.
    hitDiagnosticLines: [
      formatPhysicsPositionDiagnostic(nextFrame, 'before', beforePlayers),
      formatPhysicsPositionDiagnostic(nextFrame, 'moved', movedPlayers),
      formatPhysicsPositionDiagnostic(nextFrame, 'clamped', clampedPlayers),
      formatPhysicsPositionDiagnostic(nextFrame, 'landed', landedPlayers),
      formatPhysicsPositionDiagnostic(nextFrame, 'recovered', recoveredPlayers),
      formatPhysicsPositionDiagnostic(nextFrame, 'targetbind', finalPlayers),
    ],
  };
}

function formatPhysicsPositionDiagnostic(
  frame: number,
  phase: string,
  players: [PlayerState, PlayerState],
): string {
  const [p1, p2] = players;
  return `raw.framepos frame=${frame} phase=${phase} p1=(${formatNumber(p1.x)},${formatNumber(p1.y)}) v=(${formatNumber(p1.vx)},${formatNumber(p1.vy)}) state=${p1.stateNo} p2=(${formatNumber(p2.x)},${formatNumber(p2.y)}) v=(${formatNumber(p2.vx)},${formatNumber(p2.vy)}) state=${p2.stateNo}`;
}

function applyTargetBindMaintenance(
  players: [PlayerState, PlayerState],
  previousPlayers: [PlayerState, PlayerState],
  helpers: HelperEntity[],
  previousHelpers: HelperEntity[],
): [PlayerState, PlayerState] {
  return players.map((player) => {
    const bind = player.targetBind;
    if (!bind || bind.remaining === 0) {
      return bind?.remaining === 0 ? { ...player, targetBind: undefined } : player;
    }

    const owner = resolveRuntimePlayer(players, helpers, bind.ownerId);
    if (!owner) return { ...player, targetBind: undefined };

    const previousOwner = resolveRuntimePlayer(previousPlayers, previousHelpers, bind.ownerId);
    // TargetBind belongs to the controller owner. A target-only HitPause must
    // not extend its finite lifetime: itoko's two-tick zipper bind otherwise
    // lasts for the defender's full 100-tick pause and erases the launch.
    const frozen = (previousOwner?.hitPause ?? 0) > 0;
    const remaining = bind.remaining < 0 || frozen ? bind.remaining : Math.max(0, bind.remaining - 1);
    return {
      ...player,
      x: owner.x + bind.offsetX * owner.facing,
      y: owner.y + bind.offsetY,
      vx: owner.vx,
      vy: owner.vy,
      targetBind: { ...bind, remaining },
    };
  }) as [PlayerState, PlayerState];
}

function resolveRuntimePlayer(
  players: [PlayerState, PlayerState],
  helpers: HelperEntity[],
  entityId: number,
): PlayerState | undefined {
  if (entityId === 1 || entityId === 2) return players[entityId - 1];
  return helpers.find((helper) => helper.entityId === entityId)?.player;
}

function applyCommonDownRecovery(player: PlayerState, cns: CnsDocument | null | undefined, wasHitPaused: boolean): PlayerState {
  if (player.stateNo !== 5110) {
    return player.lieDownElapsed === undefined && player.lieDownTime === undefined
      ? player
      : { ...player, lieDownElapsed: undefined, lieDownTime: undefined };
  }

  const lieDownTime = Math.max(0, Math.trunc(readCnsConst(cns, 'data.liedown.time')));
  const lieDownElapsed = (player.lieDownElapsed ?? 0) + (wasHitPaused ? 0 : 1);
  const timed = {
    ...player,
    lieDownElapsed,
    lieDownTime,
    hitDiagnosticLines: [
      ...(player.hitDiagnosticLines ?? []),
      `raw.down_clock target=p${player.id}`,
      `  state=5110 elapsed=${lieDownElapsed} duration=${lieDownTime} remaining=${Math.max(0, lieDownTime - lieDownElapsed)} hitPause=${wasHitPaused ? 1 : 0} ko=${player.life <= 0 ? 1 : 0} result=${player.life <= 0 ? 'ko_hold' : lieDownElapsed >= lieDownTime ? 'ready' : wasHitPaused ? 'frozen' : 'advance'}`,
    ],
  };
  if (player.life <= 0 || lieDownElapsed < lieDownTime) return timed;

  // Keep State 5110 through this render boundary. The next CNS pass performs
  // the engine-owned 5110 -> 5120 entry before negative/current State scans,
  // so State 5120 Time=0 Controllers (and an immediate custom get-up route)
  // execute before the player is drawn again.
  return timed;
}

export function stepPlayerCnsPhysics(player: PlayerState, cns?: CnsDocument | null): PlayerState {
  const palFx = stepBgPalFx(player.palFx);
  if (player.hitPause > 0) {
    const remainingHitPause = Math.max(0, player.hitPause - 1);
    const advanceStateTime = player.hitPauseKind !== 'pause'
      && player.stateHeaderAppliedStateNo === player.stateNo
      && player.stateTime > 0;
    return {
      ...player,
      palFx,
      hitPause: remainingHitPause,
      hitPauseKind: remainingHitPause > 0 ? player.hitPauseKind : undefined,
      stateTime: advanceStateTime ? player.stateTime + 1 : player.stateTime,
    };
  }

  const advanced = advanceProjectileContacts(advanceMoveContact(player));
  const nextTime = {
    stateTime: player.stateTime + 1,
    animTime: player.animTime + 1,
    presentedAnimation: snapshotPresentedAnimation(player),
  };

  if (player.positionFrozen) {
    return applyCornerPush({ ...advanced, palFx, positionFrozen: false, ...nextTime }, player.x);
  }

  if (player.physics === 'S' || player.physics === 'C') {
    const friction = readCnsConst(
      cns,
      player.physics === 'C' ? 'movement.crouch.friction' : 'movement.stand.friction',
    );
    const nextVx = player.vx * friction;
    return applyCornerPush({
      ...advanced,
      palFx,
      // WinMUGEN S/C physics applies ground friction; it does not itself
      // rewrite Pos Y. StateType and Physics are independent, and real
      // characters intentionally combine StateType=A with Physics=S.
      y: player.y + player.vy,
      vx: Math.abs(nextVx) < 0.01 ? 0 : nextVx,
      ...nextTime,
    }, player.x + player.vx);
  }

  if (player.physics === 'A') {
    const nextVy = player.vy + readCnsConst(cns, 'movement.yaccel');
    return applyCornerPush({
      ...advanced,
      palFx,
      y: player.y + nextVy,
      vy: nextVy,
      ...nextTime,
    }, player.x + player.vx);
  }

  return applyCornerPush({
    ...advanced,
    palFx,
    y: player.y + player.vy,
    ...nextTime,
  }, player.x + player.vx);
}

function applyCornerPush(player: PlayerState, ordinaryX: number): PlayerState {
  const offset = player.cornerPushVelocity ?? 0;
  if (offset === 0) return { ...player, x: ordinaryX };

  const decayed = offset * WINMUGEN_CORNER_PUSH_FRICTION;
  return {
    ...player,
    x: ordinaryX + offset,
    cornerPushVelocity: Math.abs(decayed) < WINMUGEN_CORNER_PUSH_STOP_SPEED ? undefined : decayed,
  };
}

function advanceProjectileContacts(player: PlayerState): PlayerState {
  if (!player.projectileContacts) return player;
  return {
    ...player,
    projectileContacts: Object.fromEntries(Object.entries(player.projectileContacts).map(([id, contact]) => [id, {
      contactTime: contact.contactTime < 0 ? -1 : contact.contactTime + 1,
      hitTime: contact.hitTime < 0 ? -1 : contact.hitTime + 1,
      guardedTime: contact.guardedTime < 0 ? -1 : contact.guardedTime + 1,
      cancelTime: contact.cancelTime === undefined || contact.cancelTime < 0 ? -1 : contact.cancelTime + 1,
    }])),
  };
}

function clampPlayerAfterCnsPhysics(player: PlayerState, previousPlayer: PlayerState): PlayerState {
  if (player.y < DEFAULT_GROUND_Y) {
    return player;
  }

  // Physics=N has no automatic ground interaction. Characters use it for
  // authored off-screen movement such as sinking below Pos Y = 0 before a
  // ChangeState; only their CNS controllers decide when that motion stops.
  if (player.physics === 'N') {
    return player;
  }

  // S/C friction does not relocate an entity that CNS has already placed
  // below the ground axis. Only clamp an S/C player that actually crossed the
  // floor from above during this tick. T-H-M-A State 3730 deliberately enters
  // Physics=S at Pos Y=400 so the thrower remains underneath its rock Helper.
  if ((player.physics === 'S' || player.physics === 'C') && previousPlayer.y > DEFAULT_GROUND_Y) {
    return player;
  }

  if ((player.stateType === 'A' || player.stateType === 'L') && player.moveType === 'H') {
    return player;
  }

  return {
    ...player,
    y: DEFAULT_GROUND_Y,
    vy: player.vy > 0 ? 0 : player.vy,
  };
}

function applyCnsAirLandingState(player: PlayerState, opponent: PlayerState, cns?: CnsDocument | null): PlayerState {
  if (!cns || player.stateNo === COMMON_JUMP_LAND_STATE || player.physics !== 'A' || player.stateType !== 'A') {
    return player;
  }

  if (player.y < DEFAULT_GROUND_Y || player.vy < 0) {
    return player;
  }

  const landingState = findCnsState(cns, COMMON_JUMP_LAND_STATE);
  if (!landingState) {
    return player;
  }

  return enterLandingState(player, opponent, landingState);
}

function enterLandingState(player: PlayerState, opponent: PlayerState, stateDef: CnsStateDefinition): PlayerState {
  const stateType = toStateType(stateDef.stateType) ?? player.stateType;
  const physics = toPhysics(stateDef.physics) ?? player.physics;
  const animNo = stateDef.initialAnim ?? player.animNo;

  return {
    ...player,
    prevStateNo: player.stateNo,
    stateNo: stateDef.stateNo,
    // Ground contact selects State 52, but the regular CNS runtime owns the
    // StateDef entry. In particular, character common files may use an
    // expression for `anim` (akkarin selects 20047 through var(3)); physics
    // has no command/input context with which to evaluate that expression.
    // Retain the prior applied State number so the next CNS pass evaluates
    // every StateDef entry field exactly once instead of treating 52 as done.
    stateHeaderAppliedStateNo: player.stateNo,
    stateTime: 0,
    stateType,
    moveType: toMoveType(stateDef.moveType) ?? player.moveType,
    physics,
    ctrl: stateDef.ctrl ?? player.ctrl,
    animNo,
    animTime: player.animNo === animNo ? player.animTime : 0,
    y: DEFAULT_GROUND_Y,
    vy: 0,
    activeHitDef: null,
    hitDefUsed: false,
    drawAngle: undefined,
    drawScale: undefined,
    facing: player.x <= opponent.x ? 1 : -1,
  } as PlayerState;
}

function toStateType(value: string | undefined): PlayerState['stateType'] | null {
  const normalized = value?.trim().toUpperCase();
  return normalized === 'S' || normalized === 'C' || normalized === 'A' || normalized === 'L' ? normalized : null;
}

function toMoveType(value: string | undefined): PlayerState['moveType'] | null {
  const normalized = value?.trim().toUpperCase();
  return normalized === 'I' || normalized === 'A' || normalized === 'H' ? normalized : null;
}

function toPhysics(value: string | undefined): PlayerState['physics'] | null {
  const normalized = value?.trim().toUpperCase();
  return normalized === 'S' || normalized === 'C' || normalized === 'A' || normalized === 'N' ? normalized : null;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}
