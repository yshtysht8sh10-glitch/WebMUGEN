; WebMUGEN common command routing
; This file provides baseline MUGEN-style movement ChangeState routes.
; Character CMD Statedef -1 routes take precedence when they define the same primary command.
; Physics integration is handled by the runtime, but common movement state routing lives here.
; NOTE: current WebMUGEN trigger coordinates use the internal screen Y ground value 285.

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

[State -1, Common Jump Vertical Velocity]
type = VelSet
triggerall = command = "holdup"
triggerall = command != "holdfwd"
triggerall = command != "holdback"
triggerall = command != "holddown"
trigger1 = stateno = 40
trigger1 = time = 0
x = 0
y = -8.4

[State -1, Common Jump Forward Velocity]
type = VelSet
triggerall = command = "holdup"
triggerall = command = "holdfwd"
triggerall = command != "holddown"
trigger1 = stateno = 40
trigger1 = time = 0
x = 3.2
y = -8.4

[State -1, Common Jump Back Velocity]
type = VelSet
triggerall = command = "holdup"
triggerall = command = "holdback"
triggerall = command != "holddown"
trigger1 = stateno = 40
trigger1 = time = 0
x = -3.2
y = -8.4

[State -1, Common Jump Rising]
type = ChangeState
triggerall = stateno = 40
trigger1 = time > 0
value = 50

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
trigger1 = statetype = S
trigger1 = stateno != 20
value = 20

[State -1, Common Walk Back]
type = ChangeState
triggerall = command = "holdback"
triggerall = command != "holddown"
trigger1 = statetype = S
trigger1 = ctrl
trigger1 = stateno != 21
value = 21

[Statedef -2]

[State -2, Common Air Physics Landing]
type = ChangeState
triggerall = physics = A
triggerall = vel y >= 0
trigger1 = pos y >= 285
value = 52
ctrl = 0
