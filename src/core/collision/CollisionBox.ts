import type { AirCollisionBox } from '../../parser/air/AirTypes';
import type { PlayerState, Rect } from '../engine/types';

export type CollisionKind = 'attack' | 'body';

export type WorldCollisionBox = Rect & {
  kind: CollisionKind;
  source: 'default' | 'element' | 'none';
  animNo: number;
  elementIndex: number;
  boxIndex: number;
};

export function airBoxToWorldRect(
  player: PlayerState,
  box: AirCollisionBox,
  kind: CollisionKind,
  offset: { x: number; y: number } = { x: 0, y: 0 },
  metadata: Pick<WorldCollisionBox, 'source' | 'animNo' | 'elementIndex' | 'boxIndex'> = {
    source: 'none', animNo: player.animNo, elementIndex: 0, boxIndex: 0,
  },
): WorldCollisionBox {
  const localLeft = box.left + offset.x;
  const localRight = box.right + offset.x;
  const left = player.facing === 1 ? localLeft : -localRight;
  const right = player.facing === 1 ? localRight : -localLeft;

  return {
    kind,
    ...metadata,
    x: player.x + left,
    y: player.y + box.top + offset.y,
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
