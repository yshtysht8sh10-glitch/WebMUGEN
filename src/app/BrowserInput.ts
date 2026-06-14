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

function shouldPreventDefault(code: string): boolean {
  return (
    code.startsWith('Arrow') ||
    code === 'KeyA' ||
    code === 'KeyF' ||
    code === 'KeyI' ||
    code === 'KeyJ' ||
    code === 'KeyK' ||
    code === 'KeyL' ||
    code === 'KeyR'
  );
}
