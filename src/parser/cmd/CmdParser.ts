import type { CmdCommand, CmdDocument } from './CmdTypes';

export function parseCmdText(text: string): CmdDocument {
  const document: CmdDocument = {
    commands: [],
  };

  let currentCommand: Partial<CmdCommand> | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripComment(rawLine).trim();

    if (line.length === 0) {
      continue;
    }

    if (/^\[Command]$/i.test(line)) {
      if (isCompleteCommand(currentCommand)) {
        document.commands.push(currentCommand);
      }

      currentCommand = {};
      continue;
    }

    if (currentCommand === null) {
      continue;
    }

    const keyValue = parseKeyValue(line);
    if (keyValue === null) {
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
    document.commands.push(currentCommand);
  }

  return document;
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
