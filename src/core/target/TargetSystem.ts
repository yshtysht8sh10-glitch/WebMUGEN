export type TargetLink = {
  ownerId: 1 | 2;
  targetId: 1 | 2;
  hitId: number;
  bindTime: number;
};

export type TargetState = {
  links: TargetLink[];
  nextHitId: number;
};

export function createInitialTargetState(): TargetState {
  return {
    links: [],
    nextHitId: 1,
  };
}

export function addTarget(
  state: TargetState,
  ownerId: 1 | 2,
  targetId: 1 | 2,
  bindTime: number = 0,
): TargetState {
  const hitId = state.nextHitId;

  return {
    links: [
      ...state.links.filter((link) => !(link.ownerId === ownerId && link.targetId === targetId)),
      { ownerId, targetId, hitId, bindTime: Math.max(0, bindTime) },
    ],
    nextHitId: hitId + 1,
  };
}

export function dropTargets(state: TargetState, ownerId: 1 | 2): TargetState {
  return {
    ...state,
    links: state.links.filter((link) => link.ownerId !== ownerId),
  };
}

export function hasTarget(state: TargetState, ownerId: 1 | 2): boolean {
  return state.links.some((link) => link.ownerId === ownerId);
}

export function getTargets(state: TargetState, ownerId: 1 | 2): TargetLink[] {
  return state.links.filter((link) => link.ownerId === ownerId);
}

export function stepTargets(state: TargetState): TargetState {
  return {
    ...state,
    links: state.links
      .map((link) => ({ ...link, bindTime: Math.max(0, link.bindTime - 1) }))
      .filter((link) => link.bindTime > 0),
  };
}
