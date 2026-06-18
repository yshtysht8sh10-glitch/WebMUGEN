import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../engine/GameState';
import { clearAfterImage, createAfterImageState, stepAfterImage } from './AfterImageSystem';

describe('Phase54 AfterImageSystem', () => {
  it('records frames and expires', () => {
    const player = createInitialGameState().players[0];
    const first = stepAfterImage(createAfterImageState(2), player);

    expect(first?.enabled).toBe(true);
    expect(first?.frames).toHaveLength(1);

    const second = stepAfterImage(first, { ...player, x: player.x + 10 });
    expect(second?.frames).toHaveLength(2);
    expect(second?.enabled).toBe(false);

    const third = stepAfterImage(second, player);
    expect(third?.enabled).toBe(false);
  });

  it('clears afterimage', () => {
    expect(clearAfterImage()).toEqual({ enabled: false, time: 0, frames: [] });
  });
});
