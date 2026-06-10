import { describe, expect, it } from 'vitest';
import { parseAirText } from '../../parser/air/AirParser';
import { parseCmdText } from '../../parser/cmd/CmdParser';
import { parseCnsText } from '../../parser/cns/CnsParser';
import { sampleCharacterAir } from '../../app/sampleCharacterAir';
import { sampleCharacterCmd } from '../../app/sampleCharacterCmd';
import { sampleCharacterCns } from '../../app/sampleCharacterCns';
import { createInitialGameState } from './GameState';
import { stepGameByCns } from './CnsGame';
import { InputBuffer } from '../../input/InputBuffer';

describe('Special command Phase15', () => {
  it('changes to state 1000 when qcf_a is buffered', () => {
    const cns = parseCnsText(sampleCharacterCns);
    const air = parseAirText(sampleCharacterAir);
    const cmd = parseCmdText(sampleCharacterCmd);
    const buffer = new InputBuffer(20);

    buffer.push({ left: false, right: false, up: false, down: true, attack: false });
    buffer.push({ left: false, right: true, up: false, down: true, attack: false });
    buffer.push({ left: false, right: true, up: false, down: false, attack: false });

    const input = {
      left: false,
      right: false,
      up: false,
      down: false,
      attack: true,
      inputBuffer: buffer,
    };

    buffer.push(input);

    const state = stepGameByCns(
      createInitialGameState(),
      cns,
      { p1: input },
      air,
      cmd,
    );

    expect(state.players[0].stateNo).toBe(1000);
    expect(state.players[0].ctrl).toBe(false);
  });

  it('prioritizes qcf_a over normal a because it appears earlier in CMD/CNS', () => {
    const cns = parseCnsText(sampleCharacterCns);
    const air = parseAirText(sampleCharacterAir);
    const cmd = parseCmdText(sampleCharacterCmd);
    const buffer = new InputBuffer(20);

    buffer.push({ left: false, right: false, up: false, down: true, attack: false });
    buffer.push({ left: false, right: true, up: false, down: true, attack: false });
    buffer.push({ left: false, right: true, up: false, down: false, attack: false });

    const input = {
      left: false,
      right: false,
      up: false,
      down: false,
      attack: true,
      inputBuffer: buffer,
    };

    buffer.push(input);

    const state = stepGameByCns(
      createInitialGameState(),
      cns,
      { p1: input },
      air,
      cmd,
    );

    expect(state.players[0].stateNo).not.toBe(200);
    expect(state.players[0].stateNo).toBe(1000);
  });
});
