import type { AirDocument } from '../../parser/air/AirTypes';
import {
  anyIntersects,
  getPlayerAttackBoxes,
  getPlayerBodyBoxes,
} from '../collision/CollisionResolver';
import type { GameState, HitEvent, PlayerState } from './types';
import { recordMoveContact } from '../hitdef/MoveContactState';
import { pruneTargets, registerTarget } from '../hitdef/TargetState';
import { hitAttributeMatchesFilter } from '../hitdef/HitAttribute';
import { addPower } from '../power/PowerGauge';
import { isAtFallbackStageEdge } from './FallbackStageRules';

const STAND_HIT_STATE = 5000;
const CROUCH_HIT_STATE = 5010;
const AIR_HIT_SHAKE_STATE = 5020;

type PriorityDecision = {
  allowed: boolean;
  reason: 'no_clash' | 'higher_priority' | 'lower_priority' | 'equal_hit_trade' | 'equal_non_hit_miss' | 'unsupported_priority_type';
  own: number;
  opponent: number;
  ownType: string;
  opponentType: string;
};

type HitEligibility = { accepted: boolean; reason: string; targetClass: string };

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

  const p1PriorityCandidate = isPriorityCandidate(p1, p2, p1Attack, p2Body);
  const p2PriorityCandidate = isPriorityCandidate(p2, p1, p2Attack, p1Body);
  const priority = resolvePriorityClash(p1, p2, p1PriorityCandidate && p2PriorityCandidate);

  const originalP1 = p1;
  const originalP2 = p2;
  const p1Result = resolveAttack(originalP1, originalP2, p1Attack, p2Body, airDocument, diagnosticsEnabled, priority.p1);
  hitDiagnosticLines.push(...p1Result.diagnosticLines);
  if (p1Result.hitEvent) hitEvents.push(p1Result.hitEvent);

  const p2Result = resolveAttack(originalP2, originalP1, p2Attack, p1Body, airDocument, diagnosticsEnabled, priority.p2);
  hitDiagnosticLines.push(...p2Result.diagnosticLines);
  if (p2Result.hitEvent) hitEvents.push(p2Result.hitEvent);

  p1 = mergeCombatRoles(p1Result.attacker, p2Result.target, Boolean(p2Result.hitEvent));
  p2 = mergeCombatRoles(p2Result.attacker, p1Result.target, Boolean(p1Result.hitEvent));

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
  priorityDecision: PriorityDecision = { allowed: true, reason: 'no_clash', own: 4, opponent: 4, ownType: 'Hit', opponentType: 'Hit' },
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

  const alreadyHitTarget = hasConsumedHitTarget(attacker, target, active);
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

  const previousHitDefId = target.lastHitAttackerId === attacker.id
    ? target.lastHitDefByAttacker?.[attacker.id]
    : undefined;
  const chainDecision = evaluateHitChain(active, previousHitDefId);
  if (diagnosticsEnabled) diagnosticLines.push(
    `raw.hit_chain attacker=p${attacker.id} target=p${target.id}`,
    `  activeHitDefId=${activeHitDefId ?? 'none'} id=${active.hitId ?? '-'} chainid=${active.chainId ?? '-'} nochainid=${active.noChainIds?.join('|') || '-'} previous=${previousHitDefId ?? '-'} hitonce=${active.hitOnce ? 1 : 0} result=${chainDecision.accepted ? 'accepted' : 'rejected'} reason=${chainDecision.reason}`,
  );
  if (!chainDecision.accepted) return { attacker, target, hitEvent: null, diagnosticLines };

  const eligibility = evaluateHitEligibility(active, target);
  if (!eligibility.accepted) {
    if (diagnosticsEnabled) diagnosticLines.push(
      `raw.hit_collision attacker=p${attacker.id} target=p${target.id}`,
      `${collisionHeader} overlap=${formatOverlap(overlap)} result=rejected reason=${eligibility.reason}`,
      `raw.hit_eligibility attacker=p${attacker.id} target=p${target.id}`,
      `  activeHitDefId=${activeHitDefId ?? 'none'} hitflag=${active.hitFlag ?? '-'} targetClass=${eligibility.targetClass} stateType=${target.stateType} moveType=${target.moveType} attr=${formatActiveAttr(active)} hitBy=${target.hitBy ?? '-'} notHitBy=${target.notHitBy ?? '-'} result=rejected reason=${eligibility.reason}`,
    );
    return { attacker, target, hitEvent: null, diagnosticLines };
  }
  if (diagnosticsEnabled) diagnosticLines.push(
    `raw.hit_eligibility attacker=p${attacker.id} target=p${target.id}`,
    `  activeHitDefId=${activeHitDefId ?? 'none'} hitflag=${active.hitFlag ?? '-'} targetClass=${eligibility.targetClass} stateType=${target.stateType} moveType=${target.moveType} attr=${formatActiveAttr(active)} hitBy=${target.hitBy ?? '-'} notHitBy=${target.notHitBy ?? '-'} result=accepted`,
  );

  if (priorityDecision.reason !== 'no_clash' && diagnosticsEnabled) diagnosticLines.push(
    `raw.hit_priority attacker=p${attacker.id} target=p${target.id}`,
    `  own=${priorityDecision.own},${priorityDecision.ownType} opponent=${priorityDecision.opponent},${priorityDecision.opponentType} result=${priorityDecision.allowed ? 'accepted' : 'rejected'} reason=${priorityDecision.reason}`,
  );
  if (!priorityDecision.allowed) return { attacker, target, hitEvent: null, diagnosticLines };

  const guardKind = selectGuardKind(target, active.guardFlag);
  const guardDistance = active.guardDistance ?? 160;
  const withinGuardDistance = Math.abs(target.x - attacker.x) <= guardDistance;
  if (guardKind && target.guardIntent && withinGuardDistance) {
    const guardPause = active.guardPauseTime ?? active.pauseTime;
    const guardVelocity = active.guardVelocity ?? active.groundVelocity;
    const appliedGuardVelocity = { x: guardVelocity.x * attacker.facing, y: guardVelocity.y };
    const guardHitTime = active.guardHitTime ?? active.groundHitTime ?? 12;
    const guardState = guardKind === 'stand' ? 150 : guardKind === 'crouch' ? 152 : 154;
    const lifeBefore = target.life;
    const guardedAttacker = markAttackerHit(attacker, activeHitDefId, target.id, active.hitId, guardPause.attacker);
    const contactedAttacker = applyAttackerRequestedState(
      activeHitDefId === null ? guardedAttacker : recordMoveContact(guardedAttacker, activeHitDefId, 'guarded'),
      active,
    );
    const guardedTarget = applyTargetRequestedState(applyGuardHit(applyHitDefSnap(target, attacker, active), guardDamage, active.guardKill !== false, guardState, appliedGuardVelocity, guardPause.defender, {
      activeHitDefId,
      selectedHitTime: guardHitTime,
      kind: target.stateType === 'A' ? 'air' : 'ground',
      source: active.guardHitTime === undefined ? 'hardcoded' : 'active_hitdef',
      targetStateTypeAtHit: target.stateType,
      elapsed: 0,
      lastStateNo: guardState,
      selectedAnim: guardState,
      ...(active.guardHitTime === undefined ? { fallbackReason: 'missing_guard_hittime' } : {}),
    }, createGetHitVarSnapshot(active, guardDamage, guardHitTime, target.stateType === 'A' ? 'air' : 'ground', guardVelocity)), active, attacker.id);
    const auxiliary = applyHitDefAuxiliary(contactedAttacker, guardedTarget, attacker, target, active, true);
    const idText = activeHitDefId === null ? 'none' : String(activeHitDefId);
    const hitEvent = createContactHitEvent(attacker, target, active, true, guardDamage, overlap, attackBoxes, bodyBoxes, airDocument);
    if (diagnosticsEnabled) diagnosticLines.push(
      `raw.hit_collision attacker=p${attacker.id} target=p${target.id}`,
      `${collisionHeader} overlap=${formatOverlap(overlap)} damage=${damage},${guardDamage} source=${source} result=guarded`,
      `raw.guard_check attacker=p${attacker.id} target=p${target.id}`,
      `  activeHitDefId=${idText} guardflag=${active.guardFlag ?? '-'} intent=holdback stateType=${target.stateType} crouchIntent=${target.guardCrouchIntent ? 1 : 0} kind=${guardKind} distance=${Math.abs(target.x - attacker.x)} guardDistance=${guardDistance} result=accepted`,
      `raw.move_contact attacker=p${attacker.id} target=p${target.id}`,
      `  activeHitDefId=${idText} contact=1 hit=0 guarded=1 hitCount=${contactedAttacker.moveContact?.hitCount ?? 0} result=accepted`,
      `raw.hit_damage target=p${target.id}`,
      `  activeHitDefId=${idText} lifeBefore=${lifeBefore} appliedDamage=${guardDamage} lifeAfter=${guardedTarget.life} source=guard_damage ko=${guardedTarget.life === 0 ? 1 : 0}`,
      `raw.guard_reaction target=p${target.id}`,
      `  activeHitDefId=${idText} state=${guardState} kind=${guardKind} velocity=(${appliedGuardVelocity.x},${appliedGuardVelocity.y}) damage=${guardDamage} kill=${active.guardKill === false ? 0 : 1} hittime=${guardHitTime} ctrltime=${active.controlTime ?? guardHitTime} pausetime=${guardPause.defender}`,
      ...formatRequestedStateDiagnostics(attacker, target, active, contactedAttacker, guardedTarget),
      ...formatHitEffectDiagnostics(hitEvent, activeHitDefId),
      ...formatHitAuxiliaryDiagnostics(activeHitDefId, attacker, target, auxiliary, active, true),
    );
    return {
      attacker: auxiliary.attacker,
      target: auxiliary.target,
      hitEvent,
      diagnosticLines,
    };
  }
  if (diagnosticsEnabled && target.guardIntent) diagnosticLines.push(
    `raw.guard_check attacker=p${attacker.id} target=p${target.id}`,
    `  activeHitDefId=${activeHitDefId ?? 'none'} guardflag=${active.guardFlag ?? '-'} intent=holdback stateType=${target.stateType} crouchIntent=${target.guardCrouchIntent ? 1 : 0} kind=${guardKind ?? 'none'} distance=${Math.abs(target.x - attacker.x)} guardDistance=${guardDistance} result=rejected reason=${guardKind ? 'out_of_guard_distance' : 'guardflag_mismatch'}`,
  );

  const isAirJuggle = target.stateType === 'A';
  const juggleCost = Math.max(0, attacker.juggle ?? 0);
  const juggleMax = target.juggleMax ?? 15;
  const juggleBefore = target.juggleRemaining ?? juggleMax;
  if (isAirJuggle && juggleCost > juggleBefore) {
    if (diagnosticsEnabled) diagnosticLines.push(
      `raw.hit_collision attacker=p${attacker.id} target=p${target.id}`,
      `${collisionHeader} overlap=${formatOverlap(overlap)} result=rejected reason=juggle_insufficient`,
      `raw.hit_juggle attacker=p${attacker.id} target=p${target.id}`,
      `  activeHitDefId=${activeHitDefId ?? 'none'} state=${attacker.stateNo} cost=${juggleCost} before=${juggleBefore} after=${juggleBefore} max=${juggleMax} result=rejected reason=insufficient_points`,
    );
    return { attacker, target, hitEvent: null, diagnosticLines };
  }
  if (isAirJuggle) target = { ...target, juggleMax, juggleRemaining: juggleBefore - juggleCost };

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
  const reactionState = hitTimeKind === 'air'
    ? AIR_HIT_SHAKE_STATE
    : targetStateTypeAtHit === 'C'
      ? CROUCH_HIT_STATE
      : STAND_HIT_STATE;
  const selectedAnimType = hitTimeKind === 'air' ? active.airAnimType ?? 'Light' : active.animType;
  const selectedAnim = hitTimeKind === 'ground' ? groundHitAnim(active?.animType) : airHitAnim(selectedAnimType, active.airType);
  const selectedVelocity = hitTimeKind === 'air' ? active.airVelocity : active.groundVelocity;
  // WinMUGEN HitDef X velocity is expressed in the defender's reaction direction:
  // the commonly used negative value must send the target away from the attacker.
  const worldHitVelocityX = selectedVelocity.x * -attacker.facing;
  const appliedVelocity = { x: Object.is(worldHitVelocityX, -0) ? 0 : worldHitVelocityX, y: selectedVelocity.y };
  const animType = active?.animType ?? 'Light';
  const animSource = active?.animTypeSource ?? 'existing_fallback';
  const animationExists = airDocumentHasAction(airDocument, selectedAnim);
  const hitAttacker = markAttackerHit(attacker, activeHitDefId, target.id, active.hitId, active.pauseTime.attacker);
  const contactedAttacker = applyAttackerRequestedState(
    activeHitDefId === null ? hitAttacker : recordMoveContact(hitAttacker, activeHitDefId, 'hit'),
    active,
  );
  const fallVelocity = {
    x: (active.fall?.xVelocity ?? active.downVelocity?.x ?? 0) * attacker.facing,
    y: active.fall?.yVelocity ?? active.downVelocity?.y ?? 0,
  };
  const hitTarget = rememberHitDefId(applyTargetRequestedState(applyFallbackHit(applyHitDefSnap(target, attacker, active), damage, active.kill !== false, active.numHits ?? 1, reactionState, selectedAnim, appliedVelocity, fallVelocity, active.pauseTime.defender, {
    activeHitDefId,
    selectedHitTime,
    kind: activeHitTime === undefined ? 'fallback' : hitTimeKind,
    source: hitTimeSource,
    targetStateTypeAtHit,
    elapsed: 0,
    lastStateNo: reactionState,
    selectedAnim,
    getHitVarYVelocitySource: hitTimeKind === 'air' ? 'air.velocity.y' : 'ground.velocity.y',
    groundVelocityAtHit: { ...active.groundVelocity },
    airVelocityAtHit: { ...active.airVelocity },
    fallYVelocityAtHit: active.fall?.yVelocity ?? 0,
    ...(activeHitTime === undefined ? { fallbackReason: hitTimeFallbackReason } : {}),
  }, createGetHitVarSnapshot(active, damage, selectedHitTime, hitTimeKind, selectedVelocity)), active, attacker.id), attacker.id, active.hitId);
  const idText = activeHitDefId === null ? 'none' : String(activeHitDefId);
  const auxiliary = applyHitDefAuxiliary(contactedAttacker, hitTarget, attacker, target, active, false);
  const targetedAttacker = activeHitDefId === null
    ? auxiliary.attacker
    : registerTarget(auxiliary.attacker, auxiliary.target, activeHitDefId, active.hitId ?? 0);
  const fallbackReason = '-';
  const hitEvent = createContactHitEvent(attacker, target, active, false, damage, overlap, attackBoxes, bodyBoxes, airDocument);
  if (diagnosticsEnabled) diagnosticLines.push(
    `raw.hit_collision attacker=p${attacker.id} target=p${target.id}`,
    `${collisionHeader} overlap=${formatOverlap(overlap)} damage=${damage},${guardDamage} source=${source} fallbackReason=${fallbackReason} result=hit`,
    `raw.move_contact attacker=p${attacker.id} target=p${target.id}`,
    `  activeHitDefId=${idText} contact=1 hit=1 guarded=0 hitCount=${targetedAttacker.moveContact?.hitCount ?? 0} result=accepted`,
    `raw.target_register owner=p${attacker.id} target=p${target.id}`,
    `  activeHitDefId=${idText} hitDefId=${active.hitId ?? 0} targetLife=${auxiliary.target.life} registered=${auxiliary.target.life > 0 ? 1 : 0} reason=${auxiliary.target.life > 0 ? 'successful_hit' : 'target_ko'}`,
    `raw.hit_damage target=p${target.id}`,
    `  activeHitDefId=${idText} lifeBefore=${lifeBefore} appliedDamage=${damage} lifeAfter=${hitTarget.life} source=${source} kill=${active.kill === false ? 0 : 1} ko=${hitTarget.life === 0 ? 1 : 0}`,
    ...(isAirJuggle ? [
      `raw.hit_juggle attacker=p${attacker.id} target=p${target.id}`,
      `  activeHitDefId=${idText} state=${attacker.stateNo} cost=${juggleCost} before=${juggleBefore} after=${hitTarget.juggleRemaining ?? juggleBefore} max=${juggleMax} result=accepted`,
    ] : []),
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
    ...formatRequestedStateDiagnostics(attacker, target, active, contactedAttacker, hitTarget),
    ...formatHitEffectDiagnostics(hitEvent, activeHitDefId),
    ...formatHitAuxiliaryDiagnostics(activeHitDefId, attacker, target, auxiliary, active, false),
  );
  if (diagnosticsEnabled && activeHitDefId !== null) {
    diagnosticLines.push(
      `raw.hitdef_lifecycle activeHitDefId=${activeHitDefId}`,
      `  event=consume reason=successful_hit hitCount=${targetedAttacker.moveContact?.hitCount ?? 1}`,
    );
  }
  return {
    attacker: targetedAttacker,
    target: auxiliary.target,
    hitEvent,
    diagnosticLines,
  };
}

