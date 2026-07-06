import type {
  CnsDocument,
  CnsMetadataSection,
  CnsStateController,
  CnsStateDefinition,
  CnsTrigger,
  CnsValue,
} from '../../mugen/common/cnsTypes';

type CurrentSection =
  | { kind: 'statedef'; state: CnsStateDefinition }
  | { kind: 'controller'; controller: CnsStateController }
  | { kind: 'metadata'; section: CnsMetadataSection }
  | null;

export type CnsParseOptions = {
  sourceFile?: string;
};

export function parseCnsText(text: string, options: CnsParseOptions = {}): CnsDocument {
  const states: CnsStateDefinition[] = [];
  const metadataSections: CnsMetadataSection[] = [];
  let currentState: CnsStateDefinition | null = null;
  let current: CurrentSection = null;

  const lines = text.split(/\r?\n/);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const rawLine = lines[lineIndex];
    const line = stripComment(rawLine).trim();

    if (!line) {
      continue;
    }

    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      const sectionName = sectionMatch[1].trim();
      const stateDefMatch = sectionName.match(/^statedef\s+(-?\d+)$/i);
      if (stateDefMatch) {
        currentState = {
          stateNo: Number(stateDefMatch[1]),
          sourceFile: options.sourceFile,
          sourceLine: lineIndex + 1,
          controllers: [],
        };
        states.push(currentState);
        current = { kind: 'statedef', state: currentState };
        continue;
      }

      const controllerMatch = sectionName.match(/^state\s+(-?\d+)\s*,\s*(.+)$/i);
      if (controllerMatch) {
        if (!currentState) {
          currentState = {
            stateNo: Number(controllerMatch[1]),
            sourceFile: options.sourceFile,
            sourceLine: lineIndex + 1,
            controllers: [],
          };
          states.push(currentState);
        }

        const controller: CnsStateController = {
          type: '',
          triggers: [],
          params: {},
          sourceFile: options.sourceFile,
          sourceLine: lineIndex + 1,
        };
        currentState.controllers.push(controller);
        current = { kind: 'controller', controller };
        continue;
      }

      const metadataSection: CnsMetadataSection = {
        name: sectionName,
        values: {},
      };
      metadataSections.push(metadataSection);
      current = { kind: 'metadata', section: metadataSection };
      continue;
    }

    const equalsIndex = line.indexOf('=');
    if (equalsIndex < 0) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim().toLowerCase();
    const valueText = line.slice(equalsIndex + 1).trim();
    const value = parseValue(valueText);

    if (!current) {
      // Real-world MUGEN CNS files sometimes contain loose metadata or labels.
      // Ignore key-value pairs until a known section starts.
      continue;
    }

    if (current.kind === 'statedef') {
      applyStateDefValue(current.state, key, value);
      continue;
    }

    if (current.kind === 'controller') {
      applyControllerValue(current.controller, key, valueText, value);
      continue;
    }

    current.section.values[key] = value;
  }

  return {
    states,
    metadataSections,
  };
}

function applyStateDefValue(state: CnsStateDefinition, key: string, value: CnsValue): void {
  switch (key) {
    case 'type':
      state.stateType = String(value);
      break;
    case 'movetype':
      state.moveType = String(value);
      break;
    case 'physics':
      state.physics = String(value);
      break;
    case 'anim':
      state.initialAnim = Number(value);
      break;
    case 'ctrl':
      state.ctrl = Number(value) !== 0;
      break;
    case 'poweradd':
      state.powerAdd = Number(value);
      break;
    case 'juggle':
      state.juggle = Number(value);
      break;
    case 'facep2':
      state.faceP2 = Number(value) !== 0;
      break;
    default:
      break;
  }
}

function applyControllerValue(
  controller: CnsStateController,
  key: string,
  valueText: string,
  value: CnsValue,
): void {
  if (key === 'type') {
    controller.type = String(value);
    return;
  }

  if (/^trigger(?:all|\d+)$/i.test(key)) {
    controller.triggers.push({
      name: key,
      expression: valueText,
    });
    return;
  }

  controller.params[key] = value;
}

function stripComment(line: string): string {
  const semicolonIndex = line.indexOf(';');
  return semicolonIndex >= 0 ? line.slice(0, semicolonIndex) : line;
}

function parseValue(valueText: string): CnsValue {
  const commaParts = splitCommaValues(valueText);

  if (commaParts.length > 1) {
    return commaParts.map(parseSingleValue);
  }

  return parseSingleValue(valueText);
}

function splitCommaValues(valueText: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuote = false;

  for (const char of valueText) {
    if (char === '"') {
      inQuote = !inQuote;
      current += char;
      continue;
    }

    if (char === ',' && !inQuote) {
      parts.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  parts.push(current.trim());
  return parts.filter((part) => part.length > 0);
}

function parseSingleValue(valueText: string): string | number | boolean {
  const trimmed = valueText.trim();

  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  if (/^(true|false)$/i.test(trimmed)) {
    return /^true$/i.test(trimmed);
  }

  return trimmed.replace(/^"(.*)"$/, '$1');
}
