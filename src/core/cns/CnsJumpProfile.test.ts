import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { mergeMissingCnsStates } from '../character/CharacterLoader';
import { createInitialGameState } from '../engine/GameState';
import { DEFAULT_GROUND_Y } from '../engine/GroundClamp';
import type { GameState, PlayerState } from '../engine/types';
import { stepCnsPhysicsMotion } from './CnsPhysicsStep';
import { evaluateCnsRuntimeTrigger, readNumberExpression } from './CnsRuntimeTrigger';
import { stepCnsStateRuntime } from './CnsStateRuntime';

const commonCmd = parseCnsText(readFileSync('public/chars/common.cmd', 'utf8'));
const commonCns = parseCnsText(readFileSync('public/chars/common1.cns', 'utf8'));

describe('character-specific common jump profile', () => {
  const profile = createProfile({ neutral: [0, -8.4], forward: [2.5, -8.1], back: [-2.55, -8.1], runForward: [4, -8.1], runBack: [-3.5, -8.2], yAccel: 0.44 });

  it.each([
    ['neutral', [], 0, 0, -8.4],
    ['forward', ['holdfwd'], 0, 2.5, -8.4],
    ['back', ['holdback'], 0, -2.55, -8.4],
    ['run forward', ['holdfwd'], 100, 4, -8.4],
    ['run back', ['holdback'], 105, -2.55, -8.4],
  ] as const)('selects %s velocity from [Velocity]', (_name, commands, prevStateNo, expectedX, expectedY) => {
    for (const facing of [1, -1] as const) {
      const player = startJump(profile, commands, prevStateNo, facing);
      expect(player).toMatchObject({ stateNo: 50, stateType: 'A', physics: 'A', ctrl: true });
      expect(player.vx).toBeCloseTo(expectedX * facing);
      expect(player.vy).toBeCloseTo(expectedY);
    }
  });

  it.each([
    ['forward', 20, 'holdfwd'],
    ['back', 21, 'holdback'],
  ] as const)('does not let %s walk glue overwrite jump startup', (_name, stateNo, directionCommand) => {
    const state = createInitialGameState();
    const jumped = stepCnsStateRuntime({
      ...state,
      players: [{
        ...state.players[0],
        stateNo,
        stateTime: 1,
        animNo: stateNo,
        animTime: 1,
        ctrl: true,
      }, state.players[1]],
    }, profile, {
      p1Commands: new Set(['holdup', directionCommand]),
      p2Commands: new Set(),
      getAnimationDuration: () => 60,
    }).state.players[0];

    expect(jumped).toMatchObject({
      stateNo: 40,
      prevStateNo: stateNo,
      animNo: 40,
      stateTime: 0,
    });
  });

  it('exposes loaded velocity and movement values through Const expressions', () => {
    const player = createInitialGameState().players[0];
    expect(readNumberExpression('Const(velocity.jump.neu.y)', { player, constants: profile })).toBe(-8.4);
    expect(readNumberExpression('Const(velocity.jump.fwd.x)', { player, constants: profile })).toBe(2.5);
    expect(readNumberExpression('Const(velocity.runjump.back.y)', { player, constants: profile })).toBe(-8.2);
    expect(evaluateCnsRuntimeTrigger('Const(movement.yaccel) = .44', { player, constants: profile })).toBe(true);
  });

  it('inherits jump.neu Y when a real-style directional entry defines only X', () => {
    const scalarDirections = parseCnsText(`
[Velocity]
jump.neu = 0,-9.1
jump.fwd = 3.57
jump.back = -4.17

[Movement]
yaccel = .47
`);
    const player = createInitialGameState().players[0];
    expect(readNumberExpression('Const(velocity.jump.fwd.y)', { player, constants: scalarDirections })).toBe(-9.1);
    expect(readNumberExpression('Const(velocity.jump.back.y)', { player, constants: scalarDirections })).toBe(-9.1);
  });

  it('applies movement.yaccel exactly once per Physics=A frame', () => {
    const state = withAirPlayer(createInitialGameState(), { vy: -8.4 });
    const next = stepCnsPhysicsMotion(state, profile);
    expect(next.players[0].vy).toBeCloseTo(-7.96);
    expect(next.players[0].y).toBeCloseTo(DEFAULT_GROUND_Y - 7.96);
  });

  it('produces distinct apex, airtime, and landing frames for two character profiles', () => {
    const slowGravity = traceJump(createProfile({ neutral: [0, -8.4], forward: [2.5, -8.1], back: [-2.55, -8.1], runForward: [4, -8.1], runBack: [-2.55, -8.1], yAccel: 0.44 }));
    const fastGravity = traceJump(createProfile({ neutral: [0, -7], forward: [2, -7], back: [-2, -7], runForward: [3, -7], runBack: [-3, -7], yAccel: 0.7 }));

    expect(slowGravity.apexFrame).toBe(20);
    expect(slowGravity.landingFrame).toBe(38);
    expect(slowGravity.minimumY).toBeCloseTo(209);
    expect(fastGravity.apexFrame).toBe(10);
    expect(fastGravity.landingFrame).toBe(19);
    expect(fastGravity.minimumY).toBeCloseTo(253.5);
    expect(slowGravity.minimumY).toBeLessThan(fastGravity.minimumY);
    expect(slowGravity.landingFrame).toBeGreaterThan(fastGravity.landingFrame);
  });

  it('preserves Physics=N motion without automatic gravity', () => {
    const state = withAirPlayer(createInitialGameState(), { physics: 'N', vy: -3 });
    const next = stepCnsPhysicsMotion(state, profile);
    expect(next.players[0]).toMatchObject({ physics: 'N', vy: -3, y: DEFAULT_GROUND_Y - 3 });
  });
});

