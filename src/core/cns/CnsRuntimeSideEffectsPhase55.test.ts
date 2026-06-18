import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../engine/GameState';
import { applyPhase55SideEffectController } from './CnsRuntimeSideEffectsPhase55';

describe('Phase55-56 side effect controllers', () => {
  const player = createInitialGameState().players[0];

  it('handles afterimage controllers', () => {
    expect((applyPhase55SideEffectController(player, { type: 'AfterImage', triggers: [], params: { time: 12 } })?.player as any).runtime.afterImageTime).toBe(12);
    expect((applyPhase55SideEffectController(player, { type: 'AfterImageTime', triggers: [], params: { time: 0 } })?.player as any).runtime.afterImageTime).toBe(0);
  });

  it('emits safe command payloads', () => {
    expect(applyPhase55SideEffectController(player, { type: 'Explod', triggers: [], params: { id: 10, anim: 9000 } })?.command).toBe('explod');
    expect(applyPhase55SideEffectController(player, { type: 'RemoveExplod', triggers: [], params: { id: 10 } })?.command).toBe('removeExplod');
    expect(applyPhase55SideEffectController(player, { type: 'DestroySelf', triggers: [], params: {} })?.command).toBe('destroySelf');
    expect(applyPhase55SideEffectController(player, { type: 'ChangeAnim2', triggers: [], params: { value: 5000 } })?.command).toBe('changeAnim2');
  });
});
