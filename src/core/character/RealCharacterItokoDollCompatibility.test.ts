import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { parseAirText } from '../../parser/air/AirParser';
import { getMugenAnimEndTime } from '../animation/AnimationDuration';
import { getAnimationTriggerInfo, getCurrentAnimationElement } from '../animation/AnimationPlayer';
import { stepCnsPhysicsMotion } from '../cns/CnsPhysicsStep';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { createInitialGameState } from '../engine/GameState';
import { spawnHelper } from '../helper/HelperSystem';

const decoder = new TextDecoder('shift_jis');
const cns = parseCnsText(decoder.decode(readFileSync('public/chars/itoko/itoko.cns')));
const air = parseAirText(decoder.decode(readFileSync('public/chars/itoko/itoko.air')));
const animationInput = {
  getAnimationDuration: (animNo: number) => getMugenAnimEndTime(air, animNo),
  getAnimationTriggerInfo: (animNo: number, animTime: number) => getAnimationTriggerInfo(air, animNo, animTime),
  getAnimationElementNo: (animNo: number, animTime: number) => {
    const element = getCurrentAnimationElement(air, animNo, animTime);
    return element ? element.elementIndex + 1 : null;
  },
};

describe('itoko thread-and-thimble doll compatibility', () => {
  it('marks every root-side control-thread frame for vertical AIR flipping', () => {
    const action = air.actions.find((candidate) => candidate.actionNo === 1370);

    expect(action?.elements.length).toBeGreaterThan(0);
    expect(action?.elements.every((element) => element.flip.toUpperCase().includes('V'))).toBe(true);
  });

  it.each([
    { opponentX: 500, command: 'holdfwd', expectedAnim: 1315, expectedVelocity: 3 },
    { opponentX: 500, command: 'holdback', expectedAnim: 1316, expectedVelocity: -2.5 },
    { opponentX: 200, command: 'holdback', expectedAnim: 1317, expectedVelocity: -2.5 },
    { opponentX: 200, command: 'holdfwd', expectedAnim: 1318, expectedVelocity: 3 },
  ])('selects screen-correct State 1301 movement Anim $expectedAnim for $command', ({
    opponentX, command, expectedAnim, expectedVelocity,
  }) => {
    const initial = createInitialGameState();
    initial.players[0] = {
      ...initial.players[0],
      x: 320,
      facing: 1,
      stateNo: 1301,
      stateHeaderAppliedStateNo: 1301,
      stateTime: 10,
      stateType: 'S',
      moveType: 'I',
      physics: 'S',
      ctrl: false,
      animNo: 1310,
      animTime: 0,
    };
    initial.players[1] = { ...initial.players[1], x: opponentX };

    const stepped = stepCnsStateRuntime(initial, cns, {
      ...animationInput,
      p1Commands: new Set([command]),
    }).state.players[0];

    expect(stepped).toMatchObject({
      stateNo: 1301,
      facing: 1,
      animNo: expectedAnim,
      animTime: 0,
      vx: expectedVelocity,
    });
  });

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
