import type {
  CnsControllerTriggerGroups,
  CnsStateController,
  CnsTrigger,
  CnsTriggerGroup,
} from './cnsTypes';

export function prepareCnsControllerTriggerGroups(
  controller: CnsStateController,
): CnsControllerTriggerGroups {
  if (controller.triggerGroups?.sourceTriggers === controller.triggers) return controller.triggerGroups;

  const triggerAll: CnsTrigger[] = [];
  const groupsByNumber = new Map<number, CnsTrigger[]>();

  for (const trigger of controller.triggers) {
    if (/^triggerall$/i.test(trigger.name)) {
      triggerAll.push(trigger);
      continue;
    }

    const match = trigger.name.match(/^trigger(\d+)$/i);
    const groupNo = match ? Number(match[1]) : 1;
    const existing = groupsByNumber.get(groupNo);
    if (existing) {
      existing.push(trigger);
    } else {
      groupsByNumber.set(groupNo, [trigger]);
    }
  }

  const groups: CnsTriggerGroup[] = Array.from(groupsByNumber, ([number, triggers]) => ({
    number,
    triggers,
  }));
  const triggerGroups: CnsControllerTriggerGroups = {
    sourceTriggers: controller.triggers,
    triggerAll,
    groups,
    sortedGroups: [...groups].sort((left, right) => left.number - right.number),
  };
  controller.triggerGroups = triggerGroups;
  return triggerGroups;
}
