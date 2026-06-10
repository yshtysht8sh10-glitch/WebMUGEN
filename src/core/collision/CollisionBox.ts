import type { AirCollisionBox } from '../../parser/air/AirTypes';
import type { PlayerState, Rect } from '../engine/types';

export type CollisionKind = 'attack' | 'body';

export type WorldCollisionBox = Rect & {
  kind: CollisionKind;
};

export function airBoxToWorldRect(
  player: PlayerState,
  box: AirCollisionBox,
  kind: CollisionKind,
): WorldCollisionBox {
  const left = player.facing === 1 ? box.left : -box.right;
  const right = player.facing === 1 ? box.right : -box.left;

  return {
    kind,
    x: player.x + left,
    y: player.y + box.top,
    width: right - left,
    height: box.bottom - box.top,
  };
}

export function intersects(a: Rect, b: Rect): boolean {
  if (a.width <= 0 || a.height <= 0 || b.width <= 0 || b.height <= 0) return false;

  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
