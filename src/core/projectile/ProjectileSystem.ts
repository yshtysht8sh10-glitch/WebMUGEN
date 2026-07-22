import type { HitEvent, PlayerState, ProjectileState, Rect } from '../engine/types';
import { intersects } from '../collision/CollisionBox';
import { createGetHitVarSnapshot, createHitEffectEvent } from '../engine/FallbackHitResolver';
import { recordMoveContact } from '../hitdef/MoveContactState';
import { addPlayerPower } from '../power/PowerGauge';

export type ProjectileStepResult = {
  projectiles: ProjectileState[];
};

export type ProjectileHitResult = {
  players: [PlayerState, PlayerState];
  projectiles: ProjectileState[];
  hitEvents: HitEvent[];
};

const STAND_HIT_STATE = 5000;
const AIR_HIT_STATE = 5030;

export function stepProjectiles(projectiles: ProjectileState[]): ProjectileStepResult {
  return {
    projectiles: projectiles
      .map((projectile) => projectile.phase === 'hit'
        ? { ...projectile, animTime: projectile.animTime + 1 }
        : {
          ...projectile,
          x: projectile.x + projectile.vx,
          y: projectile.y + projectile.vy,
          vx: projectile.vx + (projectile.ax ?? 0),
          vy: projectile.vy + (projectile.ay ?? 0),
          animTime: projectile.animTime + 1,
          lifeTime: projectile.lifeTime + 1,
        })
      .filter(
        (projectile) =>
          (projectile.phase === 'hit'
            ? projectile.animTime < (projectile.hitAnimDuration ?? 1)
            : projectile.removeTime < 0 || projectile.lifeTime < projectile.removeTime) &&
          projectile.x > -80 &&
          projectile.x < 1040 &&
          projectile.y > -80 &&
          projectile.y < 420,
      ),
  };
}

export function resolveProjectileHits(
  players: [PlayerState, PlayerState],
  projectiles: ProjectileState[],
): ProjectileHitResult {
  let p1 = players[0];
  let p2 = players[1];
  const remaining: ProjectileState[] = [];
  const hitEvents: HitEvent[] = [];

  for (const projectile of projectiles) {
    if (projectile.phase === 'hit') {
      remaining.push(projectile);
      continue;
    }
    const target = projectile.ownerId === 1 ? p2 : p1;
    const owner = projectile.ownerId === 1 ? p1 : p2;
    const projectileBox = getProjectileWorldBox(projectile);
    const targetBox = getPlayerFallbackBodyBox(target);

    if (target.hitPause === 0 && intersects(projectileBox, targetBox)) {
      const guarded = canGuardProjectile(target, projectile);
      const reactedTarget = guarded ? applyProjectileGuard(target, projectile) : applyProjectileHit(target, projectile);
      const givePower = guarded ? projectile.hitDef.givePower?.guarded : projectile.hitDef.givePower?.hit;
      const hitTarget = givePower === undefined ? reactedTarget : addPlayerPower(reactedTarget, givePower);
      const contactedOwner = applyProjectileOwnerContact(owner, projectile, guarded);
      if (projectile.ownerId === 1) {
        p1 = contactedOwner;
        p2 = hitTarget;
      } else {
        p2 = contactedOwner;
        p1 = hitTarget;
      }
      hitEvents.push(createHitEffectEvent(
        owner,
        target,
        projectile.hitDef,
        guarded,
        guarded ? projectile.hitDef.guardDamage : projectile.hitDef.damage,
        intersectionCenter(projectileBox, targetBox),
      ));
      if (projectile.removeOnHit !== false && projectile.hitAnimNo !== undefined) {
        remaining.push({
          ...projectile,
          animNo: projectile.hitAnimNo,
          animTime: 0,
          phase: 'hit',
          vx: 0,
          vy: 0,
          ax: 0,
          ay: 0,
        });
      } else if (projectile.removeOnHit === false) {
        remaining.push(projectile);
      }
      continue;
    }

    remaining.push(projectile);
  }

  return {
    players: [p1, p2],
    projectiles: remaining,
    hitEvents,
  };
}

function intersectionCenter(a: Rect, b: Rect): { x: number; y: number } {
  const left = Math.max(a.x, b.x);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return { x: (left + right) / 2, y: (top + bottom) / 2 };
}

