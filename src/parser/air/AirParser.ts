import type { AirAction, AirDocument, AirElement } from './AirTypes';

export function parseAirText(text: string): AirDocument {
  const document: AirDocument = {
    actions: [],
  };

  let currentAction: AirAction | null = null;
  const lines = text.split(/\r?\n/);

  lines.forEach((rawLine) => {
    const line = stripComment(rawLine).trim();

    if (line.length === 0) {
      return;
    }

    const actionNo = parseBeginAction(line);
    if (actionNo !== null) {
      currentAction = {
        actionNo,
        elements: [],
      };
      document.actions.push(currentAction);
      return;
    }

    if (currentAction === null) {
      return;
    }

    const element = parseAirElement(line);
    if (element !== null) {
      currentAction.elements.push(element);
    }
  });

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

function parseAirElement(line: string): AirElement | null {
  const parts = line.split(',').map((part) => part.trim());

  if (parts.length < 5) {
    return null;
  }

  const groupNo = Number(parts[0]);
  const imageNo = Number(parts[1]);
  const offsetX = Number(parts[2]);
  const offsetY = Number(parts[3]);
  const duration = Number(parts[4]);

  if (
    Number.isNaN(groupNo) ||
    Number.isNaN(imageNo) ||
    Number.isNaN(offsetX) ||
    Number.isNaN(offsetY) ||
    Number.isNaN(duration)
  ) {
    return null;
  }

  return {
    groupNo,
    imageNo,
    offsetX,
    offsetY,
    duration,
    flip: parts[5],
    blend: parts[6],
  };
}
