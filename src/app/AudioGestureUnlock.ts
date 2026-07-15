import type { BrowserAudioRuntime } from '../core/audio/BrowserAudioRuntime';

export type AudioUnlockStatus = 'locked' | 'unlocked' | 'unsupported';

type AudioGestureTarget = {
  addEventListener(type: 'pointerdown' | 'keydown', listener: EventListener): void;
  removeEventListener(type: 'pointerdown' | 'keydown', listener: EventListener): void;
};

export function installAudioGestureUnlock(
  target: AudioGestureTarget,
  runtime: BrowserAudioRuntime,
  onStatus: (status: AudioUnlockStatus) => void,
): () => void {
  let active = true;
  const unlock: EventListener = (event) => {
    void runtime.unlock(event.type).then((unlocked) => {
      if (!active) return;
      onStatus(unlocked ? 'unlocked' : runtime.status === 'unsupported' ? 'unsupported' : 'locked');
      if (unlocked) removeListeners();
    });
  };
  const removeListeners = () => {
    target.removeEventListener('pointerdown', unlock);
    target.removeEventListener('keydown', unlock);
  };

  target.addEventListener('pointerdown', unlock);
  target.addEventListener('keydown', unlock);
  return () => {
    active = false;
    removeListeners();
  };
}
