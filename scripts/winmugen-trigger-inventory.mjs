import { readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitMarkdownRow } from './compatibility-matrix.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OFFICIAL_REFERENCE = 'https://bluesura.github.io/MUGEN/document/Official/2002.04.14/trigger.html';
const ELECBYTE_10_REFERENCE = 'https://www.elecbyte.com/mugendocs/trigger.html';
const ELECBYTE_11_REFERENCE = 'https://www.elecbyte.com/mugendocs-11b1/trigger.html';

// Derived from Elecbyte's alphabetical Trigger Index for 2002.04.14. Axis and
// Win/Lose suffix forms are split because the Compatibility Matrix tracks one
// independently testable behavior per row.
const WINMUGEN_TRIGGERS = [
  'Abs', 'ACos', 'Alive', 'Anim', 'AnimElem', 'AnimElemNo', 'AnimElemTime', 'AnimExist', 'AnimTime',
  'ASin', 'ATan', 'AuthorName', 'BackEdgeBodyDist', 'BackEdgeDist', 'CanRecover', 'Ceil', 'Command',
  'Const', 'Cos', 'Ctrl', 'DrawGame', 'E', 'Exp', 'Facing', 'Floor', 'FrontEdgeBodyDist',
  'FrontEdgeDist', 'FVar', 'GameTime', 'GetHitVar', 'HitCount', 'HitDefAttr', 'HitFall', 'HitOver',
  'HitPauseTime', 'HitShakeOver', 'HitVel X', 'HitVel Y', 'ID', 'IfElse', 'InGuardDist', 'IsHelper',
  'IsHomeTeam', 'Life', 'LifeMax', 'Log', 'Ln', 'Lose', 'LoseKO', 'LoseTime', 'MatchNo', 'MatchOver',
  'MoveContact', 'MoveGuarded', 'MoveHit', 'MoveType', 'MoveReversed', 'Name', 'NumEnemy', 'NumExplod',
  'NumHelper', 'NumPartner', 'NumProj', 'NumProjID', 'NumTarget', 'P1Name', 'P2BodyDist X',
  'P2BodyDist Y', 'P2Dist X', 'P2Dist Y', 'P2Life', 'P2MoveType', 'P2Name', 'P2StateNo',
  'P2StateType', 'P3Name', 'P4Name', 'PalNo', 'ParentDist X', 'ParentDist Y', 'Pi', 'Pos X', 'Pos Y',
  'Power', 'PowerMax', 'PlayerIDExist', 'PrevStateNo', 'ProjCancelTime', 'ProjContact',
  'ProjContactTime', 'ProjGuarded', 'ProjGuardedTime', 'ProjHit', 'ProjHitTime', 'Random', 'RootDist X',
  'RootDist Y', 'RoundNo', 'RoundsExisted', 'RoundState', 'ScreenPos X', 'ScreenPos Y', 'SelfAnimExist',
  'Sin', 'StateNo', 'StateType', 'SysFVar', 'SysVar', 'Tan', 'TeamMode', 'TeamSide', 'TicksPerSecond',
  'Time', 'TimeMod', 'UniqHitCount', 'Var', 'Vel X', 'Vel Y', 'Win', 'WinKO', 'WinPerfect', 'WinTime',
];

