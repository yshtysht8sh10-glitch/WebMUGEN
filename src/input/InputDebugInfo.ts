export type InputDebugSnapshot = {
  pressedKeys: string[];
  system: {
    restartRound: boolean;
  };
  p1: {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
    attack: boolean;
    projectile: boolean;
  };
  p2: {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
    attack: boolean;
  };
};

export function createInputDebugSnapshot(pressedKeys: ReadonlySet<string>): InputDebugSnapshot {
  const has = (key: string) => pressedKeys.has(key);

  return {
    pressedKeys: Array.from(pressedKeys).sort(),
    system: {
      restartRound: has('KeyR'),
    },
    p1: {
      left: has('ArrowLeft'),
      right: has('ArrowRight'),
      up: has('ArrowUp'),
      down: has('ArrowDown'),
      attack: has('KeyA'),
      projectile: has('KeyA') && has('ArrowDown'),
    },
    p2: {
      left: has('KeyJ'),
      right: has('KeyL'),
      up: has('KeyI'),
      down: has('KeyK'),
      attack: has('KeyF'),
    },
  };
}
