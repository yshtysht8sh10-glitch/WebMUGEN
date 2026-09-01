import type { CnsDocument } from '../../mugen/common/cnsTypes';
import { findCnsState } from '../../mugen/common/CnsStateIndex';
import type { HelperEntity, HelperRuntimeState, PlayerState } from '../engine/types';
import { readCnsConst } from '../cns/CnsConstants';

export type HelperSpawnRequest = {
  helperId: number;
  rootEntityId: 1 | 2;
  parentEntityId: number;
  ownerCharacterId: 1 | 2;
  stateOwnerId: 1 | 2;
  animationOwnerId: 1 | 2;
  stateNo: number;
  x: number;
  y: number;
  facing: 1 | -1;
  keyCtrl: boolean;
  ownPal: boolean;
  sizeXScale?: number;
  sizeYScale?: number;
  pauseMoveTime?: number;
  superMoveTime?: number;
  spawnFrame: number;
  parent: PlayerState;
};

// WinMUGEN's [Config] HelperMax accepts at most 56 Helpers in total.
// WebMUGEN does not expose mugen.cfg yet, so use that compatibility ceiling
// to bound same-tick Helper creation without inventing a generation rule.
export const WINMUGEN_HELPER_MAX = 56;

export function createInitialHelperState(): HelperRuntimeState {
  return { entries: [], nextEntityId: 3 };
}

export function spawnHelper(state: HelperRuntimeState, request: HelperSpawnRequest, cns?: CnsDocument | null): HelperRuntimeState {
  const stateDef = findCnsState(cns, request.stateNo);
  const player: PlayerState = {
    ...request.parent,
    id: request.rootEntityId,
    helperId: request.helperId,
    x: request.x,
    y: request.y,
    vx: stateDef?.velocitySet?.x ? stateDef.velocitySet.x * request.facing : 0,
    vy: stateDef?.velocitySet?.y ?? 0,
    facing: request.facing,
    stateNo: request.stateNo,
    prevStateNo: request.stateNo,
    stateTime: 0,
    stateType: normalizeStateType(stateDef?.stateType) ?? 'S',
    moveType: normalizeMoveType(stateDef?.moveType) ?? 'I',
    physics: normalizePhysics(stateDef?.physics) ?? 'N',
    ctrl: stateDef?.ctrl ?? false,
    // Helpers start as independent players in WinMUGEN. In particular, they
    // do not inherit the parent's current sprite priority before entering
    // their initial StateDef.
    sprPriority: stateDef?.sprPriority ?? 0,
    animNo: stateDef?.initialAnim ?? request.stateNo,
    animTime: 0,
    hitPause: 0,
    activeHitDef: null,
    hitDefUsed: false,
    hitTargets: [],
    targets: [],
    moveContact: undefined,
    stateOwnerId: request.stateOwnerId,
    selfStateOwnerId: request.ownerCharacterId,
    animationOwnerId: request.animationOwnerId,
    vars: {},
    fvars: {},
    sysVars: {},
    sysFVars: {},
    hitDiagnosticLines: [],
    // Normal Helpers are not screen-bound and do not move the camera unless
    // their own one-tick ScreenBound controller explicitly opts in.
    screenBound: { value: false, moveCameraX: false, moveCameraY: false },
    collisionWidth: {
      groundFront: request.parent.collisionWidth?.groundFront ?? readCnsConst(cns, 'size.ground.front'),
      groundBack: request.parent.collisionWidth?.groundBack ?? readCnsConst(cns, 'size.ground.back'),
      airFront: request.parent.collisionWidth?.airFront ?? readCnsConst(cns, 'size.air.front'),
      airBack: request.parent.collisionWidth?.airBack ?? readCnsConst(cns, 'size.air.back'),
      height: request.parent.collisionWidth?.height ?? readCnsConst(cns, 'size.height'),
      xScale: request.sizeXScale ?? 1,
      yScale: request.sizeYScale ?? 1,
    },
  };
  const entity: HelperEntity = {
    entityId: state.nextEntityId,
    helperId: request.helperId,
    rootEntityId: request.rootEntityId,
    parentEntityId: request.parentEntityId,
    ownerCharacterId: request.ownerCharacterId,
    stateOwnerId: request.stateOwnerId,
    animationOwnerId: request.animationOwnerId,
    keyCtrl: request.keyCtrl,
    ownPal: request.ownPal,
    pauseMoveTime: Math.max(0, Math.trunc(request.pauseMoveTime ?? 0)),
    superMoveTime: Math.max(0, Math.trunc(request.superMoveTime ?? 0)),
    spawnFrame: request.spawnFrame,
    hasCompletedInitialStatePass: false,
    canRenderBeforeInitialStatePass: hasStableInitialPresentation(stateDef),
    player,
  };
  return { entries: [...state.entries, entity], nextEntityId: state.nextEntityId + 1 };
}

const INITIAL_PRESENTATION_CONTROLLER_TYPES = new Set([
  'allpalfx',
  'angledraw',
  'angleset',
  'assertspecial',
  'bindtoparent',
  'bindtoroot',
  'bindtotarget',
  'changeanim',
  'changeanim2',
  'offset',
  'palfx',
  'posadd',
  'posset',
  'remappal',
  'sprpriority',
  'trans',
  'turn',
]);

function hasStableInitialPresentation(stateDef: ReturnType<typeof findCnsState>): boolean {
  if (!stateDef || stateDef.initialAnimExpression) return false;
  return !stateDef.controllers.some((controller) => (
    INITIAL_PRESENTATION_CONTROLLER_TYPES.has(controller.type.trim().toLowerCase())
  ));
}

export function destroyHelper(state: HelperRuntimeState, entityId: number): HelperRuntimeState {
  return { ...state, entries: state.entries.filter((helper) => helper.entityId !== entityId) };
}

export function countHelpers(state: HelperRuntimeState, rootEntityId: 1 | 2, helperId?: number): number {
  return state.entries.filter((helper) => helper.rootEntityId === rootEntityId && (helperId === undefined || helper.helperId === helperId)).length;
}

function normalizeStateType(value: string | null | undefined): PlayerState['stateType'] | null {
  const normalized = value?.trim().toUpperCase();
  return normalized === 'S' || normalized === 'C' || normalized === 'A' || normalized === 'L' ? normalized : null;
}

function normalizeMoveType(value: string | null | undefined): PlayerState['moveType'] | null {
  const normalized = value?.trim().toUpperCase();
  return normalized === 'I' || normalized === 'A' || normalized === 'H' ? normalized : null;
}

function normalizePhysics(value: string | null | undefined): PlayerState['physics'] | null {
  const normalized = value?.trim().toUpperCase();
  return normalized === 'S' || normalized === 'C' || normalized === 'A' || normalized === 'N' ? normalized : null;
}
