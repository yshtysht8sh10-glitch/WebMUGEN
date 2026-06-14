import type { RoundState } from '../../core/engine/RoundState';

export class RoundStateRenderer {
  render(ctx: CanvasRenderingContext2D, round: RoundState): void {
    ctx.save();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(426, 14, 108, 34);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px monospace';
    ctx.fillText(String(round.timer).padStart(2, '0'), 462, 39);

    if (round.phase === 'ko' || round.phase === 'timeOver') {
      const text = round.phase === 'ko' ? 'K.O.' : 'TIME OVER';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
      ctx.fillRect(350, 190, 260, 78);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 42px monospace';
      ctx.fillText(text, round.phase === 'ko' ? 426 : 362, 240);

      ctx.font = 'bold 18px monospace';
      ctx.fillText(formatWinner(round.winner), 420, 264);
    }

    ctx.restore();
  }
}

function formatWinner(winner: RoundState['winner']): string {
  if (winner === null) return '';
  if (winner === 'draw') return 'DRAW';
  return `P${winner} WINS`;
}
