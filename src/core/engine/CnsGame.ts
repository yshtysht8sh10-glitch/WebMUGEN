import type { CnsDocument } from '../../mugen/common/cnsTypes';
import type { FrameInput, GameState } from './types';
import { stepPlayerByCns } from './CnsStateMachine';

export function stepGameByCns(
  current: GameState,
  document: CnsDocument,
  input: FrameInput,
): GameState {
  return {
    frame: current.frame + 1,
    players: [
      stepPlayerByCns(current.players[0], document, {
        input: input.p1,
        animLength: getAnimationLength(current.players[0].animNo),
        moveHit: false,
      }),
    ],
  };
}

function getAnimationLength(animNo: number): number {
  switch (animNo) {
    case 200:
      return 18;
    default:
      return 60;
  }
}
