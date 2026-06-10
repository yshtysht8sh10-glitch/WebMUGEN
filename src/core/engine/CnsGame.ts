import type { CnsDocument } from '../../mugen/common/cnsTypes';
import type { AirDocument } from '../../parser/air/AirTypes';
import type { CmdDocument } from '../../parser/cmd/CmdTypes';
import type { FrameInput, GameState, PlayerInput, PlayerState } from './types';
import { stepPlayerByCnsWithEvents } from './CnsStateMachine';
import { resolveSimpleHits } from './SimpleCollision';
import { getAnimationLength } from '../animation/AnimationPlayer';
import { resolveClsnHits } from '../collision/CollisionResolver';
import { resolveCommands } from '../../input/CommandResolver';
import { resolveProjectileHits, stepProjectiles } from '../projectile/ProjectileSystem';

export function stepGameByCns(
  current: GameState,
  document: CnsDocument,
  input: FrameInput,
  airDocument?: AirDocument,
  cmdDocument?: CmdDocument,
): GameState {
  const p1Input = attachCommands(input.p1, cmdDocument);
  const p2Input = attachCommands(
    input.p2 ?? { left: false, right: false, up: false, down: false, attack: false },
    cmdDocument,
  );

  const p1Result = stepPlayerByCnsWithEvents(
    faceOpponent(current.players[0], current.players[1]),
    document,
    {
      input: p1Input,
      animLength: getAnimLength(current.players[0], airDocument),
      moveHit: false,
    },
  );

  const p2Result = stepPlayerByCnsWithEvents(
    faceOpponent(current.players[1], current.players[0]),
    document,
    {
      input: p2Input,
      animLength: getAnimLength(current.players[1], airDocument),
      moveHit: false,
    },
  );

  const steppedPlayers: [PlayerState, PlayerState] = [p1Result.player, p2Result.player];

  const directHitResult = airDocument
    ? resolveClsnHits(steppedPlayers, airDocument)
    : resolveSimpleHits(steppedPlayers);

  const steppedProjectiles = stepProjectiles([
    ...current.projectiles,
    ...p1Result.projectiles,
    ...p2Result.projectiles,
  ]).projectiles;

  const projectileResult = resolveProjectileHits(directHitResult.players, steppedProjectiles);

  return {
    frame: current.frame + 1,
    players: projectileResult.players,
    projectiles: projectileResult.projectiles,
    hitEvents: [...directHitResult.hitEvents, ...projectileResult.hitEvents],
  };
}

function attachCommands(input: PlayerInput, cmdDocument?: CmdDocument): PlayerInput {
  if (!cmdDocument) return input;

  return {
    ...input,
    commandNames: resolveCommands(cmdDocument, input, input.inputBuffer).activeCommandNames,
  };
}

function faceOpponent(player: PlayerState, opponent: PlayerState): PlayerState {
  return {
    ...player,
    facing: player.x <= opponent.x ? 1 : -1,
  };
}

function getAnimLength(player: PlayerState, airDocument?: AirDocument): number {
  if (airDocument) return getAnimationLength(airDocument, player.animNo);
  return player.animNo === 200 ? 18 : 60;
}
