import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseAirText } from '../../parser/air/AirParser';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { parseSndV1 } from '../../parser/snd/SndParser';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { createInitialGameState } from '../engine/GameState';
import type { GameState, HitEvent } from '../engine/types';
import { applyHitEffectRuntime } from '../hitdef/HitEffectRuntime';

describe('real character HitDef effect integration', () => {
  it('evaluates T-H-M-A scoped expressions and routes State 200 hit/guard assets', () => {
    const parsed = parseCnsText(readFileSync('public/chars/T-H-M-A/T-H-M-A/T-H-M-A.cns', 'utf8'));
    const state200 = parsed.states.find((state) => state.stateNo === 200
      && state.controllers.some((controller) => controller.type.toLowerCase() === 'hitdef'));
    expect(state200).toBeDefined();
    const cns = {
      metadataSections: parsed.metadataSections,
      states: [{
        ...state200!,
        controllers: state200!.controllers
          .filter((controller) => controller.type.toLowerCase() === 'hitdef')
          .map((controller) => ({ ...controller, triggers: [{ name: 'trigger1', expression: '1' }] })),
      }],
    };
    const air = parseAirText(readFileSync('public/chars/T-H-M-A/T-H-M-A/T-H-M-A.air', 'utf8'));
    const sounds = parseSndV1(readFileSync('public/chars/T-H-M-A/T-H-M-A/T-H-M-A.snd'));
    const initial = createInitialGameState();
    const activated = stepCnsStateRuntime({
      ...initial,
      players: [{ ...initial.players[0], stateNo: 200, animNo: 200 }, initial.players[1]],
    }, cns).state;
    const hitDef = activated.players[0].activeHitDef;
    expect(hitDef).toMatchObject({
      spark: { animNo: 16100, scope: 'attacker' },
      guardSpark: { animNo: 16000, scope: 'attacker' },
      hitSound: { group: 200, index: 0, scope: 'attacker' },
      guardSound: { group: 645, index: 1, scope: 'attacker' },
    });

    const normal = applyHitEffectRuntime(withContact(activated, {
      attackerId: 1, defenderId: 2, damage: 50,
      spark: { ...hitDef!.spark!, x: 300, y: 210 }, sound: hitDef!.hitSound,
    }), { ownerAir: () => air, ownerSounds: () => sounds });
    expect(normal.state.explods.entries[0]).toMatchObject({ animationSource: 'owner', animNo: 16100, effectKind: 'hit-spark' });
    expect(normal.soundEvents[0]).toMatchObject({ scope: 'character', group: 200, index: 0 });

    const guarded = applyHitEffectRuntime(withContact(activated, {
      attackerId: 1, defenderId: 2, damage: 10, guarded: true,
      spark: { ...hitDef!.guardSpark!, x: 294, y: 214 }, sound: hitDef!.guardSound,
    }), { ownerAir: () => air, ownerSounds: () => sounds });
    expect(guarded.state.explods.entries[0]).toMatchObject({ animNo: 16000, position: { x: 294, y: 214 } });
    expect(guarded.soundEvents[0]).toMatchObject({ group: 645, index: 1 });
  });
});

function withContact(state: GameState, event: HitEvent): GameState {
  return { ...state, frame: 20, hitEvents: [event], explods: { entries: [], nextRuntimeId: 1 } };
}
