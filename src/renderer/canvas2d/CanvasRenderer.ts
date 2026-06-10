import type { GameState, PlayerState, Rect } from '../../core/engine/types';
import { getAttackBox, getBodyBox, isAttackActive } from '../../core/engine/SimpleCollision';

export class CanvasRenderer {
  private readonly context: CanvasRenderingContext2D;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('CanvasRenderingContext2D is not available.');
    }
    this.context = context;
  }

  render(state: GameState): void {
    const ctx = this.context;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawStage(ctx);
    this.drawLifeBars(ctx, state);
    this.drawPlayer(ctx, state.players[0], '#66ccff');
    this.drawPlayer(ctx, state.players[1], '#ff99aa');
    this.drawDebugBoxes(ctx, state.players[0]);
    this.drawDebugBoxes(ctx, state.players[1]);
    this.drawDebug(ctx, state);
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

  private drawPlayer(ctx: CanvasRenderingContext2D, player: PlayerState, color: string): void {
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath();
    ctx.ellipse(player.x, 305, 32, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.scale(player.facing, 1);

    const isAttack = player.stateNo === 200;
    const isWalk = player.stateNo === 20 || player.stateNo === 21;
    const bob = isWalk ? Math.sin(player.stateTime / 3) * 3 : 0;

    ctx.fillStyle = player.hitPause > 0 ? '#ffffff' : isAttack ? '#ffcc66' : color;
    ctx.fillRect(-16, -58 + bob, 32, 58);

    ctx.fillStyle = '#ffe0bd';
    ctx.fillRect(-13, -78 + bob, 26, 22);

    ctx.fillStyle = '#222';
    ctx.fillRect(4, -71 + bob, 4, 4);

    ctx.fillStyle = color;
    if (isAttack && player.animTime > 4 && player.animTime < 12) {
      ctx.fillRect(14, -48 + bob, 42, 10);
    } else {
      ctx.fillRect(14, -46 + bob, 10, 28);
    }

    ctx.restore();
  }

  private drawDebugBoxes(ctx: CanvasRenderingContext2D, player: PlayerState): void {
    this.strokeRect(ctx, getBodyBox(player), '#00ff00');

    if (isAttackActive(player)) {
      this.strokeRect(ctx, getAttackBox(player), '#ff0000');
    }
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
      `frame=${state.frame} p1=${p1.stateNo}/${p1.stateTime} p2=${p2.stateNo}/${p2.stateTime}`,
      12,
      56,
    );
    ctx.fillText(`p1 life=${p1.life} p2 life=${p2.life}`, 12, 76);
  }
}
