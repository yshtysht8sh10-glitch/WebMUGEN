import type { CnsDocument } from '../../mugen/common/cnsTypes';
import type { AirDocument } from '../../parser/air/AirTypes';
import type { FrameInput, GameState, PlayerState } from './types';
import { stepPlayerByCns } from './CnsStateMachine';
import { resolveSimpleHits } from './SimpleCollision';
import { getAnimationLength } from '../animation/AnimationPlayer';
import { resolveClsnHits } from '../collision/CollisionResolver';

export function stepGameByCns(
  current: GameState,
  document: CnsDocument,
  input: FrameInput,
  airDocument?: AirDocument,
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
      animLength: getAnimLength(current.players[0], airDocument),
      moveHit: false,
    }),
    stepPlayerByCns(faceOpponent(current.players[1], current.players[0]), document, {
      input: p2Input,
      animLength: getAnimLength(current.players[1], airDocument),
      moveHit: false,
    }),
  ];

  const collisionResult = airDocument
    ? resolveClsnHits(steppedPlayers, airDocument)
    : resolveSimpleHits(steppedPlayers);

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

function getAnimLength(player: PlayerState, airDocument?: AirDocument): number {
  if (airDocument) {
    return getAnimationLength(airDocument, player.animNo);
  }

  switch (player.animNo) {
    case 200:
      return 18;
    default:
      return 60;
  }
}
