import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { CanvasRenderer } from '../renderer/canvas2d/CanvasRenderer';
import { createInitialGameState } from '../core/engine/GameState';
import type { GameState } from '../core/engine/types';
import { createSampleCharacterAssets, loadAppCharacter } from './AppCharacterLoader';
import type { CharacterSourceFile } from '../core/character/CharacterTypes';
import {
  BrowserInput,
  DEFAULT_INPUT_CONFIG,
  keysToP1Input,
  keysToP2Input,
  type InputConfig,
  type PlayerInputMapping,
} from './BrowserInput';
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
  DEFAULT_ROUND_TIMER,
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
import { calculateMugenAnimTime, getMugenAnimEndTime } from '../core/animation/AnimationDuration';
import { getCurrentAnimationElement } from '../core/animation/AnimationPlayer';
import { attachFallbackAttackStates } from '../core/cns/CnsFallbackDocument';
import { analyzeCnsCoverage } from '../core/cns/CnsCoverageDiagnostics';
import type { CnsCoverageDiagnostics } from '../core/cns/CnsCoverageDiagnostics';
import {
  stepCnsStateRuntime,
  type CnsRuntimeTrace,
} from '../core/cns/CnsStateRuntime';
import { stepCnsPhysicsMotion } from '../core/cns/CnsPhysicsStep';
import { formatCnsRuntimeDebugOverlay } from './CnsRuntimeDebugOverlay';
import { formatCnsCommandDebugOverlay } from './CnsCommandDebugOverlay';
import { formatCnsCoverageDebugOverlay } from './CnsCoverageDebugOverlay';
import { formatPhysicsDebugOverlay } from './PhysicsDebugOverlay';
import { InputBuffer } from '../input/InputBuffer';
import { resolveCommands } from '../input/CommandResolver';
import { evaluateCnsRuntimeTrigger, readNumberExpression, type CnsRuntimeTriggerContext } from '../core/cns/CnsRuntimeTrigger';
import type { CnsDocument, CnsStateController, CnsStateDefinition, CnsTrigger } from '../mugen/common/cnsTypes';

const DEFAULT_CHARACTER_DEF_PATH = '/chars/T-H-M-A.zip';
const ENABLE_RUNTIME_FALLBACKS = false;
const RUNTIME_HISTORY_LIMIT = 500;
const READABLE_RUNTIME_HISTORY_LIMIT = 4000;
const INPUT_CONFIG_STORAGE_KEY = 'webmugen.inputConfig.v1';
const CHARACTER_PATH_STORAGE_KEY = 'webmugen.characterPath.v1';
const RUNTIME_SETTINGS_STORAGE_KEY = 'webmugen.runtimeSettings.v1';
const CHARACTER_PATH_OPTIONS = ['/chars/T-H-M-A.zip', '/chars/kfm/kfm.def'] as const;
const DEFAULT_FRAME_INTERVAL_MS = 1000 / 60;

type RuntimeSettings = {
  roundTime: number;
  frameIntervalMs: number;
};

const DEFAULT_RUNTIME_SETTINGS: RuntimeSettings = {
  roundTime: DEFAULT_ROUND_TIMER,
  frameIntervalMs: DEFAULT_FRAME_INTERVAL_MS,
};

type DebugTab = 'static' | 'runtime' | 'ideas' | 'manual' | 'settings';
type RuntimeLogTab = 'human' | 'ai';
type CnsSourceSelection = { path: string; line: number } | null;

type StaticDebugInfo = {
  characterRows: string[];
  stateRows: StateDebugRow[];
  commandRows: string[];
};

type StateDebugRow = {
  stateNo: number;
  origin: 'character' | 'common' | 'mixed' | 'unknown';
  originLabel: string;
  sourceDetail: string;
  summary: string;
  routes: string[];
};

const EMPTY_STATIC_DEBUG_INFO: StaticDebugInfo = {
  characterRows: ['character=-'],
  stateRows: [],
  commandRows: ['commands=-'],
};

