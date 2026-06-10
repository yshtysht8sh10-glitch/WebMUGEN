import { describe, expect, it } from 'vitest';
import { matchesCommand, parseCommandTokens } from './CommandMatcher';
import { InputBuffer } from './InputBuffer';

describe('CommandMatcher', () => {
  it('parses command tokens', () => {
    expect(parseCommandTokens('D,DF,F,a')).toEqual([
      { kind: 'direction', value: 'D', hold: false },
      { kind: 'direction', value: 'DF', hold: false },
      { kind: 'direction', value: 'F', hold: false },
      { kind: 'button', value: 'a', hold: false },
    ]);
  });

  it('matches simple hold command', () => {
    const buffer = new InputBuffer();
    buffer.push({ left: false, right: true, up: false, down: false, attack: false });

    expect(matchesCommand({ name: 'holdfwd', command: '/F', time: 1 }, buffer.getFrames())).toBe(
      true,
    );
  });

  it('matches quarter-circle command', () => {
    const buffer = new InputBuffer(20);

    buffer.push({ left: false, right: false, up: false, down: true, attack: false });
    buffer.push({ left: false, right: true, up: false, down: true, attack: false });
    buffer.push({ left: false, right: true, up: false, down: false, attack: false });
    buffer.push({ left: false, right: false, up: false, down: false, attack: true });

    expect(matchesCommand({ name: 'qcf_a', command: 'D,DF,F,a', time: 15 }, buffer.getFrames())).toBe(
      true,
    );
  });

  it('does not match command in wrong order', () => {
    const buffer = new InputBuffer(20);

    buffer.push({ left: false, right: true, up: false, down: false, attack: false });
    buffer.push({ left: false, right: true, up: false, down: true, attack: false });
    buffer.push({ left: false, right: false, up: false, down: true, attack: false });
    buffer.push({ left: false, right: false, up: false, down: false, attack: true });

    expect(matchesCommand({ name: 'qcf_a', command: 'D,DF,F,a', time: 15 }, buffer.getFrames())).toBe(
      false,
    );
  });
});
