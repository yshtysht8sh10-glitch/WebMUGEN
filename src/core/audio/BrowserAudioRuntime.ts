export type AudioRuntimeDiagnosticCode =
  | 'audio_unsupported'
  | 'audio_locked'
  | 'audio_unlocked'
  | 'decode_failed'
  | 'playback_started'
  | 'playback_stopped'
  | 'audio_closed';

export type AudioRuntimeDiagnostic = {
  code: AudioRuntimeDiagnosticCode;
  message: string;
  sampleKey?: string;
};

export type AudioPlaybackOptions = {
  loop?: boolean;
  volume?: number;
  pan?: number;
  playbackRate?: number;
  channelKey?: string;
};

export type AudioPlaybackHandle = { stop(): void };

export interface AudioAdapter {
  readonly state: string;
  resume(): Promise<void>;
  decode(bytes: ArrayBuffer): Promise<unknown>;
  play(decoded: unknown, options: AudioPlaybackOptions): AudioPlaybackHandle;
  setMasterGain(value: number): void;
  close(): Promise<void>;
}

export type AudioAdapterFactory = () => AudioAdapter | null;

export class BrowserAudioRuntime {
  private adapter: AudioAdapter | null | undefined;
  private readonly decodeCache = new Map<string, Promise<unknown>>();
  private readonly activeHandles = new Set<AudioPlaybackHandle>();
  private readonly channelHandles = new Map<string, AudioPlaybackHandle>();
  private unlocked = false;
  private muted = false;
  private masterVolume = 1;

  constructor(
    private readonly createAdapter: AudioAdapterFactory = createWebAudioAdapter,
    private readonly onDiagnostic: (diagnostic: AudioRuntimeDiagnostic) => void = () => {},
  ) {}

  get status(): 'locked' | 'unlocked' | 'unsupported' | 'closed' {
    if (this.adapter === null) return 'unsupported';
    if (this.adapter === undefined) return 'locked';
    return this.unlocked ? 'unlocked' : 'locked';
  }

  async unlock(): Promise<boolean> {
    const adapter = this.ensureAdapter();
    if (!adapter) return false;
    try {
      await adapter.resume();
      this.unlocked = true;
      this.applyMasterGain();
      this.emit('audio_unlocked', 'AudioContext resumed after a user gesture.');
      return true;
    } catch (error) {
      this.emit('audio_locked', errorMessage('AudioContext resume failed', error));
      return false;
    }
  }

  async playSample(sampleKey: string, bytes: Uint8Array, options: AudioPlaybackOptions = {}): Promise<boolean> {
    const adapter = this.ensureAdapter();
    if (!adapter) return false;
    if (!this.unlocked && adapter.state !== 'running') {
      this.emit('audio_locked', 'Playback rejected until AudioContext is unlocked.', sampleKey);
      return false;
    }

    try {
      let decoded = this.decodeCache.get(sampleKey);
      if (!decoded) {
        const copy = bytes.slice().buffer;
        decoded = adapter.decode(copy);
        this.decodeCache.set(sampleKey, decoded);
      }
      const handle = adapter.play(await decoded, options);
      if (options.channelKey) {
        const previous = this.channelHandles.get(options.channelKey);
        if (previous) {
          previous.stop();
          this.activeHandles.delete(previous);
        }
        this.channelHandles.set(options.channelKey, handle);
      }
      this.activeHandles.add(handle);
      this.emit('playback_started', 'Audio sample playback started.', sampleKey);
      return true;
    } catch (error) {
      this.decodeCache.delete(sampleKey);
      this.emit('decode_failed', errorMessage('Audio sample decode/playback failed', error), sampleKey);
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

  async cleanup(): Promise<void> {
    this.stopAll();
    this.decodeCache.clear();
    if (this.adapter) await this.adapter.close();
    this.adapter = undefined;
    this.unlocked = false;
    this.emit('audio_closed', 'Audio runtime resources were released.');
  }

  private ensureAdapter(): AudioAdapter | null {
    if (this.adapter === undefined) {
      this.adapter = this.createAdapter();
      if (!this.adapter) this.emit('audio_unsupported', 'Web Audio API is unavailable.');
    }
    return this.adapter;
  }

  private applyMasterGain(): void {
    this.adapter?.setMasterGain(this.muted ? 0 : this.masterVolume);
  }

  private emit(code: AudioRuntimeDiagnosticCode, message: string, sampleKey?: string): void {
    this.onDiagnostic({ code, message, ...(sampleKey ? { sampleKey } : {}) });
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
      return { stop: () => { try { source.stop(); } catch { /* already stopped */ } } };
    },
    setMasterGain(value) { master.gain.value = value; },
    close: () => context.close(),
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
}

function errorMessage(prefix: string, error: unknown): string {
  return `${prefix}: ${error instanceof Error ? error.message : String(error)}`;
}
