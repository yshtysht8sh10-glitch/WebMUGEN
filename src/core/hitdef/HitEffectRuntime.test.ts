import { describe, expect, it } from 'vitest';
import { parseAirText } from '../../parser/air/AirParser';
import type { SndDocument, SndSample } from '../../parser/snd/SndTypes';
import { createInitialGameState } from '../engine/GameState';
import type { GameState, HitEvent } from '../engine/types';
import { createInitialHitFeedbackState, updateHitFeedback } from '../engine/HitFeedback';
import { applyExplodRemoveEvents } from '../explod/ExplodSystem';
import { resolveExplodRenderFrames } from '../../renderer/canvas2d/ExplodRender';
import { applyHitEffectRuntime } from './HitEffectRuntime';

const ownerAir = parseAirText(`
[Begin Action 10]
10,0,0,0,2
[Begin Action 20]
20,0,0,0,2
`);
const commonAir = parseAirText('[Begin Action 40]\n40,0,0,0,2');
const ownerSounds = soundDocument([[1, 2], [3, 4]]);
const commonSounds = soundDocument([[5, 6]]);

describe('HitDef shared effect runtime', () => {
  it('routes one normal hit spark through Explod and one hitsound through SoundPlayEvent', () => {
    const result = applyHitEffectRuntime(withEvents([hitEvent({
      spark: { animNo: 10, scope: 'attacker', x: 301, y: 202, coordinateSpace: 'stage' },
      sound: { group: 1, index: 2, scope: 'attacker' },
    })]), assets());

    expect(result.state.explods.entries).toHaveLength(1);
    expect(result.state.explods.entries[0]).toMatchObject({
      effectKind: 'hit-spark', animationSource: 'owner', animNo: 10,
      position: { x: 301, y: 202 }, removeTime: -2, onTop: true,
    });
    expect(result.soundEvents).toEqual([expect.objectContaining({
      type: 'play', ownerId: 1, scope: 'character', group: 1, index: 2, channel: null,
    })]);
    expect(result.state.hitEvents[0]).toMatchObject({
      spark: { available: true, runtimeIntegrated: true },
      sound: { available: true, runtimeIntegrated: true },
    });
    expect(result.state.hitDiagnosticLines?.join('\n')).toContain('kind=hit spark=attacker:10 result=created');
  });

  it('keeps guard spark and guardsound selection separate', () => {
    const result = applyHitEffectRuntime(withEvents([hitEvent({
      guarded: true,
      spark: { animNo: 20, scope: 'attacker', x: 280, y: 210, coordinateSpace: 'stage' },
      sound: { group: 3, index: 4, scope: 'attacker' },
    })]), assets());
    expect(result.state.explods.entries[0]).toMatchObject({ animNo: 20, position: { x: 280, y: 210 } });
    expect(result.soundEvents[0]).toMatchObject({ group: 3, index: 4 });
    expect(result.state.hitDiagnosticLines?.join('\n')).toContain('kind=guard');
  });

  it('selects common fightfx AIR and common SND for unprefixed or F-scoped effects', () => {
    const result = applyHitEffectRuntime(withEvents([hitEvent({
      spark: { animNo: 40, scope: 'common', x: 300, y: 200, coordinateSpace: 'stage' },
      sound: { group: 5, index: 6, scope: 'common' },
    })]), assets());
    expect(result.state.explods.entries[0]).toMatchObject({ animationSource: 'fightfx', animationOwner: null, animNo: 40 });
    expect(result.soundEvents[0]).toMatchObject({ scope: 'common', group: 5, index: 6 });
  });

  it('diagnoses missing/disabled assets without creating effects or sound events', () => {
    const result = applyHitEffectRuntime(withEvents([
      hitEvent({ spark: { animNo: 999, scope: 'attacker', x: 0, y: 0, coordinateSpace: 'stage' }, sound: { group: 9, index: 9, scope: 'attacker' } }),
      hitEvent({ spark: { animNo: 40, scope: 'common', x: 0, y: 0, coordinateSpace: 'stage' }, sound: { group: 5, index: 6, scope: 'common' } }),
      hitEvent({ spark: { animNo: -1, scope: 'common', x: 0, y: 0, coordinateSpace: 'stage' } }),
    ]), { ownerAir: () => ownerAir, ownerSounds: () => ownerSounds, fightFxAir: null, commonSounds: null });
    expect(result.state.explods.entries).toHaveLength(0);
    expect(result.soundEvents).toHaveLength(0);
    const diagnostics = result.state.hitDiagnosticLines?.join('\n') ?? '';
    expect(diagnostics).toContain('reason=animation_not_found');
    expect(diagnostics).toContain('reason=sample_not_found');
    expect(diagnostics).toContain('reason=fightfx_air_missing');
    expect(diagnostics).toContain('reason=common_snd_missing');
    expect(diagnostics).toContain('reason=animation_disabled');
  });

  it('is idempotent per HitEvent and excludes hit sparks from RemoveExplod ID selection', () => {
    const first = applyHitEffectRuntime(withEvents([hitEvent({
      spark: { animNo: 10, scope: 'attacker', x: 301, y: 202, coordinateSpace: 'stage' },
      sound: { group: 1, index: 2, scope: 'attacker' },
    })]), assets());
    const second = applyHitEffectRuntime(first.state, assets());
    expect(second.state.explods.entries).toHaveLength(1);
    expect(second.soundEvents).toHaveLength(0);
    const removed = applyExplodRemoveEvents(second.state, [{
      type: 'remove', owner: { entityId: 1, rootPlayerId: 1 }, mugenId: 0,
    }]);
    expect(removed.explods.entries).toHaveLength(1);
    expect(removed.hitDiagnosticLines?.join('\n')).toContain('id=0 matched=0 internalIds=[-] reason=not_found');
  });

  it('resolves the created spark for same-frame Explod rendering', () => {
    const result = applyHitEffectRuntime(withEvents([hitEvent({
      spark: { animNo: 10, scope: 'attacker', x: 321, y: 198, coordinateSpace: 'stage' },
    })]), assets());
    const rendered = resolveExplodRenderFrames(result.state, {}, { 1: { airDocument: ownerAir } }, { airDocument: commonAir });
    expect(rendered.frames[0]).toMatchObject({ screenX: 321, screenY: 198, entry: { effectKind: 'hit-spark', animNo: 10 } });
    expect(rendered.diagnosticLines.join('\n')).toContain('result=resolved');
    expect(updateHitFeedback(createInitialHitFeedbackState(), result.state).sparks).toHaveLength(0);
  });
});

function assets() {
  return { ownerAir: () => ownerAir, ownerSounds: () => ownerSounds, fightFxAir: commonAir, commonSounds };
}

function withEvents(hitEvents: HitEvent[]): GameState {
  return { ...createInitialGameState(), frame: 12, hitEvents };
}

function hitEvent(overrides: Partial<HitEvent>): HitEvent {
  return { attackerId: 1, defenderId: 2, damage: 20, ...overrides };
}

function soundDocument(keys: Array<[number, number]>): SndDocument {
  const samples = keys.map(([group, index], sourceOffset): SndSample => ({
    group, index, bytes: new Uint8Array([82, 73, 70, 70]), sourceOffset, format: 'wave',
  }));
  return {
    version: [1, 0, 0, 0], declaredSampleCount: samples.length, firstSubfileOffset: 0,
    samples, samplesByKey: new Map(samples.map((sample) => [`${sample.group},${sample.index}`, sample])), diagnostics: [],
  };
}
