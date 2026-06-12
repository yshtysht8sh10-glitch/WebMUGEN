import { useEffect, useRef, useState } from 'react';
import { createInitialGameState } from '../core/engine/GameState';
import { stepGameByCns } from '../core/engine/CnsGame';
import { KeyboardInputSource } from '../input/KeyboardInputSource';
import { CanvasRenderer } from '../renderer/canvas2d/CanvasRenderer';
import { loadSpritePack } from '../core/sprite/SpritePackLoader';
import { sampleSpritePackManifest } from './sampleSpritePack';
import { createSampleCharacterAssets, loadAppCharacter } from './AppCharacterLoader';

const DEFAULT_CHARACTER_DEF_PATH = '/chars/kfm/kfm.def';

export function WebMugenApp() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loadMessage, setLoadMessage] = useState('Loading character assets...');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    const input = new KeyboardInputSource();
    let state = createInitialGameState();
    let animationFrameId = 0;
    let lastTime = performance.now();
    let accumulator = 0;
    const fixedDeltaMs = 1000 / 60;

    const start = async () => {
      const loadResult = await loadAppCharacter(DEFAULT_CHARACTER_DEF_PATH);
      const sampleAssets = createSampleCharacterAssets();
      const assets = loadResult.character ?? sampleAssets;
      const pngSpritePack = await loadSpritePack(sampleSpritePackManifest).catch(() => null);

      if (disposed) return;

      setLoadMessage(
        loadResult.source === 'def'
          ? `Loaded character: ${DEFAULT_CHARACTER_DEF_PATH}`
          : `Sample character fallback: ${loadResult.errorMessage ?? 'character def was not loaded'}`,
      );

      const renderer = new CanvasRenderer(canvas, assets.air, pngSpritePack, assets.sprites);

      const loop = (now: number) => {
        accumulator += now - lastTime;
        lastTime = now;

        while (accumulator >= fixedDeltaMs) {
          state = stepGameByCns(
            state,
            assets.cns,
            input.readFrameInput(),
            assets.air,
            assets.cmd,
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
        <p>CharacterLoader app integration prototype</p>
      </header>

      <section className="stage-panel">
        <canvas ref={canvasRef} width={640} height={360} />
      </section>

      <section className="help-panel">
        <p>{loadMessage}</p>
        <p>P1: ← / → 移動、↑ ジャンプ、A 攻撃、↓↘→A 飛び道具</p>
        <p>P2: J / L 移動、I ジャンプ、K しゃがみ入力、F 攻撃</p>
        <p>
          Place character files under <code>public/chars/kfm/</code> to try DEF-based loading.
        </p>
      </section>
    </main>
  );
}
