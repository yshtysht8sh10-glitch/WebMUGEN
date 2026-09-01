import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsPhysicsMotion } from './CnsPhysicsStep';
import { stepCnsStateRuntime } from './CnsStateRuntime';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { DEFAULT_GROUND_Y } from '../engine/GroundClamp';

describe('CnsPhysicsStep', () => {
  it('keeps cornerpush separate from X velocity and applies WinMUGEN 0.7 decay after HitPause', () => {
    const initial = createInitialGameState();
    let state = {
      ...initial,
      players: [{
        ...initial.players[0],
        vx: 0,
        hitPause: 1,
        cornerPushVelocity: -7.8,
      }, initial.players[1]] as typeof initial.players,
    };

    state = stepCnsPhysicsMotion(state);
    expect(state.players[0]).toMatchObject({ x: initial.players[0].x, vx: 0, cornerPushVelocity: -7.8 });

    for (let tick = 0; tick < 6; tick += 1) state = stepCnsPhysicsMotion(state);

    expect(state.players[0].x).toBeCloseTo(initial.players[0].x - 22.941126);
    expect(state.players[0].vx).toBe(0);
    expect(state.players[0].cornerPushVelocity).toBeUndefined();
  });

  it.each([
    { physics: 'S' as const, key: 'stand.friction', configured: 0.7, fallback: 0.85 },
    { physics: 'C' as const, key: 'crouch.friction', configured: 0.6, fallback: 0.82 },
  ])('uses character movement.$key for Physics=$physics', ({ physics, key, configured, fallback }) => {
    const state = createInitialGameState();
    const player = { ...state.players[0], physics, vx: 10 };
    const configuredCns = parseCnsText(`[Movement]\n${key} = ${configured}`);

    const configuredStep = stepCnsPhysicsMotion({
      ...state,
      players: [player, state.players[1]],
    }, configuredCns);
    const fallbackStep = stepCnsPhysicsMotion({
      ...state,
      players: [player, state.players[1]],
    });

    expect(configuredStep.players[0]).toMatchObject({ x: player.x + 10, vx: 10 * configured });
    expect(fallbackStep.players[0]).toMatchObject({ x: player.x + 10, vx: 10 * fallback });
  });

  it('advances defender PalFX while a pending external State entry remains at Time 0', () => {
    const state = createInitialGameState();
    const affected = {
      ...state.players[0], hitPause: 1,
      palFx: {
        duration: 50, remainingTime: 50, elapsedTime: 0, color: 0, invertAll: true,
        add: { red: 0, green: -70, blue: -170 }, multiply: { red: 256, green: 256, blue: 256 },
        sinAdd: { red: 60, green: 60, blue: 50, period: 10 }, ownerEntityId: 2,
      },
    };
    const next = stepCnsPhysicsMotion({ ...state, players: [affected, state.players[1]] });
    expect(next.players[0]).toMatchObject({ hitPause: 0, stateTime: 0, animTime: 0, palFx: { remainingTime: 49, elapsedTime: 1 } });
  });

  it('freezes StateTime together with animation and motion during HitPause', () => {
    const state = createInitialGameState();
    const paused = {
      ...state.players[0], stateNo: 3006, stateHeaderAppliedStateNo: 3006,
      stateTime: 2, animTime: 7, hitPause: 2, hitPauseKind: 'pause' as const, vx: 3, vy: -10,
    };

    const next = stepCnsPhysicsMotion({ ...state, players: [paused, state.players[1]] });

    expect(next.players[0]).toMatchObject({
      stateTime: 2, animTime: 7, hitPause: 1,
      x: paused.x, y: paused.y, vx: 3, vy: -10,
    });
  });

  it('advances StateTime during defender hit-shake while freezing animation and motion', () => {
    const state = createInitialGameState();
    const shaken = {
      ...state.players[0], stateNo: 150, stateHeaderAppliedStateNo: 150,
      stateTime: 1, animTime: 1, hitPause: 2, hitPauseKind: 'shake' as const, vx: -4,
    };

    const next = stepCnsPhysicsMotion({ ...state, players: [shaken, state.players[1]] });

    expect(next.players[0]).toMatchObject({
      stateTime: 2, animTime: 1, hitPause: 1,
      x: shaken.x, vx: -4,
    });
  });

  it('freezes Projectile contact times during attacker HitPause and advances them afterward', () => {
    const state = createInitialGameState();
    const contacted = {
      ...state.players[0], hitPause: 1,
      projectileContacts: { 1005: { contactTime: 1, hitTime: 1, guardedTime: -1 } },
    };
    const paused = stepCnsPhysicsMotion({ ...state, players: [contacted, state.players[1]] });
    expect(paused.players[0].projectileContacts?.[1005].hitTime).toBe(1);
    const advanced = stepCnsPhysicsMotion(paused);
    expect(advanced.players[0].projectileContacts?.[1005].hitTime).toBe(2);
  });

  it('keeps MoveHit at 1 through hitpause and advances it on the next active tick', () => {
    const state = createInitialGameState();
    const hit = {
      ...state.players[0],
      hitPause: 1,
      moveContact: { activeHitDefId: 7, contact: true, hit: true, guarded: false, elapsed: 1, hitCount: 1 },
    };
    const resumed = stepCnsPhysicsMotion({ ...state, players: [hit, state.players[1]] });
    expect(resumed.players[0]).toMatchObject({ hitPause: 0, moveContact: { elapsed: 1 } });

    const advanced = stepCnsPhysicsMotion(resumed);
    expect(advanced.players[0].moveContact?.elapsed).toBe(2);
  });

  it('moves airborne players upward when jump velocity is negative', () => {
    const state = createInitialGameState();
    const next = stepCnsPhysicsMotion({
      ...state,
      players: [
        { ...state.players[0], stateNo: 40, stateType: 'A', physics: 'A', ctrl: false, vy: -8.4 },
        state.players[1],
      ],
    });

    expect(next.frame).toBe(1);
    expect(next.players[0].y).toBeLessThan(state.players[0].y);
    expect(next.players[0].vy).toBeCloseTo(-7.8);
    expect(next.players[0].stateTime).toBe(1);
    expect(next.players[0].animTime).toBe(1);
  });

  it.each(['S', 'C'] as const)('keeps %s physics on the ground and clears stale vertical velocity', (physics) => {
    const state = createInitialGameState();
    const next = stepCnsPhysicsMotion({
      ...state,
      players: [
        {
          ...state.players[0],
          stateNo: 5001,
          stateType: physics,
          moveType: 'H',
          physics,
          y: DEFAULT_GROUND_Y,
          vx: 4,
          vy: 3,
        },
        state.players[1],
      ],
    });

    expect(next.players[0]).toMatchObject({
      x: state.players[0].x + 4,
      y: DEFAULT_GROUND_Y,
      vy: 0,
      stateTime: 1,
      animTime: 1,
    });
  });

  it('keeps explicit two-axis movement for Physics=N', () => {
    const state = createInitialGameState();
    const next = stepCnsPhysicsMotion({
      ...state,
      players: [
        {
          ...state.players[0],
          physics: 'N',
          y: DEFAULT_GROUND_Y - 20,
          vx: 2,
          vy: -3,
        },
        state.players[1],
      ],
    });

    expect(next.players[0]).toMatchObject({
      x: state.players[0].x + 2,
      y: DEFAULT_GROUND_Y - 23,
      vx: 2,
      vy: -3,
    });
  });

  it.each(['S', 'C'] as const)('does not teleport an authored below-ground %s entity back to the floor', (physics) => {
    const state = createInitialGameState();
    const next = stepCnsPhysicsMotion({
      ...state,
      players: [
        {
          ...state.players[0],
          stateNo: 3730,
          stateType: 'S',
          physics,
          y: 400,
          vy: -0.1,
        },
        state.players[1],
      ],
    });

    expect(next.players[0]).toMatchObject({
      y: 399.9,
      vy: -0.1,
      stateType: 'S',
      physics,
    });
  });

  it.each(['S', 'C'] as const)('lets airborne StateType A keep its Y motion under %s friction physics', (physics) => {
    const state = createInitialGameState();
    const next = stepCnsPhysicsMotion({
      ...state,
      players: [
        {
          ...state.players[0],
          stateNo: 3401,
          stateType: 'A',
          physics,
          y: DEFAULT_GROUND_Y - 85,
          vx: 4,
          vy: 1.5,
        },
        state.players[1],
      ],
    });

    expect(next.players[0]).toMatchObject({
      x: state.players[0].x + 4,
      y: DEFAULT_GROUND_Y - 83.5,
      vy: 1.5,
      stateType: 'A',
      physics,
    });
  });

  it('does not clamp Physics=N movement below the ground axis', () => {
    const state = createInitialGameState();
    const next = stepCnsPhysicsMotion({
      ...state,
      players: [
        {
          ...state.players[0],
          stateType: 'A',
          physics: 'N',
          y: DEFAULT_GROUND_Y + 398,
          vy: 4,
        },
        state.players[1],
      ],
    });

    expect(next.players[0]).toMatchObject({
      y: DEFAULT_GROUND_Y + 402,
      vy: 4,
      stateType: 'A',
      physics: 'N',
    });
  });

  it('clamps falling air-physics players to ground without changing state', () => {
    const state = createInitialGameState();
    const next = stepCnsPhysicsMotion({
      ...state,
      players: [
        { ...state.players[0], stateNo: 50, stateType: 'A', physics: 'A', ctrl: false, y: 284, vy: 6 },
        state.players[1],
      ],
    });

    expect(next.players[0]).toMatchObject({
      stateNo: 50,
      y: 285,
      vy: 0,
      stateType: 'A',
      physics: 'A',
      ctrl: false,
    });
  });

  it('enters the CNS jump landing state after air physics reaches the ground', () => {
    const state = createInitialGameState();
    const cns = parseCnsText(`
[Statedef 52]
type = S
physics = S
ctrl = 0
anim = 47
`);

    const next = stepCnsPhysicsMotion({
      ...state,
      players: [
        {
          ...state.players[0],
          stateNo: 50,
          stateHeaderAppliedStateNo: 50,
          stateType: 'A',
          physics: 'A',
          ctrl: true,
          y: 284,
          vy: 6,
          animNo: 42,
          animTime: 10,
        },
        state.players[1],
      ],
    }, cns);

    expect(next.players[0]).toMatchObject({
      stateNo: 52,
      stateTime: 0,
      stateType: 'S',
      physics: 'S',
      ctrl: false,
      animNo: 47,
      animTime: 0,
      y: 285,
      vy: 0,
      stateHeaderAppliedStateNo: 50,
    });
  });

  it('defers an expression-based landing Anim to the normal StateDef entry pass', () => {
    const state = createInitialGameState();
    const cns = parseCnsText(`
[Statedef 52]
type = S
movetype = I
physics = S
ctrl = 0
anim = 47 + (ifelse(var(3) = 0, 1, 0)) * 20000

[State 52, Return]
type = ChangeState
trigger1 = AnimTime = 0
value = 0
ctrl = 1

[Statedef 0]
type = S
movetype = I
physics = S
ctrl = 1
anim = 0
`);

    const landed = stepCnsPhysicsMotion({
      ...state,
      players: [
        {
          ...state.players[0],
          vars: { 3: 0 },
          stateNo: 50,
          stateHeaderAppliedStateNo: 50,
          stateType: 'A',
          physics: 'A',
          ctrl: true,
          y: 284,
          vy: 6,
          animNo: 20044,
          animTime: 17,
        },
        state.players[1],
      ],
    }, cns);

    expect(landed.players[0]).toMatchObject({
      stateNo: 52,
      stateHeaderAppliedStateNo: 50,
      animNo: 20044,
    });

    const animationInput = {
      getAnimationDuration: (animNo: number) => (animNo === 20047 ? 6 : null),
    };
    const entered = stepCnsStateRuntime(landed, cns, animationInput);
    expect(entered.state.players[0]).toMatchObject({
      stateNo: 52,
      stateHeaderAppliedStateNo: 52,
      animNo: 20047,
      animTime: 0,
      stateTime: 0,
      stateType: 'S',
      physics: 'S',
      ctrl: false,
    });

    const returned = stepCnsStateRuntime({
      ...entered.state,
      players: [{
        ...entered.state.players[0],
        animTime: 6,
        stateTime: 6,
      }, entered.state.players[1]],
    }, cns, animationInput);
    expect(returned.state.players[0]).toMatchObject({
      prevStateNo: 52,
      stateNo: 0,
      animNo: 0,
      animTime: 0,
      ctrl: true,
    });
  });
});
