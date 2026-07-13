import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { parseAirText } from '../../parser/air/AirParser';
import { applyExplodCreateEvents, stepExplodRuntime, type ExplodCreateEvent } from '../explod/ExplodSystem';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';

describe('real character Explod production integration', () => {
  it('creates KFM State 191 wood through CNS into GameState with evaluated coordinates', async () => {
    const cns = parseCnsText(await readFile('public/chars/kfm/kfm.cns', 'utf8'));
    const air = parseAirText(await readFile('public/chars/kfm/kfm.air', 'utf8'));
    const initial = createInitialGameState();
    const events: ExplodCreateEvent[] = [];
    const cnsResult = stepCnsStateRuntime({
      ...initial,
      players: [{ ...initial.players[0], stateNo: 191 }, initial.players[1]],
    }, cns, { onExplodCreate: (event) => events.push(event) });
    const result = applyExplodCreateEvents(cnsResult.state, events);
    const wood = result.explods.entries.find((entry) => entry.owner.entityId === 1 && entry.animNo === 191);
    expect(wood).toMatchObject({
      runtimeId: 1, mugenId: 0, postype: 'p1', position: { x: 480, y: 195 },
      velocity: { x: -4.2, y: -7 }, acceleration: { x: 0, y: 0.32 }, removeTime: 48,
    });
    expect(result.hitDiagnosticLines?.join('\n')).toContain('raw.explod_create owner=p1 internalId=1 mugenId=0');

    let stepped = stepExplodRuntime(result, () => air);
    for (let frame = 1; frame < 48; frame += 1) stepped = stepExplodRuntime({ ...stepped, frame }, () => air);
    expect(stepped.explods.entries.find((entry) => entry.runtimeId === 1)).toMatchObject({ age: 47, animTime: 47 });
    stepped = stepExplodRuntime({ ...stepped, frame: 48 }, () => air);
    expect(stepped.explods.entries.find((entry) => entry.runtimeId === 1)).toBeUndefined();
    expect(stepped.hitDiagnosticLines?.join('\n')).toContain('reason=removetime age=48');
  });
});
