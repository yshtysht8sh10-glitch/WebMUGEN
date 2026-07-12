import type { AirDocument } from '../../parser/air/AirTypes';
import {
  anyIntersects,
  getPlayerAttackBoxes,
  getPlayerBodyBoxes,
} from '../collision/CollisionResolver';
import type { GameState, HitEvent, PlayerState } from './types';
import { recordMoveContact } from '../hitdef/MoveContactState';
import { pruneTargets, registerTarget } from '../hitdef/TargetState';

const STAND_HIT_STATE = 5000;
const AIR_HIT_SHAKE_STATE = 5020;

export function resolveFallbackHits(state: GameState, airDocument?: AirDocument | null, diagnosticsEnabled = true): GameState {
  if (!airDocument) {
    return state;
  }

  let p1 = state.players[0];
  let p2 = state.players[1];
  p1 = pruneTargets(p1, [p2]);
  p2 = pruneTargets(p2, [p1]);
  const hitEvents: HitEvent[] = [];
  const hitDiagnosticLines = diagnosticsEnabled ? [
    ...(p1.hitDiagnosticLines ?? []),
    ...(p2.hitDiagnosticLines ?? []),
  ] : [];

  const p1Attack = getPlayerAttackBoxes(p1, airDocument);
  const p1Body = getPlayerBodyBoxes(p1, airDocument);
  const p2Attack = getPlayerAttackBoxes(p2, airDocument);
  const p2Body = getPlayerBodyBoxes(p2, airDocument);

  const p1Result = resolveAttack(p1, p2, p1Attack, p2Body, airDocument, diagnosticsEnabled);
  p1 = p1Result.attacker;
  p2 = p1Result.target;
  hitDiagnosticLines.push(...p1Result.diagnosticLines);
  if (p1Result.hitEvent) hitEvents.push(p1Result.hitEvent);

  const p2Result = resolveAttack(p2, p1, p2Attack, p1Body, airDocument, diagnosticsEnabled);
  p2 = p2Result.attacker;
  p1 = p2Result.target;
  hitDiagnosticLines.push(...p2Result.diagnosticLines);
  if (p2Result.hitEvent) hitEvents.push(p2Result.hitEvent);

  return {
    ...state,
    players: [p1, p2],
    hitEvents,
    hitDiagnosticLines,
  };
}

