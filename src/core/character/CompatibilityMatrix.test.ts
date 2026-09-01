import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('versioned compatibility Matrix', () => {
  it('keeps the canonical and delta rows in the seven-status model', () => {
    const output = execFileSync(process.execPath, ['scripts/compatibility-matrix.mjs'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    expect(output).toContain('WinMUGEN canonical: 467');
    expect(output).toContain('MUGEN 1.0 delta: 24');
    expect(output).toContain('MUGEN 1.1 delta: 24');

    const markdown = readFileSync('docs/webmugen/winmugen-compatibility-matrix.md', 'utf8');
    expect(markdown).toContain('- Complete: 102');
    expect(markdown).toContain('- Partial: 204');
    expect(markdown).toContain('- Fallback: 15');
    expect(markdown).toContain('- Safe no-op: 35');
    expect(markdown).toContain('- Issue ready: 0');
    expect(markdown).toContain('- Not started: 33');
    expect(markdown).toContain('- Audit needed: 58');
    expect(markdown).not.toMatch(/^\| [^|]+ \| (Partial|Unsupported|Untested) \| [^|]+ \|$/m);
  });

  it('renders three profile tabs from separate Markdown inventories', () => {
    const html = readFileSync('docs/webmugen/winmugen-compatibility-matrix.html', 'utf8');
    for (const status of ['complete', 'partial', 'fallback']) {
      expect(html).toContain(`${status}:{`);
    }
    for (const status of ['safe-noop', 'issue-ready', 'not-started', 'audit-needed', 'not-applicable']) {
      expect(html).toContain(`'${status}':{`);
    }
    expect(html).toContain("winmugen:{label:'WinMUGEN',source:'./winmugen-compatibility-matrix.md'");
    expect(html).toContain("mugen10:{label:'MUGEN 1.0',source:'./mugen10-compatibility-delta.md'");
    expect(html).toContain("mugen11:{label:'MUGEN 1.1',source:'./mugen11-compatibility-delta.md'");
    expect(html).toContain("activeProfile='winmugen'");
    expect(html).toContain('function selectProfile(');
    expect(html).toContain('const matrixCache=new Map()');
    expect(html).toContain('function kindOf(');
    expect(html).toContain('function parse(');
    expect(html).toContain('function render(');
    expect(html).toContain('function localizedText(');
    expect(html).toContain("values[requested]||values.en||''");
    expect(html).toContain('localizedText({ja:localizedRemarks[row[0]]?.ja||row[4],en:row[5]})');
    expect(html).toContain('class="progress"');
    expect(html).not.toMatch(/\b(?:stateRows|headerRows|controllerRows|triggerRows)\b/);
    expect(html).not.toContain('s-unsupported');
    expect(html).not.toContain('s-untested');

    const mugen10 = readFileSync('docs/webmugen/mugen10-compatibility-delta.md', 'utf8');
    const mugen11 = readFileSync('docs/webmugen/mugen11-compatibility-delta.md', 'utf8');
    expect(mugen10).toContain('only behavior introduced by or changed in MUGEN 1.0');
    expect(mugen10).toContain('| SFF v2.0 |');
    expect(mugen10).not.toContain('| 0 | Stand |');
    expect(mugen11).toContain('only behavior introduced by or changed in MUGEN 1.1');
    expect(mugen11).toContain('| SFF v2.01 |');
    expect(mugen11).not.toContain('| SFF v2.0 |');
  });
});
