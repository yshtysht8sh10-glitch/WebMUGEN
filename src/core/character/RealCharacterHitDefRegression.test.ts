import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type { AirAction } from '../../parser/air/AirTypes';
import type { CnsDocument, CnsStateController, CnsStateDefinition } from '../../mugen/common/cnsTypes';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { stepCnsPhysicsMotion } from '../cns/CnsPhysicsStep';
import { analyzeCnsCoverage } from '../cns/CnsCoverageDiagnostics';
import { getMugenAnimEndTime } from '../animation/AnimationDuration';
import { getAnimationTriggerInfo, getCurrentAnimationElement } from '../animation/AnimationPlayer';
import { createInitialGameState } from '../engine/GameState';
import { applyFallbackHitRecovery } from '../engine/FallbackHitRecovery';
import { resolveFallbackHits } from '../engine/FallbackHitResolver';
import { createInitialRoundState, stepRoundState } from '../engine/RoundState';
import type { GameState } from '../engine/types';
import { loadCharacterFromDef, type CharacterAssetFetcher } from './CharacterLoader';
import { HitPauseCommandBuffer } from '../../input/HitPauseCommandBuffer';

declare const process: { env: Record<string, string | undefined>; platform: string };

class FakeImageData {
  constructor(public data: Uint8ClampedArray, public width: number, public height: number) {}
}

(globalThis as unknown as { ImageData: typeof ImageData }).ImageData = FakeImageData as unknown as typeof ImageData;

const configuredDefs: string[] = (process.env.WEBMUGEN_REAL_CHARACTER_DEFS ?? '')
  .split(process.platform === 'win32' ? ';' : ':')
  .map((value) => value.trim())
  .filter(Boolean);
const realCharacterDescribe = configuredDefs.length >= 3 ? describe : describe.skip;

