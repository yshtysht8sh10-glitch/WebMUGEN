import type { GameState, HelperEntity, PlayerState } from './types';

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
  source: 'width_controller' | 'character_size' | 'winmugen_defaults';
};

export type FallbackStageRuleOptions = { autoTurn?: boolean };

export function applyFallbackStageRules(state: GameState, options: FallbackStageRuleOptions = {}): GameState {
  const [p1, p2] = state.players;
  let nextP1 = clampToStage(p1);
  let nextP2 = clampToStage(p2);

  const beforeFacing: [PlayerState['facing'], PlayerState['facing']] = [nextP1.facing, nextP2.facing];
  [nextP1, nextP2] = applyFacing(nextP1, nextP2, state, options.autoTurn ?? true);
  const pushResult = applyPushApart(nextP1, nextP2);
  [nextP1, nextP2] = pushResult.players;
  nextP1 = clampToStage(nextP1);
  nextP2 = clampToStage(nextP2);
  [nextP1, nextP2] = finalizeTargetBinds([nextP1, nextP2], state.helpers.entries);
  [nextP1, nextP2] = applyFacing(nextP1, nextP2, state, options.autoTurn ?? true);

  return {
    ...state,
    players: [nextP1, nextP2],
    hitDiagnosticLines: [
      ...(state.hitDiagnosticLines ?? []),
      formatPushBoxDiagnostic('p1', pushResult.before[0]),
      formatPushBoxDiagnostic('p2', pushResult.before[1]),
      `raw.stagepos before=${formatNumber(p1.x)},${formatNumber(p2.x)} afterClampPushBind=${formatNumber(nextP1.x)},${formatNumber(nextP2.x)} delta=${formatNumber(nextP1.x - p1.x)},${formatNumber(nextP2.x - p2.x)} targetBind=${Number(Boolean(nextP1.targetBind))},${Number(Boolean(nextP2.targetBind))}`,
      `raw.push result=${pushResult.result} overlapX=${formatNumber(pushResult.overlapX)} overlapY=${formatNumber(pushResult.overlapY)} playerPush=${nextP1.playerPush === false || nextP2.playerPush === false ? 0 : 1}`,
      `raw.cross airborne=${Number(isAirborne(nextP1) || isAirborne(nextP2))} noAutoTurn=${Number(nextP1.noAutoTurn === true)},${Number(nextP2.noAutoTurn === true)} facingBefore=${beforeFacing.join(',')} facingAfter=${nextP1.facing},${nextP2.facing} autoTurnEnabled=${Number(options.autoTurn ?? true)} autoTurn=${Number(beforeFacing[0] !== nextP1.facing || beforeFacing[1] !== nextP2.facing)}`,
    ],
  };
}

function finalizeTargetBinds(
  players: [PlayerState, PlayerState],
  helpers: readonly HelperEntity[],
): [PlayerState, PlayerState] {
  return players.map((player) => {
    const bind = player.targetBind;
    if (!bind) return player;
    const owner = players.find((candidate) => candidate.id === bind.ownerId)
      ?? helpers.find((helper) => helper.entityId === bind.ownerId)?.player;
    if (!owner) return { ...player, targetBind: undefined };
    return {
      ...player,
      x: owner.x + bind.offsetX * owner.facing,
      y: owner.y + bind.offsetY,
      vx: owner.vx,
      vy: owner.vy,
      targetBind: bind.remaining === 0 ? undefined : bind,
    };
  }) as [PlayerState, PlayerState];
}

function applyFacing(p1: PlayerState, p2: PlayerState, state: GameState, autoTurn: boolean): [PlayerState, PlayerState] {
  if (!autoTurn || p1.x === p2.x) {
    return [p1, p2];
  }

  return [facePlayer(p1, p2, state), facePlayer(p2, p1, state)];
}

function facePlayer(player: PlayerState, opponent: PlayerState, state: GameState): PlayerState {
  if (!isAutoTurnState(player) || player.noAutoTurn === true || player.hitPause > 0 || isFrozenByGlobalPause(player, state)) return player;
  const facing = player.x < opponent.x ? 1 : -1;
  if (facing === player.facing) return player;
  return {
    ...player,
    facing,
    animNo: player.stateNo === 0 ? 5 : 6,
    animTime: 0,
    ctrl: true,
  };
}

function isAutoTurnState(player: PlayerState): boolean {
  return !isAirborne(player) && player.moveType === 'I' && (player.stateNo === 0 || player.stateNo === 11);
}

function isFrozenByGlobalPause(player: PlayerState, state: GameState): boolean {
  const pause = state.pause;
  if (!pause || pause.pauseTime <= 0 && pause.superPauseTime <= 0) return false;
  return pause.ownerEntityId !== player.id || pause.moveTime <= 0;
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
  const override = player.widthOverride?.player;
  const rawFront = override?.front ?? (configured
    ? mode === 'air' ? configured.airFront : configured.groundFront
    : mode === 'air' ? DEFAULT_AIR_FRONT : DEFAULT_GROUND_FRONT);
  const rawBack = override?.back ?? (configured
    ? mode === 'air' ? configured.airBack : configured.groundBack
    : mode === 'air' ? DEFAULT_AIR_BACK : DEFAULT_GROUND_BACK);
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
    source: override ? 'width_controller' : configured ? 'character_size' : 'winmugen_defaults',
  };
}

export function buildScreenEdgeBox(player: PlayerState): PushBox {
  const edge = player.widthOverride?.edge;
  if (!edge) return buildPushBox(player);
  const configured = player.collisionWidth;
  const scaleX = finiteScale(configured?.xScale);
  const scaleY = finiteScale(configured?.yScale);
  const front = Math.max(0, edge.front) * scaleX;
  const back = Math.max(0, edge.back) * scaleX;
  const height = Math.max(0, configured?.height ?? DEFAULT_HEIGHT) * scaleY;
  return {
    left: player.x - (player.facing === 1 ? back : front),
    right: player.x + (player.facing === 1 ? front : back),
    top: player.y - height,
    bottom: player.y,
    front,
    back,
    height,
    mode: isAirborne(player) ? 'air' : 'ground',
    source: 'width_controller',
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
