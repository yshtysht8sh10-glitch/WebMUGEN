import type { PlayerInput } from '../core/engine/types';

type KeyboardEventTarget = Pick<Window, 'addEventListener' | 'removeEventListener'>;
type GamepadReader = Pick<Navigator, 'getGamepads'>;

export class BrowserInput {
  private readonly pressedKeys = new Set<string>();

  constructor(
    private readonly target: KeyboardEventTarget = window,
    private readonly gamepads: GamepadReader | null = getDefaultGamepadReader(),
  ) {
    this.target.addEventListener('keydown', this.handleKeyDown);
    this.target.addEventListener('keyup', this.handleKeyUp);
    this.target.addEventListener('blur', this.handleBlur);
  }

  getPressedKeys(): ReadonlySet<string> {
    const keys = new Set(this.pressedKeys);
    addGamepadKeys(keys, this.gamepads?.getGamepads() ?? []);
    return keys;
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

const GAMEPAD_AXIS_THRESHOLD = 0.45;
const GAMEPAD_BUTTON_THRESHOLD = 0.5;

const P1_GAMEPAD_KEYS = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  up: 'ArrowUp',
  down: 'ArrowDown',
  a: 'KeyA',
  b: 'KeyS',
  c: 'KeyD',
  x: 'KeyQ',
  y: 'KeyW',
  z: 'KeyE',
} as const;

const P2_GAMEPAD_KEYS = {
  left: 'KeyJ',
  right: 'KeyL',
  up: 'KeyI',
  down: 'KeyK',
  a: 'KeyF',
  b: 'KeyG',
  c: 'KeyH',
  x: 'KeyU',
  y: 'KeyO',
  z: 'KeyP',
} as const;

const GAMEPAD_KEY_MAPS = [P1_GAMEPAD_KEYS, P2_GAMEPAD_KEYS] as const;

function keysToButtons(keys: ReadonlySet<string>, mapping: Readonly<Record<string, string>>): string[] {
  return Object.entries(mapping)
    .filter(([code]) => keys.has(code))
    .map(([, button]) => button);
}

function addGamepadKeys(keys: Set<string>, gamepads: readonly (Gamepad | null)[]): void {
  for (const [playerIndex, mapping] of GAMEPAD_KEY_MAPS.entries()) {
    const gamepad = gamepads[playerIndex];
    if (!gamepad) {
      continue;
    }

    if ((gamepad.axes[0] ?? 0) <= -GAMEPAD_AXIS_THRESHOLD || isGamepadButtonPressed(gamepad, 14)) {
      keys.add(mapping.left);
    }
    if ((gamepad.axes[0] ?? 0) >= GAMEPAD_AXIS_THRESHOLD || isGamepadButtonPressed(gamepad, 15)) {
      keys.add(mapping.right);
    }
    if ((gamepad.axes[1] ?? 0) <= -GAMEPAD_AXIS_THRESHOLD || isGamepadButtonPressed(gamepad, 12)) {
      keys.add(mapping.up);
    }
    if ((gamepad.axes[1] ?? 0) >= GAMEPAD_AXIS_THRESHOLD || isGamepadButtonPressed(gamepad, 13)) {
      keys.add(mapping.down);
    }

    if (isGamepadButtonPressed(gamepad, 0)) {
      keys.add(mapping.a);
    }
    if (isGamepadButtonPressed(gamepad, 1)) {
      keys.add(mapping.b);
    }
    if (isGamepadButtonPressed(gamepad, 4)) {
      keys.add(mapping.c);
    }
    if (isGamepadButtonPressed(gamepad, 2)) {
      keys.add(mapping.x);
    }
    if (isGamepadButtonPressed(gamepad, 3)) {
      keys.add(mapping.y);
    }
    if (isGamepadButtonPressed(gamepad, 5)) {
      keys.add(mapping.z);
    }
  }
}

function isGamepadButtonPressed(gamepad: Gamepad, index: number): boolean {
  const button = gamepad.buttons[index];
  return Boolean(button?.pressed || (button?.value ?? 0) >= GAMEPAD_BUTTON_THRESHOLD);
}

function getDefaultGamepadReader(): GamepadReader | null {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
    return null;
  }
  return navigator;
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
