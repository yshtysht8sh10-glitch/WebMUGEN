import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { getMugenAnimEndTime } from '../animation/AnimationDuration';
import { getAnimationTriggerInfo } from '../animation/AnimationPlayer';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { createInitialGameState } from '../engine/GameState';
import { resolveFallbackHits } from '../engine/FallbackHitResolver';
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
});
