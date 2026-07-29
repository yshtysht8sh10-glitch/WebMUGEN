import type { CharacterSourceFile } from '../core/character/CharacterTypes';

export type CharacterSyntaxScope =
  | 'plain'
  | 'comment'
  | 'entity'
  | 'parameter'
  | 'keyword'
  | 'control'
  | 'string'
  | 'constant'
  | 'number'
  | 'air-clsn1'
  | 'air-sprite'
  | 'air-offset'
  | 'air-time'
  | 'zss-variable'
  | 'zss-function'
  | 'zss-redirect'
  | 'zss-controller'
  | 'zss-modifier'
  | 'zss-operator';

export type CharacterSyntaxToken = {
  text: string;
  scope: CharacterSyntaxScope;
};

type HighlightKind = NonNullable<CharacterSourceFile['kind']>;

export function tokenizeCharacterSourceLine(
  line: string,
  kind: HighlightKind | undefined,
): CharacterSyntaxToken[] {
  if (!isMugenTextKind(kind)) return [{ text: line || ' ', scope: 'plain' }];
  if (kind === 'zss') return tokenizeZssLine(line);

  const commentIndex = line.indexOf(';');
  const content = commentIndex >= 0 ? line.slice(0, commentIndex) : line;
  const comment = commentIndex >= 0 ? line.slice(commentIndex) : '';
  const tokens = kind === 'air'
    ? tokenizeAirContent(content)
    : kind === 'def'
      ? tokenizeDefContent(content)
      : tokenizeCnsContent(content);
  if (comment) tokens.push({ text: comment, scope: 'comment' });
  return tokens.length > 0 ? tokens : [{ text: line || ' ', scope: 'plain' }];
}

export function isMugenTextKind(kind: CharacterSourceFile['kind']): boolean {
  return kind === 'def' || kind === 'cns' || kind === 'cmd' || kind === 'air' || kind === 'zss' || kind === 'common';
}

function tokenizeDefContent(content: string): CharacterSyntaxToken[] {
  if (/^\[.*\]/.test(content)) return [{ text: content, scope: 'entity' }];
  const assignment = content.match(/^(.+?)(\s+)(=)(\s+)(.+)$/);
  if (!assignment) return plain(content);
  return [
    { text: assignment[1], scope: 'parameter' },
    { text: assignment[2], scope: 'plain' },
    { text: assignment[3], scope: 'keyword' },
    { text: assignment[4], scope: 'plain' },
    ...tokenizeValue(assignment[5], 'def'),
  ];
}

function tokenizeCnsContent(content: string): CharacterSyntaxToken[] {
  if (/^\[.*\]/.test(content)) return [{ text: content, scope: 'entity' }];
  const trigger = content.match(/^(Trigger|trigger)(\S+)(\s+)(=)(\s+)(.+)$/);
  if (trigger) {
    return [
      { text: trigger[1], scope: 'control' },
      { text: trigger[2], scope: 'control' },
      { text: trigger[3], scope: 'plain' },
      { text: trigger[4], scope: 'keyword' },
      { text: trigger[5], scope: 'plain' },
      ...tokenizeValue(trigger[6], 'cns'),
    ];
  }
  const assignment = content.match(/^(.+?)(\s+)(=)(\s+)(.+)$/);
  if (!assignment) return plain(content);
  return [
    { text: assignment[1], scope: 'parameter' },
    { text: assignment[2], scope: 'plain' },
    { text: assignment[3], scope: 'keyword' },
    { text: assignment[4], scope: 'plain' },
    ...tokenizeValue(assignment[5], 'cns'),
  ];
}

