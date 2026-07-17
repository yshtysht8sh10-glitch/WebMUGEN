import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { MutableRefObject } from 'react';
import type { CnsRuntimeTrace } from '../core/cns/CnsStateRuntime';
import { AudioStartOverlay, CHARACTER_PATH_OPTIONS, RuntimeSettingsPanel, WebMugenApp, appendRuntimeHistoryIfNeeded, createSourceOutline, drawAirPreview, findAirActionForLine, formatSatisfiedStateDefTriggers, parseControllerValueText, stripReadableRuntimeValueSummaries } from './WebMugenApp';
import { DEFAULT_RUNTIME_SETTINGS } from './RuntimeSettings';
import type { ImageDataSpritePack } from '../core/sprite/ImageDataSpriteTypes';
import { parseCnsText } from '../parser/cns/CnsParser';
import { createInitialGameState } from '../core/engine/GameState';

describe('WebMugenApp runtime history', () => {
  it('offers discovered public characters in the character picker', () => {
    expect(CHARACTER_PATH_OPTIONS).toContain('/chars/T-H-M-A.zip');
    expect(CHARACTER_PATH_OPTIONS).toContain('/chars/kfm/kfm.def');
  });

  it('starts all Issue #75 debug sinks disabled while exposing four independent Settings toggles', () => {
    const html = renderToStaticMarkup(createElement(WebMugenApp, { initialPage: 'play' }));

    expect(html).not.toContain('aria-label="stage debug overlay"');
    expect(html).toContain('Human log is OFF in Settings.');
    const settingsHtml = renderToStaticMarkup(createElement(RuntimeSettingsPanel, {
      settings: DEFAULT_RUNTIME_SETTINGS,
      onChange: () => undefined,
    }));
    expect(settingsHtml).toContain('aria-label="Human log enabled"');
    expect(settingsHtml).toContain('aria-label="AI log enabled"');
    expect(settingsHtml).toContain('aria-label="Collision boxes visible"');
    expect(settingsHtml).toContain('aria-label="State history visible"');
  });

  it('keeps the game panel mounted while leaving hidden static content unmounted', () => {
    const html = renderToStaticMarkup(createElement(WebMugenApp));

    expect(html.match(/class="top-panel/g)?.length).toBe(2);
    expect(html).toContain('class="top-panel active"');
    expect(html).toContain('class="top-panel hidden"');
    expect(html).toContain('<canvas');
    expect(html).toContain('Static Info / Character Files');
    expect(html).not.toContain('<h2>Character Files</h2>');
    expect(html).toContain('キャラクターを読み込んでいます');
  });

  it('renders the user gesture and explicit no-audio start controls without tab navigation', () => {
    const onUserGesture = vi.fn();
    const onContinueWithoutAudio = vi.fn();
    const waiting = renderToStaticMarkup(createElement(AudioStartOverlay, {
      state: 'waiting-for-user', onUserGesture, onContinueWithoutAudio,
    }));
    const unavailable = renderToStaticMarkup(createElement(AudioStartOverlay, {
      state: 'audio-unavailable', onUserGesture, onContinueWithoutAudio,
    }));

    expect(waiting).toContain('クリックまたはキー入力で開始');
    expect(unavailable).toContain('音声を再試行');
    expect(unavailable).toContain('音声なしで開始');
    expect(waiting).not.toContain('Runtime');
    expect(waiting).not.toContain('Settings');
  });

  it('mounts static content on demand while retaining one game canvas across repeated page renders', () => {
    for (let index = 0; index < 10; index += 1) {
      const activePage = index % 2 === 0 ? 'static-files' : 'play';
      const html = renderToStaticMarkup(createElement(WebMugenApp, { initialPage: activePage }));

      expect(html.match(/<canvas/g)?.length).toBe(1);
      expect(html.includes('<h2>Character Files</h2>')).toBe(activePage === 'static-files');
    }
  });

  it('stores immutable line snapshots instead of live debug array references', () => {
    const inputLines = ['keys=ArrowRight'];
    const commandLines = ['cmd p1=holdfwd'];
    const physicsLines = ['phys p1 state=20'];
    const cnsLines = ['cns p1 state=0->20'];
    const pressedKeys = new Set(['ArrowRight']);
    const historyRef: MutableRefObject<string[]> = { current: ['seed'] };
    const lastSignatureRef: MutableRefObject<string> = { current: '' };
    let renderInvalidations = 0;

    appendRuntimeHistoryIfNeeded({
      frameNo: 10,
      inputLines,
      commandLines,
      physicsLines,
      roundLine: 'round=1 phase=fight',
      scoreLine: 'score p1=0 p2=0 draw=0',
      cnsLines,
      traces: [createTrace({ stateNo: 0, afterStateNo: 20 })],
      pressedKeys,
      historyRef,
      lastSignatureRef,
      setHistoryLines: () => {
        renderInvalidations += 1;
      },
    });
    const appendedSnapshot = historyRef.current.slice();

    inputLines[0] = 'keys=-';
    commandLines[0] = 'cmd p1=-';
    physicsLines[0] = 'phys p1 state=0';
    cnsLines[0] = 'cns p1 state=20->0';
    pressedKeys.clear();
    historyRef.current[0] = 'mutated seed';

    expect(renderInvalidations).toBe(1);
    expect(appendedSnapshot.join('\n')).toContain('keys=ArrowRight');
    expect(appendedSnapshot.join('\n')).toContain('cmd p1=holdfwd');
    expect(appendedSnapshot.join('\n')).toContain('phys p1 state=20');
    expect(appendedSnapshot.join('\n')).toContain('cns p1 state=0->20');
    expect(appendedSnapshot.join('\n')).not.toContain('keys=-');
    expect(appendedSnapshot.join('\n')).not.toContain('mutated seed');
  });

  it('includes event-driven hit diagnostics in AI runtime history', () => {
    const historyRef: MutableRefObject<string[]> = { current: [] };
    const lastSignatureRef: MutableRefObject<string> = { current: '' };
    appendRuntimeHistoryIfNeeded({
      frameNo: 20,
      inputLines: ['keys=-'], commandLines: ['cmd p1=-'], physicsLines: ['phys p1=-'],
      roundLine: 'round=1', scoreLine: 'score=-', cnsLines: ['cns=-'], traces: [],
      hitDiagnosticLines: [
        'raw.hit_damage target=p2',
        '  activeHitDefId=123 lifeBefore=1000 appliedDamage=37 lifeAfter=963 source=active_hitdef ko=0',
      ],
      pressedKeys: new Set(), historyRef, lastSignatureRef, setHistoryLines: () => undefined,
    });

    expect(historyRef.current.join('\n')).toContain('SECTION hit_diagnostics');
    expect(historyRef.current.join('\n')).toContain('activeHitDefId=123');
  });

  it('does not append when only time-like values changed', () => {
    const historyRef: MutableRefObject<string[]> = { current: [] };
    const lastSignatureRef: MutableRefObject<string> = { current: '' };
    let renderInvalidations = 0;

    appendRuntimeHistoryIfNeeded({
      frameNo: 10,
      inputLines: ['keys=ArrowRight'],
      commandLines: ['cmd p1=holdfwd'],
      physicsLines: ['phys p1 state=20 time=10 anim=20:10'],
      roundLine: 'round=1 phase=fight timer=90 winner=-',
      scoreLine: 'score p1=0 p2=0 draw=0',
      cnsLines: ['cns p1 state=20->20 anim=20->20 time=10->10 animtime=10 found=1'],
      traces: [createTrace({ stateNo: 20, afterStateNo: 20, animNo: 20, afterAnimNo: 20, stateTime: 10, afterStateTime: 10, mugenAnimTime: 10 })],
      pressedKeys: new Set(['ArrowRight']),
      historyRef,
      lastSignatureRef,
      setHistoryLines: () => {
        renderInvalidations += 1;
      },
    });

    appendRuntimeHistoryIfNeeded({
      frameNo: 11,
      inputLines: ['keys=ArrowRight'],
      commandLines: ['cmd p1=holdfwd'],
      physicsLines: ['phys p1 state=20 time=11 anim=20:11'],
      roundLine: 'round=1 phase=fight timer=89 winner=-',
      scoreLine: 'score p1=0 p2=0 draw=0',
      cnsLines: ['cns p1 state=20->20 anim=20->20 time=11->11 animtime=11 found=1'],
      traces: [createTrace({ stateNo: 20, afterStateNo: 20, animNo: 20, afterAnimNo: 20, stateTime: 11, afterStateTime: 11, mugenAnimTime: 11 })],
      pressedKeys: new Set(['ArrowRight']),
      historyRef,
      lastSignatureRef,
      setHistoryLines: () => {
        renderInvalidations += 1;
      },
    });

    expect(renderInvalidations).toBe(1);
    expect(historyRef.current.join('\n')).toContain('frame=10');
    expect(historyRef.current.join('\n')).not.toContain('frame=11');
  });

  it('ignores readable trigger value summaries for history identity', () => {
    expect(stripReadableRuntimeValueSummaries([
      '**ChangeState -> 0** | NG @ char.cns:10',
      'OK `trigger1=AnimTime = 0 || values: animtime=-4  time=20`',
    ].join('\n'))).toBe([
      '**ChangeState -> 0** | NG @ char.cns:10',
      'OK `trigger1=AnimTime = 0',
    ].join('\n'));
  });

  it('shows raw and evaluated controller values in the Human Log summary', () => {
    const cns = parseCnsText(`
[Statedef 50]
[State 50, JumpAnim]
type = ChangeAnim
trigger1 = Time = 0
value = ifelse((vel x)=0, 44, ifelse((vel x)>0, 45, 46))+var(5)*4
`);
    const state = createInitialGameState();
    const player = { ...state.players[0], stateNo: 50, stateTime: 0, vx: -3, vars: { 5: 1 } };
    const lines = formatSatisfiedStateDefTriggers(cns.states[0], {
      player,
      opponent: state.players[1],
      constants: cns,
    });

    expect(lines[0]).toContain('**ChangeAnim** | OK');
    expect(lines[0]).toContain('value raw=`ifelse((vel x)=0, 44, ifelse((vel x)>0, 45, 46))+var(5)*4` evaluated=50');
    expect(parseControllerValueText(lines[0])).toBe('value: ifelse((vel x)=0, 44, ifelse((vel x)>0, 45, 46))+var(5)*4 => 50');
  });

  it('builds source outlines for AIR, CNS, and CMD files', () => {
    expect(createSourceOutline({
      path: 'demo.air',
      label: 'demo.air',
      kind: 'air',
      text: '[Begin Action 106]\n0,0,0,0,5\nBegin Action 107\n0,0,0,0,5',
    }).map((item) => `${item.label}:${item.line}`)).toEqual([
      'Begin Action 106:1',
      'Begin Action 107:3',
    ]);

    expect(createSourceOutline({
      path: 'demo.cns',
      label: 'demo.cns',
      kind: 'cns',
      text: '[StateDef 50]\ntype = A\n[StateDef 52]\ntype = S',
    }).map((item) => `${item.label}:${item.line}`)).toEqual([
      'StateDef 50:1',
      'StateDef 52:3',
    ]);

    expect(createSourceOutline({
      path: 'demo.cmd',
      label: 'demo.cmd',
      kind: 'cmd',
      text: '[Command]\nname = "FF"\ncommand = F, F',
    }).map((item) => `${item.label}:${item.line}`)).toEqual(['Command FF:1']);
  });

  it('finds the active AIR action for a source line', () => {
    const outline = createSourceOutline({
      path: 'demo.air',
      label: 'demo.air',
      kind: 'air',
      text: 'Begin Action 100\n0,0,0,0,5\nBegin Action 101\n0,0,0,0,5',
    });

    expect(findAirActionForLine(outline, 1)).toBe(100);
    expect(findAirActionForLine(outline, 2)).toBe(100);
    expect(findAirActionForLine(outline, 3)).toBe(101);
  });

  it('draws AIR Preview from the same baked RGBA and palette cache identity as runtime sprites', () => {
    const originalDocument = globalThis.document;
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { createElement: () => fakePreviewSpriteCanvas() },
    });
    try {
      const drawImage = vi.fn();
      const mainCanvas = fakePreviewMainCanvas(drawImage);
      const cache = new Map<string, HTMLCanvasElement>();
      const pack = previewPack([12, 34, 56, 255], 'sprite:10,0#0');
      const action = {
        actionNo: 15001,
        loopStartIndex: null,
        defaultClsn1: [],
        defaultClsn2: [],
        elements: [{ groupNo: 10, imageNo: 0, offsetX: 0, offsetY: 0, duration: 2, flip: '', clsn1: [], clsn2: [] }],
      };

      drawAirPreview(mainCanvas, action, 0, pack, cache);
      drawAirPreview(mainCanvas, action, 0, previewPack([90, 80, 70, 255], 'sprite:10,0#1'), cache);

      expect(drawImage.mock.calls.map(([source]) => (source as PreviewCanvas).rgba)).toEqual([
        [12, 34, 56, 255],
        [90, 80, 70, 255],
      ]);
      expect(Array.from(cache.keys())).toEqual([
        'asset=asset-a;sprite=10,0;palette=sprite:10,0#0',
        'asset=asset-a;sprite=10,0;palette=sprite:10,0#1',
      ]);
    } finally {
      Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument });
    }
  });
});

