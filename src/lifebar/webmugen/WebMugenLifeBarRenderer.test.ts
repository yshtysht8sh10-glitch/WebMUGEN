import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createInitialGameState } from '../../core/engine/GameState';
import { createInitialRoundState } from '../../core/engine/RoundState';
import { createInitialRoundScore } from '../../core/engine/RoundScore';
import { parseWebMugenLifeBar } from './WebMugenLifeBarLoader';
import { WebMugenLifeBarRenderer } from './WebMugenLifeBarRenderer';

describe('Fresh WebMUGEN LifeBar readability', () => {
  it('uses high-contrast text and panels behind timer, round, and win labels', () => {
    const definition = parseWebMugenLifeBar(JSON.parse(readFileSync(
      resolve('public/lifebars/webmugen/default-cyber/fresh-lifebar.json'),
      'utf8',
    )));
    const textDraws: Array<{ text: string; color: string }> = [];
    const fillRect = vi.fn();
    const context = {
      fillStyle: '', strokeStyle: '', font: '', textAlign: '', textBaseline: '',
      fillRect,
      strokeRect: vi.fn(),
      fillText(this: { fillStyle: string }, text: string) { textDraws.push({ text, color: this.fillStyle }); },
    } as unknown as CanvasRenderingContext2D;

    new WebMugenLifeBarRenderer().renderBehindPlayers(definition, {
      ctx: context,
      state: createInitialGameState(),
      roundState: createInitialRoundState(),
      roundScore: createInitialRoundScore(),
      viewportWidth: 640,
      diagnosticsEnabled: false,
    });

    expect(definition.palette.text).toBe('#f8fafc');
    const labels = textDraws.filter((draw) => /^(?:\d+|ROUND|P[12] WINS)/.test(draw.text));
    expect(labels.length).toBeGreaterThanOrEqual(4);
    expect(new Set(labels.map((draw) => draw.color))).toEqual(new Set(['#f8fafc']));
    expect(fillRect.mock.calls.filter((call) => call[1] === 52 && call[2] === 104 && call[3] === 18)).toHaveLength(2);
    expect(fillRect).toHaveBeenCalledWith(274, 10, 92, 52);
  });
});
