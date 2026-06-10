export const sampleCharacterCns = `
; WebMUGEN sample CNS
; MUGEN common stateの考え方に寄せた簡易版。
; 本物のMUGENではState 40でsysvar(1)にジャンプ方向を保存してState 50へ移るが、
; 現段階のWebMUGENではsysvar/ifelse/constが未実装のため、40/41/42へ分ける。

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

[State 20, JumpForward]
type = ChangeState
trigger1 = command = "holdfwd_up"
value = 41
ctrl = 0

[State 20, JumpBack]
type = ChangeState
trigger1 = command = "holdback_up"
value = 42
ctrl = 0

[State 20, JumpNeutral]
type = ChangeState
trigger1 = command = "holdup"
value = 40
ctrl = 0

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
