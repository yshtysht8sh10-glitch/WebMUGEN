import { describe, expect, it } from 'vitest';
import type { CnsStateController } from '../../mugen/common/cnsTypes';
import { createInitialGameState } from './GameState';
import { executeController, executeControllers } from './ControllerExecutor';

describe('executeController', () => {
  it('executes ChangeState', () => {
    const player = createInitialGameState().players[0];
    const controller: CnsStateController = {
      type: 'ChangeState',
      triggers: [],
      params: {
        value: 20,
        ctrl: 1,
      },
    };

    const result = executeController(player, controller);

    expect(result.changedState).toBe(true);
    expect(result.velocityChanged).toBe(false);
    expect(result.player.stateNo).toBe(20);
    expect(result.player.stateTime).toBe(0);
    expect(result.player.animNo).toBe(20);
    expect(result.player.animTime).toBe(0);
    expect(result.player.ctrl).toBe(true);
  });

  it('executes VelSet', () => {
    const player = createInitialGameState().players[0];
    const controller: CnsStateController = {
      type: 'VelSet',
      triggers: [],
      params: {
        x: 2.5,
        y: -1,
      },
    };

    const result = executeController(player, controller);

    expect(result.changedState).toBe(false);
    expect(result.velocityChanged).toBe(true);
    expect(result.player.vx).toBe(2.5);
    expect(result.player.vy).toBe(-1);
  });

  it('executes PosAdd', () => {
    const player = createInitialGameState().players[0];
    const controller: CnsStateController = {
      type: 'PosAdd',
      triggers: [],
      params: {
        x: 8,
        y: -2,
      },
    };

    const result = executeController(player, controller);

    expect(result.player.x).toBe(player.x + 8);
    expect(result.player.y).toBe(player.y - 2);
  });

  it('executes CtrlSet', () => {
    const player = createInitialGameState().players[0];
    const controller: CnsStateController = {
      type: 'CtrlSet',
      triggers: [],
      params: {
        value: 0,
      },
    };

    const result = executeController(player, controller);

    expect(result.player.ctrl).toBe(false);
  });

  it('executes PlayerPush', () => {
    const player = createInitialGameState().players[0];
    const controller: CnsStateController = {
      type: 'PlayerPush',
      triggers: [],
      params: {
        value: 0,
      },
    };

    const result = executeController(player, controller);

    expect(result.player.playerPush).toBe(false);
  });

  it('executes ChangeAnim', () => {
    const player = createInitialGameState().players[0];
    const controller: CnsStateController = {
      type: 'ChangeAnim',
      triggers: [],
      params: {
        value: 200,
      },
    };

    const result = executeController(player, controller);

    expect(result.player.animNo).toBe(200);
    expect(result.player.animTime).toBe(0);
  });

  it('executes StateTypeSet', () => {
    const player = createInitialGameState().players[0];
    const controller: CnsStateController = {
      type: 'StateTypeSet',
      triggers: [],
      params: {
        statetype: 'A',
        movetype: 'A',
        physics: 'A',
      },
    };

    const result = executeController(player, controller);

    expect(result.player.stateType).toBe('A');
    expect(result.player.moveType).toBe('A');
    expect(result.player.physics).toBe('A');
  });
});

describe('executeControllers', () => {
  it('executes controller when trigger is true', () => {
    const player = createInitialGameState().players[0];
    const controllers: CnsStateController[] = [
      {
        type: 'ChangeState',
        triggers: [{ index: 1, expression: 'command = "holdfwd"' }],
        params: {
          value: 20,
        },
      },
    ];

    const result = executeControllers(player, controllers, {
      input: {
        left: false,
        right: true,
        attack: false,
      },
      animLength: 60,
      moveHit: false,
    });

    expect(result.changedState).toBe(true);
    expect(result.player.stateNo).toBe(20);
  });

  it('does not execute controller when trigger is false', () => {
    const player = createInitialGameState().players[0];
    const controllers: CnsStateController[] = [
      {
        type: 'ChangeState',
        triggers: [{ index: 1, expression: 'command = "holdfwd"' }],
        params: {
          value: 20,
        },
      },
    ];

    const result = executeControllers(player, controllers, {
      input: {
        left: false,
        right: false,
        attack: false,
      },
      animLength: 60,
      moveHit: false,
    });

    expect(result.changedState).toBe(false);
    expect(result.player.stateNo).toBe(0);
  });

  it('stops executing after ChangeState', () => {
    const player = createInitialGameState().players[0];
    const controllers: CnsStateController[] = [
      {
        type: 'ChangeState',
        triggers: [],
        params: {
          value: 20,
        },
      },
      {
        type: 'VelSet',
        triggers: [],
        params: {
          x: 99,
        },
      },
    ];

    const result = executeControllers(player, controllers, {
      input: {
        left: false,
        right: false,
        attack: false,
      },
      animLength: 60,
      moveHit: false,
    });

    expect(result.changedState).toBe(true);
    expect(result.player.stateNo).toBe(20);
    expect(result.player.vx).not.toBe(99);
  });
});
