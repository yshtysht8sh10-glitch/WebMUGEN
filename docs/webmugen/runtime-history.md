# Runtime History

Updated: 2026-07-09

Runtime History is the persistent frame-by-frame diagnostic log shown in the Debug UI.

Issue #75 makes Human and AI retention opt-in. Both default to OFF and are independently short-circuited before snapshot/string construction. The lower-left state history is a separate fixed-size lightweight stream and does not require Human log capture. See `performance-debug-settings.md`.

## Purpose

Live debug values are useful, but they change every frame. Runtime History preserves important snapshots so a transition can be inspected after it has already happened.

The App frame number and `GameState.frame` share the same monotonic tick before runtime evaluation. This is required for creation-frame diagnostics: an Explod may report age/time zero only on its actual creation tick, then must advance on the next history frame.

This is especially important for short routes such as:

- State 0 → State 10 crouch start;
- State 10 → State 11 crouch hold;
- State 0 → State 20 walk;
- State 40 → State 50 jump, including character `jump.*` / `runjump.*` velocity and `movement.yaccel` in the physics line;
- State 50 -> State 45 -> State 50 air jump, including fresh-Up gating, used/allowed count, minimum height, and character `airjump.*` velocity;
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
- Each visible State controller with a `value` parameter shows the raw CNS expression and its evaluated number for that Human Log frame. Invalid results appear as `evaluated=NaN` or `evaluated=unresolved`, including for `ChangeAnim`.
- `Character Files` can be hidden on the static/files page. The Show button opens it even when no source link has been clicked yet.
- Source links from human detail entries switch the main UI to the static/files page before opening `Character Files`, keeping the normal game/runtime page lighter.
- A runtime log clear action resets retained human entries, the lightweight frame index, AI history, and signatures together.

This structure prevents thousands of retained detail rows from becoming DOM nodes. In normal use the right pane renders one frame's retained P1 and P2 human detail logs side by side. Both players keep their own input mapping and Trigger evaluation context; copying a selected frame or all retained entries includes both logs.

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

The Human and AI stores are each capped at 5,000 entries. Their normal UI invalidation cadence is 250 ms. Disabling either sink clears its retained store; disabling the lower-left history clears its three five-item streams.

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

When Runtime Settings `Hit diagnostics` is enabled, AI runtime entries include an event-driven `SECTION hit_diagnostics`. Lines prefixed with `raw.hitdef_activate`, `raw.hit_collision`, `raw.hit_damage`, `raw.hit_anim_select`, `raw.hit_anim_change`, `raw.hit_reaction`, `raw.hitstun`, and `raw.hitdef_lifecycle` share an `activeHitDefId` from controller activation through collision, damage, initial ground animation selection, later Common State animation changes, hit-stun start/end, consumption, or state-change discard. Ground/air hit time and the supported ground Light/Medium/Hard animation are selected once at contact. Missing required Anim 5000/5001/5002 is logged with `animationExists=0` and `warning=missing_required_animation`, but `selectedAnim` is not changed. Missing ActiveHitDef or hit-time data is labeled with a hardcoded fallback and explicit reason. Outside active hit stun, diagnostics are emitted only for controller activation, collision outcomes, damage, animation selection/change, reaction, and lifecycle events.

Each controller activation also emits `raw.hitdef_parameters` with the evaluated typed snapshot. `raw.hitdef_unapplied` lists parameters that were preserved but are not yet connected to combat behavior, and `raw.hitdef_invalid` lists parameters whose activation-frame expression could not be evaluated. These are event-driven activation records; a continuously true HitDef controller legitimately creates one new record per execution tick.

`raw.hit_collision` records attacker/defender, ActiveHitDef id, both animation and element numbers, Clsn1/Clsn2 counts, overlapping attack/body box indexes, and an accepted/rejected reason. Missing ActiveHitDef, Clsn1, or Clsn2 rejects contact explicitly; the live path does not synthesize a fixed collision rectangle.

Repeated overlap for an already recorded `(activeHitDefId, defenderId)` pair is rejected as `hitonce_already_consumed`. The record also carries HitDef `id`; every later execution of a HitDef controller creates a new generation and can hit again with the same or a different id. This is required by AnimElem-driven multihit States such as bundled T-H-M-A State 1016. With `hitonce = 1`, any successful target record for that generation rejects a different target as well.

`raw.hit_chain` records the current `id`, `chainid`, `nochainid`, defender's previous HitDef id for this attacker, `hitonce`, and the accepted/rejected reason (`no_constraint`, `chainid_match`, `chainid_mismatch`, or `nochainid_match`). The check occurs after confirmed Clsn overlap and before damage/guard resolution.

