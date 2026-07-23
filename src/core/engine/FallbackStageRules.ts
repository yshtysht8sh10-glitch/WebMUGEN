import type { GameState, PlayerState } from './types';

export const FALLBACK_STAGE_LEFT = 48;
export const FALLBACK_STAGE_RIGHT = 912;
const DEFAULT_GROUND_FRONT = 16;
const DEFAULT_GROUND_BACK = 15;
const DEFAULT_AIR_FRONT = 12;
const DEFAULT_AIR_BACK = 12;
const DEFAULT_HEIGHT = 60;

export type PushBox = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  front: number;
  back: number;
  height: number;
  mode: 'ground' | 'air';
  source: 'character_size' | 'winmugen_defaults';
};

export function applyFallbackStageRules(state: GameState): GameState {
  const [p1, p2] = state.players;
  let nextP1 = clampToStage(p1);
  let nextP2 = clampToStage(p2);

  const beforeFacing: [PlayerState['facing'], PlayerState['facing']] = [nextP1.facing, nextP2.facing];
  [nextP1, nextP2] = applyFacing(nextP1, nextP2);
  const pushResult = applyPushApart(nextP1, nextP2);
  [nextP1, nextP2] = pushResult.players;
  nextP1 = clampToStage(nextP1);
  nextP2 = clampToStage(nextP2);

  return {
    ...state,
    players: [nextP1, nextP2],
    hitDiagnosticLines: [
      ...(state.hitDiagnosticLines ?? []),
      formatPushBoxDiagnostic('p1', pushResult.before[0]),
      formatPushBoxDiagnostic('p2', pushResult.before[1]),
      `raw.push result=${pushResult.result} overlapX=${formatNumber(pushResult.overlapX)} overlapY=${formatNumber(pushResult.overlapY)} playerPush=${nextP1.playerPush === false || nextP2.playerPush === false ? 0 : 1}`,
      `raw.cross airborne=${Number(isAirborne(nextP1) || isAirborne(nextP2))} noAutoTurn=${Number(nextP1.noAutoTurn === true)},${Number(nextP2.noAutoTurn === true)} facingBefore=${beforeFacing.join(',')} facingAfter=${nextP1.facing},${nextP2.facing} autoTurn=${Number(beforeFacing[0] !== nextP1.facing || beforeFacing[1] !== nextP2.facing)}`,
    ],
  };
}

function applyFacing(p1: PlayerState, p2: PlayerState): [PlayerState, PlayerState] {
  if (p1.x === p2.x) {
    return [p1, p2];
  }

  return [faceGroundedPlayer(p1, p2), faceGroundedPlayer(p2, p1)];
}

function faceGroundedPlayer(player: PlayerState, opponent: PlayerState): PlayerState {
  if (isAirborne(player) || player.moveType !== 'I' || player.noAutoTurn === true) return player;
  return { ...player, facing: player.x < opponent.x ? 1 : -1 };
}

type PushResult = {
  players: [PlayerState, PlayerState];
  before: [PushBox, PushBox];
  overlapX: number;
  overlapY: number;
  result: 'applied' | 'skip_playerpush' | 'skip_vertical' | 'skip_horizontal';
};

function applyPushApart(p1: PlayerState, p2: PlayerState): PushResult {
  const p1Box = buildPushBox(p1);
  const p2Box = buildPushBox(p2);
  const overlapX = overlapAmount(p1Box.left, p1Box.right, p2Box.left, p2Box.right);
  const overlapY = overlapAmount(p1Box.top, p1Box.bottom, p2Box.top, p2Box.bottom);
  if (p1.playerPush === false || p2.playerPush === false) {
    return { players: [p1, p2], before: [p1Box, p2Box], overlapX, overlapY, result: 'skip_playerpush' };
  }
  if (overlapY <= 0) {
    return { players: [p1, p2], before: [p1Box, p2Box], overlapX, overlapY, result: 'skip_vertical' };
  }
  if (overlapX <= 0) {
    return { players: [p1, p2], before: [p1Box, p2Box], overlapX, overlapY, result: 'skip_horizontal' };
  }

  const direction = p2.x > p1.x ? 1 : p2.x < p1.x ? -1 : p1.facing;
  const p1Capacity = direction > 0 ? p1.x - FALLBACK_STAGE_LEFT : FALLBACK_STAGE_RIGHT - p1.x;
  const p2Capacity = direction > 0 ? FALLBACK_STAGE_RIGHT - p2.x : p2.x - FALLBACK_STAGE_LEFT;
  let p1Move = Math.min(overlapX / 2, p1Capacity);
  let p2Move = Math.min(overlapX / 2, p2Capacity);
  let remaining = overlapX - p1Move - p2Move;
  const extraP1 = Math.min(remaining, p1Capacity - p1Move);
  p1Move += extraP1;
  remaining -= extraP1;
  p2Move += Math.min(remaining, p2Capacity - p2Move);

  return {
    players: [
      { ...p1, x: p1.x - direction * p1Move },
      { ...p2, x: p2.x + direction * p2Move },
    ],
    before: [p1Box, p2Box],
    overlapX,
    overlapY,
    result: 'applied',
  };
}

export function buildPushBox(player: PlayerState): PushBox {
  const configured = player.collisionWidth;
  const mode = isAirborne(player) ? 'air' : 'ground';
  const rawFront = configured
    ? mode === 'air' ? configured.airFront : configured.groundFront
    : mode === 'air' ? DEFAULT_AIR_FRONT : DEFAULT_GROUND_FRONT;
  const rawBack = configured
    ? mode === 'air' ? configured.airBack : configured.groundBack
    : mode === 'air' ? DEFAULT_AIR_BACK : DEFAULT_GROUND_BACK;
  const scaleX = finiteScale(configured?.xScale);
  const scaleY = finiteScale(configured?.yScale);
  const front = Math.max(0, rawFront) * scaleX;
  const back = Math.max(0, rawBack) * scaleX;
  const height = Math.max(0, configured?.height ?? DEFAULT_HEIGHT) * scaleY;
  return {
    left: player.x - (player.facing === 1 ? back : front),
    right: player.x + (player.facing === 1 ? front : back),
    top: player.y - height,
    bottom: player.y,
    front,
    back,
    height,
    mode,
    source: configured ? 'character_size' : 'winmugen_defaults',
  };
}

function finiteScale(value: number | undefined): number {
  return Number.isFinite(value) ? Math.abs(value as number) : 1;
}

function overlapAmount(aMin: number, aMax: number, bMin: number, bMax: number): number {
  return Math.max(0, Math.min(aMax, bMax) - Math.max(aMin, bMin));
}

function formatPushBoxDiagnostic(owner: 'p1' | 'p2', box: PushBox): string {
  return `raw.push owner=${owner} source=${box.source} mode=${box.mode} box=${formatNumber(box.left)},${formatNumber(box.top)},${formatNumber(box.right)},${formatNumber(box.bottom)} front=${formatNumber(box.front)} back=${formatNumber(box.back)} height=${formatNumber(box.height)}`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

function isAirborne(player: PlayerState): boolean {
  return player.stateType === 'A' || player.physics === 'A';
}

function clampToStage(player: PlayerState): PlayerState {
  if (player.screenBound?.value === false) return player;
  return {
    ...player,
    x: Math.min(FALLBACK_STAGE_RIGHT, Math.max(FALLBACK_STAGE_LEFT, player.x)),
  };
}

export function isAtFallbackStageEdge(player: PlayerState): boolean {
  return player.x <= FALLBACK_STAGE_LEFT || player.x >= FALLBACK_STAGE_RIGHT;
}
