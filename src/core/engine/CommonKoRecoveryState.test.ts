import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { stepCnsPhysicsMotion } from '../cns/CnsPhysicsStep';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { createInitialGameState } from './GameState';
import { createInitialRoundState, stepRoundState, type RoundState } from './RoundState';
import type { GameState, PlayerState } from './types';

const common = parseCnsText(readFileSync('public/chars/common1.cns', 'utf8'));
const animations = new Set([0, 52, 5000, 5030, 5050, 5100, 5110, 5120, 5140, 5150, 5200, 5210]);
const animationDuration = (animNo: number) => animations.has(animNo) ? 2 : null;

function withP2(player: PlayerState): GameState {
  const state = createInitialGameState();
  return { ...state, players: [state.players[0], player] };
}

function koLiedownPlayer(patch: Partial<PlayerState> = {}): PlayerState {
  return {
    ...createInitialGameState().players[1],
    life: 0,
    koReason: 'hit',
    stateNo: 5110,
    stateTime: 0,
    stateType: 'L',
    moveType: 'H',
    physics: 'N',
    ctrl: false,
    animNo: 5110,
    animTime: 2,
    getHitVars: { kill: 1, 'guard.kill': 1, 'fall.kill': 1, 'fall.damage': 0, 'fall.yvel': 0 },
    ...patch,
  };
}

