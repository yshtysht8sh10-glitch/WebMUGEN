import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { createInitialGameState } from '../engine/GameState';

const decoder = new TextDecoder('shift_jis');
const cns = parseCnsText(decoder.decode(readFileSync('public/chars/itoko/itoko.cns')));

describe('real itoko enemy-raid compatibility', () => {
  it('applies default GetHitVar yaccel after State 197 enters State 5050 without a HitDef contact', () => {
    const initial = createInitialGameState();
    let state = {
      ...initial,
      players: [{
        ...initial.players[0],
        stateNo: 197,
        stateTime: 21,
        animNo: 198,
        animTime: 21,
        stateType: 'A' as const,
        moveType: 'I' as const,
        physics: 'N' as const,
        ctrl: false,
        x: 315,
        y: 185,
        vx: 25,
        vy: 0,
        getHitVars: undefined,
      }, initial.players[1]] as typeof initial.players,
    };

    state = stepCnsStateRuntime(state, cns, { screenWidth: 320 }).state;
    expect(state.players[0]).toMatchObject({ stateNo: 5050, moveType: 'H', vx: -2 });
    expect(state.players[0].vy).toBeCloseTo(-7.65);

    const velocities = [state.players[0].vy];
    for (let frame = 0; frame < 24; frame += 1) {
      state = stepCnsStateRuntime(state, cns, { screenWidth: 320 }).state;
      velocities.push(state.players[0].vy);
    }

    expect(velocities.some((velocity) => velocity >= 0)).toBe(true);
    expect(state.players[0].stateNo).toBe(5050);
  });
});
