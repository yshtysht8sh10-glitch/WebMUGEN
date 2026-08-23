import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseAirText } from '../../parser/air/AirParser';
import { parseCmdText } from '../../parser/cmd/CmdParser';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { mergeCnsDocuments, mergeMissingCnsStates } from '../character/CharacterLoader';
import { createInitialGameState } from '../engine/GameState';
import { simulateCnsInputScenario } from '../../testing/CnsInputScenarioSimulator';

const decoder = new TextDecoder('shift_jis');
const cmdSource = decoder.decode(readFileSync('public/chars/itoko/itoko.cmd'));
const itokoCns = parseCnsText(decoder.decode(readFileSync('public/chars/itoko/itoko.cns')));
const commandStates = parseCnsText(cmdSource, { sourceFile: 'itoko.cmd' });
const cns = mergeMissingCnsStates(
  mergeMissingCnsStates(
    mergeCnsDocuments(itokoCns, commandStates),
    parseCnsText(readFileSync('public/chars/common1.cns', 'utf8')),
  ),
  parseCnsText(readFileSync('public/chars/common.cmd', 'utf8')),
);
const character = {
  air: parseAirText(decoder.decode(readFileSync('public/chars/itoko/itoko.air'))),
  cmd: parseCmdText(cmdSource),
  cns,
};

function runStrongThreadFromZGuard(buttonKey: 'KeyA' | 'KeyQ' | 'KeyW') {
  return simulateCnsInputScenario(character, [
    { p1Keys: ['KeyE'], frames: 12 },
    { p1Keys: ['ArrowDown', 'KeyE'] },
    { p1Keys: ['ArrowDown', 'ArrowLeft', 'KeyE'] },
    { p1Keys: ['ArrowLeft', 'KeyE'] },
    { p1Keys: ['KeyE', buttonKey] },
  ], createInitialGameState());
}

describe('real itoko strong thread command integration', () => {
  it.each([
    ['KeyA', '弱糸下', 1010],
    ['KeyQ', '弱糸中', 1011],
    ['KeyW', '弱糸上', 1012],
  ] as const)('routes the %s (%s) strong thread from State 130 to State %i', (buttonKey, commandName, destination) => {
    const result = runStrongThreadFromZGuard(buttonKey);
    const commandFrame = result.frames[result.frames.length - 1];

    expect(result.frames.some((frame) => frame.p1.stateNo === 125)).toBe(true);
    expect(result.frames.some((frame) => frame.p1.stateNo === 120)).toBe(true);
    expect(result.frames.some((frame) => frame.p1.stateNo === 130)).toBe(true);
    expect(result.frames.some((frame) => frame.p1.stateNo === 131)).toBe(true);
    expect(result.frames[result.frames.length - 2].p1.stateNo).toBe(130);
    expect(commandFrame.p1Commands).toContain('hold_z');
    expect(commandFrame.p1Commands).toContain(commandName);
    expect(commandFrame.p1.stateNo).toBe(destination);
  });
});
