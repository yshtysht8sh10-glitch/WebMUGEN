
;---------------------------------------------------------------

;-| CPU |-------------------------------------------------------

[Command]
name = "cpu1"
command = a,U,D,F,F,B,B,D,U,U
time = 1
[Command]
name = "cpu2"
command = b,U,D,F,B,F,B,D,U,D
time = 1
[Command]
name = "cpu3"
command = c,U,D,B,F,B,F,D,U,B
time = 1
[Command]
name = "cpu4"
command = x,U,D,B,F,F,B,D,U,F
time = 1
[Command]
name = "cpu5"
command = y,U,D,F,F,B,B,D,U,a
time = 1
[Command]
name = "cpu6"
command = z,U,D,F,B,F,B,D,U,b
time = 1
[Command]
name = "cpu7"
command = s,U,D,B,F,B,F,D,U,c
time = 1
[Command]
name = "cpu8"
command = b,U,D,B,F,F,B,D,U,x
time = 1
[Command]
name = "cpu9"
command = c,U,D,F,B,F,B,D,U,y
time = 1
[Command]
name = "cpu10"
command = c,U,D,B,B,F,B,D,U,y
time = 1
[Command]
name = "cpu11"
command = a,U,D,F,F,B,B,B,D,U,U
time = 1
[Command]
name = "cpu12"
command = b,U,D,F,B,F,B,B,D,U,D
time = 1
[Command]
name = "cpu13"
command = c,U,D,B,B,F,B,F,D,U,B
time = 1
[Command]
name = "cpu14"
command = x,U,D,B,F,B,F,B,D,U,F
time = 1
[Command]
name = "cpu15"
command = y,U,D,F,F,B,B,B,D,U,a
time = 1
[Command]
name = "cpu16"
command = z,U,B,D,F,B,F,B,D,U,b
time = 1
[Command]
name = "cpu17"
command = s,U,D,B,F,B,F,B,D,U,c
time = 1
[Command]
name = "cpu18"
command = b,U,D,B,F,B,F,B,D,U,x
time = 1
[Command]
name = "cpu19"
command = c,U,D,F,B,B,F,B,D,U,y
time = 1
[Command]
name = "cpu20"
command = c,U,D,B,B,B,F,B,D,U,y
time = 1
[Command]
name = "cpu21"
command = a,U,D,F,F,s,B,B,D,U,U
time = 1
[Command]
name = "cpu22"
command = b,U,s,D,F,B,F,B,D,U,D
time = 1
[Command]
name = "cpu23"
command = c,U,D,B,F,B,F,s,D,U,B
time = 1
[Command]
name = "cpu24"
command = x,U,D,B,s,F,F,B,D,U,F
time = 1
[Command]
name = "cpu25"
command = y,U,D,s,F,F,B,B,D,U,a
time = 1
[Command]
name = "cpu26"
command = z,U,D,F,B,F,s,B,D,U,b
time = 1
[Command]
name = "cpu27"
command = s,U,D,s,B,F,B,F,D,U,c
time = 1
[Command]
name = "cpu28"
command = b,U,D,B,s,F,F,B,s,D,U,x
time = 1
[Command]
name = "cpu29"
command = c,U,D,F,s,B,F,B,D,U,y
time = 1
[Command]
name = "cpu30"
command = c,U,D,B,B,F,B,s,D,U,y
time = 1
;---------------------------------------------------------------------

;-| 超必殺技 |--------------------------------------------------------

[Command]
name = "高速移動 (超必)"
command = D,  F, D,  F, z
time = 25

[Command]
name = "両方 (強化)"
command = D,  B, D,  B, s
time = 25

[Command]
name = "高速移動 (強化)"
command = D,  B, D,  B, z
time = 25

[Command]
name = "攻撃力 (強化)"
command = D,  B, D,  B, c
time = 25

[Command]
name = "天驚拳"
command = ~D,  F, D,  F, x+y
time = 25

[Command]
name = "投げ技"
command = ~B,  D, F,  D, DF, a+b
time = 25

[Command]
name = "挨拶y"
command = ~D,  F, D,  F, y
time = 25

[Command]
name = "挨拶x"
command = ~D,  F, D,  F, x
time = 25

[Command]
name = "相手の背後から蹴るb"
command = ~D,  B, D,  B, b
time = 25

[Command]
name = "相手の背後から蹴るa"
command = ~D,  B, D,  B, a
time = 25

[Command]
name = "連繋b"
command = ~D,  F, D,  F, b
time = 25

[Command]
name = "連繋a"
command = ~D,  F, D,  F, a
time = 25

[Command]
name = "ダークネスフィンガー"
command = ~D, DB, B, F, x+y
time = 25

;-| 必殺技 |------------------------------------------------------

[Command]
name = "ダークネスフィンガー 撃ち付けy"
command = ~D, DB, B, F, y
time = 25

[Command]
name = "ダークネスフィンガー 撃ち付けx"
command = ~D, DB, B, F, x
time = 25

[Command]
name = "怒鬼雷豪稲妻落しa"
command = ~D, B, U, D, a
time = 30

[Command]
name = "怒鬼雷豪稲妻落しb"
command = ~D, B, U, D, b
time = 30

[Command]
name = "こぶしでの攻撃（強）"
command = ~D, DB, B, y

[Command]
name = "こぶしでの攻撃（弱）"
command = ~D, DB, B, x

[Command]
name = "空中ラッシュ（強）"
command = ~D, DB, B, b

[Command]
name = "空中ラッシュ（弱）"
command = ~D, DB, B, a

[Command]
name = "落ち蹴り（EX）"
command = ~D, DF, F, a+b

[Command]
name = "落ち蹴り（強）"
command = ~D, DF, F, b

[Command]
name = "落ち蹴り（弱）"
command = ~D, DF, F, a

[Command]
name = "回転（強）"
command = ~F, D, DF, y

[Command]
name = "回転（弱）"
command = ~F, D, DF, x

[Command]
name = "衝撃波（強）"
command = ~D, DF, F, y

[Command]
name = "衝撃波（弱）"
command = ~D, DF, F, x

;-| ２回押し技 |-----------------------------------------------------------
[Command]
name = "Dasyu"     
command = F, F
time = 10

[Command]
name = "BakuSutep"     
command = B, B
time = 15

;-| ２・３個の同時押し技 |-----------------------------------------------
[Command]
name = "展開"
command = z+c
time = 1

[Command]
name = "recovery"
command = z
time = 1

[Command]
name = "投げ"
command = x+y
time = 1

[Command]
name = "ガードキャンセル"
command = x+a
time = 1


;-| 方向とボタンで出す技 |------------------------------------------------
[Command]
name = "変則立ち弱パンチ"
command = /$B,x
time = 1

[Command]
name = "近距離立ち弱パンチ"
command = /$F,x
time = 1

;---
[Command]
name = "DF_z"
command = /$DF,z
time = 1

[Command]
name = "DB_z"
command = /$DB,z
time = 1

[Command]
name = "UB_z"
command = /$UB,z
time = 1

[Command]
name = "UF_z"
command = /$UF,z
time = 1

[Command]
name = "F_z"
command = /$F,z
time = 1

[Command]
name = "D_z"
command = /$D,z
time = 1

[Command]
name = "B_z"
command = /$B,z
time = 1

[Command]
name = "U_z"
command = /$U,z
time = 1
;---

;-| ボタン設定（いじらない）|---------------------------------------------------------
[Command]
name = "a"
command = a
time = 1

[Command]
name = "b"
command = b
time = 1

[Command]
name = "c"
command = c
time = 1

[Command]
name = "x"
command = x
time = 1

[Command]
name = "y"
command = y
time = 1

[Command]
name = "z"
command = z
time = 1

[Command]
name = "start"
command = s
time = 1

;-| 押しっぱなし設定（いじらない）-------------------------------------------------------
[Command]
name = "holdfwd"
command = /$F
time = 1

[Command]
name = "holdback"
command = /$B
time = 1

[Command]
name = "holdup" 
command = /$U
time = 1

[Command]
name = "holdupfwd"
command = /$UF
time = 1

[Command]
name = "holddown"
command = /$D
time = 1

[Command]
name = "hold_z"
command = /z
time = 1

[Command]
name = "hold_c"
command = /c
time = 1

[Command]
name = "hold_b"
command = /b
time = 1

[Command]
name = "hold_a"
command = /a
time = 1

[Command]
name = "hold_y"
command = /y
time = 1

[Command]
name = "hold_x"
command = /x
time = 1

[Command]
name = "longjump"
command = ~D, $U
time = 7

;----------------------------- 方向
[Command]
name = "fwd"
command = F
time = 1

[Command]
name = "downfwd"
command = DF
time = 1

[Command]
name = "down"
command = D
time = 1

[Command]
name = "downback"
command = DB
time = 1

[Command]
name = "back"
command = B
time = 1

[Command]
name = "upback"
command = UB
time = 1

[Command]
name = "up"
command = U
time = 1

[Command]
name = "upfwd"
command = UF
time = 1

[Command]
name = "Not-Neutral"
command = $U
time = 1

[Command]
name = "Not-Neutral"
command = $F
time = 1

[Command]
name = "Not-Neutral"
command = $D
time = 1

[Command]
name = "Not-Neutral"
command = $B
time = 1

;======================
[Statedef -1]
;======================
;------
;------
;===========================================================================
;------------------------| 超必殺技 |---------------------------------------
;===========================================================================
;高速移動 (超必)
[State -1, ChangeState]
type = ChangeState
value = 3200
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerAll = var(20) = 0
triggerall = power >= 1000
triggerall = command = "高速移動 (超必)"
trigger1 = statetype != A
trigger1 = ctrl = 1
;地上病
[State -1, ChangeState]
type = ChangeState
value = 5410
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 0 || fvar(12) <= 5
triggerAll = var(20) = 0
triggerall = power >= 1000
triggerall = command = "高速移動 (超必)"
trigger1 = statetype != A
trigger1 = ctrl = 1
;地上リバサ
[State -1, Varset]
type = Varset
var(16) = 3200
triggerall = var(16) = 0
triggerAll = var(20) = 0
trigger1 = command = "高速移動 (超必)"

---------------------------------------------------------------------------
;両方 (強化)
[State -1, ChangeState]
type = ChangeState
value = 3540
TriggerAll = Palno != 12
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall = power >= 3000
triggerall = command = "両方 (強化)"
trigger1 = statetype != A
trigger1 = ctrl = 1
;地上病
[State -1, ChangeState]
type = ChangeState
value = 5410
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 0 || fvar(12) <= 5
triggerall = power >= 3000
triggerall = command = "両方 (強化)"
TriggerAll = Palno != 12
trigger1 = statetype != A
trigger1 = ctrl = 1
;地上リバサ
[State -1, Varset]
type = Varset
var(16) = 3540
triggerall = var(16) = 0
TriggerAll = Palno != 12
trigger1 = command = "両方 (強化)"

