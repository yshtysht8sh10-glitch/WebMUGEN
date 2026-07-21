import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import { applyFallbackStageRules } from '../engine/FallbackStageRules';
import { stepCnsStateRuntime } from './CnsStateRuntime';

describe('AssertSpecial noautoturn compatibility', () => {
  const cns = parseCnsText(`
[Statedef 101]
type = S
physics = N
ctrl = 0

[State 101, Keep dash facing]
type = AssertSpecial
trigger1 = 1
flag = NoAutoTurn

[State 101, Stop]
type = ChangeState
trigger1 = 1
value = 102

[Statedef 102]
type = S
physics = N
ctrl = 0
anim = 102
`);

  it('keeps facing on the asserted transition tick and deasserts on the next tick', () => {
    const initial = createInitialGameState();
    const crossed = {
      ...initial,
      players: [
        { ...initial.players[0], stateNo: 101, stateTime: 0, x: 500, facing: 1 as const },
        { ...initial.players[1], x: 400, facing: -1 as const },
      ] as typeof initial.players,
    };

    const transitionRuntime = stepCnsStateRuntime(crossed, cns).state;
    expect(transitionRuntime.players[0]).toMatchObject({ stateNo: 102, noAutoTurn: true, facing: 1 });

    const transitionStage = applyFallbackStageRules(transitionRuntime);
    expect(transitionStage.players[0].facing).toBe(1);
    expect(transitionStage.hitDiagnosticLines?.at(-1)).toContain('noAutoTurn=1,0');

    const nextRuntime = stepCnsStateRuntime(transitionStage, cns).state;
    expect(nextRuntime.players[0].noAutoTurn).toBe(false);

    const nextStage = applyFallbackStageRules(nextRuntime);
    expect(nextStage.players[0].facing).toBe(-1);
  });

  it('keeps the bundled T-H-M-A State 101 facing when it enters State 102', () => {
    const realCns = parseCnsText(readFileSync('public/chars/T-H-M-A/T-H-M-A/T-H-M-A.cns', 'utf8'));
    const initial = createInitialGameState();
    const crossed = {
      ...initial,
      players: [
        { ...initial.players[0], stateNo: 101, stateTime: 8, animNo: 101, x: 500, facing: 1 as const },
        { ...initial.players[1], x: 400, facing: -1 as const },
      ] as typeof initial.players,
    };

    const runtime = stepCnsStateRuntime(crossed, realCns, { p1Commands: new Set() }).state;
    expect(runtime.players[0]).toMatchObject({ stateNo: 102, animNo: 107, noAutoTurn: true, facing: 1 });
    expect(applyFallbackStageRules(runtime).players[0].facing).toBe(1);
  });
});
