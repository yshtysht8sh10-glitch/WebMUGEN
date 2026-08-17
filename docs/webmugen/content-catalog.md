# Content Catalog

Updated: 2026-08-04

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

The Catalog path is stored as `content.catalogPath`. The default is `/content/catalog.json`. Only same-origin absolute JSON paths without traversal are accepted; arbitrary external URLs are rejected.

On first load, a Catalog failure leaves the code/publisher Character, Stage, and LifeBar fallbacks available so the game can still start. On explicit reload, a failed request, 404, invalid JSON, version error, or timeout retains the previous successful Catalog. Development Mode displays the error and whether fallback was used.

Selection priority is:

```text
URL selection > localStorage user setting > default-settings.json > code fallback
```

URL Character and Stage IDs are accepted only when an entry of the correct kind exists in the validated publisher Catalog. URL selection is session-only and does not automatically overwrite localStorage. If a saved/current ID disappears, selection falls back to the first allowed item of the same kind.

## Catalog Generator

The Development Mode Generator uses `showDirectoryPicker()` when supported:

1. Independently choose external Character, Stage, and LifeBar folders. Any source may remain unset.
2. Set the published same-origin URL base for each folder, such as `/chars`, `/stages`, or `/lifebars`. A local filesystem path is never treated as a Runtime URL.
3. Add same-origin direct file paths when a desired DEF, ZIP, or JSON file is not obtained from folder scanning. A file name or relative path such as `itoko.zip` is resolved against that source's Published URL base (for example `/chars/itoko.zip`); an absolute same-origin path remains unchanged.
4. The Generator recursively reads candidates and requires each result to match the source slot's expected kind.
5. Publisher-shipped `source: "builtin"` items are always retained; generated items receive `source: "external"`. An unset source kind retains its currently loaded external items instead of silently deleting them.
6. Structured classification results record kind, engine, confidence, entry file, warnings, and errors.
7. Unknown/corrupt/ambiguous/wrong-kind entries, unsafe direct paths, and duplicate generated IDs are listed with reasons.
8. Independently choose an optional Catalog output folder. With write permission, `catalog.json` is written there; without an output folder or permission it can be downloaded.

The four `FileSystemDirectoryHandle` values are stored separately in IndexedDB when supported. A restored handle is used only after checking its current permission. Expired permission requests reauthorization; failure returns to explicit folder selection. Browsers without the File System Access API can still use same-origin direct paths, download a generated Catalog, run the game, or use a server/CLI-generated Catalog.

### Classification rules

- **Character:** `[Info]`, Character `[Files]`, CMD/CNS/ST references, and sprite/animation references.
- **Stage:** `[Info]` or `[StageInfo]` plus `[Camera]`, `[PlayerInfo]`, `[Bound]`, and `[BGDef]`.
- **LifeBar:** fight.def-style `[Files]` plus multiple LifeBar-specific sections such as `[Lifebar]`, `[Powerbar]`, `[Round]`, `[Time]`, or `[Combo]`.
- **WebMUGEN native:** a valid version 1 `webmugen-stage` or `webmugen-lifebar` JSON definition.
- **Unknown:** incomplete structures, invalid JSON/path, corrupt ZIP, no recognized DEF, or multiple recognized entry DEF files.

Classification lives under `src/content/catalog-generator/`. The Runtime Reader never imports or invokes it.

## Local and server generation

For local authoring, use the three Development Mode source pickers and the separate output picker. Folder scanning combines the configured public URL base with each relative file path. Direct paths must already be absolute same-origin Runtime URLs. This separation is required because a local `FileSystemDirectoryHandle` does not reveal or define the URL used after deployment.

For a server or rental-hosting environment, create or update `catalog.json` outside the runtime using any suitable tool:

- PHP deployment/administration script;
- Node.js script;
- CLI or build step;
- separate management web application;
- manual authoring.

Only the shared schema is part of the runtime contract. Do not add a required proprietary server API merely to enumerate files.

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
