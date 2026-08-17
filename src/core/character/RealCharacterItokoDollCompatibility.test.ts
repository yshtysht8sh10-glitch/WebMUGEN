import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { stepCnsPhysicsMotion } from '../cns/CnsPhysicsStep';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { createInitialGameState } from '../engine/GameState';
import { spawnHelper } from '../helper/HelperSystem';

const decoder = new TextDecoder('shift_jis');
const cns = parseCnsText(decoder.decode(readFileSync('public/chars/itoko/itoko.cns')));

describe('itoko thread-and-thimble doll compatibility', () => {
  it('moves Helper 1360 into its fixed summon state and creates the doll on frame 50', () => {
    let state = createInitialGameState();
    state.players[0] = {
      ...state.players[0],
      stateNo: 1300,
      stateHeaderAppliedStateNo: 1300,
      stateTime: 0,
      stateType: 'S',
      moveType: 'I',
      physics: 'S',
      ctrl: false,
      animNo: 1300,
    };
    state.helpers = spawnHelper(state.helpers, {
      helperId: 1360,
      rootEntityId: 1,
      parentEntityId: 1,
      ownerCharacterId: 1,
      stateOwnerId: 1,
      animationOwnerId: 1,
      stateNo: 1360,
      x: state.players[0].x,
      y: state.players[0].y - 270,
      facing: 1,
      keyCtrl: false,
      ownPal: true,
      spawnFrame: -1,
      parent: state.players[0],
    }, cns);

    state = stepCnsStateRuntime(state, cns).state;
    const tracker = state.helpers.entries.find((helper) => helper.helperId === 1360)?.player;
    expect((tracker?.x ?? 0) - state.players[0].x).toBe(0);
    expect(tracker?.stateNo).toBe(1362);

    for (let tick = 0; tick < 50; tick += 1) {
      state = stepCnsPhysicsMotion(state, cns);
      state = stepCnsStateRuntime(state, cns).state;
    }

    expect(state.players[0].stateTime).toBe(50);
    expect(state.helpers.entries.find((helper) => helper.helperId === 1350)).toMatchObject({
      player: { stateNo: 1348 },
    });
  });

  it('brings a trailing Helper 1360 to the fixed summon state', () => {
    let state = createInitialGameState();
    state.players[0] = {
      ...state.players[0],
      stateNo: 1300,
      stateHeaderAppliedStateNo: 1300,
      stateTime: 0,
      stateType: 'S',
      moveType: 'I',
      physics: 'S',
      ctrl: false,
      animNo: 1300,
    };
    state.helpers = spawnHelper(state.helpers, {
      helperId: 1360,
      rootEntityId: 1,
      parentEntityId: 1,
      ownerCharacterId: 1,
      stateOwnerId: 1,
      animationOwnerId: 1,
      stateNo: 1360,
      x: state.players[0].x - 30,
      y: state.players[0].y - 270,
      facing: 1,
      keyCtrl: false,
      ownPal: true,
      spawnFrame: -1,
      parent: state.players[0],
    }, cns);

    for (let tick = 0; tick < 60; tick += 1) {
      state = stepCnsStateRuntime(state, cns).state;
      state = stepCnsPhysicsMotion(state, cns);
    }

    const trailingTracker = state.helpers.entries.find((helper) => helper.helperId === 1360)?.player;
    expect(trailingTracker?.stateNo).toBe(1362);
    expect(state.helpers.entries.some((helper) => helper.helperId === 1350)).toBe(true);
  });
});
