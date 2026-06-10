import type { ActiveHitDef, HitEvent, PlayerState, ProjectileState, Rect } from '../engine/types';
import { intersects } from '../collision/CollisionBox';

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
      .map((projectile) => ({
        ...projectile,
        x: projectile.x + projectile.vx,
        y: projectile.y + projectile.vy,
        animTime: projectile.animTime + 1,
        lifeTime: projectile.lifeTime + 1,
      }))
      .filter(
        (projectile) =>
          projectile.lifeTime < projectile.removeTime &&
          projectile.x > -80 &&
          projectile.x < 720 &&
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
    const target = projectile.ownerId === 1 ? p2 : p1;
    const projectileBox = getProjectileWorldBox(projectile);
    const targetBox = getPlayerFallbackBodyBox(target);

    if (target.hitPause === 0 && intersects(projectileBox, targetBox)) {
      const hitTarget = applyProjectileHit(target, projectile);
      if (projectile.ownerId === 1) {
        p2 = hitTarget;
      } else {
        p1 = hitTarget;
      }
      hitEvents.push({
        attackerId: projectile.ownerId,
        defenderId: target.id,
        damage: projectile.hitDef.damage,
      });
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

export function getProjectileWorldBox(projectile: ProjectileState): Rect {
  return {
    x: projectile.x + projectile.hitBox.x,
    y: projectile.y + projectile.hitBox.y,
    width: projectile.hitBox.width,
    height: projectile.hitBox.height,
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
  return applyHit(defender, projectile.facing, projectile.hitDef);
}

function applyHit(
  defender: PlayerState,
  attackerFacing: 1 | -1,
  hitDef: ActiveHitDef,
): PlayerState {
  const isAirHit = defender.stateType === 'A' || defender.y < 285;
  const velocity = isAirHit ? hitDef.airVelocity : hitDef.groundVelocity;
  const launched = velocity.y !== 0;

  return {
    ...defender,
    life: Math.max(0, defender.life - hitDef.damage),
    stateNo: launched || isAirHit ? AIR_HIT_STATE : STAND_HIT_STATE,
    stateTime: 0,
    animNo: launched || isAirHit ? AIR_HIT_STATE : STAND_HIT_STATE,
    animTime: 0,
    stateType: launched || isAirHit ? 'A' : 'S',
    moveType: 'H',
    physics: launched || isAirHit ? 'A' : 'N',
    ctrl: false,
    vx: attackerFacing * Math.abs(velocity.x),
    vy: velocity.y,
    hitPause: hitDef.pauseTime.defender,
    activeHitDef: null,
    hitDefUsed: false,
  };
}
