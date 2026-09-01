import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { stepCnsPhysicsMotion } from '../cns/CnsPhysicsStep';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { createInitialGameState } from '../engine/GameState';
import { spawnHelper } from '../helper/HelperSystem';

describe('T-H-M-A damage-counter Helper lifecycle', () => {
  it('lets State 5506 reach DestroySelf when the parent retains Projectile contact in an idle State', () => {
    const document = parseCnsText(readFileSync(
      'public/chars/T-H-M-A/T-H-M-A/T-H-M-Atokusyudousa.cns',
      'utf8',
    ));
    const initial = createInitialGameState();
    const parent = {
      ...initial.players[0],
      stateNo: 0,
      moveType: 'I' as const,
      moveContact: {
        activeHitDefId: 1005,
        contact: true,
        hit: true,
        guarded: false,
        elapsed: 20,
        hitCount: 1,
      },
    };
    const helpers = spawnHelper(initial.helpers, {
      helperId: 5504,
      rootEntityId: 1,
      parentEntityId: 1,
      ownerCharacterId: 1,
      stateOwnerId: 1,
      animationOwnerId: 1,
      stateNo: 5506,
      x: parent.x,
      y: parent.y,
      facing: parent.facing,
      keyCtrl: false,
      ownPal: true,
      spawnFrame: 0,
      parent,
    }, document);
    let state = {
      ...initial,
      players: [parent, initial.players[1]] as typeof initial.players,
      helpers,
    };
    const diagnostics: string[] = [];

    for (let frame = 0; frame <= 201 && state.helpers.entries.length > 0; frame += 1) {
      state = stepCnsStateRuntime(state, document).state;
      diagnostics.push(...(state.hitDiagnosticLines ?? []));
      state = stepCnsPhysicsMotion(state, document);
    }

    expect(state.helpers.entries).toHaveLength(0);
    expect(diagnostics.join('\n')).toContain('event=destroy entityId=3');
  });
});
