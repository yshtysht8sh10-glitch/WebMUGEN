import type { GameState, PlayerState } from '../engine/types';
import { getAnimationLength, getCurrentAnimationElement, findAction } from '../animation/AnimationPlayer';
import type { AirDocument } from '../../parser/air/AirTypes';

export type RuntimeEntityRef = {
  entityId: number;
  rootPlayerId: 1 | 2;
};

export type ExplodPostype = 'p1' | 'p2' | 'front' | 'back' | 'left' | 'right' | 'none';
export type ExplodCoordinateSpace = 'stage' | 'screen';

export type ExplodRenderSnapshot = {
  transparency: string | null;
  alpha: { source: number; destination: number } | null;
  scaleX: number;
  scaleY: number;
  ownPalette: boolean;
  shadow: { red: number; green: number; blue: number };
};

export type ExplodRuntimeEntry = {
  runtimeId: number;
  mugenId: number;
  owner: RuntimeEntityRef;
  animationOwner: RuntimeEntityRef | null;
  animationSource: 'owner' | 'fightfx';
  animNo: number;
  animTime: number;
  animElement: number;
  creationFrame: number;
  age: number;
  position: { x: number; y: number };
  offset: { x: number; y: number };
  velocity: { x: number; y: number };
  acceleration: { x: number; y: number };
  facing: 1 | -1;
  verticalFacing: 1 | -1;
  postype: ExplodPostype;
  coordinateSpace: ExplodCoordinateSpace;
  bind: { targetEntityId: number; remaining: number; offsetX: number; offsetY: number } | null;
  removeTime: number | null;
  removeTimeElapsed: number;
  removeTimeStartFrame: number;
  removalReason: string | null;
  spritePriority: number;
  onTop: boolean;
  pauseMoveTime: number;
  superMoveTime: number;
  removeOnGetHit: boolean;
  random: { x: number; y: number };
  render: ExplodRenderSnapshot;
};

export type ExplodRuntimeState = {
  entries: ExplodRuntimeEntry[];
  nextRuntimeId: number;
};

export type ExplodCreateRequest = Omit<ExplodRuntimeEntry, 'runtimeId' | 'animTime' | 'animElement' | 'creationFrame' | 'age' | 'removeTimeElapsed' | 'removeTimeStartFrame' | 'removalReason'>;

export type ExplodModifyPatch = {
  animation?: { source: 'owner' | 'fightfx'; animNo: number };
  offset?: { x: number; y: number };
  postype?: ExplodPostype;
  facingParameter?: 1 | -1;
  verticalFacing?: 1 | -1;
  bindTime?: number;
  velocity?: { x: number; y: number };
  acceleration?: { x: number; y: number };
  random?: { x: number; y: number };
  removeTime?: number | null;
  superMoveTime?: number;
  pauseMoveTime?: number;
  scale?: { x: number; y: number };
  spritePriority?: number;
  onTop?: boolean;
  shadow?: { red: number; green: number; blue: number };
  ownPalette?: boolean;
  removeOnGetHit?: boolean;
};

export type ExplodModifyEvent = {
  type: 'modify';
  owner: RuntimeEntityRef;
  mugenId: number | null;
  patch: ExplodModifyPatch;
  changedFields: string[];
  screenWidth: number;
};

export type ExplodCreateRejection = {
  type: 'rejected';
  owner: RuntimeEntityRef;
  reason: 'missing_anim' | 'invalid_anim';
  rawAnim: string;
};

export type ExplodCreateEvent =
  | { type: 'create'; request: ExplodCreateRequest }
  | ExplodCreateRejection;

export function createInitialExplodRuntimeState(): ExplodRuntimeState {
  return { entries: [], nextRuntimeId: 1 };
}

