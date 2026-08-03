# Development and Public Build Modes

Updated: 2026-08-02

WebMUGEN derives all developer-facing capabilities from one `WebMugenBuildMode`: `development` or `public`. Components must consume the feature set from `BuildMode.ts`; hostname checks and independent feature booleans are not mode authorities.

## Selection and safe fallback

Set `VITE_WEBMUGEN_MODE=development` or `VITE_WEBMUGEN_MODE=public`. The repository includes `.env.development` and `.env.public` and provides:

- `npm run build:public` for a public deployment;
- `npm run build:development` for a production-optimized diagnostic build;
- `npm run dev -- --mode public` to exercise the public UI on the Vite development server.

An explicit valid value wins independently of Vite's DEV/PROD flag. If the value is absent, a production build defaults to Public Mode and a dev server defaults to Development Mode. Invalid or unknown environments fail closed to Public Mode.

## Feature policy

Development Mode enables Character Files editing, arbitrary character loading, Stage source controls, publisher-default export, Runtime Debug, CNS Trace, Human/AI logs, collision boxes, state/input history, internal diagnostics, and Compatibility Matrix links. A persistent `DEVELOPMENT MODE` badge appears in the header.

Public Mode retains game play, read-only Character Files browsing, normal audio/input/language/gameplay Settings, and restore-to-publisher-defaults. Character source text, palettes, sprites, sounds, maps, and navigation remain viewable, but Edit/Save controls and the save handler are not provided. Public Mode does not render the other developer pages or controls. It also rejects their handlers, disables trace/log/box/history collection, and normalizes previously saved developer settings to safe values. Publisher-selected character and Stage sources override saved development-only paths.

The mode is a distribution safety boundary, not authentication. Never deploy private assets or secrets in a public bundle.

## Public deployment checklist

- [ ] Run `npm run build:public` (or otherwise set `VITE_WEBMUGEN_MODE=public`).
- [ ] Confirm there is no `DEVELOPMENT MODE` badge.
- [ ] Confirm Character Files can be browsed but have no Edit/Save controls.
- [ ] Confirm arbitrary character path input and publisher-default export are absent.
- [ ] Confirm Runtime Debug, CNS Trace, detailed logs, collision boxes, and state history are absent and not collected.
- [ ] Confirm gameplay, audio, language, input configuration, settings persistence, and reset work.
- [ ] Deploy only the intended public catalog and `default-settings.json`.

If a Development build was published accidentally, rebuild with Public Mode and replace the deployed assets. Existing browser settings are safe: Public Mode ignores development-only fields.