function isPriorityCandidate(
  attacker: PlayerState,
  target: PlayerState,
  attackBoxes: ReturnType<typeof getPlayerAttackBoxes>,
  bodyBoxes: ReturnType<typeof getPlayerBodyBoxes>,
): boolean {
  const active = attacker.activeHitDef;
  const alreadyConsumed = active ? hasConsumedHitTarget(attacker, target, active) : false;
  return attacker.moveType === 'A'
    && attacker.hitPause <= 0
    && target.hitPause <= 0
    && Boolean(attacker.activeHitDef)
    && !alreadyConsumed
    && findOverlap(attackBoxes, bodyBoxes) !== null
    && evaluateHitEligibility(attacker.activeHitDef!, target).accepted;
}

function createContactHitEvent(
  attacker: PlayerState,
  target: PlayerState,
  hitDef: NonNullable<PlayerState['activeHitDef']>,
  guarded: boolean,
  damage: number,
  overlap: ReturnType<typeof findOverlap>,
  attackBoxes: ReturnType<typeof getPlayerAttackBoxes>,
  bodyBoxes: ReturnType<typeof getPlayerBodyBoxes>,
  airDocument: AirDocument,
): HitEvent {
  const contact = calculateContactPoint(overlap, attackBoxes, bodyBoxes, attacker, target);
  const sparkRef = guarded ? hitDef.guardSpark : hitDef.spark;
  const offset = hitDef.sparkOffset ?? { x: 0, y: 0 };
  const sparkAvailable = sparkRef?.scope === 'attacker'
    ? airDocument.actions.some((action) => action.actionNo === sparkRef.animNo)
    : undefined;
  const soundRef = guarded ? hitDef.guardSound : hitDef.hitSound;
  return {
    attackerId: attacker.id,
    defenderId: target.id,
    damage,
    guarded,
    ...(sparkRef ? { spark: {
      ...sparkRef,
      x: contact.x + offset.x * attacker.facing,
      y: contact.y + offset.y,
      available: sparkAvailable,
    } } : {}),
    ...(soundRef ? { sound: { ...soundRef } } : {}),
    ...(hitDef.envShake && hitDef.envShake.time > 0 ? { envShake: hitDef.envShake } : {}),
  };
}

