import { describe, expect, it } from 'vitest';
import { tokenizeCharacterSourceLine } from './CharacterSyntaxHighlighter';

describe('CharacterSyntaxHighlighter', () => {
  it('uses the MPS DEF scopes for sections, parameters, strings, separators, and comments', () => {
    expect(tokenizeCharacterSourceLine('[Files]', 'def')).toEqual([
      { text: '[Files]', scope: 'entity' },
    ]);
    expect(tokenizeCharacterSourceLine('sprite = chars/demo.sff ; image archive', 'def')).toEqual([
      { text: 'sprite', scope: 'parameter' },
      { text: ' ', scope: 'plain' },
      { text: '=', scope: 'keyword' },
      { text: ' ', scope: 'plain' },
      { text: 'chars', scope: 'constant' },
      { text: '/', scope: 'keyword' },
      { text: 'demo.sff ', scope: 'constant' },
      { text: '; image archive', scope: 'comment' },
    ]);
  });

  it('uses the MPS CNS scopes for triggers and expression operators', () => {
    expect(tokenizeCharacterSourceLine('trigger1 = ifelse(var(0), 1, 0) && time > 0 ; route', 'cns')).toEqual([
      { text: 'trigger', scope: 'control' },
      { text: '1', scope: 'control' },
      { text: ' ', scope: 'plain' },
      { text: '=', scope: 'keyword' },
      { text: ' ', scope: 'plain' },
      { text: 'ifelse', scope: 'keyword' },
      { text: '(', scope: 'keyword' },
      { text: 'var', scope: 'constant' },
      { text: '(', scope: 'keyword' },
      { text: '0', scope: 'constant' },
      { text: ')', scope: 'keyword' },
      { text: ', 1, 0', scope: 'constant' },
      { text: ')', scope: 'keyword' },
      { text: ' ', scope: 'constant' },
      { text: '&&', scope: 'keyword' },
      { text: ' time > 0 ', scope: 'constant' },
      { text: '; route', scope: 'comment' },
    ]);
  });

  it('matches the Dark 2026 controller sample scopes', () => {
    expect(tokenizeCharacterSourceLine('[State 3020, RemoveExplod]', 'cns')).toEqual([
      { text: '[State 3020, RemoveExplod]', scope: 'entity' },
    ]);
    expect(tokenizeCharacterSourceLine('type = RemoveExplod', 'cns')).toEqual([
      { text: 'type', scope: 'parameter' },
      { text: ' ', scope: 'plain' },
      { text: '=', scope: 'keyword' },
      { text: ' ', scope: 'plain' },
      { text: 'RemoveExplod', scope: 'constant' },
    ]);
    expect(tokenizeCharacterSourceLine('ID = 3000', 'cns')).toEqual([
      { text: 'ID', scope: 'parameter' },
      { text: ' ', scope: 'plain' },
      { text: '=', scope: 'keyword' },
      { text: ' ', scope: 'plain' },
      { text: '3000', scope: 'constant' },
    ]);
  });

  it('uses the latest IKEMEN ZSS scopes for language constructs', () => {
    expect(tokenizeCharacterSourceLine('if $enemyLife > 0 { call changeState(enemy, 100); }', 'zss')).toEqual([
      { text: 'if', scope: 'control' },
      { text: ' ', scope: 'plain' },
      { text: '$enemyLife', scope: 'zss-variable' },
      { text: ' ', scope: 'plain' },
      { text: '>', scope: 'zss-operator' },
      { text: ' ', scope: 'plain' },
      { text: '0', scope: 'number' },
      { text: ' ', scope: 'plain' },
      { text: '{', scope: 'zss-operator' },
      { text: ' ', scope: 'plain' },
      { text: 'call', scope: 'control' },
      { text: ' ', scope: 'plain' },
      { text: 'changeState', scope: 'zss-controller' },
      { text: '(', scope: 'zss-operator' },
      { text: 'enemy', scope: 'zss-redirect' },
      { text: ',', scope: 'zss-operator' },
      { text: ' ', scope: 'plain' },
      { text: '100', scope: 'number' },
      { text: ')', scope: 'zss-operator' },
      { text: ';', scope: 'zss-operator' },
      { text: ' ', scope: 'plain' },
      { text: '}', scope: 'zss-operator' },
    ]);
    expect(tokenizeCharacterSourceLine('let value = animElemTime + persistent # latest rule', 'zss')).toEqual([
      { text: 'let value = animElemTime + persistent # latest rule', scope: 'comment' },
    ]);
    expect(tokenizeCharacterSourceLine('frontEdgeBodyDist + animElemTime', 'zss')).toEqual([
      { text: 'frontEdgeBodyDist', scope: 'zss-function' },
      { text: ' ', scope: 'plain' },
      { text: '+', scope: 'zss-operator' },
      { text: ' ', scope: 'plain' },
      { text: 'animElemTime', scope: 'zss-function' },
    ]);
  });

  it('uses distinct MPS AIR scopes for sprite, offset, time, and trailing fields', () => {
    expect(tokenizeCharacterSourceLine('10,2, 3,-4, 5, H, A', 'air')).toEqual([
      { text: '10,2', scope: 'air-sprite' },
      { text: ', 3,-4', scope: 'air-offset' },
      { text: ', 5', scope: 'air-time' },
      { text: ', H, A', scope: 'keyword' },
    ]);
  });

  it('leaves arbitrary text files unclassified', () => {
    expect(tokenizeCharacterSourceLine('notes = ordinary text', 'text')).toEqual([
      { text: 'notes = ordinary text', scope: 'plain' },
    ]);
  });
});
