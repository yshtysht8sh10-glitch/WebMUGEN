import type { WebMugenLifeBarDefinition } from './WebMugenLifeBarSchema';
import { isSafeSameOriginContentPath } from '../../app/ApplicationAssetPath';

export async function loadWebMugenLifeBar(
  path: string,
  fetcher: (input: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }> = fetch,
): Promise<WebMugenLifeBarDefinition> {
  if (!isSafeSameOriginContentPath(path, ['lifebars/webmugen', 'content'], ['.json'])) {
    throw new Error('WebMUGEN lifebar loader accepts only same-origin /lifebars/webmugen/ or /content/ JSON content.');
  }
  const response = await fetcher(path);
  if (!response.ok) throw new Error(`WebMUGEN lifebar request failed: HTTP ${response.status}`);
  return parseWebMugenLifeBar(await response.json(), path);
}

export function parseWebMugenLifeBar(value: unknown, sourcePath = '/lifebars/webmugen/lifebar.json'): WebMugenLifeBarDefinition {
  if (!isRecord(value) || value.format !== 'webmugen-lifebar' || value.version !== 1 || value.layout !== 'responsive') {
    throw new Error('Not a WebMUGEN responsive lifebar v1 document.');
  }
  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(id) || !name) throw new Error('Invalid WebMUGEN lifebar identity.');
  const show = isRecord(value.show) ? value.show : {};
  const palette = isRecord(value.palette) ? value.palette : {};
  return {
    format: 'webmugen-lifebar', version: 1, id, name, layout: 'responsive', sourcePath,
    show: { life: show.life !== false, power: show.power !== false, timer: show.timer !== false, round: show.round !== false, wins: show.wins !== false },
    palette: {
      panel: color(palette.panel, '#020817'), life: color(palette.life, '#22d3ee'), danger: color(palette.danger, '#fb7185'),
      power: color(palette.power, '#c026d3'), accent: color(palette.accent, '#67e8f9'), text: color(palette.text, '#ecfeff'),
    },
  };
}

function color(value: unknown, fallback: string): string { return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback; }
function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
