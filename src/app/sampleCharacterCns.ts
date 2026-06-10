export const sampleCharacterCns = `
[StateDef 0]
type = S
movetype = I
physics = S
anim = 0
ctrl = 1

[State 0, Stop X]
type = VelSet
trigger1 = time = 0
x = 0
y = 0

[State 0, Hadouken]
type = ChangeState
trigger1 = command = "qcf_a"
value = 1000
ctrl = 0

[State 0, JumpForward]
type = ChangeState
trigger1 = command = "holdfwd_up"
value = 41
ctrl = 0

[State 0, JumpBack]
type = ChangeState
trigger1 = command = "holdback_up"
value = 42
ctrl = 0

[State 0, JumpNeutral]
type = ChangeState
trigger1 = command = "holdup"
value = 40
ctrl = 0

[State 0, Walk]
type = ChangeState
trigger1 = command = "holdfwd"
value = 20
ctrl = 1

[State 0, WalkBack]
type = ChangeState
trigger1 = command = "holdback"
value = 20
ctrl = 1

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

[State 20, Hadouken]
type = ChangeState
trigger1 = command = "qcf_a"
value = 1000
ctrl = 0

[State 20, WalkForward]
type = VelSet
trigger1 = command = "holdfwd"
x = 2.2
y = 0

[State 20, WalkBack]
type = VelSet
trigger1 = command = "holdback"
x = -1.8
y = 0

[State 20, Stop]
type = ChangeState
trigger1 = command != "holdfwd"
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

[State 40, Land]
type = ChangeState
trigger1 = time > 0
trigger1 = pos y >= 285
value = 0
ctrl = 1

[StateDef 41]
type = A
movetype = I
physics = A
anim = 40
ctrl = 0

[State 41, JumpForwardStart]
type = VelSet
trigger1 = time = 0
x = 2.2
y = -8

[State 41, Land]
type = ChangeState
trigger1 = time > 0
trigger1 = pos y >= 285
value = 0
ctrl = 1

[StateDef 42]
type = A
movetype = I
physics = A
anim = 40
ctrl = 0

[State 42, JumpBackStart]
type = VelSet
trigger1 = time = 0
x = -1.8
y = -8

[State 42, Land]
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

[State 200, Hit]
type = HitDef
trigger1 = time = 0
damage = 80, 10
pausetime = 4, 10
ground.velocity = -4, 0
air.velocity = -2.5, -5.5

[State 200, Step]
type = PosAdd
trigger1 = time = 3
x = 8

[State 200, End]
type = ChangeState
trigger1 = animtime = 0
value = 0
ctrl = 1

[StateDef 1000]
type = S
movetype = A
physics = S
anim = 1000
ctrl = 0

[State 1000, Stop]
type = VelSet
trigger1 = time = 0
x = 0
y = 0

[State 1000, Fireball]
type = Projectile
trigger1 = time = 9
projid = 1000
projanim = 1100
offset = 56, -44
velocity = 5.5, 0
damage = 90, 20
pausetime = 4, 12
ground.velocity = -5, 0
air.velocity = -3, -6
removetime = 90

[State 1000, End]
type = ChangeState
trigger1 = animtime = 0
value = 0
ctrl = 1

[StateDef 5000]
type = S
movetype = H
physics = N
anim = 5000
ctrl = 0

[State 5000, Stop Y]
type = VelSet
trigger1 = time = 0
y = 0

[State 5000, Slide Friction]
type = VelMul
trigger1 = time >= 10
x = 0.75

[State 5000, End]
type = ChangeState
trigger1 = time >= 18
value = 0
ctrl = 1

[StateDef 5030]
type = A
movetype = H
physics = A
anim = 5030
ctrl = 0

[State 5030, Land]
type = ChangeState
trigger1 = time > 0
trigger1 = pos y >= 285
value = 5000
ctrl = 0
`;