---------------------------------------------------------------------------
;高速移動 (強化)
[State -1, ChangeState]
type = ChangeState
value = 3500
TriggerAll = Palno != 12
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall = power >= 1000
triggerall = command = "高速移動 (強化)"
trigger1 = statetype != A
trigger1 = ctrl = 1
;地上病
[State -1, ChangeState]
type = ChangeState
value = 5410
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 0 || fvar(12) <= 5
triggerall = power >= 1000
triggerall = command = "高速移動 (強化)"
TriggerAll = Palno != 12
trigger1 = statetype != A
trigger1 = ctrl = 1
;地上リバサ
[State -1, Varset]
type = Varset
var(16) = 3500
triggerall = var(16) = 0
TriggerAll = Palno != 12
trigger1 = command = "高速移動 (強化)"

---------------------------------------------------------------------------
;攻撃力   (強化)
[State -1, ChangeState]
type = ChangeState
value = 3520
TriggerAll = Palno != 12
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall = power >= 1000
triggerall = command = "攻撃力 (強化)"
trigger1 = statetype != A
trigger1 = ctrl = 1
trigger2= stateno=999
;地上病
[State -1, ChangeState]
type = ChangeState
value = 5410
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 0 || fvar(12) <= 5
triggerall = power >= 1000
triggerall = command = "攻撃力 (強化)"
TriggerAll = Palno != 12
trigger1 = statetype != A
trigger1 = ctrl = 1
trigger2= stateno=999
;地上リバサ
[State -1, Varset]
type = Varset
var(16) = 3520
triggerall = var(16) = 0
TriggerAll = Palno != 12
trigger1 = command = "攻撃力 (強化)"

---------------------------------------------------------------------------
;天驚拳
[State -1, ChangeState]
type = ChangeState
value = 3000
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall = command = "天驚拳"
Trigger1 = Var(20) = 0
trigger1 = statetype != A
trigger1 = ctrl = 1
trigger1 = power >= 3000
Trigger2 = Var(20) = 1
trigger2 = statetype != A
trigger2 = ctrl = 1
trigger2 = power >= 1500
;地上病
[State -1, ChangeState]
type = ChangeState
value = 5410
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 0 || fvar(12) <= 5
triggerall = command = "天驚拳"
Trigger1 = Var(20) = 0
trigger1 = statetype != A
trigger1 = ctrl = 1
trigger1 = power >= 3000
Trigger2 = Var(20) = 1
trigger2 = statetype != A
trigger2 = ctrl = 1
trigger2 = power >= 1500
;地上リバサ
[State -1, Varset]
type = Varset
var(16) = 3520
triggerall = var(16) = 0
trigger1 = command = "天驚拳"

;---------------------------------------------------------------------------
;投げ技
[State -1, ChangeState]
type = ChangeState
value = 3700
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall = power >= 3000
triggerall = command = "投げ技" 
trigger1 = ctrl = 1
;地上病
[State -1, ChangeState]
type = ChangeState
value = 5410
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 0 || fvar(12) <= 5
triggerall = power >= 3000
triggerall = command = "投げ技" 
trigger1 = statetype != A
trigger1 = ctrl = 1
;空中病
[State -1, ChangeState]
type = ChangeState
value = 5420
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 0 || fvar(12) <= 5
triggerall = power >= 3000
triggerall = command = "投げ技" 
trigger1 = statetype = A
trigger1 = ctrl = 1
;地上リバサ
[State -1, Varset]
type = Varset
var(16) = 3700
triggerall = var(16) = 0
trigger1 = command = "投げ技" 

;---------------------------------------------------------------------------
;ダークネスフィンガー 真打
[State -1, ChangeState]
type = ChangeState
value = 3900
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall = command = "ダークネスフィンガー" 
triggerall = power >= 3000
trigger1 = ctrl = 1
trigger1 = statetype != A
trigger2= (stateno=[200,210]) && movecontact
trigger3= (stateno=[230,232]) && movecontact
trigger4= stateno = 240 && movecontact
trigger5= (stateno=[400,440]) && movecontact
;地上病
[State -1, ChangeState]
type = ChangeState
value = 5410
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 0 || fvar(12) <= 5
triggerall = command = "ダークネスフィンガー" 
triggerall = power >= 3000
trigger1 = ctrl = 1
trigger1 = statetype != A
trigger2= (stateno=[200,210]) && movecontact
trigger3= (stateno=[230,232]) && movecontact
trigger4= stateno = 240 && movecontact
trigger5= (stateno=[400,440]) && movecontact
;地上リバサ
[State -1, Varset]
type = Varset
var(16) = 3900
triggerall = var(16) = 0
trigger1 = command = "ダークネスフィンガー" 

;---------------------------------------------------------------------------
;挨拶（強）
[State -1, ChangeState]
type = ChangeState
value = 3800
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall = power >= 1000
triggerall = command = "挨拶y"
trigger1 = ctrl = 1
trigger1 = statetype != A
trigger2= (stateno=[200,242]) && movecontact
trigger3= (stateno=[400,440]) && movecontact
;地上病
[State -1, ChangeState]
type = ChangeState
value = 5410
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 0 || fvar(12) <= 5
triggerall = power >= 1000
triggerall = command = "挨拶y"
trigger1 = ctrl = 1
trigger1 = statetype != A
trigger2= (stateno=[200,241]) && movecontact
trigger3= (stateno=[400,440]) && movecontact
;地上リバサ
[State -1, Varset]
type = Varset
var(16) = 3800
triggerall = var(16) = 0
trigger1 = command = "挨拶y"

;---------------------------------------------------------------------------
;挨拶（弱）
[State -1, ChangeState]
type = ChangeState
value = 3850
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall = power >= 1000
triggerall = command = "挨拶x"
trigger1 = ctrl = 1
trigger1 = statetype != A
trigger2= (stateno=[200,242]) && movecontact
trigger3= (stateno=[400,440]) && movecontact
;地上病
[State -1, ChangeState]
type = ChangeState
value = 5410
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 0 || fvar(12) <= 5
triggerall = power >= 1000
triggerall = command = "挨拶x"
trigger1 = ctrl = 1
trigger1 = statetype != A
trigger2= (stateno=[200,241]) && movecontact
trigger3= (stateno=[400,440]) && movecontact
;地上リバサ
[State -1, Varset]
type = Varset
var(16) = 3850
triggerall = var(16) = 0
trigger1 = command = "挨拶x"

---------------------------------------------------------------------------
;旧・相手の背後から蹴る（強）
[State -1, ChangeState]
type = ChangeState
value = 3120
TriggerAll = Var(33) = 0
TriggerAll = var(19) = 1
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall = power >= 1000
triggerall = command = "相手の背後から蹴るb"
trigger1 = ctrl = 1
trigger2= (stateno=[200,242]) && movecontact
trigger3= (stateno=[400,440]) && movecontact
trigger4= (stateno=[600,640]) && movecontact
trigger5= (stateno=[1020,1046]) && movecontact
;地上病
[State -1, ChangeState]
type = ChangeState
value = 5410
TriggerAll = Var(33) = 0
TriggerAll = var(19) = 1
TriggerAll = var(11) = 0 || fvar(12) <= 5
triggerall = power >= 1000
triggerall = command = "相手の背後から蹴るb"
triggerall = statetype != A
trigger1 = ctrl = 1
trigger2= (stateno=[200,241]) && movecontact
trigger3= (stateno=[400,440]) && movecontact
trigger4= (stateno=[600,640]) && movecontact
trigger5= (stateno=[1020,1046]) && movecontact
;空中病
[State -1, ChangeState]
type = ChangeState
value = 5420
TriggerAll = Var(33) = 0
TriggerAll = var(19) = 1
TriggerAll = var(11) = 0 || fvar(12) <= 5
triggerall = power >= 1000
triggerall = command = "相手の背後から蹴るb"
triggerall = statetype = A
trigger1 = ctrl = 1
trigger2= (stateno=[200,241]) && movecontact
trigger3= (stateno=[400,440]) && movecontact
trigger4= (stateno=[600,640]) && movecontact
trigger5= (stateno=[1020,1046]) && movecontact
;地上リバサ
[State -1, Varset]
type = Varset
var(16) = 3120
triggerall = var(16) = 0
TriggerAll = var(19) = 1
trigger1 = command = "相手の背後から蹴るb"

;---------------------------------------------------------------------------
;旧・相手の背後から蹴る（弱）
[State -1, ChangeState]
type = ChangeState
value = 3100
TriggerAll = Var(33) = 0
TriggerAll = var(19) = 1
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall = power >= 1000
triggerall = command = "相手の背後から蹴るa" 
trigger1 = ctrl = 1
trigger2= (stateno=[200,242]) && movecontact
trigger3= (stateno=[400,440]) && movecontact
trigger4= (stateno=[600,640]) && movecontact
trigger5= (stateno=[1020,1046]) && movecontact
;地上病
[State -1, ChangeState]
type = ChangeState
value = 5410
TriggerAll = Var(33) = 0
TriggerAll = var(19) = 1
TriggerAll = var(11) = 0 || fvar(12) <= 5
triggerall = power >= 1000
triggerall = command = "相手の背後から蹴るa" 
triggerall = statetype != A
trigger1 = ctrl = 1
trigger2= (stateno=[200,241]) && movecontact
trigger3= (stateno=[400,440]) && movecontact
trigger4= (stateno=[600,640]) && movecontact
trigger5= (stateno=[1020,1046]) && movecontact
;空中病
[State -1, ChangeState]
type = ChangeState
value = 5420
TriggerAll = Var(33) = 0
TriggerAll = var(19) = 1
TriggerAll = var(11) = 0 || fvar(12) <= 5
triggerall = power >= 1000
triggerall = command = "相手の背後から蹴るa" 
triggerall = statetype = A
trigger1 = ctrl = 1
trigger2= (stateno=[200,241]) && movecontact
trigger3= (stateno=[400,440]) && movecontact
trigger4= (stateno=[600,640]) && movecontact
trigger5= (stateno=[1020,1046]) && movecontact
;地上リバサ
[State -1, Varset]
type = Varset
var(16) = 3110
triggerall = var(16) = 0
TriggerAll = var(19) = 1
trigger1 = command = "相手の背後から蹴るa"

