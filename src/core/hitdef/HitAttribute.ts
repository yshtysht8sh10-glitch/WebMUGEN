import type { ActiveHitDef } from '../engine/types';

export type NormalizedHitAttribute = NonNullable<ActiveHitDef['attr']>;

export function normalizeHitAttribute(stateType: string, attackTypes: readonly string[]): NormalizedHitAttribute | null {
  const normalizedState = stateType.trim().toUpperCase();
  if (!['S', 'C', 'A'].includes(normalizedState)) return null;
  const normalizedTypes = Array.from(new Set(attackTypes.map((value) => value.trim().toUpperCase()).filter(Boolean)));
  if (normalizedTypes.length === 0 || normalizedTypes.some((value) => !/^[NSH][ATP]$/.test(value))) return null;
  return { stateType: normalizedState, attackTypes: normalizedTypes };
}

export function parseHitAttributeFilter(value: string | undefined): { stateTypes: string; attackTypes: string[] } | null {
  if (!value) return null;
  const parts = value.split(',').map((part) => part.trim().toUpperCase()).filter(Boolean);
  if (parts.length < 2 || !/^[SCA]+$/.test(parts[0])) return null;
  const attackTypes = parts.slice(1).filter((part) => /^[NSH][ATP]$/.test(part));
  if (attackTypes.length === 0) return null;
  return { stateTypes: parts[0], attackTypes };
}

export function hitAttributeMatchesFilter(attribute: ActiveHitDef['attr'], filterValue: string | undefined): boolean {
  if (!attribute) return false;
  const filter = parseHitAttributeFilter(filterValue);
  return Boolean(filter && filter.stateTypes.includes(attribute.stateType) && attribute.attackTypes.some((type) => filter.attackTypes.includes(type)));
}

export function hitDefAttrMatches(attribute: ActiveHitDef['attr'], requestedStateTypes: string, requestedAttackTypes: readonly string[]): boolean {
  if (!attribute) return false;
  const states = requestedStateTypes.trim().toUpperCase();
  const types = requestedAttackTypes.map((value) => value.trim().toUpperCase()).filter(Boolean);
  return /^[SCA]+$/.test(states) && states.includes(attribute.stateType) && attribute.attackTypes.some((type) => types.includes(type));
}
