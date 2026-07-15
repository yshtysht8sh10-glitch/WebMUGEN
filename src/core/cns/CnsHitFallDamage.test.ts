import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsStateRuntime } from './CnsStateRuntime';

const cns = parseCnsText(`
[Statedef 5100]
type = L
movetype = H
physics = N
[State 5100, Fall damage]
type = HitFallDamage
trigger1 = 1
[State 5100, Fall shake]
type = FallEnvShake
trigger1 = 1
`);

describe('HitFallDamage HitDef integration', () => {
  it.each([
    [0, 1],
    [1, 0],
  ])('applies fall.damage once with fall.kill=%i', (fallKill, expectedLife) => {
    const initial = createInitialGameState();
    const shakes: Array<{ time: number; frequency: number; amplitude: number; phase: number }> = [];
    const result = stepCnsStateRuntime({
      ...initial,
      players: [{
        ...initial.players[0],
        stateNo: 5100,
        stateType: 'L',
        moveType: 'H',
        life: 10,
        hitStun: {
          activeHitDefId: 77,
          selectedHitTime: 10,
          kind: 'air',
          source: 'active_hitdef',
          targetStateTypeAtHit: 'A',
          elapsed: 1,
          lastStateNo: 5100,
        },
        getHitVars: {
          'fall.damage': 20,
          'fall.kill': fallKill,
          'fall.envshake.time': 5,
          'fall.envshake.freq': 80,
          'fall.envshake.ampl': -6,
          'fall.envshake.phase': 30,
        },
      }, initial.players[1]],
    }, cns, { onEnvironmentShake: (event) => shakes.push(event) }).state.players[0];

    expect(result.life).toBe(expectedLife);
    expect(result.hitDiagnosticLines?.join('\n')).toContain(`lifeBefore=10 damage=20 lifeAfter=${expectedLife} kill=${fallKill} result=applied`);
    expect(result.hitDiagnosticLines?.join('\n')).toContain('raw.fall_envshake');
    expect(shakes).toEqual([{ time: 5, frequency: 80, amplitude: -6, phase: 30 }]);
  });
});
