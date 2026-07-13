import type { GameState } from '../engine/types';
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
  shadow: number;
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

export type ExplodCreateRequest = Omit<ExplodRuntimeEntry, 'runtimeId' | 'animTime' | 'animElement' | 'creationFrame' | 'age' | 'removalReason'>;

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

export type ExplodAnimationResolver = (entry: ExplodRuntimeEntry) => AirDocument | null | undefined;

export function stepExplodRuntime(gameState: GameState, resolveAnimation: ExplodAnimationResolver): GameState {
  const entries: ExplodRuntimeEntry[] = [];
  const diagnosticLines = [...(gameState.hitDiagnosticLines ?? [])];

  for (const entry of gameState.explods.entries) {
    const creationFrame = entry.creationFrame === gameState.frame && entry.age === 0;
    const nextAge = creationFrame ? entry.age : entry.age + 1;
    const nextAnimTime = creationFrame ? entry.animTime : entry.animTime + 1;
    const air = resolveAnimation(entry);
    const action = air ? findAction(air, entry.animNo) : undefined;
    const currentElement = air ? getCurrentAnimationElement(air, entry.animNo, nextAnimTime) : null;
    const nextAnimElement = currentElement ? currentElement.elementIndex + 1 : entry.animElement;

    const removalReason = getExplodRemovalReason(entry, action, air, nextAge, nextAnimTime);
    if (removalReason) {
      diagnosticLines.push(
        `raw.explod_step internalId=${entry.runtimeId} mugenId=${entry.mugenId} result=removed reason=${removalReason} age=${nextAge} animTime=${nextAnimTime} elem=${nextAnimElement || '-'}`,
      );
      continue;
    }

    const bindResult = creationFrame ? { bind: entry.bind, position: entry.position, diagnostic: '' } : stepExplodBind(entry, gameState);
    const nextEntry: ExplodRuntimeEntry = {
      ...entry,
      age: nextAge,
      animTime: nextAnimTime,
      animElement: nextAnimElement,
      bind: bindResult.bind,
      position: bindResult.position,
    };
    entries.push(nextEntry);
    diagnosticLines.push(
      `raw.explod_step internalId=${entry.runtimeId} mugenId=${entry.mugenId} result=kept age=${nextAge} animTime=${nextAnimTime} elem=${nextAnimElement || '-'} bind=${nextEntry.bind?.remaining ?? 0} pos=(${nextEntry.position.x},${nextEntry.position.y})${bindResult.diagnostic}`,
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
  nextAge: number,
  nextAnimTime: number,
): 'removetime_zero' | 'removetime' | 'animtime_zero' | null {
  if (entry.removeTime === 0) return 'removetime_zero';
  if (entry.removeTime !== null && entry.removeTime > 0 && nextAge >= entry.removeTime) return 'removetime';
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
