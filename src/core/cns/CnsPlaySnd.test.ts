import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsStateRuntime } from './CnsStateRuntime';
import type { SoundPlayEvent } from '../audio/SoundEvent';

describe('PlaySnd CNS runtime', () => {
  it('evaluates the firing-frame snapshot and emits owner-scoped parameters', () => {
    const events: SoundPlayEvent[] = [];
    const cns = parseCnsText(`
[StateDef 0]
type = S
movetype = I
physics = S

[State 0, Voice]
type = PlaySnd
trigger1 = Time = 0
value = var(0), 2 + 3
channel = 1
volume = 80
volumescale = 50
pan = 25
freqmul = 1.5
loop = 1
`);
    const initial = createInitialGameState();
    const player = { ...initial.players[0], vars: { 0: 7 }, facing: -1 as const };

    stepCnsStateRuntime({ ...initial, players: [player, initial.players[1]] }, cns, {
      onSoundPlay: (event) => events.push(event),
    });

    expect(events).toContainEqual({
      ownerId: 1, scope: 'character', group: 7, index: 5, channel: 1, volume: 80, volumeScale: 50,
      pan: -25, absolutePan: false, frequencyMultiplier: 1.5, loop: true,
    });
  });

  it('does not emit when the trigger is false and keeps P1/P2 owners separate', () => {
    const events: SoundPlayEvent[] = [];
    const cns = parseCnsText(`
[StateDef 0]
type = S
movetype = I
physics = S
[State 0, Never]
type = PlaySnd
trigger1 = Time = 99
value = 0,0
`);
    const initial = createInitialGameState();
    stepCnsStateRuntime(initial, cns, { onSoundPlay: (event) => events.push(event) });
    expect(events).toEqual([]);

    const active = parseCnsText(`
[StateDef 0]
type = S
movetype = I
physics = S
[State 0, Both]
type = PlaySnd
trigger1 = 1
value = S1,2
abspan = -40
`);
    stepCnsStateRuntime(initial, active, { onSoundPlay: (event) => events.push(event) });
    expect(events.map((event) => ({ ownerId: event.ownerId, scope: event.scope, absolutePan: event.absolutePan, pan: event.pan }))).toEqual([
      { ownerId: 1, scope: 'character', absolutePan: true, pan: -40 },
      { ownerId: 2, scope: 'character', absolutePan: true, pan: -40 },
    ]);
  });
});
