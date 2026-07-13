import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import type { SoundStopEvent } from '../audio/SoundEvent';
import { stepCnsStateRuntime } from './CnsStateRuntime';

describe('StopSnd CNS runtime', () => {
  it('evaluates channel expressions and preserves owner scope', () => {
    const events: SoundStopEvent[] = [];
    const cns = parseCnsText(`
[StateDef 0]
type = S
movetype = I
physics = S
[State 0, Stop]
type = StopSnd
trigger1 = 1
channel = 1 + 2
`);
    stepCnsStateRuntime(createInitialGameState(), cns, { onSoundStop: (event) => events.push(event) });
    expect(events).toEqual([
      { type: 'stop', ownerId: 1, channel: 3 },
      { type: 'stop', ownerId: 2, channel: 3 },
    ]);
  });

  it('does not emit for a false trigger and reports omitted channel as null', () => {
    const events: SoundStopEvent[] = [];
    const falseCns = parseCnsText('[StateDef 0]\ntype=S\n[State 0, No]\ntype=StopSnd\ntrigger1=Time=99\nchannel=0');
    stepCnsStateRuntime(createInitialGameState(), falseCns, { onSoundStop: (event) => events.push(event) });
    expect(events).toEqual([]);

    const omitted = parseCnsText('[StateDef 0]\ntype=S\n[State 0, Missing]\ntype=StopSnd\ntrigger1=1');
    stepCnsStateRuntime(createInitialGameState(), omitted, { onSoundStop: (event) => events.push(event) });
    expect(events[0]).toMatchObject({ ownerId: 1, channel: null });
  });
});