const EXTENSION_TRIGGERS = [
  ['AILevel', 'MUGEN 1.0', ELECBYTE_10_REFERENCE],
  ['Cond', 'MUGEN 1.0', ELECBYTE_10_REFERENCE],
  ['Const240p', 'MUGEN 1.0', ELECBYTE_10_REFERENCE],
  ['Const480p', 'MUGEN 1.0', ELECBYTE_10_REFERENCE],
  ['Const720p', 'MUGEN 1.0', ELECBYTE_10_REFERENCE],
  ['BackEdge', 'MUGEN 1.1', ELECBYTE_11_REFERENCE],
  ['BottomEdge', 'MUGEN 1.1', ELECBYTE_11_REFERENCE],
  ['CameraPos X', 'MUGEN 1.1', ELECBYTE_11_REFERENCE],
  ['CameraPos Y', 'MUGEN 1.1', ELECBYTE_11_REFERENCE],
  ['CameraZoom', 'MUGEN 1.1', ELECBYTE_11_REFERENCE],
  ['FrontEdge', 'MUGEN 1.1', ELECBYTE_11_REFERENCE],
  ['GameHeight', 'MUGEN 1.1', ELECBYTE_11_REFERENCE],
  ['GameWidth', 'MUGEN 1.1', ELECBYTE_11_REFERENCE],
  ['LeftEdge', 'MUGEN 1.1', ELECBYTE_11_REFERENCE],
  ['RightEdge', 'MUGEN 1.1', ELECBYTE_11_REFERENCE],
  ['ScreenHeight', 'MUGEN 1.1', ELECBYTE_11_REFERENCE],
  ['ScreenWidth', 'MUGEN 1.1', ELECBYTE_11_REFERENCE],
  ['TopEdge', 'MUGEN 1.1', ELECBYTE_11_REFERENCE],
  ['BodyDist X', 'real-character compatibility alias', null],
  ['BodyDist Y', 'real-character compatibility alias', null],
  ['NumCommand', 'WebMUGEN compatibility extension', null],
  ['P2AuthorName', 'WebMUGEN compatibility extension', null],
  ['P2Ctrl', 'WebMUGEN compatibility extension', null],
  ['P2Facing', 'WebMUGEN compatibility extension', null],
  ['Physics', 'WebMUGEN compatibility extension; not in the official WinMUGEN Trigger Index', OFFICIAL_REFERENCE],
  ['StateTime', 'real-character compatibility alias', null],
  ['TargetID', 'WebMUGEN compatibility helper', null],
  ['TargetStateNo', 'WebMUGEN compatibility helper', null],
  ['TargetLife', 'not a standalone WinMUGEN trigger; use target redirect + Life', OFFICIAL_REFERENCE],
  ['TargetVel X', 'not a standalone WinMUGEN trigger; use target redirect + Vel X', OFFICIAL_REFERENCE],
  ['TargetVel Y', 'not a standalone WinMUGEN trigger; use target redirect + Vel Y', OFFICIAL_REFERENCE],
  ['TargetDist X', 'not a standalone WinMUGEN trigger; use target redirect + Pos/P2Dist', OFFICIAL_REFERENCE],
  ['TargetDist Y', 'not a standalone WinMUGEN trigger; use target redirect + Pos/P2Dist', OFFICIAL_REFERENCE],
  ['Timeremaining', 'not in the WinMUGEN 2002.04.14 official Trigger Index', OFFICIAL_REFERENCE],
  ['WinHyper', 'not in the WinMUGEN 2002.04.14 official Trigger Index', OFFICIAL_REFERENCE],
  ['WinSpecial', 'not in the WinMUGEN 2002.04.14 official Trigger Index', OFFICIAL_REFERENCE],
];

const COMPLETE = new Set([
  'AnimElem', 'AnimElemTime', 'Command', 'Ctrl', 'StateNo', 'StateType', 'Time',
]);
const SAFE_FALLBACK = new Set([
  'AILevel', 'LifeMax', 'NumEnemy', 'NumPartner',
  'ProjCancelTime', 'RoundsExisted',
]);
const PARTIAL = new Set([
  'Abs', 'ACos', 'Alive', 'Anim', 'AnimElemNo', 'AnimExist', 'AnimTime', 'ASin', 'ATan', 'AuthorName',
  'BackEdgeBodyDist', 'BackEdgeDist', 'BodyDist X', 'BodyDist Y', 'CanRecover', 'Ceil', 'Cond', 'Const',
  'Cos', 'DrawGame', 'E', 'Exp', 'Facing', 'Floor', 'FrontEdgeBodyDist', 'FrontEdgeDist', 'FVar',
  'GameTime', 'GetHitVar', 'HitCount', 'HitDefAttr', 'HitFall', 'HitOver', 'HitPauseTime', 'HitShakeOver', 'ID',
  'HitVel X', 'HitVel Y', 'IfElse', 'InGuardDist', 'IsHelper', 'Life', 'Ln', 'Log', 'Lose', 'MatchOver',
  'MoveContact', 'MoveGuarded', 'MoveHit', 'MoveType', 'Name', 'NumExplod', 'NumHelper', 'NumTarget', 'P1Name', 'P2BodyDist X',
  'P2BodyDist Y', 'P2Dist X', 'P2Dist Y', 'P2Life', 'P2MoveType', 'P2Name', 'P2StateNo', 'P2StateType', 'P3Name', 'P4Name', 'PalNo',
  'Pi', 'PlayerIDExist', 'Pos X', 'Pos Y', 'Power', 'PowerMax', 'PrevStateNo', 'ProjContact', 'ProjContactTime', 'ProjGuarded', 'ProjGuardedTime', 'ProjHit', 'ProjHitTime', 'RoundNo', 'RoundState', 'ScreenPos X',
  'ScreenPos Y', 'SelfAnimExist', 'Sin', 'StateTime', 'SysFVar', 'SysVar', 'Tan', 'TargetID', 'TargetStateNo', 'NumCommand',
  'P2AuthorName', 'P2Ctrl', 'P2Facing', 'Physics',
  'Random', 'TeamSide', 'TicksPerSecond', 'TimeMod', 'Var', 'Vel X', 'Vel Y', 'Win', 'NumProj', 'NumProjID',
]);

