import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { stepCnsPhysicsMotion } from '../cns/CnsPhysicsStep';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { applyFallbackHitRecovery } from './FallbackHitRecovery';
import { createInitialGameState } from './GameState';
import type { GameState } from './types';

const common = parseCnsText(readFileSync('public/chars/common1.cns', 'utf8'));

describe('guard common-state integration', () => {
  it('uses unmodified standing GuardHit states and returns to standing guard', () => {
    const initial = createInitialGameState();
    let state: GameState = {
      ...initial,
      players: [{ ...initial.players[0], x: 370 }, {
        ...initial.players[1], stateNo: 150, animNo: 150, moveType: 'H', physics: 'N', ctrl: false,
        vx: -2, hitVelX: -2, getHitVars: { guarded: 1, slidetime: 0, ctrltime: 2 },
        hitStun: {
          activeHitDefId: 5, selectedHitTime: 5, kind: 'ground', source: 'active_hitdef',
          targetStateTypeAtHit: 'S', elapsed: 0, lastStateNo: 150, selectedAnim: 150,
        },
      }],
    };

    const visited: number[] = [];
    const recoilControl: boolean[] = [];
    for (let frame = 0; frame < 10 && state.players[1].stateNo !== 130; frame += 1) {
      const cns = stepCnsStateRuntime(state, common, { p2Commands: new Set(['holdback']) });
      visited.push(cns.state.players[1].stateNo);
      if (cns.state.players[1].stateNo === 151) recoilControl.push(cns.state.players[1].ctrl);
      state = applyFallbackHitRecovery(stepCnsPhysicsMotion(cns.state, common));
    }

    expect(visited).toContain(151);
    expect(recoilControl[0]).toBe(false);
    expect(recoilControl).toContain(true);
    expect(state.players[1]).toMatchObject({ stateNo: 130, stateType: 'S' });
    expect(state.players[1].hitStun).toBeUndefined();

    const released = stepCnsStateRuntime(state, common).state;
    expect(released.players[1]).toMatchObject({ stateNo: 140, stateType: 'S' });
  });
});
