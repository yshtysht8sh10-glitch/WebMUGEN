import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parseAirText } from '../../parser/air/AirParser';
import { getMugenAnimEndTime } from '../animation/AnimationDuration';
import { advanceExternalCnsStateEntryFrame, enterCnsStateAndRunTimeZero, stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import type { SoundPlayEvent } from '../audio/SoundEvent';
import { applyPauseControllerEvents, createInitialPauseState, stepPauseState, type PauseControllerEvent } from '../pause/PauseSystem';
import { createInitialGameState } from '../engine/GameState';
import { resolveFallbackHits } from '../engine/FallbackHitResolver';
import type { ActiveHitDef, GameState, PlayerState } from '../engine/types';
import { loadCharacterFromDef, type CharacterAssetFetcher } from './CharacterLoader';

const collisionAir = parseAirText(`
[Begin Action 0]
Clsn2Default: 1
 Clsn2[0] = -20,-80,20,0
0,0, 0,0, 5
[Begin Action 200]
Clsn1: 1
 Clsn1[0] = 10,-60,70,-30
200,0, 0,0, 5
`);

const incomingHit: ActiveHitDef = {
  diagnosticId: 920,
  attr: { stateType: 'S', attackTypes: ['NA'] },
  damage: 80,
  guardDamage: 0,
  pauseTime: { attacker: 0, defender: 0 },
  groundVelocity: { x: 0, y: 0 },
  airVelocity: { x: 0, y: 0 },
};

describe('Issue #92 T-H-M-A blocking regression', () => {
  for (const defenderId of [1, 2] as const) {
    for (const facing of [1, -1] as const) {
      it(`registers State -1 blocking and enters State 902 for P${defenderId}, Facing ${facing}`, async () => {
        const defPath = 'public/chars/T-H-M-A/T-H-M-A/T-H-M-A.def';
        const assets = await loadCharacterFromDef(defPath, createThmaFileSystemFetcher(defPath));
        const initial = createInitialGameState();
        const attackerId = defenderId === 1 ? 2 : 1;
        const defender: PlayerState = {
          ...initial.players[defenderId - 1],
          x: defenderId === 1 ? 350 : 300,
          facing,
          stateNo: 0,
          animNo: 0,
          stateType: 'S',
          moveType: 'I',
          ctrl: true,
          vx: 3,
        };
        const attacker: PlayerState = {
          ...initial.players[attackerId - 1],
          x: defenderId === 1 ? 300 : 350,
          facing: defenderId === 1 ? 1 : -1,
          stateNo: 200,
          animNo: 200,
          moveType: 'A',
          activeHitDef: incomingHit,
        };
        const players = defenderId === 1 ? [defender, attacker] : [attacker, defender];
        const state: GameState = { ...initial, players: players as GameState['players'] };
        const emptyCns = { states: [], metadataSections: [] };
        const activated = stepCnsStateRuntime(state, assets.cns, {
          p1Commands: defenderId === 1 ? new Set(['fwd']) : new Set(),
          p2Commands: defenderId === 2 ? new Set(['fwd']) : new Set(),
          getCnsDocumentForPlayer: (id) => id === defenderId ? assets.cns : emptyCns,
        }).state;

        expect(activated.players[defenderId - 1].hitOverrides?.[0]).toMatchObject({
          attr: 'SA,AA,AP', stateNo: 902, remaining: 8,
        });
        const pauseEvents: PauseControllerEvent[] = [];
        const contactSounds: SoundPlayEvent[] = [];
        const blocked = resolveFallbackHits(activated, collisionAir, true, undefined,
          (player, opponent, stateNo) => advanceExternalCnsStateEntryFrame(enterCnsStateAndRunTimeZero(
            player,
            opponent,
            stateNo,
            assets.cns,
            {
              random: 998,
              getAnimationDuration: (animNo) => getMugenAnimEndTime(assets.air, animNo),
              onPause: (event) => pauseEvents.push(event),
              onSoundPlay: (event) => contactSounds.push(event),
            },
          )));
        expect(blocked.players[defenderId - 1]).toMatchObject({
          stateNo: 902, animNo: 908, animTime: 1, stateTime: 1, stateHeaderAppliedStateNo: 902, life: 1000,
        });
        expect(pauseEvents).toContainEqual(expect.objectContaining({
          type: 'pause', ownerEntityId: defenderId, time: 12, moveTime: 12,
        }));
        expect(contactSounds).toEqual([]);
        expect(blocked.players[defenderId - 1].x).toBe(defender.x);
        expect(blocked.players[defenderId - 1].y).toBe(defender.y);
        expect(blocked.players[defenderId - 1].vx).toBe(3);
        const events: SoundPlayEvent[] = [];
        const pause = applyPauseControllerEvents(createInitialPauseState(), pauseEvents);
        const sounded = stepCnsStateRuntime(blocked, assets.cns, {
          p1Commands: new Set(),
          p2Commands: new Set(),
          random: 998,
          getAnimationDuration: (animNo) => getMugenAnimEndTime(assets.air, animNo),
          getCnsDocumentForPlayer: (id) => id === defenderId ? assets.cns : emptyCns,
          pauseState: stepPauseState(pause),
          onSoundPlay: (event) => events.push(event),
        }).state;
        expect(sounded.players[defenderId - 1]).toMatchObject({ stateNo: 902, stateTime: 1 });
        expect(events).toContainEqual(expect.objectContaining({
          ownerId: defenderId, scope: 'character', group: 900, index: 0, volume: 100,
        }));
        expect(assets.sounds?.samplesByKey.has('900,0')).toBe(true);
        expect(blocked.hitDiagnosticLines?.join('\n')).toContain(`raw.hit_override attacker=p${attackerId} target=p${defenderId}`);
      });
    }
  }
});

function createThmaFileSystemFetcher(defPath: string): CharacterAssetFetcher {
  return {
    async text(requestPath) {
      if (requestPath === '/chars/common1.cmd') throw new Error('optional common1.cmd is absent');
      const text = new TextDecoder('shift_jis').decode(await readFile(mapCommonPath(requestPath)));
      return requestPath === defPath ? text.replace(/^\s*(?:sprite|pal\d+)\s*=.*$/gim, '') : text;
    },
    async arrayBuffer(requestPath) {
      const bytes = await readFile(mapCommonPath(requestPath));
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    },
  };
}

function mapCommonPath(requestPath: string): string {
  if (requestPath === '/chars/common1.cns') return 'public/chars/common1.cns';
  if (requestPath === '/chars/common.cmd') return 'public/chars/common.cmd';
  return requestPath;
}
