# Runtime History

Updated: 2026-07-09

Runtime History is the persistent frame-by-frame diagnostic log shown in the Debug UI.

## Purpose

Live debug values are useful, but they change every frame. Runtime History preserves important snapshots so a transition can be inspected after it has already happened.

This is especially important for short routes such as:

- State 0 → State 10 crouch start;
- State 10 → State 11 crouch hold;
- State 0 → State 20 walk;
- State 40 → State 50 jump;
- attack startup and cancel windows.

## Snapshot rule

Runtime History entries must be immutable snapshots.

Do not store references to mutable arrays or objects that will change on the next frame.

When appending history, convert lines to plain strings at that moment.

Correct concept:

```text
history entry = String(line values at frame N)
```

Incorrect concept:

```text
history entry = reference to current live debug array
```

If old history changes when current input changes, the snapshot rule is broken.

## Debug UI tabs

Runtime history is split into two top-level tabs:

- `実行履歴人間用`: a compact rendered view for following StateNo, AnimNo, key input, State状況, and recent damage.
- `実行履歴AI用`: a dense copyable log intended for Codex/debug analysis.

The old nested runtime-history subtabs were removed so runtime logs are available directly from the main debug tab row.

## When to append

History should append when something useful happens, such as:

- input is active;
- command names are active;
- state changes;
- animation changes;
- controller executes;
- debug trace exists;
- physics state changes meaningfully.

Avoid recording completely idle duplicate frames forever.

For the human-facing runtime history, capture the snapshot immediately after CNS execution and before physics increments `stateTime` / `animTime`. This keeps `Time = 0` routes visible when a StateDef is entered, while the stage overlay can still show the post-physics live state.

## Signature / deduplication

A history signature can prevent identical repeated entries.

The signature should be based on the snapshot text, not mutable data references.

If a line changes every frame due only to time counters, decide whether that is useful. During movement debugging, state time can be useful. During idle debugging, it may create noise.

The human-facing history is capped by both entry count and rendered line count. Long State状況 sections keep ChangeState / ChangeAnim candidates visible first, then only a small number of additional controllers. This prevents large characters from making the browser heavy while preserving the most useful routing diagnostics.

## Human runtime index

The human-facing runtime history uses a lightweight frame index plus a selected detail entry.

- Each generated human detail entry is stored outside React render state. The retained key is `frameNo + P1 StateNo`, so a single frame can keep multiple detail entries when CNS execution crosses more than one StateNo.
- React state holds only the visible frame index and the currently selected detail entry.
- The frame index records timestamp, `frameNo`, P1 StateNo/AnimNo, and P2 StateNo/AnimNo in compact columns so rows can stay narrow.
- A frame is indexed whenever a human detail log is generated, even if StateNo did not change.
- Clicking an index row loads exactly that frame's detail entry into the right pane.
- New logs append to the index but do not replace the selected detail pane.
- The human detail pane can be hidden to avoid rendering the heavy State status DOM; selecting a frame or using the latest-frame action opens it again.
- `最新フレームを表示` loads the newest retained detail entry on demand.
- The frame index can auto-scroll to the newest visible index row or stay in fully manual scrolling mode.
- The visible index is capped separately from the retained store, so older retained frames can still be copied or loaded by frame when exposed through tooling.
- Frame index rows visually distinguish state numbers and animation numbers so repeated-state failures can be scanned quickly.
- Human detail entries include a `StateDef` source link that opens the matching source file and line in `Character Files`.
- `Character Files` can be hidden on the static/files page. The Show button opens it even when no source link has been clicked yet.
- Source links from human detail entries switch the main UI to the static/files page before opening `Character Files`, keeping the normal game/runtime page lighter.
- A runtime log clear action resets retained human entries, the lightweight frame index, AI history, and signatures together.

This structure prevents thousands of retained detail rows from becoming DOM nodes. In normal use the right pane renders one frame's human detail log.

## AI render window

AI runtime history storage and rendering use separate limits.

- Stored AI history is capped by entry count so copy/debug data can remain available.
- Rendered AI history is capped to the current visible window so the Debug UI does not create a huge DOM.

The visible window has two modes:

