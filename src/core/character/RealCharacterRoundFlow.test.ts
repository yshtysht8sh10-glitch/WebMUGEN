import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { getMugenAnimEndTime } from '../animation/AnimationDuration';
import { stepCnsPhysicsMotion } from '../cns/CnsPhysicsStep';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { createInitialGameState } from '../engine/GameState';
import { applyRoundFlowStateEntries, winMugenRoundState } from '../engine/RoundFlow';
import { createInitialRoundState, stepRoundState } from '../engine/RoundState';
import { loadCharacterFromDef, type CharacterAssetFetcher } from './CharacterLoader';

const characters = [
  'public/chars/kfm/kfm.def',
  'public/chars/T-H-M-A/T-H-M-A/T-H-M-A.def',
];

describe('Issue #93 bundled character Round Flow', () => {
  for (const defPath of characters) {
    it(`runs ${defPath} Intro and result state families through production CNS`, async () => {
      const assets = await loadCharacterFromDef(defPath, createFileSystemFetcher(defPath));
      let state = createInitialGameState();
      let round = createInitialRoundState();
      state = applyRoundFlowStateEntries(state, round);
      const observedIntroStates = new Set<number>();

      for (let frame = 0; frame < 1200 && round.phase === 'intro'; frame += 1) {
        state.players.forEach((player) => observedIntroStates.add(player.stateNo));
        state = stepCnsStateRuntime(state, assets.cns, {
          p1Commands: new Set(), p2Commands: new Set(),
          roundState: winMugenRoundState(round),
          getAnimationDuration: (animNo) => getMugenAnimEndTime(assets.air, animNo),
        }).state;
        state = stepCnsPhysicsMotion(state, assets.cns);
        round = stepRoundState(round, state);
      }

      expect(observedIntroStates.has(190)).toBe(true);
      expect(observedIntroStates.has(191)).toBe(true);
      expect(round.phase).toBe('fight');
      expect(state.players.every((player) => player.stateNo < 190 || player.stateNo > 199)).toBe(true);

      const resultRound = { ...round, phase: 'ko' as const, winner: 1 as const, endReason: 'ko' as const, frameInPhase: 0 };
      state = applyRoundFlowStateEntries(state, resultRound);
      state = stepCnsStateRuntime(state, assets.cns, {
        p1Commands: new Set(), p2Commands: new Set(), roundState: 3,
        roundWinner: 1, roundEndReason: 'ko',
        getAnimationDuration: (animNo) => getMugenAnimEndTime(assets.air, animNo),
      }).state;
      expect(state.players[0].stateNo).toBeGreaterThanOrEqual(180);
      expect(state.players[0].stateNo).toBeLessThanOrEqual(189);
      expect(state.players[1].stateNo).toBe(170);
    }, 15_000);
  }
});

function createFileSystemFetcher(defPath: string): CharacterAssetFetcher {
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
