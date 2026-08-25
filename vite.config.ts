import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { closeSync, openSync, readFileSync, readSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import iconv from 'iconv-lite';
import { unzipSync, zipSync } from 'fflate';
import { calculateTestTimeoutMs } from './src/testing/TestTimeoutBudget';
import { decodeMugenText } from './src/parser/text/MugenTextDecoder';

const virtualCharacterManifestId = 'virtual:webmugen-character-manifest';
const resolvedVirtualCharacterManifestId = `\0${virtualCharacterManifestId}`;
const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const webMugenVersion = readPackageVersion(resolve(projectRoot, 'package.json'));
const publicCharsRoot = resolve(projectRoot, 'public/chars');
const characterFilesApiPath = '/__webmugen/character-files';
const defaultSettingsPath = resolve(projectRoot, 'public/config/default-settings.json');
const defaultSettingsApiPath = '/__webmugen/default-settings';
const textExtensions = new Set(['.air', '.cns', '.cmd', '.def', '.zss', '.ini', '.json', '.md', '.txt', '.cfg', '.log']);
const testTimeoutMs = calculateTestTimeoutMs({
  dataCount: countSffImageEntries(publicCharsRoot),
  testCount: countTestCases(resolve(projectRoot, 'src')),
});

function readPackageVersion(packagePath: string): string {
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8')) as { version?: unknown };
  if (typeof packageJson.version !== 'string' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(packageJson.version)) {
    throw new Error('package.json must contain a valid semantic version.');
  }
  return packageJson.version;
}

function countSffImageEntries(directory: string): number {
  let count = 0;
  for (const filePath of listFilesRecursive(directory, (path) => path.toLowerCase().endsWith('.sff'))) {
    const descriptor = openSync(filePath, 'r');
    try {
      const header = Buffer.alloc(24);
      if (readSync(descriptor, header, 0, header.length, 0) !== header.length) continue;
      if (!header.subarray(0, 11).equals(Buffer.from('ElecbyteSpr'))) continue;
      count += Math.max(0, header.readInt32LE(20));
    } finally {
      closeSync(descriptor);
    }
  }
  return count;
}

function countTestCases(directory: string): number {
  let count = 0;
  for (const filePath of listFilesRecursive(directory, (path) => path.endsWith('.test.ts') || path.endsWith('.test.tsx'))) {
    const source = readFileSync(filePath, 'utf8');
    count += source.match(/\b(?:it|test)(?:\.each\([^)]*\))?\s*\(/g)?.length ?? 0;
  }
  return count;
}

function listFilesRecursive(directory: string, include: (path: string) => boolean): string[] {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  const results: string[] = [];
  for (const entry of entries) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) results.push(...listFilesRecursive(absolutePath, include));
    else if (entry.isFile() && include(absolutePath)) results.push(absolutePath);
  }
  return results;
}

function scanCharacterPaths(): string[] {
  let entries: string[];
  try {
    entries = readdirSync(publicCharsRoot);
  } catch {
    return [];
  }

  const paths = new Set<string>();
  for (const entry of entries) {
    const absolutePath = join(publicCharsRoot, entry);
    let stats;
    try {
      stats = statSync(absolutePath);
    } catch {
      continue;
    }

    if (stats.isFile() && entry.toLowerCase().endsWith('.zip')) {
      paths.add(`/chars/${entry}`);
      continue;
    }

    if (stats.isDirectory()) {
      const defPath = findCharacterDefPath(absolutePath, entry);
      if (defPath) {
        paths.add(`/chars/${toPublicPath(relative(publicCharsRoot, defPath))}`);
      }
    }
  }

  return Array.from(paths).sort((left, right) => left.localeCompare(right, 'en'));
}

