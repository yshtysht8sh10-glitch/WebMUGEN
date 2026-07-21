import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import type { BgPalFxEvent } from '../palfx/BgPalFxSystem';
import { stepCnsStateRuntime } from './CnsStateRuntime';

describe('BGPalFX controller compatibility', () => {
  it('emits the State 3330 background-only palette effect', () => {
    const cns = parseCnsText(`
[StateDef 3330]
type=S
[State 3110, bgpalfx]
type=BGPalFX
trigger1=time=0
time=20
mul=0,0,0
invertall=-1
color=0
ignorehitpause=1
`);
    const initial = createInitialGameState();
    const events: BgPalFxEvent[] = [];
    const result = stepCnsStateRuntime({
      ...initial,
      players: [{ ...initial.players[0], stateNo: 3330 }, initial.players[1]],
    }, cns, { onBgPalFx: (event) => events.push(event) });

    expect(events).toEqual([expect.objectContaining({
      duration: 20,
      color: 0,
      invertAll: true,
      multiply: { red: 0, green: 0, blue: 0 },
      ownerEntityId: 1,
    })]);
    expect(result.traces[0].executedControllers).toContain('BGPalFX');
  });

  it('preserves the production T-H-M-A State 3330 values', async () => {
    const bytes = await readFile('public/chars/T-H-M-A/T-H-M-A/T-H-M-Atyouhi.cns');
    const cns = parseCnsText(new TextDecoder('shift_jis').decode(bytes));
    const initial = createInitialGameState();
    const events: BgPalFxEvent[] = [];

    stepCnsStateRuntime({
      ...initial,
      players: [{ ...initial.players[0], stateNo: 3330, stateTime: 0, animNo: 3330 }, initial.players[1]],
    }, cns, { onBgPalFx: (event) => events.push(event) });

    expect(events).toContainEqual(expect.objectContaining({
      duration: 20,
      color: 0,
      invertAll: true,
      multiply: { red: 0, green: 0, blue: 0 },
    }));
  });
});
