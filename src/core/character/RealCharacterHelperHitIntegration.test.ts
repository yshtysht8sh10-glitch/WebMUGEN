import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { getMugenAnimEndTime } from '../animation/AnimationDuration';
import { getAnimationTriggerInfo } from '../animation/AnimationPlayer';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { createInitialGameState } from '../engine/GameState';
import { resolveFallbackHits } from '../engine/FallbackHitResolver';
import { spawnHelper } from '../helper/HelperSystem';
import { parseAirText } from '../../parser/air/AirParser';
import { parseCnsText } from '../../parser/cns/CnsParser';

describe('real character Helper HitDef integration', () => {
  it('activates T-H-M-A State 3320 and damages the opposing root through Helper collision', async () => {
    const [cnsBytes, airBytes] = await Promise.all([
      readFile('public/chars/T-H-M-A/T-H-M-A/T-H-M-Atyouhi.cns'),
      readFile('public/chars/T-H-M-A/T-H-M-A/T-H-M-A.air'),
    ]);
    const cns = parseCnsText(new TextDecoder('shift_jis').decode(cnsBytes));
    const air = parseAirText(new TextDecoder('shift_jis').decode(airBytes));
    const initial = createInitialGameState();
    const helperPlayer = {
      ...initial.players[0], id: 1 as const, x: 370, stateNo: 3320, animNo: 3320,
      stateType: 'A' as const, moveType: 'A' as const, physics: 'N' as const, ctrl: false,
    };
    const source = {
      ...initial,
      players: [
        { ...initial.players[0], stateNo: -999 },
        { ...initial.players[1], stateNo: -999, animNo: 0 },
      ] as typeof initial.players,
      helpers: {
        entries: [{
          entityId: 3, helperId: 3320, rootEntityId: 1 as const, parentEntityId: 1,
          ownerCharacterId: 1 as const, stateOwnerId: 1 as const, animationOwnerId: 1 as const,
          keyCtrl: false, ownPal: false, spawnFrame: -1, player: helperPlayer,
        }],
        nextEntityId: 4,
      },
    };
    const activated = stepCnsStateRuntime(source, cns, {
      getAnimationDuration: (animNo) => getMugenAnimEndTime(air, animNo),
      getAnimationTriggerInfo: (animNo, animTime) => getAnimationTriggerInfo(air, animNo, animTime),
    }).state;

    expect(activated.helpers.entries[0].player.activeHitDef).toMatchObject({ damage: 5, guardDamage: 2 });
    const result = resolveFallbackHits(activated, air, true);
    expect(result.players[1].life).toBe(995);
    expect(result.helpers.entries[0].player.moveContact).toMatchObject({ hit: true, hitCount: 1 });
    expect(result.hitDiagnosticLines).toContain('raw.helper_hit_collision entity=3 helperId=3320 root=p1 target=p2 result=accepted');
  });

  it('runs the T-H-M-A rock Helper TargetState chain from 3725 through root State 3730', async () => {
    const cnsBytes = await readFile('public/chars/T-H-M-A/T-H-M-A/T-H-M-Atyouhi.cns');
    const cns = parseCnsText(new TextDecoder('shift_jis').decode(cnsBytes));
    const initial = createInitialGameState();
    initial.players[0] = { ...initial.players[0], stateNo: 3720, stateTime: 129, x: 220, y: 360 };
    let helpers = spawnHelper(initial.helpers, {
      helperId: 3725, rootEntityId: 1, parentEntityId: 1, ownerCharacterId: 1,
      stateOwnerId: 1, animationOwnerId: 1, stateNo: 3725, x: 220, y: 300,
      facing: 1, keyCtrl: false, ownPal: false, spawnFrame: 0, parent: initial.players[0],
    }, cns);
    helpers = {
      ...helpers,
      entries: helpers.entries.map((helper) => ({
        ...helper,
        player: {
          ...helper.player,
          stateTime: 129,
          targets: [{ playerId: 2, hitDefId: 3725, activeHitDefId: 1 }],
          moveContact: {
            activeHitDefId: 1, contact: true, hit: true, guarded: false, elapsed: 1, hitCount: 1,
          },
        },
      })),
    };

    const helperPass = stepCnsStateRuntime({ ...initial, helpers }, cns);
    expect(helperPass.state.helpers.entries[0].player.stateNo).toBe(3735);
    expect(helperPass.state.players[1]).toMatchObject({ stateNo: 3738, stateOwnerId: 1 });

    const rootPass = stepCnsStateRuntime(helperPass.state, cns);
    expect(rootPass.state.players[0].stateNo).toBe(3730);
  });
});
