import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { getMugenAnimEndTime } from '../animation/AnimationDuration';
import { getAnimationTriggerInfo } from '../animation/AnimationPlayer';
import { enterCnsStateAndRunTimeZero, stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { createInitialGameState } from '../engine/GameState';
import { resolveFallbackHits } from '../engine/FallbackHitResolver';
import { pruneTargets } from '../hitdef/TargetState';
import { applyViewportCameraRules, resolveViewportCamera } from '../engine/ScreenSize';
import { applyFallbackStageRules } from '../engine/FallbackStageRules';
import { spawnHelper } from '../helper/HelperSystem';
import { stepCnsPhysicsMotion } from '../cns/CnsPhysicsStep';
import { applyExplodCreateEvents, stepExplodRuntime, type ExplodCreateEvent } from '../explod/ExplodSystem';
import { resolveExplodRenderFrames } from '../../renderer/canvas2d/ExplodRender';
import { parseAirText } from '../../parser/air/AirParser';
import { parseCnsText } from '../../parser/cns/CnsParser';

describe('real character Helper HitDef integration', () => {
  it('routes colliding itoko bag Helpers through their indefinite HitOverride instead of common itoko hit sprites', async () => {
    const [cnsBytes, airBytes] = await Promise.all([
      readFile('public/chars/itoko/itoko.cns'),
      readFile('public/chars/itoko/itoko.air'),
    ]);
    const cns = parseCnsText(new TextDecoder('shift_jis').decode(cnsBytes));
    const air = parseAirText(new TextDecoder('shift_jis').decode(airBytes));
    const initial = createInitialGameState();
    initial.players = [
      { ...initial.players[0], stateNo: -999 },
      { ...initial.players[1], stateNo: -999 },
    ];
    let helpers = spawnHelper(initial.helpers, {
      helperId: 1101, rootEntityId: 1, parentEntityId: 1, ownerCharacterId: 1,
      stateOwnerId: 1, animationOwnerId: 1, stateNo: 1101, x: 320, y: 200,
      facing: 1, keyCtrl: false, ownPal: true, spawnFrame: -1, parent: initial.players[0],
    }, cns);
    helpers = spawnHelper(helpers, {
      helperId: 1102, rootEntityId: 1, parentEntityId: 1, ownerCharacterId: 1,
      stateOwnerId: 1, animationOwnerId: 1, stateNo: 1101, x: 320, y: 200,
      facing: -1, keyCtrl: false, ownPal: true, spawnFrame: -1, parent: initial.players[0],
    }, cns);
    const activated = stepCnsStateRuntime({ ...initial, helpers }, cns, {
      getAnimationDuration: (animNo) => getMugenAnimEndTime(air, animNo),
      getAnimationTriggerInfo: (animNo, animTime) => getAnimationTriggerInfo(air, animNo, animTime),
    }).state;

    expect(activated.helpers.entries.map((entry) => entry.player.hitOverrides?.[0]?.remaining)).toEqual([-1, -1]);
    const collided = resolveFallbackHits(
      activated,
      air,
      true,
      activated,
      (player, opponent, stateNo) => enterCnsStateAndRunTimeZero(player, opponent, stateNo, cns),
    );

    expect(collided.helpers.entries.map((entry) => ({ stateNo: entry.player.stateNo, animNo: entry.player.animNo })))
      .toEqual([{ stateNo: 1102, animNo: 1113 }, { stateNo: 1102, animNo: 1113 }]);
    expect(collided.helpers.entries.every((entry) => entry.player.life === 1000)).toBe(true);
    expect(collided.hitDiagnosticLines?.filter((line) => line.startsWith('raw.hit_override'))).toHaveLength(2);
    expect(collided.helpers.entries.some((entry) => [5000, 5010, 5020].includes(entry.player.stateNo) || entry.player.animNo === 5030)).toBe(false);
  });

  it('releases a KO target from T-H-M-A Darkness Finger shadow State 3675', async () => {
    const cnsBytes = await readFile('public/chars/T-H-M-A/T-H-M-A/T-H-M-Atyouhi.cns');
    const cns = parseCnsText(new TextDecoder('shift_jis').decode(cnsBytes));
    const initial = createInitialGameState();
    const koTarget = {
      ...initial.players[1], life: 0, stateNo: 3675, stateOwnerId: 1 as const,
      selfStateOwnerId: 2 as const, stateTime: 150, animNo: 3425,
    };
    const owner = pruneTargets({
      ...initial.players[0], stateNo: 3670, stateTime: 200, animNo: 3670,
      targets: [{ playerId: 2, hitDefId: 0, activeHitDefId: 1 }],
    }, [koTarget]);

    const result = stepCnsStateRuntime({
      ...initial,
      players: [owner, koTarget],
    }, cns, {
      getCnsDocumentForPlayer: () => cns,
    }).state;

    expect(result.players[0]).toMatchObject({ stateNo: 3680 });
    expect(result.players[1]).toMatchObject({ stateNo: 5030, stateOwnerId: 2, life: 0 });
  });

  it('carries P2 with the Sekihatenkyoken Helper and creates anim 3030 for both Helper passes', async () => {
    const [cnsBytes, customStateBytes, airBytes] = await Promise.all([
      readFile('public/chars/T-H-M-A/T-H-M-A/T-H-M-Atyouhi.cns'),
      readFile('public/chars/T-H-M-A/T-H-M-A/T-H-M-Atokusyudousa.cns'),
      readFile('public/chars/T-H-M-A/T-H-M-A/T-H-M-A.air'),
    ]);
    const primaryCns = parseCnsText(new TextDecoder('shift_jis').decode(cnsBytes));
    const customStateCns = parseCnsText(new TextDecoder('shift_jis').decode(customStateBytes));
    const cns = {
      states: [...primaryCns.states, ...customStateCns.states],
      metadataSections: [...primaryCns.metadataSections, ...customStateCns.metadataSections],
    };
    const air = parseAirText(new TextDecoder('shift_jis').decode(airBytes));
    let state = createInitialGameState();
    state.players = [
      { ...state.players[0], stateNo: 3020, animNo: 3020, x: 380, vx: 0, vy: 0 },
      { ...state.players[1], stateNo: 0, animNo: 0, x: 580, vx: 0, vy: 0 },
    ];
    state.helpers = spawnHelper(state.helpers, {
      helperId: 3010, rootEntityId: 1, parentEntityId: 1, ownerCharacterId: 1,
      stateOwnerId: 1, animationOwnerId: 1, stateNo: 3030, x: 470, y: state.players[0].y - 88,
      facing: 1, keyCtrl: false, ownPal: true, spawnFrame: -1, parent: state.players[0],
    }, cns);

    const created3030: Extract<ExplodCreateEvent, { type: 'create' }>[] = [];
    let maximumCarryGap = 0;
    let carriedFrames = 0;
    let carriedFacing: 1 | -1 | null = null;
    let carriedVelocity = 0;
    let maximumVisible3030DuringCarry = 0;
    const cameraConfig = { left: -400, right: 400, verticalFollow: 0, tension: 50 };
    state = applyViewportCameraRules(state, 400, 240, undefined, cameraConfig);
    for (let tick = 0; tick < 100 && state.players[1].stateNo !== 271; tick += 1) {
      state = { ...state, frame: tick };
      const events: ExplodCreateEvent[] = [];
      const camera = resolveViewportCamera(state, 400, 240);
      const runtime = stepCnsStateRuntime(state, cns, {
        getAnimationDuration: (animNo) => getMugenAnimEndTime(air, animNo),
        getAnimationTriggerInfo: (animNo, animTime) => getAnimationTriggerInfo(air, animNo, animTime),
        screenWidth: 400,
        cameraX: camera.x,
        screenLeft: camera.x,
        screenRight: camera.x + 400,
        onExplodCreate: (event) => events.push(event),
      });
      state = applyExplodCreateEvents(runtime.state, events);
      created3030.push(...events.filter((event): event is Extract<ExplodCreateEvent, { type: 'create' }> => (
        event.type === 'create' && event.request.animNo === 3030
      )));
      state = stepExplodRuntime(state, () => air);
      state = applyViewportCameraRules(
        applyFallbackStageRules(stepCnsPhysicsMotion(state, cns)),
        400,
        240,
        undefined,
        cameraConfig,
      );
      state = resolveFallbackHits(state, air, true);

      const helper = state.helpers.entries.find((entry) => entry.player.stateNo === 3030 || entry.player.stateNo === 3031);
      if (state.players[1].stateNo === 270 && helper) {
        carriedFrames += 1;
        maximumVisible3030DuringCarry = Math.max(
          maximumVisible3030DuringCarry,
          resolveExplodRenderFrames(state, { airDocument: air }).frames.filter((frame) => frame.entry.animNo === 3030).length,
        );
        carriedFacing ??= state.players[1].facing;
        carriedVelocity = state.players[1].vx;
        maximumCarryGap = Math.max(maximumCarryGap, Math.abs(state.players[1].x - helper.player.x));
      }
    }

    expect(carriedFrames).toBeGreaterThan(20);
    expect(maximumCarryGap).toBeLessThanOrEqual(30);
    expect({ carriedFacing, carriedVelocity }).toEqual({ carriedFacing: -1, carriedVelocity: 8 });
    expect(state.players[1]).toMatchObject({ stateNo: 271, facing: 1, vx: -8 });
    expect(state.players[1].x).toBeGreaterThan(800);
    expect(state.players[1].x).toBeLessThan(810);
    expect(resolveViewportCamera(state, 400, 240).x).toBeLessThan(512);
    expect(maximumVisible3030DuringCarry).toBeGreaterThan(2);
    expect(created3030.length).toBeGreaterThan(2);
    expect(new Set(created3030.map((event) => event.request.owner.entityId)).size).toBe(2);
    expect(state.explods.entries.filter((entry) => entry.animNo === 3030).length).toBeGreaterThan(2);
    expect(resolveExplodRenderFrames(state, { airDocument: air }).frames.filter((frame) => frame.entry.animNo === 3030).length).toBeGreaterThan(2);
  });

  it('activates T-H-M-A State 3320 and damages the opposing root through Helper collision', async () => {
    const [cnsBytes, airBytes] = await Promise.all([
      readFile('public/chars/T-H-M-A/T-H-M-A/T-H-M-Atyouhi.cns'),
      readFile('public/chars/T-H-M-A/T-H-M-A/T-H-M-A.air'),
    ]);
    const cns = parseCnsText(new TextDecoder('shift_jis').decode(cnsBytes));
    const air = parseAirText(new TextDecoder('shift_jis').decode(airBytes));
    const initial = createInitialGameState();
    const helperPlayer = {
      ...initial.players[0], id: 1 as const, x: 370, stateNo: 3320, animNo: 3320,
      stateType: 'A' as const, moveType: 'A' as const, physics: 'N' as const, ctrl: false,
    };
    const source = {
      ...initial,
      players: [
        { ...initial.players[0], stateNo: -999 },
        { ...initial.players[1], stateNo: -999, animNo: 0 },
      ] as typeof initial.players,
      helpers: {
        entries: [{
          entityId: 3, helperId: 3320, rootEntityId: 1 as const, parentEntityId: 1,
          ownerCharacterId: 1 as const, stateOwnerId: 1 as const, animationOwnerId: 1 as const,
          keyCtrl: false, ownPal: false, spawnFrame: -1, player: helperPlayer,
        }],
        nextEntityId: 4,
      },
    };
    const activated = stepCnsStateRuntime(source, cns, {
      getAnimationDuration: (animNo) => getMugenAnimEndTime(air, animNo),
      getAnimationTriggerInfo: (animNo, animTime) => getAnimationTriggerInfo(air, animNo, animTime),
    }).state;

    expect(activated.helpers.entries[0].player.activeHitDef).toMatchObject({ damage: 5, guardDamage: 2 });
    const result = resolveFallbackHits(activated, air, true);
    expect(result.players[1].life).toBe(995);
    expect(result.helpers.entries[0].player.moveContact).toMatchObject({ hit: true, hitCount: 1 });
    expect(result.hitDiagnosticLines).toContain('raw.helper_hit_collision entity=3 helperId=3320 root=p1 target=p2 result=accepted');
  });

  it('runs the T-H-M-A rock Helper TargetState chain from 3725 through root State 3730', async () => {
    const cnsBytes = await readFile('public/chars/T-H-M-A/T-H-M-A/T-H-M-Atyouhi.cns');
    const cns = parseCnsText(new TextDecoder('shift_jis').decode(cnsBytes));
    const initial = createInitialGameState();
    initial.players[0] = { ...initial.players[0], stateNo: 3720, stateTime: 129, x: 220, y: 360 };
    let helpers = spawnHelper(initial.helpers, {
      helperId: 3725, rootEntityId: 1, parentEntityId: 1, ownerCharacterId: 1,
      stateOwnerId: 1, animationOwnerId: 1, stateNo: 3725, x: 220, y: 300,
      facing: 1, keyCtrl: false, ownPal: false, spawnFrame: 0, parent: initial.players[0],
    }, cns);
    helpers = {
      ...helpers,
      entries: helpers.entries.map((helper) => ({
        ...helper,
        player: {
          ...helper.player,
          stateTime: 129,
          targets: [{ playerId: 2, hitDefId: 3725, activeHitDefId: 1 }],
          moveContact: {
            activeHitDefId: 1, contact: true, hit: true, guarded: false, elapsed: 1, hitCount: 1,
          },
        },
      })),
    };

    const helperPass = stepCnsStateRuntime({ ...initial, helpers }, cns);
    expect(helperPass.state.helpers.entries[0].player.stateNo).toBe(3735);
    expect(helperPass.state.players[1]).toMatchObject({ stateNo: 3738, stateOwnerId: 1, stateOwnerEntityId: helpers.entries[0].entityId });

    const rootPass = stepCnsStateRuntime(helperPass.state, cns);
    expect(rootPass.state.players[0].stateNo).toBe(3730);
  });

  it('evaluates the real State 3735 and 3738 AngleDraw scale curves', async () => {
    const cnsBytes = await readFile('public/chars/T-H-M-A/T-H-M-A/T-H-M-Atyouhi.cns');
    const cns = parseCnsText(new TextDecoder('shift_jis').decode(cnsBytes));
    const initial = createInitialGameState();
    initial.players = [
      { ...initial.players[0], stateNo: -999 },
      { ...initial.players[1], stateNo: 3738, stateTime: 25, stateOwnerId: 1 },
    ];
    let helpers = spawnHelper(initial.helpers, {
      helperId: 3725, rootEntityId: 1, parentEntityId: 1, ownerCharacterId: 1,
      stateOwnerId: 1, animationOwnerId: 1, stateNo: 3735, x: 220, y: 300,
      facing: 1, keyCtrl: false, ownPal: false, spawnFrame: -1, parent: initial.players[0],
    }, cns);
    helpers = {
      ...helpers,
      entries: helpers.entries.map((helper) => ({
        ...helper,
        player: { ...helper.player, stateTime: 25 },
      })),
    };

    const result = stepCnsStateRuntime({ ...initial, helpers }, cns);

    expect(result.state.helpers.entries[0].player.drawScale).toEqual({ x: 1.25, y: 1.25 });
    expect(result.state.players[1].drawScale).toEqual({ x: 0.75, y: 0.75 });
    expect(result.traces.find((trace) => trace.entityId === 3)?.executedControllers).toContain('AngleDraw');
    expect(result.traces[1].executedControllers).toContain('AngleDraw');
  });

  it('applies the real State 3735 absolute TargetLifeAdd without owner or target multipliers', async () => {
    const cnsBytes = await readFile('public/chars/T-H-M-A/T-H-M-A/T-H-M-Atyouhi.cns');
    const cns = parseCnsText(new TextDecoder('shift_jis').decode(cnsBytes));
    const initial = createInitialGameState();
    initial.players[0] = { ...initial.players[0], stateNo: -999, attackMultiplier: .5 } as typeof initial.players[0];
    initial.players[1] = { ...initial.players[1], life: 800, defenseMultiplier: .8 } as typeof initial.players[1];
    let helpers = spawnHelper(initial.helpers, {
      helperId: 3725, rootEntityId: 1, parentEntityId: 1, ownerCharacterId: 1,
      stateOwnerId: 1, animationOwnerId: 1, stateNo: 3735, x: 220, y: 300,
      facing: 1, keyCtrl: false, ownPal: false, spawnFrame: -1, parent: initial.players[0],
    }, cns);
    helpers = {
      ...helpers,
      entries: helpers.entries.map((helper) => ({
        ...helper,
        player: {
          ...helper.player,
          stateTime: 700,
          targets: [{ playerId: 2, hitDefId: 3725, activeHitDefId: 1 }],
        },
      })),
    };

    const result = stepCnsStateRuntime({ ...initial, helpers }, cns);
    expect(result.state.players[1].life).toBe(330);
    expect(result.traces.find((trace) => trace.entityId === 3)?.executedControllers).toContain('TargetLifeAdd');
  });

  it('lifts and progressively rotates the real State 3735 ground while movecamera is disabled', async () => {
    const cnsBytes = await readFile('public/chars/T-H-M-A/T-H-M-A/T-H-M-Atyouhi.cns');
    const cns = parseCnsText(new TextDecoder('shift_jis').decode(cnsBytes));
    let state = createInitialGameState();
    state.camera = { x: 280, y: 65, viewportWidth: 400, viewportHeight: 240 };
    state.players = [
      { ...state.players[0], stateNo: 3730, stateTime: 0, x: 480, y: 400 },
      { ...state.players[1], stateNo: 3738, stateTime: 0, stateOwnerId: 1, x: 480, y: 340 },
    ];
    state.helpers = spawnHelper(state.helpers, {
      helperId: 3725, rootEntityId: 1, parentEntityId: 1, ownerCharacterId: 1,
      stateOwnerId: 1, animationOwnerId: 1, stateNo: 3735, x: 480, y: 360,
      facing: 1, keyCtrl: false, ownPal: true, spawnFrame: -1, parent: state.players[0],
    }, cns);
    state.helpers = {
      ...state.helpers,
      entries: state.helpers.entries.map((helper) => ({
        ...helper,
        player: {
          ...helper.player,
          targets: [{ playerId: 2, hitDefId: 3725, activeHitDefId: 1 }],
        },
      })),
    };

    let finalHelperControllers: string[] = [];
    let firstTickGroundY = 0;
    for (let tick = 0; tick < 430; tick += 1) {
      const runtime = stepCnsStateRuntime(state, cns);
      state = runtime.state;
      finalHelperControllers = runtime.traces.find((trace) => trace.entityId === 3)?.executedControllers ?? [];
      state = stepCnsPhysicsMotion(state, cns);
      state = applyViewportCameraRules(state, 400, 240, undefined, { left: -400, right: 400, verticalFollow: 1 });
      if (tick === 0) firstTickGroundY = state.helpers.entries[0].player.y;
    }

    const ground = state.helpers.entries.find((helper) => helper.helperId === 3725)?.player;
    expect(ground).toBeDefined();
    expect(firstTickGroundY).toBeCloseTo(360);
    expect(state.players[0].y - ground!.y).toBeCloseTo(40);
    expect(ground!.y).toBeLessThan(200);
    expect(ground!.x).toBeGreaterThan(480);
    expect(finalHelperControllers).toContain('AngleAdd');
    expect((ground as typeof ground & { angle?: number })!.angle).toBeLessThan(-10);
    expect(ground!.drawAngle).toBeLessThan(-10);
    expect(state.players[0].y).toBeLessThan(200);
    expect(state.players[1].y).toBeLessThan(200);
    expect(resolveViewportCamera(state, 400, 240)).toEqual({ x: 280, y: 65 });
  });
});