- `latest`: render only the newest 50 AI runtime-history entries.
- `aroundFrame`: render entries around a selected frame.

When a StateNo transition link points at an old frame, the UI first switches the visible window to `aroundFrame` for that target frame, then scrolls the matching entry into view after React renders it. The Debug UI should show the current mode, entry range, visible entry count, total retained entry count, and whether the target frame was retained.

The retained history lives outside React state. React state tracks only the current window mode and a small version counter, so appending a log does not copy thousands of retained lines through React. Latest-window selection also stops scanning once enough recent entries are known for large logs.

Runtime-history rendering is throttled while the game is running. Appends are still stored immediately, but the React-visible version counters are invalidated on a short timer instead of every frame. Jumping to a StateNo transition or returning to the latest window invalidates immediately so navigation remains responsive.

Rendered output is capped by both entry count and line count. This matters for large characters where a single human-readable entry can contain many State status rows. When the latest window exceeds the rendered-line cap, the UI keeps the newest lines and adds a truncation marker; full retained logs remain available from the copy action.

Copy actions are split between visible logs and all retained logs. Visible-copy operations should stringify only the current rendered slice; all-log copy may stringify the full retained history on demand.

## Entry format

Preferred format:

```text
---- 23:59:55 frame=899 ----
  keys=ArrowRight
  cmd p1=fwd,holdfwd
  phys p1 state=20 ... vel=(2.4,0) anim=20:4
  cns p1 state=0->20 ... exec=ChangeState,VelSet,ChangeAnim
```

Keep it copyable and grep-friendly.

## HitDef diagnostics

When Runtime Settings `Hit diagnostics` is enabled, AI runtime entries include an event-driven `SECTION hit_diagnostics`. Lines prefixed with `raw.hitdef_activate`, `raw.hit_collision`, `raw.hit_damage`, `raw.hit_anim_select`, `raw.hit_anim_change`, `raw.hit_reaction`, `raw.hitstun`, and `raw.hitdef_lifecycle` share an `activeHitDefId` from controller activation through collision, damage, initial ground animation selection, later Common State animation changes, hit-stun start/end, consumption, or state-change discard. Ground/air hit time and the supported ground Light/Medium/Hard animation are selected once at contact. Missing required Anim 5000/5001/5002 is logged with `animationExists=0` and `warning=missing_required_animation`, but `selectedAnim` is not changed. Missing ActiveHitDef or hit-time data is labeled with a hardcoded fallback and explicit reason. Outside active hit stun, diagnostics are emitted only for activation changes, the first duplicate registration, collision outcomes, damage, animation selection/change, reaction, and lifecycle events.

Each non-duplicate activation also emits `raw.hitdef_parameters` with the evaluated typed snapshot. `raw.hitdef_unapplied` lists parameters that were preserved but are not yet connected to combat behavior, and `raw.hitdef_invalid` lists parameters whose activation-frame expression could not be evaluated. These are event-driven activation records, not per-frame logs.

`raw.hit_collision` records attacker/defender, ActiveHitDef id, both animation and element numbers, Clsn1/Clsn2 counts, overlapping attack/body box indexes, and an accepted/rejected reason. Missing ActiveHitDef, Clsn1, or Clsn2 rejects contact explicitly; the live path does not synthesize a fixed collision rectangle.

Repeated overlap for an already recorded `(activeHitDefId, defenderId)` pair is rejected as `hitonce_already_consumed`. The record also carries HitDef `id`; a new generation can hit again with the same or a different id. With `hitonce = 1`, any successful target record for that generation rejects a different target as well.

`raw.hit_chain` records the current `id`, `chainid`, `nochainid`, defender's previous HitDef id for this attacker, `hitonce`, and the accepted/rejected reason (`no_constraint`, `chainid_match`, `chainid_mismatch`, or `nochainid_match`). The check occurs after confirmed Clsn overlap and before damage/guard resolution.

`raw.hit_reaction` reports the applied velocity, `source=active_hitdef`, ground/air selection kind, and attacker facing. This distinguishes the stored CNS pair from its facing-converted world X value.

