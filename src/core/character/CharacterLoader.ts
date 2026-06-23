import { parseAirText } from '../../parser/air/AirParser';
import { parseCmdText } from '../../parser/cmd/CmdParser';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { getCharacterDefFiles, parseDefText } from '../../parser/def/DefParser';
import { convertSffV1ToImageDataSpritePack } from '../sprite/SffSpritePackConverter';
import type { CharacterAssets, CharacterPaletteAsset } from './CharacterTypes';

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

  const [cnsText, airText, cmdText, palettes] = await Promise.all([
    fetcher.text(resolveAssetPath(basePath, files.cns)),
    fetcher.text(resolveAssetPath(basePath, files.anim)),
    fetcher.text(resolveAssetPath(basePath, files.cmd)),
    loadCharacterPalettes(basePath, files.palettes ?? [], fetcher),
  ]);

  const selectedPalette = palettes[0]?.bytes;
  const sprites =
    files.sprite !== undefined
      ? convertSffV1ToImageDataSpritePack(await fetcher.arrayBuffer(resolveAssetPath(basePath, files.sprite)), {
          externalPalette: selectedPalette,
          preferExternalPalette: selectedPalette !== undefined,
          paletteIndexOrder: selectedPalette !== undefined ? 'reversed' : 'normal',
        })
      : null;

  return {
    def,
    cns: parseCnsText(cnsText),
    air: parseAirText(airText),
    cmd: parseCmdText(cmdText),
    sprites,
    palettes,
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

async function loadCharacterPalettes(
  basePath: string,
  palettes: readonly { slot: number; file: string }[],
  fetcher: CharacterAssetFetcher,
): Promise<CharacterPaletteAsset[]> {
  return Promise.all(
    palettes.map(async (palette) => ({
      slot: palette.slot,
      file: palette.file,
      bytes: new Uint8Array(await fetcher.arrayBuffer(resolveAssetPath(basePath, palette.file))),
    })),
  );
}

function getBasePath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const slashIndex = normalized.lastIndexOf('/');
  return slashIndex >= 0 ? normalized.slice(0, slashIndex) : '';
}
