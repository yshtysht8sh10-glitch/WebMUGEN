# Development and Public Build Modes

Updated: 2026-08-10

WebMUGEN derives all developer-facing capabilities from one `WebMugenBuildMode`: `development` or `public`. Components must consume the feature set from `BuildMode.ts`; hostname checks and independent feature booleans are not mode authorities.

## Selection and safe fallback

Set `VITE_WEBMUGEN_MODE=development` or `VITE_WEBMUGEN_MODE=public`. The repository includes `.env.development` and `.env.public` and provides:

- `npm run build:public` for a public deployment;
- `npm run build:development` for a production-optimized diagnostic build;
- `npm run dev -- --mode public` to exercise the public UI on the Vite development server.

An explicit valid value wins independently of Vite's DEV/PROD flag. If the value is absent, a production build defaults to Public Mode and a dev server defaults to Development Mode. Invalid or unknown environments fail closed to Public Mode.

## Feature policy

Development Mode enables Character Files editing, Catalog source management, separate Character/Stage/LifeBar folder generation, direct Catalog file paths, Stage source controls, publisher-default export, Runtime Debug, CNS Trace, Human/AI logs, collision boxes, state/input history, internal diagnostics, and Compatibility Matrix links. A persistent `DEVELOPMENT MODE` badge appears in the header. Runtime Character selection remains the single Catalog-backed selector shared with Public Mode.

Public Mode retains game play, read-only Character Files browsing, and the Content, General, Input, Audio, and Display settings pages. Character source text, palettes, sprites, sounds, maps, and navigation remain viewable, but Edit/Save controls and the save handler are not provided. The Settings left menu does not render Publisher settings or Developer entries at all. Public Mode also rejects their handlers, disables trace/log/box/history collection, and normalizes previously saved developer settings to safe values. Publisher-selected character and Stage sources override saved development-only paths.

The mode is a distribution safety boundary, not authentication. Never deploy private assets or secrets in a public bundle.

## Public deployment checklist

- [ ] Run `npm run build:public` (or otherwise set `VITE_WEBMUGEN_MODE=public`).
- [ ] Confirm there is no `DEVELOPMENT MODE` badge.
- [ ] Confirm Character Files can be browsed but have no Edit/Save controls.
- [ ] Confirm the Publisher settings and Developer menu entries are absent.
- [ ] Confirm Catalog Generator, folder/direct-path inputs, and publisher-default actions are absent.
- [ ] Confirm Runtime Debug, CNS Trace, detailed logs, collision boxes, and state history are absent and not collected.
- [ ] Confirm gameplay, audio, language, input configuration, and settings persistence work.
- [ ] Deploy only the intended public catalog and `default-settings.json`.
- [ ] For proxy-release integration, deploy `api/catalog.php` and `api/catalog-lib.php`, configure the server-only shared secret/storage/catalog/public-URL environment variables, and confirm the PHP process can read ZIPs and replace `content/catalog.json`.

If a Development build was published accidentally, rebuild with Public Mode and replace the deployed assets. Existing browser settings are safe: Public Mode ignores development-only fields.
