export type MugenTextEncoding = 'utf-8' | 'utf-16le' | 'utf-16be' | 'shift_jis';

export type DecodedMugenText = {
  encoding: MugenTextEncoding;
  text: string;
};

export function decodeMugenText(bytes: Uint8Array | ArrayBuffer): string {
  return decodeMugenTextWithEncoding(bytes).text;
}

export function decodeMugenTextWithEncoding(source: Uint8Array | ArrayBuffer): DecodedMugenText {
  const bytes = source instanceof Uint8Array ? source : new Uint8Array(source);

  if (startsWith(bytes, [0xef, 0xbb, 0xbf])) {
    return { encoding: 'utf-8', text: new TextDecoder('utf-8').decode(bytes.subarray(3)) };
  }
  if (startsWith(bytes, [0xff, 0xfe])) {
    return { encoding: 'utf-16le', text: new TextDecoder('utf-16le').decode(bytes.subarray(2)) };
  }
  if (startsWith(bytes, [0xfe, 0xff])) {
    return { encoding: 'utf-16be', text: new TextDecoder('utf-16be').decode(bytes.subarray(2)) };
  }

  try {
    return {
      encoding: 'utf-8',
      text: new TextDecoder('utf-8', { fatal: true }).decode(bytes),
    };
  } catch {
    return {
      encoding: 'shift_jis',
      text: new TextDecoder('shift_jis').decode(bytes),
    };
  }
}

function startsWith(bytes: Uint8Array, prefix: readonly number[]): boolean {
  return bytes.length >= prefix.length && prefix.every((byte, index) => bytes[index] === byte);
}
