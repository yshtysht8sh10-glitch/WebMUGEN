export function decodeSffV2Rle8(data: Uint8Array, expectedPixels: number): Uint8Array {
  if (data.length < 4) throw new Error('SFF v2 RLE8 data is missing its decoded-length header.');
  const declaredPixels = new DataView(data.buffer, data.byteOffset, 4).getUint32(0, true);
  if (declaredPixels !== expectedPixels) {
    throw new Error(`SFF v2 RLE8 decoded length ${declaredPixels} does not match ${expectedPixels}.`);
  }
  const output = new Uint8Array(expectedPixels);
  let inputOffset = 4;
  let outputOffset = 0;
  while (outputOffset < output.length && inputOffset < data.length) {
    const value = data[inputOffset++];
    if ((value & 0xc0) === 0x40) {
      const runLength = value & 0x3f;
      if (runLength === 0 || inputOffset >= data.length || outputOffset + runLength > output.length) {
        throw new Error('SFF v2 RLE8 run is invalid or exceeds the decoded image.');
      }
      output.fill(data[inputOffset++], outputOffset, outputOffset + runLength);
      outputOffset += runLength;
    } else {
      output[outputOffset++] = value;
    }
  }
  if (outputOffset !== output.length) throw new Error(`SFF v2 RLE8 stream ended at ${outputOffset}/${output.length} pixels.`);
  return output;
}
