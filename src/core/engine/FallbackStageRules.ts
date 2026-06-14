import type { GameState, PlayerState } from './types';

const STAGE_LEFT = 48;
const STAGE_RIGHT = 912;
const PUSH_DISTANCE = 44;

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

function clampToStage(player: PlayerState): PlayerState {
  return {
    ...player,
    x: Math.min(STAGE_RIGHT, Math.max(STAGE_LEFT, player.x)),
  };
}
