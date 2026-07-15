import type { PlayerState } from '../engine/types';

export const DEFAULT_MAX_POWER = 3000;

export function clampPower(power: number, maxPower: number = DEFAULT_MAX_POWER): number {
  return Math.max(0, Math.min(maxPower, Math.trunc(power)));
}

export function addPower(power: number, amount: number, maxPower: number = DEFAULT_MAX_POWER): number {
  return clampPower(power + amount, maxPower);
}

export function spendPower(power: number, amount: number): { power: number; spent: boolean } {
  const cost = Math.max(0, amount);
  if (power < cost) {
    return { power, spent: false };
  }

  return { power: power - cost, spent: true };
}

export function hasPower(power: number, amount: number): boolean {
  return power >= Math.max(0, amount);
}

export function powerLevel(power: number): number {
  return Math.floor(clampPower(power) / 1000);
}

export function readPlayerPowerMax(player: Pick<PlayerState, 'powerMax'>): number {
  return normalizeMaxPower(player.powerMax);
}

export function setPlayerPower(player: PlayerState, value: number): PlayerState {
  return { ...player, power: clampPower(value, readPlayerPowerMax(player)) };
}

export function addPlayerPower(player: PlayerState, amount: number): PlayerState {
  return setPlayerPower(player, (player.power ?? 0) + amount);
}

export function getPlayerPowerRatio(player: Pick<PlayerState, 'power' | 'powerMax'>): number {
  return clampPower(player.power ?? 0, readPlayerPowerMax(player)) / readPlayerPowerMax(player);
}

function normalizeMaxPower(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : DEFAULT_MAX_POWER;
}
