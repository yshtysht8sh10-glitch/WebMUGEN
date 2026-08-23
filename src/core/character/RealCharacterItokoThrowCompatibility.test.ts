import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseAirText } from '../../parser/air/AirParser';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { getMugenAnimEndTime } from '../animation/AnimationDuration';
import { getAnimationTriggerInfo, getCurrentAnimationElement } from '../animation/AnimationPlayer';
import { getPresentedAnimationTime } from '../animation/PresentedAnimation';
import { stepCnsPhysicsMotion } from '../cns/CnsPhysicsStep';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { applyFallbackHitRecovery } from '../engine/FallbackHitRecovery';
import { resolveFallbackHits } from '../engine/FallbackHitResolver';
import { createInitialGameState } from '../engine/GameState';

const decoder = new TextDecoder('shift_jis');
const cns = parseCnsText(decoder.decode(readFileSync('public/chars/itoko/itoko.cns')));
const air = parseAirText(decoder.decode(readFileSync('public/chars/itoko/itoko.air')));
const runtimeInput = {
  getAnimationDuration: (animNo: number) => getMugenAnimEndTime(air, animNo),
  getAnimationTriggerInfo: (animNo: number, animTime: number) => getAnimationTriggerInfo(air, animNo, animTime),
  getAnimationElementNo: (animNo: number, animTime: number) => getCurrentAnimationElement(air, animNo, animTime)?.elementIndex === undefined
    ? null
    : getCurrentAnimationElement(air, animNo, animTime)!.elementIndex + 1,
};

describe('itoko Z+X throw compatibility', () => {
  it('restarts the State 710 throw animation after HitDef p1stateno entry', () => {
    const initial = createInitialGameState();
    let state = {
      ...initial,
      players: [
        {
          ...initial.players[0],
          x: 240,
          stateNo: 700,
          stateHeaderAppliedStateNo: 700,
          stateTime: 18,
          animNo: 700,
          animTime: 18,
          moveType: 'A' as const,
          ctrl: false,
        },
        {
          ...initial.players[1],
          x: 250,
          stateNo: 0,
          stateHeaderAppliedStateNo: 0,
          animNo: 0,
          animTime: 0,
        },
      ] as typeof initial.players,
    };

    state = stepCnsStateRuntime(state, cns, runtimeInput).state;
    state = resolveFallbackHits(state, air, true);
    expect(state.players[0]).toMatchObject({ stateNo: 710, animNo: 700, animTime: 18, hitPause: 5 });
    expect(state.players[1]).toMatchObject({ stateNo: 711, stateOwnerId: 1, hitPause: 4 });

    for (let frame = 0; frame < 5; frame += 1) {
      state = stepCnsStateRuntime(state, cns, runtimeInput).state;
      state = applyFallbackHitRecovery(stepCnsPhysicsMotion(state, cns), false);
    }

    const firstActivePass = stepCnsStateRuntime(state, cns, runtimeInput).state;
    expect(firstActivePass.players[0]).toMatchObject({ stateNo: 710, animNo: 710, animTime: 0 });

    state = applyFallbackHitRecovery(stepCnsPhysicsMotion(firstActivePass, cns), false);
    for (let frame = 0; frame < 33; frame += 1) {
      state = stepCnsStateRuntime(state, cns, runtimeInput).state;
      state = applyFallbackHitRecovery(stepCnsPhysicsMotion(state, cns), false);
    }

    // Anim 713 is P2's lying frame. P1 must still be completing Anim 710;
    // inheriting Anim 700's time incorrectly moved P1 to State 720 first.
    expect(state.players[0]).toMatchObject({ stateNo: 710, animNo: 710 });
    expect(state.players[1]).toMatchObject({ stateNo: 711, animNo: 713 });
  });

  it('routes a ready State 5110 directly through State 5120 into the rolling get-up', () => {
    const initial = createInitialGameState();
    const x = 300;
    const state = {
      ...initial,
      players: [
        {
          ...initial.players[0],
          x,
          stateNo: 5110,
          stateHeaderAppliedStateNo: 5110,
          stateTime: 20,
          stateType: 'L' as const,
          moveType: 'H' as const,
          physics: 'N' as const,
          ctrl: false,
          animNo: 5110,
          animTime: 20,
          lieDownElapsed: 60,
          lieDownTime: 60,
        },
        initial.players[1],
      ] as typeof initial.players,
    };

    const result = stepCnsStateRuntime(state, cns, {
      ...runtimeInput,
      p1Commands: new Set(['holdfwd']),
    });

    expect(result.state.players[0]).toMatchObject({
      prevStateNo: 5120,
      stateNo: 730,
      stateTime: 0,
      animNo: 730,
      animTime: 0,
      x: x - 16,
    });
    expect(result.traces[0].executedControllers).toContain('EngineGetUp 5110->5120');
    expect(result.traces[0].executedControllerRefs
      ?.filter((controller) => controller.type === 'ChangeState')
      .map((controller) => controller.stateNo)).toContain(5120);
  });

  it('moves and turns on Animelem 11 before the first element-11 frame is presented', () => {
    const initial = createInitialGameState();
    let state = {
      ...initial,
      players: [{
        ...initial.players[0],
        x: 300,
        facing: 1 as const,
        prevStateNo: 2020,
        stateNo: 730,
        stateHeaderAppliedStateNo: 730,
        stateTime: 29,
        animNo: 730,
        animTime: 29,
      }, initial.players[1]] as typeof initial.players,
    };

    const beforeBoundary = stepCnsStateRuntime(state, cns, runtimeInput);
    expect(beforeBoundary.traces[0].executedControllers).not.toContain('PosAdd');
    state = stepCnsPhysicsMotion(beforeBoundary.state, cns);
    expect(getCurrentAnimationElement(air, 730, getPresentedAnimationTime(state.players[0]))?.element)
      .toMatchObject({ groupNo: 730, imageNo: 10 });
    expect(state.players[0]).toMatchObject({ x: 300, facing: 1, animTime: 30 });

    const atBoundary = stepCnsStateRuntime(state, cns, runtimeInput);
    expect(atBoundary.traces[0].executedControllers).toEqual(expect.arrayContaining(['PosAdd', 'Turn']));
    state = stepCnsPhysicsMotion(atBoundary.state, cns);
    expect(getCurrentAnimationElement(air, 730, getPresentedAnimationTime(state.players[0]))?.element)
      .toMatchObject({ groupNo: 5030, imageNo: 506 });
    expect(state.players[0]).toMatchObject({ x: 353, facing: -1, animTime: 31 });
  });
});
