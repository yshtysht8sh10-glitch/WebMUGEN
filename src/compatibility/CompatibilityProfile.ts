import type { DefDocument } from '../parser/def/DefTypes';
import { getDefValue } from '../parser/def/DefParser';

export type CompatibilityProfileId = 'WINMUGEN' | 'MUGEN_1_0';

export type CompatibilityProfile = {
  id: CompatibilityProfileId;
  catalogEngine: 'winmugen' | 'mugen_1_0';
  label: 'WinMUGEN' | 'MUGEN 1.0';
};

export const WINMUGEN_PROFILE: CompatibilityProfile = {
  id: 'WINMUGEN', catalogEngine: 'winmugen', label: 'WinMUGEN',
};

export const MUGEN_1_0_PROFILE: CompatibilityProfile = {
  id: 'MUGEN_1_0', catalogEngine: 'mugen_1_0', label: 'MUGEN 1.0',
};

export type CompatibilityProfileResolution = {
  profile: CompatibilityProfile;
  declaredVersion: string | null;
  diagnostic?: string;
};

/** DEF compatibility and binary resource formats are deliberately separate axes. */
export function resolveCompatibilityProfile(def: DefDocument): CompatibilityProfileResolution {
  const declaredVersion = getDefValue(def, 'Info', 'mugenversion');
  if (declaredVersion === null || declaredVersion.trim() === '') {
    return { profile: WINMUGEN_PROFILE, declaredVersion: null };
  }
  const normalized = declaredVersion.trim();
  if (/^1(?:\.0+)?$/i.test(normalized)) {
    return { profile: MUGEN_1_0_PROFILE, declaredVersion };
  }
  if (/^(?:winmugen|2002\.04\.14|04,14,2002)$/i.test(normalized)) {
    return { profile: WINMUGEN_PROFILE, declaredVersion };
  }
  return {
    profile: WINMUGEN_PROFILE,
    declaredVersion,
    diagnostic: `Unknown [Info] mugenversion "${declaredVersion}"; using the WinMUGEN compatibility fallback.`,
  };
}
