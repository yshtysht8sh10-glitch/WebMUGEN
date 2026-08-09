# Native Stage and LifeBar architecture

WebMUGEN keeps WinMUGEN-compatible presentation code and WebMUGEN-native presentation code in separate trees:

```text
src/stage/StageRuntime.ts
src/stage/winmugen/*
src/stage/webmugen/*
src/lifebar/LifeBarRuntime.ts
src/lifebar/winmugen/*
src/lifebar/webmugen/*
public/stages/webmugen/*
public/lifebars/webmugen/*
```

The application selects an implementation when content is loaded and passes only `StageRuntime` and `LifeBarRuntime` to `CanvasRenderer`. The game/render loop calls the common contracts; it does not branch on native versus compatible content. A stage reports bounds, camera configuration, and ground Y through the contract. A lifebar renders its behind-player HUD pass and foreground round presentation independently of the selected stage.

## WinMUGEN-compatible path

`WinMugenStageLoader` accepts only same-origin stage ZIPs and delegates DEF/SFF parsing to the compatibility loader. `WinMugenStageRuntime` and `WinMugenStageRenderer` handle the resulting MUGEN coordinates and sprite layers. `WinMugenLifeBarLoader` recognizes fight.def-style `[Files]` references only; its types, runtime, and renderer remain separate from the native schema. Missing compatibility behavior remains Partial/Unsupported and must be tracked in the WinMUGEN compatibility matrix. Native features never raise a compatibility status.

## WebMUGEN-native path

Native documents use versioned JSON, never WinMUGEN DEF as an extension point. `WebMugenStageLoader` accepts only `/stages/webmugen/*.json`; v1 defines identity, player starts, ground Y, camera bounds, and a presentation type. Image presentations contain ordered image layers; relative, same-directory image sources are resolved by the loader. Each layer may declare a stable ID, horizontal and vertical `cameraFactor: [x, y]`, a normalized vertical `viewportBand: [start, end]`, and a `background` or `foreground` pass. A viewport band clips a shared source image into contiguous visual parts while retaining one common vertical camera factor, allowing safe horizontal parallax without regenerated artwork or vertical seams. Legacy native definitions using `parallax`/`parallaxY` normalize to the same camera pair, and omitted bands cover the full viewport. Foreground layers render after players but before environment/pause overlays and HUD presentation. Unsafe paths, wrong formats, wrong versions, and invalid ranges are rejected. The image renderer uses cover-fit with overscan so screen shake does not expose an edge. Until a background image is ready, or if it fails, it safely clears with a solid background; an unavailable foreground layer stays transparent.

`WebMugenLifeBarLoader` accepts only `/lifebars/webmugen/*.json`. Its responsive v1 schema controls visibility and palette. The renderer shows life, power (including infinity), timer, round, wins, and round presentation in a viewport-relative layout.

The publisher default is Cyber Training (`public/stages/webmugen/cyber-training/stage.json`) with its panoramic background, plus Default Cyber HUD (`public/lifebars/webmugen/default-cyber/lifebar.json`). Fresh Training has its own panoramic image under `public/stages/webmugen/fresh-training/`; it does not reuse the Cyber artwork. Both use two visual depth regions from seamless 3:1 sources. Fresh distant scenery moves at 0.12 and Cyber chamber scenery at 0.10 of the horizontal camera delta; each arena floor moves at the full delta. A meadow or horizon transition smoothly interpolates between the factors. The wide sources restore full Stage camera bounds without exposing image edges, while continuous transitions avoid horizontal seams. `Fresh Clasic` preserves the earlier enhanced procedural presentation. `Cyber Clasic` uses a dedicated procedural horizon and perspective grid: the initial vanishing point is the viewport center, then both the vanishing point and floor endpoints follow the full horizontal camera delta relative to the centered match-start camera. Its native `verticalFollow` is zero, keeping the camera and ground vertically fixed during jumps. No raster front/building layer is rendered. This avoids the former transparent-image rectangle and keeps the floor aligned with stage-space character motion. Stage and LifeBar are selected through catalog/settings IDs and remain independent.

## Adding native content

1. Put Stage content below `public/stages/webmugen/<id>/` or LifeBar content below `public/lifebars/webmugen/<id>/`.
2. Create a version-1 JSON document matching the relevant schema and keep image references relative.
3. Add a typed entry to `public/content/catalog.json` using a stable ID.
4. Add loader/schema/runtime focused tests, including invalid-format and unsafe-path cases.
5. Do not update the WinMUGEN compatibility matrix for native-only work.
