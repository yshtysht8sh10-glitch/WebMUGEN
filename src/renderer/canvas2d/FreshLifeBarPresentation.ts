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
  const width = 266;
  const height = 22;
  const gap = 82;
  const centerX = viewportWidth / 2;
  const leftX = centerX - gap / 2 - width;
  const rightX = centerX + gap / 2;
  const y = 13;
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

  ctx.fillStyle = 'rgba(3, 12, 24, 0.42)';
  roundedRect(ctx, x + 2, y + 3, width, height, 5);
  ctx.fill();

  const frame = gradient(ctx, x, y, x, y + height, '#f8fbff', '#6b8198');
  ctx.fillStyle = frame;
  roundedRect(ctx, x, y, width, height, 5);
  ctx.fill();

  ctx.fillStyle = '#12243b';
  roundedRect(ctx, x + 2, y + 2, width - 4, height - 4, 4);
  ctx.fill();

  const innerX = x + 5;
  const innerY = y + 5;
  const innerWidth = width - 10;
  const innerHeight = height - 10;
  ctx.fillStyle = gradient(ctx, innerX, innerY, innerX, innerY + innerHeight, '#172b43', '#071422');
  roundedRect(ctx, innerX, innerY, innerWidth, innerHeight, 3);
  ctx.fill();

  const fillWidth = Math.max(0, innerWidth * ratio);
  const fillX = direction === 'left' ? innerX : innerX + innerWidth - fillWidth;
  if (fillWidth > 0) {
    ctx.save();
    roundedRect(ctx, innerX, innerY, innerWidth, innerHeight, 3);
    ctx.clip();

    const life = gradient(ctx, 0, innerY, 0, innerY + innerHeight, '#d9ff79', '#2ecb55');
    ctx.fillStyle = life;
    ctx.fillRect(fillX, innerY, fillWidth, innerHeight);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
    ctx.fillRect(fillX, innerY, fillWidth, Math.max(2, innerHeight * 0.28));

    if (ratio < 0.3) {
      ctx.fillStyle = 'rgba(255, 78, 55, 0.64)';
      ctx.fillRect(fillX, innerY, fillWidth, innerHeight);
    } else if (ratio < 0.55) {
      ctx.fillStyle = 'rgba(255, 190, 44, 0.24)';
      ctx.fillRect(fillX, innerY, fillWidth, innerHeight);
    }

    ctx.restore();
  }

  ctx.strokeStyle = 'rgba(4, 19, 31, 0.28)';
  ctx.lineWidth = 1;
  for (let segment = 1; segment < 10; segment += 1) {
    const segmentX = innerX + innerWidth * segment / 10;
    ctx.beginPath();
    ctx.moveTo(segmentX, innerY + 1);
    ctx.lineTo(segmentX, innerY + innerHeight - 1);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(222, 243, 255, 0.68)';
  ctx.lineWidth = 1;
  roundedRect(ctx, x + 1.5, y + 1.5, width - 3, height - 3, 4);
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

function gradient(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  start: string,
  end: string,
): CanvasGradient | string {
  if (typeof ctx.createLinearGradient !== 'function') return start;
  const result = ctx.createLinearGradient(x0, y0, x1, y1);
  result.addColorStop(0, start);
  result.addColorStop(1, end);
  return result;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
