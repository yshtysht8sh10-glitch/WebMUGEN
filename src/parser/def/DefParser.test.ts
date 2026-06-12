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
});
