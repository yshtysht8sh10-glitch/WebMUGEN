import { MUGEN_WORLD_ORIGIN_X } from '../../core/engine/ScreenSize';
import type { StageRenderContext } from '../StageRuntime';
import type { WebMugenStageDefinition } from './WebMugenStageSchema';

export class FreshClasicStageRenderer {
  render(_stage: WebMugenStageDefinition, context: StageRenderContext): void {
    const { ctx, viewportWidth, viewportHeight, cameraX, cameraY } = context;
    const cameraOffsetY = 65 - cameraY;
    const horizonY = Math.min(viewportHeight * 0.6 + cameraOffsetY * 0.42, viewportHeight * 0.76);
    const stageGroundY = 285 - cameraY;
    const floorTopY = Math.min(stageGroundY, viewportHeight * 0.78 + cameraOffsetY * 0.3);
    const parallaxX = cameraX * 0.08;

    const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
    sky.addColorStop(0, '#1592e6');
    sky.addColorStop(0.55, '#64c7f3');
    sky.addColorStop(1, '#dff5ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, viewportWidth, Math.max(0, horizonY));

    const sunX = viewportWidth * 0.68 - parallaxX * 0.12;
    const sunY = viewportHeight * 0.11 + cameraOffsetY * 0.03;
    const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, viewportHeight * 0.17);
    glow.addColorStop(0, 'rgba(255, 255, 244, 0.98)');
    glow.addColorStop(0.18, 'rgba(255, 252, 203, 0.34)');
    glow.addColorStop(1, 'rgba(255, 252, 203, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, viewportWidth, horizonY);
    ctx.fillStyle = '#fffde7';
    ctx.beginPath();
    ctx.arc(sunX, sunY, Math.max(9, viewportHeight * 0.032), 0, Math.PI * 2);
    ctx.fill();

    drawCloud(ctx, viewportWidth * 0.1 - parallaxX * 0.08, viewportHeight * 0.16, viewportHeight * 0.03, 0.78);
    drawCloud(ctx, viewportWidth * 0.4 - parallaxX * 0.12, viewportHeight * 0.25, viewportHeight * 0.024, 0.6);
    drawCloud(ctx, viewportWidth * 0.79 - parallaxX * 0.1, viewportHeight * 0.31, viewportHeight * 0.018, 0.46);

    drawMountains(ctx, viewportWidth, horizonY + 8, viewportHeight * 0.16, '#7da4bd', parallaxX * 0.22, 0.14);
    drawMountains(ctx, viewportWidth, horizonY + 22, viewportHeight * 0.21, '#496f78', parallaxX * 0.42, 0.39);

    const haze = ctx.createLinearGradient(0, horizonY - 8, 0, floorTopY);
    haze.addColorStop(0, 'rgba(240, 252, 255, 0.5)');
    haze.addColorStop(1, 'rgba(161, 198, 174, 0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, horizonY - 8, viewportWidth, Math.max(0, floorTopY - horizonY + 8));

    const treeLineY = floorTopY - Math.max(24, viewportHeight * 0.09);
    ctx.fillStyle = '#2f6c46';
    ctx.beginPath();
    ctx.moveTo(0, floorTopY);
    for (let x = -30; x <= viewportWidth + 30; x += 18) {
      const shifted = x - parallaxX * 0.68;
      const crown = treeLineY - positiveMod(Math.round(shifted * 13), 27);
      ctx.lineTo(x, crown + 8);
      ctx.lineTo(x + 7, crown - 5);
      ctx.lineTo(x + 13, crown + 5);
      ctx.lineTo(x + 20, treeLineY + 4 - positiveMod(Math.round(shifted * 7), 17));
    }
    ctx.lineTo(viewportWidth, floorTopY);
    ctx.closePath();
    ctx.fill();

    const floor = ctx.createLinearGradient(0, floorTopY, 0, viewportHeight);
    floor.addColorStop(0, '#7ea56d');
    floor.addColorStop(0.22, '#5d8358');
    floor.addColorStop(1, '#2b4b35');
    ctx.fillStyle = floor;
    ctx.fillRect(0, floorTopY, viewportWidth, Math.max(0, viewportHeight - floorTopY));
    ctx.fillStyle = 'rgba(225, 245, 191, 0.48)';
    ctx.fillRect(0, floorTopY, viewportWidth, 2);
    ctx.fillStyle = 'rgba(31, 64, 39, 0.32)';
    ctx.fillRect(0, floorTopY + 4, viewportWidth, 3);

    ctx.strokeStyle = 'rgba(232, 244, 220, 0.08)';
    ctx.lineWidth = 1;
    for (let y = floorTopY + 28; y < viewportHeight; y += 34) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(viewportWidth, y);
      ctx.stroke();
    }

    // Track camera movement relative to the centered initial viewport, not the
    // absolute world-space camera origin. This keeps the perspective centered
    // at match start while still locking floor markings to the fighters.
    const initialCameraX = MUGEN_WORLD_ORIGIN_X - viewportWidth / 2;
    const floorCameraX = cameraX - initialCameraX;
    const floorVanishingX = viewportWidth / 2 - floorCameraX;
    for (let x = -viewportWidth; x < viewportWidth * 2; x += 92) {
      ctx.beginPath();
      ctx.moveTo(floorVanishingX, floorTopY + 3);
      ctx.lineTo(x - floorCameraX, viewportHeight);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(241, 247, 229, 0.07)';
    const floorHeight = Math.max(1, viewportHeight - floorTopY - 10);
    for (let index = 0; index < 36; index += 1) {
      const x = positiveMod(index * 79 + 23 - Math.round(floorCameraX), Math.max(1, Math.round(viewportWidth)));
      const y = floorTopY + 8 + positiveMod(index * 43 + 5, Math.max(1, Math.round(floorHeight)));
      ctx.fillRect(x, y, 1 + index % 2, 1);
    }

    const vignette = ctx.createRadialGradient(
      viewportWidth / 2, viewportHeight * 0.48, viewportHeight * 0.16,
      viewportWidth / 2, viewportHeight * 0.48, viewportWidth * 0.76,
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(10, 38, 55, 0.06)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);
  }

  dispose(): void {}
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, alpha: number): void {
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.arc(x + radius * 1.2, y - radius * 0.35, radius * 1.15, 0, Math.PI * 2);
  ctx.arc(x + radius * 2.35, y, radius * 0.9, 0, Math.PI * 2);
  ctx.fill();
}

function drawMountains(ctx: CanvasRenderingContext2D, width: number, baselineY: number, amplitude: number, color: string, offsetX: number, phase: number): void {
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
