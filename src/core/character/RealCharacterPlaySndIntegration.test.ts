import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { parseSndV1 } from '../../parser/snd/SndParser';
import { findSndSample } from '../../parser/snd/SndTypes';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { createInitialGameState } from '../engine/GameState';
import type { SoundPlayEvent } from '../audio/SoundEvent';
import { loadCharacterFromDef, type CharacterAssetFetcher } from './CharacterLoader';

describe('real character PlaySnd integration', () => {
  it('fires bundled KFM State 200 PlaySnd and resolves its real SND sample', async () => {
    const cns = parseCnsText(await readFile('public/chars/kfm/kfm.cns', 'utf8'));
    const snd = parseSndV1(await readFile('public/chars/kfm/kfm.snd'));
    const initial = createInitialGameState();
    const events: SoundPlayEvent[] = [];

    stepCnsStateRuntime({
      ...initial,
      players: [{ ...initial.players[0], stateNo: 200, stateTime: 1, animNo: 200 }, initial.players[1]],
    }, cns, { onSoundPlay: (event) => events.push(event) });

    const event = events.find((item) => item.ownerId === 1);
    expect(event).toMatchObject({ scope: 'character', group: 0, index: 0, channel: null, loop: false });
    const sample = findSndSample(snd, event!.group, event!.index);
    expect(sample?.format).toBe('wave');
    expect(sample?.bytes.byteLength).toBeGreaterThan(12);
  });

  it('preserves bundled T-H-M-A stcommon State 40 and fires its jump sound', async () => {
    const defPath = 'public/chars/T-H-M-A/T-H-M-A/T-H-M-A.def';
    const assets = await loadCharacterFromDef(defPath, createThmaFileSystemFetcher(defPath));
    const state40 = assets.cns.states.find((state) => state.stateNo === 40);
    const initial = createInitialGameState();
    const events: SoundPlayEvent[] = [];

    expect(state40?.sourceLabel).toBe('stcommon');
    expect(state40?.controllers.some((controller) => controller.type.toLowerCase() === 'playsnd')).toBe(true);

    stepCnsStateRuntime({
      ...initial,
      players: [{ ...initial.players[0], stateNo: 40, stateTime: 1, animNo: 40, animTime: 1, ctrl: false }, initial.players[1]],
    }, assets.cns, { onSoundPlay: (event) => events.push(event) });

    const event = events.find((item) => item.ownerId === 1 && item.group === 40 && item.index === 0);
    expect(event).toMatchObject({ scope: 'character', group: 40, index: 0 });
    expect(findSndSample(assets.sounds!, event!.group, event!.index)?.format).toBe('wave');
  });
});

function createThmaFileSystemFetcher(defPath: string): CharacterAssetFetcher {
  return {
    async text(requestPath) {
      if (requestPath === '/chars/common1.cmd') throw new Error('optional common1.cmd is absent');
      const text = new TextDecoder('shift_jis').decode(await readFile(mapCommonPath(requestPath)));
      return requestPath === defPath
        ? text.replace(/^\s*(?:sprite|pal\d+)\s*=.*$/gim, '')
        : text;
    },
    async arrayBuffer(requestPath) {
      const bytes = await readFile(mapCommonPath(requestPath));
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    },
  };
}

function mapCommonPath(requestPath: string): string {
  if (requestPath === '/chars/common1.cns') return 'public/chars/common1.cns';
  if (requestPath === '/chars/common.cmd') return 'public/chars/common.cmd';
  return requestPath;
}
