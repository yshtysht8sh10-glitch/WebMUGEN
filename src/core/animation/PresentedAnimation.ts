import type { PlayerState } from '../engine/types';

/**
 * CNS evaluates an AIR frame before physics advances the animation clock.
 * Collision and rendering must keep using that evaluated frame for the rest
 * of the tick, or Animelem controllers take effect one displayed frame late.
 */
export function getPresentedAnimationTime(player: PlayerState): number {
  const presented = player.presentedAnimation;
  return presented
    && presented.stateNo === player.stateNo
    && presented.animNo === player.animNo
    && player.stateTime === presented.stateTime + 1
    ? presented.animTime
    : player.animTime;
}

export function snapshotPresentedAnimation(player: PlayerState): NonNullable<PlayerState['presentedAnimation']> {
  return {
    stateNo: player.stateNo,
    stateTime: player.stateTime,
    animNo: player.animNo,
    animTime: player.animTime,
  };
}
