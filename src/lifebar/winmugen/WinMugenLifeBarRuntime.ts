import type { GameState } from '../../core/engine/types';
import type { RoundScore } from '../../core/engine/RoundScore';
import type { RoundState } from '../../core/engine/RoundState';
import type { LifeBarRenderContext, LifeBarRuntime } from '../LifeBarRuntime';
import { WinMugenLifeBarRenderer } from './WinMugenLifeBarRenderer';
import type { WinMugenLifeBarDefinition } from './WinMugenLifeBarTypes';

export class WinMugenLifeBarRuntime implements LifeBarRuntime {
  readonly engine = 'winmugen' as const;
  readonly id: string;
  private readonly renderer = new WinMugenLifeBarRenderer();
  constructor(private readonly definition: WinMugenLifeBarDefinition) { this.id = definition.id; }
  update(_state: GameState, _round?: RoundState, _score?: RoundScore): void {}
  renderBehindPlayers(context: LifeBarRenderContext): string[] { return this.renderer.renderBehindPlayers(this.definition, context); }
  renderForeground(context: LifeBarRenderContext): void { this.renderer.renderForeground(this.definition, context); }
  dispose(): void {}
}
