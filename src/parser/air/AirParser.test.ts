import { describe, expect, it } from 'vitest';
import { parseAirText } from './AirParser';

describe('AirParser', () => {
  it('parses Begin Action without brackets', () => {
    const doc = parseAirText(`
Begin Action 20
20,0, 0,0, 4
20,1, 0,0, 4
`);

    expect(doc.actions[0].actionNo).toBe(20);
    expect(doc.actions[0].elements).toHaveLength(2);
  });

  it('parses bracketed Begin Action used by KFM', () => {
    const doc = parseAirText(`
[Begin Action 000]
Clsn2Default: 2
 Clsn2[0] = -13,  0, 16,-79
 Clsn2[1] =   5,-79, -7,-93
0,0, 0,0, 10
0,1, 0,0, 7
`);

    expect(doc.actions[0].actionNo).toBe(0);
    expect(doc.actions[0].elements).toHaveLength(2);
    expect(doc.actions[0].elements[0].groupNo).toBe(0);
    expect(doc.actions[0].elements[0].imageNo).toBe(0);
    expect(doc.actions[0].elements[0].clsn2).toHaveLength(2);
    expect(doc.actions[0].elements[0].clsn2[0]).toEqual({
      left: -13,
      top: -79,
      right: 16,
      bottom: 0,
    });
  });

  it('parses LoopStart', () => {
    const doc = parseAirText(`
[Begin Action 10]
10,0, 0,0, 5
LoopStart
10,1, 0,0, 5
`);

    expect(doc.actions[0].loopStartIndex).toBe(1);
  });

  it('parses temporary Clsn blocks without leaking to later elements', () => {
    const doc = parseAirText(`
[Begin Action 200]
Clsn2Default: 1
 Clsn2[0] = -16,-78,16,0
200,0, 0,0, 4
Clsn1: 1
 Clsn1[0] = 22,-52,70,-38
200,1, 0,0, 8
200,2, 0,0, 4
`);

    expect(doc.actions[0].elements[0].clsn2).toHaveLength(1);
    expect(doc.actions[0].elements[1].clsn1).toHaveLength(1);
    expect(doc.actions[0].elements[2].clsn1).toHaveLength(0);
    expect(doc.actions[0].elements[2].clsn2).toHaveLength(1);
  });

  it('parses the seventh AIR element field as transparency blending', () => {
    const doc = parseAirText(`
[Begin Action 3301]
999, 6, 0, 0, -1, , A
999, 7, 0, 0, 1, H, AS128D128
`);

    expect(doc.actions[0].elements[0]).toMatchObject({ flip: '', blend: 'A' });
    expect(doc.actions[0].elements[1]).toMatchObject({ flip: 'H', blend: 'AS128D128' });
  });
});
