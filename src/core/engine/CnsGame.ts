import type { CnsDocument } from '../../mugen/common/cnsTypes';
import type { AirDocument } from '../../parser/air/AirTypes';
import type { CmdDocument } from '../../parser/cmd/CmdTypes';
import { InputBuffer } from '../../input/InputBuffer';
import { resolveCommands } from '../../input/CommandResolver';
import { getAnimationLength } from '../animation/AnimationPlayer';
import { resolveClsnHits } from '../collision/CollisionResolver';
import { resolveProjectileHits, stepProjectiles } from '../projectile/ProjectileSystem';
import { stepPlayerByCnsWithEvents } from './CnsStateMachine';
import { resolveSimpleHits } from './SimpleCollision';
import type { FrameInput, GameState, PlayerInput, PlayerState } from './types';

export function stepGameByCns(
  current: GameState,
  document: CnsDocument,
  input: FrameInput,
  airDocument?: AirDocument,
  cmdDocument?: CmdDocument,
): GameState {
  const p1CommandInput = attachCommands(input.p1, cmdDocument, current.commandBuffers?.[0]);
  const p2CommandInput = attachCommands(
    input.p2 ?? { left: false, right: false, up: false, down: false, attack: false },
    cmdDocument,
    current.commandBuffers?.[1],
  );

  const p1Result = stepPlayerByCnsWithEvents(
    faceOpponent(current.players[0], current.players[1]),
    document,
    {
      input: p1CommandInput.input,
      animLength: getAnimLength(current.players[0], airDocument),
      moveHit: false,
    },
  );

  const p2Result = stepPlayerByCnsWithEvents(
    faceOpponent(current.players[1], current.players[0]),
    document,
    {
      input: p2CommandInput.input,
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
    commandBuffers: [p1CommandInput.buffer, p2CommandInput.buffer],
    commandNames: [p1CommandInput.commandNames, p2CommandInput.commandNames],
  };
}

type AttachedCommandInput = {
  input: PlayerInput;
  buffer: InputBuffer;
  commandNames: ReadonlySet<string>;
};

function attachCommands(
  input: PlayerInput,
  cmdDocument?: CmdDocument,
  previousBuffer?: InputBuffer,
): AttachedCommandInput {
  const buffer = input.inputBuffer?.clone() ?? previousBuffer?.clone() ?? new InputBuffer();
  buffer.push(input);

  const resolvedCommandNames = cmdDocument
    ? normalizeCommandNames(resolveCommands(cmdDocument, input, buffer).activeCommandNames)
    : normalizeCommandNames(input.commandNames ?? new Set());

  return {
    input: {
      ...input,
      inputBuffer: buffer,
      commandNames: new Set(resolvedCommandNames),
    },
    buffer,
    commandNames: resolvedCommandNames,
  };
}

function normalizeCommandNames(commands: Iterable<string>): ReadonlySet<string> {
  return new Set(Array.from(commands, (command) => command.toLowerCase()));
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
