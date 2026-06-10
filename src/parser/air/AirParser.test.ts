import { describe, expect, it } from 'vitest';
import { findAirAction, parseAirText } from './AirParser';

describe('parseAirText with Clsn', () => {
  it('parses action elements with empty collision boxes', () => {
    const document = parseAirText(`
Begin Action 20
20,0, 0,0, 4
20,1, 0,0, 4
`);
    const action = findAirAction(document, 20);
    expect(action?.elements[0].clsn1).toEqual([]);
    expect(action?.elements[0].clsn2).toEqual([]);
  });

  it('parses Clsn1Default and Clsn2Default', () => {
    const document = parseAirText(`
Begin Action 200
Clsn2Default: 1
 Clsn2[0] = -10,-78,10,0
Clsn1Default: 1
 Clsn1[0] = 15,-50,55,-40
200,0, 0,0, 3
`);
    const action = findAirAction(document, 200);
    expect(action?.defaultClsn2).toEqual([{ left: -10, top: -78, right: 10, bottom: 0 }]);
    expect(action?.defaultClsn1).toEqual([{ left: 15, top: -50, right: 55, bottom: -40 }]);
    expect(action?.elements[0].clsn2).toEqual([{ left: -10, top: -78, right: 10, bottom: 0 }]);
    expect(action?.elements[0].clsn1).toEqual([{ left: 15, top: -50, right: 55, bottom: -40 }]);
  });

  it('parses element-specific Clsn boxes', () => {
    const document = parseAirText(`
Begin Action 200
Clsn2Default: 1
 Clsn2[0] = -10,-78,10,0
200,0, 0,0, 3
Clsn1: 1
 Clsn1[0] = 20,-50,60,-40
200,1, 0,0, 3
`);
    const action = findAirAction(document, 200);
    expect(action?.elements[0].clsn1).toEqual([]);
    expect(action?.elements[1].clsn1).toEqual([{ left: 20, top: -50, right: 60, bottom: -40 }]);
    expect(action?.elements[1].clsn2).toEqual([{ left: -10, top: -78, right: 10, bottom: 0 }]);
  });
});
