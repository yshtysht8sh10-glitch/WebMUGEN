import type { CnsDocument, CnsStateController, CnsStateDefinition } from '../../mugen/common/cnsTypes';
import { prepareCnsDocumentRuntimeTriggers } from '../cns/CnsRuntimeTrigger';
import { parseAirText } from '../../parser/air/AirParser';
import { parseCmdText } from '../../parser/cmd/CmdParser';
import type { CmdDocument } from '../../parser/cmd/CmdTypes';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { getCharacterDefFiles, parseDefText } from '../../parser/def/DefParser';
import { parseSndV1 } from '../../parser/snd/SndParser';
import { convertSffV1ToImageDataSpritePack } from '../sprite/SffSpritePackConverter';
import type { CharacterAssets, CharacterLoadDiagnostic, CharacterPaletteAsset, CharacterSourceFile } from './CharacterTypes';

const COMMON_CNS_PATH = '/chars/common1.cns';
const COMMON_CMD_PATHS = ['/chars/common.cmd', '/chars/common1.cmd'];
const BASELINE_MOVEMENT_STATE_VALUES = new Set([10, 11, 12, 20, 21, 40, 50, 52, 100, 105]);
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
triggerall = stateno != 100
triggerall = stateno != 101
triggerall = stateno != 102
triggerall = stateno != 103
triggerall = stateno != 104
triggerall = stateno != 105
triggerall = stateno != 106
triggerall = stateno != 107
trigger1 = statetype = S
trigger1 = ctrl
trigger1 = stateno != 20
value = 20

[State -1, Baseline Walk Back]
type = ChangeState
triggerall = command = "holdback"
triggerall = command != "holddown"
triggerall = stateno != 100
triggerall = stateno != 101
triggerall = stateno != 102
triggerall = stateno != 103
triggerall = stateno != 104
triggerall = stateno != 105
triggerall = stateno != 106
triggerall = stateno != 107
trigger1 = statetype = S
trigger1 = ctrl
trigger1 = stateno != 21
value = 21

[State -1, Baseline Walk Stop]
type = ChangeState
triggerall = command != "holdfwd"
triggerall = command != "holdback"
triggerall = command != "holddown"
trigger1 = stateno = 20
trigger2 = stateno = 21
value = 0

