import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { stepCnsPhysicsMotion } from './CnsPhysicsStep';
import { stepCnsStateRuntime } from './CnsStateRuntime';
import { createInitialGameState } from '../engine/GameState';
import {
  applyPauseControllerEvents,
  createInitialPauseState,
  isGamePaused,
  restorePausedEntityPhysics,
  stepPauseState,
  type PauseControllerEvent,
} from '../pause/PauseSystem';

const cns = parseCnsText(`
[Statedef 3200]
type = S
movetype = A
physics = S
anim = 23000
ctrl = 0

[State 3200, Pause]
type = Pause
trigger1 = Time = 0
time = 30
movetime = 30

[State 3200, Exit]
type = ChangeState
trigger1 = Time = 30
value = 3210
ctrl = 0

[Statedef 3210]
type = S
movetype = I
physics = S
anim = 3210
ctrl = 0
`);

describe('WinMUGEN Pause resume compatibility', () => {
  it('lets an owner whose movetime covers the Pause evaluate Time on the resume frame', () => {
    const initial = createInitialGameState();
    let state = {
      ...initial,
      players: [{ ...initial.players[0], stateNo: 3200 }, initial.players[1]] as typeof initial.players,
    };
    let pause = createInitialPauseState();

    for (let frame = 0; frame < 30; frame += 1) {
      const events: PauseControllerEvent[] = [];
      const result = stepCnsStateRuntime(state, cns, {
        pauseState: pause,
        onPause: (event) => events.push(event),
      });
      const beforePhysics = result.state;
      const activePause = applyPauseControllerEvents(pause, events);
      let advanced = stepCnsPhysicsMotion(beforePhysics, cns);
      if (isGamePaused(activePause)) {
        advanced = restorePausedEntityPhysics(beforePhysics, advanced, activePause);
      }
      state = { ...advanced, pause: stepPauseState(activePause) };
      pause = state.pause;
    }

    expect(state.players[0]).toMatchObject({ stateNo: 3200, stateTime: 30 });
    expect(pause).toMatchObject({ pauseTime: 0, resumeGuard: true, ownerEntityId: 1 });

    const resumed = stepCnsStateRuntime(state, cns, { pauseState: pause });
    expect(resumed.state.players[0]).toMatchObject({ stateNo: 3210, stateTime: 0, animNo: 3210 });
    expect(resumed.traces[0].executedControllers).toContain('ChangeState');
  });

  it('keeps the resume guard for a player that was frozen by the same Pause', () => {
    const initial = createInitialGameState();
    const pause = {
      ...createInitialPauseState(),
      resumeGuard: true,
      ownerEntityId: 1,
    };
    const state = {
      ...initial,
      players: [initial.players[0], { ...initial.players[1], stateNo: 3200, stateTime: 30 }] as typeof initial.players,
    };

    const resumed = stepCnsStateRuntime(state, cns, { pauseState: pause });
    expect(resumed.state.players[1]).toMatchObject({ stateNo: 3200, stateTime: 30 });
    expect(resumed.traces[1].debugLines).toContain('global_pause skip reason=resume_guard remaining=0 owner=p1');
  });
});
