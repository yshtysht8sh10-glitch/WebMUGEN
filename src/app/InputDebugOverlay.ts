import type { InputDebugSnapshot } from '../input/InputDebugInfo';

export function formatInputDebugOverlay(snapshot: InputDebugSnapshot): string[] {
  const p1 = snapshot.p1;
  const p2 = snapshot.p2;

  return [
    `keys=${snapshot.pressedKeys.join('+') || '-'}`,
    `sys R=${flag(snapshot.system.restartRound)}`,
    `p1 L=${flag(p1.left)} R=${flag(p1.right)} U=${flag(p1.up)} D=${flag(p1.down)} A=${flag(p1.attack)} PROJ=${flag(p1.projectile)}`,
    `p2 L=${flag(p2.left)} R=${flag(p2.right)} U=${flag(p2.up)} D=${flag(p2.down)} F=${flag(p2.attack)}`,
  ];
}

function flag(value: boolean): '1' | '0' {
  return value ? '1' : '0';
}
