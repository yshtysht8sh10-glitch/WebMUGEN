import { useEffect, useRef } from 'react';
import { createInitialGameState } from '../core/engine/GameState';
import { stepGameByCns } from '../core/engine/CnsGame';
import { KeyboardInputSource } from '../input/KeyboardInputSource';
import { CanvasRenderer } from '../renderer/canvas2d/CanvasRenderer';
import { parseCnsText } from '../parser/cns/CnsParser';
import { parseAirText } from '../parser/air/AirParser';
import { sampleCharacterCns } from './sampleCharacterCns';
import { sampleCharacterAir } from './sampleCharacterAir';

export function WebMugenApp() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const characterDefinition = parseCnsText(sampleCharacterCns);
    const airDocument = parseAirText(sampleCharacterAir);
    const renderer = new CanvasRenderer(canvas, airDocument);
    const input = new KeyboardInputSource();
    let state = createInitialGameState();

    let animationFrameId = 0;
    let lastTime = performance.now();
    let accumulator = 0;
    const fixedDeltaMs = 1000 / 60;

    const loop = (now: number) => {
      accumulator += now - lastTime;
      lastTime = now;

      while (accumulator >= fixedDeltaMs) {
        state = stepGameByCns(state, characterDefinition, input.readFrameInput(), airDocument);
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
        <p>AIR-driven animation prototype</p>
      </header>

      <section className="stage-panel">
        <canvas ref={canvasRef} width={640} height={360} />
      </section>

      <section className="help-panel">
        <p>P1: ← / → 移動、↑ ジャンプ、A 攻撃</p>
        <p>P2: J / L 移動、I ジャンプ、F 攻撃</p>
        <p>AIRの現在要素をキャラクター上部に表示します。</p>
      </section>
    </main>
  );
}
