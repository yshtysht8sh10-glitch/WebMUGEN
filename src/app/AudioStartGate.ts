export type RuntimeStartState =
  | 'loading'
  | 'waiting-for-user'
  | 'unlocking-audio'
  | 'running'
  | 'audio-unavailable';

export type AudioStartGateGesture = 'pointerdown' | 'keydown';

type AudioStartGateRuntime = {
  readonly status: 'locked' | 'unlocked' | 'unsupported' | 'closed';
  readonly contextState: string;
  unlock(userGestureType: string): Promise<boolean>;
};

export type AudioStartGate = {
  prepare(startGameLoop: () => void): void;
  handleUserGesture(gestureType: AudioStartGateGesture): Promise<boolean>;
  continueWithoutAudio(): void;
  dispose(): void;
};

export function createAudioStartGate({
  runtime,
  onStateChange,
}: {
  runtime: AudioStartGateRuntime;
  onStateChange: (state: RuntimeStartState) => void;
}): AudioStartGate {
  let disposed = false;
  let started = false;
  let attemptRevision = 0;
  let startGameLoop: (() => void) | null = null;

  const startOnce = () => {
    if (disposed || started || !startGameLoop) return false;
    started = true;
    onStateChange('running');
    startGameLoop();
    return true;
  };

  return {
    prepare(start) {
      if (disposed) return;
      startGameLoop = start;
      if (runtime.status === 'unlocked' && runtime.contextState === 'running') {
        startOnce();
      } else {
        onStateChange('waiting-for-user');
      }
    },

    async handleUserGesture(gestureType) {
      if (disposed || started || !startGameLoop) return false;
      const revision = ++attemptRevision;
      onStateChange('unlocking-audio');
      const unlocked = await runtime.unlock(gestureType);
      if (disposed || started || revision !== attemptRevision) return false;
      if (unlocked && runtime.contextState === 'running') {
        return startOnce();
      }
      onStateChange('audio-unavailable');
      return false;
    },

    continueWithoutAudio() {
      attemptRevision += 1;
      startOnce();
    },

    dispose() {
      disposed = true;
      attemptRevision += 1;
      startGameLoop = null;
    },
  };
}
