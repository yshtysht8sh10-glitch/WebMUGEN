import type { PlayerInput } from '../core/engine/types';

export type DirectionToken = 'N' | 'F' | 'B' | 'U' | 'D' | 'DF' | 'DB' | 'UF' | 'UB';

export type InputFrame = {
  direction: DirectionToken;
  buttons: Set<string>;
};

export class InputBuffer {
  private readonly frames: InputFrame[] = [];
  private facing: 1 | -1 | null = null;

  constructor(private readonly maxFrames = 60) {}

  push(input: PlayerInput, facing: 1 | -1 = 1): void {
    if (this.facing !== null && this.facing !== facing) {
      this.frames.length = 0;
    }
    this.facing = facing;
    this.frames.unshift(inputToFrame(input, facing));

    if (this.frames.length > this.maxFrames) {
      this.frames.length = this.maxFrames;
    }
  }

  getFrames(): readonly InputFrame[] {
    return this.frames;
  }

  clone(): InputBuffer {
    const clone = new InputBuffer(this.maxFrames);
    clone.facing = this.facing;
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
    this.facing = null;
  }
}

export function inputToFrame(input: PlayerInput, facing: 1 | -1 = 1): InputFrame {
  return {
    direction: inputToDirection(input, facing),
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

export function inputToDirection(input: PlayerInput, facing: 1 | -1 = 1): DirectionToken {
  const forward = facing === 1 ? input.right : input.left;
  const back = facing === 1 ? input.left : input.right;
  const up = input.up ?? false;
  const down = input.down ?? false;

  if (forward && down) return 'DF';
  if (back && down) return 'DB';
  if (forward && up) return 'UF';
  if (back && up) return 'UB';
  if (forward) return 'F';
  if (back) return 'B';
  if (down) return 'D';
  if (up) return 'U';
  return 'N';
}