function findCharacterDefPath(directory: string, characterName: string): string | null {
  const directDefs = listDefFiles(directory);
  const preferredDirect = directDefs.find((filePath) => defBaseName(filePath).toLowerCase() === characterName.toLowerCase());
  if (preferredDirect) return preferredDirect;
  if (directDefs.length === 1) return directDefs[0];

  const nestedDefs = listDefFilesRecursive(directory, 3);
  const preferredNested = nestedDefs.find((filePath) => defBaseName(filePath).toLowerCase() === characterName.toLowerCase());
  return preferredNested ?? nestedDefs[0] ?? null;
}

function listDefFiles(directory: string): string[] {
  try {
    return readdirSync(directory)
      .filter((entry) => entry.toLowerCase().endsWith('.def'))
      .map((entry) => join(directory, entry));
  } catch {
    return [];
  }
}

function listDefFilesRecursive(directory: string, depth: number): string[] {
  if (depth < 0) return [];
  let entries: string[];
  try {
    entries = readdirSync(directory);
  } catch {
    return [];
  }

  const results: string[] = [];
  for (const entry of entries) {
    const absolutePath = join(directory, entry);
    let stats;
    try {
      stats = statSync(absolutePath);
    } catch {
      continue;
    }

    if (stats.isFile() && entry.toLowerCase().endsWith('.def')) {
      results.push(absolutePath);
    } else if (stats.isDirectory()) {
      results.push(...listDefFilesRecursive(absolutePath, depth - 1));
    }
  }
  return results;
}

function defBaseName(filePath: string): string {
  const fileName = filePath.split(/[\\/]/).pop() ?? '';
  return fileName.replace(/\.def$/i, '');
}

function toPublicPath(filePath: string): string {
  return filePath.split(sep).join('/');
}

function webMugenCharacterManifestPlugin() {
  return {
    name: 'webmugen-character-manifest',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const requestUrl = new URL(request.url ?? '/', 'http://localhost');
        if (requestUrl.pathname === defaultSettingsApiPath) {
          try {
            if (request.method !== 'POST') {
              sendJson(response, 405, { error: 'Method not allowed.' });
              return;
            }
            const settings = JSON.parse(await readRequestBody(request)) as Record<string, unknown>;
            if (!settings || typeof settings !== 'object' || Array.isArray(settings) || settings.version !== 1) {
              throw new Error('A version 1 WebMUGEN settings object is required.');
            }
            for (const group of ['audio', 'runtime', 'content', 'input', 'ui']) {
              const value = settings[group];
              if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`settings.${group} is required.`);
            }
            writeFileSync(defaultSettingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
            sendJson(response, 200, { saved: true, path: '/config/default-settings.json' });
          } catch (error) {
            sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
          }
          return;
        }

        if (requestUrl.pathname !== characterFilesApiPath) {
          next();
          return;
        }

        try {
          if (request.method === 'GET') {
            const defPath = requestUrl.searchParams.get('defPath');
            if (!defPath) throw new Error('defPath is required.');
            const absoluteDefPath = resolvePublicCharacterPath(defPath);
            const files = listCharacterDirectoryFiles(dirname(absoluteDefPath)).map((absolutePath) => {
              const bytes = readFileSync(absolutePath);
              const publicPath = `/chars/${toPublicPath(relative(publicCharsRoot, absolutePath))}`;
              const extension = extensionOf(absolutePath);
              const text = textExtensions.has(extension) || isProbablyText(bytes);
              return {
                path: publicPath,
                label: toPublicPath(relative(dirname(absoluteDefPath), absolutePath)),
                text: text ? decodeMugenText(bytes) : '',
                binaryBase64: extension === '.sff' || extension === '.snd' || extension === '.act' ? bytes.toString('base64') : undefined,
              };
            });
            sendJson(response, 200, { files });
            return;
          }

          if (request.method === 'POST') {
            const body = JSON.parse(await readRequestBody(request)) as {
              path?: string;
              text?: string;
              archivePath?: string;
              archiveEntryPath?: string;
            };
            if (typeof body.path !== 'string' || typeof body.text !== 'string') {
              throw new Error('path and text are required.');
            }
            if (body.archivePath && body.archiveEntryPath) {
              const archiveAbsolutePath = resolvePublicCharacterPath(body.archivePath);
              const archiveEntries = unzipSync(new Uint8Array(readFileSync(archiveAbsolutePath)));
              const entryName = normalizeArchiveEntryPath(body.archiveEntryPath);
              if (!Object.prototype.hasOwnProperty.call(archiveEntries, entryName)) {
                throw new Error(`ZIP entry does not exist: ${entryName}`);
              }
              archiveEntries[entryName] = new Uint8Array(iconv.encode(body.text, 'shift_jis'));
              writeFileSync(archiveAbsolutePath, zipSync(archiveEntries, { level: 6 }));
            } else {
              writeFileSync(resolvePublicCharacterPath(body.path), iconv.encode(body.text, 'shift_jis'));
            }
            sendJson(response, 200, { saved: true });
            return;
          }

          sendJson(response, 405, { error: 'Method not allowed.' });
        } catch (error) {
          sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
        }
      });
      server.watcher.add(publicCharsRoot);
      server.watcher.on('all', (_event, changedPath) => {
        if (!changedPath.startsWith(publicCharsRoot)) return;
        const module = server.moduleGraph.getModuleById(resolvedVirtualCharacterManifestId);
        if (module) server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: 'full-reload' });
      });
    },
    resolveId(id) {
      return id === virtualCharacterManifestId ? resolvedVirtualCharacterManifestId : null;
    },
    load(id) {
      if (id !== resolvedVirtualCharacterManifestId) return null;
      return `export const CHARACTER_PATH_OPTIONS = ${JSON.stringify(scanCharacterPaths())};`;
    },
  };
}

