import { readFile, writeFile } from 'node:fs/promises';

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

export function validateMatrixHtml(html) {
  const errors = [];
  const statusKeys = [
    'complete',
    'partial',
    'fallback',
    'safe-noop',
    'issue-ready',
    'not-started',
    'audit-needed',
    'not-applicable',
  ];
  for (const key of statusKeys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!new RegExp(`(?:["']${escaped}["']|\\b${escaped})\\s*:`).test(html)) {
      errors.push(`HTML status definition is missing: ${key}`);
    }
  }
  if (!/fetch\(\s*['"]\.\/winmugen-compatibility-matrix\.md['"]/.test(html)) {
    errors.push('HTML does not fetch the Markdown Matrix inventory.');
  }
  if (!html.includes('sections=parse(md)')) errors.push('HTML does not parse fetched Markdown into sections.');
  for (const functionName of ['splitRow', 'kindOf', 'parse', 'render', 'setLang', 'init']) {
    if (!html.includes(`function ${functionName}(`)) errors.push(`HTML runtime function is missing: ${functionName}`);
  }
  if (/\b(?:stateRows|headerRows|controllerRows|triggerRows)\b/.test(html)) {
    errors.push('HTML still embeds legacy Matrix row inventories.');
  }
  return errors;
}

function updateSummary(markdown) {
  const { rows } = validateMatrix(markdown);
  const order = ['Complete', 'Partial', 'Fallback', 'Safe no-op', 'Issue ready', 'Not started', 'Audit needed', 'Not applicable'];
  const counts = Object.fromEntries(order.map((key) => [key, 0]));
  for (const row of rows) counts[row.status.replace(/ \d+%$/, '')] += 1;
  const summary = `<!-- status-summary:start -->\n${order.map((key) => `- ${key}: ${counts[key]}`).join('\n')}\n<!-- status-summary:end -->`;
  return markdown.replace(/<!-- status-summary:start -->[\s\S]*?<!-- status-summary:end -->/, summary);
}

async function main() {
  const root = new URL('../', import.meta.url);
  const markdownPath = new URL('docs/webmugen/winmugen-compatibility-matrix.md', root);
  const htmlPath = new URL('docs/webmugen/winmugen-compatibility-matrix.html', root);
  let markdown = await readFile(markdownPath, 'utf8');
  if (process.argv.includes('--write')) {
    markdown = updateSummary(markdown);
    await writeFile(markdownPath, markdown, 'utf8');
  }
  const { errors, rows } = validateMatrix(markdown);
  if (rows.length === 0) errors.push('no Matrix rows parsed');
  const html = await readFile(htmlPath, 'utf8');
  errors.push(...validateMatrixHtml(html));
  if (errors.length > 0) throw new Error(errors.join('\n'));
  console.log(`Compatibility Matrix: ${rows.length} rows validated.`);
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/scripts/compatibility-matrix.mjs')) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
