import { useEffect, useRef } from 'react';
import { createInitialGameState } from '../core/engine/GameState';
import { stepGameByCns } from '../core/engine/CnsGame';
import { KeyboardInputSource } from '../input/KeyboardInputSource';
import { CanvasRenderer } from '../renderer/canvas2d/CanvasRenderer';
import { parseCnsText } from '../parser/cns/CnsParser';
import { parseAirText } from '../parser/air/AirParser';
import { parseCmdText } from '../parser/cmd/CmdParser';
import { loadSpritePack } from '../core/sprite/SpritePackLoader';
import { sampleCharacterCns } from './sampleCharacterCns';
import { sampleCharacterAir } from './sampleCharacterAir';
import { sampleCharacterCmd } from './sampleCharacterCmd';
import { sampleSpritePackManifest } from './sampleSpritePack';

export function WebMugenApp() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    const characterDefinition = parseCnsText(sampleCharacterCns);
    const airDocument = parseAirText(sampleCharacterAir);
    const cmdDocument = parseCmdText(sampleCharacterCmd);
    const input = new KeyboardInputSource();
    let state = createInitialGameState();

    let animationFrameId = 0;
    let lastTime = performance.now();
    let accumulator = 0;
    const fixedDeltaMs = 1000 / 60;

    const start = async () => {
      const spritePack = await loadSpritePack(sampleSpritePackManifest).catch(() => null);
      if (disposed) return;

      const renderer = new CanvasRenderer(canvas, airDocument, spritePack);

      const loop = (now: number) => {
        accumulator += now - lastTime;
        lastTime = now;

        while (accumulator >= fixedDeltaMs) {
          state = stepGameByCns(
            state,
            characterDefinition,
            input.readFrameInput(),
            airDocument,
            cmdDocument,
          );
          accumulator -= fixedDeltaMs;
        }

        renderer.render(state);
        animationFrameId = requestAnimationFrame(loop);
      };

      animationFrameId = requestAnimationFrame(loop);
    };

    void start();

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrameId);
      input.dispose();
    };
  }, []);

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>WebMUGEN</h1>
        <p>SpritePack renderer prototype</p>
      </header>

      <section className="stage-panel">
        <canvas ref={canvasRef} width={640} height={360} />
      </section>

      <section className="help-panel">
        <p>P1: ← / → 移動、↑ ジャンプ、A 攻撃、↓↘→A 飛び道具</p>
        <p>P2: J / L 移動、I ジャンプ、K しゃがみ入力、F 攻撃</p>
        <p>PNGスプライトがあればdrawImage、なければ従来の棒人間描画にフォールバックします。</p>
      </section>
    </main>
  );
}
