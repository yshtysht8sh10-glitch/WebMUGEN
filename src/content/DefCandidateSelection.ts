export type DefPathCandidate = { path: string };

export function selectPreferredDefCandidate<T extends DefPathCandidate>(candidates: readonly T[]): T {
  if (candidates.length === 0) throw new Error('A DEF candidate is required.');
  return [...candidates].sort(compareDefCandidates)[0];
}

export function compareDefCandidates(left: DefPathCandidate, right: DefPathCandidate): number {
  const leftRank = defCandidateRank(left.path);
  const rightRank = defCandidateRank(right.path);
  return leftRank.depth - rightRank.depth
    || leftRank.nameComplexity - rightRank.nameComplexity
    || leftRank.nameLength - rightRank.nameLength
    || leftRank.path.localeCompare(rightRank.path, 'en');
}

function defCandidateRank(path: string) {
  const normalized = path.replace(/\\/g, '/').replace(/^\.\//, '');
  const parts = normalized.split('/').filter(Boolean);
  const fileName = parts.at(-1) ?? normalized;
  const stem = fileName.replace(/\.[^.]+$/, '');
  return {
    depth: Math.max(0, parts.length - 1),
    nameComplexity: Array.from(stem).filter((character) => !/[\p{L}\p{N}]/u.test(character)).length,
    nameLength: Array.from(stem).length,
    path: normalized,
  };
}
