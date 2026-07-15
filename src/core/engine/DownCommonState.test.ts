import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { stepCnsPhysicsMotion } from '../cns/CnsPhysicsStep';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { createInitialGameState } from './GameState';
import type { GameState, PlayerState } from './types';

const commonText = readFileSync('public/chars/common1.cns', 'utf8');
const common = parseCnsText(commonText);
const shortLieDown = parseCnsText(`[Data]\nliedown.time = 3\n${commonText}`);

function downPlayer(stateNo: number, patch: Partial<PlayerState> = {}): PlayerState {
  return {
    ...createInitialGameState().players[1],
    stateNo,
    stateType: 'L',
    moveType: 'H',
    physics: 'N',
    ctrl: false,
    animNo: stateNo,
    hitFall: true,
    hitReactionElapsed: 10,
    getHitVars: {
      yvel: 0,
      'fall.yvel': 0,
      'fall.damage': 0,
      'down.hittime': 11,
    },
    ...patch,
  };
}

function gameWithP2(player: PlayerState): GameState {
  const initial = createInitialGameState();
  return { ...initial, players: [initial.players[0], player] };
}

describe('common down and getup states', () => {
  it('evaluates direct sysvar assignments from GetHitVar expressions', () => {
    const cns = parseCnsText(`[Statedef 5080]\ntype=L\nmovetype=H\nphysics=N\n[State 5080, var]\ntype=VarSet\ntrigger1=Time=0\nsysvar(2)=ifelse(GetHitVar(yvel)=0,5080,5090)`);
    const state = stepCnsStateRuntime(gameWithP2(downPlayer(5080)), cns).state;
    expect((state.players[1] as PlayerState & { sysVars?: Record<number, number> }).sysVars?.[2]).toBe(5080);
    const isolated = { ...common, states: common.states.filter((stateDef) => stateDef.stateNo === 5080) };
    const commonState = stepCnsStateRuntime(gameWithP2(downPlayer(5080, { animNo: 5110 })), isolated, {
      getAnimationDuration: (animNo) => [5080, 5090].includes(animNo) ? 10 : null,
    }).state;
    expect((commonState.players[1] as PlayerState & { sysVars?: Record<number, number> }).sysVars?.[2]).toBe(5080);
    expect(commonState.players[1].animNo).toBe(5080);
  });
  it('uses data.liedown.time on an independent clock and freezes it during hitpause', () => {
    let state = gameWithP2(downPlayer(5110, { hitPause: 1, stateTime: 40, animNo: 5110 }));

    state = stepCnsPhysicsMotion(state, shortLieDown);
    expect(state.players[1]).toMatchObject({ stateNo: 5110, stateTime: 40, hitPause: 0, lieDownElapsed: 0, lieDownTime: 3 });
    for (let elapsed = 1; elapsed <= 2; elapsed += 1) {
      state = stepCnsPhysicsMotion(state, shortLieDown);
      expect(state.players[1]).toMatchObject({ stateNo: 5110, lieDownElapsed: elapsed, lieDownTime: 3 });
    }
    state = stepCnsPhysicsMotion(state, shortLieDown);
    expect(state.players[1]).toMatchObject({ stateNo: 5120, stateTime: 0, moveType: 'I', ctrl: false });
    expect(state.players[1].hitDiagnosticLines?.join('\n')).toContain('duration=3 remaining=0');
  });

  it('does not schedule State 5120 for a KO player', () => {
    let state = gameWithP2(downPlayer(5110, { life: 0, animNo: 5110 }));
    for (let frame = 0; frame < 5; frame += 1) state = stepCnsPhysicsMotion(state, shortLieDown);
    expect(state.players[1]).toMatchObject({ stateNo: 5110, life: 0, lieDownTime: 3 });
    expect(state.players[1].hitDiagnosticLines?.join('\n')).toContain('result=ko_hold');
  });

  it.each([
    { yvel: 0, expectedState: 5110, expectedAnim: 5080 },
    { yvel: -4, expectedState: 5050, expectedAnim: 5090 },
  ])('routes State 5080 by down y velocity: $yvel', ({ yvel, expectedState, expectedAnim }) => {
    const player = downPlayer(5080, {
      animNo: 5110,
      hitVelX: -2,
      hitVelY: yvel,
      getHitVars: { yvel, yaccel: 0.6, fall: 1, 'fall.yvel': -4, 'down.hittime': 11 },
    });
    const state = stepCnsStateRuntime(gameWithP2(player), common, {
      getAnimationDuration: (animNo) => [5030, 5080, 5090, 5110].includes(animNo) ? 10 : null,
      hitDiagnostics: true,
    }).state;

    expect(state.players[1]).toMatchObject({ stateNo: expectedState, animNo: expectedAnim });
  });

  it('uses fall.yvel=0 for the no-bounce 5100 to 5110 path', () => {
    const player = downPlayer(5100, {
      animNo: 5050,
      vx: -4,
      vy: 8,
      getHitVars: { 'fall.yvel': 0, 'fall.damage': 0, 'down.hittime': 9 },
    });
    const state = stepCnsStateRuntime(gameWithP2(player), common, {
      getAnimationDuration: (animNo) => [5100, 5110, 5170].includes(animNo) ? 3 : null,
      hitDiagnostics: true,
    }).state;

    expect(state.players[1]).toMatchObject({ stateNo: 5110, y: 285, vy: 0, vx: -0.6375 });
  });

  it('restores fall velocity in 5101 after the 5100 ground animation', () => {
    let state = gameWithP2(downPlayer(5100, {
      animNo: 5100,
      animTime: 2,
      vx: 2,
      vy: 9,
      hitFallVelocity: { x: -1.5, y: -4 },
      getHitVars: { 'fall.yvel': -4, 'fall.damage': 0, 'down.hittime': 9 },
    }));
    state = stepCnsStateRuntime(state, common, {
      getAnimationDuration: (animNo) => [5100, 5160, 5170].includes(animNo) ? 2 : null,
      hitDiagnostics: true,
    }).state;

    expect(state.players[1]).toMatchObject({ stateNo: 5101, vx: -1.5, vy: -3.6, y: 305 });
    for (let frame = 0; frame < 30 && state.players[1].stateNo !== 5110; frame += 1) {
      state = stepCnsPhysicsMotion(state, common);
      state = stepCnsStateRuntime(state, common, {
        getAnimationDuration: (animNo) => [5100, 5160, 5170, 5110].includes(animNo) ? 2 : null,
        hitDiagnostics: true,
      }).state;
    }
    expect(state.players[1]).toMatchObject({ stateNo: 5110, stateType: 'L', moveType: 'H' });
  });

  it('plays State 5120, sets timed two-slot invulnerability, and returns to State 0 with control', () => {
    let state = gameWithP2(downPlayer(5120, { moveType: 'I', animNo: 5110, animTime: 0, hitFall: false }));
    const input = { getAnimationDuration: (animNo: number) => animNo === 5120 ? 2 : animNo === 0 ? 20 : null, hitDiagnostics: true };

    state = stepCnsStateRuntime(state, common, input).state;
    expect(state.players[1]).toMatchObject({ stateNo: 5120, animNo: 5120 });
    expect(state.players[1].hitAttributeSlots?.[0]).toMatchObject({ mode: 'deny', value: 'SCA', time: 1 });
    state = stepCnsPhysicsMotion(state, common);
    state = stepCnsStateRuntime(state, common, input).state;
    state = stepCnsPhysicsMotion(state, common);
    state = stepCnsStateRuntime(state, common, input).state;

    expect(state.players[1]).toMatchObject({ stateNo: 0, ctrl: true, stateType: 'S', moveType: 'I', hitFall: true });
    expect(state.players[1].hitAttributeSlots?.[0]).toMatchObject({ mode: 'deny', value: ',NT,ST,HT', time: 12 });
    expect(state.players[1].hitAttributeSlots?.[1]).toMatchObject({ mode: 'deny', value: 'SCA', time: 3 });
    for (let frame = 0; frame < 3; frame += 1) state = stepCnsStateRuntime(state, common, input).state;
    expect(state.players[1].hitAttributeSlots?.[0]).toMatchObject({ mode: 'deny', value: ',NT,ST,HT', time: 9 });
    expect(state.players[1].hitAttributeSlots?.[1]).toBeNull();
  });
});