realCharacterDescribe('WinMUGEN real-character HitDef regression', () => {
  it('loads at least three configured characters and audits observed Matrix items', async () => {
    const matrixMd = (await readFile('docs/webmugen/winmugen-compatibility-matrix.md', 'utf8')).toLowerCase();
    const matrixHtml = (await readFile('docs/webmugen/winmugen-compatibility-matrix.html', 'utf8')).toLowerCase();
    const characters = await Promise.all(configuredDefs.map(async (defPath) => ({
      defPath,
      assets: await loadCharacterFromDef(normalizePath(defPath), createFileSystemFetcher()),
    })));
    expect(characters.length).toBeGreaterThanOrEqual(3);

    const observedHitDefParams = new Set<string>();
    const missingControllers = new Set<string>();
    const missingTriggers = new Set<string>();
    const scenarioCoverage = {
      light: false, medium: false, hard: false, airHit: false, multiHit: false, hitConfirm: false,
      guard: false, downRecovery: false, juggle: false, target: false, customState: false, ko: false,
    };
    for (const { assets } of characters) {
      const hitDefs = findHitDefs(assets.cns);
      expect(hitDefs.length).toBeGreaterThan(0);
      expect(assets.air.actions.some((action) => action.elements.some((element) => element.clsn1.length > 0))).toBe(true);
      for (const { controller } of hitDefs) {
        for (const name of Object.keys(controller.params)) observedHitDefParams.add(name.toLowerCase());
        const animType = String(controller.params.animtype ?? '').toLowerCase();
        scenarioCoverage.light ||= animType === 'light';
        scenarioCoverage.medium ||= animType === 'medium';
        scenarioCoverage.hard ||= animType === 'hard';
        scenarioCoverage.airHit ||= controller.params['air.velocity'] !== undefined;
        scenarioCoverage.guard ||= controller.params.guardflag !== undefined;
        scenarioCoverage.downRecovery ||= controller.params.fall !== undefined || controller.params['down.hittime'] !== undefined;
        scenarioCoverage.customState ||= controller.params.p1stateno !== undefined || controller.params.p2stateno !== undefined;
        scenarioCoverage.ko ||= controller.params.kill !== undefined || controller.params.damage !== undefined;
      }
      scenarioCoverage.multiHit ||= assets.cns.states.some((state) => state.controllers.filter((controller) => controller.type.toLowerCase() === 'hitdef').length > 1);
      scenarioCoverage.hitConfirm ||= assets.cns.states.some((state) => state.controllers.some((controller) =>
        controller.type.toLowerCase() === 'changestate' && controller.triggers.some((trigger) => /move(?:hit|contact)/i.test(trigger.expression))));
      scenarioCoverage.juggle ||= assets.cns.states.some((state) => state.juggle !== undefined);
      scenarioCoverage.target ||= assets.cns.states.some((state) => state.controllers.some((controller) => controller.type.toLowerCase().startsWith('target')));
      const coverage = analyzeCnsCoverage(assets.cns);
      for (const controller of coverage.controllers) {
        if (!matrixMd.includes(`| ${controller.name.toLowerCase()} |`)) missingControllers.add(controller.name.toLowerCase());
        if (!matrixHtml.includes(`${controller.name.toLowerCase()}:`)) missingControllers.add(controller.name.toLowerCase());
      }
      for (const trigger of coverage.triggers) {
        const name = trigger.name.toLowerCase();
        if (!matrixHasTrigger(matrixMd, matrixHtml, name)) missingTriggers.add(name);
      }
    }

    expect([...missingControllers], 'Matrix missing real-character controllers').toEqual([]);
    expect([...missingTriggers], 'Matrix missing real-character triggers/redirects').toEqual([]);
    expect(scenarioCoverage, 'configured characters must cover the Issue #23 structural scenarios').toEqual({
      light: true, medium: true, hard: true, airHit: true, multiHit: true, hitConfirm: true,
      guard: true, downRecovery: true, juggle: true, target: true, customState: true, ko: true,
    });
    const missingParameters: string[] = [];
    for (const parameter of observedHitDefParams) {
      if (!matrixMd.includes(`| ${parameter} |`) || !matrixHtml.includes(parameter)) missingParameters.push(parameter);
    }
    expect(missingParameters.sort(), 'Matrix missing real-character HitDef parameters').toEqual([]);
  }, 120_000);

  it.each([1, 2] as const)('traces activate through recovery for P%i with each real character HitDef/AIR', async (attackerId) => {
    for (const defPath of configuredDefs) {
      const assets = await loadCharacterFromDef(normalizePath(defPath), createFileSystemFetcher());
      const attack = findCollisionElement(assets.air.actions, 'attack');
      const body = findCollisionElement(assets.air.actions, 'body');
      expect(attack).not.toBeNull();
      expect(body).not.toBeNull();
      for (const scenario of [
        { mode: 'ground' as const, facing: 1 as const },
        { mode: 'ground' as const, facing: -1 as const },
        { mode: 'air' as const, facing: 1 as const },
        { mode: 'guard' as const, facing: 1 as const },
        { mode: 'ko' as const, facing: 1 as const },
        { mode: 'edge' as const, facing: 1 as const },
      ]) {
        const { mode, facing } = scenario;
        const activated = activateRealHitDef(assets.cns, attackerId, mode);
        const contacted = findContact(activated, assets.air, attackerId, attack!, body!, mode, facing);
        expect(contacted, `${defPath} P${attackerId} ${mode} facing=${facing} did not produce contact`).not.toBeNull();
        let recovered = contacted!;
        for (let frame = 0; frame < 180 && recovered.players[attackerId === 1 ? 1 : 0].hitStun; frame += 1) {
          recovered = applyFallbackHitRecovery({
            ...recovered,
            players: recovered.players.map((player) => ({ ...player, hitPause: 0 })) as GameState['players'],
          });
        }
        const diagnostics = recovered.hitDiagnosticLines?.join('\n') ?? '';
        expect(diagnostics).toContain('raw.hitdef_activate');
        expect(diagnostics).toContain('raw.hit_collision');
        expect(diagnostics).toContain(mode === 'guard' ? 'result=guarded' : 'result=hit');
        expect(diagnostics).toContain('raw.hit_damage');
        expect(diagnostics).toContain(mode === 'guard' ? 'raw.guard_reaction' : 'raw.hit_reaction');
        if (mode !== 'guard') expect(diagnostics).toContain(`attackerFacing=${facing}`);
        expect(diagnostics).toContain('event=end');
        if (mode === 'ko') expect(recovered.players[attackerId === 1 ? 1 : 0].life, `${defPath} P${attackerId} KO`).toBe(0);
      }
    }
  }, 120_000);
});

