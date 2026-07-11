import { describe, expect, it } from 'vitest';
import { parseAirText } from '../../parser/air/AirParser';
import { createInitialGameState } from './GameState';
import { resolveFallbackHits } from './FallbackHitResolver';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';

const air = parseAirText(`
[Begin Action 0]
Clsn2Default: 1
 Clsn2[0] = -20,-80,20,0
0,0, 0,0, 5

[Begin Action 200]
Clsn2Default: 1
 Clsn2[0] = -20,-80,20,0
Clsn1: 1
 Clsn1[0] = 10,-60,70,-30
200,0, 0,0, 5
`);

describe('FallbackHitResolver', () => {
  it.each([25, 137])('applies CNS HitDef damage %i to the live hit path', (damage) => {
    const cns = parseCnsText(`
[Statedef 200]
type = S
movetype = A
physics = S

[State 200, Hit]
type = HitDef
trigger1 = 1
damage = ${damage}, 0
`);
    const initial = createInitialGameState();
    const runtime = stepCnsStateRuntime({
      ...initial,
      players: [
        { ...initial.players[0], x: 240, stateNo: 200, animNo: 200, moveType: 'A' },
        { ...initial.players[1], x: 290, animNo: 0 },
      ],
    }, cns).state;

    const next = resolveFallbackHits(runtime, air);

    expect(runtime.players[0].activeHitDef?.damage).toBe(damage);
    expect(next.players[1].life).toBe(1000 - damage);
    expect(next.hitEvents[0]?.damage).toBe(damage);
  });

  it('does not reset one-hit control when HitDef executes again', () => {
    const cns = parseCnsText(`
[Statedef 200]
type = S
movetype = A
physics = S

[State 200, Hit]
type = HitDef
trigger1 = 1
damage = 25
`);
    const initial = createInitialGameState();
    const runtime = stepCnsStateRuntime({
      ...initial,
      players: [
        { ...initial.players[0], stateNo: 200, moveType: 'A', hitDefUsed: true },
        initial.players[1],
      ],
    }, cns).state;

    expect(runtime.players[0].activeHitDef?.damage).toBe(25);
    expect(runtime.players[0].hitDefUsed).toBe(true);
  });

  it('applies fallback hit when attack Clsn overlaps body Clsn', () => {
    const state = createInitialGameState();
    const next = resolveFallbackHits(
      {
        ...state,
        players: [
          {
            ...state.players[0],
            x: 240,
            y: 285,
            facing: 1,
            stateNo: 200,
            animNo: 200,
            moveType: 'A',
            hitDefUsed: false,
          },
          {
            ...state.players[1],
            x: 290,
            y: 285,
            facing: -1,
            stateNo: 0,
            animNo: 0,
            moveType: 'I',
          },
        ],
      },
      air,
    );

    expect(next.hitEvents).toHaveLength(1);
    expect(next.players[1].life).toBe(940);
    expect(next.players[1].stateNo).toBe(5000);
    expect(next.players[0].hitDefUsed).toBe(true);
  });

  it('does not hit twice while hitDefUsed is true', () => {
    const state = createInitialGameState();
    const next = resolveFallbackHits(
      {
        ...state,
        players: [
          {
            ...state.players[0],
            x: 240,
            y: 285,
            facing: 1,
            stateNo: 200,
            animNo: 200,
            moveType: 'A',
            hitDefUsed: true,
          },
          {
            ...state.players[1],
            x: 290,
            y: 285,
            facing: -1,
            stateNo: 0,
            animNo: 0,
            moveType: 'I',
          },
        ],
      },
      air,
    );

    expect(next.hitEvents).toHaveLength(0);
    expect(next.players[1].life).toBe(1000);
  });

  it('does not keep stale hit events when no new contact occurs', () => {
    const state = createInitialGameState();
    const next = resolveFallbackHits(
      {
        ...state,
        hitEvents: [{ attackerId: 1, defenderId: 2, damage: 60 }],
        players: [
          {
            ...state.players[0],
            x: 120,
            y: 285,
            facing: 1,
            stateNo: 0,
            animNo: 0,
            moveType: 'I',
            hitDefUsed: false,
          },
          {
            ...state.players[1],
            x: 420,
            y: 285,
            facing: -1,
            stateNo: 0,
            animNo: 0,
            moveType: 'I',
          },
        ],
      },
      air,
    );

    expect(next.hitEvents).toHaveLength(0);
  });
});
