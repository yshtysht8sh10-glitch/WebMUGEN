import type { CnsStateController } from '../../mugen/common/cnsTypes';
import { createDefaultHitDefSpec, type HitAttribute, type HitDefSpec, type HitDefVelocity } from './HitDefTypes';

export function parseHitDefController(controller: CnsStateController): HitDefSpec | null {
  if (controller.type.toLowerCase() !== 'hitdef') {
    return null;
  }

  const defaults = createDefaultHitDefSpec();

  return {
    ...defaults,
    attr: parseAttr(readString(controller, 'attr')) ?? defaults.attr,
    damage: parseDamage(readString(controller, 'damage')) ?? defaults.damage,
    pause: parsePause(readString(controller, 'pausetime')) ?? defaults.pause,
    hitVelocity: parseVelocity(readString(controller, 'ground.velocity')) ?? defaults.hitVelocity,
    guardVelocity: parseVelocity(readString(controller, 'guard.velocity')) ?? defaults.guardVelocity,
    priority: readNumber(controller, 'priority') ?? defaults.priority,
    sparkNo: readNumber(controller, 'sparkno'),
    guardSparkNo: readNumber(controller, 'guardsparkno'),
  };
}

export function parseAttr(value: string | null): HitAttribute | null {
  if (!value) return null;

  const parts = value.split(',').map((part) => part.trim().toUpperCase());
  const stateType = parts[0] === 'S' || parts[0] === 'C' || parts[0] === 'A' ? parts[0] : 'Any';
  const category = parts[1] ?? 'NA';

  return { stateType, category };
}

function parseDamage(value: string | null): { hit: number; guard: number } | null {
  const pair = parsePair(value);
  if (!pair) return null;
  return { hit: pair[0], guard: pair[1] };
}

function parsePause(value: string | null): { attacker: number; defender: number } | null {
  const pair = parsePair(value);
  if (!pair) return null;
  return { attacker: pair[0], defender: pair[1] };
}

function parseVelocity(value: string | null): HitDefVelocity | null {
  const pair = parsePair(value);
  if (!pair) return null;
  return { x: pair[0], y: pair[1] };
}

function parsePair(value: string | null): [number, number] | null {
  if (!value) return null;
  const parts = value.split(',').map((part) => Number(part.trim()));
  if (!Number.isFinite(parts[0])) return null;
  return [parts[0], Number.isFinite(parts[1]) ? parts[1] : 0];
}

function readString(controller: CnsStateController, key: string): string | null {
  const value = controller.params[key.toLowerCase()];
  if (value === undefined || value === null) return null;
  return String(value).trim();
}

function readNumber(controller: CnsStateController, key: string): number | null {
  const value = controller.params[key.toLowerCase()];
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value).trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}