describe('T-H-M-A State 215 launch regression', () => {
  it('uses the AnimElem trigger frame for collision after physics advances AnimTime', async () => {
    const assets = await loadCharacterFromDef('public/chars/T-H-M-A/T-H-M-A/T-H-M-A.def', createFileSystemFetcher());
    const initial = createInitialGameState();
    const state: GameState = {
      ...initial,
      players: [
        {
          ...initial.players[0],
          x: 333.2,
          stateNo: 215,
          stateHeaderAppliedStateNo: 215,
          stateTime: 5,
          stateType: 'S',
          moveType: 'A',
          physics: 'S',
          ctrl: false,
          animNo: 215,
          animTime: 5,
          fvars: { 1: 1 },
        },
        { ...initial.players[1], x: 420, animNo: 0, animTime: 0 },
      ],
    };
    const runtimeInput = {
      hitDiagnostics: true,
      getAnimationDuration: (animNo: number) => getMugenAnimEndTime(assets.air, animNo),
      getAnimationElementNo: (animNo: number, animTime: number) => {
        const element = getCurrentAnimationElement(assets.air, animNo, animTime);
        return element ? element.elementIndex + 1 : null;
      },
      getAnimationTriggerInfo: (animNo: number, animTime: number) => getAnimationTriggerInfo(assets.air, animNo, animTime),
    };

    const beforeAttackElement = stepCnsStateRuntime(state, assets.cns, runtimeInput).state;
    const attackElement = stepCnsPhysicsMotion(beforeAttackElement, assets.cns);
    const earlyCollision = resolveFallbackHits(attackElement, assets.air, true, beforeAttackElement);
    expect(earlyCollision.hitEvents).toHaveLength(0);
    expect(attackElement.players[0].animTime).toBe(6);

    const activated = stepCnsStateRuntime(earlyCollision, assets.cns, runtimeInput).state;
    expect(activated.players[0].activeHitDef?.hitId).toBe(215);
    const afterPhysics = stepCnsPhysicsMotion(activated, assets.cns);
    const contacted = resolveFallbackHits(afterPhysics, assets.air, true, activated);

    expect(afterPhysics.players[0].animTime).toBe(7);
    expect(contacted.hitEvents).toHaveLength(1);
    expect(contacted.players[1].life).toBe(940);
    expect(contacted.hitDiagnosticLines?.join('\n')).toContain('attackerElem=3');
  });

  it.each([
    { mode: 'ground' as const, attackerId: 1 as const, facing: 1 as const, ko: false },
    { mode: 'air' as const, attackerId: 2 as const, facing: -1 as const, ko: false },
    { mode: 'edge' as const, attackerId: 1 as const, facing: -1 as const, ko: false },
    { mode: 'ko' as const, attackerId: 1 as const, facing: 1 as const, ko: true },
    { mode: 'ko' as const, attackerId: 2 as const, facing: -1 as const, ko: true },
  ])('audits State 215 $mode chain for P$attackerId facing=$facing', async ({ mode, attackerId, facing, ko }) => {
    const assets = await loadCharacterFromDef('public/chars/T-H-M-A/T-H-M-A/T-H-M-A.def', createFileSystemFetcher());
    const targetIndex = attackerId === 1 ? 1 : 0;
    const activated = activateState215HitDef(assets.cns, attackerId);
    expect(activated.players[attackerId - 1].activeHitDef?.fall?.enabled).toBe(true);
    expect(activated.players[attackerId - 1].activeHitDef?.fall?.recoverTime).toBe(100);

    const attack = findActionCollisionElement(assets.air.actions, 215, 'attack');
    const body = findCollisionElement(assets.air.actions, 'body');
    expect(attack).not.toBeNull();
    expect(body).not.toBeNull();

    const contacted = findContact(activated, assets.air, attackerId, attack!, body!, mode, facing);
    expect(contacted, `State 215 ${mode} P${attackerId} facing=${facing} contact`).not.toBeNull();
    if (ko) expect(contacted!.players[targetIndex].life, contacted!.hitDiagnosticLines?.join('\n')).toBe(0);
    let state = contacted!;
    let round = createInitialRoundState();
    round = { ...round, phase: 'fight' };
    const visited: number[] = [state.players[targetIndex].stateNo];
    const transitions: string[] = [];
    let sawGetup = false;
    for (let frame = 0; frame < 240; frame += 1) {
      const cns = stepCnsStateRuntime(state, assets.cns, {
        hitDiagnostics: true,
        getAnimationDuration: (animNo) => getMugenAnimEndTime(assets.air, animNo),
        getAnimationElementNo: (animNo, animTime) => {
          const element = getCurrentAnimationElement(assets.air, animNo, animTime);
          return element ? element.elementIndex + 1 : null;
        },
        getAnimationTriggerInfo: (animNo, animTime) => getAnimationTriggerInfo(assets.air, animNo, animTime),
        roundState: round.phase === 'fight' ? 2 : 3,
        roundNo: round.roundNo,
        matchOver: round.phase === 'ko' || round.phase === 'timeOver',
        roundWinner: round.winner,
        roundEndReason: round.endReason,
      }).state;
      transitions.push(...(cns.players[targetIndex].hitDiagnosticLines ?? []).filter((line) => line.includes('from=') && line.includes('to=')));
      const moved = stepCnsPhysicsMotion(cns, assets.cns);
      state = applyFallbackHitRecovery(moved, true);
      round = stepRoundState(round, state);
      visited.push(cns.players[targetIndex].stateNo, moved.players[targetIndex].stateNo, state.players[targetIndex].stateNo);
      if (state.players[targetIndex].stateNo === 5120) sawGetup = true;
      if (ko ? state.players[targetIndex].stateNo === 5150 : sawGetup && state.players[targetIndex].stateNo === 0) break;
    }

    const diagnostics = state.hitDiagnosticLines?.join('\n') ?? '';
    expect(diagnostics).toContain('hitDefId=215');
    expect(diagnostics).toContain('fall=1');
    expect(visited).toContain(mode === 'air' ? 5020 : 5000);
    expect(visited).toContain(5035);
    expect(visited).toContain(5050);
    expect(transitions.join('\n')).toContain('to=5100');
    expect(visited).toContain(5110);
    if (ko) {
      expect(visited, `final=${JSON.stringify({ player: state.players[targetIndex], round })}`).toContain(5150);
      expect(visited).not.toContain(5120);
      expect(state.players[targetIndex]).toMatchObject({ life: 0, stateNo: 5150, ctrl: false });
      expect(round).toMatchObject({ phase: 'ko', winner: attackerId, endReason: 'ko' });
    } else {
      expect(visited).toContain(5120);
      expect(visited).not.toContain(5200);
      expect(visited).not.toContain(5210);
      expect(state.players[targetIndex]).toMatchObject({ stateNo: 0, stateType: 'S', moveType: 'I' });
    }
  }, 30_000);
});