const FUNCTION_ARGUMENTS = new Map([
  ['Abs', 'expression'], ['ACos', 'expression'], ['ASin', 'expression'], ['ATan', 'expression'],
  ['AnimElemTime', 'element expression'], ['AnimExist', 'animation expression'], ['Ceil', 'expression'],
  ['Cond', 'condition, true expression, false expression'], ['Const', 'constant name'], ['Cos', 'expression'],
  ['Exp', 'expression'], ['Floor', 'expression'], ['FVar', 'variable index expression'],
  ['GetHitVar', 'get-hit field name'], ['IfElse', 'condition, true expression, false expression'],
  ['Ln', 'expression'], ['Log', 'base, expression'], ['NumExplod', 'optional explod id'],
  ['NumHelper', 'optional helper id'], ['NumProjID', 'projectile id'], ['NumTarget', 'optional HitDef id'],
  ['PlayerIDExist', 'player id expression'], ['ProjCancelTime', 'optional projectile id'],
  ['ProjContactTime', 'optional projectile id'], ['ProjGuardedTime', 'optional projectile id'],
  ['ProjHitTime', 'optional projectile id'], ['SelfAnimExist', 'animation expression'], ['Sin', 'expression'],
  ['SysFVar', 'system variable index expression'], ['SysVar', 'system variable index expression'],
  ['Tan', 'expression'], ['Var', 'variable index expression'],
]);
const AXIS = / (X|Y)$/;
const STRING_RETURN = new Set(['AuthorName', 'Name', 'P1Name', 'P2Name', 'P3Name', 'P4Name', 'MoveType', 'P2MoveType', 'StateType', 'P2StateType', 'TeamMode']);
const BOOLEAN_RETURN = new Set(['Alive', 'AnimExist', 'CanRecover', 'Command', 'Ctrl', 'DrawGame', 'HitDefAttr', 'HitFall', 'HitOver', 'HitShakeOver', 'InGuardDist', 'IsHelper', 'IsHomeTeam', 'Lose', 'LoseKO', 'LoseTime', 'MatchOver', 'PlayerIDExist', 'ProjContact', 'ProjGuarded', 'ProjHit', 'SelfAnimExist', 'Win', 'WinKO', 'WinPerfect', 'WinTime']);
const REDIRECT_EXCEPTIONS = new Set(['Command']);

const NOTES = {
  Command: 'Checks the case-sensitive CMD command name; parser retains the old-style quoted comparison.',
  AnimElem: 'Checks the 1-based AIR element start or its old-style element-relative time comparison.',
  GetHitVar: 'Reads a named value snapshotted from the hit that placed the player in get-hit state.',
  MoveContact: 'Elapsed unpaused ticks since the current attack contacted by hit or guard.',
  MoveHit: 'Elapsed unpaused ticks since the current attack hit.',
  MoveGuarded: 'Elapsed unpaused ticks since the current attack was guarded.',
  NumExplod: 'Counts active Explods owned by the current runtime entity, optionally filtered by MUGEN id.',
  ProjHitTime: 'Returns elapsed unpaused ticks since the requested projectile id last hit, or -1 when it has not hit.',
  ProjHit: 'Checks whether the optional projectile ID suffix hit on the current unpaused owner tick, with the old-style optional elapsed-time comparison.',
  Random: 'Returns an integer from 0 through 999; WebMUGEN supplies a deterministic per-frame value so runtime traces and replays remain stable.',
  Time: 'Returns ticks elapsed in the current State.',
  StateNo: 'Returns the currently executing State number.',
  StateType: 'Returns the current S/C/A state type.',
  Win: 'Reports whether the player/team won the round; suffix forms restrict the win reason.',
  Lose: 'Reports whether the player/team lost the round; suffix forms restrict the loss reason.',
};

