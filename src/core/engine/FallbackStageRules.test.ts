import { describe, expect, it } from 'vitest';
import { createInitialGameState } from './GameState';
import { applyFallbackStageRules, buildPushBox } from './FallbackStageRules';

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

    expect(next.players[0].facing).toBe(-1);
    expect(next.players[1].facing).toBe(1);
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

  it('allows an aerial cross-over without automatically turning the airborne player', () => {
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
});
