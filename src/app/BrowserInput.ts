import type { PlayerInput } from '../core/engine/types';

type KeyboardEventTarget = Pick<Window, 'addEventListener' | 'removeEventListener'>;
type GamepadReader = Pick<Navigator, 'getGamepads'>;

export type PlayerKeyboardMapping = {
  left: string;
  right: string;
  up: string;
  down: string;
  a: string;
  b: string;
  c: string;
  x: string;
  y: string;
  z: string;
};

export type PlayerGamepadMapping = {
  a: number;
  b: number;
  c: number;
  x: number;
  y: number;
  z: number;
};

export type PlayerInputMapping = {
  keyboard: PlayerKeyboardMapping;
  gamepad: PlayerGamepadMapping;
};

export type InputConfig = {
  players: readonly [PlayerInputMapping, PlayerInputMapping];
};

export const DEFAULT_INPUT_CONFIG: InputConfig = {
  players: [
    {
      keyboard: {
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
      },
      gamepad: { x: 0, y: 1, z: 4, a: 2, b: 3, c: 5 },
    },
    {
      keyboard: {
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
      },
      gamepad: { x: 0, y: 1, z: 4, a: 2, b: 3, c: 5 },
    },
  ],
};

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

  getPressedKeys(config: InputConfig = DEFAULT_INPUT_CONFIG): ReadonlySet<string> {
    const keys = new Set(this.pressedKeys);
    addGamepadKeys(keys, this.gamepads?.getGamepads() ?? [], config);
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

export function keysToP1Input(keys: ReadonlySet<string>, config: InputConfig = DEFAULT_INPUT_CONFIG): PlayerInput {
  return keysToPlayerInput(keys, config.players[0].keyboard);
}

export function keysToP2Input(keys: ReadonlySet<string>, config: InputConfig = DEFAULT_INPUT_CONFIG): PlayerInput {
  return keysToPlayerInput(keys, config.players[1].keyboard);
}

function keysToPlayerInput(keys: ReadonlySet<string>, mapping: PlayerKeyboardMapping): PlayerInput {
  return {
    left: keys.has(mapping.left),
    right: keys.has(mapping.right),
    up: keys.has(mapping.up),
    down: keys.has(mapping.down),
    attack: keys.has(mapping.a),
    buttons: keysToButtons(keys, mapping),
  };
}

const GAMEPAD_AXIS_THRESHOLD = 0.45;
const GAMEPAD_BUTTON_THRESHOLD = 0.5;

function keysToButtons(keys: ReadonlySet<string>, mapping: PlayerKeyboardMapping): string[] {
  return (['a', 'b', 'c', 'x', 'y', 'z'] as const).filter((button) => keys.has(mapping[button]));
}

function addGamepadKeys(keys: Set<string>, gamepads: readonly (Gamepad | null)[], config: InputConfig): void {
  const connectedGamepads = gamepads.filter((gamepad): gamepad is Gamepad => Boolean(gamepad));

  for (const [playerIndex, mapping] of config.players.entries()) {
    const gamepad = connectedGamepads[playerIndex];
    if (!gamepad) {
      continue;
    }

    if ((gamepad.axes[0] ?? 0) <= -GAMEPAD_AXIS_THRESHOLD || isGamepadButtonPressed(gamepad, 14)) {
      keys.add(mapping.keyboard.left);
    }
    if ((gamepad.axes[0] ?? 0) >= GAMEPAD_AXIS_THRESHOLD || isGamepadButtonPressed(gamepad, 15)) {
      keys.add(mapping.keyboard.right);
    }
    if ((gamepad.axes[1] ?? 0) <= -GAMEPAD_AXIS_THRESHOLD || isGamepadButtonPressed(gamepad, 12)) {
      keys.add(mapping.keyboard.up);
    }
    if ((gamepad.axes[1] ?? 0) >= GAMEPAD_AXIS_THRESHOLD || isGamepadButtonPressed(gamepad, 13)) {
      keys.add(mapping.keyboard.down);
    }

    for (const button of ['a', 'b', 'c', 'x', 'y', 'z'] as const) {
      if (isGamepadButtonPressed(gamepad, mapping.gamepad[button])) {
        keys.add(mapping.keyboard[button]);
      }
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
