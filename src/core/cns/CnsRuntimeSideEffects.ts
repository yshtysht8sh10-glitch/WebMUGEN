import type { PlayerState } from '../engine/types';
import type { CnsStateController, CnsValue } from '../../mugen/common/cnsTypes';

export function applyCnsRuntimeSideEffectController(
  player: PlayerState,
  controller: CnsStateController,
): { player: PlayerState; executed: boolean; name: string } | null {
  const type = controller.type.toLowerCase();

  if (type === 'sprpriority') {
    return {
      player: setRuntimeField(player, 'sprPriority', readNumber(controller, 'value') ?? readNumber(controller, 'priority') ?? 0),
      executed: true,
      name: 'SprPriority',
    };
  }

  if (type === 'width') {
    return {
      player: setRuntimeField(player, 'width', {
        edge: readNumber(controller, 'edge'),
        player: readNumber(controller, 'player'),
      }),
      executed: true,
      name: 'Width',
    };
  }

  if (type === 'assertspecial') {
    const flags = [readString(controller, 'flag'), readString(controller, 'flag2'), readString(controller, 'flag3')]
      .filter((value): value is string => Boolean(value));

    return {
      player: setRuntimeField(player, 'assertSpecial', flags),
      executed: true,
      name: 'AssertSpecial',
    };
  }

  if (type === 'playsnd') {
    return {
      player: setRuntimeField(player, 'lastSound', {
        value: controller.params.value ?? null,
        channel: readNumber(controller, 'channel'),
      }),
      executed: true,
      name: 'PlaySnd',
    };
  }

  return null;
}

function readNumber(controller: CnsStateController, key: string): number | null {
  const value = controller.params[key.toLowerCase()];
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') return value;
  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function readString(controller: CnsStateController, key: string): string | null {
  const value: CnsValue | undefined = controller.params[key.toLowerCase()];
  if (value === undefined || value === null) return null;
  return String(value).trim();
}

function setRuntimeField(player: PlayerState, key: string, value: unknown): PlayerState {
  return {
    ...player,
    runtime: {
      ...(player.runtime ?? {}),
      [key]: value,
    },
  } as PlayerState;
}
