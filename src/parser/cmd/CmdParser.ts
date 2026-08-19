import type { CmdCommand, CmdDocument } from './CmdTypes';

export function parseCmdText(text: string): CmdDocument {
  const commands: CmdCommand[] = [];

  let currentCommand: Partial<CmdCommand> | null = null;
  let currentSection: 'command' | 'defaults' | 'other' = 'other';
  let defaultTime: number | undefined;
  let defaultBufferTime: number | undefined;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripComment(rawLine).trim();

    if (line.length === 0) {
      continue;
    }

    const section = line.match(/^\[([^\]]+)]$/);
    if (section) {
      if (isCompleteCommand(currentCommand)) {
        commands.push(currentCommand);
      }

      if (/^command$/i.test(section[1].trim())) {
        currentSection = 'command';
        currentCommand = {};
      } else {
        currentSection = /^defaults$/i.test(section[1].trim()) ? 'defaults' : 'other';
        currentCommand = null;
      }
      continue;
    }

    const keyValue = parseKeyValue(line);
    if (keyValue === null) {
      continue;
    }

    if (currentSection === 'defaults') {
      if (keyValue.key.toLowerCase() === 'command.time') {
        defaultTime = Number(keyValue.value);
      } else if (keyValue.key.toLowerCase() === 'command.buffer.time') {
        defaultBufferTime = Number(keyValue.value);
      }
      continue;
    }

    if (currentSection !== 'command' || currentCommand === null) {
      continue;
    }

    switch (keyValue.key.toLowerCase()) {
      case 'name':
        currentCommand.name = unquote(keyValue.value);
        break;

      case 'command':
        currentCommand.command = unquote(keyValue.value);
        break;

      case 'time':
        currentCommand.time = Number(keyValue.value);
        break;

      case 'buffer.time':
        currentCommand.bufferTime = Number(keyValue.value);
        break;

      default:
        break;
    }
  }

  if (isCompleteCommand(currentCommand)) {
    commands.push(currentCommand);
  }

  return {
    commands: commands.map((command) => ({
      ...command,
      ...(command.time === undefined && defaultTime !== undefined ? { time: defaultTime } : {}),
      ...(command.bufferTime === undefined && defaultBufferTime !== undefined
        ? { bufferTime: defaultBufferTime }
        : {}),
    })),
  };
}

export function findCommand(document: CmdDocument, name: string): CmdCommand | undefined {
  return document.commands.find((command) => command.name === name);
}

function stripComment(line: string): string {
  const index = line.indexOf(';');
  return index >= 0 ? line.slice(0, index) : line;
}

function parseKeyValue(line: string): { key: string; value: string } | null {
  const match = line.match(/^([^=]+?)\s*=\s*(.+)$/);
  if (!match) {
    return null;
  }

  return {
    key: match[1].trim(),
    value: match[2].trim(),
  };
}

function unquote(value: string): string {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function isCompleteCommand(command: Partial<CmdCommand> | null): command is CmdCommand {
  return (
    command !== null &&
    typeof command.name === 'string' &&
    command.name.length > 0 &&
    typeof command.command === 'string' &&
    command.command.length > 0
  );
}
