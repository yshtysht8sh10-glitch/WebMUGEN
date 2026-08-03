import type { RoundScore } from '../../core/engine/RoundScore';
import type { RoundState } from '../../core/engine/RoundState';
import type { HudTheme } from '../../app/RuntimeSettings';

export class RoundStateRenderer {
  render(ctx: CanvasRenderingContext2D, round: RoundState, score?: RoundScore, viewportWidth = 640, theme: HudTheme = 'fresh'): void {
    this.renderHud(ctx, round, score, viewportWidth, theme);
    this.renderPresentation(ctx, round, viewportWidth);
  }

  renderHud(ctx: CanvasRenderingContext2D, round: RoundState, score?: RoundScore, viewportWidth = 640, theme: HudTheme = 'fresh'): void {
    ctx.save();
    const centerX = viewportWidth / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = theme === 'cyber' ? 'rgba(2, 8, 23, 0.92)' : '#18324f';
    ctx.fillRect(centerX - 46, 10, 92, 34);
    ctx.strokeStyle = theme === 'cyber' ? '#22d3ee' : '#d8edf3';
    if (typeof ctx.strokeRect === 'function') ctx.strokeRect(centerX - 46.5, 9.5, 93, 35);

    ctx.fillStyle = theme === 'cyber' ? '#a5f3fc' : '#ffffff';
    ctx.font = '800 25px "Arial Narrow", "Segoe UI", sans-serif';
    ctx.fillText(String(round.timer).padStart(2, '0'), centerX, 28);

    ctx.font = '700 11px "Segoe UI", sans-serif';
    ctx.fillText(`ROUND ${round.roundNo}`, centerX, 54);

    if (score) {
      this.drawScore(ctx, score, viewportWidth, theme);
    }

    ctx.restore();
  }

  renderPresentation(ctx: CanvasRenderingContext2D, round: RoundState, viewportWidth = 640): void {
    if (round.phase === 'intro' && round.introPresentationFrame === null) return;
    if (round.phase !== 'intro' && round.phase !== 'ko' && round.phase !== 'timeOver') return;

    ctx.save();
    const centerX = viewportWidth / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (round.phase === 'intro') this.drawIntro(ctx, round, centerX);

    if (round.phase === 'ko' || round.phase === 'timeOver') {
      const text = round.phase === 'ko' ? 'K.O.' : 'TIME OVER';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
      ctx.fillRect(centerX - 150, 186, 300, 104);
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 42px "Arial Narrow", "Segoe UI", sans-serif';
      ctx.fillText(text, centerX, 236);

      ctx.font = '800 18px "Segoe UI", sans-serif';
      ctx.fillText(formatWinner(round.winner), centerX, 264);

      ctx.font = '700 14px "Segoe UI", sans-serif';
      ctx.fillText('PRESS R TO RESTART', centerX, 284);
    }

    ctx.restore();
  }

  private drawScore(ctx: CanvasRenderingContext2D, score: RoundScore, viewportWidth: number, theme: HudTheme): void {
    const offsetX = (viewportWidth - 640) / 2;
    if (theme === 'cyber') {
      ctx.fillStyle = 'rgba(2, 8, 23, 0.82)';
      ctx.fillRect(20 + offsetX, 50, 120, 18);
      ctx.fillRect(500 + offsetX, 50, 120, 18);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 11px "Segoe UI", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`P1 WINS ${score.p1Wins}`, 30 + offsetX, 59);
      ctx.textAlign = 'right';
      ctx.fillText(`P2 WINS ${score.p2Wins}`, 610 + offsetX, 59);
    } else {
      ctx.fillStyle = 'rgba(23, 59, 74, 0.58)';
      ctx.font = '600 9px "Segoe UI", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`P1 ${score.p1Wins}`, 28 + offsetX, 57);
      ctx.textAlign = 'right';
      ctx.fillText(`P2 ${score.p2Wins}`, 612 + offsetX, 57);
    }

    if (score.draws > 0) {
      ctx.textAlign = 'center';
      ctx.fillText(`DRAW ${score.draws}`, viewportWidth / 2, 72);
    }
  }

  private drawIntro(ctx: CanvasRenderingContext2D, round: RoundState, centerX: number): void {
    if (round.introPresentationFrame === null) return;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
    ctx.fillRect(centerX - 150, 186, 300, 92);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 32px "Arial Narrow", "Segoe UI", sans-serif';

    if (round.introPresentationFrame < 45) {
      ctx.fillText(`ROUND ${round.roundNo}`, centerX, 238);
      return;
    }

    ctx.font = '900 46px "Arial Narrow", "Segoe UI", sans-serif';
    ctx.fillText('FIGHT!', centerX, 244);
  }
}

function formatWinner(winner: RoundState['winner']): string {
  if (winner === null) return '';
  if (winner === 'draw') return 'DRAW';
  return `P${winner} WINS`;
}
