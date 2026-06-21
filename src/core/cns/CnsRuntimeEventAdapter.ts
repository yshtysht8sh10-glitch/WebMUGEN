import type { CnsStateController } from '../../mugen/common/cnsTypes';
import type { RuntimeEvent } from '../runtime/RuntimeEventQueue';

export function cnsControllerToRuntimeEvent(controller: CnsStateController, ownerId: 1 | 2): RuntimeEvent | null {
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

  if (type === 'explod') {
    const pos = readPair(controller, 'pos');
    return {
      type: 'explod',
      id: num(controller, 'id'),
      animNo: num(controller, 'anim') ?? 0,
      x: pos[0],
      y: pos[1],
      removeTime: num(controller, 'removetime'),
    };
  }

  if (type === 'removeexplod') {
    return { type: 'removeExplod', id: num(controller, 'id') ?? -1 };
  }

  if (type === 'helper') {
    const pos = readPair(controller, 'pos');
    return {
      type: 'helper',
      id: num(controller, 'id'),
      ownerId,
      stateNo: num(controller, 'stateno') ?? num(controller, 'value') ?? 0,
      x: pos[0],
      y: pos[1],
      lifeTime: num(controller, 'lifetime'),
    };
  }

  if (type === 'targetbind') {
    const pos = readPair(controller, 'pos');
    return {
      type: 'targetBind',
      ownerId,
      targetId: ownerId === 1 ? 2 : 1,
      time: num(controller, 'time') ?? 1,
      x: pos[0],
      y: pos[1],
    };
  }

  if (type === 'targetdrop') {
    return { type: 'targetDrop', ownerId };
  }

  return null;
}

function readPair(controller: CnsStateController, key: string): [number, number] {
  const value = controller.params[key.toLowerCase()];
  if (typeof value === 'string') {
    const parts = value.split(',').map((part) => Number(part.trim()));
    return [Number.isFinite(parts[0]) ? parts[0] : 0, Number.isFinite(parts[1]) ? parts[1] : 0];
  }

  return [num(controller, 'x') ?? 0, num(controller, 'y') ?? 0];
}

function num(controller: CnsStateController, key: string): number | null {
  const value = controller.params[key.toLowerCase()];

  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const text = String(value).trim();
  if (text.length === 0) {
    return null;
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}
