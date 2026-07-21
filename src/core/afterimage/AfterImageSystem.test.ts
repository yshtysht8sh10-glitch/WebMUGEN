import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../engine/GameState';
import { clearAfterImage, createAfterImageState, setAfterImageTime, stepAfterImage } from './AfterImageSystem';

describe('Phase54 AfterImageSystem', () => {
  it('records frames and expires', () => {
    const player = createInitialGameState().players[0];
    const first = stepAfterImage(createAfterImageState(2), player);

    expect(first?.enabled).toBe(true);
    expect(first?.frames).toHaveLength(1);

    const second = stepAfterImage(first, { ...player, x: player.x + 10 });
    expect(second?.frames).toHaveLength(2);
    expect(second?.remainingTime).toBe(0);
    expect(second?.enabled).toBe(true);

    const third = stepAfterImage(second, player);
    expect(third?.frames).toHaveLength(2);
  });

  it('uses timegap for capture cadence and caps the history length', () => {
    const player = createInitialGameState().players[0];
    let state = createAfterImageState(-1, { timeGap: 2, frameGap: 3, length: 2 });
    for (let tick = 0; tick < 6; tick += 1) state = stepAfterImage(state, { ...player, x: tick })!;

    expect(state.frames.map((frame) => frame.x)).toEqual([4, 2]);
    expect(state.frameGap).toBe(3);
  });

  it('changes duration only while active and clears at zero', () => {
    expect(setAfterImageTime(undefined, 10)).toBeUndefined();
    expect(setAfterImageTime(createAfterImageState(3), 9)?.remainingTime).toBe(9);
    expect(setAfterImageTime(createAfterImageState(3), 0)?.enabled).toBe(false);
  });

  it('clears afterimage', () => {
    expect(clearAfterImage()).toMatchObject({ enabled: false, remainingTime: 0, captureTick: 0, frames: [] });
  });
});
