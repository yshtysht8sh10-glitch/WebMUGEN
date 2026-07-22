import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('WinMUGEN compatibility Matrix', () => {
  it('keeps every row in the canonical seven-status model', () => {
    const output = execFileSync(process.execPath, ['scripts/compatibility-matrix.mjs'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    expect(output).toContain('446 rows validated');

    const markdown = readFileSync('docs/webmugen/winmugen-compatibility-matrix.md', 'utf8');
    expect(markdown).toContain('- Complete: 101');
    expect(markdown).toContain('- Partial: 204');
    expect(markdown).toContain('- Fallback: 15');
    expect(markdown).toContain('- Safe no-op: 35');
    expect(markdown).toContain('- Issue ready: 0');
    expect(markdown).toContain('- Not started: 33');
    expect(markdown).toContain('- Audit needed: 58');
    expect(markdown).not.toMatch(/^\| [^|]+ \| (Partial|Unsupported|Untested) \| [^|]+ \|$/m);
  });

  it('renders the Markdown mirror with matching detailed badges and filters', () => {
    const html = readFileSync('docs/webmugen/winmugen-compatibility-matrix.html', 'utf8');
    for (const status of ['complete', 'partial', 'fallback', 'safe-noop', 'issue-ready', 'not-started', 'audit-needed']) {
      expect(html).toContain(`value="${status}"`);
    }
    expect(html).toContain("fetch('./winmugen-compatibility-matrix.md')");
    expect(html).toContain("if(parsed.length!==8)");
    expect(html).toContain('class="progress"');
    expect(html).not.toContain('s-unsupported');
    expect(html).not.toContain('s-untested');
  });
});