describe('T-H-M-A State 232 full-width velocity regression', () => {
  it('keeps full-width punctuation and spacing out of CNS syntax', async () => {
    const assets = await loadCharacterFromDef('public/chars/T-H-M-A/T-H-M-A/T-H-M-A.def', createFileSystemFetcher());
    const backHitSprite = assets.sprites?.sprites.get('5200,1');
    expect(backHitSprite, 'T-H-M-A Anim 5030 sprite 5200,1 is missing').toBeDefined();
    expect(Array.from(backHitSprite!.imageData.data).some((value, index) => index % 4 === 3 && value !== 0),
      'T-H-M-A Anim 5030 sprite 5200,1 has no visible pixels').toBe(true);
    const state232 = assets.cns.states.find((state) => state.stateNo === 232);
    const hitDef = state232?.controllers.find((controller) =>
      controller.type.trim().toLowerCase() === 'hitdef' && Number(controller.params.id) === 232);
    if (!state232 || !hitDef) throw new Error('T-H-M-A State 232 HitDef not found');

    expect(hitDef.params['ground.velocity']).toBeUndefined();
    expect(hitDef.params['ground.velocity　']).toBe('　-3-fvar(2)*2，-5');

    const forcedCns: CnsDocument = {
      metadataSections: assets.cns.metadataSections,
      states: [{ ...state232, controllers: [{ ...hitDef, triggers: [{ name: 'trigger1', expression: '1' }] }] }],
    };
    const initial = createInitialGameState();
    const activated = stepCnsStateRuntime({
      ...initial,
      players: [{
        ...initial.players[0], x: 400, stateNo: 232, stateType: 'S', moveType: 'A', physics: 'S', ctrl: false,
        animNo: 232, fvars: { 1: 1, 2: 0 },
      }, initial.players[1]],
    }, forcedCns, { hitDiagnostics: true }).state;

    expect(activated.players[0].activeHitDef).toMatchObject({
      animType: 'Light', groundType: undefined, groundVelocity: { x: -3.5, y: 0 },
    });

    const attack = findActionCollisionElement(assets.air.actions, 232, 'attack');
    const body = findCollisionElement(assets.air.actions, 'body');
    expect(attack).not.toBeNull();
    expect(body).not.toBeNull();
    let contacted = findContact(activated, assets.air, 1, attack!, body!, 'ground', 1);
    expect(contacted, contacted?.hitDiagnosticLines?.join('\n')).not.toBeNull();
    expect(contacted!.players[1]).toMatchObject({ stateNo: 5000, animNo: 5000, hitVelY: 0, stateType: 'S' });

    while (contacted!.players[1].hitPause > 0) contacted = stepCnsPhysicsMotion(contacted!, assets.cns);
    const resumed = stepCnsStateRuntime(contacted!, assets.cns, {
      getAnimationDuration: (animNo) => getMugenAnimEndTime(assets.air, animNo),
      getAnimationTriggerInfo: (animNo, animTime) => getAnimationTriggerInfo(assets.air, animNo, animTime),
      hitDiagnostics: true,
    }).state;

    expect(resumed.players[1].stateType).toBe('S');
    expect(resumed.players[1].stateNo).not.toBe(5030);
  });
});

