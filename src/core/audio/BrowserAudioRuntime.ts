export type AudioRuntimeDiagnosticCode =
  | 'audio_runtime_created'
  | 'audio_context_created'
  | 'audio_unsupported'
  | 'audio_unlock_requested'
  | 'audio_resume_requested'
  | 'audio_resume_resolved'
  | 'audio_resume_rejected'
  | 'audio_locked'
  | 'audio_unlocked'
  | 'audio_play_sample_started'
  | 'audio_playback_rejected'
  | 'audio_decode_started'
  | 'audio_decode_completed'
  | 'decode_failed'
  | 'audio_source_started'
  | 'playback_started'
  | 'playback_stopped'
  | 'audio_cleanup_started'
  | 'audio_context_close_requested'
  | 'audio_context_closed'
  | 'audio_context_close_rejected'
  | 'audio_closed';

export type AudioRuntimeDiagnostic = {
  code: AudioRuntimeDiagnosticCode;
  message: string;
  runtimeInstanceId: number;
  sampleKey?: string;
  userGestureType?: string;
  contextCreated?: boolean;
  contextState?: string;
  contextStateBeforeResume?: string;
  contextStateAfterResume?: string;
  resumeRequested?: boolean;
  resumeResolved?: boolean;
  resumeRejected?: boolean;
  runtimeUnlockedFlag?: boolean;
  runtimeStatus?: BrowserAudioRuntime['status'];
  muted?: boolean;
  masterVolume?: number;
};

type AudioRuntimeDiagnosticDetails = Omit<Partial<AudioRuntimeDiagnostic>, 'code' | 'message' | 'runtimeInstanceId'>;

export type AudioPlaybackOptions = {
  loop?: boolean;
  volume?: number;
  pan?: number;
  playbackRate?: number;
  channelKey?: string;
};

export type AudioPlaybackHandle = {
  stop(): void;
  setOnEnded?(callback: () => void): void;
  setPan?(value: number): boolean;
};

export type AudioPanUpdateResult = 'updated' | 'unsupported' | 'channel_not_found';

export interface AudioAdapter {
  readonly state: string;
  resume(): Promise<void>;
  decode(bytes: ArrayBuffer): Promise<unknown>;
  play(decoded: unknown, options: AudioPlaybackOptions): AudioPlaybackHandle;
  setMasterGain(value: number): void;
  close(): Promise<void>;
}

export type AudioAdapterFactory = () => AudioAdapter | null;

let nextRuntimeInstanceId = 1;

