import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { parseAirText } from '../../parser/air/AirParser';
import { applyExplodCreateEvents, stepExplodRuntime, type ExplodCreateEvent } from '../explod/ExplodSystem';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';

describe('real character Explod production integration', () => {
  it('retains T-H-M-A State 3300 Explod pause allowances and State 3310 AfterImage parameters', async () => {
    const bytes = await readFile('public/chars/T-H-M-A/T-H-M-A/T-H-M-Atyouhi.cns');
    const cns = parseCnsText(new TextDecoder('shift_jis').decode(bytes));
    const state3300 = cns.states.find((state) => state.stateNo === 3300);
    const state3310 = cns.states.find((state) => state.stateNo === 3310);
    const explods = state3300?.controllers.filter((controller) => controller.type.toLowerCase() === 'explod') ?? [];
    const afterImage = state3310?.controllers.find((controller) => controller.type.toLowerCase() === 'afterimage');

    expect(explods).toHaveLength(2);
    expect(explods).toEqual(expect.arrayContaining([
      expect.objectContaining({ params: expect.objectContaining({ supermovetime: 9999999, pausemovetime: 9999999 }) }),
    ]));
    expect(afterImage?.params).toMatchObject({
      time: 42,
      timegap: 1,
      framegap: 6,
      trans: 'add1',
    });

    const initial = createInitialGameState();
    const events: ExplodCreateEvent[] = [];
    stepCnsStateRuntime({
      ...initial,
      players: [{ ...initial.players[0], stateNo: 3300, stateTime: 10, animNo: 3300 }, initial.players[1]],
    }, cns, {
      getAnimationTriggerInfo: () => ({ elementNo: 6, elementTime: 0, elementStarted: true, elementCount: 6, elementTimes: [0, 0, 0, 0, 0, 0] }),
      onExplodCreate: (event) => events.push(event),
    });
    expect(events).toHaveLength(2);
    expect(events.map((event) => event.request)).toEqual(expect.arrayContaining([
      expect.objectContaining({ velocity: { x: 1.3, y: 0 }, superMoveTime: 9999999, pauseMoveTime: 9999999 }),
      expect.objectContaining({ velocity: { x: -1.3, y: 0 }, superMoveTime: 9999999, pauseMoveTime: 9999999 }),
    ]));
  });
  it('retains T-H-M-A Action 3301 additive AIR blending', async () => {
    const bytes = await readFile('public/chars/T-H-M-A/T-H-M-A/T-H-M-A.air');
    const air = parseAirText(new TextDecoder('shift_jis').decode(bytes));
    const action = air.actions.find((candidate) => candidate.actionNo === 3301);

    expect(action?.elements[0]).toMatchObject({ groupNo: 999, imageNo: 6, duration: -1, flip: '', blend: 'A' });
  });
  it('creates KFM State 191 wood through CNS into GameState with evaluated coordinates', async () => {
    const cns = parseCnsText(await readFile('public/chars/kfm/kfm.cns', 'utf8'));
    const air = parseAirText(await readFile('public/chars/kfm/kfm.air', 'utf8'));
    const initial = createInitialGameState();
    const events: ExplodCreateEvent[] = [];
    const cnsResult = stepCnsStateRuntime({
      ...initial,
      players: [{ ...initial.players[0], stateNo: 191, animTime: 1 }, initial.players[1]],
    }, cns, { onExplodCreate: (event) => events.push(event) });
    const result = applyExplodCreateEvents(cnsResult.state, events);
    const wood = result.explods.entries.find((entry) => entry.owner.entityId === 1 && entry.animNo === 191);
    expect(wood).toMatchObject({
      runtimeId: 1, mugenId: 0, postype: 'p1', position: { x: 480, y: 195 },
      velocity: { x: -4.2, y: -7 }, acceleration: { x: 0, y: 0.32 }, removeTime: 48,
    });
    expect(result.hitDiagnosticLines?.join('\n')).toContain('raw.explod_create owner=p1 internalId=1 mugenId=0');

    let stepped = stepExplodRuntime(result, () => air);
    stepped = stepExplodRuntime({ ...stepped, frame: 1 }, () => air);
    expect(stepped.explods.entries.find((entry) => entry.animNo === 191)).toMatchObject({
      position: { x: 480, y: 195 }, velocity: { x: -4.2, y: -7 }, bind: null,
    });
    stepped = stepExplodRuntime({ ...stepped, frame: 2 }, () => air);
    expect(stepped.explods.entries.find((entry) => entry.animNo === 191)).toMatchObject({
      position: { x: 475.8, y: 188 }, velocity: { x: -4.2, y: -6.68 },
    });
    for (let frame = 3; frame < 48; frame += 1) stepped = stepExplodRuntime({ ...stepped, frame }, () => air);
    expect(stepped.explods.entries.find((entry) => entry.runtimeId === 1)).toMatchObject({ age: 47, animTime: 47 });
    stepped = stepExplodRuntime({ ...stepped, frame: 48 }, () => air);
    expect(stepped.explods.entries.find((entry) => entry.runtimeId === 1)).toBeUndefined();
    expect(stepped.hitDiagnosticLines?.join('\n')).toContain('reason=removetime age=48');
  });
});
