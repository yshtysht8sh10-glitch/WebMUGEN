import type { CnsDocument, CnsStateController, CnsStateDefinition } from '../../mugen/common/cnsTypes';
import { parseAirText } from '../../parser/air/AirParser';
import { parseCmdText } from '../../parser/cmd/CmdParser';
import type { CmdDocument } from '../../parser/cmd/CmdTypes';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { getCharacterDefFiles, parseDefText } from '../../parser/def/DefParser';
import { convertSffV1ToImageDataSpritePack } from '../sprite/SffSpritePackConverter';
import type { CharacterAssets, CharacterPaletteAsset } from './CharacterTypes';

const COMMON_CNS_PATH = '/chars/common1.cns';
const COMMON_CMD_PATHS = ['/chars/common.cmd', '/chars/common1.cmd'];
const BASELINE_COMMON_CMD_TEXT = `
[Command]
name = "holdup"
command = /U

[Command]
name = "holddown"
command = /D

[Command]
name = "holdfwd"
command = /F

[Command]
name = "holdback"
command = /B

[Statedef -1]

[State -1, Baseline Crouch Start]
type = ChangeState
triggerall = command = "holddown"
trigger1 = statetype = S
trigger1 = ctrl
value = 10

[State -1, Baseline Crouch Hold]
type = ChangeState
triggerall = command = "holddown"
trigger1 = stateno = 10
trigger1 = time > 0
value = 11

[State -1, Baseline Crouch End]
type = ChangeState
triggerall = command != "holddown"
trigger1 = statetype = C
value = 12

[State -1, Baseline Walk Forward]
type = ChangeState
triggerall = command = "holdfwd"
triggerall = command != "holddown"
trigger1 = statetype = S
trigger1 = ctrl
trigger1 = stateno != 20
value = 20

[State -1, Baseline Walk Back]
type = ChangeState
triggerall = command = "holdback"
triggerall = command != "holddown"
trigger1 = statetype = S
trigger1 = ctrl
trigger1 = stateno != 21
value = 21

[State -1, Baseline Jump]
type = ChangeState
triggerall = command = "holdup"
triggerall = command != "holddown"
trigger1 = statetype = S
trigger1 = ctrl
value = 40
`;
const BASELINE_COMMON_CNS_TEXT = `
[Statedef 10]
type = C
movetype = I
physics = C
ctrl = 0
anim = 10

[Statedef 11]
type = C
movetype = I
physics = C
ctrl = 1
anim = 11

[Statedef 12]
type = S
movetype = I
physics = S
ctrl = 0
anim = 12

[State 12, ReturnToStand]
type = ChangeState
trigger1 = time > 3
value = 0

[Statedef 20]
type = S
movetype = I
physics = S
ctrl = 1
anim = 20

[Statedef 21]
type = S
movetype = I
physics = S
ctrl = 1
anim = 21

[Statedef 40]
type = A
movetype = I
physics = A
ctrl = 0
anim = 40
`;
const DIRECTIONAL_COMMAND_NAMES = new Set([
  'holdfwd',
  'holdback',
  'holdup',
  'holddown',
  'fwd',
  'back',
  'up',
  'down',
  'f',
  'b',
  'u',
  'd',
  'df',
  'db',
  'uf',
  'ub',
]);

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

  if (!files.cns) throw new Error('[Files] cns is missing.');
  if (!files.anim) throw new Error('[Files] anim is missing.');
  if (!files.cmd) throw new Error('[Files] cmd is missing.');

  const [cnsText, airText, cmdText, commonCnsText, fetchedCommonCmdTexts, palettes] = await Promise.all([
    fetcher.text(resolveAssetPath(basePath, files.cns)),
    fetcher.text(resolveAssetPath(basePath, files.anim)),
    fetcher.text(resolveAssetPath(basePath, files.cmd)),
    loadOptionalText(COMMON_CNS_PATH, fetcher),
    loadOptionalTexts(COMMON_CMD_PATHS, fetcher),
    loadCharacterPalettes(basePath, files.palettes ?? [], fetcher),
  ]);

  const selectedPalette = palettes[0]?.bytes;
  const sprites = files.sprite !== undefined
    ? convertSffV1ToImageDataSpritePack(await fetcher.arrayBuffer(resolveAssetPath(basePath, files.sprite)), {
        externalPalette: selectedPalette,
        preferExternalPalette: selectedPalette !== undefined,
        paletteIndexOrder: selectedPalette !== undefined ? 'reversed' : 'normal',
      })
    : null;

  const commonCmdTexts = fetchedCommonCmdTexts.length > 0 ? fetchedCommonCmdTexts : [BASELINE_COMMON_CMD_TEXT];
  const commonCnsTexts = commonCnsText ? [commonCnsText] : [BASELINE_COMMON_CNS_TEXT];
  const characterCmd = parseCmdText(cmdText);
  const commonCmdDocuments = commonCmdTexts.map(parseCmdText);
  const commonCmdCnsDocuments = commonCmdTexts.map(parseCnsText);
  const characterCns = commonCmdCnsDocuments.reduce(
    (merged, commonCmdCns) => mergeMissingCnsStates(merged, commonCmdCns),
    mergeCnsDocuments(parseCnsText(cnsText), parseCnsText(cmdText)),
  );
  const cns = commonCnsTexts.reduce(
    (merged, commonCns) => mergeMissingCnsStates(merged, parseCnsText(commonCns)),
    characterCns,
  );

  return {
    def,
    cns,
    air: parseAirText(airText),
    cmd: mergeCmdDocuments(characterCmd, commonCmdDocuments),
    sprites,
    palettes,
  };
}