function resolveAttack(
  attacker: PlayerState,
  target: PlayerState,
  attackBoxes: ReturnType<typeof getPlayerAttackBoxes>,
  bodyBoxes: ReturnType<typeof getPlayerBodyBoxes>,
  airDocument: AirDocument,
  diagnosticsEnabled: boolean,
): { attacker: PlayerState; target: PlayerState; hitEvent: HitEvent | null; diagnosticLines: string[] } {
  const diagnosticLines: string[] = [];
  if (attacker.moveType !== 'A' || attacker.hitPause > 0) {
    return { attacker, target, hitEvent: null, diagnosticLines };
  }

  const active = attacker.activeHitDef;
  const activeHitDefId = active?.diagnosticId ?? null;
  const attackElement = attackBoxes[0]?.elementIndex ?? '-';
  const bodyElement = bodyBoxes[0]?.elementIndex ?? '-';
  const collisionHeader = `  activeHitDefId=${activeHitDefId ?? 'none'} attackerAnim=${attacker.animNo} attackerElem=${attackElement} defenderAnim=${target.animNo} defenderElem=${bodyElement} clsn1=${attackBoxes.length} clsn2=${bodyBoxes.length}`;
  if (!active || attackBoxes.length === 0 || bodyBoxes.length === 0) {
    if (diagnosticsEnabled) diagnosticLines.push(
      `raw.hit_collision attacker=p${attacker.id} target=p${target.id}`,
      `${collisionHeader} result=rejected reason=${!active ? 'active_hitdef_missing' : attackBoxes.length === 0 ? 'clsn1_missing' : 'clsn2_missing'}`,
    );
    return { attacker, target, hitEvent: null, diagnosticLines };
  }
  const overlap = findOverlap(attackBoxes, bodyBoxes);
  const collided = overlap !== null;
  const damage = active.damage;
  const guardDamage = active.damageValues?.[1] ?? 0;
  const source = 'active_hitdef';

  const alreadyHitTarget = activeHitDefId !== null && (attacker.hitTargets ?? []).some(
    (record) => record.activeHitDefId === activeHitDefId && record.defenderId === target.id,
  );
  if (alreadyHitTarget) {
    if (diagnosticsEnabled && collided && activeHitDefId !== null && !active?.rejectedLogged) {
      diagnosticLines.push(
        `raw.hit_collision attacker=p${attacker.id} target=p${target.id}`,
        `${collisionHeader} overlap=${formatOverlap(overlap)} damage=${damage},${guardDamage} source=${source} result=rejected reason=hitonce_already_consumed`,
      );
      attacker = { ...attacker, activeHitDef: active ? { ...active, rejectedLogged: true } : active };
    }
    return { attacker, target, hitEvent: null, diagnosticLines };
  }

  if (!collided || target.hitPause > 0) {
    if (diagnosticsEnabled && activeHitDefId !== null && !active?.missLogged) {
      diagnosticLines.push(
        `raw.hit_collision attacker=p${attacker.id} target=p${target.id}`,
        `${collisionHeader} overlap=${formatOverlap(overlap)} damage=${damage},${guardDamage} source=${source} result=miss reason=${target.hitPause > 0 ? 'target_hitpause' : 'clsn_no_overlap'}`,
      );
      attacker = { ...attacker, activeHitDef: active ? { ...active, missLogged: true } : active };
    }
    return { attacker, target, hitEvent: null, diagnosticLines };
  }

  const lifeBefore = target.life;
  const targetStateTypeAtHit = target.stateType;
  const hitTimeKind = targetStateTypeAtHit === 'A' ? 'air' : 'ground';
  const activeHitTime = hitTimeKind === 'air' ? active?.airHitTime : active?.groundHitTime;
  const selectedHitTime = activeHitTime ?? 28;
  const hitTimeSource = activeHitTime === undefined ? 'hardcoded' : 'active_hitdef';
  const hitTimeFallbackReason = active
    ? hitTimeKind === 'air'
      ? active.airHitTimeFallbackReason ?? 'missing_air_hittime'
      : active.groundHitTimeFallbackReason ?? 'missing_ground_hittime'
    : 'active_hitdef_missing';
  const reactionState = hitTimeKind === 'air' ? AIR_HIT_SHAKE_STATE : STAND_HIT_STATE;
  const selectedAnimType = hitTimeKind === 'air' ? active.airAnimType ?? 'Light' : active.animType;
  const selectedAnim = hitTimeKind === 'ground' ? groundHitAnim(active?.animType) : airHitAnim(selectedAnimType, active.airType);
  const selectedVelocity = hitTimeKind === 'air' ? active.airVelocity : active.groundVelocity;
  // WinMUGEN HitDef X velocity is expressed in the defender's reaction direction:
  // the commonly used negative value must send the target away from the attacker.
  const appliedVelocity = { x: selectedVelocity.x * -attacker.facing, y: selectedVelocity.y };
  const animType = active?.animType ?? 'Light';
  const animSource = active?.animTypeSource ?? 'existing_fallback';
  const animationExists = airDocumentHasAction(airDocument, selectedAnim);
  const hitAttacker = markAttackerHit(attacker, activeHitDefId, target.id, active.pauseTime.attacker);
  const contactedAttacker = activeHitDefId === null ? hitAttacker : recordMoveContact(hitAttacker, activeHitDefId, 'hit');
  const fallVelocity = {
    x: (active.fall?.xVelocity ?? active.downVelocity?.x ?? 0) * attacker.facing,
    y: active.fall?.yVelocity ?? active.downVelocity?.y ?? 0,
  };
  const hitTarget = applyFallbackHit(target, damage, reactionState, selectedAnim, appliedVelocity, fallVelocity, active.pauseTime.defender, {
    activeHitDefId,
    selectedHitTime,
    kind: activeHitTime === undefined ? 'fallback' : hitTimeKind,
    source: hitTimeSource,
    targetStateTypeAtHit,
    elapsed: 0,
    lastStateNo: reactionState,
    selectedAnim,
    ...(activeHitTime === undefined ? { fallbackReason: hitTimeFallbackReason } : {}),
  }, createGetHitVarSnapshot(active, damage, selectedHitTime, hitTimeKind, selectedVelocity));
  const idText = activeHitDefId === null ? 'none' : String(activeHitDefId);
  const targetedAttacker = activeHitDefId === null
    ? contactedAttacker
    : registerTarget(contactedAttacker, hitTarget, activeHitDefId, active.hitId ?? 0);
  const fallbackReason = '-';
  if (diagnosticsEnabled) diagnosticLines.push(
    `raw.hit_collision attacker=p${attacker.id} target=p${target.id}`,
    `${collisionHeader} overlap=${formatOverlap(overlap)} damage=${damage},${guardDamage} source=${source} fallbackReason=${fallbackReason} result=hit`,
    `raw.move_contact attacker=p${attacker.id} target=p${target.id}`,
    `  activeHitDefId=${idText} contact=1 hit=1 guarded=0 hitCount=${targetedAttacker.moveContact?.hitCount ?? 0} result=accepted`,
    `raw.target_register owner=p${attacker.id} target=p${target.id}`,
    `  activeHitDefId=${idText} hitDefId=${active.hitId ?? 0} targetLife=${hitTarget.life} registered=${hitTarget.life > 0 ? 1 : 0} reason=${hitTarget.life > 0 ? 'successful_hit' : 'target_ko'}`,
    `raw.hit_damage target=p${target.id}`,
    `  activeHitDefId=${idText} lifeBefore=${lifeBefore} appliedDamage=${damage} lifeAfter=${hitTarget.life} source=${source} ko=${hitTarget.life === 0 ? 1 : 0}`,
    `raw.hitpause attacker=p${attacker.id} target=p${target.id}`,
    `  activeHitDefId=${idText} event=start attackerFrames=${active.pauseTime.attacker} defenderFrames=${active.pauseTime.defender} source=active_hitdef`,
    `raw.gethitvar_snapshot target=p${target.id}`,
    `  activeHitDefId=${idText} keys=${Object.keys(hitTarget.getHitVars ?? {}).sort().join(',')} unsupportedKeys=${hitTarget.getHitVarUnsupportedKeys?.join(',') || '-'}`,
    ...[
      `raw.hit_anim_select target=p${target.id}`,
      `  activeHitDefId=${idText} animType=${String(selectedAnimType ?? animType)} targetStateTypeAtHit=${targetStateTypeAtHit} requestedAnim=${selectedAnim} selectedAnim=${selectedAnim} animationExists=${animationExists ? 1 : 0} source=${hitTimeKind === 'air' && active.airAnimType ? 'cns_air' : animSource} fallbackReason=${hitTimeKind === 'ground' && animSource !== 'cns' ? 'existing_fixed_5000' : hitTimeKind === 'air' && !active.airAnimType ? 'missing_air_animtype' : '-'}${animationExists ? '' : ' warning=missing_required_animation'}`,
    ],
    `raw.hit_reaction target=p${target.id}`,
    `  state=${reactionState} source=${hitTimeKind === 'air' ? 'air_common_state' : 'ground_common_state'} anim=${selectedAnim} source=${hitTimeKind === 'ground' ? animSource : active.airAnimType ? 'cns_air' : 'existing_default'}`,
    `  velocity=(${appliedVelocity.x},${appliedVelocity.y}) source=active_hitdef velocityKind=${hitTimeKind} attackerFacing=${attacker.facing} pausetime=${active.pauseTime.defender} source=active_hitdef`,
    `  hittime=${selectedHitTime} source=${hitTimeSource} hittimeKind=${activeHitTime === undefined ? 'fallback' : hitTimeKind} targetStateTypeAtHit=${targetStateTypeAtHit}`,
    `  fall=${active.fall?.enabled ? 1 : 0} fallVelocity=(${fallVelocity.x},${fallVelocity.y}) recover=${active.fall?.recover === false ? 0 : 1} recoverTime=${active.fall?.recoverTime ?? 0} source=active_hitdef`,
    `raw.hitstun target=p${target.id}`,
    `  activeHitDefId=${idText} event=start selectedHitTime=${selectedHitTime} kind=${activeHitTime === undefined ? 'fallback' : hitTimeKind} remaining=${selectedHitTime} source=${hitTimeSource}${activeHitTime === undefined ? ` fallbackReason=${hitTimeFallbackReason}` : ''}`,
  );
  if (diagnosticsEnabled && activeHitDefId !== null) {
    diagnosticLines.push(
      `raw.hitdef_lifecycle activeHitDefId=${activeHitDefId}`,
      '  event=consume reason=successful_hit hitCount=1',
    );
  }
  return {
    attacker: targetedAttacker,
    target: hitTarget,
    hitEvent: { attackerId: attacker.id, defenderId: target.id, damage },
    diagnosticLines,
  };
}