describe('common KO and fall-recovery states', () => {
  it.each([
    { dead: 1, winner: 2 },
    { dead: 2, winner: 1 },
  ] as const)('enters KO round phase when P$dead is defeated', ({ dead, winner }) => {
    const state = createInitialGameState();
    const players = [...state.players] as typeof state.players;
    players[dead - 1] = { ...players[dead - 1], life: 0 };
    const round = stepRoundState({ ...createInitialRoundState(), phase: 'fight' }, { ...state, players });
    expect(round).toMatchObject({ phase: 'ko', winner, endReason: 'ko' });
  });

  it('distinguishes simultaneous KO from time over', () => {
    const state = createInitialGameState();
    const doubleKo = stepRoundState({ ...createInitialRoundState(), phase: 'fight' }, {
      ...state,
      players: [{ ...state.players[0], life: 0 }, { ...state.players[1], life: 0 }],
    });
    expect(doubleKo).toMatchObject({ phase: 'ko', winner: 'draw', endReason: 'double_ko' });

    let timeOver: RoundState = { ...createInitialRoundState(), phase: 'fight', timer: 1, frameInPhase: 59 };
    timeOver = stepRoundState(timeOver, state);
    expect(timeOver).toMatchObject({ phase: 'timeOver', winner: 'draw', endReason: 'time_over' });
  });

  it('enters State 5150 from KO liedown and selects the MatchOver animation on the next round frame', () => {
    let state = stepCnsStateRuntime(withP2(koLiedownPlayer()), common, {
      getAnimationDuration: animationDuration,
      hitDiagnostics: true,
      roundState: 2,
      roundNo: 1,
      matchOver: false,
      roundWinner: null,
    }).state;
    expect(state.players[1]).toMatchObject({ stateNo: 5150, animNo: 5140, stateType: 'L', moveType: 'H', ctrl: false });

    state = stepCnsStateRuntime(state, common, {
      getAnimationDuration: animationDuration,
      hitDiagnostics: true,
      roundState: 3,
      roundNo: 1,
      matchOver: true,
      roundWinner: 1,
      roundEndReason: 'ko',
    }).state;
    expect(state.players[1]).toMatchObject({ stateNo: 5150, animNo: 5150, ctrl: false });
    expect(state.players[1].hitAttributeSlots?.[0]).toMatchObject({ mode: 'deny', value: 'SCA', time: 1 });
    expect(state.players[1].hitDiagnosticLines?.join('\n')).toContain('koReason=hit');
    expect(state.players[1].hitDiagnosticLines?.join('\n')).toContain('roundEndReason=ko');
  });

  it('takes a lethal grounded get-hit through the common fall/down route into 5150', () => {
    const player = koLiedownPlayer({
      stateNo: 5000,
      stateType: 'S',
      animNo: 5000,
      animTime: 0,
      y: 285,
      vy: 0,
      hitStun: {
        activeHitDefId: 8,
        selectedHitTime: 0,
        kind: 'ground',
        source: 'active_hitdef',
        targetStateTypeAtHit: 'S',
        elapsed: 0,
        lastStateNo: 5000,
      },
      getHitVars: {
        animtype: 0, groundtype: 1, yvel: 0, yaccel: 0.6, fall: 1,
        'fall.damage': 0, 'fall.kill': 1, 'fall.yvel': -4.5,
      },
    });
    let state = withP2(player);
    for (let frame = 0; frame < 20 && state.players[1].stateNo !== 5150; frame += 1) {
      state = stepCnsStateRuntime(state, common, { getAnimationDuration: animationDuration }).state;
      state = stepCnsPhysicsMotion(state, common);
    }
    expect(state.players[1]).toMatchObject({ life: 0, stateNo: 5150, ctrl: false });
  });

  it('uses Anim 5110 when no lie-dead animation exists', () => {
    const state = stepCnsStateRuntime(withP2(koLiedownPlayer({ stateNo: 5150, animNo: 999, animTime: 0 })), common, {
      getAnimationDuration: (animNo) => animNo === 5110 ? 2 : null,
      roundState: 3,
      matchOver: true,
      roundWinner: 1,
    }).state;
    expect(state.players[1]).toMatchObject({ stateNo: 5150, animNo: 5110, ctrl: false });
  });

  it('waits for defender hitpause to end before the common KO route executes', () => {
    const player = koLiedownPlayer({ hitPause: 1 });
    let state = stepCnsStateRuntime(withP2(player), common, { getAnimationDuration: animationDuration }).state;
    expect(state.players[1]).toMatchObject({ stateNo: 5110, stateTime: 0, hitPause: 1 });

    state = stepCnsPhysicsMotion(state, common);
    expect(state.players[1]).toMatchObject({ stateNo: 5110, stateTime: 0, hitPause: 0 });

    state = stepCnsStateRuntime(state, common, { getAnimationDuration: animationDuration }).state;
    expect(state.players[1]).toMatchObject({ stateNo: 5150, ctrl: false });
  });

  it('keeps a KO player in 5150 even when recovery input is buffered', () => {
    let state = withP2(koLiedownPlayer({ stateNo: 5150, animNo: 5140, animTime: 0 }));
    for (let frame = 0; frame < 10; frame += 1) {
      state = stepCnsStateRuntime(state, common, {
        getAnimationDuration: animationDuration,
        p2Commands: new Set(['recovery']),
        roundState: 3,
        matchOver: true,
        roundWinner: 1,
        roundEndReason: 'ko',
      }).state;
      state = stepCnsPhysicsMotion(state, common);
    }
    expect(state.players[1]).toMatchObject({ life: 0, stateNo: 5150, ctrl: false });
  });

  it('routes near-ground recovery through 5200 into 5201 with recovery immunity', () => {
    const player = {
      ...koLiedownPlayer(),
      life: 500,
      koReason: undefined,
      stateNo: 5200,
      stateType: 'A' as const,
      animNo: 5050,
      animTime: 0,
      y: 295,
      vy: 1,
      getHitVars: { yaccel: 0.6, fall: 1, 'fall.recover': 1, 'fall.recovertime': 4 },
    };
    const state = stepCnsStateRuntime(withP2(player), common, { getAnimationDuration: animationDuration, hitDiagnostics: true }).state;
    expect(state.players[1]).toMatchObject({ stateNo: 5201, animNo: 5200, y: 285, vy: -3.5, stateType: 'A', moveType: 'H' });
    expect(state.players[1].hitAttributeSlots?.[0]).toMatchObject({ mode: 'deny', value: 'SCA', time: 1 });
  });

  it('freezes the first 5210 recovery position tick, then applies recovery motion and lands with control', () => {
    const player = {
      ...koLiedownPlayer(),
      life: 500,
      koReason: undefined,
      stateNo: 5210,
      stateTime: 0,
      stateType: 'A' as const,
      moveType: 'I' as const,
      animNo: 5050,
      animTime: 0,
      x: 500,
      y: 245,
      vx: 2,
      vy: 1,
    };
    let state = stepCnsStateRuntime(withP2(player), common, { getAnimationDuration: animationDuration }).state;
    expect(state.players[1]).toMatchObject({ stateNo: 5210, animNo: 5210, positionFrozen: true, ctrl: false });
    state = stepCnsPhysicsMotion(state, common);
    expect(state.players[1]).toMatchObject({ x: 500, y: 245, vx: 2, vy: 1, stateTime: 1, positionFrozen: false });

    for (let frame = 0; frame < 80 && state.players[1].stateNo !== 52; frame += 1) {
      state = stepCnsStateRuntime(state, common, { getAnimationDuration: animationDuration }).state;
      state = stepCnsPhysicsMotion(state, common);
    }
    expect(state.players[1]).toMatchObject({ stateNo: 0, prevStateNo: 52, stateType: 'S', moveType: 'I', ctrl: true, y: 285 });
  });
});
