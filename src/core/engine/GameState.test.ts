import { describe, expect, it } from 'vitest';
import { createInitialGameState } from './GameState';

describe('createInitialGameState', () => {
  it('accepts app-specific positions symmetric around the 960px stage center', () => {
    const [p1, p2] = createInitialGameState(undefined, {}, [380, 580]).players;

    expect((p1.x + p2.x) / 2).toBe(480);
    expect(480 - p1.x).toBe(p2.x - 480);
  });
});
