import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsStateRuntime } from './CnsStateRuntime';

function targetState(hitDefId = 42) {
  const state = createInitialGameState();
  return {
    ...state,
    players: [
      { ...state.players[0], stateNo: 200, x: 100, y: 20, facing: -1 as const, targets: [{ playerId: 2, hitDefId, activeHitDefId: 7 }] },
      { ...state.players[1], stateNo: 5000, vx: 0, vy: 0, life: 800, power: 100, x: 300, y: 0 },
    ] as typeof state.players,
  };
}

describe('CnsStateRuntime target controllers', () => {
  it('applies common target mutations to the registered target selected by HitDef id', () => {
    const cns = parseCnsText(`
[Statedef 200]
[State 200, VelSet]
type = TargetVelSet
trigger1 = 1
id = 42
x = 3
y = -2
[State 200, VelAdd]
type = TargetVelAdd
trigger1 = 1
id = 42
x = 1
y = .5
[State 200, Life]
type = TargetLifeAdd
trigger1 = 1
id = 42
value = -100
[State 200, Power]
type = TargetPowerAdd
trigger1 = 1
id = 42
value = 50
[State 200, Facing]
type = TargetFacing
trigger1 = 1
id = 42
value = -1
[State 200, Bind]
type = TargetBind
trigger1 = 1
id = 42
time = 5
pos = 10, -20
[State 200, State]
type = TargetState
trigger1 = 1
id = 42
value = 6000
[Statedef 6000]
type = A
movetype = H
physics = N
ctrl = 0
`);

    const result = stepCnsStateRuntime(targetState(), cns);
    expect(result.state.players[1]).toMatchObject({
      stateNo: 6000, stateType: 'A', moveType: 'H', physics: 'N', ctrl: false,
      vx: 4, vy: -1.5, life: 700, power: 150, facing: 1, x: 90, y: 0,
      targetBind: { ownerId: 1, remaining: 5, offsetX: 10, offsetY: -20 },
    });
    expect(result.state.players[0].hitDiagnosticLines?.join('\n')).toContain('raw.target_controller owner=p1 controller=TargetState');
  });

  it('safely does nothing and logs a diagnostic when id does not match', () => {
    const cns = parseCnsText(`
[Statedef 200]
[State 200, Missing]
type = TargetLifeAdd
trigger1 = 1
id = 99
value = -100
`);
    const result = stepCnsStateRuntime(targetState(), cns);
    expect(result.state.players[1].life).toBe(800);
    expect(result.state.players[0].hitDiagnosticLines?.join('\n')).toContain('result=noop reason=target_not_found');
  });

  it('safely does nothing when the owner has no registered target', () => {
    const cns = parseCnsText(`
[Statedef 200]
[State 200, NoTarget]
type = TargetVelSet
trigger1 = 1
x = 9
`);
    const state = targetState();
    state.players[0].targets = [];
    const result = stepCnsStateRuntime(state, cns);
    expect(result.state.players[1].vx).toBe(0);
    expect(result.state.players[0].hitDiagnosticLines?.join('\n')).toContain('targets=none result=noop reason=target_not_found');
  });

  it('prevents later target controllers from mutating a target after TargetDrop', () => {
    const cns = parseCnsText(`
[Statedef 200]
[State 200, Drop]
type = TargetDrop
trigger1 = 1
id = 42
[State 200, TooLate]
type = TargetLifeAdd
trigger1 = 1
id = 42
value = -100
`);
    const result = stepCnsStateRuntime(targetState(), cns);
    expect(result.state.players[0].targets).toEqual([]);
    expect(result.state.players[1].life).toBe(800);
    expect(result.state.players[0].hitDiagnosticLines?.join('\n')).toContain('controller=TargetDrop');
  });
});