`raw.hit_reaction` reports the applied velocity, `source=active_hitdef`, ground/air selection kind, and attacker facing. This distinguishes the stored CNS pair from its facing-converted world X value.

For vertical hit regressions, compare contact, StateDef-header/CNS, physics, clamp, and renderer-origin values. `raw.gethitvar_frame` records each State 5000 frame with State fields, GetHitVar yvel/fall/groundtype/animtype, the selected y-velocity source, and all ground/air/fall Y candidates. `raw.gethit_changestate_eval` records the 5001 and 5030 condition results on the same frame; `raw.controller_transition` records the successful transition and whether remaining ordinary-State controllers were stopped. The Issue #42 follow-up established that contact and the ground yvel snapshot were correct and the first invalid stage was CNS Controller execution, where a later 5030 ChangeState overwrote an already successful 5001 transition.

For air contact, `raw.hit_reaction` also records State 5020, the selected air animation source, fall flag, fall velocity, recovery permission, and recovery time. `raw.hit_down` records the `down.hittime`-driven transition from liedown to common getup State 5120.

`raw.hit_juggle` records attacker State, ActiveHitDef generation, charged/configured cost, before/after/max pool values, whether the attack chain already paid for that target, and accepted or `insufficient_points` rejection. Only the first accepted air contact in a continued attack chain is charged. The associated `raw.hit_collision` rejection uses `reason=juggle_insufficient`.

`raw.guard_check` records guardflag, Facing-relative holdback intent, crouch intent, StateType, selected stand/crouch/air kind, distance/guard distance, and accepted or mismatch/range rejection. `raw.guard_reaction` records common GuardHit State, guard damage/kill, velocity, hit/control time, and pause. Guarded `raw.move_contact` has `contact=1 hit=0 guarded=1`; `raw.hit_damage source=guard_damage` records chip Life and KO outcome.

`raw.hit_eligibility` records hitflag, classified target state, StateType/MoveType, normalized attr, HitBy/NotHitBy filters, and accepted/rejected reason. `raw.hit_priority` records both numeric priorities and types plus higher/lower, equal trade, equal non-Hit miss, or unsupported-type outcome. Priority diagnostics are produced from the original simultaneous frame snapshot.

`raw.custom_state` records HitDef/TargetState p1/p2 State numbers, current/self owner ids, p2getp1state, forcestand, applied ownership, and missing owner-State rejection. The runtime does not substitute the currently loaded or common CNS when an explicit owner lookup fails.

`raw.hit_effect` records hit/guard selection, scoped spark animation, preliminary AIR availability, Clsn/Facing-adjusted position, scoped sound sample, and envshake parameters. `raw.hit_effect_runtime` then records the final asset resolution: created spark internal id/position, queued sound, or `animation_disabled`, `animation_not_found`, `owner_air_missing`, `fightfx_air_missing`, `owner_snd_missing`, `common_snd_missing`, or `sample_not_found`. Duplicate contact produces no second HitEvent, and already integrated events produce no second runtime effect.

`raw.explod_render` records internal/MUGEN ids, animation and element, world/screen position, Facing/vfacing, and whether the owner animation resolved. `raw.explod_draw` records the final Canvas result; missing sprites remain invisible with `reason=sprite_not_found`.

`raw.explod_step` records age, animation time/element, bind remainder and position for retained entries. Removal records `removetime_zero`, `removetime`, or `animtime_zero`; no later render/draw line is emitted for that internal id.

Issue #34 extends `raw.explod_create` with the sampled random offset and `raw.explod_step` with position, resulting velocity/acceleration, and whether movement applied or was held by creation/binding. `raw.explod_draw` records scale, effective trans/alpha, `transSource=controller|air|default`, Canvas composite, ownpal, shadow, and explicit approximation limitations. Issue #81 uses `transSource=air` when an omitted or `default` Explod `trans` inherits the current AIR element's seventh-field blend value. Bare AIR `A` additionally reports `limitation=air_a_source_alpha_approximated` because Canvas uses 50% source alpha to preserve visible ghost transparency. `raw.explod_remove_on_gethit` identifies entries filtered after their owner receives an unguarded hit.

`raw.explod_modify` records the owner, requested MUGEN id, number of exact owner/id matches, changed fields, and affected internal ids. Missing explicit ids use `reason=not_found`; omitted ids use `reason=id_missing`. The following same-frame `raw.explod_step`, `raw.explod_render`, and `raw.explod_draw` lines expose the resulting lifecycle, position, scale, priority, and ontop values.

`raw.explod_remove` records the owner, requested MUGEN id, number of exact owner/id matches, affected internal ids, and `reason=removeexplod`. Missing explicit ids use `reason=not_found`; omitted ids use `reason=id_missing`. Removed internal ids have no later same-frame step/render/draw record.

