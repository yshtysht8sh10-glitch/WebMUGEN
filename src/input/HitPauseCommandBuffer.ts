import type { CmdDocument } from '../parser/cmd/CmdTypes';
import { parseCommandTokens } from './CommandMatcher';

export class HitPauseCommandBuffer {
  private readonly bufferableNames: ReadonlySet<string>;
  private readonly pending = new Set<string>();

  constructor(document: CmdDocument) {
    this.bufferableNames = new Set(document.commands
      .filter((command) => parseCommandTokens(command.command).some((token) => token.kind === 'button' && !token.hold))
      .map((command) => command.name.toLowerCase()));
  }

  resolve(commands: ReadonlySet<string>, hitPaused: boolean): ReadonlySet<string> {
    const resolved = new Set(Array.from(commands, (command) => command.toLowerCase()));
    if (hitPaused) {
      for (const command of resolved) {
        if (this.bufferableNames.has(command)) this.pending.add(command);
      }
      return resolved;
    }

    for (const command of this.pending) resolved.add(command);
    this.pending.clear();
    return resolved;
  }

  clear(): void {
    this.pending.clear();
  }
}
