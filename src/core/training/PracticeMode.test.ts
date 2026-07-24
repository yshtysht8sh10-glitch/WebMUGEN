import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../engine/GameState';
import { createInitialRoundState, stepRoundState } from '../engine/RoundState';
import { applyPracticeModeRecovery, FULL_LIFE } from './PracticeMode';

describe('Practice Mode recovery', () => {
  it('fully recovers a player at zero life and clears the KO reason', () => {
    const initial = createInitialGameState();
    const state = {
      ...initial,
      players: [
        initial.players[0],
        { ...initial.players[1], life: 0, koReason: 'hit' as const, stateNo: 5000 },
      ] as typeof initial.players,
    };

    const recovered = applyPracticeModeRecovery(state, true);

    expect(recovered.players[1]).toMatchObject({ life: FULL_LIFE, stateNo: 5000 });
    expect(recovered.players[1].koReason).toBeUndefined();
    expect(recovered.hitDiagnosticLines).toContain(
      'raw.practice_mode timing=before_round entity=p2 before=0 after=1000 result=full_recovery',
    );
  });

  it('recovers both players after a simultaneous lethal frame', () => {
    const initial = createInitialGameState();
    const recovered = applyPracticeModeRecovery({
      ...initial,
      players: initial.players.map((player) => ({ ...player, life: 0 })) as typeof initial.players,
    }, true);

    expect(recovered.players.map((player) => player.life)).toEqual([FULL_LIFE, FULL_LIFE]);
  });

  it('prevents the recovered frame from entering the KO phase', () => {
    const initial = createInitialGameState();
    const lethal = {
      ...initial,
      players: [initial.players[0], { ...initial.players[1], life: 0 }] as typeof initial.players,
    };
    const recovered = applyPracticeModeRecovery(lethal, true);
    const round = stepRoundState({ ...createInitialRoundState(), phase: 'fight' }, recovered);

    expect(round.phase).toBe('fight');
    expect(round.winner).toBeNull();
  });

  it('does not mutate the state when disabled or when both players are alive', () => {
    const initial = createInitialGameState();
    const lethal = {
      ...initial,
      players: [initial.players[0], { ...initial.players[1], life: 0 }] as typeof initial.players,
    };

    expect(applyPracticeModeRecovery(lethal, false)).toBe(lethal);
    expect(applyPracticeModeRecovery(initial, true)).toBe(initial);
  });
});
