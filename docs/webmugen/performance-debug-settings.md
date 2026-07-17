# Performance / Debug Settings

Updated: 2026-07-17

Issue #75 separates four debug sinks in the existing persisted Runtime Settings. Missing legacy fields and invalid values migrate to OFF.

| Setting | OFF behavior |
|---|---|
| Human log | CNS trace formatting, Human detail snapshots, retained Human entries, React index updates, and Human detail DOM are stopped. Turning OFF clears retained Human data. |
| AI log | AI_RUNTIME sections, hit/trigger/controller/render/audio diagnostic strings, retained AI entries, render invalidation, and AI DOM are stopped. Turning OFF clears retained AI data. |
| Collision boxes | Canvas does not call the Clsn1, Clsn2, Push Box, Helper, or Projectile debug-rectangle paths. Normal sprites/effects still render. |
| State history | The lower-left lightweight state/input/damage stream is not sampled, its React state is not updated, and its DOM is absent. It is independent of Human log. |

Changes are read through the live settings ref on every game tick. They apply on the next processed frame without recreating characters, rounds, the renderer, input, or requestAnimationFrame loop.

## Retention and UI cadence

- Human detail storage: at most 5,000 entries; visible index: 200 entries.
- Human detail capture: at most 10 Hz, with an immediate capture when a state transition is observed.
- AI storage: at most 5,000 entries; normal rendered window: 50 entries and 1,200 lines.
- Runtime hit/controller diagnostic lines are frame-scoped before they enter an AI_RUNTIME section; prior-frame strings are not repeatedly copied into later dumps.
- Lower-left history: five transitions, five input changes, and five damage events; React rendering is throttled to 200 ms (5 Hz).
- Human/AI history render invalidation: 250 ms (4 Hz).
- Turning a sink OFF clears its retained buffers so disabled diagnostics do not keep memory alive.

These limits retain enough surrounding frames for compatibility investigation while preventing unbounded long-session growth.

## Performance measurement

The runtime retains a rolling 600-frame measurement window. Once per second it publishes the current snapshot to:

```js
window.__WEBMUGEN_PERFORMANCE__
```

The snapshot contains average FPS, p50/p95 frame time, simulation and CNS time, diagnostic and serialization time, debug UI scheduling time, normal/debug Canvas time, generated entry/character counts, and current Human/AI/state-history buffer sizes. Changing any Runtime Setting clears the window so scenarios do not contaminate each other.

Use the same character, stage, browser size, and input sequence for each scenario. Wait for at least 300 samples, then copy the snapshot.

| Scenario | Human | AI | Boxes | State history |
|---|---:|---:|---:|---:|
| A | ON | ON | ON | ON |
| B | OFF | ON | ON | ON |
| C | ON | OFF | ON | ON |
| D | ON | ON | OFF | ON |
| E | ON | ON | ON | OFF |
| F | OFF | OFF | OFF | OFF |

The measurement calls use `performance.now()` and fixed-size numeric samples. Snapshot sorting/aggregation runs only once per second.
