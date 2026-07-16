import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import { restartRound } from '../engine/RoundRestart';
import { evaluateCnsRuntimeTrigger } from './CnsRuntimeTrigger';
import { stepCnsStateRuntime } from './CnsStateRuntime';

const routeCns = parseCnsText(`
[Statedef 1015]
type = S
movetype = A
ctrl = 0
[State 3310, ChangeState]
type = ChangeState
trigger1 = PrevStateNo = 1010
trigger1 = MoveHit = 1
trigger1 = target(1015), MoveType = H
value = 1016
ctrl = 1
[State 3310, alternate group]
type = ChangeState
triggerall = Alive
trigger2 = PrevStateNo = 9999
value = 1999
[Statedef 1016]
type = S
movetype = I
ctrl = 0
`);

describe('Issue #65 target(ID) redirect and composite trigger', () => {
  it('resolves target(ID) by HitDef id rather than StateNo or runtime player id', () => {
    const state = createInitialGameState();
    const owner = {
      ...state.players[0],
      moveType: 'H' as const,
      targets: [{ playerId: 2, hitDefId: 1015, activeHitDefId: 77 }],
    };
    const target = { ...state.players[1], stateNo: 5000, moveType: 'H' as const };

    expect(evaluateCnsRuntimeTrigger('target(1015), MoveType = H', { player: owner, opponent: target })).toBe(true);
    expect(evaluateCnsRuntimeTrigger('target(5000), MoveType = H', { player: owner, opponent: target })).toBe(false);
    expect(evaluateCnsRuntimeTrigger('target(2), MoveType = H', { player: owner, opponent: target })).toBe(false);
  });

  it('returns SFalse for both equality and inequality when the requested target is absent', () => {
    const state = createInitialGameState();
    expect(evaluateCnsRuntimeTrigger('target(1015), MoveType = H', { player: state.players[0], opponent: state.players[1] })).toBe(false);
    expect(evaluateCnsRuntimeTrigger('target(1015), MoveType != H', { player: state.players[0], opponent: state.players[1] })).toBe(false);
  });

  it('reads redirected MoveType, not self MoveType', () => {
    const state = createInitialGameState();
    const owner = {
      ...state.players[0], moveType: 'H' as const,
      targets: [{ playerId: 2, hitDefId: 1015, activeHitDefId: 77 }],
    };
    expect(evaluateCnsRuntimeTrigger('target(1015), MoveType = H', {
      player: owner,
      opponent: { ...state.players[1], moveType: 'I' },
    })).toBe(false);
  });

  it('routes 1015 to 1016 only when all three trigger1 records pass and applies ctrl=1', () => {
    const state = createInitialGameState();
    state.players = [{
      ...state.players[0],
      stateNo: 1015,
      prevStateNo: 1010,
      ctrl: false,
      moveType: 'A',
      moveContact: { activeHitDefId: 77, contact: true, hit: true, guarded: false, hitCount: 1 },
      targets: [{ playerId: 2, hitDefId: 1015, activeHitDefId: 77 }],
    }, { ...state.players[1], stateNo: 5000, moveType: 'H' }];

    const result = stepCnsStateRuntime(state, routeCns, { gameTime: 55 });

    expect(result.state.players[0], result.state.players[0].hitDiagnosticLines?.join('\n')).toMatchObject({ stateNo: 1016, prevStateNo: 1015, ctrl: true });
    expect(result.traces[0].executedControllers).toContain('ChangeState');
    expect(result.state.players[0].hitDiagnosticLines?.join('\n')).toContain('targetRedirectRequestedId=1015 targetRedirectResolvedEntityId=2 targetRedirectFound=1');
    expect(result.state.players[0].hitDiagnosticLines?.join('\n')).toContain('triggerGroup aggregateResult=1 ChangeState=eligible targetState=1016');
  });

  it.each([
    ['wrong previous state', { prevStateNo: 1000 }],
    ['miss', { moveContact: { activeHitDefId: 77, contact: false, hit: false, guarded: false, hitCount: 0 } }],
    ['guard', { moveContact: { activeHitDefId: 77, contact: true, hit: false, guarded: true, hitCount: 0 } }],
    ['target absent', { targets: [] }],
  ])('does not route when %s', (_label, override) => {
    const state = createInitialGameState();
    const base = {
      ...state.players[0], stateNo: 1015, prevStateNo: 1010, ctrl: false, moveType: 'A' as const,
      moveContact: { activeHitDefId: 77, contact: true, hit: true, guarded: false, hitCount: 1 },
      targets: [{ playerId: 2, hitDefId: 1015, activeHitDefId: 77 }],
    };
    state.players = [{ ...base, ...override }, { ...state.players[1], moveType: 'H' }];
    expect(stepCnsStateRuntime(state, routeCns).state.players[0].stateNo).toBe(1015);
  });

  it('keeps immediate PrevStateNo across same-frame transitions and resets it with the round', () => {
    const cns = parseCnsText(`
[Statedef 1010]
[State 1010, first]
type = ChangeState
trigger1 = Time = 0
value = 1015
[Statedef 1015]
[State 1015, second]
type = ChangeState
trigger1 = PrevStateNo = 1010
value = 1016
[Statedef 1016]
`);
    const state = createInitialGameState();
    state.players = [{ ...state.players[0], stateNo: 1010 }, state.players[1]];

    expect(stepCnsStateRuntime(state, cns).state.players[0]).toMatchObject({ stateNo: 1016, prevStateNo: 1015 });
    expect(restartRound(1).gameState.players[0]).toMatchObject({ stateNo: 0 });
    expect(restartRound(1).gameState.players[0].prevStateNo).toBeUndefined();
  });

  it('executes the bundled T-H-M-A State 1015 controller without a state-number special case', async () => {
    const source = await readFile('public/chars/T-H-M-A/T-H-M-A/T-H-M-Awaza.cns', 'utf8');
    const cns = parseCnsText(source);
    const state = createInitialGameState();
    state.players = [{
      ...state.players[0], stateNo: 1015, prevStateNo: 1010, stateTime: 1, ctrl: false, moveType: 'A',
      moveContact: { activeHitDefId: 77, contact: true, hit: true, guarded: false, hitCount: 1 },
      targets: [{ playerId: 2, hitDefId: 1015, activeHitDefId: 77 }],
    }, { ...state.players[1], stateNo: 5000, moveType: 'H' }];

    const result = stepCnsStateRuntime(state, cns, { gameTime: 99, getAnimationDuration: () => 100 });

    expect(result.state.players[0], result.state.players[0].hitDiagnosticLines?.join('\n')).toMatchObject({ stateNo: 1016, prevStateNo: 1015, ctrl: true });
  });
});
