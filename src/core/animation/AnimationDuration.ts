import type { AirDocument } from '../../parser/air/AirTypes';

export function getAnimationDuration(air: AirDocument | null | undefined, actionNo: number): number | null {
  if (!air) {
    return null;
  }

  const action = air.actions.find((candidate) => candidate.actionNo === actionNo);
  if (!action) {
    return null;
  }

  const duration = action.elements.reduce((total, element) => total + Math.max(0, element.duration), 0);
  return duration > 0 ? duration : null;
}

export function getMugenAnimEndTime(air: AirDocument | null | undefined, actionNo: number): number | null {
  if (!air) {
    return null;
  }

  const action = air.actions.find((candidate) => candidate.actionNo === actionNo);
  if (!action || action.elements.length === 0) {
    return null;
  }

  const infiniteIndex = action.elements.findIndex((element) => element.duration < 0);
  if (infiniteIndex === 0) return -1;
  if (infiniteIndex > 0) {
    return action.elements
      .slice(0, infiniteIndex)
      .reduce((total, element) => total + Math.max(1, element.duration), 0);
  }

  return action.elements.reduce((total, element) => total + Math.max(1, element.duration), 0);
}

export function calculateMugenAnimTime(
  elapsedAnimTime: number,
  animationEndTime: number | null | undefined,
): number {
  if (animationEndTime === null || animationEndTime === undefined) {
    return elapsedAnimTime;
  }

  if (animationEndTime < 0) {
    return 1;
  }

  return Math.min(0, elapsedAnimTime - animationEndTime);
}