function tokenizeAirContent(content: string): CharacterSyntaxToken[] {
  if (/^\[.*\]/.test(content)) return [{ text: content, scope: 'entity' }];
  const clsn1 = content.match(/^(.*?)(Clsn1)(.*?)(:|\s+=\s+)(.+)$/);
  if (clsn1) return compact([
    { text: clsn1[1], scope: 'plain' },
    { text: clsn1[2], scope: 'air-clsn1' },
    { text: clsn1[3], scope: 'air-clsn1' },
    { text: clsn1[4], scope: 'keyword' },
    { text: clsn1[5], scope: 'constant' },
  ]);
  const clsn2 = content.match(/^(.*?)(Clsn2)(.*?)(:|\s+=\s+)(.+)$/);
  if (clsn2) return compact([
    { text: clsn2[1], scope: 'plain' },
    { text: clsn2[2], scope: 'parameter' },
    { text: clsn2[3], scope: 'parameter' },
    { text: clsn2[4], scope: 'keyword' },
    { text: clsn2[5], scope: 'constant' },
  ]);
  const sprite = content.match(/^(-*\d+\s*,\s*-*\d+)(\s*,\s*-*\d+\s*,\s*-*\d+)(\s*,\s*-*\d+)(.*)$/);
  if (sprite) return compact([
    { text: sprite[1], scope: 'air-sprite' },
    { text: sprite[2], scope: 'air-offset' },
    { text: sprite[3], scope: 'air-time' },
    { text: sprite[4], scope: 'keyword' },
  ]);
  const loopStart = content.match(/^(.*?)(loopstart)(.*)$/i);
  if (loopStart) return compact([
    { text: loopStart[1], scope: 'plain' },
    { text: loopStart[2], scope: 'keyword' },
    { text: loopStart[3], scope: 'plain' },
  ]);
  return plain(content);
}

