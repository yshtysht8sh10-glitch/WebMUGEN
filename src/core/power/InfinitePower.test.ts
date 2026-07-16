import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { createInitialGameState } from '../engine/GameState';
import { restartRound } from '../engine/RoundRestart';
import { applyInfinitePowerAtFrameStart, type InfinitePowerMode } from './InfinitePower';

describe('Issue #64 Power Infinite frame boundary', () => {
  it.each([
    ['off', 100, 200, false, false],
    ['p1', 9000, 200, true, false],
    ['p2', 100, 9000, false, true],
    ['both', 9000, 9000, true, true],
  ] as Array<[InfinitePowerMode, number, number, boolean, boolean]>)('applies mode %s only to selected root players', (mode, p1Power, p2Power, p1Flag, p2Flag) => {
    const initial = createInitialGameState(9000);
    initial.players = [{ ...initial.players[0], power: 100 }, { ...initial.players[1], power: 200 }];
    const result = applyInfinitePowerAtFrameStart(initial, mode);

    expect(result.players.map((player) => player.power)).toEqual([p1Power, p2Power]);
    expect(result.players.map((player) => Boolean(player.infinitePower))).toEqual([p1Flag, p2Flag]);
  });

  it('lets controllers and later triggers observe normal same-frame PowerSet ordering, then refills next frame', () => {
    const cns = parseCnsText(`
[Statedef 200]
[State 200, Consume]
type = PowerSet
trigger1 = Time = 0
value = 0
[State 200, Observe consumed value]
type = ChangeState
trigger1 = Power = 0
value = 201
[Statedef 201]
type = S
`);
    const initial = createInitialGameState(9000);
    initial.players = [{ ...initial.players[0], stateNo: 200 }, initial.players[1]];
    const frameStart = applyInfinitePowerAtFrameStart(initial, 'p1');
    const evaluated = stepCnsStateRuntime(frameStart, cns).state;

    expect(frameStart.players[0].power).toBe(9000);
    expect(evaluated.players[0]).toMatchObject({ power: 0, stateNo: 201, infinitePower: true });
    expect(applyInfinitePowerAtFrameStart(evaluated, 'p1').players[0].power).toBe(9000);
  });

  it('preserves PowerAdd and StateDef poweradd behavior until the following frame boundary', () => {
    const cns = parseCnsText(`
[Statedef 200]
[State 200, Spend]
type = PowerAdd
trigger1 = Time = 0
value = -500
[State 200, Enter]
type = ChangeState
trigger1 = Time = 0
value = 201
[Statedef 201]
poweradd = -1000
`);
    const initial = createInitialGameState(9000);
    initial.players = [{ ...initial.players[0], stateNo: 200 }, initial.players[1]];
    const evaluated = stepCnsStateRuntime(applyInfinitePowerAtFrameStart(initial, 'p1'), cns).state;

    expect(evaluated.players[0]).toMatchObject({ stateNo: 201, power: 7500 });
    expect(applyInfinitePowerAtFrameStart(evaluated, 'p1').players[0].power).toBe(9000);
  });

  it('turns off without rewriting the current gauge and resumes ordinary consumption', () => {
    const enabled = applyInfinitePowerAtFrameStart(createInitialGameState(9000), 'both');
    const disabled = applyInfinitePowerAtFrameStart(enabled, 'off');

    expect(disabled.players.map((player) => player.power)).toEqual([9000, 9000]);
    expect(disabled.players.map((player) => Boolean(player.infinitePower))).toEqual([false, false]);
  });

  it('reapplies selected modes after a round reset without changing powerMax', () => {
    const reset = restartRound(1, 99, 9000).gameState;
    const result = applyInfinitePowerAtFrameStart(reset, 'p2');

    expect(result.players.map((player) => [player.power, player.powerMax])).toEqual([[0, 9000], [9000, 9000]]);
    expect(result.hitDiagnosticLines?.join('\n')).toContain('timing=frame_start mode=p2 entity=p2 before=0 after=9000 max=9000');
  });
});