For vertical hit regressions, compare contact, StateDef-header/CNS, physics, clamp, and renderer-origin values. Issue #42 established that `internalY=285` remained valid through contact, but live `vy` was not cleared by State 5000 `velset`; the first invalid value was therefore the post-header/CNS velocity, followed by Physics producing `internalY > 285`. `hitVelY` and `GetHitVar(yvel)` intentionally remain unchanged across that header reset.

For air contact, `raw.hit_reaction` also records State 5020, the selected air animation source, fall flag, fall velocity, recovery permission, and recovery time. `raw.hit_down` records the `down.hittime`-driven transition from liedown to common getup State 5120.

`raw.hit_juggle` records attacker State, ActiveHitDef generation, cost, before/after/max pool values, and accepted or `insufficient_points` rejection. The associated `raw.hit_collision` rejection uses `reason=juggle_insufficient`.

`raw.guard_check` records guardflag, Facing-relative holdback intent, crouch intent, StateType, selected stand/crouch/air kind, distance/guard distance, and accepted or mismatch/range rejection. `raw.guard_reaction` records common GuardHit State, guard damage/kill, velocity, hit/control time, and pause. Guarded `raw.move_contact` has `contact=1 hit=0 guarded=1`; `raw.hit_damage source=guard_damage` records chip Life and KO outcome.

`raw.hit_eligibility` records hitflag, classified target state, StateType/MoveType, normalized attr, HitBy/NotHitBy filters, and accepted/rejected reason. `raw.hit_priority` records both numeric priorities and types plus higher/lower, equal trade, equal non-Hit miss, or unsupported-type outcome. Priority diagnostics are produced from the original simultaneous frame snapshot.

`raw.custom_state` records HitDef/TargetState p1/p2 State numbers, current/self owner ids, p2getp1state, forcestand, applied ownership, and missing owner-State rejection. The runtime does not substitute the currently loaded or common CNS when an explicit owner lookup fails.

`raw.hit_effect` records hit/guard selection, scoped spark animation, AIR availability, Clsn/Facing-adjusted position, scoped sound sample, audio availability, and envshake parameters. Missing attacker AIR actions add `warning=missing_animation`; sound cues add `limitation=audio_runtime_unavailable` until owner SND playback is connected. Duplicate contact produces no second effect event.

`raw.explod_render` records internal/MUGEN ids, animation and element, world/screen position, Facing/vfacing, and whether the owner animation resolved. `raw.explod_draw` records the final Canvas result; missing sprites remain invisible with `reason=sprite_not_found`.

`raw.explod_step` records age, animation time/element, bind remainder and position for retained entries. Removal records `removetime_zero`, `removetime`, or `animtime_zero`; no later render/draw line is emitted for that internal id.

`raw.explod_modify` records the owner, requested MUGEN id, number of exact owner/id matches, changed fields, and affected internal ids. Missing explicit ids use `reason=not_found`; omitted ids use `reason=id_missing`. The following same-frame `raw.explod_step`, `raw.explod_render`, and `raw.explod_draw` lines expose the resulting lifecycle, position, scale, priority, and ontop values.

`raw.explod_remove` records the owner, requested MUGEN id, number of exact owner/id matches, affected internal ids, and `reason=removeexplod`. Missing explicit ids use `reason=not_found`; omitted ids use `reason=id_missing`. Removed internal ids have no later same-frame step/render/draw record.

Browser audio foundation diagnostics use `audio_unsupported`, `audio_locked`, `audio_unlocked`, `decode_failed`, `playback_started`, `playback_stopped`, and `audio_closed`. They distinguish browser/autoplay/decode failures from missing character assets. PlaySnd-specific owner/channel diagnostics are added in Issues #28-#29/#40.

`raw.sound_play` records the owner, scope, group/index, channel, volume/volumescale, resolved pan, frequency multiplier, loop, and queued result. `raw.sound_play_rejected` uses `sound_asset_missing`, `sample_not_found`, `common_sound_unavailable`, or `audio_locked`. The subsequent Browser Audio diagnostic proves playback start or decode failure.

`raw.sound_stop` records owner/channel and either `result=stopped`, `reason=channel_not_found`, or `reason=channel_missing`. A stopped or naturally ended voice is removed from the channel table before later sound events.

