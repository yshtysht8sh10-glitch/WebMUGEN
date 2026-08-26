# WebMUGEN Compatibility Architecture

Updated: 2026-08-26

## Purpose

WebMUGEN's primary compatibility target is WinMUGEN (M.U.G.E.N 2002.04.14). Existing WinMUGEN characters should execute in the browser as close to the original engine as practical.

MUGEN 1.0 compatibility is an additive layer. It may extend WebMUGEN only where it does not change WinMUGEN behavior. MUGEN 1.1 and later versions may be added by the same rule.

The architectural direction is:

```text
MUGEN 1.1 Compatibility (future)
              |
MUGEN 1.0 Compatibility
              | version differences only
              v
       WinMUGEN Engine
```

WinMUGEN is the base engine. It must not be implemented as a fallback from MUGEN 1.0 behavior.

## WinMUGEN First

The base implementation owns WinMUGEN semantics, including its defaults, common-state behavior, HitDef interpretation, physics, command timing, animation, and error behavior. A later-version rule must not enter this base merely because it is documented more clearly in MUGEN 1.0 material.

When WinMUGEN and MUGEN 1.0 agree, they may share an implementation after that equivalence is established. Shared code is an implementation detail; the evidence and owning profiles must still be recorded. When they differ, separate profile behavior is mandatory.

Compatibility fixes must therefore answer these questions before implementation:

1. What does WinMUGEN do?
2. Is the observed syntax or behavior available in WinMUGEN, MUGEN 1.0, or both?
3. Which profile owns the default and edge-case behavior?
4. Can implementation be shared without erasing a proven version difference?

## Compatibility Profile

Character loading will determine one explicit `CompatibilityProfile` and retain it on the loaded character. Initial profile identities are:

```ts
type CompatibilityProfileId = 'WINMUGEN' | 'MUGEN_1_0';
// Future: 'MUGEN_1_1'
```

The intended selection rule is:

- absent `Info.mugenversion`, or a WinMUGEN version such as `2002,02,14`: `WINMUGEN`;
- `Info.mugenversion = 1.0`: `MUGEN_1_0`;
- a future recognized 1.1 value: `MUGEN_1_1`;
- unknown or malformed values: use a documented conservative policy and emit a load diagnostic; never silently infer a later profile from one isolated expression.

The loaded `CharacterAssets` will hold the selected profile. Runtime systems will consume profile services or resolved policies instead of scattering `if (mugenversion == ...)` checks through controllers, physics, HitDef, and animation.

Conceptually:

```ts
interface CompatibilityProfile {
  id: CompatibilityProfileId;
  constants: ConstantSemantics;
  physics: PhysicsSemantics;
  commonStates: CommonStatePolicy;
  hitDef: HitDefSemantics;
  command: CommandSemantics;
  animation: AnimationSemantics;
}
```

The dispatcher selects this bundle once during character loading. Individual runtime modules call the selected policy. Profile inheritance or composition may reuse the WinMUGEN implementation, but later profiles contain only verified differences.

## Parser and semantics are separate

Parsers recognize file syntax and retain source data without deciding version-specific game behavior. For example:

```ini
[Movement]
down.bounce.offset = 0, 20
```

is parsed into a common vector representation equivalent to `{ x: 0, y: 20 }`. This syntax-level conversion is not permission to apply the value in every compatibility profile.

The profile decides:

- whether `Const(movement.down.bounce.offset.x)` is a valid expression;
- which character field that expression reads;
- what omission means;
- whether a default exists and who owns it;
- which common State, HitDef, or physics rule consumes it.

Parser output must preserve the original value as well as normalized views needed by common consumers. Parsing must not inject WinMUGEN or MUGEN 1.0 defaults.

## Version-difference organization

The target source layout is organized by compatibility ownership:

```text
src/compatibility/
  winmugen/
    constants
    physics
    commonStates
    hitdef
    command
    animation
  mugen10/
    constants
    physics
    commonStates
    hitdef
    command
    animation
  mugen11/                 # future
  dispatcher
```

This is a migration target, not authorization for a one-shot refactor. Existing behavior should move only with focused tests and evidence. Code review must be able to identify whether a rule is WinMUGEN base behavior, a MUGEN 1.0 difference, or genuinely shared behavior.

## Evidence priority

WinMUGEN behavior is established in this order:

