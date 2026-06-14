import { useEffect, useRef, useState } from 'react';
import { CanvasRenderer } from '../renderer/canvas2d/CanvasRenderer';
import { createInitialGameState } from '../core/engine/GameState';
import type { GameState } from '../core/engine/types';
import { loadAppCharacter } from './AppCharacterLoader';
import { BrowserInput } from './BrowserInput';
import { createInputDebugSnapshot } from '../input/InputDebugInfo';
import { formatInputDebugOverlay } from './InputDebugOverlay';
import { applyFallbackControls } from '../core/engine/FallbackControls';
import { stepFallbackMotion } from '../core/engine/FallbackMotionStep';
import { applyFallbackStageRules } from '../core/engine/FallbackStageRules';

const DEFAULT_CHARACTER_DEF_PATH = '/chars/kfm/kfm.def';

export function WebMugenApp() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const gameStateRef = useRef<GameState>(createInitialGameState());
  const inputRef = useRef<BrowserInput | null>(null);
  const [loadMessage, setLoadMessage] = useState('Loading character...');
  const [inputDebugLines, setInputDebugLines] = useState<string[]>(['keys=-']);

  useEffect(() => {
    let disposed = false;
    let frameId = 0;

    async function start() {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const loadResult = await loadAppCharacter(DEFAULT_CHARACTER_DEF_PATH);
      if (disposed) return;

      const character = loadResult.character;
      const spriteCount = character.sprites?.sprites.size ?? 0;

      setLoadMessage(
        loadResult.source === 'def'
          ? `Loaded character: ${DEFAULT_CHARACTER_DEF_PATH} sprites=${spriteCount}`
          : `Sample character fallback: ${loadResult.reason ?? 'unknown reason'}`,
      );

      rendererRef.current = new CanvasRenderer(
        canvas,
        character.air,
        null,
        character.sprites,
      );

      inputRef.current = new BrowserInput(window);

      const tick = () => {
        const input = inputRef.current;
        const pressedKeys = input?.getPressedKeys() ?? new Set<string>();
        const inputSnapshot = createInputDebugSnapshot(pressedKeys);

        setInputDebugLines(formatInputDebugOverlay(inputSnapshot));

        let nextState = gameStateRef.current;
        nextState = applyFallbackControls(nextState, inputSnapshot.p1, inputSnapshot.p2);
        nextState = stepFallbackMotion(nextState);
        nextState = applyFallbackStageRules(nextState);

        gameStateRef.current = nextState;
        rendererRef.current?.render(nextState);

        frameId = requestAnimationFrame(tick);
      };

      frameId = requestAnimationFrame(tick);
    }

    void start();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      inputRef.current?.dispose();
      inputRef.current = null;
    };
  }, []);

  return (
    <div>
      <h1>WebMUGEN</h1>
      <p>CharacterLoader app integration prototype</p>
      <canvas
        ref={canvasRef}
        width={960}
        height={540}
        style={{ border: '1px solid #475569', background: '#0f172a' }}
      />
      <p>{loadMessage}</p>
      <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', marginBottom: 16 }}>
        {inputDebugLines.join('\n')}
      </div>
      <p>P1: ← / → 移動, ↑ ジャンプ, A 攻撃, ↓ + A 飛び道具</p>
      <p>P2: J / L 移動, I ジャンプ, K しゃがみ入力, F 攻撃</p>
      <p>Place character files under <code>public/chars/kfm/</code> to try DEF-based loading.</p>
    </div>
  );
}
