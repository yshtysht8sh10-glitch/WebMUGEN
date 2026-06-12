import type {
  AirAction,
  AirCollisionBox,
  AirClsnSet,
  AirDocument,
  AirElement,
} from './AirTypes';

export function parseAirText(text: string): AirDocument {
  const actions: AirAction[] = [];
  let currentAction: AirAction | null = null;

  let defaultClsn1: AirClsnSet = [];
  let defaultClsn2: AirClsnSet = [];
  let pendingClsn1: AirClsnSet | null = null;
  let pendingClsn2: AirClsnSet | null = null;

  let writingBoxes: AirClsnSet | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripComment(rawLine).trim();
    if (!line) continue;

    const beginActionMatch = line.match(/^\[?\s*Begin\s+Action\s+(-?\d+)\s*\]?$/i);
    if (beginActionMatch) {
      currentAction = {
        actionNo: Number(beginActionMatch[1]),
        elements: [],
        loopStartIndex: null,
      };
      actions.push(currentAction);
      defaultClsn1 = [];
      defaultClsn2 = [];
      pendingClsn1 = null;
      pendingClsn2 = null;
      writingBoxes = null;
      continue;
    }

    if (!currentAction) continue;

    if (/^LoopStart$/i.test(line)) {
      currentAction.loopStartIndex = currentAction.elements.length;
      continue;
    }

    const clsnDefaultMatch = line.match(/^Clsn([12])Default\s*:\s*\d+/i);
    if (clsnDefaultMatch) {
      if (clsnDefaultMatch[1] === '1') {
        defaultClsn1 = [];
        writingBoxes = defaultClsn1;
      } else {
        defaultClsn2 = [];
        writingBoxes = defaultClsn2;
      }
      continue;
    }

    const clsnMatch = line.match(/^Clsn([12])\s*:\s*\d+/i);
    if (clsnMatch) {
      if (clsnMatch[1] === '1') {
        pendingClsn1 = [];
        writingBoxes = pendingClsn1;
      } else {
        pendingClsn2 = [];
        writingBoxes = pendingClsn2;
      }
      continue;
    }

    const clsnBox = parseClsnBox(line);
    if (clsnBox && writingBoxes) {
      writingBoxes.push(clsnBox);
      continue;
    }

    const element = parseAirElement(line);
    if (element) {
      currentAction.elements.push({
        ...element,
        clsn1: pendingClsn1 ? cloneBoxes(pendingClsn1) : cloneBoxes(defaultClsn1),
        clsn2: pendingClsn2 ? cloneBoxes(pendingClsn2) : cloneBoxes(defaultClsn2),
      });
      pendingClsn1 = null;
      pendingClsn2 = null;
      writingBoxes = null;
    }
  }

  return { actions };
}

function parseClsnBox(line: string): AirCollisionBox | null {
  const match = line.match(/^Clsn[12]\[\d+\]\s*=\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)/i);
  if (!match) return null;

  const x1 = Number(match[1]);
  const y1 = Number(match[2]);
  const x2 = Number(match[3]);
  const y2 = Number(match[4]);

  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    right: Math.max(x1, x2),
    bottom: Math.max(y1, y2),
  };
}

function cloneBoxes(boxes: AirClsnSet): AirClsnSet {
  return boxes.map((box) => ({ ...box }));
}

function parseAirElement(line: string): Omit<AirElement, 'clsn1' | 'clsn2'> | null {
  const parts = line.split(',').map((part) => part.trim());
  if (parts.length < 5) return null;

  const groupNo = Number(parts[0]);
  const imageNo = Number(parts[1]);
  const offsetX = Number(parts[2]);
  const offsetY = Number(parts[3]);
  const duration = Number(parts[4]);
  const flip = parts[5] ?? '';

  if ([groupNo, imageNo, offsetX, offsetY, duration].some((value) => Number.isNaN(value))) {
    return null;
  }

  return {
    groupNo,
    imageNo,
    offsetX,
    offsetY,
    duration,
    flip,
  };
}

function stripComment(line: string): string {
  const semicolonIndex = line.indexOf(';');
  return semicolonIndex >= 0 ? line.slice(0, semicolonIndex) : line;
}