function resolvePublicCharacterPath(publicPath: string): string {
  const normalized = decodeURIComponent(publicPath).replace(/\\/g, '/');
  if (!normalized.startsWith('/chars/')) throw new Error(`Character path is outside /chars/: ${publicPath}`);
  const absolutePath = resolve(publicCharsRoot, normalized.slice('/chars/'.length));
  const relativePath = relative(publicCharsRoot, absolutePath);
  if (relativePath.startsWith('..') || resolve(publicCharsRoot, relativePath) !== absolutePath) {
    throw new Error(`Character path escapes public/chars: ${publicPath}`);
  }
  return absolutePath;
}

function listCharacterDirectoryFiles(directory: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(directory)) {
    const absolutePath = join(directory, entry);
    const stats = statSync(absolutePath);
    if (stats.isDirectory()) results.push(...listCharacterDirectoryFiles(absolutePath));
    else if (stats.isFile()) results.push(absolutePath);
  }
  return results.sort((left, right) => left.localeCompare(right, 'en'));
}

function extensionOf(path: string): string {
  const match = path.toLowerCase().match(/\.[^.\\/]+$/);
  return match?.[0] ?? '';
}

function isProbablyText(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return true;
  const sample = bytes.subarray(0, Math.min(bytes.length, 4096));
  let controlCount = 0;
  for (const byte of sample) {
    if (byte === 0) return false;
    if (byte < 0x09 || (byte > 0x0d && byte < 0x20)) controlCount += 1;
  }
  return controlCount / sample.length < 0.02;
}

function normalizeArchiveEntryPath(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/^\.\//, '');
  if (normalized.split('/').some((part) => part === '..')) throw new Error('ZIP entry path escapes the archive.');
  return normalized;
}

function readRequestBody(request: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolveBody, rejectBody) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    request.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
    request.on('error', rejectBody);
  });
}

function sendJson(response: import('node:http').ServerResponse, status: number, value: unknown): void {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(value));
}

export default defineConfig({
  plugins: [webMugenCharacterManifestPlugin(), react()],
  base: './',
  define: {
    __WEBMUGEN_VERSION__: JSON.stringify(webMugenVersion),
  },
  test: {
    testTimeout: testTimeoutMs,
  },
});
