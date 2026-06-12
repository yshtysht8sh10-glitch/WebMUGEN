import type {
  LoadedSprite,
  SpriteDefinition,
  SpriteKey,
  SpritePack,
  SpritePackManifest,
} from './SpriteTypes';

export function spriteKey(groupNo: number, imageNo: number): SpriteKey {
  return `${groupNo},${imageNo}`;
}

export async function loadSpritePack(manifest: SpritePackManifest): Promise<SpritePack> {
  const entries = await Promise.all(
    manifest.sprites.map(async (sprite) => [
      spriteKey(sprite.groupNo, sprite.imageNo),
      await loadSprite(sprite),
    ] as const),
  );

  return {
    sprites: new Map(entries),
  };
}

export function findSprite(
  spritePack: SpritePack | null | undefined,
  groupNo: number,
  imageNo: number,
): LoadedSprite | undefined {
  return spritePack?.sprites.get(spriteKey(groupNo, imageNo));
}

async function loadSprite(sprite: SpriteDefinition): Promise<LoadedSprite> {
  const image = new Image();
  image.src = sprite.src;

  await image.decode().catch(
    () =>
      new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error(`Failed to load sprite: ${sprite.src}`));
      }),
  );

  return {
    ...sprite,
    image,
  };
}
