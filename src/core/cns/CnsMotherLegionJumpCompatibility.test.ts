import { describe, expect, it } from 'vitest';
import { resolveCommands } from '../../input/CommandResolver';
import { InputBuffer } from '../../input/InputBuffer';
import { parseCmdText } from '../../parser/cmd/CmdParser';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsStateRuntime } from './CnsStateRuntime';

const cmd = parseCmdText(`
[Command]
name = "up"
command = U
time = 1

[Command]
name = "holdup"
command = /$U
time = 1
`);

const cns = parseCnsText(`
[Statedef 50]
type = A
physics = A

[State 50, upward control]
type = VelAdd
trigger1 = time <= 60
trigger1 = command = "up"
y = -2
`);

describe('Mother_Legion State 50 direction compatibility', () => {
  it('applies command = U once instead of every frame while Up remains held', () => {
    const initial = createInitialGameState();
    let state = {
      ...initial,
      players: [
        {
          ...initial.players[0],
          stateNo: 50,
          stateType: 'A' as const,
          physics: 'A' as const,
          vy: -5,
        },
        initial.players[1],
      ] as typeof initial.players,
    };
    const buffer = new InputBuffer();
    const heldUp = { left: false, right: false, up: true, down: false, attack: false };

    buffer.push(heldUp);
    const pressedCommands = resolveCommands(cmd, heldUp, buffer).activeCommandNames;
    state = stepCnsStateRuntime(state, cns, { p1Commands: pressedCommands }).state;
    expect(pressedCommands).toContain('up');
    expect(state.players[0].vy).toBe(-7);

    buffer.push(heldUp);
    const heldCommands = resolveCommands(cmd, heldUp, buffer).activeCommandNames;
    state = stepCnsStateRuntime(state, cns, { p1Commands: heldCommands }).state;
    expect(heldCommands).toContain('holdup');
    expect(heldCommands).not.toContain('up');
    expect(state.players[0].vy).toBe(-7);
  });
});
