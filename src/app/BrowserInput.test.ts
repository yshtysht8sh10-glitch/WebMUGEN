import { describe, expect, it } from 'vitest';
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
