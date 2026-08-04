export type RuntimeFrameTick = {
  advance: boolean;
  nextTickTime: number | null;
  measuredFrameTimeMs: number;
};

export function resolveRuntimeFrameTick(
  lastTickTime: number | null,
  timestamp: number,
  frameIntervalMs: number,
): RuntimeFrameTick {
  if (lastTickTime === null) {
    return { advance: true, nextTickTime: timestamp, measuredFrameTimeMs: frameIntervalMs };
  }
  const elapsed = timestamp - lastTickTime;
  const tolerance = Math.min(0.5, frameIntervalMs * 0.05);
  if (elapsed + tolerance < frameIntervalMs) {
    return { advance: false, nextTickTime: lastTickTime, measuredFrameTimeMs: elapsed };
  }
  const nextTickTime = elapsed > frameIntervalMs * 5
    ? timestamp
    : lastTickTime + frameIntervalMs;
  return { advance: true, nextTickTime, measuredFrameTimeMs: elapsed };
}
