import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { createInitialGameState } from '../engine/GameState';
import { loadCharacterFromDef, type CharacterAssetFetcher } from './CharacterLoader';

describe('real character ctrl routing regression', () => {
  it('does not let common walking replace T-H-M-A State 60011', async () => {
    const defPath = 'public/chars/T-H-M-A/T-H-M-A/T-H-M-A.def';
    const assets = await loadCharacterFromDef(defPath, createThmaFileSystemFetcher(defPath));
    const initial = createInitialGameState();
    const result = stepCnsStateRuntime(
      {
        ...initial,
        players: [
          {
            ...initial.players[0],
            stateNo: 60011,
            stateTime: 0,
            animNo: 59991,
            animTime: 1,
            stateType: 'S',
            physics: 'S',
            ctrl: true,
          },
          initial.players[1],
        ],
      },
      assets.cns,
      {
        p1Commands: new Set(['holdfwd']),
        p2Commands: new Set(),
      },
    );

    expect(result.state.players[0]).toMatchObject({ stateNo: 60011, ctrl: false });
    expect(result.state.players[0].stateNo).not.toBe(20);
  });
});

function createThmaFileSystemFetcher(defPath: string): CharacterAssetFetcher {
  return {
    async text(requestPath) {
      if (requestPath === '/chars/common1.cmd') throw new Error('optional common1.cmd is absent');
      const text = new TextDecoder('shift_jis').decode(await readFile(mapCommonPath(requestPath)));
      return requestPath === defPath
        ? text.replace(/^\s*(?:sprite|pal\d+)\s*=.*$/gim, '')
        : text;
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
