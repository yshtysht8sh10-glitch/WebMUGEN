import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { createInitialGameState } from './GameState';
import type { PlayerState } from './types';

const common = parseCnsText(readFileSync('public/chars/common1.cns', 'utf8'));

type RouteCase = {
  name: string;
  stateNo: 5000 | 5010 | 5020;
  targetStateTypeAtHit: 'S' | 'C' | 'A';
  yvel: number;
  fall: 0 | 1;
  groundtype?: number;
  expected: number;
};

function getHitPlayer(testCase: RouteCase): PlayerState {
  const player = createInitialGameState().players[1];
  return {
    ...player,
    stateNo: testCase.stateNo,
    stateType: testCase.targetStateTypeAtHit,
    moveType: 'H',
    physics: 'N',
    ctrl: false,
    hitPause: 0,
    hitVelY: testCase.yvel,
    hitFall: testCase.fall === 1,
    getHitVars: {
      yvel: testCase.yvel,
      fall: testCase.fall,
      groundtype: testCase.groundtype ?? 1,
      animtype: 0,
      xvel: -5.5,
      hittime: 20,
    },
    hitStun: {
      activeHitDefId: 42,
      selectedHitTime: 20,
      kind: testCase.targetStateTypeAtHit === 'A' ? 'air' : 'ground',
      source: 'active_hitdef',
      targetStateTypeAtHit: testCase.targetStateTypeAtHit,
      elapsed: 0,
      lastStateNo: testCase.stateNo,
      getHitVarYVelocitySource: testCase.targetStateTypeAtHit === 'A' ? 'air.velocity.y' : 'ground.velocity.y',
      groundVelocityAtHit: { x: -5.5, y: testCase.targetStateTypeAtHit === 'A' ? 0 : testCase.yvel },
      airVelocityAtHit: { x: -2.5, y: testCase.targetStateTypeAtHit === 'A' ? testCase.yvel : 8 },
      fallYVelocityAtHit: -4,
    },
  };
}

describe('ground hit common-state routing', () => {
  it.each<RouteCase>([
    { name: 'ground yvel=0 fall=0', stateNo: 5000, targetStateTypeAtHit: 'S', yvel: 0, fall: 0, expected: 5001 },
    { name: 'ground yvel!=0 fall=0', stateNo: 5000, targetStateTypeAtHit: 'S', yvel: 8, fall: 0, expected: 5030 },
    { name: 'ground yvel=0 fall=1', stateNo: 5000, targetStateTypeAtHit: 'S', yvel: 0, fall: 1, expected: 5030 },
    { name: 'air target', stateNo: 5020, targetStateTypeAtHit: 'A', yvel: 8, fall: 0, expected: 5030 },
    { name: 'crouch yvel=0 fall=0', stateNo: 5010, targetStateTypeAtHit: 'C', yvel: 0, fall: 0, expected: 5011 },
    { name: 'crouch yvel!=0 fall=0', stateNo: 5010, targetStateTypeAtHit: 'C', yvel: 8, fall: 0, expected: 5030 },
    { name: 'trip/fall', stateNo: 5000, targetStateTypeAtHit: 'S', yvel: 0, fall: 1, groundtype: 3, expected: 5030 },
  ])('$name routes to $expected', (testCase) => {
    const initial = createInitialGameState();
    const result = stepCnsStateRuntime({
      ...initial,
      players: [initial.players[0], getHitPlayer(testCase)],
    }, common, { hitDiagnostics: true });

    const diagnostics = result.state.players[1].hitDiagnosticLines?.join('\n') ?? '';
    if (testCase.stateNo === 5000 && testCase.yvel === 0 && testCase.fall === 0) {
      expect(diagnostics).toContain('value=5001 result=1 yvel=0 fall=0 hitShakeOver=1');
      expect(diagnostics).toContain('value=5030 result=1 yvel=0 fall=0 hitShakeOver=1');
    }
    expect(diagnostics).toContain(`from=${testCase.stateNo} to=${testCase.expected} stopRemaining=1`);
    expect(result.state.players[1].stateNo, diagnostics).toBe(testCase.expected === 5030 ? 5035 : testCase.expected);
  });
});
