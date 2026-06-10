import { describe, expect, it } from 'vitest';
import { findAirAction, parseAirText } from './AirParser';

describe('parseAirText', () => {
  it('parses Begin Action and elements', () => {
    const document = parseAirText(`
; stand
Begin Action 0
0,0, 0,0, 5

Begin Action 20
20,0, 0,0, 4
20,1, 0,0, 4
20,2, 0,0, 4
`);

    expect(document.actions).toHaveLength(2);

    const walk = findAirAction(document, 20);
    expect(walk?.elements).toHaveLength(3);
    expect(walk?.elements[1]).toEqual({
      groupNo: 20,
      imageNo: 1,
      offsetX: 0,
      offsetY: 0,
      duration: 4,
      flip: undefined,
      blend: undefined,
    });
  });

  it('ignores comments and invalid lines', () => {
    const document = parseAirText(`
Begin Action 200
200,0, 0,0, 3 ; punch start
invalid
200,1, 1,2, 6
`);

    const action = findAirAction(document, 200);
    expect(action?.elements).toHaveLength(2);
    expect(action?.elements[1].offsetX).toBe(1);
    expect(action?.elements[1].offsetY).toBe(2);
  });
});
