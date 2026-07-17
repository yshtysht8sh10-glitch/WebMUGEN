import { describe, expect, it } from 'vitest';

import { parseCnsText } from '../../parser/cns/CnsParser';
import { prepareCnsControllerTriggerGroups } from '../../mugen/common/CnsTriggerGroups';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsStateRuntime } from './CnsStateRuntime';

describe('Issue #58 Phase 3 controller Trigger group cache', () => {
  it('builds triggerall and numbered groups once in source evaluation order', () => {
    const cns = parseCnsText(`
[StateDef 0]
type = S
ctrl = 1

[State 0, Group order]
type = VarSet
triggerall = ctrl
trigger2 = Time = 99
trigger1 = Time = 0
trigger1 = Var(0) = 0
v = 0
value = 7
`);
    const controller = cns.states[0].controllers[0];
    const cached = controller.triggerGroups;

    expect(cached?.triggerAll.map((trigger) => trigger.expression)).toEqual(['ctrl']);
    expect(cached?.groups.map((group) => group.number)).toEqual([2, 1]);
    expect(cached?.groups.map((group) => group.triggers.map((trigger) => trigger.expression))).toEqual([
      ['Time = 99'],
      ['Time = 0', 'Var(0) = 0'],
    ]);
    expect(cached?.sortedGroups.map((group) => group.number)).toEqual([1, 2]);

    const first = stepCnsStateRuntime(createInitialGameState(), cns, {
      traceDiagnostics: false,
      hitDiagnostics: false,
    });
    const second = stepCnsStateRuntime(first.state, cns, {
      traceDiagnostics: false,
      hitDiagnostics: false,
    });

    expect(first.state.players[0].vars[0]).toBe(7);
    expect(second.state.players[0].vars[0]).toBe(7);
    expect(controller.triggerGroups).toBe(cached);
    expect(controller.triggerGroups?.triggerAll).toBe(cached?.triggerAll);
    expect(controller.triggerGroups?.groups).toBe(cached?.groups);
    expect(controller.triggerGroups?.groups[1].triggers).toBe(cached?.groups[1].triggers);
  });

  it('rebuilds a copied Controller cache when its Trigger array is replaced', () => {
    const original = parseCnsText('[StateDef 0]\n[State 0, Original]\ntype = Null\ntrigger1 = 0')
      .states[0].controllers[0];
    const replacement = {
      ...original,
      triggers: [{ name: 'trigger2', expression: '1' }],
    };

    const regrouped = prepareCnsControllerTriggerGroups(replacement);

    expect(regrouped).not.toBe(original.triggerGroups);
    expect(regrouped.sourceTriggers).toBe(replacement.triggers);
    expect(regrouped.groups.map((group) => group.number)).toEqual([2]);
  });
});