`raw.sound_pan` records owner/channel, relative or absolute mode, raw pixel value, normalized value, and `result=updated`. Missing/ended channels, missing required parameters, and adapters without pan support are explicit no-ops with `channel_not_found`, `channel_missing`, `pan_missing`, or `unsupported` reasons.

`raw.explod_create` records owner, internal runtime id, duplicate-capable MUGEN id, animation scope/number, postype, raw offset, resolved world/screen position, Facing/vfacing, bindtime, removetime, sprite priority, and ontop. `raw.explod_create_rejected` identifies missing or invalid `anim`. Rendering/lifecycle evidence follows in `raw.explod_step`, `raw.explod_render`, and `raw.explod_draw`; Issue #33 modifications are correlated through `raw.explod_modify` and the same internal ids.

`raw.hit_power` records selected hit/guard `getpower` and `givepower`, both gauges before/after clamping, and proves the mutation occurred once for the accepted contact. `raw.hit_cornerpush` records contact class, edge condition, selected velocity offset, Facing, before/after attacker velocity, and applied/skipped reason. `raw.hit_snap` records Facing-relative offset and target before/after position. `raw.hit_sprpriority` records applied P1/P2 priorities.

`raw.hit_fall_damage` is emitted by common-State `HitFallDamage` and records fall damage, independent `fall.kill`, Life before/after, and the originating ActiveHitDef id.

`raw.hitpause` records the event-time attacker and defender counters from ActiveHitDef. Live physics and `raw.hitstun_tick` expose the remaining counter; duplicate contact rejection does not reset it.

While hit stun remains active, `raw.hitstun_tick` records independent elapsed/remaining time, current state, forced control state, control source, and state changes. Attempts to enable control, enter State 0/52 early, or take a State -1 input ChangeState are blocked and reported once per controller as `raw.hitstun_guard`. Unexpected early control or state exits are reported as `raw.hitstun_violation`.

`raw.hitstun_guard event=force_ctrl_off` records StateDef headers or allowed internal get-hit transitions that requested control during active hit stun. Internal State 5000/5001-style transitions remain permitted; only premature control is removed.

`raw.gethitvar_snapshot` records the keys captured on contact and `unsupportedKeys` that will currently return safe defaults. The snapshot stays on the defender across get-hit State transitions and is cleared when recovery ends.

`raw.move_contact` records generation id, contact/hit/guard flags, hit count, target, and accepted result. This is the source used by hit-confirm Trigger routes rather than the former ActiveHitDef/boolean approximation.

On State entry, `raw.hitdef_lifecycle` reports preserve/discard together with `hitdefpersist`, `movehitpersist`, `hitcountpersist`, and the prior hit count. This makes independent ActiveHitDef, result-flag, and count retention visible across State transitions.

`raw.target_register` records owner, target player id, HitDef id, ActiveHitDef generation, target life, registration result, and KO rejection reason.

`raw.target_controller` records the owner, controller, optional HitDef id filter, selected player ids, and whether the operation was queued, dropped, or safely skipped because no target matched.

## Real-character trace audit

The optional three-character regression harness asserts a continuous event chain for ground, air, guard, KO, edge, both Facing directions, and both player roles. Its current evidence and reproduction command are recorded in `hitdef-real-character-regression.md`.

## What to look for

| Symptom in history | Interpretation |
|---|---|
| `keys` correct but `cmd` missing | command matching issue. |
| `cmd` correct but `cns exec=-` | trigger/controller route issue. |
| `state=20` but `vel=(0,0)` | movement state entered but motion not applied. |
| state transition shown once then overwritten | later negative/current state or physics integration may be reverting it. |
| old history changes after new input | snapshot bug. |

## Copy workflow

When asking for help, copy the full debug dump rather than only a screenshot.

The dump should include:

- current live values;
- static route lists;
- runtime history around the failing action;
- investigation notes when relevant.

## Maintenance

Runtime History is a debugging tool. Keep it reliable before making it fancy.

Useful future improvements:

- filtering by player;
- filtering by state transition;
- filtering by controller execution;
- folding repeated frames;
- exporting JSON diagnostics for tests.
