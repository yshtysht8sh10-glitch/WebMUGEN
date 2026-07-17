import { describe, expect, it } from 'vitest';

import type { CnsTrigger } from '../../mugen/common/cnsTypes';
import { createInitialGameState } from '../engine/GameState';
import {
  compileCnsRuntimeTrigger,
  evaluateCnsRuntimeTrigger,
  evaluateCnsRuntimeTriggerLegacy,
  evaluatePreparedCnsRuntimeTrigger,
  prepareCnsRuntimeTrigger,
  type CnsRuntimeTriggerContext,
} from './CnsRuntimeTrigger';

describe('Issue #58 Phase 4 compiled Trigger evaluator', () => {
  const initial = createInitialGameState();
  const player = {
    ...initial.players[0],
    stateNo: 200,
    stateTime: 4,
    animNo: 20,
    animTime: 3,
    ctrl: true,
    vx: 2,
    vy: -3,
    vars: { 0: 5, 1: 2 },
    targets: [{ playerId: 2, hitDefId: 1015, activeHitDefId: 77 }],
  };
  const opponent = {
    ...initial.players[1],
    stateNo: 5000,
    moveType: 'H' as const,
    ctrl: false,
    x: 150,
    getHitVars: { hitcount: 7 },
  };
  const context: CnsRuntimeTriggerContext = {
    player,
    opponent,
    commands: new Set(['attack']),
    animTime: -2,
    animElemNo: 2,
    animElemStarted: true,
    animElemCount: 3,
    animElemTimes: [-2, 0, -4],
    animationExists: (animNo) => animNo === 20,
    numHelper: (helperId) => helperId === 5 ? 1 : 2,
    gameTime: 100,
  };

  it.each([
    '1',
    '0',
    'Ctrl',
    '!Ctrl',
    'Command = "attack"',
    'Command != "missing"',
    'StateType = S',
    'MoveType != H',
    'StateNo = [100, 300]',
    'TimeMod = 3, 1',
    'AnimElem = 2',
    'AnimElem = 2, = 0',
    '((Time + Var(0)) * 2 >= 18 && Ctrl) || !Alive',
    'IfElse(Ctrl, Var(0) + 1, unsupported) = 6',
    'Cond(0, unsupported, Abs(Vel Y)) = 3',
    'NumHelper(Var(0)) = 1',
    'AnimExist(Anim) = 1',
    'EnemyNear, StateNo = 5000',
    'Enemy, GetHitVar(hitcount) = 7',
    'Enemy(1), Alive',
    'Target(1015), MoveType = H',
    'Root, StateNo = 200',
    'Parent, Ctrl',
    'unknown trigger = 1',
  ])('matches the legacy result for %s', (expression) => {
    expect(evaluateCnsRuntimeTrigger(expression, context)).toBe(
      evaluateCnsRuntimeTriggerLegacy(expression, context),
    );
  });

  it('reuses compiled expressions and prepared Trigger records without reparsing', () => {
    const expression = 'Time >= 4 && Ctrl';
    const trigger: CnsTrigger = { name: 'trigger1', expression };
    const compiled = compileCnsRuntimeTrigger(expression);

    expect(compileCnsRuntimeTrigger(expression)).toBe(compiled);
    expect(prepareCnsRuntimeTrigger(trigger)).toBe(compiled);
    expect(prepareCnsRuntimeTrigger(trigger)).toBe(compiled);
    expect(evaluatePreparedCnsRuntimeTrigger(trigger, context)).toBe(true);
  });
});
