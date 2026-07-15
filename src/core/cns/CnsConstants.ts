import type { CnsDocument } from '../../mugen/common/cnsTypes';

export function readCnsConst(document: CnsDocument | null | undefined, rawName: string): number {
  const name = rawName.trim().toLowerCase();
  const configured = readConfiguredConst(document, name);
  if (configured !== null) return configured;

  if (/^velocity\.(?:jump\.(?:fwd|back)|runjump\.(?:fwd|back))\.y$/.test(name)) {
    const sharedJumpY = readConfiguredConst(document, 'velocity.jump.neu.y');
    if (sharedJumpY !== null) return sharedJumpY;
  }

  return readDefaultConst(name);
}

function readConfiguredConst(document: CnsDocument | null | undefined, name: string): number | null {
  if (!document) return null;

  if (name.startsWith('velocity.')) {
    const velocityName = name.slice('velocity.'.length);
    if (velocityName === 'jump.y') return readSectionComponent(document, 'velocity', 'jump.neu', 1);

    const componentMatch = velocityName.match(/^(.+)\.(x|y)$/);
    if (!componentMatch) return null;
    return readSectionComponent(document, 'velocity', componentMatch[1], componentMatch[2] === 'x' ? 0 : 1);
  }

  const sectionMatch = name.match(/^(data|size|movement)\.(.+)$/);
  if (!sectionMatch) return null;
  return readSectionComponent(document, sectionMatch[1], sectionMatch[2], 0);
}

function readSectionComponent(document: CnsDocument, sectionName: string, key: string, component: number): number | null {
  const section = document.metadataSections.find((candidate) => candidate.name.trim().toLowerCase() === sectionName);
  const raw = section?.values[key];
  if (raw === undefined) return null;
  const value = Array.isArray(raw) ? raw[component] : component === 0 ? raw : undefined;
  return finiteNumber(value);
}

function finiteNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function readDefaultConst(name: string): number {
  switch (name) {
    case 'data.life': return 1000;
    case 'data.power': return 3000;
    case 'data.liedown.time': return 60;
    case 'size.xscale': return 1;
    case 'size.yscale': return 1;
    case 'size.ground.back': return 15;
    case 'size.ground.front': return 16;
    case 'size.air.back': return 12;
    case 'size.air.front': return 12;
    case 'size.height': return 60;
    case 'size.attack.dist': return 160;
    case 'velocity.walk.fwd.x': return 2;
    case 'velocity.walk.back.x': return -2;
    case 'velocity.jump.y': return -8.4;
    case 'velocity.jump.neu.x': return 0;
    case 'velocity.jump.fwd.x': return 3.2;
    case 'velocity.jump.back.x': return -3.2;
    case 'movement.airjump.num': return 1;
    case 'movement.airjump.height': return 35;
    case 'movement.yaccel': return 0.6;
    default: return 0;
  }
}