describe('T-H-M-A State 700 throw regression', () => {
  it('accepts hitflag M- against a neutral target and enters both custom throw states', async () => {
    const assets = await loadCharacterFromDef('public/chars/T-H-M-A/T-H-M-A/T-H-M-A.def', createFileSystemFetcher());
    const state700 = assets.cns.states.find((state) => state.stateNo === 700);
    const hitDef = state700?.controllers.find((controller) => controller.type.toLowerCase() === 'hitdef');
    if (!state700 || !hitDef) throw new Error('T-H-M-A State 700 HitDef not found');
    const forcedCns: CnsDocument = {
      ...assets.cns,
      states: [
        { ...state700, controllers: [{ ...hitDef, triggers: [{ name: 'trigger1', expression: '1' }] }] },
        ...assets.cns.states.filter((state) => state.stateNo !== 700),
      ],
    };
    const initial = createInitialGameState();
    const activated = stepCnsStateRuntime({
      ...initial,
      players: [
        { ...initial.players[0], stateNo: 700, stateType: 'S', moveType: 'A', physics: 'S', ctrl: false, animNo: 700 },
        initial.players[1],
      ],
    }, forcedCns, { hitDiagnostics: true }).state;
    expect(activated.players[0].activeHitDef?.hitFlag).toBe('M-');

    const attack = findActionCollisionElement(assets.air.actions, 700, 'attack');
    const body = findCollisionElement(assets.air.actions, 'body');
    expect(attack).not.toBeNull();
    expect(body).not.toBeNull();
    const contacted = findContact(activated, assets.air, 1, attack!, body!, 'ground', 1);

    expect(contacted, contacted?.hitDiagnosticLines?.join('\n')).not.toBeNull();
    expect(contacted!.players[0].stateNo).toBe(701);
    expect(contacted!.players[1].stateNo).toBe(711);
  });
});

describe('T-H-M-A crouching and jumping Y collision regression', () => {
  it.each([
    { stateNo: 410, stateType: 'C' as const, physics: 'C' as const, y: 285 },
    { stateNo: 610, stateType: 'A' as const, physics: 'A' as const, y: 255 },
  ])('resolves State $stateNo AnimElem 5 against a standing target', async ({ stateNo, stateType, physics, y }) => {
    const assets = await loadCharacterFromDef('public/chars/T-H-M-A/T-H-M-A/T-H-M-A.def', createFileSystemFetcher());
    const stateDef = assets.cns.states.find((candidate) => candidate.stateNo === stateNo);
    expect(stateDef).toBeDefined();
    const focusedCns: CnsDocument = { metadataSections: assets.cns.metadataSections, states: [stateDef!] };
    const attackTime = findActionElementStart(assets.air.actions, stateNo, 5);
    expect(attackTime).not.toBeNull();
    const initial = createInitialGameState();
    const state: GameState = {
      ...initial,
      players: [{
        ...initial.players[0],
        x: 350,
        y,
        stateNo,
        stateHeaderAppliedStateNo: stateNo,
        stateTime: attackTime!,
        stateType,
        moveType: 'A',
        physics,
        ctrl: false,
        animNo: stateNo,
        animTime: attackTime!,
        fvars: { 1: 1, 2: 0 },
      }, {
        ...initial.players[1],
        x: 390,
        animNo: 0,
        animTime: 0,
      }],
    };
    const runtimeInput = {
      hitDiagnostics: true,
      getAnimationDuration: (animNo: number) => getMugenAnimEndTime(assets.air, animNo),
      getAnimationElementNo: (animNo: number, animTime: number) => {
        const element = getCurrentAnimationElement(assets.air, animNo, animTime);
        return element ? element.elementIndex + 1 : null;
      },
      getAnimationTriggerInfo: (animNo: number, animTime: number) => getAnimationTriggerInfo(assets.air, animNo, animTime),
    };

    const activated = stepCnsStateRuntime(state, focusedCns, runtimeInput).state;
    const afterPhysics = stepCnsPhysicsMotion(activated, focusedCns);
    const contacted = resolveFallbackHits(afterPhysics, assets.air, true, activated);

    expect(activated.players[0].activeHitDef, activated.players[0].hitDiagnosticLines?.join('\n')).not.toBeNull();
    expect(contacted.hitEvents, contacted.hitDiagnosticLines?.join('\n')).toHaveLength(1);
    expect(contacted.hitDiagnosticLines?.join('\n')).toContain('hitflag=MAFP');
  });
});

