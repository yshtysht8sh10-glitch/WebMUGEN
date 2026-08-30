import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { parseAirText } from '../../parser/air/AirParser';
import { getMugenAnimEndTime } from '../animation/AnimationDuration';
import { getAnimationTriggerInfo, getCurrentAnimationElement } from '../animation/AnimationPlayer';
import { stepCnsPhysicsMotion } from '../cns/CnsPhysicsStep';
import {
  advanceExternalCnsStateEntryFrame,
  applyPostContactTargetBindControllers,
  enterCnsStateAndRunTimeZero,
  stepCnsStateRuntime,
} from '../cns/CnsStateRuntime';
import { createInitialGameState } from '../engine/GameState';
import { applyFallbackStageRules } from '../engine/FallbackStageRules';
import { resolveFallbackHits } from '../engine/FallbackHitResolver';
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
  it('keeps a grounded P2 in State 1465 after the real Helper 1462 contact bind', () => {
    let state = createInitialGameState();
    state.players = [
      { ...state.players[0], stateNo: -999, moveType: 'I' },
      { ...state.players[1], x: 500, y: 285, stateNo: 0, animNo: 0, moveType: 'I' },
    ];
    state.helpers = spawnHelper(state.helpers, {
      helperId: 1462,
      rootEntityId: 1,
      parentEntityId: 1,
      ownerCharacterId: 1,
      stateOwnerId: 1,
      animationOwnerId: 1,
      stateNo: 1462,
      x: 400,
      y: 245,
      facing: 1,
      keyCtrl: false,
      ownPal: true,
      spawnFrame: -1,
      parent: state.players[0],
    }, cns);

    state = stepCnsStateRuntime(state, cns, animationInput).state;
    const hand = state.helpers.entries.find((helper) => helper.helperId === 1462)!;
    expect(hand.player).toMatchObject({ stateNo: 1462, animNo: 1462, moveType: 'A' });
    expect(hand.player.activeHitDef).toMatchObject({ hitId: 1462, p2StateNo: 1465 });

    state = resolveFallbackHits(state, air, true, state, (player, opponent, stateNo) => {
      const postContact = applyPostContactTargetBindControllers(opponent, player, cns, {
        ...animationInput,
        entityContext: {
          kind: 'helper',
          entityId: hand.entityId,
          helperId: hand.helperId,
          rootEntityId: hand.rootEntityId,
          parentEntityId: hand.parentEntityId,
          ownerCharacterId: hand.ownerCharacterId,
        },
      });
      return advanceExternalCnsStateEntryFrame(enterCnsStateAndRunTimeZero(
        postContact.target,
        postContact.attacker,
        stateNo,
        cns,
        animationInput,
      ));
    });

    expect(state.players[1], state.hitDiagnosticLines?.join('\n')).toMatchObject({
      stateNo: 1465,
      stateOwnerId: 1,
      stateOwnerEntityId: hand.entityId,
      stateTime: 1,
      animNo: 1465,
      x: 485,
      y: 255,
      targetBind: { ownerId: hand.entityId, remaining: 1, offsetX: 85, offsetY: 10 },
    });
  });

  it('starts caught State 1465 before hit-shake so gravity is active when the hand launches P2', () => {
    const initial = createInitialGameState();
    const contacted = {
      ...initial.players[1],
      y: 255,
      stateOwnerId: 1,
      stateOwnerEntityId: 16,
      hitPause: 9,
      hitPauseKind: 'shake' as const,
    };
    let caught = advanceExternalCnsStateEntryFrame(enterCnsStateAndRunTimeZero(
      contacted,
      initial.players[0],
      1465,
      cns,
      animationInput,
    ));

    expect(caught).toMatchObject({
      stateNo: 1465,
      stateHeaderAppliedStateNo: 1465,
      stateTime: 1,
      animNo: 1465,
      hitPause: 9,
    });

    for (let tick = 0; tick < 9; tick += 1) {
      const stepped = stepCnsPhysicsMotion({ ...initial, players: [initial.players[0], caught] }, cns);
      caught = stepped.players[1];
    }
    expect(caught).toMatchObject({ stateNo: 1465, stateTime: 10, animTime: 1, hitPause: 0 });

    for (let tick = 0; tick < 10; tick += 1) {
      const stepped = stepCnsPhysicsMotion({ ...initial, players: [initial.players[0], caught] }, cns);
      caught = stepped.players[1];
    }
    expect(caught).toMatchObject({ stateNo: 1465, stateTime: 20, hitPause: 0 });
    const gravity = cns.states.find((state) => state.stateNo === 1465)?.controllers.find((controller) => (
      controller.type.toLowerCase() === 'veladd'
    ));
    expect(gravity?.triggers.map((trigger) => trigger.expression.toLowerCase())).toContain('time >= 20');
  });

  it('applies the redirected AnimElem launch velocity once, then lets State 1465 gravity reduce it', () => {
    let state = createInitialGameState();
    state.players = [
      { ...state.players[0], moveType: 'I' },
      {
        ...state.players[1],
        y: 49,
        vy: 0,
        stateNo: 1465,
        stateHeaderAppliedStateNo: 1465,
        stateTime: 20,
        stateOwnerId: 1,
        selfStateOwnerId: 2,
        moveType: 'H',
        stateType: 'A',
        physics: 'N',
        animNo: 1465,
        animTime: 20,
      },
    ];
    state.helpers = spawnHelper(state.helpers, {
      helperId: 1350,
      rootEntityId: 1,
      parentEntityId: 1,
      ownerCharacterId: 1,
      stateOwnerId: 1,
      animationOwnerId: 1,
      stateNo: 9999,
      x: 300,
      y: -80,
      facing: 1,
      keyCtrl: false,
      ownPal: true,
      spawnFrame: -1,
      parent: state.players[0],
    }, cns);
    const doll = state.helpers.entries.find((helper) => helper.helperId === 1350)!;
    doll.player = { ...doll.player, animNo: 1464, animTime: 3 };
    state.helpers = spawnHelper(state.helpers, {
      helperId: 1462,
      rootEntityId: 1,
      parentEntityId: doll.entityId,
      ownerCharacterId: 1,
      stateOwnerId: 1,
      animationOwnerId: 1,
      stateNo: 1464,
      x: 300,
      y: -80,
      facing: 1,
      keyCtrl: false,
      ownPal: true,
      spawnFrame: -1,
      parent: doll.player,
    }, cns);
    const hand = state.helpers.entries.find((helper) => helper.helperId === 1462)!;
    hand.player = {
      ...hand.player,
      stateTime: 10,
      targets: [{ playerId: 2, hitDefId: 1462, activeHitDefId: 7 }],
    };
    state.players[1] = { ...state.players[1], stateOwnerEntityId: hand.entityId };

    state = stepCnsStateRuntime(state, cns, animationInput).state;
    expect(state.players[1]).toMatchObject({ stateNo: 1465, stateTime: 20, facing: -1, vx: 0.5, vy: -14 });

    state = stepCnsPhysicsMotion(state, cns);
    state = stepCnsStateRuntime(state, cns, animationInput).state;
    expect(state.players[1]).toMatchObject({ stateNo: 1465, stateTime: 21, facing: -1, vx: 0.5, vy: -13.63 });
    expect(state.helpers.entries.find((helper) => helper.helperId === 1462)?.player.stateTime).toBe(11);
  });

  it('keeps State 1465 P2 on the real Helper 1462 hand through stage correction', () => {
    let state = createInitialGameState();
    state.helpers = spawnHelper(state.helpers, {
      helperId: 1462,
      rootEntityId: 1,
      parentEntityId: 1,
      ownerCharacterId: 1,
      stateOwnerId: 1,
      animationOwnerId: 1,
      stateNo: 1464,
      x: 300,
      y: -80,
      facing: 1,
      keyCtrl: false,
      ownPal: true,
      spawnFrame: -1,
      parent: state.players[0],
    }, cns);
    const hand = state.helpers.entries[0];
    state.players[1] = {
      ...state.players[1],
      stateNo: 1465,
      stateHeaderAppliedStateNo: 1465,
      stateTime: 12,
      stateOwnerId: 1,
      stateOwnerEntityId: hand.entityId,
      stateType: 'A',
      moveType: 'H',
      physics: 'N',
      animNo: 1465,
      animationOwnerId: 1,
      targetBind: { ownerId: hand.entityId, remaining: 1, offsetX: 85, offsetY: 10 },
    };

    state = applyFallbackStageRules(stepCnsPhysicsMotion(state, cns));

    const movedHand = state.helpers.entries.find((helper) => helper.entityId === hand.entityId)!.player;
    expect(state.players[1]).toMatchObject({
      stateNo: 1465,
      animNo: 1465,
      animationOwnerId: 1,
      x: movedHand.x + 85 * movedHand.facing,
      y: movedHand.y + 10,
    });
  });

  it('lets the real anti-air Helper 1472 catch the released State 1465 target', () => {
    let state = createInitialGameState();
    state.players[0] = { ...state.players[0], moveType: 'I' };
    state.players[1] = {
      ...state.players[1],
      x: 385,
      y: -80,
      facing: -1,
      stateNo: 1465,
      stateHeaderAppliedStateNo: 1465,
      stateTime: 40,
      stateOwnerId: 1,
      stateOwnerEntityId: 1,
      selfStateOwnerId: 2,
      stateType: 'A',
      moveType: 'H',
      physics: 'N',
      animNo: 1465,
      animTime: 40,
      vx: 0.5,
      vy: -6.6,
    };
    state = stepCnsStateRuntime(state, cns, animationInput).state;
    expect(state.players[1]).toMatchObject({ stateNo: 1465, animNo: 5050, stateType: 'A', moveType: 'H' });

    state.helpers = spawnHelper(state.helpers, {
      helperId: 1472,
      rootEntityId: 1,
      parentEntityId: 1,
      ownerCharacterId: 1,
      stateOwnerId: 1,
      animationOwnerId: 1,
      stateNo: 1472,
      x: 300,
      y: -80,
      facing: 1,
      keyCtrl: false,
      ownPal: true,
      spawnFrame: -1,
      parent: state.players[0],
    }, cns);
    state = stepCnsStateRuntime(state, cns, animationInput).state;
    const hand = state.helpers.entries.find((helper) => helper.helperId === 1472)!;
    expect(hand.player.activeHitDef).toMatchObject({ hitFlag: 'AF', p2StateNo: 1475 });

    for (let tick = 0; tick < 5; tick += 1) {
      state = stepCnsPhysicsMotion(state, cns);
      state = stepCnsStateRuntime(state, cns, animationInput).state;
    }
    const activeHand = state.helpers.entries.find((helper) => helper.entityId === hand.entityId)!;
    activeHand.player = {
      ...activeHand.player,
      x: state.players[1].x - 85,
      y: state.players[1].y - 10,
    };
    expect(activeHand.player).toMatchObject({ animNo: 1462, moveType: 'A' });

    state = resolveFallbackHits(state, air, true, state);

    expect(state.players[1], state.hitDiagnosticLines?.join('\n')).toMatchObject({
      stateNo: 1475,
      stateOwnerId: 1,
      stateOwnerEntityId: hand.entityId,
    });
    expect(state.helpers.entries.find((helper) => helper.entityId === hand.entityId)?.player.moveContact).toMatchObject({
      hit: true,
      hitCount: 1,
    });
  });

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

  it('changes the caught doll from Anim 1470 to 1471 when Helper 1472 reaches State 1476 Time 50', () => {
    let state = createInitialGameState();
    state.helpers = spawnHelper(state.helpers, {
      helperId: 1350,
      rootEntityId: 1,
      parentEntityId: 1,
      ownerCharacterId: 1,
      stateOwnerId: 1,
      animationOwnerId: 1,
      stateNo: 1473,
      x: 100,
      y: -20,
      facing: 1,
      keyCtrl: false,
      ownPal: true,
      spawnFrame: -1,
      parent: state.players[0],
    }, cns);
    const doll = state.helpers.entries.find((helper) => helper.helperId === 1350)!;
    doll.player = {
      ...doll.player,
      stateHeaderAppliedStateNo: 1473,
      stateTime: 10,
      animNo: 1470,
      animTime: 10,
    };
    state.helpers = spawnHelper(state.helpers, {
      helperId: 1472,
      rootEntityId: 1,
      parentEntityId: doll.entityId,
      ownerCharacterId: 1,
      stateOwnerId: 1,
      animationOwnerId: 1,
      stateNo: 1476,
      x: 185,
      y: -20,
      facing: 1,
      keyCtrl: false,
      ownPal: true,
      spawnFrame: -1,
      parent: doll.player,
    }, cns);
    const hand = state.helpers.entries.find((helper) => helper.helperId === 1472)!;
    hand.player = {
      ...hand.player,
      stateHeaderAppliedStateNo: 1476,
      stateTime: 50,
    };

    state = stepCnsStateRuntime(state, cns, animationInput).state;

    expect(state.helpers.entries.find((helper) => helper.helperId === 1350)?.player).toMatchObject({
      stateNo: 1473,
      animNo: 1471,
      animTime: 0,
    });
  });

  it('keeps the doll synchronized through the real State 1470 to 1473 wall-carry route', () => {
    let state = createInitialGameState();
    state.helpers = spawnHelper(state.helpers, {
      helperId: 1350,
      rootEntityId: 1,
      parentEntityId: 1,
      ownerCharacterId: 1,
      stateOwnerId: 1,
      animationOwnerId: 1,
      stateNo: 1470,
      x: 300,
      y: -50,
      facing: 1,
      keyCtrl: false,
      ownPal: true,
      spawnFrame: -1,
      parent: state.players[0],
    }, cns);
    const doll = state.helpers.entries.find((helper) => helper.helperId === 1350)!;
    doll.player = {
      ...doll.player,
      stateHeaderAppliedStateNo: 1470,
      stateTime: 5,
      animNo: 1460,
      animTime: 9,
    };
    state.helpers = spawnHelper(state.helpers, {
      helperId: 1472,
      rootEntityId: 1,
      parentEntityId: doll.entityId,
      ownerCharacterId: 1,
      stateOwnerId: 1,
      animationOwnerId: 1,
      stateNo: 1474,
      x: 900,
      y: -50,
      facing: 1,
      keyCtrl: false,
      ownPal: true,
      spawnFrame: -1,
      parent: doll.player,
    }, cns);
    const hand = state.helpers.entries.find((helper) => helper.helperId === 1472)!;
    hand.player = {
      ...hand.player,
      stateHeaderAppliedStateNo: 1474,
      stateTime: 0,
      animNo: 1462,
    };

    state = stepCnsStateRuntime(state, cns, { ...animationInput, screenRight: 960 }).state;
    expect(state.helpers.entries.find((helper) => helper.helperId === 1350)?.player.stateNo).toBe(1473);
    expect(state.helpers.entries.find((helper) => helper.helperId === 1472)?.player.stateNo).toBe(1474);

    for (let tick = 0; tick < 51; tick += 1) {
      state = stepCnsPhysicsMotion(state, cns);
      state = stepCnsStateRuntime(state, cns, { ...animationInput, screenRight: 960 }).state;
    }

    expect(state.helpers.entries.find((helper) => helper.helperId === 1350)?.player).toMatchObject({
      stateNo: 1473,
      animNo: 1471,
    });
  });

  it('lets an older doll observe its newer hand entering State 1474 on the timeout frame', () => {
    let state = createInitialGameState();
    state.helpers = spawnHelper(state.helpers, {
      helperId: 1350,
      rootEntityId: 1,
      parentEntityId: 1,
      ownerCharacterId: 1,
      stateOwnerId: 1,
      animationOwnerId: 1,
      stateNo: 1470,
      x: 300,
      y: -50,
      facing: 1,
      keyCtrl: false,
      ownPal: true,
      spawnFrame: -1,
      parent: state.players[0],
    }, cns);
    const doll = state.helpers.entries.find((helper) => helper.helperId === 1350)!;
    doll.player = {
      ...doll.player,
      stateHeaderAppliedStateNo: 1470,
      stateTime: 26,
      animNo: 1460,
      animTime: 26,
    };
    state.helpers = spawnHelper(state.helpers, {
      helperId: 1472,
      rootEntityId: 1,
      parentEntityId: doll.entityId,
      ownerCharacterId: 1,
      stateOwnerId: 1,
      animationOwnerId: 1,
      stateNo: 1472,
      x: 385,
      y: -40,
      facing: 1,
      keyCtrl: false,
      ownPal: true,
      spawnFrame: -1,
      parent: doll.player,
    }, cns);
    const hand = state.helpers.entries.find((helper) => helper.helperId === 1472)!;
    hand.player = {
      ...hand.player,
      stateHeaderAppliedStateNo: 1472,
      stateTime: 16,
      animNo: 1462,
      moveContact: {
        activeHitDefId: 1472,
        contact: true,
        hit: true,
        guarded: false,
        elapsed: 1,
        hitCount: 1,
      },
    };

    state = stepCnsStateRuntime(state, cns, animationInput).state;

    expect(state.helpers.entries.find((helper) => helper.helperId === 1472)?.player.stateNo).toBe(1474);
    expect(state.helpers.entries.find((helper) => helper.helperId === 1350)?.player.stateNo).toBe(1473);
  });

  it('returns the missed super-B root and doll to neutral on the same frame', () => {
    let state = createInitialGameState();
    state.players[0] = {
      ...state.players[0],
      stateNo: 1330,
      stateHeaderAppliedStateNo: 1330,
      stateTime: 103,
      stateType: 'S',
      moveType: 'I',
      physics: 'S',
      ctrl: false,
      animNo: 1490,
      animTime: 103,
    };
    state.helpers = spawnHelper(state.helpers, {
      helperId: 1350,
      rootEntityId: 1,
      parentEntityId: 1,
      ownerCharacterId: 1,
      stateOwnerId: 1,
      animationOwnerId: 1,
      stateNo: 1480,
      x: 300,
      y: -50,
      facing: 1,
      keyCtrl: false,
      ownPal: true,
      spawnFrame: -1,
      parent: state.players[0],
    }, cns);
    const doll = state.helpers.entries.find((helper) => helper.helperId === 1350)!;
    doll.player = {
      ...doll.player,
      stateHeaderAppliedStateNo: 1480,
      stateTime: 100,
      animNo: 1480,
      animTime: 100,
    };

    state = stepCnsStateRuntime(state, cns, animationInput).state;

    expect(state.players[0]).toMatchObject({ stateNo: 1301, stateTime: 0, animNo: 1310 });
    expect(state.helpers.entries.find((helper) => helper.helperId === 1350)?.player).toMatchObject({
      stateNo: 1350,
      stateTime: 0,
      animNo: 1350,
    });
  });

  it('keeps the high doll in ground-catch State 1463 while Action 1460 holds indefinitely', () => {
    let state = createInitialGameState();
    state.helpers = spawnHelper(state.helpers, {
      helperId: 1350,
      rootEntityId: 1,
      parentEntityId: 1,
      ownerCharacterId: 1,
      stateOwnerId: 1,
      animationOwnerId: 1,
      stateNo: 1463,
      x: 300,
      y: -200,
      facing: 1,
      keyCtrl: false,
      ownPal: true,
      spawnFrame: -1,
      parent: state.players[0],
    }, cns);
    const doll = state.helpers.entries.find((helper) => helper.helperId === 1350)!;
    doll.player = {
      ...doll.player,
      stateHeaderAppliedStateNo: 1463,
      stateTime: 20,
      animNo: 1460,
      animTime: 49,
    };
    state.helpers = spawnHelper(state.helpers, {
      helperId: 1462,
      rootEntityId: 1,
      parentEntityId: doll.entityId,
      ownerCharacterId: 1,
      stateOwnerId: 1,
      animationOwnerId: 1,
      stateNo: 1464,
      x: 385,
      y: 100,
      facing: 1,
      keyCtrl: false,
      ownPal: true,
      spawnFrame: -1,
      parent: doll.player,
    }, cns);
    const hand = state.helpers.entries.find((helper) => helper.helperId === 1462)!;
    hand.player = { ...hand.player, vars: { ...(hand.player.vars ?? {}), 1: -200 } };

    state = stepCnsStateRuntime(state, cns, animationInput).state;

    expect(state.helpers.entries.find((helper) => helper.helperId === 1350)?.player).toMatchObject({
      stateNo: 1463,
      animNo: 1460,
      animTime: 49,
    });
  });

  it('keeps the ground-caught target in real State 1465 while the controlling Helper root is unharmed', () => {
    let state = createInitialGameState();
    state.players = [
      { ...state.players[0], moveType: 'I' },
      {
        ...state.players[1],
        y: -100,
        stateNo: 1465,
        stateHeaderAppliedStateNo: 1465,
        stateTime: 1,
        stateOwnerId: 1,
        selfStateOwnerId: 2,
        moveType: 'H',
        stateType: 'A',
        physics: 'N',
      },
    ];
    state.helpers = spawnHelper(state.helpers, {
      helperId: 1462,
      rootEntityId: 1,
      parentEntityId: 1,
      ownerCharacterId: 1,
      stateOwnerId: 1,
      animationOwnerId: 1,
      stateNo: 1464,
      x: 300,
      y: -100,
      facing: 1,
      keyCtrl: false,
      ownPal: true,
      spawnFrame: -1,
      parent: state.players[0],
    }, cns);
    state.players[1] = { ...state.players[1], stateOwnerEntityId: state.helpers.entries[0].entityId };

    const held = stepCnsStateRuntime(state, cns, animationInput).state;
    expect(held.players[1]).toMatchObject({ stateNo: 1465, stateOwnerId: 1 });

    const aborted = stepCnsStateRuntime({
      ...held,
      players: [{ ...held.players[0], moveType: 'H' }, held.players[1]],
    }, cns, animationInput).state;
    expect(aborted.players[1]).toMatchObject({ stateNo: 5040, prevStateNo: 5030, stateOwnerId: 2 });
    expect(aborted.players[1].stateOwnerEntityId).toBeUndefined();
  });

  it('lets the doll observe the returning hand before its same-pass DestroySelf cleanup', () => {
    let state = createInitialGameState();
    state.helpers = spawnHelper(state.helpers, {
      helperId: 1350,
      rootEntityId: 1,
      parentEntityId: 1,
      ownerCharacterId: 1,
      stateOwnerId: 1,
      animationOwnerId: 1,
      stateNo: 1460,
      x: 300,
      y: -200,
      facing: 1,
      keyCtrl: false,
      ownPal: true,
      spawnFrame: -1,
      parent: state.players[0],
    }, cns);
    const doll = state.helpers.entries.find((helper) => helper.helperId === 1350)!;
    doll.player = {
      ...doll.player,
      stateHeaderAppliedStateNo: 1460,
      stateTime: 85,
      animNo: 1460,
      animTime: 85,
    };
    state.helpers = spawnHelper(state.helpers, {
      helperId: 1462,
      rootEntityId: 1,
      parentEntityId: doll.entityId,
      ownerCharacterId: 1,
      stateOwnerId: 1,
      animationOwnerId: 1,
      stateNo: 1462,
      x: 385,
      y: -200,
      facing: 1,
      keyCtrl: false,
      ownPal: true,
      spawnFrame: -1,
      parent: doll.player,
    }, cns);
    const hand = state.helpers.entries.find((helper) => helper.helperId === 1462)!;
    hand.player = {
      ...hand.player,
      stateHeaderAppliedStateNo: 1462,
      stateTime: 75,
      animNo: 1462,
      animTime: 75,
      y: -200,
      vy: -3,
      vars: { ...(hand.player.vars ?? {}), 1: -200, 2: 60 },
    };

    state = stepCnsStateRuntime(state, cns, animationInput).state;

    expect(state.helpers.entries.some((helper) => helper.helperId === 1462)).toBe(false);
    expect(state.helpers.entries.find((helper) => helper.helperId === 1350)?.player).toMatchObject({
      stateNo: 1461,
      animNo: 1463,
    });
  });

  it('returns and destroys Helper 1472 after carrying the target to the front wall', () => {
    let state = createInitialGameState();
    state.helpers = spawnHelper(state.helpers, {
      helperId: 1350,
      rootEntityId: 1,
      parentEntityId: 1,
      ownerCharacterId: 1,
      stateOwnerId: 1,
      animationOwnerId: 1,
      stateNo: 1473,
      x: 100,
      y: -40,
      facing: 1,
      keyCtrl: false,
      ownPal: true,
      spawnFrame: -1,
      parent: state.players[0],
    }, cns);
    const doll = state.helpers.entries.find((helper) => helper.helperId === 1350)!;
    doll.player = {
      ...doll.player,
      stateHeaderAppliedStateNo: 1473,
      stateTime: 0,
      animNo: 1470,
      animTime: 0,
    };
    state.helpers = spawnHelper(state.helpers, {
      helperId: 1472,
      rootEntityId: 1,
      parentEntityId: doll.entityId,
      ownerCharacterId: 1,
      stateOwnerId: 1,
      animationOwnerId: 1,
      stateNo: 1474,
      x: 100,
      y: -40,
      facing: 1,
      keyCtrl: false,
      ownPal: true,
      spawnFrame: -1,
      parent: doll.player,
    }, cns);
    const hand = state.helpers.entries.find((helper) => helper.helperId === 1472)!;
    hand.player = {
      ...hand.player,
      stateHeaderAppliedStateNo: 1474,
      stateTime: 0,
      animNo: 1462,
      hitPause: 10,
    };

    const visited = new Set<number>();
    for (let tick = 0; tick < 500 && state.helpers.entries.some((helper) => helper.helperId === 1472); tick += 1) {
      const currentHand = state.helpers.entries.find((helper) => helper.helperId === 1472);
      if (currentHand) visited.add(currentHand.player.stateNo);
      state = stepCnsStateRuntime(state, cns, { ...animationInput, screenLeft: 0, screenRight: 400 }).state;
      state = stepCnsPhysicsMotion(state, cns);
    }

    expect(visited).toEqual(new Set([1474, 1476, 1477]));
    expect(state.helpers.entries.some((helper) => helper.helperId === 1472)).toBe(false);
    for (let tick = 0; tick < 30 && state.helpers.entries.find((helper) => helper.helperId === 1350)?.player.stateNo === 1473; tick += 1) {
      state = stepCnsStateRuntime(state, cns, { ...animationInput, screenLeft: 0, screenRight: 400 }).state;
      state = stepCnsPhysicsMotion(state, cns);
    }
    expect(state.helpers.entries.find((helper) => helper.helperId === 1350)?.player).toMatchObject({
      stateNo: 1350,
      animNo: 1350,
    });
  });
});
