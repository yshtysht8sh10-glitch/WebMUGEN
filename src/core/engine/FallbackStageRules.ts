import type { GameState, PlayerState } from './types';

export const FALLBACK_STAGE_LEFT = 48;
export const FALLBACK_STAGE_RIGHT = 912;
const PUSH_DISTANCE = 44;
const PUSH_HALF_WIDTH = PUSH_DISTANCE / 2;
const PUSH_HEIGHT = 80;

type PushBox = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export function applyFallbackStageRules(state: GameState): GameState {
  const [p1, p2] = state.players;
  let nextP1 = clampToStage(p1);
  let nextP2 = clampToStage(p2);

  [nextP1, nextP2] = applyFacing(nextP1, nextP2);
  [nextP1, nextP2] = applyPushApart(nextP1, nextP2);
  nextP1 = clampToStage(nextP1);
  nextP2 = clampToStage(nextP2);

  return {
    ...state,
    players: [nextP1, nextP2],
  };
}

function applyFacing(p1: PlayerState, p2: PlayerState): [PlayerState, PlayerState] {
  if (p1.x === p2.x) {
    return [p1, p2];
  }

  return [
    {
      ...p1,
      facing: p1.x < p2.x ? 1 : -1,
    },
    {
      ...p2,
      facing: p2.x < p1.x ? 1 : -1,
    },
  ];
}

function applyPushApart(p1: PlayerState, p2: PlayerState): [PlayerState, PlayerState] {
  if (p1.playerPush === false || p2.playerPush === false) {
    return [p1, p2];
  }

  const p1Box = getPushBox(p1);
  const p2Box = getPushBox(p2);
  if ((isAirborne(p1) || isAirborne(p2)) && !overlapsVertically(p1Box, p2Box)) {
    return [p1, p2];
  }

  const distance = p2.x - p1.x;
  const overlap = PUSH_DISTANCE - Math.abs(distance);

  if (overlap <= 0) {
    return [p1, p2];
  }

  if (distance === 0) {
    return [
      { ...p1, x: p1.x - overlap / 2 },
      { ...p2, x: p2.x + overlap / 2 },
    ];
  }

  const direction = distance > 0 ? 1 : -1;
  const push = overlap / 2;

  return [
    { ...p1, x: p1.x - direction * push },
    { ...p2, x: p2.x + direction * push },
  ];
}

function getPushBox(player: PlayerState): PushBox {
  return {
    left: player.x - PUSH_HALF_WIDTH,
    right: player.x + PUSH_HALF_WIDTH,
    top: player.y - PUSH_HEIGHT,
    bottom: player.y,
  };
}

function overlapsVertically(a: PushBox, b: PushBox): boolean {
  return a.bottom > b.top && b.bottom > a.top;
}

function isAirborne(player: PlayerState): boolean {
  return player.stateType === 'A' || player.physics === 'A';
}

function clampToStage(player: PlayerState): PlayerState {
  return {
    ...player,
    x: Math.min(FALLBACK_STAGE_RIGHT, Math.max(FALLBACK_STAGE_LEFT, player.x)),
  };
}

export function isAtFallbackStageEdge(player: PlayerState): boolean {
  return player.x <= FALLBACK_STAGE_LEFT || player.x >= FALLBACK_STAGE_RIGHT;
}
