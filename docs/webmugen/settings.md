# WebMUGEN Settings

Updated: 2026-08-02

WebMUGEN separates publisher defaults, browser-owned user settings, and live match state.

Content settings store the publisher catalog path plus stable character and stage IDs. Runtime paths are derived from the validated catalog at startup. Public builds lock the source to the published catalog while still allowing selection among its valid entries; development builds can edit and reload the source. See [content-catalog.md](content-catalog.md).

The `character` and `stage` URL parameters provide non-persistent, catalog-validated session overrides. Their precedence and fallback rules are documented in [url-settings.md](url-settings.md).

Stage and LifeBar/HUD have independent catalog IDs. The publisher default uses the WebMUGEN-native Cyber Training stage and Default Cyber HUD; compatible and native implementations remain separated as described in [native-presentation.md](native-presentation.md).

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
- selected character path;
- keyboard and gamepad mappings;
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

Settings provides **Restore publisher defaults** / **初期設定に戻す**. After confirmation it removes the unified user object, applies the latest fetched publisher defaults immediately to React state and the audio/runtime refs, resets input mappings, and reloads content when needed.

## Storage scope

`localStorage` is scoped to the browser origin. A public HTTPS deployment and `http://localhost:5173` have separate settings. Settings are also not shared automatically across browsers, devices, private/incognito sessions, or origins. Storage failure is non-fatal.

## Publisher workflow

Edit `public/config/default-settings.json` to change defaults for first-time users and newly added fields. Existing user values keep priority. A change that must override an existing user value requires an explicit versioned migration; it must not be disguised as an ordinary default change.

In Development Mode, Settings also exposes **Use current settings as publisher defaults**. After confirmation, the browser sends the normalized complete settings object to the local Vite-only `/__webmugen/default-settings` endpoint, which overwrites the fixed `public/config/default-settings.json` target. Public builds neither render the button nor provide the development middleware endpoint, and the client handler checks the same feature flag before making a request.

Character file selection, arbitrary `/chars/` path entry, Load, and the Character Files editor are Development Mode features. Public Mode omits those controls and source page, rejects their handlers, ignores a previously saved Development Mode character selection, and loads the character selected by the publisher defaults. This is a distribution boundary rather than authentication; only publisher-catalog content should be deployed with a public build.

Public Mode also strips saved diagnostic flags and does not persist newly attempted developer-only values. See `build-mode.md` for the complete feature table and deployment checklist.
