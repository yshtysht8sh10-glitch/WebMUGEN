import { memo, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { CanvasRenderer } from '../renderer/canvas2d/CanvasRenderer';
import { createInitialGameState } from '../core/engine/GameState';
import type { GameState, ProjectileState, Rect } from '../core/engine/types';
import { applyInfinitePowerAtFrameStart } from '../core/power/InfinitePower';
import { createSampleCharacterAssets, loadAppCharacter, readCharacterRuntimeMetadata } from './AppCharacterLoader';
import type { CharacterSourceFile } from '../core/character/CharacterTypes';
import type { SndDocument } from '../parser/snd/SndTypes';
import { sndSampleKey } from '../parser/snd/SndTypes';
import { BrowserAudioRuntime, formatAudioRuntimeDiagnostic, type AudioRuntimeDiagnostic } from '../core/audio/BrowserAudioRuntime';
import { createAudioStartGate, type AudioStartGate, type AudioStartGateGesture, type RuntimeStartState } from './AudioStartGate';
import type { SoundRuntimeEvent } from '../core/audio/SoundEvent';
import { processSoundRuntimeEvents } from '../core/audio/SoundRuntimeBridge';
import { adjustMasterVolumeFromKey, loadAudioSettings, normalizeAudioSettings, saveAudioSettings, type AudioSettings } from './AudioSettings';
import { applyExplodControllerEvents, removeExplodsOnOwnerHit, stepExplodRuntime, type ExplodControllerEvent } from '../core/explod/ExplodSystem';
import type { AirAction, AirDocument, AirElement } from '../parser/air/AirTypes';
import type { ImageDataSpritePack } from '../core/sprite/ImageDataSpriteTypes';
import { spriteKey } from '../core/sprite/SpritePackLoader';
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
import { canRestartRound, restartRound } from '../core/engine/RoundRestart';
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
  stepCnsStateRuntime,
  type CnsRuntimeTrace,
} from '../core/cns/CnsStateRuntime';
import { synchronizeRuntimeFrame } from './RuntimeFrame';
import {
  applyPauseControllerEvents,
  canEntityMoveDuringPause,
  createInitialPauseState,
  isGamePaused,
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

const DEFAULT_CHARACTER_DEF_PATH = '/chars/T-H-M-A.zip';
const ENABLE_RUNTIME_FALLBACKS = false;
const READABLE_STATE_STATUS_ALWAYS_SHOW_TYPES = new Set(['changestate', 'changeanim']);
const READABLE_STATE_STATUS_EXTRA_CONTROLLER_LIMIT = 10;
const INPUT_CONFIG_STORAGE_KEY = 'webmugen.inputConfig.v1';
const CHARACTER_PATH_STORAGE_KEY = 'webmugen.characterPath.v1';
export const CHARACTER_PATH_OPTIONS = uniqueCharacterPathOptions([
  DEFAULT_CHARACTER_DEF_PATH,
  ...DISCOVERED_CHARACTER_PATH_OPTIONS,
]);
const RUNTIME_HISTORY_RENDER_THROTTLE_MS = 250;
const STATE_HISTORY_RENDER_THROTTLE_MS = 200;
const HUMAN_LOG_CAPTURE_INTERVAL_MS = 100;

type AppPage = 'play' | 'static-files';
type DebugTab = 'runtime-human' | 'runtime-ai' | 'manual' | 'settings';
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

export function WebMugenApp({ initialPage = 'play' }: { initialPage?: AppPage } = {}) {
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
  const p1HitPauseCommandBufferRef = useRef<HitPauseCommandBuffer | null>(null);
  const p2HitPauseCommandBufferRef = useRef<HitPauseCommandBuffer | null>(null);
  const restartPressedRef = useRef(false);
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
  const [showHumanDetail, setShowHumanDetail] = useState(false);
  const [showCharacterFiles, setShowCharacterFiles] = useState(false);
  const [runtimeFrameIndexAutoScroll, setRuntimeFrameIndexAutoScroll] = useState(true);
  const [stateTransitionLogLines, setStateTransitionLogLines] = useState<string[]>(['StateNoが変化すると、ここに遷移だけが残ります。']);
  const [stageDebugLines, setStageDebugLines] = useState<string[]>(['State: -']);
  const [activePage, setActivePage] = useState<AppPage>(initialPage);
  const [activeDebugTab, setActiveDebugTab] = useState<DebugTab>('runtime-human');
  const [aiHistoryWindow, setAiHistoryWindow] = useState<RuntimeHistoryWindow>({ mode: 'latest' });
  const [copyStatus, setCopyStatus] = useState('');
  const [inputConfig, setInputConfigState] = useState<InputConfig>(inputConfigRef.current);
  const [runtimeSettings, setRuntimeSettingsState] = useState<RuntimeSettings>(runtimeSettingsRef.current);
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
  const cnsSourceScrollPositionsRef = useRef<Record<string, number>>({});

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

      gameStateRef.current = createInitialGameState();
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
      setShowHumanDetail(false);
      setShowCharacterFiles(false);
      p1CommandBufferRef.current.clear();
      p2CommandBufferRef.current.clear();
      p1HitPauseCommandBufferRef.current?.clear();
      p2HitPauseCommandBufferRef.current?.clear();
      setSelectedCnsSource(null);
      setLoadedAir(null);
      setLoadedSprites(null);
      const audioRuntime = audioRuntimeRef.current;
      recordAudioHistory(`raw.audio_lifecycle event=character_path_effect_stop_all runtimeInstanceId=${audioRuntime?.runtimeInstanceId ?? '-'} characterPath=${characterPath}`);
      audioRuntime?.stopAll();
      characterSoundsRef.current = null;
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
      const characterPowerMax = readCnsConst(character.cns, 'data.power');
      gameStateRef.current = createInitialGameState(characterPowerMax, readCharacterRuntimeMetadata(character));
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
          ? `Loaded character: ${characterPath}`
          : `Sample character fallback: ${loadResult.errorMessage ?? 'unknown reason'}`,
      );

      const characterRenderAssets = { airDocument: character.air, imageDataSpritePack: character.sprites };
      const startGameLoop = () => {
        if (disposed) return;
        rendererRef.current = new CanvasRenderer(canvas, character.air, null, character.sprites, {
          1: characterRenderAssets,
          2: characterRenderAssets,
        });
        inputRef.current = new BrowserInput(window);
        p1CommandBufferRef.current = new InputBuffer(60);
        p2CommandBufferRef.current = new InputBuffer(60);
        p1HitPauseCommandBufferRef.current = new HitPauseCommandBuffer(character.cmd);
        p2HitPauseCommandBufferRef.current = new HitPauseCommandBuffer(character.cmd);

        const tick = (timestamp: number) => {
        const frameIntervalMs = runtimeSettingsRef.current.frameIntervalMs;
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
        frameNoRef.current += 1;
        const input = inputRef.current;
        const config = inputConfigRef.current;
        const pressedKeys = input?.getPressedKeys(config) ?? new Set<string>();
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

        if (
          inputSnapshot.system.restartRound &&
          !restartPressedRef.current &&
          canRestartRound(nextRoundState)
        ) {
          const restarted = restartRound(nextRoundState.roundNo, runtimeSettingsRef.current.roundTime, characterPowerMax);
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
        } else if (nextRoundState.phase !== 'intro') {
          const pauseAtFrameStart = nextState.pause ?? createInitialPauseState();
          if (ENABLE_RUNTIME_FALLBACKS) {
            nextState = applyFallbackControls(nextState, p1Input, p2Input);
          }

          const soundEvents: SoundRuntimeEvent[] = [];
          const explodRuntimeEvents: ExplodControllerEvent[] = [];
          const pauseEvents: PauseControllerEvent[] = [];
          const projectileEvents: ProjectileState[] = [];
          const runtimeEventDiagnosticLines: string[] = [];
          const cnsStartedAt = performance.now();
          const cnsResult = stepCnsStateRuntime(nextState, character.cns, {
            p1Commands,
            p2Commands,
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
            onProjectileCreate: (projectile) => projectileEvents.push({
              ...projectile,
              hitBox: getProjectileHitBox(character.air, projectile.animNo) ?? projectile.hitBox,
            }),
            pauseState: pauseAtFrameStart,
            screenWidth: canvas.width,
            roundState: nextRoundState.phase === 'fight' ? 2 : 3,
            roundNo: nextRoundState.roundNo,
            roundsExisted: Math.max(0, nextRoundState.roundNo - 1),
            matchNo: 1,
            matchOver: nextRoundState.phase === 'ko' || nextRoundState.phase === 'timeOver',
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

          const pauseDuringFrame = nextState.pause ?? createInitialPauseState();
          const pausedThisFrame = isGamePaused(pauseDuringFrame);
          const beforePhysicsState = nextState;
          const beforePhysicsPlayers = nextState.players;
          if (ENABLE_RUNTIME_FALLBACKS) {
            nextState = stepFallbackMotion(nextState);
          } else {
            nextState = stepCnsPhysicsMotion(nextState, character.cns);
          }
          if (pausedThisFrame) {
            nextState = {
              ...nextState,
              players: [
                canEntityMoveDuringPause(pauseDuringFrame, 1) ? nextState.players[0] : beforePhysicsPlayers[0],
                canEntityMoveDuringPause(pauseDuringFrame, 2) ? nextState.players[1] : beforePhysicsPlayers[1],
              ],
            };
          }

          nextState = applyFallbackStageRules(nextState);
          if (pausedThisFrame) {
            nextState = { ...nextState, hitEvents: [] };
          } else {
            nextState = resolveFallbackHits(
              nextState,
              character.air,
              aiLogEnabled && runtimeSettingsRef.current.hitDiagnostics,
              beforePhysicsState,
            );
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
            players: nextState.players.map((player) => (
              !pausedThisFrame || canEntityMoveDuringPause(pauseDuringFrame, player.id)
                ? { ...player, afterImage: stepAfterImage(player.afterImage, player) }
                : player
            )) as GameState['players'],
            helpers: {
              ...nextState.helpers,
              entries: nextState.helpers.entries.map((helper) => (
                !pausedThisFrame || canEntityMoveDuringPause(pauseDuringFrame, helper.entityId)
                  ? { ...helper, player: { ...helper.player, afterImage: stepAfterImage(helper.player.afterImage, helper.player) } }
                  : helper
              )),
            },
          };

          if (!pausedThisFrame) nextRoundState = stepRoundState(nextRoundState, nextState);
          nextScore = updateRoundScore(nextScore, nextRoundState);
          nextFeedback = updateHitFeedback(nextFeedback, nextState);
          nextState = { ...nextState, pause: stepPauseState(pauseDuringFrame) };
        } else {
          nextRoundState = stepRoundState(nextRoundState, nextState);
          nextScore = updateRoundScore(nextScore, nextRoundState);
          nextFeedback = updateHitFeedback(nextFeedback, nextState);
        }
        for (const event of environmentShakeEvents) nextFeedback = startEnvironmentShake(nextFeedback, event);

        restartPressedRef.current = inputSnapshot.system.restartRound;

        const simulationFinishedAt = performance.now();
        const explodRenderDiagnosticLines = rendererRef.current?.render(nextState, nextFeedback, nextRoundState, nextScore, {
          collisionBoxesVisible: runtimeSettingsRef.current.collisionBoxesVisible,
          diagnosticsEnabled: aiLogEnabled,
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

        const humanStateChanged = nextCnsTraces.some((trace) => trace.stateNo !== trace.afterStateNo);
        const captureHumanLogThisFrame = humanLogEnabled && (
          humanStateChanged
          || timestamp - lastHumanLogCaptureTimeRef.current >= HUMAN_LOG_CAPTURE_INTERVAL_MS
        );
        if (captureHumanLogThisFrame) lastHumanLogCaptureTimeRef.current = timestamp;
        const formatDetailedDiagnostics = aiLogEnabled || captureHumanLogThisFrame;
        const nextRoundDebugLine = formatDetailedDiagnostics ? formatRoundState(nextRoundState) : '';
        const nextScoreDebugLine = formatDetailedDiagnostics ? formatRoundScore(nextScore) : '';
        const nextCnsDebugLines = formatDetailedDiagnostics ? formatCnsRuntimeDebugOverlay(nextCnsTraces) : [];
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
          cnsLines: nextCnsDebugLines,
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
      setShowCharacterFiles(true);
      setActivePage('static-files');
    }
  };

  const handleSelectRuntimeFrame = (entry: RuntimeLogIndexEntry) => {
    setSelectedReadableEntry(getReadableRuntimeEntry(readableEntryStoreRef.current, entry.frameNo, entry.p1StateNo));
    setShowHumanDetail(true);
  };

  const showLatestRuntimeHistory = () => {
    setSelectedReadableEntry(getLatestReadableRuntimeEntry({
      indexStore: readableIndexStoreRef.current,
      entryStore: readableEntryStoreRef.current,
    }));
    setShowHumanDetail(true);
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
    setShowHumanDetail(false);
    setStateTransitionLogLines(['history cleared']);
    invalidateRuntimeHistoryViews();
  };

  const setRuntimeSettings = (nextSettings: RuntimeSettings) => {
    const normalized = normalizeRuntimeSettings(nextSettings);
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
      setShowHumanDetail(false);
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
    <div className="app-shell">
      <header className="app-header">
        <h1>WebMUGEN</h1>
        <p>CharacterLoader app integration prototype</p>
      </header>

      <AppPageTabs activePage={activePage} onChange={setActivePage} />

      <section
        className={`top-panel ${activePage === 'play' ? 'active' : 'hidden'}`}
        aria-hidden={activePage !== 'play'}
      >
        <section className="stage-panel">
            <div className="stage-viewport">
              <canvas
                ref={canvasRef}
                width={960}
                height={540}
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
                indexEntries={runtimeLogIndexEntries}
                selectedEntry={selectedReadableEntry}
                onSelectFrame={handleSelectRuntimeFrame}
                showHumanDetail={showHumanDetail}
                onToggleHumanDetail={() => setShowHumanDetail((visible) => !visible)}
                autoScrollIndex={runtimeFrameIndexAutoScroll}
                onToggleAutoScrollIndex={() => setRuntimeFrameIndexAutoScroll((enabled) => !enabled)}
                onShowLatest={showLatestRuntimeHistory}
                onOpenCnsSource={openCnsSource}
              />
            )}
            {activeDebugTab === 'runtime-human' && !runtimeSettings.humanLogEnabled && <p>Human log is OFF in Settings.</p>}
            {activeDebugTab === 'runtime-ai' && runtimeSettings.aiLogEnabled && (
              <AiRuntimePanel
                visibleRuntimeHistory={visibleAiHistory}
                historyWindow={aiHistoryWindow}
                onShowLatest={showLatestRuntimeHistory}
              />
            )}
            {activeDebugTab === 'runtime-ai' && !runtimeSettings.aiLogEnabled && <p>AI log is OFF in Settings.</p>}
            {activeDebugTab === 'manual' && <ManualPanel />}
            {activeDebugTab === 'settings' && (
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
            )}
          </section>
      </section>

      <section
        className={`top-panel ${activePage === 'static-files' ? 'active' : 'hidden'}`}
        aria-hidden={activePage !== 'static-files'}
      >
        {activePage === 'static-files' ? (
          <section className="debug-panel page-debug-panel">
            <StaticDebugPanel
              loadMessage={loadMessage}
              staticDebugInfo={staticDebugInfo}
              coverageDebugLines={coverageDebugLines}
              sourceFiles={cnsSourceFiles}
              selectedSource={selectedCnsSource}
              onOpenSource={openCnsSource}
              sourceScrollPositionsRef={cnsSourceScrollPositionsRef}
              air={loadedAir}
              sprites={loadedSprites}
              showCharacterFiles={showCharacterFiles}
              onToggleCharacterFiles={() => setShowCharacterFiles((visible) => !visible)}
            />
          </section>
        ) : null}
      </section>
    </div>
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
  if (state === 'loading') {
    return <div className="audio-start-overlay" role="status">キャラクターを読み込んでいます…</div>;
  }
  if (state === 'unlocking-audio') {
    return <div className="audio-start-overlay" role="status">音声を開始しています…</div>;
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
          クリックまたはキー入力で開始
        </button>
      </div>
    );
  }
  return (
    <div className="audio-start-overlay" role="alert">
      <p>音声を開始できませんでした。再試行するか、音声なしで開始してください。</p>
      <div className="audio-start-actions">
        <button
          autoFocus
          className="audio-start-primary"
          onPointerDown={() => onUserGesture('pointerdown')}
          onKeyDown={() => onUserGesture('keydown')}
          type="button"
        >
          音声を再試行
        </button>
        <button onClick={onContinueWithoutAudio} type="button">音声なしで開始</button>
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
  return (
    <section className="settings-section" aria-label="audio settings">
      <h2>Audio</h2>
      <p>AudioContext: {status}</p>
      <div className="runtime-settings-grid">
        <button type="button" onClick={onUnlock}>Unlock Audio</button>
        <button type="button" onClick={onTest} disabled={status !== 'unlocked'}>Test loaded SND sample</button>
        <button type="button" onClick={onStopTest}>Stop test SND sample</button>
        <button type="button" onClick={onPanTest}>Pan test SND left</button>
        <label>
          <input aria-label="Mute all audio" type="checkbox" checked={muted} onChange={(event) => onMutedChange(event.currentTarget.checked)} />
          Mute
        </label>
        <label>
          Master volume: {masterVolume}%
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
        </label>
      </div>
      <p>{diagnostic}</p>
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

export function RuntimeSettingsPanel({
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
          Power Infinite
          <select
            aria-label="Power Infinite"
            value={settings.infinitePower}
            onChange={(event) => onChange({
              ...settings,
              infinitePower: event.currentTarget.value as RuntimeSettings['infinitePower'],
            })}
          >
            <option value="off">OFF</option>
            <option value="p1">P1</option>
            <option value="p2">P2</option>
            <option value="both">P1 + P2</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.hitDiagnostics}
            disabled={!settings.aiLogEnabled}
            onChange={(event) => onChange({ ...settings, hitDiagnostics: event.currentTarget.checked })}
          />
          AI hit lifecycle details
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
      <h3>Debug / Logging</h3>
      <div className="runtime-settings-grid">
        <label>
          <input
            aria-label="Human log enabled"
            type="checkbox"
            checked={settings.humanLogEnabled}
            onChange={(event) => onChange({ ...settings, humanLogEnabled: event.currentTarget.checked })}
          />
          Human log
          <small>Records detailed diagnostics for reading on screen. May increase load.</small>
        </label>
        <label>
          <input
            aria-label="AI log enabled"
            type="checkbox"
            checked={settings.aiLogEnabled}
            onChange={(event) => onChange({ ...settings, aiLogEnabled: event.currentTarget.checked })}
          />
          AI log
          <small>Records detailed AI_RUNTIME frame dumps. May increase load.</small>
        </label>
        <label>
          <input
            aria-label="Collision boxes visible"
            type="checkbox"
            checked={settings.collisionBoxesVisible}
            onChange={(event) => onChange({ ...settings, collisionBoxesVisible: event.currentTarget.checked })}
          />
          Collision boxes
          <small>Draws Clsn1, Clsn2, Push, and projectile debug rectangles.</small>
        </label>
        <label>
          <input
            aria-label="State history visible"
            type="checkbox"
            checked={settings.stateHistoryVisible}
            onChange={(event) => onChange({ ...settings, stateHistoryVisible: event.currentTarget.checked })}
          />
          State history
          <small>Shows the lightweight state/input/damage history at the lower left.</small>
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
  return (
    <nav className="page-tabs" aria-label="main page tabs">
      <button className={activePage === 'play' ? 'active' : ''} onClick={() => onChange('play')} type="button">
        Game / Runtime
      </button>
      <button className={activePage === 'static-files' ? 'active' : ''} onClick={() => onChange('static-files')} type="button">
        Static Info / Character Files
      </button>
    </nav>
  );
}

function DebugTabsV2({ activeTab, onChange }: { activeTab: DebugTab; onChange: (tab: DebugTab) => void }) {
  return (
    <nav className="debug-tabs" aria-label="debug tabs">
      <button className={activeTab === 'runtime-human' ? 'active' : ''} onClick={() => onChange('runtime-human')} type="button">
        Human Runtime
      </button>
      <button className={activeTab === 'runtime-ai' ? 'active' : ''} onClick={() => onChange('runtime-ai')} type="button">
        AI Runtime
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
              選択中フレームをコピー
            </button>
            <button
              type="button"
              onClick={() => onCopy('全人間用ログ', formatAllReadableRuntimeEntriesCopy({
                indexStore: readableIndexStoreRef.current,
                entryStore: readableEntryStoreRef.current,
              }))}
            >
              全人間用ログをコピー
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => onCopy('表示中のAI用ログ', visibleAiLines.join('\n'))}>
              表示中AIログをコピー
            </button>
            <button type="button" onClick={() => onCopy('全AI用ログ', allAiLinesRef.current.join('\n'))}>
              全AIログをコピー
            </button>
          </>
        )}
        <button type="button" className="danger" onClick={onClearLogs}>
          ログをクリア
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
  loadMessage,
  staticDebugInfo,
  coverageDebugLines,
  sourceFiles,
  selectedSource,
  onOpenSource,
  sourceScrollPositionsRef,
  air,
  sprites,
  showCharacterFiles,
  onToggleCharacterFiles,
}: {
  loadMessage: string;
  staticDebugInfo: StaticDebugInfo;
  coverageDebugLines: string[];
  sourceFiles: CharacterSourceFile[];
  selectedSource: CnsSourceSelection;
  onOpenSource: (selection: CnsSourceSelection) => void;
  sourceScrollPositionsRef: MutableRefObject<Record<string, number>>;
  air: AirDocument | null;
  sprites: ImageDataSpritePack | null;
  showCharacterFiles: boolean;
  onToggleCharacterFiles: () => void;
}) {
  return (
    <div className="debug-grid">
      <DebugBlock title="Character / DEF" lines={[loadMessage, ...staticDebugInfo.characterRows]} />
      <DebugBlock title="CMD Commands" lines={staticDebugInfo.commandRows} />
      <DebugBlock title="CNS Coverage" lines={coverageDebugLines} />
      <section className="debug-block character-source-toggle-panel">
        <div className="collapsible-debug-header">
          <h2>Character Files</h2>
          <button type="button" onClick={onToggleCharacterFiles}>{showCharacterFiles ? 'Hide' : 'Show'}</button>
        </div>
        {showCharacterFiles ? (
          <CharacterSourceFilesViewer files={sourceFiles} selection={selectedSource} onSelect={onOpenSource} scrollPositionsRef={sourceScrollPositionsRef} air={air} sprites={sprites} />
        ) : (
          <p className="debug-note">Character Files is hidden to keep the debug UI light. Use Show or a StateDef link in the runtime log.</p>
        )}
      </section>
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

const RuntimeFrameIndexList = memo(function RuntimeFrameIndexList({
  entries,
  selectedKey,
  autoScroll,
  onToggleAutoScroll,
  onSelectFrame,
}: {
  entries: RuntimeLogIndexEntry[];
  selectedKey: string | null;
  autoScroll: boolean;
  onToggleAutoScroll: () => void;
  onSelectFrame: (entry: RuntimeLogIndexEntry) => void;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!autoScroll) return;
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [autoScroll, entries]);

  return (
    <>
      <div className="runtime-frame-index-controls">
        <span>{autoScroll ? '最新ログへ自動追従' : '手動スクロール'}</span>
        <button type="button" onClick={onToggleAutoScroll}>
          {autoScroll ? '手動に切替' : '自動追従に切替'}
        </button>
      </div>
      <div className="runtime-frame-index" ref={listRef}>
        {entries.length > 0 ? (
          <div className="runtime-frame-index-header">
            <span>時</span>
            <span>f</span>
            <span>S</span>
            <span>A</span>
            <span>S2</span>
            <span>A2</span>
          </div>
        ) : null}
        {entries.length === 0 ? (
          <div className="history-empty">ログが生成されると、ここにフレーム索引が追加されます。</div>
        ) : entries.map((entry) => (
          <button
            type="button"
            className={`runtime-frame-index-row ${entry.key === selectedKey ? 'selected' : ''}`}
            key={entry.id}
            onClick={() => onSelectFrame(entry)}
          >
            <span>{entry.timestamp}</span>
            <span>{entry.frameNo}</span>
            <span className="runtime-index-state">{entry.p1StateNo}</span>
            <span className="runtime-index-anim">{entry.p1AnimNo}</span>
            <span className="runtime-index-state secondary">{entry.p2StateNo}</span>
            <span className="runtime-index-anim secondary">{entry.p2AnimNo}</span>
          </button>
        ))}
      </div>
    </>
  );
});

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

function HumanRuntimePanel({
  indexEntries,
  selectedEntry,
  onSelectFrame,
  showHumanDetail,
  onToggleHumanDetail,
  autoScrollIndex,
  onToggleAutoScrollIndex,
  onShowLatest,
  onOpenCnsSource,
}: {
  indexEntries: RuntimeLogIndexEntry[];
  selectedEntry: ReadableRuntimeEntry | null;
  onSelectFrame: (entry: RuntimeLogIndexEntry) => void;
  showHumanDetail: boolean;
  onToggleHumanDetail: () => void;
  autoScrollIndex: boolean;
  onToggleAutoScrollIndex: () => void;
  onShowLatest: () => void;
  onOpenCnsSource: (selection: CnsSourceSelection) => void;
}) {
  return (
    <section className="runtime-history-panel">
      <div className="runtime-human-grid">
        <section>
          <h2>Runtime Frame Index</h2>
          <p className="debug-note">Only frames with retained detail logs are listed. Multiple StateNo values in one frame appear as separate rows.</p>
          <RuntimeFrameIndexList
            entries={indexEntries}
            selectedKey={selectedEntry?.key ?? null}
            autoScroll={autoScrollIndex}
            onToggleAutoScroll={onToggleAutoScrollIndex}
            onSelectFrame={onSelectFrame}
          />
        </section>
        <section>
          <div className="collapsible-debug-header">
            <h2>Human Detail Log</h2>
            <button type="button" onClick={onToggleHumanDetail}>{showHumanDetail ? 'Hide' : 'Show'}</button>
          </div>
          <p className="debug-note">Selecting a row loads only that one detail entry. New logs do not replace the current selection.</p>
          <button type="button" className="history-latest-button" onClick={onShowLatest}>Show Latest Frame</button>
          {!showHumanDetail ? (
            <div className="history-empty">Detail log is hidden. Select a frame or show the latest frame to open it.</div>
          ) : selectedEntry ? (
            <>
              <div className="history-selected-frame">
                selected frame={selectedEntry.frameNo} P1 state={selectedEntry.p1StateNo} P2 state={selectedEntry.p2StateNo}
              </div>
              <div className="human-detail-grid">
                <section className="human-detail-player" aria-label="P1 detail log">
                  <h3>P1</h3>
                  <ReadableRuntimeHistoryMarkup lines={selectedEntry.lines} onOpenCnsSource={onOpenCnsSource} />
                </section>
                <section className="human-detail-player" aria-label="P2 detail log">
                  <h3>P2</h3>
                  <ReadableRuntimeHistoryMarkup lines={selectedEntry.p2Lines} onOpenCnsSource={onOpenCnsSource} />
                </section>
              </div>
            </>
          ) : (
            <div className="history-empty">Select a frame on the left.</div>
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
  return (
    <section className="runtime-history-panel">
      <h2>AI用 詳細ログ</h2>
      <p className="debug-note">
        入力、Command、State、Controller、Physics、成立情報を解析用に蓄積します。Timeだけの変化では増えません。
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

function HistoryWindowStatus({
  visible,
  window,
  onShowLatest,
}: {
  visible: VisibleRuntimeHistory;
  window: RuntimeHistoryWindow;
  onShowLatest: () => void;
}) {
  const modeLabel = window.mode === 'latest'
    ? '最新'
    : `フレーム ${window.targetFrame} 周辺`;
  const targetStatus = window.mode === 'aroundFrame' && !visible.targetFound
    ? ' / 対象フレームは保持範囲外です'
    : '';

  return (
    <div className="history-window-status">
      <span>表示: {modeLabel}</span>
      <span>範囲: {visible.rangeLabel}</span>
      <span>件数: {visible.visibleEntries}/{visible.totalEntries}{targetStatus}</span>
      {window.mode !== 'latest' ? (
        <button type="button" onClick={onShowLatest}>最新へ戻る</button>
      ) : null}
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
    const valueText = parseControllerValueText(controllerMatch[2]);
    return (
      <div className={`readable-history-controller ${passed ? 'passed' : 'failed'}`}>
        {source ? (
          <button
            className="readable-controller-link"
            type="button"
            onClick={() => onOpenCnsSource(source)}
            title={`${source.path}:${source.line}`}
          >
            {controllerMatch[1]}{valueText ? ` | ${valueText}` : ''}
          </button>
        ) : (
          <strong>{controllerMatch[1]}{valueText ? ` | ${valueText}` : ''}</strong>
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
  if (trimmed.startsWith('P1 StateNo=') || trimmed.startsWith('P2 StateNo=')) return <ReadableRuntimeHistoryMeta line={trimmed} />;
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

function CharacterSourceFilesViewer({
  files,
  selection,
  onSelect,
  scrollPositionsRef,
  air,
  sprites,
}: {
  files: CharacterSourceFile[];
  selection: CnsSourceSelection;
  onSelect: (selection: CnsSourceSelection) => void;
  scrollPositionsRef?: MutableRefObject<Record<string, number>>;
  air?: AirDocument | null;
  sprites?: ImageDataSpritePack | null;
}) {
  const localScrollPositionsRef = useRef<Record<string, number>>({});
  const effectiveScrollPositionsRef = scrollPositionsRef ?? localScrollPositionsRef;
  const codeRef = useRef<HTMLDivElement | null>(null);
  const [selectedAirActionNo, setSelectedAirActionNo] = useState<number | null>(null);
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
        <div className="character-source-detail">
          <div className="character-source-summary">
            <h3>Summary</h3>
            {sourceOutline.length === 0 ? (
              <div className="character-source-summary-empty">outline=-</div>
            ) : (
              <div className="character-source-summary-list">
                {sourceOutline.map((item) => (
                  <button
                    key={`${item.kind}-${item.line}-${item.label}`}
                    type="button"
                    onClick={() => handleOutlineClick(item)}
                    className={item.kind === 'air-action' && item.value === effectiveAirActionNo ? 'active' : ''}
                    title={`line ${item.line}`}
                  >
                    <span>{item.label}</span>
                    <small>:{item.line}</small>
                  </button>
                ))}
              </div>
            )}
            {selectedFile.kind === 'air' ? (
              <AirAnimationPreview
                actionNo={effectiveAirActionNo}
                air={air ?? null}
                sprites={sprites ?? null}
              />
            ) : null}
          </div>
        <div className="character-source-content">
          <div className="cns-source-title">
            <strong>{selectedFile.label}</strong>
            <span>{selectedFile.path}:{effectiveSelection?.line ?? 1}</span>
          </div>
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
                  <span className="cns-source-line-no">{lineNo}</span>
                  <code>{line || ' '}</code>
                </div>
              );
            })}
          </div>
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

type SourceOutlineItem = {
  kind: 'air-action' | 'statedef' | 'command' | 'section';
  label: string;
  line: number;
  value: number | string;
};

export function createSourceOutline(file: CharacterSourceFile): SourceOutlineItem[] {
  const lines = file.text.split(/\r?\n/);
  const items: SourceOutlineItem[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const lineNo = index + 1;
    const line = lines[index].trim();
    const airMatch = line.match(/^\[?\s*Begin\s+Action\s+(-?\d+)\s*\]?$/i);
    if (airMatch) {
      const actionNo = Number(airMatch[1]);
      items.push({ kind: 'air-action', label: `Begin Action ${actionNo}`, line: lineNo, value: actionNo });
      continue;
    }
    const stateMatch = line.match(/^\[\s*StateDef\s+(-?\d+)\s*\]$/i);
    if (stateMatch) {
      const stateNo = Number(stateMatch[1]);
      items.push({ kind: 'statedef', label: `StateDef ${stateNo}`, line: lineNo, value: stateNo });
      continue;
    }
    const commandSection = line.match(/^\[\s*Command\s*\]$/i);
    if (commandSection) {
      const commandName = findFollowingName(lines, index + 1);
      items.push({ kind: 'command', label: commandName ? `Command ${commandName}` : 'Command', line: lineNo, value: commandName ?? lineNo });
      continue;
    }
    const sectionMatch = line.match(/^\[\s*([^\]]+)\s*\]$/);
    if (items.length < 120 && sectionMatch && file.kind === 'def') {
      items.push({ kind: 'section', label: sectionMatch[1], line: lineNo, value: sectionMatch[1] });
    }
  }
  return items.slice(0, 500);
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
        <strong>AIR Preview</strong>
        <button type="button" onClick={() => setPlaying((value) => !value)}>
          {playing ? 'Pause' : 'Play'}
        </button>
      </div>
      <canvas ref={canvasRef} width={220} height={160} />
      <div className="air-preview-meta">
        {action ? (
          <>
            <span>Action {action.actionNo}</span>
            <span>frame {action.elements.length === 0 ? '-' : frameIndex + 1}/{action.elements.length}</span>
            <span>{element ? `sprite ${element.groupNo},${element.imageNo} time=${element.duration}` : 'sprite=-'}</span>
          </>
        ) : (
          <span>Action not selected</span>
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
  cnsLines: string[];
  traces: CnsRuntimeTrace[];
  hitDiagnosticLines?: string[];
  pressedKeys: ReadonlySet<string>;
  historyRef: MutableRefObject<string[]>;
  lastSignatureRef: MutableRefObject<string>;
  setHistoryLines: () => void;
}) {
  const stateChanged = traces.some((trace) => trace.stateNo !== trace.afterStateNo || trace.animNo !== trace.afterAnimNo);
  const controllerRan = traces.some((trace) => trace.executedControllers.length > 0 || trace.debugLines.length > 0);
  const hasInput = pressedKeys.size > 0;
  if (!hasInput && !stateChanged && !controllerRan && hitDiagnosticLines.length === 0) return;

  const snapshot = formatAiRuntimeSnapshot({
    inputLines,
    commandLines,
    physicsLines,
    roundLine,
    scoreLine,
    cnsLines,
    traces,
    hitDiagnosticLines,
    pressedKeys,
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
  cnsLines,
  traces,
  hitDiagnosticLines = [],
  pressedKeys,
}: {
  inputLines: string[];
  commandLines: string[];
  physicsLines: string[];
  roundLine: string;
  scoreLine: string;
  cnsLines: string[];
  traces: CnsRuntimeTrace[];
  hitDiagnosticLines?: string[];
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
    'SECTION hit_diagnostics',
    ...(hitDiagnosticLines.length > 0 ? hitDiagnosticLines : ['raw.hit_diagnostics=-']),
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
  setIndexEntries: (entries: RuntimeLogIndexEntry[]) => void;
}): number {
  const p1KeySummary = formatMugenPressedKeys(pressedKeys, inputConfig.players[0]);
  const p2KeySummary = formatMugenPressedKeys(pressedKeys, inputConfig.players[1]);
  const snapshots = createReadableRuntimeStateSnapshots(state, traces);
  const preparedSnapshots = snapshots.map((snapshot) => {
    const [p1, p2] = snapshot.players;
    const p1TriggerSummary = formatPlayerSatisfiedStateDefTriggerSummary(cns, snapshot, 0, p1Commands, getAnimEndTime);
    const p2TriggerSummary = formatPlayerSatisfiedStateDefTriggerSummary(cns, snapshot, 1, p2Commands, getAnimEndTime);
    const damageSummary = formatHitEventSummary(snapshot);
    return { snapshot, p1TriggerSummary, p2TriggerSummary, damageSummary, signature: [
      p1.stateNo,
      p1.animNo,
      stripReadableRuntimeValueSummaries(p1TriggerSummary),
      p2.stateNo,
      p2.animNo,
      stripReadableRuntimeValueSummaries(p2TriggerSummary),
      damageSummary,
      p1KeySummary,
      p2KeySummary,
    ].join('|') };
  });
  const signature = preparedSnapshots.map((prepared) => prepared.signature).join('||');
  if (signature === lastSignatureRef.current) return 0;

  lastSignatureRef.current = signature;
  const timestamp = new Date().toLocaleTimeString('ja-JP', { hour12: false });
  let visibleEntries: RuntimeLogIndexEntry[] | null = null;
  let generatedCharacters = 0;
  const appendedKeys = new Set<string>();
  for (const { snapshot, p1TriggerSummary, p2TriggerSummary, damageSummary } of preparedSnapshots) {
    const [p1, p2] = snapshot.players;
    const key = createReadableRuntimeEntryKey(frameNo, p1.stateNo);
    if (appendedKeys.has(key)) continue;
    appendedKeys.add(key);
    const id = nextEntryIdRef.current;
    nextEntryIdRef.current += 1;
    const lines = freezeHistoryLines([
      `---- ${timestamp} frame=${frameNo} state=${p1.stateNo} ----`,
      `P1 StateNo=${p1.stateNo} Time=${p1.stateTime} AnimNo=${p1.animNo}`,
      formatReadableStateDefLine(cns, p1.stateNo),
      p1KeySummary,
      'State Status',
      ...p1TriggerSummary.split('\n').map((line) => `  ${line}`),
      `Damage=${damageSummary}`,
      '',
    ]);
    const p2Lines = freezeHistoryLines([
      `---- ${timestamp} frame=${frameNo} state=${p2.stateNo} ----`,
      `P2 StateNo=${p2.stateNo} Time=${p2.stateTime} AnimNo=${p2.animNo}`,
      formatReadableStateDefLine(cns, p2.stateNo),
      p2KeySummary,
      'State Status',
      ...p2TriggerSummary.split('\n').map((line) => `  ${line}`),
      `Damage=${damageSummary}`,
      '',
    ]);
    generatedCharacters += [...lines, ...p2Lines].reduce((total, line) => total + line.length, 0);
    visibleEntries = appendReadableRuntimeEntry({
      indexStore: indexStoreRef.current,
      entryStore: entryStoreRef.current,
      indexEntry: createRuntimeLogIndexEntry({ id, frameNo, timestamp, state: snapshot }),
      entry: { id, key, frameNo, p1StateNo: p1.stateNo, p2StateNo: p2.stateNo, lines, p2Lines },
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

function formatReadableStateDefLine(cns: CnsDocument, stateNo: number): string {
  const stateDef = cns.states.find((state) => state.stateNo === stateNo);
  if (!stateDef) return 'StateDef=-';
  const source = stateDef.sourceFile && stateDef.sourceLine
    ? ` @ ${stateDef.sourceFile}:${stateDef.sourceLine}`
    : '';
  return `StateDef ${stateNo}${source}`;
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
      trace.debugLines.filter((line) => !/\btime=|StateTime=|animtime=|MugenAnimTime=/.test(line)).join(','),
    ].join(':')),
  ].join('|');
}

function formatPlayerSatisfiedStateDefTriggerSummary(
  cns: CnsDocument,
  state: GameState,
  playerIndex: 0 | 1,
  commands: ReadonlySet<string>,
  getAnimEndTime?: (animNo: number) => number | null,
): string {
  const [p1, p2] = state.players;
  const player = playerIndex === 0 ? p1 : p2;
  const opponent = playerIndex === 0 ? p2 : p1;
  const mugenAnimTime = calculateMugenAnimTime(player.animTime, getAnimEndTime?.(player.animNo));
  const context = { player, opponent, commands, animTime: mugenAnimTime, constants: cns, gameTime: state.frame };
  const summaries = cns.states
    .filter((stateDef) => stateDef.stateNo === player.stateNo)
    .flatMap((stateDef) => formatSatisfiedStateDefTriggers(stateDef, context));

  return summaries.length > 0 ? summaries.join('\n') : '-';
}

export function formatSatisfiedStateDefTriggers(
  stateDef: CnsStateDefinition,
  context: Parameters<typeof evaluateCnsRuntimeTrigger>[1],
): string[] {
  const controllerSummaries = stateDef.controllers
    .filter((controller) => controller.triggers.length > 0 && shouldShowReadableController(controller, context));
  const prioritized = prioritizeReadableControllers(controllerSummaries);
  const lines: string[] = [];

  prioritized.visible.forEach((controller) => {
    const passed = evaluateReadableController(controller, context);
    lines.push(formatReadableControllerHeaderOk(controller, passed, context));
    lines.push(...controller.triggers.map((trigger) => `  ${formatReadableTriggerLineOk(trigger, context)}`));
  });

  if (prioritized.hiddenCount > 0) {
    lines.push(`**...** | ${prioritized.hiddenCount} controllers hidden to keep history light`);
  }

  return lines;
}

function prioritizeReadableControllers(controllers: CnsStateController[]): { visible: CnsStateController[]; hiddenCount: number } {
  const visible: CnsStateController[] = [];
  let extraCount = 0;
  for (const controller of controllers) {
    const type = controller.type.toLowerCase();
    if (READABLE_STATE_STATUS_ALWAYS_SHOW_TYPES.has(type)) {
      visible.push(controller);
      continue;
    }
    if (extraCount < READABLE_STATE_STATUS_EXTRA_CONTROLLER_LIMIT) {
      visible.push(controller);
      extraCount += 1;
    }
  }
  return { visible, hiddenCount: Math.max(0, controllers.length - visible.length) };
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

function formatReadableControllerHeaderOk(
  controller: CnsStateController,
  passed: boolean,
  context: CnsRuntimeTriggerContext,
): string {
  const value = controller.type.toLowerCase() === 'changestate'
    ? ` -> ${readParamNumber(controller, 'value') ?? '?'}`
    : '';
  const source = controller.sourceFile && controller.sourceLine ? ` @ ${controller.sourceFile}:${controller.sourceLine}` : '';
  return `**${controller.type}${value}** | ${passed ? 'OK' : 'NG'}${formatReadableControllerValue(controller, context)}${source}`;
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
    .replace(/(\s+\|\s+value raw=`.+?`) evaluated=\S+/gm, '$1');
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
