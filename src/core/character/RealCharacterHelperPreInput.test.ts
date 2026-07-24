import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { createInitialGameState } from '../engine/GameState';

describe('bundled T-H-M-A pre-input Helper', () => {
  it('snapshots size and pause allowances from the real Helper 5502 controller', () => {
    const globals = parseCnsText(readFileSync('public/chars/T-H-M-A/T-H-M-A/T-H-M-A-2.cns', 'utf8'));
    const states = parseCnsText(readFileSync('public/chars/T-H-M-A/T-H-M-A/T-H-M-Atokusyudousa.cns', 'utf8'));
    const stateMinus2 = globals.states.find((state) => state.stateNo === -2)!;
    const helperController = stateMinus2.controllers.find((controller) => (
      controller.type.toLowerCase() === 'helper' && Number(controller.params.id) === 5502
    ))!;
    const helperState = states.states.find((state) => state.stateNo === 5502)!;
    const cns = {
      metadataSections: [...globals.metadataSections, ...states.metadataSections],
      states: [{ ...stateMinus2, controllers: [helperController] }, helperState],
    };
    const initial = createInitialGameState();
    initial.players[0] = { ...initial.players[0], vars: { 16: 3200 } };

    const result = stepCnsStateRuntime(initial, cns);

    expect(result.state.helpers.entries).toHaveLength(1);
    expect(result.state.helpers.entries[0]).toMatchObject({
      helperId: 5502,
      pauseMoveTime: 10000,
      superMoveTime: 10000,
      player: { stateNo: 5502, collisionWidth: { xScale: 0.5, yScale: 0.5 } },
    });
    expect(result.state.hitDiagnosticLines?.join('\n')).toContain('scale=(0.5,0.5) pausemovetime=10000 supermovetime=10000');
  });
});
