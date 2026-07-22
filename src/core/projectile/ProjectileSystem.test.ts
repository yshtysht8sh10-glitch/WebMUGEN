import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { parseAirText } from '../../parser/air/AirParser';
import { stepCnsPhysicsMotion } from '../cns/CnsPhysicsStep';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { createInitialGameState } from '../engine/GameState';
import { applyHitEffectRuntime } from '../hitdef/HitEffectRuntime';
import { getProjectileWorldBox, resolveProjectileHits, stepProjectiles } from './ProjectileSystem';
import type { ProjectileState } from '../engine/types';

function createProjectile(): ProjectileState {
  return {
    id: 1000,
    ownerId: 1,
    x: 420,
    y: 230,
    vx: 5,
    vy: 0,
    facing: 1,
    animNo: 1100,
    animTime: 0,
    lifeTime: 0,
    removeTime: 90,
    hitDef: {
      damage: 90,
      guardDamage: 20,
      pauseTime: { attacker: 4, defender: 12 },
      groundVelocity: { x: -5, y: 0 },
      airVelocity: { x: -3, y: -6 },
    },
    hitBox: {
      x: -12,
      y: -12,
      width: 24,
      height: 24,
    },
  };
}

describe('ProjectileSystem', () => {
  it('steps projectile position', () => {
    const projectile = { ...createProjectile(), ax: 0.5, ay: 0.25 };
    const result = stepProjectiles([projectile]);

    expect(result.projectiles[0].x).toBe(425);
    expect(result.projectiles[0].vx).toBe(5.5);
    expect(result.projectiles[0].vy).toBe(0.25);
    expect(result.projectiles[0].animTime).toBe(1);
    expect(result.projectiles[0].lifeTime).toBe(1);
  });

  it('mirrors and scales the projectile collision box with Facing', () => {
    const box = getProjectileWorldBox({
      ...createProjectile(), facing: -1, scaleX: 0.5, scaleY: 2,
      hitBox: { x: -5, y: -10, width: 50, height: 20 },
    });
    expect(box).toEqual({ x: 397.5, y: 210, width: 25, height: 40 });
  });

  it('removes projectile on hit', () => {
    const state = createInitialGameState();
    const projectile = createProjectile();

    const result = resolveProjectileHits(state.players, [projectile]);

    expect(result.hitEvents).toHaveLength(1);
    expect(result.projectiles).toHaveLength(0);
    expect(result.players[1].life).toBe(910);
    expect(result.players[1].stateNo).toBe(5000);
    expect(result.players[0].moveContact).toMatchObject({ hit: true, guarded: false, hitCount: 1 });
  });

  it('connects guard, power transfer, MoveGuarded and defender PalFX for Projectile HitDef data', () => {
    const state = createInitialGameState();
    const projectile = {
      ...createProjectile(),
      hitDef: {
        ...createProjectile().hitDef,
        guardFlag: 'MA',
        guardVelocity: { x: -2, y: 0 },
        guardHitTime: 15,
        guardPauseTime: { attacker: 3, defender: 4 },
        getPower: { hit: 280, guarded: 20 },
        givePower: { hit: 140, guarded: 10 },
        palFx: {
          duration: 50, color: 0, invertAll: true,
          add: { red: 0, green: -70, blue: -170 },
          multiply: { red: 256, green: 256, blue: 256 },
          sinAdd: { red: 60, green: 60, blue: 50, period: 10 },
        },
      },
    };

    const guarded = resolveProjectileHits([
      state.players[0], { ...state.players[1], guardIntent: true },
    ], [projectile]);
    expect(guarded.players[0]).toMatchObject({ power: 20, hitPause: 3, moveContact: { hit: false, guarded: true, hitCount: 0 } });
    expect(guarded.players[1]).toMatchObject({ life: 980, power: 10, stateNo: 150, vx: -2, hitPause: 4 });
    expect(guarded.players[1].palFx).toBeUndefined();
    expect(guarded.hitEvents[0].guarded).toBe(true);

    const hit = resolveProjectileHits(state.players, [projectile]);
    expect(hit.players[0]).toMatchObject({ power: 280, moveContact: { hit: true, guarded: false, hitCount: 1 } });
    expect(hit.players[1]).toMatchObject({ power: 140, palFx: { remainingTime: 50, elapsedTime: 0, color: 0, invertAll: true } });
  });

  it('connects launched projectile hits to common get-hit gravity and hit-stun data', () => {
    const state = createInitialGameState();
    const projectile = {
      ...createProjectile(),
      hitDef: {
        ...createProjectile().hitDef,
        groundHitTime: 20,
        groundVelocity: { x: -20, y: -8 },
      },
    };

    const result = resolveProjectileHits(state.players, [projectile]);
    const defender = result.players[1];

    expect(defender).toMatchObject({
      stateNo: 5030,
      stateType: 'A',
      moveType: 'H',
      physics: 'N',
      ctrl: false,
      vx: 20,
      vy: -8,
      hitVelX: 20,
      hitVelY: -8,
      hitPause: 12,
      hitStun: {
        selectedHitTime: 20,
        kind: 'ground',
        source: 'active_hitdef',
        targetStateTypeAtHit: 'S',
        groundVelocityAtHit: { x: -20, y: -8 },
      },
      getHitVars: {
        hittime: 20,
        xvel: -20,
        yvel: -8,
        yaccel: 0.6,
      },
    });
    expect(defender.hitDiagnosticLines?.join('\n')).toContain('raw.projectile_hit_reaction');

    const common = parseCnsText(`
[StateDef 5030]
type = A
movetype = H
physics = N

[State 5030, Gravity]
type = VelAdd
trigger1 = 1
y = GetHitVar(yaccel)

[State 5030, Restore hit velocity]
type = HitVelSet
trigger1 = Time = 0
x = 1
y = 1
`);
    let launched = {
      ...state,
      players: [state.players[0], { ...defender, hitPause: 0 }] as typeof state.players,
      projectiles: [],
    };
    launched = stepCnsStateRuntime(launched, common).state;
    launched = stepCnsPhysicsMotion(launched, common);
    launched = stepCnsStateRuntime(launched, common).state;

    expect(launched.players[1].vy).toBeCloseTo(-7.4);
  });

  it('routes the Projectile HitDef spark through the attacker character AIR', () => {
    const state = createInitialGameState();
    const projectile = {
      ...createProjectile(),
      hitDef: {
        ...createProjectile().hitDef,
        spark: { animNo: 1660, scope: 'attacker' as const },
        sparkOffset: { x: 30, y: -37 },
      },
    };

    const contact = resolveProjectileHits(state.players, [projectile]);
    expect(contact.hitEvents[0]).toMatchObject({
      attackerId: 1,
      defenderId: 2,
      spark: { animNo: 1660, scope: 'attacker', coordinateSpace: 'stage' },
    });

    const integrated = applyHitEffectRuntime({
      ...state,
      players: contact.players,
      projectiles: contact.projectiles,
      hitEvents: contact.hitEvents,
    }, {
      ownerAir: () => parseAirText('[Begin Action 1660]\n1660,0,0,0,2'),
      ownerSounds: () => null,
      fightFxAir: null,
      commonSounds: null,
    });

    expect(integrated.state.explods.entries[0]).toMatchObject({
      effectKind: 'hit-spark',
      animationSource: 'owner',
      animNo: 1660,
    });
  });

  it('plays projhitanim once without allowing the removed projectile to hit again', () => {
    const state = createInitialGameState();
    const projectile = {
      ...createProjectile(),
      hitAnimNo: 15210,
      hitAnimDuration: 3,
      phase: 'active' as const,
      removeOnHit: true,
    };

    const contact = resolveProjectileHits(state.players, [projectile]);
    expect(contact.hitEvents).toHaveLength(1);
    expect(contact.projectiles).toEqual([expect.objectContaining({
      animNo: 15210,
      animTime: 0,
      phase: 'hit',
      vx: 0,
      vy: 0,
    })]);

    const noSecondHit = resolveProjectileHits(contact.players, contact.projectiles);
    expect(noSecondHit.hitEvents).toHaveLength(0);
    expect(stepProjectiles(noSecondHit.projectiles).projectiles[0].animTime).toBe(1);
    expect(stepProjectiles(stepProjectiles(noSecondHit.projectiles).projectiles).projectiles[0].animTime).toBe(2);
    expect(stepProjectiles(stepProjectiles(stepProjectiles(noSecondHit.projectiles).projectiles).projectiles).projectiles).toHaveLength(0);
  });
});
