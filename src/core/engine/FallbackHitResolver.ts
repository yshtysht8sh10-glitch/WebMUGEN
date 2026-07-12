import type { AirDocument } from '../../parser/air/AirTypes';
import {
  anyIntersects,
  getPlayerAttackBoxes,
  getPlayerBodyBoxes,
} from '../collision/CollisionResolver';
import type { GameState, HitEvent, PlayerState } from './types';

const ATTACKER_HIT_PAUSE = 4;
const DEFENDER_HIT_PAUSE = 8;
const STAND_HIT_STATE = 5000;

export function resolveFallbackHits(state: GameState, airDocument?: AirDocument | null, diagnosticsEnabled = true): GameState {
  if (!airDocument) {
    return state;
  }

  let p1 = state.players[0];
  let p2 = state.players[1];
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
  const selectedAnim = hitTimeKind === 'ground' ? groundHitAnim(active?.animType) : STAND_HIT_STATE;
  const animType = active?.animType ?? 'Light';
  const animSource = active?.animTypeSource ?? 'existing_fallback';
  const animationExists = airDocumentHasAction(airDocument, selectedAnim);
  const hitAttacker = markAttackerHit(attacker, activeHitDefId, target.id);
  const hitTarget = applyFallbackHit(target, hitAttacker, damage, selectedAnim, {
    activeHitDefId,
    selectedHitTime,
    kind: activeHitTime === undefined ? 'fallback' : hitTimeKind,
    source: hitTimeSource,
    targetStateTypeAtHit,
    elapsed: 0,
    lastStateNo: STAND_HIT_STATE,
    selectedAnim,
    ...(activeHitTime === undefined ? { fallbackReason: hitTimeFallbackReason } : {}),
  });
  const idText = activeHitDefId === null ? 'none' : String(activeHitDefId);
  const fallbackReason = '-';
  if (diagnosticsEnabled) diagnosticLines.push(
    `raw.hit_collision attacker=p${attacker.id} target=p${target.id}`,
    `${collisionHeader} overlap=${formatOverlap(overlap)} damage=${damage},${guardDamage} source=${source} fallbackReason=${fallbackReason} result=hit`,
    `raw.hit_damage target=p${target.id}`,
    `  activeHitDefId=${idText} lifeBefore=${lifeBefore} appliedDamage=${damage} lifeAfter=${hitTarget.life} source=${source} ko=${hitTarget.life === 0 ? 1 : 0}`,
    ...(hitTimeKind === 'ground' ? [
      `raw.hit_anim_select target=p${target.id}`,
      `  activeHitDefId=${idText} animType=${animType} targetStateTypeAtHit=${targetStateTypeAtHit} requestedAnim=${selectedAnim} selectedAnim=${selectedAnim} animationExists=${animationExists ? 1 : 0} source=${animSource} fallbackReason=${animSource === 'cns' ? '-' : 'existing_fixed_5000'}${animationExists ? '' : ' warning=missing_required_animation'}`,
    ] : []),
    `raw.hit_reaction target=p${target.id}`,
    `  state=${STAND_HIT_STATE} source=existing_fallback anim=${selectedAnim} source=${hitTimeKind === 'ground' ? animSource : 'existing_fallback'}`,
    `  velocity=(${hitAttacker.facing * 4},0) source=existing_fallback pausetime=${DEFENDER_HIT_PAUSE} source=existing_fallback`,
    `  hittime=${selectedHitTime} source=${hitTimeSource} hittimeKind=${activeHitTime === undefined ? 'fallback' : hitTimeKind} targetStateTypeAtHit=${targetStateTypeAtHit}`,
    '  fall=0 source=existing_fallback',
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
    attacker: hitAttacker,
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

function markAttackerHit(player: PlayerState, activeHitDefId: number | null, defenderId: number): PlayerState {
  return {
    ...player,
    hitPause: ATTACKER_HIT_PAUSE,
    hitDefUsed: true,
    hitTargets: activeHitDefId === null ? (player.hitTargets ?? []) : [
      ...(player.hitTargets ?? []),
      { activeHitDefId, defenderId },
    ],
  };
}

function applyFallbackHit(
  defender: PlayerState,
  attacker: PlayerState,
  damage: number,
  selectedAnim: number,
  hitStun: NonNullable<PlayerState['hitStun']>,
): PlayerState {
  return {
    ...defender,
    life: Math.max(0, defender.life - damage),
    stateNo: STAND_HIT_STATE,
    animNo: selectedAnim,
    stateTime: 0,
    animTime: 0,
    stateType: 'S',
    moveType: 'H',
    physics: 'N',
    ctrl: false,
    vx: attacker.facing * 4,
    vy: 0,
    hitPause: DEFENDER_HIT_PAUSE,
    hitDefUsed: false,
    activeHitDef: null,
    hitStun,
  };
}

function groundHitAnim(animType: NonNullable<PlayerState['activeHitDef']>['animType']): number {
  if (animType === 'Medium') return 5001;
  if (animType === 'Hard') return 5002;
  return 5000;
}

function airDocumentHasAction(document: AirDocument | null, actionNo: number): boolean {
  return document?.actions.some((action) => action.actionNo === actionNo) === true;
}
