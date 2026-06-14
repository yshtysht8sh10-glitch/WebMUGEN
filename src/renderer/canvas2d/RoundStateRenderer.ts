import type { RoundState } from '../../core/engine/RoundState';

export class RoundStateRenderer {
  render(ctx: CanvasRenderingContext2D, round: RoundState): void {
    ctx.save();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(426, 14, 108, 34);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px monospace';
    ctx.fillText(String(round.timer).padStart(2, '0'), 462, 39);

    ctx.font = 'bold 12px monospace';
    ctx.fillText(`ROUND ${round.roundNo}`, 444, 62);

    if (round.phase === 'intro') {
      this.drawIntro(ctx, round);
    }

    if (round.phase === 'ko' || round.phase === 'timeOver') {
      const text = round.phase === 'ko' ? 'K.O.' : 'TIME OVER';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
      ctx.fillRect(330, 186, 300, 104);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 42px monospace';
      ctx.fillText(text, round.phase === 'ko' ? 426 : 362, 236);

      ctx.font = 'bold 18px monospace';
      ctx.fillText(formatWinner(round.winner), 420, 264);

      ctx.font = 'bold 14px monospace';
      ctx.fillText('PRESS R TO RESTART', 396, 284);
    }

    ctx.restore();
  }

  private drawIntro(ctx: CanvasRenderingContext2D, round: RoundState): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
    ctx.fillRect(330, 186, 300, 92);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px monospace';

    if (round.frameInPhase < 45) {
      ctx.fillText(`ROUND ${round.roundNo}`, 402, 238);
      return;
    }

    ctx.font = 'bold 46px monospace';
    ctx.fillText('FIGHT!', 398, 244);
  }
}

function formatWinner(winner: RoundState['winner']): string {
  if (winner === null) return '';
  if (winner === 'draw') return 'DRAW';
  return `P${winner} WINS`;
}
