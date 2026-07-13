import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { parseAirText } from '../../parser/air/AirParser';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { CanvasRenderer } from '../../renderer/canvas2d/CanvasRenderer';
import type { SpritePack } from '../sprite/SpriteTypes';
import { stepCnsStateRuntime } from '../cns/CnsStateRuntime';
import { createInitialGameState } from '../engine/GameState';
import type { GameState } from '../engine/types';
import {
  applyExplodControllerEvents,
  removeExplodsOnOwnerHit,
  stepExplodRuntime,
  type ExplodControllerEvent,
} from './ExplodSystem';

const cns = parseCnsText(readFileSync('src/core/explod/fixtures/explod-visual-motion.cns', 'utf8'));
const air = parseAirText(readFileSync('src/core/explod/fixtures/modify-explod.air', 'utf8'));

describe('Explod visual and motion compatibility fixture', () => {
  it('applies deterministic random once, converts X by Facing once, and integrates velocity before acceleration', () => {
    let state = createFixtureExplod([0.75, 0]);
    expect(state.explods.entries[0]).toMatchObject({
      position: { x: 209, y: 262 }, offset: { x: 11, y: -23 },
      velocity: { x: -2, y: -3 }, acceleration: { x: -0.5, y: 0.25 }, random: { x: 4, y: 6 },
      pauseMoveTime: 8, superMoveTime: 7, removeOnGetHit: true,
    });
    state = stepExplodRuntime(state, () => air);
    expect(state.explods.entries[0]).toMatchObject({ position: { x: 209, y: 262 }, velocity: { x: -2, y: -3 } });
    state = stepExplodRuntime({ ...state, frame: 1 }, () => air);
    expect(state.explods.entries[0]).toMatchObject({ position: { x: 207, y: 259 }, velocity: { x: -2.5, y: -2.75 } });
    expect(state.hitDiagnosticLines?.join('\n')).toContain('movement=applied');
  });

  it('applies scale/facing/vfacing and additive alpha in the same Canvas draw', () => {
    const state = createFixtureExplod([0.75, 0]);
    const scale = vi.fn();
    const drawState: Array<{ composite: string; alpha: number }> = [];
    const context = fakeContext(scale, function (this: CanvasRenderingContext2D) {
      drawState.push({ composite: this.globalCompositeOperation, alpha: this.globalAlpha });
    });
    const diagnostics = renderer(context).render(state);

    expect(scale).toHaveBeenCalledWith(-2, -3);
    expect(drawState).toContainEqual({ composite: 'lighter', alpha: 0.5 });
    expect(diagnostics.join('\n')).toContain('trans=addalpha alpha=(128,128) composite=lighter ownpal=1 shadow=(4,5,6)');
    expect(diagnostics.join('\n')).toContain('limitation=destination_alpha_approximated');
    expect(diagnostics.join('\n')).toContain('limitation_ownpal=dynamic_palette_effects_unverified');
    expect(diagnostics.join('\n')).toContain('limitation_shadow=no_effect_shadow_pass');
  });

  it('removes removeongethit entries on an owner hit but not on guard', () => {
    const created = createFixtureExplod([0.5, 0.5]);
    const guarded = removeExplodsOnOwnerHit({
      ...created,
      hitEvents: [{ attackerId: 2, defenderId: 1, damage: 0, guarded: true }],
    });
    expect(guarded.explods.entries).toHaveLength(1);

    const hit = removeExplodsOnOwnerHit({
      ...created,
      hitEvents: [{ attackerId: 2, defenderId: 1, damage: 10 }],
    });
    expect(hit.explods.entries).toHaveLength(0);
    expect(hit.hitDiagnosticLines?.join('\n')).toContain('raw.explod_remove_on_gethit owner=p1 internalId=1 mugenId=100 reason=owner_hit');
  });
});

function createFixtureExplod(randomValues: number[]): GameState {
  const initial = createInitialGameState();
  const state = { ...initial, players: [{ ...initial.players[0], stateNo: 930, facing: -1 as const }, initial.players[1]] };
  const events: ExplodControllerEvent[] = [];
  const result = stepCnsStateRuntime(state, cns, { onExplodCreate: (event) => events.push(event) });
  let index = 0;
  return applyExplodControllerEvents(result.state, events, () => randomValues[index++] ?? 0);
}

function renderer(context: CanvasRenderingContext2D): CanvasRenderer {
  const canvas = { width: 640, height: 360, getContext: () => context } as unknown as HTMLCanvasElement;
  const image = {} as HTMLImageElement;
  const sprites: SpritePack = { sprites: new Map([['100,0', { groupNo: 100, imageNo: 0, src: '', xAxis: 0, yAxis: 0, image }]]) };
  return new CanvasRenderer(canvas, air, null, null, { 1: { airDocument: air, spritePack: sprites } });
}

function fakeContext(scale: ReturnType<typeof vi.fn>, drawImage: (this: CanvasRenderingContext2D) => void): CanvasRenderingContext2D {
  return {
    globalAlpha: 1, globalCompositeOperation: 'source-over',
    clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(),
    beginPath: vi.fn(), arc: vi.fn(), ellipse: vi.fn(), fill: vi.fn(), fillText: vi.fn(), drawImage, scale,
  } as unknown as CanvasRenderingContext2D;
}
