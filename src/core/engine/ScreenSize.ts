import type { GameState } from './types';
import { buildPushBox } from './FallbackStageRules';
import type { MugenStage } from '../stage/MugenStage';

export const MUGEN_WORLD_ORIGIN_X = 480;
export const MUGEN_GROUND_Y = 285;

export type ScreenSizeMode = 'winmugen-800x480' | 'winmugen-classic-640x480' | 'wide-960x540';

export type ScreenSizeProfile = {
  width: number;
  height: number;
  logicalWidth: number;
  logicalHeight: number;
  renderScale: number;
};

export const SCREEN_SIZE_PROFILES: Record<ScreenSizeMode, ScreenSizeProfile> = {
  'winmugen-800x480': { width: 800, height: 480, logicalWidth: 400, logicalHeight: 240, renderScale: 2 },
  'winmugen-classic-640x480': { width: 640, height: 480, logicalWidth: 320, logicalHeight: 240, renderScale: 2 },
  'wide-960x540': { width: 960, height: 540, logicalWidth: 960, logicalHeight: 540, renderScale: 1 },
};

export function getScreenSizeProfile(mode: ScreenSizeMode): ScreenSizeProfile {
  return SCREEN_SIZE_PROFILES[mode];
}

export function resolveCanvasViewport(width: number, height: number): Pick<ScreenSizeProfile, 'logicalWidth' | 'logicalHeight' | 'renderScale'> {
  if (width === 800 && height === 480) {
    return { logicalWidth: 400, logicalHeight: 240, renderScale: 2 };
  }
  if (width === 640 && height === 480) {
    return { logicalWidth: 320, logicalHeight: 240, renderScale: 2 };
  }
  return { logicalWidth: width, logicalHeight: height, renderScale: 1 };
}

export function resolveViewportCamera(state: GameState, width: number, height: number): { x: number; y: number } {
  if ((width !== 320 && width !== 400) || height !== 240) return { x: 0, y: 0 };
  if (state.camera?.viewportWidth === width && state.camera.viewportHeight === height) {
    return { x: state.camera.x, y: state.camera.y };
  }
  return resolveDesiredCamera(state, width, height);
}

export function applyViewportCameraRules(state: GameState, width: number, height: number, stage?: MugenStage | null): GameState {
  if ((width !== 320 && width !== 400) || height !== 240) {
    return { ...state, camera: { x: 0, y: 0, viewportWidth: width, viewportHeight: height } };
  }

  let nextState = state;
  let clampedPlayers: string[] = [];
  for (let pass = 0; pass < 2; pass += 1) {
    const camera = stage
      ? resolveStageCamera(nextState, width, height, stage)
      : resolveDesiredCamera(nextState, width, height);
    const result = keepPlayersInsideCamera(
      nextState,
      camera.x,
      width,
      stage?.screenBound.left ?? 4,
      stage?.screenBound.right ?? 4,
    );
    nextState = { ...nextState, players: result.players };
    clampedPlayers = [...clampedPlayers, ...result.clampedPlayers];
  }
  const camera = stage
    ? resolveStageCamera(nextState, width, height, stage)
    : resolveDesiredCamera(nextState, width, height);
  const uniqueClampedPlayers = [...new Set(clampedPlayers)];
  return {
    ...nextState,
    camera: { ...camera, viewportWidth: width, viewportHeight: height },
    hitDiagnosticLines: [
      ...(nextState.hitDiagnosticLines ?? []),
      `raw.camera viewport=${width}x${height} pos=(${formatNumber(camera.x)},${formatNumber(camera.y)}) clamped=${uniqueClampedPlayers.length > 0 ? uniqueClampedPlayers.join(',') : 'none'}`,
    ],
  };
}

