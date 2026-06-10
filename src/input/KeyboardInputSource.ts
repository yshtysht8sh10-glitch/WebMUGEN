import type { FrameInput } from '../core/engine/types';
import { InputBuffer } from './InputBuffer';

export class KeyboardInputSource {
  private readonly pressed = new Set<string>();
  private readonly justPressed = new Set<string>();
  private readonly p1Buffer = new InputBuffer(60);
  private readonly p2Buffer = new InputBuffer(60);

  constructor() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  readFrameInput(): FrameInput {
    const p1 = {
      left: this.pressed.has('ArrowLeft'),
      right: this.pressed.has('ArrowRight'),
      up: this.pressed.has('ArrowUp'),
      down: this.pressed.has('ArrowDown'),
      attack: this.justPressed.has('KeyA'),
    };

    const p2 = {
      left: this.pressed.has('KeyJ'),
      right: this.pressed.has('KeyL'),
      up: this.pressed.has('KeyI'),
      down: this.pressed.has('KeyK'),
      attack: this.justPressed.has('KeyF'),
    };

    this.p1Buffer.push(p1);
    this.p2Buffer.push(p2);

    const frameInput: FrameInput = {
      p1: {
        ...p1,
        inputBuffer: this.p1Buffer,
      },
      p2: {
        ...p2,
        inputBuffer: this.p2Buffer,
      },
    };

    this.justPressed.clear();
    return frameInput;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (
      [
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'ArrowDown',
        'KeyA',
        'KeyJ',
        'KeyL',
        'KeyI',
        'KeyK',
        'KeyF',
      ].includes(event.code)
    ) {
      event.preventDefault();
    }

    if (!this.pressed.has(event.code)) {
      this.justPressed.add(event.code);
    }

    this.pressed.add(event.code);
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.pressed.delete(event.code);
  };
}
