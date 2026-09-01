import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsStateRuntime } from './CnsStateRuntime';

const transCns = parseCnsText(`
[Statedef 1200]
type = S
movetype = I
physics = N
anim = 1200

[State 1200, fade in]
type = Trans
trigger1 = time <= 18
trans = addalpha
alpha = 8*time, 256-8*time

[State 1200, steady]
type = Trans
trigger1 = time >= 19
trans = addalpha
alpha = 150, 100
`);

const stateMinusThreeTransCns = parseCnsText(`
[Statedef -3]

[State -3, character transparency]
type = Trans
trigger1 = var(2) = 1
trans = addalpha
alpha = 100, 156

[Statedef 0]
type = S
movetype = I
physics = S
ctrl = 1
`);

describe('WinMUGEN Trans controller compatibility', () => {
  it('evaluates the dynamic alpha pair in the current entity context', () => {
    const state = createInitialGameState();
    state.players[0] = { ...state.players[0], stateNo: 1200, stateTime: 10, animNo: 1200 };

    const result = stepCnsStateRuntime(state, transCns, {});

    expect(result.state.players[0].spriteTransparency).toBe('addalpha');
    expect(result.state.players[0].spriteAlpha).toEqual({ source: 80, destination: 176 });
  });

  it('uses the later fixed alpha pair after the fade-in interval', () => {
    const state = createInitialGameState();
    state.players[0] = { ...state.players[0], stateNo: 1200, stateTime: 19, animNo: 1200 };

    const result = stepCnsStateRuntime(state, transCns, {});

    expect(result.state.players[0].spriteTransparency).toBe('addalpha');
    expect(result.state.players[0].spriteAlpha).toEqual({ source: 150, destination: 100 });
  });

  it('retains the last presented State -3 Trans while HitPause suppresses reevaluation', () => {
    const state = createInitialGameState();
    state.players[0] = {
      ...state.players[0],
      vars: { 2: 1 },
      hitPause: 2,
      spriteTransparency: 'addalpha',
      spriteAlpha: { source: 100, destination: 156 },
    };

    const result = stepCnsStateRuntime(state, stateMinusThreeTransCns, {});

    expect(result.state.players[0].spriteTransparency).toBe('addalpha');
    expect(result.state.players[0].spriteAlpha).toEqual({ source: 100, destination: 156 });
    expect(result.traces[0].executedControllers).not.toContain('Trans');
  });

  it('clears an old Trans on an active tick when its trigger no longer passes', () => {
    const state = createInitialGameState();
    state.players[0] = {
      ...state.players[0],
      vars: { 2: 0 },
      spriteTransparency: 'addalpha',
      spriteAlpha: { source: 100, destination: 156 },
    };

    const result = stepCnsStateRuntime(state, stateMinusThreeTransCns, {});

    expect(result.state.players[0].spriteTransparency).toBeUndefined();
    expect(result.state.players[0].spriteAlpha).toBeUndefined();
  });
});
