# State processing order（Root / Helper）

## 目的

この文書は、WinMUGEN互換を優先するWebMUGENにおいて、1 tick内での通常State、特殊State（`StateDef -3` / `-2` / `-1`）、Root、Helperの処理順を定義する。

根拠はElecbyte公式ドキュメントのCNS仕様およびHelper State Controller仕様とする。

- CNS format: https://www.elecbyte.com/mugendocs/cns.html
- State Controller Reference / Helper: https://www.elecbyte.com/mugendocs/sctrls.html

---

## 1. 用語

### 現在State（Current State）

`StateNo`が示す現在実行中の通常State。

例:

```cns
[StateDef 3405]
```

実行中であれば、`StateNo = 3405`となる。

### 特殊State

各キャラクターが持つ次の負数State。

- `StateDef -3`
- `StateDef -2`
- `StateDef -1`

特殊Stateは通常Stateへ遷移して「そのStateに滞在する」ものではない。各tickで現在Stateとは別に走査される。

---

## 2. Rootプレイヤーの基本処理順

Rootプレイヤーは1 tickごとに、原則として次の順番でState Controllerを処理する。

```text
StateDef -3
↓
StateDef -2
↓
StateDef -1
↓
現在のStateNo
```

現在Stateが3405なら、概念上の処理順は次の通り。

```text
-3 → -2 → -1 → 3405
```

各State内のState Controllerは、CNSに記述された上から下の順に評価する。

### StateDef -3

毎tick処理される。ただし、投げなどによって他プレイヤーのStateデータを一時的に使用している間は処理されない。

### StateDef -2

毎tick処理される常時処理用State。

### StateDef -1

主にコマンド入力に基づくState遷移を記述する。Rootプレイヤーでは毎tick処理される。

---

## 3. 特殊State内でChangeStateした場合

特殊State内で`ChangeState`が成立した場合、次の動作となる。

1. プレイヤーの現在StateNoを更新する。
2. `ChangeState`が成立した特殊Stateの残りのControllerを打ち切る。
3. 次の特殊Stateの処理へ進む。
4. 特殊Stateの走査完了後、更新後の現在Stateを処理する。

例として、`StateDef -1`からState 1000へ遷移した場合:

```text
StateDef -3を処理
↓
StateDef -2を処理
↓
StateDef -1の途中でChangeState value = 1000
↓
StateDef -1の残りを打ち切る
↓
State 1000を先頭から処理
```

`StateDef -3`または`StateDef -2`でChangeStateした場合も、現在StateNoは更新されるが、その後に続く特殊Stateの走査自体は継続する。

---

## 4. 現在State内でChangeStateした場合

現在State内で`ChangeState`が成立すると、元Stateの残りのControllerを打ち切り、遷移先Stateを先頭から処理する。

例:

```text
State 3405の途中
↓
ChangeState value = 3415
↓
State 3405の残りを打ち切る
↓
State 3415を先頭から処理
```

遷移先Stateでさらに`ChangeState`が成立すれば、同一tick内で続けて次のStateへ遷移する。

現在Stateの末尾まで到達し、それ以上State遷移が起きなければ、そのエンティティのState処理はそのtickについて終了する。

### 実装上の注意

同一tick内の連続ChangeStateにより無限ループが発生し得るため、WebMUGENでは互換動作を壊さない範囲で循環検出または遷移回数上限を持つ必要がある。ただし、正常な多段遷移を一律に1回へ制限してはならない。

---

## 5. 通常Helperの基本処理順

通常HelperはRootプレイヤーと異なり、`StateDef -3`および`StateDef -2`を持たないものとして扱う。

さらに、`keyctrl = 0`のHelperは`StateDef -1`も継承しない。

したがって通常のHelperは、基本的に現在Stateだけを処理する。

```text
Helper（keyctrl = 0）

現在のStateNoのみ
```

例:

```cns
[State 1000, Helper]
type = Helper
stateno = 3000
keyctrl = 0
```

このHelperの毎tickのState処理は次の通り。

```text
State 3000
```

`StateDef -3`、`StateDef -2`、`StateDef -1`をRootと同様に走査してはならない。

---

## 6. keyctrl = 1のHelper

Helper Controllerで`keyctrl = 1`を指定した場合、そのHelperはRootのコマンド入力を読み取ることができ、Rootの`StateDef -1`を継承する。

処理順は次の通り。

```text
Helper（keyctrl = 1）

Rootから継承したStateDef -1
↓
Helperの現在StateNo
```