const ZSS_CONTROL_WORDS = wordSet('if|else|let|call|while|for|break|continue|switch|case|default|function|statedef');
const ZSS_FUNCTION_WORDS = wordSet('abs|acos|ailevel|ailevelf|alive|anim|animelem|animelemlength|animelemno|animelemtime|animexist|animlength|animtime|asin|atan|attack|authorname|backedge|backedgebodydist|backedgedist|bgmlength|bgmposition|bottomedge|camerapos|camerazoom|canrecover|ceil|combocount|command|cond|consecutivewins|const|const240p|const480p|const720p|cos|ctrl|defence|dizzy|dizzypoints|dizzypointsmax|drawgame|drawpalno|e|exp|facing|fighttime|firstattack|float|floor|framespercount|frontedge|frontedgedodydist|frontedgedist|fvar|gameheight|gamemode|gametime|gamewidth|gethitvar|getplayerid|groundangle|guardbreak|guardpoints|guardpointsmax|helpername|hitcount|hitdefattr|hitfall|hitover|hitoverridden|hitpausetime|hitshakeover|hitvel|id|ifelse|incustomstate|indialogue|inguarddist|isasserted|ishelper|ishometeam|ishost|jugglepoints|leftedge|life|lifemax|ln|localscale|log|lose|loseko|losetime|majorversion|map|matchno|matchover|max|memberno|min|movecontact|movecountered|moveguarded|movehit|movereversed|movetype|name|numenemy|numexplod|numhelper|numpartner|numproj|numprojid|numtarget|p1name|p2bodydist|p2dist|p2life|p2movetype|p2name|p2stateno|p2statetype|p3name|p4name|p5name|p6name|p7name|p8name|palno|parentdist|pausetime|physics|pi|playeridexist|playerno|pos|power|powermax|prevanim|prevstateno|projcanceltime|projcontact|projcontacttime|projguarded|projguardedtime|projhit|projhittime|rand|random|ratiolevel|receiveddamage|receivedhits|redlife|reversaldefattr|rightedge|rootdist|round|roundno|roundsexisted|roundstate|roundtype|score|scoretotal|screenheight|screenpos|screenwidth|selfanimexist|selfstatenoexist|sin|sprpriority|stagebackedge|stageconst|stagefrontedge|stagetime|stagevar|standby|stateno|statetype|sysfvar|sysvar|tan|teamleader|teammode|teamside|teamsize|tickspersecond|time|timeelapsed|timemod|timeremaining|timetotal|topedge|uniqhitcount|var|vel|win|winhyper|winko|winperfect|winspecial|wintime');
const ZSS_REDIRECT_WORDS = wordSet('player|parent|root|helper|target|partner|enemy|enemynear|playerid');
const ZSS_CONTROLLER_WORDS = wordSet('afterimage|afterimagetime|allpalfx|angleadd|angledraw|anglemul|angleset|appendtoclipboard|assertinput|assertspecial|attackdist|attackmulset|bgpalfx|bindtoparent|bindtoroot|bindtotarget|changeanim|changeanim2|changestate|clearclipboard|ctrlset|defencemulset|destroyself|dialogue|displaytoclipboard|dizzypointsadd|dizzypointsset|dizzyset|envcolor|envshake|explod|explodbindtime|fallenvshake|forcefeedback|gamemakeanim|gravity|guardbreakset|guardpointsadd|guardpointsset|helper|hitadd|hitby|hitdef|hitfalldamage|hitfallset|hitfallvel|hitoverride|hitscaleset|hitvelset|lifeadd|lifebaraction|lifeset|loadfile|makedust|mapadd|mapset|matchrestart|modifyexplod|modifystagevar|movehitreset|nothitby|null|offset|palfx|parentmapadd|parentmapset|parentvaradd|parentvarset|pause|playerpush|playbgm|playsnd|posadd|posfreeze|posset|poweradd|powerset|printtoconsole|projectile|rankadd|redlifeadd|redlifeset|remappal|remapsprite|removeexplod|reversaldef|rootmapadd|rootmapset|rootvaradd|rootvarset|roundtimeadd|roundtimeset|savefile|scoreadd|screenbound|selfstate|sndpan|sprpriority|statetypeset|stopsnd|superpause|tagin|tagout|targetbind|targetdizzypointsadd|targetdrop|targetfacing|targetguardpointsadd|targetlifeadd|targetpoweradd|targetredlifeadd|targetscoreadd|targetstate|targetveladd|targetvelset|teammapadd|teammapset|text|trans|turn|varadd|varrandom|varrangeset|varset|veladd|velmul|velset|victoryquote|width|zoom|absolute|abspan|accel|add|addtype|affects|affectteam|afterimage.length|afterimage.time|air.animtype|air.cornerpush.veloff|air.fall|air.hittime|air.juggle|air.type|air.velocity|airguard.cornerpush.veloff|airguard.ctrltime|airguard.velocity|align|alpha|ampl|angle|anim|animtype|attr|bank|bindid|bindtime|both|cases|chainid|channel|color|ctrl|damage|darken|dest|dizzypoints|down.bounce|down.cornerpush.veloff|down.hittime|down.velocity|edge|elem|endcmdbuftime|envshake.ampl|envshake.freq|envshake.phase|envshake.time|excludeid|extendsmap|facep2|facing|fall.animtype|fall.damage|fall.envshake.ampl|fall.envshake.freq|fall.envshake.phase|fall.envshake.time|fall.kill|fall.recover|fall.recovertime|fall.xvelocity|fall.yvelocity|fall|first|flag|flag2|flag3|focallength|font|force|forceair|forcenofall|forcestand|framegap|freq|freqmul|fv|fvalue|getpower|givepower|ground.cornerpush.veloff|ground.hittime|ground.slidetime|ground.type|ground.velocity|guard.cornerpush.veloff|guard.ctrltime|guard.dist|guard.hittime|guard.kill|guard.pausetime|guard.slidetime|guard.sparkno|guard.velocity|guardflag|guardpoints|guardsound.channel|guardsound|helpertype|hitflag|hitonce|hitsound.channel|hitsound|id|ignorehitpause|immortal|in|inheritchannels|inheritjuggle|invertall|keepone|keyctrl|kill|kovelocity|last|layerno|leader|length|loop|loopend|loopstart|lowpriority|map|max|maxdist|min|mindist|movecamera|movetime|movetype|mul|multype|name|nochainid|none|numhits|offset|onhit|ontop|ownpal|p1def|p1facing|p1getp2facing|p1sprpriority|p1stateno|p2def|p2defmul|p2facing|p2getp1state|p2sprpriority|p2stateno|p3def|p4def|p5def|p6def|p7def|p8def|paladd|palbright|palcolor|palcontrast|palfx|palfx.add|palfx.mul|palfx.time|palinvertall|palmul|palpostbright|pan|params|partner|partnerstateno|path|pausebg|pausemovetime|pausetime|phase|physics|player|pos|pos2|postype|poweradd|preserve|preset|priority|projangle|projanim|projcancelanim|projection|projedgebound|projheightbound|projhitanim|projhits|projid|projmisstime|projpriority|projremanim|projremove|projremovetime|projscale|projshadow|projsprpriority|projstagebound|random|range|readplayerid|recursive|redirectid|redlife|reload|remappal|removeexplods|removeongethit|removetime|remvelocity|reset|reversal.attr|savedata|scale|score|self|shadow|sinadd|size.air.back|size.air.front|size.ground.back|size.ground.front|size.head.pos|size.height|size.mid.pos|size.proj.doscale|size.shadowoffset|size.xscale|size.yscale|slot|snap|snd|sound|source|space|spacing|sparkno|sparkxy|spr|sprpriority|stagebound|stagedef|stateno|statetype|supermove|supermovetime|teamside|text|time|timegap|timemul|top|trans|type|under|unhittable|v|value|vel|velmul|velocity|velset|vfacing|volume|volumescale|waveform|x|xangle|xvel|y|yaccel|yangle|yvel');
const ZSS_MODIFIER_WORDS = wordSet('persistent|ignorehitpause');

