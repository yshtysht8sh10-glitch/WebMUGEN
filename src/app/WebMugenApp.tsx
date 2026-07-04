import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { CanvasRenderer } from '../renderer/canvas2d/CanvasRenderer';
import { createInitialGameState } from '../core/engine/GameState';
import type { GameState } from '../core/engine/types';
import { createSampleCharacterAssets, loadAppCharacter } from './AppCharacterLoader';
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
import { formatCmdControlHelp } from './CmdControlHelp';

const DEFAULT_CHARACTER_DEF_PATH = '/chars/T-H-M-A.zip';
const ENABLE_RUNTIME_FALLBACKS = false;
const RUNTIME_HISTORY_LIMIT = 500;
const INPUT_CONFIG_STORAGE_KEY = 'webmugen.inputConfig.v1';
const CHARACTER_PATH_STORAGE_KEY = 'webmugen.characterPath.v1';
const CHARACTER_PATH_OPTIONS = ['/chars/T-H-M-A.zip', '/chars/kfm/kfm.def'] as const;

type DebugTab = 'static' | 'runtime' | 'ideas' | 'manual' | 'settings';

type StaticDebugInfo = {
  characterRows: string[];
  commandRoutes: string[];
  stateRows: string[];
  commandRows: string[];
};

const EMPTY_STATIC_DEBUG_INFO: StaticDebugInfo = {
  characterRows: ['character=-'],
  commandRoutes: ['routes=-'],
  stateRows: ['states=-'],
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
  const frameNoRef = useRef(0);
  const runtimeHistoryRef = useRef<string[]>([]);
  const lastRuntimeSignatureRef = useRef('');
  const [loadMessage, setLoadMessage] = useState('Loading character...');
  const [inputDebugLines, setInputDebugLines] = useState<string[]>(['keys=-']);
  const [roundDebugLine, setRoundDebugLine] = useState(formatRoundState(createInitialRoundState()));
  const [scoreDebugLine, setScoreDebugLine] = useState(formatRoundScore(createInitialRoundScore()));
  const [cnsDebugLines, setCnsDebugLines] = useState<string[]>([]);
  const [commandDebugLines, setCommandDebugLines] = useState<string[]>(['cmd p1=-', 'cmd p2=-']);
  const [physicsDebugLines, setPhysicsDebugLines] = useState<string[]>(['phys p1=-', 'phys p2=-']);
  const [coverageDebugLines, setCoverageDebugLines] = useState<string[]>(['coverage=-']);
  const [controlHelpLines, setControlHelpLines] = useState<string[]>(['CMD: -']);
  const [staticDebugInfo, setStaticDebugInfo] = useState<StaticDebugInfo>(EMPTY_STATIC_DEBUG_INFO);
  const [runtimeHistoryLines, setRuntimeHistoryLines] = useState<string[]>(['操作すると、ここにタイムスタンプ付きで内部処理ログが残ります。']);
  const [activeDebugTab, setActiveDebugTab] = useState<DebugTab>('static');
  const [copyStatus, setCopyStatus] = useState('');
  const [inputConfig, setInputConfigState] = useState<InputConfig>(inputConfigRef.current);
  const [characterPath, setCharacterPathState] = useState(loadCharacterPath());

  useEffect(() => {
    let disposed = false;
    let frameId = 0;

    async function start() {
      const canvas = canvasRef.current;
      if (!canvas) return;

      gameStateRef.current = createInitialGameState();
      hitFeedbackRef.current = createInitialHitFeedbackState();
      roundStateRef.current = createInitialRoundState();
      roundScoreRef.current = createInitialRoundScore();
      cnsTraceRef.current = [];
      runtimeHistoryRef.current = [];
      lastRuntimeSignatureRef.current = '';
      p1CommandBufferRef.current.clear();
      p2CommandBufferRef.current.clear();

      const loadResult = await loadAppCharacter(characterPath);
      if (disposed) return;

      const loadedCharacter = loadResult.character ?? createSampleCharacterAssets();
      const character = {
        ...loadedCharacter,
        cns: ENABLE_RUNTIME_FALLBACKS
          ? attachFallbackAttackStates(loadedCharacter.cns)
          : loadedCharacter.cns,
      };
      cnsCoverageRef.current = analyzeCnsCoverage(character.cns);
      setCoverageDebugLines(formatCnsCoverageDebugOverlay(cnsCoverageRef.current));
      setControlHelpLines(formatCmdControlHelp(character.cmd));

      const spriteCount = character.sprites?.sprites.size ?? 0;

      setStaticDebugInfo(createStaticDebugInfo(character, loadResult.source, spriteCount));
      setLoadMessage(
        loadResult.source === 'def'
          ? `Loaded character: ${characterPath} sprites=${spriteCount} cnsStates=${character.cns.states.length} fallback=${ENABLE_RUNTIME_FALLBACKS ? 'on' : 'off'}`
          : `Sample character fallback: ${loadResult.errorMessage ?? 'unknown reason'} cnsStates=${character.cns.states.length} runtimeFallback=${ENABLE_RUNTIME_FALLBACKS ? 'on' : 'off'}`,
      );

      rendererRef.current = new CanvasRenderer(canvas, character.air, null, character.sprites);
      inputRef.current = new BrowserInput(window);
      p1CommandBufferRef.current = new InputBuffer(60);
      p2CommandBufferRef.current = new InputBuffer(60);

      const tick = () => {
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
          const restarted = restartRound(nextRoundState.roundNo);
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
            getAnimationDuration: (animNo) => getAnimationDuration(character.air, animNo),
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
            nextState = stepCnsPhysicsMotion(nextState);
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
  const staticTabLines = formatStaticTabLines(loadMessage, staticDebugInfo, coverageDebugLines, controlHelpLines);

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
        <canvas
          ref={canvasRef}
          width={960}
          height={540}
        />
        <div className="live-debug-strip" aria-label="live runtime debug">
          {liveDebugLines.join('\n')}
        </div>
      </section>

      <DebugTabs activeTab={activeDebugTab} onChange={setActiveDebugTab} />
      <CopyToolbar
        activeTab={activeDebugTab}
        runtimeLogText={runtimeHistoryLines.join('\n')}
        copyStatus={copyStatus}
        onCopy={handleCopy}
      />

      <section className="debug-panel">
        {activeDebugTab === 'static' && (
          <StaticDebugPanel
            loadMessage={loadMessage}
            staticDebugInfo={staticDebugInfo}
            coverageDebugLines={coverageDebugLines}
            controlHelpLines={controlHelpLines}
          />
        )}
        {activeDebugTab === 'runtime' && (
          <RuntimeHistoryPanel runtimeHistoryLines={runtimeHistoryLines} />
        )}
        {activeDebugTab === 'ideas' && <IdeasPanel />}
        {activeDebugTab === 'manual' && <ManualPanel />}
        {activeDebugTab === 'settings' && (
          <SettingsPanel
            characterPath={characterPath}
            inputConfig={inputConfig}
            onCharacterPathChange={setCharacterPath}
            onInputConfigChange={setInputConfig}
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
  onCharacterPathChange,
  onInputConfigChange,
}: {
  characterPath: string;
  inputConfig: InputConfig;
  onCharacterPathChange: (path: string) => void;
  onInputConfigChange: (config: InputConfig) => void;
}) {
  return (
    <div className="settings-stack">
      <CharacterConfigPanel characterPath={characterPath} onChange={onCharacterPathChange} />
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
      <button className={activeTab === 'static' ? 'active' : ''} onClick={() => onChange('static')} type="button">
        タブ1 静的情報
      </button>
      <button className={activeTab === 'runtime' ? 'active' : ''} onClick={() => onChange('runtime')} type="button">
        タブ2 実行履歴
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
  runtimeLogText,
  copyStatus,
  onCopy,
}: {
  activeTab: DebugTab;
  runtimeLogText: string;
  copyStatus: string;
  onCopy: (label: string, text: string) => void;
}) {
  if (activeTab !== 'runtime') return null;

  return (
    <div className="copy-toolbar">
      <button type="button" onClick={() => onCopy('実行履歴ログ', runtimeLogText)}>
        ログをコピー
      </button>
      {copyStatus && <span className="copy-status">{copyStatus}</span>}
    </div>
  );
}

function StaticDebugPanel({
  loadMessage,
  staticDebugInfo,
  coverageDebugLines,
  controlHelpLines,
}: {
  loadMessage: string;
  staticDebugInfo: StaticDebugInfo;
  coverageDebugLines: string[];
  controlHelpLines: string[];
}) {
  return (
    <div className="debug-grid">
      <DebugBlock title="Character / DEF 読込結果" lines={[loadMessage, ...staticDebugInfo.characterRows]} />
      <DebugBlock title="Command → State 期待遷移" lines={staticDebugInfo.commandRoutes} />
      <DebugBlock title="StateDef 一覧" lines={staticDebugInfo.stateRows} />
      <DebugBlock title="CMD コマンド一覧" lines={staticDebugInfo.commandRows} />
      <DebugBlock title="互換カバレッジ" lines={coverageDebugLines} />
      <DebugBlock title="操作ヘルプ" lines={controlHelpLines} />
    </div>
  );
}

function RuntimeHistoryPanel({ runtimeHistoryLines }: { runtimeHistoryLines: string[] }) {
  return (
    <div>
      <p className="debug-note">
        入力、Command、State、Controller、Physics の変化をタイムスタンプ付きで蓄積します。操作を止めても消えません。
      </p>
      <pre className="debug-pre history-pre">{runtimeHistoryLines.join('\n')}</pre>
    </div>
  );
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
    `source=${source}`,
    `name=${readDefValue(character.def, 'Info', 'name') ?? '-'}`,
    `displayname=${readDefValue(character.def, 'Info', 'displayname') ?? '-'}`,
    `author=${readDefValue(character.def, 'Info', 'author') ?? '-'}`,
    `sprites=${spriteCount}`,
    `cnsStates=${character.cns.states.length}`,
    `cmdCommands=${character.cmd.commands.length}`,
  ];

  const commandRoutes = character.cns.states
    .filter((state: any) => state.stateNo === -1 || state.stateNo === -2 || state.stateNo === -3)
    .flatMap((state: any) => state.controllers.map((controller: any) => formatExpectedRoute(state.stateNo, controller)))
    .filter(Boolean)
    .slice(0, 80);

  const stateRows = character.cns.states
    .slice()
    .sort((left: any, right: any) => left.stateNo - right.stateNo)
    .map((state: any) => `S${state.stateNo} type=${state.stateType ?? '-'} phys=${state.physics ?? '-'} ctrl=${state.ctrl === undefined ? '-' : Number(state.ctrl)} anim=${state.initialAnim ?? '-'} controllers=${state.controllers.length}`)
    .slice(0, 120);

  const commandRows = character.cmd.commands
    .map((command: any) => `${command.name}: ${command.command}${command.time ? ` time=${command.time}` : ''}`)
    .slice(0, 120);

  return {
    characterRows: infoRows,
    commandRoutes: commandRoutes.length > 0 ? commandRoutes : ['ChangeState routes=-'],
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

  return `S${stateNo} ${commandTriggers.join(' | ') || 'auto'} -> ChangeState ${value ?? '?'}${otherTriggers ? ` if ${otherTriggers}` : ''}`;
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

function formatStaticTabLines(
  loadMessage: string,
  staticDebugInfo: StaticDebugInfo,
  coverageDebugLines: string[],
  controlHelpLines: string[],
): string[] {
  return [
    '=== Character / DEF 読込結果 ===',
    loadMessage,
    ...staticDebugInfo.characterRows,
    '',
    '=== Command → State 期待遷移 ===',
    ...staticDebugInfo.commandRoutes,
    '',
    '=== StateDef 一覧 ===',
    ...staticDebugInfo.stateRows,
    '',
    '=== CMD コマンド一覧 ===',
    ...staticDebugInfo.commandRows,
    '',
    '=== 互換カバレッジ ===',
    ...coverageDebugLines,
    '',
    '=== 操作ヘルプ ===',
    ...controlHelpLines,
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

  const snapshot = freezeHistoryLines([
    ...inputLines,
    ...commandLines,
    ...physicsLines,
    roundLine,
    scoreLine,
    ...cnsLines,
  ]);
  const signature = snapshot.join('|');
  if (signature === lastSignatureRef.current) return;

  lastSignatureRef.current = signature;
  const timestamp = new Date().toLocaleTimeString('ja-JP', { hour12: false });
  const entry = freezeHistoryLines([
    `---- ${timestamp} frame=${frameNo} ----`,
    ...snapshot.map((line) => `  ${line}`),
  ]);
  const nextHistory = freezeHistoryLines([...historyRef.current, ...entry]).slice(-RUNTIME_HISTORY_LIMIT);
  historyRef.current = nextHistory.slice();
  setHistoryLines(nextHistory.slice());
}

function freezeHistoryLines(lines: Iterable<unknown>): string[] {
  return Array.from(lines, (line) => String(line));
}

function normalizeResolvedCommands(commands: Iterable<string>): ReadonlySet<string> {
  return new Set(Array.from(commands, (command) => command.toLowerCase()));
}
