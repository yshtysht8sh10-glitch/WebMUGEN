import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { stepCnsPhysicsMotion } from '../cns/CnsPhysicsStep';
import { createInitialGameState } from './GameState';
import { applyFallbackHitRecovery } from './FallbackHitRecovery';
import type { GameState, PlayerState } from './types';

const common = parseCnsText(readFileSync('public/chars/common1.cns', 'utf8'));

function airHitPlayer(fall: boolean, recover = true): PlayerState {
  const player = createInitialGameState().players[1];
  return {
    ...player,
    y: 240,
    stateNo: 5020,
    stateType: 'A',
    moveType: 'H',
    physics: 'N',
    ctrl: false,
    animNo: 5000,
    vx: -3,
    vy: -5,
    hitVelX: -3,
    hitVelY: -5,
    hitFall: fall,
    fallRecover: recover,
    fallRecoverTime: 3,
    hitFallVelocity: { x: 0, y: 0 },
    getHitVars: {
      animtype: 0, airtype: 1, hittime: 2, xvel: -3, yvel: -5, yaccel: 0.6,
      fall: fall ? 1 : 0, 'fall.xvel': 0, 'fall.yvel': 0, 'fall.recover': recover ? 1 : 0,
      'fall.recovertime': 3, 'fall.damage': 0, 'down.hittime': 3,
    },
    hitStun: {
      activeHitDefId: 9, selectedHitTime: 2, kind: 'air', source: 'active_hitdef',
      targetStateTypeAtHit: 'A', elapsed: 0, lastStateNo: 5020, selectedAnim: 5000,
    },
  };
}

function tick(state: GameState, p2Commands?: ReadonlySet<string>): GameState {
  const cns = stepCnsStateRuntime(state, common, { p2Commands }).state;
  const moved = stepCnsPhysicsMotion(cns, common);
  return applyFallbackHitRecovery(moved);
}

describe('air hit common-state integration', () => {
  it('restores configured hit velocity and follows non-fall recovery through landing', () => {
    const initial = createInitialGameState();
    let state: GameState = { ...initial, players: [initial.players[0], airHitPlayer(false)] };
    state = tick(state);
    expect(state.players[1]).toMatchObject({ stateNo: 5035, vx: -3, vy: -5, stateType: 'A' });

    for (let frame = 0; frame < 40 && state.players[1].stateNo !== 0; frame += 1) state = tick(state);
    expect(state.players[1]).toMatchObject({ stateNo: 0, stateType: 'S', moveType: 'I', ctrl: true, y: 285, vy: 0 });
  });

  it('follows fall through State 5050 to down and uses down.hittime for getup', () => {
    const initial = createInitialGameState();
    let state: GameState = { ...initial, players: [initial.players[0], airHitPlayer(true, false)] };
    const visited = new Set<number>();
    for (let frame = 0; frame < 80 && state.players[1].stateNo !== 5120; frame += 1) {
      state = tick(state, new Set(['recovery']));
      visited.add(state.players[1].stateNo);
    }
    expect(visited).toContain(5050);
    expect(Array.from(visited)).toContain(5110);
    expect(Array.from(visited)).not.toContain(5101);
    expect(state.players[1]).toMatchObject({ stateNo: 5120, moveType: 'I', ctrl: false });
  });

  it('allows recovery only after fall.recovertime when fall.recover is enabled', () => {
    const player = airHitPlayer(true, true);
    expect(player.fallRecoverTime).toBe(3);
    let state: GameState = { ...createInitialGameState(), players: [createInitialGameState().players[0], player] };
    state = tick(state, new Set(['recovery']));
    expect(state.players[1].stateNo).not.toBe(5200);
    for (let frame = 0; frame < 30 && ![5200, 5210].includes(state.players[1].stateNo); frame += 1) {
      state = tick(state, new Set(['recovery']));
    }
    expect([5200, 5210]).toContain(state.players[1].stateNo);
  });
});
