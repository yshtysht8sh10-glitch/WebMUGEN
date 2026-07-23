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

  it('emits timed EnvColor and legacy fightfx effects through shared runtime events', () => {
    const cns = parseCnsText(`
[Statedef 200]
type = S
physics = N
[State 200, color]
type = EnvColor
trigger1 = 1
value = 12, 34, 56
time = 7
under = 1
[State 200, fall dust]
type = GameMakeAnim
trigger1 = 1
value = 62
pos = 3, -4
under = 1
[State 200, run dust]
type = MakeDust
trigger1 = 1
pos = -5, -2
pos2 = 5, -2
`);
    const onEnvColor = vi.fn();
    const onExplodCreate = vi.fn();
    const initial = createInitialGameState();
    const result = stepCnsStateRuntime({
      ...initial,
      players: [{ ...initial.players[0], stateNo: 200, x: 100, y: 20 }, initial.players[1]],
    }, cns, { onEnvColor, onExplodCreate });

    expect(onEnvColor).toHaveBeenCalledWith({
      color: { red: 12, green: 34, blue: 56 }, time: 7, under: true, ownerEntityId: 1,
    });
    expect(onExplodCreate).toHaveBeenCalledTimes(3);
    expect(onExplodCreate.mock.calls[0][0]).toMatchObject({
      type: 'create', request: { animationSource: 'fightfx', animNo: 62, position: { x: 103, y: 16 }, spritePriority: -5 },
    });
    expect(onExplodCreate.mock.calls.slice(1).map(([event]) => event.request.animNo)).toEqual([120, 120]);
    expect(result.traces[0].executedControllers).toEqual(['EnvColor', 'GameMakeAnim', 'MakeDust']);
  });
});
