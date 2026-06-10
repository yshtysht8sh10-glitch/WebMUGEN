import { describe, expect, it } from 'vitest';
import { parseAirText } from '../../parser/air/AirParser';
import {
  getAnimationLength,
  getCurrentAnimationElement,
  isAnimationFinished,
} from './AnimationPlayer';

describe('AnimationPlayer', () => {
  const document = parseAirText(`
Begin Action 20
20,0, 0,0, 4
20,1, 0,0, 4
20,2, 0,0, 4
`);

  it('gets animation length', () => {
    expect(getAnimationLength(document, 20)).toBe(12);
  });

  it('gets current element by animTime', () => {
    expect(getCurrentAnimationElement(document, 20, 0)?.element.imageNo).toBe(0);
    expect(getCurrentAnimationElement(document, 20, 4)?.element.imageNo).toBe(1);
    expect(getCurrentAnimationElement(document, 20, 8)?.element.imageNo).toBe(2);
  });

  it('loops animation element', () => {
    expect(getCurrentAnimationElement(document, 20, 12)?.element.imageNo).toBe(0);
  });

  it('detects animation finished', () => {
    expect(isAnimationFinished(document, 20, 11)).toBe(false);
    expect(isAnimationFinished(document, 20, 12)).toBe(true);
  });
});
