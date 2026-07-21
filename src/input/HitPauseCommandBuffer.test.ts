import { describe, expect, it } from 'vitest';
import { parseCmdText } from '../parser/cmd/CmdParser';
import { HitPauseCommandBuffer } from './HitPauseCommandBuffer';

describe('HitPauseCommandBuffer', () => {
  const cmd = parseCmdText(`
[Command]
name = "a"
command = a
time = 1

[Command]
name = "qcf_a"
command = D, DF, F, a
time = 15

[Command]
name = "holddown"
command = /D
time = 1
`);

  it('releases a button command once when hitpause ends', () => {
    const buffer = new HitPauseCommandBuffer(cmd);
    buffer.resolve(new Set(['a']), true);
    for (let frame = 0; frame < 8; frame += 1) buffer.resolve(new Set(), true);

    expect(buffer.resolve(new Set(), false)).toEqual(new Set(['a']));
    expect(buffer.resolve(new Set(), false)).toEqual(new Set());
  });

  it('buffers button sequences but not released direction holds', () => {
    const buffer = new HitPauseCommandBuffer(cmd);
    buffer.resolve(new Set(['qcf_a', 'holddown']), true);

    expect(buffer.resolve(new Set(), false)).toEqual(new Set(['qcf_a']));
  });

  it('clears pending commands on reset', () => {
    const buffer = new HitPauseCommandBuffer(cmd);
    buffer.resolve(new Set(['a']), true);
    buffer.clear();

    expect(buffer.resolve(new Set(), false)).toEqual(new Set());
  });
});