function createProfile(values: {
  neutral: [number, number];
  forward: [number, number];
  back: [number, number];
  runForward: [number, number];
  runBack: [number, number];
  yAccel: number;
}) {
  const character = parseCnsText(`
[Velocity]
jump.neu = ${values.neutral.join(',')}
jump.fwd = ${values.forward.join(',')}
jump.back = ${values.back.join(',')}
runjump.fwd = ${values.runForward.join(',')}
runjump.back = ${values.runBack.join(',')}

[Movement]
yaccel = ${values.yAccel}
`);
  return mergeMissingCnsStates(mergeMissingCnsStates(character, commonCns), commonCmd);
}

function startJump(profile: ReturnType<typeof createProfile>, commands: readonly string[], prevStateNo: number, facing: 1 | -1): PlayerState {
  const state = createInitialGameState();
  return stepCnsStateRuntime({
    ...state,
    players: [{
      ...state.players[0],
      stateNo: 40,
      prevStateNo,
      stateTime: 0,
      animNo: 40,
      animTime: 0,
      facing,
      ctrl: false,
    }, state.players[1]],
  }, profile, {
    p1Commands: new Set(commands),
    p2Commands: new Set(),
    getAnimationDuration: () => 0,
  }).state.players[0];
}

function traceJump(profile: ReturnType<typeof createProfile>): { apexFrame: number; landingFrame: number; minimumY: number } {
  let state = withAirPlayer(createInitialGameState(), { stateNo: 50, vy: readNumberExpression('Const(velocity.jump.neu.y)', { player: createInitialGameState().players[0], constants: profile }) ?? 0 });
  let minimumY = state.players[0].y;
  let apexFrame = 0;

  for (let frame = 1; frame <= 120; frame += 1) {
    state = stepCnsPhysicsMotion(state, profile);
    minimumY = Math.min(minimumY, state.players[0].y);
    if (apexFrame === 0 && state.players[0].vy >= 0) apexFrame = frame;
    if (state.players[0].stateNo === 52) return { apexFrame, landingFrame: frame, minimumY };
  }

  throw new Error('jump did not land');
}

function withAirPlayer(state: GameState, patch: Partial<PlayerState>): GameState {
  return {
    ...state,
    players: [{
      ...state.players[0],
      stateNo: 50,
      stateType: 'A',
      moveType: 'I',
      physics: 'A',
      y: DEFAULT_GROUND_Y,
      ...patch,
    }, state.players[1]],
  };
}
