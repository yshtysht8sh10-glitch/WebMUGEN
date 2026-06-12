import type { CharacterDefFiles, DefDocument, DefSection } from './DefTypes';

export function parseDefText(text: string): DefDocument {
  const sections: DefSection[] = [];
  let current: DefSection | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripComment(rawLine).trim();

    if (!line) {
      continue;
    }

    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      current = {
        name: sectionMatch[1].trim(),
        values: new Map(),
      };
      sections.push(current);
      continue;
    }

    if (!current) {
      continue;
    }

    const equalsIndex = line.indexOf('=');
    if (equalsIndex < 0) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim().toLowerCase();
    const value = line.slice(equalsIndex + 1).trim();
    current.values.set(key, value);
  }

  return { sections };
}

export function getDefSection(document: DefDocument, name: string): DefSection | undefined {
  const lowerName = name.toLowerCase();
  return document.sections.find((section) => section.name.toLowerCase() === lowerName);
}

export function getCharacterDefFiles(document: DefDocument): CharacterDefFiles {
  const files = getDefSection(document, 'Files');
  if (!files) {
    return {};
  }

  const st: string[] = [];

  for (const [key, value] of files.values.entries()) {
    if (key === 'st' || /^st\d+$/.test(key)) {
      st.push(value);
    }
  }

  return {
    cmd: files.values.get('cmd'),
    cns: files.values.get('cns'),
    st,
    sprite: files.values.get('sprite'),
    anim: files.values.get('anim'),
    sound: files.values.get('sound'),
  };
}

function stripComment(line: string): string {
  const semicolonIndex = line.indexOf(';');
  return semicolonIndex >= 0 ? line.slice(0, semicolonIndex) : line;
}
