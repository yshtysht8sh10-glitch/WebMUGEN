import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject, type ReactNode } from 'react';
import { CanvasRenderer } from '../renderer/canvas2d/CanvasRenderer';
import { createInitialGameState } from '../core/engine/GameState';
import type { GameState, PlayerState, ProjectileState, Rect } from '../core/engine/types';
import { applyInfinitePowerAtFrameStart } from '../core/power/InfinitePower';
import { applyPracticeModeRecovery } from '../core/training/PracticeMode';
import { createSampleCharacterAssets, loadAppCharacter, readCharacterRuntimeMetadata, saveCharacterSourceFile } from './AppCharacterLoader';
import { loadMugenStageZip } from './AppStageLoader';
import type { CharacterSourceFile } from '../core/character/CharacterTypes';
import type { SndDocument, SndSample } from '../parser/snd/SndTypes';
import { sndSampleKey } from '../parser/snd/SndTypes';
import { parseSndV1 } from '../parser/snd/SndParser';
import { BrowserAudioRuntime, formatAudioRuntimeDiagnostic, type AudioRuntimeDiagnostic } from '../core/audio/BrowserAudioRuntime';
import { createAudioStartGate, type AudioStartGate, type AudioStartGateGesture, type RuntimeStartState } from './AudioStartGate';
import type { SoundRuntimeEvent } from '../core/audio/SoundEvent';
import { processSoundRuntimeEvents } from '../core/audio/SoundRuntimeBridge';
import { adjustMasterVolumeFromKey, loadAudioSettings, normalizeAudioSettings, saveAudioSettings, type AudioSettings } from './AudioSettings';
import { applyExplodControllerEvents, removeExplodsOnOwnerHit, stepExplodRuntime, type ExplodControllerEvent } from '../core/explod/ExplodSystem';
import type { AirAction, AirDocument, AirElement } from '../parser/air/AirTypes';
import type { ImageDataSprite, ImageDataSpritePack } from '../core/sprite/ImageDataSpriteTypes';
import { spriteKey } from '../core/sprite/SpritePackLoader';
import type { SpriteKey } from '../core/sprite/SpriteTypes';
import { convertSffV1ToImageDataSpritePack } from '../core/sprite/SffSpritePackConverter';
import { tokenizeCharacterSourceLine } from './CharacterSyntaxHighlighter';
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
import { resolveProjectileHits, stepProjectiles } from '../core/projectile/ProjectileSystem';
import { applyHitEffectRuntime } from '../core/hitdef/HitEffectRuntime';
import { applyFallbackHitRecovery } from '../core/engine/FallbackHitRecovery';
import {
  createInitialHitFeedbackState,
  startEnvironmentShake,
  updateHitFeedback,
  type EnvironmentShake,
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
import {
  applyRoundFlowStateEntries,
  isMatchOver,
  requestRoundResultSkip,
  shouldStartNextMatch,
  shouldStartNextRound,
  skipRoundIntro,
  winMugenRoundState,
} from '../core/engine/RoundFlow';
import { canRestartRound, restartCurrentRound, restartRound } from '../core/engine/RoundRestart';
import {
  applyWinMugenStateActions,
  isEditableHotkeyTarget,
  isWinMugenStateAction,
  isWinMugenSystemKey,
  resolveWinMugenHotkey,
  shouldPreserveNativeTextCopy,
  type WinMugenHotkeyAction,
} from './WinMugenHotkeys';
import {
  DEFAULT_FRAME_INTERVAL_MS,
  DEFAULT_RUNTIME_SETTINGS,
  loadRuntimeSettings,
  normalizeRuntimeSettings,
  saveRuntimeSettings,
  type RuntimeSettings,
} from './RuntimeSettings';
import { calculateMugenAnimTime, getMugenAnimEndTime } from '../core/animation/AnimationDuration';
import { getAnimationTriggerInfo, getCurrentAnimationElement } from '../core/animation/AnimationPlayer';
import { attachFallbackAttackStates } from '../core/cns/CnsFallbackDocument';
import { readCnsConst } from '../core/cns/CnsConstants';
import { analyzeCnsCoverage } from '../core/cns/CnsCoverageDiagnostics';
import type { CnsCoverageDiagnostics } from '../core/cns/CnsCoverageDiagnostics';
import {
  advanceExternalCnsStateEntryFrame,
  enterCnsStateAndRunTimeZero,
  stepCnsStateRuntime,
  type CnsExecutedControllerRef,
  type CnsRuntimeTrace,
} from '../core/cns/CnsStateRuntime';
import { synchronizeRuntimeFrame } from './RuntimeFrame';
import {
  applyPauseControllerEvents,
  canEntityMoveDuringPause,
  canHelperMoveDuringPause,
  createInitialPauseState,
  isGamePaused,
  restorePausedEntityPhysics,
  stepHelperPauseMoveTimes,
  stepPauseState,
  type PauseControllerEvent,
} from '../core/pause/PauseSystem';
import { stepCnsPhysicsMotion } from '../core/cns/CnsPhysicsStep';
import { stepAfterImage } from '../core/afterimage/AfterImageSystem';
import { applyBgPalFxEvents, stepBgPalFx, type BgPalFxEvent } from '../core/palfx/BgPalFxSystem';
import { formatCnsRuntimeDebugOverlay } from './CnsRuntimeDebugOverlay';
import { formatCnsCommandDebugOverlay } from './CnsCommandDebugOverlay';
import { formatCnsCoverageDebugOverlay } from './CnsCoverageDebugOverlay';
import { formatPhysicsDebugOverlay } from './PhysicsDebugOverlay';
import { playForceFeedback } from '../core/input/ForceFeedbackAdapter';
import { InputBuffer } from '../input/InputBuffer';
import { HitPauseCommandBuffer } from '../input/HitPauseCommandBuffer';
import { resolveCommands } from '../input/CommandResolver';
import { evaluateCnsRuntimeTrigger, readNumberExpression, type CnsRuntimeTriggerContext } from '../core/cns/CnsRuntimeTrigger';
import type { CnsDocument, CnsStateController, CnsStateDefinition, CnsTrigger } from '../mugen/common/cnsTypes';
import {
  RUNTIME_HISTORY_STORE_LIMIT,
  limitRuntimeHistoryEntries,
  selectVisibleRuntimeHistory,
  type RuntimeHistoryWindow,
  type VisibleRuntimeHistory,
} from './RuntimeHistoryWindow';
import {
  appendReadableRuntimeEntry,
  clearReadableRuntimeLogStores,
  createReadableRuntimeEntryKey,
  createRuntimeLogIndexEntry,
  formatAllReadableRuntimeEntriesCopy,
  formatReadableRuntimeEntryCopy,
  getLatestReadableRuntimeEntry,
  getReadableRuntimeEntry,
  type ReadableRuntimeEntry,
  type RuntimeLogIndexEntry,
} from './RuntimeLogIndex';
import { RuntimePerformanceMetrics } from './RuntimePerformanceMetrics';
import { CHARACTER_PATH_OPTIONS as DISCOVERED_CHARACTER_PATH_OPTIONS } from 'virtual:webmugen-character-manifest';
import { loadUiLanguage, saveUiLanguage, UiLanguageProvider, useUiLanguage } from './UiLanguage';
import { applyViewportCameraRules, getScreenSizeProfile } from '../core/engine/ScreenSize';

const DEFAULT_CHARACTER_DEF_PATH = '/chars/T-H-M-A.zip';
const ENABLE_RUNTIME_FALLBACKS = false;
const APP_PLAYER_START_X = [380, 580] as const;
const INPUT_CONFIG_STORAGE_KEY = 'webmugen.inputConfig.v1';
const CHARACTER_PATH_STORAGE_KEY = 'webmugen.characterPath.v1';
export const CHARACTER_PATH_OPTIONS = uniqueCharacterPathOptions([
  DEFAULT_CHARACTER_DEF_PATH,
  ...DISCOVERED_CHARACTER_PATH_OPTIONS,
]);
const RUNTIME_HISTORY_RENDER_THROTTLE_MS = 250;
const STATE_HISTORY_RENDER_THROTTLE_MS = 200;

type AppPage = 'play' | 'static-files' | 'settings';
type DebugTab = 'runtime-human' | 'runtime-ai' | 'manual';
type RuntimeLogTab = 'human' | 'ai';
type CnsSourceSelection = { path: string; line: number } | null;
type CharacterSyntaxTheme = 'vscode-dark-2026' | 'mps-classic' | 'monochrome';
export type SourceViewHistoryEntry = {
  label: string;
  line: number;
  path: string;
  sourceLine: string;
};

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

export function WebMugenApp({ initialPage = 'play' }: { initialPage?: AppPage }) {
  const [uiLanguage, setUiLanguage] = useState(loadUiLanguage);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const gameStateRef = useRef<GameState>(createInitialGameState(undefined, {}, APP_PLAYER_START_X));
  const hitFeedbackRef = useRef<HitFeedbackState>(createInitialHitFeedbackState());
  const roundStateRef = useRef<RoundState>(createInitialRoundState());
  const roundScoreRef = useRef<RoundScore>(createInitialRoundScore());
  const cnsTraceRef = useRef<CnsRuntimeTrace[]>([]);
  const cnsCoverageRef = useRef<CnsCoverageDiagnostics | null>(null);
  const p1CommandBufferRef = useRef(new InputBuffer(60));
  const p2CommandBufferRef = useRef(new InputBuffer(60));
  const p1HitPauseCommandBufferRef = useRef<HitPauseCommandBuffer | null>(null);
  const p2HitPauseCommandBufferRef = useRef<HitPauseCommandBuffer | null>(null);
  const restartPressedRef = useRef(false);
  const presentationSkipInputHeldRef = useRef(false);
  const pendingWinMugenHotkeysRef = useRef<WinMugenHotkeyAction[]>([]);
  const winMugenPausedRef = useRef(false);
  const winMugenHudVisibleRef = useRef(true);
  const winMugenFastForwardRef = useRef(false);
  const inputRef = useRef<BrowserInput | null>(null);
  const inputConfigRef = useRef<InputConfig>(loadInputConfig());
  const runtimeSettingsRef = useRef<RuntimeSettings>(loadRuntimeSettings());
  const audioSettingsRef = useRef<AudioSettings>(loadAudioSettings());
  const audioRuntimeRef = useRef<BrowserAudioRuntime | null>(null);
  const audioStartGateRef = useRef<AudioStartGate | null>(null);
  const characterSoundsRef = useRef<SndDocument | null>(null);
  const lastFrameTickTimeRef = useRef<number | null>(null);
  const frameNoRef = useRef(0);
  const runtimeHistoryRef = useRef<string[]>([]);
  const audioLifecycleHistoryRef = useRef<string[]>([]);
  const readableEntryStoreRef = useRef<Map<string, ReadableRuntimeEntry>>(new Map());
  const readableIndexStoreRef = useRef<RuntimeLogIndexEntry[]>([]);
  const nextRuntimeLogEntryIdRef = useRef(1);
  const stateTransitionLogRef = useRef<string[]>([]);
  const lastRuntimeSignatureRef = useRef('');
  const lastReadableRuntimeSignatureRef = useRef('');
  const stateTransitionHistoryRef = useRef<string[]>([]);
  const inputHistoryRef = useRef<string[]>([]);
  const damageHistoryRef = useRef<string[]>([]);
  const lastStageKeySignatureRef = useRef('');
  const lastStateNosRef = useRef<[number, number]>([0, 0]);
  const stateTransitionLogLastStateNosRef = useRef<[number, number]>([0, 0]);
  const runtimeHistoryRenderTimerRef = useRef<number | null>(null);
  const lastStateHistoryRenderTimeRef = useRef(0);
  const lastHumanLogCaptureTimeRef = useRef(0);
  const performanceMetricsRef = useRef(new RuntimePerformanceMetrics());
  const lastPerformancePublishTimeRef = useRef(0);
  const [loadMessage, setLoadMessage] = useState('Loading character...');
  const [inputDebugLines, setInputDebugLines] = useState<string[]>(['keys=-']);
  const [roundDebugLine, setRoundDebugLine] = useState(formatRoundState(createInitialRoundState()));
  const [scoreDebugLine, setScoreDebugLine] = useState(formatRoundScore(createInitialRoundScore()));
  const [cnsDebugLines, setCnsDebugLines] = useState<string[]>([]);
  const [commandDebugLines, setCommandDebugLines] = useState<string[]>(['cmd p1=-', 'cmd p2=-']);
  const [physicsDebugLines, setPhysicsDebugLines] = useState<string[]>(['phys p1=-', 'phys p2=-']);
  const [coverageDebugLines, setCoverageDebugLines] = useState<string[]>(['coverage=-']);
  const [staticDebugInfo, setStaticDebugInfo] = useState<StaticDebugInfo>(EMPTY_STATIC_DEBUG_INFO);
  const [runtimeHistoryVersion, setRuntimeHistoryVersion] = useState(0);
  const [runtimeLogIndexEntries, setRuntimeLogIndexEntries] = useState<RuntimeLogIndexEntry[]>([]);
  const [selectedReadableEntry, setSelectedReadableEntry] = useState<ReadableRuntimeEntry | null>(null);
  const [runtimeFrameIndexAutoScroll, setRuntimeFrameIndexAutoScroll] = useState(true);
  const [stateTransitionLogLines, setStateTransitionLogLines] = useState<string[]>(['StateNoが変化すると、ここに遷移だけが残ります。']);
  const [stageDebugLines, setStageDebugLines] = useState<string[]>(['State: -']);
  const [activePage, setActivePage] = useState<AppPage>(initialPage);
  const [activeDebugTab, setActiveDebugTab] = useState<DebugTab>('runtime-human');
  const [aiHistoryWindow, setAiHistoryWindow] = useState<RuntimeHistoryWindow>({ mode: 'latest' });
  const [copyStatus, setCopyStatus] = useState('');
  const [inputConfig, setInputConfigState] = useState<InputConfig>(inputConfigRef.current);
  const [runtimeSettings, setRuntimeSettingsState] = useState<RuntimeSettings>(runtimeSettingsRef.current);
  const screenSizeProfile = getScreenSizeProfile(runtimeSettings.screenSizeMode);
  const [audioStatus, setAudioStatus] = useState<'locked' | 'unlocked' | 'unsupported'>('locked');
  const [audioMuted, setAudioMuted] = useState(audioSettingsRef.current.muted);
  const [audioMasterVolume, setAudioMasterVolume] = useState(audioSettingsRef.current.masterVolumePercent);
  const [audioDiagnostic, setAudioDiagnostic] = useState('audio=-');
  const [runtimeStartState, setRuntimeStartState] = useState<RuntimeStartState>('loading');
  const [characterPath, setCharacterPathState] = useState(loadCharacterPath());
  const [cnsSourceFiles, setCnsSourceFiles] = useState<CharacterSourceFile[]>([]);
  const [loadedAir, setLoadedAir] = useState<AirDocument | null>(null);
  const [loadedSprites, setLoadedSprites] = useState<ImageDataSpritePack | null>(null);
  const [selectedCnsSource, setSelectedCnsSource] = useState<CnsSourceSelection>(null);
  const [sourceViewHistory, setSourceViewHistory] = useState<SourceViewHistoryEntry[]>([]);
  const [characterReloadVersion, setCharacterReloadVersion] = useState(0);
  const cnsSourceScrollPositionsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const handleWinMugenHotkey = (event: KeyboardEvent) => {
      if (isEditableHotkeyTarget(event.target)) return;
      if (shouldPreserveNativeTextCopy(event)) return;
      const action = resolveWinMugenHotkey(event);
      if (!action) return;
      event.preventDefault();
      event.stopPropagation();
      pendingWinMugenHotkeysRef.current.push(action);
    };
    window.addEventListener('keydown', handleWinMugenHotkey);
    return () => window.removeEventListener('keydown', handleWinMugenHotkey);
  }, []);

  const clearRuntimeHistoryRenderTimer = () => {
    if (runtimeHistoryRenderTimerRef.current === null) return;
    window.clearTimeout(runtimeHistoryRenderTimerRef.current);
    runtimeHistoryRenderTimerRef.current = null;
  };

  const invalidateRuntimeHistoryViews = () => {
    clearRuntimeHistoryRenderTimer();
    setRuntimeHistoryVersion((version) => version + 1);
  };

  const scheduleRuntimeHistoryRender = () => {
    if (runtimeHistoryRenderTimerRef.current !== null) return;
    runtimeHistoryRenderTimerRef.current = window.setTimeout(() => {
      runtimeHistoryRenderTimerRef.current = null;
      setRuntimeHistoryVersion((version) => version + 1);
    }, RUNTIME_HISTORY_RENDER_THROTTLE_MS);
  };

  const recordAudioHistory = (line: string) => {
    if (!runtimeSettingsRef.current.aiLogEnabled) return;
    const entry = [
      `===== AI_RUNTIME frame=${frameNoRef.current} timestamp=${new Date().toISOString()} source=audio =====`,
      line,
    ];
    audioLifecycleHistoryRef.current = [...entry, ...audioLifecycleHistoryRef.current].slice(0, 400);
    runtimeHistoryRef.current = limitRuntimeHistoryEntries(
      [...entry, ...runtimeHistoryRef.current],
      'ai',
      RUNTIME_HISTORY_STORE_LIMIT,
    );
    scheduleRuntimeHistoryRender();
  };

  useEffect(() => {
    let active = true;
    const runtime = new BrowserAudioRuntime(undefined, (diagnostic: AudioRuntimeDiagnostic) => {
      recordAudioHistory(formatAudioRuntimeDiagnostic(diagnostic));
      if (active) setAudioDiagnostic(`audio ${diagnostic.code}${diagnostic.sampleKey ? ` sample=${diagnostic.sampleKey}` : ''} ${diagnostic.message}`);
    });
    runtime.setMasterVolume(audioSettingsRef.current.masterVolumePercent / 100);
    runtime.setMuted(audioSettingsRef.current.muted);
    audioRuntimeRef.current = runtime;
    recordAudioHistory(`raw.audio_lifecycle event=mount runtimeInstanceId=${runtime.runtimeInstanceId}`);

    return () => {
      recordAudioHistory(`raw.audio_lifecycle event=react_effect_cleanup runtimeInstanceId=${runtime.runtimeInstanceId}`);
      active = false;
      audioStartGateRef.current?.dispose();
      audioStartGateRef.current = null;
      void runtime.cleanup();
      audioRuntimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let frameId = 0;
    let gate: AudioStartGate | null = null;

    async function loadCharacterAssets() {
      const canvas = canvasRef.current;
      if (!canvas) return;

      setRuntimeStartState('loading');

      gameStateRef.current = createInitialGameState(undefined, {}, APP_PLAYER_START_X);
      hitFeedbackRef.current = createInitialHitFeedbackState();
      roundStateRef.current = createInitialRoundState(runtimeSettingsRef.current.roundTime);
      roundScoreRef.current = createInitialRoundScore();
      cnsTraceRef.current = [];
      runtimeHistoryRef.current = [...audioLifecycleHistoryRef.current];
      readableEntryStoreRef.current = new Map();
      readableIndexStoreRef.current = [];
      nextRuntimeLogEntryIdRef.current = 1;
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
      invalidateRuntimeHistoryViews();
      setRuntimeLogIndexEntries([]);
      setSelectedReadableEntry(null);
      p1CommandBufferRef.current.clear();
      p2CommandBufferRef.current.clear();
      p1HitPauseCommandBufferRef.current?.clear();
      p2HitPauseCommandBufferRef.current?.clear();
      setSelectedCnsSource(null);
      setSourceViewHistory([]);
      setLoadedAir(null);
      setLoadedSprites(null);
      const audioRuntime = audioRuntimeRef.current;
      recordAudioHistory(`raw.audio_lifecycle event=character_path_effect_stop_all runtimeInstanceId=${audioRuntime?.runtimeInstanceId ?? '-'} characterPath=${characterPath}`);
      audioRuntime?.stopAll();
      characterSoundsRef.current = null;
      setStateTransitionLogLines(['StateNoが変化すると、ここに遷移だけが残ります。']);

      const loadResult = await loadAppCharacter(characterPath);
      if (disposed) return;
      let loadedStage = null;
      let stageLoadError: string | null = null;
      if (runtimeSettingsRef.current.stageTheme === 'external') {
        try {
          loadedStage = await loadMugenStageZip(runtimeSettingsRef.current.stageArchivePath);
        } catch (error) {
          stageLoadError = error instanceof Error ? error.message : String(error);
        }
      }
      if (disposed) return;

      const loadedCharacter = loadResult.character ?? createSampleCharacterAssets();
      const character = {
        ...loadedCharacter,
        cns: ENABLE_RUNTIME_FALLBACKS
          ? attachFallbackAttackStates(loadedCharacter.cns)
          : loadedCharacter.cns,
      };
      const characterPowerMax = readCnsConst(character.cns, 'data.power');
      gameStateRef.current = createInitialGameState(characterPowerMax, readCharacterRuntimeMetadata(character), APP_PLAYER_START_X);
      setCnsSourceFiles(character.cnsSourceFiles ?? []);
      setLoadedAir(character.air);
      setLoadedSprites(character.sprites);
      characterSoundsRef.current = character.sounds ?? null;
      cnsCoverageRef.current = analyzeCnsCoverage(character.cns);
      setCoverageDebugLines(formatCnsCoverageDebugOverlay(cnsCoverageRef.current));

      const spriteCount = character.sprites?.sprites.size ?? 0;

      setStaticDebugInfo(createStaticDebugInfo(character, loadResult.source, spriteCount));
      setLoadMessage(
        loadResult.source === 'def'
          ? `Loaded character: ${characterPath}${stageLoadError ? ` / Stage fallback: ${stageLoadError}` : loadedStage ? ` / Stage: ${loadedStage.name}` : ''}`
          : `Sample character fallback: ${loadResult.errorMessage ?? 'unknown reason'}`,
      );

      const characterRenderAssets = { airDocument: character.air, imageDataSpritePack: character.sprites };
      const startGameLoop = () => {
        if (disposed) return;
        rendererRef.current = new CanvasRenderer(canvas, character.air, null, character.sprites, {
          1: characterRenderAssets,
          2: characterRenderAssets,
        }, undefined, loadedStage);
        inputRef.current = new BrowserInput(window);
        p1CommandBufferRef.current = new InputBuffer(60);
        p2CommandBufferRef.current = new InputBuffer(60);
        p1HitPauseCommandBufferRef.current = new HitPauseCommandBuffer(character.cmd);
        p2HitPauseCommandBufferRef.current = new HitPauseCommandBuffer(character.cmd);

        const tick = (timestamp: number) => {
        const frameIntervalMs = winMugenFastForwardRef.current ? 1 : runtimeSettingsRef.current.frameIntervalMs;
        const lastTickTime = lastFrameTickTimeRef.current;
        if (lastTickTime !== null && timestamp - lastTickTime < frameIntervalMs) {
          frameId = requestAnimationFrame(tick);
          return;
        }
        lastFrameTickTimeRef.current = timestamp;
        const measuredFrameTimeMs = lastTickTime === null ? frameIntervalMs : timestamp - lastTickTime;
        const performanceFrameStartedAt = performance.now();
        const aiSignatureBefore = lastRuntimeSignatureRef.current;
        const humanBufferEntriesBefore = readableEntryStoreRef.current.size;
        let cnsMs = 0;
        let logSerializationMs = 0;
        let debugUiUpdateMs = 0;
        const winMugenHotkeys = pendingWinMugenHotkeysRef.current.splice(0);
        let frameStepRequested = false;
        let reloadMatchRequested = false;
        for (const action of winMugenHotkeys) {
          if (action === 'toggle-pause') winMugenPausedRef.current = !winMugenPausedRef.current;
          else if (action === 'frame-step') frameStepRequested = winMugenPausedRef.current;
          else if (action === 'toggle-hud') winMugenHudVisibleRef.current = !winMugenHudVisibleRef.current;
          else if (action === 'toggle-fast-forward') winMugenFastForwardRef.current = !winMugenFastForwardRef.current;
          else if (action === 'toggle-collision-boxes') {
            setRuntimeSettings({
              ...runtimeSettingsRef.current,
              collisionBoxesVisible: !runtimeSettingsRef.current.collisionBoxesVisible,
            });
          } else if (action === 'toggle-debug-display') {
            setRuntimeSettings({
              ...runtimeSettingsRef.current,
              stateHistoryVisible: !runtimeSettingsRef.current.stateHistoryVisible,
            });
          } else if (action === 'clear-debug') clearRuntimeLogs();
          else if (action === 'screenshot') captureCanvasScreenshot(canvas);
          else if (action === 'reload-match') reloadMatchRequested = true;
        }
        if (reloadMatchRequested) {
          winMugenPausedRef.current = false;
          setCharacterReloadVersion((version) => version + 1);
          return;
        }
        const deferredSimulationHotkeys = winMugenHotkeys.filter((action) => isWinMugenStateAction(action) || action === 'restart-round');
        if (winMugenPausedRef.current && !frameStepRequested) {
          pendingWinMugenHotkeysRef.current.unshift(...deferredSimulationHotkeys);
          rendererRef.current?.render(gameStateRef.current, hitFeedbackRef.current, roundStateRef.current, roundScoreRef.current, {
            collisionBoxesVisible: runtimeSettingsRef.current.collisionBoxesVisible,
            diagnosticsEnabled: runtimeSettingsRef.current.aiLogEnabled,
            hudVisible: winMugenHudVisibleRef.current,
            hudTheme: runtimeSettingsRef.current.hudTheme,
            stageTheme: runtimeSettingsRef.current.stageTheme,
          });
          frameId = requestAnimationFrame(tick);
          return;
        }

        frameNoRef.current += 1;
        const input = inputRef.current;
        const config = inputConfigRef.current;
        const pressedKeys = input?.getPressedKeys(config) ?? new Set<string>();
        const presentationKeys = new Set([...pressedKeys].filter((key) => !isWinMugenSystemKey(key)));
        const presentationSkipPressed = presentationKeys.size > 0 && !presentationSkipInputHeldRef.current;
        const inputSnapshot = createInputDebugSnapshot(pressedKeys);
        const p1Input = keysToP1Input(pressedKeys, config);
        const p2Input = keysToP2Input(pressedKeys, config);
        const currentPlayers = gameStateRef.current.players;
        p1CommandBufferRef.current.push(p1Input, currentPlayers[0].facing);
        p2CommandBufferRef.current.push(p2Input, currentPlayers[1].facing);
        const resolvedP1Commands = normalizeResolvedCommands(resolveCommands(character.cmd, p1Input, p1CommandBufferRef.current, currentPlayers[0].facing).activeCommandNames);
        const resolvedP2Commands = normalizeResolvedCommands(resolveCommands(character.cmd, p2Input, p2CommandBufferRef.current, currentPlayers[1].facing).activeCommandNames);
        const p1Commands = p1HitPauseCommandBufferRef.current?.resolve(resolvedP1Commands, currentPlayers[0].hitPause > 0) ?? resolvedP1Commands;
        const p2Commands = p2HitPauseCommandBufferRef.current?.resolve(resolvedP2Commands, currentPlayers[1].hitPause > 0) ?? resolvedP2Commands;

        const humanLogEnabled = runtimeSettingsRef.current.humanLogEnabled;
        const aiLogEnabled = runtimeSettingsRef.current.aiLogEnabled;
        const traceDiagnosticsEnabled = humanLogEnabled || aiLogEnabled;
        const nextInputDebugLines = traceDiagnosticsEnabled ? formatInputDebugOverlay(inputSnapshot) : [];
        const nextCommandDebugLines = traceDiagnosticsEnabled ? formatCnsCommandDebugOverlay(p1Commands, p2Commands) : [];
        if (humanLogEnabled) {
          setInputDebugLines(nextInputDebugLines);
          setCommandDebugLines(nextCommandDebugLines);
        }

        const synchronizedState = synchronizeRuntimeFrame(gameStateRef.current, frameNoRef.current);
        let nextState = applyInfinitePowerAtFrameStart({
          ...synchronizedState,
          hitDiagnosticLines: [],
          players: [
            { ...synchronizedState.players[0], hitDiagnosticLines: [] },
            { ...synchronizedState.players[1], hitDiagnosticLines: [] },
          ],
        }, runtimeSettingsRef.current.infinitePower);
        let nextReadableHistoryState = nextState;
        let nextRoundState = roundStateRef.current;
        let nextFeedback = hitFeedbackRef.current;
        let nextScore = roundScoreRef.current;
        let nextCnsTraces = cnsTraceRef.current;
        const environmentShakeEvents: EnvironmentShake[] = [];
        const bgPalFxEvents: BgPalFxEvent[] = [];
        const allPalFxEvents: BgPalFxEvent[] = [];
        const envColorEvents: Array<{ color: { red: number; green: number; blue: number }; time: number; under: boolean; ownerEntityId: number }> = [];

        const hotkeyStateResult = applyWinMugenStateActions(
          nextState,
          nextRoundState,
          winMugenHotkeys.filter(isWinMugenStateAction),
          runtimeSettingsRef.current.roundTime,
        );
        nextState = hotkeyStateResult.state;
        nextRoundState = hotkeyStateResult.roundState;

        if (
          winMugenHotkeys.includes('restart-round') || (
            inputSnapshot.system.restartRound &&
            !restartPressedRef.current &&
            canRestartRound(nextRoundState)
          )
        ) {
          const restarted = restartCurrentRound(nextRoundState.roundNo, runtimeSettingsRef.current.roundTime, characterPowerMax, APP_PLAYER_START_X);
          const synchronizedRestartState = synchronizeRuntimeFrame(restarted.gameState, frameNoRef.current);
          nextState = applyInfinitePowerAtFrameStart({
            ...synchronizedRestartState,
            hitDiagnosticLines: [],
            players: [
              { ...synchronizedRestartState.players[0], hitDiagnosticLines: [] },
              { ...synchronizedRestartState.players[1], hitDiagnosticLines: [] },
            ],
          }, runtimeSettingsRef.current.infinitePower);
          nextRoundState = restarted.roundState;
          nextFeedback = restarted.hitFeedbackState;
          nextCnsTraces = [];
          p1CommandBufferRef.current.clear();
          p2CommandBufferRef.current.clear();
          p1HitPauseCommandBufferRef.current?.clear();
          p2HitPauseCommandBufferRef.current?.clear();
          audioRuntimeRef.current?.stopAll();
        } else {
          if (presentationSkipPressed) {
            nextState = skipRoundIntro(nextState, nextRoundState);
            nextRoundState = requestRoundResultSkip(nextRoundState);
          }
          nextState = applyRoundFlowStateEntries(nextState, nextRoundState);
          const fightActive = nextRoundState.phase === 'fight';
          const pauseAtFrameStart = nextState.pause ?? createInitialPauseState();
          if (ENABLE_RUNTIME_FALLBACKS && fightActive) {
            nextState = applyFallbackControls(nextState, p1Input, p2Input);
          }

          const soundEvents: SoundRuntimeEvent[] = [];
          const explodRuntimeEvents: ExplodControllerEvent[] = [];
          const pauseEvents: PauseControllerEvent[] = [];
          const projectileEvents: ProjectileState[] = [];
          const runtimeEventDiagnosticLines: string[] = [];
          const cnsStartedAt = performance.now();
          const cnsResult = stepCnsStateRuntime(nextState, character.cns, {
            p1Commands: fightActive ? p1Commands : new Set(),
            p2Commands: fightActive ? p2Commands : new Set(),
            getAnimationDuration: (animNo) => getMugenAnimEndTime(character.air, animNo),
            getAnimationElementNo: (animNo, animTime) => {
              const element = getCurrentAnimationElement(character.air, animNo, animTime);
              return element ? element.elementIndex + 1 : null;
            },
            getAnimationTriggerInfo: (animNo, animTime) => getAnimationTriggerInfo(character.air, animNo, animTime),
            hitDiagnostics: aiLogEnabled && runtimeSettingsRef.current.hitDiagnostics,
            traceDiagnostics: traceDiagnosticsEnabled,
            onSoundPlay: (event) => soundEvents.push(event),
            onSoundStop: (event) => soundEvents.push(event),
            onSoundPan: (event) => soundEvents.push(event),
            onExplodCreate: (event) => explodRuntimeEvents.push(event),
            onExplodModify: (event) => explodRuntimeEvents.push(event),
            onExplodRemove: (event) => explodRuntimeEvents.push(event),
            onExplodBindTime: (event) => explodRuntimeEvents.push(event),
            onPause: (event) => pauseEvents.push(event),
            onEnvironmentShake: (event) => environmentShakeEvents.push(event),
            onBgPalFx: (event) => bgPalFxEvents.push(event),
            onAllPalFx: (event) => allPalFxEvents.push(event),
            onEnvColor: (event) => envColorEvents.push(event),
            onForceFeedback: (event) => { void playForceFeedback(event); },
            onProjectileCreate: (projectile) => projectileEvents.push({
              ...projectile,
              hitBox: getProjectileHitBox(character.air, projectile.animNo) ?? projectile.hitBox,
            }),
            pauseState: pauseAtFrameStart,
            screenWidth: getScreenSizeProfile(runtimeSettingsRef.current.screenSizeMode).logicalWidth,
            roundState: winMugenRoundState(nextRoundState),
            roundNo: nextRoundState.roundNo,
            roundsExisted: Math.max(0, nextRoundState.roundNo - 1),
            matchNo: 1,
            matchOver: isMatchOver(nextScore),
            roundWinner: nextRoundState.winner,
            roundEndReason: nextRoundState.endReason,
            teamMode: 'single',
          });
          cnsMs = performance.now() - cnsStartedAt;
          nextState = cnsResult.state;
          if (projectileEvents.length > 0) {
            nextState = { ...nextState, projectiles: [...nextState.projectiles, ...projectileEvents] };
          }
          if (bgPalFxEvents.length > 0) nextState = applyBgPalFxEvents(nextState, bgPalFxEvents);
          if (allPalFxEvents.length > 0) {
            const event = allPalFxEvents[allPalFxEvents.length - 1];
            nextState = applyBgPalFxEvents({
              ...nextState,
              players: nextState.players.map((player) => ({
                ...player,
                palFx: { ...event, remainingTime: event.duration, elapsedTime: 0 },
              })) as GameState['players'],
            }, [event]);
          }
          if (envColorEvents.length > 0) {
            const event = envColorEvents[envColorEvents.length - 1];
            nextState = { ...nextState, envColor: { ...event, remainingTime: event.time } };
          }
          if (pauseEvents.length > 0) {
            const pause = applyPauseControllerEvents(nextState.pause ?? createInitialPauseState(), pauseEvents);
            nextState = {
              ...nextState,
              pause,
              hitDiagnosticLines: [
                ...(nextState.hitDiagnosticLines ?? []),
                ...pauseEvents.map((event) => `raw.global_pause event=start kind=${event.type} owner=p${event.ownerEntityId} time=${event.time} movetime=${event.moveTime} darken=${event.darken ? 1 : 0} soundPolicy=continues`),
              ],
            };
          }
          if (explodRuntimeEvents.length > 0) {
            const previousDiagnosticCount = nextState.hitDiagnosticLines?.length ?? 0;
            nextState = applyExplodControllerEvents(nextState, explodRuntimeEvents);
            runtimeEventDiagnosticLines.push(...(nextState.hitDiagnosticLines ?? []).slice(previousDiagnosticCount));
          }
          if (nextState.explods.entries.length > 0) {
            const previousDiagnosticCount = nextState.hitDiagnosticLines?.length ?? 0;
            nextState = stepExplodRuntime(nextState, (entry) => entry.animationSource === 'owner' ? character.air : null, nextState.pause ?? null);
            runtimeEventDiagnosticLines.push(...(nextState.hitDiagnosticLines ?? []).slice(previousDiagnosticCount));
          }
          if (soundEvents.length > 0) {
            runtimeEventDiagnosticLines.push(...processSoundRuntimeEvents(soundEvents, character.sounds, null, audioRuntimeRef.current, aiLogEnabled));
          }
          nextReadableHistoryState = cnsResult.state;
          nextCnsTraces = cnsResult.traces;

          const processedPauseEventCount = pauseEvents.length;
          const processedSoundEventCount = soundEvents.length;
          const processedExplodEventCount = explodRuntimeEvents.length;
          const processedBgPalFxEventCount = bgPalFxEvents.length;
          const processedAllPalFxEventCount = allPalFxEvents.length;
          const processedEnvColorEventCount = envColorEvents.length;
          const processedProjectileEventCount = projectileEvents.length;
          let pauseDuringFrame = nextState.pause ?? createInitialPauseState();
          let pausedThisFrame = isGamePaused(pauseDuringFrame);
          const beforePhysicsState = nextState;
          if (ENABLE_RUNTIME_FALLBACKS) {
            nextState = stepFallbackMotion(nextState);
          } else {
            nextState = stepCnsPhysicsMotion(nextState, character.cns);
          }
          if (pausedThisFrame) {
            nextState = restorePausedEntityPhysics(beforePhysicsState, nextState, pauseDuringFrame);
          }

          nextState = applyFallbackStageRules(nextState);
          const activeScreenProfile = getScreenSizeProfile(runtimeSettingsRef.current.screenSizeMode);
          nextState = applyViewportCameraRules(nextState, activeScreenProfile.logicalWidth, activeScreenProfile.logicalHeight);
          if (!fightActive) {
            nextState = { ...nextState, hitEvents: [] };
          } else {
            nextState = resolveFallbackHits(
              nextState,
              character.air,
              aiLogEnabled && runtimeSettingsRef.current.hitDiagnostics,
              beforePhysicsState,
              (player, opponent, stateNo) => advanceExternalCnsStateEntryFrame(enterCnsStateAndRunTimeZero(
                player,
                opponent,
                stateNo,
                character.cns,
                {
                  gameTime: nextState.frame,
                  getAnimationDuration: (animNo) => getMugenAnimEndTime(character.air, animNo),
                  getAnimationElementNo: (animNo, animTime) => {
                    const element = getCurrentAnimationElement(character.air, animNo, animTime);
                    return element ? element.elementIndex + 1 : null;
                  },
                  getAnimationTriggerInfo: (animNo, animTime) => getAnimationTriggerInfo(character.air, animNo, animTime),
                  hitDiagnostics: aiLogEnabled && runtimeSettingsRef.current.hitDiagnostics,
                  onSoundPlay: (event) => soundEvents.push(event),
                  onSoundStop: (event) => soundEvents.push(event),
                  onSoundPan: (event) => soundEvents.push(event),
                  onExplodCreate: (event) => explodRuntimeEvents.push(event),
                  onExplodModify: (event) => explodRuntimeEvents.push(event),
                  onExplodRemove: (event) => explodRuntimeEvents.push(event),
                  onExplodBindTime: (event) => explodRuntimeEvents.push(event),
                  onPause: (event) => pauseEvents.push(event),
                  onEnvironmentShake: (event) => environmentShakeEvents.push(event),
                  onBgPalFx: (event) => bgPalFxEvents.push(event),
                  onAllPalFx: (event) => allPalFxEvents.push(event),
                  onEnvColor: (event) => envColorEvents.push(event),
                  onForceFeedback: (event) => { void playForceFeedback(event); },
                  onProjectileCreate: (projectile) => projectileEvents.push({
                    ...projectile,
                    hitBox: getProjectileHitBox(character.air, projectile.animNo) ?? projectile.hitBox,
                  }),
                  pauseState: pauseDuringFrame,
                  screenWidth: getScreenSizeProfile(runtimeSettingsRef.current.screenSizeMode).logicalWidth,
                  roundState: winMugenRoundState(nextRoundState),
                  roundNo: nextRoundState.roundNo,
                  matchOver: isMatchOver(nextScore),
                  roundWinner: nextRoundState.winner,
                  roundEndReason: nextRoundState.endReason,
                  teamMode: 'single',
                },
                player.id === 1 ? p1Commands : p2Commands,
              )),
              (entityId) => {
                if (!pausedThisFrame) return true;
                const helper = nextState.helpers.entries.find((entry) => entry.entityId === entityId);
                return helper
                  ? canHelperMoveDuringPause(pauseDuringFrame, helper)
                  : canEntityMoveDuringPause(pauseDuringFrame, entityId);
              },
            );
            const deferredPauseEvents = pauseEvents.slice(processedPauseEventCount);
            if (deferredPauseEvents.length > 0) {
              pauseDuringFrame = applyPauseControllerEvents(pauseDuringFrame, deferredPauseEvents);
              pausedThisFrame = isGamePaused(pauseDuringFrame);
              nextState = {
                ...nextState,
                pause: pauseDuringFrame,
                hitDiagnosticLines: [
                  ...(nextState.hitDiagnosticLines ?? []),
                  ...deferredPauseEvents.map((event) => `raw.global_pause event=start kind=${event.type} owner=p${event.ownerEntityId} time=${event.time} movetime=${event.moveTime} darken=${event.darken ? 1 : 0} soundPolicy=continues phase=post_collision`),
                ],
              };
            }
            const deferredBgPalFxEvents = bgPalFxEvents.slice(processedBgPalFxEventCount);
            if (deferredBgPalFxEvents.length > 0) nextState = applyBgPalFxEvents(nextState, deferredBgPalFxEvents);
            const deferredAllPalFxEvents = allPalFxEvents.slice(processedAllPalFxEventCount);
            if (deferredAllPalFxEvents.length > 0) {
              const event = deferredAllPalFxEvents[deferredAllPalFxEvents.length - 1];
              nextState = applyBgPalFxEvents({
                ...nextState,
                players: nextState.players.map((player) => ({
                  ...player,
                  palFx: { ...event, remainingTime: event.duration, elapsedTime: 0 },
                })) as GameState['players'],
              }, [event]);
            }
            const deferredEnvColorEvents = envColorEvents.slice(processedEnvColorEventCount);
            if (deferredEnvColorEvents.length > 0) {
              const event = deferredEnvColorEvents[deferredEnvColorEvents.length - 1];
              nextState = { ...nextState, envColor: { ...event, remainingTime: event.time } };
            }
            const deferredExplodEvents = explodRuntimeEvents.slice(processedExplodEventCount);
            if (deferredExplodEvents.length > 0) nextState = applyExplodControllerEvents(nextState, deferredExplodEvents);
            const deferredProjectileEvents = projectileEvents.slice(processedProjectileEventCount);
            if (deferredProjectileEvents.length > 0) nextState = { ...nextState, projectiles: [...nextState.projectiles, ...deferredProjectileEvents] };
            const deferredSoundEvents = soundEvents.slice(processedSoundEventCount);
            if (deferredSoundEvents.length > 0) {
              runtimeEventDiagnosticLines.push(...processSoundRuntimeEvents(deferredSoundEvents, character.sounds, null, audioRuntimeRef.current, aiLogEnabled));
            }
            const projectileResult = resolveProjectileHits(
              nextState.players,
              stepProjectiles(nextState.projectiles).projectiles,
            );
            nextState = {
              ...nextState,
              players: projectileResult.players,
              projectiles: projectileResult.projectiles,
              hitEvents: [...nextState.hitEvents, ...projectileResult.hitEvents],
            };
            nextState = removeExplodsOnOwnerHit(nextState);
            const hitEffects = applyHitEffectRuntime(nextState, {
              ownerAir: () => character.air,
              ownerSounds: () => character.sounds,
              fightFxAir: null,
              commonSounds: null,
            });
            nextState = hitEffects.state;
            runtimeEventDiagnosticLines.push(...processSoundRuntimeEvents(hitEffects.soundEvents, character.sounds, null, audioRuntimeRef.current, aiLogEnabled));
            nextState = applyFallbackHitRecovery(nextState, aiLogEnabled && runtimeSettingsRef.current.hitDiagnostics);
          }
          if (runtimeEventDiagnosticLines.length > 0) {
            nextState = { ...nextState, hitDiagnosticLines: [...(nextState.hitDiagnosticLines ?? []), ...runtimeEventDiagnosticLines] };
          }

          nextState = {
            ...nextState,
            bgPalFx: stepBgPalFx(nextState.bgPalFx),
            envColor: nextState.envColor && nextState.envColor.remainingTime > 1
              ? { ...nextState.envColor, remainingTime: nextState.envColor.remainingTime - 1 }
              : undefined,
            players: nextState.players.map((player) => (
              !pausedThisFrame || canEntityMoveDuringPause(pauseDuringFrame, player.id)
                ? { ...player, afterImage: stepAfterImage(player.afterImage, player) }
                : player
            )) as GameState['players'],
            helpers: {
              ...nextState.helpers,
              entries: nextState.helpers.entries.map((helper) => (
                !pausedThisFrame || canHelperMoveDuringPause(pauseDuringFrame, helper)
                  ? { ...helper, player: { ...helper.player, afterImage: stepAfterImage(helper.player.afterImage, helper.player) } }
                  : helper
              )),
            },
          };

          if (!pausedThisFrame) {
            if (fightActive) nextState = applyPracticeModeRecovery(nextState, runtimeSettingsRef.current.practiceMode);
            nextRoundState = stepRoundState(nextRoundState, nextState, runtimeSettingsRef.current.practiceMode);
          }
          nextScore = updateRoundScore(nextScore, nextRoundState);
          nextFeedback = updateHitFeedback(nextFeedback, nextState);
          nextState = {
            ...nextState,
            helpers: stepHelperPauseMoveTimes(nextState.helpers, pauseDuringFrame),
            pause: stepPauseState(pauseDuringFrame),
          };
          const startNextMatch = shouldStartNextMatch(nextRoundState, nextScore, nextState);
          if (startNextMatch || shouldStartNextRound(nextRoundState, nextScore, nextState)) {
            const restarted = restartRound(startNextMatch ? 0 : nextRoundState.roundNo, runtimeSettingsRef.current.roundTime, characterPowerMax);
            nextState = synchronizeRuntimeFrame(restarted.gameState, frameNoRef.current);
            nextRoundState = restarted.roundState;
            if (startNextMatch) nextScore = createInitialRoundScore();
            nextFeedback = restarted.hitFeedbackState;
            nextCnsTraces = [];
            p1CommandBufferRef.current.clear();
            p2CommandBufferRef.current.clear();
            p1HitPauseCommandBufferRef.current?.clear();
            p2HitPauseCommandBufferRef.current?.clear();
            audioRuntimeRef.current?.stopAll();
          }
        }
        for (const event of environmentShakeEvents) nextFeedback = startEnvironmentShake(nextFeedback, event);

        restartPressedRef.current = inputSnapshot.system.restartRound;
        presentationSkipInputHeldRef.current = presentationKeys.size > 0;

        const simulationFinishedAt = performance.now();
        const explodRenderDiagnosticLines = rendererRef.current?.render(nextState, nextFeedback, nextRoundState, nextScore, {
          collisionBoxesVisible: runtimeSettingsRef.current.collisionBoxesVisible,
          diagnosticsEnabled: aiLogEnabled,
          hudVisible: winMugenHudVisibleRef.current,
          hudTheme: runtimeSettingsRef.current.hudTheme,
          stageTheme: runtimeSettingsRef.current.stageTheme,
        }) ?? [];
        if (explodRenderDiagnosticLines.length > 0) {
          nextState = { ...nextState, hitDiagnosticLines: [...(nextState.hitDiagnosticLines ?? []), ...explodRenderDiagnosticLines] };
        }

        gameStateRef.current = nextState;
        hitFeedbackRef.current = nextFeedback;
        roundStateRef.current = nextRoundState;
        roundScoreRef.current = nextScore;
        cnsTraceRef.current = nextCnsTraces;
        const diagnosticStartedAt = performance.now();
        if (
          runtimeSettingsRef.current.stateHistoryVisible
          && timestamp - lastStateHistoryRenderTimeRef.current >= STATE_HISTORY_RENDER_THROTTLE_MS
        ) {
          lastStateHistoryRenderTimeRef.current = timestamp;
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
        }

        const humanLogCaptureMode = runtimeSettingsRef.current.humanLogCaptureMode;
        const captureHumanLogThisFrame = humanLogEnabled && shouldEvaluateHumanLogFrame(humanLogCaptureMode, nextCnsTraces);
        if (captureHumanLogThisFrame) lastHumanLogCaptureTimeRef.current = timestamp;
        const formatDetailedDiagnostics = aiLogEnabled || captureHumanLogThisFrame;
        const nextRoundDebugLine = formatDetailedDiagnostics ? formatRoundState(nextRoundState) : '';
        const nextScoreDebugLine = formatDetailedDiagnostics ? formatRoundScore(nextScore) : '';
        const nextCnsDebugLines = captureHumanLogThisFrame ? formatCnsRuntimeDebugOverlay(nextCnsTraces) : [];
        const nextPhysicsDebugLines = formatDetailedDiagnostics ? formatPhysicsDebugOverlay(nextState) : [];
        if (captureHumanLogThisFrame) {
          const debugUiStartedAt = performance.now();
          setRoundDebugLine(nextRoundDebugLine);
          setScoreDebugLine(nextScoreDebugLine);
          setCnsDebugLines(nextCnsDebugLines);
          setPhysicsDebugLines(nextPhysicsDebugLines);
          debugUiUpdateMs += performance.now() - debugUiStartedAt;
        }

        const logSerializationStartedAt = performance.now();
        if (aiLogEnabled) appendRuntimeHistoryIfNeeded({
          frameNo: frameNoRef.current,
          inputLines: nextInputDebugLines,
          commandLines: nextCommandDebugLines,
          physicsLines: nextPhysicsDebugLines,
          roundLine: nextRoundDebugLine,
          scoreLine: nextScoreDebugLine,
          traces: nextCnsTraces,
          hitDiagnosticLines: nextState.hitDiagnosticLines ?? [],
          pressedKeys,
          historyRef: runtimeHistoryRef,
          lastSignatureRef: lastRuntimeSignatureRef,
          setHistoryLines: scheduleRuntimeHistoryRender,
        });
        const generatedHumanCharacters = captureHumanLogThisFrame ? appendReadableRuntimeHistoryIfNeeded({
          cns: character.cns,
          p1Commands,
          p2Commands,
          getAnimEndTime: (animNo) => getMugenAnimEndTime(character.air, animNo),
          inputConfig: config,
          frameNo: frameNoRef.current,
          state: nextReadableHistoryState,
          traces: nextCnsTraces,
          pressedKeys,
          entryStoreRef: readableEntryStoreRef,
          indexStoreRef: readableIndexStoreRef,
          nextEntryIdRef: nextRuntimeLogEntryIdRef,
          lastSignatureRef: lastReadableRuntimeSignatureRef,
          captureMode: humanLogCaptureMode,
          setIndexEntries: setRuntimeLogIndexEntries,
        }) : 0;
        if (humanLogEnabled) appendStateTransitionLogIfNeeded({
          frameNo: frameNoRef.current,
          state: nextState,
          historyRef: stateTransitionLogRef,
          lastStateNosRef: stateTransitionLogLastStateNosRef,
          setHistoryLines: setStateTransitionLogLines,
        });
        logSerializationMs = performance.now() - logSerializationStartedAt;

        const rendererTimings = rendererRef.current?.getLastTimings() ?? { normalMs: 0, debugMs: 0 };
        const generatedAiEntries = lastRuntimeSignatureRef.current !== aiSignatureBefore ? 1 : 0;
        const generatedHumanEntries = Math.max(0, readableEntryStoreRef.current.size - humanBufferEntriesBefore);
        const nextAiHeaderIndex = runtimeHistoryRef.current.findIndex((line, index) => index > 0 && line.startsWith('===== AI_RUNTIME'));
        const newlyGeneratedAiCharacters = generatedAiEntries === 0
          ? 0
          : runtimeHistoryRef.current.slice(0, nextAiHeaderIndex < 0 ? runtimeHistoryRef.current.length : nextAiHeaderIndex)
            .reduce((total, line) => total + line.length, 0);
        performanceMetricsRef.current.record({
          frameTimeMs: measuredFrameTimeMs,
          simulationMs: simulationFinishedAt - performanceFrameStartedAt,
          cnsMs,
          diagnosticMs: performance.now() - diagnosticStartedAt,
          logSerializationMs,
          debugUiUpdateMs,
          canvasNormalMs: rendererTimings.normalMs,
          canvasDebugMs: rendererTimings.debugMs,
          generatedLogEntries: generatedAiEntries + generatedHumanEntries,
          generatedLogCharacters: newlyGeneratedAiCharacters + generatedHumanCharacters,
          aiBufferLines: runtimeHistoryRef.current.length,
          humanBufferEntries: readableEntryStoreRef.current.size,
          stateHistoryLines: stateTransitionHistoryRef.current.length + inputHistoryRef.current.length + damageHistoryRef.current.length,
        });
        if (timestamp - lastPerformancePublishTimeRef.current >= 1000) {
          lastPerformancePublishTimeRef.current = timestamp;
          const performanceSnapshot = performanceMetricsRef.current.snapshot(runtimeSettingsRef.current);
          window.__WEBMUGEN_PERFORMANCE__ = performanceSnapshot;
          canvas.dataset.performanceSnapshot = JSON.stringify(performanceSnapshot);
        }

          frameId = requestAnimationFrame(tick);
        };

        frameId = requestAnimationFrame(tick);
      };

      const gateRuntime = audioRuntimeRef.current;
      if (!gateRuntime) return;
      gate = createAudioStartGate({
        runtime: gateRuntime,
        onStateChange(nextState) {
          if (disposed) return;
          recordAudioHistory(`raw.audio_start_gate state=${nextState} runtimeInstanceId=${gateRuntime.runtimeInstanceId} contextState=${gateRuntime.contextState}`);
          setRuntimeStartState(nextState);
          if (nextState === 'running' || nextState === 'audio-unavailable') {
            setAudioStatus(gateRuntime.status === 'unlocked' ? 'unlocked' : gateRuntime.status === 'unsupported' ? 'unsupported' : 'locked');
          }
        },
      });
      audioStartGateRef.current = gate;
      gate.prepare(startGameLoop);
    }

    void loadCharacterAssets();

    return () => {
      disposed = true;
      gate?.dispose();
      if (audioStartGateRef.current === gate) audioStartGateRef.current = null;
      cancelAnimationFrame(frameId);
      clearRuntimeHistoryRenderTimer();
      inputRef.current?.dispose();
      inputRef.current = null;
    };
  }, [characterPath, characterReloadVersion]);

  const liveDebugLines = [
    ...inputDebugLines,
    ...commandDebugLines,
    ...physicsDebugLines,
    roundDebugLine,
    scoreDebugLine,
    ...cnsDebugLines,
  ];
  const staticTabLines = formatStaticTabLines(loadMessage, staticDebugInfo, coverageDebugLines);
  const visibleAiHistory = useMemo(
    () => activeDebugTab === 'runtime-ai'
      ? selectVisibleRuntimeHistory(runtimeHistoryRef.current, 'ai', aiHistoryWindow)
      : createEmptyVisibleRuntimeHistory(),
    [activeDebugTab, aiHistoryWindow, runtimeHistoryVersion],
  );

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
    p1HitPauseCommandBufferRef.current?.clear();
    p2HitPauseCommandBufferRef.current?.clear();
  };

  const openCnsSource = (selection: CnsSourceSelection) => {
    setSelectedCnsSource(selection);
    if (selection) {
      const historyEntry = createSourceViewHistoryEntry(cnsSourceFiles, selection);
      if (historyEntry) setSourceViewHistory((history) => appendSourceViewHistory(history, historyEntry));
      setActivePage('static-files');
    }
  };

  const openAnimationSource = (animNo: number) => {
    openCnsSource(findAirActionSourceSelection(cnsSourceFiles, animNo));
  };

  const handleSaveCharacterSource = async (file: CharacterSourceFile, sourceText: string) => {
    await saveCharacterSourceFile(file, sourceText);
    setCnsSourceFiles((files) => files.map((candidate) => candidate.path === file.path
      ? { ...candidate, text: sourceText }
      : candidate));
    setCharacterReloadVersion((version) => version + 1);
  };

  const handleSelectRuntimeFrame = (entry: RuntimeLogIndexEntry) => {
    setSelectedReadableEntry(getReadableRuntimeEntry(readableEntryStoreRef.current, entry.frameNo, entry.p1StateNo));
  };

  const showLatestRuntimeHistory = () => {
    setSelectedReadableEntry(getLatestReadableRuntimeEntry({
      indexStore: readableIndexStoreRef.current,
      entryStore: readableEntryStoreRef.current,
    }));
    setAiHistoryWindow({ mode: 'latest' });
  };

  const clearRuntimeLogs = () => {
    runtimeHistoryRef.current = [];
    audioLifecycleHistoryRef.current = [];
    clearReadableRuntimeLogStores({
      indexStore: readableIndexStoreRef.current,
      entryStore: readableEntryStoreRef.current,
    });
    stateTransitionLogRef.current = [];
    lastRuntimeSignatureRef.current = '';
    lastReadableRuntimeSignatureRef.current = '';
    nextRuntimeLogEntryIdRef.current = 1;
    setRuntimeLogIndexEntries([]);
    setSelectedReadableEntry(null);
    setStateTransitionLogLines(['history cleared']);
    invalidateRuntimeHistoryViews();
  };

  const setRuntimeSettings = (nextSettings: RuntimeSettings) => {
    const normalized = normalizeRuntimeSettings(nextSettings);
    const screenSizeChanged = normalized.screenSizeMode !== runtimeSettingsRef.current.screenSizeMode;
    const appearanceSourceChanged = normalized.stageTheme !== runtimeSettingsRef.current.stageTheme
      || normalized.stageArchivePath !== runtimeSettingsRef.current.stageArchivePath;
    if (normalized.humanLogCaptureMode !== runtimeSettingsRef.current.humanLogCaptureMode) {
      lastReadableRuntimeSignatureRef.current = '';
    }
    performanceMetricsRef.current.clear();
    lastPerformancePublishTimeRef.current = 0;
    if (!normalized.aiLogEnabled) {
      runtimeHistoryRef.current = [];
      audioLifecycleHistoryRef.current = [];
      lastRuntimeSignatureRef.current = '';
      invalidateRuntimeHistoryViews();
    }
    if (!normalized.humanLogEnabled) {
      clearReadableRuntimeLogStores({ indexStore: readableIndexStoreRef.current, entryStore: readableEntryStoreRef.current });
      stateTransitionLogRef.current = [];
      lastReadableRuntimeSignatureRef.current = '';
      setRuntimeLogIndexEntries([]);
      setSelectedReadableEntry(null);
      lastHumanLogCaptureTimeRef.current = 0;
    }
    if (!normalized.stateHistoryVisible) {
      stateTransitionHistoryRef.current = [];
      inputHistoryRef.current = [];
      damageHistoryRef.current = [];
      lastStateHistoryRenderTimeRef.current = 0;
      setStageDebugLines([]);
    }
    runtimeSettingsRef.current = normalized;
    setRuntimeSettingsState(normalized);
    saveRuntimeSettings(normalized);
    if (screenSizeChanged || appearanceSourceChanged) setCharacterReloadVersion((version) => version + 1);
  };

  const setCharacterPath = (nextPath: string) => {
    const trimmed = nextPath.trim();
    if (!trimmed || trimmed === characterPath) return;
    saveCharacterPath(trimmed);
    setCharacterPathState(trimmed);
  };

  const unlockAudio = async () => {
    const runtime = audioRuntimeRef.current;
    if (!runtime) return;
    const unlocked = await runtime.unlock();
    setAudioStatus(unlocked ? 'unlocked' : runtime.status === 'unsupported' ? 'unsupported' : 'locked');
  };

  const testLoadedAudio = async () => {
    const sample = characterSoundsRef.current?.samples.find((entry) => entry.format === 'wave');
    const runtime = audioRuntimeRef.current;
    if (!runtime || !sample) {
      setAudioDiagnostic('audio sound_asset_missing No loaded WAV sample is available.');
      return;
    }
    await runtime.playSample(sndSampleKey(sample.group, sample.index), sample.bytes, { channelKey: 'manual:0', loop: true });
  };

  const stopTestAudio = () => {
    const stopped = audioRuntimeRef.current?.stopChannel('manual:0') ?? false;
    setAudioDiagnostic(`audio test_stop result=${stopped ? 'stopped' : 'noop'}`);
  };

  const panTestAudio = () => {
    const result = audioRuntimeRef.current?.updateChannelPan('manual:0', -0.75) ?? 'channel_not_found';
    setAudioDiagnostic(`audio test_pan normalized=-0.75 result=${result}`);
  };

  const setAudioMute = (muted: boolean) => {
    const next = normalizeAudioSettings({ ...audioSettingsRef.current, muted });
    audioSettingsRef.current = next;
    setAudioMuted(muted);
    audioRuntimeRef.current?.setMuted(muted);
    saveAudioSettings(next);
  };

  const setAudioVolume = (volume: number) => {
    const next = normalizeAudioSettings({ ...audioSettingsRef.current, masterVolumePercent: volume });
    audioSettingsRef.current = next;
    setAudioMasterVolume(next.masterVolumePercent);
    audioRuntimeRef.current?.setMasterVolume(next.masterVolumePercent / 100);
    saveAudioSettings(next);
  };

  const handleAudioStartGesture = (gestureType: AudioStartGateGesture) => {
    const gate = audioStartGateRef.current;
    if (gate) void gate.handleUserGesture(gestureType);
  };

  const continueWithoutAudio = () => {
    audioStartGateRef.current?.continueWithoutAudio();
  };

  return (
    <UiLanguageProvider language={uiLanguage}>
    <div className="app-shell" lang={uiLanguage}>
      <header className="app-header">
        <div>
          <h1>WebMUGEN</h1>
          <p>{uiLanguage === 'ja' ? 'キャラクターローダー統合版' : 'Character loader integration'}</p>
        </div>
        <button
          className="language-toggle"
          type="button"
          aria-label={uiLanguage === 'ja' ? '表示言語を英語に切り替え' : 'Switch display language to Japanese'}
          onClick={() => {
            const next = uiLanguage === 'ja' ? 'en' : 'ja';
            setUiLanguage(next);
            saveUiLanguage(next);
          }}
        >
          {uiLanguage === 'ja' ? 'English' : '日本語'}
        </button>
      </header>

      <AppPageTabs activePage={activePage} onChange={setActivePage} />

      <section
        className={`top-panel ${activePage === 'play' ? 'active' : 'hidden'}`}
        aria-hidden={activePage !== 'play'}
      >
        <section className="stage-panel">
            <div className="stage-viewport">
              <canvas
                className="game-canvas"
                ref={canvasRef}
                width={screenSizeProfile.width}
                height={screenSizeProfile.height}
              />
              {runtimeStartState !== 'running' && (
                <AudioStartOverlay
                  state={runtimeStartState}
                  onUserGesture={handleAudioStartGesture}
                  onContinueWithoutAudio={continueWithoutAudio}
                />
              )}
              {runtimeSettings.stateHistoryVisible && <div className="stage-debug-overlay" aria-label="stage debug overlay">
                {stageDebugLines.map((line, index) => (
                  <div key={`${line}-${index}`}>{line}</div>
                ))}
              </div>}
            </div>
          </section>

          <DebugTabsV2 activeTab={activeDebugTab} onChange={setActiveDebugTab} />
          <CopyToolbarV2
            activeTab={activeDebugTab}
            visibleAiLines={visibleAiHistory.lines}
            allAiLinesRef={runtimeHistoryRef}
            selectedReadableEntry={selectedReadableEntry}
            readableIndexStoreRef={readableIndexStoreRef}
            readableEntryStoreRef={readableEntryStoreRef}
            copyStatus={copyStatus}
            onCopy={handleCopy}
            onClearLogs={clearRuntimeLogs}
          />

          <section className="debug-panel">
            {activeDebugTab === 'runtime-human' && runtimeSettings.humanLogEnabled && (
              <HumanRuntimePanel
                captureMode={runtimeSettings.humanLogCaptureMode}
                indexEntries={runtimeLogIndexEntries}
                selectedEntry={selectedReadableEntry}
                onSelectFrame={handleSelectRuntimeFrame}
                autoScrollIndex={runtimeFrameIndexAutoScroll}
                onToggleAutoScrollIndex={() => setRuntimeFrameIndexAutoScroll((enabled) => !enabled)}
                onOpenCnsSource={openCnsSource}
                onOpenAnimationSource={openAnimationSource}
                onCaptureModeChange={(humanLogCaptureMode) => setRuntimeSettings({ ...runtimeSettings, humanLogCaptureMode })}
              />
            )}
            {activeDebugTab === 'runtime-human' && !runtimeSettings.humanLogEnabled && <p>{uiLanguage === 'ja' ? '人間向けログは設定で無効になっています。' : 'Human log is disabled in Settings.'}</p>}
            {activeDebugTab === 'runtime-ai' && runtimeSettings.aiLogEnabled && (
              <AiRuntimePanel
                visibleRuntimeHistory={visibleAiHistory}
                historyWindow={aiHistoryWindow}
                onShowLatest={showLatestRuntimeHistory}
              />
            )}
            {activeDebugTab === 'runtime-ai' && !runtimeSettings.aiLogEnabled && <p>{uiLanguage === 'ja' ? 'AI向けログは設定で無効になっています。' : 'AI log is disabled in Settings.'}</p>}
            {activeDebugTab === 'manual' && <ManualPanel />}
          </section>
      </section>

      <section
        className={`top-panel ${activePage === 'static-files' ? 'active' : 'hidden'}`}
        aria-hidden={activePage !== 'static-files'}
      >
        {activePage === 'static-files' ? (
          <section className="debug-panel page-debug-panel">
            <StaticDebugPanel
              sourceFiles={cnsSourceFiles}
              sourceViewHistory={sourceViewHistory}
              selectedSource={selectedCnsSource}
              onOpenSource={openCnsSource}
              onSaveSource={handleSaveCharacterSource}
              sourceScrollPositionsRef={cnsSourceScrollPositionsRef}
              air={loadedAir}
              sprites={loadedSprites}
            />
          </section>
        ) : null}
      </section>

      <section
        className={`top-panel ${activePage === 'settings' ? 'active' : 'hidden'}`}
        aria-hidden={activePage !== 'settings'}
      >
        {activePage === 'settings' ? (
          <section className="debug-panel page-debug-panel settings-page-panel">
            <SettingsPanel
              characterPath={characterPath}
              inputConfig={inputConfig}
              runtimeSettings={runtimeSettings}
              onCharacterPathChange={setCharacterPath}
              onInputConfigChange={setInputConfig}
              onRuntimeSettingsChange={setRuntimeSettings}
              audioStatus={audioStatus}
              audioMuted={audioMuted}
              audioMasterVolume={audioMasterVolume}
              audioDiagnostic={audioDiagnostic}
              onUnlockAudio={unlockAudio}
              onTestAudio={testLoadedAudio}
              onStopTestAudio={stopTestAudio}
              onPanTestAudio={panTestAudio}
              onAudioMutedChange={setAudioMute}
              onAudioMasterVolumeChange={setAudioVolume}
            />
          </section>
        ) : null}
      </section>
    </div>
    </UiLanguageProvider>
  );
}