;---------------------------------------------------------------------------
;新・相手の背後から蹴る（強）
[State -1, ChangeState]
type = ChangeState
value = 3180
TriggerAll = Var(33) = 0
TriggerAll = var(19) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall = power >= 1000
triggerall = command = "相手の背後から蹴るb"
trigger1 = ctrl = 1
trigger2= (stateno=[200,242]) && movecontact
trigger3= (stateno=[400,440]) && movecontact
trigger4= (stateno=[600,640]) && movecontact
trigger5= (stateno=[1020,1046]) && movecontact
;地上病
[State -1, ChangeState]
type = ChangeState
value = 5410
TriggerAll = Var(33) = 0
TriggerAll = var(19) = 0
TriggerAll = var(11) = 0 || fvar(12) <= 5
triggerall = power >= 1000
triggerall = command = "相手の背後から蹴るb" 
triggerall = statetype != A
trigger1 = ctrl = 1
trigger2= (stateno=[200,241]) && movecontact
trigger3= (stateno=[400,440]) && movecontact
trigger4= (stateno=[600,640]) && movecontact
trigger5= (stateno=[1020,1046]) && movecontact
;空中病
[State -1, ChangeState]
type = ChangeState
value = 5420
TriggerAll = Var(33) = 0
TriggerAll = var(19) = 0
TriggerAll = var(11) = 0 || fvar(12) <= 5
triggerall = power >= 1000
triggerall = command = "相手の背後から蹴るb"
triggerall = statetype = A
trigger1 = ctrl = 1
trigger2= (stateno=[200,241]) && movecontact
trigger3= (stateno=[400,440]) && movecontact
trigger4= (stateno=[600,640]) && movecontact
trigger5= (stateno=[1020,1046]) && movecontact
;地上リバサ
[State -1, Varset]
type = Varset
var(16) = 3180
triggerall = var(16) = 0
TriggerAll = var(19) = 0
trigger1 = command = "相手の背後から蹴るb"

;---------------------------------------------------------------------------
;新・相手の背後から蹴る（弱）
[State -1, ChangeState]
type = ChangeState
value = 3160
TriggerAll = Var(33) = 0
TriggerAll = var(19) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall = power >= 1000
triggerall = command = "相手の背後から蹴るa" 
trigger1 = ctrl = 1
trigger2= (stateno=[200,242]) && movecontact
trigger3= (stateno=[400,440]) && movecontact
trigger4= (stateno=[600,640]) && movecontact
trigger5= (stateno=[1020,1046]) && movecontact
;地上病
[State -1, ChangeState]
type = ChangeState
value = 5410
TriggerAll = Var(33) = 0
TriggerAll = var(19) = 0
TriggerAll = var(11) = 0 || fvar(12) <= 5
triggerall = power >= 1000
triggerall = command = "相手の背後から蹴るa" 
triggerall = statetype != A
trigger1 = ctrl = 1
trigger2= (stateno=[200,241]) && movecontact
trigger3= (stateno=[400,440]) && movecontact
trigger4= (stateno=[600,640]) && movecontact
trigger5= (stateno=[1020,1046]) && movecontact
;空中病
[State -1, ChangeState]
type = ChangeState
value = 5420
TriggerAll = Var(33) = 0
TriggerAll = var(19) = 0
TriggerAll = var(11) = 0 || fvar(12) <= 5
triggerall = power >= 1000
triggerall = command = "相手の背後から蹴るa" 
triggerall = statetype = A
trigger1 = ctrl = 1
trigger2= (stateno=[200,241]) && movecontact
trigger3= (stateno=[400,440]) && movecontact
trigger4= (stateno=[600,640]) && movecontact
trigger5= (stateno=[1020,1046]) && movecontact
;地上リバサ
[State -1, Varset]
type = Varset
var(16) = 3160
triggerall = var(16) = 0
TriggerAll = var(19) = 0
trigger1 = command = "相手の背後から蹴るa"

;---------------------------------------------------------------------------
;連繋（弱）
[State -1, ChangeState]
type = ChangeState
value = 3300
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall = power >= 1000
triggerall = command = "連繋a" 
trigger1 = ctrl = 1
trigger1 = statetype != A
trigger2= (stateno=[200,242]) && movecontact
trigger3= (stateno=[400,440]) && movecontact
;地上病
[State -1, ChangeState]
type = ChangeState
value = 5410
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 0 || fvar(12) <= 5
triggerall = power >= 1000
triggerall = command = "連繋a"
trigger1 = ctrl = 1
trigger1 = statetype != A
trigger2= (stateno=[200,241]) && movecontact
trigger3= (stateno=[400,440]) && movecontact
;地上リバサ
[State -1, Varset]
type = Varset
var(16) = 3300
triggerall = var(16) = 0
trigger1 = command = "連繋a" 

;---------------------------------------------------------------------------
;連繋（強）
[State -1, ChangeState]
type = ChangeState
value = 3350
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall = power >= 1000
triggerall = command = "連繋b"
trigger1 = ctrl = 1
trigger1 = statetype != A
trigger2= (stateno=[200,242]) && movecontact
trigger3= (stateno=[400,440]) && movecontact
;地上病
[State -1, ChangeState]
type = ChangeState
value = 5410
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 0 || fvar(12) <= 5
triggerall = power >= 1000
triggerall = command = "連繋b"
trigger1 = ctrl = 1
trigger1 = statetype != A
trigger2= (stateno=[200,241]) && movecontact
trigger3= (stateno=[400,440]) && movecontact
;地上リバサ
[State -1, Varset]
type = Varset
var(16) = 3350
triggerall = var(16) = 0
trigger1 = command = "連繋b"

;---------------------------------------------------------------------------
;ダークネスフィンガー 影打
[State -1, ChangeState]
type = ChangeState
value = 3600
TriggerAll = Var(33) = 0
TriggerAll = var(22) = 1
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall = power >= 5000
triggerall = command = "ダークネスフィンガー" 
triggerall = TeamMode = single || TeamMode = turns
triggerall = enemy,TeamMode = single || enemy,TeamMode = turns
triggerall = Var(20) = 0
trigger1 = stateno = 3430

;===========================================================================
;------------------------| 必殺技 |-----------------------------------------
;===========================================================================
;ダークネスフィンガー 撃ち付け（強）
[State -1, ChangeState]
type = ChangeState
value = 3400
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall =  command = "ダークネスフィンガー 撃ち付けy"
trigger1 = ctrl = 1
trigger1 = statetype != A
trigger2= (stateno=[200,210]) && movecontact
trigger3= (stateno=[230,232]) && movecontact
trigger4= stateno = 240 && movecontact
trigger5= (stateno=[400,440]) && movecontact
;地上病
[State -1, ChangeState]
type = ChangeState
value = 5410
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 0 || fvar(12) <= 5
triggerall =  command = "ダークネスフィンガー 撃ち付けy"
trigger1 = ctrl = 1
trigger1 = statetype != A
trigger2= (stateno=[200,210]) && movecontact
trigger3= (stateno=[230,232]) && movecontact
trigger4= stateno = 240 && movecontact
trigger5= (stateno=[400,440]) && movecontact
;地上リバサ
[State -1, Varset]
type = Varset
var(16) = 3400
triggerall = var(16) = 0
trigger1 =  command = "ダークネスフィンガー 撃ち付けy"

;ダークネスフィンガー 撃ち付け（強）
[State -1, ChangeState]
type = ChangeState
value = 3401
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
TriggerAll = Var(19) = 1
triggerall =  command = "ダークネスフィンガー 撃ち付けy"
trigger1 = statetype = A
trigger1 = ctrl = 1
trigger2= (stateno=[600,640]) && movecontact
;空中病
[State -1, ChangeState]
type = ChangeState
value = 5420
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 0 || fvar(12) <= 5
TriggerAll = Var(19) = 1
triggerall =  command = "ダークネスフィンガー 撃ち付けy"
trigger1 = statetype = A
trigger1 = ctrl = 1
trigger2= (stateno=[600,640]) && movecontact
;空中リバサ
[State -1, Varset]
type = Varset
var(17) = 3401
triggerall = var(17) = 0
TriggerAll = Var(19) = 1
trigger1 =  command = "ダークネスフィンガー 撃ち付けy"

;---------------------------------------------------------------------------
;ダークネスフィンガー 撃ち付け（弱）
[State -1, ChangeState]
type = ChangeState
value = 3405
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall = command = "ダークネスフィンガー 撃ち付けx" 
trigger1 = ctrl = 1
trigger1 = statetype != A
trigger2= (stateno=[200,210]) && movecontact
trigger3= (stateno=[230,232]) && movecontact
trigger4= stateno = 240 && movecontact
trigger5= (stateno=[400,440]) && movecontact
;地上病
[State -1, ChangeState]
type = ChangeState
value = 5410
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 0 || fvar(12) <= 5
triggerall = command = "ダークネスフィンガー 撃ち付けx" 
trigger1 = ctrl = 1
trigger1 = statetype != A
trigger2= (stateno=[200,210]) && movecontact
trigger3= (stateno=[230,232]) && movecontact
trigger4= stateno = 240 && movecontact
trigger5= (stateno=[400,440]) && movecontact
;地上リバサ
[State -1, Varset]
type = Varset
var(16) = 3405
triggerall = var(16) = 0
trigger1 =  command = "ダークネスフィンガー 撃ち付けx"

;ダークネスフィンガー 撃ち付け（弱）
[State -1, ChangeState]
type = ChangeState
value = 3402
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
TriggerAll = Var(19) = 1
triggerall = command = "ダークネスフィンガー 撃ち付けx" 
trigger1 = statetype = A
trigger1 = ctrl = 1
trigger2= (stateno=[600,640]) && movecontact
;空中病
[State -1, ChangeState]
type = ChangeState
value = 5420
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 0 || fvar(12) <= 5
TriggerAll = Var(19) = 1
triggerall = command = "ダークネスフィンガー 撃ち付けx" 
trigger1 = statetype = A
trigger1 = ctrl = 1
trigger2= (stateno=[600,640]) && movecontact
;空中リバサ
[State -1, Varset]
type = Varset
var(17) = 3402
triggerall = var(17) = 0
TriggerAll = Var(19) = 1
trigger1 =  command = "ダークネスフィンガー 撃ち付けx"

;---------------------------------------------------------------------------
;こぶしでの攻撃（強）
[State -1, ChangeState]
type = ChangeState
value = 1078
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall = command = "こぶしでの攻撃（強）"
trigger1 = statetype != A
trigger1 = ctrl
trigger2= (stateno=[200,210]) && movecontact = 1
trigger3= (stateno=[230,232]) && movecontact = 1
trigger4= stateno = 240 && movecontact = 1
trigger5= (stateno=[400,440]) && movecontact = 1
;地上病
[State -1, ChangeState]
type = ChangeState
value = 5410
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 0 || fvar(12) <= 5
triggerall = command = "こぶしでの攻撃（強）"
trigger1 = statetype != A
trigger1 = ctrl
trigger2= (stateno=[200,210]) && movecontact = 1
trigger3= (stateno=[230,232]) && movecontact = 1
trigger4= stateno = 240 && movecontact = 1
trigger5= (stateno=[400,440]) && movecontact = 1
;地上リバサ
[State -1, Varset]
type = Varset
var(16) = 1078
triggerall = var(16) = 0
trigger1 = command = "こぶしでの攻撃（強）"

;---------------------------------------------------------------------------
;こぶしでの攻撃（弱）
[State -1, ChangeState]
type = ChangeState
value = 1070
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall = command = "こぶしでの攻撃（弱）"
trigger1 = statetype != A
trigger1 = ctrl
trigger2= (stateno=[200,210]) && movecontact
trigger3= (stateno=[230,232]) && movecontact
trigger4= stateno = 240 && movecontact
trigger5= (stateno=[400,440]) && movecontact
;地上病
[State -1, ChangeState]
type = ChangeState
value = 5410
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 0 || fvar(12) <= 5
triggerall = command = "こぶしでの攻撃（弱）"
trigger1 = statetype != A
trigger1 = ctrl
trigger2= (stateno=[200,210]) && movecontact
trigger3= (stateno=[230,232]) && movecontact
trigger4= stateno = 240 && movecontact
trigger5= (stateno=[400,440]) && movecontact
;地上リバサ
[State -1, Varset]
type = Varset
var(16) = 1070
triggerall = var(16) = 0
trigger1 = command = "こぶしでの攻撃（弱）"

