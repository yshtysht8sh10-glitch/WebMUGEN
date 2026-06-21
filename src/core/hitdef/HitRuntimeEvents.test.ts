import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../engine/GameState';
import { createDefaultHitDefSpec } from './HitDefTypes';
import { createHitOutcome, createHitSparkEvents } from './HitRuntimeEvents';

describe('Phase70 HitRuntimeEvents', () => {
  it('creates hit outcome and spark events', () => {
    const state = createInitialGameState();
    const hitDef = {
      ...createDefaultHitDefSpec(),
      damage: { hit: 20, guard: 3 },
      sparkNo: 9000,
      guardSparkNo: 9001,
    };

    const outcome = createHitOutcome(1, 2, hitDef, false);
    expect(outcome).toMatchObject({ attackerId: 1, defenderId: 2, guarded: false, damage: 20, sparkNo: 9000 });

    expect(createHitSparkEvents(outcome, state.players[1])).toEqual([
      { type: 'explod', id: null, animNo: 9000, x: state.players[1].x, y: state.players[1].y, removeTime: 12 },
    ]);
  });
});
