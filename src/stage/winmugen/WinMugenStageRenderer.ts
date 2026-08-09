import { spriteKey } from '../../core/sprite/SpritePackLoader';
import { ImageDataSpriteRenderer } from '../../renderer/canvas2d/ImageDataSpriteRenderer';
import { MUGEN_GROUND_Y, MUGEN_WORLD_ORIGIN_X } from '../../core/engine/ScreenSize';
import type { StageRenderContext } from '../StageRuntime';
import type { WinMugenStageDefinition } from './WinMugenStageTypes';

export class WinMugenStageRenderer {
  private readonly sprites = new ImageDataSpriteRenderer();

  render(stage: WinMugenStageDefinition, context: StageRenderContext): void {
    const { ctx, viewportWidth, cameraX, cameraY } = context;
    const scale = stage.hiRes ? 0.5 : 1;
    ctx.save();
    ctx.scale(scale, scale);
    const sourceViewportWidth = viewportWidth / scale;
    const stageCamera = resolveStageCameraPosition({ viewportWidth, zOffset: stage.zOffset, cameraX, cameraY });
    for (const layer of stage.layers) {
      const sprite = stage.sprites.sprites.get(spriteKey(layer.groupNo, layer.imageNo));
      const image = this.sprites.findCanvas(stage.sprites, layer.groupNo, layer.imageNo);
      if (!sprite || !image) continue;
      const position = resolveStageLayerPosition({
        viewportWidth: sourceViewportWidth,
        startX: layer.startX,
        startY: layer.startY,
        spriteAxisX: sprite.xAxis,
        spriteAxisY: sprite.yAxis,
        cameraX: stageCamera.x,
        cameraY: stageCamera.y,
        deltaX: layer.deltaX,
        deltaY: layer.deltaY,
      });
      ctx.drawImage(image, Math.round(position.x), Math.round(position.y));
    }
    ctx.restore();
  }
}

export function resolveStageLayerPosition(input: {
  viewportWidth: number; startX: number; startY: number; spriteAxisX: number; spriteAxisY: number;
  cameraX: number; cameraY: number; deltaX: number; deltaY: number;
}): { x: number; y: number } {
  return {
    x: input.viewportWidth / 2 + input.startX - input.spriteAxisX - input.cameraX * input.deltaX,
    y: input.startY - input.spriteAxisY - input.cameraY * input.deltaY,
  };
}

export function resolveStageCameraPosition(input: { viewportWidth: number; zOffset: number; cameraX: number; cameraY: number }): { x: number; y: number } {
  return {
    x: input.cameraX + input.viewportWidth / 2 - MUGEN_WORLD_ORIGIN_X,
    y: input.cameraY + input.zOffset - MUGEN_GROUND_Y,
  };
}
