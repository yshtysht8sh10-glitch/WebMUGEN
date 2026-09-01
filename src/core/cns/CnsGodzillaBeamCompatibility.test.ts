import { describe, expect, it } from 'vitest';
import { getMugenAnimEndTime } from '../animation/AnimationDuration';
import { getAnimationTriggerInfo } from '../animation/AnimationPlayer';
import { createInitialGameState } from '../engine/GameState';
import { resolveFallbackHits } from '../engine/FallbackHitResolver';
import { DEFAULT_GROUND_Y } from '../engine/GroundClamp';
import { spawnHelper } from '../helper/HelperSystem';
import { parseAirText } from '../../parser/air/AirParser';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { stepCnsStateRuntime } from './CnsStateRuntime';

const cns = parseCnsText(`
[Statedef 4130]
type = C
movetype = A
physics = N
anim = 4130

[State 4130, hyper beam]
type = HitDef
trigger1 = time % 7 = 0
attr = , HP
hitflag = MAFDP
damage = 80, 8
pausetime = 0, 6

[Statedef 4190]
type = C
movetype = A
physics = N
anim = 4190

[State 4190, beam]
type = HitDef
trigger1 = animelem = 1
attr = , SP
hitflag = MAFDP
damage = 80, 8
pausetime = 0, 6
`);

const air = parseAirText(`
[Begin Action 0]
Clsn2Default: 1
 Clsn2[0] = -20,-80,20,0
0,0, 0,0, 5

[Begin Action 4130]
Clsn1: 1
 Clsn1[0] = 0,-60,60,0
4130,0, 0,0, 5

[Begin Action 4190]
Clsn1: 1
 Clsn1[0] = 0,-60,60,0
4190,0, 0,0, 5
`);

describe('godzilla(VS) beam Helper HitDef compatibility', () => {
  it.each([
    [4190, 'SP'],
    [4130, 'HP'],
  ] as const)('uses StateType C for State %i attr with an omitted state class', (stateNo, attackType) => {
    const initial = createInitialGameState();
    const root = { ...initial.players[0], stateNo: stateNo === 4190 ? 1005 : 3000 };
    const target = { ...initial.players[1], x: 300, animNo: 0 };
    const helpers = spawnHelper(initial.helpers, {
      helperId: stateNo,
      rootEntityId: 1,
      parentEntityId: 1,
      ownerCharacterId: 1,
      stateOwnerId: 1,
      animationOwnerId: 1,
      stateNo,
      x: 260,
      y: DEFAULT_GROUND_Y,
      facing: 1,
      keyCtrl: false,
      ownPal: true,
      spawnFrame: -1,
      parent: root,
    }, cns);
    const activated = stepCnsStateRuntime({
      ...initial,
      players: [root, target],
      helpers,
    }, cns, {
      getAnimationDuration: (animNo) => getMugenAnimEndTime(air, animNo),
      getAnimationTriggerInfo: (animNo, animTime) => getAnimationTriggerInfo(air, animNo, animTime),
    }).state;

    expect(activated.helpers.entries[0].player.activeHitDef).toMatchObject({
      attr: { stateType: 'C', attackTypes: [attackType] },
      invalidParameters: [],
      damage: 80,
    });

    const hit = resolveFallbackHits(activated, air, true);
    expect(hit.players[1].life).toBe(920);
    expect(hit.helpers.entries[0].player.moveContact).toMatchObject({ hit: true, hitCount: 1 });
    expect(hit.hitDiagnosticLines).toContain(`raw.helper_hit_collision entity=3 helperId=${stateNo} root=p1 target=p2 result=accepted`);
  });
});
