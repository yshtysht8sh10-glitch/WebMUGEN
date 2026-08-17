import { useEffect, useState } from 'react';
import { useUiLanguage } from '../../app/UiLanguage';
import type { ContentCatalog, ContentCatalogDocument, ContentKind } from '../catalog/ContentCatalogTypes';
import { loadCatalogDirectoryHandle, saveCatalogDirectoryHandle } from './CatalogDirectoryStore';
import { generateContentCatalog, resolveCatalogDirectPath, resolveCatalogPublicPath } from './CatalogGenerator';
import type { CatalogDirectoryHandle, CatalogDirectoryRole, CatalogGeneratorResult, CatalogSourceFile } from './CatalogGeneratorTypes';
import { readCatalogSourceFiles, readCatalogSourcePath } from './LocalFolderCatalogSource';
import { downloadCatalogJson, ensureDirectoryPermission, writeCatalogToDirectory } from './CatalogWriter';

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<CatalogDirectoryHandle>;
};

const SOURCE_KINDS: ContentKind[] = ['character', 'stage', 'lifebar'];
const DEFAULT_PUBLIC_BASES: Record<ContentKind, string> = {
  character: '/chars',
  stage: '/stages',
  lifebar: '/lifebars',
};

export function CatalogGeneratorPanel({ catalog }: { catalog: ContentCatalog }) {
  const { text } = useUiLanguage();
  const [directories, setDirectories] = useState<Partial<Record<CatalogDirectoryRole, CatalogDirectoryHandle>>>({});
  const [publicBases, setPublicBases] = useState(DEFAULT_PUBLIC_BASES);
  const [directDrafts, setDirectDrafts] = useState<Record<ContentKind, string>>({ character: '', stage: '', lifebar: '' });
  const [directPaths, setDirectPaths] = useState<Record<ContentKind, string[]>>({ character: [], stage: [], lifebar: [] });
  const [result, setResult] = useState<CatalogGeneratorResult | null>(null);
  const [status, setStatus] = useState(text('Choose source folders or add direct paths, then generate catalog.json.', '入力フォルダを選択するかファイルパスを追加して、catalog.jsonを生成します。'));
  const [busy, setBusy] = useState(false);
  const pickerSupported = typeof window !== 'undefined' && typeof (window as DirectoryPickerWindow).showDirectoryPicker === 'function';

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
      await saveCatalogDirectoryHandle(handle, role).catch(() => false);
      setStatus(text(`${roleLabel(role, 'en')} folder selected: ${handle.name}.`, `${roleLabel(role, 'ja')}フォルダを選択しました: ${handle.name}`));
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
  };

  const generate = async () => {
    setBusy(true);
    setStatus(text('Scanning the three sources and validating direct paths...', '3種の入力元を走査し、直接指定パスを検証しています…'));
    try {
      const files: CatalogSourceFile[] = [];
      for (const kind of SOURCE_KINDS) {
        const directory = directories[kind];
        if (directory) {
          if (!await ensureDirectoryPermission(directory, 'read')) throw new Error(`${roleLabel(kind, 'en')} folder permission was not granted.`);
          const scanned = await readCatalogSourceFiles(directory);
          files.push(...scanned.map((file) => ({
            ...file,
            expectedKind: kind,
            catalogPath: resolveCatalogPublicPath(publicBases[kind], file.path),
          })));
        }
        for (const path of directPaths[kind]) {
          files.push({
            ...await readCatalogSourcePath(resolveCatalogDirectPath(publicBases[kind], path)),
            expectedKind: kind,
          });
        }
      }
      const preserved = catalog.entries.filter((entry) => (
        entry.source === 'builtin'
        || entry.path.startsWith('builtin:')
        || (!directories[entry.kind] && directPaths[entry.kind].length === 0)
      ));
      const generated = generateContentCatalog(files, toDocument(catalog), preserved);
      setResult(generated);
      setStatus(text(
        `Generation completed: ${generated.items.length} total, ${generated.excluded.length} excluded.`,
        `生成完了: 内蔵を含む${generated.items.length}件、${generated.excluded.length}件除外。`,
      ));
    } catch (error) {
      setStatus(text('Catalog generation failed: ', 'Catalog生成に失敗しました: ') + errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const writeCatalog = async () => {
    const output = directories.output;
    if (!output || !result) return;
    setBusy(true);
    try {
      const outcome = await writeCatalogToDirectory(output, result.catalog);
      setStatus(outcome === 'written'
        ? text('catalog.json was written to the Catalog output folder.', 'Catalog出力フォルダへcatalog.jsonを書き込みました。')
        : text('Write permission is unavailable. Download catalog.json instead.', '書込権限がありません。catalog.jsonをダウンロードしてください。'));
    } catch (error) {
      setStatus(text('Catalog write failed: ', 'Catalog書込に失敗しました: ') + errorMessage(error));
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
            'Choose separate external Character, Stage, and LifeBar sources. Built-in WebMUGEN items are retained in the generated Catalog.',
            '外部Character・Stage・LifeBarの入力元を個別に指定します。WebMUGEN内蔵項目は生成Catalogに保持されます。',
          )}</p>
        </div>
      </div>

      <div className="catalog-source-grid">
        {SOURCE_KINDS.map((kind) => <section className="catalog-source-card" key={kind}>
          <h4>{text(roleLabel(kind, 'en'), roleLabel(kind, 'ja'))}</h4>
          <p>{directories[kind]
            ? text(`Selected folder: ${directories[kind]!.name}`, `選択中: ${directories[kind]!.name}`)
            : text('No external folder selected.', '外部フォルダ未選択')}</p>
          <button disabled={busy || !pickerSupported} onClick={() => void chooseFolder(kind)} type="button">
            {text('Choose folder', 'フォルダを選択')}
          </button>
          <label>
            <span>{text('Published URL base', '配信URLの基点')}</span>
            <input aria-label={`${kind} public URL base`} value={publicBases[kind]} onChange={(event) => {
              const value = event.currentTarget.value;
              setPublicBases((current) => ({ ...current, [kind]: value }));
              setResult(null);
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
            }} type="button">×</button>
          </li>)}</ul> : null}
        </section>)}
      </div>

      <section className="catalog-output-card">
        <div>
          <h4>{text('Catalog output folder', 'Catalog出力フォルダ')}</h4>
          <p>{directories.output
            ? text(`Selected folder: ${directories.output.name}`, `選択中: ${directories.output.name}`)
            : text('Optional. Without it, use the download button.', '任意です。未指定の場合はダウンロードを使用します。')}</p>
        </div>
        <button disabled={busy || !pickerSupported} onClick={() => void chooseFolder('output')} type="button">{text('Choose output folder', '出力フォルダを選択')}</button>
      </section>

      <div className="catalog-generator-actions">
        <button disabled={busy} onClick={() => void generate()} type="button">{text('Generate Catalog', 'Catalogを生成')}</button>
        <button disabled={busy || !result || !directories.output} onClick={() => void writeCatalog()} type="button">{text('Write catalog.json', 'catalog.jsonを書き戻す')}</button>
        <button disabled={!result} onClick={() => result && downloadCatalogJson(result.catalog)} type="button">{text('Download catalog.json', 'catalog.jsonをダウンロード')}</button>
      </div>
      {!pickerSupported ? <p className="catalog-generator-warning">{text(
        'Folder selection is not supported in this browser. Direct same-origin file paths and Catalog download remain available.',
        'このブラウザはフォルダ選択に対応していません。同一オリジンの直接ファイル指定とCatalogダウンロードは利用できます。',
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

function toDocument(catalog: ContentCatalog): ContentCatalogDocument {
  return {
    version: 1,
    items: catalog.entries.map(({ id, name, kind, engine, path, source }) => ({ id, name, kind, engine, path, ...(source ? { source } : {}) })),
  };
}
