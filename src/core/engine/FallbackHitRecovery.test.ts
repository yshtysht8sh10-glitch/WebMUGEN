import { describe, expect, it } from 'vitest';
import { createInitialGameState } from './GameState';
import { applyFallbackHitRecovery } from './FallbackHitRecovery';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';

describe('FallbackHitRecovery', () => {
  it.each([1, 2] as const)('keeps P%i unable to act for 120 full hit-stun frames', (targetId) => {
    const cns = parseCnsText(`
[Statedef -1]
[State -1, Input escape]
type = ChangeState
trigger1 = command = "a"
value = 52

[Statedef 5000]
type = S
movetype = H
physics = N
ctrl = 0
[State 5000, To slide]
type = ChangeState
trigger1 = 1
value = 5001

[Statedef 5001]
type = S
movetype = H
physics = S
ctrl = 0
[State 5001, Early control]
type = CtrlSet
trigger1 = 1
value = 1
[State 5001, Early recovery]
type = ChangeState
trigger1 = 1
value = 0
ctrl = 1

[Statedef 0]
type = S
movetype = I
physics = S
ctrl = 1
[Statedef 52]
type = S
movetype = I
physics = S
ctrl = 1
`);
    const initial = createInitialGameState();
    const index = targetId - 1;
    let state = {
      ...initial,
      players: [...initial.players] as typeof initial.players,
    };
    state.players[index] = {
      ...state.players[index],
      stateNo: 5000,
      moveType: 'H',
      ctrl: false,
      hitStun: {
        activeHitDefId: 12,
        selectedHitTime: 120,
        kind: 'ground',
        source: 'active_hitdef',
        targetStateTypeAtHit: 'S',
        elapsed: 0,
        lastStateNo: 5000,
      },
    };

    let guardLog = '';
    for (let frame = 1; frame <= 120; frame += 1) {
      const cnsResult = stepCnsStateRuntime(state, cns, {
        p1Commands: targetId === 1 ? new Set(['a']) : new Set(),
        p2Commands: targetId === 2 ? new Set(['a']) : new Set(),
        hitDiagnostics: true,
      });
      guardLog += `\n${cnsResult.state.players[index].hitDiagnosticLines?.join('\n') ?? ''}`;
      state = applyFallbackHitRecovery(cnsResult.state, true);
      expect(state.players[index].ctrl, `frame ${frame}`).toBe(false);
      expect(state.players[index].stateNo, `frame ${frame}`).toBe(5001);
    }

    expect(guardLog).toContain('controller=CtrlSet value=1');
    expect(guardLog).toContain('reason=early_recovery_state_during_hitstun');
    expect(guardLog).toContain('reason=input_changestate_during_hitstun');
    expect(state.players[index].hitStun?.elapsed).toBe(120);
    const finalCns = stepCnsStateRuntime(state, cns, { hitDiagnostics: true });
    state = applyFallbackHitRecovery(finalCns.state, true);
    expect(state.players[index]).toMatchObject({ stateNo: 0, ctrl: true, moveType: 'I' });
    expect(state.hitDiagnosticLines?.join('\n')).toContain('event=end selectedHitTime=120 elapsed=120 recoveryPath=existing');
  });

  it('keeps a seven-frame hit stun through frame 7 and recovers on the next frame', () => {
    const state = createInitialGameState();
    let player = {
      ...state.players[0],
      stateNo: 5000,
      moveType: 'H' as const,
      ctrl: false,
      hitStun: {
        activeHitDefId: 7,
        selectedHitTime: 7,
        kind: 'ground' as const,
        source: 'active_hitdef' as const,
        targetStateTypeAtHit: 'S' as const,
        elapsed: 0,
        lastStateNo: 5000,
      },
    };
    for (let frame = 1; frame <= 7; frame += 1) {
      player = applyFallbackHitRecovery({ ...state, players: [player, state.players[1]] }).players[0] as typeof player;
      expect(player.ctrl).toBe(false);
    }
    player = applyFallbackHitRecovery({ ...state, players: [player, state.players[1]] }).players[0] as typeof player;
    expect(player).toMatchObject({ stateNo: 0, ctrl: true });
  });
  it('does not recover while hitPause remains', () => {
    const state = createInitialGameState();
    const next = applyFallbackHitRecovery({
      ...state,
      players: [
        {
          ...state.players[0],
          stateNo: 5000,
          animNo: 5000,
          moveType: 'H',
          ctrl: false,
          hitPause: 3,
          stateTime: 99,
        },
        state.players[1],
      ],
    });

    expect(next.players[0].stateNo).toBe(5000);
    expect(next.players[0].moveType).toBe('H');
  });

  it('does not recover before recovery frames', () => {
    const state = createInitialGameState();
    const next = applyFallbackHitRecovery({
      ...state,
      players: [
        {
          ...state.players[0],
          stateNo: 5000,
          animNo: 5000,
          moveType: 'H',
          ctrl: false,
          hitPause: 0,
          stateTime: 10,
        },
        state.players[1],
      ],
    });

    expect(next.players[0].stateNo).toBe(5000);
    expect(next.players[0].ctrl).toBe(false);
  });

  it('recovers hit player to idle', () => {
    const state = createInitialGameState();
    const next = applyFallbackHitRecovery({
      ...state,
      players: [
        {
          ...state.players[0],
          stateNo: 5000,
          animNo: 5000,
          moveType: 'H',
          ctrl: false,
          hitPause: 0,
          stateTime: 28,
          vx: 4,
          hitDefUsed: true,
        },
        state.players[1],
      ],
    });

    expect(next.players[0]).toMatchObject({
      stateNo: 0,
      animNo: 0,
      moveType: 'I',
      ctrl: true,
      vx: 0,
      hitDefUsed: false,
    });
  });
});