export function getProjectileWorldBox(projectile: ProjectileState): Rect {
  const scaleX = Math.abs(projectile.scaleX ?? 1);
  const scaleY = Math.abs(projectile.scaleY ?? 1);
  const facingOffsetX = projectile.facing === 1
    ? projectile.hitBox.x
    : -(projectile.hitBox.x + projectile.hitBox.width);
  return {
    x: projectile.x + facingOffsetX * scaleX,
    y: projectile.y + projectile.hitBox.y * scaleY,
    width: projectile.hitBox.width * scaleX,
    height: projectile.hitBox.height * scaleY,
  };
}

function getPlayerFallbackBodyBox(player: PlayerState): Rect {
  return {
    x: player.x - 16,
    y: player.y - 78,
    width: 32,
    height: 78,
  };
}

function applyProjectileHit(defender: PlayerState, projectile: ProjectileState): PlayerState {
  return applyHit(defender, projectile);
}

function applyHit(
  defender: PlayerState,
  projectile: ProjectileState,
): PlayerState {
  const { hitDef } = projectile;
  const isAirHit = defender.stateType === 'A' || defender.y < 285;
  const velocity = isAirHit ? hitDef.airVelocity : hitDef.groundVelocity;
  const launched = velocity.y !== 0;
  const hitTimeKind = isAirHit ? 'air' : 'ground';
  const hitTime = (isAirHit ? hitDef.airHitTime : hitDef.groundHitTime) ?? 28;
  const worldVelocityX = velocity.x * -projectile.facing;
  const appliedVelocity = {
    x: Object.is(worldVelocityX, -0) ? 0 : worldVelocityX,
    y: velocity.y,
  };
  const getHitVars = createGetHitVarSnapshot(hitDef, hitDef.damage, hitTime, hitTimeKind, velocity);
  const stateNo = launched || isAirHit ? AIR_HIT_STATE : STAND_HIT_STATE;
  const comboHitCount = (defender.comboHitCount ?? 0) + Math.max(0, Math.trunc(hitDef.numHits ?? 1));
  const fallVelocity = {
    x: (hitDef.fall?.xVelocity ?? 0) * projectile.facing,
    y: hitDef.fall?.yVelocity ?? -4.5,
  };

  return {
    ...defender,
    life: Math.max(0, defender.life - hitDef.damage),
    comboHitCount,
    stateNo,
    stateTime: 0,
    animNo: stateNo,
    animTime: 0,
    stateType: launched || isAirHit ? 'A' : 'S',
    moveType: 'H',
    // WinMUGEN common get-hit states own gravity through GetHitVar(yaccel).
    // Physics=A here would either double-apply gravity or bypass that route.
    physics: 'N',
    ctrl: false,
    vx: appliedVelocity.x,
    vy: appliedVelocity.y,
    hitVelX: appliedVelocity.x,
    hitVelY: appliedVelocity.y,
    hitFall: getHitVars.fall !== 0,
    fallRecover: getHitVars['fall.recover'] !== 0,
    fallRecoverTime: getHitVars['fall.recovertime'],
    hitFallVelocity: fallVelocity,
    hitPause: hitDef.pauseTime.defender,
    palFx: hitDef.palFx && hitDef.palFx.duration !== 0
      ? {
          ...hitDef.palFx,
          remainingTime: hitDef.palFx.duration,
          elapsedTime: 0,
          ownerEntityId: projectile.ownerId,
        }
      : defender.palFx,
    activeHitDef: null,
    hitDefUsed: false,
    hitStun: {
      activeHitDefId: hitDef.diagnosticId ?? null,
      selectedHitTime: hitTime,
      kind: isAirHit ? 'air' : hitDef.groundHitTime === undefined ? 'fallback' : 'ground',
      source: (isAirHit ? hitDef.airHitTime : hitDef.groundHitTime) === undefined ? 'hardcoded' : 'active_hitdef',
      targetStateTypeAtHit: defender.stateType,
      fallbackReason: (isAirHit ? hitDef.airHitTime : hitDef.groundHitTime) === undefined
        ? `missing_${hitTimeKind}_hittime`
        : undefined,
      elapsed: 0,
      lastStateNo: stateNo,
      selectedAnim: stateNo,
      getHitVarYVelocitySource: isAirHit ? 'air.velocity.y' : 'ground.velocity.y',
      groundVelocityAtHit: { ...hitDef.groundVelocity },
      airVelocityAtHit: { ...hitDef.airVelocity },
      fallYVelocityAtHit: hitDef.fall?.yVelocity ?? 0,
    },
    getHitVars: { ...getHitVars, hitcount: comboHitCount },
    getHitVarUnsupportedKeys: ['fall.time', 'zoff'],
    hitDiagnosticLines: [
      ...(defender.hitDiagnosticLines ?? []),
      `raw.projectile_hit_reaction owner=p${projectile.ownerId} projectileId=${projectile.id} target=p${defender.id}`,
      `  state=${stateNo} velocity=(${appliedVelocity.x},${appliedVelocity.y}) velocityKind=${hitTimeKind} yaccel=${getHitVars.yaccel} hittime=${hitTime} attackerFacing=${projectile.facing} hitAnim=${projectile.hitAnimNo ?? '-'} hitAnimDuration=${projectile.hitAnimDuration ?? '-'}`,
    ],
  };
}

