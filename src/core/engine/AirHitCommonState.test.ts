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

function launchedGroundHitPlayer(options: {
  recover?: boolean;
  recoverTime?: number;
  fall?: boolean;
  selectedHitTime?: number;
} = {}): PlayerState {
  const player = createInitialGameState().players[1];
  const fall = options.fall ?? true;
  const recover = options.recover ?? true;
  const recoverTime = options.recoverTime ?? 100;
  return {
    ...player,
    y: 285,
    stateNo: 5000,
    stateType: 'S',
    moveType: 'H',
    physics: 'N',
    ctrl: false,
    animNo: 5000,
    vx: -1.5,
    vy: -13,
    hitVelX: -1.5,
    hitVelY: -13,
    hitFall: fall,
    fallRecover: recover,
    fallRecoverTime: recoverTime,
    hitFallVelocity: { x: 0, y: 0 },
    getHitVars: {
      animtype: 3, groundtype: 1, hittime: options.selectedHitTime ?? 15,
      xvel: -1.5, yvel: -13, yaccel: 0.28,
      fall: fall ? 1 : 0, 'fall.xvel': 0, 'fall.yvel': 0, 'fall.recover': recover ? 1 : 0,
      'fall.recovertime': recoverTime, 'fall.damage': 0, 'down.hittime': 3,
    },
    hitStun: {
      activeHitDefId: 215, selectedHitTime: options.selectedHitTime ?? 15, kind: 'ground', source: 'active_hitdef',
      targetStateTypeAtHit: 'S', elapsed: 0, lastStateNo: 5000, selectedAnim: 5000,
      getHitVarYVelocitySource: 'ground.velocity.y',
      groundVelocityAtHit: { x: -1.5, y: -13 },
      airVelocityAtHit: { x: -1.5, y: -7 },
      fallYVelocityAtHit: 0,
    },
  };
}

function tick(state: GameState, p2Commands?: ReadonlySet<string>): GameState {
  const cns = stepCnsStateRuntime(state, common, { p2Commands, hitDiagnostics: true }).state;
  const moved = stepCnsPhysicsMotion(cns, common);
  return applyFallbackHitRecovery(moved);
}

function traceUntil(
  player: PlayerState,
  commandForFrame: (frame: number) => ReadonlySet<string> | undefined = () => undefined,
  maxFrames = 180,
): { state: GameState; visited: number[]; trace: string } {
  const initial = createInitialGameState();
  let state: GameState = { ...initial, players: [initial.players[0], player] };
  const visited: number[] = [];
  const lines: string[] = [];
  let saw5120 = false;
  for (let frame = 0; frame < maxFrames; frame += 1) {
    const before = state.players[1];
    const commands = commandForFrame(frame);
    const cns = stepCnsStateRuntime(state, common, { p2Commands: commands, hitDiagnostics: true }).state;
    const afterCns = cns.players[1];
    const moved = stepCnsPhysicsMotion(cns, common);
    const afterPhysics = moved.players[1];
    state = applyFallbackHitRecovery(moved);
    const after = state.players[1];
    visited.push(afterCns.stateNo, afterPhysics.stateNo, after.stateNo);
    if (after.stateNo === 5120) saw5120 = true;
    lines.push([
      `f=${frame}`,
      `prev=${before.stateNo}`,
      `cns=${afterCns.stateNo}`,
      `phys=${afterPhysics.stateNo}`,
      `state=${after.stateNo}`,
      `type=${after.stateType}`,
      `move=${after.moveType}`,
      `phys=${after.physics}`,
      `y=${after.y}`,
      `vx=${after.vx}`,
      `vy=${after.vy}`,
      `yvel=${after.getHitVars?.yvel ?? '-'}`,
      `yaccel=${after.getHitVars?.yaccel ?? '-'}`,
      `fall=${after.getHitVars?.fall ?? '-'}`,
      `recover=${after.getHitVars?.['fall.recover'] ?? '-'}`,
      `recovertime=${after.getHitVars?.['fall.recovertime'] ?? '-'}`,
      `fallY=${after.getHitVars?.['fall.yvel'] ?? '-'}`,
      `HitFall=${after.hitFall ? 1 : 0}`,
      `CanRecover=${after.fallRecover !== false && (after.hitStun?.elapsed ?? after.hitReactionElapsed ?? after.stateTime) >= (after.fallRecoverTime ?? 0) ? 1 : 0}`,
      `cmd=${commands?.has('recovery') ? 1 : 0}`,
      `hitStun=${after.hitStun?.elapsed ?? '-'}`,
      `hitElapsed=${after.hitReactionElapsed ?? '-'}`,
      `cnsDiag=${afterCns.hitDiagnosticLines?.slice(-6).join('|') ?? '-'}`,
      `fallback=${state.hitDiagnosticLines?.filter((line) => line.includes('recoveryPath=') || line.includes('raw.hit_down')).slice(-2).join('|') ?? '-'}`,
    ].join(' '));
    if (saw5120 && after.stateNo === 0) break;
  }
  return { state, visited, trace: lines.join('\n') };
}