function findOverlap(
  attackBoxes: ReturnType<typeof getPlayerAttackBoxes>,
  bodyBoxes: ReturnType<typeof getPlayerBodyBoxes>,
): { attackBoxIndex: number; bodyBoxIndex: number } | null {
  for (let attackBoxIndex = 0; attackBoxIndex < attackBoxes.length; attackBoxIndex += 1) {
    for (let bodyBoxIndex = 0; bodyBoxIndex < bodyBoxes.length; bodyBoxIndex += 1) {
      if (anyIntersects([attackBoxes[attackBoxIndex]], [bodyBoxes[bodyBoxIndex]])) return { attackBoxIndex, bodyBoxIndex };
    }
  }
  return null;
}

function formatOverlap(value: ReturnType<typeof findOverlap>): string {
  return value ? `${value.attackBoxIndex}:${value.bodyBoxIndex}` : '-';
}

function markAttackerHit(player: PlayerState, activeHitDefId: number | null, defenderId: number, pauseTime: number): PlayerState {
  return {
    ...player,
    hitPause: pauseTime,
    hitDefUsed: true,
    hitTargets: activeHitDefId === null ? (player.hitTargets ?? []) : [
      ...(player.hitTargets ?? []),
      { activeHitDefId, defenderId },
    ],
  };
}

