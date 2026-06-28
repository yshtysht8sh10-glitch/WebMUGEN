import { describe, expect, it } from 'vitest';
import { stepGame } from './Engine';
import type { FrameInput, GameState, PlayerInput, PlayerState } from './types';

function createPlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id: 1,
    x: 120,
    y: 285,
    vx: 0,
    vy: 0,
    facing: 1,
    life: 1000,
    stateNo: 0,
    stateTime: 0,
    stateType: 'S',
    moveType: 'I',
    physics: 'S',
    ctrl: true,
    animNo: 0,
    animTime: 0,
    hitPause: 0,
    activeHitDef: null,
    hitDefUsed: false,
    ...overrides,
  };
}

function createState(player: PlayerState = createPlayer()): GameState {
  return {
    frame: 0,
    players: [player, createPlayer({ id: 2, x: 420, facing: -1 })],
    projectiles: [],
    hitEvents: [],
  };
}

function input(overrides: Partial<PlayerInput> = {}): FrameInput {
  return {
    p1: {
      left: false,
      right: false,
      up: false,
      down: false,
      attack: false,
      ...overrides,
    },
  };
}

type DiagnosticFrame = {
  label: string;
  input: FrameInput;
  before: PlayerState;
  after: PlayerState;
};

function runFrames(initial: GameState, frames: { label: string; input: FrameInput }[]): {
  state: GameState;
  diagnostics: DiagnosticFrame[];
} {
  let state = initial;
  const diagnostics: DiagnosticFrame[] = [];

  for (const frame of frames) {
    const before = state.players[0];
    state = stepGame(state, frame.input);
    diagnostics.push({
      label: frame.label,
      input: frame.input,
      before,
      after: state.players[0],
    });
  }

  return { state, diagnostics };
}

function expectPlayerState(
  player: PlayerState,
  expected: Partial<Pick<PlayerState, 'stateNo' | 'animNo' | 'stateType' | 'physics' | 'ctrl'>>,
  diagnostics: DiagnosticFrame[],
): void {
  const failures: string[] = [];

  if (expected.stateNo !== undefined && player.stateNo !== expected.stateNo) {
    failures.push(`stateNo expected=${expected.stateNo} actual=${player.stateNo}`);
  }

  if (expected.animNo !== undefined && player.animNo !== expected.animNo) {
    failures.push(`animNo expected=${expected.animNo} actual=${player.animNo}`);
  }

  if (expected.stateType !== undefined && player.stateType !== expected.stateType) {
    failures.push(`stateType expected=${expected.stateType} actual=${player.stateType}`);
  }

  if (expected.physics !== undefined && player.physics !== expected.physics) {
    failures.push(`physics expected=${expected.physics} actual=${player.physics}`);
  }

  if (expected.ctrl !== undefined && player.ctrl !== expected.ctrl) {
    failures.push(`ctrl expected=${expected.ctrl} actual=${player.ctrl}`);
  }

  if (failures.length > 0) {
    throw new Error([
      'Crouch transition assertion failed.',
      ...failures,
      '',
      formatDiagnostics(diagnostics),
    ].join('\n'));
  }
}

function formatDiagnostics(diagnostics: DiagnosticFrame[]): string {
  return [
    'Frame diagnostics:',
    ...diagnostics.map((frame, index) => [
      `#${index + 1} ${frame.label}`,
      `  input: ${formatInput(frame.input.p1)}`,
      `  before: ${formatPlayer(frame.before)}`,
      `  after : ${formatPlayer(frame.after)}`,
    ].join('\n')),
  ].join('\n');
}

function formatInput(playerInput: PlayerInput): string {
  return JSON.stringify({
    left: playerInput.left,
    right: playerInput.right,
    up: playerInput.up ?? false,
    down: playerInput.down ?? false,
    attack: playerInput.attack,
    buttons: playerInput.buttons ? Array.from(playerInput.buttons) : [],
    commandNames: playerInput.commandNames ? Array.from(playerInput.commandNames) : [],
  });
}

function formatPlayer(player: PlayerState): string {
  return JSON.stringify({
    stateNo: player.stateNo,
    stateTime: player.stateTime,
    stateType: player.stateType,
    moveType: player.moveType,
    physics: player.physics,
    ctrl: player.ctrl,
    animNo: player.animNo,
    animTime: player.animTime,
    x: player.x,
    y: player.y,
    vx: player.vx,
    vy: player.vy,
    facing: player.facing,
  });
}

describe('stepGame crouch routing', () => {
  it('enters state 10 when down is pressed from stand', () => {
    const { state, diagnostics } = runFrames(createState(), [
      { label: 'press down from stand', input: input({ down: true }) },
    ]);

    expectPlayerState(state.players[0], {
      stateNo: 10,
      animNo: 10,
      stateType: 'C',
      physics: 'C',
    }, diagnostics);
  });

  it('holds crouch as state 11 after crouch start', () => {
    const { state, diagnostics } = runFrames(createState(), [
      { label: 'press down from stand', input: input({ down: true }) },
      { label: 'hold down after crouch start', input: input({ down: true }) },
    ]);

    expectPlayerState(state.players[0], {
      stateNo: 11,
      animNo: 11,
      stateType: 'C',
      physics: 'C',
    }, diagnostics);
  });

  it('enters state 12 when down is released from crouch', () => {
    const { state, diagnostics } = runFrames(createState(), [
      { label: 'press down from stand', input: input({ down: true }) },
      { label: 'hold down after crouch start', input: input({ down: true }) },
      { label: 'release down from crouch', input: input({ down: false }) },
    ]);

    expectPlayerState(state.players[0], {
      stateNo: 12,
      animNo: 12,
      stateType: 'S',
      physics: 'S',
    }, diagnostics);
  });
});
