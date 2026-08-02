import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import type { SoundPlayEvent } from '../audio/SoundEvent';
import { stepCnsPhysicsMotion } from '../cns/CnsPhysicsStep';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { createInitialGameState } from '../engine/GameState';
import type { GameState } from '../engine/types';
import {
  applyPauseControllerEvents,
  createInitialPauseState,
  stepPauseState,
  type PauseControllerEvent,
  type PauseState,
} from '../pause/PauseSystem';
import { applyExplodControllerEvents, stepExplodRuntime, type ExplodControllerEvent } from './ExplodSystem';

const cns = parseCnsText(readFileSync('src/core/explod/fixtures/explod-pause.cns', 'utf8'));

describe('Explod Pause/SuperPause production integration', () => {
  it('freezes pause fields, consumes per-Explod allowance, and prevents resume-frame side-effect duplication', () => {
    const initial = createInitialGameState();
    let state: GameState = { ...initial, frame: 1, players: [{ ...initial.players[0], stateNo: 940 }, initial.players[1]] };
    let pause = createInitialPauseState();
    let soundCount = 0;

    ({ state, pause, soundCount } = executeFrame(state, pause, soundCount));
    expect(pause).toMatchObject({ pauseTime: 1, kind: 'pause' });
    expect(soundCount).toBe(1);
    expect(state.explods.entries.find((entry) => entry.mugenId === 110)).toMatchObject({ age: 0, animTime: 0, pauseMoveTime: 0 });
    expect(state.explods.entries.find((entry) => entry.mugenId === 111)).toMatchObject({ age: 0, animTime: 0, pauseMoveTime: 0 });
    expect(state.explods.entries.find((entry) => entry.mugenId === 112)).toMatchObject({ age: 0, animTime: 0, pauseMoveTime: -1 });
    expect(state.hitDiagnosticLines?.join('\n')).toContain('result=frozen pause=pause allowance=0');
    expect(state.hitDiagnosticLines?.join('\n')).toContain('pause=pause update=allowed allowanceBefore=1 allowanceAfter=0');

    state = { ...state, frame: 2 };
    ({ state, pause, soundCount } = executeFrame(state, pause, soundCount));
    expect(pause).toMatchObject({ pauseTime: 0, resumeGuard: true });
    expect(soundCount).toBe(1);
    expect(state.explods.entries.find((entry) => entry.mugenId === 110)).toMatchObject({ age: 0, animTime: 0 });
    expect(state.explods.entries.find((entry) => entry.mugenId === 111)).toMatchObject({ age: 0, animTime: 0 });
    expect(state.explods.entries.find((entry) => entry.mugenId === 112)).toMatchObject({ age: 1, animTime: 1, pauseMoveTime: -1 });
    expect(state.hitDiagnosticLines?.join('\n')).toContain('pause=pause update=allowed allowanceBefore=-1 allowanceAfter=-1 mode=indefinite');

    state = { ...state, frame: 3 };
    ({ state, pause, soundCount } = executeFrame(state, pause, soundCount, true));
    expect(soundCount).toBe(1);
    expect(pause.resumeGuard).toBe(false);
    expect(state.players[0].stateTime).toBe(1);
    expect(state.explods.entries.find((entry) => entry.mugenId === 110)?.age).toBe(1);
    expect(state.explods.entries.find((entry) => entry.mugenId === 111)?.age).toBe(1);
    expect(state.explods.entries.find((entry) => entry.mugenId === 112)?.age).toBe(2);

    state = { ...state, frame: 4 };
    ({ state, pause, soundCount } = executeFrame(state, pause, soundCount, true));
    expect(soundCount).toBe(1);
    expect(state.explods.entries).toHaveLength(3);
  });

  it('distinguishes SuperPause allowance and darken from normal Pause', () => {
    const initial = createInitialGameState();
    const start: GameState = { ...initial, frame: 1, players: [{ ...initial.players[0], stateNo: 941 }, initial.players[1]] };
    const result = executeFrame(start, createInitialPauseState(), 0);
    expect(result.pause).toMatchObject({ superPauseTime: 1, kind: 'superpause', darken: false });
    expect(result.state.explods.entries.find((entry) => entry.mugenId === 120)).toMatchObject({ age: 0, superMoveTime: 0 });
    expect(result.state.explods.entries.find((entry) => entry.mugenId === 121)).toMatchObject({ age: 0, superMoveTime: 0 });
    expect(result.state.explods.entries.find((entry) => entry.mugenId === 122)).toMatchObject({ age: 0, animTime: 0, superMoveTime: -1 });
    expect(result.state.hitDiagnosticLines?.join('\n')).toContain('pause=superpause update=allowed');

    const second = executeFrame({ ...result.state, frame: 2 }, result.pause, 0);
    expect(second.state.explods.entries.find((entry) => entry.mugenId === 120)).toMatchObject({ age: 0, animTime: 0 });
    expect(second.state.explods.entries.find((entry) => entry.mugenId === 121)).toMatchObject({ age: 0, animTime: 0 });
    expect(second.state.explods.entries.find((entry) => entry.mugenId === 122)).toMatchObject({ age: 1, animTime: 1, superMoveTime: -1 });
    expect(second.state.hitDiagnosticLines?.join('\n')).toContain('pause=superpause update=allowed allowanceBefore=-1 allowanceAfter=-1 mode=indefinite');
  });

  it('does not treat player-local hitpause as global Explod pause', () => {
    const initial = createInitialGameState();
    let state: GameState = { ...initial, frame: 1, players: [{ ...initial.players[0], stateNo: 940 }, initial.players[1]] };
    const events: ExplodControllerEvent[] = [];
    stepCnsStateRuntime(state, cns, { onExplodCreate: (event) => events.push(event) });
    state = applyExplodControllerEvents(state, events.filter((event) => event.type === 'create'));
    state = stepExplodRuntime(state, () => null);
    state = { ...state, frame: 2, players: [{ ...state.players[0], hitPause: 2 }, state.players[1]] };
    state = stepExplodRuntime(state, () => null, null);
    expect(state.explods.entries.every((entry) => entry.age === 1)).toBe(true);
    expect(state.hitDiagnosticLines?.join('\n')).toContain('movement=applied');
  });

  it('skips negative-state side effects while globally paused', () => {
    const negative = parseCnsText(`
[StateDef -2]
[State -2, repeated sound]
type = PlaySnd
trigger1 = 1
value = 0, 0
[State -2, repeated explod]
type = Explod
trigger1 = 1
anim = 1
[StateDef 0]
type = S
`);
    const initial = createInitialGameState();
    const sounds: SoundPlayEvent[] = [];
    const explods: ExplodControllerEvent[] = [];
    const paused = { ...createInitialPauseState(), pauseTime: 2, kind: 'pause' as const, ownerEntityId: 1 };

    const result = stepCnsStateRuntime(initial, negative, {
      pauseState: paused,
      onSoundPlay: (event) => sounds.push(event),
      onExplodCreate: (event) => explods.push(event),
      debug: true,
    });

    expect(sounds).toHaveLength(0);
    expect(explods).toHaveLength(0);
    expect(result.traces[0].debugLines.join('\n')).toContain('global_pause skip reason=pause');
  });

  it('fires the bundled T-H-M-A State 3010 SuperPause and PlaySnd through the production CNS path', () => {
    const realCns = parseCnsText(readFileSync('public/chars/T-H-M-A/T-H-M-A/T-H-M-Atyouhi.cns', 'utf8'));
    const initial = createInitialGameState();
    const pauses: PauseControllerEvent[] = [];
    const sounds: SoundPlayEvent[] = [];

    stepCnsStateRuntime({
      ...initial,
      players: [{ ...initial.players[0], stateNo: 3010, stateTime: 0, animNo: 3010 }, initial.players[1]],
    }, realCns, {
      onPause: (event) => pauses.push(event),
      onSoundPlay: (event) => sounds.push(event),
    });

    expect(pauses).toContainEqual({ type: 'superpause', ownerEntityId: 1, time: 80, moveTime: 0, darken: true });
    expect(sounds).toContainEqual(expect.objectContaining({ ownerId: 1, scope: 'character', group: 5000, index: 6 }));
    expect(applyPauseControllerEvents(createInitialPauseState(), pauses)).toMatchObject({
      superPauseTime: 80,
      kind: 'superpause',
      ownerEntityId: 1,
    });
  });

  it('preserves bundled T-H-M-A State 3500 supermovetime=-1 as an indefinite Explod allowance', () => {
    const realCns = parseCnsText(readFileSync('public/chars/T-H-M-A/T-H-M-A/T-H-M-Atyouhi.cns', 'utf8'));
    const initial = createInitialGameState();
    const explods: ExplodControllerEvent[] = [];
    const pauses: PauseControllerEvent[] = [];

    stepCnsStateRuntime({
      ...initial,
      players: [{ ...initial.players[0], stateNo: 3500, stateTime: 0, animNo: 3500 }, initial.players[1]],
    }, realCns, { onExplodCreate: (event) => explods.push(event) });
    let state = applyExplodControllerEvents(initial, explods);
    expect(state.explods.entries).toContainEqual(expect.objectContaining({ animNo: 10040, superMoveTime: -1 }));

    stepCnsStateRuntime({
      ...state,
      frame: 2,
      players: [{ ...state.players[0], stateNo: 3500, stateTime: 2, animNo: 3500 }, state.players[1]],
    }, realCns, { onPause: (event) => pauses.push(event) });
    const superPause = applyPauseControllerEvents(createInitialPauseState(), pauses);
    expect(superPause).toMatchObject({ superPauseTime: 60, kind: 'superpause' });

    state = stepExplodRuntime({ ...state, frame: 2 }, () => null, superPause);
    expect(state.explods.entries).toContainEqual(expect.objectContaining({ animNo: 10040, age: 1, animTime: 1, superMoveTime: -1 }));
  });
});

function executeFrame(
  state: GameState,
  pause: PauseState,
  soundCount: number,
  applyPhysics = false,
): { state: GameState; pause: PauseState; soundCount: number } {
  const explodEvents: ExplodControllerEvent[] = [];
  const pauseEvents: PauseControllerEvent[] = [];
  const sounds: SoundPlayEvent[] = [];
  const result = stepCnsStateRuntime(state, cns, {
    pauseState: pause,
    onExplodCreate: (event) => explodEvents.push(event),
    onPause: (event) => pauseEvents.push(event),
    onSoundPlay: (event) => sounds.push(event),
  });
  let nextState = applyExplodControllerEvents(result.state, explodEvents);
  const activePause = applyPauseControllerEvents(pause, pauseEvents);
  nextState = stepExplodRuntime(nextState, () => null, activePause);
  if (applyPhysics) nextState = stepCnsPhysicsMotion(nextState, cns);
  return { state: nextState, pause: stepPauseState(activePause), soundCount: soundCount + sounds.length };
}
