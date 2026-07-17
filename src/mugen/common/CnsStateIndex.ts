import type { CnsDocument, CnsStateDefinition } from './cnsTypes';

type CnsStateIndex = {
  sourceStates: readonly CnsStateDefinition[];
  statesByNumber: ReadonlyMap<number, CnsStateDefinition>;
};

const documentStateIndexes = new WeakMap<CnsDocument, CnsStateIndex>();

export function prepareCnsDocumentStateIndex(document: CnsDocument): ReadonlyMap<number, CnsStateDefinition> {
  const cached = documentStateIndexes.get(document);
  if (cached?.sourceStates === document.states) return cached.statesByNumber;

  const statesByNumber = new Map<number, CnsStateDefinition>();
  for (const state of document.states) {
    // Array.find selected the first duplicate StateNo; preserve that rule.
    if (!statesByNumber.has(state.stateNo)) statesByNumber.set(state.stateNo, state);
  }
  documentStateIndexes.set(document, { sourceStates: document.states, statesByNumber });
  return statesByNumber;
}

export function findCnsState(
  document: CnsDocument | null | undefined,
  stateNo: number,
): CnsStateDefinition | undefined {
  return document ? prepareCnsDocumentStateIndex(document).get(stateNo) : undefined;
}
