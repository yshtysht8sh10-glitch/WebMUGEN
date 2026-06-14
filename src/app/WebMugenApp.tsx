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
import { resolveFallbackHits } from '../core/engine/FallbackHitResolver';
import { applyFallbackHitRecovery } from '../core/engine/FallbackHitRecovery';
import {
  createInitialHitFeedbackState,
  updateHitFeedback,
  type HitFeedbackState,
} from '../core/engine/HitFeedback';
import {
  createInitialRoundState,
  formatRoundState,
  stepRoundState,
  type RoundState,
} from '../core/engine/RoundState';
import {
  createInitialRoundScore,
  formatRoundScore,
  updateRoundScore,
  type RoundScore,
} from '../core/engine/RoundScore';
import { canRestartRound, restartRound } from '../core/engine/RoundRestart';
import { getAnimationDuration } from '../core/animation/AnimationDuration';
import { createFallbackCnsCommandSet } from '../core/cns/CnsCommandInput';
import { attachFallbackAttackStates } from '../core/cns/CnsFallbackDocument';
import {
  stepCnsStateRuntime,
  type CnsRuntimeTrace,
} from '../core/cns/CnsStateRuntime';
import { formatCnsRuntimeDebugOverlay } from './CnsRuntimeDebugOverlay';
import { formatCnsCommandDebugOverlay } from './CnsCommandDebugOverlay';

const DEFAULT_CHARACTER_DEF_PATH = '/chars/kfm/kfm.def';

export function WebMugenApp() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const gameStateRef = useRef<GameState>(createInitialGameState());
  const hitFeedbackRef = useRef<HitFeedbackState>(createInitialHitFeedbackState());
  const roundStateRef = useRef<RoundState>(createInitialRoundState());
  const roundScoreRef = useRef<RoundScore>(createInitialRoundScore());
  const cnsTraceRef = useRef<CnsRuntimeTrace[]>([]);
  const restartPressedRef = useRef(false);
  const inputRef = useRef<BrowserInput | null>(null);
  const [loadMessage, setLoadMessage] = useState('Loading character...');
  const [inputDebugLines, setInputDebugLines] = useState<string[]>(['keys=-']);
  const [roundDebugLine, setRoundDebugLine] = useState(formatRoundState(createInitialRoundState()));
  const [scoreDebugLine, setScoreDebugLine] = useState(formatRoundScore(createInitialRoundScore()));
  const [cnsDebugLines, setCnsDebugLines] = useState<string[]>([]);
  const [commandDebugLines, setCommandDebugLines] = useState<string[]>(['cmd p1=-', 'cmd p2=-']);

  useEffect(() => {
    let disposed = false;
    let frameId = 0;

    async function start() {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const loadResult = await loadAppCharacter(DEFAULT_CHARACTER_DEF_PATH);
      if (disposed) return;

      const character = {
        ...loadResult.character,
        cns: attachFallbackAttackStates(loadResult.character.cns),
      };
      const spriteCount = character.sprites?.sprites.size ?? 0;

      setLoadMessage(
        loadResult.source === 'def'
          ? `Loaded character: ${DEFAULT_CHARACTER_DEF_PATH} sprites=${spriteCount} cnsStates=${character.cns.states.length}`
          : `Sample character fallback: ${loadResult.reason ?? 'unknown reason'} cnsStates=${character.cns.states.length}`,
      );

      rendererRef.current = new CanvasRenderer(canvas, character.air, null, character.sprites);
      inputRef.current = new BrowserInput(window);

      const tick = () => {
        const input = inputRef.current;
        const pressedKeys = input?.getPressedKeys() ?? new Set<string>();
        const inputSnapshot = createInputDebugSnapshot(pressedKeys);
        const p1Commands = createFallbackCnsCommandSet(inputSnapshot.p1);
        const p2Commands = createFallbackCnsCommandSet(inputSnapshot.p2);

        setInputDebugLines(formatInputDebugOverlay(inputSnapshot));
        setCommandDebugLines(formatCnsCommandDebugOverlay(p1Commands, p2Commands));

        let nextState = gameStateRef.current;
        let nextRoundState = roundStateRef.current;
        let nextFeedback = hitFeedbackRef.current;
        let nextScore = roundScoreRef.current;
        let nextCnsTraces = cnsTraceRef.current;

        if (
          inputSnapshot.system.restartRound &&
          !restartPressedRef.current &&
          canRestartRound(nextRoundState)
        ) {
          const restarted = restartRound(nextRoundState.roundNo);
          nextState = restarted.gameState;
          nextRoundState = restarted.roundState;
          nextFeedback = restarted.hitFeedbackState;
          nextCnsTraces = [];
        } else if (nextRoundState.phase === 'fight') {
          nextState = applyFallbackControls(nextState, inputSnapshot.p1, inputSnapshot.p2);

          const cnsResult = stepCnsStateRuntime(nextState, character.cns, {
            p1Commands,
            p2Commands,
            getAnimationDuration: (animNo) => getAnimationDuration(character.air, animNo),
          });
          nextState = cnsResult.state;
          nextCnsTraces = cnsResult.traces;

          nextState = stepFallbackMotion(nextState);
          nextState = applyFallbackStageRules(nextState);
          nextState = resolveFallbackHits(nextState, character.air);
          nextState = applyFallbackHitRecovery(nextState);
          nextRoundState = stepRoundState(nextRoundState, nextState);
          nextScore = updateRoundScore(nextScore, nextRoundState);
          nextFeedback = updateHitFeedback(nextFeedback, nextState);
        } else {
          nextRoundState = stepRoundState(nextRoundState, nextState);
          nextScore = updateRoundScore(nextScore, nextRoundState);
          nextFeedback = updateHitFeedback(nextFeedback, nextState);
        }

        restartPressedRef.current = inputSnapshot.system.restartRound;

        gameStateRef.current = nextState;
        hitFeedbackRef.current = nextFeedback;
        roundStateRef.current = nextRoundState;
        roundScoreRef.current = nextScore;
        cnsTraceRef.current = nextCnsTraces;
        setRoundDebugLine(formatRoundState(nextRoundState));
        setScoreDebugLine(formatRoundScore(nextScore));
        setCnsDebugLines(formatCnsRuntimeDebugOverlay(nextCnsTraces));

        rendererRef.current?.render(nextState, nextFeedback, nextRoundState, nextScore);

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
        {[...inputDebugLines, ...commandDebugLines, roundDebugLine, scoreDebugLine, ...cnsDebugLines].join('\n')}
      </div>
      <p>P1: ← / → 移動, ↑ ジャンプ, A 攻撃, ↓ + A 飛び道具</p>
      <p>P2: J / L 移動, I ジャンプ, K しゃがみ入力, F 攻撃</p>
      <p>System: R ラウンド再開（KO/TIME OVER後）</p>
      <p>Place character files under <code>public/chars/kfm/</code> to try DEF-based loading.</p>
    </div>
  );
}