function calculateContactPoint(
  overlap: ReturnType<typeof findOverlap>,
  attackBoxes: ReturnType<typeof getPlayerAttackBoxes>,
  bodyBoxes: ReturnType<typeof getPlayerBodyBoxes>,
  attacker: PlayerState,
  target: PlayerState,
): { x: number; y: number } {
  if (!overlap) return { x: (attacker.x + target.x) / 2, y: Math.min(attacker.y, target.y) - 52 };
  const attack = attackBoxes[overlap.attackBoxIndex];
  const body = bodyBoxes[overlap.bodyBoxIndex];
  const left = Math.max(attack.x, body.x);
  const right = Math.min(attack.x + attack.width, body.x + body.width);
  const top = Math.max(attack.y, body.y);
  const bottom = Math.min(attack.y + attack.height, body.y + body.height);
  return { x: (left + right) / 2, y: (top + bottom) / 2 };
}

function formatHitEffectDiagnostics(event: HitEvent, activeHitDefId: number | null): string[] {
  if (!event.spark && !event.sound && !event.envShake) return [];
  const sparkAvailability = event.spark?.available === false ? 'missing' : event.spark?.available === true ? 'available' : 'unknown';
  return [
    `raw.hit_effect attacker=p${event.attackerId} target=p${event.defenderId}`,
    `  activeHitDefId=${activeHitDefId ?? 'none'} kind=${event.guarded ? 'guard' : 'hit'} spark=${event.spark ? `${event.spark.scope}:${event.spark.animNo}` : '-'} sparkAvailable=${sparkAvailability} sparkPos=${event.spark ? `${event.spark.x},${event.spark.y}` : '-'} sound=${event.sound ? `${event.sound.scope}:${event.sound.group},${event.sound.index}` : '-'} soundAvailable=${event.sound ? 'deferred' : '-'} envshake=${event.envShake ? `${event.envShake.time},${event.envShake.frequency},${event.envShake.amplitude},${event.envShake.phase}` : '-'} result=generated${event.spark?.available === false ? ' warning=missing_animation' : ''}`,
  ];
}

