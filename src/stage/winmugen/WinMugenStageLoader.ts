import type { WinMugenStageDefinition } from './WinMugenStageTypes';
import { loadMugenStageZip } from '../../app/AppStageLoader';
import { isSafeSameOriginContentPath } from '../../app/ApplicationAssetPath';

export async function loadWinMugenStage(path: string): Promise<WinMugenStageDefinition> {
  if (!isSafeSameOriginContentPath(path, ['stages', 'content'], ['.zip'])) {
    throw new Error('WinMUGEN stage loader accepts only same-origin /stages/ or /content/ ZIP content.');
  }
  return loadMugenStageZip(path);
}