[State -1, Baseline Jump]
type = ChangeState
triggerall = command = "holdup"
triggerall = command != "holddown"
trigger1 = statetype = S
trigger1 = ctrl
value = 40
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

  const primaryCnsPath = resolveAssetPath(basePath, files.cns);
  const extraCnsPaths = uniqueExtraCnsPaths(files.cns, files.st ?? []).map((path) => resolveAssetPath(basePath, path));
  const airPath = resolveAssetPath(basePath, files.anim);
  const cmdPath = resolveAssetPath(basePath, files.cmd);
  const characterCommonCnsPath = files.stcommon ? resolveAssetPath(basePath, files.stcommon) : null;
  const soundPath = files.sound ? resolveAssetPath(basePath, files.sound) : null;

  const [cnsText, extraCnsTexts, airText, cmdText, characterCommonCnsText, commonCnsText, fetchedCommonCmdTexts, palettes, soundResult] = await Promise.all([
    fetcher.text(primaryCnsPath),
    loadOptionalTextEntries(extraCnsPaths, fetcher),
    fetcher.text(airPath),
    fetcher.text(cmdPath),
    characterCommonCnsPath ? loadOptionalText(characterCommonCnsPath, fetcher) : Promise.resolve(null),
    loadOptionalText(COMMON_CNS_PATH, fetcher),
    loadOptionalTextEntries(COMMON_CMD_PATHS, fetcher),
    loadCharacterPalettes(basePath, files.palettes ?? [], fetcher),
    soundPath ? loadCharacterSounds(soundPath, fetcher) : Promise.resolve({ sounds: null, diagnostics: [] }),
  ]);

  const selectedPalette = palettes[0]?.bytes;
  const sprites = files.sprite !== undefined
    ? convertSffV1ToImageDataSpritePack(await fetcher.arrayBuffer(resolveAssetPath(basePath, files.sprite)), {
        externalPalette: selectedPalette,
        preferExternalPalette: selectedPalette !== undefined,
        paletteIndexOrder: selectedPalette !== undefined ? 'reversed' : 'normal',
      })
    : null;

  const commonCmdTexts = fetchedCommonCmdTexts.length > 0
    ? fetchedCommonCmdTexts
    : [{ path: 'baseline-common.cmd', text: BASELINE_COMMON_CMD_TEXT }];
  const characterCmd = parseCmdText(cmdText);
  const commonCmdDocuments = commonCmdTexts.map((entry) => parseCmdText(entry.text));
  const commonCmdCnsDocuments = commonCmdTexts.map((entry) =>
    annotateCnsDocument(parseCnsText(entry.text, { sourceFile: entry.path }), 'common', shortSourceLabel(entry.path)));
  const characterCnsDocuments = [
    parseCnsText(cnsText, { sourceFile: primaryCnsPath }),
    ...extraCnsTexts.map((entry) => parseCnsText(entry.text, { sourceFile: entry.path })),
  ];
  const characterCns = annotateCnsDocument(
    mergeCnsDocuments(
      mergeManyCnsDocuments(characterCnsDocuments),
      parseCnsText(cmdText, { sourceFile: cmdPath }),
    ),
    'character',
    'character',
  );
  const withCharacterCommonCns = characterCommonCnsText
    ? mergeMissingCnsStates(characterCns, annotateCnsDocument(parseCnsText(characterCommonCnsText, { sourceFile: characterCommonCnsPath ?? 'stcommon' }), 'character', 'stcommon'))
    : characterCns;
  const withCommonCns = commonCnsText
    ? mergeMissingCnsStates(withCharacterCommonCns, annotateCnsDocument(parseCnsText(commonCnsText, { sourceFile: COMMON_CNS_PATH }), 'common', 'common1.cns'))
    : withCharacterCommonCns;
  const cns = commonCmdCnsDocuments.reduce(
    (merged, commonCmdCns) => mergeMissingCnsStates(merged, commonCmdCns),
    withCommonCns,
  );
  prepareCnsDocumentRuntimeTriggers(cns);
  const cnsSourceFiles: CharacterSourceFile[] = [
    { path: defPath, label: shortSourceLabel(defPath), text: defText, kind: 'def' },
    { path: primaryCnsPath, label: shortSourceLabel(primaryCnsPath), text: cnsText, kind: 'cns' },
    ...extraCnsTexts.map((entry) => ({ path: entry.path, label: shortSourceLabel(entry.path), text: entry.text, kind: 'cns' as const })),
    ...(characterCommonCnsText && characterCommonCnsPath ? [{ path: characterCommonCnsPath, label: shortSourceLabel(characterCommonCnsPath), text: characterCommonCnsText, kind: 'cns' as const }] : []),
    { path: cmdPath, label: shortSourceLabel(cmdPath), text: cmdText, kind: 'cmd' },
    { path: airPath, label: shortSourceLabel(airPath), text: airText, kind: 'air' },
    ...(commonCnsText ? [{ path: COMMON_CNS_PATH, label: 'common1.cns', text: commonCnsText, kind: 'common' as const }] : []),
    ...commonCmdTexts.map((entry) => ({ path: entry.path, label: shortSourceLabel(entry.path), text: entry.text, kind: 'common' as const })),
  ];

  return {
    def,
    cns,
    air: parseAirText(airText),
    cmd: mergeCmdDocuments(characterCmd, commonCmdDocuments),
    sprites,
    palettes,
    sounds: soundResult.sounds,
    loadDiagnostics: soundResult.diagnostics,
    cnsSourceFiles,
  };
}

