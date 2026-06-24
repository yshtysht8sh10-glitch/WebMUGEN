; WebMUGEN common command routing
; This file provides baseline MUGEN-style movement ChangeState routes.
; Character CMD Statedef -1 routes take precedence when they define the same command.

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

[State -1, Common Jump]
type = ChangeState
triggerall = command = "holdup"
triggerall = command != "holddown"
trigger1 = statetype = S
trigger1 = ctrl
value = 40

[State -1, Common Crouch]
type = ChangeState
triggerall = command = "holddown"
trigger1 = statetype = S
trigger1 = ctrl
value = 10

[State -1, Common Stand From Crouch]
type = ChangeState
triggerall = command != "holddown"
trigger1 = statetype = C
trigger1 = ctrl
value = 12

[State -1, Common Walk Forward]
type = ChangeState
triggerall = command = "holdfwd"
triggerall = command != "holddown"
trigger1 = statetype = S
trigger1 = ctrl
value = 20

[State -1, Common Walk Back]
type = ChangeState
triggerall = command = "holdback"
triggerall = command != "holddown"
trigger1 = statetype = S
trigger1 = ctrl
value = 20
