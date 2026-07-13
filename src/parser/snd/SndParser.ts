import { sndSampleKey, type SndDiagnostic, type SndDocument, type SndSample } from './SndTypes';

const SND_SIGNATURE = 'ElecbyteSnd\0';
const HEADER_SIZE = 24;
const SUBFILE_HEADER_SIZE = 16;

export class SndParseError extends Error {}

export function parseSndV1(input: ArrayBuffer | Uint8Array): SndDocument {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength < HEADER_SIZE) throw new SndParseError('SND header is truncated.');
  if (readAscii(bytes, 0, 12) !== SND_SIGNATURE) throw new SndParseError('Invalid SND signature.');

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version: [number, number, number, number] = [bytes[12], bytes[13], bytes[14], bytes[15]];
  const declaredSampleCount = view.getUint32(16, true);
  const firstSubfileOffset = view.getUint32(20, true);
  const samples: SndSample[] = [];
  const samplesByKey = new Map<string, SndSample>();
  const diagnostics: SndDiagnostic[] = [];
  const visitedOffsets = new Set<number>();

  let offset = firstSubfileOffset;
  while (offset !== 0 && samples.length < declaredSampleCount) {
    if (visitedOffsets.has(offset) || offset + SUBFILE_HEADER_SIZE > bytes.byteLength) {
      diagnostics.push({ code: 'invalid_subfile', message: `Invalid SND subfile offset ${offset}.`, offset });
      break;
    }
    visitedOffsets.add(offset);

    const nextOffset = view.getUint32(offset, true);
    const length = view.getUint32(offset + 4, true);
    const group = view.getInt32(offset + 8, true);
    const index = view.getInt32(offset + 12, true);
    const dataOffset = offset + SUBFILE_HEADER_SIZE;
    const dataEnd = dataOffset + length;
    if (dataEnd > bytes.byteLength) {
      diagnostics.push({ code: 'invalid_subfile', message: `SND sample ${group},${index} exceeds the archive bounds.`, group, index, offset });
      break;
    }

    const payload = bytes.slice(dataOffset, dataEnd);
    const format = detectFormat(payload);
    const sample: SndSample = { group, index, bytes: payload, sourceOffset: offset, format };
    samples.push(sample);

    const key = sndSampleKey(group, index);
    if (samplesByKey.has(key)) {
      diagnostics.push({ code: 'duplicate_sample', message: `Duplicate SND sample ${key}; lookup keeps the first archive entry.`, group, index, offset });
    } else {
      samplesByKey.set(key, sample);
    }

    if (format === 'empty') diagnostics.push({ code: 'empty_sample', message: `SND sample ${key} has a zero-byte payload.`, group, index, offset });
    if (format === 'unknown') diagnostics.push({ code: 'unknown_format', message: `SND sample ${key} is not a RIFF/WAVE payload.`, group, index, offset });

    offset = nextOffset;
  }

  return { version, declaredSampleCount, firstSubfileOffset, samples, samplesByKey, diagnostics };
}

function detectFormat(bytes: Uint8Array): SndSample['format'] {
  if (bytes.byteLength === 0) return 'empty';
  return bytes.byteLength >= 12 && readAscii(bytes, 0, 4) === 'RIFF' && readAscii(bytes, 8, 4) === 'WAVE'
    ? 'wave'
    : 'unknown';
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}