describe('T-H-M-A hit-confirm command buffering', () => {
  it('carries an a command from State 200 hitpause into the close State 232 cancel route', async () => {
    const assets = await loadCharacterFromDef('public/chars/T-H-M-A/T-H-M-A/T-H-M-A.def', createFileSystemFetcher());
    const initial = createInitialGameState();
    let state: GameState = {
      ...initial,
      players: [
        {
          ...initial.players[0],
          x: 333.2,
          stateNo: 200,
          stateHeaderAppliedStateNo: 200,
          stateTime: 8,
          stateType: 'S',
          moveType: 'A',
          physics: 'S',
          ctrl: false,
          animNo: 200,
          animTime: 8,
          hitPause: 8,
          moveContact: { activeHitDefId: 1, contact: true, hit: true, guarded: false, elapsed: 1, hitCount: 1 },
        },
        { ...initial.players[1], x: 330 },
      ],
    };
    const commandBuffer = new HitPauseCommandBuffer(assets.cmd);
    const animationInput = {
      getAnimationDuration: (animNo: number) => getMugenAnimEndTime(assets.air, animNo),
      getAnimationElementNo: (animNo: number, animTime: number) => {
        const element = getCurrentAnimationElement(assets.air, animNo, animTime);
        return element ? element.elementIndex + 1 : null;
      },
      getAnimationTriggerInfo: (animNo: number, animTime: number) => getAnimationTriggerInfo(assets.air, animNo, animTime),
    };
    commandBuffer.resolve(new Set(['a']), true);

    while (state.players[0].hitPause > 0) {
      const commands = commandBuffer.resolve(new Set(), true);
      state = stepCnsPhysicsMotion(stepCnsStateRuntime(state, assets.cns, {
        ...animationInput,
        p1Commands: commands,
      }).state, assets.cns);
    }

    const resumedCommands = commandBuffer.resolve(new Set(), false);
    const cancelResult = stepCnsStateRuntime(state, assets.cns, {
      ...animationInput,
      p1Commands: resumedCommands,
      traceDiagnostics: true,
      hitDiagnostics: true,
    });
    const cancelled = cancelResult.state;

    expect(resumedCommands).toContain('a');
    expect(cancelled.players[0], [
      ...cancelResult.traces[0].debugLines,
      ...(cancelled.players[0].hitDiagnosticLines ?? []),
    ].join('\n')).toMatchObject({ stateNo: 232, animNo: 232, ctrl: false });
    expect(cancelled.players[0].moveContact).toBeUndefined();
  });
});

describe('T-H-M-A State 1016 multihit regression', () => {
  it('creates a fresh HitDef generation at each configured AnimElem', async () => {
    const assets = await loadCharacterFromDef('public/chars/T-H-M-A/T-H-M-A/T-H-M-A.def', createFileSystemFetcher());
    const state1016 = assets.cns.states.find((state) => state.stateNo === 1016);
    const hitDef = state1016?.controllers.find((controller) => controller.type.trim().toLowerCase() === 'hitdef');
    if (!state1016 || !hitDef) throw new Error('State 1016 HitDef not found');
    const focusedCns: CnsDocument = {
      metadataSections: assets.cns.metadataSections,
      states: [{ ...state1016, controllers: [hitDef] }],
    };
    const firstElemTime = findActionElementStart(assets.air.actions, 1016, 1);
    const secondElemTime = findActionElementStart(assets.air.actions, 1016, 2);
    expect(firstElemTime).not.toBeNull();
    expect(secondElemTime).not.toBeNull();
    const initial = createInitialGameState();
    const input = {
      hitDiagnostics: true,
      getAnimationTriggerInfo: (animNo: number, animTime: number) => getAnimationTriggerInfo(assets.air, animNo, animTime),
    };
    const first = stepCnsStateRuntime({
      ...initial,
      players: [{
        ...initial.players[0], stateNo: 1016, stateType: 'A', moveType: 'A', physics: 'N', ctrl: false,
        animNo: 1016, animTime: firstElemTime!,
      }, initial.players[1]],
    }, focusedCns, input).state;
    const firstGeneration = first.players[0].activeHitDef?.diagnosticId;
    expect(firstGeneration).toBeDefined();

    const second = stepCnsStateRuntime({
      ...first,
      players: [{
        ...first.players[0], animTime: secondElemTime!, hitDefUsed: true,
        moveContact: { activeHitDefId: firstGeneration!, contact: true, hit: true, guarded: false, hitCount: 1 },
      }, first.players[1]],
    }, focusedCns, input).state;

    expect(second.players[0].activeHitDef?.diagnosticId).not.toBe(firstGeneration);
    expect(second.players[0].moveContact).toMatchObject({ contact: true, hit: true, guarded: false, elapsed: 1, hitCount: 1 });
  });

  it('routes State 1011 to 1012 after the first hit even when the next AnimElem activates HitDef first', async () => {
    const assets = await loadCharacterFromDef('public/chars/T-H-M-A/T-H-M-A/T-H-M-A.def', createFileSystemFetcher());
    const secondElemTime = findActionElementStart(assets.air.actions, 1011, 2);
    expect(secondElemTime).not.toBeNull();
    const initial = createInitialGameState();
    const state = {
      ...initial,
      players: [{
        ...initial.players[0], stateNo: 1011, prevStateNo: 1010, stateType: 'S' as const, moveType: 'A' as const,
        physics: 'N' as const, ctrl: false, animNo: 1011, animTime: secondElemTime!, hitPause: 0,
        moveContact: { activeHitDefId: 77, contact: true, hit: true, guarded: false, elapsed: 1, hitCount: 1 },
        targets: [{ playerId: 2, hitDefId: 1011, activeHitDefId: 77 }],
      }, { ...initial.players[1], stateNo: 5000, moveType: 'H' as const, ctrl: false }],
    } as GameState;

    const result = stepCnsStateRuntime(state, assets.cns, {
      getAnimationDuration: (animNo) => getMugenAnimEndTime(assets.air, animNo),
      getAnimationTriggerInfo: (animNo, animTime) => getAnimationTriggerInfo(assets.air, animNo, animTime),
      hitDiagnostics: true,
    });

    expect(result.state.players[0], result.state.players[0].hitDiagnosticLines?.join('\n')).toMatchObject({
      stateNo: 1012, prevStateNo: 1011,
    });
    expect(result.state.players[0].hitDiagnosticLines?.join('\n')).toContain('targetRedirectRequestedId=1011');
  });
});

