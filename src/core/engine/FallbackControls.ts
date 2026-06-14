import type { GameState, PlayerState } from './types';

export type FallbackControlInput = {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  attack: boolean;
  projectile?: boolean;
};

export function applyFallbackControls(
  state: GameState,
  p1Input: FallbackControlInput,
  p2Input: FallbackControlInput,
): GameState {
  return {
    ...state,
    players: [
      applyPlayerFallbackControl(state.players[0], p1Input),
      applyPlayerFallbackControl(state.players[1], p2Input),
    ],
  };
}

function applyPlayerFallbackControl(player: PlayerState, input: FallbackControlInput): PlayerState {
  if (player.hitPause > 0 || player.moveType === 'H') {
    return player;
  }

  const horizontal = Number(input.right) - Number(input.left);

  if (input.projectile) {
    return startAction(player, 1000);
  }

  if (input.attack) {
    return startAction(player, 200);
  }

  if (input.up && player.stateType !== 'A') {
    return {
      ...player,
      stateNo: 40,
      animNo: 40,
      animTime: 0,
      stateTime: 0,
      stateType: 'A',
      moveType: 'I',
      physics: 'A',
      ctrl: false,
      vy: -9,
      vx: horizontal * 3,
      hitDefUsed: false,
    };
  }

  if (horizontal !== 0 && player.stateType !== 'A') {
    return {
      ...player,
      stateNo: 20,
      animNo: 20,
      animTime: player.stateNo === 20 ? player.animTime : 0,
      stateTime: player.stateNo === 20 ? player.stateTime : 0,
      stateType: 'S',
      moveType: 'I',
      physics: 'S',
      ctrl: true,
      facing: horizontal > 0 ? 1 : -1,
      vx: horizontal * 2.5,
      hitDefUsed: false,
    };
  }

  if (player.stateType !== 'A') {
    return {
      ...player,
      stateNo: 0,
      animNo: 0,
      animTime: player.stateNo === 0 ? player.animTime : 0,
      stateTime: player.stateNo === 0 ? player.stateTime : 0,
      stateType: 'S',
      moveType: 'I',
      physics: 'S',
      ctrl: true,
      vx: 0,
      hitDefUsed: false,
    };
  }

  return player;
}

function startAction(player: PlayerState, actionStateNo: 200 | 1000): PlayerState {
  if (player.stateNo === actionStateNo) {
    return player;
  }

  return {
    ...player,
    stateNo: actionStateNo,
    animNo: actionStateNo,
    animTime: 0,
    stateTime: 0,
    stateType: 'S',
    moveType: 'A',
    physics: 'S',
    ctrl: false,
    vx: 0,
    hitDefUsed: false,
  };
}
