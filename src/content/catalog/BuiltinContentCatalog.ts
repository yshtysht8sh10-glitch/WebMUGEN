import type { ContentCatalogEntry } from './ContentCatalogTypes';

/** Catalog entries backed by assets that ship with WebMUGEN. */
export const BUILTIN_CONTENT_ENTRIES: readonly ContentCatalogEntry[] = [
  { id: 't-h-m-a', name: 'T-H-M-A', kind: 'character', engine: 'winmugen', path: '/chars/T-H-M-A.zip', source: 'builtin' },
  { id: 'kfm', name: 'KFM', kind: 'character', engine: 'winmugen', path: '/chars/kfm/kfm.def', source: 'builtin' },
  { id: 'fresh', name: 'Fresh', kind: 'stage', engine: 'webmugen', path: 'builtin:stage:fresh', source: 'builtin' },
  { id: 'cyber', name: 'Cyber', kind: 'stage', engine: 'webmugen', path: 'builtin:stage:cyber', source: 'builtin' },
  { id: 'fresh-clasic', name: 'Fresh Classic', kind: 'stage', engine: 'webmugen', path: 'builtin:stage:fresh-clasic', source: 'builtin' },
  { id: 'cyber-clasic', name: 'Cyber Classic', kind: 'stage', engine: 'webmugen', path: 'builtin:stage:cyber-clasic', source: 'builtin' },
  { id: 'fresh-hud', name: 'Fresh HUD', kind: 'lifebar', engine: 'webmugen', path: 'builtin:lifebar:fresh-hud', source: 'builtin' },
  { id: 'default-cyber', name: 'Default Cyber HUD', kind: 'lifebar', engine: 'webmugen', path: 'builtin:lifebar:default-cyber', source: 'builtin' },
];
