import type { WinMugenStageDefinition } from './WinMugenStageTypes';
import { loadMugenStageZip } from '../../app/AppStageLoader';

export async function loadWinMugenStage(path: string): Promise<WinMugenStageDefinition> {
  if ((!path.startsWith('/stages/') && !path.startsWith('/content/')) || !path.toLowerCase().endsWith('.zip') || path.includes('..') || path.includes('://')) {
    throw new Error('WinMUGEN stage loader accepts only same-origin /stages/ or /content/ ZIP content.');
  }
  return loadMugenStageZip(path);
}
