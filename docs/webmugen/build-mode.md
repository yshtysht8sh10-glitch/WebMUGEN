# Development and Public Build Modes

Updated: 2026-08-23

WebMUGEN derives all developer-facing capabilities from one `WebMugenBuildMode`: `development` or `public`. Components must consume the feature set from `BuildMode.ts`; hostname checks and independent feature booleans are not mode authorities.

## Selection and safe fallback

Set `VITE_WEBMUGEN_MODE=development` or `VITE_WEBMUGEN_MODE=public`. The repository includes `.env.development` and `.env.public` and provides:

- `npm run build:public` for a public deployment;
- `npm run build:development` for a production-optimized diagnostic build;
- `npm run dev -- --mode public` to exercise the public UI on the Vite development server.

Application bundling and the repository-wide TypeScript check are separate commands. The build
commands generate deployable assets through Vite; `npm run typecheck` runs `tsc` without emitting
files. A typecheck failure must still be reported and investigated, but it does not prevent creating
a Public artifact while existing repository-wide type debt is tracked separately.

An explicit valid value wins independently of Vite's DEV/PROD flag. If the value is absent, a production build defaults to Public Mode and a dev server defaults to Development Mode. Invalid or unknown environments fail closed to Public Mode.

## Feature policy

Development Mode enables Character Files editing, direct Stage source controls, publisher-default export, and the other developer-writer capabilities. A persistent `DEVELOPMENT MODE` badge appears in the header. Runtime Character selection remains the single Catalog-backed selector shared with Public Mode.

Public Mode retains game play, read-only Character Files browsing, and the Content, General, Input, Audio, Display, and Developer settings pages. Content Catalog source management, Catalog Generator, the Share URL, Runtime Debug, CNS Trace, Human/AI logs, collision boxes, state/input history, internal diagnostics, and Compatibility Matrix links are available in both modes. Diagnostic capture remains opt-in and defaults OFF.

Public Mode still excludes the Publisher settings page, Character Editor, direct Stage Editor/source controls, and their write handlers. Character source text, palettes, sprites, sounds, maps, and navigation remain viewable, but Edit/Save controls are not provided. Catalog loading is a validated same-origin read. Catalog Generator can download generated JSON or write `catalog.json` only into a local directory that the user explicitly selects and grants browser read/write permission; it cannot rewrite files on the deployed server. The mode is therefore a server-write boundary, not a restriction on diagnostics or local authoring tools.

The mode is a distribution safety boundary, not authentication. Never deploy private assets or secrets in a public bundle.

## Public deployment checklist

`npm run build:public` replaces `dist/` with the complete static Public artifact. Upload the
**contents of `dist/`** to the directory that should serve WebMUGEN. For a root deployment,
`dist/index.html` becomes the server document root's `index.html`. For a subdirectory deployment
such as `https://example.com/WebMUGEN/`, create/select the server's `WebMUGEN/` directory and place
`index.html`, `assets/`, `chars/`, `config/`, `content/`, `lifebars/`, and `stages/` directly inside
it. Do not upload `src/`, `node_modules/`, or the repository root. Asset references are relative,
so the same artifact supports both placements without changing a domain or server file.

- [ ] Run `npm run build:public` (or otherwise set `VITE_WEBMUGEN_MODE=public`).
- [ ] Run `npm run typecheck` and record any known failures separately from artifact generation.
- [ ] Confirm there is no `DEVELOPMENT MODE` badge.
- [ ] Confirm Character Files can be browsed but have no Edit/Save controls.
- [ ] Confirm the Publisher settings entry and publisher-default actions are absent.
- [ ] Confirm Character and Stage editor/save controls are absent.
- [ ] Confirm Content Catalog management, Catalog Generator, and Developer settings are present.
- [ ] Confirm Runtime Debug, CNS Trace, detailed logs, collision boxes, and state history remain opt-in and work when enabled.
- [ ] Confirm gameplay, audio, language, input configuration, and settings persistence work.
- [ ] Confirm the Content Share URL copies and opens the selected Character and Stage.
- [ ] Deploy only the intended public catalog and `default-settings.json`.
- [ ] For proxy-release integration, deploy `api/catalog.php` and `api/catalog-lib.php`; copy `config/catalog-config.example.php` to the Git-ignored `config/catalog-config.php` and set its server-only `secret`, or retain the `WEBMUGEN_CATALOG_SECRET` environment-variable fallback. Configure the storage/catalog/public-URL environment variables and confirm the PHP process can read ZIPs and replace `content/catalog.json`. Never place the real secret in the example file, Vite variables, JavaScript, HTML, URLs, logs, or repository files.

If a Development build was published accidentally, rebuild with Public Mode and replace the deployed assets. Public Mode ignores direct Stage source settings and does not expose server-writer handlers.
