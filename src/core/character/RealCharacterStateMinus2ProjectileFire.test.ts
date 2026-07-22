import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { createInitialGameState } from '../engine/GameState';
import { applyExplodControllerEvents, type ExplodControllerEvent } from '../explod/ExplodSystem';
import { resolveProjectileHits } from '../projectile/ProjectileSystem';
import type { ProjectileState } from '../engine/types';

describe('T-H-M-A State -2 projectile fire effects', () => {
  it('runs ignorehitpause Explods when ProjHitTime(1005)=1 and suppresses duplicate ids through NumExplod', () => {
    const parsed = parseCnsText(readFileSync('public/chars/T-H-M-A/T-H-M-A/T-H-M-A-2.cns', 'utf8'));
    const stateMinus2 = parsed.states.find((state) => state.stateNo === -2)!;
    const fireControllers = stateMinus2.controllers.filter((controller) => (
      controller.type.toLowerCase() === 'explod'
      && controller.triggers.some((trigger) => /projhittime\(1005\)/i.test(trigger.expression))
    ));
    expect(fireControllers).toHaveLength(4);
    const cns = { metadataSections: parsed.metadataSections, states: [{ ...stateMinus2, controllers: fireControllers }] };

    const initial = createInitialGameState();
    const projectile: ProjectileState = {
      id: 1005, ownerId: 1, x: initial.players[1].x, y: 273, vx: 0, vy: 0,
      facing: 1, animNo: 15201, animTime: 0, lifeTime: 0, removeTime: 90,
      hitBox: { x: -12, y: -12, width: 24, height: 24 },
      hitDef: {
        damage: 140, guardDamage: 10,
        pauseTime: { attacker: 12, defender: 12 },
        groundVelocity: { x: -3, y: 0 }, airVelocity: { x: -3, y: 0 },
      },
    };
    const contact = resolveProjectileHits(initial.players, [projectile]);
    expect(contact.players[0]).toMatchObject({ hitPause: 12, projectileContacts: { 1005: { hitTime: 1 } } });
    expect(contact.players[1].moveType).toBe('H');

    const hitState = { ...initial, players: contact.players, projectiles: contact.projectiles };
    const events: ExplodControllerEvent[] = [];
    stepCnsStateRuntime(hitState, cns, { onExplodCreate: (event) => events.push(event) });
    const creates = events.filter((event) => event.type === 'create');
    expect(creates.map((event) => event.request.mugenId)).toEqual([16600, 16601, 16700, 16701]);
    expect(creates.every((event) => event.request.postype === 'p2' && event.request.pauseMoveTime === 40)).toBe(true);

    const withFire = applyExplodControllerEvents(hitState, events);
    const duplicateEvents: ExplodControllerEvent[] = [];
    stepCnsStateRuntime(withFire, cns, { onExplodCreate: (event) => duplicateEvents.push(event) });
    expect(duplicateEvents.filter((event) => event.type === 'create')).toHaveLength(0);
  });
});
