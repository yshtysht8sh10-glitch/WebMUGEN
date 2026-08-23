import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { stepCnsPhysicsMotion } from '../cns/CnsPhysicsStep';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { createInitialGameState } from '../engine/GameState';
import { spawnHelper } from '../helper/HelperSystem';

const decoder = new TextDecoder('shift_jis');
const cns = parseCnsText(decoder.decode(readFileSync('public/chars/itoko/itoko.cns')));

describe('itoko H1101 bag compatibility', () => {
  it('uses IsHelper(ID) to select the broken-bag state and spawn a button Helper', () => {
    const initial = createInitialGameState();
    const parent = initial.players[0];
    let helpers = spawnHelper(initial.helpers, {
      helperId: 1101,
      rootEntityId: 1,
      parentEntityId: 1,
      ownerCharacterId: 1,
      stateOwnerId: 1,
      animationOwnerId: 1,
      stateNo: 1102,
      x: parent.x,
      y: 3,
      facing: 1,
      keyCtrl: false,
      ownPal: true,
      spawnFrame: 0,
      parent,
    }, cns);

    helpers = {
      ...helpers,
      entries: helpers.entries.map((helper) => ({
        ...helper,
        player: {
          ...helper.player,
          stateTime: 1,
          vars: { 9: 20 },
        },
      })),
    };

    let state = { ...initial, helpers };
    const runtimeInput = { getAnimationDuration: () => 20 };
    const broken = stepCnsStateRuntime(state, cns, runtimeInput);
    state = broken.state;
    expect(broken.traces.find((trace) => trace.entityId === 3)?.executedControllerRefs
      ?.filter((controller) => controller.type === 'ChangeState')
      .map((controller) => controller.stateNo)).toEqual([1102, 1103]);
    expect(state.helpers.entries.find((helper) => helper.helperId === 1101)?.player.stateNo).toBe(1105);

    state = stepCnsPhysicsMotion(state, cns);
    state = stepCnsStateRuntime(state, cns, runtimeInput).state;
    state = stepCnsPhysicsMotion(state, cns);
    state = stepCnsStateRuntime(state, cns, runtimeInput).state;
    state = stepCnsPhysicsMotion(state, cns);
    state = stepCnsStateRuntime(state, cns, runtimeInput).state;
    expect(state.helpers.entries.some((helper) => helper.helperId === 1105 && helper.player.stateNo === 1106)).toBe(true);
  });

  it('leaves State 1104 for State 1105 when its selected button slot is free', () => {
    const initial = createInitialGameState();
    const parent = initial.players[0];
    let helpers = spawnHelper(initial.helpers, {
      helperId: 1101,
      rootEntityId: 1,
      parentEntityId: 1,
      ownerCharacterId: 1,
      stateOwnerId: 1,
      animationOwnerId: 1,
      stateNo: 1104,
      x: parent.x,
      y: 3,
      facing: 1,
      keyCtrl: false,
      ownPal: true,
      spawnFrame: 0,
      parent,
    }, cns);
    helpers = {
      ...helpers,
      entries: helpers.entries.map((helper) => ({
        ...helper,
        player: { ...helper.player, vars: { 20: 1 } },
      })),
    };

    const result = stepCnsStateRuntime({ ...initial, helpers }, cns, { getAnimationDuration: () => 20 });
    expect(result.state.helpers.entries[0].player.stateNo).toBe(1105);
    expect(result.traces.find((trace) => trace.entityId === 3)?.executedControllerRefs
      ?.filter((controller) => controller.type === 'ChangeState')
      .map((controller) => controller.stateNo)).toEqual([1104]);
  });

  it('allocates all three button Helper slots across three broken bags', () => {
    let state = createInitialGameState();
    const runtimeInput = { getAnimationDuration: () => 20 };
    for (const bagId of [1101, 1102, 1103]) {
      let helpers = spawnHelper(state.helpers, {
        helperId: bagId,
        rootEntityId: 1,
        parentEntityId: 1,
        ownerCharacterId: 1,
        stateOwnerId: 1,
        animationOwnerId: 1,
        stateNo: 1102,
        x: state.players[0].x,
        y: 3,
        facing: 1,
        keyCtrl: false,
        ownPal: true,
        spawnFrame: 0,
        parent: state.players[0],
      }, cns);
      helpers = {
        ...helpers,
        entries: helpers.entries.map((helper) => helper.helperId === bagId
          ? { ...helper, player: { ...helper.player, stateTime: 0, vars: { 9: 20 } } }
          : helper),
      };
      state = { ...state, helpers };
    }

    for (let tick = 0; tick < 12; tick += 1) {
      state = stepCnsStateRuntime(state, cns, runtimeInput).state;
      state = stepCnsPhysicsMotion(state, cns);
    }

    expect(state.helpers.entries
      .filter((helper) => helper.helperId >= 1105 && helper.helperId <= 1107)
      .map((helper) => helper.helperId)).toEqual([1105, 1106, 1107]);
  });
});
