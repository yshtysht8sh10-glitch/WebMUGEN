export type CollisionBox = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  kind: 'clsn1' | 'clsn2';
};

export type ScreenCollisionBox = CollisionBox & {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function projectCollisionBoxes(
  boxes: readonly CollisionBox[],
  origin: { x: number; y: number },
  facing: 1 | -1,
  scale = { x: 1, y: 1 },
): ScreenCollisionBox[] {
  return boxes.map((box) => {
    const left = facing === 1 ? box.left : -box.right;
    const right = facing === 1 ? box.right : -box.left;
    const x1 = origin.x + left * scale.x;
    const x2 = origin.x + right * scale.x;
    const y1 = origin.y + box.top * scale.y;
    const y2 = origin.y + box.bottom * scale.y;

    return {
      ...box,
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
    };
  });
}

export function getCollisionBoxColor(kind: CollisionBox['kind']): string {
  return kind === 'clsn1' ? 'rgba(255, 64, 64, 0.55)' : 'rgba(64, 160, 255, 0.45)';
}
