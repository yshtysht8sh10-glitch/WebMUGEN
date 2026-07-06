import type { AirAction, AirDocument, AirElement } from '../../parser/air/AirTypes';

export type CurrentAnimationElement = {
  action: AirAction;
  element: AirElement;
  elementIndex: number;
  localTime: number;
};

export function getAnimationLength(document: AirDocument, actionNo: number): number {
  const action = findAction(document, actionNo);
  if (!action || action.elements.length === 0) {
    return 1;
  }

  if (action.elements.some((element) => element.duration < 0)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(
    1,
    action.elements.reduce((sum, element) => sum + Math.max(1, element.duration), 0),
  );
}

export function getCurrentAnimationElement(
  document: AirDocument,
  actionNo: number,
  animTime: number,
): CurrentAnimationElement | null {
  const action = findAction(document, actionNo);
  if (!action || action.elements.length === 0) {
    return null;
  }

  const normalizedTime = normalizeAnimationTime(action, animTime);
  let cursor = 0;

  for (let index = 0; index < action.elements.length; index += 1) {
    const element = action.elements[index];

    if (element.duration < 0) {
      return {
        action,
        element,
        elementIndex: index,
        localTime: Math.max(0, normalizedTime - cursor),
      };
    }

    const duration = Math.max(1, element.duration);
    if (normalizedTime < cursor + duration) {
      return {
        action,
        element,
        elementIndex: index,
        localTime: normalizedTime - cursor,
      };
    }

    cursor += duration;
  }

  const lastIndex = action.elements.length - 1;
  return {
    action,
    element: action.elements[lastIndex],
    elementIndex: lastIndex,
    localTime: Math.max(0, animTime - cursor),
  };
}

export function findAction(document: AirDocument, actionNo: number): AirAction | undefined {
  return document.actions.find((action) => action.actionNo === actionNo);
}

function normalizeAnimationTime(action: AirAction, animTime: number): number {
  const safeTime = Math.max(0, animTime);

  if (action.elements.length === 0) {
    return 0;
  }

  const infiniteIndex = action.elements.findIndex((element) => element.duration < 0);
  if (infiniteIndex >= 0) {
    const beforeInfinite = action.elements
      .slice(0, infiniteIndex)
      .reduce((sum, element) => sum + Math.max(1, element.duration), 0);
    return Math.min(safeTime, beforeInfinite);
  }

  const length = getAnimationLengthFromAction(action);
  if (length <= 0) {
    return 0;
  }

  if (action.loopStartIndex !== null && action.loopStartIndex !== undefined) {
    const loopStartTime = action.elements
      .slice(0, action.loopStartIndex)
      .reduce((sum, element) => sum + Math.max(1, element.duration), 0);
    const loopLength = Math.max(1, length - loopStartTime);

    if (safeTime >= length) {
      return loopStartTime + ((safeTime - loopStartTime) % loopLength);
    }
  }

  if (safeTime === length) {
    return length - 1;
  }

  // Real-world AIR files often omit LoopStart for idle animations.
  // Loop by default after the terminal frame instead of returning null.
  return safeTime % Math.max(1, length);
}

function getAnimationLengthFromAction(action: AirAction): number {
  return action.elements.reduce((sum, element) => sum + Math.max(1, element.duration), 0);
}
