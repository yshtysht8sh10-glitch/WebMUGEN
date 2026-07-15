import type { BrowserAudioRuntime } from '../core/audio/BrowserAudioRuntime';

export type AudioUnlockStatus = 'locked' | 'unlocked' | 'unsupported';
export type AudioUserGestureType = 'pointerdown' | 'keydown';
export type AudioUserGestureCallback = (gestureType: AudioUserGestureType) => void;

type AudioGestureTarget = {
  addEventListener(type: 'pointerdown', listener: EventListener): void;
  removeEventListener(type: 'pointerdown', listener: EventListener): void;
};

export function createAudioUserGestureUnlock(
  runtime: BrowserAudioRuntime,
  onStatus: (status: AudioUnlockStatus) => void,
): { onUserGesture: AudioUserGestureCallback; dispose(): void } {
  let active = true;
  const onUserGesture: AudioUserGestureCallback = (gestureType) => {
    void runtime.unlock(gestureType).then((unlocked) => {
      if (!active) return;
      onStatus(unlocked ? 'unlocked' : runtime.status === 'unsupported' ? 'unsupported' : 'locked');
    });
  };
  return {
    onUserGesture,
    dispose() { active = false; },
  };
}

export function installAudioGestureUnlock(target: AudioGestureTarget, onUserGesture: AudioUserGestureCallback): () => void {
  const unlock: EventListener = () => onUserGesture('pointerdown');
  target.addEventListener('pointerdown', unlock);
  return () => {
    target.removeEventListener('pointerdown', unlock);
  };
}
