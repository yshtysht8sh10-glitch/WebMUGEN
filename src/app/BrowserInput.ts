import type { PlayerInput } from '../core/engine/types';

type KeyboardEventTarget = Pick<Window, 'addEventListener' | 'removeEventListener'>;

export class BrowserInput {
  private readonly pressedKeys = new Set<string>();

  constructor(private readonly target: KeyboardEventTarget = window) {
    this.target.addEventListener('keydown', this.handleKeyDown);
    this.target.addEventListener('keyup', this.handleKeyUp);
    this.target.addEventListener('blur', this.handleBlur);
  }

  getPressedKeys(): ReadonlySet<string> {
    return this.pressedKeys;
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.handleKeyDown);
    this.target.removeEventListener('keyup', this.handleKeyUp);
    this.target.removeEventListener('blur', this.handleBlur);
    this.pressedKeys.clear();
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    this.pressedKeys.add(event.code);
    if (shouldPreventDefault(event.code)) {
      event.preventDefault();
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.pressedKeys.delete(event.code);
    if (shouldPreventDefault(event.code)) {
      event.preventDefault();
    }
  };

  private readonly handleBlur = (): void => {
    this.pressedKeys.clear();
  };
}

export function keysToP1Input(keys: ReadonlySet<string>): PlayerInput {
  return {
    left: keys.has('ArrowLeft'),
    right: keys.has('ArrowRight'),
    up: keys.has('ArrowUp'),
    down: keys.has('ArrowDown'),
    attack: keys.has('KeyA'),
    buttons: keysToButtons(keys, P1_BUTTON_KEYS),
  };
}

export function keysToP2Input(keys: ReadonlySet<string>): PlayerInput {
  return {
    left: keys.has('KeyJ'),
    right: keys.has('KeyL'),
    up: keys.has('KeyI'),
    down: keys.has('KeyK'),
    attack: keys.has('KeyF'),
    buttons: keysToButtons(keys, P2_BUTTON_KEYS),
  };
}

const P1_BUTTON_KEYS: Readonly<Record<string, string>> = {
  KeyA: 'a',
  KeyS: 'b',
  KeyD: 'c',
  KeyQ: 'x',
  KeyW: 'y',
  KeyE: 'z',
};

const P2_BUTTON_KEYS: Readonly<Record<string, string>> = {
  KeyF: 'a',
  KeyG: 'b',
  KeyH: 'c',
  KeyU: 'x',
  KeyO: 'y',
  KeyP: 'z',
};

function keysToButtons(keys: ReadonlySet<string>, mapping: Readonly<Record<string, string>>): string[] {
  return Object.entries(mapping)
    .filter(([code]) => keys.has(code))
    .map(([, button]) => button);
}

function shouldPreventDefault(code: string): boolean {
  return (
    code.startsWith('Arrow') ||
    code === 'KeyA' ||
    code === 'KeyS' ||
    code === 'KeyD' ||
    code === 'KeyF' ||
    code === 'KeyG' ||
    code === 'KeyH' ||
    code === 'KeyI' ||
    code === 'KeyJ' ||
    code === 'KeyK' ||
    code === 'KeyL' ||
    code === 'KeyQ' ||
    code === 'KeyU' ||
    code === 'KeyW' ||
    code === 'KeyE' ||
    code === 'KeyO' ||
    code === 'KeyP' ||
    code === 'KeyR'
  );
}
