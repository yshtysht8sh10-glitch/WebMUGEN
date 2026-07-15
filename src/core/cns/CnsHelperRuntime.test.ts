import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import { restartRound } from '../engine/RoundRestart';
import { stepCnsPhysicsMotion } from './CnsPhysicsStep';
import { stepCnsStateRuntime } from './CnsStateRuntime';
import { evaluateCnsRuntimeTrigger } from './CnsRuntimeTrigger';

describe('CNS Helper Phase 1 runtime', () => {
  const cns = parseCnsText(`
[StateDef 0]
type = S
movetype = I
physics = S
anim = 0
ctrl = 1

[State 0, Spawn]
type = Helper
trigger1 = time = 0
trigger1 = NumHelper(100) = 0
id = 100
pos = 10, -20
postype = p1
facing = -1
stateno = 100

[StateDef 100]
type = A
movetype = I
physics = N
anim = 1000
ctrl = 0

[State 100, Nested]
type = Helper
trigger1 = time = 0
trigger1 = NumHelper(200) = 0
id = 200
stateno = 200

[State 100, Anim]
type = ChangeAnim
trigger1 = time = 0
value = 1001

[State 100, Destroy]
type = DestroySelf
trigger1 = time = 1

[StateDef 200]
type = S
movetype = I
physics = N
anim = 2000
ctrl = 0
`);

  it('spawns P1/P2 helpers after controller evaluation with separate runtime and MUGEN IDs', () => {
    const initial = createInitialGameState();
    const result = stepCnsStateRuntime(initial, cns);

    expect(result.state.helpers.entries).toHaveLength(2);
    expect(result.state.helpers.entries.map((helper) => helper.entityId)).toEqual([3, 4]);
    expect(result.state.helpers.entries.map((helper) => helper.helperId)).toEqual([100, 100]);
    expect(result.state.helpers.entries[0]).toMatchObject({
      rootEntityId: 1, parentEntityId: 1, ownerCharacterId: 1,
      stateOwnerId: 1, animationOwnerId: 1,
    });
    expect(result.state.helpers.entries[1]).toMatchObject({
      rootEntityId: 2, parentEntityId: 2, ownerCharacterId: 2,
    });
    expect(result.state.helpers.entries[0].player).toMatchObject({
      stateNo: 100, stateTime: 0, animNo: 1000, animTime: 0,
    });
    expect(result.traces).toHaveLength(2);
    expect(result.state.hitDiagnosticLines?.join('\n')).toContain('firstStep=next_frame');
  });

  it('runs Helper State/Anim on the next frame, supports nested parent identity, NumHelper, and DestroySelf', () => {
    let state = stepCnsStateRuntime(createInitialGameState(), cns).state;
    state = stepCnsPhysicsMotion(state, cns);
    expect(state.helpers.entries[0].player.stateTime).toBe(0);

    const stepped = stepCnsStateRuntime(state, cns);
    expect(stepped.state.helpers.entries).toHaveLength(4);
    expect(stepped.state.helpers.entries.slice(0, 2).map((helper) => helper.player.animNo)).toEqual([1001, 1001]);
    expect(stepped.state.helpers.entries.slice(2).map((helper) => helper.helperId)).toEqual([200, 200]);
    expect(stepped.state.helpers.entries[2]).toMatchObject({ rootEntityId: 1, parentEntityId: 3, ownerCharacterId: 1 });
    expect(stepped.state.helpers.entries[3]).toMatchObject({ rootEntityId: 2, parentEntityId: 4, ownerCharacterId: 2 });
    expect(stepped.traces.slice(2).map((trace) => trace.entityId)).toEqual([3, 4]);

    state = stepCnsPhysicsMotion(stepped.state, cns);
    const destroyed = stepCnsStateRuntime(state, cns);
    expect(destroyed.state.helpers.entries.map((helper) => helper.helperId)).toEqual([200, 200]);
    expect(destroyed.state.hitDiagnosticLines?.join('\n')).toContain('event=destroy entityId=3');
  });

  it('clears every Helper and resets the allocator on round restart', () => {
    const spawned = stepCnsStateRuntime(createInitialGameState(), cns).state;
    expect(spawned.helpers.entries).toHaveLength(2);
    expect(restartRound(1).gameState.helpers).toEqual({ entries: [], nextEntityId: 3 });
  });

  it('evaluates NumHelper(id) and IsHelper from the current entity context', () => {
    const player = createInitialGameState().players[0];
    expect(evaluateCnsRuntimeTrigger('NumHelper(100) = 2', { player, numHelper: (id) => id === 100 ? 2 : 0 })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('IsHelper = 1', { player, isHelper: true })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('IsHelper = 0', { player, isHelper: false })).toBe(true);
  });
});
