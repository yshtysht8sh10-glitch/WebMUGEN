import { describe, expect, it } from 'vitest';
import { findSndSample } from './SndTypes';
import { parseSndV1, SndParseError } from './SndParser';

describe('SndParser', () => {
  it('parses linked SND v1 WAV samples and supports group/index lookup', () => {
    const document = parseSndV1(makeSnd([
      { group: 0, index: 0, bytes: waveBytes(1) },
      { group: 2, index: 7, bytes: waveBytes(2) },
    ]));

    expect(document.version).toEqual([1, 0, 0, 0]);
    expect(document.declaredSampleCount).toBe(2);
    expect(findSndSample(document, 2, 7)?.bytes).toEqual(waveBytes(2));
    expect(findSndSample(document, 9, 9)).toBeNull();
    expect(document.diagnostics).toEqual([]);
  });

  it('keeps the first duplicate lookup entry and diagnoses duplicates, empty payloads, and unknown formats', () => {
    const document = parseSndV1(makeSnd([
      { group: 1, index: 2, bytes: waveBytes(3) },
      { group: 1, index: 2, bytes: waveBytes(4) },
      { group: 3, index: 0, bytes: new Uint8Array() },
      { group: 4, index: 0, bytes: new Uint8Array([1, 2, 3]) },
    ]));

    expect(document.samples).toHaveLength(4);
    expect(findSndSample(document, 1, 2)?.bytes).toEqual(waveBytes(3));
    expect(document.diagnostics.map((item) => item.code)).toEqual([
      'duplicate_sample', 'empty_sample', 'unknown_format',
    ]);
  });

  it('rejects an invalid or truncated archive header', () => {
    expect(() => parseSndV1(new Uint8Array(10))).toThrow(SndParseError);
    expect(() => parseSndV1(new Uint8Array(24))).toThrow('Invalid SND signature');
  });
});

type TestSample = { group: number; index: number; bytes: Uint8Array };

function makeSnd(samples: TestSample[]): Uint8Array {
  const offsets: number[] = [];
  let size = 512;
  for (const sample of samples) {
    offsets.push(size);
    size += 16 + sample.bytes.byteLength;
  }

  const bytes = new Uint8Array(size);
  bytes.set(Array.from('ElecbyteSnd\0').map((value) => value.charCodeAt(0)), 0);
  bytes.set([1, 0, 0, 0], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, samples.length, true);
  view.setUint32(20, samples.length > 0 ? offsets[0] : 0, true);

  samples.forEach((sample, position) => {
    const offset = offsets[position];
    view.setUint32(offset, offsets[position + 1] ?? 0, true);
    view.setUint32(offset + 4, sample.bytes.byteLength, true);
    view.setInt32(offset + 8, sample.group, true);
    view.setInt32(offset + 12, sample.index, true);
    bytes.set(sample.bytes, offset + 16);
  });
  return bytes;
}

function waveBytes(marker: number): Uint8Array {
  return new Uint8Array([82, 73, 70, 70, marker, 0, 0, 0, 87, 65, 86, 69]);
}
