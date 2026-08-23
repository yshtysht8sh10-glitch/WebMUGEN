import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parseAirText } from '../../parser/air/AirParser';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { getAnimationTriggerInfo } from '../animation/AnimationPlayer';
import { stepCnsPhysicsMotion } from '../cns/CnsPhysicsStep';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { createInitialGameState } from '../engine/GameState';
import { DEFAULT_GROUND_Y } from '../engine/GroundClamp';

describe('T-H-M-A State 3710 transition regression (#110)', () => {
  it('allows Physics=N to descend to Pos Y 400 and enter State 3720', async () => {
    const [cnsBytes, airBytes] = await Promise.all([
      readFile('public/chars/T-H-M-A/T-H-M-A/T-H-M-Atyouhi.cns'),
      readFile('public/chars/T-H-M-A/T-H-M-A/T-H-M-A.air'),
    ]);
    const decoder = new TextDecoder('shift_jis');
    const cns = parseCnsText(decoder.decode(cnsBytes));
    const air = parseAirText(decoder.decode(airBytes));
    const initial = createInitialGameState();
    let state = {
      ...initial,
      players: [
        {
          ...initial.players[0],
          stateNo: 3710,
          stateTime: 0,
          animNo: 1051,
          animTime: 0,
          stateType: 'A' as const,
          moveType: 'I' as const,
          physics: 'N' as const,
          ctrl: false,
          y: DEFAULT_GROUND_Y,
        },
        initial.players[1],
      ] as typeof initial.players,
    };

    for (let frame = 0; frame < 220 && state.players[0].stateNo === 3710; frame += 1) {
      state = stepCnsStateRuntime(state, cns, {
        getAnimationTriggerInfo: (animNo, time) => getAnimationTriggerInfo(air, animNo, time),
      }).state;
      state = stepCnsPhysicsMotion(state, cns);
    }

    expect(state.players[0]).toMatchObject({ stateNo: 3720, prevStateNo: 3710 });
    expect(state.players[0].y).toBeGreaterThanOrEqual(DEFAULT_GROUND_Y + 400);
  });
});