export function applyExplodCreateEvents(gameState: GameState, events: readonly ExplodCreateEvent[]): GameState {
  let explods = gameState.explods;
  const diagnosticLines = [...(gameState.hitDiagnosticLines ?? [])];

  for (const event of events) {
    if (event.type === 'rejected') {
      diagnosticLines.push(`raw.explod_create_rejected owner=p${event.owner.rootPlayerId} reason=${event.reason} anim=${event.rawAnim || '-'}`);
      continue;
    }

    const runtimeId = explods.nextRuntimeId;
    const entry: ExplodRuntimeEntry = {
      ...event.request,
      runtimeId,
      animTime: 0,
      animElement: 0,
      creationFrame: gameState.frame,
      age: 0,
      removeTimeElapsed: 0,
      removeTimeStartFrame: gameState.frame,
      removalReason: null,
    };
    explods = {
      entries: [...explods.entries, entry],
      nextRuntimeId: runtimeId + 1,
    };
    diagnosticLines.push(
      `raw.explod_create owner=p${entry.owner.rootPlayerId} internalId=${entry.runtimeId} mugenId=${entry.mugenId}`,
      `  anim=${entry.animationSource === 'fightfx' ? 'F' : ''}${entry.animNo} postype=${entry.postype} pos=(${entry.offset.x},${entry.offset.y}) world=(${entry.position.x},${entry.position.y}) facing=${entry.facing} vfacing=${entry.verticalFacing}`,
      `  bindtime=${entry.bind?.remaining ?? 0} removetime=${entry.removeTime ?? -1} sprpriority=${entry.spritePriority} ontop=${entry.onTop ? 1 : 0}`,
    );
  }

  return { ...gameState, explods, hitDiagnosticLines: diagnosticLines };
}

export function applyExplodModifyEvents(gameState: GameState, events: readonly ExplodModifyEvent[]): GameState {
  let entries = gameState.explods.entries;
  const diagnosticLines = [...(gameState.hitDiagnosticLines ?? [])];

  for (const event of events) {
    if (event.mugenId === null) {
      diagnosticLines.push(`raw.explod_modify owner=p${event.owner.rootPlayerId} id=- matched=0 reason=id_missing`);
      continue;
    }

    const internalIds: number[] = [];
    entries = entries.map((entry) => {
      if (!sameRuntimeOwner(entry.owner, event.owner) || entry.mugenId !== event.mugenId) return entry;
      internalIds.push(entry.runtimeId);
      return applyExplodModifyPatch(entry, event, gameState);
    });
    diagnosticLines.push(
      `raw.explod_modify owner=p${event.owner.rootPlayerId} id=${event.mugenId} matched=${internalIds.length}${internalIds.length === 0 ? ' reason=not_found' : ''}`,
      `  changed=[${event.changedFields.join(',') || '-'}] internalIds=[${internalIds.join(',') || '-'}]`,
    );
  }

  return { ...gameState, explods: { ...gameState.explods, entries }, hitDiagnosticLines: diagnosticLines };
}

function applyExplodModifyPatch(entry: ExplodRuntimeEntry, event: ExplodModifyEvent, gameState: GameState): ExplodRuntimeEntry {
  const patch = event.patch;
  const owner = gameState.players.find((player) => player.id === event.owner.entityId);
  const opponent = gameState.players.find((player) => player.id !== event.owner.rootPlayerId) ?? gameState.players[1];
  const postype = patch.postype ?? entry.postype;
  const offset = patch.offset ?? entry.offset;
  const resolved = owner ? resolveExplodOrigin(postype, owner, opponent, offset.x, offset.y, event.screenWidth) : null;
  const facing = patch.facingParameter === undefined
    ? entry.facing
    : normalizeExplodFacing((resolved?.baseFacing ?? 1) * patch.facingParameter);
  const coordinateChanged = patch.offset !== undefined || patch.postype !== undefined;
  const bindChanged = patch.bindTime !== undefined || (coordinateChanged && entry.bind !== null);
  const bindTime = patch.bindTime ?? entry.bind?.remaining ?? 0;
  const bind = bindChanged
    ? resolved?.bindTargetEntityId !== null && resolved?.bindTargetEntityId !== undefined && bindTime !== 0
      ? { targetEntityId: resolved.bindTargetEntityId, remaining: bindTime, offsetX: offset.x, offsetY: offset.y }
      : null
    : entry.bind;
  const animationChanged = patch.animation !== undefined
    && (patch.animation.animNo !== entry.animNo || patch.animation.source !== entry.animationSource);
  const removeTimeChanged = Object.prototype.hasOwnProperty.call(patch, 'removeTime');

  return {
    ...entry,
    animationSource: patch.animation?.source ?? entry.animationSource,
    animationOwner: patch.animation ? (patch.animation.source === 'owner' ? event.owner : null) : entry.animationOwner,
    animNo: patch.animation?.animNo ?? entry.animNo,
    animTime: animationChanged ? 0 : entry.animTime,
    animElement: animationChanged ? 0 : entry.animElement,
    position: coordinateChanged && resolved ? { x: resolved.x, y: resolved.y } : entry.position,
    offset,
    postype,
    coordinateSpace: coordinateChanged && resolved ? resolved.coordinateSpace : entry.coordinateSpace,
    facing,
    verticalFacing: patch.verticalFacing ?? entry.verticalFacing,
    bind,
    velocity: patch.velocity ? { x: patch.velocity.x * facing, y: patch.velocity.y } : entry.velocity,
    acceleration: patch.acceleration ? { x: patch.acceleration.x * facing, y: patch.acceleration.y } : entry.acceleration,
    random: patch.random ?? entry.random,
    removeTime: removeTimeChanged ? patch.removeTime ?? null : entry.removeTime,
    removeTimeElapsed: removeTimeChanged ? 0 : entry.removeTimeElapsed,
    removeTimeStartFrame: removeTimeChanged ? gameState.frame : entry.removeTimeStartFrame,
    superMoveTime: patch.superMoveTime ?? entry.superMoveTime,
    pauseMoveTime: patch.pauseMoveTime ?? entry.pauseMoveTime,
    spritePriority: patch.spritePriority ?? entry.spritePriority,
    onTop: patch.onTop ?? entry.onTop,
    removeOnGetHit: patch.removeOnGetHit ?? entry.removeOnGetHit,
    render: {
      ...entry.render,
      scaleX: patch.scale?.x ?? entry.render.scaleX,
      scaleY: patch.scale?.y ?? entry.render.scaleY,
      shadow: patch.shadow ?? entry.render.shadow,
      ownPalette: patch.ownPalette ?? entry.render.ownPalette,
    },
  };
}

