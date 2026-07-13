import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type { CnsDocument, CnsStateController, CnsStateDefinition } from '../../mugen/common/cnsTypes';
import { findAction } from '../animation/AnimationPlayer';
import type { SoundPlayEvent } from '../audio/SoundEvent';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { createInitialGameState } from '../engine/GameState';
import type { GameState } from '../engine/types';
import { applyExplodCreateEvents, stepExplodRuntime, type ExplodCreateEvent } from '../explod/ExplodSystem';
import { findSndSample } from '../../parser/snd/SndTypes';
import { resolveExplodRenderFrames } from '../../renderer/canvas2d/ExplodRender';
import { loadCharacterFromDef, type CharacterAssetFetcher } from './CharacterLoader';
import type { CharacterAssets } from './CharacterTypes';

declare const process: { env: Record<string, string | undefined>; platform: string };

class FakeImageData {
  constructor(public data: Uint8ClampedArray, public width: number, public height: number) {}
}

(globalThis as unknown as { ImageData: typeof ImageData }).ImageData = FakeImageData as unknown as typeof ImageData;

const configuredDefs = (process.env.WEBMUGEN_REAL_CHARACTER_DEFS ?? '')
  .split(process.platform === 'win32' ? ';' : ':')
  .map((value) => value.trim())
  .filter(Boolean);
const realCharacterDescribe = configuredDefs.length >= 3 ? describe : describe.skip;
let configuredCharactersPromise: Promise<Array<{ defPath: string; assets: CharacterAssets }>> | null = null;

realCharacterDescribe('WinMUGEN real-character Explod/Sound regression', () => {
  it('audits three distinct controller profiles and Matrix rows', async () => {
    const characters = await loadConfiguredCharacters();
    expect(characters).toHaveLength(configuredDefs.length);
    expect(characters.length).toBeGreaterThanOrEqual(3);
    const names = new Set(characters.map(({ assets }) => String(assets.def.sections.find((section) => section.name.toLowerCase() === 'info')?.values.get('name') ?? '')));
    expect(names.size).toBeGreaterThanOrEqual(3);

    const profiles = characters.map(({ assets }) => controllerProfile(assets.cns));
    for (const profile of profiles) {
      expect(profile.Explod).toBeGreaterThan(0);
      expect(profile.PlaySnd).toBeGreaterThan(0);
    }
    expect(new Set(profiles.map((profile) => JSON.stringify(profile))).size).toBeGreaterThanOrEqual(3);
    expect(profiles.some((profile) => profile.ModifyExplod > 0)).toBe(true);
    expect(profiles.some((profile) => profile.RemoveExplod > 0)).toBe(true);
    expect(profiles.some((profile) => profile.SuperPause > 0)).toBe(true);

    const [matrixHtml, matrixMd] = await Promise.all([
      readFile('docs/webmugen/winmugen-compatibility-matrix.html', 'utf8'),
      readFile('docs/webmugen/winmugen-compatibility-matrix.md', 'utf8'),
    ]);
    for (const name of ['Explod', 'ModifyExplod', 'RemoveExplod', 'ExplodBindTime', 'PlaySnd', 'StopSnd', 'SndPan']) {
      expect(matrixHtml).toContain(`${name}:`);
      expect(matrixMd).toContain(`| ${name} |`);
    }
  }, 120_000);

  it.each([1, 2] as const)('runs real PlaySnd and visible Explod through production paths for P%i and both Facings', async (attackerId) => {
    for (const { defPath, assets } of await loadConfiguredCharacters()) {
      const sound = findUsableSoundController(assets, attackerId);
      expect(sound, `${defPath} has no executable character PlaySnd sample`).not.toBeNull();
      expect(findSndSample(assets.sounds!, sound!.group, sound!.index)).not.toBeNull();

      for (const facing of [1, -1] as const) {
        const explod = findUsableExplodController(assets, attackerId, facing);
        expect(explod, `${defPath} P${attackerId} facing=${facing} has no visible owner Explod`).not.toBeNull();
        expect(explod!.entry.owner).toEqual({ entityId: attackerId, rootPlayerId: attackerId });
        expect(explod!.entry.facing).toBe(facing);
        expect(explod!.rendered.frames).toHaveLength(1);
        expect(explod!.rendered.frames[0].entry.runtimeId).toBe(explod!.entry.runtimeId);
      }
    }
  }, 120_000);

  it('keeps real Explod collections bounded during a long lifecycle and resets them between rounds', async () => {
    for (const { defPath, assets } of await loadConfiguredCharacters()) {
      const selected = findUsableExplodController(assets, 1, 1);
      expect(selected, `${defPath} has no lifecycle Explod`).not.toBeNull();
      let state = selected!.state;
      const initialCount = state.explods.entries.length;
      const action = findAction(assets.air, selected!.entry.animNo);
      expect(action).toBeDefined();
      const lifecycleAir = { actions: [action!] };
      const endFrame = state.frame + 600;
      for (let frame = state.frame + 1; frame <= endFrame; frame += 1) {
        state = stepExplodRuntime({ ...state, frame, hitDiagnosticLines: [] }, () => lifecycleAir);
        expect(state.explods.entries.length).toBeLessThanOrEqual(initialCount);
      }
      expect(createInitialGameState().explods).toEqual({ entries: [], nextRuntimeId: 1 });
    }
  }, 120_000);
});

