import type { CnsStateController } from '../../mugen/common/cnsTypes';

export type RuntimeControllerCommand =
  | { type: 'pause'; time: number; moveTime: number }
  | { type: 'superpause'; time: number; moveTime: number; darken: boolean }
  | { type: 'helper'; id: number | null; stateNo: number; x: number; y: number }
  | { type: 'targetdrop' }
  | { type: 'targetbind'; time: number; x: number; y: number };

export function toRuntimeControllerCommand(controller: CnsStateController): RuntimeControllerCommand | null {
  const type = controller.type.toLowerCase();

  if (type === 'pause') {
    return { type: 'pause', time: num(controller, 'time') ?? 0, moveTime: num(controller, 'movetime') ?? 0 };
  }

  if (type === 'superpause') {
    return {
      type: 'superpause',
      time: num(controller, 'time') ?? 0,
      moveTime: num(controller, 'movetime') ?? 0,
      darken: (num(controller, 'darken') ?? 1) !== 0,
    };
  }

  if (type === 'helper') {
    return {
      type: 'helper',
      id: num(controller, 'id'),
      stateNo: num(controller, 'stateno') ?? num(controller, 'value') ?? 0,
      x: readPos(controller)[0],
      y: readPos(controller)[1],
    };
  }

  if (type === 'targetdrop') {
    return { type: 'targetdrop' };
  }

  if (type === 'targetbind') {
    const pos = readPos(controller);
    return { type: 'targetbind', time: num(controller, 'time') ?? 1, x: pos[0], y: pos[1] };
  }

  return null;
}

function readPos(controller: CnsStateController): [number, number] {
  const value = controller.params.pos;
  if (typeof value === 'string') {
    const parts = value.split(',').map((part) => Number(part.trim()));
    return [Number.isFinite(parts[0]) ? parts[0] : 0, Number.isFinite(parts[1]) ? parts[1] : 0];
  }

  return [num(controller, 'x') ?? 0, num(controller, 'y') ?? 0];
}

function num(controller: CnsStateController, key: string): number | null {
  const value = controller.params[key.toLowerCase()];
  if (typeof value === 'number') return value;
  const parsed = Number(String(value ?? '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}
