import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import { createInitialHelperState, spawnHelper } from '../helper/HelperSystem';
import { stepCnsStateRuntime } from './CnsStateRuntime';

describe('binding and ownership controllers', () => {
  it('binds a Helper to its root and commits ParentVarSet/Add to the actual parent entity', () => {
    const cns = parseCnsText(`
[Statedef 0]
type = S
physics = N
[Statedef 1000]
type = S
physics = N
[State 1000, bind]
type = BindToRoot
trigger1 = 1
time = 2
facing = -1
pos = 10, -20
[State 1000, parent integer]
type = ParentVarSet
trigger1 = 1
v = 3
value = 7
[State 1000, parent float]
type = ParentVarAdd
trigger1 = 1
fv = 2
value = 1.5
`);
    const initial = createInitialGameState();
    initial.players[0] = { ...initial.players[0], x: 100, y: 30, facing: 1 };
    initial.helpers = spawnHelper(createInitialHelperState(), {
      helperId: 20, rootEntityId: 1, parentEntityId: 1, ownerCharacterId: 1,
      stateOwnerId: 1, animationOwnerId: 1, stateNo: 1000, x: 0, y: 0, facing: 1,
      keyCtrl: false, ownPal: false, spawnFrame: 0, parent: initial.players[0],
    }, cns);

    const result = stepCnsStateRuntime(initial, cns);

    expect(result.state.helpers.entries[0].player).toMatchObject({ x: 110, y: 10, facing: -1 });
    expect(result.state.players[0].vars?.[3]).toBe(7);
    expect(result.state.players[0].fvars?.[2]).toBe(1.5);
  });

  it('binds to a selected Target and uses target head/mid/foot anchors safely', () => {
    const cns = parseCnsText(`
[Statedef 200]
type = S
physics = N
[State 200, bind target]
type = BindToTarget
trigger1 = 1
id = 44
time = 1
postype = Mid
pos = 5, 2
`);
    const initial = createInitialGameState();
    initial.players = [
      { ...initial.players[0], stateNo: 200, targets: [{ playerId: 2, hitDefId: 44, activeHitDefId: 9 }] },
      { ...initial.players[1], x: 300, y: 50, facing: -1, collisionWidth: { groundFront: 15, groundBack: 15, airFront: 12, airBack: 12, height: 80 } },
    ];

    const result = stepCnsStateRuntime(initial, cns);
    expect(result.state.players[0]).toMatchObject({ x: 295, y: 12 });
  });

  it('selects the custom-state owner for ChangeAnim2 and restores self ownership with ChangeAnim', () => {
    const changeAnim2Cns = parseCnsText(`
[Statedef 700]
type = S
physics = N
[State 700, borrowed anim]
type = ChangeAnim2
trigger1 = 1
value = 900
`);
    const initial = createInitialGameState();
    initial.players[0] = { ...initial.players[0], stateNo: 700, stateOwnerId: 2, selfStateOwnerId: 1 };
    const borrowed = stepCnsStateRuntime(initial, changeAnim2Cns);
    expect(borrowed.state.players[0]).toMatchObject({ animNo: 900, animationOwnerId: 2 });

    const changeAnimCns = parseCnsText(`
[Statedef 700]
type = S
physics = N
[State 700, self anim]
type = ChangeAnim
trigger1 = 1
value = 901
`);
    const restored = stepCnsStateRuntime(borrowed.state, changeAnimCns);
    expect(restored.state.players[0]).toMatchObject({ animNo: 901, animationOwnerId: 1 });
  });
});