describe('air hit common-state integration', () => {
  it('uses the 5060 animation family while descending instead of treating 5060 as a StateDef', () => {
    const initial = createInitialGameState();
    const player = {
      ...airHitPlayer(true, false),
      stateNo: 5050,
      animNo: 5050,
      animTime: 0,
      vy: 1,
    };
    const result = stepCnsStateRuntime(
      { ...initial, players: [initial.players[0], player] },
      common,
      { getAnimationDuration: (animNo) => ([5050, 5060].includes(animNo) ? 10 : null), hitDiagnostics: true },
    );

    expect(common.states.some((stateDef) => stateDef.stateNo === 5060)).toBe(false);
    expect(result.state.players[1]).toMatchObject({ stateNo: 5050, animNo: 5060 });
    expect(result.state.players[1].hitDiagnosticLines?.join('\n')).toContain('state=5050');
  });

  it('freezes the 5070 trip state during hitpause, then enters 5071 with the stored hit velocity', () => {
    const initial = createInitialGameState();
    let state: GameState = {
      ...initial,
      players: [initial.players[0], {
        ...airHitPlayer(true, false),
        stateNo: 5070,
        animNo: 5070,
        stateTime: 4,
        animTime: 4,
        hitPause: 1,
        hitVelX: -2,
        hitVelY: -4,
      }],
    };

    const frozen = stepCnsStateRuntime(state, common, { hitDiagnostics: true }).state;
    expect(frozen.players[1]).toMatchObject({ stateNo: 5070, stateTime: 4, animTime: 4, hitPause: 1 });
    expect(frozen.players[1].hitDiagnosticLines?.join('\n')).toContain('raw.fall_pause');
    state = stepCnsPhysicsMotion(frozen, common);
    expect(state.players[1]).toMatchObject({ stateNo: 5070, stateTime: 4, animTime: 4, hitPause: 0 });

    state = stepCnsStateRuntime(state, common, { hitDiagnostics: true }).state;
    expect(state.players[1]).toMatchObject({ stateNo: 5071, vx: -2, vy: -3.4, stateType: 'A', moveType: 'H' });
  });

  it('routes a non-fall air hit through 5040 and lands only after a downward ground crossing', () => {
    const initial = createInitialGameState();
    let state: GameState = { ...initial, players: [initial.players[0], airHitPlayer(false)] };
    const visited = new Set<number>();
    let sawAboveGround5040 = false;
    for (let frame = 0; frame < 80 && state.players[1].stateNo !== 0; frame += 1) {
      state = tick(state);
      const player = state.players[1];
      visited.add(player.stateNo);
      if (player.stateNo === 5040 && player.y < 285) sawAboveGround5040 = true;
    }

    expect(visited).toContain(5040);
    expect(sawAboveGround5040).toBe(true);
    expect(state.players[1]).toMatchObject({ stateNo: 0, prevStateNo: 52, y: 285, vy: 0 });
  });

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

  it('keeps ground launch fall in the common down route when no recovery command is pressed', () => {
    const { state, visited, trace } = traceUntil(launchedGroundHitPlayer());
    const firstIdle = visited.indexOf(0);
    const firstGetup = visited.indexOf(5120);
    expect(visited, trace).toContain(5035);
    expect(visited, trace).toContain(5050);
    expect(trace).toContain('from=5050 to=5100');
    expect(trace).toContain('from=5100 to=5110');
    expect(visited, trace).toContain(5110);
    expect(visited, trace).toContain(5120);
    expect(visited, trace).not.toContain(5200);
    expect(visited, trace).not.toContain(5210);
    expect(firstIdle, trace).toBeGreaterThan(firstGetup);
    expect(state.players[1], trace).toMatchObject({ stateNo: 0, stateType: 'S', moveType: 'I', ctrl: true });
  });

  it('allows fall recovery only when CanRecover and the recovery command are both true', () => {
    const { visited, trace } = traceUntil(
      launchedGroundHitPlayer({ recover: true, recoverTime: 3 }),
      () => new Set(['recovery']),
    );
    expect(visited, trace).toContain(5050);
    expect(visited.some((stateNo) => stateNo === 5200 || stateNo === 5210), trace).toBe(true);
  });

  it('does not enter recovery states without recovery command even after CanRecover is true', () => {
    const { visited, trace } = traceUntil(launchedGroundHitPlayer({ recover: true, recoverTime: 3 }));
    expect(trace).toContain('CanRecover=1 cmd=0');
    expect(visited, trace).not.toContain(5200);
    expect(visited, trace).not.toContain(5210);
  });

  it('blocks recovery command when fall.recover is disabled', () => {
    const { visited, trace } = traceUntil(
      launchedGroundHitPlayer({ recover: false, recoverTime: 3 }),
      () => new Set(['recovery']),
    );
    expect(visited, trace).toContain(5120);
    expect(visited, trace).not.toContain(5200);
    expect(visited, trace).not.toContain(5210);
  });

  it('blocks recovery command before fall.recovertime', () => {
    const { visited, trace } = traceUntil(
      launchedGroundHitPlayer({ recover: true, recoverTime: 120 }),
      () => new Set(['recovery']),
    );
    expect(visited, trace).toContain(5120);
    expect(visited, trace).not.toContain(5200);
    expect(visited, trace).not.toContain(5210);
  });
});