;---------------------------------------------------------------------------
;空中ラッシュ（強）
[State -1, ChangeState]
type = ChangeState
value = 1045
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall = command = "空中ラッシュ（強）"
trigger1 = statetype = A
trigger1 = ctrl
trigger2= (stateno=[600,640]) && movecontact
;空中病
[State -1, ChangeState]
type = ChangeState
value = 5420
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 0 || fvar(12) <= 5
triggerall = command = "空中ラッシュ（強）"
trigger1 = statetype = A
trigger1 = ctrl
trigger2= (stateno=[600,640]) && movecontact
;空中リバサ
[State -1, Varset]
type = Varset
var(17) = 1045
triggerall = var(17) = 0
trigger1 = command = "空中ラッシュ（強）"

;---------------------------------------------------------------------------
;空中ラッシュ（弱）
[State -1, ChangeState]
type = ChangeState
value = 1040
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall = command = "空中ラッシュ（弱）"
trigger1 = statetype = A
trigger1 = ctrl
trigger2= (stateno=[600,640]) && movecontact
;空中病
[State -1, ChangeState]
type = ChangeState
value = 5420
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 0 || fvar(12) <= 5
triggerall = command = "空中ラッシュ（弱）"
trigger1 = statetype = A
trigger1 = ctrl
trigger2= (stateno=[600,640]) && movecontact
;空中リバサ
[State -1, Varset]
type = Varset
var(17) = 1040
triggerall = var(17) = 0
trigger1 = command = "空中ラッシュ（弱）"

;---------------------------------------------------------------------------
;落ち蹴り（EX）
[State -1, ChangeState]
type = ChangeState
value = 1035
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall = command = "落ち蹴り（EX）"
trigger1 = statetype = A
trigger1 = ctrl
trigger2= (stateno=[600,640]) && movecontact
;空中病
[State -1, ChangeState]
type = ChangeState
value = 5410
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 0 || fvar(12) <= 5
triggerall = command = "落ち蹴り（EX）"
trigger1 = statetype = A
trigger1 = ctrl
trigger2= (stateno=[600,640]) && movecontact
;空中リバサ
[State -1, Varset]
type = Varset
var(17) = 1035
triggerall = var(17) = 0
trigger1 = command = "落ち蹴り（EX）"

;---------------------------------------------------------------------------
;落ち蹴り（強）
[State -1, ChangeState]
type = ChangeState
value = 1030
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall = command = "落ち蹴り（強）"
trigger1 = statetype = A
trigger1 = ctrl
trigger2= (stateno=[600,640]) && movecontact
;空中病
[State -1, ChangeState]
type = ChangeState
value = 5420
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 0 || fvar(12) <= 5
triggerall = command = "落ち蹴り（強）"
trigger1 = statetype = A
trigger1 = ctrl
trigger2= (stateno=[600,640]) && movecontact
;空中リバサ
[State -1, Varset]
type = Varset
var(17) = 1030
triggerall = var(17) = 0
trigger1 = command = "落ち蹴り（強）"

;---------------------------------------------------------------------------
;落ち蹴り（弱）
[State -1, ChangeState]
type = ChangeState
value = 1020
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall = command = "落ち蹴り（弱）"
trigger1 = statetype = A
trigger1 = ctrl
trigger2= (stateno=[600,640]) && movecontact
;空中病
[State -1, ChangeState]
type = ChangeState
value = 5420
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 0 || fvar(12) <= 5
triggerall = command = "落ち蹴り（弱）"
trigger1 = statetype = A
trigger1 = ctrl
trigger2= (stateno=[600,640]) && movecontact
;空中リバサ
[State -1, Varset]
type = Varset
var(17) = 1020
triggerall = var(17) = 0
trigger1 = command = "落ち蹴り（弱）"

;---------------------------------------------------------------------------
;ラッシュ（強）
[State -1, ChangeState]
type = ChangeState
value = 1018
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall = command = "落ち蹴り（強）"
trigger1 = statetype != A
trigger1 = ctrl
trigger2= (stateno=[200,210]) && movecontact
trigger3= (stateno=[230,232]) && movecontact
trigger4= stateno = 240 && movecontact
trigger5= (stateno=[400,440]) && movecontact
;地上病
[State -1, ChangeState]
type = ChangeState
value = 5410
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 0 || fvar(12) <= 5
triggerall = command = "落ち蹴り（強）"
trigger1 = statetype != A
trigger1 = ctrl
trigger2= (stateno=[200,210]) && movecontact
trigger3= (stateno=[230,232]) && movecontact
trigger4= stateno = 240 && movecontact
trigger5= (stateno=[400,440]) && movecontact
;地上リバサ
[State -1, Varset]
type = Varset
var(16) = 1018
triggerall = var(16) = 0
trigger1 = command = "落ち蹴り（強）"

;---------------------------------------------------------------------------
;ラッシュ（弱）
[State -1, ChangeState]
type = ChangeState
value = 1010
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall = command = "落ち蹴り（弱）"
trigger1 = statetype != A
trigger1 = ctrl
trigger2= (stateno=[200,210]) && movecontact
trigger3= (stateno=[230,232]) && movecontact
trigger4= stateno = 240 && movecontact
trigger5= (stateno=[400,440]) && movecontact
;地上病
[State -1, ChangeState]
type = ChangeState
value = 5410
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 0 || fvar(12) <= 5
triggerall = command = "落ち蹴り（弱）"
trigger1 = statetype != A
trigger1 = ctrl
trigger2= (stateno=[200,210]) && movecontact
trigger3= (stateno=[230,232]) && movecontact
trigger4= stateno = 240 && movecontact
trigger5= (stateno=[400,440]) && movecontact
;地上リバサ
[State -1, Varset]
type = Varset
var(16) = 1010
triggerall = var(16) = 0
trigger1 = command = "落ち蹴り（弱）"

;---------------------------------------------------------------------------
;回転（強）
[State -1, ChangeState]
type = ChangeState
value = 1055
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall = command = "回転（強）"
trigger1 = statetype != A
trigger1 = ctrl
trigger2= (stateno=[200,210]) && movecontact
trigger3= (stateno=[230,232]) && movecontact
trigger4= stateno = 240 && movecontact
trigger5= (stateno=[400,440]) && movecontact
;地上病
[State -1, ChangeState]
type = ChangeState
value = 5410
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 0 || fvar(12) <= 5
triggerall = command = "回転（強）"
trigger1 = statetype != A
trigger1 = ctrl
trigger2= (stateno=[200,210]) && movecontact
trigger3= (stateno=[230,232]) && movecontact
trigger4= stateno = 240 && movecontact
trigger5= (stateno=[400,440]) && movecontact
;地上リバサ
[State -1, Varset]
type = Varset
var(16) = 1055
triggerall = var(16) = 0
trigger1 = command = "回転（強）"

;回転空中（強）
[State -1, ChangeState]
type = ChangeState
value = 1061
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall = command = "回転（強）"
trigger1 = statetype = A
trigger1 = ctrl
trigger2= (stateno=[600,640]) && movecontact
;空中病
[State -1, ChangeState]
type = ChangeState
value = 5420
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 0 || fvar(12) <= 5
triggerall = command = "回転（強）"
trigger1 = statetype = A
trigger1 = ctrl
trigger2= (stateno=[600,640]) && movecontact
;空中リバサ
[State -1, Varset]
type = Varset
var(17) = 1061
triggerall = var(17) = 0
trigger1 = command = "回転（強）"

;---------------------------------------------------------------------------
;回転（弱）
[State -1, ChangeState]
type = ChangeState
value = 1050
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall = command = "回転（弱）"
triggerall = statetype != A
trigger1 = ctrl
trigger2= (stateno=[200,210]) && movecontact
trigger3= (stateno=[230,232]) && movecontact
trigger4= stateno = 240 && movecontact
trigger5= (stateno=[400,440]) && movecontact
trigger6= (stateno=[600,640]) && movecontact
;地上病
[State -1, ChangeState]
type = ChangeState
value = 5410
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 0 || fvar(12) <= 5
triggerall = command = "回転（弱）"
triggerall = statetype != A
trigger1 = ctrl
trigger2= (stateno=[200,210]) && movecontact
trigger3= (stateno=[230,232]) && movecontact
trigger4= stateno = 240 && movecontact
trigger5= (stateno=[400,440]) && movecontact
trigger6= (stateno=[600,640]) && movecontact
;地上リバサ
[State -1, Varset]
type = Varset
var(16) = 1050
triggerall = var(16) = 0
trigger1 = command = "回転（弱）"

;回転（弱）
[State -1, ChangeState]
type = ChangeState
value = 1054
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall = command = "回転（弱）"
triggerall = statetype = A
trigger1 = ctrl
trigger2= (stateno=[200,210]) && movecontact
trigger3= (stateno=[230,232]) && movecontact
trigger4= stateno = 240 && movecontact
trigger5= (stateno=[400,440]) && movecontact
trigger6= (stateno=[600,640]) && movecontact
;空中病
[State -1, ChangeState]
type = ChangeState
value = 5420
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 0 || fvar(12) <= 5
triggerall = command = "回転（弱）"
triggerall = statetype = A
trigger1 = ctrl
trigger2= (stateno=[200,210]) && movecontact
trigger3= (stateno=[230,232]) && movecontact
trigger4= stateno = 240 && movecontact
trigger5= (stateno=[400,440]) && movecontact
trigger6= (stateno=[600,640]) && movecontact
;空中リバサ
[State -1, Varset]
type = Varset
var(17) = 1054
triggerall = var(17) = 0
trigger1 = command = "回転（弱）"

;---------------------------------------------------------------------------
;衝撃波（強）
[State -1, ChangeState]
type = ChangeState
value = 1005
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall = command = "衝撃波（強）"
trigger1 = statetype != A
trigger1 = ctrl
;地上病
[State -1, ChangeState]
type = ChangeState
value = 5410
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 0 || fvar(12) <= 5
triggerall = command = "衝撃波（強）"
trigger1 = statetype != A
trigger1 = ctrl
;地上リバサ
[State -1, Varset]
type = Varset
var(16) = 1005
triggerall = var(16) = 0
trigger1 = command = "衝撃波（強）"

;---------------------------------------------------------------------------
;衝撃波（弱）
[State -1, ChangeState]
type = ChangeState
value = 1000
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall = command = "衝撃波（弱）"
trigger1 = statetype != A
trigger1 = ctrl
;地上病
[State -1, ChangeState]
type = ChangeState
value = 5410
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 0 || fvar(12) <= 5
triggerall = command = "衝撃波（弱）"
trigger1 = statetype != A
trigger1 = ctrl
;地上リバサ
[State -1, Varset]
type = Varset
var(16) = 1000
triggerall = var(16) = 0
trigger1 = command = "衝撃波（弱）"

