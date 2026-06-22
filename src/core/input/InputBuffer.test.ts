import { describe, expect, it } from 'vitest';
import { createInputBuffer, getRecentInputFrames, hasTokenAtFrame, pushInputFrame } from './InputBuffer';

describe('Phase88 InputBuffer', () => {
  it('pushes snapshots and trims old frames', () => {
    let buffer = createInputBuffer(3);
    buffer = pushInputFrame(buffer, 1, { direction: 'D', buttons: [] });
    buffer = pushInputFrame(buffer, 2, { direction: 'DF', buttons: [] });
    buffer = pushInputFrame(buffer, 3, { direction: 'F', buttons: ['x'] });
    buffer = pushInputFrame(buffer, 4, { direction: 'N', buttons: [] });

    expect(buffer.frames.map((entry) => entry.frame)).toEqual([2, 3, 4]);
    expect(hasTokenAtFrame(buffer, 3, 'x')).toBe(true);
    expect(getRecentInputFrames(buffer, 4, 2).map((entry) => entry.frame)).toEqual([3, 4]);
  });
});