`raw.explod_bindtime` records owner, requested MUGEN id, match count, and one indented `internalId`, old duration, and new duration line per duplicate. Missing id/time uses `id_missing`, `not_found`, or `time_missing`. Following `raw.explod_step` lines show the same-frame bind remainder, owner-relative position, follow, and release result.

`raw.hit_effect` records the Clsn overlap contact separately from the resolved `sparkPos` and `sparkSpace`. For HitDef sparks, `sparkPos` is absolute stage-space: X uses P2's P1-facing character `Size` edge plus `sparkxy.x`, and Y uses P1's root axis plus `sparkxy.y`. Subsequent `raw.explod_create`, `raw.explod_render`, and `raw.explod_draw` lines expose the unchanged world point, one camera conversion, and final AIR/SFF draw transform.

`raw.global_pause` records Pause/SuperPause activation kind, owner, time, movetime, darken, and the continuing-audio policy. CNS traces use `global_pause skip` with the pause kind or `resume_guard`. Frozen Explods emit `raw.explod_step ... result=frozen` with the matching allowance; allowed ticks emit `raw.explod_pause` with allowance before/after values. When an active SuperPause has `darken = 1`, Canvas emits `raw.superpause_darken` with remaining time, opacity, and its `before_ontop` layer position.

Browser audio lifecycle is recorded as `raw.audio` with a distinct `runtimeInstanceId`. It covers runtime/AudioContext creation, unlock gesture and before/after context state, resume requested/resolved/rejected, locked/unlocked flags, runtime status, mute/master volume, play entry, decode start/completion/failure, adapter source start, `playback_started`, cleanup, context close, and closed-runtime rejection. A resolved resume is not accepted unless the adapter state is `running`; a still-suspended result remains retryable. `raw.audio_lifecycle` records mount, React effect cleanup/remount, and character-path `stopAll`, and these lines survive the character-history reset.

On a fresh reload, character/assets may finish loading while the game frame remains zero. `raw.audio_start_gate` records each gate state and context state. The overlay calls unlock directly from its `pointerdown` or `keydown` handler; no BrowserInput or requestAnimationFrame exists yet. `audio_context_created`, `audio_unlock_requested`, and `audio_unlocked contextStateAfterResume=running` therefore precede `raw.audio_start_gate state=running`, the first game-loop Runtime History entry, and every later `raw.sound_play`. Resume failure produces no game frames until retry succeeds or the user explicitly chooses no-audio continuation. No Runtime, Manual, or Settings tab transition participates in this route.

`raw.sound_runtime_event` records event generation. `raw.sound_lookup` records character/common scope, group/index, found/missing result, and byte length when found. `raw.sound_play` then records the owner, scope, group/index, channel, volume/volumescale, resolved pan, frequency multiplier, loop, queued result, runtime/context status, mute, and master volume. `raw.sound_play_rejected` uses `sound_asset_missing`, `sample_not_found`, `common_sound_unavailable`, or `audio_locked`. The subsequent `raw.audio` sequence proves decode, source start, playback start, or the precise rejection point.

`raw.sound_stop` records owner/channel and either `result=stopped`, `reason=channel_not_found`, or `reason=channel_missing`. A stopped or naturally ended voice is removed from the channel table before later sound events.

`raw.sound_pan` records owner/channel, relative or absolute mode, raw pixel value, normalized value, and `result=updated`. Missing/ended channels, missing required parameters, and adapters without pan support are explicit no-ops with `channel_not_found`, `channel_missing`, `pan_missing`, or `unsupported` reasons.

`raw.explod_create` records owner, internal runtime id, duplicate-capable MUGEN id, animation scope/number, postype, raw offset, resolved world/screen position, Facing/vfacing, bindtime, removetime, sprite priority, and ontop. `raw.explod_create_rejected` identifies missing or invalid `anim`. Rendering/lifecycle evidence follows in `raw.explod_step`, `raw.explod_render`, and `raw.explod_draw`; Issue #33 modifications are correlated through `raw.explod_modify` and the same internal ids.

`raw.power` records initial, StateDef, PowerAdd/PowerSet, and TargetPowerAdd mutations with before/value-or-delta/after/max values. `raw.hit_power` records selected hit/guard `getpower` and `givepower`, both gauges before/after their player-specific clamp, and proves the mutation occurred once for the accepted contact. `raw.power_hud` is emitted when either rendered gauge value changes and records the runtime value/max plus Canvas width. `raw.hit_cornerpush` records contact class, edge condition, selected velocity offset, Facing, before/after attacker velocity, and applied/skipped reason. `raw.hit_snap` records Facing-relative offset and target before/after position. `raw.hit_sprpriority` records applied P1/P2 priorities.

