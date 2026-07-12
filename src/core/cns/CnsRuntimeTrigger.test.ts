import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../engine/GameState';
import { DEFAULT_GROUND_Y } from '../engine/GroundClamp';
import { evaluateCnsRuntimeTrigger, evaluateCnsRuntimeTriggerGroup, readNumberExpression } from './CnsRuntimeTrigger';

describe('CnsRuntimeTrigger', () => {
  it('evaluates command comparisons as numeric terms in common-state arithmetic', () => {
    const state = createInitialGameState();
    expect(readNumberExpression('151 + 2*(command = "holddown")', {
      player: state.players[0], commands: new Set(['holddown']),
    })).toBe(153);
    expect(readNumberExpression('151 + 2*(command = "holddown")', {
      player: state.players[0], commands: new Set(['holdback']),
    })).toBe(151);
  });
  const player = {
    ...createInitialGameState().players[0],
    stateTime: 6,
    animTime: 12,
    ctrl: true,
    stateType: 'S' as const,
    moveType: 'I' as const,
    vx: 3,
    vy: -2,
  };

  it('evaluates animtime using MUGEN-like value when supplied', () => {
    expect(evaluateCnsRuntimeTrigger('AnimTime = 0', { player, animTime: 0 })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('AnimTime > 0', { player, animTime: 4 })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('AnimTime = 12', { player })).toBe(true);
  });

  it('evaluates AnimExist using the animation lookup hook', () => {
    const context = {
      player,
      animationExists: (animNo: number) => animNo === 200,
    };

    expect(evaluateCnsRuntimeTrigger('AnimExist(200) = 1', context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('AnimExist(anim) = 0', context)).toBe(true);
  });

  it('evaluates SelfAnimExist using the animation lookup hook', () => {
    const context = {
      player,
      animationExists: (animNo: number) => animNo === 12,
    };

    expect(evaluateCnsRuntimeTrigger('SelfAnimExist(12) = 1', context)).toBe(true);
    expect(evaluateCnsRuntimeTrigger('SelfAnimExist(999) = 0', context)).toBe(true);
  });

  it('evaluates AnimElemNo using the current animation element hook', () => {
    expect(evaluateCnsRuntimeTrigger('AnimElemNo = 3', { player, animElemNo: 3 })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('AnimElemNo != 2', { player, animElemNo: 3 })).toBe(true);
  });

  it('evaluates command equality and inequality', () => {
    expect(evaluateCnsRuntimeTrigger('command = "QCF_x"', {
      player,
      commands: new Set(['qcf_x']),
    })).toBe(true);

    expect(evaluateCnsRuntimeTrigger('command != "holddown"', {
      player,
      commands: new Set(['x']),
    })).toBe(true);

    expect(evaluateCnsRuntimeTrigger('command != "holddown"', {
      player,
      commands: new Set(['holddown']),
    })).toBe(false);
  });

  it('evaluates common round and player status triggers', () => {
    expect(evaluateCnsRuntimeTrigger('RoundState = 2', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('AILevel = 0', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('Alive', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('Var(59) = 0', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('SysVar(0) = 0', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('FVar(0) = 0', { player })).toBe(true);
  });

  it('evaluates physics and WinMUGEN y-position triggers', () => {
    const groundedAirPhysicsPlayer = {
      ...player,
      physics: 'A' as const,
      y: DEFAULT_GROUND_Y,
      vy: 0,
    };

    expect(evaluateCnsRuntimeTrigger('physics = A', { player: groundedAirPhysicsPlayer })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('physics != S', { player: groundedAirPhysicsPlayer })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('pos y = 0', { player: groundedAirPhysicsPlayer })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('pos y < 0', {
      player: { ...groundedAirPhysicsPlayer, y: DEFAULT_GROUND_Y - 1 },
    })).toBe(true);
  });

  it('evaluates boolean operators and ranges', () => {
    expect(evaluateCnsRuntimeTrigger('ctrl && statetype = S', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('!(statetype = A)', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('time = [0, 10]', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('vel x > 2 || vel y > 0', { player })).toBe(true);
  });

  it('exposes Vel X relative to the player facing', () => {
    expect(evaluateCnsRuntimeTrigger('vel x > 0', {
      player: { ...player, facing: -1, vx: -3 },
    })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('vel x < 0', {
      player: { ...player, facing: -1, vx: 3 },
    })).toBe(true);
  });

  it('evaluates arithmetic in numeric trigger expressions', () => {
    expect(evaluateCnsRuntimeTrigger('time + 4 = 10', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('time - 1 = 5', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('(time + 2) * 3 = 24', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('time / 2 = 3', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('time % 4 = 2', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('time = 3 + 3', { player })).toBe(true);
  });

  it('evaluates math constants and numeric functions', () => {
    expect(evaluateCnsRuntimeTrigger('Pi > 3', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('E > 2', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('Sin(0) = 0', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('Cos(0) = 1', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('Tan(0) = 0', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('ACos(1) = 0', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('ASin(0) = 0', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('ATan(0) = 0', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('Exp(0) = 1', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('Ln(E) = 1', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('Log(100) = 2', { player })).toBe(true);
  });

  it('evaluates conditional numeric functions', () => {
    expect(evaluateCnsRuntimeTrigger('IfElse(ctrl, 4, 9) = 4', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('Cond(statetype = A, 4, 9) = 9', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('IfElse(time > 5, time + 1, 0) = 7', { player })).toBe(true);
  });

  it('evaluates opponent and count-style triggers with safe defaults', () => {
    const opponent = { ...createInitialGameState().players[1], x: player.x + 20, y: player.y + 5, stateType: 'C' as const };

    expect(evaluateCnsRuntimeTrigger('P2BodyDist X < 30', { player, opponent })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('BodyDist X < 30', { player, opponent })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('BodyDist Y = 5', { player, opponent })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('P2StateType = C', { player, opponent })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('NumEnemy > 0', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('NumHelper = 0', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('NumExplod = 0', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('NumProj = 0', { player })).toBe(true);
  });

  it('evaluates constants and misc numeric triggers', () => {
    expect(evaluateCnsRuntimeTrigger('Const(data.life) = 1000', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('Life > 0', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('Power = 0', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('Random < 1000', { player })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('HitPauseTime = 0', { player })).toBe(true);
  });

  it('evaluates trigger groups as OR of AND groups', () => {
    expect(evaluateCnsRuntimeTriggerGroup([
      'trigger1: ctrl',
      'trigger1: command = "x"',
    ], {
      player,
      commands: new Set(['x']),
    })).toBe(true);

    expect(evaluateCnsRuntimeTriggerGroup([
      'trigger1: ctrl',
      'trigger1: command = "x"',
    ], {
      player,
      commands: new Set(),
    })).toBe(false);

    expect(evaluateCnsRuntimeTriggerGroup([
      'trigger1: ctrl',
      'trigger1: command = "x"',
      'trigger2: time > 5',
    ], {
      player,
      commands: new Set(),
    })).toBe(true);
  });

  it('requires triggerall before any trigger group may pass', () => {
    expect(evaluateCnsRuntimeTriggerGroup([
      'triggerall: command = "QCF_x"',
      'trigger1: statetype = S',
      'trigger1: ctrl',
    ], {
      player,
      commands: new Set(['qcf_x']),
    })).toBe(true);

    expect(evaluateCnsRuntimeTriggerGroup([
      'triggerall: command = "QCF_x"',
      'trigger1: statetype = S',
      'trigger1: ctrl',
    ], {
      player,
      commands: new Set(['x']),
    })).toBe(false);
  });

  it('evaluates a common-style jump trigger group', () => {
    expect(evaluateCnsRuntimeTriggerGroup([
      'triggerall: command = "holdup"',
      'triggerall: command != "holddown"',
      'triggerall: alive',
      'triggerall: roundstate = 2',
      'triggerall: ailevel = 0',
      'triggerall: var(59) = 0',
      'trigger1: statetype = S',
      'trigger1: ctrl',
    ], {
      player,
      commands: new Set(['holdup', 'up']),
    })).toBe(true);
  });
});
