import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import type { SoundPanEvent } from '../audio/SoundEvent';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsStateRuntime } from './CnsStateRuntime';

describe('SndPan CNS runtime', () => {
  it('evaluates firing-frame channel and facing-relative pan for each owner', () => {
    const events: SoundPanEvent[] = [];
    const cns = parseCnsText(`
[StateDef 0]
type = S
[State 0, Pan]
type = SndPan
trigger1 = 1
channel = 1 + 2
pan = var(0)
`);
    const initial = createInitialGameState();
    const p1 = { ...initial.players[0], vars: { 0: 40 }, facing: 1 as const };
    const p2 = { ...initial.players[1], vars: { 0: 40 }, facing: -1 as const };
    stepCnsStateRuntime({ ...initial, players: [p1, p2] }, cns, { onSoundPan: (event) => events.push(event) });
    expect(events).toEqual([
      { type: 'pan', ownerId: 1, channel: 3, pan: 40, mode: 'pan' },
      { type: 'pan', ownerId: 2, channel: 3, pan: -40, mode: 'pan' },
    ]);
  });

  it('gives abspan precedence, preserves owner scope, and does not fire on a false trigger', () => {
    const events: SoundPanEvent[] = [];
    const cns = parseCnsText(`
[StateDef 0]
type = S
[State 0, Absolute]
type = SndPan
trigger1 = Time = 0
channel = 4
pan = 70
abspan = -25
[State 0, Never]
type = SndPan
trigger1 = Time = 99
channel = 5
pan = 10
`);
    stepCnsStateRuntime(createInitialGameState(), cns, { onSoundPan: (event) => events.push(event) });
    expect(events).toEqual([
      { type: 'pan', ownerId: 1, channel: 4, pan: -25, mode: 'abspan' },
      { type: 'pan', ownerId: 2, channel: 4, pan: -25, mode: 'abspan' },
    ]);
  });

  it('emits missing required values for production diagnostics', () => {
    const events: SoundPanEvent[] = [];
    const cns = parseCnsText('[StateDef 0]\ntype=S\n[State 0, Missing]\ntype=SndPan\ntrigger1=1');
    stepCnsStateRuntime(createInitialGameState(), cns, { onSoundPan: (event) => events.push(event) });
    expect(events[0]).toEqual({ type: 'pan', ownerId: 1, channel: null, pan: null, mode: null });
  });
});
