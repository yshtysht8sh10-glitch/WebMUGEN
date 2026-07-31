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
  lastPowerHudSignature?: string;
  reportedInitialPower?: boolean;
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
  const offsetX = (viewportWidth - 640) / 2;
  const leftX = 24 + offsetX;
  const rightX = 482 + offsetX;
  const y = 38;
  const width = 134;
  const height = 11;
  const p1Power = p1.power ?? 0;
  const p2Power = p2.power ?? 0;
  const p1PowerMax = p1.powerMax ?? 3000;
  const p2PowerMax = p2.powerMax ?? 3000;
  const p1Ratio = clamp01(p1Power / Math.max(1, p1PowerMax));
  const p2Ratio = clamp01(p2Power / Math.max(1, p2PowerMax));

  drawPowerBar(ctx, leftX, y, width, height, p1Ratio, 'left');
  drawPowerBar(ctx, rightX, y, width, height, p2Ratio, 'right');

  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  if (p1.infinitePower) ctx.fillText('∞', leftX + width + 8, y + height / 2);
  ctx.textAlign = 'right';
  if (p2.infinitePower) ctx.fillText('∞', rightX - 8, y + height / 2);
  ctx.restore();

  if (!diagnosticsEnabled) return [];

  const infiniteMode = p1.infinitePower && p2.infinitePower ? 'both' : p1.infinitePower ? 'p1' : p2.infinitePower ? 'p2' : 'off';
  const signature = `${p1Power}/${p1PowerMax}|${p2Power}/${p2PowerMax}|${infiniteMode}`;
  if (signature === this.lastPowerHudSignature) return [];
  this.lastPowerHudSignature = signature;

  const diagnostics = [`raw.power_hud p1=${p1Power}/${p1PowerMax} width=${126 * p1Ratio} p2=${p2Power}/${p2PowerMax} width=${126 * p2Ratio} infinite=${infiniteMode}`];
  if (!this.reportedInitialPower) {
    this.reportedInitialPower = true;
    diagnostics.unshift(
      `raw.power entity=p1 source=initial before=0 delta=${p1Power} after=${p1Power} max=${p1PowerMax}`,
      `raw.power entity=p2 source=initial before=0 delta=${p2Power} after=${p2Power} max=${p2PowerMax}`,
    );
  }
  return diagnostics;
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

  ctx.fillStyle = 'rgba(35, 60, 80, 0.18)';
  roundedRect(ctx, x + 2, y + 2, width, height, 3);
  ctx.fill();

  ctx.fillStyle = '#dcecef';
  roundedRect(ctx, x, y, width, height, 3);
  ctx.fill();

  ctx.fillStyle = '#315a67';
  roundedRect(ctx, x + 2, y + 2, width - 4, height - 4, 2);
  ctx.fill();

  const innerX = x + 3;
  const innerY = y + 3;
  const innerWidth = width - 6;
  const innerHeight = height - 6;
  ctx.fillStyle = '#d5e7e4';
  roundedRect(ctx, innerX, innerY, innerWidth, innerHeight, 1);
  ctx.fill();

  const fillWidth = innerWidth * ratio;
  const fillX = direction === 'left' ? innerX : innerX + innerWidth - fillWidth;
  if (fillWidth > 0) {
    ctx.save();
    roundedRect(ctx, innerX, innerY, innerWidth, innerHeight, 1);
    ctx.clip();
    ctx.fillStyle = '#48b9d7';
    ctx.fillRect(fillX, innerY, fillWidth, innerHeight);
    ctx.restore();
  }

  ctx.strokeStyle = 'rgba(49, 90, 103, 0.22)';
  ctx.lineWidth = 1;
  for (let segment = 1; segment < 6; segment += 1) {
    const segmentX = innerX + innerWidth * segment / 6;
    ctx.beginPath();
    ctx.moveTo(segmentX, innerY);
    ctx.lineTo(segmentX, innerY + innerHeight);
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
