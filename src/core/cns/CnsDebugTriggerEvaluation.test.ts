import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./CnsRuntimeTrigger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./CnsRuntimeTrigger')>();
  return {
    ...actual,
    evaluateCnsRuntimeTrigger: vi.fn(actual.evaluateCnsRuntimeTrigger),
    evaluatePreparedCnsRuntimeTrigger: vi.fn(actual.evaluatePreparedCnsRuntimeTrigger),
  };
});

import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import { evaluateCnsRuntimeTrigger, evaluatePreparedCnsRuntimeTrigger } from './CnsRuntimeTrigger';
import { stepCnsStateRuntime } from './CnsStateRuntime';

describe('Issue #58 Phase 2 debug trigger evaluation gating', () => {
  const cns = parseCnsText(`
[StateDef -1]
[State -1, Crouch route]
type = ChangeState
triggerall = command = "holddown"
trigger1 = statetype = S
trigger1 = ctrl
value = 10

[StateDef 0]
type = S
physics = S
ctrl = 1

[StateDef 10]
type = C
physics = C
ctrl = 0
`);

  beforeEach(() => {
    vi.mocked(evaluateCnsRuntimeTrigger).mockClear();
    vi.mocked(evaluatePreparedCnsRuntimeTrigger).mockClear();
  });

  it('evaluates each production trigger once when trace diagnostics are disabled', () => {
    const initial = createInitialGameState();
    const result = stepCnsStateRuntime({
      ...initial,
      players: [initial.players[0], { ...initial.players[1], hitPause: 1 }],
    }, cns, {
      p1Commands: new Set(['holddown']),
      traceDiagnostics: false,
      hitDiagnostics: false,
    });

    expect(result.state.players[0].stateNo).toBe(10);
    expect(evaluatePreparedCnsRuntimeTrigger).toHaveBeenCalledTimes(3);
    expect(evaluateCnsRuntimeTrigger).not.toHaveBeenCalled();
  });

  it('keeps the existing crouch-route diagnostics when debug tracing is enabled', () => {
    const initial = createInitialGameState();
    const result = stepCnsStateRuntime({
      ...initial,
      players: [initial.players[0], { ...initial.players[1], hitPause: 1 }],
    }, cns, {
      p1Commands: new Set(['holddown']),
      hitDiagnostics: false,
    });

    expect(result.state.players[0].stateNo).toBe(10);
    expect(evaluatePreparedCnsRuntimeTrigger).toHaveBeenCalledTimes(9);
    expect(evaluateCnsRuntimeTrigger).toHaveBeenCalledTimes(23);
    expect(result.traces[0].debugLines.some((line) => line.includes('eval=['))).toBe(true);
    expect(result.traces[0].debugLines.some((line) => line.includes('STATE10 05 final'))).toBe(true);
  });
});
