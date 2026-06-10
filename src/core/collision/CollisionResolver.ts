import type { AirDocument } from '../../parser/air/AirTypes';
import { getCurrentAnimationElement } from '../animation/AnimationPlayer';
import type { PlayerState, Rect } from '../engine/types';
import { airBoxToWorldRect, intersects, type WorldCollisionBox } from './CollisionBox';

export function getPlayerAttackBoxes(
  player: PlayerState,
  airDocument: AirDocument,
): WorldCollisionBox[] {
  const element = getCurrentAnimationElement(airDocument, player.animNo, player.animTime)?.element;
  return element ? element.clsn1.map((box) => airBoxToWorldRect(player, box, 'attack')) : [];
}

export function getPlayerBodyBoxes(
  player: PlayerState,
  airDocument: AirDocument,
): WorldCollisionBox[] {
  const element = getCurrentAnimationElement(airDocument, player.animNo, player.animTime)?.element;
  return element ? element.clsn2.map((box) => airBoxToWorldRect(player, box, 'body')) : [];
}

export function anyIntersects(a: Rect[], b: Rect[]): boolean {
  return a.some((boxA) => b.some((boxB) => intersects(boxA, boxB)));
}
