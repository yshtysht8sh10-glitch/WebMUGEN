import type { CnsDocument } from '../../mugen/common/cnsTypes';
import type { FrameInput, GameState, PlayerState } from './types';
import { stepPlayerByCns } from './CnsStateMachine';
import { resolveSimpleHits } from './SimpleCollision';

export function stepGameByCns(
  current: GameState,
  document: CnsDocument,
  input: FrameInput,
): GameState {
  const p1Input = input.p1;
  const p2Input = input.p2 ?? {
    left: false,
    right: false,
    up: false,
    attack: false,
  };

  const steppedPlayers: [PlayerState, PlayerState] = [
    stepPlayerByCns(faceOpponent(current.players[0], current.players[1]), document, {
      input: p1Input,
      animLength: getAnimationLength(current.players[0].animNo),
      moveHit: false,
    }),
    stepPlayerByCns(faceOpponent(current.players[1], current.players[0]), document, {
      // Phase7時点では、P2もキー入力をそのまま渡す。
      // MUGEN本来の holdfwd/holdback は向き基準だが、
      // 現在のsampleCharacterCnsは right=前進、left=後退 の簡易定義として扱っている。
      input: p2Input,
      animLength: getAnimationLength(current.players[1].animNo),
      moveHit: false,
    }),
  ];

  const collisionResult = resolveSimpleHits(steppedPlayers);

  return {
    frame: current.frame + 1,
    players: collisionResult.players,
    hitEvents: collisionResult.hitEvents,
  };
}

function faceOpponent(player: PlayerState, opponent: PlayerState): PlayerState {
  return {
    ...player,
    facing: player.x <= opponent.x ? 1 : -1,
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
