import { CanvasRenderer } from './CanvasRenderer';
import type { GameState } from '../../core/engine/types';
import type { HudTheme } from '../../app/RuntimeSettings';

type LifeBarDraw = (
  ctx: CanvasRenderingContext2D,
  state: GameState,
  viewportWidth?: number,
  theme?: HudTheme,
) => void;

type PatchableRenderer = {
  drawLifeBars: LifeBarDraw;
};

const prototype = CanvasRenderer.prototype as unknown as PatchableRenderer;
const originalDrawLifeBars = prototype.drawLifeBars;

prototype.drawLifeBars = function drawPolishedLifeBars(
  ctx,
  state,
  viewportWidth = 640,
  theme = 'fresh',
): void {
  if (theme !== 'fresh') {
    originalDrawLifeBars.call(this, ctx, state, viewportWidth, theme);
    return;
  }

  const [p1, p2] = state.players;
  const width = 250;
  const height = 18;
  const gap = 92;
  const centerX = viewportWidth / 2;
  const leftX = centerX - gap / 2 - width;
  const rightX = centerX + gap / 2;
  const y = 14;
  const p1Ratio = clamp01(p1.life / 1000);
  const p2Ratio = clamp01(p2.life / 1000);

  drawBar(ctx, leftX, y, width, height, p1Ratio, 'left');
  drawBar(ctx, rightX, y, width, height, p2Ratio, 'right');
};

function drawBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  ratio: number,
  direction: 'left' | 'right',
): void {
  ctx.save();

  ctx.fillStyle = 'rgba(35, 60, 80, 0.22)';
  roundedRect(ctx, x + 2, y + 2, width, height, 4);
  ctx.fill();

  ctx.fillStyle = '#e6f2f7';
  roundedRect(ctx, x, y, width, height, 4);
  ctx.fill();

  ctx.fillStyle = '#315a67';
  roundedRect(ctx, x + 2, y + 2, width - 4, height - 4, 3);
  ctx.fill();

  const innerX = x + 4;
  const innerY = y + 4;
  const innerWidth = width - 8;
  const innerHeight = height - 8;
  ctx.fillStyle = '#d5e7e4';
  roundedRect(ctx, innerX, innerY, innerWidth, innerHeight, 2);
  ctx.fill();

  const fillWidth = Math.max(0, innerWidth * ratio);
  const fillX = direction === 'left' ? innerX : innerX + innerWidth - fillWidth;
  if (fillWidth > 0) {
    ctx.save();
    roundedRect(ctx, innerX, innerY, innerWidth, innerHeight, 2);
    ctx.clip();
    ctx.fillStyle = ratio < 0.3 ? '#e26b4f' : ratio < 0.55 ? '#e7b34d' : '#70c96d';
    ctx.fillRect(fillX, innerY, fillWidth, innerHeight);
    ctx.restore();
  }

  ctx.strokeStyle = 'rgba(49, 90, 103, 0.24)';
  ctx.lineWidth = 1;
  for (let segment = 1; segment < 10; segment += 1) {
    const segmentX = innerX + innerWidth * segment / 10;
    ctx.beginPath();
    ctx.moveTo(segmentX, innerY + 1);
    ctx.lineTo(segmentX, innerY + innerHeight - 1);
    ctx.stroke();
  }

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

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