1. observed WinMUGEN real-game behavior;
2. WinMUGEN standard characters;
3. WinMUGEN standard `common1.cns`;
4. official WinMUGEN or contemporary documentation.

Real-character evidence supplements these sources but does not by itself prove engine semantics, because a character can implement custom behavior.

MUGEN 1.0 documentation is evidence for the MUGEN 1.0 difference layer. It must not be the sole basis for changing the WinMUGEN profile. A rule described by MUGEN 1.0 documentation may enter shared code only after WinMUGEN equivalence is independently confirmed.

Every compatibility change should record the source version, evidence, tested profile, and remaining uncertainty in its focused test, topic documentation, or Matrix note.

## Constants and `movement.down.bounce`

The values `offset=(0,20)`, `yaccel=.4`, and `groundlevel=12` are visible as literals in the WinMUGEN 2002.04.14 common State 5101. The names `Const(movement.down.bounce.*)` and the corresponding `[Movement]` fields belong to the later MUGEN 1.0 expression/data surface.

These facts must remain separate:

- the WinMUGEN profile owns the verified State 5101 behavior and its common-state literals;
- the MUGEN 1.0 profile owns resolution and omission rules for `Const(movement.down.bounce.*)`;
- a shared numeric implementation is allowed only as a tested reuse of equivalent behavior, not as evidence that the two specifications are identical;
- each profile will ultimately own its constant defaults instead of using one global fallback table.

The current global `CnsConstants` fallback for these names is transitional. It fixes a real runtime failure but does not represent the final profile architecture. Until profile dispatch exists, documentation and Matrix evidence must label this boundary honestly.

## Adding a compatibility rule

Use this sequence for new work:

1. Identify the affected syntax and runtime behavior.
2. Determine the target profile before selecting implementation evidence.
3. Reproduce WinMUGEN behavior using the evidence priority above.
4. Investigate later-version documentation only as a difference analysis.
5. Put syntax normalization in the parser and behavior/defaults in the owning profile.
6. Add focused tests named or parameterized by profile. Shared tests must run against every profile claiming the behavior.
7. Update the relevant topic document and Matrix evidence with the tested version.
8. Add diagnostics when profile selection or dispatch cannot be observed otherwise.
9. Run focused tests, the full suite, Matrix validation when applicable, and the production build.

Do not broaden a WinMUGEN fix into MUGEN 1.0 support without separate evidence and acceptance criteria.

## Compatibility Matrix direction

The current Matrix is WinMUGEN-first and remains the canonical WinMUGEN checklist. During profile migration, rows with a known version difference must state the affected profile in their evidence.

The future Matrix representation should support one item identity with profile-specific status/evidence, or clearly separated per-profile views. It must not collapse different WinMUGEN and MUGEN 1.0 results into one ambiguous status. The schema change will be designed and migrated separately; this document does not change current Matrix status mechanics.

## Adding MUGEN 1.1 or another version

A new version is added as a new profile whose base is the nearest established earlier profile and whose code contains verified differences only. Adding it requires:

- an explicit loader selection rule;
- its own evidence policy and versioned tests;
- profile-owned constants and defaults;
- documented common-state, HitDef, physics, command, and animation differences;
- Matrix representation that does not alter the meaning of existing WinMUGEN results.

No later profile becomes the implicit default. An unknown version must not silently upgrade a character.

## Current implementation gap

The repository does not yet implement the target architecture:

| Area | Current state | Target state |
|---|---|---|
| Profile selection | DEF retains generic fields, but `CharacterAssets` has no selected compatibility profile | Select once during load and retain the profile |
| Runtime dispatch | Runtime modules call shared global behavior | Runtime consumes profile policies |
| Constants | `CnsConstants` combines character values and one global fallback table | Profile-owned resolution and defaults |
| Common States | DEF-selected common States and bundled WinMUGEN `common1.cns` are merged without profile dispatch | Profile selects compatible common-state policy/assets |
| Parser | Metadata retains raw scalar/array values; vector normalization is being added independently of semantics | Common normalized syntax model consumed by profiles |
| Matrix | One WinMUGEN-first status per item | Preserve WinMUGEN view and add profile-specific evidence/status where differences exist |

Migration must be incremental. The first implementation milestone should add profile identity and loader selection without changing runtime behavior. Later milestones can move one semantic family at a time behind the dispatcher.
