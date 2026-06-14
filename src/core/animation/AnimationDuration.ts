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

export function calculateMugenAnimTime(
  elapsedAnimTime: number,
  animationDuration: number | null | undefined,
): number {
  if (animationDuration === null || animationDuration === undefined) {
    return elapsedAnimTime;
  }

  return Math.max(0, animationDuration - elapsedAnimTime);
}
