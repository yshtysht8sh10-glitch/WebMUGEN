import { describe, expect, it } from 'vitest';
import { decodeMugenTextWithEncoding } from './MugenTextDecoder';

describe('MugenTextDecoder', () => {
  it('detects BOM-less UTF-8 per file', () => {
    const result = decodeMugenTextWithEncoding(new TextEncoder().encode('日本語のコマンド'));

    expect(result).toEqual({ encoding: 'utf-8', text: '日本語のコマンド' });
  });

  it('falls back to CP932-compatible Shift-JIS per file', () => {
    const result = decodeMugenTextWithEncoding(new Uint8Array([
      0x93, 0xfa, 0x96, 0x7b, 0x8c, 0xea,
    ]));

    expect(result).toEqual({ encoding: 'shift_jis', text: '日本語' });
  });

  it('honors UTF BOMs before byte validation', () => {
    expect(decodeMugenTextWithEncoding(new Uint8Array([0xef, 0xbb, 0xbf, 0xe6, 0x97, 0xa5])))
      .toEqual({ encoding: 'utf-8', text: '日' });
    expect(decodeMugenTextWithEncoding(new Uint8Array([0xff, 0xfe, 0xe5, 0x65])))
      .toEqual({ encoding: 'utf-16le', text: '日' });
    expect(decodeMugenTextWithEncoding(new Uint8Array([0xfe, 0xff, 0x65, 0xe5])))
      .toEqual({ encoding: 'utf-16be', text: '日' });
  });
});
