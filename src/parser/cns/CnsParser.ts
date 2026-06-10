import type {
  CnsDocument,
  CnsStateController,
  CnsStateDefinition,
  CnsValue,
} from '../../mugen/common/cnsTypes';

type ParserContext = {
  currentState: CnsStateDefinition | null;
  currentController: CnsStateController | null;
};

export function parseCnsText(text: string): CnsDocument {
  const document: CnsDocument = {
    versionHint: 'unknown',
    states: [],
  };

  const context: ParserContext = {
    currentState: null,
    currentController: null,
  };

  const lines = text.split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = stripComment(rawLine).trim();

    if (line.length === 0) {
      return;
    }

    const sectionName = parseSectionName(line);
    if (sectionName !== null) {
      handleSection(sectionName, document, context, lineNumber);
      return;
    }

    const keyValue = parseKeyValue(line);
    if (keyValue === null) {
      return;
    }

    handleKeyValue(keyValue.key, keyValue.value, context, lineNumber);
  });

  return document;
}

function stripComment(line: string): string {
  const commentIndex = line.indexOf(';');
  if (commentIndex < 0) {
    return line;
  }

  return line.slice(0, commentIndex);
}

function parseSectionName(line: string): string | null {
  const match = line.match(/^\[(.+)]$/);
  return match ? match[1].trim() : null;
}

function handleSection(
  sectionName: string,
  document: CnsDocument,
  context: ParserContext,
  lineNumber: number,
): void {
  const stateDefMatch = sectionName.match(/^StateDef\s+(-?\d+)$/i);
  if (stateDefMatch) {
    const state: CnsStateDefinition = {
      stateNo: Number(stateDefMatch[1]),
      controllers: [],
    };

    document.states.push(state);
    context.currentState = state;
    context.currentController = null;
    return;
  }

  if (/^State\s+/i.test(sectionName)) {
    if (context.currentState === null) {
      throw new Error(`State controller appears before StateDef at line ${lineNumber}.`);
    }

    const controller: CnsStateController = {
      type: 'Unknown',
      triggers: [],
      params: {},
      source: {
        line: lineNumber,
      },
    };

    context.currentState.controllers.push(controller);
    context.currentController = controller;
  }
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

function handleKeyValue(
  rawKey: string,
  rawValue: string,
  context: ParserContext,
  lineNumber: number,
): void {
  const key = rawKey.toLowerCase();

  if (context.currentController !== null) {
    if (key.startsWith('trigger')) {
      const triggerIndex = Number(key.replace('trigger', ''));
      context.currentController.triggers.push({
        index: Number.isFinite(triggerIndex) ? triggerIndex : 0,
        expression: rawValue,
      });
      return;
    }

    if (key === 'type') {
      context.currentController.type = rawValue;
      return;
    }

    context.currentController.params[key] = parseCnsValue(rawValue);
    return;
  }

  if (context.currentState !== null) {
    applyStateDefValue(context.currentState, key, rawValue);
    return;
  }

  throw new Error(`Key-value pair appears outside a section at line ${lineNumber}.`);
}

function applyStateDefValue(state: CnsStateDefinition, key: string, rawValue: string): void {
  switch (key) {
    case 'type':
      state.stateType = rawValue;
      break;
    case 'movetype':
      state.moveType = rawValue;
      break;
    case 'physics':
      state.physics = rawValue;
      break;
    case 'anim':
      state.initialAnim = Number(rawValue);
      break;
    case 'ctrl':
      state.ctrl = rawValue.trim() !== '0';
      break;
    default:
      break;
  }
}

export function parseCnsValue(rawValue: string): CnsValue {
  const value = rawValue.trim();

  if (value.includes(',')) {
    return value.split(',').map((part) => parseCnsValue(part.trim())) as number[] | string[];
  }

  if (value === '0') {
    return 0;
  }

  if (value === '1') {
    return 1;
  }

  const numericValue = Number(value);
  if (!Number.isNaN(numericValue)) {
    return numericValue;
  }

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
