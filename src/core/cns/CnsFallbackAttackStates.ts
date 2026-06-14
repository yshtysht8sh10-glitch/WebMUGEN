export const CNS_FALLBACK_ATTACK_STATES = `
[Statedef 0]
type = S
movetype = I
physics = S
ctrl = 1
anim = 0

[State 0, StandToLightAttack]
type = ChangeState
trigger1 = ctrl
trigger2 = command = "x"
value = 200

[Statedef 20]
type = S
movetype = I
physics = S
ctrl = 1
anim = 20

[State 20, WalkToLightAttack]
type = ChangeState
trigger1 = ctrl
trigger2 = command = "x"
value = 200

[Statedef 200]
type = S
movetype = A
physics = S
ctrl = 0
anim = 200

[State 200, Stop]
type = VelSet
trigger1 = time = 0
x = 0

[State 200, ReturnToStand]
type = ChangeState
trigger1 = time > 18
value = 0
`;

export function appendCnsFallbackAttackStates(baseText: string | null | undefined): string {
  return `${baseText ?? ''}\n${CNS_FALLBACK_ATTACK_STATES}`;
}