;===========================================================================
;===========================================================================
;展開
[State -1, ChangeState]
type = ChangeState
value = 4999
TriggerAll = Var(40) != 1
TriggerAll = Var(33) = 0
triggerall = statetype = S
trigger1 = command = "展開"
trigger1 = ctrl

[State -1, ChangeState]
type = ChangeState
value = 4998
TriggerAll = Var(40) = 1
TriggerAll = Var(33) = 0
triggerall = statetype = S
trigger1 = command = "展開"
trigger1 = ctrl

;---------------------------------------------------------------------------
;壁張り付き
[State -1, ChangeState]
type = ChangeState
value = 110
TriggerAll = Var(33) = 0
trigger1 = command = "c"
trigger1 = statetype = A
trigger1 = BackEdgeBodyDist < 11
trigger1 = ctrl

;---------------------------------------------------------------------------
;ダッシュ
[State -1, ChangeState]
type = ChangeState
value = 100
TriggerAll = Var(33) = 0
trigger1 = command = "Dasyu"
trigger1 = statetype = S
trigger1 = ctrl
trigger2= stateno = 1074 && movehit
trigger2= command = "holdfwd"
trigger2= p2stateno = 280

;---------------------------------------------------------------------------
;後退ダッシュ
[State -1, ChangeState]
type = ChangeState
value = 105
TriggerAll = Var(33) = 0
triggerall = command = "BakuSutep"
triggerall = statetype = S
trigger1= stateno != 105
trigger1 = ctrl

;---------------------------------------------------------------------------
;前方空中ダッシュ
[State -1, ChangeState]
type = ChangeState
value = 7020
TriggerAll = Var(8) <= 0
TriggerAll = Var(40) = 1
TriggerAll = Var(33) = 0
trigger1 = command = "Dasyu"
trigger1 = statetype = A
trigger1 = ctrl

;---------------------------------------------------------------------------
;後方空中ダッシュ
[State -1, ChangeState]
type = ChangeState
value = 7030
TriggerAll = Var(9) <= 0
TriggerAll = Var(40) = 1
TriggerAll = Var(33) = 0
triggerall = command = "BakuSutep"
triggerall = statetype = A
trigger1 = ctrl

;---------------------------------------------------------------------------
;投げ
[State -1, ChangeState]
type = ChangeState
value = 700
TriggerAll = Var(33) = 0
triggerall = statetype = S
trigger1 = command = "投げ"
trigger1 = ctrl

;---------------------------------------------------------------------------
;ガードキャンセル
[State -1, ChangeState]
type = ChangeState
value = 920
TriggerAll = Var(33) = 0
triggerall = command = "ガードキャンセル"
triggerall = command = "holdfwd"
triggerall = fvar(12) < 5
trigger1 = stateno = 150
trigger2 = stateno = 151

;---------------------------------------------------------------------------
;変則立ち弱パンチ
[State -1, ChangeState]
type = ChangeState
value = 205
TriggerAll = Var(33) = 0
triggerall = command = "変則立ち弱パンチ"
triggerall = command != "holddown"
trigger1 = statetype = S
trigger1 = ctrl
trigger2= stateno = 200 && movecontact
trigger3= stateno = 203 && movecontact
trigger4 = stateno = 101
trigger5 = stateno = [103,104]
trigger6 = stateno= 400 && movecontact

;---------------------------------------------------------------------------
;近距離立ち弱パンチ
[State -1, ChangeState]
type = ChangeState
value = 200
TriggerAll = Var(33) = 0
triggerall = command = "x"
triggerall = command != "holddown"
triggerall = p2bodydist X <= 20
triggerall = p2bodydist Y = 0
trigger1 = p2statetype != A
trigger1 = statetype = S
trigger1 = ctrl
trigger2 = stateno = 101
trigger3 = stateno = [103,104]

;---------------------------------------------------------------------------
;立ち弱パンチ
[State -1, ChangeState]
type = ChangeState
value = 203
TriggerAll = Var(33) = 0
triggerall = command = "x"
triggerall = command != "holddown"
trigger1 = statetype = S
trigger1 = ctrl
trigger2 = stateno = 101
trigger3 = stateno = [103,104]

;---------------------------------------------------------------------------
;立ち強パンチ
[State -1, ChangeState]
type = ChangeState
value = 210
TriggerAll = Var(33) = 0
triggerall = command = "y"
triggerall = command != "holddown"
trigger1 = statetype = S
trigger1 = ctrl
trigger2= (stateno=[200,205]) && movecontact
trigger3= (stateno=[230,232]) && movecontact
trigger4 = stateno = 101
trigger5 = stateno = [103,104]
trigger6 = stateno= 400 && movecontact

;---------------------------------------------------------------------------
;立ち弱キック
[State -1, ChangeState]
type = ChangeState
value = 230
TriggerAll = Var(33) = 0
triggerall = command = "a"
triggerall = command != "holddown"
triggerall = p2bodydist X >= 20
trigger1 = statetype = S
trigger1 = ctrl
trigger2= (stateno=[200,205]) && movecontact
trigger3 = stateno = 101
trigger4 = stateno = [103,104]
trigger6 = stateno= 400 && movecontact

;---------------------------------------------------------------------------
;近距離立ち弱キック
[State -1, ChangeState]
type = ChangeState
value = 232
TriggerAll = Var(33) = 0
triggerall = command = "a"
triggerall = command != "holddown"
triggerall = p2bodydist X <= 20
trigger1 = statetype = S
trigger1 = ctrl
trigger2= (stateno=[200,205]) && movecontact
trigger3 = stateno = 101
trigger4 = stateno = [103,104]
trigger5 = stateno= 400 && movecontact

;---------------------------------------------------------------------------
;立ち強キック
[State -1, ChangeState]
type = ChangeState
value = 240
TriggerAll = Var(33) = 0
triggerall = command = "b"
triggerall = command != "holddown"
trigger1 = statetype = S
trigger1 = ctrl
trigger2= (stateno=[200,210]) && movecontact
trigger3= (stateno=[230,232]) && movecontact
trigger4 = stateno = 101
trigger5 = stateno = [103,104]
trigger6 = stateno= 400 && movecontact

;---------------------------------------------------------------------------
;挑発
[State -1, ChangeState]
type = ChangeState
value = 195
TriggerAll = Var(33) = 0
triggerall = command = "start"
trigger1 = statetype != A
trigger1 = ctrl

;---------------------------------------------------------------------------
;しゃがみ弱パンチ
[State -1, ChangeState]
type = ChangeState
value = 400
TriggerAll = Var(33) = 0
triggerall = command = "x"
triggerall = command = "holddown"
trigger1 = statetype = C
trigger1 = ctrl
trigger2 = stateno = 101
trigger3 = stateno = [103,104]

;---------------------------------------------------------------------------
;しゃがみ強パンチ
[State -1, ChangeState]
type = ChangeState
value = 410
TriggerAll = Var(33) = 0
triggerall = command = "y"
triggerall = command = "holddown"
trigger1 = statetype = C
trigger1 = ctrl
trigger2= stateno = 400 && movecontact
trigger3= stateno = 430 && movecontact
trigger4 = stateno = 101
trigger5 = stateno = [103,104]

;---------------------------------------------------------------------------
;しゃがみ弱キック
[State -1, ChangeState]
type = ChangeState
value = 430
TriggerAll = Var(33) = 0
triggerall = command = "a"
triggerall = command = "holddown"
trigger1 = statetype = C
trigger1 = ctrl
trigger2= stateno = 400 && movecontact
trigger3 = stateno = 101
trigger4 = stateno = [103,104]

;---------------------------------------------------------------------------
;しゃがみ強キック
[State -1, ChangeState]
type = ChangeState
value = 440
TriggerAll = Var(33) = 0
triggerall = command = "b"
triggerall = command = "holddown"
trigger1 = statetype = C
trigger1 = ctrl
trigger2= (stateno=[400,430]) && movecontact
trigger3 = stateno = 101
trigger4 = stateno = [103,104]

;---------------------------------------------------------------------------
;空中弱パンチ
[State -1, ChangeState]
type = ChangeState
value = 600
TriggerAll = Var(33) = 0
triggerall = command = "x"
trigger1 = statetype = A
trigger1 = ctrl

;---------------------------------------------------------------------------
;空中強パンチ
[State -1, ChangeState]
type = ChangeState
value = 610
TriggerAll = Var(33) = 0
triggerall = command = "y"
trigger1 = statetype = A
trigger1 = ctrl
trigger2= stateno = 600 && movecontact
trigger3= stateno = 630 && movecontact
;---------------------------------------------------------------------------
;空中弱キック
[State -1, ChangeState]
type = ChangeState
value = 630
TriggerAll = Var(33) = 0
triggerall = command = "a"
trigger1 = statetype = A
trigger1 = ctrl
trigger2= stateno = 600 && movecontact

;---------------------------------------------------------------------------
;空中強キック
[State -1, ChangeState]
type = ChangeState
value = 640
TriggerAll = Var(33) = 0
triggerall = command = "b"
trigger1 = statetype = A
trigger1 = ctrl
trigger2= (stateno=[600,630]) && movecontact

;===========================================================================
;------------------------| 高速移動 |---------------------------------------
;===========================================================================
; 高速移動 (上前方)
[State -1, ChangeState]
type = ChangeState
value = 6070
TriggerAll = Var(40) != 1
TriggerAll = Var(33) = 0
triggerall = command = "UF_z" 
triggerall = var(12) = 0
trigger1 = statetype = S
trigger1 = ctrl
trigger2= (stateno=[200,241]) && movecontact
trigger3= (stateno=3850) && MoveGuarded
trigger4=  stateno = 40
;地上病
[State -1, ChangeState]
type = ChangeState
value = 5410
TriggerAll = Var(40) != 1
TriggerAll = Var(33) = 0
triggerall = command = "UF_z" 
triggerall = var(12) = 1
trigger1 = statetype = S
trigger1 = ctrl
trigger2= (stateno=[200,241]) && movecontact

;---------------------------------------------------------------------------
; 高速移動 (上後方)
[State -1, ChangeState]
type = ChangeState
value = 6050
TriggerAll = Var(40) != 1
TriggerAll = Var(33) = 0
triggerall = command = "UB_z" 
triggerall = var(12) = 0
trigger1 = statetype = S
trigger1 = ctrl
trigger2= (stateno=[200,241]) && movecontact
trigger3= (stateno=3850) && MoveGuarded
trigger4=  stateno = 40
;地上病
[State -1, ChangeState]
type = ChangeState
value = 5410
TriggerAll = Var(40) != 1
TriggerAll = Var(33) = 0
triggerall = command = "UB_z" 
triggerall = var(12) = 1
trigger1 = statetype = S
trigger1 = ctrl
trigger2= (stateno=[200,241]) && movecontact