async function loadCharacterSounds(
  path: string,
  fetcher: CharacterAssetFetcher,
): Promise<Pick<CharacterAssets, 'sounds'> & { diagnostics: CharacterLoadDiagnostic[] }> {
  try {
    return { sounds: parseSndV1(await fetcher.arrayBuffer(path)), diagnostics: [] };
  } catch (error) {
    return {
      sounds: null,
      diagnostics: [{ asset: 'sound', path, message: error instanceof Error ? error.message : String(error) }],
    };
  }
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

function mergeManyCnsDocuments(documents: readonly CnsDocument[]): CnsDocument {
  return documents.reduce((merged, document) => mergeCnsDocuments(merged, document), { states: [], metadataSections: [] });
}

function annotateCnsDocument(document: CnsDocument, source: CnsStateDefinition['source'], sourceLabel: string): CnsDocument {
  return {
    states: document.states.map((state) => ({
      ...state,
      source: state.source ?? source,
      sourceLabel: state.sourceLabel ?? sourceLabel,
    })),
    metadataSections: document.metadataSections,
  };
}

export function mergeMissingCnsStates(base: CnsDocument, common: CnsDocument): CnsDocument {
  const existingStateNos = new Set(base.states.map((state) => state.stateNo));
  const commonCommandState = common.states.find((state) => state.stateNo === -1);

  const states = base.states.map((state) => {
    if (state.stateNo !== -1 || !commonCommandState) return state;

    const characterPrimaryCommands = collectPrimaryCommandRoutes(state.controllers);
    const baselineMovementControllers = commonCommandState.controllers.filter(
      (controller) => isBaselineMovementController(controller) && !isOverriddenByCharacterPrimaryCommand(controller, characterPrimaryCommands),
    );
    const otherCommonControllers = commonCommandState.controllers.filter((controller) => !isBaselineMovementController(controller));

    return {
      ...state,
      source: state.source === 'common' ? 'common' : 'mixed' as CnsStateDefinition['source'],
      sourceLabel: `${state.sourceLabel ?? 'character'}+${commonCommandState.sourceLabel ?? 'common'}`,
      controllers: [
        ...baselineMovementControllers,
        ...state.controllers,
        ...filterCommonCommandControllers(state, otherCommonControllers),
      ],
    };
  });

  const missingCommonStates = common.states.filter((state) => !existingStateNos.has(state.stateNo));

  return {
    states: [...states, ...missingCommonStates],
    metadataSections: [...base.metadataSections, ...common.metadataSections],
  };
}

function isBaselineMovementController(controller: CnsStateController): boolean {
  if (controller.type.toLowerCase() !== 'changestate') return false;
  const value = Number(controller.params.value);
  return BASELINE_MOVEMENT_STATE_VALUES.has(value);
}

function isOverriddenByCharacterPrimaryCommand(
  controller: CnsStateController,
  characterPrimaryCommands: ReadonlySet<string>,
): boolean {
  const commonPrimaryCommands = collectPrimaryCommandRoutes([controller]);
  return Array.from(commonPrimaryCommands).some((commandName) => characterPrimaryCommands.has(commandName));
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

async function loadOptionalTextEntries(paths: readonly string[], fetcher: CharacterAssetFetcher): Promise<Array<{ path: string; text: string }>> {
  const texts = await Promise.all(paths.map(async (path) => ({ path, text: await loadOptionalText(path, fetcher) })));
  return texts.filter((entry): entry is { path: string; text: string } => entry.text !== null);
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

function shortSourceLabel(path: string): string {
  return path.replace(/\\/g, '/').split('/').pop() ?? path;
}

function uniqueExtraCnsPaths(primaryCns: string, paths: readonly string[]): string[] {
  const seen = new Set([normalizeRelativePath(primaryCns)]);
  const result: string[] = [];

  for (const path of paths) {
    const normalized = normalizeRelativePath(path);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(path);
  }

  return result;
}

function normalizeRelativePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();
}
