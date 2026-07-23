import { describe, expect, it, vi } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { applyFallbackStageRules } from '../engine/FallbackStageRules';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsStateRuntime } from './CnsStateRuntime';

describe('cross-issue compatibility controllers', () => {
  it('applies character yaccel once for every executed Gravity controller', () => {
    const cns = parseCnsText(`
[Movement]
yaccel = .7
[Statedef 200]
type = A
physics = N
[State 200, gravity one]
type = Gravity
trigger1 = 1
[State 200, gravity two]
type = Gravity
trigger1 = 1
`);
    const initial = createInitialGameState();
    const state = { ...initial, players: [{ ...initial.players[0], stateNo: 200, vy: -3 }, initial.players[1]] as typeof initial.players };

    const result = stepCnsStateRuntime(state, cns);

    expect(result.state.players[0].vy).toBeCloseTo(-1.6);
    expect(result.traces[0].executedControllers).toEqual(['Gravity', 'Gravity']);
  });

  it('keeps velocity while ScreenBound value 0 permits an out-of-stage position for that tick', () => {
    const cns = parseCnsText(`
[Statedef 200]
type = S
physics = N
[State 200, free screen]
type = ScreenBound
trigger1 = 1
value = 0
movecamera = 1, 0
`);
    const initial = createInitialGameState();
    const state = { ...initial, players: [{ ...initial.players[0], stateNo: 200, x: 940, vx: 4 }, initial.players[1]] as typeof initial.players };
    const runtime = stepCnsStateRuntime(state, cns).state;

    expect(runtime.players[0].screenBound).toEqual({ value: false, moveCameraX: true, moveCameraY: false });
    expect(applyFallbackStageRules(runtime).players[0]).toMatchObject({ x: 940, vx: 4 });
  });

  it('formats, appends, clears, and isolates the player debug clipboard', () => {
    const cns = parseCnsText(`
[Statedef 200]
type = S
physics = N
[State 200, display]
type = DisplayToClipboard
trigger1 = time = 0
text = "v=%d f=%.2f %%"
params = 4.9, 1.25
[State 200, append]
type = AppendToClipboard
trigger1 = time = 0
text = "next=%i"
params = 7
[State 200, clear]
type = ClearClipboard
trigger1 = time = 1
`);
    const initial = createInitialGameState();
    const state = { ...initial, players: [{ ...initial.players[0], stateNo: 200 }, initial.players[1]] as typeof initial.players };

    const displayed = stepCnsStateRuntime(state, cns).state;
    expect(displayed.players[0].debugClipboard).toBe('v=4 f=1.25 %\nnext=7');
    expect(displayed.players[1].debugClipboard).toBeUndefined();
    const advanced = {
      ...displayed,
      players: [{ ...displayed.players[0], stateTime: 1 }, displayed.players[1]] as typeof displayed.players,
    };
    expect(stepCnsStateRuntime(advanced, cns).state.players[0].debugClipboard).toBe('');
  });

  it('retains all AssertSpecial slots for one tick and emits a ForceFeedback request', () => {
    const cns = parseCnsText(`
[Statedef 200]
type = S
physics = N
[State 200, flags]
type = AssertSpecial
trigger1 = time = 0
flag = invisible
flag2 = nobardisplay
flag3 = noautoturn
[State 200, rumble]
type = ForceFeedback
trigger1 = time = 0
waveform = sine
time = 12
ampl = 0.75
freq = 30
`);
    const onForceFeedback = vi.fn();
    const initial = createInitialGameState();
    const state = { ...initial, players: [{ ...initial.players[0], stateNo: 200 }, initial.players[1]] as typeof initial.players };

    const asserted = stepCnsStateRuntime(state, cns, { onForceFeedback }).state;
    expect(asserted.players[0]).toMatchObject({
      assertSpecialFlags: ['invisible', 'nobardisplay', 'noautoturn'],
      noAutoTurn: true,
    });
    expect(onForceFeedback).toHaveBeenCalledWith({ ownerEntityId: 1, waveform: 'sine', time: 12, amplitude: 0.75, frequency: 30 });

    const advanced = {
      ...asserted,
      players: [{ ...asserted.players[0], stateTime: 1 }, asserted.players[1]] as typeof asserted.players,
    };
    const next = stepCnsStateRuntime(advanced, cns, { onForceFeedback }).state;
    expect(next.players[0].assertSpecialFlags).toEqual([]);
    expect(next.players[0].noAutoTurn).toBe(false);
  });
});