;---------------------------------------------------------------------------
; 高速移動 (上方)
[State -1, ChangeState]
type = ChangeState
value = 6060
TriggerAll = Var(40) != 1
TriggerAll = Var(33) = 0
triggerall = command = "U_z"
triggerall = var(12) = 0
trigger1 = statetype = S
trigger1 = ctrl
trigger2= (stateno=[200,241]) && movecontact
trigger3= (stateno=3850) && MoveGuarded
trigger4=  stateno = 40
;地上病
[State -1, ChangeState]
type = ChangeState
value = 5410
TriggerAll = Var(40) != 1
TriggerAll = Var(33) = 0
triggerall = command = "U_z"
triggerall = var(12) = 1
trigger1 = statetype = S
trigger1 = ctrl
trigger2= (stateno=[200,241]) && movecontact

;---------------------------------------------------------------------------
; 高速移動 (前方)
[State -1, ChangeState]
type = ChangeState
value = 6000
TriggerAll = Var(40) != 1
TriggerAll = Var(33) = 0
triggerall = command = "F_z" 
triggerall = var(12) = 0
trigger1 = statetype = S
trigger1 = ctrl
trigger2= (stateno=[200,241]) && movecontact
trigger3= (stateno=3850) && MoveGuarded
;地上病
[State -1, ChangeState]
type = ChangeState
value = 5410
TriggerAll = Var(40) != 1
TriggerAll = Var(33) = 0
triggerall = command = "F_z" 
triggerall = var(12) = 1
trigger1 = statetype = S
trigger1 = ctrl
trigger2= (stateno=[200,241]) && movecontact

;---------------------------------------------------------------------------
; 高速移動 (後方)
[State -1, ChangeState]
type = ChangeState
value = 6001
TriggerAll = Var(40) != 1
TriggerAll = Var(33) = 0
triggerall = command = "B_z"
triggerall = var(12) = 0
trigger1 = statetype = S
trigger1 = ctrl
trigger2= (stateno=[200,241]) && movecontact
trigger3= (stateno=3850) && MoveGuarded
;地上病
[State -1, ChangeState]
type = ChangeState
value = 5410
TriggerAll = Var(40) != 1
TriggerAll = Var(33) = 0
triggerall = command = "B_z"
triggerall = var(12) = 1
trigger1 = statetype = S
trigger1 = ctrl
trigger2= (stateno=[200,241]) && movecontact

;---------------------------------------------------------------------------
; 高速移動 
[State -1, ChangeState]
type = ChangeState
value = 5999
TriggerAll = Var(40) != 1
TriggerAll = Var(33) = 0
triggerall = command = "z" 
triggerall = var(12) = 0
trigger1 = statetype = S
trigger1 = ctrl
;地上病
[State -1, ChangeState]
type = ChangeState
value = 5410
TriggerAll = Var(40) != 1
TriggerAll = Var(33) = 0
triggerall = command = "z" 
triggerall = var(12) = 1
trigger1 = statetype = S
trigger1 = ctrl

;---------------------------------------------------------------------------
; しゃがみ高速移動 (前方)
[State -1, ChangeState]
type = ChangeState
value = 6200
TriggerAll = Var(40) != 1
TriggerAll = Var(33) = 0
triggerall = command = "F_z" 
triggerall = var(12) = 0
trigger1 = statetype = C
trigger1 = ctrl
trigger2= (stateno=[400,440]) && movecontact
;地上病
[State -1, ChangeState]
type = ChangeState
value = 5410
TriggerAll = Var(40) != 1
TriggerAll = Var(33) = 0
triggerall = command = "F_z" 
triggerall = var(12) = 1
trigger1 = statetype = C
trigger1 = ctrl
trigger2= (stateno=[400,440]) && movecontact

;---------------------------------------------------------------------------
; しゃがみ高速移動 (後方)
[State -1, ChangeState]
type = ChangeState
value = 6201
TriggerAll = Var(40) != 1
TriggerAll = Var(33) = 0
triggerall = command = "B_z"
triggerall = var(12) = 0
trigger1 = statetype = C
trigger1 = ctrl
trigger2= (stateno=[400,440]) && movecontact
;地上病
[State -1, ChangeState]
type = ChangeState
value = 5410
TriggerAll = Var(40) != 1
TriggerAll = Var(33) = 0
triggerall = command = "B_z"
triggerall = var(12) = 1
trigger1 = statetype = C
trigger1 = ctrl
trigger2= (stateno=[400,440]) && movecontact

;---------------------------------------------------------------------------
; しゃがみ高速移動 
[State -1, ChangeState]
type = ChangeState
value = 6999
TriggerAll = Var(40) != 1
TriggerAll = Var(33) = 0
triggerall = command = "z" 
triggerall = var(12) = 0
trigger1 = statetype = C
trigger1 = ctrl
;地上病
[State -1, ChangeState]
type = ChangeState
value = 5410
TriggerAll = Var(40) != 1
TriggerAll = Var(33) = 0
triggerall = command = "z" 
triggerall = var(12) = 1
trigger1 = statetype = C
trigger1 = ctrl

;---------------------------------------------------------------------------
; 空中高速移動 (下前方)
[State -1, ChangeState]
type = ChangeState
value = 6110
TriggerAll = Var(40) != 1
TriggerAll = Var(33) = 0
triggerall = var(3) = [0,2]
triggerall = command = "DF_z"
triggerall = var(12) = 0
trigger1 = statetype = A
trigger1 = ctrl
trigger2= (stateno=[600,640]) && movecontact
;空中病
[State -1, ChangeState]
type = ChangeState
value = 5420
TriggerAll = Var(40) != 1
TriggerAll = Var(33) = 0
triggerall = var(3) = [0,2]
triggerall = command = "DF_z"
triggerall = var(12) = 1
trigger1 = statetype = A
trigger1 = ctrl
trigger2= (stateno=[600,640]) && movecontact

;---------------------------------------------------------------------------
; 空中高速移動 (下後方)
[State -1, ChangeState]
type = ChangeState
value = 6130
TriggerAll = Var(40) != 1
TriggerAll = Var(33) = 0
triggerall = var(3) = [0,2]
triggerall = command = "DB_z"
triggerall = var(12) = 0
trigger1 = statetype = A
trigger1 = ctrl
trigger2= (stateno=[600,640]) && movecontact
;空中病
[State -1, ChangeState]
type = ChangeState
value = 5420
TriggerAll = Var(40) != 1
TriggerAll = Var(33) = 0
triggerall = var(3) = [0,2]
triggerall = command = "DB_z"
triggerall = var(12) = 1
trigger1 = statetype = A
trigger1 = ctrl
trigger2= (stateno=[600,640]) && movecontact

;---------------------------------------------------------------------------
; 空中高速移動 (後上方)
[State -1, ChangeState]
type = ChangeState
value = 6150
TriggerAll = Var(40) != 1
TriggerAll = Var(33) = 0
triggerall = var(3) = [0,2]
triggerall = command = "UB_z"
triggerall = var(12) = 0
trigger1 = statetype = A
trigger1 = ctrl
trigger2= (stateno=[600,640]) && movecontact
;空中病
[State -1, ChangeState]
type = ChangeState
value = 5420
TriggerAll = Var(40) != 1
TriggerAll = Var(33) = 0
triggerall = var(3) = [0,2]
triggerall = command = "UB_z"
triggerall = var(12) = 1
trigger1 = statetype = A
trigger1 = ctrl
trigger2= (stateno=[600,640]) && movecontact

;---------------------------------------------------------------------------
; 空中高速移動 (上前方)
[State -1, ChangeState]
type = ChangeState
value = 6170
TriggerAll = Var(40) != 1
TriggerAll = Var(33) = 0
triggerall = var(3) = [0,2]
triggerall = command = "UF_z"
triggerall = var(12) = 0
trigger1 = statetype = A
trigger1 = ctrl
trigger2= (stateno=[600,640]) && movecontact
;空中病
[State -1, ChangeState]
type = ChangeState
value = 5420
TriggerAll = Var(40) != 1
TriggerAll = Var(33) = 0
triggerall = var(3) = [0,2]
triggerall = command = "UF_z"
triggerall = var(12) = 1
trigger1 = statetype = A
trigger1 = ctrl
trigger2= (stateno=[600,640]) && movecontact

;---------------------------------------------------------------------------
; 空中高速移動 (前方)
[State -1, ChangeState]
type = ChangeState
value = 6100
TriggerAll = Var(40) != 1
TriggerAll = Var(33) = 0
triggerall = var(3) = [0,2]
triggerall = command = "F_z"
triggerall = var(12) = 0
trigger1 = statetype = A
trigger1 = ctrl
trigger2= (stateno=[600,640]) && movecontact
;空中病
[State -1, ChangeState]
type = ChangeState
value = 5420
TriggerAll = Var(40) != 1
TriggerAll = Var(33) = 0
triggerall = var(3) = [0,2]
triggerall = command = "F_z"
triggerall = var(12) = 1
trigger1 = statetype = A
trigger1 = ctrl
trigger2= (stateno=[600,640]) && movecontact

;---------------------------------------------------------------------------
; 空中高速移動 (下方)
[State -1, ChangeState]
type = ChangeState
value = 6120
TriggerAll = Var(40) != 1
TriggerAll = Var(33) = 0
triggerall = var(3) = [0,2]
triggerall = command = "D_z"
triggerall = var(12) = 0
trigger1 = statetype = A
trigger1 = ctrl
trigger2= (stateno=[600,640]) && movecontact
;空中病
[State -1, ChangeState]
type = ChangeState
value = 5420
TriggerAll = Var(40) != 1
TriggerAll = Var(33) = 0
triggerall = var(3) = [0,2]
triggerall = command = "D_z"
triggerall = var(12) = 1
trigger1 = statetype = A
trigger1 = ctrl
trigger2= (stateno=[600,640]) && movecontact

;---------------------------------------------------------------------------
; 空中高速移動 (後方)
[State -1, ChangeState]
type = ChangeState
value = 6140
TriggerAll = Var(40) != 1
TriggerAll = Var(33) = 0
triggerall = var(3) = [0,2]
triggerall = command = "B_z"
triggerall = var(12) = 0
trigger1 = statetype = A
trigger1 = ctrl
trigger2= (stateno=[600,640]) && movecontact
;空中病
[State -1, ChangeState]
type = ChangeState
value = 5420
TriggerAll = Var(40) != 1
TriggerAll = Var(33) = 0
triggerall = var(3) = [0,2]
triggerall = command = "B_z"
triggerall = var(12) = 1
trigger1 = statetype = A
trigger1 = ctrl
trigger2= (stateno=[600,640]) && movecontact

;---------------------------------------------------------------------------
; 空中高速移動 (上方)
[State -1, ChangeState]
type = ChangeState
value = 6160
TriggerAll = Var(40) != 1
TriggerAll = Var(33) = 0
triggerall = var(3) = [0,2]
triggerall = command = "U_z"
triggerall = var(12) = 0
trigger1 = statetype = A
trigger1 = ctrl
trigger2= (stateno=[600,640]) && movecontact
;空中病
[State -1, ChangeState]
type = ChangeState
value = 5420
TriggerAll = Var(40) != 1
TriggerAll = Var(33) = 0
triggerall = var(3) = [0,2]
triggerall = command = "U_z"
triggerall = var(12) = 1
trigger1 = statetype = A
trigger1 = ctrl
trigger2= (stateno=[600,640]) && movecontact 

