export type WinMugenHotkeyAction =
  | 'ko-p1'
  | 'ko-p2'
  | 'life-one-both'
  | 'life-one-p1'
  | 'life-one-p2'
  | 'power-full'
  | 'restart-round'
  | 'reload-match'
  | 'time-over'
  | 'clear-debug'
  | 'screenshot'
  | 'toggle-collision-boxes'
  | 'toggle-debug-display'
  | 'force-neutral'
  | 'toggle-hud'
  | 'toggle-fast-forward'
  | 'restore-all'
  | 'toggle-pause'
  | 'frame-step';

export type WinMugenHotkeyEvent = {
  code: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  repeat?: boolean;
};

export function resolveWinMugenHotkey(event: WinMugenHotkeyEvent): WinMugenHotkeyAction | null {
  if (event.repeat || event.altKey) return null;
  const ctrl = event.ctrlKey === true;
  const shift = event.shiftKey === true;

  if (event.code === 'F1') return ctrl ? 'ko-p1' : 'ko-p2';
  if (event.code === 'F2') {
    if (ctrl) return 'life-one-p1';
    if (shift) return 'life-one-p2';
    return 'life-one-both';
  }
  if (event.code === 'F3' && !ctrl && !shift) return 'power-full';
  if (event.code === 'F4' && !ctrl) return shift ? 'reload-match' : 'restart-round';
  if (event.code === 'F5' && !ctrl && !shift) return 'time-over';
  if (event.code === 'F8' && !ctrl && !shift) return 'clear-debug';
  if (event.code === 'F12' && !ctrl && !shift) return 'screenshot';
  if (event.code === 'Space' && !ctrl && !shift) return 'restore-all';
  if (event.code === 'Pause' && !ctrl && !shift) return 'toggle-pause';
  if (event.code === 'ScrollLock' && !ctrl && !shift) return 'frame-step';
  if (!ctrl || shift) return null;

  if (event.code === 'KeyC') return 'toggle-collision-boxes';
  if (event.code === 'KeyD') return 'toggle-debug-display';
  if (event.code === 'KeyI') return 'force-neutral';
  if (event.code === 'KeyL') return 'toggle-hud';
  if (event.code === 'KeyS') return 'toggle-fast-forward';
  return null;
}

export function isEditableHotkeyTarget(target: EventTarget | null): boolean {
  const element = target as { tagName?: string; isContentEditable?: boolean } | null;
  const tagName = element?.tagName?.toUpperCase();
  return element?.isContentEditable === true || tagName === 'INPUT' || tagName === 'SELECT' || tagName === 'TEXTAREA';
}

export function isWinMugenSystemKey(code: string): boolean {
  return code === 'ControlLeft'
    || code === 'ControlRight'
    || code === 'ShiftLeft'
    || code === 'ShiftRight'
    || code === 'AltLeft'
    || code === 'AltRight'
    || code === 'Space'
    || code === 'Pause'
    || code === 'ScrollLock'
    || ['KeyC', 'KeyD', 'KeyI', 'KeyL', 'KeyS'].includes(code)
    || /^F(?:[1-9]|1[0-2])$/.test(code);
}

const STATE_ACTIONS = new Set<WinMugenHotkeyAction>([
  'ko-p1',
  'ko-p2',
  'life-one-both',
  'life-one-p1',
  'life-one-p2',
  'power-full',
  'time-over',
  'force-neutral',
  'restore-all',
]);

export function isWinMugenStateAction(action: WinMugenHotkeyAction): boolean {
  return STATE_ACTIONS.has(action);
}

export function applyWinMugenStateActions(
  state: GameState,
  roundState: RoundState,
  actions: readonly WinMugenHotkeyAction[],
  roundTimer: number,
): { state: GameState; roundState: RoundState } {
  let nextState = state;
  let nextRoundState = roundState;

  for (const action of actions) {
    if (action === 'ko-p1' || action === 'ko-p2') {
      const playerIndex = action === 'ko-p1' ? 0 : 1;
      nextState = updateRootPlayers(nextState, (player, index) => index === playerIndex ? { ...player, life: 0 } : player);
    } else if (action === 'life-one-both' || action === 'life-one-p1' || action === 'life-one-p2') {
      nextState = updateRootPlayers(nextState, (player, index) => {
        const applies = action === 'life-one-both' || (action === 'life-one-p1' ? index === 0 : index === 1);
        return applies ? { ...player, life: 1 } : player;
      });
    } else if (action === 'power-full') {
      nextState = updateRootPlayers(nextState, (player) => ({ ...player, power: player.powerMax ?? 3000 }));
    } else if (action === 'time-over') {
      nextRoundState = forceRoundTimeOver(nextRoundState, nextState);
    } else if (action === 'force-neutral') {
      nextState = {
        ...nextState,
        players: nextState.players.map(resetPlayerToNeutral) as GameState['players'],
        helpers: {
          ...nextState.helpers,
          entries: nextState.helpers.entries.map((helper) => ({ ...helper, player: resetPlayerToNeutral(helper.player) })),
        },
      };
    } else if (action === 'restore-all') {
      nextState = {
        ...nextState,
        players: nextState.players.map(restorePlayer) as GameState['players'],
        helpers: {
          ...nextState.helpers,
          entries: nextState.helpers.entries.map((helper) => ({ ...helper, player: restorePlayer(helper.player) })),
        },
      };
      if (nextRoundState.phase === 'fight') nextRoundState = { ...nextRoundState, timer: roundTimer };
    }
  }

  return { state: nextState, roundState: nextRoundState };
}

function updateRootPlayers(
  state: GameState,
  update: (player: PlayerState, index: number) => PlayerState,
): GameState {
  return { ...state, players: state.players.map(update) as GameState['players'] };
}

function resetPlayerToNeutral(player: PlayerState): PlayerState {
  return {
    ...player,
    prevStateNo: player.stateNo,
    stateNo: 0,
    stateTime: 0,
    stateType: 'S',
    moveType: 'I',
    physics: 'S',
    ctrl: false,
    animNo: 0,
    animTime: 0,
    vx: 0,
    vy: 0,
    hitPause: 0,
    activeHitDef: null,
    hitDefUsed: false,
  };
}

function restorePlayer(player: PlayerState): PlayerState {
  return {
    ...player,
    life: 1000,
    power: player.powerMax ?? 3000,
    koReason: undefined,
  };
}
import { forceRoundTimeOver, type RoundState } from '../core/engine/RoundState';
import type { GameState, PlayerState } from '../core/engine/types';
