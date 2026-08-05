import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getMugenAnimEndTime } from '../animation/AnimationDuration';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { stepCnsPhysicsMotion } from '../cns/CnsPhysicsStep';
import { parseAirText } from '../../parser/air/AirParser';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from './GameState';
import { applyFallbackStageRules } from './FallbackStageRules';

const common = parseCnsText(readFileSync('public/chars/common1.cns', 'utf8'));
const kfmAir = parseAirText(readFileSync('public/chars/kfm/kfm.air', 'utf8'));

describe('WinMUGEN idle AutoTurn compatibility', () => {
  it.each([
    { stateNo: 0, stateType: 'S' as const, physics: 'S' as const, idleAnim: 0, turnAnim: 5 },
    { stateNo: 11, stateType: 'C' as const, physics: 'C' as const, idleAnim: 11, turnAnim: 6 },
  ])('completes Facing immediately in State $stateNo while AIR $turnAnim presents the turn', ({ stateNo, stateType, physics, idleAnim, turnAnim }) => {
    const initial = createInitialGameState();
    let state = applyFallbackStageRules({
      ...initial,
      players: [
        { ...initial.players[0], stateNo, stateType, physics, moveType: 'I', animNo: idleAnim, x: 500, facing: 1, ctrl: false },
        { ...initial.players[1], x: 300, facing: -1 },
      ],
    });

    expect(state.players[0]).toMatchObject({ stateNo, facing: -1, animNo: turnAnim, animTime: 0, ctrl: true });
    const action = kfmAir.actions.find((candidate) => candidate.actionNo === turnAnim);
    expect(action?.elements[0].flip?.toUpperCase()).toContain('H');
    expect(action?.elements.at(-1)?.flip?.toUpperCase() ?? '').not.toContain('H');

    const duration = getMugenAnimEndTime(kfmAir, turnAnim);
    expect(duration).toBeGreaterThan(0);
    const timeline: Array<{ animNo: number; animTime: number }> = [];
    for (let tick = 0; tick <= (duration ?? 0); tick += 1) {
      state = stepCnsStateRuntime(state, common, {
        getAnimationDuration: (animNo) => getMugenAnimEndTime(kfmAir, animNo),
      }).state;
      state = stepCnsPhysicsMotion(state, common);
      timeline.push({ animNo: state.players[0].animNo, animTime: state.players[0].animTime });
      if (state.players[0].animNo === idleAnim) break;
      state = applyFallbackStageRules(state);
    }

    expect(state.players[0], JSON.stringify(timeline)).toMatchObject({ stateNo, facing: -1, animNo: idleAnim, ctrl: true });
  });
});