function sameRuntimeOwner(left: RuntimeEntityRef, right: RuntimeEntityRef): boolean {
  return left.entityId === right.entityId && left.rootPlayerId === right.rootPlayerId;
}

export function resolveExplodOrigin(
  postype: ExplodPostype,
  player: Pick<PlayerState, 'id' | 'x' | 'y' | 'facing'>,
  opponent: Pick<PlayerState, 'id' | 'x' | 'y' | 'facing'>,
  offsetX: number,
  offsetY: number,
  screenWidth: number,
): { x: number; y: number; baseFacing: 1 | -1; coordinateSpace: ExplodCoordinateSpace; bindTargetEntityId: number | null } {
  if (postype === 'p1') return { x: player.x + offsetX * player.facing, y: player.y + offsetY, baseFacing: player.facing, coordinateSpace: 'stage', bindTargetEntityId: player.id };
  if (postype === 'p2') return { x: opponent.x + offsetX * opponent.facing, y: opponent.y + offsetY, baseFacing: opponent.facing, coordinateSpace: 'stage', bindTargetEntityId: opponent.id };
  if (postype === 'front') return { x: (player.facing === 1 ? screenWidth : 0) + offsetX, y: offsetY, baseFacing: 1, coordinateSpace: 'screen', bindTargetEntityId: null };
  if (postype === 'back') return { x: (player.facing === 1 ? 0 : screenWidth) + offsetX * player.facing, y: offsetY, baseFacing: player.facing, coordinateSpace: 'screen', bindTargetEntityId: null };
  if (postype === 'left') return { x: offsetX, y: offsetY, baseFacing: 1, coordinateSpace: 'screen', bindTargetEntityId: null };
  if (postype === 'right') return { x: screenWidth + offsetX, y: offsetY, baseFacing: 1, coordinateSpace: 'screen', bindTargetEntityId: null };
  return { x: offsetX, y: offsetY, baseFacing: 1, coordinateSpace: 'stage', bindTargetEntityId: null };
}

export function normalizeExplodFacing(value: number): 1 | -1 {
  return value < 0 ? -1 : 1;
}

export type ExplodAnimationResolver = (entry: ExplodRuntimeEntry) => AirDocument | null | undefined;