function applyAttackerRequestedState(attacker: PlayerState, hitDef: NonNullable<PlayerState['activeHitDef']>): PlayerState {
  if (hitDef.p1StateNo === undefined) return attacker;
  const ownerId = attacker.selfStateOwnerId ?? attacker.id;
  return {
    ...attacker,
    stateNo: hitDef.p1StateNo,
    stateTime: 0,
    ctrl: false,
    stateOwnerId: ownerId,
    activeHitDef: null,
    hitDefUsed: false,
  };
}

function applyTargetRequestedState(target: PlayerState, hitDef: NonNullable<PlayerState['activeHitDef']>, attackerId: number): PlayerState {
  const selfOwnerId = target.selfStateOwnerId ?? target.id;
  const stateNo = hitDef.p2StateNo ?? target.stateNo;
  const stateOwnerId = hitDef.p2StateNo === undefined
    ? selfOwnerId
    : hitDef.p2GetP1State ? attackerId : selfOwnerId;
  return {
    ...target,
    stateNo,
    stateTime: hitDef.p2StateNo === undefined ? target.stateTime : 0,
    stateOwnerId,
    stateType: hitDef.forceStand ? 'S' : target.stateType,
  };
}

function formatRequestedStateDiagnostics(
  attackerBefore: PlayerState,
  targetBefore: PlayerState,
  hitDef: NonNullable<PlayerState['activeHitDef']>,
  attackerAfter: PlayerState,
  targetAfter: PlayerState,
): string[] {
  if (hitDef.p1StateNo === undefined && hitDef.p2StateNo === undefined && !hitDef.forceStand) return [];
  return [
    `raw.custom_state attacker=p${attackerBefore.id} target=p${targetBefore.id}`,
    `  p1stateno=${hitDef.p1StateNo ?? '-'} p1Owner=${attackerAfter.stateOwnerId ?? attackerAfter.id} p2stateno=${hitDef.p2StateNo ?? '-'} p2Owner=${targetAfter.stateOwnerId ?? targetAfter.id} p2getp1state=${hitDef.p2GetP1State ? 1 : 0} forcestand=${hitDef.forceStand ? 1 : 0} result=applied`,
  ];
}

