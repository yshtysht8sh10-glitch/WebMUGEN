import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getMugenAnimEndTime } from '../animation/AnimationDuration';
import { getAnimationTriggerInfo } from '../animation/AnimationPlayer';
import { parseAirText } from '../../parser/air/AirParser';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { stepCnsPhysicsMotion } from '../cns/CnsPhysicsStep';
import { createInitialGameState } from '../engine/GameState';
import { applyFallbackStageRules } from '../engine/FallbackStageRules';
import { spawnHelper } from '../helper/HelperSystem';
import type { GameState, ProjectileState } from '../engine/types';
import { resolveProjectileHits, stepProjectiles } from '../projectile/ProjectileSystem';

const decoder = new TextDecoder('shift_jis');
const itokoCns = parseCnsText(decoder.decode(readFileSync('public/chars/itoko/itoko.cns')));
const itokoAir = parseAirText(decoder.decode(readFileSync('public/chars/itoko/itoko.air')));

function withRealProjectileHitBox(projectile: ProjectileState): ProjectileState {
  const action = itokoAir.actions.find((candidate) => candidate.actionNo === projectile.animNo);
  const boxes = action?.elements[0]?.clsn1.length ? action.elements[0].clsn1 : action?.defaultClsn1 ?? [];
  if (boxes.length === 0) return projectile;
  return {
    ...projectile,
    hitBox: {
      x: Math.min(...boxes.map((box) => box.left)),
      y: Math.min(...boxes.map((box) => box.top)),
      width: Math.max(...boxes.map((box) => box.right)) - Math.min(...boxes.map((box) => box.left)),
      height: Math.max(...boxes.map((box) => box.bottom)) - Math.min(...boxes.map((box) => box.top)),
    },
  };
}