function createFileSystemFetcher(): CharacterAssetFetcher {
  return {
    async text(requestPath) {
      const filePath = mapCommonPath(requestPath);
      return new TextDecoder('shift_jis').decode(await readFile(filePath));
    },
    async arrayBuffer(requestPath) {
      const bytes = await readFile(mapCommonPath(requestPath));
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    },
  };
}

function matrixHasTrigger(markdown: string, html: string, name: string): boolean {
  if (name === 'constant') return markdown.includes('| `triggern` or |') && html.includes("'triggern or'");
  const paired = new Map([
    ['p2bodydist', 'p2bodydist x'], ['p2dist', 'p2dist x'], ['pos', 'pos x'], ['screenpos', 'screenpos x'], ['vel', 'vel x'],
  ]).get(name);
  const item = paired ?? name;
  return markdown.includes(`| ${item} |`) && html.includes(item);
}

function mapCommonPath(requestPath: string): string {
  const normalized = normalizePath(requestPath);
  if (normalized === '/chars/common1.cns') return 'public/chars/common1.cns';
  if (normalized === '/chars/common.cmd' || normalized === '/chars/common1.cmd') return 'public/chars/common.cmd';
  if (normalized.startsWith('/chars/')) return `public${normalized}`;
  return normalized;
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/');
}

function findHitDefs(cns: CnsDocument): Array<{ state: CnsStateDefinition; controller: CnsStateController }> {
  return cns.states.flatMap((state) => state.controllers
    .filter((controller) => controller.type.trim().toLowerCase() === 'hitdef')
    .map((controller) => ({ state, controller })));
}

type ContactMode = 'ground' | 'air' | 'guard' | 'ko' | 'edge';

function activateRealHitDef(cns: CnsDocument, attackerId: 1 | 2, mode: ContactMode): GameState {
  const hitDefs = findHitDefs(cns);
  const preferred = hitDefs.filter(({ controller }) => {
    if (mode === 'air') return String(controller.params.hitflag ?? 'MAF').toUpperCase().includes('A') && controller.params['air.velocity'] !== undefined;
    if (mode === 'guard') return controller.params.guardflag !== undefined;
    if (mode === 'ko') return controller.params.damage !== undefined && Number(controller.params.kill ?? 1) !== 0;
    return controller.params.damage !== undefined && /[HM]/i.test(String(controller.params.hitflag ?? 'MAF'));
  });
  for (const selected of [...preferred, ...hitDefs.filter((item) => !preferred.includes(item))]) {
    const forcedCns: CnsDocument = {
      metadataSections: cns.metadataSections,
      states: [{
        ...selected.state,
        moveType: 'A',
        controllers: [{ ...selected.controller, triggers: [{ name: 'trigger1', expression: '1' }] }],
      }],
    };
    const initial = createInitialGameState();
    const attackerIndex = attackerId - 1;
    const players = [...initial.players] as GameState['players'];
    players[attackerIndex] = {
      ...players[attackerIndex], stateNo: selected.state.stateNo, moveType: 'A', ctrl: false,
    };
    const activated = stepCnsStateRuntime({ ...initial, players }, forcedCns, { hitDiagnostics: true }).state;
    const hitDef = activated.players[attackerIndex].activeHitDef;
    if (!hitDef) continue;
    if (mode === 'ko' && (hitDef.damage <= 0 || hitDef.kill === false)) continue;
    if (mode === 'guard' && !hitDef.guardFlag) continue;
    if (mode === 'air' && !hitDef.hitFlag?.includes('A')) continue;
    return activated;
  }
  throw new Error(`No usable ${mode} HitDef for P${attackerId}`);
}

