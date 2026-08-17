import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { stepCnsPhysicsMotion } from '../cns/CnsPhysicsStep';

const source = readFileSync('public/chars/T-H-M-A/T-H-M-A/T-H-M-Atyouhi.cns', 'utf8');
const parsed = parseCnsText(source);
const states = [3910, 3425, 3970]
  .map((stateNo) => parsed.states.find((state) => state.stateNo === stateNo))
  .filter((state): state is NonNullable<typeof state> => Boolean(state));
const document = { metadataSections: parsed.metadataSections, states };

describe('T-H-M-A Darkness Finger Shinuchi ownership compatibility', () => {
  it('retains the real opening HitDef custom state and p2facing request', () => {
    const initial = createInitialGameState();
    const result = stepCnsStateRuntime({
      ...initial,
      players: [{
        ...initial.players[0], stateNo: 3910, stateTime: 0, animNo: 3910,
        stateType: 'S', moveType: 'A', physics: 'N', facing: 1,
      }, initial.players[1]],
    }, document, {
      getAnimationTriggerInfo: () => ({
        elementNo: 1, elementTime: 0, elementStarted: true, elementCount: 7, elementTimes: [0, 3, 6, 9, 12, 15, 18],
      }),
    }).state;

    expect(result.players[0].activeHitDef).toMatchObject({
      p1StateNo: 3920,
      p2StateNo: 3425,
      p2Facing: 1,
    });
  });

  it('borrows State 3425 AIR while retaining P2 as the sprite-image owner', () => {
    const initial = createInitialGameState();
    initial.players[1] = {
      ...initial.players[1], stateNo: 3425, stateTime: 0, animNo: 5000,
      stateOwnerId: 1, selfStateOwnerId: 2, animationOwnerId: 2,
      stateType: 'A', moveType: 'H', physics: 'N', facing: 1,
    };

    const result = stepCnsStateRuntime(initial, document).state.players[1];

    expect(result).toMatchObject({
      stateNo: 3425,
      animNo: 3425,
      facing: 1,
      stateOwnerId: 1,
      selfStateOwnerId: 2,
      animationOwnerId: 1,
    });
  });

  it('lets the real interrupted Shinuchi State 3970 fall and reach its bounce State', () => {
    const initial = createInitialGameState();
    initial.players[0] = {
      ...initial.players[0], stateNo: 3970, stateTime: 0, animNo: 5050,
      stateType: 'A', moveType: 'H', physics: 'N', ctrl: false,
      y: 285, vy: 0, getHitVars: { yaccel: 0.75 },
    };

    let state = initial;
    const visited = [state.players[0].stateNo];
    for (let frame = 0; frame < 20 && state.players[0].stateNo === 3970; frame += 1) {
      state = stepCnsPhysicsMotion(stepCnsStateRuntime(state, document).state, document);
      visited.push(state.players[0].stateNo);
    }

    expect(visited).toContain(5100);
    expect(state.players[0].vy).toBeGreaterThan(0);
  });
});
