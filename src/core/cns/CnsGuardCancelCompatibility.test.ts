import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsStateRuntime } from './CnsStateRuntime';

describe('WinMUGEN State -1 guard-cancel compatibility', () => {
  const cns = parseCnsText(`
[Statedef -1]
[State -1, Guard cancel]
type = ChangeState
value = 720
triggerall = command = "holdfwd"
triggerall = command = "recovery"
triggerall = statetype != A
triggerall = power >= 1000
trigger1 = stateno = 150
trigger2 = stateno = 151
trigger3 = stateno = 152
trigger4 = stateno = 153

[Statedef 150]
type = S
movetype = H
physics = N
ctrl = 0

[Statedef 5000]
type = S
movetype = H
physics = N
ctrl = 0

[Statedef 720]
type = S
movetype = A
physics = S
anim = 720 + (ifelse(var(3)=0,1,0))*20000
ctrl = 0
poweradd = -1000
`);

  function guardedPlayer(hitPause = 0) {
    const initial = createInitialGameState();
    return {
      ...initial.players[0],
      stateNo: 150,
      stateHeaderAppliedStateNo: 150,
      stateTime: 4,
      stateType: 'S' as const,
      moveType: 'H' as const,
      physics: 'N' as const,
      ctrl: false,
      animNo: 150,
      power: 1000,
      hitPause,
      vars: { 3: 0 },
      getHitVars: { guarded: 1, ctrltime: 15 },
      hitStun: {
        activeHitDefId: 700,
        selectedHitTime: 15,
        kind: 'ground' as const,
        source: 'active_hitdef' as const,
        targetStateTypeAtHit: 'S' as const,
        elapsed: 4,
        lastStateNo: 150,
      },
    };
  }

  it('executes the authored State 150 guard-cancel route after HitPause', () => {
    const initial = createInitialGameState();
    const result = stepCnsStateRuntime({
      ...initial,
      players: [guardedPlayer(), initial.players[1]],
    }, cns, { p1Commands: new Set(['holdfwd', 'recovery']) });

    expect(result.state.players[0]).toMatchObject({
      prevStateNo: 150,
      stateNo: 720,
      stateType: 'S',
      moveType: 'A',
      physics: 'S',
      ctrl: false,
      animNo: 20720,
      animTime: 0,
      power: 0,
    });
    expect(result.traces[0].executedControllers).toContain('ChangeState');
  });

  it('does not execute the same route during HitPause without ignorehitpause', () => {
    const initial = createInitialGameState();
    const result = stepCnsStateRuntime({
      ...initial,
      players: [guardedPlayer(2), initial.players[1]],
    }, cns, { p1Commands: new Set(['holdfwd', 'recovery']) });

    expect(result.state.players[0]).toMatchObject({ stateNo: 150, power: 1000, hitPause: 2 });
  });

  it('leaves the route decision to the authored State and power triggers', () => {
    const initial = createInitialGameState();
    const normalHit = {
      ...guardedPlayer(),
      stateNo: 5000,
      stateHeaderAppliedStateNo: 5000,
      animNo: 5000,
      getHitVars: { guarded: 0 },
      hitStun: { ...guardedPlayer().hitStun!, lastStateNo: 5000 },
    };
    const insufficient = { ...guardedPlayer(), power: 999 };

    const hitResult = stepCnsStateRuntime({
      ...initial,
      players: [normalHit, initial.players[1]],
    }, cns, { p1Commands: new Set(['holdfwd', 'recovery']) });
    const powerResult = stepCnsStateRuntime({
      ...initial,
      players: [insufficient, initial.players[1]],
    }, cns, { p1Commands: new Set(['holdfwd', 'recovery']) });

    expect(hitResult.state.players[0]).toMatchObject({ stateNo: 5000, power: 1000 });
    expect(powerResult.state.players[0]).toMatchObject({ stateNo: 150, power: 999 });
  });
});
