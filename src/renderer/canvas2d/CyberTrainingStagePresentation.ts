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
const previousDrawStage = prototype.drawStage;

prototype.drawStage = function drawCyberTrainingStage(
  ctx,
  viewportWidth,
  viewportHeight,
  cameraX,
  cameraY,
  theme,
): void {
  if (theme !== 'cyber') {
    previousDrawStage.call(this, ctx, viewportWidth, viewportHeight, cameraX, cameraY, theme);
    return;
  }

  const cameraOffsetY = 65 - cameraY;
  const horizonY = viewportHeight * 0.49 + cameraOffsetY * 0.45;
  const centerX = viewportWidth / 2 - cameraX * 0.03;

  ctx.fillStyle = verticalGradient(ctx, 0, viewportHeight, '#030816', '#10284a');
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);

  const horizonGlow = ctx.createRadialGradient(
    centerX,
    horizonY,
    0,
    centerX,
    horizonY,
    Math.max(viewportWidth * 0.28, viewportHeight * 0.42),
  );
  horizonGlow.addColorStop(0, 'rgba(34, 211, 238, 0.28)');
  horizonGlow.addColorStop(0.35, 'rgba(56, 189, 248, 0.09)');
  horizonGlow.addColorStop(1, 'rgba(56, 189, 248, 0)');
  ctx.fillStyle = horizonGlow;
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);

  drawCitySilhouette(ctx, viewportWidth, horizonY, cameraX);

  ctx.fillStyle = 'rgba(34, 211, 238, 0.2)';
  ctx.fillRect(0, Math.round(horizonY), viewportWidth, 2);
  ctx.fillStyle = 'rgba(125, 211, 252, 0.22)';
  ctx.fillRect(0, Math.round(horizonY + 4), viewportWidth, 1);

  const floorTop = horizonY + 2;
  const floorGradient = verticalGradient(ctx, floorTop, viewportHeight, 'rgba(8, 24, 50, 0.68)', '#020713');
  ctx.fillStyle = floorGradient;
  ctx.fillRect(0, floorTop, viewportWidth, viewportHeight - floorTop);

  drawPerspectiveGrid(ctx, viewportWidth, viewportHeight, centerX, floorTop, cameraX);
  drawSidePylons(ctx, viewportWidth, viewportHeight, floorTop);

  const edgeGlow = ctx.createLinearGradient(0, 0, viewportWidth, 0);
  edgeGlow.addColorStop(0, 'rgba(217, 70, 239, 0.1)');
  edgeGlow.addColorStop(0.18, 'rgba(217, 70, 239, 0)');
  edgeGlow.addColorStop(0.82, 'rgba(34, 211, 238, 0)');
  edgeGlow.addColorStop(1, 'rgba(34, 211, 238, 0.1)');
  ctx.fillStyle = edgeGlow;
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);

  const vignette = ctx.createRadialGradient(
    viewportWidth / 2,
    viewportHeight * 0.5,
    viewportHeight * 0.16,
    viewportWidth / 2,
    viewportHeight * 0.5,
    viewportWidth * 0.72,
  );
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 3, 12, 0.38)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);
};

function drawCitySilhouette(
  ctx: CanvasRenderingContext2D,
  width: number,
  horizonY: number,
  cameraX: number,
): void {
  ctx.save();
  const offset = -positiveMod(cameraX * 0.08, 44);
  for (let x = offset - 44; x < width + 44; x += 44) {
    const index = Math.round((x - offset) / 44);
    const buildingWidth = 22 + positiveMod(index * 17, 16);
    const buildingHeight = 22 + positiveMod(index * 29, 52);
    const buildingX = x + 5;
    const buildingY = horizonY - buildingHeight;

    ctx.fillStyle = index % 3 === 0 ? '#071426' : '#091a2e';
    ctx.fillRect(buildingX, buildingY, buildingWidth, buildingHeight);

    ctx.fillStyle = 'rgba(34, 211, 238, 0.23)';
    for (let windowY = buildingY + 7; windowY < horizonY - 5; windowY += 10) {
      for (let windowX = buildingX + 5; windowX < buildingX + buildingWidth - 4; windowX += 9) {
        if ((windowX + windowY + index) % 3 !== 0) ctx.fillRect(windowX, windowY, 2, 4);
      }
    }
  }
  ctx.restore();
}

function drawPerspectiveGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  centerX: number,
  floorTop: number,
  cameraX: number,
): void {
  ctx.save();

  const verticalSpacing = Math.max(30, width / 18);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.26)';
  ctx.lineWidth = 1;
  for (let x = -width; x < width * 2; x += verticalSpacing) {
    ctx.beginPath();
    ctx.moveTo(centerX, floorTop);
    ctx.lineTo(x - cameraX * 0.16, height);
    ctx.stroke();
  }

  let normalized = 0;
  let row = 0;
  while (normalized < 1) {
    const y = floorTop + (height - floorTop) * normalized;
    const alpha = 0.12 + normalized * 0.23;
    ctx.strokeStyle = `rgba(34, 211, 238, ${alpha})`;
    ctx.lineWidth = normalized > 0.72 ? 1.35 : 1;
    ctx.beginPath();
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(width, Math.round(y) + 0.5);
    ctx.stroke();
    row += 1;
    normalized += Math.min(0.19, 0.035 + row * 0.012);
  }

  ctx.restore();
}

function drawSidePylons(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  floorTop: number,
): void {
  const pylonY = floorTop + (height - floorTop) * 0.54;
  const pylonHeight = Math.max(30, (height - floorTop) * 0.18);
  const pylonWidth = Math.max(7, width * 0.012);

  for (const side of [-1, 1] as const) {
    const x = side < 0 ? width * 0.09 : width * 0.91 - pylonWidth;
    ctx.fillStyle = 'rgba(7, 17, 35, 0.92)';
    ctx.fillRect(x, pylonY, pylonWidth, pylonHeight);
    ctx.fillStyle = side < 0 ? 'rgba(217, 70, 239, 0.72)' : 'rgba(34, 211, 238, 0.72)';
    ctx.fillRect(x + pylonWidth * 0.34, pylonY + 3, Math.max(2, pylonWidth * 0.28), pylonHeight - 6);
  }
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

function positiveMod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
