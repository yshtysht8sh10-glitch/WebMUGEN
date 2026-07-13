import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { parseSndV1 } from '../../parser/snd/SndParser';
import { findSndSample } from '../../parser/snd/SndTypes';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { createInitialGameState } from '../engine/GameState';
import type { SoundPlayEvent } from '../audio/SoundEvent';

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
});
