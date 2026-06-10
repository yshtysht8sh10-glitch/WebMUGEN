import { describe, expect, it } from 'vitest';
import { parseCnsText } from './CnsParser';

describe('parseCnsText', () => {
  it('parses StateDef and ChangeState controller', () => {
    const document = parseCnsText(`
[StateDef 0]
type = S
movetype = I
physics = S
anim = 0
ctrl = 1

[State 0, Walk]
type = ChangeState
trigger1 = command = "holdfwd"
value = 20
ctrl = 1
`);

    expect(document.states).toHaveLength(1);
    expect(document.states[0].stateNo).toBe(0);
    expect(document.states[0].stateType).toBe('S');
    expect(document.states[0].moveType).toBe('I');
    expect(document.states[0].physics).toBe('S');
    expect(document.states[0].initialAnim).toBe(0);
    expect(document.states[0].ctrl).toBe(true);

    expect(document.states[0].controllers).toHaveLength(1);
    expect(document.states[0].controllers[0].type).toBe('ChangeState');
    expect(document.states[0].controllers[0].triggers[0].expression).toBe(
      'command = "holdfwd"',
    );
    expect(document.states[0].controllers[0].params.value).toBe(20);
  });

  it('parses comma separated values', () => {
    const document = parseCnsText(`
[StateDef 200]

[State 200, Hit]
type = HitDef
trigger1 = time = 0
damage = 30, 5
ground.velocity = -4, -2
`);

    const controller = document.states[0].controllers[0];

    expect(controller.type).toBe('HitDef');
    expect(controller.params.damage).toEqual([30, 5]);
    expect(controller.params['ground.velocity']).toEqual([-4, -2]);
  });

  it('ignores comments', () => {
    const document = parseCnsText(`
; comment
[StateDef 0] ; state def
type = S ; standing
`);

    expect(document.states).toHaveLength(1);
    expect(document.states[0].stateType).toBe('S');
  });
});
