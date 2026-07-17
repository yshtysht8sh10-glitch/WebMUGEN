import type {
  CnsDocument,
  CnsStateController,
  CnsStateDefinition,
} from '../../mugen/common/cnsTypes';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { prepareCnsControllerTriggerGroups } from '../../mugen/common/CnsTriggerGroups';
import { prepareCnsDocumentStateIndex } from '../../mugen/common/CnsStateIndex';
import { appendCnsFallbackAttackStates } from './CnsFallbackAttackStates';

const FALLBACK_RETURN_CONTROLLER: CnsStateController = {
  type: 'ChangeState',
  triggers: [
    {
      name: 'trigger1',
      expression: 'time > 18',
    },
  ],
  params: {
    value: 0,
  },
};
prepareCnsControllerTriggerGroups(FALLBACK_RETURN_CONTROLLER);

const FALLBACK_RETURN_CONTROLLER_NAME = 'FallbackReturnToStand';

export function attachFallbackAttackStates(cnsDocument?: CnsDocument | null): CnsDocument {
  const fallbackDocument = parseCnsText(appendCnsFallbackAttackStates(''));

  if (!cnsDocument) {
    return fallbackDocument;
  }

  const fallbackStates = fallbackDocument.states.filter(
    (fallbackState) =>
      !cnsDocument.states.some((existingState) => existingState.stateNo === fallbackState.stateNo),
  );

  const mergedStates = [...cnsDocument.states, ...fallbackStates].map((state) =>
    state.stateNo === 200 ? injectFallbackReturnController(state) : state,
  );

  const document = {
    ...cnsDocument,
    states: mergedStates,
    metadataSections: [
      ...cnsDocument.metadataSections,
      ...fallbackDocument.metadataSections,
    ],
  };
  prepareCnsDocumentStateIndex(document);
  return document;
}

function injectFallbackReturnController(state: CnsStateDefinition): CnsStateDefinition {
  if (hasSimpleReturnToStandController(state)) {
    return state;
  }

  return {
    ...state,
    controllers: [
      ...state.controllers,
      {
        ...FALLBACK_RETURN_CONTROLLER,
        name: FALLBACK_RETURN_CONTROLLER_NAME,
      } as CnsStateController,
    ],
  };
}

function hasSimpleReturnToStandController(state: CnsStateDefinition): boolean {
  return state.controllers.some((controller) => {
    if (controller.type.toLowerCase() !== 'changestate') {
      return false;
    }

    const value = controller.params.value;
    const numericValue = typeof value === 'number' ? value : Number(String(value ?? '').trim());

    return Number.isFinite(numericValue) && numericValue === 0;
  });
}