function resolvePriorityClash(p1: PlayerState, p2: PlayerState, clashes: boolean): { p1: PriorityDecision; p2: PriorityDecision } {
  const p1Priority = p1.activeHitDef?.priority?.value ?? 4;
  const p2Priority = p2.activeHitDef?.priority?.value ?? 4;
  const p1Type = p1.activeHitDef?.invalidParameters?.includes('priority') ? 'Unsupported' : normalizePriorityType(p1.activeHitDef?.priority?.type);
  const p2Type = p2.activeHitDef?.invalidParameters?.includes('priority') ? 'Unsupported' : normalizePriorityType(p2.activeHitDef?.priority?.type);
  const decision = (allowed: boolean, reason: PriorityDecision['reason'], own: number, opponent: number, ownType: string, opponentType: string): PriorityDecision =>
    ({ allowed, reason, own, opponent, ownType, opponentType });
  if (!clashes) return {
    p1: decision(true, 'no_clash', p1Priority, p2Priority, p1Type, p2Type),
    p2: decision(true, 'no_clash', p2Priority, p1Priority, p2Type, p1Type),
  };
  if (p1Type === 'Unsupported' || p2Type === 'Unsupported') return {
    p1: decision(false, 'unsupported_priority_type', p1Priority, p2Priority, p1Type, p2Type),
    p2: decision(false, 'unsupported_priority_type', p2Priority, p1Priority, p2Type, p1Type),
  };
  if (p1Priority > p2Priority) return {
    p1: decision(true, 'higher_priority', p1Priority, p2Priority, p1Type, p2Type),
    p2: decision(false, 'lower_priority', p2Priority, p1Priority, p2Type, p1Type),
  };
  if (p2Priority > p1Priority) return {
    p1: decision(false, 'lower_priority', p1Priority, p2Priority, p1Type, p2Type),
    p2: decision(true, 'higher_priority', p2Priority, p1Priority, p2Type, p1Type),
  };
  const trades = p1Type === 'Hit' && p2Type === 'Hit';
  return {
    p1: decision(trades, trades ? 'equal_hit_trade' : 'equal_non_hit_miss', p1Priority, p2Priority, p1Type, p2Type),
    p2: decision(trades, trades ? 'equal_hit_trade' : 'equal_non_hit_miss', p2Priority, p1Priority, p2Type, p1Type),
  };
}

