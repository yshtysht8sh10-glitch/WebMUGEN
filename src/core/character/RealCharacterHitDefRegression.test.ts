import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type { AirAction } from '../../parser/air/AirTypes';
import type { CnsDocument, CnsStateController, CnsStateDefinition } from '../../mugen/common/cnsTypes';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { analyzeCnsCoverage } from '../cns/CnsCoverageDiagnostics';
import { createInitialGameState } from '../engine/GameState';
import { applyFallbackHitRecovery } from '../engine/FallbackHitRecovery';
import { resolveFallbackHits } from '../engine/FallbackHitResolver';
import type { GameState } from '../engine/types';
import { loadCharacterFromDef, type CharacterAssetFetcher } from './CharacterLoader';

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
