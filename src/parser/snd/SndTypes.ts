export type SndSample = {
  group: number;
  index: number;
  bytes: Uint8Array;
  sourceOffset: number;
  format: 'wave' | 'unknown' | 'empty';
};

export type SndDiagnostic = {
  code: 'duplicate_sample' | 'empty_sample' | 'unknown_format' | 'invalid_subfile';
  message: string;
  group?: number;
  index?: number;
  offset?: number;
};

export type SndDocument = {
  version: [number, number, number, number];
  declaredSampleCount: number;
  firstSubfileOffset: number;
  samples: SndSample[];
  samplesByKey: ReadonlyMap<string, SndSample>;
  diagnostics: SndDiagnostic[];
};

export function sndSampleKey(group: number, index: number): string {
  return `${group},${index}`;
}

export function findSndSample(document: SndDocument, group: number, index: number): SndSample | null {
  return document.samplesByKey.get(sndSampleKey(group, index)) ?? null;
}
