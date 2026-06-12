import { parseAirText } from '../../parser/air/AirParser';
import { parseCmdText } from '../../parser/cmd/CmdParser';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { getCharacterDefFiles, parseDefText } from '../../parser/def/DefParser';
import type { CharacterAssets } from './CharacterTypes';
import { convertSffV1ToImageDataSpritePack } from '../sprite/SffSpritePackConverter';

export type CharacterAssetFetcher = {
  text(path: string): Promise<string>;
  arrayBuffer(path: string): Promise<ArrayBuffer>;
};

export async function loadCharacterFromDef(
  defPath: string,
  fetcher: CharacterAssetFetcher = createHttpCharacterAssetFetcher(),
): Promise<CharacterAssets> {
  const defText = await fetcher.text(defPath);
  const def = parseDefText(defText);
  const files = getCharacterDefFiles(def);
  const basePath = getBasePath(defPath);

  if (!files.cns) {
    throw new Error('[Files] cns is missing.');
  }

  if (!files.anim) {
    throw new Error('[Files] anim is missing.');
  }

  if (!files.cmd) {
    throw new Error('[Files] cmd is missing.');
  }

  const [cnsText, airText, cmdText] = await Promise.all([
    fetcher.text(resolveAssetPath(basePath, files.cns)),
    fetcher.text(resolveAssetPath(basePath, files.anim)),
    fetcher.text(resolveAssetPath(basePath, files.cmd)),
  ]);

  const sprites =
    files.sprite !== undefined
      ? convertSffV1ToImageDataSpritePack(
          await fetcher.arrayBuffer(resolveAssetPath(basePath, files.sprite)),
        )
      : null;

  return {
    def,
    cns: parseCnsText(cnsText),
    air: parseAirText(airText),
    cmd: parseCmdText(cmdText),
    sprites,
  };
}

export function createHttpCharacterAssetFetcher(): CharacterAssetFetcher {
  return {
    async text(path: string) {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`Failed to fetch text asset: ${path}`);
      }
      return response.text();
    },

    async arrayBuffer(path: string) {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`Failed to fetch binary asset: ${path}`);
      }
      return response.arrayBuffer();
    },
  };
}

export function resolveAssetPath(basePath: string, relativePath: string): string {
  if (/^https?:\/\//i.test(relativePath) || relativePath.startsWith('/')) {
    return relativePath;
  }

  if (!basePath) {
    return relativePath;
  }

  return `${basePath.replace(/\/$/, '')}/${relativePath.replace(/^\.\//, '')}`;
}

function getBasePath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const slashIndex = normalized.lastIndexOf('/');
  return slashIndex >= 0 ? normalized.slice(0, slashIndex) : '';
}