function tokenizeZssLine(line: string): CharacterSyntaxToken[] {
  if (line.includes('#')) return [{ text: line || ' ', scope: 'comment' }];
  const tokens: CharacterSyntaxToken[] = [];
  const pattern = /["'][^"']*["']|\$\w+|\b\d+\b|[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*|[+\-*/%!&|^~=:<>[\](){},.;]/g;
  let offset = 0;
  for (const match of line.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > offset) tokens.push({ text: line.slice(offset, index), scope: 'plain' });
    tokens.push({ text: match[0], scope: classifyZssToken(match[0]) });
    offset = index + match[0].length;
  }
  if (offset < line.length) tokens.push({ text: line.slice(offset), scope: 'plain' });
  return tokens.length > 0 ? tokens : [{ text: line || ' ', scope: 'plain' }];
}

function classifyZssToken(token: string): CharacterSyntaxScope {
  const lower = token.toLowerCase();
  if (/^["']/.test(token)) return 'string';
  if (/^\$/.test(token)) return 'zss-variable';
  if (/^\d+$/.test(token)) return 'number';
  if (ZSS_CONTROL_WORDS.has(lower)) return 'control';
  if (ZSS_FUNCTION_WORDS.has(lower)) return 'zss-function';
  if (ZSS_REDIRECT_WORDS.has(lower)) return 'zss-redirect';
  if (ZSS_MODIFIER_WORDS.has(lower)) return 'zss-modifier';
  if (ZSS_CONTROLLER_WORDS.has(lower)) return 'zss-controller';
  if (/^[+\-*/%!&|^~=:<>[\](){},.;]$/.test(token)) return 'zss-operator';
  return 'plain';
}

function wordSet(words: string): ReadonlySet<string> {
  return new Set(words.split('|').map((word) => word === 'frontedgedodydist' ? 'frontedgebodydist' : word));
}

function tokenizeValue(value: string, kind: 'def' | 'cns'): CharacterSyntaxToken[] {
  const result: CharacterSyntaxToken[] = [];
  let offset = 0;
  const pattern = kind === 'def'
    ? /"[^"]*"|\//g
    : /"[^"]*"|&&|\|\||[()]|\bifelse\b/gi;
  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > offset) result.push({ text: value.slice(offset, index), scope: 'constant' });
    const matched = match[0];
    result.push({
      text: matched,
      scope: matched.startsWith('"')
        ? 'string'
        : 'keyword',
    });
    offset = index + matched.length;
  }
  if (offset < value.length) result.push({ text: value.slice(offset), scope: 'constant' });
  return result.length > 0 ? result : [{ text: value, scope: 'constant' }];
}

function plain(text: string): CharacterSyntaxToken[] {
  return text ? [{ text, scope: 'plain' }] : [];
}

function compact(tokens: CharacterSyntaxToken[]): CharacterSyntaxToken[] {
  return tokens.filter((token) => token.text.length > 0);
}
