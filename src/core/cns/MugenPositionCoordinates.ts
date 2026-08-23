export function mugenPosXToWorldX(
  positionX: number,
  cameraX: number | undefined,
  screenWidth: number | undefined,
): number {
  return positionX + mugenScreenCenterWorldX(cameraX, screenWidth);
}

export function worldXToMugenPosX(
  worldX: number,
  cameraX: number | undefined,
  screenWidth: number | undefined,
): number {
  return worldX - mugenScreenCenterWorldX(cameraX, screenWidth);
}

function mugenScreenCenterWorldX(
  cameraX: number | undefined,
  screenWidth: number | undefined,
): number {
  if (typeof cameraX !== 'number' || !Number.isFinite(cameraX)) return 0;
  if (typeof screenWidth !== 'number' || !Number.isFinite(screenWidth)) return 0;
  return cameraX + screenWidth / 2;
}
