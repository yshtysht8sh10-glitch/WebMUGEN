import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const virtualCharacterManifestId = 'virtual:webmugen-character-manifest';
const resolvedVirtualCharacterManifestId = `\0${virtualCharacterManifestId}`;
const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const publicCharsRoot = resolve(projectRoot, 'public/chars');

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

export default defineConfig({
  plugins: [webMugenCharacterManifestPlugin(), react()],
  base: './',
});
