import type { GameState } from '../core/engine/types';
import type { RoundScore } from '../core/engine/RoundScore';
import type { RoundState } from '../core/engine/RoundState';

export type LifeBarRenderContext = {
  ctx: CanvasRenderingContext2D;
  state: GameState;
  roundState?: RoundState;
  roundScore?: RoundScore;
  viewportWidth: number;
  diagnosticsEnabled: boolean;
};

export interface LifeBarRuntime {
  readonly engine: 'winmugen' | 'webmugen';
  readonly id: string;
  update(state: GameState, round?: RoundState, score?: RoundScore): void;
  renderBehindPlayers(context: LifeBarRenderContext): string[];
  renderForeground(context: LifeBarRenderContext): void;
  dispose(): void;
}
