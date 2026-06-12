import { describe, expect, it } from 'vitest';
import { parseCnsText } from './CnsParser';

describe('CnsParser', () => {
  it('parses StateDef and State controllers', () => {
    const doc = parseCnsText(`
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

    expect(doc.states).toHaveLength(1);
    expect(doc.states[0]).toMatchObject({
      stateNo: 0,
      stateType: 'S',
      moveType: 'I',
      physics: 'S',
      initialAnim: 0,
      ctrl: true,
    });
    expect(doc.states[0].controllers[0].type).toBe('ChangeState');
    expect(doc.states[0].controllers[0].triggers[0].expression).toBe('command = "holdfwd"');
  });

  it('allows metadata sections before StateDef', () => {
    const doc = parseCnsText(`
[Data]
life = 1000
attack = 100

[Size]
xscale = 1
yscale = 1

[StateDef 0]
type = S
movetype = I
physics = S
anim = 0
ctrl = 1
`);

    expect(doc.metadataSections).toHaveLength(2);
    expect(doc.metadataSections[0]).toEqual({
      name: 'Data',
      values: {
        life: 1000,
        attack: 100,
      },
    });
    expect(doc.metadataSections[1].values.xscale).toBe(1);
    expect(doc.states[0].stateNo).toBe(0);
  });

  it('ignores loose key-value pairs outside sections', () => {
    const doc = parseCnsText(`
; loose data sometimes appears in real-world files
author = somebody

[StateDef 0]
type = S
movetype = I
physics = S
anim = 0
ctrl = 1
`);

    expect(doc.states).toHaveLength(1);
    expect(doc.metadataSections).toHaveLength(0);
  });

  it('parses comma separated numeric values', () => {
    const doc = parseCnsText(`
[StateDef 200]
type = S
movetype = A
physics = S
anim = 200
ctrl = 0

[State 200, Hit]
type = HitDef
trigger1 = time = 0
damage = 80, 10
ground.velocity = -4, 0
`);

    expect(doc.states[0].controllers[0].params.damage).toEqual([80, 10]);
    expect(doc.states[0].controllers[0].params['ground.velocity']).toEqual([-4, 0]);
  });
});
