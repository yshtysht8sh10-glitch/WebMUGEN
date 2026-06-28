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

type ExpectedPlayerFields = Partial<
  Pick<PlayerState, 'stateNo' | 'animNo' | 'stateType' | 'moveType' | 'physics' | 'ctrl' | 'facing'>
> & {
  vx?: number | { sign: 'positive' | 'negative' | 'zero' };
};

function expectPlayerState(
  label: string,
  player: PlayerState,
  expected: ExpectedPlayerFields,
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

  if (expected.moveType !== undefined && player.moveType !== expected.moveType) {
    failures.push(`moveType expected=${expected.moveType} actual=${player.moveType}`);
  }

  if (expected.physics !== undefined && player.physics !== expected.physics) {
    failures.push(`physics expected=${expected.physics} actual=${player.physics}`);
  }

  if (expected.ctrl !== undefined && player.ctrl !== expected.ctrl) {
    failures.push(`ctrl expected=${expected.ctrl} actual=${player.ctrl}`);
  }

  if (expected.facing !== undefined && player.facing !== expected.facing) {
    failures.push(`facing expected=${expected.facing} actual=${player.facing}`);
  }

  if (expected.vx !== undefined) {
    const vxFailure = checkVelocityX(player.vx, expected.vx);
    if (vxFailure) failures.push(vxFailure);
  }

  if (failures.length > 0) {
    throw new Error([
      `${label} assertion failed.`,
      ...failures,
      '',
      formatDiagnostics(diagnostics),
    ].join('\n'));
  }
}

function checkVelocityX(actual: number, expected: ExpectedPlayerFields['vx']): string | null {
  if (expected === undefined) return null;
  if (typeof expected === 'number') {
    return actual === expected ? null : `vx expected=${expected} actual=${actual}`;
  }

  if (expected.sign === 'positive' && actual > 0) return null;
  if (expected.sign === 'negative' && actual < 0) return null;
  if (expected.sign === 'zero' && actual === 0) return null;
  return `vx expected ${expected.sign} actual=${actual}`;
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

describe('stepGame basic state routing', () => {
  it('keeps state 0 when no input is active', () => {
    const { state, diagnostics } = runFrames(createState(), [
      { label: 'neutral from stand', input: input() },
    ]);

    expectPlayerState('stand idle', state.players[0], {
      stateNo: 0,
      animNo: 0,
      stateType: 'S',
      physics: 'S',
      ctrl: true,
      vx: 0,
    }, diagnostics);
  });

  it('enters state 20 and moves right when right is pressed', () => {
    const { state, diagnostics } = runFrames(createState(), [
      { label: 'press right from stand', input: input({ right: true }) },
    ]);

    expectPlayerState('walk right', state.players[0], {
      stateNo: 20,
      animNo: 20,
      stateType: 'S',
      physics: 'S',
      ctrl: true,
      facing: 1,
      vx: { sign: 'positive' },
    }, diagnostics);
  });

  it('enters state 20 and moves left when left is pressed', () => {
    const { state, diagnostics } = runFrames(createState(), [
      { label: 'press left from stand', input: input({ left: true }) },
    ]);

    expectPlayerState('walk left', state.players[0], {
      stateNo: 20,
      animNo: 20,
      stateType: 'S',
      physics: 'S',
      ctrl: true,
      facing: -1,
      vx: { sign: 'negative' },
    }, diagnostics);
  });

  it('enters state 200 and disables ctrl when attack is pressed', () => {
    const { state, diagnostics } = runFrames(createState(), [
      { label: 'press attack from stand', input: input({ attack: true }) },
    ]);

    expectPlayerState('stand attack', state.players[0], {
      stateNo: 200,
      animNo: 200,
      ctrl: false,
      vx: 0,
    }, diagnostics);
  });

  it('returns from state 200 to state 0 after the fallback attack duration', () => {
    const frames = [
      { label: 'press attack from stand', input: input({ attack: true }) },
      ...Array.from({ length: 19 }, (_, index) => ({
        label: `attack recovery frame ${index + 1}`,
        input: input(),
      })),
    ];
    const { state, diagnostics } = runFrames(createState(), frames);

    expectPlayerState('attack recovery', state.players[0], {
      stateNo: 0,
      animNo: 0,
      stateType: 'S',
      physics: 'S',
      ctrl: true,
      vx: 0,
    }, diagnostics);
  });
});

describe('stepGame crouch routing', () => {
  it('enters state 10 when down is pressed from stand', () => {
    const { state, diagnostics } = runFrames(createState(), [
      { label: 'press down from stand', input: input({ down: true }) },
    ]);

    expectPlayerState('crouch start', state.players[0], {
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

    expectPlayerState('crouch hold', state.players[0], {
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

    expectPlayerState('crouch end', state.players[0], {
      stateNo: 12,
      animNo: 12,
      stateType: 'S',
      physics: 'S',
    }, diagnostics);
  });

  it('prioritizes crouch over walking when down and right are both held', () => {
    const { state, diagnostics } = runFrames(createState(), [
      { label: 'press down-right from stand', input: input({ down: true, right: true }) },
    ]);

    expectPlayerState('down-right crouch priority', state.players[0], {
      stateNo: 10,
      animNo: 10,
      stateType: 'C',
      physics: 'C',
      vx: 0,
    }, diagnostics);
  });

  it('prioritizes attack over crouch when attack and down are both pressed', () => {
    const { state, diagnostics } = runFrames(createState(), [
      { label: 'press attack and down from stand', input: input({ attack: true, down: true }) },
    ]);

    expectPlayerState('attack-over-crouch priority', state.players[0], {
      stateNo: 200,
      animNo: 200,
      ctrl: false,
    }, diagnostics);
  });
});
