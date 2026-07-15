import type { GameState, HitEvent, PlayerState } from './types';

export type HitSpark = {
  id: number;
  x: number;
  y: number;
  life: number;
  attackerId: 1 | 2;
  defenderId: 1 | 2;
  damage: number;
  animNo?: number;
  scope?: 'common' | 'attacker';
};

export type HitFeedbackState = {
  sparks: HitSpark[];
  nextSparkId: number;
  soundCues?: NonNullable<HitEvent['sound']>[];
  shake?: NonNullable<HitEvent['envShake']> & { remaining: number; elapsed: number };
};

export type EnvironmentShake = NonNullable<HitEvent['envShake']>;

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
  const added = gameState.hitEvents.filter((event) => event.spark?.available !== false && !event.spark?.runtimeIntegrated).map((event) => {
    const attacker = getPlayer(gameState.players, event.attackerId);
    const defender = getPlayer(gameState.players, event.defenderId);

    const spark: HitSpark = {
      id: nextSparkId,
      x: event.spark?.x ?? (attacker.x + defender.x) / 2,
      y: event.spark?.y ?? Math.min(attacker.y, defender.y) - 52,
      life: 18,
      attackerId: event.attackerId,
      defenderId: event.defenderId,
      damage: event.damage,
      animNo: event.spark?.animNo,
      scope: event.spark?.scope,
    };

    nextSparkId += 1;
    return spark;
  });

  const incomingShakes = gameState.hitEvents.map((event) => event.envShake).filter((value): value is NonNullable<HitEvent['envShake']> => Boolean(value));
  const incomingShake = incomingShakes[incomingShakes.length - 1];
  const previousShake = feedback.shake && feedback.shake.remaining > 1
    ? { ...feedback.shake, remaining: feedback.shake.remaining - 1, elapsed: feedback.shake.elapsed + 1 }
    : undefined;
  return {
    sparks: [...decayed, ...added],
    nextSparkId,
    soundCues: gameState.hitEvents.flatMap((event) => event.sound ? [event.sound] : []),
    shake: incomingShake ? { ...incomingShake, remaining: incomingShake.time, elapsed: 0 } : previousShake,
  };
}

export function getScreenShakeOffset(feedback: HitFeedbackState | undefined): { x: number; y: number } {
  if (!feedback?.shake || feedback.shake.remaining <= 0) return { x: 0, y: 0 };
  const radians = ((feedback.shake.phase + feedback.shake.elapsed * feedback.shake.frequency) * Math.PI) / 180;
  return { x: 0, y: Math.sin(radians) * feedback.shake.amplitude };
}

export function startEnvironmentShake(feedback: HitFeedbackState, shake: EnvironmentShake): HitFeedbackState {
  return { ...feedback, shake: { ...shake, remaining: Math.max(0, shake.time), elapsed: 0 } };
}

function getPlayer(players: [PlayerState, PlayerState], id: 1 | 2): PlayerState {
  return players[id - 1];
}
