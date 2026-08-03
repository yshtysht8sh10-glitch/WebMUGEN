import { useEffect, useState } from 'react';
import { useUiLanguage } from '../../app/UiLanguage';
import type { ContentCatalog, ContentCatalogDocument } from '../catalog/ContentCatalogTypes';
import { loadCatalogDirectoryHandle, saveCatalogDirectoryHandle } from './CatalogDirectoryStore';
import { generateContentCatalog } from './CatalogGenerator';
import type { CatalogDirectoryHandle, CatalogGeneratorResult } from './CatalogGeneratorTypes';
import { readCatalogSourceFiles } from './LocalFolderCatalogSource';
import { downloadCatalogJson, ensureDirectoryPermission, writeCatalogToDirectory } from './CatalogWriter';

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<CatalogDirectoryHandle>;
};

export function CatalogGeneratorPanel({ catalog }: { catalog: ContentCatalog }) {
  const { text } = useUiLanguage();
  const [savedDirectory, setSavedDirectory] = useState<CatalogDirectoryHandle | null>(null);
  const [result, setResult] = useState<CatalogGeneratorResult | null>(null);
  const [status, setStatus] = useState(text('Choose a content folder to generate catalog.json.', 'コンテンツフォルダを選択してcatalog.jsonを生成します。'));
  const [busy, setBusy] = useState(false);
  const pickerSupported = typeof window !== 'undefined' && typeof (window as DirectoryPickerWindow).showDirectoryPicker === 'function';

  useEffect(() => {
    let active = true;
    void loadCatalogDirectoryHandle().then(async (handle) => {
      if (!active || !handle) return;
      const permitted = await ensureDirectoryPermission(handle, 'read');
      if (active && permitted) setSavedDirectory(handle);
      else if (active) setStatus(text('Saved folder permission expired. Select the folder again.', '保存済みフォルダの権限が失効しました。再選択してください。'));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [text]);

  const generateFrom = async (directory: CatalogDirectoryHandle) => {
    setBusy(true);
    setStatus(text('Scanning folder and classifying content...', 'フォルダを走査してコンテンツを判定しています…'));
    try {
      if (!await ensureDirectoryPermission(directory, 'read')) throw new Error('Folder read permission was not granted.');
      const files = await readCatalogSourceFiles(directory);
      const generated = generateContentCatalog(files, toDocument(catalog));
      setSavedDirectory(directory);
      setResult(generated);
      await saveCatalogDirectoryHandle(directory).catch(() => false);
      setStatus(text(
        `Scan completed: ${generated.items.length} valid, ${generated.excluded.length} excluded.`,
        `走査完了: ${generated.items.length}件有効、${generated.excluded.length}件除外。`,
      ));
    } catch (error) {
      setStatus(text('Catalog generation failed: ', 'Catalog生成に失敗しました: ') + (error instanceof Error ? error.message : String(error)));
    } finally {
      setBusy(false);
    }
  };

  const chooseFolder = async () => {
    const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
    if (!picker) {
      setStatus(text('This browser does not support folder selection.', 'このブラウザはフォルダ選択に対応していません。'));
      return;
    }
    try {
      await generateFrom(await picker({ mode: 'readwrite' }));
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setStatus(text('Folder selection failed: ', 'フォルダ選択に失敗しました: ') + (error instanceof Error ? error.message : String(error)));
    }
  };

  const writeCatalog = async () => {
    if (!savedDirectory || !result) return;
    setBusy(true);
    try {
      const outcome = await writeCatalogToDirectory(savedDirectory, result.catalog);
      if (outcome === 'written') setStatus(text('catalog.json was written to the selected folder.', '選択したフォルダへcatalog.jsonを書き込みました。'));
      else setStatus(text('Write permission is unavailable. Download catalog.json instead.', '書込権限がありません。catalog.jsonをダウンロードしてください。'));
    } catch (error) {
      setStatus(text('Catalog write failed: ', 'Catalog書込に失敗しました: ') + (error instanceof Error ? error.message : String(error)));
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
            'Development tool: scan a local folder and create catalog.json. The game runtime never scans this folder.',
            '開発用ツールです。ローカルフォルダを走査してcatalog.jsonを生成します。ゲームRuntimeはフォルダを走査しません。',
          )}</p>
        </div>
      </div>
      <div className="catalog-generator-actions">
        <button disabled={busy || !pickerSupported} onClick={() => void chooseFolder()} type="button">
          {text('Choose folder and generate', 'フォルダからCatalogを生成')}
        </button>
        {savedDirectory ? <button disabled={busy} onClick={() => void generateFrom(savedDirectory)} type="button">
          {text('Rescan saved folder', '保存済みフォルダを再走査')}
        </button> : null}
        <button disabled={busy || !result || !savedDirectory} onClick={() => void writeCatalog()} type="button">
          {text('Write catalog.json', 'catalog.jsonを書き戻す')}
        </button>
        <button disabled={!result} onClick={() => result && downloadCatalogJson(result.catalog)} type="button">
          {text('Download catalog.json', 'catalog.jsonをダウンロード')}
        </button>
      </div>
      {!pickerSupported ? <p className="catalog-generator-warning">{text(
        'Folder selection is not supported in this browser. Use a Chromium-based browser or generate the Catalog with a server/CLI tool.',
        'このブラウザはフォルダ選択に対応していません。Chromium系ブラウザ、またはサーバー／CLIツールでCatalogを生成してください。',
      )}</p> : null}
      <p className="catalog-generator-status" role="status">{status}</p>
      {result ? <div className="catalog-generator-results">
        <dl>
          <div><dt>{text('Candidates scanned', '走査候補')}</dt><dd>{result.scannedFiles}</dd></div>
          <div><dt>{text('Valid items', '有効')}</dt><dd>{result.items.length}</dd></div>
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

function toDocument(catalog: ContentCatalog): ContentCatalogDocument {
  return {
    version: 1,
    items: catalog.entries.map(({ id, name, kind, engine, path }) => ({ id, name, kind, engine, path })),
  };
}
