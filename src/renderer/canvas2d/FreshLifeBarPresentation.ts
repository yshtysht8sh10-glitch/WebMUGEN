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

  ctx.fillStyle = '#1f4250';
  roundedRect(ctx, x, y, width, height, 3);
  ctx.fill();

  ctx.fillStyle = '#d9edf0';
  roundedRect(ctx, x + 2, y + 2, width - 4, height - 4, 2);
  ctx.fill();

  const innerX = x + 4;
  const innerY = y + 4;
  const innerWidth = width - 8;
  const innerHeight = height - 8;
  ctx.fillStyle = '#b8d5d1';
  roundedRect(ctx, innerX, innerY, innerWidth, innerHeight, 1);
  ctx.fill();

  const fillWidth = Math.max(0, innerWidth * ratio);
  const fillX = direction === 'left' ? innerX : innerX + innerWidth - fillWidth;
  if (fillWidth > 0) {
    ctx.fillStyle = ratio < 0.3 ? '#d9573f' : ratio < 0.55 ? '#d99d35' : '#55b85a';
    ctx.fillRect(fillX, innerY, fillWidth, innerHeight);
  }

  ctx.strokeStyle = '#1f4250';
  ctx.lineWidth = 1;
  for (let segment = 1; segment < 10; segment += 1) {
    const segmentX = Math.round(innerX + innerWidth * segment / 10) + 0.5;
    ctx.beginPath();
    ctx.moveTo(segmentX, innerY);
    ctx.lineTo(segmentX, innerY + innerHeight);
    ctx.stroke();
  }

  ctx.strokeStyle = '#f3fbfc';
  ctx.lineWidth = 1;
  roundedRect(ctx, x + 0.5, y + 0.5, width - 1, height - 1, 3);
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

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
