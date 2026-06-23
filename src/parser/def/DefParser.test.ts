import { describe, expect, it } from 'vitest';
import { getCharacterDefFiles, getDefSection, parseDefText } from './DefParser';

describe('DefParser', () => {
  it('parses sections and key values', () => {
    const doc = parseDefText(`
[Info]
name = "Kung Fu Man"

[Files]
cmd = kfm.cmd
cns = kfm.cns
st = kfm-common.cns
st1 = kfm-special.cns
sprite = kfm.sff
anim = kfm.air
sound = kfm.snd
`);

    expect(getDefSection(doc, 'Info')?.values.get('name')).toBe('"Kung Fu Man"');
    expect(getDefSection(doc, 'Files')?.values.get('cmd')).toBe('kfm.cmd');
  });

  it('extracts character file paths', () => {
    const doc = parseDefText(`
[Files]
cmd = kfm.cmd
cns = kfm.cns
st = common.cns
st2 = extra.cns
sprite = kfm.sff
anim = kfm.air
sound = kfm.snd
`);

    expect(getCharacterDefFiles(doc)).toEqual({
      cmd: 'kfm.cmd',
      cns: 'kfm.cns',
      st: ['common.cns', 'extra.cns'],
      sprite: 'kfm.sff',
      anim: 'kfm.air',
      sound: 'kfm.snd',
    });
  });

  it('extracts sorted palette file references', () => {
    const doc = parseDefText(`
[Files]
pal6 = kfm.act
pal1 = kfm6.act
pal2 = kfm4.act
`);

    expect(getCharacterDefFiles(doc).palettes).toEqual([
      { slot: 1, file: 'kfm6.act' },
      { slot: 2, file: 'kfm4.act' },
      { slot: 6, file: 'kfm.act' },
    ]);
  });
});
