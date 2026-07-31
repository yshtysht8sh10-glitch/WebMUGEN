import { CanvasRenderer } from './CanvasRenderer';
import type { StageTheme } from '../../app/RuntimeSettings';

type StageDraw = (
  ctx: CanvasRenderingContext2D,
  viewportWidth: number,
  viewportHeight: number,
  cameraX: number,
  cameraY: number,
  theme: StageTheme,
) => void;

type PatchableRenderer = {
  drawStage: StageDraw;
};

const prototype = CanvasRenderer.prototype as unknown as PatchableRenderer;
const originalDrawStage = prototype.drawStage;

prototype.drawStage = function drawEnhancedStage(
  ctx,
  viewportWidth,
  viewportHeight,
  cameraX,
  cameraY,
  theme,
): void {
  if (theme !== 'fresh') {
    originalDrawStage.call(this, ctx, viewportWidth, viewportHeight, cameraX, cameraY, theme);
    return;
  }

  const cameraOffsetY = 65 - cameraY;
  const horizonY = Math.min(viewportHeight * 0.61 + cameraOffsetY * 0.45, viewportHeight * 0.78);
  const groundY = Math.min(viewportHeight * 0.79 + cameraOffsetY, viewportHeight * 0.92);
  const parallaxX = cameraX * 0.08;

  const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
  sky.addColorStop(0, '#17335a');
  sky.addColorStop(0.48, '#5685ad');
  sky.addColorStop(0.8, '#d59b83');
  sky.addColorStop(1, '#f1bf8f');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, viewportWidth, Math.max(0, horizonY));

  const sunX = viewportWidth * 0.76 - parallaxX * 0.2;
  const sunY = viewportHeight * 0.24 + cameraOffsetY * 0.08;
  const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, viewportHeight * 0.24);
  glow.addColorStop(0, 'rgba(255, 248, 210, 0.96)');
  glow.addColorStop(0.22, 'rgba(255, 211, 151, 0.36)');
  glow.addColorStop(1, 'rgba(255, 187, 126, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, viewportWidth, horizonY);
  ctx.fillStyle = 'rgba(255, 241, 190, 0.92)';
  ctx.beginPath();
  ctx.arc(sunX, sunY, Math.max(11, viewportHeight * 0.046), 0, Math.PI * 2);
  ctx.fill();

  drawCloud(ctx, viewportWidth * 0.17 - parallaxX * 0.1, viewportHeight * 0.2, viewportHeight * 0.028, 0.2);
  drawCloud(ctx, viewportWidth * 0.49 - parallaxX * 0.14, viewportHeight * 0.31, viewportHeight * 0.022, 0.14);

  drawMountains(ctx, viewportWidth, horizonY + 4, viewportHeight * 0.17, '#61778a', parallaxX * 0.25, 0.18);
  drawMountains(ctx, viewportWidth, horizonY + 20, viewportHeight * 0.22, '#334e5a', parallaxX * 0.45, 0.43);

  const mist = ctx.createLinearGradient(0, horizonY - 8, 0, groundY);
  mist.addColorStop(0, 'rgba(246, 219, 188, 0.42)');
  mist.addColorStop(1, 'rgba(83, 110, 99, 0)');
  ctx.fillStyle = mist;
  ctx.fillRect(0, horizonY - 8, viewportWidth, Math.max(0, groundY - horizonY + 8));

  ctx.fillStyle = '#173b36';
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  for (let x = -30; x <= viewportWidth + 30; x += 18) {
    const shifted = x - parallaxX * 0.7;
    const crown = groundY - 15 - positiveMod(Math.round(shifted * 13), 31);
    ctx.lineTo(x, crown + 8);
    ctx.lineTo(x + 7, crown - 6);
    ctx.lineTo(x + 13, crown + 5);
    ctx.lineTo(x + 20, groundY - 12 - positiveMod(Math.round(shifted * 7), 19));
  }
  ctx.lineTo(viewportWidth, groundY);
  ctx.closePath();
  ctx.fill();

  const floor = ctx.createLinearGradient(0, groundY, 0, viewportHeight);
  floor.addColorStop(0, '#4b6250');
  floor.addColorStop(0.16, '#30463d');
  floor.addColorStop(1, '#142321');
  ctx.fillStyle = floor;
  ctx.fillRect(0, groundY, viewportWidth, Math.max(0, viewportHeight - groundY));

  ctx.fillStyle = 'rgba(203, 226, 186, 0.58)';
  ctx.fillRect(0, groundY, viewportWidth, 2);
  ctx.fillStyle = 'rgba(8, 18, 18, 0.62)';
  ctx.fillRect(0, groundY + 4, viewportWidth, 5);

  ctx.strokeStyle = 'rgba(202, 222, 207, 0.12)';
  ctx.lineWidth = 1;
  for (let y = groundY + 18; y < viewportHeight; y += 22) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(viewportWidth, y);
    ctx.stroke();
  }
  for (let x = -viewportWidth; x < viewportWidth * 2; x += 58) {
    ctx.beginPath();
    ctx.moveTo(viewportWidth / 2 - cameraX * 0.03, groundY + 3);
    ctx.lineTo(x - cameraX * 0.2, viewportHeight);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(224, 235, 218, 0.11)';
  const floorHeight = Math.max(1, viewportHeight - groundY - 10);
  for (let index = 0; index < 76; index += 1) {
    const x = positiveMod(index * 79 + 23 - Math.round(cameraX * 0.15), Math.max(1, Math.round(viewportWidth)));
    const y = groundY + 8 + positiveMod(index * 43 + 5, Math.max(1, Math.round(floorHeight)));
    ctx.fillRect(x, y, 1 + index % 3, 1);
  }

  const vignette = ctx.createRadialGradient(
    viewportWidth / 2,
    viewportHeight * 0.5,
    viewportHeight * 0.14,
    viewportWidth / 2,
    viewportHeight * 0.5,
    viewportWidth * 0.72,
  );
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(3, 9, 15, 0.28)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);
};

function drawCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  alpha: number,
): void {
  ctx.fillStyle = `rgba(255, 246, 226, ${alpha})`;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.arc(x + radius * 1.2, y - radius * 0.35, radius * 1.15, 0, Math.PI * 2);
  ctx.arc(x + radius * 2.35, y, radius * 0.9, 0, Math.PI * 2);
  ctx.fill();
}

function drawMountains(
  ctx: CanvasRenderingContext2D,
  width: number,
  baselineY: number,
  amplitude: number,
  color: string,
  offsetX: number,
  phase: number,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, baselineY + amplitude);
  for (let x = -16; x <= width + 16; x += 7) {
    const normalized = (x + offsetX) / Math.max(1, width);
    const ridge = Math.sin((normalized + phase) * Math.PI * 4.4) * 0.34
      + Math.sin((normalized + phase * 0.7) * Math.PI * 9.2) * 0.15
      + Math.sin((normalized + phase * 1.2) * Math.PI * 2.1) * 0.46;
    ctx.lineTo(x, baselineY - amplitude * (0.5 + ridge * 0.4));
  }
  ctx.lineTo(width, baselineY + amplitude);
  ctx.closePath();
  ctx.fill();
}

function positiveMod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
