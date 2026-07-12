import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../core/engine/GameState';
import { formatPhysicsDebugOverlay } from './PhysicsDebugOverlay';

describe('PhysicsDebugOverlay', () => {
  it('includes player power for StateDef poweradd diagnostics', () => {
    const state = createInitialGameState();
    const lines = formatPhysicsDebugOverlay({
      ...state,
      players: [
        { ...state.players[0], power: 120 },
        { ...state.players[1], juggle: 6, juggleRemaining: 4, juggleMax: 15, guardIntent: true, guardCrouchIntent: true },
      ],
    });

    expect(lines[0]).toContain('power=120');
    expect(lines[1]).toContain('power=0');
    expect(lines[0]).toContain('facing=1');
    expect(lines[1]).toContain('facing=-1');
    expect(lines[0]).toContain('juggle=-');
    expect(lines[1]).toContain('juggle=6');
    expect(lines[1]).toContain('juggleRemaining=4/15');
    expect(lines[1]).toContain('guard=back+down');
    expect(lines[1]).toContain('owner=2/2');
  });
});