;---------------------------------------------------------------------------
; 空中高速移動 
[State -1, ChangeState]
type = ChangeState
value = 6099
TriggerAll = Var(40) != 1
TriggerAll = Var(33) = 0
triggerall = var(3) = [0,2]
triggerall = command = "z"
triggerall = var(12) = 0
trigger1 = statetype = A
trigger1 = ctrl
;空中病
[State -1, ChangeState]
type = ChangeState
value = 5420
TriggerAll = Var(40) != 1
TriggerAll = Var(33) = 0
triggerall = var(3) = [0,2]
triggerall = command = "z"
triggerall = var(12) = 1
trigger1 = statetype = A
trigger1 = ctrl

;---------------------------------------------------------------------------
;展開高速移動上
[State -1, ChangeState]
type = ChangeState
value = 7000
TriggerAll = Var(40) = 1
TriggerAll = Var(33) = 0
triggerall = command = "z"
trigger1 = statetype != A
trigger1 = ctrl

;展開高速移動下
[State -1, ChangeState]
type = ChangeState
value = 7010
TriggerAll = Var(40) = 1
TriggerAll = Var(33) = 0
triggerall = command = "z"
trigger1 = statetype = A
trigger1 = ctrl

;---------------------------------------------------------------------------
;---------------------------------------------------------------------------
; 超ロングジャンプ
[State -1, ChangeState]
type = ChangeState
value = 60
TriggerAll = Var(33) = 0
triggerall = statetype = S
triggerall = ctrl = 1
triggerall = command = "longjump"
trigger1 = prevstateno = 999
trigger2 = command = "hold_c"

;---------------------------------------------------------------------------
; 気力溜め
[State -1, ChangeState]
type = ChangeState
value = 999
TriggerAll = Var(33) = 0
TriggerAll = Var(20) = 0
triggerall = statetype != A
triggerall = Power < 9000 || fvar(12) > 0
triggerall = ctrl = 1
triggerall= stateno != [100,103]
trigger1 = command = "hold_c"

;---------------------------------------------------------------------------
;ブロッキング立ち
[State -1, hitoverride]
type = hitoverride
TriggerAll = Var(33) = 0
triggerall = statetype = S
triggerall = command = "fwd" && command != "back" && command != "up" && command != "down"
triggerall = movetype != A
triggerall = movetype != H
trigger1 = stateno=902 || stateno=903
trigger2 = stateno= 0
trigger3 = stateno= 10
trigger4 = stateno= 11
trigger5 = stateno= 12
trigger6 = stateno= 20
attr = SA,AA,AP
stateno = 902
slot = 0
time = ifelse((stateno=[150,153]),6,8)

;---------------------------------------------------------------------------
;ブロッキングしゃがみ
[State -1, hitoverride]
type = hitoverride
TriggerAll = Var(33) = 0
triggerall=(statetype=S&&command="down")||(statetype=C&&command="fwd")&&command!="back"&&command!="up"
triggerall = movetype != A
trigger1 = stateno=902 || stateno=903
trigger2 = stateno= 0
trigger3 = stateno= 10
trigger4 = stateno= 11
trigger5 = stateno= 12
trigger6 = stateno= 20
attr = C,AA,AP
stateno = 903
slot = 0
time = ifelse((stateno=[150,153]),6,8)

;---------------------------------------------------------------------------
;ブロッキング空中
[State -1, hitoverride]
type = hitoverride
TriggerAll = Var(33) = 0
triggerall = command = "fwd" && command != "back" && command != "up" && command != "down"
triggerall = movetype != A
triggerall = statetype = A
trigger1 = stateno=904
trigger2 = stateno= 45
trigger3 = stateno= 50
trigger4 = stateno= 51
attr = SA,AA,AP
stateno = 904
forceair = 1
slot = 0
time = ifelse((stateno=[154,155]),6,8)


;---------------------------------------------------------------------------
;---------------------------------------------------------------------------
;---------------------------------------------------------------------------
;---------------------------------------------------------------------------
;---------------------------------------------------------------------------
;---------------------------------------------------------------------------
;---------------------------------------------------------------------------
;---------------------------------------------------------------------------
;---------------------------------------------------------------------------
;---------------------------------------------------------------------------
;---------------------------------------------------------------------------
;---------------------------------------------------------------------------
;---------------------------------------------------------------------------
;---------------------------------------------------------------------------
;---------------------------------------------------------------------------
;---------------------------------------------------------------------------
;---------------------------------------------------------------------------
;---------------------------------------------------------------------------
;---------------------------------------------------------------------------
;---------------------------------------------------------------------------
;---------------------------------------------------------------------------
;---------------------------------------------------------------------------
;---------------------------------------------------------------------------
;---------------------------------------------------------------------------
;━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
;━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
;━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[State -1, Explod];床激突　【落ち蹴り｢強｣】【落ち蹴り｢強｣(強化)】【相手の背後から蹴る(強)】
type = Explod
triggerall = p2movetype = H
triggerall = numexplod(17000) = 0
trigger1 = p2stateno = 261 || p2stateno = 264
trigger2 = p2stateno = 291
anim = 17000
pos = -14, 2
postype = p2
sprpriority = -3
ontop = 1
ownpal = 1
id = 17000


[State -1, Explod];壁激突　 【相手の背後から蹴る(弱)】【天驚拳】【立ち｢強｣キックの動作2】【衝撃波(弱)】
type = Explod
triggerall = p2movetype = H
triggerall = numexplod(17100) = 0
triggerall = P2Dist X > 0
trigger1 = p2stateno = 251 || p2stateno = 271
trigger2 = p2stateno = 281
anim = 17100
pos = 0, floor(screenpos y) -60
postype = front
facing = ifelse(facing = 1,1,-1)
sprpriority = -3
ontop = 1
id = 17100


[State -1, Explod];壁激突二回目の衝突
type = Explod
triggerall = p2movetype = H
triggerall = numexplod(17100) = 0
trigger1 = p2stateno = 266
anim = 17100
pos = 30, 50
postype = p2
facing = 1
sprpriority = -3
ontop = 1
id = 17100

[State -1, Explod];壁激突二回目の衝突
type = Explod
triggerall = p2movetype = H
triggerall = numexplod(17100) = 0
trigger1 = p2stateno = 268
anim = 17100
pos = 30, -50
postype = p2
facing = 1
sprpriority = -3
ontop = 1
id = 17100

;━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[State 3310, Helper]
type = Helper
triggerall = numHelper(5503) = 0
trigger1 = p2stateno = 251 || p2stateno = 271
trigger2 = p2stateno = 261 || p2stateno = 266
trigger3 = p2stateno = 291 || p2stateno = 281
trigger4 = p2stateno = 264 || p2stateno = 3937
trigger5 = p2stateno = 268
name = "gegi"
ID = 5503
pos = 120,0
postype = left
stateno = 5503
ownpal = 1
size.xscale = 0.5
size.yscale = 0.5
supermovetime = 10000
pausemovetime = 10000
ignorehitpause = 1

[State -1, PlaySnd];激突PlaySnd
type = PlaySnd
triggerall = p2movetype = H
triggerall = NumExplod(1111) = 1
trigger1 = p2stateno = 268
value = s700, 2
;channel = 4
;lowpriority = 2
ignorehitpause = 1
persistent=0

[State 1000, Explod]
type = RemoveExplod
trigger1 = p2stateno = 252 || p2stateno = 272
trigger2 = p2stateno = 262 || p2stateno = 267
trigger3 = p2stateno = 292 || p2stateno = 282
trigger4 = p2stateno = 265 || p2stateno = 3938
trigger5 = p2stateno = 269
ID = 1111
ignorehitpause = 1
supermovetime = 99999
pausemovetime = 99999



;━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

;高速移動
[State -2, ll]
type = PlaySnd
triggerall = Random = [300,599]
trigger1 = stateno = 5999
trigger2 = stateno = 6000
trigger3 = stateno = 6001
trigger4 = stateno = 6060
trigger5 = stateno = 6050
trigger6 = stateno = 6070
value = s5001,4
channel = 0
lowpriority = 3
persistent=0
ignorehitpause = 1


[State -2, ll]
type = PlaySnd
triggerall = Random = [600,999]
trigger1 = stateno = 6999
trigger2 = stateno = 6200
trigger3 = stateno = 6201
value = s5002,4
channel = 0
lowpriority = 3
persistent=0
ignorehitpause = 1

[State 6151, posadd]
type = Varset
trigger1 = StateType != A
var(3) = 0



;高速移動
[State -2, ll]
type = PlaySnd
triggerall = var(3) = 0
trigger1 = stateno = 6099
trigger2 = stateno = 6100
trigger3 = stateno = 6120
trigger4 = stateno = 6140
trigger5 = stateno = 6160
trigger6 = stateno = 6110
trigger7 = stateno = 6130
trigger8 = stateno = 6150
trigger9 = stateno = 6170
value = s5001,3
channel = 0
lowpriority = 3
persistent=0
ignorehitpause = 1

;高速移動
[State -2, ll]
type = PlaySnd
triggerall = var(3) = 1
trigger1 = stateno = 6099
trigger2 = stateno = 6100
trigger3 = stateno = 6120
trigger4 = stateno = 6140
trigger5 = stateno = 6160
trigger6 = stateno = 6110
trigger7 = stateno = 6130
trigger8 = stateno = 6150
trigger9 = stateno = 6170
value = s5001,1
channel = 1
lowpriority = 3
persistent=0
ignorehitpause = 1

;高速移動
[State -2, ll]
type = PlaySnd
triggerall = var(3) = 2
trigger1 = stateno = 6099
trigger2 = stateno = 6100
trigger3 = stateno = 6120
trigger4 = stateno = 6140
trigger5 = stateno = 6160
trigger6 = stateno = 6110
trigger7 = stateno = 6130
trigger8 = stateno = 6150
trigger9 = stateno = 6170
value = s5002,4
channel = 5
lowpriority = 3
persistent=0
ignorehitpause = 1


;コマンド
[State 240, Varset]
type = Varset
trigger1 = stateno != 240
var(24) = 0




;--------------------------------------
;━━━━━━━━━━━━━━━━━━━
;[Statedef 242]
[State 252, VelSet]
type = Varset
trigger1 = stateno != 242
trigger1 = var(26) != 0
var(26) = 0
persistent=0
ignorehitpause=1


;カウンター
;━━━━━━━━━━━━━━━━━━━
[State -1, PlaySnd];激突PlaySnd
type = PlaySnd
triggerall = numexplod(16501) = 0
trigger1 = movehit = 1
trigger1 = var(30) = 1
value = s646, 0
ignorehitpause = 1

