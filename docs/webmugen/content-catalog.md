# Content Catalog

Updated: 2026-08-23

## Purpose and architecture

The Content Catalog is the common, deployment-independent list of content that a WebMUGEN publisher allows the game to load. The game runtime reads one versioned `catalog.json`; it does not scan folders, inspect ZIP archives, or infer content kinds during startup or reload.

Responsibilities are deliberately separated:

- **Catalog Reader** fetches one same-origin JSON file, enforces a timeout, parses JSON, and returns either a validated Catalog or a structured failure with the previous successful Catalog as fallback.
- **Catalog Validator** checks the schema, version, individual items, duplicate IDs, kind/engine values, safe paths, and resolves relative paths against the Catalog directory.
- **Content Selection** exposes only entries of the requested kind and resolves a removed selection to the first allowed entry of that kind.
- **Content Loader** remains the final authority for the selected Character, Stage, or LifeBar. A declared `kind` never bypasses its normal Loader validation.
- **Catalog Generator** is a separate Development Mode tool. It scans independently selected Character, Stage, and LifeBar folders, validates directly specified files, and creates `catalog.json` in an independent output folder or download.

The Generator is optional. A missing or unsupported Generator must never prevent normal game startup. Server deployments may generate the same schema through PHP, Node.js, a CLI, a management application, deployment automation, or manual authoring; WebMUGEN has no dependency on any one of those systems.

## Catalog schema

The canonical version 1 document uses `items`:

```json
{
  "version": 1,
  "items": [
    {
      "id": "t-h-m-a",
      "kind": "character",
      "engine": "winmugen",
      "source": "builtin",
      "name": "T-H-M-A",
      "path": "/chars/T-H-M-A.zip"
    },
    {
      "id": "cyber",
      "kind": "stage",
      "engine": "webmugen",
      "source": "builtin",
      "name": "Cyber Training",
      "path": "stages/cyber/stage.json"
    },
    {
      "id": "default-cyber",
      "kind": "lifebar",
      "engine": "webmugen",
      "source": "builtin",
      "name": "Default Cyber HUD",
      "path": "lifebars/default-cyber/lifebar.json"
    }
  ]
}
```

Each item has a stable `id`, display `name`, `kind` (`character`, `stage`, or `lifebar`), execution `engine` (`winmugen` or `webmugen`), and path. The optional `source` field distinguishes publisher-shipped `builtin` items from generated `external` items. Relative paths are resolved from the directory containing `catalog.json`; absolute same-origin paths remain absolute. Built-in native content may use `builtin:<kind>:<id>`.

Unknown kinds/engines, unsafe paths, duplicate IDs, invalid item shapes, and incompatible extensions are excluded individually and reported. A missing `items` array or unsupported top-level version rejects the whole document. An empty `items` array is valid and leaves the publisher's safe game fallbacks active.

## Runtime reading and fallback

The Catalog path is stored as `content.catalogPath`. The publisher default is `content/catalog.json`, resolved from the directory containing the deployed `index.html`, so the same build works at the origin root or below a path such as `/DotoEita/50_WebMUGEN/`. Safe same-origin absolute JSON paths are also accepted; arbitrary external URLs and traversal are rejected. Runtime reads use `cache: no-store` so a newly published Character is selectable without waiting for a stale browser cache to expire.

On first load, a Catalog failure leaves the code/publisher Character, Stage, and LifeBar fallbacks available so the game can still start. On explicit reload, a failed request, 404, invalid JSON, version error, or timeout retains the previous successful Catalog. Development Mode displays the error and whether fallback was used.

Selection priority is:

```text
URL selection > localStorage user setting > default-settings.json > code fallback
```

URL Character and Stage IDs are accepted only when an entry of the correct kind exists in the validated publisher Catalog. URL selection is session-only and does not automatically overwrite localStorage. If a saved/current ID disappears, selection falls back to the first allowed item of the same kind.

## Catalog Generator

The Generator starts with a **Server / Local** source-location switch and renders only the controls used by the selected workflow:

- **Local:** uses `showDirectoryPicker()` when supported. Independently choose external Character, Stage, and LifeBar folders; any source may remain unset. The Generator recursively reads candidates and maps their relative paths to the default published bases `/chars`, `/stages`, and `/lifebars`. An optional output folder enables direct `catalog.json` writeback; download remains available as a fallback.
- **Server:** accepts same-origin files that are already publicly reachable by WebMUGEN. Set the published URL base for each kind and add a file name, relative path, or absolute same-origin path. For example, `itoko.zip` under `/chars` resolves to `/chars/itoko.zip`. Server mode generates a downloadable Catalog and does not expose local folder pickers or output-folder writeback.

Server mode does not scan a deployment server directory and does not receive server credentials. Rental-server rebuild scripts and the authenticated Catalog API remain separate server-side workflows.

In both modes, each result must match its source slot's expected kind. Publisher-shipped `source: "builtin"` items are always retained; generated items receive `source: "external"`. An unset source kind retains its currently loaded external items instead of silently deleting them. Structured classification results record kind, engine, confidence, entry file, warnings, and errors. Unknown/corrupt/ambiguous/wrong-kind entries, unsafe direct paths, and duplicate generated IDs are listed with reasons.