function findCollisionElement(actions: AirAction[], kind: 'attack' | 'body'): { actionNo: number; animTime: number } | null {
  for (const action of actions) {
    let animTime = 0;
    for (const element of action.elements) {
      if ((kind === 'attack' ? element.clsn1 : element.clsn2).length > 0) return { actionNo: action.actionNo, animTime };
      animTime += Math.max(0, element.duration);
    }
  }
  return null;
}

function findActionCollisionElement(actions: AirAction[], actionNo: number, kind: 'attack' | 'body'): { actionNo: number; animTime: number } | null {
  const action = actions.find((candidate) => candidate.actionNo === actionNo);
  if (!action) return null;
  let animTime = 0;
  for (const element of action.elements) {
    if ((kind === 'attack' ? element.clsn1 : element.clsn2).length > 0) return { actionNo: action.actionNo, animTime };
    animTime += Math.max(0, element.duration);
  }
  return null;
}

function findActionElementStart(actions: AirAction[], actionNo: number, elementNo: number): number | null {
  const action = actions.find((candidate) => candidate.actionNo === actionNo);
  if (!action || elementNo < 1 || elementNo > action.elements.length) return null;
  return action.elements.slice(0, elementNo - 1).reduce((sum, element) => sum + Math.max(1, element.duration), 0);
}

function activateState215HitDef(cns: CnsDocument, attackerId: 1 | 2 = 1): GameState {
  const state215 = cns.states.find((state) => state.stateNo === 215);
  const hitDef = state215?.controllers.find((controller) =>
    controller.type.trim().toLowerCase() === 'hitdef' && Number(controller.params.id) === 215);
  if (!state215 || !hitDef) throw new Error('State 215 HitDef not found');
  const forcedCns: CnsDocument = {
    metadataSections: cns.metadataSections,
    states: [{ ...state215, controllers: [{ ...hitDef, triggers: [{ name: 'trigger1', expression: '1' }] }] }],
  };
  const initial = createInitialGameState();
  const players = [...initial.players] as GameState['players'];
  const attackerIndex = attackerId - 1;
  players[attackerIndex] = {
    ...players[attackerIndex],
    stateNo: 215,
    stateType: 'S',
    moveType: 'A',
    physics: 'S',
    ctrl: false,
    animNo: 215,
    fvars: { 1: 1 },
  } as GameState['players'][number];
  return stepCnsStateRuntime({ ...initial, players }, forcedCns, { hitDiagnostics: true }).state;
}

function findContact(
  activated: GameState,
  air: { actions: AirAction[] },
  attackerId: 1 | 2,
  attack: { actionNo: number; animTime: number },
  body: { actionNo: number; animTime: number },
  mode: ContactMode,
  forcedFacing: 1 | -1,
): GameState | null {
  const attackerIndex = attackerId - 1;
  const targetIndex = attackerId === 1 ? 1 : 0;
  for (const facing of [forcedFacing]) {
    for (let offset = -240; offset <= 240; offset += 4) {
      const players = [...activated.players] as GameState['players'];
      const guardFlag = players[attackerIndex].activeHitDef?.guardFlag ?? '';
      const targetStateType = mode === 'air' ? 'A'
        : mode === 'guard' ? /[HM]/i.test(guardFlag) ? 'S' : /L/i.test(guardFlag) ? 'C' : 'A'
          : 'S';
      players[attackerIndex] = {
        ...players[attackerIndex], x: mode === 'edge' ? 912 - offset : 400, y: 285, facing, animNo: attack.actionNo, animTime: attack.animTime,
        stateType: 'S', moveType: 'A', hitPause: 0,
      };
      players[targetIndex] = {
        ...players[targetIndex], x: mode === 'edge' ? 912 : 400 + offset, y: 285, facing: facing === 1 ? -1 : 1,
        animNo: body.actionNo, animTime: body.animTime,
        stateType: targetStateType,
        physics: targetStateType === 'A' ? 'A' : targetStateType === 'C' ? 'C' : 'S', moveType: 'I', hitPause: 0,
        guardIntent: mode === 'guard',
        life: mode === 'ko' ? Math.max(1, players[attackerIndex].activeHitDef?.damage ?? 1) : players[targetIndex].life,
      };
      const result = resolveFallbackHits({ ...activated, players }, air, true);
      if (result.hitEvents.length > 0 && Boolean(result.hitEvents[0].guarded) === (mode === 'guard')) return result;
    }
  }
  return null;
}
