# ACT Palette Runtime Notes

This document records the current WebMUGEN ACT palette behavior so future Codex sessions and maintainers do not re-debug the same issue.

## Problem That Was Fixed

KFM declared ACT palette files in `public/chars/kfm/kfm.def`:

```ini
[Files]
pal1 = kfm6.act
pal2 = kfm4.act
pal3 = kfm2.act
pal4 = kfm5.act
pal5 = kfm3.act
pal6 = kfm.act
```

Before this fix, `CharacterLoader` loaded `cns`, `air`, `cmd`, and `sff`, but did not fetch the `palN` ACT files. As a result, sprite colors were coming from PCX/SFF embedded palette data or fallback behavior, not from the DEF-selected ACT palette.

The visual symptom was KFM rendering with obviously wrong colors. After connecting ACT loading, the colors changed substantially, proving that the ACT path was active. The final correction was to use reversed palette index order when applying external ACT palettes to SFF/PCX indexed pixels.

## Runtime Flow

The intended runtime path is:

```text
DEF [Files] palN entries
  -> DefParser.getCharacterDefFiles().palettes
  -> CharacterLoader.fetcher.arrayBuffer(...act)
  -> CharacterAssets.palettes
  -> SffSpritePackConverter externalPalette option
  -> PcxDecoder decodePcx(...)
  -> ImageData sprites
```

## File Responsibilities

### `src/parser/def/DefParser.ts`

Parses `[Files]` entries named `pal1`, `pal2`, etc. into sorted palette references:

```ts
{ slot: 1, file: 'kfm6.act' }
```

Sorting is by numeric slot so later code can choose the first declared slot deterministically.

### `src/core/character/CharacterLoader.ts`

Fetches ACT files declared in the DEF via `arrayBuffer()`. For now, the first loaded palette is selected for sprite conversion:

```ts
const selectedPalette = palettes[0]?.bytes;
```

When `selectedPalette` exists, the SFF conversion is called with:

```ts
{
  externalPalette: selectedPalette,
  preferExternalPalette: true,
  paletteIndexOrder: 'reversed',
}
```

If no ACT palette exists, the SFF/PCX path remains normal and uses the embedded/shared palette path.

### `src/core/sprite/SffSpritePackConverter.ts`

Accepts palette conversion options and passes them into `decodePcx()`.

Important distinction:

- SFF/PCX default behavior remains normal.
- Character DEF/ACT loading explicitly opts into external ACT palette behavior.

### `src/parser/pcx/PcxDecoder.ts`

Supports three palette options:

```ts
export type DecodePcxOptions = {
  externalPalette?: Uint8Array;
  preferExternalPalette?: boolean;
  paletteIndexOrder?: 'normal' | 'reversed';
};
```

Behavior:

- `externalPalette`: palette supplied by caller, usually ACT or shared SFF palette.
- `preferExternalPalette`: when true, use external palette before embedded PCX palette.
- `paletteIndexOrder: 'reversed'`: read color from `255 - sourceIndex`.

Transparency is still based on the original source pixel index:

```ts
alpha = sourceIndex === 0 ? 0 : 255
```

Do not base transparency on the reversed color index. Index `0` means transparent source pixel even when the color is read from palette index `255`.

## Key Rule

For DEF-loaded ACT palettes with SFF/PCX indexed sprites:

```text
ACT color lookup uses reversed palette index order.
Transparency uses the original source index.
```

This is why the final successful path is:

```ts
paletteIndexOrder: 'reversed'
```

only when an external ACT palette is selected.

## Regression Tests To Preserve

Keep these behaviors covered:

- DEF parser extracts sorted `palN` entries.
- CharacterLoader fetches ACT files from DEF.
- PCX decoding can prefer external palette over embedded palette.
- PCX decoding supports reversed palette index order.
- Source index `0` remains transparent even with reversed palette order.

## Current Limitations

Palette selection is currently simplified: it picks the first sorted DEF palette entry. Full MUGEN behavior should eventually account for player-selected palette buttons and `pal.defaults`.

Suggested future path:

```text
pal.defaults / selected button
  -> palette slot
  -> CharacterAssets.palettes lookup
  -> per-player selected ACT
  -> sprite conversion or palette-aware render-time application
```

Do not remove the reversed-index behavior while implementing that. It is required for the observed KFM ACT colors to render correctly.
