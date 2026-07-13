; WebMUGEN common command routing
; This file provides baseline MUGEN-style movement ChangeState routes.
; Character CMD Statedef -1 routes take precedence when they define the same primary command.
; Physics integration is handled by the runtime, but common movement state routing lives here.
; CNS Pos Y follows WinMUGEN coordinates where ground is 0.

[Command]
name = "FF"
command = F, F

[Command]
name = "BB"
command = B, B

[Command]
name = "holdup"
command = /U

[Command]
name = "holddown"
command = /D

[Command]
name = "holdfwd"
command = /F

[Command]
name = "holdback"
command = /B

[Statedef -1]

[State -1, Common Forward Dash]
type = ChangeState
triggerall = command = "FF"
triggerall = command != "holddown"
trigger1 = statetype = S
trigger1 = ctrl
value = 100

[State -1, Common Back Dash]
type = ChangeState
triggerall = command = "BB"
triggerall = command != "holddown"
trigger1 = statetype = S
trigger1 = ctrl
value = 105

[State -1, Common Jump]
type = ChangeState
triggerall = command = "holdup"
triggerall = command != "holddown"
trigger1 = statetype = S
trigger1 = ctrl
value = 40

[State -1, Common Crouch Start]
type = ChangeState
triggerall = command = "holddown"
trigger1 = statetype = S
trigger1 = ctrl
value = 10

[State -1, Common Crouch Hold]
type = ChangeState
triggerall = command = "holddown"
trigger1 = stateno = 10
trigger1 = time > 0
value = 11

[State -1, Common Crouch End]
type = ChangeState
triggerall = command != "holddown"
trigger1 = statetype = C
value = 12

[State -1, Common Walk Forward]
type = ChangeState
triggerall = command = "holdfwd"
triggerall = command != "holddown"
triggerall = stateno != 100
triggerall = stateno != 101
triggerall = stateno != 102
triggerall = stateno != 103
triggerall = stateno != 104
triggerall = stateno != 105
triggerall = stateno != 106
triggerall = stateno != 107
trigger1 = statetype = S
trigger1 = ctrl
trigger1 = stateno != 20
value = 20

[State -1, Common Walk Forward Velocity]
type = VelSet
triggerall = command = "holdfwd"
triggerall = command != "holddown"
trigger1 = stateno = 20
x = 2.4

[State -1, Common Walk Forward Anim]
type = ChangeAnim
triggerall = command = "holdfwd"
triggerall = command != "holddown"
trigger1 = stateno = 20
trigger1 = anim != 20
value = 20

[State -1, Common Walk Back]
type = ChangeState
triggerall = command = "holdback"
triggerall = command != "holddown"
triggerall = stateno != 100
triggerall = stateno != 101
triggerall = stateno != 102
triggerall = stateno != 103
triggerall = stateno != 104
triggerall = stateno != 105
triggerall = stateno != 106
triggerall = stateno != 107
trigger1 = statetype = S
trigger1 = ctrl
trigger1 = stateno != 21
value = 21

[State -1, Common Walk Back Velocity]
type = VelSet
triggerall = command = "holdback"
triggerall = command != "holddown"
trigger1 = stateno = 21
x = -2.2

[State -1, Common Walk Back Anim]
type = ChangeAnim
triggerall = command = "holdback"
triggerall = command != "holddown"
trigger1 = stateno = 21
trigger1 = anim != 21
value = 21

[State -1, Common Walk Stop]
type = ChangeState
triggerall = command != "holdfwd"
triggerall = command != "holdback"
triggerall = command != "holddown"
trigger1 = stateno = 20
trigger2 = stateno = 21
value = 0

[Statedef -2]

[State -2, Common Air Physics Landing]
type = ChangeState
triggerall = physics = A
triggerall = vel y >= 0
trigger1 = pos y >= 0
value = 52
ctrl = 0

; Common jump startup for characters that rely on common1.cns.
; Directional and running profiles use the character's [Velocity] pairs.
[Statedef 40]
type = S
physics = S
anim = 40
ctrl = 0
sprpriority = 1

[State 40, Direction]
type = VarSet
trigger1 = Time = 0
sysvar(1) = 0

[State 40, Forward]
type = VarSet
trigger1 = command = "holdfwd"
sysvar(1) = 1

[State 40, Back]
type = VarSet
trigger1 = command = "holdback"
sysvar(1) = -1

[State 40, Jump Velocity]
type = VelSet
trigger1 = AnimTime = 0
x = ifelse(sysvar(1)=0, const(velocity.jump.neu.x), ifelse(sysvar(1)=1, ifelse(prevstateno=100, const(velocity.runjump.fwd.x), const(velocity.jump.fwd.x)), ifelse(prevstateno=105, const(velocity.runjump.back.x), const(velocity.jump.back.x))))
y = ifelse(sysvar(1)=0, const(velocity.jump.neu.y), ifelse(sysvar(1)=1, ifelse(prevstateno=100, const(velocity.runjump.fwd.y), const(velocity.jump.fwd.y)), ifelse(prevstateno=105, const(velocity.runjump.back.y), const(velocity.jump.back.y))))

[State 40, Air State]
type = ChangeState
trigger1 = AnimTime = 0
value = 50
ctrl = 1
