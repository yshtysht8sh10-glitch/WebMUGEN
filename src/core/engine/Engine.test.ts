import { describe, it } from 'vitest';
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

type Sign = 'positive' | 'negative' | 'zero';

type ExpectedPlayerFields = Partial<
  Pick<PlayerState, 'stateNo' | 'animNo' | 'stateType' | 'moveType' | 'physics' | 'ctrl' | 'facing'>
> & {
  x?: number | { sign: Sign; relativeTo: number };
  y?: number | { sign: Sign; relativeTo: number };
  vx?: number | { sign: Sign };
  vy?: number | { sign: Sign };
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

  const xFailure = checkNumber('x', player.x, expected.x);
  if (xFailure) failures.push(xFailure);

  const yFailure = checkNumber('y', player.y, expected.y);
  if (yFailure) failures.push(yFailure);

  const vxFailure = checkNumber('vx', player.vx, expected.vx);
  if (vxFailure) failures.push(vxFailure);

  const vyFailure = checkNumber('vy', player.vy, expected.vy);
  if (vyFailure) failures.push(vyFailure);

  if (failures.length > 0) {
    throw new Error([
      `${label} assertion failed.`,
      ...failures,
      '',
      formatDiagnostics(diagnostics),
    ].join('\n'));
  }
}

function checkNumber(
  field: string,
  actual: number,
  expected: number | { sign: Sign } | { sign: Sign; relativeTo: number } | undefined,
): string | null {
  if (expected === undefined) return null;
  if (typeof expected === 'number') {
    return actual === expected ? null : `${field} expected=${expected} actual=${actual}`;
  }

  const relativeTo = 'relativeTo' in expected ? expected.relativeTo : 0;
  const delta = actual - relativeTo;
  if (expected.sign === 'positive' && delta > 0) return null;
  if (expected.sign === 'negative' && delta < 0) return null;
  if (expected.sign === 'zero' && delta === 0) return null;
  return `${field} expected ${expected.sign}${'relativeTo' in expected ? ` relativeTo=${relativeTo}` : ''} actual=${actual}`;
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
      x: { sign: 'positive', relativeTo: 120 },
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
      x: { sign: 'negative', relativeTo: 120 },
    }, diagnostics);
  });

  it('enters state 100 and moves forward when FF command is active', () => {
    const { state, diagnostics } = runFrames(createState(), [
      { label: 'trigger FF from stand', input: input({ commandNames: new Set(['ff']) }) },
    ]);

    expectPlayerState('forward dash', state.players[0], {
      stateNo: 100,
      animNo: 100,
      stateType: 'S',
      physics: 'S',
      ctrl: true,
      vx: { sign: 'positive' },
      x: { sign: 'positive', relativeTo: 120 },
    }, diagnostics);
  });

  it('enters state 105 and moves backward when BB command is active', () => {
    const { state, diagnostics } = runFrames(createState(), [
      { label: 'trigger BB from stand', input: input({ commandNames: new Set(['bb']) }) },
    ]);

    expectPlayerState('back dash', state.players[0], {
      stateNo: 105,
      animNo: 105,
      stateType: 'S',
      physics: 'S',
      ctrl: true,
      vx: { sign: 'negative' },
      x: { sign: 'negative', relativeTo: 120 },
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

describe('stepGame jump routing', () => {
  it('enters state 40 when up is pressed from stand', () => {
    const { state, diagnostics } = runFrames(createState(), [
      { label: 'press up from stand', input: input({ up: true }) },
    ]);

    expectPlayerState('jump start', state.players[0], {
      stateNo: 40,
      animNo: 40,
      stateType: 'A',
      physics: 'A',
      y: { sign: 'negative', relativeTo: 285 },
      vy: { sign: 'negative' },
    }, diagnostics);
  });

  it('enters state 50 after jump start', () => {
    const { state, diagnostics } = runFrames(createState(), [
      { label: 'press up from stand', input: input({ up: true }) },
      { label: 'release up after jump start', input: input() },
    ]);

    expectPlayerState('jump up', state.players[0], {
      stateNo: 50,
      animNo: 50,
      stateType: 'A',
      physics: 'A',
      y: { sign: 'negative', relativeTo: 285 },
    }, diagnostics);
  });

  it('keeps horizontal jump velocity for forward jump', () => {
    const { state, diagnostics } = runFrames(createState(), [
      { label: 'press up-right from stand', input: input({ up: true, right: true }) },
    ]);

    expectPlayerState('forward jump start', state.players[0], {
      stateNo: 40,
      animNo: 40,
      stateType: 'A',
      physics: 'A',
      vx: { sign: 'positive' },
      y: { sign: 'negative', relativeTo: 285 },
    }, diagnostics);
  });

  it('enters state 52 when an airborne player reaches the ground', () => {
    const fallingPlayer = createPlayer({ stateNo: 50, animNo: 50, stateType: 'A', physics: 'A', y: 285, vy: 1, ctrl: true });
    const { state, diagnostics } = runFrames(createState(fallingPlayer), [
      { label: 'falling player reaches ground', input: input() },
    ]);

    expectPlayerState('jump land', state.players[0], {
      stateNo: 52,
      animNo: 52,
      stateType: 'S',
      physics: 'S',
      ctrl: false,
      y: 285,
      vx: 0,
      vy: 0,
    }, diagnostics);
  });

  it('returns from state 52 to state 0 after landing recovery', () => {
    const landingPlayer = createPlayer({ stateNo: 52, animNo: 52, stateType: 'S', physics: 'S', y: 285, ctrl: false });
    const frames = Array.from({ length: 4 }, (_, index) => ({
      label: `landing recovery frame ${index + 1}`,
      input: input(),
    }));
    const { state, diagnostics } = runFrames(createState(landingPlayer), frames);

    expectPlayerState('landing recovery', state.players[0], {
      stateNo: 0,
      animNo: 0,
      stateType: 'S',
      physics: 'S',
      ctrl: true,
      y: 285,
      vx: 0,
      vy: 0,
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
      y: 285,
      vx: 0,
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
      y: 285,
      vx: 0,
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
      y: 285,
      vx: 0,
    }, diagnostics);
  });

  it('returns from state 12 to state 0 after crouch end recovery', () => {
    const crouchEndPlayer = createPlayer({ stateNo: 12, animNo: 12, stateType: 'S', physics: 'S' });
    const frames = Array.from({ length: 7 }, (_, index) => ({
      label: `crouch end recovery frame ${index + 1}`,
      input: input(),
    }));
    const { state, diagnostics } = runFrames(createState(crouchEndPlayer), frames);

    expectPlayerState('crouch end recovery', state.players[0], {
      stateNo: 0,
      animNo: 0,
      stateType: 'S',
      physics: 'S',
      ctrl: true,
      vx: 0,
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
