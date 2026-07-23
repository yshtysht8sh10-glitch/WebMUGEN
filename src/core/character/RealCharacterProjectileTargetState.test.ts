import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { mergeCnsDocuments } from './CharacterLoader';
import { stepCnsPhysicsMotion } from '../cns/CnsPhysicsStep';
import { stepCnsStateRuntime, type CnsRuntimeInput } from '../cns/CnsStateRuntime';
import { createInitialGameState } from '../engine/GameState';
import { resolveProjectileHits } from '../projectile/ProjectileSystem';
import type { GameState, ProjectileState } from '../engine/types';

const ownerCns = mergeCnsDocuments(
  parseCnsText(readFileSync('public/chars/T-H-M-A/T-H-M-A/T-H-M-A-2.cns', 'utf8')),
  parseCnsText(readFileSync('public/chars/T-H-M-A/T-H-M-A/T-H-M-Atokusyudousa.cns', 'utf8')),
);

const targetSelfCns = parseCnsText(`
[StateDef 5100]
type = L
movetype = H
physics = N
anim = 5100
`);

const runtimeInput: CnsRuntimeInput = {
  getCnsDocumentForPlayer: (ownerId) => ownerId === 1 ? ownerCns : ownerId === 2 ? targetSelfCns : null,
  getAnimationDuration: () => 10,
};

function projectile(): ProjectileState {
  return {
    id: 1000,
    ownerId: 1,
    x: 420,
    y: 273,
    vx: 0,
    vy: 0,
    facing: 1,
    animNo: 15201,
    animTime: 0,
    lifeTime: 0,
    removeTime: 60,
    hitBox: { x: -12, y: -12, width: 24, height: 24 },
    hitDef: {
      diagnosticId: 91,
      damage: 1,
      guardDamage: 0,
      pauseTime: { attacker: 2, defender: 0 },
      groundVelocity: { x: 0, y: 0 },
      airVelocity: { x: 0, y: 0 },
    },
  };
}

function stepFrame(state: GameState): GameState {
  const cns = stepCnsStateRuntime(state, ownerCns, runtimeInput).state;
  return stepCnsPhysicsMotion(cns, ownerCns);
}

describe('T-H-M-A Projectile ProjHit -> TargetState custom-state route', () => {
  it('runs State -2 TargetState 280, wall states 281/282, and SelfState 5100', () => {
    const initial = createInitialGameState();
    const contact = resolveProjectileHits(initial.players, [projectile()]);
    let state: GameState = {
      ...initial,
      players: contact.players,
      projectiles: contact.projectiles,
      hitEvents: contact.hitEvents,
    };

    expect(state.players[0].projectileContacts?.[1000].hitTime).toBe(1);
    expect(state.players[0].targets).toEqual([{ playerId: 2, hitDefId: 1000, activeHitDefId: 91 }]);

    const paused = stepCnsStateRuntime(state, ownerCns, runtimeInput);
    expect(paused.state.players[1].stateNo).not.toBe(280);
    expect(paused.traces[0].executedControllers).not.toContain('TargetState');

    state = stepCnsPhysicsMotion(paused.state, ownerCns);
    state = stepFrame(state);
    expect(state.players[0].hitPause).toBe(0);
    expect(state.players[0].projectileContacts?.[1000].hitTime).toBe(1);

    const targetState = stepCnsStateRuntime(state, ownerCns, runtimeInput);
    expect(targetState.traces[0].executedControllers).toContain('TargetState');
    expect(targetState.state.players[0].hitDiagnosticLines?.join('\n')).toContain(
      'raw.target_controller owner=p1 controller=TargetState',
    );
    expect(targetState.state.players[1]).toMatchObject({
      stateNo: 280,
      stateOwnerId: 1,
      selfStateOwnerId: 2,
    });

    const afterTargetPhysics = stepCnsPhysicsMotion(targetState.state, ownerCns);
    state = {
      ...afterTargetPhysics,
      players: [afterTargetPhysics.players[0], { ...afterTargetPhysics.players[1], x: 900 }],
    };
    const shakes: Array<{ time: number; frequency: number; amplitude: number; phase: number }> = [];
    const wallImpact = stepCnsStateRuntime(state, ownerCns, {
      ...runtimeInput,
      onEnvironmentShake: (event) => shakes.push(event),
    });
    expect(wallImpact.state.players[1]).toMatchObject({ stateNo: 281, stateOwnerId: 1 });
    expect(wallImpact.traces[1].executedControllers).toEqual(expect.arrayContaining([
      'EnvShake',
      'PosFreeze',
      'ScreenBound',
    ]));
    expect(shakes).toEqual([{ time: 16, frequency: 100, amplitude: 4, phase: 90 }]);
    expect(wallImpact.state.players[1].hitDiagnosticLines?.join('\n')).toContain('raw.envshake owner=p2');
    state = stepCnsPhysicsMotion(wallImpact.state, ownerCns);

    for (let frame = 0; frame < 10 && state.players[1].stateNo !== 282; frame += 1) {
      state = stepFrame(state);
    }
    expect(state.players[1]).toMatchObject({ stateNo: 282, stateOwnerId: 1 });

    for (let frame = 0; frame < 80 && state.players[1].stateNo !== 5100; frame += 1) {
      state = stepFrame(state);
    }
    expect(state.players[1]).toMatchObject({
      stateNo: 5100,
      stateOwnerId: 2,
      selfStateOwnerId: 2,
    });
  });
});
