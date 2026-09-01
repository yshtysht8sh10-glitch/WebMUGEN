export type SffFormat = 'SFF_V1' | 'SFF_V2';

export type SffFormatDetection = {
  format: SffFormat;
  version: string;
  parser: 'SffV1Parser' | 'SffV2Parser';
};

export function detectSffFormat(buffer: ArrayBuffer): SffFormatDetection {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 16) throw new Error('SFF header is truncated.');
  const signature = String.fromCharCode(...bytes.subarray(0, 12));
  if (signature !== 'ElecbyteSpr\0') throw new Error('Invalid SFF signature.');
  const major = bytes[15];
  const minor = bytes[14];
  const patch = bytes[13];
  const revision = bytes[12];
  const version = `${major}.${minor}.${patch}.${revision}`;
  if (major === 1) return { format: 'SFF_V1', version, parser: 'SffV1Parser' };
  if (major === 2) return { format: 'SFF_V2', version, parser: 'SffV2Parser' };
  throw new Error(`Unsupported SFF version ${version}.`);
}
