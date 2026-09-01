# WebMUGEN MUGEN 1.1 Compatibility Delta

Updated: 2026-09-01

This inventory contains only behavior introduced by or changed in MUGEN 1.1 relative to MUGEN 1.0. It inherits the canonical WinMUGEN Matrix plus the MUGEN 1.0 delta; inherited rows must not be duplicated here.

## Character / Profile

| Item | Meaning | Status | Notes |
|---|---|---|---|
| MUGEN 1.1 Compatibility Profile | Select and retain a MUGEN 1.1 difference layer on top of MUGEN 1.0. | Not started | Planned profile identity, loader selection rule, diagnostics, policies, and versioned tests. |
| mugenversion 1.1 | `[Info] mugenversion = 1.1` selects the MUGEN 1.1 profile. | Not started | Currently diagnosed as unknown and conservatively loaded with the WinMUGEN profile. |

## Triggers

| Item | Meaning | Status | Notes |
|---|---|---|---|
| BackEdge | MUGEN 1.1 camera-space back edge. | Not started | Planned MUGEN 1.1 trigger difference. |
| BottomEdge | MUGEN 1.1 camera-space bottom edge. | Not started | Planned MUGEN 1.1 trigger difference. |
| CameraPos X | MUGEN 1.1 camera X position. | Not started | Planned MUGEN 1.1 trigger difference. |
| CameraPos Y | MUGEN 1.1 camera Y position. | Not started | Planned MUGEN 1.1 trigger difference. |
| CameraZoom | MUGEN 1.1 camera zoom factor. | Not started | Planned MUGEN 1.1 trigger difference. |
| FrontEdge | MUGEN 1.1 camera-space front edge. | Not started | Planned MUGEN 1.1 trigger difference. |
| GameHeight | MUGEN 1.1 game coordinate-space height. | Not started | Planned MUGEN 1.1 trigger difference. |
| GameWidth | MUGEN 1.1 game coordinate-space width. | Not started | Planned MUGEN 1.1 trigger difference. |
| LeftEdge | MUGEN 1.1 camera-space left edge. | Not started | Planned MUGEN 1.1 trigger difference. |
| RightEdge | MUGEN 1.1 camera-space right edge. | Not started | Planned MUGEN 1.1 trigger difference. |
| ScreenHeight | MUGEN 1.1 rendered screen height. | Not started | Planned MUGEN 1.1 trigger difference. |
| ScreenWidth | MUGEN 1.1 rendered screen width. | Not started | Planned MUGEN 1.1 trigger difference. |
| TopEdge | MUGEN 1.1 camera-space top edge. | Not started | Planned MUGEN 1.1 trigger difference. |

## Resources / SFF v2.01

| Item | Meaning | Status | Notes |
|---|---|---|---|
| SFF v2.01 | MUGEN 1.1 extension of the SFF v2 resource format. | Not started | Planned MUGEN 1.1 resource difference; the current parser supports only the verified v2.0 subset. |
| PNG Sprite | PNG-encoded sprite payloads. | Not started | Planned MUGEN 1.1 resource difference. |
| RGBA Sprite | Direct-color sprites with alpha. | Not started | Planned MUGEN 1.1 resource difference; current RGBA output is produced only by converting indexed supported inputs. |

## Camera / Rendering

| Item | Meaning | Status | Notes |
|---|---|---|---|
| Camera Zoom | MUGEN 1.1 match camera zoom behavior. | Not started | Planned camera simulation and renderer integration difference. |
| Zoom-aware rendering | Apply camera zoom to players, stages, effects, collision presentation, and screen-space coordinates. | Not started | Planned render-pipeline difference; current rendering has no MUGEN 1.1 zoom profile. |
| RGBA blending | MUGEN 1.1 direct alpha-channel rendering semantics. | Not started | Planned renderer difference; indexed-source conversion does not establish MUGEN 1.1 RGBA parity. |

## Explod Differences

| Item | Meaning | Status | Notes |
|---|---|---|---|
| Explod space | Select stage or screen coordinate space for an Explod. | Not started | Planned MUGEN 1.1 Explod parameter difference. |
| Explod remappal | Apply palette remapping to an Explod. | Not started | Planned MUGEN 1.1 Explod parameter difference. |

## Engine Differences

| Item | Meaning | Status | Notes |
|---|---|---|---|
| MUGEN 1.1 profile-owned runtime semantics | Apply verified 1.1 differences on top of the MUGEN 1.0 profile without changing inherited behavior. | Not started | Planned dispatcher services and versioned evidence for 1.1-only behavior. |
