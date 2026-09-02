/**
 * Stable, browser-safe entry points used by Proxy Release's generated preview.
 *
 * Keep this facade thin: the implementations below are the same DEF, text,
 * compatibility and SFF pipeline used by the WebMUGEN character runtime.
 */
export { discoverCharacterDef } from '../content/CharacterDefDiscovery';
export { resolveCompatibilityProfile } from '../compatibility/CompatibilityProfile';
export { resolveAssetPath } from '../core/character/CharacterLoader';
export { loadSffSpritePack } from '../core/sprite/SffSpritePackDispatcher';
export { getCharacterDefFiles, parseDefText } from '../parser/def/DefParser';
export { decodeMugenText } from '../parser/text/MugenTextDecoder';

export type { CharacterDefPalette, DefDocument } from '../parser/def/DefTypes';
export type { ImageDataSpritePack } from '../core/sprite/ImageDataSpriteTypes';
export type { SffSpritePackLoadResult } from '../core/sprite/SffSpritePackDispatcher';
