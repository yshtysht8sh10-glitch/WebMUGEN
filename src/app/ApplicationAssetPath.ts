export function resolveApplicationAssetPath(relativePath: string, locationHref?: string): string {
  const safeRelativePath = relativePath.replace(/\\/g, '/').replace(/^\.\//, '');
  if (!safeRelativePath || safeRelativePath.startsWith('/') || safeRelativePath.includes('..') || safeRelativePath.includes('://')) {
    throw new Error(`Unsafe application asset path: ${relativePath}`);
  }
  const href = locationHref ?? readLocationHref();
  if (!href) return `/${safeRelativePath}`;
  return new URL(`./${safeRelativePath}`, href).pathname;
}

export function isSafeSameOriginContentPath(
  path: string,
  directories: readonly string[],
  extensions: readonly string[],
): boolean {
  if (!isSafeSameOriginAssetPath(path, extensions)) return false;
  const normalized = path.trim().replace(/\\/g, '/');
  return directories.some((directory) => normalized.includes(`/${directory.replace(/^\/+|\/+$/g, '')}/`));
}

export function isSafeSameOriginAssetPath(
  path: string,
  extensions: readonly string[],
): boolean {
  const normalized = path.trim().replace(/\\/g, '/');
  const lower = normalized.toLowerCase();
  return normalized.startsWith('/')
    && !normalized.startsWith('//')
    && !normalized.includes('://')
    && !normalized.split('/').some((part) => part === '.' || part === '..')
    && extensions.some((extension) => lower.endsWith(extension.toLowerCase()));
}

function readLocationHref(): string | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.location.href;
  } catch {
    return undefined;
  }
}