function auditClassification(name, version) {
  if (version.startsWith('MUGEN ') || version.startsWith('not ') || name.startsWith('TargetLife') || name.startsWith('TargetVel') || name.startsWith('TargetDist') || name === 'Timeremaining' || name === 'WinHyper' || name === 'WinSpecial') return 'Not applicable';
  if (COMPLETE.has(name)) return 'Complete';
  if (SAFE_FALLBACK.has(name)) return 'Safe fallback';
  if (PARTIAL.has(name)) return 'Partial';
  return 'Parser only';
}

function matrixStatus(audit) {
  if (audit === 'Complete') return 'Complete';
  if (audit === 'Partial') return 'Partial 40%';
  if (audit === 'Safe fallback') return 'Safe no-op';
  if (audit === 'Not implemented') return 'Not started';
  return 'Audit needed';
}

const MATRIX_STATUS_OVERRIDES = new Map([
  ['ProjHit', 'Partial 90%'],
  ['FVar', 'Partial 90%'],
  ['SysFVar', 'Partial 90%'],
  ['SysVar', 'Partial 90%'],
  ['Var', 'Partial 90%'],
  ['AuthorName', 'Partial 90%'],
  ['Name', 'Partial 90%'],
  ['P1Name', 'Partial 90%'],
  ['P2Name', 'Partial 90%'],
  ['P3Name', 'Partial 55%'],
  ['P4Name', 'Partial 55%'],
  ['PalNo', 'Partial 85%'],
]);

function syntaxFor(name) {
  if (name === 'Command') return 'Command = "name"';
  if (name === 'AnimElem') return 'AnimElem = element[, operator time]';
  if (name === 'HitDefAttr') return 'HitDefAttr = state-attrs, attack-attrs';
  if (name === 'TeamMode') return 'TeamMode = Single|Simul|Turns';
  if (name === 'TimeMod') return 'TimeMod operator divisor, remainder';
  if (name === 'ProjHit') return 'ProjHit[ID] = boolean[, operator time]';
  const args = FUNCTION_ARGUMENTS.get(name.replace(AXIS, '')) ?? FUNCTION_ARGUMENTS.get(name);
  if (args) return `${name.replace(AXIS, '')}(${args})`;
  return name;
}

