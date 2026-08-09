import type { LifeBarRenderContext } from '../LifeBarRuntime';
import type { WebMugenLifeBarDefinition } from './WebMugenLifeBarSchema';

export class WebMugenLifeBarRenderer {
  private lastPowerSignature = '';

  renderBehindPlayers(definition: WebMugenLifeBarDefinition, context: LifeBarRenderContext): string[] {
    const { ctx, state, roundState, roundScore, viewportWidth } = context;
    const [p1, p2] = state.players;
    const center = viewportWidth / 2;
    const width = Math.min(250, Math.max(120, viewportWidth * 0.39));
    const gap = Math.max(76, viewportWidth * 0.12);
    const left = center - gap / 2 - width;
    const right = center + gap / 2;
    if (definition.show.life) {
      drawGauge(ctx, left, 14, width, 18, clamp01(p1.life / 1000), 'left', definition.palette, true);
      drawGauge(ctx, right, 14, width, 18, clamp01(p2.life / 1000), 'right', definition.palette, true);
    }
    if (definition.show.power) {
      drawGauge(ctx, left, 38, Math.min(134, width), 11, clamp01((p1.power ?? 0) / Math.max(1, p1.powerMax ?? 3000)), 'left', definition.palette, false);
      drawGauge(ctx, right + width - Math.min(134, width), 38, Math.min(134, width), 11, clamp01((p2.power ?? 0) / Math.max(1, p2.powerMax ?? 3000)), 'right', definition.palette, false);
      ctx.fillStyle = definition.palette.text;
      ctx.font = 'bold 11px sans-serif';
      if (p1.infinitePower) ctx.fillText('∞', left + Math.min(134, width) + 8, 47);
      if (p2.infinitePower) ctx.fillText('∞', right + width - Math.min(134, width) - 16, 47);
    }
    if (roundState && (definition.show.timer || definition.show.round)) {
      ctx.fillStyle = definition.palette.panel;
      ctx.fillRect(center - 46, 10, 92, 52);
      ctx.strokeStyle = definition.palette.accent;
      ctx.strokeRect(center - 46.5, 9.5, 93, 53);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = definition.palette.text;
      if (definition.show.timer) { ctx.font = '800 25px sans-serif'; ctx.fillText(String(roundState.timer).padStart(2, '0'), center, 28); }
      if (definition.show.round) { ctx.font = '700 11px sans-serif'; ctx.fillText(`ROUND ${roundState.roundNo}`, center, 54); }
    }
    if (roundScore && definition.show.wins) {
      ctx.fillStyle = definition.palette.panel;
      ctx.fillRect(left, 52, 104, 18);
      ctx.fillRect(right + width - 104, 52, 104, 18);
      ctx.fillStyle = definition.palette.text; ctx.font = '700 11px sans-serif';
      ctx.textAlign = 'left'; ctx.fillText(`P1 WINS ${roundScore.p1Wins}`, left, 64);
      ctx.textAlign = 'right'; ctx.fillText(`P2 WINS ${roundScore.p2Wins}`, right + width, 64);
    }
    if (!context.diagnosticsEnabled || !definition.show.power) return [];
    const signature = `${p1.power}/${p1.powerMax}|${p2.power}/${p2.powerMax}|${p1.infinitePower ? 1 : 0}${p2.infinitePower ? 1 : 0}`;
    if (signature === this.lastPowerSignature) return [];
    this.lastPowerSignature = signature;
    return [`raw.power_hud p1=${p1.power ?? 0}/${p1.powerMax ?? 3000} p2=${p2.power ?? 0}/${p2.powerMax ?? 3000} infinite=${p1.infinitePower && p2.infinitePower ? 'both' : p1.infinitePower ? 'p1' : p2.infinitePower ? 'p2' : 'off'}`];
  }

  renderForeground(definition: WebMugenLifeBarDefinition, context: LifeBarRenderContext): void {
    const round = context.roundState;
    if (!round || (round.phase !== 'intro' && round.phase !== 'ko' && round.phase !== 'timeOver')) return;
    if (round.phase === 'intro' && round.introPresentationFrame === null) return;
    const { ctx, viewportWidth } = context;
    const text = round.phase === 'intro'
      ? round.introPresentationFrame! < 45 ? `ROUND ${round.roundNo}` : 'FIGHT!'
      : round.phase === 'ko' ? 'K.O.' : 'TIME OVER';
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(viewportWidth / 2 - 150, 186, 300, 92);
    ctx.fillStyle = definition.palette.text; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 42px sans-serif'; ctx.fillText(text, viewportWidth / 2, 238);
  }
}

function drawGauge(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, ratio: number, direction: 'left' | 'right', palette: WebMugenLifeBarDefinition['palette'], life: boolean): void {
  ctx.fillStyle = palette.panel; ctx.fillRect(x, y, width, height);
  const inner = Math.max(0, (width - 6) * ratio); const fillX = direction === 'left' ? x + 3 : x + width - 3 - inner;
  ctx.fillStyle = life ? (ratio < 0.3 ? palette.danger : palette.life) : palette.power;
  ctx.fillRect(fillX, y + 3, inner, height - 6); ctx.strokeStyle = palette.accent; ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
}
function clamp01(value: number): number { return Math.max(0, Math.min(1, value)); }
