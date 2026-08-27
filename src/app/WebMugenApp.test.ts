import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { MutableRefObject } from 'react';
import type { CnsRuntimeTrace } from '../core/cns/CnsStateRuntime';
import { AudioStartOverlay, CHARACTER_PATH_OPTIONS, CharacterSourceEditorLines, CharacterSourceFilesViewer, ContentCatalogPanel, HumanRuntimePanel, ManualPanel, RuntimeFrameIndexList, RuntimeSettingsPanel, SettingsSidebar, WebMugenApp, appendRuntimeHistoryIfNeeded, appendSourceViewHistory, calculateSourceLineWindow, createActPreviewImage, createReadableRuntimeTriggerChangeSignature, createRuntimeFrameIndexGridTemplate, createSourceNavigationTargets, createSourceOutline, createSourceViewHistoryEntry, drawAirPreview, findAirActionForLine, findAirActionSourceSelection, findStateDefSourceSelection, formatSatisfiedStateDefTriggers, parseControllerValueText, searchCharacterSourceFiles, shouldEvaluateHumanLogFrame, stripReadableRuntimeValueSummaries } from './WebMugenApp';
import { DEFAULT_RUNTIME_SETTINGS } from './RuntimeSettings';
import type { ImageDataSpritePack } from '../core/sprite/ImageDataSpriteTypes';
import { parseCnsText } from '../parser/cns/CnsParser';
import { createInitialGameState } from '../core/engine/GameState';
import { UiLanguageProvider } from './UiLanguage';

