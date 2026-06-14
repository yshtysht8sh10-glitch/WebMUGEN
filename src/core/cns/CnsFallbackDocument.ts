import type { CnsDocument } from '../../mugen/common/cnsTypes';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { appendCnsFallbackAttackStates } from './CnsFallbackAttackStates';

export function attachFallbackAttackStates(cnsDocument?: CnsDocument | null): CnsDocument {
  const fallbackDocument = parseCnsText(appendCnsFallbackAttackStates(''));

  if (!cnsDocument) {
    return fallbackDocument;
  }

  const fallbackStates = fallbackDocument.states.filter(
    (fallbackState) =>
      !cnsDocument.states.some((existingState) => existingState.stateNo === fallbackState.stateNo),
  );

  return {
    ...cnsDocument,
    states: [...cnsDocument.states, ...fallbackStates],
    metadataSections: [
      ...cnsDocument.metadataSections,
      ...fallbackDocument.metadataSections,
    ],
  };
}
