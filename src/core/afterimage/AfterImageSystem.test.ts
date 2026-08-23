import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../engine/GameState';
import { applyAfterImagePaletteToRgba, clearAfterImage, createAfterImageState, setAfterImageTime, stepAfterImage } from './AfterImageSystem';

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

  it('uses timegap for capture cadence and length for history capacity', () => {
    const player = createInitialGameState().players[0];
    let state = createAfterImageState(-1, { timeGap: 2, frameGap: 3, length: 2 });
    for (let tick = 0; tick < 6; tick += 1) state = stepAfterImage(state, { ...player, x: tick })!;

    expect(state.frames.map((frame) => frame.x)).toEqual([4, 2]);
    expect(state.frameGap).toBe(3);
  });

  it('captures AngleDraw angle and scale with each afterimage frame', () => {
    const player = {
      ...createInitialGameState().players[0],
      drawAngle: 15,
      drawScale: { x: 0.75, y: 1.5 },
    };

    const state = stepAfterImage(createAfterImageState(2), player);

    expect(state?.frames[0]).toMatchObject({
      drawAngle: 15,
      drawScale: { x: 0.75, y: 1.5 },
    });
  });

  it('changes duration only while active and lets retained frames age out at zero', () => {
    expect(setAfterImageTime(undefined, 10)).toBeUndefined();
    expect(setAfterImageTime(createAfterImageState(3), 9)?.remainingTime).toBe(9);
    const stopped = setAfterImageTime(stepAfterImage(createAfterImageState(3), createInitialGameState().players[0]), 0);
    expect(stopped).toMatchObject({ enabled: true, remainingTime: 0 });
    expect(stopped?.frames).toHaveLength(1);
  });

  it('clears afterimage', () => {
    expect(clearAfterImage()).toMatchObject({ enabled: false, remainingTime: 0, captureTick: 0, frames: [] });
  });

  it('applies WinMUGEN palette stages per RGB channel and repeats add then multiply', () => {
    const pixels = new Uint8ClampedArray([200, 120, 80, 255]);
    const palette = createAfterImageState(-1, {
      palette: {
        color: 256,
        invertAll: false,
        bright: { red: 0, green: -250, blue: -250 },
        contrast: { red: 120, green: 120, blue: 220 },
        postBright: { red: 0, green: 0, blue: 0 },
        add: { red: 0, green: -250, blue: -250 },
        multiply: { red: 0.65, green: 0.65, blue: 0.75 },
      },
    }).palette;

    applyAfterImagePaletteToRgba(pixels, palette, 1);

    expect(Array.from(pixels)).toEqual([61, 0, 0, 255]);
  });
});