`raw.hit_fall_damage` is emitted by common-State `HitFallDamage` and records fall damage, independent `fall.kill`, Life before/after, and the originating ActiveHitDef id.

`raw.hitpause` records the event-time attacker and defender counters from ActiveHitDef. Live physics and `raw.hitstun_tick` expose the remaining counter; duplicate contact rejection does not reset it.

While hit stun remains active, `raw.hitstun_tick` records independent elapsed/remaining time, current state, forced control state, control source, and state changes. Attempts to enable control, enter State 0/52 early, or take a State -1 input ChangeState are blocked and reported once per controller as `raw.hitstun_guard`. Unexpected early control or state exits are reported as `raw.hitstun_violation`.

`raw.hitstun_guard event=force_ctrl_off` records StateDef headers or allowed internal get-hit transitions that requested control during active hit stun. Internal State 5000/5001-style transitions remain permitted; only premature control is removed.

`raw.gethitvar_snapshot` records the keys captured on contact and `unsupportedKeys` that will currently return safe defaults. The snapshot stays on the defender across get-hit State transitions and is cleared when recovery ends.

For common fall/down States 5030-5120, `raw.gethitvar_frame` also records MUGEN-relative position, velocity, yaccel, ground/landed/crossing flags, `fall.recover`, `fall.recovertime`, `CanRecover`, recovery input, down/lie timers, Life/KO, and `GroundClamp`. `raw.gethit_changestate_eval` gives the exact controller index and result. A frozen fall/down frame emits `raw.fall_pause` with hitpause/pause reason, remaining time, and `clock=frozen`. `raw.down_clock` reports the independent `[Data] liedown.time` schedule and never substitutes `down.hittime` or StateTime.

Issue #62 extends those frame diagnostics through States 5150, 5200, 5201, and 5210. The KO line records `ko`, `koReason`, `hitKill`, `guardKill`, `fallKill`, `lieDead`, `roundState`, `winner`, `matchOver`, `roundEndRequested`, and `roundEndReason`. Together with `raw.gethit_changestate_eval` and the normal controller trace, this exposes the exact KO/recovery State and Anim transition rather than inferring it from the rendered result.

`raw.fall_envshake` records the fall HitDef time, frequency, amplitude, phase, and whether shared screen shake started or was skipped for zero time.

Issue #63's integrated trace gate requires one continuous sequence containing `raw.hitdef_activate`, accepted `raw.hit_collision`, `raw.hit_damage`, reaction/state transition records, fall/down frames, and either State 0 recovery or State 5150 plus RoundState winner/end reason. P1/P2 and Facing are asserted from the same diagnostic vocabulary.

`raw.move_contact` records generation id, contact/hit/guard flags, hit count, target, and accepted result. This is the source used by hit-confirm Trigger routes rather than the former ActiveHitDef/boolean approximation.

On State entry, `raw.hitdef_lifecycle` reports preserve/discard together with `hitdefpersist`, `movehitpersist`, `hitcountpersist`, and the prior hit count. This makes independent ActiveHitDef, result-flag, and count retention visible across State transitions.

MoveContact/MoveHit/MoveGuarded use an elapsed value: contact records value 1, attacker hitpause freezes it, and each following unpaused physics tick increments it. A later HitDef activation changes the diagnostic generation without erasing that move result; a later accepted contact replaces the result at value 1.

`raw.target_register` records owner, target player id, HitDef id, ActiveHitDef generation, target life, registration result, and KO rejection reason.

`raw.projectile_contact` records owner, Projectile ID, hit/guard result, contact/hit/guard times, and whether the live defender was registered as a Target. The ID-0 history entry is the most recent contact across all Projectile IDs. `raw.envshake` records controller-evaluated time/frequency/amplitude/phase and whether shared Canvas shake started.

`raw.target_controller` records the owner, controller, optional HitDef id filter, selected player ids, and whether the operation was queued, dropped, or safely skipped because no target matched.

`raw.cross` records airborne state, both players' current `AssertSpecial noautoturn` values, Facing before/after, and whether stage auto-turn changed either player. This distinguishes an AIR/rendering flip from a stage-facing change and verifies that a same-tick State transition retains the asserted flag.

## Real-character trace audit

The optional three-character regression harness asserts a continuous event chain for ground, air, guard, KO, edge, both Facing directions, and both player roles. Its current evidence and reproduction command are recorded in `hitdef-real-character-regression.md`.

The companion Explod/Sound harness follows real PlaySnd and Explod controllers through production SND/AIR resolution for P1/P2 and both Facings, then runs lifecycle and cleanup gates. Counts, commands, and absent-real-data limitations are recorded in `explod-sound-real-character-regression.md`.

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
