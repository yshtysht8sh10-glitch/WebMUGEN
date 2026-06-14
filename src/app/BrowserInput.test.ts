import { describe, expect, it } from 'vitest';
import { BrowserInput } from './BrowserInput';

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
});
