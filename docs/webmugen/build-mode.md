# Development and Public Build Modes

Updated: 2026-08-28

WebMUGEN derives its initial developer-facing capabilities from one `WebMugenBuildMode`: `development` or `public`. Components must consume the feature set from `BuildMode.ts`; hostname checks and independent feature booleans are not mode authorities. A Public build may elevate its in-memory feature profile after server-side Pass authentication, but it always starts locked.

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

In a Public build, the header **Development Mode** entry accepts an administrator Pass and sends it only in `X-WebMUGEN-Development-Pass` to `api/catalog.php?action=authorize`. The PHP endpoint verifies it against the separate server-only `development_pass_hash`; it never compares the Pass with the Catalog API `secret`. On success, the endpoint issues a signed, scoped session token valid for 60–3600 seconds (900 by default). The current tab switches to the Development feature profile and keeps only that short-lived token in memory for authenticated Catalog writes. The raw Pass is discarded after the authorization request and is never placed in an API-token header, URL, request body, settings, localStorage, rendered HTML, or application log. Reloading or closing the tab discards the session token and returns to locked Public Mode. A static-only deployment without the PHP endpoint cannot unlock Development Mode.

Public Mode retains game play, read-only Character Files browsing, and the Content, General, Input, Audio, Display, and Developer settings pages. The Content page retains only the published Character, Stage, LifeBar, palette, and Share URL controls while locked. Content Catalog source loading and Catalog Generator are Development-only. Runtime Debug, CNS Trace, Human/AI logs, collision boxes, state/input history, internal diagnostics, and Compatibility Matrix links remain available in both modes. Diagnostic capture remains opt-in and defaults OFF.

While locked, Public Mode excludes the Publisher settings page, Character Editor, direct Stage Editor/source controls, and their write handlers. Character source text, palettes, sprites, sounds, maps, and navigation remain viewable, but Edit/Save controls are not provided. Catalog loading is a validated same-origin read. Catalog Generator's Server mode reads explicitly added same-origin paths and downloads generated JSON; Local mode can write `catalog.json` only into a local directory that the user explicitly selects and grants browser read/write permission. An authenticated Development session may additionally use the Catalog API to replace the deployed Catalog draft.

The build mode remains the safe initial distribution policy; server-side Pass verification is the authentication boundary for runtime elevation. Never deploy private assets or secrets in a public bundle.

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
- [ ] Confirm the initial screen has a **Development Mode** entry but no `DEVELOPMENT MODE` badge.
- [ ] Confirm an invalid Pass leaves the Public feature profile active and does not expose the Pass in the URL or UI.
- [ ] Confirm a valid Pass displays the badge and Development-only controls, and that reload locks the UI again.
- [ ] Confirm Character Files can be browsed but have no Edit/Save controls.
- [ ] Confirm the Publisher settings entry and publisher-default actions are absent.
- [ ] Confirm Character and Stage editor/save controls are absent.
- [ ] Confirm Content Catalog source loading and Catalog Generator are absent while locked, while published content selection and Developer settings remain present.
- [ ] Confirm successful Pass authentication reveals Content Catalog source loading and Catalog Generator.
- [ ] Confirm the Catalog API Token field and server `save-catalog` action are absent while locked, then become available without a second Token prompt after successful Pass authentication.
- [ ] Confirm Runtime Debug, CNS Trace, detailed logs, collision boxes, and state history remain opt-in and work when enabled.
- [ ] Confirm gameplay, audio, language, input configuration, and settings persistence work.
- [ ] Confirm the Content Share URL copies and opens the selected Character and Stage.
- [ ] Deploy only the intended public catalog and `default-settings.json`.
- [ ] For proxy-release integration, deploy `api/catalog.php` and `api/catalog-lib.php`; copy `config/catalog-config.example.php` to the Git-ignored `config/catalog-config.php`. Set a rotated API `secret` and a separately generated `development_pass_hash`; never reuse either value for the other. The API secret may alternatively come from `WEBMUGEN_CATALOG_SECRET`, and the Pass hash from `WEBMUGEN_DEVELOPMENT_PASS_HASH`. Configure the storage/catalog/public-URL environment variables and confirm the PHP process can read ZIPs and replace `content/catalog.json`. Never place the real API secret, raw Pass, or production Pass hash in the example file, Vite variables, JavaScript, HTML, URLs, logs, or repository files.

If a Development build was published accidentally, rebuild with Public Mode and replace the deployed assets. Public Mode ignores direct Stage source settings and does not expose server-writer handlers.
