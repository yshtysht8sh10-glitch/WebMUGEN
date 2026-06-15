import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../engine/GameState';
import { applyCnsRuntimeSideEffectController } from './CnsRuntimeSideEffects';

describe('CnsRuntimeSideEffects phase50', () => {
  const player = createInitialGameState().players[0];

  it('handles PlaySnd as a safe runtime side effect', () => {
    const result = applyCnsRuntimeSideEffectController(player, {
      type: 'PlaySnd',
      triggers: [],
      params: { value: '0, 1', channel: 2 },
    });

    expect(result?.name).toBe('PlaySnd');
    expect((result?.player as any).runtime.lastSound).toEqual({ value: '0, 1', channel: 2 });
  });

  it('handles SprPriority, Width, and AssertSpecial', () => {
    const spr = applyCnsRuntimeSideEffectController(player, {
      type: 'SprPriority',
      triggers: [],
      params: { value: 5 },
    });

    expect((spr?.player as any).runtime.sprPriority).toBe(5);

    const width = applyCnsRuntimeSideEffectController(player, {
      type: 'Width',
      triggers: [],
      params: { edge: 12, player: 8 },
    });

    expect((width?.player as any).runtime.width).toEqual({ edge: 12, player: 8 });

    const assert = applyCnsRuntimeSideEffectController(player, {
      type: 'AssertSpecial',
      triggers: [],
      params: { flag: 'noautoturn', flag2: 'nostandguard' },
    });

    expect((assert?.player as any).runtime.assertSpecial).toEqual(['noautoturn', 'nostandguard']);
  });
});
