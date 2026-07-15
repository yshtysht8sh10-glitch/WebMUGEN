import { describe, expect, it, vi } from 'vitest';
import { BrowserAudioRuntime, type AudioAdapter, type AudioPlaybackHandle } from '../core/audio/BrowserAudioRuntime';
import type { SoundPlayEvent } from '../core/audio/SoundEvent';
import { processSoundRuntimeEvents } from '../core/audio/SoundRuntimeBridge';
import type { SndDocument, SndSample } from '../parser/snd/SndTypes';
import { createAudioUserGestureUnlock } from './AudioGestureUnlock';
import { BrowserInput, DEFAULT_INPUT_CONFIG, keysToP1Input, keysToP2Input, type InputConfig } from './BrowserInput';

describe('BrowserInput', () => {
  it('tracks pressed keys', () => {
    const listeners = new Map<string, EventListener[]>();
    const fakeWindow = {
      addEventListener(type: string, listener: EventListener) {
        listeners.set(type, [...(listeners.get(type) ?? []), listener]);
      },
      removeEventListener(type: string, listener: EventListener) {
        listeners.set(
          type,
          (listeners.get(type) ?? []).filter((item) => item !== listener),
        );
      },
    } as unknown as Window;

    const input = new BrowserInput(fakeWindow);
    const keydown = listeners.get('keydown')?.[0] as (event: KeyboardEvent) => void;
    const keyup = listeners.get('keyup')?.[0] as (event: KeyboardEvent) => void;

    keydown({ code: 'ArrowRight', preventDefault() {} } as KeyboardEvent);
    expect(input.getPressedKeys().has('ArrowRight')).toBe(true);

    keyup({ code: 'ArrowRight', preventDefault() {} } as KeyboardEvent);
    expect(input.getPressedKeys().has('ArrowRight')).toBe(false);

    input.dispose();
  });

  it('maps P1 keys to MUGEN command buttons', () => {
    const input = keysToP1Input(new Set(['ArrowDown', 'ArrowRight', 'KeyQ', 'KeyA']));

    expect(input.down).toBe(true);
    expect(input.right).toBe(true);
    expect(input.attack).toBe(true);
    expect(input.buttons).toEqual(['a', 'x']);
  });

  it('maps P2 keys to MUGEN command buttons', () => {
    const input = keysToP2Input(new Set(['KeyJ', 'KeyK', 'KeyU', 'KeyF']));

    expect(input.left).toBe(true);
    expect(input.down).toBe(true);
    expect(input.attack).toBe(true);
    expect(input.buttons).toEqual(['a', 'x']);
  });

  it('does not capture or prevent keyboard controls on form fields', () => {
    const listeners = new Map<string, EventListener[]>();
    const fakeWindow = {
      addEventListener(type: string, listener: EventListener) {
        listeners.set(type, [...(listeners.get(type) ?? []), listener]);
      },
      removeEventListener() {},
    } as unknown as Window;
    const input = new BrowserInput(fakeWindow);
    const preventDefault = vi.fn();
    const keydown = listeners.get('keydown')?.[0] as (event: KeyboardEvent) => void;

    keydown({ code: 'ArrowRight', target: { tagName: 'INPUT' }, preventDefault } as unknown as KeyboardEvent);

    expect(preventDefault).not.toHaveBeenCalled();
    expect(input.getPressedKeys().has('ArrowRight')).toBe(false);
  });

  it('reports a game keydown as a user gesture while recording the same key', () => {
    const target = new FakeKeyboardTarget();
    const onUserGesture = vi.fn();
    const input = new BrowserInput(target.asWindow(), null, onUserGesture);

    target.dispatchKeyDown('KeyA');

    expect(onUserGesture).toHaveBeenCalledTimes(1);
    expect(onUserGesture).toHaveBeenCalledWith('keydown');
    expect(input.getPressedKeys()).toContain('KeyA');
  });

  it('does not report editable keydowns and stops reporting after dispose', () => {
    const target = new FakeKeyboardTarget();
    const onUserGesture = vi.fn();
    const input = new BrowserInput(target.asWindow(), null, onUserGesture);

    for (const tagName of ['INPUT', 'SELECT', 'TEXTAREA']) target.dispatchKeyDown('KeyA', { tagName });
    target.dispatchKeyDown('KeyA', { tagName: 'DIV', isContentEditable: true });
    expect(onUserGesture).not.toHaveBeenCalled();
    expect(input.getPressedKeys()).not.toContain('KeyA');

    input.dispose();
    target.dispatchKeyDown('KeyA');
    expect(onUserGesture).not.toHaveBeenCalled();
  });

  it('starts fresh audio unlock from KeyA and lets the same-gesture PlaySnd wait without pointerdown', async () => {
    const diagnostics: string[] = [];
    const played: unknown[] = [];
    let state = 'suspended';
    let resolveResume!: () => void;
    const resume = vi.fn(() => new Promise<void>((resolve) => {
      resolveResume = () => { state = 'running'; resolve(); };
    }));
    const factory = vi.fn((): AudioAdapter => ({
      get state() { return state; },
      resume,
      async decode(bytes) { return bytes.byteLength; },
      play(decoded): AudioPlaybackHandle { played.push(decoded); return { stop() {} }; },
      setMasterGain() {},
      async close() {},
    }));
    const runtime = new BrowserAudioRuntime(factory, (item) => diagnostics.push(item.code));
    const statuses: string[] = [];
    const gestureUnlock = createAudioUserGestureUnlock(runtime, (status) => statuses.push(status));
    const target = new FakeKeyboardTarget();
    const input = new BrowserInput(target.asWindow(), null, gestureUnlock.onUserGesture);

    expect(runtime.contextState).toBe('not_created');
    target.dispatchKeyDown('KeyA');
    target.dispatchKeyDown('KeyA');
    expect(input.getPressedKeys()).toContain('KeyA');
    expect(factory).toHaveBeenCalledTimes(1);
    expect(resume).toHaveBeenCalledTimes(1);
    expect(diagnostics).toEqual(expect.arrayContaining(['audio_context_created', 'audio_unlock_requested']));

    const lines = processSoundRuntimeEvents([playEvent(230, 1)], soundDocument([[230, 1]]), null, runtime);
    expect(lines.join('\n')).toContain('raw.sound_play owner=1 scope=character sample=230,1');
    expect(played).toHaveLength(0);

    resolveResume();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(diagnostics).toEqual(expect.arrayContaining(['audio_unlocked', 'playback_started']));
    expect(statuses).toEqual(['unlocked', 'unlocked']);
    expect(played).toHaveLength(1);
    input.dispose();
    gestureUnlock.dispose();
  });

  it('maps keyboard input through a custom config', () => {
    const config: InputConfig = {
      players: [
        {
          keyboard: { ...DEFAULT_INPUT_CONFIG.players[0].keyboard, right: 'KeyR', a: 'KeyM' },
          gamepad: DEFAULT_INPUT_CONFIG.players[0].gamepad,
        },
        DEFAULT_INPUT_CONFIG.players[1],
      ],
    };

    const input = keysToP1Input(new Set(['KeyR', 'KeyM']), config);

    expect(input.right).toBe(true);
    expect(input.attack).toBe(true);
    expect(input.buttons).toEqual(['a']);
  });

  it('maps the first gamepad to P1 keyboard-equivalent input', () => {
    const input = new BrowserInput(createFakeWindow(), {
      getGamepads: () => [createGamepad({ axes: [1, 0], pressedButtons: [0, 2] })],
    });

    const keys = input.getPressedKeys();
    expect(keys.has('ArrowRight')).toBe(true);
    expect(keys.has('KeyA')).toBe(true);
    expect(keys.has('KeyQ')).toBe(true);

    const p1Input = keysToP1Input(keys);
    expect(p1Input.right).toBe(true);
    expect(p1Input.attack).toBe(true);
    expect(p1Input.buttons).toEqual(['a', 'x']);
  });

  it('swaps gamepad face button groups so 0/1/4 are x/y/z and 2/3/5 are a/b/c', () => {
    const topButtons = new BrowserInput(createFakeWindow(), {
      getGamepads: () => [createGamepad({ pressedButtons: [0, 1, 4] })],
    });
    const bottomButtons = new BrowserInput(createFakeWindow(), {
      getGamepads: () => [createGamepad({ pressedButtons: [2, 3, 5] })],
    });

    expect(keysToP1Input(topButtons.getPressedKeys()).buttons).toEqual(['x', 'y', 'z']);
    expect(keysToP1Input(bottomButtons.getPressedKeys()).buttons).toEqual(['a', 'b', 'c']);
  });

  it('maps gamepad buttons through a custom config', () => {
    const config: InputConfig = {
      players: [
        {
          keyboard: DEFAULT_INPUT_CONFIG.players[0].keyboard,
          gamepad: { ...DEFAULT_INPUT_CONFIG.players[0].gamepad, a: 7 },
        },
        DEFAULT_INPUT_CONFIG.players[1],
      ],
    };
    const input = new BrowserInput(createFakeWindow(), {
      getGamepads: () => [createGamepad({ pressedButtons: [7] })],
    });

    expect(keysToP1Input(input.getPressedKeys(config), config).buttons).toEqual(['a']);
  });

  it('maps the second gamepad to P2 keyboard-equivalent input', () => {
    const input = new BrowserInput(createFakeWindow(), {
      getGamepads: () => [
        null,
        createGamepad({ pressedButtons: [0] }),
        createGamepad({ pressedButtons: [2, 14] }),
      ],
    });

    const keys = input.getPressedKeys();
    expect(keys.has('KeyJ')).toBe(true);
    expect(keys.has('KeyF')).toBe(true);

    const p2Input = keysToP2Input(keys);
    expect(p2Input.left).toBe(true);
    expect(p2Input.attack).toBe(true);
    expect(p2Input.buttons).toEqual(['a']);
  });

  it('maps the first connected gamepad to P1 even when browser slots start with null', () => {
    const input = new BrowserInput(createFakeWindow(), {
      getGamepads: () => [null, createGamepad({ axes: [1, 0], pressedButtons: [0] })],
    });

    const keys = input.getPressedKeys();
    expect(keys.has('ArrowRight')).toBe(true);
    expect(keys.has('KeyQ')).toBe(true);
    expect(keys.has('KeyA')).toBe(false);
    expect(keys.has('KeyL')).toBe(false);
    expect(keys.has('KeyF')).toBe(false);
  });
});

