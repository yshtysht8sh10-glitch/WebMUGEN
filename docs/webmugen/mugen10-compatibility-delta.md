# WebMUGEN MUGEN 1.0 Compatibility Delta

Updated: 2026-09-01

This inventory contains only behavior introduced by or changed in MUGEN 1.0 relative to the canonical WinMUGEN Matrix. Unchanged WinMUGEN rows are inherited and must not be duplicated here.

## Character / Profile

| Item | Meaning | Status | Notes |
|---|---|---|---|
| Compatibility Profile | Select and retain the MUGEN 1.0 compatibility identity independently from resource format. | Partial 20% | Implemented: DEF loading selects and retains `MUGEN_1_0`, and resource policy consumes the selected identity for SFF dispatch. Missing: profile-owned constants, physics, common States, HitDef, command, and animation policies. Evidence: focused CharacterLoader and SFF dispatcher tests. |
| mugenversion | `[Info] mugenversion = 1.0` selects the MUGEN 1.0 profile. | Complete | Recognized during DEF loading; unknown values diagnose and conservatively select WinMUGEN. Evidence: focused CharacterLoader selection tests. |

## Constants

| Item | Meaning | Status | Notes |
|---|---|---|---|
| movement.down.bounce.offset.x | MUGEN 1.0 movement down-bounce horizontal offset constant. | Partial 40% | Implemented: character metadata pair parsing and `Const` lookup are available. Missing: MUGEN 1.0 profile-owned validity, omission defaults, and common-state consumption. Evidence: parser/runtime constant tests and compatibility architecture audit. |
| movement.down.bounce.offset.y | MUGEN 1.0 movement down-bounce vertical offset constant. | Partial 40% | Implemented: character metadata pair parsing and `Const` lookup are available. Missing: MUGEN 1.0 profile-owned validity, omission defaults, and common-state consumption. Evidence: parser/runtime constant tests and compatibility architecture audit. |
| movement.down.bounce.yaccel | MUGEN 1.0 down-bounce acceleration constant. | Partial 35% | Implemented: configured character values can be resolved. Missing: profile-owned default and verified MUGEN 1.0 common-state semantics. Evidence: runtime constant tests and compatibility architecture audit. |
| movement.down.bounce.groundlevel | MUGEN 1.0 down-bounce ground-level constant. | Partial 35% | Implemented: configured character values can be resolved. Missing: profile-owned default and verified MUGEN 1.0 common-state semantics. Evidence: runtime constant tests and compatibility architecture audit. |

## Triggers / Expressions

| Item | Meaning | Status | Notes |
|---|---|---|---|
| AILevel | MUGEN 1.0 AI level trigger. | Partial 20% | Implemented: evaluator reads an injected AI level and otherwise returns zero. Missing: production AI-level selection and full MUGEN 1.0 behavior. Evidence: focused trigger and command-route tests. |
| Cond | MUGEN 1.0 short-circuit conditional expression. | Complete | The selected branch is evaluated lazily and invalid conditions return bottom. Evidence: focused expression-domain and branch-evaluation tests. |
| Const240p | Convert a constant to the 240p coordinate space. | Not started | Planned MUGEN 1.0 difference; no compatible evaluator is registered. |
| Const480p | Convert a constant to the 480p coordinate space. | Not started | Planned MUGEN 1.0 difference; no compatible evaluator is registered. |
| Const720p | Convert a constant to the 720p coordinate space. | Not started | Planned MUGEN 1.0 difference; no compatible evaluator is registered. |

## State Controllers

| Item | Meaning | Status | Notes |
|---|---|---|---|
| RemapPal | Remap sprite palette groups and indices at runtime. | Not started | Planned MUGEN 1.0 controller difference; no verified production palette-remap effect is connected. |

## Resources / SFF v2.0

| Item | Meaning | Status | Notes |
|---|---|---|---|
| SFF v2.0 | Header-detected MUGEN 1.0 sprite resource format. | Partial 55% | Implemented: independent v2.0 parser, MUGEN 1.0 resource-policy gate, and RGBA SpritePack conversion for the supported subset. Missing: remaining compression/data/color-depth modes and broader real-character coverage. Evidence: focused parser/dispatcher/converter tests and optional Alice Liddell integration. |
| Sprite Directory | SFF v2 sprite directory records. | Complete | Header counts and sprite directory metadata are parsed with bounds validation. Evidence: focused SFF v2 fixture tests. |
| Palette Directory | SFF v2 palette directory records. | Complete | Palette nodes and per-sprite palette references are parsed and converted. Evidence: focused SFF v2 parser/converter tests. |
| LData | SFF v2 literal data block. | Complete | LData offsets are bounds-checked and feed supported sprite/palette decoding. Evidence: focused SFF v2 fixture tests. |
| TData | SFF v2 translated data block. | Not started | Unsupported TData references fail explicitly instead of being treated as decoded. |
| Linked Sprite | SFF v2 linked sprite data. | Complete | Linked sprite chains preserve referencing metadata and reject invalid indices/cycles. Evidence: focused link and cycle tests. |
| Linked Palette | SFF v2 linked palette data. | Complete | Linked palette chains resolve with invalid-index and cycle detection. Evidence: focused palette-link tests. |
| RLE8 | SFF v2 8-bit RLE8 compression. | Complete | Declared length, runs, and final pixel count are validated before conversion. Evidence: focused decoder and SpritePack tests. |
| RLE5 | SFF v2 5-bit RLE compression. | Not started | Unsupported RLE5 sprites fail explicitly. |
| LZ5 | SFF v2 LZ5 compression. | Not started | Unsupported LZ5 sprites fail explicitly. |

## Engine Differences

| Item | Meaning | Status | Notes |
|---|---|---|---|
| Profile-owned runtime semantics | Apply only verified MUGEN 1.0 differences on top of canonical WinMUGEN behavior. | Not started | Planned dispatcher services for constants, physics, common States, HitDef, commands, and animation; current runtime behavior is shared globally. |
| Character localcoord | MUGEN 1.0 character coordinate-space declaration and scaling. | Not started | Planned engine difference; full character-local coordinate scaling is not implemented. |
