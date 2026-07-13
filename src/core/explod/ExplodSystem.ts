import type { GameState } from '../engine/types';

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