function applyFallbackHit(
  defender: PlayerState,
  damage: number,
  stateNo: number,
  selectedAnim: number,
  velocity: { x: number; y: number },
  fallVelocity: { x: number; y: number },
  pauseTime: number,
  hitStun: NonNullable<PlayerState['hitStun']>,
  getHitVars: Record<string, number>,
): PlayerState {
  return {
    ...defender,
    life: Math.max(0, defender.life - damage),
    stateNo,
    animNo: selectedAnim,
    stateTime: 0,
    animTime: 0,
    stateType: stateNo === AIR_HIT_SHAKE_STATE ? 'A' : 'S',
    moveType: 'H',
    physics: 'N',
    ctrl: false,
    vx: velocity.x,
    vy: velocity.y,
    hitVelX: velocity.x,
    hitVelY: velocity.y,
    hitFall: getHitVars.fall !== 0,
    fallRecover: getHitVars['fall.recover'] !== 0,
    fallRecoverTime: getHitVars['fall.recovertime'],
    hitFallVelocity: fallVelocity,
    hitPause: pauseTime,
    hitDefUsed: false,
    activeHitDef: null,
    hitStun,
    getHitVars,
    getHitVarUnsupportedKeys: ['fall.time', 'xoff', 'yoff', 'zoff'],
  };
}

function createGetHitVarSnapshot(
  hitDef: NonNullable<PlayerState['activeHitDef']>,
  damage: number,
  hitTime: number,
  hitTimeKind: 'ground' | 'air',
  selectedVelocity: { x: number; y: number },
): Record<string, number> {
  const animType = hitAnimTypeCode(hitTimeKind === 'air'
    ? hitDef.airAnimType ?? 'Light'
    : hitDef.groundAnimTypeRaw ?? hitDef.animType ?? 'Light');
  const groundType = hitReactionTypeCode(hitDef.groundType);
  const airType = hitReactionTypeCode(hitDef.airType ?? hitDef.groundType);
  const fall = hitDef.fall ?? {};
  return {
    damage,
    hittime: hitTime,
    slidetime: hitDef.groundSlideTime ?? hitTime,
    ctrltime: hitDef.controlTime ?? hitTime,
    xveladd: selectedVelocity.x,
    yveladd: selectedVelocity.y,
    xvel: selectedVelocity.x,
    yvel: selectedVelocity.y,
    type: hitTimeKind === 'air' ? airType : groundType,
    animtype: animType,
    airtype: airType,
    groundtype: groundType,
    fall: fall.enabled ? 1 : 0,
    'fall.damage': fall.damage ?? 0,
    'fall.xvel': fall.xVelocity ?? 0,
    'fall.yvel': fall.yVelocity ?? 0,
    'fall.recover': fall.recover === false ? 0 : 1,
    'fall.recovertime': fall.recoverTime ?? 0,
    hitid: hitDef.hitId ?? 0,
    chainid: hitDef.chainId ?? -1,
    guarded: 0,
    yaccel: hitDef.yAcceleration ?? 0.6,
    'down.xvel': hitDef.downVelocity?.x ?? 0,
    'down.yvel': hitDef.downVelocity?.y ?? 0,
    'down.hittime': hitDef.downHitTime ?? 20,
  };
}

function hitAnimTypeCode(value: string): number {
  const codes: Record<string, number> = { light: 0, medium: 1, med: 1, hard: 2, heavy: 2, back: 3, up: 4, diagup: 5 };
  return codes[value.trim().toLowerCase()] ?? 0;
}

function hitReactionTypeCode(value: string | undefined): number {
  const codes: Record<string, number> = { none: 0, high: 1, low: 2, trip: 3 };
  return value ? codes[value.trim().toLowerCase()] ?? 0 : 0;
}

function groundHitAnim(animType: NonNullable<PlayerState['activeHitDef']>['animType']): number {
  if (animType === 'Medium') return 5001;
  if (animType === 'Hard') return 5002;
  return 5000;
}

function airHitAnim(value: string | undefined, airType: string | undefined): number {
  const code = hitAnimTypeCode(value ?? 'Light');
  if (code >= 3) return code === 3 ? 5030 : 5047 + code;
  return (airType?.trim().toLowerCase() === 'low' ? 5010 : 5000) + code;
}

function airDocumentHasAction(document: AirDocument | null, actionNo: number): boolean {
  return document?.actions.some((action) => action.actionNo === actionNo) === true;
}
