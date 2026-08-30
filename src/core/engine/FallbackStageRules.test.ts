import { describe, expect, it } from 'vitest';
import { spawnHelper } from '../helper/HelperSystem';
import { createInitialGameState } from './GameState';
import { applyFallbackStageRules, buildPushBox, buildScreenEdgeBox } from './FallbackStageRules';

describe('FallbackStageRules', () => {
  it('makes players face each other', () => {
    const state = createInitialGameState();
    const next = applyFallbackStageRules({
      ...state,
      players: [
        { ...state.players[0], x: 700 },
        { ...state.players[1], x: 300 },
      ],
    });

    expect(next.players[0]).toMatchObject({ stateNo: 0, facing: -1, animNo: 5, animTime: 0, ctrl: true });
    expect(next.players[1]).toMatchObject({ stateNo: 0, facing: 1, animNo: 5, animTime: 0, ctrl: true });
  });

  it('clamps players to stage bounds', () => {
    const state = createInitialGameState();
    const next = applyFallbackStageRules({
      ...state,
      players: [
        { ...state.players[0], x: -999 },
        { ...state.players[1], x: 9999 },
      ],
    });

    expect(next.players[0].x).toBeGreaterThanOrEqual(48);
    expect(next.players[1].x).toBeLessThanOrEqual(912);
  });

  it('pushes overlapping players apart', () => {
    const state = createInitialGameState();
    const next = applyFallbackStageRules({
      ...state,
      players: [
        { ...state.players[0], x: 300 },
        { ...state.players[1], x: 320 },
      ],
    });

    expect(next.players[1].x - next.players[0].x).toBeGreaterThanOrEqual(32);
  });

  it('resolves facing again after equal-position push separation', () => {
    const state = createInitialGameState();
    const next = applyFallbackStageRules({
      ...state,
      players: [
        { ...state.players[0], x: 320, facing: 1 },
        { ...state.players[1], x: 320, facing: 1 },
      ],
    });
    expect(next.players[0].x).toBeLessThan(next.players[1].x);
    expect(next.players.map(({ facing }) => facing)).toEqual([1, -1]);
    expect(next.players.map(({ animNo }) => animNo)).toEqual([0, 5]);
  });

  it('honors noautoturn in an attacking wall-carry state when TargetBind places P2 behind P1', () => {
    const state = createInitialGameState();
    const next = applyFallbackStageRules({
      ...state,
      players: [
        { ...state.players[0], x: 400, facing: 1, moveType: 'A', ctrl: false, noAutoTurn: true },
        { ...state.players[1], x: 380, facing: 1, moveType: 'H', ctrl: false, noAutoTurn: true },
      ],
    });

    expect(next.players[0].facing).toBe(1);
    expect(next.players[1].facing).toBe(1);
  });

  it('reapplies TargetBind after stage clamping and push, then clears an expired bind', () => {
    const state = createInitialGameState();
    const next = applyFallbackStageRules({
      ...state,
      players: [
        { ...state.players[0], x: 950, y: 120, vx: 4, vy: -2, facing: -1, moveType: 'A' },
        {
          ...state.players[1], x: 940, y: 120, vx: 99, vy: 99, moveType: 'H',
          targetBind: { ownerId: 1, remaining: 0, offsetX: 20, offsetY: -30 },
        },
      ],
    });

    expect(next.players[0].x).toBe(912);
    expect(next.players[1]).toMatchObject({ x: 892, y: 90, vx: 4, vy: -2 });
    expect(next.players[1].targetBind).toBeUndefined();
  });

  it('keeps a target attached to its Helper owner during final stage correction', () => {
    const state = createInitialGameState();
    state.helpers = spawnHelper(state.helpers, {
      helperId: 1462,
      rootEntityId: 1,
      parentEntityId: 1,
      ownerCharacterId: 1,
      stateOwnerId: 1,
      animationOwnerId: 1,
      stateNo: 1464,
      x: 420,
      y: 90,
      facing: -1,
      keyCtrl: false,
      ownPal: true,
      spawnFrame: -1,
      parent: state.players[0],
    });
    const hand = state.helpers.entries[0];
    hand.player = { ...hand.player, vx: -3, vy: 2 };
    state.players[1] = {
      ...state.players[1],
      x: 800,
      y: 200,
      moveType: 'H',
      stateType: 'A',
      targetBind: { ownerId: hand.entityId, remaining: 1, offsetX: 85, offsetY: 10 },
    };

    const next = applyFallbackStageRules(state);

    expect(next.players[1]).toMatchObject({
      x: 335,
      y: 100,
      vx: -3,
      vy: 2,
      targetBind: { ownerId: hand.entityId, remaining: 1, offsetX: 85, offsetY: 10 },
    });
  });

  it.each([
    { label: 'P1 approaches P2', p1X: 319, p2X: 320 },
    { label: 'P2 approaches P1', p1X: 300, p2X: 301 },
  ])('keeps ground players separated when $label', ({ p1X, p2X }) => {
    const state = createInitialGameState();
    const next = applyFallbackStageRules({
      ...state,
      players: [
        { ...state.players[0], x: p1X, y: 285, stateType: 'S', physics: 'S' },
        { ...state.players[1], x: p2X, y: 285, stateType: 'S', physics: 'S' },
      ],
    });

    expect(Math.abs(next.players[1].x - next.players[0].x)).toBeGreaterThanOrEqual(32);
  });

  it('separates both ground players when they approach simultaneously', () => {
    const state = createInitialGameState();
    const next = applyFallbackStageRules({
      ...state,
      players: [
        { ...state.players[0], x: 310, y: 285, vx: 2.4 },
        { ...state.players[1], x: 330, y: 285, vx: -2.4 },
      ],
    });

    expect(Math.abs(next.players[1].x - next.players[0].x)).toBeGreaterThanOrEqual(32);
  });

  it('does not push players apart when their push boxes do not overlap vertically', () => {
    const state = createInitialGameState();
    const next = applyFallbackStageRules({
      ...state,
      players: [
        { ...state.players[0], x: 300, y: 260, stateType: 'A' },
        { ...state.players[1], x: 300, y: 360 },
      ],
    });

    expect(next.players[0].x).toBe(300);
    expect(next.players[1].x).toBe(300);
  });

  it('preserves the airborne player facing after an aerial cross-over', () => {
    const state = createInitialGameState();
    const next = applyFallbackStageRules({
      ...state,
      players: [
        { ...state.players[0], x: 340, y: 260, stateType: 'A', facing: 1 },
        { ...state.players[1], x: 300, y: 360, facing: -1 },
      ],
    });

    expect(next.players[0].x).toBe(340);
    expect(next.players[1].x).toBe(300);
    expect(next.players[0].facing).toBe(1);
    expect(next.players[1].facing).toBe(1);
    expect(next.hitDiagnosticLines?.join('\n')).toContain('raw.cross airborne=1');
  });

  it('pushes an airborne player whose vertical push box still overlaps', () => {
    const state = createInitialGameState();
    const next = applyFallbackStageRules({
      ...state,
      players: [
        { ...state.players[0], x: 300, y: 240, stateType: 'A', physics: 'A' },
        { ...state.players[1], x: 320, y: 285 },
      ],
    });

    expect(Math.abs(next.players[1].x - next.players[0].x)).toBeGreaterThanOrEqual(28);
  });

  it('does not push either player when PlayerPush is disabled', () => {
    const state = createInitialGameState();
    const next = applyFallbackStageRules({
      ...state,
      players: [
        { ...state.players[0], x: 300, playerPush: false },
        { ...state.players[1], x: 320 },
      ],
    });

    expect(next.players[0].x).toBe(300);
    expect(next.players[1].x).toBe(320);
    expect(next.hitDiagnosticLines?.join('\n')).toContain('result=skip_playerpush');
  });

  it('uses Size ground front/back, height, scale, and Facing exactly once', () => {
    const state = createInitialGameState();
    const box = buildPushBox({
      ...state.players[0],
      x: 300,
      y: 285,
      facing: -1,
      collisionWidth: {
        groundFront: 20, groundBack: 10, airFront: 8, airBack: 6,
        height: 70, xScale: 1.5, yScale: 2,
      },
    });

    expect(box).toMatchObject({
      left: 270, right: 315, top: 145, bottom: 285,
      front: 30, back: 15, height: 140,
      mode: 'ground', source: 'character_size',
    });
  });

  it('uses the Width controller edge and player pairs for their separate bars', () => {
    const state = createInitialGameState();
    const player = {
      ...state.players[0],
      x: 300,
      facing: 1 as const,
      widthOverride: {
        edge: { front: 70, back: 0 },
        player: { front: 8, back: 6 },
      },
    };

    expect(buildScreenEdgeBox(player)).toMatchObject({ left: 300, right: 370, front: 70, back: 0, source: 'width_controller' });
    expect(buildPushBox(player)).toMatchObject({ left: 294, right: 308, front: 8, back: 6, source: 'width_controller' });
  });

  it('switches to Size air front/back and preserves both airborne facings', () => {
    const state = createInitialGameState();
    const widths = {
      groundFront: 20, groundBack: 10, airFront: 7, airBack: 5,
      height: 50, xScale: 2, yScale: 1,
    };
    const next = applyFallbackStageRules({
      ...state,
      players: [
        { ...state.players[0], x: 340, y: 200, stateType: 'A', physics: 'A', facing: 1, collisionWidth: widths },
        { ...state.players[1], x: 300, y: 200, stateType: 'A', physics: 'A', facing: -1, collisionWidth: widths },
      ],
    });

    expect(buildPushBox(next.players[0])).toMatchObject({ front: 14, back: 10, mode: 'air' });
    expect(next.players[0].facing).toBe(1);
    expect(next.players[1].facing).toBe(-1);
    expect(next.hitDiagnosticLines?.join('\n')).toContain('source=character_size mode=air');
  });

  it('auto-turns only State 0 and State 11 and selects their standard turn animations', () => {
    const state = createInitialGameState();
    for (const player of [
      { stateNo: 0, stateType: 'S' as const, moveType: 'I' as const, physics: 'S' as const, expectedFacing: -1, expectedAnim: 5 },
      { stateNo: 11, stateType: 'C' as const, moveType: 'I' as const, physics: 'C' as const, expectedFacing: -1, expectedAnim: 6 },
      { stateNo: 0, stateType: 'S' as const, moveType: 'A' as const, physics: 'S' as const, expectedFacing: 1, expectedAnim: 0 },
      { stateNo: 20, stateType: 'S' as const, moveType: 'I' as const, physics: 'S' as const, expectedFacing: 1, expectedAnim: 20 },
      { stateNo: 200, stateType: 'S' as const, moveType: 'A' as const, physics: 'S' as const, expectedFacing: 1, expectedAnim: 200 },
      { stateNo: 5000, stateType: 'S' as const, moveType: 'H' as const, physics: 'N' as const, expectedFacing: 1, expectedAnim: 5000 },
      { stateNo: 50, stateType: 'A' as const, moveType: 'I' as const, physics: 'A' as const, expectedFacing: 1, expectedAnim: 50 },
      { stateNo: 52, stateType: 'S' as const, moveType: 'I' as const, physics: 'S' as const, expectedFacing: 1, expectedAnim: 52 },
    ]) {
      const next = applyFallbackStageRules({
        ...state,
        players: [
          { ...state.players[0], ...player, animNo: player.stateNo, x: 500, facing: 1, ctrl: false },
          { ...state.players[1], x: 300, facing: -1 },
        ],
      });
      expect(next.players[0], `state ${player.stateNo}`).toMatchObject({
        stateNo: player.stateNo,
        facing: player.expectedFacing,
        animNo: player.expectedAnim,
        ctrl: player.moveType === 'I' && (player.stateNo === 0 || player.stateNo === 11),
      });
    }
  });

  it('does not restart a turn animation after Facing already matches the opponent', () => {
    const state = createInitialGameState();
    const next = applyFallbackStageRules({
      ...state,
      players: [
        { ...state.players[0], stateNo: 0, x: 500, facing: -1, animNo: 5, animTime: 3, ctrl: true },
        { ...state.players[1], x: 300, facing: 1 },
      ],
    });
    expect(next.players[0]).toMatchObject({ facing: -1, animNo: 5, animTime: 3, ctrl: true });
  });

  it('preserves facing when stage autoturn is disabled or noautoturn is asserted', () => {
    const state = createInitialGameState();
    const crossed = { ...state, players: [
      { ...state.players[0], x: 500, facing: 1 },
      { ...state.players[1], x: 300, facing: -1 },
    ] as typeof state.players };
    expect(applyFallbackStageRules(crossed, { autoTurn: false }).players.map(({ facing }) => facing)).toEqual([1, -1]);
    expect(applyFallbackStageRules({
      ...crossed,
      players: crossed.players.map((player) => ({ ...player, noAutoTurn: true })) as typeof state.players,
    }).players.map(({ facing }) => facing)).toEqual([1, -1]);
  });

  it('defers auto-turn for hitpause and globally frozen players', () => {
    const state = createInitialGameState();
    const crossed = { ...state, players: [
      { ...state.players[0], x: 500, facing: 1, hitPause: 2 },
      { ...state.players[1], x: 300, facing: -1 },
    ] as typeof state.players };
    const hitPaused = applyFallbackStageRules(crossed);
    expect(hitPaused.players.map(({ facing }) => facing)).toEqual([1, 1]);

    const paused = applyFallbackStageRules({
      ...crossed,
      players: crossed.players.map((player) => ({ ...player, hitPause: 0 })) as typeof state.players,
      pause: { pauseTime: 2, superPauseTime: 0, darken: false, moveTime: 0, ownerEntityId: 1, kind: 'pause', resumeGuard: false },
    });
    expect(paused.players.map(({ facing }) => facing)).toEqual([1, -1]);
  });
});
