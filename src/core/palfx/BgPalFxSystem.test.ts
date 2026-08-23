import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../engine/GameState';
import { applyBgPalFxEvents, applyPalFxToRgba, resolveBgPalFxFilter, stepBgPalFx } from './BgPalFxSystem';

describe('BGPalFX runtime', () => {
  it('applies add and multiply values independently per RGB channel', () => {
    const pixels = new Uint8ClampedArray([80, 80, 80, 255]);
    applyPalFxToRgba(pixels, {
      duration: 10, remainingTime: 10, elapsedTime: 0, color: 256, invertAll: false, ownerEntityId: 1,
      add: { red: 175, green: -190, blue: -190 },
      multiply: { red: 256, green: 256, blue: 256 },
      sinAdd: { red: 0, green: 0, blue: 0, period: 1 },
    });

    expect([...pixels]).toEqual([255, 0, 0, 255]);
  });

  it('retains the effect for its configured duration and targets the background filter', () => {
    const result = applyBgPalFxEvents(createInitialGameState(), [{
      duration: 20,
      color: 0,
      invertAll: true,
      add: { red: 0, green: 0, blue: 0 },
      multiply: { red: 0, green: 0, blue: 0 },
      sinAdd: { red: 0, green: 0, blue: 0, period: 0 },
      ownerEntityId: 1,
    }]);

    expect(resolveBgPalFxFilter(result.bgPalFx)).toBe('invert(1) grayscale(1) brightness(0)');
    expect(stepBgPalFx(result.bgPalFx)).toMatchObject({ remainingTime: 19, elapsedTime: 1 });
    let effect = result.bgPalFx;
    for (let frame = 0; frame < 20; frame += 1) effect = stepBgPalFx(effect);
    expect(effect).toMatchObject({ remainingTime: 0, elapsedTime: 20 });
    expect(stepBgPalFx(effect)).toBeUndefined();
  });
});
