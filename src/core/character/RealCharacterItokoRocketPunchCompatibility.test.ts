import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { parseAirText } from '../../parser/air/AirParser';
import { getAnimationTriggerInfo } from '../animation/AnimationPlayer';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { createInitialGameState } from '../engine/GameState';
import { spawnHelper } from '../helper/HelperSystem';

const cns = parseCnsText(new TextDecoder('shift_jis').decode(
  readFileSync('public/chars/itoko/itoko.cns'),
));
const air = parseAirText(new TextDecoder('shift_jis').decode(
  readFileSync('public/chars/itoko/itoko.air'),
));

describe('itoko rocket-punch Helper presentation', () => {
  it('can draw flying-hand Helper 1421 on its creation frame', () => {
    const initial = createInitialGameState();
    const helpers = spawnHelper(initial.helpers, {
      helperId: 1421,
      rootEntityId: 1,
      parentEntityId: 3,
      ownerCharacterId: 1,
      stateOwnerId: 1,
      animationOwnerId: 1,
      stateNo: 1421,
      x: 300,
      y: 200,
      facing: 1,
      keyCtrl: false,
      ownPal: true,
      spawnFrame: 10,
      parent: initial.players[0],
    }, cns);

    expect(helpers.entries[0]).toMatchObject({
      hasCompletedInitialStatePass: false,
      canRenderBeforeInitialStatePass: true,
      player: { stateNo: 1421, animNo: 1421, animTime: 0 },
    });
  });

  it('marks the Helper spawned by Action 1420 element 8 for immediate presentation', () => {
    const initial = createInitialGameState();
    initial.players[0] = {
      ...initial.players[0],
      stateNo: 1322,
      stateHeaderAppliedStateNo: 1322,
      animNo: 1322,
    };
    initial.helpers = spawnHelper(initial.helpers, {
      helperId: 1350,
      rootEntityId: 1,
      parentEntityId: 1,
      ownerCharacterId: 1,
      stateOwnerId: 1,
      animationOwnerId: 1,
      stateNo: 1420,
      x: 300,
      y: 200,
      facing: 1,
      keyCtrl: false,
      ownPal: true,
      spawnFrame: -1,
      parent: initial.players[0],
    }, cns);
    initial.helpers.entries[0] = {
      ...initial.helpers.entries[0],
      hasCompletedInitialStatePass: true,
      player: {
        ...initial.helpers.entries[0].player,
        stateHeaderAppliedStateNo: 1420,
        stateTime: 20,
        animNo: 1420,
        animTime: 20,
      },
    };

    const result = stepCnsStateRuntime(initial, cns, {
      getAnimationTriggerInfo: (animNo, animTime) => getAnimationTriggerInfo(air, animNo, animTime),
    });
    const flyingHand = result.state.helpers.entries.find((helper) => helper.helperId === 1421);

    expect(flyingHand).toMatchObject({
      parentEntityId: 3,
      hasCompletedInitialStatePass: true,
      canRenderBeforeInitialStatePass: true,
      player: { stateNo: 1421, animNo: 1421, animTime: 0 },
    });
    expect(result.state.hitDiagnosticLines?.join('\n')).toContain('creationRender=immediate');
  });
});