function normalizePriorityType(value: string | undefined): 'Hit' | 'Miss' | 'Dodge' | 'Unsupported' {
  const normalized = value?.trim().toLowerCase() ?? 'hit';
  if (normalized === 'hit') return 'Hit';
  if (normalized === 'miss') return 'Miss';
  if (normalized === 'dodge') return 'Dodge';
  return 'Unsupported';
}

function evaluateHitEligibility(hitDef: NonNullable<PlayerState['activeHitDef']>, target: PlayerState): HitEligibility {
  const targetClass = classifyHitTarget(target);
  const hitFlag = (hitDef.hitFlag ?? 'MAF').replace(/\s+/g, '').toUpperCase();
  if (!/^[HLAFDM+-]+$/.test(hitFlag)) return { accepted: false, reason: 'unsupported_hitflag', targetClass };
  if (/[+-]/.test(hitFlag)) return { accepted: false, reason: 'unsupported_hitflag_modifier', targetClass };
  const requiredFlag = targetClass === 'stand' ? ['H', 'M']
    : targetClass === 'crouch' ? ['L', 'M']
      : targetClass === 'air' ? ['A']
        : targetClass === 'fall' ? ['F']
          : ['D'];
  if (!requiredFlag.some((flag) => hitFlag.includes(flag))) return { accepted: false, reason: 'hitflag_state_mismatch', targetClass };
  if (hitDef.invalidParameters?.includes('attr')) return { accepted: false, reason: 'invalid_attr', targetClass };
  if (target.hitBy && !hitAttributeMatchesFilter(hitDef.attr, target.hitBy)) return { accepted: false, reason: 'attr_not_allowed', targetClass };
  if (target.notHitBy && hitAttributeMatchesFilter(hitDef.attr, target.notHitBy)) return { accepted: false, reason: 'attr_blocked', targetClass };
  return { accepted: true, reason: 'accepted', targetClass };
}

function classifyHitTarget(target: PlayerState): 'stand' | 'crouch' | 'air' | 'fall' | 'down' {
  if (target.stateType === 'L') return 'down';
  if (target.stateType === 'A') return target.moveType === 'H' ? 'fall' : 'air';
  if (target.stateType === 'C') return 'crouch';
  return 'stand';
}

function formatActiveAttr(hitDef: NonNullable<PlayerState['activeHitDef']>): string {
  return hitDef.attr ? `${hitDef.attr.stateType},${hitDef.attr.attackTypes.join('|')}` : '-';
}