For a locally generated Character entry, the `/chars/<relative path>` value is also the lookup key
for the saved local Character folder. Runtime keeps normal same-origin HTTP loading first, then reads
that relative ZIP/DEF from the retained folder handle only when the HTTP load is unavailable or
invalid for the declared asset type. This lets one
generated `catalog.json` keep stable Character paths during local testing while preserving the same
server-first paths after the assets are published. Stage and LifeBar local-runtime fallback are not
part of this slice.

The four Local-mode `FileSystemDirectoryHandle` values are stored separately in IndexedDB when supported. A restored handle is used only after checking its current permission. Expired permission requests reauthorization; failure returns to explicit folder selection. Browsers without the File System Access API can switch to Server mode for same-origin direct paths, download a generated Catalog, run the game, or use a server/CLI-generated Catalog.

### Classification rules

- **Character:** `[Info]`, Character `[Files]`, CMD/CNS/ST references, and sprite/animation references.
- **Stage:** `[Info]` or `[StageInfo]` plus `[Camera]`, `[PlayerInfo]`, `[Bound]`, and `[BGDef]`.
- **LifeBar:** fight.def-style `[Files]` plus multiple LifeBar-specific sections such as `[Lifebar]`, `[Powerbar]`, `[Round]`, `[Time]`, or `[Combo]`.
- **WebMUGEN native:** a valid version 1 `webmugen-stage` or `webmugen-lifebar` JSON definition.
- **Unknown:** incomplete structures, invalid JSON/path, corrupt ZIP, no recognized DEF, or multiple recognized entry DEF files.

Classification lives under `src/content/catalog-generator/`. The Runtime Reader never imports or invokes it.

## Local and server generation

For local authoring, select Local and use the three source pickers plus the separate output picker. Local folder scanning uses the standard public bases for each content kind. A local `FileSystemDirectoryHandle` never reveals or defines a deployment-server path.

For content already uploaded to the same WebMUGEN origin, select Server and add the published files by URL path. This is a browser-side read and download workflow, not a server filesystem scan or server write operation.

For a server or rental-hosting environment, create or update `catalog.json` outside the runtime using any suitable tool:

- PHP deployment/administration script;
- Node.js script;
- CLI or build step;
- separate management web application;
- manual authoring.

Only the shared schema is part of the runtime contract. Do not make the browser Runtime enumerate server folders.

### Proxy-release publishing endpoint

The supplied PHP endpoint `public/api/catalog.php` is the deployment adapter for the proxy-release workflow. It scans only the configured fixed storage root, validates each ZIP server-side, and rewrites the same version 1 Catalog consumed by the Runtime. It supports authenticated `POST` actions:

- `publish-character`: validate one `publicationId` plus the actual `archiveFile` basename and return its stable Character ID, Character path, and play URL;
- `publish-stage`: validate one Stage ZIP, upsert it with the stable publication ID, and return its Stage ID, Stage path, and a play URL using the configured default Character;
- `rebuild`: rescan the fixed storage root and replace all `proxy-release-*` entries while retaining publisher/built-in entries;
- `play-url`: return the current URL for an already cataloged publication.

For rental-server deployments, copy `public/config/catalog-config.example.php` to `public/config/catalog-config.php` and replace `YOUR_SECRET_HERE` with the same Bearer token configured in the proxy-release administrator screen. `catalog-config.php` is ignored by Git and must remain server-only. PHP reads the secret in this order:

1. non-empty `secret` from `public/config/catalog-config.php`;
2. `WEBMUGEN_CATALOG_SECRET` environment variable;
3. no secret, causing Catalog API authorization to fail with HTTP 401.

The environment variable remains supported for Docker and existing deployments. Never place either real value in the example file, Vite/browser settings, JavaScript, HTML, URLs, logs, or repository files.

After `publish-character` or `rebuild` atomically replaces `content/catalog.json`, the endpoint applies permission mode `0644` to the final file so the web server can serve it to the browser. A failed permission change does not discard an otherwise valid Catalog update, but PHP records a warning in the server error log; correct the hosting account ownership or filesystem permissions before relying on the generated Catalog.

For temporary 401 diagnosis only, set `'debug' => true` in the server-only `catalog-config.php` and send a `POST` to `api/catalog.php?action=debug`. This action runs before authentication only while the flag is the boolean `true`; otherwise it returns 404. The response reports whether the config file exists, is readable, and returned an array; whether the selected secret came from `config`, `environment`, or `none`; Secret and request-header byte lengths; Authorization and selected authentication sources; matching `HTTP_`/`REDIRECT_HTTP_` server key names; Bearer prefix; and the resolved deployment paths. It never returns the Secret, Authorization value, X-WebMUGEN-Token value, or hashes. Set `debug` back to `false` immediately after diagnosis because the response includes server filesystem paths.

