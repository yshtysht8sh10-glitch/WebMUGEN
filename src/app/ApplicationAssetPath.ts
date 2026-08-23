export function resolveApplicationAssetPath(relativePath: string, locationHref?: string): string {
  const safeRelativePath = relativePath.replace(/\\/g, '/').replace(/^\.\//, '');
  if (!safeRelativePath || safeRelativePath.startsWith('/') || safeRelativePath.includes('..') || safeRelativePath.includes('://')) {
    throw new Error(`Unsafe application asset path: ${relativePath}`);
  }
  const href = locationHref ?? readLocationHref();
  if (!href) return `/${safeRelativePath}`;
  return new URL(`./${safeRelativePath}`, href).pathname;
}

function readLocationHref(): string | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.location.href;
  } catch {
    return undefined;
  }
}
