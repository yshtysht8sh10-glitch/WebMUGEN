import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsStateRuntime } from './CnsStateRuntime';

describe('AfterImage controller compatibility', () => {
  it('creates a configured frame-history effect when its trigger fires', () => {
    const cns = parseCnsText(`
[StateDef 3310]
type = S
movetype = A
physics = N

[State 3310, afterimage]
type = AfterImage
trigger1 = animelem = 2
time = 42
timegap = 1
framegap = 6
palbright = 0,0,0
paladd = 0,0,0
palmul = .9,.9,.9
palcontrast = 160,160,160
palpostbright = 0,0,0
trans = add1
`);
    const initial = createInitialGameState();
    const result = stepCnsStateRuntime({
      ...initial,
      players: [{ ...initial.players[0], stateNo: 3310, animNo: 3310 }, initial.players[1]],
    }, cns, { getAnimationTriggerInfo: () => ({ elementNo: 2, elementTime: 0, elementStarted: true, elementCount: 2, elementTimes: [0, 0] }) });

    expect(result.state.players[0].afterImage).toMatchObject({
      enabled: true,
      remainingTime: 42,
      timeGap: 1,
      frameGap: 6,
      transparency: 'add1',
      palette: {
        bright: { red: 0, green: 0, blue: 0 },
        add: { red: 0, green: 0, blue: 0 },
        multiply: { red: 0.9, green: 0.9, blue: 0.9 },
        contrast: { red: 160, green: 160, blue: 160 },
        postBright: { red: 0, green: 0, blue: 0 },
      },
    });
    expect(result.traces[0].executedControllers).toContain('AfterImage');
  });

  it('does not create the effect before animelem 2', () => {
    const cns = parseCnsText('[StateDef 3310]\ntype=S\n[State 3310, trail]\ntype=AfterImage\ntrigger1=animelem=2\ntime=42');
    const initial = createInitialGameState();
    const result = stepCnsStateRuntime({
      ...initial,
      players: [{ ...initial.players[0], stateNo: 3310, animNo: 3310 }, initial.players[1]],
    }, cns, { getAnimationTriggerInfo: () => ({ elementNo: 1, elementTime: 0, elementStarted: true, elementCount: 2, elementTimes: [0, 0] }) });

    expect(result.state.players[0].afterImage).toBeUndefined();
  });
});
