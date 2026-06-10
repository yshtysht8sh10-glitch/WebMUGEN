export const sampleCharacterCns = `
[StateDef 0]
type = S
movetype = I
physics = S
anim = 0
ctrl = 1

[State 0, WalkForward]
type = ChangeState
trigger1 = command = "holdfwd"
value = 20
ctrl = 1

[State 0, WalkBack]
type = ChangeState
trigger1 = command = "holdback"
value = 21
ctrl = 1

[State 0, Jump]
type = ChangeState
trigger1 = command = "holdup"
value = 40
ctrl = 0

[State 0, Punch]
type = ChangeState
trigger1 = command = "a"
value = 200
ctrl = 0

[StateDef 20]
type = S
movetype = I
physics = S
anim = 20
ctrl = 1

[State 20, Move]
type = VelSet
trigger1 = time = 0
x = 2.2
y = 0

[State 20, Stop]
type = ChangeState
trigger1 = command != "holdfwd"
value = 0
ctrl = 1

[StateDef 21]
type = S
movetype = I
physics = S
anim = 21
ctrl = 1

[State 21, Move]
type = VelSet
trigger1 = time = 0
x = -1.8
y = 0

[State 21, Stop]
type = ChangeState
trigger1 = command != "holdback"
value = 0
ctrl = 1

[StateDef 40]
type = A
movetype = I
physics = A
anim = 40
ctrl = 0

[State 40, JumpStart]
type = VelSet
trigger1 = time = 0
x = 0
y = -8

[State 40, Gravity]
type = Gravity
trigger1 = 1

[State 40, Land]
type = ChangeState
trigger1 = time > 0
trigger1 = pos y >= 285
value = 0
ctrl = 1

[StateDef 200]
type = S
movetype = A
physics = S
anim = 200
ctrl = 0

[State 200, Stop]
type = VelSet
trigger1 = time = 0
x = 0
y = 0

[State 200, Step]
type = PosAdd
trigger1 = time = 3
x = 8

[State 200, End]
type = ChangeState
trigger1 = animtime = 0
value = 0
ctrl = 1
`;