`keyctrl = 1`であっても、通常Helperが`StateDef -3`および`StateDef -2`を処理することはない。

まとめると:

```text
Root:
-3 → -2 → -1 → Current State

Helper（keyctrl = 0）:
Current Stateのみ

Helper（keyctrl = 1）:
Rootの-1 → Current State
```

---

## 7. RootとHelperのエンティティ間処理順

Elecbyteの公開CNSドキュメントは、各プレイヤー／Helper内部のState処理順を明記している。一方で、次のような全エンティティ間の厳密な処理順は公開仕様だけでは確定できない。

```text
P1 Root
P2 Root
P1 Helper A
P2 Helper B
```

そのため、WebMUGENでは次の要件を満たす決定論的な順序を採用する。

1. tick開始時点のRootおよび既存Helperのスナップショットを固定する。
2. 同じ入力・同じ初期状態なら、毎回同じ順番で処理する。
3. tick途中で生成されたHelperは、そのtickでは通常State処理を開始しない。
4. 新規Helperは次tickからState処理へ参加する。
5. tick途中の生成・削除によって、走査中の配列順が変化しないようにする。

WebMUGEN Phase 1で採用している基本順序:

```text
1. P1 Root
2. P2 Root
3. tick開始時点に存在したHelper（安定したentityId順）
4. DestroySelfを反映
5. 新規Helperを追加
```

このエンティティ間順序はWebMUGENの決定論的実装方針であり、WinMUGEN内部の未公開スロット順と完全一致することまでは現時点で保証しない。順序依存キャラクターが確認された場合は、WinMUGENとの比較試験を行う。

---

## 8. StateNoとStateDefの関係

`StateNo`は、現在実行中の通常State番号を返す。

特殊Stateを走査中であっても、`StateNo`が`-3`、`-2`、`-1`へ切り替わるわけではない。

例として、現在Stateが3405の場合:

```text
StateDef -3を評価中: StateNo = 3405
StateDef -2を評価中: StateNo = 3405
StateDef -1を評価中: StateNo = 3405
StateDef 3405を評価中: StateNo = 3405
```

特殊State内の`ChangeState`が成立した時点で、`StateNo`は遷移先の番号へ更新される。

例:

```text
StateDef -1の前半: StateNo = 3405
ChangeState value = 1000
StateDef -1の残りは打ち切り
現在Stateの処理開始時: StateNo = 1000
```

---

## 9. Helper実装に対する必須確認事項

Helper性能問題および互換性問題を調査する際は、各tickについて次を確認する。

```text
frame
tick内の処理順
entityId
entityType = root / helper
rootEntityId
parentEntityId
helperId
keyctrl
phase = state-3 / state-2 / state-1 / current
StateNo
StateDef番号
評価Controller数
評価Trigger数
処理時間
```

期待値:

```text
Root P1: -3 → -2 → -1 → Current
Root P2: -3 → -2 → -1 → Current
Helper keyctrl=0: Currentのみ
Helper keyctrl=1: Rootの-1 → Current
```

Helperが`keyctrl = 0`であるにもかかわらずRootと同じ`-3 / -2 / -1`を毎tick評価している場合、それは仕様違反であり、性能悪化の有力原因となる。

---

## 10. 互換性ステータス

| 項目 | 仕様 |
|---|---|
| Rootの特殊State順 | `-3 → -2 → -1` |
| Rootの現在State | 特殊State処理後に実行 |
| 特殊State内ChangeState | 同特殊Stateの残りを打ち切り、後続特殊Stateの走査後に更新後Currentを処理 |
| Current内ChangeState | 元Stateの残りを打ち切り、遷移先Stateを同tick内で処理 |
| Helper `keyctrl=0` | Currentのみ |
| Helper `keyctrl=1` | Rootの`-1`を継承後、Currentを処理 |
| Helperの`-3/-2` | 通常Helperでは処理しない |
| 新規Helperの初回処理 | 生成tickではState処理せず、次tickから開始 |
| Root/Helper間の厳密な順序 | 公開仕様では未確定。WebMUGENは決定論的順序を採用 |

---

## 11. 参照

- Elecbyte, The CNS format
  - https://www.elecbyte.com/mugendocs/cns.html
- Elecbyte, State Controller Reference — Helper
  - https://www.elecbyte.com/mugendocs/sctrls.html

本書はWinMUGEN互換を基準とし、MUGEN 1.1固有挙動は別途明示して扱う。