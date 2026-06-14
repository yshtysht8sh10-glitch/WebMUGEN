import type { CommandDefinition } from '../../parser/cmd/CmdTypes';

export type CnsCommandInputSnapshot = {
  p1Commands: ReadonlySet<string>;
  p2Commands: ReadonlySet<string>;
};

export type ResolvedCommandLike = {
  name: string;
};

export function createCnsCommandSet(commands: readonly ResolvedCommandLike[]): ReadonlySet<string> {
  return new Set(commands.map((command) => command.name.toLowerCase()));
}

export function createFallbackCnsCommandSet(input: {
  attack: boolean;
  projectile?: boolean;
}): ReadonlySet<string> {
  const commands = new Set<string>();

  if (input.attack) {
    commands.add('x');
  }

  if (input.projectile) {
    commands.add('qcf_x');
  }

  return commands;
}

export function hasCommandDefinition(
  definitions: readonly CommandDefinition[] | undefined,
  commandName: string,
): boolean {
  if (!definitions) {
    return false;
  }

  const normalized = commandName.toLowerCase();
  return definitions.some((definition) => definition.name.toLowerCase() === normalized);
}
