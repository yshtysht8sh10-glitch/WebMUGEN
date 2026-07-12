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

  it('parses triggerall controllers used by CMD Statedef -1', () => {
    const doc = parseCnsText(`
[Statedef -1]

[State -1, Special]
type = ChangeState
triggerall = command = "QCF_x"
trigger1 = statetype = S
trigger1 = ctrl
value = 1000
`);

    expect(doc.states[0].stateNo).toBe(-1);
    expect(doc.states[0].controllers[0].triggers).toEqual([
      { name: 'triggerall', expression: 'command = "QCF_x"' },
      { name: 'trigger1', expression: 'statetype = S' },
      { name: 'trigger1', expression: 'ctrl' },
    ]);
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

  it('parses StateDef poweradd header value', () => {
    const doc = parseCnsText(`
[StateDef 200]
type = S
movetype = A
physics = S
anim = 200
poweradd = 20
`);

    expect(doc.states[0].powerAdd).toBe(20);
  });

  it('parses StateDef facep2 header value', () => {
    const doc = parseCnsText(`
[StateDef 210]
type = S
movetype = A
physics = S
anim = 210
facep2 = 1
`);

    expect(doc.states[0].faceP2).toBe(true);
  });

  it('parses StateDef juggle header value', () => {
    const doc = parseCnsText(`
[StateDef 220]
type = S
movetype = A
physics = S
anim = 220
juggle = 6
`);

    expect(doc.states[0].juggle).toBe(6);
  });

  it('parses StateDef HitDef and move-hit persistence flags', () => {
    const doc = parseCnsText(`
[Statedef 200]
hitdefpersist = 1
movehitpersist = 0
hitcountpersist = 1
`);
    expect(doc.states[0]).toMatchObject({
      hitDefPersist: true,
      moveHitPersist: false,
      hitCountPersist: true,
    });
  });

  it('keeps commas inside HitDef expressions while splitting parameter pairs', () => {
    const doc = parseCnsText(`
[StateDef 200]
type = S
[State 200, Hit]
type = HitDef
trigger1 = 1
damage = ifelse(var(0), 80, 40), var(1) + 5
ground.velocity = ifelse(facing = 1, -4, 4), -2
`);

    expect(doc.states[0].controllers[0].params.damage).toEqual(['ifelse(var(0), 80, 40)', 'var(1) + 5']);
    expect(doc.states[0].controllers[0].params['ground.velocity']).toEqual(['ifelse(facing = 1, -4, 4)', -2]);
  });

  it('records source file and line numbers when provided', () => {
    const doc = parseCnsText(`
[StateDef 240]
type = S

[State 240, Follow]
type = ChangeState
value = 241
`, { sourceFile: 'char.cns' });

    expect(doc.states[0]).toMatchObject({ sourceFile: 'char.cns', sourceLine: 2 });
    expect(doc.states[0].controllers[0]).toMatchObject({ sourceFile: 'char.cns', sourceLine: 5 });
  });
});
