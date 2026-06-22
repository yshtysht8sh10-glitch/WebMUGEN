import { normalizeInputTokens, type InputToken } from '../input/InputTypes';

export type CmdCommandStep = {
  tokens: InputToken[];
  hold: boolean;
  release: boolean;
};

export type CmdCommandDefinition = {
  name: string;
  command: string;
  time: number;
  steps: CmdCommandStep[];
};

export function parseCmdCommands(text: string): CmdCommandDefinition[] {
  const sections = splitCommandSections(text);

  return sections
    .map(parseCommandSection)
    .filter((definition): definition is CmdCommandDefinition => definition !== null);
}

export function parseCommandExpression(command: string): CmdCommandStep[] {
  return command
    .split(',')
    .map((part) => parseCommandStep(part.trim()))
    .filter((step): step is CmdCommandStep => step !== null);
}

function splitCommandSections(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const sections: string[] = [];
  let current: string[] | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (/^\[Command\]$/i.test(line)) {
      if (current) {
        sections.push(current.join('\n'));
      }
      current = [];
      continue;
    }

    if (/^\[/.test(line)) {
      if (current) {
        sections.push(current.join('\n'));
      }
      current = null;
      continue;
    }

    if (current) {
      current.push(rawLine);
    }
  }

  if (current) {
    sections.push(current.join('\n'));
  }

  return sections;
}

function parseCommandSection(section: string): CmdCommandDefinition | null {
  const values = new Map<string, string>();

  for (const rawLine of section.split(/\r?\n/)) {
    const line = stripComment(rawLine).trim();
    const match = /^([^=]+?)\s*=\s*(.+)$/.exec(line);
    if (!match) {
      continue;
    }

    values.set(match[1].trim().toLowerCase(), unquote(match[2].trim()));
  }

  const name = values.get('name');
  const command = values.get('command');
  if (!name || !command) {
    return null;
  }

  return {
    name,
    command,
    time: readNumber(values.get('time')) ?? 15,
    steps: parseCommandExpression(command),
  };
}

function parseCommandStep(part: string): CmdCommandStep | null {
  if (!part) {
    return null;
  }

  let text = part;
  const hold = text.includes('$') || text.includes('/');
  const release = text.includes('~');
  text = text.replace(/[~$/]/g, '').replace(/[+]/g, ' ');

  const tokens = normalizeInputTokens(text.split(/\s+/));
  if (tokens.length === 0) {
    return null;
  }

  return { tokens, hold, release };
}

function stripComment(line: string): string {
  const index = line.indexOf(';');
  return index >= 0 ? line.slice(0, index) : line;
}

function unquote(value: string): string {
  return value.replace(/^["']|["']$/g, '');
}

function readNumber(value: string | undefined): number | null {
  if (value === undefined) {
    return null;
  }

  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}
