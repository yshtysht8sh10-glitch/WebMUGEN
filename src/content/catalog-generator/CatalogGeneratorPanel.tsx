import { useEffect, useRef, useState } from 'react';
import { useUiLanguage } from '../../app/UiLanguage';
import { BUILTIN_CONTENT_ENTRIES } from '../catalog/BuiltinContentCatalog';
import type { ContentCatalog, ContentCatalogDocument, ContentKind } from '../catalog/ContentCatalogTypes';
import { isCatalogDraftDirty, mergeCatalogEntries, parseCatalogDraft, removeCatalogEntry } from './CatalogDraft';
import { loadCatalogDirectoryHandle, saveCatalogDirectoryHandle } from './CatalogDirectoryStore';
import { generateContentCatalog, resolveCatalogDirectPath, resolveCatalogPublicPath } from './CatalogGenerator';
import { loadCatalogPublicBases, saveCatalogPublicBases } from './CatalogPublicBaseStore';
import type { CatalogDirectoryHandle, CatalogDirectoryRole, CatalogGeneratorResult, CatalogSourceFile } from './CatalogGeneratorTypes';
import { CatalogServerWriteError, readCatalogServerSnapshot, saveCatalogDraftToServer, scanCatalogServerContent } from './CatalogServerWriter';
import { readCatalogSourceFiles, readCatalogSourcePath } from './LocalFolderCatalogSource';
import { downloadCatalogJson, ensureDirectoryPermission, serializeContentCatalog, writeCatalogToDirectory } from './CatalogWriter';

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<CatalogDirectoryHandle>;
};

const SOURCE_KINDS: ContentKind[] = ['character', 'stage', 'lifebar'];
const DEFAULT_PUBLIC_BASES: Record<ContentKind, string> = {
  character: '/chars',
  stage: '/stages',
  lifebar: '/lifebars',
};

export type CatalogGeneratorMode = 'server' | 'local';
type CatalogSaveState = 'idle' | 'checking' | 'local-saving' | 'local-saved' | 'local-failed' | 'server-saving' | 'server-saved' | 'server-failed' | 'conflict';