function resolveStageCamera(state: GameState, width: number, height: number, stage: MugenStage): { x: number; y: number } {
  const xFollowers = state.players.filter((player) => player.screenBound?.moveCameraX !== false);
  const yFollowers = state.players.filter((player) => player.screenBound?.moveCameraY !== false);
  const xSources = xFollowers.length > 0 ? xFollowers : state.players;
  const ySources = yFollowers.length > 0 ? yFollowers : state.players;
  const previousStageX = state.camera?.viewportWidth === width && state.camera.viewportHeight === height
    ? state.camera.x + width / 2 - MUGEN_WORLD_ORIGIN_X
    : stage.camera.startX;
  const minimumX = Math.min(...xSources.map((player) => player.x));
  const maximumX = Math.max(...xSources.map((player) => player.x));
  const tension = Math.max(0, Math.min(width / 2, stage.camera.tension));
  let stageX = previousStageX;
  let leftEdge = MUGEN_WORLD_ORIGIN_X + stageX - width / 2;
  if (minimumX < leftEdge + tension) stageX -= leftEdge + tension - minimumX;
  leftEdge = MUGEN_WORLD_ORIGIN_X + stageX - width / 2;
  if (maximumX > leftEdge + width - tension) stageX += maximumX - (leftEdge + width - tension);
  stageX = clamp(stageX, stage.camera.boundLeft, stage.camera.boundRight);

  const highestY = Math.min(...ySources.map((player) => player.y));
  const heightAboveFloor = Math.max(0, MUGEN_GROUND_Y - highestY);
  const desiredStageY = heightAboveFloor > stage.camera.floorTension
    ? stage.camera.startY - (heightAboveFloor - stage.camera.floorTension) * clamp(stage.camera.verticalFollow, 0, 1)
    : stage.camera.startY;
  const stageY = clamp(desiredStageY, stage.camera.boundHigh, stage.camera.boundLow);
  return {
    x: MUGEN_WORLD_ORIGIN_X + stageX - width / 2,
    y: MUGEN_GROUND_Y - stage.zOffset + stageY,
  };
}

function resolveDesiredCamera(state: GameState, width: number, height: number): { x: number; y: number } {
  const xFollowers = state.players.filter((player) => player.screenBound?.moveCameraX !== false);
  const yFollowers = state.players.filter((player) => player.screenBound?.moveCameraY !== false);
  const xSources = xFollowers.length > 0 ? xFollowers : state.players;
  const center = xSources.reduce((sum, player) => sum + player.x, 0) / xSources.length;
  const highestY = Math.min(...(yFollowers.length > 0 ? yFollowers : state.players).map((player) => player.y));
  const lowestY = Math.max(...(yFollowers.length > 0 ? yFollowers : state.players).map((player) => player.y));
  const verticalRise = Math.max(0, 285 - highestY);
  const desiredY = 65 - verticalRise * 0.25;
  const minimumY = lowestY - (height - 8);
  const maximumY = highestY - 8;
  const y = minimumY <= maximumY
    ? Math.max(minimumY, Math.min(65, maximumY, desiredY))
    : (minimumY + maximumY) / 2;
  return {
    x: Math.max(0, Math.min(960 - width, center - width / 2)),
    y: Math.min(65, y),
  };
}

function keepPlayersInsideCamera(
  state: GameState,
  cameraX: number,
  width: number,
  leftInset: number,
  rightInset: number,
): { players: GameState['players']; clampedPlayers: string[] } {
  const leftEdge = cameraX + Math.max(0, leftInset);
  const rightEdge = cameraX + width - Math.max(0, rightInset);
  const clampedPlayers: string[] = [];
  const players = state.players.map((player) => {
    if (player.screenBound?.value === false) return player;
    const box = buildPushBox(player);
    let offsetX = 0;
    if (box.left < leftEdge) offsetX = leftEdge - box.left;
    if (box.right + offsetX > rightEdge) offsetX -= box.right + offsetX - rightEdge;
    if (offsetX === 0) return player;
    clampedPlayers.push(`p${player.id}`);
    return { ...player, x: player.x + offsetX };
  }) as GameState['players'];
  return { players, clampedPlayers };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(Math.min(minimum, maximum), Math.min(Math.max(minimum, maximum), value));
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}
