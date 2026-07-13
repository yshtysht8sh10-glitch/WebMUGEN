import { describe, expect, it } from 'vitest';
import { parseCnsText } from '../../parser/cns/CnsParser';
import type { ExplodCreateEvent } from '../explod/ExplodSystem';
import { createInitialGameState } from '../engine/GameState';
import { stepCnsStateRuntime } from './CnsStateRuntime';

describe('Explod CNS production creation', () => {
  it('evaluates and freezes the complete Issue #30 creation snapshot', () => {
    const events: ExplodCreateEvent[] = [];
    const cns = parseCnsText(`
[StateDef 0]
type = S
[State 0, Effect]
type = Explod
trigger1 = Time = 0
anim = var(0) + 10
id = 1000
pos = 20, -40
postype = p1
facing = -1
vfacing = -1
bindtime = 3
removetime = 12
sprpriority = 4
ontop = 1
vel = 2, -3
accel = .5, .25
scale = .75, 1.25
trans = addalpha
alpha = 200, 56
ownpal = 1
random = 6, 8
shadow = 1
removeongethit = 1
pausemovetime = 2
supermovetime = 4
`);
    const initial = createInitialGameState();
    const p1 = { ...initial.players[0], vars: { 0: 90 }, facing: 1 as const };
    stepCnsStateRuntime({ ...initial, players: [p1, initial.players[1]] }, cns, { onExplodCreate: (event) => events.push(event) });
    const created = events.find((event) => event.type === 'create' && event.request.owner.entityId === 1);
    expect(created).toMatchObject({
      type: 'create',
      request: {
        mugenId: 1000, animNo: 100, animationSource: 'owner', position: { x: 240, y: 245 }, offset: { x: 20, y: -40 },
        facing: -1, verticalFacing: -1, bind: { targetEntityId: 1, remaining: 3 }, removeTime: 12,
        spritePriority: 4, onTop: true, velocity: { x: -2, y: -3 }, acceleration: { x: -0.5, y: 0.25 },
        pauseMoveTime: 2, superMoveTime: 4, removeOnGetHit: true, random: { x: 6, y: 8 },
        render: { transparency: 'addalpha', alpha: { source: 200, destination: 56 }, scaleX: 0.75, scaleY: 1.25, ownPalette: true, shadow: 1 },
      },
    });
  });

  it.each([
    ['p1', 230, 280, 1, 'stage'],
    ['p2', 410, 280, -1, 'stage'],
    ['front', 650, -5, 1, 'screen'],
    ['back', 10, -5, 1, 'screen'],
    ['left', 10, -5, 1, 'screen'],
    ['right', 650, -5, 1, 'screen'],
    ['none', 10, -5, 1, 'stage'],
  ] as const)('resolves postype=%s once at creation', (postype, x, y, facing, coordinateSpace) => {
    const events: ExplodCreateEvent[] = [];
    const cns = parseCnsText(`[StateDef 0]\ntype=S\n[State 0, E]\ntype=Explod\ntrigger1=1\nanim=10\npos=10,-5\npostype=${postype}`);
    const initial = createInitialGameState();
    stepCnsStateRuntime(initial, cns, { onExplodCreate: (event) => events.push(event) });
    const event = events.find((item) => item.type === 'create' && item.request.owner.entityId === 1);
    expect(event).toMatchObject({ type: 'create', request: { position: { x, y }, facing, coordinateSpace } });
  });

  it('allows duplicate MUGEN ids, separates owners, honors false triggers, and rejects missing/invalid anim safely', () => {
    const events: ExplodCreateEvent[] = [];
    const cns = parseCnsText(`
[StateDef 0]
type=S
[State 0, First]
type=Explod
trigger1=1
anim=F72
id=9
[State 0, Second]
type=Explod
trigger1=1
anim=73
id=9
[State 0, Never]
type=Explod
trigger1=Time=99
anim=74
[State 0, Missing]
type=Explod
trigger1=1
[State 0, Invalid]
type=Explod
trigger1=1
anim=not_an_expression
`);
    stepCnsStateRuntime(createInitialGameState(), cns, { onExplodCreate: (event) => events.push(event) });
    const creates = events.filter((event) => event.type === 'create');
    expect(creates).toHaveLength(4);
    expect(creates.map((event) => event.request.owner.rootPlayerId)).toEqual([1, 1, 2, 2]);
    expect(creates[0]).toMatchObject({ request: { mugenId: 9, animationSource: 'fightfx', animNo: 72 } });
    expect(events.filter((event) => event.type === 'rejected').map((event) => event.reason)).toEqual([
      'missing_anim', 'invalid_anim', 'missing_anim', 'invalid_anim',
    ]);
  });
});
