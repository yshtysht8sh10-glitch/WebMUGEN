import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsStateRuntime } from './CnsStateRuntime';

const cns = parseCnsText(`
[Data]
airjuggle = 12
[Statedef 0]
type = S
movetype = I
physics = S
ctrl = 1
[Statedef 200]
type = S
movetype = A
physics = S
juggle = 6
[Statedef 5030]
type = A
movetype = H
physics = N
[Statedef 5110]
type = L
movetype = H
physics = N
`);

describe('CNS juggle runtime state', () => {
  it('loads Data airjuggle and the active StateDef juggle cost', () => {
    const state = createInitialGameState();
    const result = stepCnsStateRuntime({ ...state, players: [{ ...state.players[0], stateNo: 200 }, state.players[1]] }, cns);
    expect(result.state.players[0]).toMatchObject({ juggle: 6, juggleMax: 12, juggleRemaining: 12 });
  });

  it('keeps remaining points through air/down states and resets after grounded control recovery', () => {
    const state = createInitialGameState();
    const air = stepCnsStateRuntime({
      ...state,
      players: [state.players[0], { ...state.players[1], stateNo: 5030, stateType: 'A', moveType: 'H', ctrl: false, juggleMax: 12, juggleRemaining: 3 }],
    }, cns).state;
    expect(air.players[1].juggleRemaining).toBe(3);

    const down = stepCnsStateRuntime({
      ...air,
      players: [air.players[0], { ...air.players[1], stateNo: 5110, stateType: 'L', moveType: 'H', ctrl: false }],
    }, cns).state;
    expect(down.players[1].juggleRemaining).toBe(3);

    const recovered = stepCnsStateRuntime({
      ...down,
      players: [down.players[0], { ...down.players[1], stateNo: 0, stateType: 'S', moveType: 'I', ctrl: true }],
    }, cns).state;
    expect(recovered.players[1].juggleRemaining).toBe(12);
  });

  it('preserves the paid target across a continued attack and resets it at an explicit new juggle StateDef', () => {
    const chainCns = parseCnsText(`
[Statedef 200]
type = S
movetype = A
physics = N
juggle = 6
[State 200, Continue]
type = ChangeState
trigger1 = 1
value = 201
[Statedef 201]
type = A
movetype = A
physics = N
[State 201, New attack]
type = ChangeState
trigger1 = Time = 1
value = 202
[Statedef 202]
type = A
movetype = A
physics = N
juggle = 4
`);
    const state = createInitialGameState();
    const continued = stepCnsStateRuntime({
      ...state,
      players: [{
        ...state.players[0], stateNo: 200, moveType: 'A', juggle: 6, juggleConsumedTargetIds: [2],
      }, state.players[1]],
    }, chainCns).state;
    expect(continued.players[0]).toMatchObject({ stateNo: 201, juggle: 6, juggleConsumedTargetIds: [2] });

    const restarted = stepCnsStateRuntime({
      ...continued,
      players: [{ ...continued.players[0], stateTime: 1 }, continued.players[1]],
    }, chainCns).state;
    expect(restarted.players[0]).toMatchObject({ stateNo: 202, juggle: 4, juggleConsumedTargetIds: [] });
  });
});
