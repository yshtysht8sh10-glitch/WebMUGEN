import type { CmdCommand, CmdDocument } from '../parser/cmd/CmdTypes';

export type CmdControlHelpLine = {
  name: string;
  command: string;
  display: string;
};

const PRIORITY_COMMANDS = [
  'triplekfpalm',
  'qcf_x',
  'qcf_y',
  'qcf_xy',
  'qcb_a',
  'qcb_b',
  'ff_ab',
  'ff_a',
  'ff_b',
  'ff',
  'bb',
  'down_a',
  'down_b',
  'recovery',
];

export function formatCmdControlHelp(document: CmdDocument, maxLines = 10): string[] {
  const lines = selectCommandHelpLines(document, maxLines);

  if (lines.length === 0) {
    return ['CMD: -'];
  }

  return lines.map((line) => `${line.name}: ${line.display}`);
}

export function selectCommandHelpLines(document: CmdDocument, maxLines = 10): CmdControlHelpLine[] {
  const seen = new Set<string>();
  const ordered = [...document.commands].sort(compareCommandHelpPriority);
  const lines: CmdControlHelpLine[] = [];

  for (const command of ordered) {
    const normalizedName = command.name.toLowerCase();
    if (seen.has(normalizedName) || isLowValueCommand(command)) {
      continue;
    }

    seen.add(normalizedName);
    lines.push({
      name: command.name,
      command: command.command,
      display: formatCommandExpression(command.command),
    });

    if (lines.length >= maxLines) {
      break;
    }
  }

  return lines;
}

export function formatCommandExpression(command: string): string {
  return command
    .split(',')
    .map((step) => formatCommandStep(step.trim()))
    .filter((step) => step.length > 0)
    .join(', ');
}

function compareCommandHelpPriority(left: CmdCommand, right: CmdCommand): number {
  const leftRank = commandRank(left.name);
  const rightRank = commandRank(right.name);
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  return left.name.localeCompare(right.name);
}

function commandRank(name: string): number {
  const normalized = name.toLowerCase();
  const index = PRIORITY_COMMANDS.indexOf(normalized);
  return index >= 0 ? index : PRIORITY_COMMANDS.length;
}

function isLowValueCommand(command: CmdCommand): boolean {
  const normalized = command.name.toLowerCase();
  return ['a', 'b', 'c', 'x', 'y', 'z', 'start', 'holdfwd', 'holdback', 'holdup', 'holddown'].includes(normalized);
}

function formatCommandStep(step: string): string {
  if (!step) {
    return '';
  }

  return step
    .split('+')
    .map((token) => formatCommandToken(token.trim()))
    .filter((token) => token.length > 0)
    .join('+');
}

function formatCommandToken(token: string): string {
  const stripped = token.replace(/[~/$]/g, '').toUpperCase();

  switch (stripped) {
    case 'D':
      return '↓';
    case 'U':
      return '↑';
    case 'F':
      return '→';
    case 'B':
      return '←';
    case 'DF':
      return '↓→';
    case 'DB':
      return '↓←';
    case 'UF':
      return '↑→';
    case 'UB':
      return '↑←';
    default:
      return stripped.toLowerCase();
  }
}
