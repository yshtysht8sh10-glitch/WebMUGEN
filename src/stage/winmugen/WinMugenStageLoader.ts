import type { WinMugenStageDefinition } from './WinMugenStageTypes';
import { loadMugenStageZip } from '../../app/AppStageLoader';
import { isSafeSameOriginAssetPath } from '../../app/ApplicationAssetPath';

export async function loadWinMugenStage(path: string): Promise<WinMugenStageDefinition> {
  if (!isSafeSameOriginAssetPath(path, ['.zip'])) {
    throw new Error('WinMUGEN stage loader accepts only same-origin absolute ZIP paths.');
  }
  return loadMugenStageZip(path);
}
