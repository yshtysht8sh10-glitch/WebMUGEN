import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parseAirText } from '../../parser/air/AirParser';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { getAnimationTriggerInfo } from '../animation/AnimationPlayer';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';

describe('T-H-M-A State 3010 Helper regression (#111)', () => {
  it('spawns the AnimElem 3 Helper once even though the AIR tail loops', async () => {
    const [cnsBytes, airBytes] = await Promise.all([
      readFile('public/chars/T-H-M-A/T-H-M-A/T-H-M-Atyouhi.cns'),
      readFile('public/chars/T-H-M-A/T-H-M-A/T-H-M-A.air'),
    ]);
    const decoder = new TextDecoder('shift_jis');
    const cns = parseCnsText(decoder.decode(cnsBytes));
    const air = parseAirText(decoder.decode(airBytes));
    const initial = createInitialGameState();
    const spawnTimes: number[] = [];

    for (let animTime = 0; animTime < 40; animTime += 1) {
      const player = {
        ...initial.players[0],
        stateNo: 3010,
        stateTime: animTime,
        animNo: 3010,
        animTime,
        ctrl: false,
      };
      const result = stepCnsStateRuntime({ ...initial, players: [player, initial.players[1]] }, cns, {
        getAnimationTriggerInfo: (animNo, time) => getAnimationTriggerInfo(air, animNo, time),
      });
      if (result.state.helpers.entries.length > 0) spawnTimes.push(animTime);
    }

    expect(spawnTimes).toEqual([10]);
  });
});
