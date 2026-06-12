import type { AirDocument } from '../../parser/air/AirTypes';
import { findAction, getCurrentAnimationElement } from '../animation/AnimationPlayer';
import type { PlayerState } from '../engine/types';
import type { ImageDataSpritePack } from './ImageDataSpriteTypes';
import type { SpritePack } from './SpriteTypes';
import { spriteKey } from './SpritePackLoader';

export type PlayerSpriteDebugInfo = {
  playerId: 1 | 2;
  animNo: number;
  animTime: number;
  actionExists: boolean;
  actionElementCount: number;
  groupNo: number | null;
  imageNo: number | null;
  key: string | null;
  hasImageDataSprite: boolean;
  hasPngSprite: boolean;
};

export type SpriteDebugInfo = {
  imageDataSpriteCount: number;
  pngSpriteCount: number;
  players: PlayerSpriteDebugInfo[];
};

export function createSpriteDebugInfo(
  players: [PlayerState, PlayerState],
  airDocument?: AirDocument,
  imageDataSpritePack?: ImageDataSpritePack | null,
  pngSpritePack?: SpritePack | null,
): SpriteDebugInfo {
  return {
    imageDataSpriteCount: imageDataSpritePack?.sprites.size ?? 0,
    pngSpriteCount: pngSpritePack?.sprites.size ?? 0,
    players: players.map((player) =>
      createPlayerSpriteDebugInfo(player, airDocument, imageDataSpritePack, pngSpritePack),
    ),
  };
}

function createPlayerSpriteDebugInfo(
  player: PlayerState,
  airDocument?: AirDocument,
  imageDataSpritePack?: ImageDataSpritePack | null,
  pngSpritePack?: SpritePack | null,
): PlayerSpriteDebugInfo {
  const action = airDocument ? findAction(airDocument, player.animNo) : undefined;
  const currentElement = airDocument
    ? getCurrentAnimationElement(airDocument, player.animNo, player.animTime)
    : null;

  if (!currentElement) {
    return {
      playerId: player.id,
      animNo: player.animNo,
      animTime: player.animTime,
      actionExists: action !== undefined,
      actionElementCount: action?.elements.length ?? 0,
      groupNo: null,
      imageNo: null,
      key: null,
      hasImageDataSprite: false,
      hasPngSprite: false,
    };
  }

  const groupNo = currentElement.element.groupNo;
  const imageNo = currentElement.element.imageNo;
  const key = spriteKey(groupNo, imageNo);

  return {
    playerId: player.id,
    animNo: player.animNo,
    animTime: player.animTime,
    actionExists: true,
    actionElementCount: currentElement.action.elements.length,
    groupNo,
    imageNo,
    key,
    hasImageDataSprite: imageDataSpritePack?.sprites.has(key) ?? false,
    hasPngSprite: pngSpritePack?.sprites.has(key) ?? false,
  };
}