export function AudioStartOverlay({
  state,
  onUserGesture,
  onContinueWithoutAudio,
}: {
  state: Exclude<RuntimeStartState, 'running'>;
  onUserGesture: (gestureType: AudioStartGateGesture) => void;
  onContinueWithoutAudio: () => void;
}) {
  const { text } = useUiLanguage();
  if (state === 'loading') {
    return <div className="audio-start-overlay" role="status">{text('Loading character…', 'キャラクターを読み込んでいます…')}</div>;
  }
  if (state === 'unlocking-audio') {
    return <div className="audio-start-overlay" role="status">{text('Starting audio…', '音声を開始しています…')}</div>;
  }
  if (state === 'waiting-for-user') {
    return (
      <div className="audio-start-overlay">
        <button
          autoFocus
          className="audio-start-primary"
          onPointerDown={() => onUserGesture('pointerdown')}
          onKeyDown={() => onUserGesture('keydown')}
          type="button"
        >
          {text('Click or press a key to start', 'クリックまたはキー入力で開始')}
        </button>
      </div>
    );
  }
  return (
    <div className="audio-start-overlay" role="alert">
      <p>{text('Audio could not be started. Retry or continue without audio.', '音声を開始できませんでした。再試行するか、音声なしで開始してください。')}</p>
      <div className="audio-start-actions">
        <button
          autoFocus
          className="audio-start-primary"
          onPointerDown={() => onUserGesture('pointerdown')}
          onKeyDown={() => onUserGesture('keydown')}
          type="button"
        >
          {text('Retry audio', '音声を再試行')}
        </button>
        <button onClick={onContinueWithoutAudio} type="button">{text('Continue without audio', '音声なしで開始')}</button>
      </div>
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
  { key: 'start', label: 'Start' },
] as const;

type InputAction = typeof INPUT_ACTIONS[number]['key'];

function SettingsPanel({
  characterPath,
  inputConfig,
  runtimeSettings,
  onCharacterPathChange,
  onInputConfigChange,
  onRuntimeSettingsChange,
  audioStatus,
  audioMuted,
  audioMasterVolume,
  audioDiagnostic,
  onUnlockAudio,
  onTestAudio,
  onStopTestAudio,
  onPanTestAudio,
  onAudioMutedChange,
  onAudioMasterVolumeChange,
}: {
  characterPath: string;
  inputConfig: InputConfig;
  runtimeSettings: RuntimeSettings;
  onCharacterPathChange: (path: string) => void;
  onInputConfigChange: (config: InputConfig) => void;
  onRuntimeSettingsChange: (settings: RuntimeSettings) => void;
  audioStatus: 'locked' | 'unlocked' | 'unsupported';
  audioMuted: boolean;
  audioMasterVolume: number;
  audioDiagnostic: string;
  onUnlockAudio: () => void;
  onTestAudio: () => void;
  onStopTestAudio: () => void;
  onPanTestAudio: () => void;
  onAudioMutedChange: (muted: boolean) => void;
  onAudioMasterVolumeChange: (volume: number) => void;
}) {
  return (
    <div className="settings-stack">
      <CharacterConfigPanel characterPath={characterPath} onChange={onCharacterPathChange} />
      <RuntimeSettingsPanel settings={runtimeSettings} onChange={onRuntimeSettingsChange} />
      <AudioSettingsPanel
        status={audioStatus}
        muted={audioMuted}
        masterVolume={audioMasterVolume}
        diagnostic={audioDiagnostic}
        onUnlock={onUnlockAudio}
        onTest={onTestAudio}
        onStopTest={onStopTestAudio}
        onPanTest={onPanTestAudio}
        onMutedChange={onAudioMutedChange}
        onMasterVolumeChange={onAudioMasterVolumeChange}
      />
      <InputConfigPanel
        config={inputConfig}
        onChange={onInputConfigChange}
      />
    </div>
  );
}

export function AudioSettingsPanel({
  status,
  muted,
  masterVolume,
  diagnostic,
  onUnlock,
  onTest,
  onStopTest,
  onPanTest,
  onMutedChange,
  onMasterVolumeChange,
}: {
  status: 'locked' | 'unlocked' | 'unsupported';
  muted: boolean;
  masterVolume: number;
  diagnostic: string;
  onUnlock: () => void;
  onTest: () => void;
  onStopTest: () => void;
  onPanTest: () => void;
  onMutedChange: (muted: boolean) => void;
  onMasterVolumeChange: (volume: number) => void;
}) {
  const { text } = useUiLanguage();
  return (
    <section className="settings-section audio-settings-section" aria-label={text('audio settings', '音声設定')}>
      <div className="settings-section-header">
        <div>
          <h2>{text('Audio', '音声設定')}</h2>
          <p>{text('Control playback, volume, and test output.', '再生状態、音量、テスト出力をまとめて調整します。')}</p>
        </div>
        <span className={`audio-status-badge ${status}`}>{text('Audio status', '音声状態')}: {text(status, status === 'locked' ? '未開始' : status === 'unlocked' ? '開始済み' : '非対応')}</span>
      </div>
      <div className="settings-card-grid audio-settings-grid">
        <section className="settings-card audio-control-card">
          <h3>{text('Playback test', '再生テスト')}</h3>
          <div className="settings-action-grid">
            <button className="settings-primary-button" type="button" onClick={onUnlock}>{text('Start audio', '音声を開始')}</button>
            <button type="button" onClick={onTest} disabled={status !== 'unlocked'}>{text('Play test sound', 'テスト音を再生')}</button>
            <button type="button" onClick={onStopTest}>{text('Stop', '停止')}</button>
            <button type="button" onClick={onPanTest}>{text('Pan left', '左へ移動')}</button>
          </div>
        </section>
        <section className="settings-card audio-volume-card">
          <div className="audio-volume-header">
            <h3>{text('Master volume', '全体音量')}</h3>
            <strong>{masterVolume}%</strong>
          </div>
          <input
            aria-label="Master volume"
            type="range"
            min={0}
            max={100}
            step={1}
            value={masterVolume}
            onChange={(event) => onMasterVolumeChange(Number(event.currentTarget.value))}
            onKeyDown={(event) => {
              const next = adjustMasterVolumeFromKey(masterVolume, event.key);
              if (next === null) return;
              event.preventDefault();
              event.stopPropagation();
              onMasterVolumeChange(next);
            }}
          />
          <label className="settings-inline-option audio-mute-option">
            <input aria-label="Mute all audio" type="checkbox" checked={muted} onChange={(event) => onMutedChange(event.currentTarget.checked)} />
            {text('Mute all audio', 'すべてミュート')}
          </label>
        </section>
      </div>
      <p className="settings-diagnostic">{diagnostic}</p>
    </section>
  );
}

function CharacterConfigPanel({
  characterPath,
  onChange,
}: {
  characterPath: string;
  onChange: (path: string) => void;
}) {
  const { text } = useUiLanguage();
  const [draft, setDraft] = useState(characterPath);

  useEffect(() => {
    setDraft(characterPath);
  }, [characterPath]);

  return (
    <section className="settings-section">
      <h2>{text('Character', 'キャラクター')}</h2>
      <p>{text('Place character files under public/chars/, then select or enter the DEF/ZIP path here.', 'キャラクターファイルを public/chars/ に置き、DEFまたはZIPのパスを選択・入力してください。')}</p>
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
        <button type="button" onClick={() => onChange(draft)}>{text('Load', '読み込み')}</button>
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
  const { text } = useUiLanguage();
  return (
    <section className="input-config-panel">
      <div className="input-config-header">
        <h2>{text('Input Config', '入力設定')}</h2>
        <button type="button" onClick={() => onChange(cloneInputConfig(DEFAULT_INPUT_CONFIG))}>
          {text('Reset', '初期化')}
        </button>
      </div>
      <LiveInputMonitor />
      <ControlSummaryCard config={config} />
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

export function RuntimeSettingsPanel({
  settings,
  onChange,
}: {
  settings: RuntimeSettings;
  onChange: (settings: RuntimeSettings) => void;
}) {
  const { text } = useUiLanguage();
  return (
    <section className="settings-section runtime-settings-section">
      <div className="settings-section-header">
        <div>
          <h2>{text('Runtime', '実行設定')}</h2>
          <p>{text('Adjust match behavior and choose only the diagnostics you need.', '対戦の動作と、必要な診断表示だけをまとめて設定します。')}</p>
        </div>
        <button className="settings-secondary-button" type="button" onClick={() => onChange(DEFAULT_RUNTIME_SETTINGS)}>
          {text('MUGEN defaults', 'MUGEN既定値')}
        </button>
      </div>

      <div className="settings-card-grid runtime-core-settings">
        <section className="settings-card">
          <h3>{text('Match behavior', '対戦動作')}</h3>
          <div className="settings-field-grid">
            <label className="settings-field">
              <span>{text('Game time', 'ラウンド時間')}</span>
              <input min={0} max={999} type="number" value={settings.roundTime} onChange={(event) => onChange({ ...settings, roundTime: Number(event.currentTarget.value) })} />
            </label>
            <label className="settings-field">
              <span>{text('Infinite power', 'パワー無限')}</span>
              <select aria-label="Power Infinite" value={settings.infinitePower} onChange={(event) => onChange({ ...settings, infinitePower: event.currentTarget.value as RuntimeSettings['infinitePower'] })}>
                <option value="off">OFF</option>
                <option value="p1">P1</option>
                <option value="p2">P2</option>
                <option value="both">P1 + P2</option>
              </select>
            </label>
            <label className="settings-field">
              <span>{text('Frame duration (ms)', 'フレーム間隔（ms）')}</span>
              <input min={1} max={1000} step={1} type="number" value={Math.round(settings.frameIntervalMs)} onChange={(event) => onChange({ ...settings, frameIntervalMs: Number(event.currentTarget.value) })} />
            </label>
            <label className="settings-field">
              <span>{text('Logical screen size', '論理画面サイズ')}</span>
              <select aria-label="Logical screen size" value={settings.screenSizeMode} onChange={(event) => onChange({ ...settings, screenSizeMode: event.currentTarget.value as RuntimeSettings['screenSizeMode'] })}>
                <option value="winmugen-800x480">Extended Hi-Res 800×480 (400×240 coordinates)</option>
                <option value="winmugen-classic-640x480">WinMUGEN Classic 640×480 (320×240 coordinates)</option>
                <option value="wide-960x540">Wide 960×540 (16:9)</option>
              </select>
              <small>{text('Changing this setting reloads the current match.', '変更すると現在の対戦を再読み込みします。')}</small>
            </label>
            <label className="settings-field">
              <span>{text('Gauge design', 'ゲージデザイン')}</span>
              <select aria-label="Gauge design" value={settings.hudTheme} onChange={(event) => onChange({ ...settings, hudTheme: event.currentTarget.value as RuntimeSettings['hudTheme'] })}>
                <option value="fresh">Fresh</option>
                <option value="cyber">Cyber</option>
              </select>
            </label>
            <label className="settings-field">
              <span>{text('Stage design', '背景・ステージ')}</span>
              <select aria-label="Stage design" value={settings.stageTheme} onChange={(event) => onChange({ ...settings, stageTheme: event.currentTarget.value as RuntimeSettings['stageTheme'] })}>
                <option value="fresh">Fresh</option>
                <option value="cyber">Cyber</option>
                <option value="external">MUGEN Stage ZIP</option>
              </select>
            </label>
            <label className="settings-field">
              <span>{text('Stage ZIP path', 'ステージZIPパス')}</span>
              <input aria-label="Stage ZIP path" defaultValue={settings.stageArchivePath} key={settings.stageArchivePath} type="text" onBlur={(event) => onChange({ ...settings, stageArchivePath: event.currentTarget.value })} />
              <small>{text('Use a URL served by WebMUGEN, such as /stages/example.zip.', 'public/stages 配下など、WebMUGENから配信されるURLを指定します。')}</small>
            </label>
          </div>
        </section>
        <label className="settings-card settings-toggle-card">
          <input aria-label="Practice Mode" type="checkbox" checked={settings.practiceMode} onChange={(event) => onChange({ ...settings, practiceMode: event.currentTarget.checked })} />
          <span>
            <strong>{text('Practice mode', '練習モード')}</strong>
            <small>{text('Recover at 0 life and remove the round time limit.', '体力0で全回復し、ラウンド時間を無制限にします。')}</small>
          </span>
        </label>
      </div>

      <div className="settings-subsection-header">
        <h3>{text('Debug / Logging', 'デバッグ・ログ')}</h3>
        <p>{text('Enable only the information needed for the current investigation.', '現在の調査に必要な情報だけを有効にしてください。')}</p>
      </div>
      <div className="settings-card-grid diagnostics-settings-grid">
        <section className="settings-card settings-toggle-card-with-control">
          <label className="settings-toggle-row">
            <input aria-label="Human log enabled" type="checkbox" checked={settings.humanLogEnabled} onChange={(event) => onChange({ ...settings, humanLogEnabled: event.currentTarget.checked })} />
            <span><strong>{text('Human log', '人間向けログ')}</strong><small>{text('Detailed diagnostics for reading on screen.', '画面で読むための詳細診断を記録します。')}</small></span>
          </label>
          <label className="settings-field compact">
            <span>{text('Retention', '保持条件')}</span>
            <select aria-label="Human log capture mode" disabled={!settings.humanLogEnabled} value={settings.humanLogCaptureMode} onChange={(event) => onChange({ ...settings, humanLogCaptureMode: event.currentTarget.value as RuntimeSettings['humanLogCaptureMode'] })}>
              <option value="state-transition">{text('When StateNo changes', 'Stateが遷移したとき')}</option>
              <option value="all-frames">{text('Every frame', '全フレーム')}</option>
              <option value="trigger-changes">{text('When trigger ON/OFF changes', 'トリガーのON/OFFに変化があったとき')}</option>
              <option value="controller-activated">{text('When a state controller activates', 'ステコンが作動したとき')}</option>
            </select>
          </label>
        </section>
        <section className="settings-card settings-toggle-card-with-control">
          <label className="settings-toggle-row">
            <input aria-label="AI log enabled" type="checkbox" checked={settings.aiLogEnabled} onChange={(event) => onChange({ ...settings, aiLogEnabled: event.currentTarget.checked })} />
            <span><strong>{text('AI log', 'AI向けログ')}</strong><small>{text('Compact event snapshots for diagnosis and copying.', '診断・コピー用にイベント発生時の要点を記録します。')}</small></span>
          </label>
          <label className="settings-inline-option">
            <input type="checkbox" checked={settings.hitDiagnostics} disabled={!settings.aiLogEnabled} onChange={(event) => onChange({ ...settings, hitDiagnostics: event.currentTarget.checked })} />
            {text('Include hit lifecycle details', 'ヒット処理詳細を含める')}
          </label>
        </section>
        <label className="settings-card settings-toggle-card">
          <input aria-label="Collision boxes visible" type="checkbox" checked={settings.collisionBoxesVisible} onChange={(event) => onChange({ ...settings, collisionBoxesVisible: event.currentTarget.checked })} />
          <span><strong>{text('Collision boxes', '当たり判定枠')}</strong><small>{text('Draw Clsn1, Clsn2, Push, and projectile rectangles.', 'Clsn1、Clsn2、Push、Projectileの枠を描画します。')}</small></span>
        </label>
        <label className="settings-card settings-toggle-card">
          <input aria-label="State history visible" type="checkbox" checked={settings.stateHistoryVisible} onChange={(event) => onChange({ ...settings, stateHistoryVisible: event.currentTarget.checked })} />
          <span><strong>{text('State history', 'ステート履歴')}</strong><small>{text('Show lightweight state, input, and damage history.', '軽量なステート・入力・ダメージ履歴を表示します。')}</small></span>
        </label>
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
  const { text } = useUiLanguage();
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
    <section className="live-input-monitor" aria-label={text('live input monitor', '入力モニター')}>
      <h3>{text('Live Input Monitor', '入力モニター')}</h3>
      <div className="live-input-grid">
        <div>
          <h4>{text('Keyboard', 'キーボード')}</h4>
          <div className="live-input-pills">
            {snapshot.keys.length === 0 ? <span className="live-input-empty">-</span> : snapshot.keys.map((key) => (
              <span className="live-input-pill" key={key}>{key}</span>
            ))}
          </div>
        </div>
        <div>
          <h4>{text('Controller', 'コントローラー')}</h4>
          {snapshot.gamepads.length === 0 ? (
            <div className="live-input-empty">{text('not connected', '未接続')}</div>
          ) : snapshot.gamepads.map((gamepad) => (
            <div className="live-gamepad-row" key={gamepad.index}>
              <strong>Pad {gamepad.index + 1}</strong>
              <span title={gamepad.id}>{gamepad.id || 'unknown'}</span>
              <span>{text('buttons', 'ボタン')}: {gamepad.buttons.length === 0 ? '-' : gamepad.buttons.join(', ')}</span>
              <span>{text('axes', '軸')}: {gamepad.axes.length === 0 ? '-' : gamepad.axes.map((axis) => `${axis.index}:${axis.value.toFixed(2)}`).join(', ')}</span>
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
  const { text } = useUiLanguage();
  const japaneseActionLabels: Partial<Record<InputAction, string>> = { left: '左', right: '右', up: '上', down: '下', start: 'スタート' };
  const actionLabel = (key: InputAction, fallback: string) => japaneseActionLabels[key] ?? fallback;
  return (
    <section className="input-config-card">
      <h3>P{playerIndex + 1}</h3>
      <div className="input-config-rows">
        {INPUT_ACTIONS.map((action) => (
          <div className="input-config-row" key={action.key}>
            <span>{text(action.label, actionLabel(action.key, action.label))}</span>
            <KeyCaptureButton
              value={player.keyboard[action.key]}
              onChange={(code) => onChange({
                ...player,
                keyboard: { ...player.keyboard, [action.key]: code },
              })}
            />
            <label>
              {text('Pad', 'パッド')}
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
  const { text } = useUiLanguage();
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
      {capturing ? text('Press key…', 'キーを押してください…') : formatKeyCode(value)}
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

function uniqueCharacterPathOptions(paths: readonly string[]): readonly string[] {
  return Array.from(new Set(paths));
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

function AppPageTabs({ activePage, onChange }: { activePage: AppPage; onChange: (page: AppPage) => void }) {
  const { text } = useUiLanguage();
  return (
    <nav className="page-tabs" aria-label={text('main page tabs', 'メイン画面タブ')}>
      <button className={activePage === 'play' ? 'active' : ''} onClick={() => onChange('play')} type="button">
        {text('Game / Runtime', 'ゲーム・実行状況')}
      </button>
      <button className={activePage === 'static-files' ? 'active' : ''} onClick={() => onChange('static-files')} type="button">
        {text('Character Files', 'キャラクターファイル')}
      </button>
      <button className={activePage === 'settings' ? 'active' : ''} onClick={() => onChange('settings')} type="button">
        {text('Settings', '設定')}
      </button>
    </nav>
  );
}

function DebugTabsV2({ activeTab, onChange }: { activeTab: DebugTab; onChange: (tab: DebugTab) => void }) {
  const { text } = useUiLanguage();
  return (
    <nav className="debug-tabs" aria-label="debug tabs">
      <button className={activeTab === 'runtime-human' ? 'active' : ''} onClick={() => onChange('runtime-human')} type="button">
        {text('Human Runtime', '人間向け実行ログ')}
      </button>
      <button className={activeTab === 'runtime-ai' ? 'active' : ''} onClick={() => onChange('runtime-ai')} type="button">
        {text('AI Runtime', 'AI向け実行ログ')}
      </button>
      <button className={activeTab === 'manual' ? 'active' : ''} onClick={() => onChange('manual')} type="button">
        {text('Manual', '操作説明')}
      </button>
    </nav>
  );
}

function LegacyDebugTabs({
  activeTab,
  onChange,
}: {
  activeTab: 'runtime' | 'static' | 'ideas' | 'manual' | 'settings';
  onChange: (tab: 'runtime' | 'static' | 'ideas' | 'manual' | 'settings') => void;
}) {
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

function CopyToolbarV2({
  activeTab,
  visibleAiLines,
  allAiLinesRef,
  selectedReadableEntry,
  readableIndexStoreRef,
  readableEntryStoreRef,
  copyStatus,
  onCopy,
  onClearLogs,
}: {
  activeTab: DebugTab;
  visibleAiLines: string[];
  allAiLinesRef: MutableRefObject<string[]>;
  selectedReadableEntry: ReadableRuntimeEntry | null;
  readableIndexStoreRef: MutableRefObject<RuntimeLogIndexEntry[]>;
  readableEntryStoreRef: MutableRefObject<Map<string, ReadableRuntimeEntry>>;
  copyStatus: string;
  onCopy: (label: string, text: string) => void;
  onClearLogs: () => void;
}) {
  const { text } = useUiLanguage();
  if (activeTab !== 'runtime-human' && activeTab !== 'runtime-ai') return null;
  const visibleHumanLines = selectedReadableEntry?.lines ?? ['selected frame=-'];
  const allHumanLinesRef = {
    get current() {
      return formatAllReadableRuntimeEntriesCopy({
        indexStore: readableIndexStoreRef.current,
        entryStore: readableEntryStoreRef.current,
      }).split('\n');
    },
  };
  const stateTransitionLogLines: string[] = [];

  return (
    <div className="copy-toolbar">
      <div className="copy-toolbar-buttons">
        {activeTab === 'runtime-human' ? (
          <>
            <button type="button" onClick={() => onCopy('選択中フレームの人間用ログ', formatReadableRuntimeEntryCopy(selectedReadableEntry))}>
              {text('Copy selected frame', '選択中フレームをコピー')}
            </button>
            <button
              type="button"
              onClick={() => onCopy('全人間用ログ', formatAllReadableRuntimeEntriesCopy({
                indexStore: readableIndexStoreRef.current,
                entryStore: readableEntryStoreRef.current,
              }))}
            >
              {text('Copy all human logs', '全人間用ログをコピー')}
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => onCopy('表示中のAI用ログ', visibleAiLines.join('\n'))}>
              {text('Copy visible AI log', '表示中AIログをコピー')}
            </button>
            <button type="button" onClick={() => onCopy('全AI用ログ', allAiLinesRef.current.join('\n'))}>
              {text('Copy all AI logs', '全AIログをコピー')}
            </button>
          </>
        )}
        <button type="button" className="danger" onClick={onClearLogs}>
          {text('Clear logs', 'ログをクリア')}
        </button>
      </div>
      {copyStatus && <span className="copy-status">{copyStatus}</span>}
    </div>
  );

  return (
    <div className="copy-toolbar">
      <div className="copy-toolbar-buttons">
        {activeTab === 'runtime-human' ? (
          <>
            <button type="button" onClick={() => onCopy('表示中の人間用ログ', formatHumanRuntimeCopyText(visibleHumanLines, stateTransitionLogLines))}>
              表示中ログをコピー
            </button>
            <button type="button" onClick={() => onCopy('全人間用ログ', formatHumanRuntimeCopyText(allHumanLinesRef.current, stateTransitionLogLines))}>
              全ログをコピー
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => onCopy('表示中のAI用ログ', visibleAiLines.join('\n'))}>
              表示中ログをコピー
            </button>
            <button type="button" onClick={() => onCopy('全AI用ログ', allAiLinesRef.current.join('\n'))}>
              全ログをコピー
            </button>
          </>
        )}
      </div>
      {copyStatus && <span className="copy-status">{copyStatus}</span>}
    </div>
  );
}

function formatHumanRuntimeCopyText(historyLines: string[], stateTransitionLogLines: string[]): string {
  return [
    '=== 人間用 実行履歴 ===',
    ...historyLines,
    '',
    '=== StateNo 遷移 ===',
    ...stateTransitionLogLines,
  ].join('\n');
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
  if (activeTab !== 'runtime-human' && activeTab !== 'runtime-ai') return null;

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
  sourceFiles,
  sourceViewHistory,
  selectedSource,
  onOpenSource,
  onSaveSource,
  sourceScrollPositionsRef,
  air,
  sprites,
}: {
  sourceFiles: CharacterSourceFile[];
  sourceViewHistory: readonly SourceViewHistoryEntry[];
  selectedSource: CnsSourceSelection;
  onOpenSource: (selection: CnsSourceSelection) => void;
  onSaveSource: (file: CharacterSourceFile, sourceText: string) => Promise<void>;
  sourceScrollPositionsRef: MutableRefObject<Record<string, number>>;
  air: AirDocument | null;
  sprites: ImageDataSpritePack | null;
}) {
  return (
    <CharacterSourceFilesViewer
      files={sourceFiles}
      history={sourceViewHistory}
      selection={selectedSource}
      onSelect={onOpenSource}
      onSave={onSaveSource}
      scrollPositionsRef={sourceScrollPositionsRef}
      air={air}
      sprites={sprites}
    />
  );
}

function ControlSummaryCard({ config }: { config: InputConfig }) {
  const { text } = useUiLanguage();
  return (
    <section className="input-config-card control-summary-card">
      <h3>{text('Control Summary', '操作一覧')}</h3>
      <div className="control-help-grid">
        <div>
          <h4>{text('Keyboard', 'キーボード')}</h4>
          <p>P1: {formatKeyboardMapping(config.players[0])}</p>
          <p>P2: {formatKeyboardMapping(config.players[1])}</p>
        </div>
        <div>
          <h4>{text('Controller', 'コントローラー')}</h4>
          <p>{text('1st gamepad = P1, 2nd gamepad = P2', '1台目のゲームパッド = P1、2台目 = P2')}</p>
          <p>{text('Move with the D-pad or left stick', '方向パッドまたは左スティックで移動')}</p>
          <p>P1: {formatGamepadMapping(config.players[0])}</p>
          <p>P2: {formatGamepadMapping(config.players[1])}</p>
        </div>
      </div>
    </section>
  );
}

function StateDefListPanel({ rows }: { rows: StateDebugRow[] }) {
  const { text } = useUiLanguage();
  return (
    <section className="debug-block statedef-list">
      <h2>{text('StateDef List', 'StateDef一覧')}</h2>
      <div className="statedef-count">{text('loaded StateDefs', '読み込み済みStateDef')}: {rows.length}</div>
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

export const RuntimeFrameIndexList = memo(function RuntimeFrameIndexList({
  entries,
  selectedKey,
  autoScroll,
  onToggleAutoScroll,
  onSelectFrame,
  showAnimNos,
}: {
  entries: RuntimeLogIndexEntry[];
  selectedKey: string | null;
  autoScroll: boolean;
  onToggleAutoScroll: () => void;
  onSelectFrame: (entry: RuntimeLogIndexEntry) => void;
  showAnimNos: boolean;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const { text } = useUiLanguage();
  const helperColumns = useMemo(() => {
    const latestEntry = entries[entries.length - 1];
    return [...(latestEntry?.helpers ?? [])].sort((left, right) => left.entityId - right.entityId);
  }, [entries]);
  const gridTemplateColumns = createRuntimeFrameIndexGridTemplate(showAnimNos, helperColumns.length);

  useEffect(() => {
    if (!autoScroll) return;
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [autoScroll, entries]);

  return (
    <>
      <label className="runtime-frame-index-controls">
        <input checked={autoScroll} onChange={onToggleAutoScroll} type="checkbox" />
        {text('Automatically follow latest log', '最新ログへ自動追従')}
      </label>
      <div className="runtime-frame-index" ref={listRef}>
        {entries.length > 0 ? (
          <div className="runtime-frame-index-header" style={{ gridTemplateColumns }}>
            <span>時</span>
            <span>f</span>
            <span>P1 State</span>
            {showAnimNos ? <span>P1 Anim</span> : null}
            <span>P2 State</span>
            {showAnimNos ? <span>P2 Anim</span> : null}
            {helperColumns.flatMap((helper) => [
              <span className="runtime-helper-column-header" key={`${helper.entityId}-state`} title={`H${helper.helperId} #${helper.entityId} / P${helper.rootEntityId}`}>
                H{helper.helperId}<small>State</small>
              </span>,
              ...(showAnimNos ? [
                <span className="runtime-helper-column-header" key={`${helper.entityId}-anim`} title={`H${helper.helperId} #${helper.entityId} / P${helper.rootEntityId}`}>
                  H{helper.helperId}<small>Anim</small>
                </span>,
              ] : []),
            ])}
          </div>
        ) : null}
        {entries.length === 0 ? (
          <div className="history-empty">{text('Frames appear here when logs are generated.', 'ログが生成されると、ここにフレーム索引が追加されます。')}</div>
        ) : entries.map((entry) => (
          <div className="runtime-frame-index-entry" key={entry.id}>
            <div
              aria-label={`${entry.timestamp} frame ${entry.frameNo}`}
              className={`runtime-frame-index-row ${entry.key === selectedKey ? 'selected' : ''}`}
              onClick={() => onSelectFrame(entry)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                onSelectFrame(entry);
              }}
              role="button"
              style={{ gridTemplateColumns }}
              tabIndex={0}
            >
              <span>{entry.timestamp}</span>
              <span>{entry.frameNo}</span>
              <span className="runtime-index-state">{entry.p1StateNo}</span>
              {showAnimNos ? <RuntimeAnimationValue animNo={entry.p1AnimNo} /> : null}
              <span className="runtime-index-state secondary">{entry.p2StateNo}</span>
              {showAnimNos ? <RuntimeAnimationValue animNo={entry.p2AnimNo} className="secondary" /> : null}
              {helperColumns.flatMap((column) => {
                const helper = entry.helpers.find((candidate) => candidate.entityId === column.entityId);
                return [
                  <span className={`runtime-index-state helper ${helper ? '' : 'empty'}`} key={`${column.entityId}-state`}>{helper?.stateNo ?? '-'}</span>,
                  ...(showAnimNos ? [
                    helper
                      ? <RuntimeAnimationValue animNo={helper.animNo} className="helper" key={`${column.entityId}-anim`} />
                      : <span className="runtime-index-anim helper empty" key={`${column.entityId}-anim`}>-</span>,
                  ] : []),
                ];
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
});

function RuntimeAnimationValue({
  animNo,
  className = '',
}: {
  animNo: number;
  className?: string;
}) {
  return (
    <span className={`runtime-index-anim ${className}`.trim()}>
      {animNo}
    </span>
  );
}

export function createRuntimeFrameIndexGridTemplate(showAnimNos: boolean, helperCount: number): string {
  const rootColumns = showAnimNos
    ? ['62px', '52px', '58px', '58px', '58px', '58px']
    : ['62px', '52px', '72px', '72px'];
  const helperColumns = Array.from({ length: Math.max(0, helperCount) }, () => showAnimNos ? ['82px', '82px'] : ['82px']).flat();
  return [...rootColumns, ...helperColumns].join(' ');
}

function createSelectedReadableRuntimeHistory(entry: ReadableRuntimeEntry | null): VisibleRuntimeHistory {
  return {
    lines: entry ? [...entry.lines, ...entry.p2Lines] : [],
    mode: 'latest',
    targetFrame: entry?.frameNo ?? null,
    targetFound: Boolean(entry),
    totalEntries: entry ? 1 : 0,
    visibleEntries: entry ? 1 : 0,
    rangeLabel: entry ? `frame=${entry.frameNo} state=${entry.p1StateNo}` : '0/0',
  };
}

function createEmptyVisibleRuntimeHistory(): VisibleRuntimeHistory {
  return {
    lines: [],
    mode: 'latest',
    targetFrame: null,
    targetFound: true,
    totalEntries: 0,
    visibleEntries: 0,
    rangeLabel: '0/0',
  };
}

export function HumanRuntimePanel({
  captureMode,
  indexEntries,
  selectedEntry,
  onSelectFrame,
  autoScrollIndex,
  onToggleAutoScrollIndex,
  onOpenCnsSource,
  onOpenAnimationSource,
  onCaptureModeChange,
}: {
  captureMode: RuntimeSettings['humanLogCaptureMode'];
  indexEntries: RuntimeLogIndexEntry[];
  selectedEntry: ReadableRuntimeEntry | null;
  onSelectFrame: (entry: RuntimeLogIndexEntry) => void;
  autoScrollIndex: boolean;
  onToggleAutoScrollIndex: () => void;
  onOpenCnsSource: (selection: CnsSourceSelection) => void;
  onOpenAnimationSource?: (animNo: number) => void;
  onCaptureModeChange: (mode: RuntimeSettings['humanLogCaptureMode']) => void;
}) {
  const { text } = useUiLanguage();
  const [showAnimNos, setShowAnimNos] = useState(true);
  const [indexWidth, setIndexWidth] = useState(400);
  const [resizingMain, setResizingMain] = useState(false);
  const [activeEntityKey, setActiveEntityKey] = useState('p1');
  const mainGridRef = useRef<HTMLDivElement | null>(null);
  const helperLogs = selectedEntry?.helperLogs ?? [];
  const selectedIndexEntry = indexEntries.find((entry) => entry.key === selectedEntry?.key) ?? null;
  const helperOptions = new Map(helperLogs.map((helper) => [helper.key, { key: helper.key, label: helper.label }]));
  for (const helper of selectedIndexEntry?.helpers ?? []) {
    const key = `helper-${helper.entityId}`;
    if (!helperOptions.has(key)) helperOptions.set(key, { key, label: `H${helper.helperId}` });
  }
  const entityOptions = [
    { key: 'p1', label: 'P1', lines: selectedEntry?.lines ?? [] },
    { key: 'p2', label: 'P2', lines: selectedEntry?.p2Lines ?? [] },
    ...Array.from(helperOptions.values()).map((option) => ({
      ...option,
      lines: helperLogs.find((helper) => helper.key === option.key)?.lines ?? [],
    })),
  ];
  const activeEntity = entityOptions.find((entity) => entity.key === activeEntityKey) ?? entityOptions[0];

  return (
    <section className="runtime-history-panel">
      <div
        className="runtime-human-grid"
        ref={mainGridRef}
        style={{ '--runtime-index-width': `${indexWidth}px` } as CSSProperties}
      >
        <section>
          <h2>{text('Runtime Frame Index', '実行フレーム一覧')}</h2>
          <p className="debug-note">{text('Only frames with retained detail logs are listed. Multiple StateNo values in one frame appear as separate rows.', '詳細ログが残っているフレームだけを表示します。同じフレームに複数のStateNoがある場合は別の行になります。')}</p>
          <label className="runtime-frame-capture-mode">
            {text('Retain logs', 'ログ保持')}
            <select value={captureMode} onChange={(event) => onCaptureModeChange(event.currentTarget.value as RuntimeSettings['humanLogCaptureMode'])}>
              <option value="state-transition">{text('StateNo changed', 'Stateが遷移したとき')}</option>
              <option value="all-frames">{text('Every frame', '全フレーム')}</option>
              <option value="trigger-changes">{text('Trigger ON/OFF changes', 'トリガーのON/OFFに変化があったとき')}</option>
              <option value="controller-activated">{text('State controller activated', 'ステコンが作動したとき')}</option>
            </select>
          </label>
          <label className="runtime-frame-anim-toggle">
            <input checked={showAnimNos} onChange={(event) => setShowAnimNos(event.currentTarget.checked)} type="checkbox" />
            {text('Show animation numbers', 'アニメ番号を表示')}
          </label>
          <RuntimeFrameIndexList
            entries={indexEntries}
            selectedKey={selectedEntry?.key ?? null}
            autoScroll={autoScrollIndex}
            onToggleAutoScroll={onToggleAutoScrollIndex}
            onSelectFrame={onSelectFrame}
            showAnimNos={showAnimNos}
          />
        </section>
        <div
          aria-label={text('Resize runtime frame list and detail log', '実行フレーム一覧と詳細ログの幅を変更')}
          aria-orientation="vertical"
          className={`runtime-splitter ${resizingMain ? 'dragging' : ''}`}
          onPointerDown={(event) => {
            const splitter = event.currentTarget;
            const resize = (clientX: number) => {
              if (!mainGridRef.current) return;
              const bounds = mainGridRef.current.getBoundingClientRect();
              setIndexWidth(Math.max(280, Math.min(clientX - bounds.left, bounds.width - 430)));
            };
            const handleMove = (moveEvent: PointerEvent) => resize(moveEvent.clientX);
            const handleUp = () => {
              document.removeEventListener('pointermove', handleMove);
              document.removeEventListener('pointerup', handleUp);
              setResizingMain(false);
            };
            splitter.setPointerCapture(event.pointerId);
            setResizingMain(true);
            document.addEventListener('pointermove', handleMove);
            document.addEventListener('pointerup', handleUp, { once: true });
          }}
          role="separator"
          tabIndex={0}
        />
        <section className="human-detail-pane">
          <h2>{text('Human Detail Log', '人間向け詳細ログ')}</h2>
          <p className="debug-note">{text('Selecting a row loads only that detail entry. New logs do not replace the current selection.', '行を選ぶと、その詳細だけを表示します。新しいログが現在の選択を置き換えることはありません。')}</p>
          {selectedEntry ? (
            <>
              <div className="history-selected-frame">
                <span>{selectedIndexEntry?.timestamp ?? '--:--:--'}</span>
                <strong>f={selectedEntry.frameNo}</strong>
              </div>
              <div className="human-detail-entity-tabs" aria-label={text('Detail log entities', '詳細ログの表示対象')} role="tablist">
                {entityOptions.map((entity) => (
                  <button
                    aria-controls={`human-detail-${entity.key}`}
                    aria-selected={activeEntity.key === entity.key}
                    className={activeEntity.key === entity.key ? 'active' : ''}
                    key={entity.key}
                    onClick={() => setActiveEntityKey(entity.key)}
                    role="tab"
                    type="button"
                  >
                    {entity.label}
                  </button>
                ))}
              </div>
              <section
                aria-label={`${activeEntity.label} detail log`}
                className="human-detail-player"
                id={`human-detail-${activeEntity.key}`}
                role="tabpanel"
              >
                {activeEntity.lines.length > 0 ? (
                  <ReadableRuntimeHistoryMarkup
                    lines={activeEntity.lines.filter((line) => !line.trim().startsWith('----'))}
                    onOpenAnimationSource={onOpenAnimationSource}
                    onOpenCnsSource={onOpenCnsSource}
                  />
                ) : (
                  <div className="history-empty">{text('No retained detail is available for this entity in the selected frame.', '選択中フレームには、この対象の詳細ログがありません。')}</div>
                )}
              </section>
            </>
          ) : (
            <div className="history-empty">{text('Select a frame on the left.', '左側でフレームを選択してください。')}</div>
          )}
        </section>
      </div>
    </section>
  );
}

function AiRuntimePanel({
  visibleRuntimeHistory,
  historyWindow,
  onShowLatest,
}: {
  visibleRuntimeHistory: VisibleRuntimeHistory;
  historyWindow: RuntimeHistoryWindow;
  onShowLatest: () => void;
}) {
  const { text } = useUiLanguage();
  return (
    <section className="runtime-history-panel">
      <h2>{text('AI Detail Log', 'AI向け詳細ログ')}</h2>
      <p className="debug-note">
        {text('Stores input, command, state, controller, physics, and result details for analysis. Time-only changes are omitted.', '入力、コマンド、ステート、コントローラー、物理、成立情報を解析用に蓄積します。時間だけの変化は省略します。')}
      </p>
      <HistoryWindowStatus visible={visibleRuntimeHistory} window={historyWindow} onShowLatest={onShowLatest} />
      <pre className="debug-pre history-pre codex-history-pre">{visibleRuntimeHistory.lines.join('\n')}</pre>
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
  onOpenAnimationSource,
}: {
  lines: string[];
  onOpenCnsSource: (selection: CnsSourceSelection) => void;
  onOpenAnimationSource?: (animNo: number) => void;
}) {
  const stateDefSelection = parseStateDefSourceSelection(lines);
  const compactMetaLine = lines.find((line) => /^(?:P1|P2|H\d+(?: #\d+)?) StateNo=/.test(line.trim()));
  const compactMeta = compactMetaLine ? parseReadableRuntimeMeta(compactMetaLine.trim()) : null;
  const hasStateDefBlock = lines.some((line) => line.trim().startsWith('StateDef '));
  const rendered: ReactNode[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (hasStateDefBlock && line === compactMetaLine) continue;
    if (line.trim().startsWith('keys=')) continue;
    if (line.trim().startsWith('StateDef ')) {
      const parameterLines: string[] = [];
      while (index + 1 < lines.length && /^STATEDEF_PARAM\s+`/.test(lines[index + 1].trim())) {
        parameterLines.push(lines[index + 1]);
        index += 1;
      }
      rendered.push(<ReadableStateDefBlock compactMeta={compactMeta} key={`${index}-${line}`} line={line.trim()} onOpenAnimationSource={onOpenAnimationSource} onOpenCnsSource={onOpenCnsSource} parameterLines={parameterLines} />);
      continue;
    }
    if (/^\s*\*\*.+\*\*\s+\|\s+/.test(line)) {
      const triggerLines: string[] = [];
      const parameterLines: string[] = [];
      while (index + 1 < lines.length && /^\s*(?:(?:OK|NG)\s+`|PARAM\s+`)/.test(lines[index + 1])) {
        if (/^\s*PARAM\s+`/.test(lines[index + 1])) parameterLines.push(lines[index + 1]);
        else triggerLines.push(lines[index + 1]);
        index += 1;
      }
      rendered.push(<ReadableControllerBlock headerLine={line} key={`${index}-${line}`} onOpenAnimationSource={onOpenAnimationSource} onOpenCnsSource={onOpenCnsSource} parameterLines={parameterLines} triggerLines={triggerLines} />);
      continue;
    }
    rendered.push(
      <ReadableRuntimeHistoryLine
        key={`${index}-${line}`}
        line={line}
        onOpenAnimationSource={onOpenAnimationSource}
        onOpenCnsSource={onOpenCnsSource}
        stateDefSelection={stateDefSelection}
      />,
    );
  }
  return (
    <div className="history-pre readable-history-view">
      {rendered}
    </div>
  );
}

function parseReadableRuntimeMeta(line: string): { animNo: number; time: number } | null {
  const match = line.match(/^(?:P[12]|H\d+(?: #\d+)?) StateNo=-?\d+\s+Anim(?:No)?=(-?\d+)\s+Time=(-?\d+)/);
  return match ? { animNo: Number(match[1]), time: Number(match[2]) } : null;
}

function ReadableControllerBlock({
  headerLine,
  onOpenAnimationSource,
  onOpenCnsSource,
  parameterLines,
  triggerLines,
}: {
  headerLine: string;
  onOpenAnimationSource?: (animNo: number) => void;
  onOpenCnsSource: (selection: CnsSourceSelection) => void;
  parameterLines: string[];
  triggerLines: string[];
}) {
  const [triggersExpanded, setTriggersExpanded] = useState(false);
  const [parametersExpanded, setParametersExpanded] = useState(false);
  const valueParameter = parseControllerValueText(headerLine);
  const allParameterLines = [
    ...(valueParameter ? [`PARAM \`${valueParameter.replace(/^value:\s*/, 'value = ').replace(/\s+=>\s+/, ' || evaluated: ')}\``] : []),
    ...parameterLines,
  ];
  return (
    <div className="readable-controller-block">
      <ReadableRuntimeHistoryLine line={headerLine} onOpenAnimationSource={onOpenAnimationSource} onOpenCnsSource={onOpenCnsSource} stateDefSelection={null} />
      {triggerLines.length > 0 ? (
        <button
          aria-expanded={triggersExpanded}
          className="readable-controller-disclosure"
          onClick={() => setTriggersExpanded((value) => !value)}
          type="button"
        >
          {triggersExpanded ? '▲' : '▼'} triggers ({triggerLines.length})
        </button>
      ) : null}
      {allParameterLines.length > 0 ? (
        <button
          aria-expanded={parametersExpanded}
          className="readable-controller-disclosure"
          onClick={() => setParametersExpanded((value) => !value)}
          type="button"
        >
          {parametersExpanded ? '▲' : '▼'} parameters ({allParameterLines.length})
        </button>
      ) : null}
      {triggersExpanded ? triggerLines.map((line, index) => (
        <ReadableRuntimeHistoryLine key={`${index}-${line}`} line={line} onOpenAnimationSource={onOpenAnimationSource} onOpenCnsSource={onOpenCnsSource} stateDefSelection={null} />
      )) : null}
      {parametersExpanded ? allParameterLines.map((line, index) => (
        <ReadableRuntimeHistoryLine key={`${index}-${line}`} line={line} onOpenAnimationSource={onOpenAnimationSource} onOpenCnsSource={onOpenCnsSource} stateDefSelection={null} />
      )) : null}
    </div>
  );
}

function HistoryWindowStatus({
  visible,
  window,
  onShowLatest,
}: {
  visible: VisibleRuntimeHistory;
  window: RuntimeHistoryWindow;
  onShowLatest: () => void;
}) {
  const { text } = useUiLanguage();
  const modeLabel = window.mode === 'latest'
    ? text('latest', '最新')
    : text(`around frame ${window.targetFrame}`, `フレーム ${window.targetFrame} 周辺`);
  const targetStatus = window.mode === 'aroundFrame' && !visible.targetFound
    ? text(' / target frame is outside the retained range', ' / 対象フレームは保持範囲外です')
    : '';

  return (
    <div className="history-window-status">
      <span>{text('View', '表示')}: {modeLabel}</span>
      <span>{text('Range', '範囲')}: {visible.rangeLabel}</span>
      <span>{text('Entries', '件数')}: {visible.visibleEntries}/{visible.totalEntries}{targetStatus}</span>
      {window.mode !== 'latest' ? (
        <button type="button" onClick={onShowLatest}>{text('Return to latest', '最新へ戻る')}</button>
      ) : null}
    </div>
  );
}

function ReadableRuntimeHistoryLine({
  line,
  onOpenAnimationSource,
  onOpenCnsSource,
  stateDefSelection,
}: {
  line: string;
  onOpenAnimationSource?: (animNo: number) => void;
  onOpenCnsSource: (selection: CnsSourceSelection) => void;
  stateDefSelection: CnsSourceSelection;
}) {
  const trimmed = line.trim();
  if (!trimmed) return <div className="readable-history-spacer" aria-hidden="true" />;

  const controllerMatch = trimmed.match(/^\*\*(.+)\*\*\s+\|\s+(.+)$/);
  if (controllerMatch) {
    const passed = controllerMatch[2].includes('ACTIVE') && !controllerMatch[2].includes('INACTIVE');
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
        <span>{passed ? '作動' : '非作動'}</span>
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

  const parameterMatch = trimmed.match(/^PARAM\s+`(.+)`$/);
  if (parameterMatch) {
    const [expressionText, evaluatedText] = parameterMatch[1].split(' || evaluated: ', 2);
    return (
      <div className="readable-history-parameter">
        <code>{expressionText}</code>
        {evaluatedText ? <span className="readable-history-values">evaluated: {evaluatedText}</span> : null}
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
  if (/^(?:P1|P2|H\d+(?: #\d+)?) StateNo=/.test(trimmed)) return <ReadableRuntimeHistoryMeta line={trimmed} onOpenAnimationSource={onOpenAnimationSource} onOpenCnsSource={onOpenCnsSource} source={stateDefSelection} />;
  if (trimmed.startsWith('StateDef ')) return <ReadableStateDefLink line={trimmed} onOpenCnsSource={onOpenCnsSource} />;
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

export function parseControllerValueText(text: string): string {
  const match = text.match(/\|\s+value raw=`(.+?)` evaluated=(\S+)/);
  return match ? `value: ${match[1]} => ${match[2]}` : '';
}

function parseControllerSourceRef(text: string): Exclude<CnsSourceSelection, null> | null {
  const match = text.match(/\s@\s*(.+):(\d+)\s*$/);
  if (!match) return null;
  return { path: match[1], line: Number(match[2]) };
}

function ReadableRuntimeHistoryMeta({
  line,
  onOpenAnimationSource,
  onOpenCnsSource,
  source,
}: {
  line: string;
  onOpenAnimationSource?: (animNo: number) => void;
  onOpenCnsSource: (selection: CnsSourceSelection) => void;
  source: CnsSourceSelection;
}) {
  const match = line.match(/^((?:P[12]|H\d+(?: #\d+)?)) StateNo=(-?\d+)\s+Anim(?:No)?=(-?\d+)\s+Time=(-?\d+)(.*)$/);
  if (!match) return <div className="readable-history-meta">{line}</div>;
  return (
    <div className="readable-history-meta">
      <span>{match[1]} </span>
      <button className="readable-state-badge" disabled={!source} onClick={() => source && onOpenCnsSource(source)} type="button">StateNo={match[2]}</button>
      <button
        className="readable-history-anim readable-history-anim-link"
        disabled={!onOpenAnimationSource}
        onClick={() => onOpenAnimationSource?.(Number(match[3]))}
        title={`Open Begin Action ${match[3]}`}
        type="button"
      >
        Anim={match[3]}
      </button>
      <span> Time={match[4]}{match[5]}</span>
    </div>
  );
}

function parseStateDefSourceSelection(lines: readonly string[]): CnsSourceSelection {
  for (const line of lines) {
    const match = line.trim().match(/^StateDef\s+-?\d+\s+@\s+(.+):(\d+)$/);
    if (match) return { path: match[1], line: Number(match[2]) };
  }
  return null;
}

function ReadableStateDefBlock({
  compactMeta,
  line,
  onOpenAnimationSource,
  onOpenCnsSource,
  parameterLines,
}: {
  compactMeta: { animNo: number; time: number } | null;
  line: string;
  onOpenAnimationSource?: (animNo: number) => void;
  onOpenCnsSource: (selection: CnsSourceSelection) => void;
  parameterLines: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const match = line.match(/^StateDef\s+(-?\d+)(?:\s+@\s+(.+):(\d+))?$/);
  if (!match) return <div className="readable-history-statedef">{line}</div>;
  const selection = match[2] && match[3] ? { path: match[2], line: Number(match[3]) } : null;
  return (
    <div className="readable-statedef-block">
      <div className={`readable-history-statedef ${compactMeta ? 'readable-statedef-heading' : ''}`}>
        <button disabled={!selection} onClick={() => selection && onOpenCnsSource(selection)} type="button">StateDef {match[1]}</button>
        {compactMeta ? <span className="readable-statedef-time">Time={compactMeta.time}</span> : null}
        {compactMeta ? <span className="readable-statedef-rule" aria-hidden="true" /> : null}
        {!compactMeta && parameterLines.length > 0 ? (
          <button
            aria-expanded={expanded}
            className="readable-statedef-disclosure"
            onClick={() => setExpanded((value) => !value)}
            type="button"
          >
            {expanded ? '▲' : '▼'} parameters ({parameterLines.length})
          </button>
        ) : null}
      </div>
      {compactMeta ? (
        <div className="readable-statedef-actions">
          <button
            className="readable-history-anim readable-history-anim-link"
            disabled={!onOpenAnimationSource}
            onClick={() => onOpenAnimationSource?.(compactMeta.animNo)}
            title={`Open Begin Action ${compactMeta.animNo}`}
            type="button"
          >
            Anim={compactMeta.animNo}
          </button>
          {parameterLines.length > 0 ? (
            <button
              aria-expanded={expanded}
              className="readable-statedef-disclosure"
              onClick={() => setExpanded((value) => !value)}
              type="button"
            >
              {expanded ? '▲' : '▼'} parameters ({parameterLines.length})
            </button>
          ) : null}
        </div>
      ) : null}
      {expanded ? (
        <div className="readable-statedef-parameters">
          {parameterLines.map((parameterLine, index) => (
            <div key={`${index}-${parameterLine}`}>{parameterLine.trim().replace(/^STATEDEF_PARAM\s+`|`$/g, '')}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ReadableStateDefLink({
  line,
  onOpenCnsSource,
}: {
  line: string;
  onOpenCnsSource: (selection: CnsSourceSelection) => void;
}) {
  const match = line.match(/^StateDef\s+(-?\d+)(?:\s+@\s+(.+):(\d+))?$/);
  if (!match?.[2] || !match[3]) return <div className="readable-history-statedef">{line}</div>;
  const selection = { path: match[2], line: Number(match[3]) };
  return (
    <div className="readable-history-statedef">
      <button type="button" onClick={() => onOpenCnsSource(selection)}>
        StateDef {match[1]}
      </button>
      <span>{selection.path}:{selection.line}</span>
    </div>
  );
}

function StateTransitionLogMarkup({ lines, onJumpFrame }: { lines: string[]; onJumpFrame?: (frameNo: number) => void }) {
  return (
    <div className="debug-pre history-pre state-transition-pre">
      {lines.map((line, index) => {
        const frameMatch = line.match(/\bf=(\d+)\b/);
        if (!frameMatch || frameMatch.index === undefined) return <div key={`${index}-${line}`}>{line}</div>;
        const frameNo = Number(frameMatch[1]);
        return (
          <div className="state-transition-line" key={`${index}-${line}`}>
            <span>{line.slice(0, frameMatch.index)}</span>
            <button type="button" onClick={() => (onJumpFrame ? onJumpFrame(frameNo) : scrollToRuntimeFrame(frameNo))}>{frameMatch[0]}</button>
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

export function CharacterSourceFilesViewer({
  files,
  history = [],
  selection,
  onSelect,
  onSave,
  scrollPositionsRef,
  air,
  sprites,
}: {
  files: CharacterSourceFile[];
  history?: readonly SourceViewHistoryEntry[];
  selection: CnsSourceSelection;
  onSelect: (selection: CnsSourceSelection) => void;
  onSave?: (file: CharacterSourceFile, sourceText: string) => Promise<void>;
  scrollPositionsRef?: MutableRefObject<Record<string, number>>;
  air?: AirDocument | null;
  sprites?: ImageDataSpritePack | null;
}) {
  const { text } = useUiLanguage();
  const localScrollPositionsRef = useRef<Record<string, number>>({});
  const effectiveScrollPositionsRef = scrollPositionsRef ?? localScrollPositionsRef;
  const codeRef = useRef<HTMLDivElement | null>(null);
  const detailRef = useRef<HTMLDivElement | null>(null);
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const editorHighlightRef = useRef<HTMLPreElement | null>(null);
  const resizingRef = useRef(false);
  const historyResizingRef = useRef(false);
  const rowResizingRef = useRef<'file-list' | 'detail' | null>(null);
  const [selectedAirActionNo, setSelectedAirActionNo] = useState<number | null>(null);
  const [summaryWidth, setSummaryWidth] = useState(300);
  const [fileListHeight, setFileListHeight] = useState(() => calculateCharacterFileListHeight(files));
  const [detailHeight, setDetailHeight] = useState(560);
  const [historyHeight, setHistoryHeight] = useState(140);
  const [syntaxTheme, setSyntaxTheme] = useState<CharacterSyntaxTheme>('vscode-dark-2026');
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<{ path: string; state: 'saving' | 'saved' | 'error'; message: string } | null>(null);
  const [selectedSffSpriteKey, setSelectedSffSpriteKey] = useState<SpriteKey | null>(null);
  const [selectedSndSampleKey, setSelectedSndSampleKey] = useState<string | null>(null);
  const [sffZoom, setSffZoom] = useState(1);
  const [sffPan, setSffPan] = useState({ x: 0, y: 0 });
  const fallbackSelection = files[0] ? { path: files[0].path, line: 1 } : null;
  const effectiveSelection = selection && files.some((file) => file.path === selection.path) ? selection : fallbackSelection;
  const selectedFile = effectiveSelection ? files.find((file) => file.path === effectiveSelection.path) : null;
  const selectedLineId = effectiveSelection ? cnsSourceLineId(effectiveSelection.path, effectiveSelection.line) : null;
  const selectedPath = selectedFile?.path ?? '';
  const selectedLine = effectiveSelection?.line ?? 1;
  const sourceOutline = useMemo(
    () => selectedFile ? createSourceOutline(selectedFile) : [],
    [selectedFile],
  );
  const airActions = selectedFile?.kind === 'air' ? sourceOutline.filter((item) => item.kind === 'air-action') : [];
  const effectiveAirActionNo = selectedFile?.kind === 'air'
    ? selectedAirActionNo ?? (airActions[0] ? Number(airActions[0].value) : null)
    : null;
  const selectedDraft = selectedFile ? drafts[selectedFile.path] ?? selectedFile.text : '';
  const isEditing = selectedFile?.path === editingPath;
  const isDirty = selectedFile ? selectedDraft !== selectedFile.text : false;
  const sourceNavigationTargets = useMemo(
    () => selectedFile ? createSourceNavigationTargets(selectedFile, files) : new Map<number, SourceNavigationTarget>(),
    [files, selectedFile],
  );
  const selectedSff = useMemo(() => resolveSffPreview(selectedFile, sprites ?? null), [selectedFile, sprites]);
  const sffEntries = useMemo(() => sortSffSpriteEntries(selectedSff.pack), [selectedSff.pack]);
  const effectiveSffSpriteKey = selectedSffSpriteKey && selectedSff.pack?.sprites.has(selectedSffSpriteKey)
    ? selectedSffSpriteKey
    : sffEntries[0]?.[0] ?? null;
  const selectedSnd = useMemo(() => resolveSndPreview(selectedFile), [selectedFile]);
  const effectiveSndSampleKey = selectedSndSampleKey && selectedSnd.document?.samplesByKey.has(selectedSndSampleKey)
    ? selectedSndSampleKey
    : selectedSnd.document?.samples[0]
      ? sndSampleKey(selectedSnd.document.samples[0].group, selectedSnd.document.samples[0].index)
      : null;

  const fileInventorySignature = files.map((file) => `${file.external ? 'e' : 'i'}:${file.path}`).join('|');
  const previousFileInventorySignatureRef = useRef(fileInventorySignature);
  useEffect(() => {
    if (previousFileInventorySignatureRef.current === fileInventorySignature) return;
    previousFileInventorySignatureRef.current = fileInventorySignature;
    setFileListHeight(calculateCharacterFileListHeight(files));
  }, [fileInventorySignature, files]);

  useEffect(() => {
    const codeElement = codeRef.current;
    if (!codeElement || !effectiveSelection) return;
    const frameId = requestAnimationFrame(() => {
      if (selectedLine > 1 && selectedLineId) {
        document.getElementById(selectedLineId)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
      }
      codeElement.scrollTop = effectiveScrollPositionsRef.current[selectedPath] ?? 0;
    });
    return () => cancelAnimationFrame(frameId);
  }, [effectiveScrollPositionsRef, selectedLine, selectedLineId, selectedPath]);

  useEffect(() => {
    if (selectedFile?.kind !== 'air') {
      setSelectedAirActionNo(null);
      return;
    }
    const currentAction = findAirActionForLine(sourceOutline, selectedLine);
    if (currentAction !== null) setSelectedAirActionNo(currentAction);
    else if (selectedAirActionNo === null && airActions[0]) setSelectedAirActionNo(Number(airActions[0].value));
  }, [airActions, selectedAirActionNo, selectedFile?.kind, selectedLine, sourceOutline]);

  const handleCodeScroll = () => {
    if (!selectedPath || !codeRef.current) return;
    effectiveScrollPositionsRef.current[selectedPath] = codeRef.current.scrollTop;
  };

  const handleOutlineClick = (item: SourceOutlineItem) => {
    if (!selectedFile) return;
    if (item.kind === 'air-action') setSelectedAirActionNo(Number(item.value));
    onSelect({ path: selectedFile.path, line: item.line });
  };

  const handleResizePointerMove = (clientX: number) => {
    if (!resizingRef.current || !detailRef.current) return;
    const bounds = detailRef.current.getBoundingClientRect();
    setSummaryWidth(Math.max(160, Math.min(bounds.width - 320, clientX - bounds.left)));
  };

  const handleHistoryResizePointerMove = (clientY: number) => {
    if (!historyResizingRef.current || !summaryRef.current) return;
    const bounds = summaryRef.current.getBoundingClientRect();
    const maximum = Math.max(70, bounds.height - 120);
    setHistoryHeight(Math.max(70, Math.min(maximum, bounds.bottom - clientY)));
  };

  const handleSave = async () => {
    if (!selectedFile || !selectedFile.editable || !isEditing || !onSave) return;
    setSaveStatus({ path: selectedFile.path, state: 'saving', message: text('Saving…', '保存中…') });
    try {
      await onSave(selectedFile, selectedDraft);
      setSaveStatus({ path: selectedFile.path, state: 'saved', message: text('Saved', '保存しました') });
      setEditingPath(null);
    } catch (error) {
      setSaveStatus({
        path: selectedFile.path,
        state: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const discardEdit = () => {
    if (!selectedFile || !isEditing) return;
    if (isDirty && !window.confirm(text('Discard the unsaved changes?', '未保存の変更を破棄しますか？'))) return;
    setDrafts((current) => ({ ...current, [selectedFile.path]: selectedFile.text }));
    setEditingPath(null);
    setSaveStatus(null);
  };

  const selectFile = (path: string) => {
    if (isEditing && isDirty && selectedFile && path !== selectedFile.path) {
      if (!window.confirm(text('Discard the unsaved changes and open another file?', '未保存の変更を破棄して別のファイルを開きますか？'))) return;
      setDrafts((current) => ({ ...current, [selectedFile.path]: selectedFile.text }));
      setEditingPath(null);
    }
    setSelectedSffSpriteKey(null);
    setSelectedSndSampleKey(null);
    onSelect({ path, line: 1 });
  };

  if (files.length === 0) {
    return (
      <section className="cns-source-viewer character-source-viewer">
        <h2>{text('Character Files', 'キャラクターファイル')}</h2>
        <p className="debug-note">{text('No text source files are loaded.', 'テキスト形式のソースファイルは読み込まれていません。')}</p>
      </section>
    );
  }

  if (!selectedFile) {
    return (
      <section className="cns-source-viewer character-source-viewer">
        <h2>{text('Character Files', 'キャラクターファイル')}</h2>
        <p className="debug-note">{text('Source not found', 'ソースが見つかりません')}: {effectiveSelection?.path}:{effectiveSelection?.line}</p>
      </section>
    );
  }

  const lines = selectedFile.text.split(/\r?\n/);
  return (
    <section className={`cns-source-viewer character-source-viewer syntax-theme-${syntaxTheme}`}>
      <h2>{text('Character Files', 'キャラクターファイル')}</h2>
      <div className="character-source-layout">
        <div className="character-source-file-list" aria-label="loaded character files" style={{ height: `${fileListHeight}px` }}>
          {files.map((file, index) => (
            <div className="character-source-file-entry" key={file.path}>
            {index === 0 || files[index - 1]?.external !== file.external ? (
              <div className="character-source-file-group-heading">{file.external ? 'エンジン' : 'キャラ'}</div>
            ) : null}
            <button
              className={`${file.path === selectedFile.path ? 'active' : ''} kind-${file.path.toLowerCase().split('.').pop() ?? 'binary'}`.trim()}
              onClick={() => selectFile(file.path)}
              title={`${file.path}${file.external ? ` (${text('outside character folder', 'キャラクターフォルダ外')})` : ''}`}
              type="button"
            >
              <span className="character-source-kind">{formatSourceKind(file)}</span>
              <span>{file.label}</span>
              {file.external ? <small>{text('external', '外部')}</small> : null}
            </button>
            </div>
          ))}
        </div>
        <div
          aria-label={text('Resize file list height', 'ファイル一覧の高さを変更')}
          aria-orientation="horizontal"
          aria-valuemax={1600}
          aria-valuemin={68}
          aria-valuenow={fileListHeight}
          className="character-source-row-resizer"
          onKeyDown={(event) => {
            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
            event.preventDefault();
            setFileListHeight((height) => Math.max(68, Math.min(1600, height + (event.key === 'ArrowUp' ? -24 : 24))));
          }}
          onPointerDown={(event) => {
            rowResizingRef.current = 'file-list';
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (rowResizingRef.current !== 'file-list') return;
            const list = event.currentTarget.previousElementSibling?.getBoundingClientRect();
            if (list) setFileListHeight(Math.max(68, Math.min(1600, event.clientY - list.top)));
          }}
          onPointerUp={(event) => {
            rowResizingRef.current = null;
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          role="separator"
          tabIndex={0}
        />
        <div
          className="character-source-detail"
          ref={detailRef}
          style={{ '--character-summary-width': `${summaryWidth}px`, height: `${detailHeight}px` } as CSSProperties}
        >
          <div className="character-source-summary" ref={summaryRef}>
            <h3>{text('Map', 'マップ')}</h3>
            {selectedFile.kind === 'sff' ? (
              <SffSpriteMap
                entries={sffEntries}
                error={selectedSff.error}
                onSelect={setSelectedSffSpriteKey}
                paletteCount={selectedSff.pack?.palettes?.size ?? 0}
                selectedKey={effectiveSffSpriteKey}
                spriteCount={sffEntries.length}
              />
            ) : selectedFile.kind === 'snd' ? (
              <SndSampleMap
                document={selectedSnd.document}
                error={selectedSnd.error}
                onSelect={setSelectedSndSampleKey}
                selectedKey={effectiveSndSampleKey}
              />
            ) : (
              <SourceOutlineMap
                items={sourceOutline}
                key={selectedFile.path}
                onSelect={handleOutlineClick}
                selectedAirActionNo={effectiveAirActionNo}
                selectedLine={selectedLine}
              />
            )}
            {selectedFile.kind === 'air' ? (
              <AirAnimationPreview
                actionNo={effectiveAirActionNo}
                air={air ?? null}
                sprites={sprites ?? null}
              />
            ) : null}
            <div
              aria-label={text('Resize Map and View History', 'マップと閲覧履歴の高さを変更')}
              aria-orientation="horizontal"
              aria-valuemax={Math.max(70, detailHeight - 120)}
              aria-valuemin={70}
              aria-valuenow={Math.round(historyHeight)}
              className="source-view-history-resizer"
              onKeyDown={(event) => {
                if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
                event.preventDefault();
                const maximum = Math.max(70, detailHeight - 120);
                setHistoryHeight((height) => Math.max(70, Math.min(maximum, height + (event.key === 'ArrowUp' ? 20 : -20))));
              }}
              onPointerDown={(event) => {
                historyResizingRef.current = true;
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => handleHistoryResizePointerMove(event.clientY)}
              onPointerUp={(event) => {
                historyResizingRef.current = false;
                event.currentTarget.releasePointerCapture(event.pointerId);
              }}
              role="separator"
              tabIndex={0}
            />
            <SourceViewHistory entries={history} height={historyHeight} onSelect={onSelect} selected={effectiveSelection} />
          </div>
          <div
            aria-label={text('Resize summary and file view', '概要とファイル表示の幅を変更')}
            aria-orientation="vertical"
            aria-valuemax={900}
            aria-valuemin={160}
            aria-valuenow={Math.round(summaryWidth)}
            className="character-source-resizer"
            onKeyDown={(event) => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
              event.preventDefault();
              setSummaryWidth((width) => Math.max(160, width + (event.key === 'ArrowLeft' ? -24 : 24)));
            }}
            onPointerDown={(event) => {
              resizingRef.current = true;
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => handleResizePointerMove(event.clientX)}
            onPointerUp={(event) => {
              resizingRef.current = false;
              event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            role="separator"
            tabIndex={0}
          />
          <div className="character-source-content">
          <div className="cns-source-title">
            <div>
              <strong>{selectedFile.label}</strong>
              <span>{selectedFile.path}:{effectiveSelection?.line ?? 1}</span>
            </div>
            {selectedFile.editable ? (
              <label className="character-syntax-theme-select">
                {text('Highlight', 'ハイライト')}
                <select value={syntaxTheme} onChange={(event) => setSyntaxTheme(event.currentTarget.value as CharacterSyntaxTheme)}>
                  <option value="vscode-dark-2026">VS Code Dark 2026</option>
                  <option value="mps-classic">MPS Classic</option>
                  <option value="monochrome">Monochrome</option>
                </select>
              </label>
            ) : null}
            {onSave ? <div className="character-source-edit-actions">
              <button
                disabled={!selectedFile.editable}
                onClick={() => {
                  setDrafts((current) => ({ ...current, [selectedFile.path]: current[selectedFile.path] ?? selectedFile.text }));
                  setEditingPath(selectedFile.path);
                  setSaveStatus(null);
                }}
                type="button"
              >
                {text('Edit', '編集')}
              </button>
              {isEditing ? (
                <button className="secondary" onClick={discardEdit} type="button">
                  {text('Cancel Edit', '編集解除')}
                </button>
              ) : null}
              <button
                disabled={!isEditing || !isDirty || saveStatus?.state === 'saving'}
                onClick={() => void handleSave()}
                type="button"
              >
                {text('Save', '保存')}
              </button>
            </div> : null}
          </div>
          {saveStatus?.path === selectedFile.path ? (
            <div className={`character-source-save-status ${saveStatus.state}`}>{saveStatus.message}</div>
          ) : null}
          {selectedFile.editable ? (
            <TextSourceSearch
              key={selectedFile.path}
              onSelectLine={(line) => onSelect({ path: selectedFile.path, line })}
              selectedLine={selectedLine}
              source={selectedDraft}
            />
          ) : null}
          {selectedFile.kind === 'sff' ? (
            <SffSpriteViewer
              error={selectedSff.error}
              onPanChange={setSffPan}
              onZoomChange={setSffZoom}
              pack={selectedSff.pack}
              pan={sffPan}
              selectedKey={effectiveSffSpriteKey}
              zoom={sffZoom}
            />
          ) : selectedFile.kind === 'act' ? (
            <ActPaletteViewer file={selectedFile} sprites={sprites ?? null} />
          ) : selectedFile.kind === 'snd' ? (
            <SndSampleViewer document={selectedSnd.document} error={selectedSnd.error} selectedKey={effectiveSndSampleKey} />
          ) : selectedFile.editable ? isEditing ? (
            <div className="character-source-editor-shell">
              <pre aria-hidden="true" className="character-source-editor-highlight" ref={editorHighlightRef}>
                <CharacterSourceEditorLines kind={selectedFile.kind} path={selectedFile.path} source={selectedDraft} />
              </pre>
              <textarea
                aria-label={text('Character file editor', 'キャラクターファイル編集')}
                className="character-source-editor"
                onChange={(event) => setDrafts((current) => ({ ...current, [selectedFile.path]: event.currentTarget.value }))}
                onScroll={(event) => {
                  if (!editorHighlightRef.current) return;
                  editorHighlightRef.current.scrollTop = event.currentTarget.scrollTop;
                  editorHighlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
                }}
                spellCheck={false}
                value={selectedDraft}
              />
            </div>
          ) : (
            <div className="cns-source-code" ref={codeRef} onScroll={handleCodeScroll}>
              {lines.map((line, index) => {
                const lineNo = index + 1;
                const selected = lineNo === effectiveSelection?.line;
                return (
                  <div
                    className={`cns-source-line ${selected ? 'selected' : ''}`}
                    id={cnsSourceLineId(selectedFile.path, lineNo)}
                    key={`${selectedFile.path}-${lineNo}`}
                  >
                    <button
                      aria-label={`${text('Highlight line', '行を強調')} ${lineNo}`}
                      className="cns-source-line-no"
                      onClick={() => onSelect({ path: selectedFile.path, line: lineNo })}
                      title={`${text('Highlight line', '行を強調')} ${lineNo}`}
                      type="button"
                    >
                      {lineNo}
                    </button>
                    <code>
                      <HighlightedSourceText
                        kind={selectedFile.kind}
                        line={line}
                        navigationTarget={sourceNavigationTargets.get(lineNo)}
                        onNavigate={onSelect}
                      />
                    </code>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="character-source-binary-empty">
              {text('Binary preview is not available for this file type.', 'この形式のバイナリプレビューには対応していません。')}
            </div>
          )}
          </div>
        </div>
        <div
          aria-label={text('Resize file viewer height', 'ファイル表示の高さを変更')}
          aria-orientation="horizontal"
          aria-valuemax={1200}
          aria-valuemin={280}
          aria-valuenow={detailHeight}
          className="character-source-row-resizer bottom"
          onKeyDown={(event) => {
            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
            event.preventDefault();
            setDetailHeight((height) => Math.max(280, Math.min(1200, height + (event.key === 'ArrowUp' ? -32 : 32))));
          }}
          onPointerDown={(event) => {
            rowResizingRef.current = 'detail';
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (rowResizingRef.current !== 'detail' || !detailRef.current) return;
            setDetailHeight(Math.max(280, Math.min(1200, event.clientY - detailRef.current.getBoundingClientRect().top)));
          }}
          onPointerUp={(event) => {
            rowResizingRef.current = null;
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          role="separator"
          tabIndex={0}
        />
      </div>
    </section>
  );
}

type SourceNavigationTarget = {
  end: number;
  kind: 'animation' | 'state';
  selection: Exclude<CnsSourceSelection, null>;
  start: number;
  value: number;
};

function HighlightedSourceTokens({ line, kind }: { line: string; kind: CharacterSourceFile['kind'] }) {
  return <>{tokenizeCharacterSourceLine(line, kind).map((token, index) => (
    <span className={`source-syntax-${token.scope}`} key={`${index}-${token.scope}`}>{token.text}</span>
  ))}</>;
}

function HighlightedSourceText({
  line,
  kind,
  navigationTarget,
  onNavigate,
}: {
  line: string;
  kind: CharacterSourceFile['kind'];
  navigationTarget?: SourceNavigationTarget;
  onNavigate?: (selection: CnsSourceSelection) => void;
}) {
  if (!navigationTarget || !onNavigate) return <HighlightedSourceTokens kind={kind} line={line} />;
  const linkedText = line.slice(navigationTarget.start, navigationTarget.end);
  const label = navigationTarget.kind === 'animation'
    ? `Open Begin Action ${navigationTarget.value}`
    : `Open StateDef ${navigationTarget.value}`;
  return <>
    <HighlightedSourceTokens kind={kind} line={line.slice(0, navigationTarget.start)} />
    <button
      className={`character-source-navigation-link ${navigationTarget.kind}`}
      onClick={() => onNavigate(navigationTarget.selection)}
      title={label}
      type="button"
    >
      <HighlightedSourceTokens kind={kind} line={linkedText} />
    </button>
    <HighlightedSourceTokens kind={kind} line={line.slice(navigationTarget.end)} />
  </>;
}

export function CharacterSourceEditorLines({
  kind,
  path,
  source,
}: {
  kind: CharacterSourceFile['kind'];
  path: string;
  source: string;
}) {
  return <>{source.split(/\r?\n/).map((line, index) => (
    <span
      className="character-source-editor-line"
      data-line-number={index + 1}
      key={`${path}-edit-${index}`}
    >
      <HighlightedSourceText line={line} kind={kind} />{'\n'}
    </span>
  ))}</>;
}

function SourceViewHistory({
  entries,
  height,
  onSelect,
  selected,
}: {
  entries: readonly SourceViewHistoryEntry[];
  height: number;
  onSelect: (selection: CnsSourceSelection) => void;
  selected: CnsSourceSelection;
}) {
  const { text } = useUiLanguage();
  return (
    <section className="source-view-history" style={{ height: `${height}px` }}>
      <h4>{text('View History', '閲覧履歴')}</h4>
      {entries.length > 0 ? (
        <div className="source-view-history-list">
          {entries.map((entry) => {
            const active = selected?.path === entry.path && selected.line === entry.line;
            return (
              <button
                className={active ? 'active' : ''}
                key={`${entry.path}:${entry.line}`}
                onClick={() => onSelect({ path: entry.path, line: entry.line })}
                title={`${entry.path}:${entry.line}`}
                type="button"
              >
                <span>{entry.label}:{entry.line}</span>
                <small>{entry.sourceLine}</small>
              </button>
            );
          })}
        </div>
      ) : <div className="source-view-history-empty">{text('No highlighted locations yet.', '強調表示した箇所はまだありません。')}</div>}
    </section>
  );
}

function calculateCharacterFileListHeight(files: readonly CharacterSourceFile[]): number {
  const internalCount = files.filter((file) => !file.external).length;
  const externalCount = files.length - internalCount;
  const groups = [internalCount, externalCount].filter((count) => count > 0);
  const rows = groups.reduce((total, count) => total + Math.ceil(count / 4), 0);
  return Math.max(68, groups.length * 24 + rows * 40 + Math.max(0, groups.length - 1) * 6);
}

function SourceOutlineMap({
  items,
  onSelect,
  selectedAirActionNo,
  selectedLine,
}: {
  items: readonly SourceOutlineItem[];
  onSelect: (item: SourceOutlineItem) => void;
  selectedAirActionNo: number | null;
  selectedLine: number;
}) {
  const [filter, setFilter] = useState('');
  const [expandedParents, setExpandedParents] = useState<Set<number>>(() => new Set());
  const parentLines = useMemo(() => new Set(items.filter((item) => item.level === 2).map((item) => item.parentLine)), [items]);
  const expandableParents = items.filter((item) => item.level === 1 && parentLines.has(item.line));
  const query = filter.trim().toLowerCase();

  useEffect(() => {
    const selected = items.find((item) => item.level === 2 && item.line === selectedLine);
    if (selected?.parentLine === undefined) return;
    setExpandedParents((current) => current.has(selected.parentLine!) ? current : new Set(current).add(selected.parentLine!));
  }, [items, selectedLine]);

  const parentMatches = (parent: SourceOutlineItem) => parent.label.toLowerCase().includes(query) || String(parent.line).includes(query);
  const childMatches = (child: SourceOutlineItem) => child.label.toLowerCase().includes(query) || String(child.line).includes(query);
  const visibleItems = items.filter((item) => {
    if (!query) return item.level === 1 || (item.parentLine !== undefined && expandedParents.has(item.parentLine));
    if (item.level === 1) {
      return parentMatches(item) || items.some((child) => child.parentLine === item.line && childMatches(child));
    }
    const parent = items.find((candidate) => candidate.level === 1 && candidate.line === item.parentLine);
    return childMatches(item) || Boolean(parent && parentMatches(parent));
  });

  const toggleParent = (line: number) => setExpandedParents((current) => {
    const next = new Set(current);
    if (next.has(line)) next.delete(line);
    else next.add(line);
    return next;
  });

  return (
    <div className="source-outline-map">
      <div className="map-toolbar">
        <input aria-label="Map search" onChange={(event) => setFilter(event.currentTarget.value)} placeholder="マップ検索" value={filter} />
        {expandableParents.length > 0 ? <div className="map-expand-actions">
          <button type="button" onClick={() => setExpandedParents(new Set(expandableParents.map((item) => item.line)))}>全て展開</button>
          <button type="button" onClick={() => setExpandedParents(new Set())}>全てたたむ</button>
        </div> : null}
      </div>
      {visibleItems.length === 0 ? <div className="character-source-summary-empty">該当項目なし</div> : (
        <div className="character-source-summary-list" role="tree">
          {visibleItems.map((item) => {
            const expandable = item.level === 1 && parentLines.has(item.line);
            const expanded = query ? true : expandedParents.has(item.line);
            const active = item.line === selectedLine || (item.kind === 'air-action' && item.value === selectedAirActionNo);
            return (
              <div
                aria-expanded={expandable ? expanded : undefined}
                aria-level={item.level}
                className={`source-outline-row ${item.level === 2 ? 'child' : 'parent'}`}
                key={`${item.kind}-${item.line}-${item.label}`}
                role="treeitem"
              >
                {expandable ? (
                  <button aria-label={`${item.label} ${expanded ? 'をたたむ' : 'を展開'}`} className="map-disclosure" onClick={() => toggleParent(item.line)} type="button">
                    {expanded ? '▼' : '▶'}
                  </button>
                ) : <span className="map-disclosure-placeholder" />}
                <button className={`source-outline-link ${active ? 'active' : ''}`} onClick={() => onSelect(item)} title={`line ${item.line}`} type="button">
                  <span>{item.label}</span><small>:{item.line}</small>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TextSourceSearch({ source, selectedLine, onSelectLine }: { source: string; selectedLine: number; onSelectLine: (line: number) => void }) {
  const [query, setQuery] = useState('');
  const matchingLines = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return source.split(/\r?\n/).flatMap((line, index) => line.toLowerCase().includes(normalized) ? [index + 1] : []);
  }, [query, source]);
  const currentIndex = Math.max(0, matchingLines.indexOf(selectedLine));
  const move = (offset: number) => {
    if (matchingLines.length === 0) return;
    const index = (currentIndex + offset + matchingLines.length) % matchingLines.length;
    onSelectLine(matchingLines[index]);
  };
  return (
    <div className="text-source-search">
      <label>文字列検索 <input aria-label="Text search" onChange={(event) => setQuery(event.currentTarget.value)} value={query} /></label>
      <output>{matchingLines.length > 0 ? `${currentIndex + 1}/${matchingLines.length}` : '0件'}</output>
      <button disabled={matchingLines.length === 0} onClick={() => move(-1)} type="button">前へ</button>
      <button disabled={matchingLines.length === 0} onClick={() => move(1)} type="button">次へ</button>
    </div>
  );
}

function resolveSffPreview(
  file: CharacterSourceFile | null | undefined,
  loadedSprites: ImageDataSpritePack | null,
): { pack: ImageDataSpritePack | null; error: string | null } {
  if (file?.kind !== 'sff') return { pack: null, error: null };
  if (file.primary && loadedSprites) return { pack: loadedSprites, error: null };
  if (!file.binary) return { pack: null, error: 'SFF data is not available.' };
  try {
    return { pack: convertSffV1ToImageDataSpritePack(toExactArrayBuffer(file.binary)), error: null };
  } catch (error) {
    return { pack: null, error: error instanceof Error ? error.message : String(error) };
  }
}

function resolveSndPreview(file: CharacterSourceFile | null | undefined): { document: SndDocument | null; error: string | null } {
  if (file?.kind !== 'snd') return { document: null, error: null };
  if (!file.binary) return { document: null, error: 'SND data is not available.' };
  try {
    return { document: parseSndV1(file.binary), error: null };
  } catch (error) {
    return { document: null, error: error instanceof Error ? error.message : String(error) };
  }
}

function SndSampleMap({
  document,
  error,
  onSelect,
  selectedKey,
}: {
  document: SndDocument | null;
  error: string | null;
  onSelect: (key: string) => void;
  selectedKey: string | null;
}) {
  const [filter, setFilter] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(() => new Set());
  const samples = document?.samples ?? [];
  const groups = useMemo(() => {
    const grouped = new Map<number, SndSample[]>();
    for (const sample of samples) grouped.set(sample.group, [...(grouped.get(sample.group) ?? []), sample]);
    return Array.from(grouped.entries());
  }, [samples]);
  const query = filter.trim().toLowerCase();

  const toggleGroup = (group: number) => setExpandedGroups((current) => {
    const next = new Set(current);
    if (next.has(group)) next.delete(group);
    else next.add(group);
    return next;
  });

  if (error) return <div className="character-source-summary-empty source-save-error">{error}</div>;
  return <div className="snd-sample-map">
    <div className="character-source-sff-summary"><span>samples: {samples.length}</span></div>
    <label>音声検索 <input aria-label="SND map search" onChange={(event) => setFilter(event.currentTarget.value)} placeholder="group,index" value={filter} /></label>
    <div className="map-expand-actions">
      <button type="button" onClick={() => setExpandedGroups(new Set(groups.map(([group]) => group)))}>全て展開</button>
      <button type="button" onClick={() => setExpandedGroups(new Set())}>全てたたむ</button>
    </div>
    <div className="snd-sample-list" role="tree">
      {groups.map(([group, groupSamples]) => {
        const matches = query ? groupSamples.filter((sample) => sndSampleKey(sample.group, sample.index).includes(query)) : groupSamples;
        if (matches.length === 0 && !String(group).includes(query)) return null;
        const expanded = query ? true : expandedGroups.has(group);
        return <div className="snd-sample-group" key={group}>
          <button aria-expanded={expanded} className="snd-group-row" onClick={() => toggleGroup(group)} role="treeitem" type="button">
            <span>{expanded ? '▼' : '▶'} Group {group}</span><small>{groupSamples.length}</small>
          </button>
          {expanded ? matches.map((sample) => {
            const key = sndSampleKey(sample.group, sample.index);
            return <button aria-level={2} className={`snd-sample-child ${key === selectedKey ? 'active' : ''}`} key={key} onClick={() => onSelect(key)} role="treeitem" type="button">
              <span>{key}</span><small>{sample.format} / {sample.bytes.byteLength} bytes</small>
            </button>;
          }) : null}
        </div>;
      })}
    </div>
  </div>;
}

function SndSampleViewer({ document, error, selectedKey }: { document: SndDocument | null; error: string | null; selectedKey: string | null }) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const sample = selectedKey ? document?.samplesByKey.get(selectedKey) ?? null : null;
  useEffect(() => {
    if (!sample || sample.format !== 'wave' || typeof URL === 'undefined') {
      setAudioUrl(null);
      return;
    }
    const url = URL.createObjectURL(new Blob([sample.bytes.slice().buffer], { type: 'audio/wav' }));
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [sample]);

  if (error) return <div className="character-source-binary-empty source-save-error">{error}</div>;
  if (!sample) return <div className="character-source-binary-empty">再生する音声をマップから選択してください。</div>;
  return <div className="snd-sample-viewer">
    <h3>SND {sample.group},{sample.index}</h3>
    <dl>
      <div><dt>format</dt><dd>{sample.format}</dd></div>
      <div><dt>size</dt><dd>{sample.bytes.byteLength} bytes</dd></div>
      <div><dt>source offset</dt><dd>{sample.sourceOffset}</dd></div>
    </dl>
    {audioUrl ? <audio controls key={audioUrl} preload="metadata" src={audioUrl}>音声を再生できません。</audio> : (
      <p className="source-save-error">このサンプルはWAVE形式ではないため、ブラウザで再生できません。</p>
    )}
  </div>;
}

function sortSffSpriteEntries(pack: ImageDataSpritePack | null): Array<[SpriteKey, ImageDataSprite]> {
  return Array.from(pack?.sprites.entries() ?? []).sort((left, right) => {
    const groupDifference = left[1].groupNo - right[1].groupNo;
    return groupDifference || left[1].imageNo - right[1].imageNo;
  });
}

function SffSpriteMap({
  entries,
  error,
  onSelect,
  paletteCount,
  selectedKey,
  spriteCount,
}: {
  entries: readonly [SpriteKey, ImageDataSprite][];
  error: string | null;
  onSelect: (key: SpriteKey) => void;
  paletteCount: number;
  selectedKey: SpriteKey | null;
  spriteCount: number;
}) {
  const { text } = useUiLanguage();
  const [filter, setFilter] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(() => new Set());
  const groups = useMemo(() => {
    const grouped = new Map<number, Array<[SpriteKey, ImageDataSprite]>>();
    for (const entry of entries) {
      const current = grouped.get(entry[1].groupNo) ?? [];
      current.push(entry);
      grouped.set(entry[1].groupNo, current);
    }
    return Array.from(grouped.entries());
  }, [entries]);
  const query = filter.trim().toLowerCase();

  const toggleGroup = (groupNo: number) => setExpandedGroups((current) => {
    const next = new Set(current);
    if (next.has(groupNo)) next.delete(groupNo);
    else next.add(groupNo);
    return next;
  });
  return (
    <div className="sff-sprite-map">
      <div className="character-source-sff-summary">
        <span>{text('sprites', 'スプライト')}: {spriteCount}</span>
        <span>{text('palettes', 'パレット')}: {paletteCount}</span>
        {error ? <span className="source-save-error">{error}</span> : null}
      </div>
      <label>
        {text('Sprite filter', 'スプライト検索')}
        <input aria-label="SFF map search" onChange={(event) => setFilter(event.currentTarget.value)} placeholder="group,image" value={filter} />
      </label>
      <div className="map-expand-actions">
        <button type="button" onClick={() => setExpandedGroups(new Set(groups.map(([groupNo]) => groupNo)))}>全て展開</button>
        <button type="button" onClick={() => setExpandedGroups(new Set())}>全てたたむ</button>
      </div>
      <div className="sff-sprite-list">
        {groups.map(([groupNo, groupEntries]) => {
          const matchingEntries = query
            ? groupEntries.filter(([key]) => key.toLowerCase().includes(query) || String(groupNo).includes(query))
            : groupEntries;
          if (matchingEntries.length === 0) return null;
          const expanded = query.length > 0 || expandedGroups.has(groupNo);
          return <div className="sff-sprite-entry" key={groupNo}>
          <button aria-expanded={expanded} className="sff-group-row" onClick={() => toggleGroup(groupNo)} type="button">
            <span>{expanded ? '▼' : '▶'} Group {groupNo}</span><small>{groupEntries.length}</small>
          </button>
          {expanded ? matchingEntries.map(([key, sprite]) => <button className={`sff-sprite-child ${key === selectedKey ? 'active' : ''}`} key={key} onClick={() => onSelect(key)} type="button">
            <span>{sprite.groupNo},{sprite.imageNo}</span>
            <small>{sprite.imageData.width}×{sprite.imageData.height}</small>
          </button>) : null}
          </div>;
        })}
      </div>
    </div>
  );
}

function SffSpriteViewer({
  pack,
  error,
  onPanChange,
  onZoomChange,
  pan,
  selectedKey,
  zoom,
}: {
  pack: ImageDataSpritePack | null;
  error: string | null;
  onPanChange: (pan: { x: number; y: number }) => void;
  onZoomChange: (zoom: number | ((current: number) => number)) => void;
  pan: { x: number; y: number };
  selectedKey: SpriteKey | null;
  zoom: number;
}) {
  const { text } = useUiLanguage();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cacheRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const spriteEntries = useMemo(() => sortSffSpriteEntries(pack), [pack]);
  const effectiveKey = selectedKey && pack?.sprites.has(selectedKey) ? selectedKey : spriteEntries[0]?.[0] ?? null;
  const selectedSprite = effectiveKey ? pack?.sprites.get(effectiveKey) ?? null : null;
  const selectedPalette = selectedSprite?.paletteKey ? pack?.palettes?.get(selectedSprite.paletteKey) : undefined;

  useEffect(() => {
    drawSffSpritePreview(canvasRef.current, pack, selectedSprite, cacheRef.current, { zoom, panX: pan.x, panY: pan.y });
  }, [pack, pan, selectedSprite, zoom]);

  if (error) return <div className="character-source-binary-empty source-save-error">{error}</div>;
  if (!pack || spriteEntries.length === 0) {
    return <div className="character-source-binary-empty">{text('No decodable SFF v1 sprites.', '表示できるSFF v1スプライトがありません。')}</div>;
  }

  return (
    <div className="sff-viewer">
      <div className="sff-preview-detail">
        <div className="sff-viewport-controls">
          <button type="button" onClick={() => onZoomChange((value) => Math.max(0.1, value / 1.25))}>−</button>
          <label>{text('Zoom', '拡縮')} <input min={10} max={800} type="range" value={Math.round(zoom * 100)} onChange={(event) => onZoomChange(Number(event.currentTarget.value) / 100)} /></label>
          <output>{Math.round(zoom * 100)}%</output>
          <button type="button" onClick={() => onZoomChange((value) => Math.min(8, value * 1.25))}>＋</button>
          <button type="button" onClick={() => { onZoomChange(1); onPanChange({ x: 0, y: 0 }); }}>{text('Fit / Center', '全体表示・中央')}</button>
        </div>
        <canvas
          aria-label={text('SFF sprite preview', 'SFFスプライトプレビュー')}
          height={520}
          onPointerDown={(event) => {
            panStartRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const start = panStartRef.current;
            if (!start) return;
            const bounds = event.currentTarget.getBoundingClientRect();
            onPanChange({
              x: start.panX + (event.clientX - start.x) * event.currentTarget.width / Math.max(1, bounds.width),
              y: start.panY + (event.clientY - start.y) * event.currentTarget.height / Math.max(1, bounds.height),
            });
          }}
          onPointerUp={(event) => {
            panStartRef.current = null;
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          ref={canvasRef}
          width={860}
        />
        {selectedSprite ? (
          <div className="sff-sprite-meta">
            <span>group,image = {selectedSprite.groupNo},{selectedSprite.imageNo}</span>
            <span>size = {selectedSprite.imageData.width}×{selectedSprite.imageData.height}</span>
            <span>{text('registration', '登録位置')} = x:{selectedSprite.xAxis} y:{selectedSprite.yAxis}</span>
            <span>{text('palette', 'パレット')} = {selectedSprite.paletteKey ?? 'baked-rgba'}</span>
            <span>{text('palette source', 'パレット元')} = {selectedSprite.paletteMetadata?.source ?? '-'}</span>
            <span>samePalette={selectedSprite.paletteMetadata?.samePaletteRaw ?? 0} linked={selectedSprite.paletteMetadata?.linked ? 1 : 0}</span>
            {selectedSprite.paletteMetadata?.ownerGroupNo !== undefined ? (
              <span>{text('palette owner', 'パレット所有元')} = {selectedSprite.paletteMetadata.ownerGroupNo},{selectedSprite.paletteMetadata.ownerImageNo} #{selectedSprite.paletteMetadata.ownerSequence}</span>
            ) : null}
            {selectedSprite.paletteMetadata?.externalActApplied ? <span>ACT applied / index order={selectedSprite.paletteMetadata.paletteIndexOrder}</span> : null}
          </div>
        ) : null}
        <div className="sff-palette" aria-label={text('applied palette colors', '適用パレット色')}>
          {selectedPalette ? Array.from({ length: 256 }, (_, index) => {
            const paletteIndex = selectedPalette.indexOrder === 'reversed' ? 255 - index : index;
            const offset = paletteIndex * 3;
            const red = selectedPalette.bytes[offset] ?? 0;
            const green = selectedPalette.bytes[offset + 1] ?? 0;
            const blue = selectedPalette.bytes[offset + 2] ?? 0;
            return <span
              key={index}
              style={{ backgroundColor: `rgb(${red}, ${green}, ${blue})` }}
              title={`index=${index} rgb=${red},${green},${blue}`}
            />;
          }) : <small>{text('Palette bytes are not retained for this sprite.', 'このスプライトのパレットデータはありません。')}</small>}
        </div>
      </div>
    </div>
  );
}

function ActPaletteViewer({
  file,
  sprites,
}: {
  file: CharacterSourceFile;
  sprites: ImageDataSpritePack | null;
}) {
  const { text } = useUiLanguage();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sprite = sprites?.sprites.get(spriteKey(0, 0))
    ?? Array.from(sprites?.sprites.values() ?? []).find((candidate) => candidate.indexedPixels)
    ?? null;
  const spriteLabel = sprite ? `${sprite.groupNo},${sprite.imageNo}` : '0,0';
  const actBytes = file.binary;
  const previewImage = useMemo(() => createActPreviewImage(sprite, actBytes), [actBytes, sprite]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    context.fillStyle = '#020617';
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (!previewImage) return;
    const source = document.createElement('canvas');
    source.width = previewImage.width;
    source.height = previewImage.height;
    source.getContext('2d')?.putImageData(previewImage, 0, 0);
    const scale = Math.min(6, Math.max(0.1, Math.min(
      (canvas.width - 48) / Math.max(1, source.width),
      (canvas.height - 48) / Math.max(1, source.height),
    )));
    context.imageSmoothingEnabled = false;
    context.drawImage(
      source,
      (canvas.width - source.width * scale) / 2,
      (canvas.height - source.height * scale) / 2,
      source.width * scale,
      source.height * scale,
    );
  }, [previewImage]);

  if (!actBytes) return <div className="character-source-binary-empty">{text('ACT palette bytes are unavailable.', 'ACTパレットデータを取得できません。')}</div>;
  return (
    <div className="act-palette-viewer">
      <div className="act-preview-panel">
        <strong>{text(`Sprite ${spriteLabel} with this ACT applied`, `${spriteLabel}スプライトへACTを適用した見た目`)}</strong>
        {previewImage ? (
          <canvas aria-label={text(`ACT applied sprite ${spriteLabel} preview`, `ACT適用後の${spriteLabel}スプライト`)} height={480} ref={canvasRef} width={760} />
        ) : (
          <div className="character-source-binary-empty">{text('No decodable sprite is available for ACT preview.', 'ACTプレビューに利用できるスプライトがありません。')}</div>
        )}
      </div>
      <div>
        <strong>{text('Palette map (MUGEN index order)', 'パレットマップ（MUGENインデックス順）')}</strong>
        <div className="sff-palette act-palette" aria-label={text('ACT palette colors', 'ACTパレット色')}>
          {Array.from({ length: Math.min(256, Math.floor(actBytes.length / 3)) }, (_, index) => {
            const offset = (255 - index) * 3;
            const red = actBytes[offset] ?? 0;
            const green = actBytes[offset + 1] ?? 0;
            const blue = actBytes[offset + 2] ?? 0;
            return <span key={index} style={{ backgroundColor: `rgb(${red}, ${green}, ${blue})` }} title={`index=${index} rgb=${red},${green},${blue}`} />;
          })}
        </div>
      </div>
    </div>
  );
}

export function createActPreviewImage(
  sprite: ImageDataSprite | null,
  actBytes: Uint8Array | undefined,
): ImageData | null {
  if (!sprite?.indexedPixels || !actBytes || actBytes.length < 3) return null;
  const rgba = new Uint8ClampedArray(sprite.indexedPixels.length * 4);
  sprite.indexedPixels.forEach((sourceIndex, pixelIndex) => {
    const paletteOffset = (255 - sourceIndex) * 3;
    const outputOffset = pixelIndex * 4;
    rgba[outputOffset] = actBytes[paletteOffset] ?? 0;
    rgba[outputOffset + 1] = actBytes[paletteOffset + 1] ?? 0;
    rgba[outputOffset + 2] = actBytes[paletteOffset + 2] ?? 0;
    rgba[outputOffset + 3] = sourceIndex === 0 ? 0 : 255;
  });
  return new ImageData(rgba, sprite.imageData.width, sprite.imageData.height);
}

export function drawSffSpritePreview(
  canvas: HTMLCanvasElement | null,
  pack: ImageDataSpritePack | null,
  sprite: ImageDataSprite | null,
  cache: Map<string, HTMLCanvasElement>,
  viewport: { zoom?: number; panX?: number; panY?: number } = {},
): void {
  if (!canvas) return;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#020617';
  context.fillRect(0, 0, canvas.width, canvas.height);
  let originX = canvas.width / 2 + (viewport.panX ?? 0);
  let originY = canvas.height / 2 + (viewport.panY ?? 0);
  if (sprite) {
    const spriteCanvas = getSpriteCanvas(pack, sprite.groupNo, sprite.imageNo, cache);
    if (spriteCanvas) {
      const left = Math.min(0, -sprite.xAxis);
      const top = Math.min(0, -sprite.yAxis);
      const right = Math.max(0, spriteCanvas.width - sprite.xAxis);
      const bottom = Math.max(0, spriteCanvas.height - sprite.yAxis);
      const contentWidth = Math.max(1, right - left);
      const contentHeight = Math.max(1, bottom - top);
      const fitScale = Math.min(4, Math.max(0.02, Math.min(
        (canvas.width - 48) / contentWidth,
        (canvas.height - 48) / contentHeight,
      )));
      const scale = fitScale * Math.max(0.1, Math.min(8, viewport.zoom ?? 1));
      originX -= ((left + right) / 2) * scale;
      originY -= ((top + bottom) / 2) * scale;
      context.save();
      context.translate(originX, originY);
      context.scale(scale, scale);
      context.imageSmoothingEnabled = false;
      context.drawImage(spriteCanvas, -sprite.xAxis, -sprite.yAxis);
      context.restore();
    }
  }
  context.strokeStyle = '#f59e0b';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(originX - 16, originY);
  context.lineTo(originX + 16, originY);
  context.moveTo(originX, originY - 16);
  context.lineTo(originX, originY + 16);
  context.stroke();
}

function toExactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

function formatSourceKind(file: CharacterSourceFile): string {
  if (file.external && /common1\.cns$/i.test(file.path)) return 'ENGINE CNS';
  if (file.external && /common\.cmd$/i.test(file.path)) return 'ENGINE CMD';
  const kind = file.kind ?? file.path.split('.').pop() ?? 'txt';
  return kind.toUpperCase();
}

function cnsSourceLineId(path: string, line: number): string {
  return `cns-source-${path.replace(/[^a-z0-9_-]+/gi, '-')}-${line}`;
}

type SourceOutlineItem = {
  kind: 'air-action' | 'statedef' | 'state-controller' | 'command' | 'section';
  label: string;
  line: number;
  level: 1 | 2;
  parentLine?: number;
  value: number | string;
};

export function createSourceOutline(file: CharacterSourceFile): SourceOutlineItem[] {
  const lines = file.text.split(/\r?\n/);
  const items: SourceOutlineItem[] = [];
  let currentStateDef: { line: number; stateNo: number } | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const lineNo = index + 1;
    const line = lines[index].trim();
    const airMatch = line.match(/^\[?\s*Begin\s+Action\s+(-?\d+)\s*\]?$/i);
    if (airMatch) {
      const actionNo = Number(airMatch[1]);
      items.push({ kind: 'air-action', label: `Begin Action ${actionNo}`, line: lineNo, level: 1, value: actionNo });
      continue;
    }
    const stateMatch = line.match(/^\[\s*StateDef\s+(-?\d+)\s*\]$/i);
    if (stateMatch) {
      const stateNo = Number(stateMatch[1]);
      currentStateDef = { line: lineNo, stateNo };
      items.push({ kind: 'statedef', label: `StateDef ${stateNo}`, line: lineNo, level: 1, value: stateNo });
      continue;
    }
    const controllerMatch = line.match(/^\[\s*State\s+(-?\d+)\s*,\s*(.*?)\s*\]$/i);
    if (controllerMatch && currentStateDef) {
      const headerLabel = controllerMatch[2].trim();
      const controllerType = findFollowingAssignment(lines, index + 1, 'type');
      const label = controllerType && headerLabel
        ? `${controllerType} — ${headerLabel}`
        : controllerType || headerLabel || `State ${controllerMatch[1]}`;
      items.push({
        kind: 'state-controller',
        label,
        line: lineNo,
        level: 2,
        parentLine: currentStateDef.line,
        value: `${currentStateDef.stateNo}:${lineNo}`,
      });
      continue;
    }
    const commandSection = line.match(/^\[\s*Command\s*\]$/i);
    if (commandSection) {
      const commandName = findFollowingName(lines, index + 1);
      items.push({ kind: 'command', label: commandName ? `Command ${commandName}` : 'Command', line: lineNo, level: 1, value: commandName ?? lineNo });
      continue;
    }
    const sectionMatch = line.match(/^\[\s*([^\]]+)\s*\]$/);
    if (items.length < 120 && sectionMatch && file.kind === 'def') {
      items.push({ kind: 'section', label: sectionMatch[1], line: lineNo, level: 1, value: sectionMatch[1] });
    }
  }
  return items;
}

export function findAirActionSourceSelection(
  files: readonly CharacterSourceFile[],
  animNo: number,
): CnsSourceSelection {
  for (const file of files) {
    if (file.kind !== 'air' && !/\.air$/i.test(file.path)) continue;
    const action = createSourceOutline(file).find((item) => item.kind === 'air-action' && Number(item.value) === animNo);
    if (action) return { path: file.path, line: action.line };
  }
  return null;
}

export function findStateDefSourceSelection(
  files: readonly CharacterSourceFile[],
  stateNo: number,
  preferredPath?: string,
): CnsSourceSelection {
  const orderedFiles = preferredPath
    ? [...files.filter((file) => file.path === preferredPath), ...files.filter((file) => file.path !== preferredPath)]
    : files;
  for (const file of orderedFiles) {
    if (!/\.(?:cns|cmd)$/i.test(file.path) && file.kind !== 'cns' && file.kind !== 'common') continue;
    const stateDef = createSourceOutline(file).find((item) => item.kind === 'statedef' && Number(item.value) === stateNo);
    if (stateDef) return { path: file.path, line: stateDef.line };
  }
  return null;
}

export function createSourceViewHistoryEntry(
  files: readonly CharacterSourceFile[],
  selection: Exclude<CnsSourceSelection, null>,
): SourceViewHistoryEntry | null {
  const file = files.find((candidate) => candidate.path === selection.path);
  if (!file) return null;
  const sourceLine = file.text.split(/\r?\n/)[selection.line - 1]?.trim() ?? '';
  return {
    label: file.label,
    line: selection.line,
    path: selection.path,
    sourceLine: sourceLine || '(blank line)',
  };
}

export function appendSourceViewHistory(
  history: readonly SourceViewHistoryEntry[],
  entry: SourceViewHistoryEntry,
  limit = 50,
): SourceViewHistoryEntry[] {
  const key = `${entry.path}:${entry.line}`;
  return [entry, ...history.filter((candidate) => `${candidate.path}:${candidate.line}` !== key)].slice(0, limit);
}

export function createSourceNavigationTargets(
  file: CharacterSourceFile,
  files: readonly CharacterSourceFile[],
): Map<number, SourceNavigationTarget> {
  const targets = new Map<number, SourceNavigationTarget>();
  const lines = file.text.split(/\r?\n/);
  let insideController = false;
  let controllerType = '';

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const sectionMatch = line.match(/^\s*\[\s*([^\]]+)\s*\]/);
    if (sectionMatch) {
      insideController = /^State\s+-?\d+\s*,/i.test(sectionMatch[1].trim());
      controllerType = '';
      continue;
    }

    const code = line.replace(/;.*$/, '');
    const assignment = code.match(/^\s*([a-z][a-z0-9_.]*)\s*=\s*(.*?)\s*$/i);
    if (!assignment) continue;
    const key = assignment[1].toLowerCase();
    if (insideController && key === 'type') {
      controllerType = assignment[2].trim().toLowerCase();
      continue;
    }

    const navigable = key === 'anim' || (key === 'value' && insideController && controllerType === 'changeanim')
      ? 'animation'
      : key === 'stateno' || (key === 'value' && insideController && controllerType === 'changestate')
        ? 'state'
        : null;
    if (!navigable) continue;
    const valueMatch = code.match(/^\s*[a-z][a-z0-9_.]*\s*=\s*(-?\d+)\b/i);
    if (!valueMatch || valueMatch.index === undefined) continue;
    const value = Number(valueMatch[1]);
    const start = valueMatch.index + valueMatch[0].lastIndexOf(valueMatch[1]);
    const selection = navigable === 'animation'
      ? findAirActionSourceSelection(files, value)
      : findStateDefSourceSelection(files, value, file.path);
    if (!selection) continue;
    targets.set(index + 1, {
      end: start + valueMatch[1].length,
      kind: navigable,
      selection,
      start,
      value,
    });
  }

  return targets;
}

function findFollowingAssignment(
  lines: readonly string[],
  startIndex: number,
  key: string,
): string | null {
  const assignment = new RegExp(`^\\s*${key}\\s*=\\s*(.+?)\\s*$`, 'i');
  for (let index = startIndex; index < lines.length; index += 1) {
    if (/^\s*\[/.test(lines[index])) return null;
    const match = lines[index].match(assignment);
    if (match) return match[1].replace(/\s*;.*$/, '').trim();
  }
  return null;
}

function findFollowingName(lines: readonly string[], startIndex: number): string | null {
  for (let index = startIndex; index < Math.min(lines.length, startIndex + 8); index += 1) {
    const match = lines[index].match(/^\s*name\s*=\s*"?([^"]+?)"?\s*$/i);
    if (match) return match[1].trim();
    if (/^\s*\[/.test(lines[index])) return null;
  }
  return null;
}

export function findAirActionForLine(items: readonly SourceOutlineItem[], line: number): number | null {
  let current: number | null = null;
  for (const item of items) {
    if (item.kind !== 'air-action') continue;
    if (item.line > line) break;
    current = Number(item.value);
  }
  return current;
}

function AirAnimationPreview({
  actionNo,
  air,
  sprites,
}: {
  actionNo: number | null;
  air: AirDocument | null;
  sprites: ImageDataSpritePack | null;
}) {
  const { text } = useUiLanguage();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spriteCanvasCacheRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const [playing, setPlaying] = useState(true);
  const [frameIndex, setFrameIndex] = useState(0);
  const action = actionNo === null ? null : air?.actions.find((candidate) => candidate.actionNo === actionNo) ?? null;

  useEffect(() => {
    setFrameIndex(0);
  }, [actionNo]);

  useEffect(() => {
    if (!action || !playing) return;
    const interval = window.setInterval(() => {
      setFrameIndex((index) => (action.elements.length === 0 ? 0 : (index + 1) % action.elements.length));
    }, Math.max(50, getAirElementDurationMs(action.elements[frameIndex])));
    return () => window.clearInterval(interval);
  }, [action, frameIndex, playing]);

  useEffect(() => {
    drawAirPreview(canvasRef.current, action, frameIndex, sprites, spriteCanvasCacheRef.current);
  }, [action, frameIndex, sprites]);

  const element = action?.elements[frameIndex] ?? null;

  return (
    <div className="air-preview">
      <div className="air-preview-header">
        <strong>{text('AIR Preview', 'AIRプレビュー')}</strong>
        <button type="button" onClick={() => setPlaying((value) => !value)}>
          {playing ? text('Pause', '一時停止') : text('Play', '再生')}
        </button>
      </div>
      <canvas ref={canvasRef} width={220} height={160} />
      <div className="air-preview-meta">
        {action ? (
          <>
            <span>Action {action.actionNo}</span>
            <span>{text('frame', 'フレーム')} {action.elements.length === 0 ? '-' : frameIndex + 1}/{action.elements.length}</span>
            <span>{element ? `${text('sprite', 'スプライト')} ${element.groupNo},${element.imageNo} time=${element.duration}` : `${text('sprite', 'スプライト')}=-`}</span>
          </>
        ) : (
          <span>{text('Action not selected', 'アクション未選択')}</span>
        )}
      </div>
    </div>
  );
}

function getAirElementDurationMs(element: AirElement | undefined): number {
  if (!element) return 120;
  return Math.max(1, element.duration) * DEFAULT_FRAME_INTERVAL_MS;
}

export function drawAirPreview(
  canvas: HTMLCanvasElement | null,
  action: AirAction | null,
  frameIndex: number,
  sprites: ImageDataSpritePack | null,
  cache: Map<string, HTMLCanvasElement>,
): void {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
  ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
  ctx.strokeStyle = 'rgba(96, 165, 250, 0.45)';
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2 - 28, canvas.height - 34);
  ctx.lineTo(canvas.width / 2 + 28, canvas.height - 34);
  ctx.moveTo(canvas.width / 2, canvas.height - 62);
  ctx.lineTo(canvas.width / 2, canvas.height - 8);
  ctx.stroke();

  const element = action?.elements[frameIndex] ?? null;
  if (!element) {
    drawAirPreviewText(ctx, 'no frame');
    return;
  }

  const spriteCanvas = getSpriteCanvas(sprites, element.groupNo, element.imageNo, cache);
  if (!spriteCanvas) {
    drawAirPreviewText(ctx, `missing ${element.groupNo},${element.imageNo}`);
    return;
  }

  const flipX = element.flip?.toUpperCase().includes('H') ?? false;
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height - 34);
  ctx.scale(flipX ? -1 : 1, 1);
  const sprite = sprites?.sprites.get(spriteKey(element.groupNo, element.imageNo));
  const xAxis = sprite?.xAxis ?? spriteCanvas.width / 2;
  const yAxis = sprite?.yAxis ?? spriteCanvas.height;
  ctx.drawImage(spriteCanvas, -xAxis + element.offsetX, -yAxis + element.offsetY);
  ctx.restore();
}

function drawAirPreviewText(ctx: CanvasRenderingContext2D, text: string): void {
  ctx.fillStyle = '#bfdbfe';
  ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(text, ctx.canvas.width / 2, ctx.canvas.height / 2);
}

function getSpriteCanvas(
  sprites: ImageDataSpritePack | null,
  groupNo: number,
  imageNo: number,
  cache: Map<string, HTMLCanvasElement>,
): HTMLCanvasElement | null {
  const spriteId = spriteKey(groupNo, imageNo);
  const sprite = sprites?.sprites.get(spriteId);
  if (!sprite) return null;
  const key = `asset=${sprites?.cacheKey ?? 'unknown'};sprite=${spriteId};palette=${sprite.paletteKey ?? 'baked-rgba'}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = sprite.imageData.width;
  canvas.height = sprite.imageData.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.putImageData(sprite.imageData, 0, 0);
  cache.set(key, canvas);
  return canvas;
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
  if (pressedKeys.has(mapping.start)) buttons.push('START');
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

export function ManualPanel() {
  const { text } = useUiLanguage();
  const shortcuts = [
    ['F1', text('Set P2 life to 0', 'P2の体力を0にする')],
    ['Ctrl + F1', text('Set P1 life to 0', 'P1の体力を0にする')],
    ['F2', text('Set both players’ life to 1', '両プレイヤーの体力を1にする')],
    ['Ctrl + F2', text('Set P1 life to 1', 'P1の体力を1にする')],
    ['Shift + F2', text('Set P2 life to 1', 'P2の体力を1にする')],
    ['F3', text('Fill both power gauges', '両プレイヤーのパワーゲージを最大にする')],
    ['F4', text('Restart the current round from its beginning', '現在のラウンドを最初からやり直す')],
    ['Shift + F4', text('Reload the character and restart the match', 'キャラクターを再読込して試合を最初からやり直す')],
    ['F5', text('End the round by time over', '時間切れにする')],
    ['F8', text('Clear runtime logs', '実行ログを消去する')],
    ['F12', text('Save the game screen as a PNG', 'ゲーム画面をPNGで保存する')],
    ['Ctrl + C', text('Toggle collision boxes', '当たり判定表示を切り替える')],
    ['Ctrl + D', text('Toggle runtime history display', '実行履歴表示を切り替える')],
    ['Ctrl + I', text('Force all characters and helpers to State 0 with Ctrl=0', '全キャラクターとヘルパーをState 0・Ctrl=0にする')],
    ['Ctrl + L', text('Toggle the life bar and power gauges', 'ライフバーとパワーゲージの表示を切り替える')],
    ['Ctrl + S', text('Toggle fast-forward', '早送りを切り替える')],
    ['Space', text('Restore every character’s life and power; reset the timer', '全キャラクターの体力・パワーとタイマーを回復する')],
    ['Pause', text('Pause or resume the simulation', '一時停止・再開する')],
    ['Scroll Lock', text('Advance one frame while paused', '一時停止中に1フレーム進める')],
    ['R', text('Restart after KO or time over', 'KO・時間切れ後に現在のラウンドをやり直す')],
  ];
  return (
    <section className="settings-section manual-panel">
      <h2>{text('Controls', '操作説明')}</h2>
      <p>{text(
        'Any configured game key skips a character intro. A new match starts automatically after either player wins two rounds.',
        '設定済みのゲームキーでキャラクターのイントロをスキップできます。どちらかが2ラウンド先取すると、自動で次の試合を開始します。',
      )}</p>
      <h3>{text('WinMUGEN-compatible system shortcuts', 'WinMUGEN互換のシステム操作')}</h3>
      <div className="manual-shortcut-grid">
        {shortcuts.map(([key, description]) => (
          <div className="manual-shortcut-row" key={key}>
            <kbd>{key}</kbd>
            <span>{description}</span>
          </div>
        ))}
      </div>
      <aside className="manual-limitations">
        <strong>{text('Not supported yet', '未対応')}</strong>
        <p>{text(
          'Ctrl + number (AI toggle), Ctrl + Alt + number (remove a player), and Ctrl + V (VSync toggle) are not available because WebMUGEN does not yet have WinMUGEN player-slot AI/removal controls and browser rendering controls VSync.',
          'Ctrl＋数字（AI切替）、Ctrl＋Alt＋数字（プレイヤー消去）、Ctrl＋V（VSync切替）は未対応です。WebMUGENにはWinMUGEN相当のプレイヤースロットAI／消去機構がまだなく、VSyncはブラウザー描画側で制御されるためです。',
        )}</p>
      </aside>
    </section>
  );
}

function captureCanvasScreenshot(canvas: HTMLCanvasElement): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `webmugen-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }, 'image/png');
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
  traces,
  hitDiagnosticLines = [],
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
  traces: CnsRuntimeTrace[];
  hitDiagnosticLines?: string[];
  pressedKeys: ReadonlySet<string>;
  historyRef: MutableRefObject<string[]>;
  lastSignatureRef: MutableRefObject<string>;
  setHistoryLines: () => void;
}) {
  const stateChanged = traces.some((trace) => trace.stateNo !== trace.afterStateNo || trace.animNo !== trace.afterAnimNo);
  const controllerRan = traces.some((trace) => (
    trace.executedControllers.some((controller) => !controller.startsWith('dbg '))
    || formatMeaningfulAiTraceDebugLines(trace).length > 0
  ));
  const hasInput = pressedKeys.size > 0;
  if (!hasInput && !stateChanged && !controllerRan && hitDiagnosticLines.length === 0) return;

  const snapshot = formatAiRuntimeSnapshot({
    inputLines,
    commandLines,
    physicsLines,
    roundLine,
    scoreLine,
    traces,
    hitDiagnosticLines,
  });
  const signature = formatRuntimeHistorySignature({
    commandLines,
    inputLines,
    pressedKeys,
    traces,
    hitDiagnosticLines,
  });
  if (signature === lastSignatureRef.current) return;

  lastSignatureRef.current = signature;
  const timestamp = new Date().toLocaleTimeString('ja-JP', { hour12: false });
  const entry = freezeHistoryLines([
    `===== AI_RUNTIME frame=${frameNo} timestamp=${timestamp} =====`,
    ...snapshot,
  ]);
  const nextHistory = limitRuntimeHistoryEntries(
    freezeHistoryLines([...entry, ...historyRef.current]),
    'ai',
    RUNTIME_HISTORY_STORE_LIMIT,
  );
  historyRef.current = nextHistory.slice();
  setHistoryLines();
}

function formatAiRuntimeSnapshot({
  inputLines,
  commandLines,
  physicsLines,
  roundLine,
  scoreLine,
  traces,
  hitDiagnosticLines = [],
}: {
  inputLines: string[];
  commandLines: string[];
  physicsLines: string[];
  roundLine: string;
  scoreLine: string;
  traces: CnsRuntimeTrace[];
  hitDiagnosticLines?: string[];
}): string[] {
  const inputSnapshotLines = inputLines.filter((line) => line !== 'sys R=0');
  const traceDetailLines = formatCodexTraceDetailLines(traces);
  return freezeHistoryLines([
    'SECTION input',
    ...inputSnapshotLines.map((line) => `raw.${line}`),
    'SECTION command',
    ...commandLines.map((line) => `raw.${line}`),
    'SECTION physics_after_step',
    ...physicsLines.map((line) => `raw.${line}`),
    'SECTION round_score',
    `raw.${roundLine}`,
    `raw.${scoreLine}`,
    'SECTION cns_trace',
    ...formatCodexTraceSummaryLines(traces),
    ...(traceDetailLines.length > 0 ? ['DETAIL cns_special', ...traceDetailLines] : []),
    ...(hitDiagnosticLines.length > 0 ? ['SECTION event_diagnostics', ...hitDiagnosticLines] : []),
    'END AI_RUNTIME',
  ]);
}

function formatCodexTraceSummaryLines(traces: readonly CnsRuntimeTrace[]): string[] {
  if (traces.length === 0) return ['traceCount=0'];
  return [
    `traceCount=${traces.length}`,
    ...traces.map((trace) => {
      const executedControllers = actualExecutedControllers(trace);
      return [
        `trace p${trace.playerId}`,
        `state=${trace.stateNo}->${trace.afterStateNo}`,
        `anim=${trace.animNo}->${trace.afterAnimNo}`,
        `time=${trace.stateTime}->${trace.afterStateTime}`,
        `mugenAnimTime=${trace.mugenAnimTime}`,
        `stateFound=${trace.stateFound ? 1 : 0}`,
        `execCount=${executedControllers.length}`,
        `exec=${executedControllers.length > 0 ? executedControllers.join(',') : '-'}`,
      ].join(' ');
    }),
  ];
}

export function shouldEvaluateHumanLogFrame(
  mode: RuntimeSettings['humanLogCaptureMode'],
  traces: readonly CnsRuntimeTrace[],
): boolean {
  if (mode === 'state-transition') {
    return traces.some((trace) => trace.stateNo !== trace.afterStateNo);
  }
  if (mode !== 'controller-activated') return true;
  return traces.some((trace) => trace.executedControllers.some((name) => !name.startsWith('dbg ')));
}

function appendReadableRuntimeHistoryIfNeeded({
  cns,
  p1Commands,
  p2Commands,
  getAnimEndTime,
  inputConfig,
  frameNo,
  state,
  traces,
  pressedKeys,
  entryStoreRef,
  indexStoreRef,
  nextEntryIdRef,
  lastSignatureRef,
  captureMode,
  setIndexEntries,
}: {
  cns: CnsDocument;
  p1Commands: ReadonlySet<string>;
  p2Commands: ReadonlySet<string>;
  getAnimEndTime?: (animNo: number) => number | null;
  inputConfig: InputConfig;
  frameNo: number;
  state: GameState;
  traces: CnsRuntimeTrace[];
  pressedKeys: ReadonlySet<string>;
  entryStoreRef: MutableRefObject<Map<string, ReadableRuntimeEntry>>;
  indexStoreRef: MutableRefObject<RuntimeLogIndexEntry[]>;
  nextEntryIdRef: MutableRefObject<number>;
  lastSignatureRef: MutableRefObject<string>;
  captureMode: RuntimeSettings['humanLogCaptureMode'];
  setIndexEntries: (entries: RuntimeLogIndexEntry[]) => void;
}): number {
  const p1KeySummary = formatMugenPressedKeys(pressedKeys, inputConfig.players[0]);
  const p2KeySummary = formatMugenPressedKeys(pressedKeys, inputConfig.players[1]);
  const snapshots = createReadableRuntimeStateSnapshots(state, traces);
  const preparedSnapshots = snapshots.map((snapshot) => {
    const [p1, p2] = snapshot.players;
    const p1Trace = findRootTraceForPlayer(traces, 1, p1.stateNo);
    const p2Trace = findRootTraceForPlayer(traces, 2, p2.stateNo);
    const p1TriggerSummary = formatPlayerSatisfiedStateDefTriggerSummary(cns, snapshot, 0, p1Commands, getAnimEndTime, p1Trace);
    const p2TriggerSummary = formatPlayerSatisfiedStateDefTriggerSummary(cns, snapshot, 1, p2Commands, getAnimEndTime, p2Trace);
    const damageSummary = formatHitEventSummary(snapshot);
    const preparedHelperLogs = snapshot.helpers.entries.map((helper) => {
      const trace = traces.find((candidate) => candidate.entityId === helper.entityId);
      const opponent = snapshot.players[helper.rootEntityId === 1 ? 1 : 0];
      const commands = helper.keyCtrl ? (helper.rootEntityId === 1 ? p1Commands : p2Commands) : new Set<string>();
      const keySummary = helper.rootEntityId === 1 ? p1KeySummary : p2KeySummary;
      const triggerSummary = formatRuntimeEntitySatisfiedStateDefTriggerSummary(
        cns, snapshot, helper.player, opponent, commands, getAnimEndTime, trace,
      );
      return {
        key: `helper-${helper.entityId}`,
        label: `H${helper.helperId}`,
        triggerSummary,
        lines: freezeHistoryLines([
          `---- ${new Date().toLocaleTimeString('ja-JP', { hour12: false })} frame=${frameNo} state=${helper.player.stateNo} ----`,
          `H${helper.helperId} #${helper.entityId} StateNo=${helper.player.stateNo} Anim=${helper.player.animNo} Time=${helper.player.stateTime}`,
          ...formatReadableStateDefLines(cns, helper.player.stateNo),
          keySummary,
          'State Status',
          ...triggerSummary.split('\n').map((line) => `  ${line}`),
          `Damage=${damageSummary}`,
          '',
        ]),
      };
    });
    const helperLogs = preparedHelperLogs.map(({ triggerSummary: _triggerSummary, ...helperLog }) => helperLog);
    return {
      snapshot,
      p1TriggerSummary,
      p2TriggerSummary,
      damageSummary,
      helperLogs,
      signature: createReadableRuntimeTriggerChangeSignature(
        p1TriggerSummary,
        p2TriggerSummary,
        preparedHelperLogs.map(({ key, triggerSummary }) => ({ key, triggerSummary })),
      ),
    };
  });
  const signature = preparedSnapshots.map((prepared) => prepared.signature).join('||');
  if (captureMode === 'trigger-changes' && signature === lastSignatureRef.current) return 0;

  lastSignatureRef.current = signature;
  const timestamp = new Date().toLocaleTimeString('ja-JP', { hour12: false });
  let visibleEntries: RuntimeLogIndexEntry[] | null = null;
  let generatedCharacters = 0;
  const appendedKeys = new Set<string>();
  for (const { snapshot, p1TriggerSummary, p2TriggerSummary, damageSummary, helperLogs } of preparedSnapshots) {
    const [p1, p2] = snapshot.players;
    const key = createReadableRuntimeEntryKey(frameNo, p1.stateNo);
    if (appendedKeys.has(key)) continue;
    appendedKeys.add(key);
    const id = nextEntryIdRef.current;
    nextEntryIdRef.current += 1;
    const lines = freezeHistoryLines([
      `---- ${timestamp} frame=${frameNo} state=${p1.stateNo} ----`,
      `P1 StateNo=${p1.stateNo} Anim=${p1.animNo} Time=${p1.stateTime}`,
      ...formatReadableStateDefLines(cns, p1.stateNo),
      p1KeySummary,
      'State Status',
      ...p1TriggerSummary.split('\n').map((line) => `  ${line}`),
      `Damage=${damageSummary}`,
      '',
    ]);
    const p2Lines = freezeHistoryLines([
      `---- ${timestamp} frame=${frameNo} state=${p2.stateNo} ----`,
      `P2 StateNo=${p2.stateNo} Anim=${p2.animNo} Time=${p2.stateTime}`,
      ...formatReadableStateDefLines(cns, p2.stateNo),
      p2KeySummary,
      'State Status',
      ...p2TriggerSummary.split('\n').map((line) => `  ${line}`),
      `Damage=${damageSummary}`,
      '',
    ]);
    generatedCharacters += [...lines, ...p2Lines, ...helperLogs.flatMap((helper) => helper.lines)].reduce((total, line) => total + line.length, 0);
    visibleEntries = appendReadableRuntimeEntry({
      indexStore: indexStoreRef.current,
      entryStore: entryStoreRef.current,
      indexEntry: createRuntimeLogIndexEntry({ id, frameNo, timestamp, state: snapshot }),
      entry: { id, key, frameNo, p1StateNo: p1.stateNo, p2StateNo: p2.stateNo, lines, p2Lines, helperLogs },
    });
  }
  if (visibleEntries) setIndexEntries(visibleEntries);
  return generatedCharacters;
}

function createReadableRuntimeStateSnapshots(state: GameState, traces: readonly CnsRuntimeTrace[]): GameState[] {
  const snapshots: GameState[] = [];
  const seenStateNos = new Set<number>();
  const addSnapshot = (snapshot: GameState) => {
    const p1 = snapshot.players[0];
    if (!p1 || seenStateNos.has(p1.stateNo)) return;
    seenStateNos.add(p1.stateNo);
    snapshots.push(snapshot);
  };
  const p1Trace = traces.find((trace) => trace.playerId === 1);
  if (p1Trace && p1Trace.stateNo !== state.players[0]?.stateNo) {
    addSnapshot(withReadableP1TraceState(state, p1Trace));
  }
  addSnapshot(state);
  return snapshots;
}

function findRootTraceForPlayer(
  traces: readonly CnsRuntimeTrace[],
  playerId: 1 | 2,
  stateNo: number,
): CnsRuntimeTrace | undefined {
  return traces.find((trace) => trace.playerId === playerId && trace.entityId === undefined && trace.stateNo === stateNo)
    ?? traces.find((trace) => trace.playerId === playerId && trace.entityId === undefined);
}

function withReadableP1TraceState(state: GameState, trace: CnsRuntimeTrace): GameState {
  const [p1, p2] = state.players;
  return {
    ...state,
    players: [
      {
        ...p1,
        stateNo: trace.stateNo,
        stateTime: trace.stateTime,
        animNo: trace.animNo,
      },
      p2,
    ],
  };
}

function formatReadableStateDefLines(cns: CnsDocument, stateNo: number): string[] {
  const stateDef = cns.states.find((state) => state.stateNo === stateNo);
  if (!stateDef) return ['StateDef=-'];
  const source = stateDef.sourceFile && stateDef.sourceLine
    ? ` @ ${stateDef.sourceFile}:${stateDef.sourceLine}`
    : '';
  const params = [
    ['type', stateDef.stateType],
    ['movetype', stateDef.moveType],
    ['physics', stateDef.physics],
    ['anim', stateDef.initialAnimExpression ?? stateDef.initialAnim],
    ['sprpriority', stateDef.sprPriority],
    ['velset', stateDef.velocitySet ? `${stateDef.velocitySet.x},${stateDef.velocitySet.y}` : undefined],
    ['ctrl', stateDef.ctrl === undefined ? undefined : Number(stateDef.ctrl)],
    ['poweradd', stateDef.powerAdd],
    ['juggle', stateDef.juggle],
    ['facep2', stateDef.faceP2 === undefined ? undefined : Number(stateDef.faceP2)],
    ['hitdefpersist', stateDef.hitDefPersist === undefined ? undefined : Number(stateDef.hitDefPersist)],
    ['movehitpersist', stateDef.moveHitPersist === undefined ? undefined : Number(stateDef.moveHitPersist)],
    ['hitcountpersist', stateDef.hitCountPersist === undefined ? undefined : Number(stateDef.hitCountPersist)],
  ].filter((entry): entry is [string, string | number] => entry[1] !== undefined);
  return [
    `StateDef ${stateNo}${source}`,
    ...params.map(([key, value]) => `STATEDEF_PARAM \`${key} = ${value}\``),
  ];
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
  hitDiagnosticLines = [],
}: {
  commandLines: string[];
  inputLines: string[];
  pressedKeys: ReadonlySet<string>;
  traces: CnsRuntimeTrace[];
  hitDiagnosticLines?: string[];
}): string {
  return [
    formatPressedKeys(pressedKeys),
    ...inputLines.filter((line) => !/^keys=/.test(line)),
    ...commandLines,
    ...hitDiagnosticLines,
    ...traces.map((trace) => [
      trace.playerId,
      trace.stateNo,
      trace.afterStateNo,
      trace.animNo,
      trace.afterAnimNo,
      formatExecutedControllers(trace),
      formatMeaningfulAiTraceDebugLines(trace)
        .filter((line) => !/\btime=|StateTime=|animtime=|MugenAnimTime=/.test(line))
        .join(','),
    ].join(':')),
  ].join('|');
}

function formatPlayerSatisfiedStateDefTriggerSummary(
  cns: CnsDocument,
  state: GameState,
  playerIndex: 0 | 1,
  commands: ReadonlySet<string>,
  getAnimEndTime?: (animNo: number) => number | null,
  trace?: CnsRuntimeTrace,
): string {
  const [p1, p2] = state.players;
  const player = playerIndex === 0 ? p1 : p2;
  const opponent = playerIndex === 0 ? p2 : p1;
  return formatRuntimeEntitySatisfiedStateDefTriggerSummary(cns, state, player, opponent, commands, getAnimEndTime, trace);
}

function formatRuntimeEntitySatisfiedStateDefTriggerSummary(
  cns: CnsDocument,
  state: GameState,
  player: PlayerState,
  opponent: PlayerState,
  commands: ReadonlySet<string>,
  getAnimEndTime?: (animNo: number) => number | null,
  trace?: CnsRuntimeTrace,
): string {
  const mugenAnimTime = calculateMugenAnimTime(player.animTime, getAnimEndTime?.(player.animNo));
  const context = { player, opponent, commands, animTime: mugenAnimTime, constants: cns, gameTime: state.frame };
  const summaries = cns.states
    .filter((stateDef) => stateDef.stateNo === player.stateNo)
    .flatMap((stateDef) => formatSatisfiedStateDefTriggers(stateDef, context, trace?.executedControllerRefs));

  return summaries.length > 0 ? summaries.join('\n') : '-';
}

export function formatSatisfiedStateDefTriggers(
  stateDef: CnsStateDefinition,
  context: Parameters<typeof evaluateCnsRuntimeTrigger>[1],
  executedControllers?: readonly CnsExecutedControllerRef[],
): string[] {
  const lines: string[] = [];

  stateDef.controllers.forEach((controller, controllerIndex) => {
    const activated = executedControllers === undefined
      ? evaluateReadableController(controller, context)
      : executedControllers.some((executed) => (
          executed.stateNo === stateDef.stateNo
          && executed.controllerIndex === controllerIndex
          && executed.type.toLowerCase() === controller.type.toLowerCase()
          && executed.sourceFile === controller.sourceFile
          && executed.sourceLine === controller.sourceLine
        ));
    lines.push(formatReadableControllerHeaderOk(controller, activated, context));
    lines.push(...controller.triggers.map((trigger) => `  ${formatReadableTriggerLineOk(trigger, context)}`));
    lines.push(...formatReadableControllerParameterLines(controller, context));
  });

  return lines;
}

function formatReadableControllerHeader(controller: CnsStateController, passed: boolean): string {
  const value = controller.type.toLowerCase() === 'changestate'
    ? ` -> ${readParamNumber(controller, 'value') ?? '?'}`
    : '';
  return `**${controller.type}${value}** | ${passed ? '✅ 成立' : '✗ 不成立'}`;
}

function formatReadableControllerHeaderOk(
  controller: CnsStateController,
  passed: boolean,
  context: CnsRuntimeTriggerContext,
): string {
  const value = controller.type.toLowerCase() === 'changestate'
    ? ` -> ${readParamNumber(controller, 'value') ?? '?'}`
    : '';
  const source = controller.sourceFile && controller.sourceLine ? ` @ ${controller.sourceFile}:${controller.sourceLine}` : '';
  return `**${controller.type}${value}** | ${passed ? 'ACTIVE' : 'INACTIVE'}${formatReadableControllerValue(controller, context)}${source}`;
}

function formatReadableControllerValue(
  controller: CnsStateController,
  context: CnsRuntimeTriggerContext,
): string {
  const raw = controller.params.value;
  if (raw === undefined) return '';
  const rawText = Array.isArray(raw) ? raw.join(', ') : String(raw);
  const evaluated = readNumberExpression(rawText, context);
  const evaluatedText = evaluated === null
    ? 'unresolved'
    : Number.isFinite(evaluated) ? formatRuntimeNumber(evaluated) : 'NaN';
  return ` | value raw=\`${rawText}\` evaluated=${evaluatedText}`;
}

function formatReadableControllerParameterLines(
  controller: CnsStateController,
  context: CnsRuntimeTriggerContext,
): string[] {
  return Object.entries(controller.params)
    .filter(([key]) => key.toLowerCase() !== 'value')
    .map(([key, value]) => {
      const rawText = Array.isArray(value) ? value.join(', ') : String(value);
      const evaluated = readNumberExpression(rawText, context);
      const evaluatedText = evaluated === null
        ? ''
        : ` || evaluated: ${Number.isFinite(evaluated) ? formatRuntimeNumber(evaluated) : 'NaN'}`;
      return `PARAM \`${key} = ${rawText}${evaluatedText}\``;
    });
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
  return summary
    .replace(/\s+\|\| values: .+$/gm, '')
    .replace(/(\s+\|\s+value raw=`.+?`) evaluated=\S+/gm, '$1')
    .replace(/(\bPARAM\s+`.+?)\s+\|\| evaluated: [^`]+`$/gm, '$1`');
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
  const lines = Array.from(new Set(traces.flatMap((trace) => (
    formatMeaningfulAiTraceDebugLines(trace).map((line) => `trace p${trace.playerId} ${line}`)
  ))));
  const limit = 120;
  return lines.length <= limit
    ? lines
    : [...lines.slice(0, limit), `trace detail omitted=${lines.length - limit}`];
}

export function createReadableRuntimeTriggerChangeSignature(
  p1TriggerSummary: string,
  p2TriggerSummary: string,
  helpers: readonly { key: string; triggerSummary: string }[],
): string {
  return [
    `p1:${stripReadableRuntimeValueSummaries(p1TriggerSummary)}`,
    `p2:${stripReadableRuntimeValueSummaries(p2TriggerSummary)}`,
    ...helpers
      .slice()
      .sort((left, right) => left.key.localeCompare(right.key))
      .map((helper) => `${helper.key}:${stripReadableRuntimeValueSummaries(helper.triggerSummary)}`),
  ].join('|');
}

function formatExecutedControllers(trace: CnsRuntimeTrace): string {
  const controllers = actualExecutedControllers(trace);
  return controllers.length > 0 ? controllers.join(',') : '-';
}

function actualExecutedControllers(trace: CnsRuntimeTrace): string[] {
  return trace.executedControllers.filter((controller) => !controller.startsWith('dbg '));
}

function formatMeaningfulAiTraceDebugLines(trace: CnsRuntimeTrace): string[] {
  return trace.debugLines.filter((line) => (
    !/^finish state=/.test(line)
    && !/^pipe (?:before|after) /.test(line)
    && !/^return S-?\d+ state=/.test(line)
  ));
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

function getProjectileHitBox(air: AirDocument, animNo: number): Rect | null {
  const action = air.actions.find((candidate) => candidate.actionNo === animNo);
  const boxes = action?.elements[0]?.clsn1.length
    ? action.elements[0].clsn1
    : action?.defaultClsn1 ?? [];
  if (boxes.length === 0) return null;
  const left = Math.min(...boxes.map((box) => box.left));
  const top = Math.min(...boxes.map((box) => box.top));
  const right = Math.max(...boxes.map((box) => box.right));
  const bottom = Math.max(...boxes.map((box) => box.bottom));
  return { x: left, y: top, width: right - left, height: bottom - top };
}
