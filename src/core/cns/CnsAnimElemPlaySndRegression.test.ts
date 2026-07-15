import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parseAirText } from '../../parser/air/AirParser';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { getAnimationTriggerInfo } from '../animation/AnimationPlayer';
import type { SoundPlayEvent } from '../audio/SoundEvent';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsStateRuntime } from './CnsStateRuntime';

describe('AnimElem PlaySnd loop regression', () => {
  it('emits PlaySnd at the same element starts on every AIR loop', () => {
    const air = parseAirText(`
[Begin Action 101]
101,0, 0,0, 2
101,1, 0,0, 2
101,2, 0,0, 2
101,3, 0,0, 2
`);
    const cns = parseCnsText(`
[StateDef 101]
type = S
anim = 101

[State 101, PlaySnd]
type = PlaySnd
trigger1 = AnimElem = 1
trigger2 = AnimElem = 4
value = S100,1
`);

    expect(collectEvents(cns, air, 17).map((event) => event.animTime)).toEqual([0, 6, 9, 14, 16]);
  });

  it('replays the bundled T-H-M-A dash footstep at elements 1 and 4 on later loops', async () => {
    const [cnsBytes, airBytes] = await Promise.all([
      readFile('public/chars/T-H-M-A/T-H-M-A/T-H-M-A.cns'),
      readFile('public/chars/T-H-M-A/T-H-M-A/T-H-M-A.air'),
    ]);
    const decoder = new TextDecoder('shift_jis');
    const cns = parseCnsText(decoder.decode(cnsBytes));
    const air = parseAirText(decoder.decode(airBytes));

    const events = collectEvents(cns, air, 44);
    expect(events.filter((event) => event.group === 100 && event.index === 1).map((event) => event.animTime)).toEqual([
      0, 6, 13, 18, 24, 30, 36, 42,
    ]);
  });
});

function collectEvents(
  cns: ReturnType<typeof parseCnsText>,
  air: ReturnType<typeof parseAirText>,
  frameCount: number,
): Array<SoundPlayEvent & { animTime: number }> {
  const initial = createInitialGameState();
  const events: Array<SoundPlayEvent & { animTime: number }> = [];

  for (let animTime = 0; animTime < frameCount; animTime += 1) {
    const player = {
      ...initial.players[0],
      stateNo: 101,
      stateTime: animTime,
      animNo: 101,
      animTime,
      ctrl: false,
    };
    stepCnsStateRuntime({ ...initial, players: [player, initial.players[1]] }, cns, {
      getAnimationTriggerInfo: (animNo, time) => getAnimationTriggerInfo(air, animNo, time),
      onSoundPlay: (event) => events.push({ ...event, animTime }),
    });
  }

  return events;
}
