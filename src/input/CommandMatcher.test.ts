import { describe, expect, it } from 'vitest';
import { matchesCommand, parseCommandSteps, parseCommandTokens } from './CommandMatcher';
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

  it('parses MUGEN release and hold modifiers', () => {
    expect(parseCommandTokens('~D, /$F, x+y')).toEqual([
      { kind: 'direction', value: 'D', hold: false },
      { kind: 'direction', value: 'F', hold: true },
      { kind: 'button', value: 'x', hold: false },
      { kind: 'button', value: 'y', hold: false },
    ]);
  });

  it('parses simultaneous command step', () => {
    expect(parseCommandSteps('/F+/U')).toEqual([
      {
        tokens: [
          { kind: 'direction', value: 'F', hold: true },
          { kind: 'direction', value: 'U', hold: true },
        ],
      },
    ]);
  });

  it('matches simple hold command', () => {
    const buffer = new InputBuffer();
    buffer.push({ left: false, right: true, up: false, down: false, attack: false });

    expect(matchesCommand({ name: 'holdfwd', command: '/F', time: 1 }, buffer.getFrames())).toBe(
      true,
    );
  });

  it('matches simultaneous diagonal hold command', () => {
    const buffer = new InputBuffer();
    buffer.push({ left: false, right: true, up: true, down: false, attack: false });

    expect(
      matchesCommand({ name: 'holdfwd_up', command: '/F+/U', time: 1 }, buffer.getFrames()),
    ).toBe(true);
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

  it('matches KFM-style quarter-circle x command', () => {
    const buffer = new InputBuffer(20);

    buffer.push({ left: false, right: false, up: false, down: true, attack: false });
    buffer.push({ left: false, right: true, up: false, down: true, attack: false });
    buffer.push({ left: false, right: true, up: false, down: false, attack: false });
    buffer.push({ left: false, right: false, up: false, down: false, attack: false, buttons: ['x'] });

    expect(matchesCommand({ name: 'QCF_x', command: '~D, DF, F, x', time: 15 }, buffer.getFrames())).toBe(
      true,
    );
  });

  it('matches hold-down plus button command', () => {
    const buffer = new InputBuffer(20);

    buffer.push({ left: false, right: false, up: false, down: true, attack: false, buttons: ['a'] });

    expect(matchesCommand({ name: 'down_a', command: '/$D,a', time: 1 }, buffer.getFrames())).toBe(true);
  });

  it('matches quarter-circle command when attack is pressed on down-forward', () => {
    const buffer = new InputBuffer(20);

    buffer.push({ left: false, right: false, up: false, down: true, attack: false });
    buffer.push({ left: false, right: true, up: false, down: true, attack: false });
    buffer.push({ left: false, right: true, up: false, down: true, attack: true });

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
