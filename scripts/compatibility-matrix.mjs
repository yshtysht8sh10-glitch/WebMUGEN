import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';

export const STATUS_PATTERN = /^(Complete|Partial ([1-9]|[1-9][0-9])%|Fallback ([1-9]|[1-9][0-9])%|Safe no-op|Issue ready|Not started|Audit needed|Not applicable)$/;

export function splitMarkdownRow(line) {
  const cells = [];
  let cell = '';
  let code = false;
  for (let index = 1; index < line.length - 1; index += 1) {
    const char = line[index];
    if (char === '`') code = !code;
    if (char === '|' && !code) {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += char;
    }
  }
  cells.push(cell.trim());
  return cells;
}

export function parseMatrixMarkdown(markdown) {
  const sections = [];
  let section;
  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+)/);
    if (heading) {
      section = { title: heading[1], rows: [] };
      sections.push(section);
      continue;
    }
    if (!section || !line.startsWith('|') || /^\|[-: |]+\|$/.test(line)) continue;
    const cells = splitMarkdownRow(line);
    if (cells.length < 3) continue;
    const status = cells.at(-2);
    if (!STATUS_PATTERN.test(status)) continue;
    section.rows.push({ item: cells[0].replaceAll('`', ''), status, note: cells.at(-1) });
  }
  return sections.filter((entry) => entry.rows.length > 0);
}

export function validateMatrix(markdown) {
  const errors = [];
  const sections = parseMatrixMarkdown(markdown);
  const rows = sections.flatMap((section) => section.rows.map((row) => ({ ...row, section: section.title })));
  const seen = new Set();
  for (const row of rows) {
    const key = `${row.section}\0${row.item.toLowerCase()}`;
    if (seen.has(key)) errors.push(`duplicate row: ${row.section} / ${row.item}`);
    seen.add(key);
    if (/^(Partial|Fallback)/.test(row.status) && !/^Implemented:.*Missing:.*Evidence:/i.test(row.note)) {
      errors.push(`incomplete evidence note: ${row.section} / ${row.item}`);
    }
    if (row.status === 'Issue ready' && !/#\d+/.test(row.note)) errors.push(`Issue ready without issue: ${row.item}`);
    if (row.status === 'Safe no-op' && !/without changing game state/i.test(row.note)) errors.push(`ambiguous safe no-op: ${row.item}`);
  }
  return { errors, sections, rows };
}

function statusLabel(detail) {
  if (detail.kind === 'complete') return 'Complete';
  if (detail.kind === 'partial') return `Partial ${detail.progress}%`;
  if (detail.kind === 'fallback') return `Fallback ${detail.progress}%`;
  if (detail.kind === 'safe-noop') return 'Safe no-op';
  if (detail.kind === 'issue-ready') return 'Issue ready';
  if (detail.kind === 'not-started') return 'Not started';
  if (detail.kind === 'not-applicable') return 'Not applicable';
  return 'Audit needed';
}

async function loadHtmlModel(htmlPath) {
  const html = await readFile(htmlPath, 'utf8');
  const source = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  if (!source) throw new Error('Matrix HTML script was not found.');
  const modelSource = `${source.slice(0, source.indexOf("let lang='ja'"))}\nglobalThis.model = { classify: matrixStatus, sections };`;
  const context = {};
  vm.createContext(context);
  vm.runInContext(modelSource, context);
  return context.model;
}

function updateSummary(markdown) {
  const { rows } = validateMatrix(markdown);
  const order = ['Complete', 'Partial', 'Fallback', 'Safe no-op', 'Issue ready', 'Not started', 'Audit needed', 'Not applicable'];
  const counts = Object.fromEntries(order.map((key) => [key, 0]));
  for (const row of rows) counts[row.status.replace(/ \d+%$/, '')] += 1;
  const summary = `<!-- status-summary:start -->\n${order.map((key) => `- ${key}: ${counts[key]}`).join('\n')}\n<!-- status-summary:end -->`;
  return markdown.replace(/<!-- status-summary:start -->[\s\S]*?<!-- status-summary:end -->/, summary);
}

export async function refineLegacyMarkdown(markdown, htmlPath) {
  const { classify } = await loadHtmlModel(htmlPath);
  const lines = markdown.split(/\r?\n/);
  const output = lines.map((line) => {
    if (!line.startsWith('|') || /^\|[-: |]+\|$/.test(line)) return line;
    const cells = splitMarkdownRow(line);
    const legacy = cells.at(-2);
    if (!['Complete', 'Partial', 'Unsupported', 'Untested'].includes(legacy)) return line;
    const item = cells[0].replaceAll('`', '');
    const detail = classify(item, legacy.toLowerCase(), cells.at(-1));
    cells[cells.length - 2] = statusLabel(detail);
    cells[cells.length - 1] = detail.note;
    return `| ${cells.join(' | ')} |`;
  });
  return updateSummary(output.join('\n'));
}

async function main() {
  const root = new URL('../', import.meta.url);
  const markdownPath = new URL('docs/webmugen/winmugen-compatibility-matrix.md', root);
  const htmlPath = new URL('docs/webmugen/winmugen-compatibility-matrix.html', root);
  let markdown = await readFile(markdownPath, 'utf8');
  if (process.argv.includes('--write')) {
    markdown = await refineLegacyMarkdown(markdown, htmlPath);
    await writeFile(markdownPath, markdown, 'utf8');
  }
  const { errors, rows } = validateMatrix(markdown);
  if (rows.length === 0) errors.push('no Matrix rows parsed');
  const { sections: htmlSections } = await loadHtmlModel(htmlPath);
  const markdownSections = parseMatrixMarkdown(markdown);
  if (htmlSections.length !== markdownSections.length) errors.push(`section count differs: HTML ${htmlSections.length}, Markdown ${markdownSections.length}`);
  for (let sectionIndex = 0; sectionIndex < Math.min(htmlSections.length, markdownSections.length); sectionIndex += 1) {
    const htmlRows = htmlSections[sectionIndex].rows;
    const markdownRows = markdownSections[sectionIndex].rows;
    if (htmlRows.length !== markdownRows.length) errors.push(`row count differs in section ${sectionIndex}: HTML ${htmlRows.length}, Markdown ${markdownRows.length}`);
    const markdownByItem = new Map(markdownRows.map((row) => [row.item, row]));
    for (const htmlRow of htmlRows) {
      const markdownRow = markdownByItem.get(htmlRow[0]);
      const htmlStatus = statusLabel({ kind: htmlRow[3], progress: htmlRow[6] });
      if (!markdownRow || htmlStatus !== markdownRow.status) {
        errors.push(`mirror mismatch in section ${sectionIndex}: HTML ${htmlRow[0]} / ${htmlStatus}, Markdown ${markdownRow?.item ?? 'missing'} / ${markdownRow?.status ?? 'missing'}`);
      }
    }
  }
  if (errors.length > 0) throw new Error(errors.join('\n'));
  console.log(`Compatibility Matrix: ${rows.length} rows validated.`);
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/scripts/compatibility-matrix.mjs')) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