function createBaseRecord(name, version = 'WinMUGEN 2002.04.14', reference = OFFICIAL_REFERENCE) {
  const canonicalName = name.replace(AXIS, '').replace(/^(Win|Lose)(KO|Time|Perfect)$/, '$1');
  const audit = auditClassification(name, version);
  const evaluatorImplemented = audit === 'Complete' || audit === 'Partial' || audit === 'Safe fallback';
  return {
    name,
    canonicalName,
    aliases: [name.toLowerCase()],
    caseInsensitive: true,
    syntax: syntaxFor(name),
    arguments: name === 'ProjHit'
      ? 'optional projectile ID suffix, boolean value, optional elapsed-time comparison'
      : FUNCTION_ARGUMENTS.get(canonicalName) ?? (AXIS.test(name) ? 'axis is part of old-style syntax' : 'none'),
    returnType: STRING_RETURN.has(name) ? 'string or enum' : BOOLEAN_RETURN.has(name) ? 'boolean int' : 'number',
    redirectable: !REDIRECT_EXCEPTIONS.has(canonicalName),
    version,
    officialReference: reference,
    officialSummary: NOTES[name] ?? NOTES[canonicalName] ?? `Returns the WinMUGEN ${canonicalName} value described by Elecbyte's Trigger Reference.`,
    syntaxSupported: true,
    parserBehavior: 'CnsParser retains the complete expression string; trigger names are not enumerated in the production parser AST.',
    evaluatorImplemented,
    implementationLocation: evaluatorImplemented ? 'src/core/cns/CnsRuntimeTrigger.ts' : null,
    runtimeDataSource: audit === 'Safe fallback' ? 'fixed compatibility value' : evaluatorImplemented ? 'CnsRuntimeTriggerContext / PlayerState and connected subsystem state' : null,
    argumentSupport: evaluatorImplemented ? 'See syntax and knownLimitations; irregular/optional argument coverage is conservative.' : 'Expression is retained but no correct runtime value is produced.',
    redirectSupport: REDIRECT_EXCEPTIONS.has(canonicalName) ? 'not redirectable by specification' : 'enemy/enemynear/target subset only; root/parent are fallbacks and helper/partner/playerid are missing',
    fallbackBehavior: audit === 'Safe fallback' ? 'Returns a fixed compatibility value.' : audit === 'Parser only' ? 'Unknown runtime term makes the containing trigger false.' : 'No general self fallback is intended for missing redirects.',
    updateTiming: COMPLETE.has(name) ? 'covered for the implemented root-player path' : 'not fully verified against WinMUGEN tick ordering',
    pauseBehavior: ['MoveContact', 'MoveHit', 'MoveGuarded', 'HitPauseTime', 'HitShakeOver', 'ProjHit'].includes(name) ? 'specific hit-pause behavior is connected; global pause edges remain audited as Partial where applicable' : 'not comprehensively verified for hitpause, Pause and SuperPause',
    rootBehavior: evaluatorImplemented ? 'root-player path exists' : 'not implemented',
    helperBehavior: name === 'IsHelper' || name === 'NumHelper' ? 'focused Helper coverage exists' : 'not comprehensively verified',
    targetBehavior: name.startsWith('Target') || name === 'NumTarget' ? 'two-root-player Target registry subset' : 'redirect child behavior only where the redirect resolver supports it',
    projectileBehavior: name === 'ProjHitTime' || name === 'ProjHit'
      ? 'root-owner Projectile hit history is connected and advances on unpaused owner ticks'
      : name.startsWith('Proj') || name === 'NumProj' || name === 'NumProjID' ? 'projectile Trigger integration is absent or fixed fallback' : 'not applicable to direct value source; projectile-owner parity unverified',
    testCoverage: evaluatorImplemented ? 'focused tests exist for the implemented subset; inventory audit records exact Matrix coverage' : 'inventory/Matrix coverage only',
    realCharacterUsage: [],
    matrixStatus: audit,
    canonicalMatrixStatus: MATRIX_STATUS_OVERRIDES.get(name) ?? matrixStatus(audit),
    knownLimitations: audit === 'Complete' ? 'Complete only for the documented scope and available real-character path.' : `${audit}; redirect, entity ownership, pause timing, arguments, or real-character evidence is incomplete as described above.`,
  };
}

export function buildInventory() {
  return [
    ...WINMUGEN_TRIGGERS.map((name) => createBaseRecord(name)),
    ...EXTENSION_TRIGGERS.map(([name, version, reference]) => createBaseRecord(name, version, reference)),
  ].sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

function triggerPattern(name) {
  const axis = name.match(AXIS)?.[1];
  const base = name.replace(AXIS, '');
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const idSuffix = name === 'ProjContact' || name === 'ProjGuarded' || name === 'ProjHit' ? '\\d*' : '';
  return new RegExp(`(^|[^a-z0-9_.])${escaped}${idSuffix}${axis ? `\\s+${axis}` : ''}(?=\\s|\\(|=|!|<|>|,|$)`, 'i');
}

async function collectRealCharacterUsage(records) {
  const { readdir } = await import('node:fs/promises');
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (/\.(cns|cmd|st)$/i.test(entry.name) && !/common1\.cns$/i.test(entry.name)) files.push(path);
    }
  }
  await walk(resolve(ROOT, 'public/chars'));
  for (const record of records) {
    const pattern = triggerPattern(record.name);
    const usage = [];
    for (const file of files) {
      const lines = (await readFile(file, 'utf8')).split(/\r?\n/);
      const hits = [];
      lines.forEach((line, index) => {
        if (/^\s*trigger(?:all|\d+)\s*=/.test(line) && pattern.test(line)) hits.push(index + 1);
      });
      if (hits.length) usage.push({ file: relative(ROOT, file).replaceAll('\\', '/'), count: hits.length, exampleLine: hits[0] });
    }
    record.realCharacterUsage = usage;
  }
}

