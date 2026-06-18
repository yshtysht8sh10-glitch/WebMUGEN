import type { PlayerState } from '../engine/types';

export type ExtendedTriggerContext = {
  player: PlayerState;
  opponent?: PlayerState;
  stage?: { left: number; right: number };
  moveContact?: boolean;
  hitShakeOver?: boolean;
  helperCount?: number;
  projectileCount?: number;
};

export function evaluateExtendedCnsTrigger(expression: string, context: ExtendedTriggerContext): boolean | null {
  const trimmed = expression.trim().toLowerCase().replace(/\s+/g, ' ');

  if (trimmed === 'movecontact') return context.moveContact ?? false;
  if (trimmed === 'hitshakeover') return context.hitShakeOver ?? false;

  const p2dist = trimmed.match(/^p2bodydist\s+([xy])\s*(=|!=|>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)$/);
  if (p2dist) {
    const actual = getP2BodyDist(context.player, context.opponent, p2dist[1] as 'x' | 'y');
    return compare(actual, p2dist[2], Number(p2dist[3]));
  }

  const front = trimmed.match(/^frontedgebodydist\s*(=|!=|>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)$/);
  if (front) return compare(getFrontEdgeBodyDist(context.player, context.stage), front[1], Number(front[2]));

  const back = trimmed.match(/^backedgebodydist\s*(=|!=|>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)$/);
  if (back) return compare(getBackEdgeBodyDist(context.player, context.stage), back[1], Number(back[2]));

  const helper = trimmed.match(/^numhelper(?:\s*\(\s*(-?\d+)\s*\))?\s*(=|!=|>=|<=|>|<)\s*(-?\d+)$/);
  if (helper) return compare(context.helperCount ?? 0, helper[2], Number(helper[3]));

  const proj = trimmed.match(/^numproj\s*(=|!=|>=|<=|>|<)\s*(-?\d+)$/);
  if (proj) return compare(context.projectileCount ?? 0, proj[1], Number(proj[2]));

  return null;
}

function getP2BodyDist(player: PlayerState, opponent: PlayerState | undefined, axis: 'x' | 'y'): number {
  if (!opponent) return Number.POSITIVE_INFINITY;
  return axis === 'x' ? Math.abs(opponent.x - player.x) : opponent.y - player.y;
}

function getFrontEdgeBodyDist(player: PlayerState, stage: ExtendedTriggerContext['stage']): number {
  if (!stage) return Number.POSITIVE_INFINITY;
  return player.facing >= 0 ? stage.right - player.x : player.x - stage.left;
}

function getBackEdgeBodyDist(player: PlayerState, stage: ExtendedTriggerContext['stage']): number {
  if (!stage) return Number.POSITIVE_INFINITY;
  return player.facing >= 0 ? player.x - stage.left : stage.right - player.x;
}

function compare(actual: number, op: string, expected: number): boolean {
  switch (op) {
    case '=': return actual === expected;
    case '!=': return actual !== expected;
    case '>': return actual > expected;
    case '>=': return actual >= expected;
    case '<': return actual < expected;
    case '<=': return actual <= expected;
    default: return false;
  }
}
