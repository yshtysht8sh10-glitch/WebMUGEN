import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { mergeCnsDocuments } from './CharacterLoader';
import { stepCnsPhysicsMotion } from '../cns/CnsPhysicsStep';
import { stepCnsStateRuntime, type CnsRuntimeInput } from '../cns/CnsStateRuntime';
import { createInitialGameState } from '../engine/GameState';
import { applyFallbackHitRecovery } from '../engine/FallbackHitRecovery';
import { resolveProjectileHits } from '../projectile/ProjectileSystem';
import type { SoundPlayEvent } from '../audio/SoundEvent';
import type { ExplodCreateEvent } from '../explod/ExplodSystem';
import type { GameState, ProjectileState } from '../engine/types';

const ownerCns = mergeCnsDocuments(
  parseCnsText(readFileSync('public/chars/T-H-M-A/T-H-M-A/T-H-M-A-2.cns', 'utf8')),
  parseCnsText(readFileSync('public/chars/T-H-M-A/T-H-M-A/T-H-M-Atokusyudousa.cns', 'utf8')),
);
const ownerWithCommandCns = mergeCnsDocuments(
  ownerCns,
  parseCnsText(readFileSync('public/chars/T-H-M-A/T-H-M-A/T-H-M-A.cmd', 'utf8')),
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
  it('lets P1 State -1 observe wall State 281 and produce its Explod and sound Helper', () => {
    const initial = createInitialGameState();
    const state: GameState = {
      ...initial,
      players: [
        { ...initial.players[0], x: 300 },
        {
          ...initial.players[1],
          x: 900,
          stateNo: 281,
          stateTime: 1,
          stateType: 'A',
          moveType: 'H',
          physics: 'N',
          stateOwnerId: 1,
          selfStateOwnerId: 2,
        },
      ],
    };
    const explods: ExplodCreateEvent[] = [];
    const sounds: SoundPlayEvent[] = [];
    const input: CnsRuntimeInput = {
      getCnsDocumentForPlayer: (ownerId) => ownerId === 1 ? ownerWithCommandCns : targetSelfCns,
      onExplodCreate: (event) => explods.push(event),
      onSoundPlay: (event) => sounds.push(event),
    };

    const observed = stepCnsStateRuntime(state, ownerWithCommandCns, input).state;
    expect(explods).toContainEqual(expect.objectContaining({
      type: 'create',
      request: expect.objectContaining({ mugenId: 17100, animNo: 17100 }),
    }));
    expect(observed.helpers.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ helperId: 5503, rootEntityId: 1, player: expect.objectContaining({ stateNo: 5503 }) }),
    ]));

    stepCnsStateRuntime(observed, ownerWithCommandCns, input);
    expect(sounds).toContainEqual(expect.objectContaining({
      type: 'play', ownerId: 1, scope: 'character', group: 252, index: 0,
    }));
  });

  it('turns State 280 toward the attacker before applying its Facing-relative launch velocity', () => {
    const initial = createInitialGameState();
    const state: GameState = {
      ...initial,
      players: [
        { ...initial.players[0], x: 300 },
        {
          ...initial.players[1],
          x: 400,
          stateNo: 280,
          stateTime: 0,
          stateType: 'S',
          moveType: 'H',
          physics: 'N',
          facing: 1,
          stateOwnerId: 1,
          selfStateOwnerId: 2,
        },
      ],
    };

    const runtime = stepCnsStateRuntime(state, ownerCns, runtimeInput).state;
    expect(runtime.players[1]).toMatchObject({ stateNo: 280, facing: -1, vx: 12, vy: -0.2 });

    const moved = stepCnsPhysicsMotion(runtime, ownerCns);
    expect(moved.players[1]).toMatchObject({ x: 412, y: initial.players[1].y - 0.2, vx: 12, vy: -0.2 });
  });

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

    state = {
      ...state,
      players: [state.players[0], { ...state.players[1], vy: -8 }],
    };
    const targetState = stepCnsStateRuntime(state, ownerCns, runtimeInput);
    expect(targetState.traces[0].executedControllers).toContain('TargetState');
    expect(targetState.state.players[0].hitDiagnosticLines?.join('\n')).toContain(
      'raw.target_controller owner=p1 controller=TargetState',
    );
    expect(targetState.state.players[1]).toMatchObject({
      stateNo: 280,
      stateOwnerId: 1,
      selfStateOwnerId: 2,
      stateTime: 0,
      physics: 'N',
      vx: 12,
      vy: -0.2,
    });

    const afterTargetPhysics = stepCnsPhysicsMotion(targetState.state, ownerCns);
    expect(afterTargetPhysics.players[1]).toMatchObject({ stateNo: 280, stateTime: 1, vx: 12, vy: -0.2 });
    const atHitTimeEnd = applyFallbackHitRecovery({
      ...afterTargetPhysics,
      players: [afterTargetPhysics.players[0], {
        ...afterTargetPhysics.players[1],
        hitStun: afterTargetPhysics.players[1].hitStun
          ? { ...afterTargetPhysics.players[1].hitStun, elapsed: afterTargetPhysics.players[1].hitStun.selectedHitTime }
          : undefined,
      }],
    });
    expect(atHitTimeEnd.players[1]).toMatchObject({ stateNo: 280, stateOwnerId: 1, physics: 'N', vx: 12, vy: -0.2 });
    state = {
      ...atHitTimeEnd,
      players: [atHitTimeEnd.players[0], { ...atHitTimeEnd.players[1], x: 900, animTime: 10 }],
    };
    const shakes: Array<{ time: number; frequency: number; amplitude: number; phase: number }> = [];
    const wallImpact = stepCnsStateRuntime(state, ownerCns, {
      ...runtimeInput,
      onEnvironmentShake: (event) => shakes.push(event),
    });
    expect(wallImpact.state.players[1]).toMatchObject({ stateNo: 281, stateOwnerId: 1, animNo: 5012, animTime: 0 });
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