describe('WebMugenApp runtime history', () => {
  it('uses a simple auto-follow checkbox and descriptive State/Anim columns including helpers', () => {
    const html = renderToStaticMarkup(createElement(RuntimeFrameIndexList, {
      entries: [{
        id: 1, key: '10:191', frameNo: 10, timestamp: '12:00:00',
        p1StateNo: 191, p1AnimNo: 191, p2StateNo: 0, p2AnimNo: 0,
        helpers: [{ entityId: 3, helperId: 5504, rootEntityId: 1, stateNo: 5900, animNo: 42 }],
      }],
      selectedKey: '10:191', autoScroll: true, onToggleAutoScroll: () => undefined,
      onSelectFrame: () => undefined, showAnimNos: true,
    }));

    expect(html).toContain('type="checkbox"');
    expect(html).toContain('Automatically follow latest log');
    expect(html).not.toContain('Switch to manual');
    expect(html).toContain('<span>P1 State</span>');
    expect(html).toContain('<span>P1 Anim</span>');
    expect(html).toContain('<span>P2 State</span>');
    expect(html).toContain('<span>P2 Anim</span>');
    expect(html.match(/class="runtime-frame-index-row/g)).toHaveLength(1);
    expect(html).not.toContain('runtime-frame-helper-row');
    expect(html).toContain('H5504');
    expect(html).toContain('title="H5504 #3 / P1"');
    expect(html).toContain('>5900</span>');
    expect(html).toContain('<span class="runtime-index-anim helper">42</span>');
    expect(html).not.toContain('Open Begin Action 42');
    expect(createRuntimeFrameIndexGridTemplate(true, 1)).toBe('62px 52px 58px 58px 58px 58px 82px 82px');
  });

  it('removes Helper columns when the latest retained frame no longer has that Helper', () => {
    const html = renderToStaticMarkup(createElement(RuntimeFrameIndexList, {
      entries: [{
        id: 1, key: '10:0', frameNo: 10, timestamp: '12:00:00',
        p1StateNo: 0, p1AnimNo: 0, p2StateNo: 0, p2AnimNo: 0,
        helpers: [{ entityId: 3, helperId: 5504, rootEntityId: 1, stateNo: 5506, animNo: 19731 }],
      }, {
        id: 2, key: '11:0', frameNo: 11, timestamp: '12:00:01',
        p1StateNo: 0, p1AnimNo: 0, p2StateNo: 0, p2AnimNo: 0, helpers: [],
      }],
      selectedKey: '11:0', autoScroll: true, onToggleAutoScroll: () => undefined,
      onSelectFrame: () => undefined, showAnimNos: true,
    }));

    expect(html).not.toContain('H5504');
    expect(html).not.toContain('5506');
    expect(html).not.toContain('19731');
    expect(html).toContain('grid-template-columns:62px 52px 58px 58px 58px 58px');
  });

  it('renders one entity detail tab at a time while retaining Helper tabs', () => {
    const html = renderToStaticMarkup(createElement(HumanRuntimePanel, {
      captureMode: 'all-frames',
      indexEntries: [],
      selectedEntry: {
        id: 1, key: '10:191', frameNo: 10, p1StateNo: 191, p2StateNo: 0,
        lines: ['P1 StateNo=191 Anim=191 Time=79'],
        p2Lines: ['P2 StateNo=0 Anim=0 Time=79'],
        helperLogs: [{ key: 'helper-3', label: 'H5504', lines: ['H5504 #3 StateNo=5900 Anim=42 Time=4'] }],
      },
      onSelectFrame: () => undefined,
      autoScrollIndex: true,
      onToggleAutoScrollIndex: () => undefined,
      onOpenAnimationSource: () => undefined,
      onOpenCnsSource: () => undefined,
      onCaptureModeChange: () => undefined,
    }));

    expect(html.match(/role="separator"/g)).toHaveLength(1);
    expect(html).toContain('<option value="state-transition">StateNo changed</option>');
    expect(html).toContain('Detail log entities');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('role="tab" type="button">H5504</button>');
    expect(html).toContain('H5504');
    expect(html).not.toContain('aria-label="H5504 detail log"');
    expect(html).toContain('aria-label="P1 detail log"');
    expect(html).toContain('class="readable-history-anim readable-history-anim-link"');
    expect(html.indexOf('Anim=191')).toBeLessThan(html.indexOf('Time=79'));
    expect(html).toContain('<span>--:--:--</span><strong>f=10</strong>');
    expect(html).not.toContain('selected frame=10 P1 state=191 P2 state=0');
  });

  it('retains only frames containing a root or Helper StateNo transition in state-transition mode', () => {
    expect(shouldEvaluateHumanLogFrame('state-transition', [
      createTrace({ playerId: 1, stateNo: 0, afterStateNo: 0 }),
      createTrace({ playerId: 2, stateNo: 20, afterStateNo: 20 }),
    ])).toBe(false);
    expect(shouldEvaluateHumanLogFrame('state-transition', [
      createTrace({ playerId: 2, stateNo: 0, afterStateNo: 3110 }),
    ])).toBe(true);
    expect(shouldEvaluateHumanLogFrame('state-transition', [
      createTrace({ playerId: 1, entityId: 3, stateNo: 5504, afterStateNo: 5506 }),
    ])).toBe(true);
    expect(shouldEvaluateHumanLogFrame('state-transition', [
      createTrace({ playerId: 2, externalEntryFromStateNo: 0, stateNo: 3425, afterStateNo: 3425 }),
    ])).toBe(true);
  });

  it('shows a Helper tab from the selected frame even before its detail text is available', () => {
    const html = renderToStaticMarkup(createElement(HumanRuntimePanel, {
      captureMode: 'all-frames',
      indexEntries: [{
        id: 1, key: '10:191', frameNo: 10, timestamp: '12:00:00',
        p1StateNo: 191, p1AnimNo: 191, p2StateNo: 0, p2AnimNo: 0,
        helpers: [{ entityId: 4, helperId: 5504, rootEntityId: 1, stateNo: 5506, animNo: 19731 }],
      }],
      selectedEntry: {
        id: 1, key: '10:191', frameNo: 10, p1StateNo: 191, p2StateNo: 0,
        lines: ['P1 StateNo=191 Anim=191 Time=79'], p2Lines: ['P2 StateNo=0 Anim=0 Time=79'],
      },
      onSelectFrame: () => undefined,
      autoScrollIndex: true,
      onToggleAutoScrollIndex: () => undefined,
      onOpenCnsSource: () => undefined,
      onCaptureModeChange: () => undefined,
    }));

    expect(html).toContain('role="tab" type="button">H5504</button>');
    expect(html).not.toContain('type="checkbox" checked=""/>H5504');
  });

  it('collapses StateDef fields, triggers, and controller parameters inside the selected entity card', () => {
    const html = renderToStaticMarkup(createElement(HumanRuntimePanel, {
      captureMode: 'all-frames',
      indexEntries: [{
        id: 1, key: '343:0', frameNo: 343, timestamp: '20:21:13',
        p1StateNo: 0, p1AnimNo: 0, p2StateNo: 0, p2AnimNo: 0, helpers: [],
      }],
      selectedEntry: {
        id: 1, key: '343:0', frameNo: 343, p1StateNo: 0, p2StateNo: 0,
        lines: [
          '---- 20:21:13 frame=343 state=0 ----',
          'P1 StateNo=0 Anim=0 Time=0',
          'StateDef 0 @ demo.cns:1',
          'STATEDEF_PARAM `type = S`',
          'STATEDEF_PARAM `physics = S`',
          'STATEDEF_PARAM `sprpriority = 0`',
          'keys=-',
          '**HitDef** | ACTIVE | value raw=`1` evaluated=1 @ demo.cns:8',
          '  OK `trigger1=Time = 0`',
          'PARAM `hitsound = s630, 0`',
        ],
        p2Lines: [],
      },
      onSelectFrame: () => undefined,
      autoScrollIndex: true,
      onToggleAutoScrollIndex: () => undefined,
      onOpenAnimationSource: () => undefined,
      onOpenCnsSource: () => undefined,
      onCaptureModeChange: () => undefined,
    }));

    expect(html).toContain('<span>20:21:13</span><strong>f=343</strong>');
    expect(html).not.toContain('state=0</strong>');
    expect(html).not.toContain('Show Latest Frame');
    expect(html).not.toContain('frame=343 state=0');
    expect(html).toContain('StateDef 0</button><span class="readable-statedef-time">Time=0</span>');
    expect(html).toContain('>Anim=0</button>');
    expect(html).not.toContain('>P1 </span>');
    expect(html).not.toContain('StateNo=0</button>');
    expect(html).not.toContain('keys=-');
    expect(html).toContain('▼ parameters (3)');
    expect(html).toContain('▼ triggers (1)');
    expect(html).toContain('▼ parameters (2)');
    expect(html).toContain('>HitDef</button>');
    expect(html).not.toContain('HitDef | value:');
  });

  it('resolves an Anim number to the matching AIR Begin Action line', () => {
    expect(findAirActionSourceSelection([{
      path: '/chars/test/test.air', label: 'test.air', kind: 'air',
      text: '[Begin Action 0]\n0,0,0,0,1\n\n[Begin Action 19731]\n1,0,0,0,1',
    }], 19731)).toEqual({ path: '/chars/test/test.air', line: 4 });
    expect(findAirActionSourceSelection([], 19731)).toBeNull();
  });

  it('offers discovered public characters in the character picker', () => {
    expect(CHARACTER_PATH_OPTIONS).toContain('/chars/T-H-M-A.zip');
    expect(CHARACTER_PATH_OPTIONS).toContain('/chars/kfm/kfm.def');
  });

  it('starts all Issue #75 debug sinks disabled while exposing four independent Settings toggles', () => {
    const html = renderToStaticMarkup(createElement(WebMugenApp, { initialPage: 'play' }));

    expect(html).not.toContain('aria-label="stage debug overlay"');
    expect(html).toContain('Human log is disabled in Settings.');
    const settingsHtml = renderToStaticMarkup(createElement(RuntimeSettingsPanel, {
      settings: DEFAULT_RUNTIME_SETTINGS,
      onChange: () => undefined,
    }));
    expect(settingsHtml).toContain('aria-label="Human log enabled"');
    expect(settingsHtml).toContain('aria-label="AI log enabled"');
    expect(settingsHtml).toContain('aria-label="Collision boxes visible"');
    expect(settingsHtml).toContain('aria-label="State history visible"');
    expect(settingsHtml).toContain('aria-label="Human log capture mode"');
    expect(settingsHtml).toContain('When trigger ON/OFF changes');
    expect(settingsHtml).toContain('aria-label="Practice Mode"');
    expect(settingsHtml).toContain('Recover at 0 life and remove the round time limit.');
    expect(settingsHtml).toContain('aria-label="Logical screen size"');
    expect(settingsHtml).not.toContain('aria-label="Gauge design"');
    expect(settingsHtml).not.toContain('aria-label="Stage design"');
    expect(settingsHtml).not.toContain('aria-label="Stage ZIP path"');
    expect(settingsHtml).toContain('Extended Hi-Res 800×480 (400×240 coordinates)');
    expect(settingsHtml).toContain('WinMUGEN Classic 640×480 (320×240 coordinates)');
    expect(settingsHtml).toContain('Wide 960×540 (16:9)');
    const appHtml = renderToStaticMarkup(createElement(WebMugenApp, { initialPage: 'play' }));
    expect(appHtml).toContain('width="800" height="480"');
    expect(appHtml).toContain('DEVELOPMENT MODE');
  });

  it('keeps normal Settings while omitting developer settings in public presentation', () => {
    const html = renderToStaticMarkup(createElement(RuntimeSettingsPanel, {
      settings: { ...DEFAULT_RUNTIME_SETTINGS, humanLogEnabled: true, aiLogEnabled: true },
      onChange: () => undefined,
      showDeveloperSettings: false,
    }));
    expect(html).toContain('Game time');
    expect(html).toContain('Practice mode');
    expect(html).not.toContain('Gauge design');
    expect(html).not.toContain('Stage design');
    expect(html).not.toContain('Human log');
    expect(html).not.toContain('AI log');
    expect(html).not.toContain('Collision boxes');
    expect(html).not.toContain('State history');
    expect(html).not.toContain('Frame duration');
    expect(html).not.toContain('Stage ZIP path');
    expect(html).not.toContain('MUGEN Stage ZIP');
  });

  it('splits Runtime settings into General, Display, and Developer pages', () => {
    const renderPage = (page: 'general' | 'display' | 'developer') => renderToStaticMarkup(createElement(RuntimeSettingsPanel, {
      settings: DEFAULT_RUNTIME_SETTINGS,
      onChange: () => undefined,
      showDeveloperSettings: true,
      page,
    }));
    const general = renderPage('general');
    const display = renderPage('display');
    const developer = renderPage('developer');

    expect(general).toContain('Game time');
    expect(general).toContain('Practice mode');
    expect(general).not.toContain('Logical screen size');
    expect(display).toContain('Logical screen size');
    expect(display).toContain('Collision boxes');
    expect(display).not.toContain('Human log');
    expect(developer).toContain('Frame duration');
    expect(developer).toContain('Human log');
    expect(developer).toContain('AI log');
    expect(developer).not.toContain('Game time');
  });

  it('keeps Developer settings in the Public sidebar while removing Publisher settings', () => {
    const development = renderToStaticMarkup(createElement(SettingsSidebar, {
      activePage: 'publisher', canPublishDefaults: true, showDeveloperSettings: true, onSelect: () => undefined,
    }));
    const publicBuild = renderToStaticMarkup(createElement(SettingsSidebar, {
      activePage: 'content', canPublishDefaults: false, showDeveloperSettings: true, onSelect: () => undefined,
    }));

    expect(development).toContain('Publisher settings');
    expect(development).toContain('Developer');
    expect(publicBuild).not.toContain('Publisher settings');
    expect(publicBuild).toContain('Developer');
    expect(publicBuild).toContain('Content');
    expect(publicBuild).toContain('General');
    expect(publicBuild).toContain('Input');
    expect(publicBuild).toContain('Audio');
    expect(publicBuild).toContain('Display');
  });

  it('identifies the engine in Stage and LifeBar catalog options', () => {
    const catalog = { version: 1 as const, totalEntries: 5, rejectedEntries: 0, issues: [], entries: [
      { id: 'hero', name: 'Hero', kind: 'character' as const, engine: 'winmugen' as const, path: '/chars/hero.def' },
      { id: 'fresh', name: 'Fresh', kind: 'stage' as const, engine: 'webmugen' as const, path: 'builtin:stage:fresh' },
      { id: 'arena', name: 'Arena', kind: 'stage' as const, engine: 'winmugen' as const, path: '/stages/arena.def' },
      { id: 'fresh-hud', name: 'Fresh HUD', kind: 'lifebar' as const, engine: 'webmugen' as const, path: 'builtin:lifebar:fresh-hud' },
      { id: 'classic-hud', name: 'Classic HUD', kind: 'lifebar' as const, engine: 'winmugen' as const, path: '/lifebars/winmugen/classic.def' },
    ] };
    const html = renderToStaticMarkup(createElement(ContentCatalogPanel, {
      catalog,
      settings: { catalogPath: '/content/catalog.json', characterId: 'hero', stageId: 'fresh', lifeBarId: 'fresh-hud', characterPath: '/chars/hero.def', paletteNo: 9 },
      readResult: null, selectionSource: { character: 'settings', stage: 'settings' }, canManage: false, canGenerate: false,
      onSelect: () => undefined, onPaletteChange: () => undefined, onPathChange: () => undefined, onReload: () => undefined,
    }));

    expect(html).toContain('[WinMUGEN] Hero');
    expect(html).toContain('[WebMUGEN] Fresh');
    expect(html).toContain('[WinMUGEN] Arena');
    expect(html).toContain('[WebMUGEN] Fresh HUD');
    expect(html).toContain('[WinMUGEN] Classic HUD');
    expect(html).toContain('aria-label="Character palette"');
    expect(html).toContain('<option value="9" selected="">p9</option>');
    expect(html).toContain('<option value="12">p12</option>');
    expect(html).not.toContain('class="content-settings-group content-list-group"');
    expect(html).not.toContain('Selected by settings');

    const developmentHtml = renderToStaticMarkup(createElement(ContentCatalogPanel, {
      catalog,
      settings: { catalogPath: '/content/catalog.json', characterId: 'hero', stageId: 'fresh', lifeBarId: 'fresh-hud', characterPath: '/chars/hero.def', paletteNo: 9 },
      readResult: { catalog, status: 'success', sourcePath: '/content/catalog.json', fallbackUsed: false, issues: [] },
      selectionSource: { character: 'settings', stage: 'settings' }, canManage: true, canGenerate: true,
      onSelect: () => undefined, onPaletteChange: () => undefined, onPathChange: () => undefined, onReload: () => undefined,
    }));
    expect(developmentHtml).toContain('class="content-settings-group content-selection-group"');
    expect(developmentHtml).toContain('class="content-settings-group content-list-group"');
    expect(developmentHtml).toContain('Content list file');
    expect(developmentHtml).toContain('Catalog Generator');
    expect(developmentHtml).toContain('External Character');
    expect(developmentHtml).toContain('External Stage');
    expect(developmentHtml).toContain('External LifeBar');
    expect(developmentHtml).toContain('Catalog output');
    expect(developmentHtml).toContain('Load content list');
    expect(developmentHtml).toContain('aria-label="Catalog source location"');
    expect(developmentHtml).toContain('aria-pressed="true" class="active" type="button">Local</button>');
    expect(developmentHtml).not.toContain('Direct file path');
    expect(developmentHtml).not.toContain('Place character files under public/chars/');
    expect(developmentHtml).toContain('>1</strong>');
    expect(developmentHtml).toContain('>2</strong>');
  });

  it('updates the shared URL when the selected Character or Stage changes', () => {
    const catalog = { version: 1 as const, totalEntries: 5, rejectedEntries: 0, issues: [], entries: [
      { id: 'itoko', name: 'Itoko', kind: 'character' as const, engine: 'winmugen' as const, path: '/chars/itoko.zip' },
      { id: 'hero', name: 'Hero', kind: 'character' as const, engine: 'winmugen' as const, path: '/chars/hero.def' },
      { id: 'fresh-clasic', name: 'Fresh Classic', kind: 'stage' as const, engine: 'webmugen' as const, path: 'builtin:stage:fresh-clasic' },
      { id: 'arena', name: 'Arena', kind: 'stage' as const, engine: 'winmugen' as const, path: '/stages/arena.def' },
      { id: 'fresh-hud', name: 'Fresh HUD', kind: 'lifebar' as const, engine: 'webmugen' as const, path: 'builtin:lifebar:fresh-hud' },
    ] };
    const renderContent = (characterId: string, stageId: string) => renderToStaticMarkup(createElement(ContentCatalogPanel, {
      catalog,
      settings: { catalogPath: '/content/catalog.json', characterId, stageId, lifeBarId: 'fresh-hud', characterPath: '/chars/itoko.zip', paletteNo: 1 },
      readResult: null,
      selectionSource: { character: 'settings', stage: 'settings' },
      canManage: false,
      canGenerate: false,
      canShare: true,
      shareUrlBase: { origin: 'https://example.com', pathname: '/WebMUGEN/' },
      onSelect: () => undefined,
      onPaletteChange: () => undefined,
      onPathChange: () => undefined,
      onReload: () => undefined,
    }));

    expect(renderContent('itoko', 'fresh-clasic'))
      .toContain('value="https://example.com/WebMUGEN/?character=itoko&amp;stage=fresh-clasic"');
    expect(renderContent('hero', 'fresh-clasic'))
      .toContain('value="https://example.com/WebMUGEN/?character=hero&amp;stage=fresh-clasic"');
    expect(renderContent('hero', 'arena'))
      .toContain('value="https://example.com/WebMUGEN/?character=hero&amp;stage=arena"');
  });

  it('renders shared URL controls independently of content management', () => {
    const catalog = { version: 1 as const, totalEntries: 3, rejectedEntries: 0, issues: [], entries: [
      { id: 'itoko', name: 'Itoko', kind: 'character' as const, engine: 'winmugen' as const, path: '/chars/itoko.zip' },
      { id: 'fresh-clasic', name: 'Fresh Classic', kind: 'stage' as const, engine: 'webmugen' as const, path: 'builtin:stage:fresh-clasic' },
      { id: 'fresh-hud', name: 'Fresh HUD', kind: 'lifebar' as const, engine: 'webmugen' as const, path: 'builtin:lifebar:fresh-hud' },
    ] };
    const html = renderToStaticMarkup(createElement(ContentCatalogPanel, {
      catalog,
      settings: { catalogPath: '/content/catalog.json', characterId: 'itoko', stageId: 'fresh-clasic', lifeBarId: 'fresh-hud', characterPath: '/chars/itoko.zip', paletteNo: 1 },
      readResult: null,
      selectionSource: { character: 'settings', stage: 'settings' },
      canManage: false,
      canGenerate: false,
      canShare: true,
      shareUrlBase: { origin: 'https://example.com', pathname: '/' },
      onSelect: () => undefined,
      onPaletteChange: () => undefined,
      onPathChange: () => undefined,
      onReload: () => undefined,
    }));

    expect(html).toContain('Share URL');
    expect(html).toContain('aria-label="Share URL"');
    expect(html).toContain('>Copy</button>');
    expect(html).toContain('class="content-settings-group content-selection-group"');
    expect(html).not.toContain('class="content-settings-group content-list-group"');
  });

  it('keeps the game panel mounted while leaving hidden static and Settings content unmounted', () => {
    const html = renderToStaticMarkup(createElement(WebMugenApp));

    expect(html.match(/class="top-panel/g)?.length).toBe(3);
    expect(html).toContain('class="top-panel active"');
    expect(html).toContain('class="top-panel hidden"');
    expect(html).toContain('<canvas');
    expect(html).toContain('class="game-canvas"');
    expect(html).toContain('class="stage-viewport" style="width:800px"');
    expect(html).toContain('Character Files');
    expect(html).not.toContain('<h2>Character Files</h2>');
    expect(html).toContain('Loading character');
  });

  it('exposes Settings as a top-level page with a left menu and one selected pane', () => {
    const html = renderToStaticMarkup(createElement(WebMugenApp, { initialPage: 'settings' }));
    const pageTabs = html.slice(html.indexOf('class="page-tabs"'), html.indexOf('</nav>', html.indexOf('class="page-tabs"')));
    const debugTabs = html.slice(html.indexOf('class="debug-tabs"'), html.indexOf('</nav>', html.indexOf('class="debug-tabs"')));

    expect(pageTabs).toContain('Settings');
    expect(debugTabs).not.toContain('Settings');
    expect(html).toContain('class="debug-panel page-debug-panel settings-page-panel"');
    expect(html).toContain('class="settings-workspace"');
    expect(html).toContain('class="settings-sidebar"');
    expect(html).toContain('aria-current="page"');
    expect(html).not.toContain('class="input-config-panel settings-section"');
    expect(html).toContain('Use current settings as publisher defaults');
    expect(html).toContain('Restore publisher defaults');
  });

  it('shows the package-managed application version beside the WebMUGEN title', () => {
    const html = renderToStaticMarkup(createElement(WebMugenApp));

    expect(html).toContain('<div class="app-title-row"><h1>WebMUGEN</h1>');
    expect(html).toContain(`aria-label="WebMUGEN version ${__WEBMUGEN_VERSION__}"`);
    expect(html).toContain(`>Ver. ${__WEBMUGEN_VERSION__}</span>`);
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

    expect(waiting).toContain('Click or press a key to start');
    expect(unavailable).toContain('Retry audio');
    expect(unavailable).toContain('Continue without audio');
    expect(waiting).not.toContain('Runtime');
    expect(waiting).not.toContain('Settings');
  });

  it('renders one language at a time and exposes the stage language toggle', () => {
    const english = renderToStaticMarkup(createElement(WebMugenApp));
    const japanese = renderToStaticMarkup(createElement(UiLanguageProvider, { language: 'ja' },
      createElement(AudioStartOverlay, {
        state: 'waiting-for-user', onUserGesture: () => undefined, onContinueWithoutAudio: () => undefined,
      }),
    ));
    expect(english).toContain('aria-label="Switch display language to Japanese"');
    const headerEnd = english.indexOf('</header>');
    expect(english.indexOf('class="language-toggle"')).toBeLessThan(headerEnd);
    expect(english.slice(english.indexOf('class="stage-viewport"'), english.indexOf('</section>', english.indexOf('class="stage-viewport"')))).not.toContain('language-toggle');
    expect(english).toContain('Game / Runtime');
    expect(english).not.toContain('ゲーム・実行状況');
    expect(japanese).toContain('クリックまたはキー入力で開始');
    expect(japanese).not.toContain('Click or press a key to start');
  });

  it('documents implemented WinMUGEN system shortcuts and explicit limitations', () => {
    const html = renderToStaticMarkup(createElement(UiLanguageProvider, { language: 'ja' }, createElement(ManualPanel)));

    expect(html).toContain('WinMUGEN互換のシステム操作');
    expect(html).toContain('<kbd>F4</kbd>');
    expect(html).toContain('現在のラウンドを最初からやり直す');
    expect(html).toContain('<kbd>Scroll Lock</kbd>');
    expect(html).toContain('未対応');
    expect(html).toContain('Ctrl＋数字');
  });

  it('mounts static content on demand while retaining one game canvas across repeated page renders', () => {
    for (let index = 0; index < 10; index += 1) {
      const activePage = index % 2 === 0 ? 'static-files' : 'play';
      const html = renderToStaticMarkup(createElement(WebMugenApp, { initialPage: activePage }));

      expect(html.match(/<canvas/g)?.length).toBe(1);
      expect(html.includes('<h2>Character Files</h2>')).toBe(activePage === 'static-files');
    }
  });

  it('keeps the Character Files page dedicated to the always-visible file viewer', () => {
    const html = renderToStaticMarkup(createElement(WebMugenApp, { initialPage: 'static-files' }));

    expect(html).toContain('<h2>Character Files</h2>');
    expect(html).not.toContain('Character / DEF');
    expect(html).not.toContain('CMD Commands');
    expect(html).not.toContain('CNS Coverage');
    expect(html).not.toContain('StateDef List');
    expect(html).not.toContain('>Hide<');
  });

  it('renders edit/save, syntax scopes, a movable divider, plain text, and external file styling', () => {
    const files = [
      { path: 'Demo/Demo.def', label: 'Demo.def', text: '[Info]\nname = "Demo" ; title', kind: 'def' as const, editable: true },
      { path: 'Demo/readme.txt', label: 'readme.txt', text: 'ordinary notes', kind: 'text' as const, editable: true },
      { path: '/chars/common.cmd', label: 'common.cmd', text: '[Command]', kind: 'common' as const, editable: true, external: true },
    ];
    const html = renderToStaticMarkup(createElement(CharacterSourceFilesViewer, {
      files,
      selection: { path: 'Demo/Demo.def', line: 1 },
      onSelect: () => undefined,
      onSave: async () => undefined,
    }));

    expect(html).toContain('>Edit<');
    expect(html).toContain('>Save<');
    expect(html).toContain('role="separator"');
    expect(html.match(/role="separator"/g)?.length).toBe(4);
    expect(html).toContain('aria-label="Resize Map and View History"');
    expect(html).toContain('VS Code Dark 2026');
    expect(html).toContain('syntax-theme-vscode-dark-2026');
    expect(html).toContain('>Map<');
    expect(html).toContain('source-syntax-entity');
    expect(html).toContain('>キャラ<');
    expect(html).toContain('>エンジン<');
    expect(html).toContain('kind-cmd');
    expect(html).toContain('common.cmd');

    const textHtml = renderToStaticMarkup(createElement(CharacterSourceFilesViewer, {
      files,
      selection: { path: 'Demo/readme.txt', line: 1 },
      onSelect: () => undefined,
      onSave: async () => undefined,
    }));
    expect(textHtml).toContain('source-syntax-plain');
    expect(textHtml).toContain('ordinary notes');
    expect(textHtml).not.toContain('outline=-');
  });

  it('keeps Character Files browsable without exposing editing when no save capability is provided', () => {
    const html = renderToStaticMarkup(createElement(CharacterSourceFilesViewer, {
      files: [{
        path: 'Demo/Demo.cns', label: 'Demo.cns', text: '[StateDef 100]\ntype = S', kind: 'cns', editable: true,
      }],
      selection: { path: 'Demo/Demo.cns', line: 1 },
      onSelect: () => undefined,
    }));

    expect(html).toContain('<h2>Character Files</h2>');
    expect(html).toContain('Demo.cns');
    expect(html).toContain('StateDef');
    expect(html).toContain('aria-label="Highlight line 1"');
    expect(html).not.toContain('>Edit<');
    expect(html).not.toContain('>Save<');
    expect(html).not.toContain('aria-label="Character file editor"');
  });

  it('searches every text source by line, including unsaved overrides, while excluding binary files', () => {
    const files = [
      { path: 'Demo/Demo.cns', label: 'Demo.cns', text: 'type = Null\ntrigger1 = ctrl', kind: 'cns' as const },
      { path: 'Demo/Demo.cmd', label: 'Demo.cmd', text: 'command = "a"', kind: 'cmd' as const },
      { path: 'Demo/readme.txt', label: 'readme.txt', text: 'トリガーの説明', kind: 'text' as const },
      { path: 'Demo/Demo.sff', label: 'Demo.sff', text: 'trigger must not be searched', kind: 'sff' as const },
    ];

    const result = searchCharacterSourceFiles(files, 'TRIGGER', {
      'Demo/Demo.cmd': 'triggerall = command = "a"\ntrigger1 = ctrl',
    });

    expect(result.searchableFileCount).toBe(3);
    expect(result.totalMatchCount).toBe(3);
    expect(result.results).toMatchObject([
      { path: 'Demo/Demo.cns', line: 2, sourceLine: 'trigger1 = ctrl', matchStart: 0, matchLength: 7 },
      { path: 'Demo/Demo.cmd', line: 1, sourceLine: 'triggerall = command = "a"', matchStart: 0, matchLength: 7 },
      { path: 'Demo/Demo.cmd', line: 2, sourceLine: 'trigger1 = ctrl', matchStart: 0, matchLength: 7 },
    ]);
    expect(result.results.some((match) => match.path.endsWith('.sff'))).toBe(false);
  });

  it('reports total cross-file matches when the rendered result list is limited', () => {
    const result = searchCharacterSourceFiles([{
      path: 'Demo/Demo.cns', label: 'Demo.cns', kind: 'cns', text: 'trigger1 = 1\ntrigger2 = 1\ntrigger3 = 1',
    }], 'trigger', {}, 2);

    expect(result.results).toHaveLength(2);
    expect(result.totalMatchCount).toBe(3);
    expect(result.truncated).toBe(true);
  });

  it('exposes Map and Search All Files tabs with the global search shortcut', () => {
    const html = renderToStaticMarkup(createElement(CharacterSourceFilesViewer, {
      files: [
        { path: 'Demo/Demo.cns', label: 'Demo.cns', text: 'trigger1 = ctrl', kind: 'cns' as const },
        { path: 'Demo/Demo.sff', label: 'Demo.sff', text: '', kind: 'sff' as const },
      ],
      selection: { path: 'Demo/Demo.cns', line: 1 },
      onSelect: () => undefined,
    }));

    expect(html).toContain('role="tablist"');
    expect(html).toContain('>Map<');
    expect(html).toContain('>Search All Files<');
    expect(html).toContain('aria-keyshortcuts="Control+Shift+F Meta+Shift+F"');
  });

  it('links constant animation and State destinations while browsing', () => {
    const cnsFile = {
      path: 'Demo/Demo.cns', label: 'Demo.cns', kind: 'cns' as const, editable: true,
      text: '[StateDef 100]\nanim = 103\n[State 100, Route]\ntype = ChangeState\nvalue = 3201\n[State 100, Helper]\ntype = Helper\nstateno = 3201\n[State 100, Animation]\ntype = ChangeAnim\nvalue = 103\n[State 100, Borrowed animation]\ntype = ChangeAnim2\nvalue = 104\n[State 100, Custom hit]\ntype = HitDef\np1stateno = 3201\np2stateno = 3202\n[StateDef 3201]\ntype = S\n[StateDef 3202]\ntype = A',
    };
    const airFile = {
      path: 'Demo/Demo.air', label: 'Demo.air', kind: 'air' as const, editable: true,
      text: '[Begin Action 103]\n0,0,0,0,1\n[Begin Action 104]\n0,0,0,0,1',
    };
    const files = [cnsFile, airFile];
    const targets = createSourceNavigationTargets(cnsFile, files);

    expect(targets.get(2)).toMatchObject({ kind: 'animation', value: 103, selection: { path: 'Demo/Demo.air', line: 1 } });
    expect(targets.get(5)).toMatchObject({ kind: 'state', value: 3201, selection: { path: 'Demo/Demo.cns', line: 19 } });
    expect(targets.get(8)).toMatchObject({ kind: 'state', value: 3201, selection: { path: 'Demo/Demo.cns', line: 19 } });
    expect(targets.get(11)).toMatchObject({ kind: 'animation', value: 103, selection: { path: 'Demo/Demo.air', line: 1 } });
    expect(targets.get(14)).toMatchObject({ kind: 'animation', value: 104, selection: { path: 'Demo/Demo.air', line: 3 } });
    expect(targets.get(17)).toMatchObject({ kind: 'state', value: 3201, selection: { path: 'Demo/Demo.cns', line: 19 } });
    expect(targets.get(18)).toMatchObject({ kind: 'state', value: 3202, selection: { path: 'Demo/Demo.cns', line: 21 } });
    expect(findStateDefSourceSelection(files, 3201, cnsFile.path)).toEqual({ path: 'Demo/Demo.cns', line: 19 });

    const html = renderToStaticMarkup(createElement(CharacterSourceFilesViewer, {
      files,
      selection: { path: cnsFile.path, line: 1 },
      onSelect: () => undefined,
      onSave: async () => undefined,
    }));
    expect(html).toContain('title="Open Begin Action 103"');
    expect(html.match(/title="Open Begin Action 103"/g)).toHaveLength(2);
    expect(html).toContain('title="Open Begin Action 104"');
    expect(html.match(/title="Open StateDef 3201"/g)).toHaveLength(3);
    expect(html).toContain('title="Open StateDef 3202"');
    expect(html).toContain('aria-label="Highlight line 1"');
  });

  it('windows large source files while keeping the selected line mounted', () => {
    expect(calculateSourceLineWindow(100, 50)).toEqual({ start: 0, end: 100 });
    expect(calculateSourceLineWindow(10_000, 5_000)).toEqual({ start: 4599, end: 5399 });
    expect(calculateSourceLineWindow(10_000, 9_999, 10)).toEqual({ start: 0, end: 800 });

    const text = Array.from({ length: 10_000 }, (_, index) => `line ${index + 1}`).join('\n');
    const html = renderToStaticMarkup(createElement(CharacterSourceFilesViewer, {
      files: [{ path: 'Demo/Large.cns', label: 'Large.cns', text, kind: 'cns' as const, editable: true }],
      selection: { path: 'Demo/Large.cns', line: 5_000 },
      onSelect: () => undefined,
    }));
    expect(html).toContain('aria-label="Highlight line 5000"');
    expect(html).not.toContain('aria-label="Highlight line 1"');
    expect(html.match(/class="cns-source-line /g)?.length).toBe(800);
  });

  it('deduplicates highlighted source locations in newest-first view history', () => {
    const files = [{ path: 'Demo/Demo.cns', label: 'Demo.cns', kind: 'cns' as const, text: '[StateDef 100]\ntype = S' }];
    const first = createSourceViewHistoryEntry(files, { path: 'Demo/Demo.cns', line: 1 });
    const second = createSourceViewHistoryEntry(files, { path: 'Demo/Demo.cns', line: 2 });
    expect(first).toMatchObject({ label: 'Demo.cns', line: 1, sourceLine: '[StateDef 100]' });
    expect(second).not.toBeNull();

    const history = appendSourceViewHistory(appendSourceViewHistory([first!], second!), first!);
    expect(history.map((entry) => entry.line)).toEqual([1, 2]);

    const html = renderToStaticMarkup(createElement(CharacterSourceFilesViewer, {
      files,
      history,
      selection: { path: 'Demo/Demo.cns', line: 1 },
      onSelect: () => undefined,
    }));
    expect(html).toContain('>View History<');
    expect(html).toContain('Demo.cns:1');
    expect(html).toContain('[StateDef 100]');
  });

  it('keeps visible line numbers in the editor highlight layer', () => {
    const html = renderToStaticMarkup(createElement(CharacterSourceEditorLines, {
      kind: 'cns',
      path: 'Demo/Demo.cns',
      source: 'type = ChangeState\nvalue = 3201',
    }));

    expect(html).toContain('data-line-number="1"');
    expect(html).toContain('data-line-number="2"');
    expect(html).not.toContain('character-source-navigation-link');
  });

  it('renders SFF sprite, registration, and applied palette metadata', () => {
    const pack = previewPack([12, 34, 56, 255], 'sprite:10,0#0');
    pack.palettes = new Map([['sprite:10,0#0', { bytes: new Uint8Array(768), indexOrder: 'normal' }]]);
    const html = renderToStaticMarkup(createElement(CharacterSourceFilesViewer, {
      files: [{ path: 'Demo/Demo.sff', label: 'Demo.sff', text: '', kind: 'sff', primary: true }],
      selection: { path: 'Demo/Demo.sff', line: 1 },
      onSelect: () => undefined,
      onSave: async () => undefined,
      sprites: pack,
    }));

    expect(html).toContain('SFF sprite preview');
    expect(html).toContain('group,image = 10,0');
    expect(html).toContain('registration = x:0 y:0');
    expect(html).toContain('applied palette colors');
    expect(html).toContain('Fit / Center');
  });

  it('renders every SFF sprite in the Map without a 600-item cutoff', () => {
    const sprites = new Map(Array.from({ length: 601 }, (_, imageNo) => [
      `${imageNo},0`,
      {
        groupNo: imageNo, imageNo: 0, xAxis: 0, yAxis: 0,
        imageData: { data: new Uint8ClampedArray([0, 0, 0, 0]), width: 1, height: 1 } as ImageData,
      },
    ] as const));
    const html = renderToStaticMarkup(createElement(CharacterSourceFilesViewer, {
      files: [{ path: 'Demo/Demo.sff', label: 'Demo.sff', text: '', kind: 'sff' as const, primary: true }],
      selection: { path: 'Demo/Demo.sff', line: 1 },
      onSelect: () => undefined,
      sprites: { sprites },
    }));

    expect(html).toContain('Group 600');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('Showing first 600 matches');
  });

  it('does not leave empty sprite rows behind collapsed SFF groups', () => {
    const sprites = new Map(Array.from({ length: 98 }, (_, imageNo) => [
      `10520,${imageNo}`,
      {
        groupNo: 10520, imageNo, xAxis: 0, yAxis: 0,
        imageData: { data: new Uint8ClampedArray([0, 0, 0, 0]), width: 1, height: 1 } as ImageData,
      },
    ] as const));
    const html = renderToStaticMarkup(createElement(CharacterSourceFilesViewer, {
      files: [{ path: 'Demo/Demo.sff', label: 'Demo.sff', text: '', kind: 'sff' as const, primary: true }],
      selection: { path: 'Demo/Demo.sff', line: 1 },
      onSelect: () => undefined,
      sprites: { sprites },
    }));

    expect(html.match(/class="sff-sprite-entry"/g)).toHaveLength(1);
    expect(html).toContain('Group 10520');
    expect(html).not.toContain('sff-sprite-child');
  });

  it('starts StateDef controllers collapsed and exposes bulk tree controls and map search', () => {
    const html = renderToStaticMarkup(createElement(CharacterSourceFilesViewer, {
      files: [{
        path: 'Demo/Demo.cns', label: 'Demo.cns', kind: 'cns' as const, editable: true,
        text: '[StateDef 100]\ntype = S\n[State 100, Voice]\ntype = PlaySnd\ntrigger1 = 1',
      }],
      selection: { path: 'Demo/Demo.cns', line: 1 },
      onSelect: () => undefined,
    }));

    expect(html).toContain('StateDef 100');
    expect(html).not.toContain('PlaySnd — Voice');
    expect(html).toContain('aria-label="Map search"');
    expect(html).toContain('全て展開');
    expect(html).toContain('全てたたむ');
  });

  it('parses SND samples for the map and manual preview', () => {
    const binary = makeViewerSnd(2, 7, new Uint8Array([82, 73, 70, 70, 4, 0, 0, 0, 87, 65, 86, 69]));
    const html = renderToStaticMarkup(createElement(CharacterSourceFilesViewer, {
      files: [{ path: 'Demo/Demo.snd', label: 'Demo.snd', kind: 'snd' as const, text: '', binary }],
      selection: { path: 'Demo/Demo.snd', line: 1 },
      onSelect: () => undefined,
    }));

    expect(html).toContain('samples: 1');
    expect(html).toContain('Group 2');
    expect(html).toContain('SND 2,7');
    expect(html).toContain('aria-label="SND map search"');
  });

  it('applies MUGEN-reversed ACT colors to retained sprite 0,0 indices', () => {
    const originalImageData = globalThis.ImageData;
    class TestImageData {
      constructor(public data: Uint8ClampedArray, public width: number, public height: number) {}
    }
    Object.defineProperty(globalThis, 'ImageData', { configurable: true, value: TestImageData });
    try {
      const act = new Uint8Array(768);
      act[(255 - 1) * 3] = 12;
      act[(255 - 1) * 3 + 1] = 34;
      act[(255 - 1) * 3 + 2] = 56;
      const sprite = {
        groupNo: 0, imageNo: 0, xAxis: 0, yAxis: 0,
        indexedPixels: new Uint8Array([0, 1]),
        imageData: { data: new Uint8ClampedArray(8), width: 2, height: 1 } as ImageData,
      };

      expect(Array.from(createActPreviewImage(sprite, act)?.data ?? [])).toEqual([
        0, 0, 0, 0,
        12, 34, 56, 255,
      ]);
    } finally {
      Object.defineProperty(globalThis, 'ImageData', { configurable: true, value: originalImageData });
    }
  });

  it('stores immutable line snapshots instead of live debug array references', () => {
    const inputLines = ['keys=ArrowRight'];
    const commandLines = ['cmd p1=holdfwd'];
    const physicsLines = ['phys p1 state=20'];
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
    pressedKeys.clear();
    historyRef.current[0] = 'mutated seed';

    expect(renderInvalidations).toBe(1);
    expect(appendedSnapshot.join('\n')).toContain('keys=ArrowRight');
    expect(appendedSnapshot.join('\n')).toContain('cmd p1=holdfwd');
    expect(appendedSnapshot.join('\n')).toContain('phys p1 state=20');
    expect(appendedSnapshot.join('\n')).toContain('trace p1 state=0->20');
    expect(appendedSnapshot.join('\n')).not.toContain('keys=-');
    expect(appendedSnapshot.join('\n')).not.toContain('mutated seed');
  });

  it('includes event-driven hit diagnostics in AI runtime history', () => {
    const historyRef: MutableRefObject<string[]> = { current: [] };
    const lastSignatureRef: MutableRefObject<string> = { current: '' };
    appendRuntimeHistoryIfNeeded({
      frameNo: 20,
      inputLines: ['keys=-'], commandLines: ['cmd p1=-'], physicsLines: ['phys p1=-'],
      roundLine: 'round=1', scoreLine: 'score=-', traces: [],
      hitDiagnosticLines: [
        'raw.hit_damage target=p2',
        '  activeHitDefId=123 lifeBefore=1000 appliedDamage=37 lifeAfter=963 source=active_hitdef ko=0',
      ],
      pressedKeys: new Set(), historyRef, lastSignatureRef, setHistoryLines: () => undefined,
    });

    expect(historyRef.current.join('\n')).toContain('SECTION event_diagnostics');
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

  it('keeps AI snapshots compact without duplicate overlay and pipeline diagnostics', () => {
    const historyRef: MutableRefObject<string[]> = { current: [] };
    appendRuntimeHistoryIfNeeded({
      frameNo: 30,
      inputLines: ['keys=ArrowDown', 'sys R=0', 'p1 D=1', 'p2 D=0'],
      commandLines: ['cmd p1=holddown', 'cmd p2=-'],
      physicsLines: ['phys p1 state=10', 'phys p2 state=0'],
      roundLine: 'round=1 phase=fight',
      scoreLine: 'score p1=0 p2=0 draw=0',
      traces: [createTrace({
        stateNo: 0,
        afterStateNo: 10,
        executedControllers: ['dbg pipe before S-1 ChangeState', 'ChangeState', 'dbg finish state=10'],
        debugLines: [
          'pipe before S-1 ChangeState v=10 state=0 run=1',
          'STATE10 05 final shouldRun=T',
          'pipe after S-1 ChangeState executed=1 before=0 after=10',
          'finish state=10',
        ],
      })],
      pressedKeys: new Set(['ArrowDown']),
      historyRef,
      lastSignatureRef: { current: '' },
      setHistoryLines: () => undefined,
    });

    const text = historyRef.current.join('\n');
    expect(historyRef.current.length).toBeLessThanOrEqual(22);
    expect(text).toContain('SECTION cns_trace');
    expect(text).toContain('execCount=1 exec=ChangeState');
    expect(text).toContain('STATE10 05 final shouldRun=T');
    expect(text).not.toContain('SECTION cns_overlay');
    expect(text).not.toContain('sys R=0');
    expect(text).not.toContain('pipe before');
    expect(text).not.toContain('pipe after');
    expect(text).not.toContain('finish state=');
    expect(text).not.toContain('hit_diagnostics=-');
  });

  it('does not retain a frame containing only the routine finish trace', () => {
    const historyRef: MutableRefObject<string[]> = { current: [] };
    appendRuntimeHistoryIfNeeded({
      frameNo: 31,
      inputLines: ['keys=-'], commandLines: ['cmd p1=-'], physicsLines: ['phys p1 state=0'],
      roundLine: 'round=1', scoreLine: 'score=-',
      traces: [createTrace({ debugLines: ['finish state=0'], executedControllers: ['dbg finish state=0'] })],
      pressedKeys: new Set(), historyRef, lastSignatureRef: { current: '' }, setHistoryLines: () => undefined,
    });

    expect(historyRef.current).toEqual([]);
  });

  it('ignores readable trigger value summaries for history identity', () => {
    expect(stripReadableRuntimeValueSummaries([
      '**ChangeState -> 0** | NG @ char.cns:10',
      'OK `trigger1=AnimTime = 0 || values: animtime=-4  time=20`',
      'PARAM `value = Time || evaluated: 20`',
    ].join('\n'))).toBe([
      '**ChangeState -> 0** | NG @ char.cns:10',
      'OK `trigger1=AnimTime = 0',
      'PARAM `value = Time`',
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

    expect(lines[0]).toContain('**ChangeAnim** | ACTIVE');
    expect(lines[0]).toContain('value raw=`ifelse((vel x)=0, 44, ifelse((vel x)>0, 45, 46))+var(5)*4` evaluated=50');
    expect(parseControllerValueText(lines[0])).toBe('value: ifelse((vel x)=0, 44, ifelse((vel x)>0, 45, 46))+var(5)*4 => 50');
  });

  it('does not treat Helper Time-only diagnostic changes as trigger changes', () => {
    const first = createReadableRuntimeTriggerChangeSignature(
      'OK `trigger1=Time >= 200 || values: time=41`\nPARAM `value = Time || evaluated: 41`',
      'OK `trigger1=1`',
      [{ key: 'helper-3', triggerSummary: 'NG `trigger1=Time >= 200 || values: time=41`' }],
    );
    const next = createReadableRuntimeTriggerChangeSignature(
      'OK `trigger1=Time >= 200 || values: time=42`\nPARAM `value = Time || evaluated: 42`',
      'OK `trigger1=1`',
      [{ key: 'helper-3', triggerSummary: 'NG `trigger1=Time >= 200 || values: time=42`' }],
    );
    const destroyed = createReadableRuntimeTriggerChangeSignature(
      'OK `trigger1=Time >= 200 || values: time=42`',
      'OK `trigger1=1`',
      [],
    );

    expect(next).toBe(first);
    expect(destroyed).not.toBe(next);
  });

  it('retains non-trigger controller parameters for the Human Log parameter disclosure', () => {
    const cns = parseCnsText(`
[Statedef 200]
[State 200, attack]
type = HitDef
trigger1 = Time = 0
attr = S, NA
hitsound = s630, 0
`);
    const state = createInitialGameState();
    const lines = formatSatisfiedStateDefTriggers(cns.states[0], {
      player: state.players[0], opponent: state.players[1], constants: cns,
    });

    expect(lines).toContain('PARAM `attr = S, NA`');
    expect(lines).toContain('PARAM `hitsound = s630, 0`');
  });

  it('keeps every State controller in Human detail instead of truncating the list', () => {
    const controllers = Array.from({ length: 18 }, (_, index) => `
[State 0, controller ${index}]
type = VarSet
trigger1 = ${index % 2}
v = ${index}
value = ${index}
`).join('');
    const cns = parseCnsText(`[StateDef 0]\ntype = S\n${controllers}`);
    const state = createInitialGameState();
    const lines = formatSatisfiedStateDefTriggers(cns.states[0], {
      player: state.players[0], opponent: state.players[1], constants: cns,
    });

    expect(lines.filter((line) => line.startsWith('**VarSet**'))).toHaveLength(18);
    expect(lines.join('\n')).not.toContain('controllers hidden');
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
      text: '[StateDef 50]\ntype = A\n[State 50, Jump]\ntype = ChangeState\ntrigger1 = Time = 0\nvalue = 52\n[State 50, Sound]\ntype = PlaySnd\n[StateDef 52]\ntype = S',
    }).map((item) => `${item.level}:${item.label}:${item.line}`)).toEqual([
      '1:StateDef 50:1',
      '2:ChangeState — Jump:3',
      '2:PlaySnd — Sound:7',
      '1:StateDef 52:9',
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

function makeViewerSnd(group: number, index: number, payload: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(24 + 16 + payload.length);
  bytes.set(Array.from('ElecbyteSnd\0').map((value) => value.charCodeAt(0)), 0);
  bytes[12] = 1;
  const view = new DataView(bytes.buffer);
  view.setUint32(16, 1, true);
  view.setUint32(20, 24, true);
  view.setUint32(24, 0, true);
  view.setUint32(28, payload.length, true);
  view.setInt32(32, group, true);
  view.setInt32(36, index, true);
  bytes.set(payload, 40);
  return bytes;
}

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
