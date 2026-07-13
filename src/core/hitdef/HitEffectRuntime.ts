import { findAction } from '../animation/AnimationPlayer';
import type { SoundPlayEvent } from '../audio/SoundEvent';
import type { GameState, HitEvent } from '../engine/types';
import { applyExplodCreateEvents, type ExplodCreateEvent, type RuntimeEntityRef } from '../explod/ExplodSystem';
import type { AirDocument } from '../../parser/air/AirTypes';
import { findSndSample, type SndDocument } from '../../parser/snd/SndTypes';

export type HitEffectAssets = {
  ownerAir(ownerId: 1 | 2): AirDocument | null | undefined;
  ownerSounds(ownerId: 1 | 2): SndDocument | null | undefined;
  fightFxAir?: AirDocument | null;
  commonSounds?: SndDocument | null;
};

export type HitEffectRuntimeResult = {
  state: GameState;
  soundEvents: SoundPlayEvent[];
};

export function applyHitEffectRuntime(gameState: GameState, assets: HitEffectAssets): HitEffectRuntimeResult {
  let state = gameState;
  const soundEvents: SoundPlayEvent[] = [];
  const diagnostics: string[] = [];
  const hitEvents = gameState.hitEvents.map((event, index) => {
    let next = event;
    if (event.spark && !event.spark.runtimeIntegrated) {
      const spark = integrateSpark(state, event, assets, diagnostics, index);
      state = spark.state;
      next = { ...next, spark: { ...event.spark, available: spark.available, runtimeIntegrated: true } };
    }
    if (event.sound && !event.sound.runtimeIntegrated) {
      const sound = integrateSound(event, assets, diagnostics, index);
      if (sound.event) soundEvents.push(sound.event);
      next = { ...next, sound: { ...event.sound, available: sound.available, runtimeIntegrated: true } };
    }
    return next;
  });

  return {
    state: { ...state, hitEvents, hitDiagnosticLines: [...(state.hitDiagnosticLines ?? []), ...diagnostics] },
    soundEvents,
  };
}

function integrateSpark(
  state: GameState,
  event: HitEvent,
  assets: HitEffectAssets,
  diagnostics: string[],
  eventIndex: number,
): { state: GameState; available: boolean } {
  const spark = event.spark!;
  const scope = spark.scope === 'attacker' ? 'owner' : 'fightfx';
  if (spark.animNo < 0) {
    diagnostics.push(formatDiagnostic(event, eventIndex, `spark=${spark.scope}:${spark.animNo} result=noop reason=animation_disabled`));
    return { state, available: false };
  }
  const air = spark.scope === 'attacker' ? assets.ownerAir(event.attackerId) : assets.fightFxAir;
  if (!air) {
    diagnostics.push(formatDiagnostic(event, eventIndex, `spark=${spark.scope}:${spark.animNo} result=noop reason=${spark.scope === 'attacker' ? 'owner_air_missing' : 'fightfx_air_missing'}`));
    return { state, available: false };
  }
  if (!findAction(air, spark.animNo)) {
    diagnostics.push(formatDiagnostic(event, eventIndex, `spark=${spark.scope}:${spark.animNo} result=noop reason=animation_not_found`));
    return { state, available: false };
  }

  const owner: RuntimeEntityRef = { entityId: event.attackerId, rootPlayerId: event.attackerId };
  const create: ExplodCreateEvent = {
    type: 'create',
    request: {
      mugenId: 0,
      owner,
      animationOwner: scope === 'owner' ? owner : null,
      animationSource: scope,
      animNo: spark.animNo,
      position: { x: spark.x, y: spark.y },
      offset: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      acceleration: { x: 0, y: 0 },
      facing: state.players[event.attackerId - 1].facing,
      verticalFacing: 1,
      postype: 'none',
      coordinateSpace: 'stage',
      bind: null,
      removeTime: -2,
      spritePriority: 5,
      onTop: true,
      pauseMoveTime: 0,
      superMoveTime: 0,
      removeOnGetHit: false,
      random: { x: 0, y: 0 },
      render: {
        transparency: null,
        alpha: null,
        scaleX: 1,
        scaleY: 1,
        ownPalette: scope === 'fightfx',
        shadow: { red: 0, green: 0, blue: 0 },
      },
      effectKind: 'hit-spark',
    },
  };
  const created = applyExplodCreateEvents(state, [create]);
  const runtimeId = created.explods.nextRuntimeId - 1;
  diagnostics.push(formatDiagnostic(event, eventIndex, `spark=${spark.scope}:${spark.animNo} result=created internalId=${runtimeId} pos=(${spark.x},${spark.y})`));
  return { state: created, available: true };
}

function integrateSound(
  event: HitEvent,
  assets: HitEffectAssets,
  diagnostics: string[],
  eventIndex: number,
): { event: SoundPlayEvent | null; available: boolean } {
  const sound = event.sound!;
  const document = sound.scope === 'attacker' ? assets.ownerSounds(event.attackerId) : assets.commonSounds;
  if (!document) {
    diagnostics.push(formatDiagnostic(event, eventIndex, `sound=${sound.scope}:${sound.group},${sound.index} result=noop reason=${sound.scope === 'attacker' ? 'owner_snd_missing' : 'common_snd_missing'}`));
    return { event: null, available: false };
  }
  if (!findSndSample(document, sound.group, sound.index)) {
    diagnostics.push(formatDiagnostic(event, eventIndex, `sound=${sound.scope}:${sound.group},${sound.index} result=noop reason=sample_not_found`));
    return { event: null, available: false };
  }
  diagnostics.push(formatDiagnostic(event, eventIndex, `sound=${sound.scope}:${sound.group},${sound.index} result=queued`));
  return {
    available: true,
    event: {
      type: 'play',
      ownerId: event.attackerId,
      scope: sound.scope === 'attacker' ? 'character' : 'common',
      group: sound.group,
      index: sound.index,
      channel: null,
      volume: 100,
      volumeScale: 100,
      pan: 0,
      absolutePan: false,
      frequencyMultiplier: 1,
      loop: false,
    },
  };
}

function formatDiagnostic(event: HitEvent, eventIndex: number, result: string): string {
  return `raw.hit_effect_runtime event=${eventIndex} attacker=p${event.attackerId} target=p${event.defenderId} kind=${event.guarded ? 'guard' : 'hit'} ${result}`;
}