Authorization is read first from `$_SERVER['HTTP_AUTHORIZATION']`, then `$_SERVER['REDIRECT_HTTP_AUTHORIZATION']`, `apache_request_headers()`, and `getallheaders()`. If any Authorization value exists, it is treated as the preferred Bearer credential and a mismatch fails authentication even when an X token also matches. When Authorization is unavailable, the server accepts `X-WebMUGEN-Token` from the equivalent PHP/header sources and compares it with the same configured Secret using `hash_equals()`. The API never accepts a Token from the JSON body. proxy-release sends both headers to tolerate rental-server environments that strip Authorization.

Configure the remaining deployment values with these server-side environment variables:

- `WEBMUGEN_CATALOG_SECRET`: backward-compatible Bearer token fallback when the config file has no non-empty secret;
- `WEBMUGEN_PROXY_STORAGE_DIR`: filesystem path to `/DotoEita/16_proxy_release/storage/data`;
- `WEBMUGEN_PROXY_STORAGE_PUBLIC_BASE`: corresponding same-origin URL path;
- `WEBMUGEN_CATALOG_PATH`: filesystem path to the deployed `content/catalog.json`;
- `WEBMUGEN_PUBLIC_URL`: deployed WebMUGEN `index.html` URL;
- `WEBMUGEN_DEFAULT_STAGE_ID`: stage ID included in generated play URLs.
- `WEBMUGEN_DEFAULT_CHARACTER_ID`: character ID used when generating a play URL for a published Stage (default `t-h-m-a`).

`publish-character` accepts `publicationId`, `archiveFile`, and optional `stageId`. `publicationId` produces the stable ID `proxy-release-<publicationId>`; it is never inferred from `archiveFile`. `archiveFile` must be a `.zip` basename with no slash, backslash, `..`, URL syntax, absolute path, or control characters, and is resolved only below `WEBMUGEN_PROXY_STORAGE_DIR`. A valid Character DEF requires `[Info]`, `[Files]`, `cmd`, `anim`, and either `cns` or `st`. Multiple valid definitions use the same shallowest/simplest deterministic ranking as the browser Character loader. A valid Stage DEF requires Stage metadata plus `[Camera]`, `[PlayerInfo]`, `[Bound]`, and `[BGDef] spr`; multiple Stage definitions use the same ranking. Zero valid definitions, corrupt archives, traversal paths, or unsafe names fail without changing the existing Catalog.

`publish-stage` accepts `publicationId`, `archiveFile`, and optional `characterId`. It writes a `kind: "stage"`, `engine: "winmugen"` entry using stable ID `proxy-release-<publicationId>`. Before writing, it verifies that the selected Character exists and generates `?character=<id>&stage=proxy-release-<publicationId>`.

Before writing, the endpoint builds the prospective Catalog, verifies that the requested Stage exists as a Stage entry, generates the standard `?character=<id>&stage=<id>` URL, and validates the complete document. Only then does it atomically replace `catalog.json`; an invalid Stage cannot leave a Character-only partial update. Rebuild continues to inspect every ZIP basename in the configured storage directory, replaces only `proxy-release-*` items, retains built-in/publisher items, and returns per-file exclusions.

`WEBMUGEN_PROXY_STORAGE_DIR` is a PHP server filesystem setting. It is unrelated to Settings → External Character → Select folder, which grants the local browser Catalog Generator access to a directory on the user's PC. Public proxy publication never depends on that Development/authoring picker.

## Development and Public Mode UI

Both modes show a responsive **Content in use** section with separate Character, Stage, and LifeBar/HUD selectors. Options include `[WinMUGEN]` or `[WebMUGEN]`; display labels are distinct from stable IDs. Invalid and unknown entries never appear. These are the only Stage and LifeBar/HUD selection controls; Runtime Settings does not duplicate them or expose a separate Stage ZIP path.

Development Mode additionally shows:

- valid counts per content kind;
- Catalog success/partial/fallback/error status;
- total, valid, and excluded counts;
- item-level exclusion reasons;
- editable **Content list file** path and reload;
- three independent external source folders and URL bases;
- same-origin direct file path additions per kind;
- an independent Catalog output folder plus generate, write, and download controls;
- Generator exclusions and Catalog diff counts.

Public Mode hides the Catalog path, reload, Generator, folder picker, detailed errors, and all management actions. It shows only the allowed content selectors and cannot switch to a user-saved Catalog path that differs from the publisher default.

The Character selector in **Content in use** is the only runtime Character selection UI. The former separate Character path selector was removed. Development authors add missing Character paths through the Generator, validate them, regenerate the Catalog, and then select them from the same Catalog-backed control used in Public Mode.

## Security notes

- Treat Catalog JSON as untrusted input and validate every item.
- Reject external URLs, traversal segments, unsafe roots, invalid IDs, and incompatible paths.
- Do not treat `kind` as proof that the target content is valid; the selected content must still pass its Character, Stage, or LifeBar Loader.
- Do not make the Runtime recursively fetch or scan a content tree.
- Do not expose local folder handles or Generator controls in Public Mode.
- Directory permission is user-controlled and may expire at any time.
- Do not deploy secrets or private assets merely because they are absent from the Catalog.