function parseTriggerMatrix(markdown) {
  const section = markdown.match(/## Trigger Compatibility\r?\n([\s\S]*?)(?=\r?\n## )/)?.[1] ?? '';
  const rows = new Map();
  for (const line of section.split(/\r?\n/)) {
    if (!line.startsWith('|') || /^\|[-: |]+\|$/.test(line)) continue;
    const cells = splitMarkdownRow(line).map((cell) => cell.replaceAll('`', ''));
    if (cells[0] === 'Trigger') continue;
    rows.set(cells[0], cells);
  }
  return rows;
}

function canonicalStatusFor(record, existing) {
  if (record.matrixStatus === 'Complete') return 'Complete';
  if (record.matrixStatus === 'Safe fallback') return 'Safe no-op';
  if (record.matrixStatus === 'Parser only' || record.matrixStatus === 'Not applicable') return 'Audit needed';
  if (record.matrixStatus === 'Not implemented') return 'Not started';
  if (/^(Partial|Fallback) /.test(existing ?? '')) return existing;
  return 'Partial 80%';
}

function noteFor(record, status, existingNote) {
  if (record.matrixStatus === 'Complete' && existingNote) return existingNote;
  if (record.matrixStatus === 'Partial' && /^(Partial|Fallback) /.test(status) && /^Implemented:.*Missing:.*Evidence:/i.test(existingNote ?? '')) return existingNote;
  if (record.matrixStatus === 'Partial') return `Implemented: ${record.evaluatorImplemented ? 'The current evaluator has a runtime path for the documented subset.' : 'The expression is retained.'} Missing: strict Issue #82 Complete evidence across arguments, redirects, entity ownership, pause timing, and real-character execution. Evidence: machine-readable inventory, current implementation, and focused-test audit.`;
  if (record.matrixStatus === 'Safe fallback') return `Recognized by the CNS runtime without changing game state; returns a fixed compatibility value instead of WinMUGEN semantics. See the machine-readable Trigger inventory.`;
  if (record.matrixStatus === 'Parser only') return 'The CNS parser retains the expression string, but the runtime evaluator has no correct value source; unknown evaluation becomes false.';
  if (record.matrixStatus === 'Not implemented') return 'Neither a supported syntax path nor a correct runtime value source was found.';
  if (record.matrixStatus === 'Not applicable') return `${record.version}; tracked to prevent later-version or pseudo-trigger syntax from being mixed into the WinMUGEN scope.`;
  return existingNote ?? record.knownLimitations;
}

function statusDetail(status) {
  if (status === 'Complete') return ['complete', 100];
  const partial = status.match(/^Partial (\d+)%$/);
  if (partial) return ['partial', Number(partial[1])];
  const fallback = status.match(/^Fallback (\d+)%$/);
  if (fallback) return ['fallback', Number(fallback[1])];
  if (status === 'Safe no-op') return ['safe-noop', null];
  if (status === 'Issue ready') return ['issue-ready', null];
  if (status === 'Not started') return ['not-started', null];
  return ['audit-needed', null];
}

async function writeMatrix(records) {
  const markdownPath = resolve(ROOT, 'docs/webmugen/winmugen-compatibility-matrix.md');
  let markdown = await readFile(markdownPath, 'utf8');
  const existing = parseTriggerMatrix(markdown);
  const lines = [
    '## Trigger Compatibility',
    '',
    '| Trigger | Audit classification | Status | Notes |',
    '|---|---|---|---|',
  ];
  const htmlRows = [];
  for (const record of records) {
    const old = existing.get(record.name);
    const oldStatus = old?.at(-2);
    const oldNote = old?.at(-1);
    const status = canonicalStatusFor(record, oldStatus);
    const note = noteFor(record, status, oldNote);
    lines.push(`| ${record.name} | ${record.matrixStatus} | ${status} | ${note} |`);
    const [kind, progress] = statusDetail(status);
    htmlRows.push([record.name, record.matrixStatus, record.matrixStatus, kind, note, note, progress]);
  }
  const replacement = `${lines.join('\n')}\n`;
  markdown = markdown.replace(/## Trigger Compatibility\r?\n[\s\S]*?(?=\r?\n## Redirects \/ Player References)/, replacement.trimEnd());
  // Repair the legacy migration helper's non-idempotent wrapping if a caller
  // accidentally ran it on an already-canonical Matrix. This exact sentence
  // is generated by that helper and is safe to collapse mechanically.
  markdown = markdown.replaceAll('Implemented: Implemented:', 'Implemented:');
  const legacySuffix = 'Missing: remaining WinMUGEN semantics not identified as covered by this row. Evidence: current implemented behavior, runtime inventory, and focused-test inventory.';
  markdown = markdown.replaceAll(`${legacySuffix} ${legacySuffix}`, legacySuffix);
  await writeFile(markdownPath, markdown, 'utf8');

  const htmlPath = resolve(ROOT, 'docs/webmugen/winmugen-compatibility-matrix.html');
  let html = await readFile(htmlPath, 'utf8');
  html = html.replace(
    '<a href="https://www.elecbyte.com/mugendocs-11b1/trigger.html">Trigger Reference</a>',
    '<a href="https://bluesura.github.io/MUGEN/document/Official/2002.04.14/trigger.html">WinMUGEN 2002.04.14 Trigger Reference</a> / <a href="https://www.elecbyte.com/mugendocs-11b1/trigger.html">MUGEN 1.1 Trigger Reference</a>',
  );
  html = html.replace(/const triggerRows=.*?;\r?\n/, `const triggerRows=${JSON.stringify(htmlRows)};\n`);
  await writeFile(htmlPath, html, 'utf8');
}

export async function auditInventory({ write = false } = {}) {
  const records = buildInventory();
  await collectRealCharacterUsage(records);
  if (write) await writeMatrix(records);
  const matrixPath = resolve(ROOT, 'docs/webmugen/winmugen-compatibility-matrix.md');
  const matrixRows = parseTriggerMatrix(await readFile(matrixPath, 'utf8'));
  const inventoryNames = new Set(records.map((record) => record.name));
  const errors = [];
  for (const record of records) {
    const row = matrixRows.get(record.name);
    if (!row) errors.push(`Matrix is missing Trigger: ${record.name}`);
    else if (row.length >= 4 && row[1] !== record.matrixStatus) errors.push(`Matrix audit classification mismatch: ${record.name}: ${row[1]} != ${record.matrixStatus}`);
  }
  for (const name of matrixRows.keys()) if (!inventoryNames.has(name)) errors.push(`Inventory is missing Matrix Trigger: ${name}`);

  const runtimeSource = await readFile(resolve(ROOT, 'src/core/cns/CnsRuntimeTrigger.ts'), 'utf8');
  const sourceSlice = runtimeSource.slice(runtimeSource.indexOf('function getBooleanSource'), runtimeSource.indexOf('function getRedirectNumberSource'));
  const evaluatorCases = [...sourceSlice.matchAll(/case\s+'([^']+)'/g)].map((match) => match[1]);
  const redirectsAndInternals = new Set(['root', 'parent', 'enemynear']);
  const normalizedInventory = new Set(records.map((record) => record.name.toLowerCase().replaceAll(' ', '')));
  for (const evaluatorCase of evaluatorCases) {
    const normalized = evaluatorCase.replaceAll(' ', '');
    if (!redirectsAndInternals.has(evaluatorCase) && !normalizedInventory.has(normalized)) {
      errors.push(`Runtime evaluator case is not inventoried: ${evaluatorCase}`);
    }
  }

  const counts = Object.fromEntries(['Not implemented', 'Parser only', 'Safe fallback', 'Partial', 'Complete', 'Not applicable'].map((status) => [status, records.filter((record) => record.matrixStatus === status).length]));
  const output = {
    schemaVersion: 1,
    generatedAt: 'reproducible: run npm run trigger:audit -- --write',
    scope: 'Elecbyte WinMUGEN 2002.04.14 plus explicitly versioned later/compatibility entries',
    references: [OFFICIAL_REFERENCE, ELECBYTE_10_REFERENCE, ELECBYTE_11_REFERENCE],
    counts,
    records,
  };
  if (write) await writeFile(resolve(ROOT, 'docs/webmugen/winmugen-trigger-inventory.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  return { errors, output, matrixRows };
}

async function main() {
  const write = process.argv.includes('--write');
  const { errors, output } = await auditInventory({ write });
  console.log(`WinMUGEN Trigger inventory: ${output.records.length} rows; ${Object.entries(output.counts).map(([key, value]) => `${key}=${value}`).join(', ')}`);
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
