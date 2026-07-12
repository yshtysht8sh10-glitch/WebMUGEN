import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsStateRuntime, type CnsRuntimeInput } from './CnsStateRuntime';

const owner1 = parseCnsText(`
[Statedef 200]
type = S
movetype = A
[State 200, Borrow]
type = TargetState
trigger1 = 1
value = 700
[Statedef 700]
type = A
movetype = H
physics = N
[State 700, OwnerVelocity]
type = VelSet
trigger1 = 1
x = 9
[Statedef 701]
type = A
movetype = H
physics = N
[State 701, Return]
type = SelfState
trigger1 = 1
value = 900
`);

const owner2 = parseCnsText(`
[Statedef 0]
type = S
movetype = I
physics = S
[Statedef 700]
type = A
movetype = H
physics = N
[State 700, SelfVelocity]
type = VelSet
trigger1 = 1
x = 2
[Statedef 900]
type = S
movetype = I
physics = S
[State 900, ReturnedVelocity]
type = VelSet
trigger1 = 1
x = 3
`);

const input: CnsRuntimeInput = {
  getCnsDocumentForPlayer: (ownerId) => ownerId === 1 ? owner1 : ownerId === 2 ? owner2 : null,
};

describe('CNS custom state ownership', () => {
  it('executes the State from its recorded owner document', () => {
    const state = createInitialGameState();
    const borrowed = stepCnsStateRuntime({
      ...state,
      players: [state.players[0], { ...state.players[1], stateNo: 700, stateOwnerId: 1, selfStateOwnerId: 2 }],
    }, owner1, input);
    expect(borrowed.state.players[1]).toMatchObject({ stateNo: 700, stateOwnerId: 1, vx: -9 });

    const selfOwned = stepCnsStateRuntime({
      ...state,
      players: [state.players[0], { ...state.players[1], stateNo: 700, stateOwnerId: 2, selfStateOwnerId: 2 }],
    }, owner1, input);
    expect(selfOwned.state.players[1]).toMatchObject({ stateNo: 700, stateOwnerId: 2, vx: -2 });
  });

  it('returns to the self owner document through SelfState', () => {
    const state = createInitialGameState();
    const returned = stepCnsStateRuntime({
      ...state,
      players: [state.players[0], { ...state.players[1], stateNo: 701, stateOwnerId: 1, selfStateOwnerId: 2 }],
    }, owner1, input).state;
    expect(returned.players[1]).toMatchObject({ stateNo: 900, stateOwnerId: 2 });

    const executedSelf = stepCnsStateRuntime(returned, owner1, input).state;
    expect(executedSelf.players[1]).toMatchObject({ stateNo: 900, stateOwnerId: 2, vx: -3 });
  });

  it('gives TargetState the controller owner and diagnoses a missing borrowed State', () => {
    const state = createInitialGameState();
    const targeted = stepCnsStateRuntime({
      ...state,
      players: [
        { ...state.players[0], stateNo: 200, targets: [{ playerId: 2, hitDefId: 0, activeHitDefId: 1 }] },
        state.players[1],
      ],
    }, owner1, input).state;
    expect(targeted.players[1]).toMatchObject({ stateNo: 700, stateOwnerId: 1 });

    const missing = stepCnsStateRuntime({
      ...targeted,
      players: [targeted.players[0], { ...targeted.players[1], stateNo: 999, stateOwnerId: 1 }],
    }, owner1, input).state;
    expect(missing.players[1].hitDiagnosticLines?.join('\n')).toContain('state=999 owner=1 result=missing reason=state_not_found');
  });
});
