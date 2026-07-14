import { describe, expect, it } from 'vitest';
import { matchesCommand, parseCommandSteps, parseCommandTokens } from './CommandMatcher';
import { InputBuffer } from './InputBuffer';

describe('CommandMatcher', () => {
  it('parses command tokens', () => {
    expect(parseCommandTokens('D,DF,F,a')).toEqual([
      { kind: 'direction', value: 'D', hold: false, release: false },
      { kind: 'direction', value: 'DF', hold: false, release: false },
      { kind: 'direction', value: 'F', hold: false, release: false },
      { kind: 'button', value: 'a', hold: false, release: false },
    ]);
  });

  it('keeps lowercase b as a button and uppercase B as back direction', () => {
    expect(parseCommandTokens('b')).toEqual([
      { kind: 'button', value: 'b', hold: false, release: false },
    ]);

    expect(parseCommandTokens('B')).toEqual([
      { kind: 'direction', value: 'B', hold: false, release: false },
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
      { kind: 'direction', value: 'D', hold: false, release: true },
      { kind: 'direction', value: 'F', hold: true, release: false },
      { kind: 'button', value: 'x', hold: false, release: false },
      { kind: 'button', value: 'y', hold: false, release: false },
    ]);
  });

  it('parses simultaneous command step', () => {
    expect(parseCommandSteps('/F+/U')).toEqual([
      {
        tokens: [
          { kind: 'direction', value: 'F', hold: true, release: false },
          { kind: 'direction', value: 'U', hold: true, release: false },
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

  it('keeps simple button commands briefly active by default after release', () => {
    const buffer = new InputBuffer(10);
    buffer.push({ left: false, right: false, up: false, down: false, attack: false, buttons: ['x'] });
    buffer.push({ left: false, right: false, up: false, down: false, attack: false });
    buffer.push({ left: false, right: false, up: false, down: false, attack: false });

    expect(matchesCommand({ name: 'x', command: 'x', time: 1 }, buffer.getFrames())).toBe(true);
  });

  it('does not retrigger a simple button command while the button is held', () => {
    const buffer = new InputBuffer(10);
    buffer.push({ left: false, right: false, up: false, down: false, attack: false, buttons: ['b'] });
    buffer.push({ left: false, right: false, up: false, down: false, attack: false, buttons: ['b'] });
    buffer.push({ left: false, right: false, up: false, down: false, attack: false, buttons: ['b'] });
    buffer.push({ left: false, right: false, up: false, down: false, attack: false, buttons: ['b'] });

    expect(matchesCommand({ name: 'b', command: 'b', time: 1 }, buffer.getFrames())).toBe(false);
  });

  it('matches a simple button command again after the button is released and pressed', () => {
    const buffer = new InputBuffer(10);
    buffer.push({ left: false, right: false, up: false, down: false, attack: false, buttons: ['b'] });
    buffer.push({ left: false, right: false, up: false, down: false, attack: false });
    buffer.push({ left: false, right: false, up: false, down: false, attack: false, buttons: ['b'] });

    expect(matchesCommand({ name: 'b', command: 'b', time: 1 }, buffer.getFrames())).toBe(true);
  });

  it('does not apply the default button buffer to direction commands', () => {
    const buffer = new InputBuffer(10);
    buffer.push({ left: false, right: true, up: false, down: false, attack: false });
    buffer.push({ left: false, right: false, up: false, down: false, attack: false });

    expect(matchesCommand({ name: 'holdfwd', command: '/F', time: 1 }, buffer.getFrames())).toBe(false);
  });

  it('keeps double-tap direction commands briefly active by default', () => {
    const buffer = new InputBuffer(10);
    buffer.push({ left: false, right: true, up: false, down: false, attack: false });
    buffer.push({ left: false, right: false, up: false, down: false, attack: false });
    buffer.push({ left: false, right: true, up: false, down: false, attack: false });
    buffer.push({ left: false, right: false, up: false, down: false, attack: false });

    expect(matchesCommand({ name: 'FF', command: 'F, F', time: 10 }, buffer.getFrames())).toBe(true);
  });

  it('does not keep double-tap forward active for the whole hold', () => {
    const buffer = new InputBuffer(20);
    buffer.push({ left: false, right: true, up: false, down: false, attack: false });
    buffer.push({ left: false, right: false, up: false, down: false, attack: false });
    buffer.push({ left: false, right: true, up: false, down: false, attack: false });
    buffer.push({ left: false, right: true, up: false, down: false, attack: false });
    buffer.push({ left: false, right: true, up: false, down: false, attack: false });
    buffer.push({ left: false, right: true, up: false, down: false, attack: false });

    expect(matchesCommand({ name: 'FF', command: 'F, F', time: 10 }, buffer.getFrames())).toBe(false);
  });

  it('does not retrigger double-tap back while back is held', () => {
    const buffer = new InputBuffer(20);
    buffer.push({ left: true, right: false, up: false, down: false, attack: false });
    buffer.push({ left: false, right: false, up: false, down: false, attack: false });
    buffer.push({ left: true, right: false, up: false, down: false, attack: false });
    buffer.push({ left: true, right: false, up: false, down: false, attack: false });
    buffer.push({ left: true, right: false, up: false, down: false, attack: false });
    buffer.push({ left: true, right: false, up: false, down: false, attack: false });

    expect(matchesCommand({ name: 'BB', command: 'B, B', time: 10 }, buffer.getFrames())).toBe(false);
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

  it('requires a released ~D before the later command steps', () => {
    const released = new InputBuffer(20);
    released.push({ left: false, right: false, up: false, down: true, attack: false });
    released.push({ left: true, right: false, up: false, down: true, attack: false });
    released.push({ left: true, right: false, up: false, down: false, attack: false });
    released.push({ left: false, right: true, up: false, down: false, attack: false });
    released.push({ left: false, right: false, up: false, down: false, attack: false, buttons: ['x'] });

    const held = new InputBuffer(20);
    held.push({ left: false, right: false, up: false, down: true, attack: false });
    held.push({ left: true, right: false, up: false, down: true, attack: false });
    held.push({ left: true, right: false, up: false, down: true, attack: false });
    held.push({ left: false, right: true, up: false, down: true, attack: false });
    held.push({ left: false, right: false, up: false, down: true, attack: false, buttons: ['x'] });

    const command = { name: 'release', command: '~D, DB, B, F, x', time: 25 };
    expect(matchesCommand(command, released.getFrames())).toBe(true);
    expect(matchesCommand(command, held.getFrames())).toBe(false);
    expect(matchesCommand({ ...command, command: 'D, DB, B, F, x' }, held.getFrames())).toBe(true);
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
