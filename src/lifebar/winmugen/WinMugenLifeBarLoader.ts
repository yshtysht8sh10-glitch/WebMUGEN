import { getDefValue, parseDefText } from '../../parser/def/DefParser';
import type { WinMugenLifeBarDefinition } from './WinMugenLifeBarTypes';
import { isSafeSameOriginContentPath } from '../../app/ApplicationAssetPath';

export async function loadWinMugenLifeBar(
  path: string,
  fetcher: (input: string) => Promise<{ ok: boolean; status: number; text(): Promise<string> }> = fetch,
): Promise<WinMugenLifeBarDefinition> {
  if (!isSafeSameOriginContentPath(path, ['lifebars/winmugen', 'content'], ['.def'])) {
    throw new Error('WinMUGEN lifebar loader accepts only same-origin /lifebars/winmugen/ or /content/ DEF content.');
  }
  const response = await fetcher(path);
  if (!response.ok) throw new Error(`WinMUGEN lifebar request failed: HTTP ${response.status}`);
  const def = parseDefText(await response.text());
  const spritePath = getDefValue(def, 'Files', 'sff');
  const animationPath = getDefValue(def, 'Files', 'fightfx.air') ?? getDefValue(def, 'Files', 'air');
  if (!spritePath && !animationPath) throw new Error('Not a WinMUGEN fight.def document.');
  return {
    format: 'winmugen-fight-def', id: path, name: getDefValue(def, 'Info', 'name') ?? path, defPath: path,
    spritePath: spritePath ?? undefined,
    animationPath: animationPath ?? undefined,
    soundPath: getDefValue(def, 'Files', 'snd') ?? undefined,
  };
}
