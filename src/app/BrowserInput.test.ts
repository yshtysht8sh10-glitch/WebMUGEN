import { describe, expect, it } from 'vitest';
import { BrowserInput, keysToP1Input, keysToP2Input } from './BrowserInput';

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
});