type PreviewCanvas = HTMLCanvasElement & { rgba: number[] };

function fakePreviewSpriteCanvas(): PreviewCanvas {
  const canvas = { width: 0, height: 0, rgba: [] as number[] } as unknown as PreviewCanvas;
  canvas.getContext = ((() => ({
    putImageData(imageData: ImageData) { canvas.rgba = Array.from(imageData.data); },
  })) as unknown) as HTMLCanvasElement['getContext'];
  return canvas;
}

function fakePreviewMainCanvas(drawImage: ReturnType<typeof vi.fn>): HTMLCanvasElement {
  return {
    width: 220,
    height: 160,
    getContext: () => ({
      clearRect: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(),
      lineTo: vi.fn(), stroke: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), scale: vi.fn(),
      drawImage, fillText: vi.fn(),
    }),
  } as unknown as HTMLCanvasElement;
}

function previewPack(rgba: [number, number, number, number], paletteKey: string): ImageDataSpritePack {
  return {
    cacheKey: 'asset-a',
    sprites: new Map([[
      '10,0',
      {
        groupNo: 10,
        imageNo: 0,
        xAxis: 0,
        yAxis: 0,
        paletteKey,
        imageData: { data: new Uint8ClampedArray(rgba), width: 1, height: 1 } as ImageData,
      },
    ]]),
  };
}

function createTrace(patch: Partial<CnsRuntimeTrace>): CnsRuntimeTrace {
  return {
    playerId: 1,
    stateNo: 0,
    afterStateNo: 0,
    animNo: 0,
    afterAnimNo: 0,
    stateTime: 0,
    afterStateTime: 0,
    mugenAnimTime: 0,
    stateFound: true,
    executedControllers: [],
    debugLines: [],
    ...patch,
  };
}
