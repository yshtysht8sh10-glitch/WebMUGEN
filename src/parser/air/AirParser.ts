import type { AirAction, AirCollisionBox, AirDocument, AirElement } from './AirTypes';

type PendingClsn = {
  type: 'Clsn1' | 'Clsn2';
  boxes: AirCollisionBox[];
  isDefault: boolean;
};

export function parseAirText(text: string): AirDocument {
  const document: AirDocument = { actions: [] };
  let currentAction: AirAction | null = null;
  let pendingClsn: PendingClsn | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripComment(rawLine).trim();
    if (line.length === 0) continue;

    const actionNo = parseBeginAction(line);
    if (actionNo !== null) {
      currentAction = {
        actionNo,
        elements: [],
        defaultClsn1: [],
        defaultClsn2: [],
      };
      pendingClsn = null;
      document.actions.push(currentAction);
      continue;
    }

    if (currentAction === null) continue;

    const clsnHeader = parseClsnHeader(line);
    if (clsnHeader !== null) {
      pendingClsn = { ...clsnHeader, boxes: [] };
      continue;
    }

    const clsnBox = parseClsnBox(line);
    if (clsnBox !== null && pendingClsn !== null) {
      pendingClsn.boxes.push(clsnBox);
      if (pendingClsn.isDefault) {
        if (pendingClsn.type === 'Clsn1') currentAction.defaultClsn1 = [...pendingClsn.boxes];
        if (pendingClsn.type === 'Clsn2') currentAction.defaultClsn2 = [...pendingClsn.boxes];
      }
      continue;
    }

    const element = parseAirElement(line, currentAction, pendingClsn);
    if (element !== null) {
      currentAction.elements.push(element);
      if (pendingClsn !== null && !pendingClsn.isDefault) {
        pendingClsn = null;
      }
    }
  }

  return document;
}

export function findAirAction(document: AirDocument, actionNo: number): AirAction | undefined {
  return document.actions.find((action) => action.actionNo === actionNo);
}

function stripComment(line: string): string {
  const index = line.indexOf(';');
  return index >= 0 ? line.slice(0, index) : line;
}

function parseBeginAction(line: string): number | null {
  const match = line.match(/^Begin\s+Action\s+(-?\d+)$/i);
  return match ? Number(match[1]) : null;
}

function parseClsnHeader(line: string): { type: 'Clsn1' | 'Clsn2'; isDefault: boolean } | null {
  const match = line.match(/^(Clsn[12])(Default)?\s*:\s*\d+$/i);
  if (!match) return null;

  return {
    type: match[1].toLowerCase() === 'clsn1' ? 'Clsn1' : 'Clsn2',
    isDefault: match[2] !== undefined,
  };
}

function parseClsnBox(line: string): AirCollisionBox | null {
  const match = line.match(/^Clsn[12]\[\d+]\s*=\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)$/i);
  if (!match) return null;

  return {
    left: Number(match[1]),
    top: Number(match[2]),
    right: Number(match[3]),
    bottom: Number(match[4]),
  };
}

function parseAirElement(
  line: string,
  currentAction: AirAction,
  pendingClsn: PendingClsn | null,
): AirElement | null {
  const parts = line.split(',').map((part) => part.trim());
  if (parts.length < 5) return null;

  const [groupNo, imageNo, offsetX, offsetY, duration] = parts.slice(0, 5).map(Number);
  if ([groupNo, imageNo, offsetX, offsetY, duration].some(Number.isNaN)) return null;

  const clsn1 =
    pendingClsn !== null && pendingClsn.type === 'Clsn1' && !pendingClsn.isDefault
      ? [...pendingClsn.boxes]
      : [...currentAction.defaultClsn1];

  const clsn2 =
    pendingClsn !== null && pendingClsn.type === 'Clsn2' && !pendingClsn.isDefault
      ? [...pendingClsn.boxes]
      : [...currentAction.defaultClsn2];

  return {
    groupNo,
    imageNo,
    offsetX,
    offsetY,
    duration,
    flip: parts[5],
    blend: parts[6],
    clsn1,
    clsn2,
  };
}
