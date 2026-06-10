import { useEffect, useRef } from 'react';
import { createInitialGameState } from '../core/engine/GameState';
import { stepGameByCns } from '../core/engine/CnsGame';
import { KeyboardInputSource } from '../input/KeyboardInputSource';
import { CanvasRenderer } from '../renderer/canvas2d/CanvasRenderer';
import { parseCnsText } from '../parser/cns/CnsParser';
import { sampleCharacterCns } from './sampleCharacterCns';

export function WebMugenApp() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new CanvasRenderer(canvas);
    const input = new KeyboardInputSource();
    const characterDefinition = parseCnsText(sampleCharacterCns);
    let state = createInitialGameState();

    let animationFrameId = 0;
    let lastTime = performance.now();
    let accumulator = 0;
    const fixedDeltaMs = 1000 / 60;

    const loop = (now: number) => {
      accumulator += now - lastTime;
      lastTime = now;

      while (accumulator >= fixedDeltaMs) {
        state = stepGameByCns(state, characterDefinition, input.readFrameInput());
        accumulator -= fixedDeltaMs;
      }

      renderer.render(state);
      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      input.dispose();
    };
  }, []);

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>WebMUGEN</h1>
        <p>2P hitbox prototype</p>
      </header>

      <section className="stage-panel">
        <canvas ref={canvasRef} width={640} height={360} />
      </section>

      <section className="help-panel">
        <p>P1: ← / → 移動、↑ ジャンプ、A 攻撃</p>
        <p>P2: J / L 移動、I ジャンプ、F 攻撃</p>
        <p>緑枠がbody box、赤枠がattack boxです。</p>
      </section>
    </main>
  );
}
