import { describe, expect, it } from 'vitest';
import { createSampleCharacterAssets } from './AppCharacterLoader';

describe('AppCharacterLoader', () => {
  it('creates sample character assets', () => {
    const assets = createSampleCharacterAssets();

    expect(assets.cns.states.length).toBeGreaterThan(0);
    expect(assets.air.actions.length).toBeGreaterThan(0);
    expect(assets.cmd.commands.length).toBeGreaterThan(0);
    expect(assets.sprites).toBeNull();
  });
});