export function WebMugenApp() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const gameStateRef = useRef<GameState>(createInitialGameState());
  const hitFeedbackRef = useRef<HitFeedbackState>(createInitialHitFeedbackState());
  const roundStateRef = useRef<RoundState>(createInitialRoundState());
  const roundScoreRef = useRef<RoundScore>(createInitialRoundScore());
  const cnsTraceRef = useRef<CnsRuntimeTrace[]>([]);
  const cnsCoverageRef = useRef<CnsCoverageDiagnostics | null>(null);
  const p1CommandBufferRef = useRef(new InputBuffer(60));
  const p2CommandBufferRef = useRef(new InputBuffer(60));
  const restartPressedRef = useRef(false);
  const inputRef = useRef<BrowserInput | null>(null);
  const inputConfigRef = useRef<InputConfig>(loadInputConfig());
  const runtimeSettingsRef = useRef<RuntimeSettings>(loadRuntimeSettings());
  const lastFrameTickTimeRef = useRef<number | null>(null);
  const frameNoRef = useRef(0);
  const runtimeHistoryRef = useRef<string[]>([]);
  const readableRuntimeHistoryRef = useRef<string[]>([]);
  const stateTransitionLogRef = useRef<string[]>([]);
  const lastRuntimeSignatureRef = useRef('');
  const lastReadableRuntimeSignatureRef = useRef('');
  const stateTransitionHistoryRef = useRef<string[]>([]);
  const inputHistoryRef = useRef<string[]>([]);
  const damageHistoryRef = useRef<string[]>([]);
  const lastStageKeySignatureRef = useRef('');
  const lastStateNosRef = useRef<[number, number]>([0, 0]);
  const stateTransitionLogLastStateNosRef = useRef<[number, number]>([0, 0]);
  const [loadMessage, setLoadMessage] = useState('Loading character...');
  const [inputDebugLines, setInputDebugLines] = useState<string[]>(['keys=-']);
  const [roundDebugLine, setRoundDebugLine] = useState(formatRoundState(createInitialRoundState()));
  const [scoreDebugLine, setScoreDebugLine] = useState(formatRoundScore(createInitialRoundScore()));
  const [cnsDebugLines, setCnsDebugLines] = useState<string[]>([]);
  const [commandDebugLines, setCommandDebugLines] = useState<string[]>(['cmd p1=-', 'cmd p2=-']);
  const [physicsDebugLines, setPhysicsDebugLines] = useState<string[]>(['phys p1=-', 'phys p2=-']);
  const [coverageDebugLines, setCoverageDebugLines] = useState<string[]>(['coverage=-']);
  const [staticDebugInfo, setStaticDebugInfo] = useState<StaticDebugInfo>(EMPTY_STATIC_DEBUG_INFO);
  const [runtimeHistoryLines, setRuntimeHistoryLines] = useState<string[]>(['操作すると、ここにタイムスタンプ付きで内部処理ログが残ります。']);
  const [readableRuntimeHistoryLines, setReadableRuntimeHistoryLines] = useState<string[]>(['人間用の短い実行履歴がここに残ります。']);
  const [stateTransitionLogLines, setStateTransitionLogLines] = useState<string[]>(['StateNoが変化すると、ここに遷移だけが残ります。']);
  const [stageDebugLines, setStageDebugLines] = useState<string[]>(['State: -']);
  const [activeDebugTab, setActiveDebugTab] = useState<DebugTab>('runtime');
  const [activeRuntimeLogTab, setActiveRuntimeLogTab] = useState<RuntimeLogTab>('human');
  const [copyStatus, setCopyStatus] = useState('');
  const [inputConfig, setInputConfigState] = useState<InputConfig>(inputConfigRef.current);
  const [runtimeSettings, setRuntimeSettingsState] = useState<RuntimeSettings>(runtimeSettingsRef.current);
  const [characterPath, setCharacterPathState] = useState(loadCharacterPath());
  const [cnsSourceFiles, setCnsSourceFiles] = useState<CharacterSourceFile[]>([]);
  const [selectedCnsSource, setSelectedCnsSource] = useState<CnsSourceSelection>(null);

  useEffect(() => {
    let disposed = false;
    let frameId = 0;

    async function start() {
      const canvas = canvasRef.current;
      if (!canvas) return;

      gameStateRef.current = createInitialGameState();
      hitFeedbackRef.current = createInitialHitFeedbackState();
      roundStateRef.current = createInitialRoundState(runtimeSettingsRef.current.roundTime);
      roundScoreRef.current = createInitialRoundScore();
      cnsTraceRef.current = [];
      runtimeHistoryRef.current = [];
      readableRuntimeHistoryRef.current = [];
      stateTransitionLogRef.current = [];
      stateTransitionHistoryRef.current = [];
      inputHistoryRef.current = [];
      damageHistoryRef.current = [];
      lastRuntimeSignatureRef.current = '';
      lastReadableRuntimeSignatureRef.current = '';
      lastStageKeySignatureRef.current = '';
      lastStateNosRef.current = [0, 0];
      stateTransitionLogLastStateNosRef.current = [0, 0];
      lastFrameTickTimeRef.current = null;
      p1CommandBufferRef.current.clear();
      p2CommandBufferRef.current.clear();
      setSelectedCnsSource(null);
      setStateTransitionLogLines(['StateNoが変化すると、ここに遷移だけが残ります。']);

      const loadResult = await loadAppCharacter(characterPath);
      if (disposed) return;

      const loadedCharacter = loadResult.character ?? createSampleCharacterAssets();
      const character = {
        ...loadedCharacter,
        cns: ENABLE_RUNTIME_FALLBACKS
          ? attachFallbackAttackStates(loadedCharacter.cns)
          : loadedCharacter.cns,
      };
      setCnsSourceFiles(character.cnsSourceFiles ?? []);
      cnsCoverageRef.current = analyzeCnsCoverage(character.cns);
      setCoverageDebugLines(formatCnsCoverageDebugOverlay(cnsCoverageRef.current));

      const spriteCount = character.sprites?.sprites.size ?? 0;

      setStaticDebugInfo(createStaticDebugInfo(character, loadResult.source, spriteCount));
      setLoadMessage(
        loadResult.source === 'def'
          ? `Loaded character: ${characterPath}`
          : `Sample character fallback: ${loadResult.errorMessage ?? 'unknown reason'}`,
      );

      rendererRef.current = new CanvasRenderer(canvas, character.air, null, character.sprites);
      inputRef.current = new BrowserInput(window);
      p1CommandBufferRef.current = new InputBuffer(60);
      p2CommandBufferRef.current = new InputBuffer(60);

      const tick = (timestamp: number) => {
        const frameIntervalMs = runtimeSettingsRef.current.frameIntervalMs;
        const lastTickTime = lastFrameTickTimeRef.current;
        if (lastTickTime !== null && timestamp - lastTickTime < frameIntervalMs) {
          frameId = requestAnimationFrame(tick);
          return;
        }
        lastFrameTickTimeRef.current = timestamp;
        frameNoRef.current += 1;
        const input = inputRef.current;
        const config = inputConfigRef.current;
        const pressedKeys = input?.getPressedKeys(config) ?? new Set<string>();
        const inputSnapshot = createInputDebugSnapshot(pressedKeys);
        const p1Input = keysToP1Input(pressedKeys, config);
        const p2Input = keysToP2Input(pressedKeys, config);
        p1CommandBufferRef.current.push(p1Input);
        p2CommandBufferRef.current.push(p2Input);
        const p1Commands = normalizeResolvedCommands(resolveCommands(character.cmd, p1Input, p1CommandBufferRef.current).activeCommandNames);
        const p2Commands = normalizeResolvedCommands(resolveCommands(character.cmd, p2Input, p2CommandBufferRef.current).activeCommandNames);

        const nextInputDebugLines = formatInputDebugOverlay(inputSnapshot);
        const nextCommandDebugLines = formatCnsCommandDebugOverlay(p1Commands, p2Commands);
        setInputDebugLines(nextInputDebugLines);
        setCommandDebugLines(nextCommandDebugLines);

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
          const restarted = restartRound(nextRoundState.roundNo, runtimeSettingsRef.current.roundTime);
          nextState = restarted.gameState;
          nextRoundState = restarted.roundState;
          nextFeedback = restarted.hitFeedbackState;
          nextCnsTraces = [];
          p1CommandBufferRef.current.clear();
          p2CommandBufferRef.current.clear();
        } else if (nextRoundState.phase === 'fight') {
          if (ENABLE_RUNTIME_FALLBACKS) {
            nextState = applyFallbackControls(nextState, p1Input, p2Input);
          }

          const cnsResult = stepCnsStateRuntime(nextState, character.cns, {
            p1Commands,
            p2Commands,
            getAnimationDuration: (animNo) => getMugenAnimEndTime(character.air, animNo),
            getAnimationElementNo: (animNo, animTime) => {
              const element = getCurrentAnimationElement(character.air, animNo, animTime);
              return element ? element.elementIndex + 1 : null;
            },
          });
          nextState = cnsResult.state;
          nextCnsTraces = cnsResult.traces;

          if (ENABLE_RUNTIME_FALLBACKS) {
            nextState = stepFallbackMotion(nextState);
          } else {
            nextState = stepCnsPhysicsMotion(nextState, character.cns);
          }

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
        updateStageDebugOverlay({
          state: nextState,
          pressedKeys,
          frameNo: frameNoRef.current,
          stateTransitionHistoryRef,
          inputHistoryRef,
          damageHistoryRef,
          lastKeySignatureRef: lastStageKeySignatureRef,
          lastStateNosRef,
          setStageDebugLines,
        });

        const nextRoundDebugLine = formatRoundState(nextRoundState);
        const nextScoreDebugLine = formatRoundScore(nextScore);
        const nextCnsDebugLines = formatCnsRuntimeDebugOverlay(nextCnsTraces);
        const nextPhysicsDebugLines = formatPhysicsDebugOverlay(nextState);
        setRoundDebugLine(nextRoundDebugLine);
        setScoreDebugLine(nextScoreDebugLine);
        setCnsDebugLines(nextCnsDebugLines);
        setPhysicsDebugLines(nextPhysicsDebugLines);

        appendRuntimeHistoryIfNeeded({
          frameNo: frameNoRef.current,
          inputLines: nextInputDebugLines,
          commandLines: nextCommandDebugLines,
          physicsLines: nextPhysicsDebugLines,
          roundLine: nextRoundDebugLine,
          scoreLine: nextScoreDebugLine,
          cnsLines: nextCnsDebugLines,
          traces: nextCnsTraces,
          pressedKeys,
          historyRef: runtimeHistoryRef,
          lastSignatureRef: lastRuntimeSignatureRef,
          setHistoryLines: setRuntimeHistoryLines,
        });
        appendReadableRuntimeHistoryIfNeeded({
          cns: character.cns,
          commands: p1Commands,
          getAnimEndTime: (animNo) => getMugenAnimEndTime(character.air, animNo),
          inputConfig: config,
          frameNo: frameNoRef.current,
          state: nextState,
          pressedKeys,
          historyRef: readableRuntimeHistoryRef,
          lastSignatureRef: lastReadableRuntimeSignatureRef,
          setHistoryLines: setReadableRuntimeHistoryLines,
        });
        appendStateTransitionLogIfNeeded({
          frameNo: frameNoRef.current,
          state: nextState,
          historyRef: stateTransitionLogRef,
          lastStateNosRef: stateTransitionLogLastStateNosRef,
          setHistoryLines: setStateTransitionLogLines,
        });

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
  }, [characterPath]);

  const liveDebugLines = [
    ...inputDebugLines,
    ...commandDebugLines,
    ...physicsDebugLines,
    roundDebugLine,
    scoreDebugLine,
    ...cnsDebugLines,
  ];
  const staticTabLines = formatStaticTabLines(loadMessage, staticDebugInfo, coverageDebugLines);

  const handleCopy = async (label: string, text: string) => {
    try {
      await copyTextToClipboard(text);
      setCopyStatus(`${label}をコピーしました (${text.split('\n').length}行)`);
    } catch (error) {
      setCopyStatus(`コピーに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const setInputConfig = (nextConfig: InputConfig) => {
    inputConfigRef.current = nextConfig;
    setInputConfigState(nextConfig);
    saveInputConfig(nextConfig);
    p1CommandBufferRef.current.clear();
    p2CommandBufferRef.current.clear();
  };

  const setRuntimeSettings = (nextSettings: RuntimeSettings) => {
    const normalized = normalizeRuntimeSettings(nextSettings);
    runtimeSettingsRef.current = normalized;
    setRuntimeSettingsState(normalized);
    saveRuntimeSettings(normalized);
  };

  const setCharacterPath = (nextPath: string) => {
    const trimmed = nextPath.trim();
    if (!trimmed || trimmed === characterPath) return;
    saveCharacterPath(trimmed);
    setCharacterPathState(trimmed);
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>WebMUGEN</h1>
        <p>CharacterLoader app integration prototype</p>
      </header>

      <section className="stage-panel">
        <div className="stage-viewport">
          <canvas
            ref={canvasRef}
            width={960}
            height={540}
          />
          <div className="stage-debug-overlay" aria-label="stage debug overlay">
            {stageDebugLines.map((line, index) => (
              <div key={`${line}-${index}`}>{line}</div>
            ))}
          </div>
        </div>
      </section>

      <DebugTabs activeTab={activeDebugTab} onChange={setActiveDebugTab} />
      <CopyToolbar
        activeTab={activeDebugTab}
        aiLogText={runtimeHistoryLines.join('\n')}
        humanLogText={[
          '=== 人間用 実行履歴 ===',
          ...readableRuntimeHistoryLines,
          '',
          '=== StateNo 遷移 ===',
          ...stateTransitionLogLines,
        ].join('\n')}
        copyStatus={copyStatus}
        onCopy={handleCopy}
      />

      <section className="debug-panel">
        {activeDebugTab === 'static' && (
          <StaticDebugPanel
            loadMessage={loadMessage}
            staticDebugInfo={staticDebugInfo}
            coverageDebugLines={coverageDebugLines}
            sourceFiles={cnsSourceFiles}
            selectedSource={selectedCnsSource}
            onOpenSource={setSelectedCnsSource}
          />
        )}
        {activeDebugTab === 'runtime' && (
          <ReadableRuntimePanel
            activeTab={activeRuntimeLogTab}
            onTabChange={setActiveRuntimeLogTab}
            readableRuntimeHistoryLines={readableRuntimeHistoryLines}
            runtimeHistoryLines={runtimeHistoryLines}
            stateTransitionLogLines={stateTransitionLogLines}
            cnsSourceFiles={cnsSourceFiles}
            selectedCnsSource={selectedCnsSource}
            onOpenCnsSource={setSelectedCnsSource}
          />
        )}
        {activeDebugTab === 'ideas' && <IdeasPanel />}
        {activeDebugTab === 'manual' && <ManualPanel />}
        {activeDebugTab === 'settings' && (
          <SettingsPanel
            characterPath={characterPath}
            inputConfig={inputConfig}
            runtimeSettings={runtimeSettings}
            onCharacterPathChange={setCharacterPath}
            onInputConfigChange={setInputConfig}
            onRuntimeSettingsChange={setRuntimeSettings}
          />
        )}
      </section>
    </div>
  );
}

const INPUT_ACTIONS = [
  { key: 'left', label: 'Left' },
  { key: 'right', label: 'Right' },
  { key: 'up', label: 'Up' },
  { key: 'down', label: 'Down' },
  { key: 'a', label: 'a' },
  { key: 'b', label: 'b' },
  { key: 'c', label: 'c' },
  { key: 'x', label: 'x' },
  { key: 'y', label: 'y' },
  { key: 'z', label: 'z' },
] as const;

type InputAction = typeof INPUT_ACTIONS[number]['key'];

function SettingsPanel({
  characterPath,
  inputConfig,
  runtimeSettings,
  onCharacterPathChange,
  onInputConfigChange,
  onRuntimeSettingsChange,
}: {
  characterPath: string;
  inputConfig: InputConfig;
  runtimeSettings: RuntimeSettings;
  onCharacterPathChange: (path: string) => void;
  onInputConfigChange: (config: InputConfig) => void;
  onRuntimeSettingsChange: (settings: RuntimeSettings) => void;
}) {
  return (
    <div className="settings-stack">
      <CharacterConfigPanel characterPath={characterPath} onChange={onCharacterPathChange} />
      <RuntimeSettingsPanel settings={runtimeSettings} onChange={onRuntimeSettingsChange} />
      <section className="settings-section">
        <h2>Control Summary</h2>
        <div className="control-help-grid">
          <div>
            <h3>Keyboard</h3>
            <p>P1: {formatKeyboardMapping(inputConfig.players[0])}</p>
            <p>P2: {formatKeyboardMapping(inputConfig.players[1])}</p>
          </div>
          <div>
            <h3>Controller</h3>
            <p>1st gamepad = P1, 2nd gamepad = P2</p>
            <p>D-pad / left stick move</p>
            <p>P1: {formatGamepadMapping(inputConfig.players[0])}</p>
            <p>P2: {formatGamepadMapping(inputConfig.players[1])}</p>
          </div>
        </div>
      </section>
      <InputConfigPanel
        config={inputConfig}
        onChange={onInputConfigChange}
      />
    </div>
  );
}

function CharacterConfigPanel({
  characterPath,
  onChange,
}: {
  characterPath: string;
  onChange: (path: string) => void;
}) {
  const [draft, setDraft] = useState(characterPath);

  useEffect(() => {
    setDraft(characterPath);
  }, [characterPath]);

  return (
    <section className="settings-section">
      <h2>Character</h2>
      <p>Place character files under <code>public/chars/</code>, then select or enter the DEF/ZIP path here.</p>
      <div className="character-picker">
        <select value={characterPath} onChange={(event) => onChange(event.currentTarget.value)}>
          {CHARACTER_PATH_OPTIONS.map((path) => (
            <option key={path} value={path}>{path}</option>
          ))}
          {!CHARACTER_PATH_OPTIONS.includes(characterPath as typeof CHARACTER_PATH_OPTIONS[number]) && (
            <option value={characterPath}>{characterPath}</option>
          )}
        </select>
        <input
          list="character-path-options"
          onChange={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onChange(draft);
          }}
          value={draft}
        />
        <datalist id="character-path-options">
          {CHARACTER_PATH_OPTIONS.map((path) => (
            <option key={path} value={path} />
          ))}
        </datalist>
        <button type="button" onClick={() => onChange(draft)}>Load</button>
      </div>
    </section>
  );
}

function InputConfigPanel({
  config,
  onChange,
}: {
  config: InputConfig;
  onChange: (config: InputConfig) => void;
}) {
  return (
    <section className="input-config-panel">
      <div className="input-config-header">
        <h2>Input Config</h2>
        <button type="button" onClick={() => onChange(cloneInputConfig(DEFAULT_INPUT_CONFIG))}>
          Reset
        </button>
      </div>
      <LiveInputMonitor />
      <div className="input-config-grid">
        {config.players.map((player, playerIndex) => (
          <PlayerInputConfig
            key={playerIndex}
            player={player}
            playerIndex={playerIndex}
            onChange={(nextPlayer) => onChange(replacePlayerInputConfig(config, playerIndex, nextPlayer))}
          />
        ))}
      </div>
    </section>
  );
}

function RuntimeSettingsPanel({
  settings,
  onChange,
}: {
  settings: RuntimeSettings;
  onChange: (settings: RuntimeSettings) => void;
}) {
  return (
    <section className="settings-section">
      <h2>Runtime</h2>
      <div className="runtime-settings-grid">
        <label>
          Game time
          <input
            min={0}
            max={999}
            type="number"
            value={settings.roundTime}
            onChange={(event) => onChange({ ...settings, roundTime: Number(event.currentTarget.value) })}
          />
        </label>
        <label>
          Frame ms
          <input
            min={1}
            max={1000}
            step={1}
            type="number"
            value={Math.round(settings.frameIntervalMs)}
            onChange={(event) => onChange({ ...settings, frameIntervalMs: Number(event.currentTarget.value) })}
          />
        </label>
        <button type="button" onClick={() => onChange(DEFAULT_RUNTIME_SETTINGS)}>
          MUGEN default
        </button>
      </div>
    </section>
  );
}

type LiveInputMonitorState = {
  keys: string[];
  gamepads: Array<{
    index: number;
    id: string;
    buttons: number[];
    axes: Array<{ index: number; value: number }>;
  }>;
};

function LiveInputMonitor() {
  const [snapshot, setSnapshot] = useState<LiveInputMonitorState>({ keys: [], gamepads: [] });

  useEffect(() => {
    const pressedKeys = new Set<string>();
    let frameId = 0;

    const update = () => {
      setSnapshot({
        keys: Array.from(pressedKeys).sort().map(formatKeyCode),
        gamepads: readLiveGamepadSnapshot(),
      });
      frameId = requestAnimationFrame(update);
    };
    const handleKeyDown = (event: KeyboardEvent) => pressedKeys.add(event.code);
    const handleKeyUp = (event: KeyboardEvent) => pressedKeys.delete(event.code);
    const handleBlur = () => pressedKeys.clear();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    frameId = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  return (
    <section className="live-input-monitor" aria-label="live input monitor">
      <h3>Live Input Monitor</h3>
      <div className="live-input-grid">
        <div>
          <h4>Keyboard</h4>
          <div className="live-input-pills">
            {snapshot.keys.length === 0 ? <span className="live-input-empty">-</span> : snapshot.keys.map((key) => (
              <span className="live-input-pill" key={key}>{key}</span>
            ))}
          </div>
        </div>
        <div>
          <h4>Controller</h4>
          {snapshot.gamepads.length === 0 ? (
            <div className="live-input-empty">not connected</div>
          ) : snapshot.gamepads.map((gamepad) => (
            <div className="live-gamepad-row" key={gamepad.index}>
              <strong>Pad {gamepad.index + 1}</strong>
              <span title={gamepad.id}>{gamepad.id || 'unknown'}</span>
              <span>buttons: {gamepad.buttons.length === 0 ? '-' : gamepad.buttons.join(', ')}</span>
              <span>axes: {gamepad.axes.length === 0 ? '-' : gamepad.axes.map((axis) => `${axis.index}:${axis.value.toFixed(2)}`).join(', ')}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function readLiveGamepadSnapshot(): LiveInputMonitorState['gamepads'] {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return [];
  return Array.from(navigator.getGamepads())
    .filter((gamepad): gamepad is Gamepad => Boolean(gamepad))
    .map((gamepad) => ({
      index: gamepad.index,
      id: gamepad.id,
      buttons: gamepad.buttons
        .map((button, index) => (button.pressed || button.value >= 0.5 ? index : -1))
        .filter((index) => index >= 0),
      axes: gamepad.axes
        .map((value, index) => ({ index, value }))
        .filter((axis) => Math.abs(axis.value) >= 0.25),
    }));
}

function PlayerInputConfig({
  player,
  playerIndex,
  onChange,
}: {
  player: PlayerInputMapping;
  playerIndex: number;
  onChange: (player: PlayerInputMapping) => void;
}) {
  return (
    <section className="input-config-card">
      <h3>P{playerIndex + 1}</h3>
      <div className="input-config-rows">
        {INPUT_ACTIONS.map((action) => (
          <div className="input-config-row" key={action.key}>
            <span>{action.label}</span>
            <KeyCaptureButton
              value={player.keyboard[action.key]}
              onChange={(code) => onChange({
                ...player,
                keyboard: { ...player.keyboard, [action.key]: code },
              })}
            />
            <label>
              Pad
              <input
                min={0}
                max={31}
                type="number"
                value={player.gamepad[action.key]}
                onChange={(event) => onChange({
                  ...player,
                  gamepad: {
                    ...player.gamepad,
                    [action.key]: clampGamepadButton(Number(event.currentTarget.value)),
                  },
                })}
              />
            </label>
          </div>
        ))}
      </div>
    </section>
  );
}

function KeyCaptureButton({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [capturing, setCapturing] = useState(false);
  return (
    <button
      className={capturing ? 'capture active' : 'capture'}
      onBlur={() => setCapturing(false)}
      onClick={() => setCapturing(true)}
      onKeyDown={(event) => {
        if (!capturing) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.code === 'Escape') {
          setCapturing(false);
          return;
        }
        onChange(event.code);
        setCapturing(false);
      }}
      type="button"
    >
      {capturing ? 'Press key...' : formatKeyCode(value)}
    </button>
  );
}

function replacePlayerInputConfig(config: InputConfig, playerIndex: number, player: PlayerInputMapping): InputConfig {
  return {
    players: playerIndex === 0
      ? [player, config.players[1]]
      : [config.players[0], player],
  };
}

function cloneInputConfig(config: InputConfig): InputConfig {
  return {
    players: [
      {
        keyboard: { ...config.players[0].keyboard },
        gamepad: { ...config.players[0].gamepad },
      },
      {
        keyboard: { ...config.players[1].keyboard },
        gamepad: { ...config.players[1].gamepad },
      },
    ],
  };
}

function loadInputConfig(): InputConfig {
  if (typeof localStorage === 'undefined') return cloneInputConfig(DEFAULT_INPUT_CONFIG);
  try {
    const raw = localStorage.getItem(INPUT_CONFIG_STORAGE_KEY);
    if (!raw) return cloneInputConfig(DEFAULT_INPUT_CONFIG);
    return normalizeInputConfig(JSON.parse(raw));
  } catch {
    return cloneInputConfig(DEFAULT_INPUT_CONFIG);
  }
}

function saveInputConfig(config: InputConfig): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(INPUT_CONFIG_STORAGE_KEY, JSON.stringify(config));
}

function loadCharacterPath(): string {
  if (typeof localStorage === 'undefined') return DEFAULT_CHARACTER_DEF_PATH;
  return localStorage.getItem(CHARACTER_PATH_STORAGE_KEY) || DEFAULT_CHARACTER_DEF_PATH;
}

function saveCharacterPath(path: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(CHARACTER_PATH_STORAGE_KEY, path);
}

function loadRuntimeSettings(): RuntimeSettings {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_RUNTIME_SETTINGS };
  try {
    const raw = localStorage.getItem(RUNTIME_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_RUNTIME_SETTINGS };
    return normalizeRuntimeSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_RUNTIME_SETTINGS };
  }
}

function saveRuntimeSettings(settings: RuntimeSettings): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(RUNTIME_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function normalizeRuntimeSettings(value: unknown): RuntimeSettings {
  const source = value && typeof value === 'object' ? value as Partial<RuntimeSettings> : {};
  return {
    roundTime: clampInteger(source.roundTime, 0, 999, DEFAULT_RUNTIME_SETTINGS.roundTime),
    frameIntervalMs: clampNumber(source.frameIntervalMs, 1, 1000, DEFAULT_RUNTIME_SETTINGS.frameIntervalMs),
  };
}

function normalizeInputConfig(value: unknown): InputConfig {
  const fallback = cloneInputConfig(DEFAULT_INPUT_CONFIG);
  if (!value || typeof value !== 'object' || !Array.isArray((value as { players?: unknown }).players)) {
    return fallback;
  }

  const players = (value as { players: unknown[] }).players;
  return {
    players: [
      normalizePlayerInputConfig(players[0], fallback.players[0]),
      normalizePlayerInputConfig(players[1], fallback.players[1]),
    ],
  };
}

function normalizePlayerInputConfig(value: unknown, fallback: PlayerInputMapping): PlayerInputMapping {
  const source = value && typeof value === 'object' ? value as Partial<PlayerInputMapping> : {};
  const keyboard = source.keyboard && typeof source.keyboard === 'object' ? source.keyboard as Partial<Record<InputAction, unknown>> : {};
  const gamepad = source.gamepad && typeof source.gamepad === 'object' ? source.gamepad as Partial<Record<InputAction, unknown>> : {};
  const next = clonePlayerInputConfig(fallback);

  for (const action of INPUT_ACTIONS) {
    const keyValue = keyboard[action.key];
    if (typeof keyValue === 'string' && keyValue.length > 0) {
      next.keyboard[action.key] = keyValue;
    }
    const buttonValue = Number(gamepad[action.key]);
    if (Number.isFinite(buttonValue)) {
      next.gamepad[action.key] = clampGamepadButton(buttonValue);
    }
  }

  return next;
}

function clonePlayerInputConfig(config: PlayerInputMapping): PlayerInputMapping {
  return {
    keyboard: { ...config.keyboard },
    gamepad: { ...config.gamepad },
  };
}

function clampGamepadButton(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(31, Math.trunc(value)));
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function formatKeyCode(code: string): string {
  return code
    .replace(/^Key/, '')
    .replace(/^Arrow/, '')
    .replace(/^Digit/, '');
}

function formatKeyboardMapping(player: PlayerInputMapping): string {
  return [
    `${formatKeyCode(player.keyboard.left)}/${formatKeyCode(player.keyboard.right)}/${formatKeyCode(player.keyboard.up)}/${formatKeyCode(player.keyboard.down)} move`,
    `${formatKeyCode(player.keyboard.a)}/${formatKeyCode(player.keyboard.b)}/${formatKeyCode(player.keyboard.c)} = a/b/c`,
    `${formatKeyCode(player.keyboard.x)}/${formatKeyCode(player.keyboard.y)}/${formatKeyCode(player.keyboard.z)} = x/y/z`,
  ].join(', ');
}

function formatGamepadMapping(player: PlayerInputMapping): string {
  return [
    `${player.gamepad.x}/${player.gamepad.y}/${player.gamepad.z} = x/y/z`,
    `${player.gamepad.a}/${player.gamepad.b}/${player.gamepad.c} = a/b/c`,
  ].join(', ');
}

function DebugTabs({ activeTab, onChange }: { activeTab: DebugTab; onChange: (tab: DebugTab) => void }) {
  return (
    <nav className="debug-tabs" aria-label="debug tabs">
      <button className={activeTab === 'runtime' ? 'active' : ''} onClick={() => onChange('runtime')} type="button">
        タブ1 実行履歴
      </button>
      <button className={activeTab === 'static' ? 'active' : ''} onClick={() => onChange('static')} type="button">
        タブ2 静的情報
      </button>
      <button className={activeTab === 'ideas' ? 'active' : ''} onClick={() => onChange('ideas')} type="button">
        タブ3 調査メモ
      </button>
      <button className={activeTab === 'manual' ? 'active' : ''} onClick={() => onChange('manual')} type="button">
        Manual
      </button>
      <button className={activeTab === 'settings' ? 'active' : ''} onClick={() => onChange('settings')} type="button">
        Settings
      </button>
    </nav>
  );
}

function CopyToolbar({
  activeTab,
  aiLogText,
  humanLogText,
  copyStatus,
  onCopy,
}: {
  activeTab: DebugTab;
  aiLogText: string;
  humanLogText: string;
  copyStatus: string;
  onCopy: (label: string, text: string) => void;
}) {
  if (activeTab !== 'runtime') return null;

  return (
    <div className="copy-toolbar">
      <div className="copy-toolbar-buttons">
        <button type="button" onClick={() => onCopy('人間用実行履歴ログ', humanLogText)}>
          人間用ログをコピー
        </button>
        <button type="button" onClick={() => onCopy('AI用詳細ログ', aiLogText)}>
          AI用ログをコピー
        </button>
      </div>
      {copyStatus && <span className="copy-status">{copyStatus}</span>}
    </div>
  );
}

function StaticDebugPanel({
  loadMessage,
  staticDebugInfo,
  coverageDebugLines,
  sourceFiles,
  selectedSource,
  onOpenSource,
}: {
  loadMessage: string;
  staticDebugInfo: StaticDebugInfo;
  coverageDebugLines: string[];
  sourceFiles: CharacterSourceFile[];
  selectedSource: CnsSourceSelection;
  onOpenSource: (selection: CnsSourceSelection) => void;
}) {
  return (
    <div className="debug-grid">
      <DebugBlock title="Character / DEF 読込結果" lines={[loadMessage, ...staticDebugInfo.characterRows]} />
      <DebugBlock title="CMD コマンド一覧" lines={staticDebugInfo.commandRows} />
      <DebugBlock title="CNS対応状況" lines={coverageDebugLines} />
      <CharacterSourceFilesViewer files={sourceFiles} selection={selectedSource} onSelect={onOpenSource} />
      <StateDefListPanel rows={staticDebugInfo.stateRows} />
    </div>
  );
}

function StateDefListPanel({ rows }: { rows: StateDebugRow[] }) {
  return (
    <section className="debug-block statedef-list">
      <h2>StateDef 一覧</h2>
      <div className="statedef-count">loaded StateDefs: {rows.length}</div>
      <div className="statedef-scroll">
        {rows.length === 0 ? (
          <div className="statedef-empty">states=-</div>
        ) : rows.map((row, index) => (
          <div className={`statedef-row ${row.origin}`} key={`${row.stateNo}-${row.originLabel}-${index}`}>
            <span className="statedef-no">S{row.stateNo}</span>
            <span className="statedef-origin">{row.originLabel}</span>
            <span className="statedef-summary">
              {row.summary}
              <span className="statedef-routes">
                {row.routes.length === 0 ? 'routes=-' : row.routes.map((route, routeIndex) => (
                  <span className="statedef-route" key={`${route}-${routeIndex}`}>{route}</span>
                ))}
              </span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReadableRuntimePanel({
  activeTab,
  onTabChange,
  readableRuntimeHistoryLines,
  runtimeHistoryLines,
  stateTransitionLogLines,
  cnsSourceFiles,
  selectedCnsSource,
  onOpenCnsSource,
}: {
  activeTab: RuntimeLogTab;
  onTabChange: (tab: RuntimeLogTab) => void;
  readableRuntimeHistoryLines: string[];
  runtimeHistoryLines: string[];
  stateTransitionLogLines: string[];
  cnsSourceFiles: CharacterSourceFile[];
  selectedCnsSource: CnsSourceSelection;
  onOpenCnsSource: (selection: CnsSourceSelection) => void;
}) {
  return (
    <section className="runtime-history-panel">
      <nav className="runtime-subtabs" aria-label="runtime log tabs">
        <button className={activeTab === 'human' ? 'active' : ''} type="button" onClick={() => onTabChange('human')}>
          人間用 実行履歴
        </button>
        <button className={activeTab === 'ai' ? 'active' : ''} type="button" onClick={() => onTabChange('ai')}>
          AI用 詳細ログ
        </button>
      </nav>
      {activeTab === 'human' ? (
        <div className="runtime-human-grid">
          <section>
            <h2>人間用 実行履歴</h2>
            <p className="debug-note">
              タイムスタンプ、StateNo、AnimNo、State状況を短く表示します。Timeだけの変化では増えません。
            </p>
            <ReadableRuntimeHistoryMarkup lines={readableRuntimeHistoryLines} onOpenCnsSource={onOpenCnsSource} />
          </section>
          <section>
            <h2>StateNo 遷移</h2>
            <p className="debug-note">StateNoが変わった瞬間だけを短く表示します。f=を押すと左の該当フレームへ移動します。</p>
            <StateTransitionLogMarkup lines={stateTransitionLogLines} />
          </section>
        </div>
      ) : (
        <section>
          <h2>AI用 詳細ログ</h2>
          <p className="debug-note">
            入力、Command、State、Controller、Physics、成立情報を多めに蓄積します。Timeだけの変化では増えません。
          </p>
          <pre className="debug-pre history-pre codex-history-pre">{runtimeHistoryLines.join('\n')}</pre>
        </section>
      )}
      {selectedCnsSource ? (
        <CharacterSourceFilesViewer files={cnsSourceFiles} selection={selectedCnsSource} onSelect={onOpenCnsSource} />
      ) : null}
    </section>
  );
}

function ReadableRuntimeHistoryMarkup({
  lines,
  onOpenCnsSource,
}: {
  lines: string[];
  onOpenCnsSource: (selection: CnsSourceSelection) => void;
}) {
  return (
    <div className="history-pre readable-history-view">
      {lines.map((line, index) => (
        <ReadableRuntimeHistoryLine key={`${index}-${line}`} line={line} onOpenCnsSource={onOpenCnsSource} />
      ))}
    </div>
  );
}

function ReadableRuntimeHistoryLine({
  line,
  onOpenCnsSource,
}: {
  line: string;
  onOpenCnsSource: (selection: CnsSourceSelection) => void;
}) {
  const trimmed = line.trim();
  if (!trimmed) return <div className="readable-history-spacer" aria-hidden="true" />;

  const controllerMatch = trimmed.match(/^\*\*(.+)\*\*\s+\|\s+(.+)$/);
  if (controllerMatch) {
    const passed = controllerMatch[2].includes('OK');
    const source = parseControllerSourceRef(controllerMatch[2]);
    return (
      <div className={`readable-history-controller ${passed ? 'passed' : 'failed'}`}>
        {source ? (
          <button
            className="readable-controller-link"
            type="button"
            onClick={() => onOpenCnsSource(source)}
            title={`${source.path}:${source.line}`}
          >
            {controllerMatch[1]}
          </button>
        ) : (
          <strong>{controllerMatch[1]}</strong>
        )}
        <span>{passed ? '成立' : '不成立'}</span>
      </div>
    );
  }

  const triggerMatch = trimmed.match(/^(OK|NG)\s+`(.+)`$/);
  if (triggerMatch) {
    const passed = triggerMatch[1] === 'OK';
    const [expressionText, valueText] = splitTriggerValueText(triggerMatch[2]);
    return (
      <div className={`readable-history-trigger ${passed ? 'passed' : 'failed'}`}>
        <span className="readable-history-status">{passed ? 'OK' : 'NG'}</span>
        <code>{expressionText}</code>
        {valueText ? <span className="readable-history-values">{valueText}</span> : null}
      </div>
    );
  }

  if (trimmed.startsWith('----')) {
    const frameMatch = trimmed.match(/\bframe=(\d+)\b/);
    const frameId = frameMatch ? runtimeFrameElementId(Number(frameMatch[1])) : undefined;
    return <div className="readable-history-entry" id={frameId}>{trimmed.replace(/^-+\s*|\s*-+$/g, '')}</div>;
  }
  if (trimmed === 'State状況:' || (trimmed.startsWith('State') && !trimmed.startsWith('StateNo='))) {
    return <div className="readable-history-section">State状況</div>;
  }
  if (trimmed.startsWith('P1 StateNo=')) return <ReadableRuntimeHistoryMeta line={trimmed} />;
  if (trimmed.startsWith('keys=')) return <div className="readable-history-keys">{trimmed}</div>;
  if (trimmed.startsWith('Damage=')) return <div className="readable-history-damage">{trimmed}</div>;
  return <div className="readable-history-line">{trimmed}</div>;
}

function splitTriggerValueText(text: string): [string, string] {
  const marker = ' || values: ';
  const index = text.indexOf(marker);
  if (index < 0) return [text, ''];
  return [text.slice(0, index), text.slice(index + marker.length)];
}

function parseControllerSourceRef(text: string): Exclude<CnsSourceSelection, null> | null {
  const match = text.match(/\s@\s*(.+):(\d+)\s*$/);
  if (!match) return null;
  return { path: match[1], line: Number(match[2]) };
}

function ReadableRuntimeHistoryMeta({ line }: { line: string }) {
  const match = line.match(/^P1 StateNo=(\d+)\s+(.*)$/);
  if (!match) return <div className="readable-history-meta">{line}</div>;
  return (
    <div className="readable-history-meta">
      <span>P1 </span>
      <span className="readable-state-badge">StateNo={match[1]}</span>
      <span> {match[2]}</span>
    </div>
  );
}

function StateTransitionLogMarkup({ lines }: { lines: string[] }) {
  return (
    <div className="debug-pre history-pre state-transition-pre">
      {lines.map((line, index) => {
        const frameMatch = line.match(/\bf=(\d+)\b/);
        if (!frameMatch || frameMatch.index === undefined) return <div key={`${index}-${line}`}>{line}</div>;
        const frameNo = Number(frameMatch[1]);
        return (
          <div className="state-transition-line" key={`${index}-${line}`}>
            <span>{line.slice(0, frameMatch.index)}</span>
            <button type="button" onClick={() => scrollToRuntimeFrame(frameNo)}>{frameMatch[0]}</button>
            <span>{line.slice(frameMatch.index + frameMatch[0].length)}</span>
          </div>
        );
      })}
    </div>
  );
}

function scrollToRuntimeFrame(frameNo: number): void {
  const element = document.getElementById(runtimeFrameElementId(frameNo));
  if (!element) return;
  element.scrollIntoView({ block: 'center', behavior: 'smooth' });
  element.classList.remove('jump-highlight');
  window.setTimeout(() => element.classList.add('jump-highlight'), 0);
}

function runtimeFrameElementId(frameNo: number): string {
  return `runtime-frame-${frameNo}`;
}

function CharacterSourceFilesViewer({
  files,
  selection,
  onSelect,
}: {
  files: CharacterSourceFile[];
  selection: CnsSourceSelection;
  onSelect: (selection: CnsSourceSelection) => void;
}) {
  const fallbackSelection = files[0] ? { path: files[0].path, line: 1 } : null;
  const effectiveSelection = selection && files.some((file) => file.path === selection.path) ? selection : fallbackSelection;
  const selectedFile = effectiveSelection ? files.find((file) => file.path === effectiveSelection.path) : null;
  const selectedLineId = effectiveSelection ? cnsSourceLineId(effectiveSelection.path, effectiveSelection.line) : null;

  useEffect(() => {
    if (!selectedLineId) return;
    requestAnimationFrame(() => {
      document.getElementById(selectedLineId)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }, [selectedLineId]);

  if (files.length === 0) {
    return (
      <section className="cns-source-viewer character-source-viewer">
        <h2>Character Files</h2>
        <p className="debug-note">No text source files are loaded.</p>
      </section>
    );
  }

  if (!selectedFile) {
    return (
      <section className="cns-source-viewer character-source-viewer">
        <h2>Character Files</h2>
        <p className="debug-note">Source not found: {effectiveSelection?.path}:{effectiveSelection?.line}</p>
      </section>
    );
  }

  const lines = selectedFile.text.split(/\r?\n/);
  return (
    <section className="cns-source-viewer character-source-viewer">
      <h2>Character Files</h2>
      <div className="character-source-layout">
        <div className="character-source-file-list" aria-label="loaded character files">
          {files.map((file) => (
            <button
              className={file.path === selectedFile.path ? 'active' : ''}
              key={file.path}
              onClick={() => onSelect({ path: file.path, line: 1 })}
              title={file.path}
              type="button"
            >
              <span className="character-source-kind">{formatSourceKind(file)}</span>
              <span>{file.label}</span>
            </button>
          ))}
        </div>
        <div className="character-source-content">
          <div className="cns-source-title">
            <strong>{selectedFile.label}</strong>
            <span>{selectedFile.path}:{effectiveSelection?.line ?? 1}</span>
          </div>
          <div className="cns-source-code">
            {lines.map((line, index) => {
              const lineNo = index + 1;
              const selected = lineNo === effectiveSelection?.line;
              return (
                <div
                  className={`cns-source-line ${selected ? 'selected' : ''}`}
                  id={cnsSourceLineId(selectedFile.path, lineNo)}
                  key={`${selectedFile.path}-${lineNo}`}
                >
                  <span className="cns-source-line-no">{lineNo}</span>
                  <code>{line || ' '}</code>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function formatSourceKind(file: CharacterSourceFile): string {
  const kind = file.kind ?? file.path.split('.').pop() ?? 'txt';
  return kind.toUpperCase();
}

function cnsSourceLineId(path: string, line: number): string {
  return `cns-source-${path.replace(/[^a-z0-9_-]+/gi, '-')}-${line}`;
}

function RuntimeHistoryPanel({
  activeTab,
  onTabChange,
  readableRuntimeHistoryLines,
  runtimeHistoryLines,
  stateTransitionLogLines,
}: {
  activeTab: RuntimeLogTab;
  onTabChange: (tab: RuntimeLogTab) => void;
  readableRuntimeHistoryLines: string[];
  runtimeHistoryLines: string[];
  stateTransitionLogLines: string[];
}) {
  return (
    <section className="runtime-history-panel">
      <nav className="runtime-subtabs" aria-label="runtime log tabs">
        <button className={activeTab === 'human' ? 'active' : ''} type="button" onClick={() => onTabChange('human')}>
          人間用 実行履歴
        </button>
        <button className={activeTab === 'ai' ? 'active' : ''} type="button" onClick={() => onTabChange('ai')}>
          AI用 詳細ログ
        </button>
      </nav>
      {activeTab === 'human' ? (
        <div className="runtime-human-grid">
          <section>
            <h2>人間用 実行履歴</h2>
            <p className="debug-note">
              タイムスタンプ、StateNo、AnimNo、State状況を短く表示します。Timeだけの変化では増えません。
            </p>
            <ReadableRuntimeHistoryView lines={readableRuntimeHistoryLines} />
          </section>
          <section>
            <h2>StateNo 遷移</h2>
            <p className="debug-note">StateNoが変わった瞬間だけを短く表示します。</p>
            <pre className="debug-pre history-pre state-transition-pre">{stateTransitionLogLines.join('\n')}</pre>
          </section>
        </div>
      ) : (
        <section>
          <h2>AI用 詳細ログ</h2>
          <p className="debug-note">
            入力、Command、State、Controller、Physics、成立情報を多めに蓄積します。Timeだけの変化では増えません。
          </p>
          <pre className="debug-pre history-pre codex-history-pre">{runtimeHistoryLines.join('\n')}</pre>
        </section>
      )}
    </section>
  );
}

function ReadableRuntimeHistoryView({ lines }: { lines: string[] }) {
  return (
    <div className="history-pre readable-history-view">
      {lines.map((line, index) => (
        <ReadableHistoryLine key={`${index}-${line}`} line={line} />
      ))}
    </div>
  );
}

function ReadableHistoryLine({ line }: { line: string }) {
  const trimmed = line.trim();
  if (!trimmed) return <div className="readable-history-spacer" aria-hidden="true" />;

  const controllerMatch = trimmed.match(/^\*\*(.+)\*\*\s+\|\s+(.+)$/);
  if (controllerMatch) {
    const passed = controllerMatch[2].includes('成立') && !controllerMatch[2].includes('不成立');
    return (
      <div className={`readable-history-controller ${passed ? 'passed' : 'failed'}`}>
        <strong>{controllerMatch[1]}</strong>
        <span>{controllerMatch[2]}</span>
      </div>
    );
  }

  const triggerMatch = trimmed.match(/^([✅✗])\s+`(.+)`$/);
  if (triggerMatch) {
    const passed = triggerMatch[1] === '✅';
    return (
      <div className={`readable-history-trigger ${passed ? 'passed' : 'failed'}`}>
        <span className="readable-history-status">{passed ? 'OK' : 'NG'}</span>
        <code>{triggerMatch[2]}</code>
      </div>
    );
  }

  if (trimmed.startsWith('----')) return <div className="readable-history-entry">{trimmed.replace(/^-+\s*|\s*-+$/g, '')}</div>;
  if (trimmed === 'State状況:') return <div className="readable-history-section">State状況</div>;
  if (trimmed.startsWith('P1 StateNo=')) return <div className="readable-history-meta">{trimmed}</div>;
  if (trimmed.startsWith('keys=')) return <div className="readable-history-keys">{trimmed}</div>;
  if (trimmed.startsWith('Damage=')) return <div className="readable-history-damage">{trimmed}</div>;
  return <div className="readable-history-line">{trimmed}</div>;
}

function updateStageDebugOverlay({
  state,
  pressedKeys,
  frameNo,
  stateTransitionHistoryRef,
  inputHistoryRef,
  damageHistoryRef,
  lastKeySignatureRef,
  lastStateNosRef,
  setStageDebugLines,
}: {
  state: GameState;
  pressedKeys: ReadonlySet<string>;
  frameNo: number;
  stateTransitionHistoryRef: MutableRefObject<string[]>;
  inputHistoryRef: MutableRefObject<string[]>;
  damageHistoryRef: MutableRefObject<string[]>;
  lastKeySignatureRef: MutableRefObject<string>;
  lastStateNosRef: MutableRefObject<[number, number]>;
  setStageDebugLines: (lines: string[]) => void;
}) {
  const [p1, p2] = state.players;
  const currentStateNos: [number, number] = [p1.stateNo, p2.stateNo];
  const previousStateNos = lastStateNosRef.current;

  const transitions: string[] = [];
  if (previousStateNos[0] !== currentStateNos[0]) transitions.push(`P1 ${previousStateNos[0]}->${currentStateNos[0]}`);
  if (previousStateNos[1] !== currentStateNos[1]) transitions.push(`P2 ${previousStateNos[1]}->${currentStateNos[1]}`);
  if (transitions.length > 0) {
    stateTransitionHistoryRef.current = [...stateTransitionHistoryRef.current, `f${frameNo} ${transitions.join(' ')}`].slice(-5);
    lastStateNosRef.current = currentStateNos;
  }

  const keySignature = formatPressedKeys(pressedKeys);
  if (keySignature !== lastKeySignatureRef.current) {
    inputHistoryRef.current = [...inputHistoryRef.current, `f${frameNo} ${keySignature}`].slice(-5);
    lastKeySignatureRef.current = keySignature;
  }

  if (state.hitEvents.length > 0) {
    const damageLines = state.hitEvents.map((event) => `f${frameNo} P${event.attackerId}->P${event.defenderId} dmg=${event.damage}`);
    damageHistoryRef.current = [...damageHistoryRef.current, ...damageLines].slice(-5);
  }

  setStageDebugLines([
    `P1 State ${p1.stateNo} time=${p1.stateTime} anim=${p1.animNo}`,
    `P2 State ${p2.stateNo} time=${p2.stateTime} anim=${p2.animNo}`,
    `State履歴: ${stateTransitionHistoryRef.current.join(' | ') || '-'}`,
    `入力履歴: ${inputHistoryRef.current.join(' | ') || '-'}`,
    `Damage: ${damageHistoryRef.current.join(' | ') || '-'}`,
  ]);
}

function formatPressedKeys(pressedKeys: ReadonlySet<string>): string {
  if (pressedKeys.size === 0) return 'keys=-';
  return `keys=${Array.from(pressedKeys).sort().map(formatKeyCode).join('+')}`;
}

function formatMugenPressedKeys(pressedKeys: ReadonlySet<string>, player: PlayerInputMapping): string {
  const mapping = player.keyboard;
  const buttons: string[] = [];
  if (pressedKeys.has(mapping.x)) buttons.push('X');
  if (pressedKeys.has(mapping.y)) buttons.push('Y');
  if (pressedKeys.has(mapping.z)) buttons.push('Z');
  if (pressedKeys.has(mapping.a)) buttons.push('A');
  if (pressedKeys.has(mapping.b)) buttons.push('B');
  if (pressedKeys.has(mapping.c)) buttons.push('C');
  if (pressedKeys.has(mapping.left)) buttons.push('←');
  if (pressedKeys.has(mapping.right)) buttons.push('→');
  if (pressedKeys.has(mapping.up)) buttons.push('↑');
  if (pressedKeys.has(mapping.down)) buttons.push('↓');
  return `keys=${buttons.join('+') || '-'}`;
}

function IdeasPanel() {
  return (
    <div className="debug-grid">
      <DebugBlock
        title="次に作ると便利な表示"
        lines={[
          '1. State遷移グラフ: State 0 → -1 → 10 → 11 のように矢印で表示',
          '2. Controller 実行表: ChangeState / VelSet / ChangeAnim が OK/NG どちらだったかを行単位で表示',
          '3. Trigger 詳細: expected / actual / result を分けて表示',
          '4. Collision / HitDef タブ: Clsn と HitDef の当たり判定を可視化',
          '5. 差分比較: WinMUGEN期待値とWebMUGEN実測値を横並び表示',
        ]}
      />
      <DebugBlock
        title="現在の調査メモ"
        lines={[
          'State10問題では、入力とCommand認識は確認済み。',
          '次は「StateDefにどのControllerが入っているか」と「どのControllerが実行されたか」をGUIで追う。',
          '長い1行ログではなく、タブ内で静的情報と実行履歴を分離して見る。',
        ]}
      />
    </div>
  );
}

function ManualPanel() {
  return (
    <section className="settings-section">
      <h2>Manual</h2>
      <p>System: R restarts the round after KO or TIME OVER.</p>
    </section>
  );
}

function DebugBlock({ title, lines }: { title: string; lines: string[] }) {
  return (
    <section className="debug-block">
      <h2>{title}</h2>
      <pre className="debug-pre">{lines.join('\n')}</pre>
    </section>
  );
}

function createStaticDebugInfo(character: any, source: string, spriteCount: number): StaticDebugInfo {
  const infoRows = [
    '',
    `source: ${source}`,
    `name: ${readDefValue(character.def, 'Info', 'name') ?? '-'}`,
    `displayname: ${readDefValue(character.def, 'Info', 'displayname') ?? '-'}`,
    `author: ${readDefValue(character.def, 'Info', 'author') ?? '-'}`,
    `sprites: ${spriteCount}`,
    `cns states: ${character.cns.states.length}`,
    `cmd commands: ${character.cmd.commands.length}`,
    `runtime fallback: ${ENABLE_RUNTIME_FALLBACKS ? 'on' : 'off'}`,
  ];

  const stateRows = character.cns.states
    .slice()
    .sort((left: CnsStateDefinition, right: CnsStateDefinition) => left.stateNo - right.stateNo)
    .map(formatStateDebugRow);

  const commandRows = character.cmd.commands
    .map((command: any) => `${command.name}: ${command.command}${command.time ? ` time=${command.time}` : ''}`)
    .slice(0, 120);

  return {
    characterRows: infoRows,
    stateRows,
    commandRows,
  };
}

function formatExpectedRoute(stateNo: number, controller: any): string | null {
  if (String(controller.type).toLowerCase() !== 'changestate') return null;
  const value = readParamNumber(controller, 'value');
  const commandTriggers = controller.triggers
    .filter((trigger: any) => /command\s*[!=]?=/.test(String(trigger.expression).toLowerCase()))
    .map((trigger: any) => `${trigger.name}:${trigger.expression}`);
  if (commandTriggers.length === 0 && stateNo === -1) return null;

  const otherTriggers = controller.triggers
    .filter((trigger: any) => !/command\s*[!=]?=/.test(String(trigger.expression).toLowerCase()))
    .map((trigger: any) => `${trigger.name}:${trigger.expression}`)
    .join(' | ');

  return `${commandTriggers.join(' | ') || 'auto'} -> ChangeState ${value ?? '?'}${otherTriggers ? ` if ${otherTriggers}` : ''}`;
}

function readDefValue(def: any, sectionName: string, key: string): string | null {
  const section = def?.sections?.find((candidate: any) => String(candidate.name).toLowerCase() === sectionName.toLowerCase());
  const value = section?.values?.get?.(key.toLowerCase()) ?? section?.values?.get?.(key);
  if (value === undefined || value === null) return null;
  return String(value).trim().replace(/^"|"$/g, '');
}

function readParamNumber(controller: any, key: string): number | null {
  const raw = controller.params?.[key.toLowerCase()];
  const parsed = Number(String(raw ?? '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function formatStateDebugRow(state: CnsStateDefinition): StateDebugRow {
  const origin = state.source ?? 'unknown';
  const sourceDetail = state.sourceLabel ?? origin;
  return {
    stateNo: state.stateNo,
    origin,
    originLabel: formatStateOriginLabel(origin),
    sourceDetail,
    summary: [
      `source=${sourceDetail}`,
      `type=${state.stateType ?? '-'}`,
      `movetype=${state.moveType ?? '-'}`,
      `physics=${state.physics ?? '-'}`,
      `ctrl=${state.ctrl === undefined ? '-' : Number(state.ctrl)}`,
      `anim=${state.initialAnim ?? '-'}`,
      `controllers=${state.controllers.length}`,
    ].join(' '),
    routes: state.controllers
      .map((controller: any) => formatExpectedRoute(state.stateNo, controller))
      .filter((route): route is string => route !== null),
  };
}

function formatStateOriginLabel(origin: StateDebugRow['origin']): string {
  if (origin === 'character') return 'Char';
  if (origin === 'common') return 'Common';
  if (origin === 'mixed') return 'Mixed';
  return 'Unknown';
}

function formatStateDebugLine(row: StateDebugRow): string {
  return `S${row.stateNo} [${row.originLabel}:${row.sourceDetail}] ${row.summary} routes=${row.routes.join('; ') || '-'}`;
}

function formatStaticTabLines(
  loadMessage: string,
  staticDebugInfo: StaticDebugInfo,
  coverageDebugLines: string[],
): string[] {
  return [
    '=== Character / DEF 読込結果 ===',
    loadMessage,
    ...staticDebugInfo.characterRows,
    '',
    '=== StateDef 一覧 ===',
    ...staticDebugInfo.stateRows.map(formatStateDebugLine),
    '',
    '=== CMD コマンド一覧 ===',
    ...staticDebugInfo.commandRows,
    '',
    '=== CNS対応状況 ===',
    ...coverageDebugLines,
  ];
}

async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.setAttribute('readonly', 'true');
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';
  document.body.appendChild(textArea);
  textArea.select();
  const succeeded = document.execCommand('copy');
  document.body.removeChild(textArea);
  if (!succeeded) throw new Error('clipboard API is unavailable');
}

export function appendRuntimeHistoryIfNeeded({
  frameNo,
  inputLines,
  commandLines,
  physicsLines,
  roundLine,
  scoreLine,
  cnsLines,
  traces,
  pressedKeys,
  historyRef,
  lastSignatureRef,
  setHistoryLines,
}: {
  frameNo: number;
  inputLines: string[];
  commandLines: string[];
  physicsLines: string[];
  roundLine: string;
  scoreLine: string;
  cnsLines: string[];
  traces: CnsRuntimeTrace[];
  pressedKeys: ReadonlySet<string>;
  historyRef: MutableRefObject<string[]>;
  lastSignatureRef: MutableRefObject<string>;
  setHistoryLines: (lines: string[]) => void;
}) {
  const stateChanged = traces.some((trace) => trace.stateNo !== trace.afterStateNo || trace.animNo !== trace.afterAnimNo);
  const controllerRan = traces.some((trace) => trace.executedControllers.length > 0 || trace.debugLines.length > 0);
  const hasInput = pressedKeys.size > 0;
  if (!hasInput && !stateChanged && !controllerRan) return;

  const snapshot = formatAiRuntimeSnapshot({
    inputLines,
    commandLines,
    physicsLines,
    roundLine,
    scoreLine,
    cnsLines,
    traces,
    pressedKeys,
  });
  const signature = formatRuntimeHistorySignature({
    commandLines,
    inputLines,
    pressedKeys,
    traces,
  });
  if (signature === lastSignatureRef.current) return;

  lastSignatureRef.current = signature;
  const timestamp = new Date().toLocaleTimeString('ja-JP', { hour12: false });
  const entry = freezeHistoryLines([
    `===== AI_RUNTIME frame=${frameNo} timestamp=${timestamp} =====`,
    ...snapshot,
  ]);
  const nextHistory = freezeHistoryLines([...entry, ...historyRef.current]).slice(0, RUNTIME_HISTORY_LIMIT);
  historyRef.current = nextHistory.slice();
  setHistoryLines(nextHistory.slice());
}

function formatAiRuntimeSnapshot({
  inputLines,
  commandLines,
  physicsLines,
  roundLine,
  scoreLine,
  cnsLines,
  traces,
  pressedKeys,
}: {
  inputLines: string[];
  commandLines: string[];
  physicsLines: string[];
  roundLine: string;
  scoreLine: string;
  cnsLines: string[];
  traces: CnsRuntimeTrace[];
  pressedKeys: ReadonlySet<string>;
}): string[] {
  return freezeHistoryLines([
    'SECTION input',
    `pressedKeys=${Array.from(pressedKeys).sort().join('+') || '-'}`,
    ...inputLines.map((line) => `raw.${line}`),
    'SECTION command',
    ...commandLines.map((line) => `raw.${line}`),
    'SECTION physics_after_step',
    ...physicsLines.map((line) => `raw.${line}`),
    'SECTION round_score',
    `raw.${roundLine}`,
    `raw.${scoreLine}`,
    'SECTION cns_overlay',
    ...cnsLines.map((line) => `raw.${line}`),
    'SECTION cns_trace_summary',
    ...formatCodexTraceSummaryLines(traces),
    'SECTION cns_trace_detail',
    ...formatCodexTraceDetailLines(traces),
    'END AI_RUNTIME',
  ]);
}

function formatCodexTraceSummaryLines(traces: readonly CnsRuntimeTrace[]): string[] {
  if (traces.length === 0) return ['traceCount=0'];
  return [
    `traceCount=${traces.length}`,
    ...traces.map((trace) => [
      `trace p${trace.playerId}`,
      `state=${trace.stateNo}->${trace.afterStateNo}`,
      `stateChanged=${trace.stateNo === trace.afterStateNo ? 0 : 1}`,
      `anim=${trace.animNo}->${trace.afterAnimNo}`,
      `animChanged=${trace.animNo === trace.afterAnimNo ? 0 : 1}`,
      `time=${trace.stateTime}->${trace.afterStateTime}`,
      `mugenAnimTime=${trace.mugenAnimTime}`,
      `stateFound=${trace.stateFound ? 1 : 0}`,
      `execCount=${trace.executedControllers.length}`,
      `exec=${formatExecutedControllers(trace)}`,
      `debugCount=${trace.debugLines.length}`,
    ].join(' ')),
  ];
}

function appendReadableRuntimeHistoryIfNeeded({
  cns,
  commands,
  getAnimEndTime,
  inputConfig,
  frameNo,
  state,
  pressedKeys,
  historyRef,
  lastSignatureRef,
  setHistoryLines,
}: {
  cns: CnsDocument;
  commands: ReadonlySet<string>;
  getAnimEndTime?: (animNo: number) => number | null;
  inputConfig: InputConfig;
  frameNo: number;
  state: GameState;
  pressedKeys: ReadonlySet<string>;
  historyRef: MutableRefObject<string[]>;
  lastSignatureRef: MutableRefObject<string>;
  setHistoryLines: (lines: string[]) => void;
}) {
  const [p1] = state.players;
  const triggerSummary = formatP1SatisfiedStateDefTriggerSummary(cns, state, commands, getAnimEndTime);
  const damageSummary = formatHitEventSummary(state);
  const keySummary = formatMugenPressedKeys(pressedKeys, inputConfig.players[0]);
  const signature = [
    p1.stateNo,
    p1.animNo,
    stripReadableRuntimeValueSummaries(triggerSummary),
    damageSummary,
    keySummary,
  ].join('|');
  if (signature === lastSignatureRef.current) return;

  lastSignatureRef.current = signature;
  const timestamp = new Date().toLocaleTimeString('ja-JP', { hour12: false });
  const entry = [
    `---- ${timestamp} frame=${frameNo} ----`,
    `P1 StateNo=${p1.stateNo} Time=${p1.stateTime} AnimNo=${p1.animNo}`,
    keySummary,
    `State状況:`,
    ...triggerSummary.split('\n').map((line) => `  ${line}`),
    `Damage=${damageSummary}`,
    '',
  ];
  const nextHistory = freezeHistoryLines([...entry, ...historyRef.current]).slice(0, READABLE_RUNTIME_HISTORY_LIMIT);
  historyRef.current = nextHistory.slice();
  setHistoryLines(nextHistory.slice());
}

function appendStateTransitionLogIfNeeded({
  frameNo,
  state,
  historyRef,
  lastStateNosRef,
  setHistoryLines,
}: {
  frameNo: number;
  state: GameState;
  historyRef: MutableRefObject<string[]>;
  lastStateNosRef: MutableRefObject<[number, number]>;
  setHistoryLines: (lines: string[]) => void;
}) {
  const [p1, p2] = state.players;
  const previous = lastStateNosRef.current;
  const current: [number, number] = [p1.stateNo, p2.stateNo];
  const changes: string[] = [];
  if (previous[0] !== current[0]) changes.push(`P1 ${previous[0]} -> ${current[0]}`);
  if (previous[1] !== current[1]) changes.push(`P2 ${previous[1]} -> ${current[1]}`);
  if (changes.length === 0) return;

  lastStateNosRef.current = current;
  const timestamp = new Date().toLocaleTimeString('ja-JP', { hour12: false });
  const nextHistory = [`${timestamp} f=${frameNo} ${changes.join(' | ')}`, ...historyRef.current].slice(0, 160);
  historyRef.current = nextHistory.slice();
  setHistoryLines(nextHistory.slice());
}

function formatRuntimeHistorySignature({
  commandLines,
  inputLines,
  pressedKeys,
  traces,
}: {
  commandLines: string[];
  inputLines: string[];
  pressedKeys: ReadonlySet<string>;
  traces: CnsRuntimeTrace[];
}): string {
  return [
    formatPressedKeys(pressedKeys),
    ...inputLines.filter((line) => !/^keys=/.test(line)),
    ...commandLines,
    ...traces.map((trace) => [
      trace.playerId,
      trace.stateNo,
      trace.afterStateNo,
      trace.animNo,
      trace.afterAnimNo,
      formatExecutedControllers(trace),
      trace.debugLines.filter((line) => !/\btime=|StateTime=|animtime=|MugenAnimTime=/.test(line)).join(','),
    ].join(':')),
  ].join('|');
}

function formatP1SatisfiedStateDefTriggerSummary(
  cns: CnsDocument,
  state: GameState,
  commands: ReadonlySet<string>,
  getAnimEndTime?: (animNo: number) => number | null,
): string {
  const [p1, p2] = state.players;
  const mugenAnimTime = calculateMugenAnimTime(p1.animTime, getAnimEndTime?.(p1.animNo));
  const context = { player: p1, opponent: p2, commands, animTime: mugenAnimTime };
  const summaries = cns.states
    .filter((stateDef) => stateDef.stateNo === p1.stateNo)
    .flatMap((stateDef) => formatSatisfiedStateDefTriggers(stateDef, context));

  return summaries.length > 0 ? summaries.join('\n') : '-';
}

function formatSatisfiedStateDefTriggers(
  stateDef: CnsStateDefinition,
  context: Parameters<typeof evaluateCnsRuntimeTrigger>[1],
): string[] {
  const lines: string[] = [];

  stateDef.controllers.forEach((controller) => {
    if (controller.triggers.length === 0) return;
    if (!shouldShowReadableController(controller, context)) return;

    const passed = evaluateReadableController(controller, context);
    lines.push(formatReadableControllerHeaderOk(controller, passed));
    lines.push(...controller.triggers.map((trigger) => `  ${formatReadableTriggerLineOk(trigger, context)}`));
  });

  return lines;
}

function shouldShowReadableController(
  controller: CnsStateController,
  context: Parameters<typeof evaluateCnsRuntimeTrigger>[1],
): boolean {
  if (controller.type.toLowerCase() === 'changestate') return true;
  return controller.triggers.some((trigger) => evaluateCnsRuntimeTrigger(trigger.expression, context));
}

function formatReadableControllerHeader(controller: CnsStateController, passed: boolean): string {
  const value = controller.type.toLowerCase() === 'changestate'
    ? ` -> ${readParamNumber(controller, 'value') ?? '?'}`
    : '';
  return `**${controller.type}${value}** | ${passed ? '✅ 成立' : '✗ 不成立'}`;
}

function formatReadableControllerHeaderOk(controller: CnsStateController, passed: boolean): string {
  const value = controller.type.toLowerCase() === 'changestate'
    ? ` -> ${readParamNumber(controller, 'value') ?? '?'}`
    : '';
  const source = controller.sourceFile && controller.sourceLine ? ` @ ${controller.sourceFile}:${controller.sourceLine}` : '';
  return `**${controller.type}${value}** | ${passed ? 'OK' : 'NG'}${source}`;
}

function formatReadableTriggerLine(
  trigger: CnsTrigger,
  context: Parameters<typeof evaluateCnsRuntimeTrigger>[1],
): string {
  const passed = evaluateCnsRuntimeTrigger(trigger.expression, context);
  return `${passed ? '✅' : '✗'} \`${trigger.name}=${trigger.expression}\``;
}

function formatReadableTriggerLineOk(
  trigger: CnsTrigger,
  context: Parameters<typeof evaluateCnsRuntimeTrigger>[1],
): string {
  const passed = evaluateCnsRuntimeTrigger(trigger.expression, context);
  const values = formatTriggerValueSummary(trigger.expression, context);
  return `${passed ? 'OK' : 'NG'} \`${trigger.name}=${trigger.expression}${values ? ` || values: ${values}` : ''}\``;
}

function formatTriggerValueSummary(
  expression: string,
  context: CnsRuntimeTriggerContext,
): string {
  const names = collectTriggerValueNames(expression);
  const values: string[] = [];
  const seen = new Set<string>();

  for (const name of names) {
    const normalized = normalizeDisplayExpressionName(name);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    const value = readNumberExpression(normalized, context);
    if (value !== null) values.push(`${normalized}=${formatRuntimeNumber(value)}`);
  }

  if (values.length === 0) {
    values.push(
      `time=${context.player.stateTime}`,
      `anim=${context.player.animNo}`,
      `vel=(${formatRuntimeNumber(context.player.vx)},${formatRuntimeNumber(context.player.vy)})`,
    );
  } else {
    if (!seen.has('anim') && /\banim\b/i.test(expression)) values.push(`anim=${context.player.animNo}`);
    if (!seen.has('time') && /\btime\b/i.test(expression)) values.push(`time=${context.player.stateTime}`);
  }

  return values.slice(0, 6).join('  ');
}

export function stripReadableRuntimeValueSummaries(summary: string): string {
  return summary.replace(/\s+\|\| values: .+$/gm, '');
}

function collectTriggerValueNames(expression: string): string[] {
  const names: string[] = [];
  const lower = expression.toLowerCase();
  const functionRefs = lower.match(/\b(?:var|fvar|sysvar|gethitvar|const)\([^)]*\)/g) ?? [];
  names.push(...functionRefs);

  const namedRefs = [
    'vel x',
    'vel y',
    'hitvel x',
    'hitvel y',
    'pos x',
    'pos y',
    'animtime',
    'animelemno',
    'animelem',
    'stateno',
    'prevstateno',
    'time',
    'anim',
    'power',
    'life',
    'ctrl',
    'movehit',
    'movecontact',
    'moveguarded',
    'hitcount',
  ];

  for (const name of namedRefs) {
    const pattern = new RegExp(`(^|[^a-z0-9_])${escapeRegExp(name).replace(/\\ /g, '\\s+')}([^a-z0-9_]|$)`, 'i');
    if (pattern.test(lower)) names.push(name);
  }

  return names;
}

function normalizeDisplayExpressionName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

function formatRuntimeNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function evaluateReadableController(
  controller: CnsStateController,
  context: Parameters<typeof evaluateCnsRuntimeTrigger>[1],
): boolean {
  const triggerAll = controller.triggers.filter((trigger) => /^triggerall$/i.test(trigger.name));
  const groups = collectReadableTriggerGroups(controller.triggers);
  if (!triggerAll.every((trigger) => evaluateCnsRuntimeTrigger(trigger.expression, context))) return false;
  if (groups.length === 0) return triggerAll.length > 0;
  return groups.some(([, triggers]) => triggers.every((trigger) => evaluateCnsRuntimeTrigger(trigger.expression, context)));
}

function collectReadableTriggerGroups(triggers: readonly CnsTrigger[]): Array<[number, CnsTrigger[]]> {
  const groups = new Map<number, CnsTrigger[]>();
  for (const trigger of triggers) {
    if (/^triggerall$/i.test(trigger.name)) continue;
    const match = trigger.name.match(/^trigger(\d+)$/i);
    const groupNo = match ? Number(match[1]) : 1;
    const group = groups.get(groupNo) ?? [];
    group.push(trigger);
    groups.set(groupNo, group);
  }
  return Array.from(groups.entries()).sort(([left], [right]) => left - right);
}

function formatCodexTraceDetailLines(traces: readonly CnsRuntimeTrace[]): string[] {
  if (traces.length === 0) return ['trace=-'];
  return traces.flatMap((trace) => [
    `trace p${trace.playerId} StateNo=${trace.stateNo}->${trace.afterStateNo} StateTime=${trace.stateTime}->${trace.afterStateTime} AnimNo=${trace.animNo}->${trace.afterAnimNo} MugenAnimTime=${trace.mugenAnimTime} found=${trace.stateFound ? 1 : 0}`,
    `trace p${trace.playerId} executed=${formatExecutedControllers(trace)}`,
    ...trace.debugLines.map((line) => `trace p${trace.playerId} debug ${line}`),
  ]);
}

function formatExecutedControllers(trace: CnsRuntimeTrace): string {
  return trace.executedControllers.length > 0 ? trace.executedControllers.join(',') : '-';
}

function formatHitEventSummary(state: GameState): string {
  const p1Hits = state.hitEvents.filter((event) => event.attackerId === 1);
  if (p1Hits.length === 0) return '-';
  return p1Hits.map((event) => `P1->P${event.defenderId}:${event.damage}`).join(',');
}

function freezeHistoryLines(lines: Iterable<unknown>): string[] {
  return Array.from(lines, (line) => String(line));
}

function normalizeResolvedCommands(commands: Iterable<string>): ReadonlySet<string> {
  return new Set(Array.from(commands, (command) => command.toLowerCase()));
}
