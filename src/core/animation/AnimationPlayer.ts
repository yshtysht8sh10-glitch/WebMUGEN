import type { AirAction, AirDocument, AirElement } from '../../parser/air/AirTypes';
import { findAirAction } from '../../parser/air/AirParser';

export type CurrentAnimationElement = {
  element: AirElement;
  elementIndex: number;
  localTime: number;
};

export function getCurrentAnimationElement(
  document: AirDocument,
  animNo: number,
  animTime: number,
): CurrentAnimationElement | null {
  const action = findAirAction(document, animNo);
  if (!action || action.elements.length === 0) {
    return null;
  }

  const normalizedTime = normalizeAnimationTime(action, animTime);
  let cursor = 0;

  for (let index = 0; index < action.elements.length; index += 1) {
    const element = action.elements[index];
    const duration = getElementDuration(element);

    if (normalizedTime < cursor + duration) {
      return {
        element,
        elementIndex: index,
        localTime: normalizedTime - cursor,
      };
    }

    cursor += duration;
  }

  const lastIndex = action.elements.length - 1;
  return {
    element: action.elements[lastIndex],
    elementIndex: lastIndex,
    localTime: 0,
  };
}

export function getAnimationLength(document: AirDocument, animNo: number): number {
  const action = findAirAction(document, animNo);
  if (!action) {
    return 60;
  }

  const total = action.elements.reduce((sum, element) => sum + getElementDuration(element), 0);
  return total > 0 ? total : 1;
}

export function isAnimationFinished(document: AirDocument, animNo: number, animTime: number): boolean {
  return animTime >= getAnimationLength(document, animNo);
}

function normalizeAnimationTime(action: AirAction, animTime: number): number {
  const total = action.elements.reduce((sum, element) => sum + getElementDuration(element), 0);

  if (total <= 0) {
    return 0;
  }

  return animTime % total;
}

function getElementDuration(element: AirElement): number {
  // MUGENでは-1など特殊なdurationがあるが、Phase10では最低1Fとして扱う。
  return element.duration > 0 ? element.duration : 1;
}
