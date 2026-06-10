import type { GameState, PlayerState } from '../../core/engine/types';

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
    this.drawPlayer(ctx, state.players[0]);
    this.drawDebug(ctx, state);
  }

  private drawStage(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#26351e';
    ctx.fillRect(0, 285, this.canvas.width, 80);
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, player: PlayerState): void {
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath();
    ctx.ellipse(player.x, 305, 32, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.scale(player.facing, 1);

    const isAttack = player.stateNo === 200;
    const isWalk = player.stateNo === 20;
    const bob = isWalk ? Math.sin(player.stateTime / 3) * 3 : 0;

    ctx.fillStyle = isAttack ? '#ffcc66' : '#66ccff';
    ctx.fillRect(-16, -58 + bob, 32, 58);

    ctx.fillStyle = '#ffe0bd';
    ctx.fillRect(-13, -78 + bob, 26, 22);

    ctx.fillStyle = '#222';
    ctx.fillRect(4, -71 + bob, 4, 4);

    ctx.fillStyle = '#66ccff';
    if (isAttack && player.animTime > 4 && player.animTime < 12) {
      ctx.fillRect(14, -48 + bob, 42, 10);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(52, -50 + bob, 22, 14);
    } else {
      ctx.fillRect(14, -46 + bob, 10, 28);
    }

    ctx.restore();
  }

  private drawDebug(ctx: CanvasRenderingContext2D, state: GameState): void {
    const player = state.players[0];
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.fillText(
      `frame=${state.frame} state=${player.stateNo} time=${player.stateTime} anim=${player.animNo}`,
      12,
      22,
    );
    ctx.fillText(`x=${player.x.toFixed(1)} vx=${player.vx.toFixed(1)}`, 12, 42);
  }
}