describe('itoko zipper compatibility', () => {
  it('lets the State 3006 follow-up hit during initial hitpause and enter the zipper-close states', () => {
    const initial = createInitialGameState();
    const state: GameState = {
      ...initial,
      players: [
        {
          ...initial.players[0],
          x: 400,
          y: 285,
          facing: 1,
          stateNo: 3006,
          stateHeaderAppliedStateNo: 3006,
          stateTime: 25,
          stateType: 'S',
          moveType: 'A',
          physics: 'S',
          ctrl: false,
          animNo: 3002,
        },
        {
          ...initial.players[1],
          x: 480,
          y: 285,
          facing: -1,
          stateNo: 5070,
          stateTime: 0,
          stateType: 'A',
          moveType: 'H',
          physics: 'N',
          ctrl: false,
          animNo: 5030,
          hitPause: 75,
          stateOwnerId: 1,
          selfStateOwnerId: 2,
        },
      ],
    };
    const createdProjectiles: ProjectileState[] = [];
    const created = stepCnsStateRuntime(state, itokoCns, {
      getCnsDocumentForPlayer: () => itokoCns,
      onProjectileCreate: (projectile) => createdProjectiles.push(projectile),
    });

    expect(created.traces[0].executedControllers).toContain('Projectile');
    expect(createdProjectiles).toEqual([
      expect.objectContaining({ id: 0, animNo: 3066, x: 418, y: 255, removeTime: 175 }),
    ]);

    const action = itokoAir.actions.find((candidate) => candidate.actionNo === 3066);
    const boxes = action?.elements[0]?.clsn1.length ? action.elements[0].clsn1 : action?.defaultClsn1 ?? [];
    expect(boxes).toHaveLength(1);
    const projectile = {
      ...createdProjectiles[0],
      hitBox: {
        x: Math.min(...boxes.map((box) => box.left)),
        y: Math.min(...boxes.map((box) => box.top)),
        width: Math.max(...boxes.map((box) => box.right)) - Math.min(...boxes.map((box) => box.left)),
        height: Math.max(...boxes.map((box) => box.bottom)) - Math.min(...boxes.map((box) => box.top)),
      },
    };
    const contact = resolveProjectileHits(created.state.players, [projectile]);
    expect(contact.hitEvents).toHaveLength(1);
    expect(contact.players[0].projectileContacts?.[0]).toMatchObject({ hitTime: 1 });
    expect(contact.players[0].targets).toEqual([
      expect.objectContaining({ playerId: 2, hitDefId: 3066 }),
    ]);
    expect(contact.players[1]).toMatchObject({ stateNo: 5030, hitPause: 0 });

    const closed = stepCnsStateRuntime({
      ...created.state,
      players: contact.players,
      projectiles: contact.projectiles,
      hitEvents: contact.hitEvents,
    }, itokoCns, { getCnsDocumentForPlayer: () => itokoCns });

    expect(closed.traces[0].executedControllers).toEqual(expect.arrayContaining(['TargetState', 'ChangeState']));
    expect(closed.state.players[0]).toMatchObject({ stateNo: 3010 });
    expect(closed.state.players[1]).toMatchObject({ stateNo: 3007, stateOwnerId: 1, selfStateOwnerId: 2 });
  });

  it('releases the two-tick opening bind during defender HitPause so Projectile 3066 can launch', () => {
    const initial = createInitialGameState();
    const p1 = {
      ...initial.players[0],
      x: 400,
      y: 285,
      stateNo: 3005,
      stateHeaderAppliedStateNo: 3005,
      stateTime: 12,
      stateType: 'S' as const,
      moveType: 'A' as const,
      physics: 'S' as const,
      targets: [{ playerId: 2 as const, hitDefId: 3065, activeHitDefId: 3065 }],
      projectileContacts: {
        0: { contactTime: 1, hitTime: 1, guardedTime: -1 },
        3065: { contactTime: 1, hitTime: 1, guardedTime: -1 },
      },
    };
    const p2 = {
      ...initial.players[1],
      x: 480,
      y: 285,
      stateNo: 5030,
      stateHeaderAppliedStateNo: 5030,
      stateTime: 0,
      stateType: 'A' as const,
      moveType: 'H' as const,
      physics: 'N' as const,
      hitPause: 100,
      vy: 15,
    };
    const enteredLaunch = stepCnsStateRuntime({ ...initial, players: [p1, p2] }, itokoCns, {
      getCnsDocumentForPlayer: () => itokoCns,
    }).state;
    expect(enteredLaunch.players[0].stateNo).toBe(3006);
    expect(enteredLaunch.players[1].targetBind).toMatchObject({ ownerId: 1, remaining: 2, offsetX: 80, offsetY: 30 });

    const firstBoundTick = stepCnsPhysicsMotion(enteredLaunch, itokoCns);
    expect(firstBoundTick.players[0]).toMatchObject({ stateNo: 3006, stateTime: 1 });
    expect(firstBoundTick.players[1]).toMatchObject({ hitPause: 99, targetBind: { remaining: 1 } });

    const createdProjectiles: ProjectileState[] = [];
    const launchPass = stepCnsStateRuntime(firstBoundTick, itokoCns, {
      getCnsDocumentForPlayer: () => itokoCns,
      onProjectileCreate: (projectile) => createdProjectiles.push(projectile),
    }).state;
    const released = applyFallbackStageRules(stepCnsPhysicsMotion(launchPass, itokoCns));
    expect(released.players[1].targetBind).toBeUndefined();

    const launch = createdProjectiles.find((projectile) => projectile.animNo === 3066);
    expect(launch).toBeDefined();
    const contact = resolveProjectileHits(released.players, [{
      ...launch!,
      hitBox: { x: -80, y: -80, width: 160, height: 160 },
    }]);
    expect(contact.players[1]).toMatchObject({ stateNo: 5030, vy: -10, hitPause: 17 });

    let airborne = { ...released, players: contact.players };
    const launchY = airborne.players[1].y;
    for (let tick = 0; tick < 18; tick += 1) airborne = stepCnsPhysicsMotion(airborne, itokoCns);
    expect(airborne.players[1].y).toBeLessThan(launchY);
  });

  it('runs the real opening and launch projectiles in production frame order', () => {
    const initial = createInitialGameState(3000, {}, [400, 480]);
    let state: GameState = {
      ...initial,
      players: [{
        ...initial.players[0],
        stateNo: 3005,
        stateHeaderAppliedStateNo: 3005,
        stateTime: 11,
        stateType: 'S',
        moveType: 'A',
        physics: 'S',
        ctrl: false,
        animNo: 3000,
      }, initial.players[1]],
    };
    const contacts: Array<{ frame: number; projectileId: number; stateNo: number; y: number; vy: number; hitPause: number }> = [];
    let minimumTargetY = state.players[1].y;
    let closeFrame = -1;

    for (let frame = 0; frame < 750; frame += 1) {
      const created: ProjectileState[] = [];
      const cns = stepCnsStateRuntime(state, itokoCns, {
        getCnsDocumentForPlayer: () => itokoCns,
        getAnimationDuration: (animNo) => getMugenAnimEndTime(itokoAir, animNo),
        getAnimationTriggerInfo: (animNo, animTime) => getAnimationTriggerInfo(itokoAir, animNo, animTime),
        onProjectileCreate: (projectile) => created.push(withRealProjectileHitBox(projectile)),
      });
      state = applyFallbackStageRules(stepCnsPhysicsMotion({
        ...cns.state,
        projectiles: [...cns.state.projectiles, ...created],
      }, itokoCns));
      const beforeHitPause = state.players[1].hitPause;
      const projectiles = stepProjectiles(state.projectiles).projectiles;
      const collision = resolveProjectileHits(state.players, projectiles);
      state = {
        ...state,
        frame: state.frame + 1,
        players: collision.players,
        projectiles: collision.projectiles,
        hitEvents: collision.hitEvents,
      };
      if (state.players[1].hitPause !== beforeHitPause) {
        contacts.push({
          frame,
          projectileId: state.players[0].targets.at(-1)?.hitDefId ?? -1,
          stateNo: state.players[1].stateNo,
          y: state.players[1].y,
          vy: state.players[1].vy,
          hitPause: state.players[1].hitPause,
        });
      }
      minimumTargetY = Math.min(minimumTargetY, state.players[1].y);
      if (closeFrame < 0 && state.players[1].stateNo === 3007) closeFrame = frame;
    }

    expect(contacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ projectileId: 3065, vy: 15, hitPause: 100 }),
      expect.objectContaining({ projectileId: 3066, vy: -10, hitPause: 17 }),
    ]));
    expect(minimumTargetY).toBeLessThan(230);
    expect(closeFrame).toBeGreaterThanOrEqual(43);
    expect(state.players[0]).toMatchObject({ stateNo: 0, ctrl: true });
    expect(state.players[1]).toMatchObject({
      stateNo: 5120,
      stateOwnerId: 2,
      y: 285,
      vy: 0,
      ctrl: false,
    });
  });

  it('destroys the zipper hook Helper when State 3030 finishes', () => {
    const initial = createInitialGameState();
    const p1 = {
      ...initial.players[0],
      stateNo: 3030,
      stateHeaderAppliedStateNo: 3030,
      stateTime: 95,
      stateType: 'S' as const,
      moveType: 'A' as const,
      physics: 'S' as const,
      animNo: 3030,
    };
    const helpers = spawnHelper(initial.helpers, {
      helperId: 3063,
      rootEntityId: 1,
      parentEntityId: 1,
      ownerCharacterId: 1,
      stateOwnerId: 1,
      animationOwnerId: 1,
      stateNo: 3063,
      x: p1.x,
      y: p1.y,
      facing: p1.facing,
      keyCtrl: false,
      ownPal: false,
      spawnFrame: 0,
      parent: p1,
    }, itokoCns);

    const result = stepCnsStateRuntime({
      ...initial,
      players: [p1, initial.players[1]],
      helpers,
    }, itokoCns, { getCnsDocumentForPlayer: () => itokoCns });

    expect(result.traces[0].executedControllers).toContain('ChangeState');
    expect(result.state.helpers.entries.some((helper) => helper.helperId === 3063)).toBe(false);
    expect(result.traces.find((trace) => trace.entityId === 3)?.executedControllers).toContain('DestroySelf');
  });
});
