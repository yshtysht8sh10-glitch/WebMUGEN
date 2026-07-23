import { describe, expect, it, vi } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsStateRuntime } from './CnsStateRuntime';

describe('visual compatibility controller batch', () => {
  it('creates player and all-player PalFX states and tick-scoped AngleDraw data', () => {
    const cns = parseCnsText(`
[Statedef 200]
type = S
physics = N
[State 200, player pal]
type = PalFX
trigger1 = 1
time = 12
add = 10, 20, 30
mul = 200, 210, 220
sinadd = 1, 2, 3, 8
invertall = 1
color = 128
[State 200, all pal]
type = AllPalFX
trigger1 = 1
time = 9
mul = 0, 0, 0
[State 200, draw]
type = AngleDraw
trigger1 = 1
angle = 45
scale = 1.5, .5
`);
    const onAllPalFx = vi.fn();
    const initial = createInitialGameState();
    const result = stepCnsStateRuntime({
      ...initial,
      players: [{ ...initial.players[0], stateNo: 200 }, initial.players[1]],
    }, cns, { onAllPalFx });

    expect(result.state.players[0]).toMatchObject({
      drawAngle: 45,
      drawScale: { x: 1.5, y: 0.5 },
      palFx: {
        duration: 12,
        remainingTime: 12,
        color: 128,
        invertAll: true,
        add: { red: 10, green: 20, blue: 30 },
        multiply: { red: 200, green: 210, blue: 220 },
        sinAdd: { red: 1, green: 2, blue: 3, period: 8 },
      },
    });
    expect(onAllPalFx).toHaveBeenCalledWith(expect.objectContaining({ duration: 9, multiply: { red: 0, green: 0, blue: 0 } }));
    expect(result.traces[0].executedControllers).toEqual(['PalFX', 'AllPalFX', 'AngleDraw']);
  });

  it('clears AngleDraw state at the next CNS tick unless reasserted', () => {
    const cns = parseCnsText('[Statedef 200]\ntype=S\nphysics=N');
    const initial = createInitialGameState();
    const result = stepCnsStateRuntime({
      ...initial,
      players: [{ ...initial.players[0], stateNo: 200, drawAngle: 90, drawScale: { x: 2, y: 2 } }, initial.players[1]],
    }, cns);
    expect(result.state.players[0]).toMatchObject({ drawAngle: undefined, drawScale: undefined });
  });
});
