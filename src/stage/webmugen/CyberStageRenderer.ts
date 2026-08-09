import { DepthPanoramaStageRenderer, resolveDepthCameraFactor } from './FreshStageRenderer';

const CYBER_DEPTH_OPTIONS = {
  fallbackColor: '#020713',
  farCameraFactor: 0.1,
  transitionStart: 0.55,
  transitionEnd: 0.68,
};

export class CyberStageRenderer extends DepthPanoramaStageRenderer {
  constructor() { super(CYBER_DEPTH_OPTIONS); }
}

export function resolveCyberDepthCameraFactor(viewportY: number): number {
  return resolveDepthCameraFactor(viewportY, CYBER_DEPTH_OPTIONS);
}
