import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parseAirText } from '../../parser/air/AirParser';
import { findSffSprite, parseSffV1 } from '../../parser/sff/SffParser';

describe('T-H-M-A Action 44 regression', () => {
  it('parses Action 044 as 44 and resolves every referenced SFF sprite', async () => {
    const airBytes = await readFile('public/chars/T-H-M-A/T-H-M-A/T-H-M-A.air');
    const sffBytes = await readFile('public/chars/T-H-M-A/T-H-M-A/T-H-M-A.sff');
    const air = parseAirText(new TextDecoder('shift_jis').decode(airBytes));
    const sff = parseSffV1(
      sffBytes.buffer.slice(sffBytes.byteOffset, sffBytes.byteOffset + sffBytes.byteLength) as ArrayBuffer,
    );
    const action = air.actions.find((candidate) => candidate.actionNo === 44);

    expect(action?.elements.map((element) => [element.groupNo, element.imageNo])).toEqual([
      [40, 3],
      [40, 4],
      [40, 5],
      [40, 6],
    ]);
    for (const element of action!.elements) {
      expect(findSffSprite(sff, element.groupNo, element.imageNo)).toBeDefined();
    }
  });
});
