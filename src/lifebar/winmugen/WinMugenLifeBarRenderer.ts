import type { LifeBarRenderContext } from '../LifeBarRuntime';
import type { WinMugenLifeBarDefinition } from './WinMugenLifeBarTypes';

export class WinMugenLifeBarRenderer {
  renderBehindPlayers(_definition: WinMugenLifeBarDefinition, context: LifeBarRenderContext): string[] {
    const { ctx, state, roundState, roundScore, viewportWidth } = context;
    const offset = (viewportWidth - 640) / 2;
    const [p1, p2] = state.players;
    ctx.fillStyle = '#181818'; ctx.fillRect(18 + offset, 14, 264, 20); ctx.fillRect(358 + offset, 14, 264, 20);
    ctx.fillStyle = '#f4b942'; ctx.fillRect(20 + offset, 16, 260 * Math.max(0, p1.life / 1000), 14); ctx.fillRect(620 + offset - 260 * Math.max(0, p2.life / 1000), 16, 260 * Math.max(0, p2.life / 1000), 14);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = 'bold 22px sans-serif';
    if (roundState) ctx.fillText(String(roundState.timer).padStart(2, '0'), viewportWidth / 2, 30);
    if (roundScore) { ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(`P1 ${roundScore.p1Wins}`, 20 + offset, 48); ctx.textAlign = 'right'; ctx.fillText(`P2 ${roundScore.p2Wins}`, 620 + offset, 48); }
    return [];
  }
  renderForeground(_definition: WinMugenLifeBarDefinition, _context: LifeBarRenderContext): void {}
}