function mergeCombatRoles(attackerResult: PlayerState, targetResult: PlayerState, wasTargeted: boolean): PlayerState {
  if (!wasTargeted) return attackerResult;
  return {
    ...targetResult,
    hitPause: Math.max(attackerResult.hitPause, targetResult.hitPause),
    hitTargets: attackerResult.hitTargets,
    moveContact: attackerResult.moveContact,
    targets: attackerResult.targets,
    lastHitDefByAttacker: {
      ...(attackerResult.lastHitDefByAttacker ?? {}),
      ...(targetResult.lastHitDefByAttacker ?? {}),
    },
    lastHitAttackerId: targetResult.lastHitAttackerId ?? attackerResult.lastHitAttackerId,
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

function markAttackerHit(
  player: PlayerState,
  activeHitDefId: number | null,
  defenderId: number,
  hitDefId: number | undefined,
  pauseTime: number,
): PlayerState {
  return {
    ...player,
    hitPause: pauseTime,
    hitDefUsed: true,
    hitTargets: activeHitDefId === null ? (player.hitTargets ?? []) : [
      ...(player.hitTargets ?? []),
      { activeHitDefId, defenderId, hitDefId },
    ],
  };
}

type HitAuxiliaryResult = {
  attacker: PlayerState;
  target: PlayerState;
  attackerPowerBefore: number;
  targetPowerBefore: number;
  atEdge: boolean;
  cornerVelocity: number | undefined;
};

function applyHitDefSnap(
  target: PlayerState,
  attacker: PlayerState,
  hitDef: NonNullable<PlayerState['activeHitDef']>,
): PlayerState {
  if (!hitDef.snap) return target;
  return {
    ...target,
    x: attacker.x + hitDef.snap.x * attacker.facing,
    y: attacker.y + hitDef.snap.y,
  };
}

function applyHitDefAuxiliary(
  attackerAfterContact: PlayerState,
  targetAfterContact: PlayerState,
  attackerBefore: PlayerState,
  targetBefore: PlayerState,
  hitDef: NonNullable<PlayerState['activeHitDef']>,
  guarded: boolean,
): HitAuxiliaryResult {
  const attackerPowerBefore = attackerAfterContact.power ?? 0;
  const targetPowerBefore = targetAfterContact.power ?? 0;
  const attackerPower = guarded ? hitDef.getPower?.guarded : hitDef.getPower?.hit;
  const targetPower = guarded ? hitDef.givePower?.guarded : hitDef.givePower?.hit;
  const atEdge = isAtFallbackStageEdge(targetBefore);
  const cornerVelocity = guarded
    ? targetBefore.stateType === 'A' ? hitDef.cornerPush?.airGuard : hitDef.cornerPush?.guard
    : targetBefore.stateType === 'L' ? hitDef.cornerPush?.down
      : targetBefore.stateType === 'A' ? hitDef.cornerPush?.air
        : hitDef.cornerPush?.ground;
  const attacker = {
    ...attackerAfterContact,
    ...(attackerPower === undefined ? {} : { power: addPower(attackerPowerBefore, attackerPower) }),
    ...(hitDef.p1SprPriority === undefined ? {} : { sprPriority: hitDef.p1SprPriority }),
    ...(atEdge && cornerVelocity !== undefined ? { vx: attackerAfterContact.vx + cornerVelocity * attackerBefore.facing } : {}),
  };
  const target = {
    ...targetAfterContact,
    ...(targetPower === undefined ? {} : { power: addPower(targetPowerBefore, targetPower) }),
    ...(hitDef.p2SprPriority === undefined ? {} : { sprPriority: hitDef.p2SprPriority }),
  };
  return { attacker, target, attackerPowerBefore, targetPowerBefore, atEdge, cornerVelocity };
}

function formatHitAuxiliaryDiagnostics(
  activeHitDefId: number | null,
  attackerBefore: PlayerState,
  targetBefore: PlayerState,
  result: HitAuxiliaryResult,
  hitDef: NonNullable<PlayerState['activeHitDef']>,
  guarded: boolean,
): string[] {
  const lines: string[] = [];
  if (hitDef.getPower || hitDef.givePower) lines.push(
    `raw.hit_power attacker=p${attackerBefore.id} target=p${targetBefore.id}`,
    `  activeHitDefId=${activeHitDefId ?? 'none'} kind=${guarded ? 'guard' : 'hit'} getpower=${guarded ? hitDef.getPower?.guarded ?? '-' : hitDef.getPower?.hit ?? '-'} attackerBefore=${result.attackerPowerBefore} attackerAfter=${result.attacker.power ?? 0} givepower=${guarded ? hitDef.givePower?.guarded ?? '-' : hitDef.givePower?.hit ?? '-'} targetBefore=${result.targetPowerBefore} targetAfter=${result.target.power ?? 0} result=applied`,
  );
  if (hitDef.cornerPush && Object.values(hitDef.cornerPush).some((value) => value !== undefined)) lines.push(
    `raw.hit_cornerpush attacker=p${attackerBefore.id} target=p${targetBefore.id}`,
    `  activeHitDefId=${activeHitDefId ?? 'none'} kind=${guarded ? 'guard' : targetBefore.stateType === 'L' ? 'down' : targetBefore.stateType === 'A' ? 'air' : 'ground'} atEdge=${result.atEdge ? 1 : 0} veloff=${result.cornerVelocity ?? '-'} facing=${attackerBefore.facing} vxBefore=${attackerBefore.vx} vxAfter=${result.attacker.vx} result=${result.atEdge && result.cornerVelocity !== undefined ? 'applied' : 'skipped'} reason=${!result.atEdge ? 'target_not_at_edge' : result.cornerVelocity === undefined ? 'parameter_not_selected' : '-'}`,
  );
  if (hitDef.snap) lines.push(
    `raw.hit_snap attacker=p${attackerBefore.id} target=p${targetBefore.id}`,
    `  activeHitDefId=${activeHitDefId ?? 'none'} offset=${hitDef.snap.x},${hitDef.snap.y} facing=${attackerBefore.facing} before=${targetBefore.x},${targetBefore.y} after=${result.target.x},${result.target.y} result=applied`,
  );
  if (hitDef.p1SprPriority !== undefined || hitDef.p2SprPriority !== undefined) lines.push(
    `raw.hit_sprpriority attacker=p${attackerBefore.id} target=p${targetBefore.id}`,
    `  activeHitDefId=${activeHitDefId ?? 'none'} p1=${hitDef.p1SprPriority ?? '-'} p2=${hitDef.p2SprPriority ?? '-'} result=applied`,
  );
  return lines;
}

function hasConsumedHitTarget(
  attacker: PlayerState,
  target: PlayerState,
  hitDef: NonNullable<PlayerState['activeHitDef']>,
): boolean {
  const currentGeneration = (attacker.hitTargets ?? []).filter(
    (record) => record.activeHitDefId === hitDef.diagnosticId,
  );
  return currentGeneration.some((record) => record.defenderId === target.id)
    || (hitDef.hitOnce === true && currentGeneration.length > 0);
}

function evaluateHitChain(
  hitDef: NonNullable<PlayerState['activeHitDef']>,
  previousHitDefId: number | undefined,
): { accepted: boolean; reason: 'no_constraint' | 'chainid_match' | 'chainid_mismatch' | 'nochainid_match' } {
  if (hitDef.noChainIds?.includes(previousHitDefId as number)) return { accepted: false, reason: 'nochainid_match' };
  if (hitDef.chainId !== undefined) {
    return previousHitDefId === hitDef.chainId
      ? { accepted: true, reason: 'chainid_match' }
      : { accepted: false, reason: 'chainid_mismatch' };
  }
  return { accepted: true, reason: 'no_constraint' };
}

function rememberHitDefId(player: PlayerState, attackerId: number, hitDefId: number | undefined): PlayerState {
  if (hitDefId === undefined) return player;
  return {
    ...player,
    lastHitDefByAttacker: {
      ...(player.lastHitDefByAttacker ?? {}),
      [attackerId]: hitDefId,
    },
    lastHitAttackerId: attackerId,
  };
}

function applyFallbackHit(
  defender: PlayerState,
  damage: number,
  canKill: boolean,
  numHits: number,
  stateNo: number,
  selectedAnim: number,
  velocity: { x: number; y: number },
  fallVelocity: { x: number; y: number },
  pauseTime: number,
  hitStun: NonNullable<PlayerState['hitStun']>,
  getHitVars: Record<string, number>,
): PlayerState {
  const comboHitCount = (defender.comboHitCount ?? 0) + Math.max(0, Math.trunc(numHits));
  return {
    ...defender,
    life: Math.max(canKill ? 0 : Math.min(1, defender.life), defender.life - damage),
    comboHitCount,
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
    getHitVars: { ...getHitVars, hitcount: comboHitCount },
    getHitVarUnsupportedKeys: ['fall.time', 'zoff'],
  };
}

function applyGuardHit(
  defender: PlayerState,
  damage: number,
  canKill: boolean,
  stateNo: number,
  velocity: { x: number; y: number },
  pauseTime: number,
  hitStun: NonNullable<PlayerState['hitStun']>,
  getHitVars: Record<string, number>,
): PlayerState {
  return {
    ...defender,
    life: Math.max(canKill ? 0 : Math.min(1, defender.life), defender.life - damage),
    stateNo,
    stateTime: 0,
    animNo: stateNo,
    animTime: 0,
    moveType: 'H',
    physics: 'N',
    ctrl: false,
    vx: velocity.x,
    vy: velocity.y,
    hitVelX: velocity.x,
    hitVelY: velocity.y,
    hitPause: pauseTime,
    hitDefUsed: false,
    activeHitDef: null,
    hitFall: false,
    hitStun,
    getHitVars: { ...getHitVars, guarded: 1 },
    getHitVarUnsupportedKeys: ['fall.time', 'zoff'],
  };
}

function selectGuardKind(player: PlayerState, guardFlag: string | undefined): 'stand' | 'crouch' | 'air' | null {
  if (!guardFlag) return null;
  const flags = guardFlag.toUpperCase();
  if (player.stateType === 'A') return flags.includes('A') ? 'air' : null;
  if (player.stateType === 'C' || player.guardCrouchIntent) return flags.includes('L') || flags.includes('M') ? 'crouch' : null;
  return flags.includes('H') || flags.includes('M') ? 'stand' : null;
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
    'fall.kill': fall.kill === false ? 0 : 1,
    'fall.xvel': fall.xVelocity ?? 0,
    'fall.yvel': fall.yVelocity ?? 0,
    'fall.recover': fall.recover === false ? 0 : 1,
    'fall.recovertime': fall.recoverTime ?? 0,
    hitid: hitDef.hitId ?? 0,
    chainid: hitDef.chainId ?? -1,
    xoff: hitDef.snap?.x ?? 0,
    yoff: hitDef.snap?.y ?? 0,
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
