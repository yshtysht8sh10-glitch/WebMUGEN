import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { InputBuffer } from '../../input/InputBuffer';
import { hasCommand, resolveCommands } from '../../input/CommandResolver';
import { parseCmdText } from '../../parser/cmd/CmdParser';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsStateRuntime } from './CnsStateRuntime';

const source = new TextDecoder('shift_jis').decode(
  readFileSync('public/chars/T-H-M-A/T-H-M-A/T-H-M-A.cmd'),
);
const commands = parseCmdText(source);
const commandStates = parseCnsText(source, { sourceFile: 'T-H-M-A.cmd' });

function runRealCommand(button: 'x' | 'y') {
  const name = `ダークネスフィンガー 撃ち付け${button}`;
  const inputs = [
    { left: false, right: false, up: false, down: true, attack: false },
    { left: true, right: false, up: false, down: true, attack: false },
    { left: true, right: false, up: false, down: false, attack: false },
    { left: false, right: true, up: false, down: false, attack: false },
    { left: false, right: false, up: false, down: false, attack: false, buttons: [button] },
  ];
  const buffer = new InputBuffer(60);
  for (const input of inputs) buffer.push(input, 1);
  const resolved = resolveCommands(commands, inputs[inputs.length - 1], buffer, 1);

  const stateMinusOne = commandStates.states.find((state) => state.stateNo === -1);
  const filteredControllers =
    stateMinusOne?.controllers.filter(
      (controller) =>
        controller.type.toLowerCase() === 'changestate' &&
        controller.triggers.some((trigger) => trigger.expression.includes(name)),
    ) ?? [];
  const cns = {
    states: [
      { ...stateMinusOne!, controllers: filteredControllers },
      {
        stateNo: 0,
        stateType: 'S',
        moveType: 'I',
        physics: 'S',
        ctrl: true,
        initialAnim: 0,
        controllers: [],
      },
      {
        stateNo: 3400,
        stateType: 'S',
        moveType: 'A',
        physics: 'S',
        ctrl: false,
        controllers: [],
      },
      {
        stateNo: 3405,
        stateType: 'S',
        moveType: 'A',
        physics: 'S',
        ctrl: false,
        controllers: [],
      },
    ],
    metadataSections: commandStates.metadataSections,
  };
  const initial = createInitialGameState();
  const result = stepCnsStateRuntime({
    ...initial,
    players: [
      { ...initial.players[0], vars: { 11: 1, 33: 0 }, fvars: { 12: 0 } },
      initial.players[1],
    ],
  }, cns, {
    p1Commands: resolved.activeCommandNames,
    p2Commands: new Set(),
  });

  return { name, resolved, result, filteredControllers };
}

function runProximityCommand(button: 'x' | 'a', axisDistance: number) {
  const destinations = button === 'x' ? [200, 203] : [230, 232];
  const stateMinusOne = commandStates.states.find((state) => state.stateNo === -1);
  const filteredControllers = stateMinusOne?.controllers.filter((controller) =>
    controller.type.toLowerCase() === 'changestate' && destinations.includes(Number(controller.params.value))) ?? [];
  const cns = {
    states: [
      { ...stateMinusOne!, controllers: filteredControllers },
      {
        stateNo: 0, stateType: 'S', moveType: 'I', physics: 'S', ctrl: true, initialAnim: 0, controllers: [],
      },
      ...destinations.map((stateNo) => ({
        stateNo, stateType: 'S', moveType: 'A', physics: 'S', ctrl: false, initialAnim: stateNo, controllers: [],
      })),
    ],
    metadataSections: commandStates.metadataSections,
  };
  const initial = createInitialGameState();
  return stepCnsStateRuntime({
    ...initial,
    players: [
      { ...initial.players[0], x: 300, facing: 1, vars: { 33: 0 } },
      { ...initial.players[1], x: 300 + axisDistance, facing: -1 },
    ],
  }, cns, {
    p1Commands: new Set([button]),
    p2Commands: new Set(),
  });
}

describe('real T-H-M-A release command integration', () => {
  it.each([
    ['x', 3405],
    ['y', 3400],
  ] as const)('routes the real %s CMD through State -1 to State %i', (button, stateNo) => {
    const result = runRealCommand(button);
    expect(result.filteredControllers.length).toBeGreaterThan(0);
    expect(hasCommand(result.resolved, result.name)).toBe(true);
    expect(result.result.state.players[0].stateNo).toBe(stateNo);
    expect(result.result.traces[0].executedControllers).toContain('ChangeState');
  });
});

describe('real T-H-M-A proximity attack routing', () => {
  it.each([
    ['x', 32, 200],
    ['x', 80, 203],
    ['a', 32, 232],
    ['a', 80, 230],
  ] as const)('routes %s at axis distance %i to State %i', (button, axisDistance, stateNo) => {
    const result = runProximityCommand(button, axisDistance);
    expect(result.state.players[0].stateNo).toBe(stateNo);
    expect(result.traces[0].executedControllers).toContain('ChangeState');
  });
});