async function loadConfiguredCharacters(): Promise<Array<{ defPath: string; assets: CharacterAssets }>> {
  configuredCharactersPromise ??= Promise.all(configuredDefs.map(async (defPath) => ({
    defPath,
    assets: await loadCharacterFromDef(normalizePath(defPath), createFileSystemFetcher()),
  })));
  return configuredCharactersPromise;
}

function findUsableSoundController(assets: CharacterAssets, attackerId: 1 | 2): SoundPlayEvent | null {
  if (!assets.sounds) return null;
  const candidates = controllers(assets.cns, 'playsnd').filter(({ controller }) => {
    const parts = Array.isArray(controller.params.value) ? controller.params.value : String(controller.params.value ?? '').split(',');
    const group = Number(String(parts[0] ?? '').trim().replace(/^s/i, ''));
    const index = Number(String(parts[1] ?? '').trim());
    return Number.isFinite(group) && Number.isFinite(index) && Boolean(findSndSample(assets.sounds!, Math.trunc(group), Math.trunc(index)));
  });
  for (const { state, controller } of candidates.slice(0, 8)) {
    const events: SoundPlayEvent[] = [];
    stepCnsStateRuntime(forcedState(state, controller, attackerId), forcedDocument(assets.cns, state, controller), {
      onSoundPlay: (event) => events.push(event),
    });
    const event = events.find((candidate) => candidate.scope === 'character' && Boolean(findSndSample(assets.sounds!, candidate.group, candidate.index)));
    if (event) return event;
  }
  return null;
}

function findUsableExplodController(assets: CharacterAssets, attackerId: 1 | 2, facing: 1 | -1) {
  const candidates = controllers(assets.cns, 'explod').filter(({ controller }) => {
    const raw = Array.isArray(controller.params.anim) ? controller.params.anim[0] : controller.params.anim;
    const text = String(raw ?? '').trim();
    if (/^f/i.test(text)) return false;
    const animNo = Number(text.replace(/^s/i, ''));
    return Number.isFinite(animNo) && Boolean(findAction(assets.air, Math.trunc(animNo)));
  });
  for (const { state, controller } of candidates.slice(0, 8)) {
    const events: ExplodCreateEvent[] = [];
    const source = forcedState(state, controller, attackerId, facing);
    const result = stepCnsStateRuntime(source, forcedDocument(assets.cns, state, controller), {
      onExplodCreate: (event) => events.push(event), screenWidth: 640,
    });
    const event = events.find((candidate): candidate is Extract<ExplodCreateEvent, { type: 'create' }> => candidate.type === 'create'
      && candidate.request.animationSource === 'owner'
      && Boolean(findAction(assets.air, candidate.request.animNo)));
    if (!event) continue;
    const applied = applyExplodCreateEvents(result.state, [event], () => 0.5);
    const entry = applied.explods.entries[0];
    const rendered = resolveExplodRenderFrames(applied, {}, { [attackerId]: { airDocument: assets.air } });
    if (entry && rendered.frames.length === 1) return { state: applied, entry, rendered };
  }
  return null;
}

function forcedDocument(source: CnsDocument, state: CnsStateDefinition, controller: CnsStateController): CnsDocument {
  return {
    metadataSections: source.metadataSections,
    states: [{ ...state, controllers: [{ ...controller, triggers: [{ name: 'trigger1', expression: '1' }] }] }],
  };
}

function forcedState(state: CnsStateDefinition, controller: CnsStateController, attackerId: 1 | 2, facing: 1 | -1 = 1): GameState {
  const initial = createInitialGameState();
  const players = [...initial.players] as GameState['players'];
  players[attackerId - 1] = { ...players[attackerId - 1], stateNo: state.stateNo, facing, moveType: 'A', ctrl: false };
  players[attackerId === 1 ? 1 : 0] = { ...players[attackerId === 1 ? 1 : 0], stateNo: Number.MIN_SAFE_INTEGER };
  return { ...initial, frame: 10, players };
}

function controllers(cns: CnsDocument, type: string) {
  return cns.states.flatMap((state) => state.controllers
    .filter((controller) => controller.type.trim().toLowerCase() === type)
    .map((controller) => ({ state, controller })));
}

function controllerProfile(cns: CnsDocument): Record<string, number> {
  const names = ['Explod', 'ModifyExplod', 'RemoveExplod', 'ExplodBindTime', 'PlaySnd', 'StopSnd', 'SndPan', 'Pause', 'SuperPause'];
  return Object.fromEntries(names.map((name) => [name, controllers(cns, name.toLowerCase()).length]));
}

function createFileSystemFetcher(): CharacterAssetFetcher {
  return {
    async text(requestPath) { return new TextDecoder('shift_jis').decode(await readFile(mapCommonPath(requestPath))); },
    async arrayBuffer(requestPath) {
      const bytes = await readFile(mapCommonPath(requestPath));
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    },
  };
}

function mapCommonPath(requestPath: string): string {
  const normalized = normalizePath(requestPath);
  if (normalized === '/chars/common1.cns') return 'public/chars/common1.cns';
  if (normalized === '/chars/common.cmd' || normalized === '/chars/common1.cmd') return 'public/chars/common.cmd';
  return normalized;
}

function normalizePath(value: string): string { return value.replace(/\\/g, '/'); }
