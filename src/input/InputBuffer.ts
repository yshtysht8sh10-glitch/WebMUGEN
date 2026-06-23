import type { PlayerInput } from '../core/engine/types';

export type DirectionToken = 'N' | 'F' | 'B' | 'U' | 'D' | 'DF' | 'DB' | 'UF' | 'UB';

export type InputFrame = {
  direction: DirectionToken;
  buttons: Set<string>;
};

export class InputBuffer {
  private readonly frames: InputFrame[] = [];

  constructor(private readonly maxFrames = 60) {}

  push(input: PlayerInput): void {
    this.frames.unshift(inputToFrame(input));

    if (this.frames.length > this.maxFrames) {
      this.frames.length = this.maxFrames;
    }
  }

  getFrames(): readonly InputFrame[] {
    return this.frames;
  }

  clone(): InputBuffer {
    const clone = new InputBuffer(this.maxFrames);
    clone.frames.push(
      ...this.frames.map((frame) => ({
        direction: frame.direction,
        buttons: new Set(frame.buttons),
      })),
    );
    return clone;
  }

  clear(): void {
    this.frames.length = 0;
  }
}

export function inputToFrame(input: PlayerInput): InputFrame {
  return {
    direction: inputToDirection(input),
    buttons: inputToButtons(input),
  };
}

export function inputToButtons(input: PlayerInput): Set<string> {
  const buttons = new Set<string>();

  if (input.attack) {
    buttons.add('a');
  }

  if (input.buttons) {
    for (const button of input.buttons) {
      buttons.add(button.toLowerCase());
    }
  }

  return buttons;
}

export function inputToDirection(input: PlayerInput): DirectionToken {
  const left = input.left;
  const right = input.right;
  const up = input.up ?? false;
  const down = input.down ?? false;

  if (right && down) return 'DF';
  if (left && down) return 'DB';
  if (right && up) return 'UF';
  if (left && up) return 'UB';
  if (right) return 'F';
  if (left) return 'B';
  if (down) return 'D';
  if (up) return 'U';
  return 'N';
}
