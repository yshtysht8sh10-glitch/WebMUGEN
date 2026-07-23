import type { CnsDocument } from '../../mugen/common/cnsTypes';
import { findCnsState } from '../../mugen/common/CnsStateIndex';
import type { HelperEntity, HelperRuntimeState, PlayerState } from '../engine/types';

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
  spawnFrame: number;
  parent: PlayerState;
};

export function createInitialHelperState(): HelperRuntimeState {
  return { entries: [], nextEntityId: 3 };
}

export function spawnHelper(state: HelperRuntimeState, request: HelperSpawnRequest, cns?: CnsDocument | null): HelperRuntimeState {
  const stateDef = findCnsState(cns, request.stateNo);
  const player: PlayerState = {
    ...request.parent,
    id: request.rootEntityId,
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
    vars: {},
    fvars: {},
    sysVars: {},
    sysFVars: {},
    hitDiagnosticLines: [],
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
    spawnFrame: request.spawnFrame,
    player,
  };
  return { entries: [...state.entries, entity], nextEntityId: state.nextEntityId + 1 };
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
