export type DirectionToken = 'B' | 'DB' | 'D' | 'DF' | 'F' | 'UF' | 'U' | 'UB' | 'N';
export type ButtonToken = 'a' | 'b' | 'c' | 'x' | 'y' | 'z' | 's';
export type InputToken = DirectionToken | ButtonToken;

export type InputFrame = {
  frame: number;
  tokens: InputToken[];
};

export type InputSnapshot = {
  direction: DirectionToken;
  buttons: ButtonToken[];
};

export function normalizeInputTokens(tokens: readonly string[]): InputToken[] {
  return tokens
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .map((token) => {
      const upper = token.toUpperCase();
      if (isDirectionToken(upper)) {
        return upper;
      }

      return token.toLowerCase();
    })
    .filter(isInputToken);
}

export function snapshotToTokens(snapshot: InputSnapshot): InputToken[] {
  return [snapshot.direction, ...snapshot.buttons];
}

export function isInputToken(value: string): value is InputToken {
  return isDirectionToken(value) || isButtonToken(value);
}

export function isDirectionToken(value: string): value is DirectionToken {
  return ['B', 'DB', 'D', 'DF', 'F', 'UF', 'U', 'UB', 'N'].includes(value);
}

export function isButtonToken(value: string): value is ButtonToken {
  return ['a', 'b', 'c', 'x', 'y', 'z', 's'].includes(value);
}