export function formatAudioRuntimeDiagnostic(diagnostic: AudioRuntimeDiagnostic): string {
  const fields: Array<[string, string | number | boolean | undefined]> = [
    ['runtimeInstanceId', diagnostic.runtimeInstanceId],
    ['contextCreated', diagnostic.contextCreated],
    ['userGestureType', diagnostic.userGestureType],
    ['contextStateBeforeResume', diagnostic.contextStateBeforeResume],
    ['resumeRequested', diagnostic.resumeRequested],
    ['resumeResolved', diagnostic.resumeResolved],
    ['resumeRejected', diagnostic.resumeRejected],
    ['contextStateAfterResume', diagnostic.contextStateAfterResume],
    ['runtimeUnlockedFlag', diagnostic.runtimeUnlockedFlag],
    ['runtimeStatus', diagnostic.runtimeStatus],
    ['contextState', diagnostic.contextState],
    ['muted', diagnostic.muted],
    ['masterVolume', diagnostic.masterVolume],
    ['sampleKey', diagnostic.sampleKey],
  ];
  return `raw.audio code=${diagnostic.code} ${fields
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${typeof value === 'boolean' ? (value ? 1 : 0) : value}`)
    .join(' ')}`.trimEnd();
}

export class BrowserAudioRuntime {
  readonly runtimeInstanceId = nextRuntimeInstanceId++;
  private adapter: AudioAdapter | null | undefined;
  private readonly decodeCache = new Map<string, Promise<unknown>>();
  private readonly activeHandles = new Set<AudioPlaybackHandle>();
  private readonly channelHandles = new Map<string, AudioPlaybackHandle>();
  private unlockPromise: Promise<boolean> | null = null;
  private lifecycleRevision = 0;
  private closed = false;
  private unlocked = false;
  private muted = false;
  private masterVolume = 1;

  constructor(
    private readonly createAdapter: AudioAdapterFactory = createWebAudioAdapter,
    private readonly onDiagnostic: (diagnostic: AudioRuntimeDiagnostic) => void = () => {},
  ) {
    this.emit('audio_runtime_created', 'BrowserAudioRuntime instance created.', { contextCreated: false });
  }

  get status(): 'locked' | 'unlocked' | 'unsupported' | 'closed' {
    if (this.closed) return 'closed';
    if (this.adapter === null) return 'unsupported';
    if (this.adapter === undefined) return 'locked';
    return this.unlocked ? 'unlocked' : 'locked';
  }

  get isUnlockPending(): boolean {
    return this.unlockPromise !== null;
  }

  get contextState(): string {
    return this.adapter?.state ?? (this.adapter === null ? 'unsupported' : 'not_created');
  }

  get isMuted(): boolean {
    return this.muted;
  }

  get masterVolumeValue(): number {
    return this.masterVolume;
  }

  unlock(userGestureType = 'manual'): Promise<boolean> {
    if (this.closed) return Promise.resolve(false);
    if (this.unlocked) return Promise.resolve(true);
    if (this.unlockPromise) return this.unlockPromise;
    const adapter = this.ensureAdapter();
    if (!adapter) return Promise.resolve(false);
    const contextStateBeforeResume = adapter.state;
    this.emit('audio_unlock_requested', `AudioContext unlock requested by ${userGestureType}; state=${adapter.state}.`, {
      userGestureType,
      contextStateBeforeResume,
      resumeRequested: adapter.state !== 'running',
    });
    if (adapter.state === 'running') {
      this.finishUnlock(userGestureType, contextStateBeforeResume);
      return Promise.resolve(true);
    }
    const attempt = this.resumeAdapter(adapter, this.lifecycleRevision, userGestureType);
    this.unlockPromise = attempt;
    void attempt.then(() => {
      if (this.unlockPromise === attempt) this.unlockPromise = null;
    });
    return attempt;
  }

  private async resumeAdapter(adapter: AudioAdapter, lifecycleRevision: number, userGestureType: string): Promise<boolean> {
    const contextStateBeforeResume = adapter.state;
    this.emit('audio_resume_requested', `AudioContext resume() called for ${userGestureType}.`, {
      userGestureType,
      contextStateBeforeResume,
      resumeRequested: true,
    });
    try {
      await adapter.resume();
      if (this.closed || this.lifecycleRevision !== lifecycleRevision || this.adapter !== adapter) return false;
      const contextStateAfterResume = adapter.state;
      this.emit('audio_resume_resolved', `AudioContext resume() resolved; state=${contextStateAfterResume}.`, {
        userGestureType,
        contextStateBeforeResume,
        contextStateAfterResume,
        resumeRequested: true,
        resumeResolved: true,
      });
      if (contextStateAfterResume !== 'running') {
        this.emit('audio_locked', `AudioContext resume() resolved without reaching running; state=${contextStateAfterResume}.`, {
          userGestureType,
          contextStateBeforeResume,
          contextStateAfterResume,
          resumeRequested: true,
          resumeResolved: true,
        });
        return false;
      }
      this.finishUnlock(userGestureType, contextStateBeforeResume);
      return true;
    } catch (error) {
      const contextStateAfterResume = adapter.state;
      const details = { userGestureType, contextStateBeforeResume, contextStateAfterResume, resumeRequested: true, resumeRejected: true };
      this.emit('audio_resume_rejected', errorMessage(`AudioContext resume failed for ${userGestureType}`, error), details);
      this.emit('audio_locked', errorMessage(`AudioContext resume failed for ${userGestureType}`, error), details);
      return false;
    }
  }

  private finishUnlock(userGestureType: string, contextStateBeforeResume: string): void {
    this.unlocked = true;
    this.applyMasterGain();
    this.emit('audio_unlocked', 'AudioContext is running after a user gesture.', {
      userGestureType,
      contextStateBeforeResume,
      contextStateAfterResume: this.adapter?.state,
    });
  }

  async playSample(sampleKey: string, bytes: Uint8Array, options: AudioPlaybackOptions = {}): Promise<boolean> {
    this.emit('audio_play_sample_started', 'Audio sample playback request entered the runtime.', { sampleKey });
    if (this.closed) {
      this.emit('audio_playback_rejected', 'Playback rejected because the audio runtime was cleaned up.', { sampleKey });
      return false;
    }
    const pendingUnlock = this.unlockPromise;
    if (pendingUnlock && !await pendingUnlock) {
      this.emit('audio_playback_rejected', 'Playback rejected because the pending unlock did not reach running.', { sampleKey });
      return false;
    }
    const adapter = this.ensureAdapter();
    if (!adapter) {
      this.emit('audio_playback_rejected', 'Playback rejected because Web Audio is unavailable.', { sampleKey });
      return false;
    }
    if (!this.unlocked && adapter.state !== 'running') {
      this.emit('audio_locked', 'Playback rejected until AudioContext is unlocked.', { sampleKey });
      this.emit('audio_playback_rejected', 'Playback rejected until AudioContext is unlocked.', { sampleKey });
      return false;
    }

    try {
      let decoded = this.decodeCache.get(sampleKey);
      if (!decoded) {
        const copy = bytes.slice().buffer;
        this.emit('audio_decode_started', 'Audio sample decode started.', { sampleKey });
        decoded = adapter.decode(copy);
        this.decodeCache.set(sampleKey, decoded);
        void decoded.then(
          () => this.emit('audio_decode_completed', 'Audio sample decode completed.', { sampleKey }),
          () => {},
        );
      }
      const handle = adapter.play(await decoded, options);
      this.emit('audio_source_started', 'Audio adapter executed source.start().', { sampleKey });
      if (options.channelKey) {
        const previous = this.channelHandles.get(options.channelKey);
        if (previous) {
          previous.stop();
          this.activeHandles.delete(previous);
        }
        this.channelHandles.set(options.channelKey, handle);
      }
      this.activeHandles.add(handle);
      handle.setOnEnded?.(() => this.releaseHandle(handle, options.channelKey));
      this.emit('playback_started', 'Audio sample playback started.', { sampleKey });
      return true;
    } catch (error) {
      this.decodeCache.delete(sampleKey);
      this.emit('decode_failed', errorMessage('Audio sample decode/playback failed', error), { sampleKey });
      return false;
    }
  }

  setMasterVolume(value: number): void {
    this.masterVolume = clamp(value, 0, 1);
    this.applyMasterGain();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyMasterGain();
  }

  stopAll(): void {
    for (const handle of this.activeHandles) handle.stop();
    if (this.activeHandles.size > 0) this.emit('playback_stopped', 'All active audio sources were stopped.');
    this.activeHandles.clear();
    this.channelHandles.clear();
  }

  stopChannel(channelKey: string): boolean {
    const handle = this.channelHandles.get(channelKey);
    if (!handle) return false;
    handle.stop();
    this.releaseHandle(handle, channelKey);
    this.emit('playback_stopped', `Audio channel ${channelKey} was stopped.`);
    return true;
  }

  updateChannelPan(channelKey: string, pan: number): AudioPanUpdateResult {
    const handle = this.channelHandles.get(channelKey);
    if (!handle) return 'channel_not_found';
    if (!handle.setPan) return 'unsupported';
    return handle.setPan(clamp(pan, -1, 1)) ? 'updated' : 'unsupported';
  }

  async cleanup(): Promise<void> {
    if (this.closed) return;
    this.emit('audio_cleanup_started', 'Audio runtime cleanup started.');
    this.closed = true;
    this.lifecycleRevision += 1;
    this.unlockPromise = null;
    this.stopAll();
    this.decodeCache.clear();
    if (this.adapter) {
      const contextStateBeforeResume = this.adapter.state;
      this.emit('audio_context_close_requested', 'AudioContext close() called.', { contextStateBeforeResume });
      try {
        await this.adapter.close();
        this.emit('audio_context_closed', 'AudioContext close() resolved.', {
          contextStateBeforeResume,
          contextStateAfterResume: this.adapter.state,
        });
      } catch (error) {
        this.emit('audio_context_close_rejected', errorMessage('AudioContext close() failed', error), {
          contextStateBeforeResume,
          contextStateAfterResume: this.adapter.state,
        });
      }
    }
    this.adapter = undefined;
    this.unlocked = false;
    this.emit('audio_closed', 'Audio runtime resources were released.');
  }

  private ensureAdapter(): AudioAdapter | null {
    if (this.closed) return null;
    if (this.adapter === undefined) {
      this.adapter = this.createAdapter();
      if (!this.adapter) this.emit('audio_unsupported', 'Web Audio API is unavailable.', { contextCreated: false });
      else this.emit('audio_context_created', `AudioContext created; state=${this.adapter.state}.`, { contextCreated: true });
    }
    return this.adapter;
  }

  private applyMasterGain(): void {
    this.adapter?.setMasterGain(this.muted ? 0 : this.masterVolume);
  }

  private releaseHandle(handle: AudioPlaybackHandle, channelKey?: string): void {
    this.activeHandles.delete(handle);
    if (channelKey && this.channelHandles.get(channelKey) === handle) this.channelHandles.delete(channelKey);
  }

  private emit(code: AudioRuntimeDiagnosticCode, message: string, details: AudioRuntimeDiagnosticDetails = {}): void {
    this.onDiagnostic({
      code,
      message,
      runtimeInstanceId: this.runtimeInstanceId,
      contextState: this.contextState,
      runtimeUnlockedFlag: this.unlocked,
      runtimeStatus: this.status,
      muted: this.muted,
      masterVolume: this.masterVolume,
      ...details,
    });
  }
}

export function createWebAudioAdapter(): AudioAdapter | null {
  const AudioContextConstructor = globalThis.AudioContext;
  if (!AudioContextConstructor) return null;
  const context = new AudioContextConstructor();
  const master = context.createGain();
  master.connect(context.destination);

  return {
    get state() { return context.state; },
    resume: () => context.resume(),
    decode: (bytes) => context.decodeAudioData(bytes),
    play(decoded, options) {
      const source = context.createBufferSource();
      const gain = context.createGain();
      const panner = typeof context.createStereoPanner === 'function' ? context.createStereoPanner() : null;
      source.buffer = decoded as AudioBuffer;
      source.loop = options.loop ?? false;
      source.playbackRate.value = Math.max(0.01, options.playbackRate ?? 1);
      gain.gain.value = clamp(options.volume ?? 1, 0, 1);
      source.connect(gain);
      if (panner) {
        panner.pan.value = clamp(options.pan ?? 0, -1, 1);
        gain.connect(panner);
        panner.connect(master);
      } else {
        gain.connect(master);
      }
      source.start();
      return {
        stop: () => { try { source.stop(); } catch { /* already stopped */ } },
        setOnEnded(callback) { source.onended = callback; },
        setPan(value) {
          if (!panner) return false;
          panner.pan.value = clamp(value, -1, 1);
          return true;
        },
      };
    },
    setMasterGain(value) {
      const normalized = clamp(value, 0, 1);
      const now = context.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(normalized, now + 0.015);
    },
    close: () => context.close(),
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
}

function errorMessage(prefix: string, error: unknown): string {
  return `${prefix}: ${error instanceof Error ? error.message : String(error)}`;
}