export function createHttpCharacterAssetFetcher(): CharacterAssetFetcher {
  return {
    async text(path: string) {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`Failed to fetch text asset: ${path}`);
      return response.text();
    },
    async arrayBuffer(path: string) {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`Failed to fetch binary asset: ${path}`);
      return response.arrayBuffer();
    },
  };
}

export function resolveAssetPath(basePath: string, relativePath: string): string {
  if (/^https?:\/\//i.test(relativePath) || relativePath.startsWith('/')) return relativePath;
  if (!basePath) return relativePath;
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
  const commonCommandState = common.states.find((state) => state.stateNo === -1);

  const states = base.states.map((state) => {
    if (state.stateNo !== -1 || !commonCommandState) return state;

    return {
      ...state,
      controllers: [
        ...state.controllers,
        ...filterCommonCommandControllers(state, commonCommandState.controllers),
      ],
    };
  });

  const missingCommonStates = common.states.filter((state) => !existingStateNos.has(state.stateNo));

  return {
    states: [...states, ...missingCommonStates],
    metadataSections: [...base.metadataSections, ...common.metadataSections],
  };
}

function filterCommonCommandControllers(
  characterCommandState: CnsStateDefinition,
  commonControllers: readonly CnsStateController[],
): CnsStateController[] {
  const characterPrimaryCommands = collectPrimaryCommandRoutes(characterCommandState.controllers);

  return commonControllers.filter((controller) => {
    const commonPrimaryCommands = collectPrimaryCommandRoutes([controller]);
    return !Array.from(commonPrimaryCommands).some((commandName) => characterPrimaryCommands.has(commandName));
  });
}

function collectPrimaryCommandRoutes(controllers: readonly CnsStateController[]): Set<string> {
  const names = new Set<string>();

  for (const controller of controllers) {
    if (controller.type.toLowerCase() !== 'changestate') continue;
    addAll(names, selectPrimaryCommandNames(collectPositiveCommandNames(controller.triggers)));
  }

  return names;
}

function selectPrimaryCommandNames(commandNames: ReadonlySet<string>): Set<string> {
  const nonDirectionalNames = Array.from(commandNames).filter((commandName) => !DIRECTIONAL_COMMAND_NAMES.has(commandName));
  return new Set(nonDirectionalNames.length > 0 ? nonDirectionalNames : Array.from(commandNames));
}

function collectPositiveCommandNames(
  triggers: readonly CnsStateController['triggers'][number][],
): Set<string> {
  const names = new Set<string>();

  for (const trigger of triggers) {
    const match = trigger.expression.match(/^\s*command\s*=\s*"([^"]+)"\s*$/i);
    if (match) names.add(match[1].toLowerCase());
  }

  return names;
}

function addAll(target: Set<string>, source: ReadonlySet<string>): void {
  for (const item of source) target.add(item);
}

function mergeCmdDocuments(character: CmdDocument, commonDocuments: readonly CmdDocument[]): CmdDocument {
  const commandsByName = new Map<string, CmdDocument['commands'][number]>();

  for (const document of commonDocuments) {
    for (const command of document.commands) commandsByName.set(command.name.toLowerCase(), command);
  }

  for (const command of character.commands) commandsByName.set(command.name.toLowerCase(), command);

  return { commands: Array.from(commandsByName.values()) };
}

async function loadOptionalText(path: string, fetcher: CharacterAssetFetcher): Promise<string | null> {
  try {
    return await fetcher.text(path);
  } catch {
    return null;
  }
}

async function loadOptionalTexts(paths: readonly string[], fetcher: CharacterAssetFetcher): Promise<string[]> {
  const texts = await Promise.all(paths.map((path) => loadOptionalText(path, fetcher)));
  return texts.filter((text): text is string => text !== null);
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
