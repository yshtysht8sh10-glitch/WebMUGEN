import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from './GameState';
import { stepGameByCns } from './CnsGame';

describe('CnsGame stage rules', () => {
  const idleCns = parseCnsText(`
[StateDef 0]
type = S
movetype = I
physics = S
anim = 0
ctrl = 1
`);

  it('faces players toward each other after CNS movement', () => {
    const state = createInitialGameState();
    const next = stepGameByCns(
      {
        ...state,
        players: [
          { ...state.players[0], x: 500, facing: 1 },
          { ...state.players[1], x: 420, facing: -1 },
        ],
      },
      idleCns,
      {
        p1: { left: false, right: false, up: false, down: false, attack: false },
      },
    );

    expect(next.players[0].facing).toBe(-1);
    expect(next.players[1].facing).toBe(1);
  });

  it('pushes overlapping players apart after CNS movement', () => {
    const state = createInitialGameState();
    const next = stepGameByCns(
      {
        ...state,
        players: [
          { ...state.players[0], x: 300 },
          { ...state.players[1], x: 320 },
        ],
      },
      idleCns,
      {
        p1: { left: false, right: false, up: false, down: false, attack: false },
      },
    );

    expect(Math.abs(next.players[1].x - next.players[0].x)).toBeGreaterThanOrEqual(44);
  });

  it('honors PlayerPush = 0 during stage separation', () => {
    const noPushCns = parseCnsText(`
[StateDef 0]
type = S
movetype = I
physics = S
anim = 0
ctrl = 1

[State 0, Disable player push]
type = PlayerPush
trigger1 = time >= 0
value = 0
`);
    const state = createInitialGameState();
    const next = stepGameByCns(
      {
        ...state,
        players: [
          { ...state.players[0], x: 300 },
          { ...state.players[1], x: 320 },
        ],
      },
      noPushCns,
      {
        p1: { left: false, right: false, up: false, down: false, attack: false },
      },
    );

    expect(next.players[0].playerPush).toBe(false);
    expect(next.players[1].playerPush).toBe(false);
    expect(next.players[0].x).toBe(300);
    expect(next.players[1].x).toBe(320);
  });

  it('restores player push on the next frame when no PlayerPush controller executes', () => {
    const state = createInitialGameState();
    const next = stepGameByCns(
      {
        ...state,
        players: [
          { ...state.players[0], x: 300, playerPush: false },
          { ...state.players[1], x: 320, playerPush: false },
        ],
      },
      idleCns,
      {
        p1: { left: false, right: false, up: false, down: false, attack: false },
      },
    );

    expect(next.players[0].playerPush).toBe(true);
    expect(next.players[1].playerPush).toBe(true);
    expect(Math.abs(next.players[1].x - next.players[0].x)).toBeGreaterThanOrEqual(44);
  });
});
