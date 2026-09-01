import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { stepCnsPhysicsMotion } from '../cns/CnsPhysicsStep';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { createInitialGameState } from '../engine/GameState';
import { spawnHelper } from '../helper/HelperSystem';

const decoder = new TextDecoder('shift_jis');
const cns = parseCnsText(decoder.decode(readFileSync('public/chars/itoko/itoko.cns')));

describe('itoko rubber-belt Helper compatibility', () => {
  it('keeps Helper 1210 attached between its immediate parent and root', () => {
    const initial = createInitialGameState();
    initial.players[0] = {
      ...initial.players[0],
      x: 300,
      stateNo: 1200,
      stateHeaderAppliedStateNo: 1200,
      stateTime: 1,
      stateType: 'A',
      moveType: 'A',
      physics: 'A',
      ctrl: false,
      animNo: 1200,
      vars: { 9: 0 },
    };
    initial.helpers = spawnHelper(initial.helpers, {
      helperId: 1360,
      rootEntityId: 1,
      parentEntityId: 1,
      ownerCharacterId: 1,
      stateOwnerId: 1,
      animationOwnerId: 1,
      stateNo: 1371,
      x: 100,
      y: 15,
      facing: 1,
      keyCtrl: false,
      ownPal: true,
      spawnFrame: -1,
      parent: initial.players[0],
    }, cns);

    let state = stepCnsStateRuntime(initial, cns).state;
    const belt = state.helpers.entries.find((helper) => helper.helperId === 1210);
    expect(belt).toMatchObject({
      rootEntityId: 1,
      parentEntityId: 3,
      player: { x: 100, y: 15, stateNo: 1210 },
    });

    state = {
      ...state,
      helpers: {
        ...state.helpers,
        entries: state.helpers.entries.map((helper) => ({
          ...helper,
          player: {
            ...helper.player,
            stateTime: helper.entityId === belt?.entityId ? 0 : 1,
          },
        })),
      },
    };
    // State 1210 intentionally runs AngleDraw before AngleSet. Its first pass
    // primes the stored angle, which the next pass draws just like WinMUGEN.
    state = stepCnsStateRuntime(state, cns).state;
    state = {
      ...state,
      helpers: {
        ...state.helpers,
        entries: state.helpers.entries.map((helper) => helper.entityId === belt?.entityId
          ? { ...helper, player: { ...helper.player, stateTime: 5 } }
          : helper),
      },
    };
    state = stepCnsStateRuntime(state, cns).state;

    const drawnBelt = state.helpers.entries.find((helper) => helper.entityId === belt?.entityId)?.player;
    const angle = 90 - Math.atan(270 / 200) * 180 / Math.PI;
    const lengthScale = 1 / Math.cos(Math.atan(200 / -270));
    expect(drawnBelt?.drawAngle).toBeCloseTo(angle, 8);
    expect(drawnBelt?.drawScale?.x).toBe(1);
    expect(drawnBelt?.drawScale?.y).toBeCloseTo(lengthScale, 8);

    // Canvas must rotate the downward belt clockwise (a negative Canvas
    // angle) so its lower end moves toward a root standing to the right.
    const canvasAngle = -(drawnBelt?.drawAngle ?? 0) * (drawnBelt?.facing ?? 1) * Math.PI / 180;
    expect(Math.sin(canvasAngle)).toBeLessThan(0);
  });

  it('clears the root AngleDraw transform when rubber-belt motion lands in State 52', () => {
    const initial = createInitialGameState();
    initial.players[0] = {
      ...initial.players[0],
      stateNo: 1200,
      stateHeaderAppliedStateNo: 1200,
      stateTime: 10,
      stateType: 'A',
      moveType: 'A',
      physics: 'A',
      ctrl: false,
      animNo: 1202,
      y: 284,
      vy: 2,
      angle: 60,
    } as typeof initial.players[0] & { angle: number };

    const angled = stepCnsStateRuntime(initial, cns).state;
    expect(angled.players[0].drawAngle).toBe(30);

    const landed = stepCnsPhysicsMotion(angled, cns);
    expect(landed.players[0]).toMatchObject({ stateNo: 52, animNo: 47 });
    expect(landed.players[0].drawAngle).toBeUndefined();
    expect(landed.players[0].drawScale).toBeUndefined();
  });

  it('first renders a chained strong belt after its red Anim and AngleDraw are initialized', () => {
    const initial = createInitialGameState();
    initial.players[0] = {
      ...initial.players[0],
      x: 300,
      y: 200,
      stateNo: 1203,
      stateTime: 1,
      stateType: 'A',
      moveType: 'A',
      physics: 'A',
      ctrl: false,
      animNo: 1200,
      vars: { 9: 0 },
    };
    initial.helpers = spawnHelper(initial.helpers, {
      helperId: 1360,
      rootEntityId: 1,
      parentEntityId: 1,
      ownerCharacterId: 1,
      stateOwnerId: 1,
      animationOwnerId: 1,
      stateNo: 1371,
      x: 100,
      y: 15,
      facing: 1,
      keyCtrl: false,
      ownPal: true,
      spawnFrame: -1,
      parent: initial.players[0],
    }, cns);

    let state = stepCnsStateRuntime(initial, cns).state;
    let belt = state.helpers.entries.find((helper) => helper.helperId === 1210);
    expect(belt).toMatchObject({
      hasCompletedInitialStatePass: true,
      canRenderBeforeInitialStatePass: false,
      player: { animNo: 1211, drawScale: { x: 0.1 } },
    });
    const parent = state.helpers.entries.find((helper) => helper.entityId === belt?.parentEntityId)?.player;
    const expectedAngle = 90 - Math.atan(
      (state.players[0].y - (parent?.y ?? 0)) / (state.players[0].x - (parent?.x ?? 0)),
    ) * 180 / Math.PI;
    expect(belt?.player.drawAngle).toBeCloseTo(expectedAngle, 8);
  });
});
