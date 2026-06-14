import type { AirDocument } from '../../parser/air/AirTypes';
import { getCurrentAnimationElement } from '../../core/animation/AnimationPlayer';
import {
  getPlayerAttackBoxes,
  getPlayerBodyBoxes,
} from '../../core/collision/CollisionResolver';
import type { GameState, PlayerState, ProjectileState, Rect } from '../../core/engine/types';
import { getAttackBox, getBodyBox, isAttackActive } from '../../core/engine/SimpleCollision';
import { getProjectileWorldBox } from '../../core/projectile/ProjectileSystem';
import { findSprite } from '../../core/sprite/SpritePackLoader';
import type { SpritePack } from '../../core/sprite/SpriteTypes';
import type { ImageDataSpritePack } from '../../core/sprite/ImageDataSpriteTypes';
import { ImageDataSpriteRenderer } from './ImageDataSpriteRenderer';
import { createSpriteDebugInfo } from '../../core/sprite/SpriteDebugInfo';
import type { HitFeedbackState } from '../../core/engine/HitFeedback';
import { HitFeedbackRenderer } from './HitFeedbackRenderer';

export class CanvasRenderer {
  private readonly context: CanvasRenderingContext2D;
  private readonly imageDataSpriteRenderer = new ImageDataSpriteRenderer();
  private readonly hitFeedbackRenderer = new HitFeedbackRenderer();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly airDocument?: AirDocument,
    private readonly spritePack?: SpritePack | null,
    private readonly imageDataSpritePack?: ImageDataSpritePack | null,
  ) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('CanvasRenderingContext2D is not available.');
    this.context = context;
  }

  render(state: GameState, hitFeedback?: HitFeedbackState): void {
    const ctx = this.context;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawStage(ctx);
    this.drawLifeBars(ctx, state);
    this.drawProjectiles(ctx, state.projectiles);
    this.drawPlayer(ctx, state.players[0], '#66ccff');
    this.drawPlayer(ctx, state.players[1], '#ff99aa');
    if (hitFeedback) this.hitFeedbackRenderer.render(ctx, hitFeedback);
    this.drawDebugBoxes(ctx, state.players[0]);
    this.drawDebugBoxes(ctx, state.players[1]);
    this.drawProjectileDebugBoxes(ctx, state.projectiles);
    this.drawDebug(ctx, state);
    this.drawSpriteDebug(ctx, state);
  }

  private drawStage(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#26351e';
    ctx.fillRect(0, 285, this.canvas.width, 80);
  }

  private drawLifeBars(ctx: CanvasRenderingContext2D, state: GameState): void {
    const [p1, p2] = state.players;
    ctx.fillStyle = '#111827';
    ctx.fillRect(20, 18, 260, 16);
    ctx.fillRect(360, 18, 260, 16);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(20, 18, 260 * (p1.life / 1000), 16);
    ctx.fillRect(620 - 260 * (p2.life / 1000), 18, 260 * (p2.life / 1000), 16);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(20, 18, 260, 16);
    ctx.strokeRect(360, 18, 260, 16);
  }

  private drawProjectiles(ctx: CanvasRenderingContext2D, projectiles: ProjectileState[]): void {
    for (const projectile of projectiles) {
      const currentElement = this.airDocument
        ? getCurrentAnimationElement(this.airDocument, projectile.animNo, projectile.animTime)
        : null;

      if (currentElement) {
        const drawn = this.drawSpriteByElement(
          ctx,
          currentElement.element.groupNo,
          currentElement.element.imageNo,
          projectile.x,
          projectile.y,
          projectile.facing,
          currentElement.element.offsetX,
          currentElement.element.offsetY,
          currentElement.element.flip,
        );

        if (drawn) continue;
      }

      ctx.save();
      ctx.translate(projectile.x, projectile.y);
      ctx.scale(projectile.facing, 1);
      ctx.fillStyle = '#60a5fa';
      ctx.beginPath();
      ctx.arc(0, 0, 13 + Math.sin(projectile.animTime / 2) * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#bfdbfe';
      ctx.beginPath();
      ctx.arc(-4, -4, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, player: PlayerState, color: string): void {
    const currentElement = this.airDocument
      ? getCurrentAnimationElement(this.airDocument, player.animNo, player.animTime)
      : null;

    if (currentElement) {
      const drawn = this.drawSpriteByElement(
        ctx,
        currentElement.element.groupNo,
        currentElement.element.imageNo,
        player.x,
        player.y,
        player.facing,
        currentElement.element.offsetX,
        currentElement.element.offsetY,
        currentElement.element.flip,
      );

      if (drawn) return;
    }

    this.drawFallbackPlayer(ctx, player, color, currentElement);
  }

  private drawSpriteByElement(
    ctx: CanvasRenderingContext2D,
    groupNo: number,
    imageNo: number,
    x: number,
    y: number,
    facing: 1 | -1,
    offsetX = 0,
    offsetY = 0,
    flip = '',
  ): boolean {
    const flipX = flip.toUpperCase().includes('H');
    const key = `${groupNo},${imageNo}`;

    const imageDataSprite = this.imageDataSpritePack?.sprites.get(key);
    if (imageDataSprite) {
      const canvas = this.imageDataSpriteRenderer.findCanvas(this.imageDataSpritePack, groupNo, imageNo);
      if (!canvas) return false;

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(facing * (flipX ? -1 : 1), 1);
      ctx.drawImage(canvas, -imageDataSprite.xAxis + offsetX, -imageDataSprite.yAxis + offsetY);
      ctx.restore();
      return true;
    }

    const sprite = findSprite(this.spritePack, groupNo, imageNo);
    if (sprite) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(facing * (flipX ? -1 : 1), 1);
      ctx.drawImage(sprite.image, -sprite.xAxis + offsetX, -sprite.yAxis + offsetY);
      ctx.restore();
      return true;
    }

    return false;
  }

  private drawFallbackPlayer(
    ctx: CanvasRenderingContext2D,
    player: PlayerState,
    color: string,
    currentElement: ReturnType<typeof getCurrentAnimationElement>,
  ): void {
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath();
    ctx.ellipse(player.x, 305, 32, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.scale(player.facing, 1);

    const isAttack = player.stateNo === 200;
    const isSpecial = player.stateNo === 1000;
    const isWalk = player.stateNo === 20;
    const bob = isWalk ? Math.sin(player.animTime / 3) * 3 : 0;
    const frameTint = currentElement ? currentElement.element.imageNo % 3 : 0;

    ctx.fillStyle = player.hitPause > 0 ? '#ffffff' : isSpecial ? '#a7f3d0' : isAttack ? '#ffcc66' : color;
    ctx.fillRect(-16, -58 + bob, 32, 58);
    ctx.fillStyle = '#ffe0bd';
    ctx.fillRect(-13, -78 + bob, 26, 22);
    ctx.fillStyle = '#222';
    ctx.fillRect(4, -71 + bob, 4, 4);

    ctx.fillStyle = frameTint === 0 ? color : frameTint === 1 ? '#c4b5fd' : '#fde68a';

    if (isSpecial && player.animTime > 6 && player.animTime < 16) {
      ctx.fillRect(14, -50 + bob, 58, 12);
    } else if (isAttack && player.animTime > 4 && player.animTime < 12) {
      ctx.fillRect(14, -48 + bob, 42, 10);
    } else {
      ctx.fillRect(14, -46 + bob, 10, 28);
    }

    if (currentElement) {
      ctx.fillStyle = '#111';
      ctx.font = '10px monospace';
      ctx.fillText(`${currentElement.element.groupNo},${currentElement.element.imageNo}`, -18, -86 + bob);
    }

    ctx.restore();
  }

  private drawDebugBoxes(ctx: CanvasRenderingContext2D, player: PlayerState): void {
    if (this.airDocument) {
      getPlayerBodyBoxes(player, this.airDocument).forEach((box) =>
        this.strokeRect(ctx, box, '#00ff00'),
      );
      getPlayerAttackBoxes(player, this.airDocument).forEach((box) =>
        this.strokeRect(ctx, box, '#ff0000'),
      );
      return;
    }

    this.strokeRect(ctx, getBodyBox(player), '#00ff00');
    if (isAttackActive(player)) this.strokeRect(ctx, getAttackBox(player), '#ff0000');
  }

  private drawProjectileDebugBoxes(ctx: CanvasRenderingContext2D, projectiles: ProjectileState[]): void {
    projectiles.forEach((projectile) => this.strokeRect(ctx, getProjectileWorldBox(projectile), '#ff0000'));
  }

  private strokeRect(ctx: CanvasRenderingContext2D, rect: Rect, color: string): void {
    ctx.strokeStyle = color;
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
  }

  private drawDebug(ctx: CanvasRenderingContext2D, state: GameState): void {
    const [p1, p2] = state.players;
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.fillText(
      `frame=${state.frame} p1=${p1.stateNo}/${p1.animNo}:${p1.animTime} p2=${p2.stateNo}/${p2.animNo}:${p2.animTime}`,
      12,
      56,
    );
    ctx.fillText(`p1 life=${p1.life} p2 life=${p2.life} projectiles=${state.projectiles.length}`, 12, 76);
  }

  private drawSpriteDebug(ctx: CanvasRenderingContext2D, state: GameState): void {
    const info = createSpriteDebugInfo(
      state.players,
      this.airDocument,
      this.imageDataSpritePack,
      this.spritePack,
    );

    ctx.save();
    ctx.fillStyle = 'rgba(17, 24, 39, 0.78)';
    ctx.fillRect(8, 88, 360, 78);
    ctx.font = '12px monospace';
    ctx.fillStyle = '#e5e7eb';
    ctx.fillText(`sprites imageData=${info.imageDataSpriteCount} png=${info.pngSpriteCount}`, 16, 106);

    info.players.forEach((playerInfo, index) => {
      const y = 126 + index * 18;
      const status = playerInfo.hasImageDataSprite
        ? 'imageData:yes'
        : playerInfo.hasPngSprite
          ? 'png:yes'
          : 'missing';
      ctx.fillStyle = playerInfo.hasImageDataSprite || playerInfo.hasPngSprite ? '#bbf7d0' : '#fecaca';
      ctx.fillText(
        `p${playerInfo.playerId} anim=${playerInfo.animNo}:${playerInfo.animTime} sprite=${playerInfo.key ?? 'none'} ${status}`,
        16,
        y,
      );
    });

    ctx.restore();
  }
}
