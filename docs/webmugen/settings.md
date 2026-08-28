# WebMUGEN Settings

Updated: 2026-08-23

WebMUGEN separates publisher defaults, browser-owned user settings, and live match state.

Content settings store the Catalog path, stable Character/Stage/LifeBar IDs, and the selected character palette number (`p1`-`p12`). Runtime paths are derived from the validated catalog at startup. Development and Public builds can edit and reload the same-origin Catalog source. See [content-catalog.md](content-catalog.md).

The `character` and `stage` URL parameters provide non-persistent, catalog-validated session overrides. Their precedence and fallback rules are documented in [url-settings.md](url-settings.md).

Stage and LifeBar/HUD have independent catalog IDs. The publisher default uses the WebMUGEN-native Cyber Training stage and Default Cyber HUD; compatible and native implementations remain separated as described in [native-presentation.md](native-presentation.md).

The Content section is the only user-facing selection surface for Character, palette, Stage, and
LifeBar/HUD. Runtime Settings contains match, timing, display-size, and diagnostic behavior only;
it does not repeat Stage, LifeBar/HUD, or direct Stage ZIP selectors. Legacy runtime presentation
fields remain normalized and persisted for migration and catalog-to-loader integration.

## Settings workspace

Settings uses a left menu and renders only the selected page in the right pane. Development Mode
provides Publisher settings, Content, General, Input, Audio, Display, and Developer pages. Public
Mode omits only the Publisher settings menu item. The Developer page and Content management tools
are available in both modes.

- Publisher settings owns restoring and writing the complete distributed defaults.
- Content owns Character, palette, Stage, LifeBar/HUD, Catalog management, and Catalog Generator.
- Content also owns the Development/Public Share URL field generated from the live Character and Stage Catalog IDs.
- General owns round time, Infinite Power, Practice Mode, and other match behavior.
- Input owns the live keyboard/Gamepad monitor, per-player physical controller selection,
  keyboard/Gamepad mappings, and reset action. It does not repeat those mappings in a separate
  control summary.
- Audio owns browser audio activation, test controls, master volume, and mute.
- Display owns logical viewport size and optional visual diagnostic overlays.
- Developer owns frame timing, Human/AI logs, retention mode, and hit lifecycle diagnostics.

Page selection is local UI state. The settings values remain owned by the existing parent state, so
switching pages does not change persistence, immediate application, or the `URL > localStorage >
publisher defaults` precedence.

## Sources and priority

Startup resolves settings in this order:

1. safe defaults compiled into `WebMugenSettings.ts`;
2. publisher defaults from `public/config/default-settings.json`;
3. user settings from the current origin's `localStorage` key `webmugen.settings.v1`;
4. schema migration and field-by-field normalization.

Nested groups are merged independently. A saved audio volume does not discard a newly published mute or runtime setting. Missing publisher data, failed fetches, blocked storage, malformed JSON, invalid types, and out-of-range values all fall back without preventing game startup.

## Persisted data

The version 1 object contains only configuration:

- audio volume and mute;
- match, presentation, and diagnostic runtime settings shown by Settings;
- selected character path and palette number;
- keyboard and Gamepad Button mappings;
- each player's physical controller selection, stored with Gamepad `id`, `mapping`, browser index,
  and same-ID ordinal so reconnect recovery is not based on index alone;
- Japanese/English UI language.

Character and Stage paths are restricted to normalized same-origin `/chars/` and `/stages/` asset paths with supported extensions. Unknown object keys are not copied into the normalized object.

The following live state is deliberately absent: Life, Power, StateNo, StateTime, round timer progress, Helpers, Projectiles, Targets, hit/pause clocks, logs, and match results. Reloading starts a normal new match.

## Legacy migration

When the unified key is absent, the loader migrates these existing keys once:

- `webmugen.inputConfig.v1`;
- `webmugen.characterPath.v1`;
- `webmugen.runtimeSettings.v1`;
- `webmugen.audioSettings.v1`;
- `webmugen.uiLanguage.v1`.

After a successful unified write, legacy keys are removed. Future schema changes must add explicit sequential migration before increasing `WEBMUGEN_SETTINGS_VERSION`; known fields from a future-version object are currently normalized safely to the supported schema.

## Reset behavior

The Development-only Publisher settings page provides **Restore publisher defaults** / **初期設定に戻す**. After confirmation it removes the unified user object, applies the latest fetched publisher defaults immediately to React state and the audio/runtime refs, resets input mappings, and reloads content when needed. Public Mode does not expose the Publisher settings page.

The Input page's own **Reset** action restores both players' keyboard/Button mappings and their
legacy controller defaults: the first connected Gamepad for P1 and the second for P2. Selecting
Keyboard disables Gamepad input only for that player; the player's keyboard mapping remains active.

## Storage scope

`localStorage` is scoped to the browser origin. A public HTTPS deployment and `http://localhost:5173` have separate settings. Settings are also not shared automatically across browsers, devices, private/incognito sessions, or origins. Storage failure is non-fatal.

## Publisher workflow

Edit `public/config/default-settings.json` to change defaults for first-time users and newly added fields. Existing user values keep priority. A change that must override an existing user value requires an explicit versioned migration; it must not be disguised as an ordinary default change.

In Development Mode, the Publisher settings page exposes **Use current settings as publisher defaults**. After confirmation, the browser sends the normalized complete settings object to the local Vite-only `/__webmugen/default-settings` endpoint, which overwrites the fixed `public/config/default-settings.json` target. Public builds render neither the Publisher settings menu nor its actions, do not provide the development middleware endpoint, and the client handler checks the same feature flag before making a request.

Arbitrary Character source loading and source editing are Development Mode features. Locked Public Mode keeps the Character Files page read-only, rejects edit handlers, and loads characters through the validated Catalog selection. A Public build can elevate the current tab only after the server validates the header Development Mode Pass; the credential stays in memory and reload returns to Public. Only content intended for public access should be deployed.

Public Mode retains saved diagnostic and Catalog settings. Direct Stage source settings remain publisher-controlled, and server-writer features remain Development-only. See `build-mode.md` for the complete feature table and deployment checklist.

Catalog management fetches validated same-origin JSON and does not write server files. Catalog Generator separates its inputs with a Server / Local switch. Local mode scans user-selected PC folders and may write `catalog.json` only to a separately authorized local directory. Server mode reads explicitly added same-origin published paths and downloads the generated JSON; it neither scans nor writes the deployment server.
