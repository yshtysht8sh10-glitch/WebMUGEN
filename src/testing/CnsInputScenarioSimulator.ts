import { getAnimationDuration } from '../core/animation/AnimationDuration';
import { getCurrentAnimationElement } from '../core/animation/AnimationPlayer';
import type { CharacterAssets } from '../core/character/CharacterTypes';
import { stepCnsPhysicsMotion } from '../core/cns/CnsPhysicsStep';
import { stepCnsStateRuntime, type CnsRuntimeTrace } from '../core/cns/CnsStateRuntime';
import { createInitialGameState } from '../core/engine/GameState';
import type { GameState, PlayerInput, PlayerState } from '../core/engine/types';
import { InputBuffer } from '../input/InputBuffer';
import { resolveCommands } from '../input/CommandResolver';
import { keysToP1Input, keysToP2Input } from '../app/BrowserInput';

export type CnsInputScenarioStep = {
  frames?: number;
  p1Keys?: readonly string[];
  p2Keys?: readonly string[];
  p1Input?: PlayerInput;
  p2Input?: PlayerInput;
};

export type CnsInputScenarioFrame = {
  frame: number;
  p1Commands: readonly string[];
  p2Commands: readonly string[];
  p1: PlayerFrameSnapshot;
  p2: PlayerFrameSnapshot;
  traces: readonly CnsRuntimeTrace[];
};

export type PlayerFrameSnapshot = Pick<
  PlayerState,
  'stateNo' | 'stateTime' | 'stateType' | 'moveType' | 'physics' | 'ctrl' | 'animNo' | 'animTime' | 'x' | 'y' | 'vx' | 'vy'
> & {
  prevStateNo?: number;
};

export type CnsInputScenarioResult = {
  state: GameState;
  frames: readonly CnsInputScenarioFrame[];
};

export function simulateCnsInputScenario(
  character: Pick<CharacterAssets, 'air' | 'cmd' | 'cns'>,
  scenario: readonly CnsInputScenarioStep[],
  initialState: GameState = createInitialGameState(),
): CnsInputScenarioResult {
  let state = initialState;
  const frames: CnsInputScenarioFrame[] = [];
  const p1Buffer = new InputBuffer(60);
  const p2Buffer = new InputBuffer(60);

  for (const step of scenario) {
    const count = Math.max(1, step.frames ?? 1);
    for (let i = 0; i < count; i += 1) {
      const p1Input = step.p1Input ?? keysToP1Input(new Set(step.p1Keys ?? []));
      const p2Input = step.p2Input ?? keysToP2Input(new Set(step.p2Keys ?? []));
      p1Buffer.push(p1Input);
      p2Buffer.push(p2Input);

      const p1Commands = normalizeCommands(resolveCommands(character.cmd, p1Input, p1Buffer).activeCommandNames);
      const p2Commands = normalizeCommands(resolveCommands(character.cmd, p2Input, p2Buffer).activeCommandNames);
      const cnsResult = stepCnsStateRuntime(state, character.cns, {
        p1Commands: new Set(p1Commands),
        p2Commands: new Set(p2Commands),
        getAnimationDuration: (animNo) => getAnimationDuration(character.air, animNo),
        getAnimationElementNo: (animNo, animTime) => {
          const element = getCurrentAnimationElement(character.air, animNo, animTime);
          return element ? element.elementIndex + 1 : null;
        },
      });

      state = stepCnsPhysicsMotion(cnsResult.state);
      frames.push({
        frame: frames.length,
        p1Commands,
        p2Commands,
        p1: snapshotPlayer(state.players[0]),
        p2: snapshotPlayer(state.players[1]),
        traces: cnsResult.traces,
      });
    }
  }

  return { state, frames };
}

export function holdP1Keys(keys: readonly string[], frames: number): CnsInputScenarioStep {
  return { p1Keys: keys, frames };
}

export function neutral(frames: number): CnsInputScenarioStep {
  return { frames };
}

export function formatScenarioFrame(frame: CnsInputScenarioFrame): string {
  const p1Exec = frame.traces[0]?.executedControllers.join(',') || '-';
  return [
    `f=${frame.frame}`,
    `cmd=${frame.p1Commands.join(',') || '-'}`,
    `p1=s${frame.p1.stateNo}`,
    `type=${frame.p1.stateType}`,
    `ctrl=${frame.p1.ctrl ? 1 : 0}`,
    `anim=${frame.p1.animNo}:${frame.p1.animTime}`,
    `pos=(${round(frame.p1.x)},${round(frame.p1.y)})`,
    `vel=(${round(frame.p1.vx)},${round(frame.p1.vy)})`,
    `exec=${p1Exec}`,
  ].join(' ');
}

function normalizeCommands(commands: Iterable<string>): string[] {
  return Array.from(commands, (command) => command.toLowerCase()).sort();
}

function snapshotPlayer(player: PlayerState): PlayerFrameSnapshot {
  return {
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
    prevStateNo: (player as PlayerState & { prevStateNo?: number }).prevStateNo,
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
