import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getMugenAnimEndTime } from '../animation/AnimationDuration';
import { enterCnsState, stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { stepCnsPhysicsMotion } from '../cns/CnsPhysicsStep';
import { parseAirText } from '../../parser/air/AirParser';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from './GameState';
import { applyFallbackStageRules } from './FallbackStageRules';

const common = parseCnsText(readFileSync('public/chars/common1.cns', 'utf8'));
const kfmAir = parseAirText(readFileSync('public/chars/kfm/kfm.air', 'utf8'));

describe('WinMUGEN idle AutoTurn compatibility', () => {
  it('returns an attacking player to idle MoveType when State 0 omits movetype, then turns toward P2', () => {
    const cns = parseCnsText(`
[StateDef 0]
type = S
physics = S
ctrl = 1
`);
    const initial = createInitialGameState();
    const attacker = {
      ...initial.players[0],
      stateNo: 3430,
      stateType: 'S' as const,
      moveType: 'A' as const,
      x: 500,
      facing: 1 as const,
      ctrl: false,
    };
    const opponent = { ...initial.players[1], x: 300, facing: 1 as const };

    const entered = enterCnsState(attacker, opponent, 0, cns);
    expect(entered).toMatchObject({ stateNo: 0, moveType: 'I', facing: 1 });

    const turned = applyFallbackStageRules({ ...initial, players: [entered, opponent] });
    expect(turned.players[0]).toMatchObject({ stateNo: 0, moveType: 'I', facing: -1, animNo: 5 });
  });

  it('preserves the preceding MoveType only when StateDef explicitly requests U', () => {
    const cns = parseCnsText(`
[StateDef 100]
type = S
movetype = U
physics = N
`);
    const initial = createInitialGameState();
    const attacker = { ...initial.players[0], stateNo: 3430, moveType: 'A' as const };

    expect(enterCnsState(attacker, initial.players[1], 100, cns).moveType).toBe('A');
  });

  it('applies the omitted movetype default on a State first entered outside ChangeState', () => {
    const cns = parseCnsText(`
[StateDef 0]
type = S
physics = S
ctrl = 1
`);
    const initial = createInitialGameState();
    const result = stepCnsStateRuntime({
      ...initial,
      players: [
        { ...initial.players[0], stateNo: 0, moveType: 'A', stateHeaderAppliedStateNo: 3430 },
        initial.players[1],
      ],
    }, cns, {});

    expect(result.state.players[0].moveType).toBe('I');
  });

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
