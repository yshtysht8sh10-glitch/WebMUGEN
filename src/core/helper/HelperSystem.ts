import type { PlayerState } from '../engine/types';

export type HelperEntity = {
  id: number;
  ownerId: 1 | 2;
  stateNo: number;
  x: number;
  y: number;
  facing: 1 | -1;
  lifeTime: number | null;
};

export type HelperState = {
  helpers: HelperEntity[];
  nextHelperId: number;
};

export function createInitialHelperState(): HelperState {
  return {
    helpers: [],
    nextHelperId: 1,
  };
}

export function spawnHelper(
  state: HelperState,
  owner: PlayerState,
  ownerId: 1 | 2,
  input: { id?: number; stateNo: number; x?: number; y?: number; lifeTime?: number | null },
): HelperState {
  const id = input.id ?? state.nextHelperId;

  return {
    helpers: [
      ...state.helpers,
      {
        id,
        ownerId,
        stateNo: input.stateNo,
        x: owner.x + (input.x ?? 0),
        y: owner.y + (input.y ?? 0),
        facing: owner.facing,
        lifeTime: input.lifeTime ?? null,
      },
    ],
    nextHelperId: Math.max(state.nextHelperId, id + 1),
  };
}

export function destroyHelper(state: HelperState, id: number): HelperState {
  return {
    ...state,
    helpers: state.helpers.filter((helper) => helper.id !== id),
  };
}

export function countHelpers(state: HelperState, ownerId?: 1 | 2): number {
  return ownerId ? state.helpers.filter((helper) => helper.ownerId === ownerId).length : state.helpers.length;
}

export function stepHelpers(state: HelperState): HelperState {
  return {
    ...state,
    helpers: state.helpers
      .map((helper) => ({
        ...helper,
        lifeTime: helper.lifeTime === null ? null : Math.max(0, helper.lifeTime - 1),
      }))
      .filter((helper) => helper.lifeTime === null || helper.lifeTime > 0),
  };
}
