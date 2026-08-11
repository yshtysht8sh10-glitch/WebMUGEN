import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parseAirText } from '../../parser/air/AirParser';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { getAnimationTriggerInfo } from '../animation/AnimationPlayer';
import { stepCnsPhysicsMotion } from '../cns/CnsPhysicsStep';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { createInitialGameState } from '../engine/GameState';
import { applyViewportCameraRules, resolveViewportCamera } from '../engine/ScreenSize';
import { applyExplodControllerEvents, synchronizeBoundExplodPositions, type ExplodControllerEvent } from '../explod/ExplodSystem';

describe('T-H-M-A Darkness Finger effect coordinates (#109)', () => {
  it('keeps State 3630 full-screen background at the back edge so its purple subtractive lightning remains visible', async () => {
    const { cns, air } = await loadCharacter();
    const initial = createInitialGameState();
    const events: ExplodControllerEvent[] = [];
    stepCnsStateRuntime({
      ...initial,
      players: [{
        ...initial.players[0],
        x: 250,
        facing: 1,
        stateNo: 3630,
        stateTime: 0,
        animNo: 3630,
        animTime: 0,
        stateType: 'A',
        moveType: 'A',
        physics: 'N',
        stateHeaderAppliedStateNo: 3630,
      }, initial.players[1]],
    }, cns, {
      screenWidth: 320,
      getAnimationTriggerInfo: (animNo, time) => getAnimationTriggerInfo(air, animNo, time),
      onExplodCreate: (event) => events.push(event),
    });

    const background = events.find((event) => event.type === 'create' && event.request.animNo === 3603);
    expect(background).toMatchObject({
      type: 'create',
      request: {
        postype: 'back',
        coordinateSpace: 'screen',
        position: { x: 0, y: 0 },
        spritePriority: 3,
      },
    });
    const action = air.actions.find((candidate) => candidate.actionNo === 3603);
    expect(action?.elements[0]).toMatchObject({ groupNo: 3602, imageNo: 1 });
  });

  it('keeps the State 3900 cut-in Helper behind both root players', async () => {
    const { cns, air } = await loadCharacter();
    const initial = createInitialGameState();
    const state = stepCnsStateRuntime({
      ...initial,
      players: [{
        ...initial.players[0],
        stateNo: 3900,
        stateTime: 5,
        animNo: 3900,
        animTime: 5,
        sprPriority: 2,
        stateHeaderAppliedStateNo: 3900,
      }, initial.players[1]],
    }, cns, {
      gameTime: 100,
      getAnimationTriggerInfo: (animNo, time) => getAnimationTriggerInfo(air, animNo, time),
    }).state;

    const cutIn = state.helpers.entries.find((helper) => helper.helperId === 1000);
    expect(cutIn).toMatchObject({
      player: { stateNo: 3201, animNo: 3103, sprPriority: 0 },
    });
    expect(cutIn?.player.sprPriority).toBeLessThan(state.players[0].sprPriority ?? 0);
  });

  it('places the State 3930 portrait behind both players and its accent Explods in front', async () => {
    const { cns, air } = await loadCharacter();
    const initial = createInitialGameState();
    const events: ExplodControllerEvent[] = [];
    const stepped = stepCnsStateRuntime({
      ...initial,
      players: [{
        ...initial.players[0],
        stateNo: 3930,
        stateTime: 0,
        animNo: 3920,
        animTime: 0,
        sprPriority: -3,
        stateHeaderAppliedStateNo: undefined,
      }, initial.players[1]],
    }, cns, {
      getAnimationTriggerInfo: (animNo, time) => getAnimationTriggerInfo(air, animNo, time),
      onExplodCreate: (event) => events.push(event),
    }).state;
    const state = applyExplodControllerEvents(stepped, events);

    const portrait = state.explods.entries.find((entry) => entry.animNo === 3901);
    const accents = state.explods.entries.filter((entry) => [3914, 3926, 3927].includes(entry.animNo));
    expect(state.players[0].sprPriority).toBe(2);
    expect(state.players[1].sprPriority ?? 0).toBeGreaterThan(portrait?.spritePriority ?? Number.MAX_SAFE_INTEGER);
    expect(portrait).toMatchObject({ spritePriority: -1, onTop: false });
    expect(accents.length).toBeGreaterThan(0);
    expect(accents.every((entry) => entry.spritePriority > (state.players[0].sprPriority ?? 0))).toBe(true);
  });

  it('honors State 3920 Width before the wall transition and leaves the bound impact at the edge', async () => {
    const { cns, air } = await loadCharacter();
    const initial = createInitialGameState();
    let state = stepCnsStateRuntime({
      ...initial,
      camera: { x: 512, y: 65, viewportWidth: 400, viewportHeight: 240 },
      players: [{
        ...initial.players[0],
        x: 822,
        facing: 1,
        stateNo: 3920,
        stateTime: 1,
        animNo: 3920,
        animTime: 1,
        stateType: 'S',
        moveType: 'A',
        physics: 'N',
      }, {
        ...initial.players[1],
        x: 902,
        screenBound: { value: false, moveCameraX: false, moveCameraY: false },
      }],
    }, cns, {
      screenWidth: 400,
      cameraX: 512,
      screenLeft: 512,
      screenRight: 912,
      getAnimationTriggerInfo: (animNo, time) => getAnimationTriggerInfo(air, animNo, time),
    }).state;

    expect(state.players[0]).toMatchObject({
      stateNo: 3930,
      widthOverride: {
        edge: { front: 70, back: 0 },
        player: { front: 0, back: 0 },
      },
    });

    const events: ExplodControllerEvent[] = [];
    state = stepCnsStateRuntime(state, cns, {
      screenWidth: 400,
      cameraX: 512,
      screenLeft: 512,
      screenRight: 912,
      getAnimationTriggerInfo: (animNo, time) => getAnimationTriggerInfo(air, animNo, time),
      onExplodCreate: (event) => events.push(event),
    }).state;
    state = applyExplodControllerEvents(state, events);
    state = applyViewportCameraRules(state, 400, 240, undefined, { left: -400, right: 400, verticalFollow: 0 });

    const camera = resolveViewportCamera(state, 400, 240);
    const impact = state.explods.entries.find((entry) => entry.animNo === 10045);
    expect(state.players[0].x + 70).toBeLessThanOrEqual(camera.x + 400 - 4);
    expect(impact?.position.x).toBe(state.players[0].x + 80);
    expect(impact?.position.x).toBeLessThanOrEqual(camera.x + 400);
  });

  it('creates the State 3940 screen beam and turns State 3935 toward the opposite wall', async () => {
    const { cns, air } = await loadCharacter();
    const initial = createInitialGameState();
    const events: ExplodControllerEvent[] = [];
    let state = stepCnsStateRuntime({
      ...initial,
      players: [{
        ...initial.players[0],
        stateNo: 3940,
        stateTime: 20,
        animNo: 3940,
        animTime: 20,
        facing: 1,
        targets: [{ playerId: 2, hitDefId: 1, activeHitDefId: 1 }],
      }, {
        ...initial.players[1],
        stateNo: 3936,
        stateTime: 10,
        facing: -1,
      }],
    }, cns, {
      screenWidth: 320,
      cameraY: 65,
      getAnimationTriggerInfo: (animNo, time) => getAnimationTriggerInfo(air, animNo, time),
      onExplodCreate: (event) => events.push(event),
    }).state;

    const beams = events.filter((event) => event.type === 'create' && [3941, 3942].includes(event.request.animNo));
    expect(beams).toHaveLength(2);
    expect(beams.every((event) => event.type === 'create'
      && event.request.coordinateSpace === 'screen'
      && event.request.position.x === 0
      && event.request.position.y === 30)).toBe(true);
    expect(state.players[1]).toMatchObject({ stateNo: 3935, stateTime: 0, facing: 1 });

    state = stepCnsStateRuntime({
      ...state,
      players: [
        { ...state.players[0], stateTime: 22, animTime: 22 },
        { ...state.players[1], stateTime: 2, animTime: 2 },
      ],
    }, cns, {
      screenWidth: 320,
      cameraY: 65,
      getAnimationTriggerInfo: (animNo, time) => getAnimationTriggerInfo(air, animNo, time),
    }).state;
    expect(state.players[1]).toMatchObject({ facing: 1, vx: -98.5, vy: -2.925 });
  });

  it.each([
    [1, 1, 320, 160],
    [1, 1, 400, 120],
    [2, -1, 320, 160],
    [2, -1, 400, 120],
  ] as const)('keeps P%s bound Explods aligned after motion at width %s', async (ownerId, facing, screenWidth, cameraX) => {
    const { cns, air } = await loadCharacter();
    const initial = createInitialGameState();
    const index = ownerId - 1;
    const owner = {
      ...initial.players[index],
      stateNo: 3910,
      stateTime: 0,
      animNo: 3910,
      animTime: 0,
      facing,
      stateType: 'S' as const,
      moveType: 'A' as const,
      physics: 'N' as const,
      ctrl: false,
    };
    const players = [...initial.players] as typeof initial.players;
    players[index] = owner;
    const events: ExplodControllerEvent[] = [];
    let state = stepCnsStateRuntime({ ...initial, players }, cns, {
      screenWidth,
      cameraX,
      cameraY: 45,
      getAnimationTriggerInfo: (animNo, time) => getAnimationTriggerInfo(air, animNo, time),
      onExplodCreate: (event) => events.push(event),
    }).state;
    state = applyExplodControllerEvents(state, events);
    state = stepCnsPhysicsMotion(state, cns);
    state = synchronizeBoundExplodPositions(state);

    const finalOwner = state.players[index];
    const hand = state.explods.entries.find((entry) => entry.owner.rootPlayerId === ownerId && entry.animNo === 3911);
    expect(hand).toMatchObject({
      position: { x: finalOwner.x - 33 * facing, y: finalOwner.y - 82 },
      coordinateSpace: 'stage',
    });
  });

  it.each([
    [1, 1, 400, 120, 20],
    [2, -1, 400, 120, 620],
  ] as const)('places P%s back-edge Helper in camera-relative world space', async (ownerId, facing, screenWidth, cameraX, expectedX) => {
    const { cns, air } = await loadCharacter();
    const initial = createInitialGameState();
    const index = ownerId - 1;
    const players = [...initial.players] as typeof initial.players;
    players[index] = {
      ...players[index],
      stateNo: 3900,
      stateTime: 5,
      animNo: 3900,
      animTime: 5,
      facing,
      ctrl: false,
    };
    const state = stepCnsStateRuntime({ ...initial, players }, cns, {
      screenWidth,
      cameraX,
      cameraY: 45,
      getAnimationTriggerInfo: (animNo, time) => getAnimationTriggerInfo(air, animNo, time),
    }).state;
    const helper = state.helpers.entries.find((entry) => entry.rootEntityId === ownerId && entry.helperId === 1000);

    expect(helper?.player).toMatchObject({ x: expectedX, y: 185, facing });
  });
});

let loadedCharacter: Promise<{ cns: ReturnType<typeof parseCnsText>; air: ReturnType<typeof parseAirText> }> | undefined;

function loadCharacter(): Promise<{ cns: ReturnType<typeof parseCnsText>; air: ReturnType<typeof parseAirText> }> {
  loadedCharacter ??= Promise.all([
    readFile('public/chars/T-H-M-A/T-H-M-A/T-H-M-Atyouhi.cns'),
    readFile('public/chars/T-H-M-A/T-H-M-A/T-H-M-A.air'),
  ]).then(([cnsBytes, airBytes]) => {
    const decoder = new TextDecoder('shift_jis');
    return { cns: parseCnsText(decoder.decode(cnsBytes)), air: parseAirText(decoder.decode(airBytes)) };
  });
  return loadedCharacter;
}
