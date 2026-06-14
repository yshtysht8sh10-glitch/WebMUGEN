import type { GameState, HitEvent, PlayerState } from './types';

export type HitSpark = {
  id: number;
  x: number;
  y: number;
  life: number;
  attackerId: 1 | 2;
  defenderId: 1 | 2;
  damage: number;
};

export type HitFeedbackState = {
  sparks: HitSpark[];
  nextSparkId: number;
};

export function createInitialHitFeedbackState(): HitFeedbackState {
  return {
    sparks: [],
    nextSparkId: 1,
  };
}

export function updateHitFeedback(
  feedback: HitFeedbackState,
  gameState: GameState,
): HitFeedbackState {
  const decayed = feedback.sparks
    .map((spark) => ({ ...spark, life: spark.life - 1 }))
    .filter((spark) => spark.life > 0);

  let nextSparkId = feedback.nextSparkId;
  const added = gameState.hitEvents.map((event) => {
    const attacker = getPlayer(gameState.players, event.attackerId);
    const defender = getPlayer(gameState.players, event.defenderId);

    const spark: HitSpark = {
      id: nextSparkId,
      x: (attacker.x + defender.x) / 2,
      y: Math.min(attacker.y, defender.y) - 52,
      life: 18,
      attackerId: event.attackerId,
      defenderId: event.defenderId,
      damage: event.damage,
    };

    nextSparkId += 1;
    return spark;
  });

  return {
    sparks: [...decayed, ...added],
    nextSparkId,
  };
}

function getPlayer(players: [PlayerState, PlayerState], id: 1 | 2): PlayerState {
  return players[id - 1];
}
