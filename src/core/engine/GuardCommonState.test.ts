import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getMugenAnimEndTime } from '../animation/AnimationDuration';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { parseAirText } from '../../parser/air/AirParser';
import { mergeCnsDocuments, mergeMissingCnsStates } from '../character/CharacterLoader';
import { stepCnsPhysicsMotion } from '../cns/CnsPhysicsStep';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { applyFallbackHitRecovery } from './FallbackHitRecovery';
import { createInitialGameState } from './GameState';
import type { GameState } from './types';

const common = parseCnsText(readFileSync('public/chars/common1.cns', 'utf8'));
const commonControl = parseCnsText(readFileSync('public/chars/common.cmd', 'utf8'));
const itokoAir = parseAirText(readFileSync('public/chars/itoko/itoko.air', 'utf8'));
const itokoWithCommon = mergeMissingCnsStates(
  mergeMissingCnsStates(
    mergeCnsDocuments(
      parseCnsText(readFileSync('public/chars/itoko/itoko.cns', 'utf8')),
      parseCnsText(readFileSync('public/chars/itoko/itoko.cmd', 'utf8')),
    ),
    common,
  ),
  commonControl,
);

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

  it.each([
    { stateType: 'S' as const, physics: 'S' as const, animNo: 145, destination: 0 },
    { stateType: 'C' as const, physics: 'C' as const, animNo: 146, destination: 11 },
    { stateType: 'A' as const, physics: 'A' as const, animNo: 142, destination: 51 },
  ])('leaves itoko guard end for StateType $stateType when its finite animation ends', ({ stateType, physics, animNo, destination }) => {
    const initial = createInitialGameState();
    const animationEndTime = getMugenAnimEndTime(itokoAir, animNo);
    expect(animationEndTime).not.toBeNull();

    const state: GameState = {
      ...initial,
      players: [{
        ...initial.players[0],
        stateNo: 140,
        stateTime: animationEndTime!,
        stateType,
        physics,
        ctrl: true,
        animNo,
        animTime: animationEndTime!,
        vars: { 1: 1 },
        y: stateType === 'A' ? initial.players[0].y - 20 : initial.players[0].y,
        vy: stateType === 'A' ? -1 : 0,
      }, initial.players[1]],
    };

    const result = stepCnsStateRuntime(state, itokoWithCommon, {
      p1Commands: stateType === 'C' ? new Set(['holddown']) : new Set(),
      getAnimationDuration: (actionNo) => getMugenAnimEndTime(itokoAir, actionNo),
    });

    expect(result.state.players[0]).toMatchObject({
      prevStateNo: 140,
      stateNo: destination,
      stateTime: 0,
      vars: expect.objectContaining({ 1: 0 }),
    });
    expect(result.traces[0]).toMatchObject({ stateNo: 140, afterStateNo: destination, mugenAnimTime: 0 });
  });

  it('clears itoko strong-guard mode after State 201 before the next y attack', () => {
    const initial = createInitialGameState();
    const attackEndTime = getMugenAnimEndTime(itokoAir, 201);
    expect(attackEndTime).not.toBeNull();

    let state: GameState = {
      ...initial,
      players: [{
        ...initial.players[0],
        stateNo: 201,
        stateTime: attackEndTime!,
        stateType: 'S',
        moveType: 'A',
        physics: 'S',
        ctrl: false,
        animNo: 201,
        animTime: attackEndTime!,
      }, initial.players[1]],
    };
    const input = {
      getAnimationDuration: (actionNo: number) => getMugenAnimEndTime(itokoAir, actionNo),
    };

    state = stepCnsStateRuntime(state, itokoWithCommon, {
      ...input,
      p1Commands: new Set(['hold_z']),
    }).state;
    expect(state.players[0]).toMatchObject({ stateNo: 130, vars: expect.objectContaining({ 1: 1 }) });

    state = stepCnsStateRuntime(state, itokoWithCommon, input).state;
    expect(state.players[0]).toMatchObject({ stateNo: 140, vars: expect.objectContaining({ 1: 0 }) });

    state = stepCnsStateRuntime(state, itokoWithCommon, input).state;
    expect(state.players[0].vars?.[1]).toBe(0);

    state = stepCnsStateRuntime(state, itokoWithCommon, {
      ...input,
      p1Commands: new Set(['y']),
    }).state;
    expect(state.players[0].stateNo).toBe(200);
  });
});
