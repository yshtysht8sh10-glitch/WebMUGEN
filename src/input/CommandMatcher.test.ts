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

  it('keeps lowercase b as a button and uppercase B as back direction', () => {
    expect(parseCommandTokens('b')).toEqual([
      { kind: 'button', value: 'b', hold: false },
    ]);

    expect(parseCommandTokens('B')).toEqual([
      { kind: 'direction', value: 'B', hold: false },
    ]);
  });

  it('does not match button b from holding back', () => {
    const buffer = new InputBuffer();
    buffer.push({ left: true, right: false, up: false, down: false, attack: false });

    expect(matchesCommand({ name: 'b', command: 'b', time: 1 }, buffer.getFrames())).toBe(false);
    expect(matchesCommand({ name: 'holdback', command: '/$B', time: 1 }, buffer.getFrames())).toBe(true);
  });

  it('does not match double-tap forward from holding forward', () => {
    const buffer = new InputBuffer(10);
    buffer.push({ left: false, right: true, up: false, down: false, attack: false });
    buffer.push({ left: false, right: true, up: false, down: false, attack: false });
    buffer.push({ left: false, right: true, up: false, down: false, attack: false });

    expect(matchesCommand({ name: 'FF', command: 'F, F', time: 10 }, buffer.getFrames())).toBe(false);
  });

  it('matches double-tap forward when forward is pressed twice', () => {
    const buffer = new InputBuffer(10);
    buffer.push({ left: false, right: true, up: false, down: false, attack: false });
    buffer.push({ left: false, right: false, up: false, down: false, attack: false });
    buffer.push({ left: false, right: true, up: false, down: false, attack: false });

    expect(matchesCommand({ name: 'FF', command: 'F, F', time: 10 }, buffer.getFrames())).toBe(true);
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

  it('keeps a completed command active for buffer.time frames', () => {
    const buffer = new InputBuffer(10);
    buffer.push({ left: false, right: false, up: false, down: false, attack: false, buttons: ['x'] });
    buffer.push({ left: false, right: false, up: false, down: false, attack: false });
    buffer.push({ left: false, right: false, up: false, down: false, attack: false });

    expect(matchesCommand({ name: 'x', command: 'x', time: 1, bufferTime: 2 }, buffer.getFrames())).toBe(true);
    expect(matchesCommand({ name: 'x', command: 'x', time: 1, bufferTime: 1 }, buffer.getFrames())).toBe(false);
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