export function stepExplodRuntime(gameState: GameState, resolveAnimation: ExplodAnimationResolver): GameState {
  const entries: ExplodRuntimeEntry[] = [];
  const diagnosticLines = [...(gameState.hitDiagnosticLines ?? [])];

  for (const entry of gameState.explods.entries) {
    const creationFrame = entry.creationFrame === gameState.frame && entry.age === 0;
    const nextAge = creationFrame ? entry.age : entry.age + 1;
    const nextAnimTime = creationFrame ? entry.animTime : entry.animTime + 1;
    const currentRemoveTimeElapsed = Number.isFinite(entry.removeTimeElapsed) ? entry.removeTimeElapsed : entry.age;
    const removeTimeStartFrame = (Number.isFinite(entry.removeTimeStartFrame) ? entry.removeTimeStartFrame : entry.creationFrame) === gameState.frame;
    const nextRemoveTimeElapsed = removeTimeStartFrame ? currentRemoveTimeElapsed : currentRemoveTimeElapsed + 1;
    const air = resolveAnimation(entry);
    const action = air ? findAction(air, entry.animNo) : undefined;
    const currentElement = air ? getCurrentAnimationElement(air, entry.animNo, nextAnimTime) : null;
    const nextAnimElement = currentElement ? currentElement.elementIndex + 1 : entry.animElement;

    const removalReason = getExplodRemovalReason(entry, action, air, nextRemoveTimeElapsed, nextAnimTime);
    if (removalReason) {
      diagnosticLines.push(
        `raw.explod_step internalId=${entry.runtimeId} mugenId=${entry.mugenId} result=removed reason=${removalReason} age=${nextAge} removeElapsed=${nextRemoveTimeElapsed} animTime=${nextAnimTime} elem=${nextAnimElement || '-'}`,
      );
      continue;
    }

    const bindResult = creationFrame ? { bind: entry.bind, position: entry.position, diagnostic: '' } : stepExplodBind(entry, gameState);
    const nextEntry: ExplodRuntimeEntry = {
      ...entry,
      age: nextAge,
      animTime: nextAnimTime,
      animElement: nextAnimElement,
      removeTimeElapsed: nextRemoveTimeElapsed,
      bind: bindResult.bind,
      position: bindResult.position,
    };
    entries.push(nextEntry);
    diagnosticLines.push(
      `raw.explod_step internalId=${entry.runtimeId} mugenId=${entry.mugenId} result=kept age=${nextAge} removeElapsed=${nextRemoveTimeElapsed} animTime=${nextAnimTime} elem=${nextAnimElement || '-'} bind=${nextEntry.bind?.remaining ?? 0} pos=(${nextEntry.position.x},${nextEntry.position.y})${bindResult.diagnostic}`,
    );
  }

  return {
    ...gameState,
    explods: { ...gameState.explods, entries },
    hitDiagnosticLines: diagnosticLines,
  };
}

function getExplodRemovalReason(
  entry: ExplodRuntimeEntry,
  action: ReturnType<typeof findAction>,
  air: AirDocument | null | undefined,
  nextRemoveTimeElapsed: number,
  nextAnimTime: number,
): 'removetime_zero' | 'removetime' | 'animtime_zero' | null {
  if (entry.removeTime === 0) return 'removetime_zero';
  if (entry.removeTime !== null && entry.removeTime > 0 && nextRemoveTimeElapsed >= entry.removeTime) return 'removetime';
  if (entry.removeTime !== -2 || !air || !action) return null;
  if (action.loopStartIndex !== null && action.loopStartIndex !== undefined) return null;
  const animationLength = getAnimationLength(air, entry.animNo);
  if (!Number.isFinite(animationLength)) return null;
  return nextAnimTime >= animationLength ? 'animtime_zero' : null;
}

function stepExplodBind(
  entry: ExplodRuntimeEntry,
  gameState: GameState,
): { bind: ExplodRuntimeEntry['bind']; position: ExplodRuntimeEntry['position']; diagnostic: string } {
  const bind = entry.bind;
  if (!bind) return { bind: null, position: entry.position, diagnostic: '' };
  if (bind.remaining === 0 || bind.remaining === 1) {
    return { bind: null, position: entry.position, diagnostic: ' bindResult=released' };
  }

  const target = gameState.players.find((player) => player.id === bind.targetEntityId);
  if (!target) return { bind: null, position: entry.position, diagnostic: ' bindResult=released_owner_missing' };

  return {
    bind: bind.remaining < 0 ? bind : { ...bind, remaining: bind.remaining - 1 },
    position: {
      x: target.x + bind.offsetX * target.facing,
      y: target.y + bind.offsetY,
    },
    diagnostic: ' bindResult=followed',
  };
}