function canGuardProjectile(defender: PlayerState, projectile: ProjectileState): boolean {
  if (!defender.guardIntent || !projectile.hitDef.guardFlag) return false;
  const flags = projectile.hitDef.guardFlag.toUpperCase();
  if (defender.stateType === 'A') return flags.includes('A');
  if (defender.stateType === 'C' || defender.guardCrouchIntent) return flags.includes('L') || flags.includes('M');
  return flags.includes('H') || flags.includes('M');
}

function applyProjectileGuard(defender: PlayerState, projectile: ProjectileState): PlayerState {
  const { hitDef } = projectile;
  const guardKind = defender.stateType === 'A' ? 'air' : defender.stateType === 'C' || defender.guardCrouchIntent ? 'crouch' : 'stand';
  const stateNo = guardKind === 'air' ? 154 : guardKind === 'crouch' ? 152 : 150;
  const guardPause = hitDef.guardPauseTime ?? hitDef.pauseTime;
  const guardVelocity = hitDef.guardVelocity ?? hitDef.groundVelocity;
  const hitTime = hitDef.guardHitTime ?? hitDef.groundHitTime ?? 12;
  const getHitVars = createGetHitVarSnapshot(hitDef, hitDef.guardDamage, hitTime, guardKind === 'air' ? 'air' : 'ground', guardVelocity);
  const minimumLife = hitDef.guardKill === false ? 1 : 0;
  return {
    ...defender,
    life: Math.max(minimumLife, defender.life - hitDef.guardDamage),
    stateNo,
    stateTime: 0,
    animNo: stateNo,
    animTime: 0,
    moveType: 'H',
    physics: 'N',
    ctrl: false,
    vx: guardVelocity.x * projectile.facing,
    vy: guardVelocity.y,
    hitPause: guardPause.defender,
    hitStun: {
      activeHitDefId: hitDef.diagnosticId ?? projectile.id,
      selectedHitTime: hitTime,
      kind: guardKind === 'air' ? 'air' : 'ground',
      source: hitDef.guardHitTime === undefined ? 'hardcoded' : 'active_hitdef',
      targetStateTypeAtHit: defender.stateType,
      elapsed: 0,
      lastStateNo: stateNo,
      selectedAnim: stateNo,
    },
    getHitVars: { ...getHitVars, guarded: 1 },
    getHitVarUnsupportedKeys: ['fall.time', 'zoff'],
  };
}

function applyProjectileOwnerContact(owner: PlayerState, projectile: ProjectileState, guarded: boolean): PlayerState {
  const power = guarded ? projectile.hitDef.getPower?.guarded : projectile.hitDef.getPower?.hit;
  const pause = guarded ? projectile.hitDef.guardPauseTime?.attacker ?? projectile.hitDef.pauseTime.attacker : projectile.hitDef.pauseTime.attacker;
  const contacted = recordMoveContact(owner, projectile.hitDef.diagnosticId ?? projectile.id, guarded ? 'guarded' : 'hit');
  return {
    ...(power === undefined ? contacted : addPlayerPower(contacted, power)),
    hitPause: Math.max(contacted.hitPause, pause),
    projectileContacts: {
      ...(contacted.projectileContacts ?? {}),
      [projectile.id]: {
        contactTime: 1,
        hitTime: guarded ? -1 : 1,
        guardedTime: guarded ? 1 : -1,
      },
    },
  };
}