function createFakeWindow(): Window {
  return {
    addEventListener() {},
    removeEventListener() {},
  } as unknown as Window;
}

class FakeKeyboardTarget {
  private readonly listeners = new Map<string, Set<EventListener>>();

  asWindow(): Window {
    return {
      addEventListener: (type: string, listener: EventListener) => {
        const listeners = this.listeners.get(type) ?? new Set<EventListener>();
        listeners.add(listener);
        this.listeners.set(type, listeners);
      },
      removeEventListener: (type: string, listener: EventListener) => {
        this.listeners.get(type)?.delete(listener);
      },
    } as unknown as Window;
  }

  dispatchKeyDown(code: string, target: { tagName?: string; isContentEditable?: boolean } = {}): void {
    const event = { code, target, preventDefault() {} } as unknown as KeyboardEvent;
    for (const listener of this.listeners.get('keydown') ?? []) listener(event);
  }
}

function playEvent(group: number, index: number): SoundPlayEvent {
  return { type: 'play', ownerId: 1, scope: 'character', group, index, channel: null, volume: 100, volumeScale: 100, pan: 0, absolutePan: false, frequencyMultiplier: 1, loop: false };
}

function soundDocument(keys: Array<[number, number]>): SndDocument {
  const samples = keys.map(([group, index], sourceOffset): SndSample => ({ group, index, bytes: new Uint8Array([1, 2, 3, 4]), sourceOffset, format: 'wave' }));
  return { version: [1, 0, 0, 0], declaredSampleCount: samples.length, firstSubfileOffset: 0, samples, samplesByKey: new Map(samples.map((sample) => [`${sample.group},${sample.index}`, sample])), diagnostics: [] };
}

function createGamepad({
  axes = [0, 0],
  pressedButtons = [],
}: {
  axes?: number[];
  pressedButtons?: number[];
}): Gamepad {
  const pressedButtonSet = new Set(pressedButtons);
  return {
    axes,
    buttons: Array.from({ length: 16 }, (_, index) => {
      const pressed = pressedButtonSet.has(index);
      return { pressed, touched: pressed, value: pressed ? 1 : 0 };
    }),
  } as Gamepad;
}
