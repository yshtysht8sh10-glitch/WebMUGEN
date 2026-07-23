import { describe, expect, it, vi } from 'vitest';
import { playForceFeedback } from './ForceFeedbackAdapter';

describe('ForceFeedback browser adapter', () => {
  it('maps WinMUGEN ticks and amplitude/frequency to connected dual-rumble hardware', async () => {
    const playEffect = vi.fn().mockResolvedValue(undefined);
    const played = await playForceFeedback({ ownerEntityId: 1, waveform: 'sine', time: 12, amplitude: 0.8, frequency: 25 }, {
      getGamepads: () => [{ connected: true, vibrationActuator: { playEffect } }],
    });
    expect(played).toBe(true);
    expect(playEffect).toHaveBeenCalledWith('dual-rumble', {
      duration: 200,
      startDelay: 0,
      strongMagnitude: 0.7000000000000001,
      weakMagnitude: 0.5,
    });
  });

  it('is a safe no-op without an actuator or when the browser rejects vibration', async () => {
    expect(await playForceFeedback({ ownerEntityId: 1, waveform: 'sine', time: 1, amplitude: 1, frequency: 0 }, {
      getGamepads: () => [{ connected: true }],
    })).toBe(false);
    expect(await playForceFeedback({ ownerEntityId: 1, waveform: 'sine', time: 1, amplitude: 1, frequency: 0 }, {
      getGamepads: () => [{ connected: true, vibrationActuator: { playEffect: vi.fn().mockRejectedValue(new Error('blocked')) } }],
    })).toBe(false);
  });
});
