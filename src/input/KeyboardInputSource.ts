import type { FrameInput } from '../core/engine/types';

export class KeyboardInputSource {
  private readonly pressed = new Set<string>();
  private readonly justPressed = new Set<string>();

  constructor() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  readFrameInput(): FrameInput {
    const frameInput: FrameInput = {
      p1: {
        left: this.pressed.has('ArrowLeft'),
        right: this.pressed.has('ArrowRight'),
        up: this.pressed.has('ArrowUp'),
        down: this.pressed.has('ArrowDown'),
        attack: this.justPressed.has('KeyA'),
      },
      p2: {
        left: this.pressed.has('KeyJ'),
        right: this.pressed.has('KeyL'),
        up: this.pressed.has('KeyI'),
        down: this.pressed.has('KeyK'),
        attack: this.justPressed.has('KeyF'),
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