export function CatalogGeneratorPanel({
  catalog,
  initialMode = 'local',
  canWriteServer = false,
  serverCredential,
  onCatalogSaved,
}: {
  catalog: ContentCatalog;
  initialMode?: CatalogGeneratorMode;
  canWriteServer?: boolean;
  serverCredential?: string;
  onCatalogSaved?: () => void | Promise<void>;
}) {
  const { text } = useUiLanguage();
  const [mode, setMode] = useState<CatalogGeneratorMode>(initialMode);
  const [directories, setDirectories] = useState<Partial<Record<CatalogDirectoryRole, CatalogDirectoryHandle>>>({});
  const [publicBases, setPublicBases] = useState(() => loadCatalogPublicBases(DEFAULT_PUBLIC_BASES));
  const [directDrafts, setDirectDrafts] = useState<Record<ContentKind, string>>({ character: '', stage: '', lifebar: '' });
  const [directPaths, setDirectPaths] = useState<Record<ContentKind, string[]>>({ character: [], stage: [], lifebar: [] });
  const [sourcesDirty, setSourcesDirty] = useState(false);
  const [draftCatalog, setDraftCatalog] = useState<ContentCatalogDocument>(() => toDocument(catalog));
  const [savedCatalog, setSavedCatalog] = useState<ContentCatalogDocument>(() => toDocument(catalog));
  const [serverRevision, setServerRevision] = useState<string | null>(null);
  const lastSavedServerRevision = useRef<string | null>(null);
  const [serverToken, setServerToken] = useState('');
  const [saveState, setSaveState] = useState<CatalogSaveState>('idle');
  const [result, setResult] = useState<CatalogGeneratorResult | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorText, setEditorText] = useState(() => serializeContentCatalog(toDocument(catalog)));
  const [status, setStatus] = useState(initialMode === 'local'
    ? text('Choose local source folders, then add external content to the Catalog draft.', 'ローカルの入力フォルダを選択し、外部コンテンツをCatalog下書きへ追加します。')
    : text('Add files available on this server to the Catalog draft.', 'サーバーで公開済みのファイルをCatalog下書きへ追加します。'));
  const [busy, setBusy] = useState(false);
  const pickerSupported = typeof window !== 'undefined' && typeof (window as DirectoryPickerWindow).showDirectoryPicker === 'function';
  const draftDirty = isCatalogDraftDirty(draftCatalog, savedCatalog);
  const editorDirty = editorText !== serializeContentCatalog(draftCatalog);
  const pendingChanges = draftDirty || editorDirty || sourcesDirty;
  const draftState = catalogDraftState(draftDirty || editorDirty, sourcesDirty, saveState, text);
  const applyButtonFeedback = catalogApplyButtonFeedback(pendingChanges, saveState, text);

  useEffect(() => {
    const next = toDocument(catalog);
    setDraftCatalog(next);
    setSavedCatalog(next);
    setEditorText(serializeContentCatalog(next));
    setResult(null);
    setSourcesDirty(false);
  }, [catalog]);

  useEffect(() => {
    if (mode !== 'server' || !canWriteServer) return undefined;
    let active = true;
    setSaveState('checking');
    setStatus(text('Checking the current server Catalog revision...', 'サーバー上のCatalog更新状態を確認しています…'));
    void readCatalogServerSnapshot(catalog.sourcePath ?? '/content/catalog.json').then((snapshot) => {
      if (!active) return;
      if (isCatalogDraftDirty(snapshot.catalog, savedCatalog)) {
        setServerRevision(null);
        setSaveState('conflict');
        setStatus(text(
          'The server Catalog differs from the loaded draft base. Reload the content list before saving.',
          'サーバー上のCatalogが下書きの読込元から更新されています。保存前にコンテンツ一覧を再読込してください。',
        ));
        return;
      }
      setServerRevision(snapshot.revision);
      if (snapshot.revision === lastSavedServerRevision.current) {
        setSaveState('server-saved');
        setStatus(text(
          `Server save succeeded: ${snapshot.catalog.items.length} items are applied to catalog.json.`,
          `サーバー保存成功: ${snapshot.catalog.items.length}件がcatalog.jsonに反映されています。`,
        ));
        return;
      }
      setSaveState('idle');
      setStatus(text('The server Catalog matches the loaded draft base.', 'サーバー上のCatalogは下書きの読込元と一致しています。'));
    }).catch((error) => {
      if (!active) return;
      setServerRevision(null);
      setSaveState('server-failed');
      setStatus(text('Server Catalog check failed: ', 'サーバーCatalogの確認に失敗しました: ') + errorMessage(error));
    });
    return () => { active = false; };
  }, [mode, canWriteServer, catalog.sourcePath, text]);

  const changeMode = (nextMode: CatalogGeneratorMode) => {
    setMode(nextMode);
    setResult(null);
    setSourcesDirty(nextMode === 'local'
      ? SOURCE_KINDS.some((kind) => Boolean(directories[kind]))
      : SOURCE_KINDS.some((kind) => directPaths[kind].length > 0));
    setSaveState('idle');
    setStatus(nextMode === 'local'
      ? text('Choose local source folders, then add external content to the Catalog draft.', 'ローカルの入力フォルダを選択し、外部コンテンツをCatalog下書きへ追加します。')
      : text('Add files available on this server to the Catalog draft.', 'サーバーで公開済みのファイルをCatalog下書きへ追加します。'));
  };

  useEffect(() => {
    let active = true;
    void Promise.all(([...SOURCE_KINDS, 'output'] as CatalogDirectoryRole[]).map(async (role) => {
      const handle = await loadCatalogDirectoryHandle(role);
      if (!handle) return;
      const permitted = await ensureDirectoryPermission(handle, role === 'output' ? 'readwrite' : 'read');
      if (active && permitted) setDirectories((current) => ({ ...current, [role]: handle }));
    })).catch(() => {
      if (active) setStatus(text('A saved folder permission expired. Select that folder again.', '保存済みフォルダの権限が失効しました。対象フォルダを再選択してください。'));
    });
    return () => { active = false; };
  }, [text]);

  const chooseFolder = async (role: CatalogDirectoryRole) => {
    const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
    if (!picker) {
      setStatus(text('This browser does not support folder selection.', 'このブラウザはフォルダ選択に対応していません。'));
      return;
    }
    try {
      const handle = await picker({ mode: role === 'output' ? 'readwrite' : 'read' });
      setDirectories((current) => ({ ...current, [role]: handle }));
      if (role !== 'output') setSourcesDirty(true);
      await saveCatalogDirectoryHandle(handle, role).catch(() => false);
      setStatus(role === 'output'
        ? text(`${roleLabel(role, 'en')} folder selected: ${handle.name}.`, `${roleLabel(role, 'ja')}フォルダを選択しました: ${handle.name}`)
        : text(
          `${roleLabel(role, 'en')} folder selected: ${handle.name}. It will be imported into the draft before the final save.`,
          `${roleLabel(role, 'ja')}フォルダを選択しました: ${handle.name}。最終反映時に下書きへ自動で取り込みます。`,
        ));
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setStatus(text('Folder selection failed: ', 'フォルダ選択に失敗しました: ') + errorMessage(error));
    }
  };

  const addDirectPath = (kind: ContentKind) => {
    const path = directDrafts[kind].trim().replace(/\\/g, '/');
    if (!path || directPaths[kind].includes(path)) return;
    setDirectPaths((current) => ({ ...current, [kind]: [...current[kind], path] }));
    setDirectDrafts((current) => ({ ...current, [kind]: '' }));
    setResult(null);
    setSourcesDirty(true);
  };

  const scanExternalContent = async (baseCatalog: ContentCatalogDocument): Promise<CatalogGeneratorResult> => {
    const files: CatalogSourceFile[] = [];
    for (const kind of SOURCE_KINDS) {
      const directory = mode === 'local' ? directories[kind] : undefined;
      if (directory) {
        if (!await ensureDirectoryPermission(directory, 'read')) throw new Error(`${roleLabel(kind, 'en')} folder permission was not granted.`);
        const scanned = await readCatalogSourceFiles(directory);
        files.push(...scanned.map((file) => ({
          ...file,
          expectedKind: kind,
          catalogPath: resolveCatalogPublicPath(DEFAULT_PUBLIC_BASES[kind], file.path),
        })));
      }
      for (const path of mode === 'server' ? directPaths[kind] : []) {
        files.push({
          ...await readCatalogSourcePath(resolveCatalogDirectPath(publicBases[kind], path)),
          expectedKind: kind,
        });
      }
    }
    const replacedKinds = new Set(SOURCE_KINDS.filter((kind) => (
      mode === 'local' ? Boolean(directories[kind]) : directPaths[kind].length > 0
    )));
    const preserved = baseCatalog.items.filter((entry) => entry.source !== 'external' || !replacedKinds.has(entry.kind));
    return generateContentCatalog(files, baseCatalog, preserved);
  };

  const applyGeneratedDraft = (generated: CatalogGeneratorResult) => {
    setResult(generated);
    setDraftCatalog(generated.catalog);
    setEditorText(serializeContentCatalog(generated.catalog));
    setSourcesDirty(false);
  };

  const addExternalContent = async () => {
    setBusy(true);
    setStatus(text('Scanning the three sources and validating direct paths...', '3種の入力元を走査し、直接指定パスを検証しています…'));
    try {
      let generated = await scanExternalContent(draftCatalog);
      if (mode === 'server') {
        const token = (serverCredential ?? serverToken).trim();
        if (!token) throw new Error(text(
          'Development Mode authentication is required to scan the server folder.',
          'サーバーフォルダの走査にはDevelopment Mode認証が必要です。',
        ));
        const scanned = await scanCatalogServerContent(token);
        const storagePublicBase = normalizeServerPublicBase(scanned.storagePublicBase);
        const enabledKinds = new Set<ContentKind>((['character', 'stage'] as ContentKind[]).filter((kind) => (
          normalizeServerPublicBase(publicBases[kind]) === storagePublicBase
        )));
        if (enabledKinds.size === 0) {
          throw new Error(text(
            `The server API scans ${storagePublicBase}. Set the Character or Stage published URL base to that path.`,
            `サーバーAPIの走査起点は ${storagePublicBase} です。外部Characterまたは外部Stageの配信URLの基点をこのパスにしてください。`,
          ));
        }
        const selectedEntries = scanned.entries.filter((entry) => enabledKinds.has(entry.kind));
        const merged = mergeCatalogEntries(generated.catalog, selectedEntries);
        generated = {
          ...generated,
          catalog: merged,
          items: merged.items.map((entry) => ({ ...entry, sourcePath: entry.path })),
          excluded: [
            ...generated.excluded,
            ...scanned.excluded.map((entry) => ({
              path: entry.file,
              result: { kind: 'unknown' as const, warnings: [], errors: [entry.message] },
            })),
          ],
          scannedFiles: generated.scannedFiles + scanned.entries.length + scanned.excluded.length,
        };
      }
      applyGeneratedDraft(generated);
      setStatus(text(
        `External content updated: ${generated.catalog.items.length} draft items, ${generated.excluded.length} files excluded.`,
        `外部コンテンツを下書きへ取り込みました: 下書き${generated.catalog.items.length}件、${generated.excluded.length}ファイル除外。`,
      ));
    } catch (error) {
      setStatus(text('Catalog generation failed: ', 'Catalog生成に失敗しました: ') + errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const addBuiltInContent = () => {
    const next = mergeCatalogEntries(draftCatalog, BUILTIN_CONTENT_ENTRIES);
    setDraftCatalog(next);
    setEditorText(serializeContentCatalog(next));
    setResult(null);
    setStatus(text(
      `Built-in content is present in the Catalog (${BUILTIN_CONTENT_ENTRIES.length} entries).`,
      `内蔵コンテンツ${BUILTIN_CONTENT_ENTRIES.length}件をCatalogへ追加しました。`,
    ));
  };

  const deleteItem = (id: string) => {
    const next = removeCatalogEntry(draftCatalog, id);
    setDraftCatalog(next);
    setEditorText(serializeContentCatalog(next));
    setResult(null);
    setStatus(text(`Removed ${id} from the Catalog draft.`, `${id} をCatalog下書きから削除しました。`));
  };

  const applyEditor = () => {
    try {
      const next = parseCatalogDraft(editorText, catalog.sourcePath ?? '/content/catalog.json');
      setDraftCatalog(next);
      setEditorText(serializeContentCatalog(next));
      setResult(null);
      setStatus(text('The edited JSON was applied to the Catalog draft.', '編集したJSONをCatalog下書きへ反映しました。'));
    } catch (error) {
      setStatus(text('Catalog JSON is invalid: ', 'Catalog JSONが不正です: ') + errorMessage(error));
    }
  };

  const writeCatalog = async () => {
    const output = directories.output;
    if (!output) return;
    setBusy(true);
    setSaveState('local-saving');
    try {
      let catalogToWrite = parseCatalogDraft(editorText, catalog.sourcePath ?? '/content/catalog.json');
      setDraftCatalog(catalogToWrite);
      setEditorText(serializeContentCatalog(catalogToWrite));
      if (sourcesDirty) {
        setStatus(text('Importing the selected sources into the draft before saving...', '選択した入力元を下書きへ取り込んでから保存しています…'));
        const generated = await scanExternalContent(catalogToWrite);
        applyGeneratedDraft(generated);
        catalogToWrite = generated.catalog;
      }
      const outcome = await writeCatalogToDirectory(output, catalogToWrite);
      if (outcome === 'written') {
        const basesRemembered = saveCatalogPublicBases(publicBases);
        setSavedCatalog(catalogToWrite);
        setSaveState('local-saved');
        setStatus(text(
          `The draft was applied to catalog.json (${catalogToWrite.items.length} items).${basesRemembered ? ' Published URL bases were remembered.' : ''}`,
          `下書き${catalogToWrite.items.length}件をcatalog.jsonに反映しました。${basesRemembered ? '配信URLの基点を記憶しました。' : ''}`,
        ));
      } else {
        setSaveState('local-failed');
        setStatus(text('Write permission is unavailable. Download catalog.json instead.', '書込権限がありません。catalog.jsonをダウンロードしてください。'));
      }
    } catch (error) {
      setSaveState('local-failed');
      setStatus(text('Catalog write failed: ', 'Catalog書込に失敗しました: ') + errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const writeServerCatalog = async () => {
    const token = (serverCredential ?? serverToken).trim();
    if (!token) {
      setSaveState('server-failed');
      setStatus(text('Enter the Catalog API Token before saving.', '保存前にCatalog API Tokenを入力してください。'));
      return;
    }
    if (!serverRevision) {
      setSaveState('conflict');
      setStatus(text('Reload the content list before saving to the server.', 'サーバーへ保存する前にコンテンツ一覧を再読込してください。'));
      return;
    }
    setBusy(true);
    setSaveState('server-saving');
    if (!serverCredential) setServerToken('');
    setStatus(text('Saving the Catalog draft through the authenticated server API...', '認証付きCatalog API経由で下書きを保存しています…'));
    try {
      let catalogToWrite = parseCatalogDraft(editorText, catalog.sourcePath ?? '/content/catalog.json');
      setDraftCatalog(catalogToWrite);
      setEditorText(serializeContentCatalog(catalogToWrite));
      if (sourcesDirty) {
        setStatus(text('Importing the selected sources into the draft before server save...', '選択した入力元を下書きへ取り込んでからサーバーへ保存しています…'));
        const generated = await scanExternalContent(catalogToWrite);
        applyGeneratedDraft(generated);
        catalogToWrite = generated.catalog;
      }
      const saved = await saveCatalogDraftToServer(catalogToWrite, serverRevision, token);
      const basesRemembered = saveCatalogPublicBases(publicBases);
      lastSavedServerRevision.current = saved.revision;
      setServerRevision(saved.revision);
      setSavedCatalog(catalogToWrite);
      await onCatalogSaved?.();
      setSaveState('server-saved');
      setStatus(text(
        `Server save succeeded: ${saved.itemCount} items were applied to catalog.json.${basesRemembered ? ' Published URL bases were remembered.' : ''}`,
        `サーバー保存成功: ${saved.itemCount}件をcatalog.jsonに反映しました。${basesRemembered ? '配信URLの基点を記憶しました。' : ''}`,
      ));
    } catch (error) {
      const conflict = error instanceof CatalogServerWriteError && error.code === 'catalog.conflict';
      if (conflict) setServerRevision(null);
      setSaveState(conflict ? 'conflict' : 'server-failed');
      setStatus(conflict
        ? text('Server save conflict: reload the content list before retrying.', 'サーバー保存競合: コンテンツ一覧を再読込してからやり直してください。')
        : text('Server save failed: ', 'サーバー保存失敗: ') + errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="catalog-generator" aria-label="Catalog Generator">
      <div className="catalog-generator-heading">
        <div>
          <h3>{text('Generate content list', 'コンテンツ一覧を生成')}</h3>
          <p>{text(
            'Choose separate external Character, Stage, and LifeBar sources, then manage the Catalog draft before saving it.',
            '外部Character・Stage・LifeBarの入力元を個別に指定し、保存前にCatalog下書きを確認・編集します。',
          )}</p>
        </div>
      </div>

      <div className="catalog-generator-mode" aria-label={text('Catalog source location', 'コンテンツの場所')} role="group">
        <span>{text('Source location', 'コンテンツの場所')}</span>
        <div className="catalog-generator-mode-switch">
          <button aria-pressed={mode === 'server'} className={mode === 'server' ? 'active' : ''} onClick={() => changeMode('server')} type="button">
            {text('Server', 'サーバー')}
          </button>
          <button aria-pressed={mode === 'local'} className={mode === 'local' ? 'active' : ''} onClick={() => changeMode('local')} type="button">
            {text('Local', 'ローカル')}
          </button>
        </div>
        <small>{mode === 'local'
          ? text(
            'Scan folders on this computer and save locally. Browsers disclose the complete folder name, not its absolute OS path.',
            'このPCのフォルダを走査してローカルへ保存します。ブラウザはフォルダ名を開示しますが、OS上の絶対パスは開示しません。',
          )
          : canWriteServer
            ? text('Read published files and apply the draft through the authenticated Catalog API.', '公開済みファイルを読み込み、認証付きCatalog API経由で下書きを反映します。')
            : text('Read only files already published under this WebMUGEN origin.', 'このWebMUGENと同一オリジンで公開済みのファイルだけを読み込みます。')}</small>
      </div>

      <div className="catalog-source-grid">
        {SOURCE_KINDS.map((kind) => <section className="catalog-source-card" key={kind}>
          <h4>{text(roleLabel(kind, 'en'), roleLabel(kind, 'ja'))}</h4>
          {mode === 'local' ? <><p className="catalog-folder-path" title={directories[kind]?.name}>{directories[kind]
            ? text(`Selected folder: ${directories[kind]!.name}`, `選択中のフォルダ: ${directories[kind]!.name}`)
            : text('No local folder selected.', 'ローカルフォルダ未選択')}</p>
          <button disabled={busy || !pickerSupported} onClick={() => void chooseFolder(kind)} type="button">
            {text('Choose folder', 'フォルダを選択')}
          </button>
          </> : <><label>
            <span>{text('Published URL base', '配信URLの基点')}</span>
            <input aria-label={`${kind} public URL base`} value={publicBases[kind]} onChange={(event) => {
              const value = event.currentTarget.value;
              setPublicBases((current) => ({ ...current, [kind]: value }));
              setResult(null);
              if (directPaths[kind].length > 0) setSourcesDirty(true);
            }} />
          </label>
          <label>
            <span>{text('Direct file path', 'ファイルを直接パス指定')}</span>
            <div className="catalog-direct-path-row">
              <input aria-label={`${kind} direct file path`} placeholder={`${DEFAULT_PUBLIC_BASES[kind]}/... or file.zip`} value={directDrafts[kind]} onChange={(event) => {
                const value = event.currentTarget.value;
                setDirectDrafts((current) => ({ ...current, [kind]: value }));
              }} />
              <button disabled={!directDrafts[kind].trim()} onClick={() => addDirectPath(kind)} type="button">{text('Add', '追加')}</button>
            </div>
          </label>
          {directPaths[kind].length > 0 ? <ul className="catalog-direct-paths">{directPaths[kind].map((path) => <li key={path}>
            <code>{path}</code>
            <button aria-label={`Remove ${path}`} onClick={() => {
              setDirectPaths((current) => ({ ...current, [kind]: current[kind].filter((item) => item !== path) }));
              setResult(null);
              setSourcesDirty(true);
            }} type="button">×</button>
          </li>)}</ul> : null}
          </>}
        </section>)}
      </div>

      <section className={`catalog-output-card${pendingChanges ? ' draft-dirty' : ''}`}>
        <div className="catalog-output-heading">
          <div>
            <h4>{text('Catalog output', 'Catalog出力')}</h4>
            <p>{text(
              'Add external or built-in content to the draft. Review it, then save or download catalog.json.',
              '外部または内蔵コンテンツを下書きへ追加し、確認後にcatalog.jsonを保存またはダウンロードします。',
            )}</p>
          </div>
          <div className="catalog-draft-state" aria-live="polite">
            <strong>{text(`${draftCatalog.items.length} items`, `${draftCatalog.items.length}件`)}</strong>
            <span className={draftState.tone}>{draftState.label}</span>
          </div>
        </div>
        {mode === 'local' ? <div className="catalog-output-folder-row">
          <div>
            <span>{text('Output folder', '出力フォルダ')}</span>
            <p className="catalog-folder-path" title={directories.output?.name}>{directories.output
              ? text(`Selected folder: ${directories.output.name}`, `選択中のフォルダ: ${directories.output.name}`)
              : text('No output folder selected. Download remains available.', '出力フォルダ未選択。ダウンロードは利用できます。')}</p>
          </div>
          <button disabled={busy || !pickerSupported} onClick={() => void chooseFolder('output')} type="button">{text('Choose output folder', '出力フォルダを選択')}</button>
        </div> : canWriteServer ? <div className="catalog-server-auth">
          {serverCredential ? <strong>{text('Development Mode authenticated', 'Development Mode 認証済み')}</strong> : <label htmlFor="catalog-api-token">
            <span>{text('Catalog API Token', 'Catalog API Token')}</span>
            <input
              id="catalog-api-token"
              aria-label="Catalog API Token"
              autoComplete="off"
              disabled={busy}
              type="password"
              value={serverToken}
              onChange={(event) => setServerToken(event.currentTarget.value)}
            />
          </label>}
          <small>{serverCredential ? text(
            'A short-lived Development session is used for server saves and kept only in memory.',
            '認証済みのPassをサーバー保存にも使用し、メモリ上だけに保持します。',
          ) : text(
            'Used only for this save request. It is not stored in settings, localStorage, URLs, or logs.',
            'この保存リクエストだけに使用し、設定・localStorage・URL・ログには保存しません。',
          )}</small>
        </div> : null}

        <details className="catalog-item-manager">
          <summary>{text('Review or remove Catalog items', 'Catalog項目を確認・削除')} ({draftCatalog.items.length})</summary>
          <ul>{draftCatalog.items.map((entry) => <li key={entry.id}>
            <span><strong>{entry.name}</strong><code>{entry.id} · {entry.kind} · {entry.path}</code></span>
            <button aria-label={`Remove ${entry.id}`} onClick={() => deleteItem(entry.id)} type="button">{text('Remove', '削除')}</button>
          </li>)}</ul>
        </details>

        {editorOpen ? <div className="catalog-json-editor">
          <label htmlFor="catalog-json-draft">{text('catalog.json text editor', 'catalog.jsonテキストエディター')}</label>
          <textarea id="catalog-json-draft" value={editorText} onChange={(event) => {
            setEditorText(event.currentTarget.value);
            setSaveState('idle');
          }} spellCheck={false} />
          <div><button onClick={applyEditor} type="button">{text('Apply JSON to draft', 'JSONを下書きへ反映')}</button></div>
        </div> : null}

        <div className="catalog-draft-actions">
          <button className="catalog-draft-action" disabled={busy} onClick={() => void addExternalContent()} type="button">{text('Import selected external content into draft', '選択した外部コンテンツを下書きに取り込む')}</button>
          <button className="catalog-draft-action" disabled={busy} onClick={addBuiltInContent} type="button">{text('Add built-in content to draft', '下書きに内蔵コンテンツを追加')}</button>
          <button className="catalog-draft-action" onClick={() => setEditorOpen((open) => !open)} type="button">{editorOpen ? text('Close draft text editor', '下書きのテキスト編集を閉じる') : text('Edit draft as JSON', '下書きをJSONで編集')}</button>
        </div>
        <div className="catalog-output-actions">
          <button className="catalog-download-button" onClick={() => downloadCatalogJson(draftCatalog)} type="button">{text('Download draft as catalog.json', '下書きをcatalog.jsonとしてダウンロード')}</button>
          {mode === 'local' ? <button aria-live="polite" className={`catalog-apply-button${pendingChanges ? ' pending' : ''} ${applyButtonFeedback.tone}`} disabled={busy || !directories.output} onClick={() => void writeCatalog()} type="button">{applyButtonFeedback.label}</button> : null}
          {mode === 'server' && canWriteServer ? <button aria-live="polite" className={`catalog-apply-button${pendingChanges ? ' pending' : ''} ${applyButtonFeedback.tone}`} disabled={busy || saveState === 'checking' || !serverRevision} onClick={() => void writeServerCatalog()} type="button">{applyButtonFeedback.label}</button> : null}
        </div>
      </section>
      {mode === 'local' && !pickerSupported ? <p className="catalog-generator-warning">{text(
        'Folder selection is not supported in this browser. Switch to Server to add same-origin file paths, or use a supported browser.',
        'このブラウザはフォルダ選択に対応していません。サーバーへ切り替えて同一オリジンのファイルを追加するか、対応ブラウザを使用してください。',
      )}</p> : null}
      <p className="catalog-generator-status" role="status">{status}</p>
      {result ? <div className="catalog-generator-results">
        <dl>
          <div><dt>{text('Candidates scanned', '走査候補')}</dt><dd>{result.scannedFiles}</dd></div>
          <div><dt>{text('Catalog items', 'Catalog項目')}</dt><dd>{result.items.length}</dd></div>
          <div><dt>{text('Excluded', '除外')}</dt><dd>{result.excluded.length}</dd></div>
          <div><dt>{text('Added / Removed / Changed', '追加 / 削除 / 変更')}</dt><dd>{result.diff.added.length} / {result.diff.removed.length} / {result.diff.changed.length}</dd></div>
        </dl>
        {result.excluded.length > 0 ? <details>
          <summary>{text('Excluded files and reasons', '除外ファイルと理由')} ({result.excluded.length})</summary>
          <ul>{result.excluded.map((entry) => <li key={entry.path}><code>{entry.path}</code>: {entry.result.errors.join(' ')}</li>)}</ul>
        </details> : null}
        {result.errors.length > 0 ? <details>
          <summary>{text('Generator errors', '生成エラー')} ({result.errors.length})</summary>
          <ul>{result.errors.map((error) => <li key={error}>{error}</li>)}</ul>
        </details> : null}
      </div> : null}
    </section>
  );
}

function roleLabel(role: CatalogDirectoryRole, language: 'en' | 'ja'): string {
  const labels: Record<CatalogDirectoryRole, [string, string]> = {
    character: ['External Character', '外部Character'],
    stage: ['External Stage', '外部Stage'],
    lifebar: ['External LifeBar', '外部LifeBar'],
    output: ['Catalog output', 'Catalog出力'],
  };
  return labels[role][language === 'ja' ? 1 : 0];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function normalizeServerPublicBase(path: string): string {
  return path.trim().replace(/\\/g, '/').replace(/\/+$/, '');
}

export function catalogApplyButtonFeedback(
  pendingChanges: boolean,
  saveState: CatalogSaveState,
  text: (english: string, japanese: string) => string,
): { label: string; tone: 'default' | 'saving' | 'saved' | 'error' } {
  if (saveState === 'server-saving' || saveState === 'local-saving') {
    return { label: text('Applying...', '反映中…'), tone: 'saving' };
  }
  if (!pendingChanges && (saveState === 'server-saved' || saveState === 'local-saved')) {
    return { label: text('✓ Applied to catalog.json', '✓ catalog.jsonに反映しました'), tone: 'saved' };
  }
  if (saveState === 'server-failed' || saveState === 'local-failed' || saveState === 'conflict') {
    return { label: text('Apply failed — check the message below', '反映に失敗しました ― 下のメッセージを確認'), tone: 'error' };
  }
  return { label: text('Apply draft to catalog.json', '下書きをcatalog.jsonに反映'), tone: 'default' };
}

function catalogDraftState(
  draftDirty: boolean,
  sourcesDirty: boolean,
  saveState: CatalogSaveState,
  text: (english: string, japanese: string) => string,
): { label: string; tone: 'neutral' | 'pending' | 'saved' | 'error' } {
  if (saveState === 'checking') return { label: text('Checking server...', 'サーバー確認中…'), tone: 'neutral' };
  if (saveState === 'server-saving') return { label: text('Saving to server...', 'サーバーへ保存中…'), tone: 'pending' };
  if (saveState === 'local-saving') return { label: text('Saving locally...', 'ローカルへ保存中…'), tone: 'pending' };
  if (saveState === 'conflict') return { label: text('Server conflict', 'サーバー更新と競合'), tone: 'error' };
  if (saveState === 'server-failed') return { label: text('Server save failed', 'サーバー保存失敗'), tone: 'error' };
  if (saveState === 'local-failed') return { label: text('Local save failed', 'ローカル保存失敗'), tone: 'error' };
  if (sourcesDirty) return { label: text('Selected sources not imported', '選択した入力が下書き未取込'), tone: 'pending' };
  if (draftDirty) return { label: text('Unapplied changes', '未反映の変更あり'), tone: 'pending' };
  if (saveState === 'server-saved') return { label: text('Server save succeeded', 'サーバー保存成功'), tone: 'saved' };
  if (saveState === 'local-saved') return { label: text('Applied to catalog.json', 'catalog.jsonへ反映済み'), tone: 'saved' };
  return { label: text('Same as loaded Catalog', '読込Catalogと同じ'), tone: 'neutral' };
}

function toDocument(catalog: ContentCatalog): ContentCatalogDocument {
  return {
    version: 1,
    items: catalog.entries.map(({ id, name, kind, engine, path, source }) => ({ id, name, kind, engine, path, ...(source ? { source } : {}) })),
  };
}
