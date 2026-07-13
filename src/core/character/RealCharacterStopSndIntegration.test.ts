import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import type { SoundStopEvent } from '../audio/SoundEvent';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { createInitialGameState } from '../engine/GameState';

describe('real character StopSnd integration', () => {
  it('fires bundled T-H-M-A State 195 channel 12 stop event', async () => {
    const cns = parseCnsText(await readFile('public/chars/T-H-M-A/T-H-M-A/T-H-M-A.cns', 'utf8'));
    const initial = createInitialGameState();
    const events: SoundStopEvent[] = [];
    stepCnsStateRuntime({
      ...initial,
      players: [{ ...initial.players[0], stateNo: 195 }, initial.players[1]],
    }, cns, { onSoundStop: (event) => events.push(event) });
    expect(events).toContainEqual({ type: 'stop', ownerId: 1, channel: 12 });
  });
});
