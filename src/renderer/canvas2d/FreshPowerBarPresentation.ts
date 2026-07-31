import { CanvasRenderer } from './CanvasRenderer';
import type { GameState } from '../../core/engine/types';
import type { HudTheme } from '../../app/RuntimeSettings';

type PowerBarDraw = (
  ctx: CanvasRenderingContext2D,
  state: GameState,
  diagnosticsEnabled: boolean,
  viewportWidth?: number,
  theme?: HudTheme,
) => string[];

type PatchableRenderer = {
  drawPowerBars: PowerBarDraw;
};

const prototype = CanvasRenderer.prototype as unknown as PatchableRenderer;
const originalDrawPowerBars = prototype.drawPowerBars;

prototype.drawPowerBars = function drawPolishedPowerBars(
  ctx,
  state,
  diagnosticsEnabled,
  viewportWidth = 640,
  theme = 'fresh',
): string[] {
  if (theme !== 'fresh') {
    return originalDrawPowerBars.call(this, ctx, state, diagnosticsEnabled, viewportWidth, theme);
  }

  const [p1, p2] = state.players;
  const leftX = 18 + (viewportWidth - 640) / 2;
  const rightX = 488 + (viewportWidth - 640) / 2;
  const y = 39;
  const width = 134;
  const height = 14;
  const p1Ratio = clamp01((p1.power ?? 0) / Math.max(1, p1.powerMax ?? 3000));
  const p2Ratio = clamp01((p2.power ?? 0) / Math.max(1, p2.powerMax ?? 3000));

  drawPowerBar(ctx, leftX, y, width, height, p1Ratio, 'left');
  drawPowerBar(ctx, rightX, y, width, height, p2Ratio, 'right');

  ctx.save();
  ctx.fillStyle = '#f7fbff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  if (p1.infinitePower) ctx.fillText('∞', leftX + width + 7, y + height / 2);
  ctx.textAlign = 'right';
  if (p2.infinitePower) ctx.fillText('∞', rightX - 7, y + height / 2);
  ctx.restore();

  return originalDrawPowerBars.call(this, ctx, state, diagnosticsEnabled, viewportWidth, theme)
    .filter((line) => line.startsWith('raw.power'));
};

function drawPowerBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  ratio: number,
  direction: 'left' | 'right',
): void {
  ctx.save();

  ctx.fillStyle = 'rgba(2, 10, 22, 0.42)';
  roundedRect(ctx, x + 2, y + 3, width, height, 4);
  ctx.fill();

  ctx.fillStyle = verticalGradient(ctx, y, y + height, '#edf7ff', '#60758c');
  roundedRect(ctx, x, y, width, height, 4);
  ctx.fill();

  ctx.fillStyle = '#10243a';
  roundedRect(ctx, x + 2, y + 2, width - 4, height - 4, 3);
  ctx.fill();

  const innerX = x + 4;
  const innerY = y + 4;
  const innerWidth = width - 8;
  const innerHeight = height - 8;
  ctx.fillStyle = verticalGradient(ctx, innerY, innerY + innerHeight, '#17324e', '#071422');
  roundedRect(ctx, innerX, innerY, innerWidth, innerHeight, 2);
  ctx.fill();

  const fillWidth = innerWidth * ratio;
  const fillX = direction === 'left' ? innerX : innerX + innerWidth - fillWidth;
  if (fillWidth > 0) {
    ctx.save();
    roundedRect(ctx, innerX, innerY, innerWidth, innerHeight, 2);
    ctx.clip();
    ctx.fillStyle = verticalGradient(ctx, innerY, innerY + innerHeight, '#7ce7ff', '#199bd8');
    ctx.fillRect(fillX, innerY, fillWidth, innerHeight);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.fillRect(fillX, innerY, fillWidth, Math.max(1, innerHeight * 0.35));
    ctx.restore();
  }

  ctx.strokeStyle = 'rgba(4, 16, 30, 0.28)';
  ctx.lineWidth = 1;
  for (let segment = 1; segment < 6; segment += 1) {
    const segmentX = innerX + innerWidth * segment / 6;
    ctx.beginPath();
    ctx.moveTo(segmentX, innerY);
    ctx.lineTo(segmentX, innerY + innerHeight);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(224, 243, 255, 0.72)';
  roundedRect(ctx, x + 0.5, y + 0.5, width - 1, height - 1, 4);
  ctx.stroke();
  ctx.restore();
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    return;
  }
  ctx.beginPath();
  ctx.rect(x, y, width, height);
}

function verticalGradient(
  ctx: CanvasRenderingContext2D,
  y0: number,
  y1: number,
  start: string,
  end: string,
): CanvasGradient | string {
  if (typeof ctx.createLinearGradient !== 'function') return start;
  const gradient = ctx.createLinearGradient(0, y0, 0, y1);
  gradient.addColorStop(0, start);
  gradient.addColorStop(1, end);
  return gradient;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