[State -1, Explod]
type = Explod
triggerall = numexplod(16501) = 0
trigger1 = movehit = 1
trigger1 = var(30) = 1
anim = 16501
pos = 0, -50
postype = p2
sprpriority = 3
ontop = 1
ownpal = 1
id = 16501
scale = 1.5, 1.5
ignorehitpause=1

[State 252, VelSet]
type = Varset
trigger1 = enemy,movetype = A
var(30) = 1
ignorehitpause=1

[State 252, VelSet]
type = Varset
trigger1 = enemy,movetype != A
var(30) = 0
ignorehitpause=1

;リバサ
;━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
; 起きあがり
[State 5120, 7]
type = ChangeState
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall  = stateno = 5120               ; 起きあがり
triggerall  = AnimTime = 0
trigger1  = var(16) >= 1000
trigger1  = var(16) < 3000
trigger2  = var(16) >= 3400
trigger2  = var(16) < 3500
value = var(16)
ctrl = 0
; 起きあがり
[State 5120, 7]
type = ChangeState
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
trigger1  = stateno = 5120               ; 起きあがり
trigger1  = AnimTime = 0
trigger1  = var(16) = 3000
trigger1  = Power >= 3000
value = var(16)
ctrl = 0
; 起きあがり
[State 5120, 7]
type = ChangeState
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall  = stateno = 5120               ; 起きあがり
triggerall  = AnimTime = 0
trigger1  = var(16) >= 3100
trigger1  = var(16) < 3540
trigger1  = Power >= 1000
value = var(16)
ctrl = 0
; 起きあがり
[State 5120, 7]
type = ChangeState
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall  = stateno = 5120               ; 起きあがり
triggerall  = AnimTime = 0
trigger1  = var(16) >= 3540
trigger1  = var(16) < 3980
trigger1  = power >= 3000
value = var(16)
ctrl = 0

; 喰らい回復
[State 5120, 7]
type = ChangeState
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall   = statetype = S || statetype = C
triggerall   = stateno = 5001               ; 喰らい回復
triggerall   = HitOver
trigger1  = var(16) >= 1000
trigger1  = var(16) < 3000
trigger2  = var(16) >= 3400
trigger2  = var(16) < 3500
value = var(16)
ctrl = 0
; 喰らい回復
[State 5120, 7]
type = ChangeState
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall   = statetype = S || statetype = C
triggerall   = stateno = 5001               ; 喰らい回復
triggerall   = HitOver
trigger1  = var(16) = 3000
trigger1  = Power >= 3000
value = var(16)
ctrl = 0
; 喰らい回復
[State 5120, 7]
type = ChangeState
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall   = statetype = S || statetype = C
triggerall   = stateno = 5001               ; 喰らい回復
triggerall   = HitOver
trigger1  = var(16) >= 3100
trigger1  = var(16) < 3540
trigger1  = Power >= 1000
value = var(16)
ctrl = 0
; 喰らい回復
[State 5120, 7]
type = ChangeState
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall   = statetype = S || statetype = C
triggerall   = stateno = 5001               ; 喰らい回復
triggerall   = HitOver
trigger1  = var(16) >= 3540
trigger1  = var(16) < 3980
trigger1  = power >= 3000
value = var(16)
ctrl = 0

; 屈喰らい回復
[State 5120, 7]
type = ChangeState
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall   = statetype = S || statetype = C
triggerall   = stateno = 5011               ; 屈喰らい回復
triggerall   = HitOver
trigger1  = var(16) >= 1000
trigger1  = var(16) < 3000
trigger2  = var(16) >= 3400
trigger2  = var(16) < 3500
value = var(16)
ctrl = 0
; 屈喰らい回復
[State 5120, 7]
type = ChangeState
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall   = statetype = S || statetype = C
triggerall   = stateno = 5011               ; 屈喰らい回復
triggerall   = HitOver
trigger1  = var(16) = 3000
trigger1  = Power >= 3000
value = var(16)
ctrl = 0
; 屈喰らい回復
[State 5120, 7]
type = ChangeState
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall   = statetype = S || statetype = C
triggerall   = stateno = 5011               ; 屈喰らい回復
triggerall   = HitOver
trigger1  = var(16) >= 3100
trigger1  = var(16) < 3540
trigger1  = Power >= 1000
value = var(16)
ctrl = 0
; 屈喰らい回復
[State 5120, 7]
type = ChangeState
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall   = statetype = S || statetype = C
triggerall   = stateno = 5011               ; 屈喰らい回復
triggerall   = HitOver
trigger1  = var(16) >= 3540
trigger1  = var(16) < 3980
trigger1  = power >= 3000
value = var(16)
ctrl = 0

; 空中喰らい回復
[State 5120, 7]
type = ChangeState
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall   = statetype = A
triggerall   = stateno = 5021               ; 空中喰らい回復
triggerall   = HitOver
trigger1  = var(17) >= 1000
trigger1  = var(17) < 3000
trigger2  = var(17) >= 3400
trigger2  = var(17) < 3500
value = var(17)
ctrl = 0
; 空中喰らい回復
[State 5120, 7]
type = ChangeState
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall   = statetype = A
triggerall   = stateno = 5021               ; 空中喰らい回復
triggerall   = HitOver
trigger1  = var(17) = 3000
trigger1  = Power >= 3000
value = var(17)
ctrl = 0
; 空中喰らい回復
[State 5120, 7]
type = ChangeState
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall   = statetype = A
triggerall   = stateno = 5021               ; 空中喰らい回復
triggerall   = HitOver
trigger1  = var(17) >= 3100
trigger1  = var(17) < 3540
trigger1  = Power >= 1000
value = var(17)
ctrl = 0
; 空中喰らい回復
[State 5120, 7]
type = ChangeState
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall   = statetype = A
triggerall   = stateno = 5021               ; 空中喰らい回復
triggerall   = HitOver
trigger1  = var(17) >= 3540
trigger1  = var(17) < 3980
trigger1  = power >= 3000
value = var(17)
ctrl = 0

; ガード回復
[State 5120, 7]
type = ChangeState
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall   = statetype = S || statetype = C
triggerall   = stateno = 151               ; ガード回復
triggerall   = HitOver
trigger1  = var(16) >= 1000
trigger1  = var(16) < 3000
trigger2  = var(16) >= 3400
trigger2  = var(16) < 3500
value = var(16)
ctrl = 0
; ガード回復
[State 5120, 7]
type = ChangeState
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall   = statetype = S || statetype = C
triggerall   = stateno = 151               ; ガード回復
triggerall   = HitOver
trigger1  = var(16) = 3000
trigger1  = Power >= 3000
value = var(16)
ctrl = 0
; ガード回復
[State 5120, 7]
type = ChangeState
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall   = statetype = S || statetype = C
triggerall   = stateno = 151               ; ガード回復
triggerall   = HitOver
trigger1  = var(16) >= 3100
trigger1  = var(16) < 3540
trigger1  = Power >= 1000
value = var(16)
ctrl = 0
; ガード回復
[State 5120, 7]
type = ChangeState
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall   = statetype = S || statetype = C
triggerall   = stateno = 151               ; ガード回復
triggerall   = HitOver
trigger1  = var(16) >= 3540
trigger1  = var(16) < 3980
trigger1  = power >= 3000
value = var(16)
ctrl = 0

; 屈ガード回復
[State 5120, 7]
type = ChangeState
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall   = statetype = S || statetype = C
triggerall   = stateno = 153               ; 屈ガード回復
triggerall   = HitOver
trigger1  = var(16) >= 1000
trigger1  = var(16) < 3000
trigger2  = var(16) >= 3400
trigger2  = var(16) < 3500
value = var(16)
ctrl = 0
; 屈ガード回復
[State 5120, 7]
type = ChangeState
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall   = statetype = S || statetype = C
triggerall   = stateno = 153               ; 屈ガード回復
triggerall   = HitOver
trigger1  = var(16) = 3000
trigger1  = Power >= 3000
value = var(16)
ctrl = 0
; 屈ガード回復
[State 5120, 7]
type = ChangeState
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall   = statetype = S || statetype = C
triggerall   = stateno = 153               ; 屈ガード回復
triggerall   = HitOver
trigger1  = var(16) >= 3100
trigger1  = var(16) < 3540
trigger1  = Power >= 1000
value = var(16)
ctrl = 0
; 屈ガード回復
[State 5120, 7]
type = ChangeState
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall   = statetype = S || statetype = C
triggerall   = stateno = 153               ; 屈ガード回復
triggerall   = HitOver
trigger1  = var(16) >= 3540
trigger1  = var(16) < 3980
trigger1  = power >= 3000
value = var(16)
ctrl = 0

; 空中ガード回復
[State 5120, 7]
type = ChangeState
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall   = statetype = A
triggerall   = stateno = 155               ; 空中ガード回復
triggerall   = HitOver
trigger1  = var(17) >= 1000
trigger1  = var(17) < 3000
trigger2  = var(17) >= 3400
trigger2  = var(17) < 3500
value = var(17)
ctrl = 0
; 空中ガード回復
[State 5120, 7]
type = ChangeState
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall   = statetype = A
triggerall   = stateno = 155               ; 空中ガード回復
triggerall   = HitOver
trigger1  = var(17) = 3000
trigger1  = Power >= 3000
value = var(17)
ctrl = 0
; 空中ガード回復
[State 5120, 7]
type = ChangeState
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall   = statetype = A
triggerall   = stateno = 155               ; 空中ガード回復
triggerall   = HitOver
trigger1  = var(17) >= 3100
trigger1  = var(17) < 3540
trigger1  = Power >= 1000
value = var(17)
ctrl = 0
; 空中ガード回復
[State 5120, 7]
type = ChangeState
TriggerAll = Var(33) = 0
TriggerAll = var(11) = 1 || fvar(12) < 5
triggerall   = statetype = A
triggerall   = stateno = 155               ; 空中ガード回復
triggerall   = HitOver
trigger1  = var(17) >= 3540
trigger1  = var(17) < 3980
trigger1  = power >= 3000
value = var(17)
ctrl = 0

;------
;リセット
[State -1, Varset]
type = Varset
trigger1 = stateno != 151
trigger1 = stateno != 153
trigger1 = stateno != 154
trigger1 = stateno != 5120
trigger2 = var(28) >= 10
var(16) = 0
ignorehitpause=1
[State -1, Varset]
type = Varset
trigger1 = stateno != 151
trigger1 = stateno != 153
trigger1 = stateno != 154
trigger1 = stateno != 5120
trigger2 = var(29) >= 10
var(17) = 0
ignorehitpause=1

[State -1, Varset]
type = Varadd
trigger1 = var(16) != 0
var(28) = 1
ignorehitpause=1
[State -1, Varset]
type = Varset
trigger1 = var(16) = 0
var(28) = 0
ignorehitpause=1
[State -1, Varset]
type = Varadd
trigger1 = var(17) != 0
var(29) = 1
ignorehitpause=1
[State -1, Varset]
type = Varset
trigger1 = var(17) = 0
var(29) = 0
ignorehitpause=1
;------
