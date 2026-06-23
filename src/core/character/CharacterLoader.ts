import type { CnsDocument } from '../../mugen/common/cnsTypes';
import { parseAirText } from '../../parser/air/AirParser';
import { parseCmdText } from '../../parser/cmd/CmdParser';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { getCharacterDefFiles, parseDefText } from '../../parser/def/DefParser';
import { convertSffV1ToImageDataSpritePack } from '../sprite/SffSpritePackConverter';
import type { CharacterAssets, CharacterPaletteAsset } from './CharacterTypes';

const COMMON_CNS_PATH = '/chars/common1.cns';

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

  const [cnsText, airText, cmdText, commonCnsText, palettes] = await Promise.all([
    fetcher.text(resolveAssetPath(basePath, files.cns)),
    fetcher.text(resolveAssetPath(basePath, files.anim)),
    fetcher.text(resolveAssetPath(basePath, files.cmd)),
    loadOptionalText(COMMON_CNS_PATH, fetcher),
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

  const characterCns = mergeCnsDocuments(parseCnsText(cnsText), parseCnsText(cmdText));

  return {
    def,
    cns: commonCnsText
      ? mergeMissingCnsStates(characterCns, parseCnsText(commonCnsText))
      : characterCns,
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

export function mergeCnsDocuments(base: CnsDocument, extra: CnsDocument): CnsDocument {
  return {
    states: [...base.states, ...extra.states],
    metadataSections: [...base.metadataSections, ...extra.metadataSections],
  };
}

export function mergeMissingCnsStates(base: CnsDocument, common: CnsDocument): CnsDocument {
  const existingStateNos = new Set(base.states.map((state) => state.stateNo));
  const missingCommonStates = common.states.filter((state) => !existingStateNos.has(state.stateNo));

  return {
    states: [...base.states, ...missingCommonStates],
    metadataSections: [...base.metadataSections, ...common.metadataSections],
  };
}

async function loadOptionalText(path: string, fetcher: CharacterAssetFetcher): Promise<string | null> {
  try {
    return await fetcher.text(path);
  } catch {
    return null;
  }
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
