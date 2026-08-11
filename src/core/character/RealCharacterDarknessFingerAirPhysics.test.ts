import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { getMugenAnimEndTime } from '../animation/AnimationDuration';
import { stepCnsPhysicsMotion } from '../cns/CnsPhysicsStep';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { createInitialGameState } from '../engine/GameState';
import { loadCharacterFromDef, type CharacterAssetFetcher } from './CharacterLoader';

class FakeImageData {
  constructor(public data: Uint8ClampedArray, public width: number, public height: number) {}
}

(globalThis as unknown as { ImageData: typeof ImageData }).ImageData = FakeImageData as unknown as typeof ImageData;

describe('T-H-M-A airborne Darkness Finger wall carry', () => {
  it('keeps its airborne Y position through State 3401 -> 3400', async () => {
    const assets = await loadCharacterFromDef(
      'public/chars/T-H-M-A/T-H-M-A/T-H-M-A.def',
      createFileSystemFetcher(),
    );
    const states = assets.cns.states.filter((state) => state.stateNo === 3400 || state.stateNo === 3401);
    expect(states.map((state) => state.stateNo)).toEqual([3400, 3401]);

    const initial = createInitialGameState();
    const beforeY = 200;
    const routed = stepCnsStateRuntime({
      ...initial,
      players: [{
        ...initial.players[0],
        y: beforeY,
        vy: -4,
        stateNo: 3401,
        stateHeaderAppliedStateNo: 3401,
        stateTime: 1,
        stateType: 'A',
        physics: 'S',
        ctrl: false,
        vars: { 21: 1 },
      }, initial.players[1]],
    }, { metadataSections: assets.cns.metadataSections, states }, {
      getAnimationDuration: (animNo) => getMugenAnimEndTime(assets.air, animNo),
    }).state;

    expect(routed.players[0]).toMatchObject({
      stateNo: 3400,
      stateTime: 0,
      stateType: 'A',
      physics: 'S',
      vy: 1.5,
      y: beforeY,
    });

    const moved = stepCnsPhysicsMotion(routed, assets.cns);
    expect(moved.players[0]).toMatchObject({
      stateNo: 3400,
      stateType: 'A',
      physics: 'S',
      y: beforeY + 1.5,
      vy: 1.5,
    });
  });
});

function createFileSystemFetcher(): CharacterAssetFetcher {
  return {
    async text(requestPath) {
      return new TextDecoder('shift_jis').decode(await readFile(mapCharacterPath(requestPath)));
    },
    async arrayBuffer(requestPath) {
      const bytes = await readFile(mapCharacterPath(requestPath));
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    },
  };
}

function mapCharacterPath(requestPath: string): string {
  const normalized = requestPath.replace(/\\/g, '/');
  if (normalized === '/chars/common1.cns') return 'public/chars/common1.cns';
  if (normalized === '/chars/common.cmd' || normalized === '/chars/common1.cmd') return 'public/chars/common.cmd';
  if (normalized.startsWith('/chars/')) return `public${normalized}`;
  return normalized;
}
