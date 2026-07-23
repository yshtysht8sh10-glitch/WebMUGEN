export type ForceFeedbackRequest = {
  ownerEntityId: number;
  waveform: string;
  time: number;
  amplitude: number;
  frequency: number;
};

type HapticActuator = {
  playEffect: (type: 'dual-rumble', params: {
    duration: number;
    startDelay: number;
    strongMagnitude: number;
    weakMagnitude: number;
  }) => Promise<unknown>;
};

type GamepadLike = { connected: boolean; vibrationActuator?: HapticActuator };
type NavigatorLike = { getGamepads?: () => ArrayLike<GamepadLike | null> };

export async function playForceFeedback(
  request: ForceFeedbackRequest,
  navigatorLike: NavigatorLike | undefined = typeof navigator === 'undefined' ? undefined : navigator,
): Promise<boolean> {
  const gamepads = navigatorLike?.getGamepads?.();
  if (!gamepads) return false;
  const gamepad = Array.from(gamepads).find((candidate) => candidate?.connected && candidate.vibrationActuator);
  if (!gamepad?.vibrationActuator) return false;
  const amplitude = clamp01(request.amplitude);
  const frequencyWeight = clamp01(request.frequency / 100);
  try {
    await gamepad.vibrationActuator.playEffect('dual-rumble', {
      duration: Math.max(0, Math.round(request.time * 1000 / 60)),
      startDelay: 0,
      strongMagnitude: amplitude * (1 - frequencyWeight * 0.5),
      weakMagnitude: amplitude * (0.5 + frequencyWeight * 0.5),
    });
    return true;
  } catch {
    return false;
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}
