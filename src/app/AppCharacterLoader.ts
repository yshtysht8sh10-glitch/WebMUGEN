import { parseAirText } from '../parser/air/AirParser';
import { parseCmdText } from '../parser/cmd/CmdParser';
import { parseCnsText } from '../parser/cns/CnsParser';
import type { CharacterAssets } from '../core/character/CharacterTypes';
import { loadCharacterFromDef } from '../core/character/CharacterLoader';
import { sampleCharacterAir } from './sampleCharacterAir';
import { sampleCharacterCmd } from './sampleCharacterCmd';
import { sampleCharacterCns } from './sampleCharacterCns';

export type AppCharacterLoadResult = {
  character: CharacterAssets | null;
  source: 'def' | 'sample';
  errorMessage: string | null;
};

export async function loadAppCharacter(defPath: string): Promise<AppCharacterLoadResult> {
  try {
    const character = await loadCharacterFromDef(defPath);
    return {
      character,
      source: 'def',
      errorMessage: null,
    };
  } catch (error) {
    return {
      character: null,
      source: 'sample',
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

export function createSampleCharacterAssets(): Pick<CharacterAssets, 'cns' | 'air' | 'cmd' | 'sprites'> {
  return {
    cns: parseCnsText(sampleCharacterCns),
    air: parseAirText(sampleCharacterAir),
    cmd: parseCmdText(sampleCharacterCmd),
    sprites: null,
  };
}
