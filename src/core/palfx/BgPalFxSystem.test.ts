import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../engine/GameState';
import { applyBgPalFxEvents, resolveBgPalFxFilter, stepBgPalFx } from './BgPalFxSystem';

describe('BGPalFX runtime', () => {
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

    expect(resolveBgPalFxFilter(result.bgPalFx)).toBe('grayscale(1) brightness(0) invert(1)');
    expect(stepBgPalFx(result.bgPalFx)).toMatchObject({ remainingTime: 19, elapsedTime: 1 });
    let effect = result.bgPalFx;
    for (let frame = 0; frame < 20; frame += 1) effect = stepBgPalFx(effect);
    expect(effect).toMatchObject({ remainingTime: 0, elapsedTime: 20 });
    expect(stepBgPalFx(effect)).toBeUndefined();
  });
});
