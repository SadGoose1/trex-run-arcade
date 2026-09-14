// Generates main.blocks (MakeCode Arcade block XML) for "T-Rex Run".
// Every block type/field/value name below was verified against real
// MakeCode Arcade projects (see research notes) so the XML loads natively
// in the Blocks editor.
const fs = require("fs");
const path = require("path");
// Sprite art: HQ versions generated from the user-provided images
// (dino, 3 trees, sun, moon, 9 clouds, bird, plus cactus/star/heart/bolt/ground).
// Chars map to the Arcade 16-color palette (0=transparent,1=white,2=red,3=pink,
// 4=orange,5=yellow,6=teal,7=green,8=blue,9=cyan,a=purple,b=mauve,
// c=dark purple,d=pale,e=brown,f=black).
const S = require("./hq/sprites_hq.js");
// Compatibility: HQ ships sprite VARIANTS (tree/cloud1-9, bird1/bird2).
// Pick randomly at spawn time so all 3 trees, all 9 clouds, and both
// bird poses appear in the game.
const treeVar = () => [S.tree1, S.tree2, S.tree3][Math.floor(Math.random() * 3)];
const cloudVar = () => [S.cloud1, S.cloud2, S.cloud3, S.cloud4, S.cloud5, S.cloud6, S.cloud7, S.cloud8, S.cloud9][Math.floor(Math.random() * 9)];

const SCORE_STEP = process.env.FASTSCORE ? 25 : 1;
const NO_SETTINGS = !!process.env.NO_SETTINGS;
let idc = 0;
const nid = () => "blk" + (++idc);

// ---------------- variables registry ----------------
const kindVars = ["Player", "Projectile", "Enemy", "Bird", "Star", "Heart", "Bolt", "Cloud"];
const plainVars = ["dino", "temp", "ts", "pick", "r2", "speed", "effSpeed", "vy", "gravity", "jumpHeld", "stage", "grounded", "ducking", "started", "starMs", "hitInvMs", "slowMs", "nightMode", "blinkOn", "phase", "nameI", "charI", "entryMode", "overMode", "page", "myRank", "myScore", "myName", "lbScores", "nameArr", "lbCount", "lastI", "ok", "tmpS", "tmpN", "vol", "volSpr", "sunSpr", "moonSpr", "letters", "entrySprites", "boardRows", "eCount", "rCount", "idx", "slots", "first", "cIdx", "nm", "nm2", "i", "a", "pass", "bIdx", "selftestPhase"];
const varId = {};
kindVars.forEach((k) => (varId[k] = "kind_" + k.toLowerCase()));
plainVars.forEach((v) => (varId[v] = "var_" + v));

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ---------------- shadows (literal pickers) ----------------
const numOnly = (v) => {
  if (typeof v !== "number") throw new Error("expected a number, got XML/block: " + String(v).slice(0, 60));
  return v;
};
const sh = {
  num: (n) => `<shadow type="math_number"><field name="NUM">${numOnly(n)}</field></shadow>`,
  whole: (n) => `<shadow type="math_whole_number"><field name="NUM">${numOnly(n)}</field></shadow>`,
  bool: (b) => `<shadow type="logic_boolean"><field name="BOOL">${b}</field></shadow>`,
  text: (t) => {
    if (typeof t !== "string") throw new Error("text shadow needs a plain string, got: " + String(t).slice(0, 60));
    return `<shadow type="text"><field name="TEXT">${esc(t)}</field></shadow>`;
  },
  time: (ms) => `<shadow type="timePicker"><field name="ms">${numOnly(ms)}</field></shadow>`,
  speed: (v) => `<shadow type="spriteSpeedPicker"><field name="speed">${numOnly(v)}</field></shadow>`,
  pos: (v) => `<shadow type="positionPicker"><field name="index">${numOnly(v)}</field></shadow>`,
  color: (i) => `<shadow type="colorindexpicker"><field name="index">${numOnly(i)}</field></shadow>`,
  toggle: (b) => `<shadow type="toggleOnOff"><field name="on">${b}</field></shadow>`,
  kind: (k) => `<shadow type="spritekind"><field name="MEMBER">${k}</field></shadow>`,
  winlose: (b) => `<shadow type="toggleWinLose"><field name="win">${b}</field></shadow>`,
  reporter: (name) => `<shadow type="variables_get_reporter"><field name="VAR" id="${varId[name]}">${name}</field></shadow>`,
  percent: (p) => `<shadow type="math_number_minmax"><mutation min="0" max="Infinity" label="Percentage" precision="0"></mutation><field name="SLIDER">${numOnly(p)}</field></shadow>`,
  tempo: (t) => `<shadow type="math_number_minmax"><mutation min="40" max="500" label="Tempo" precision="0"></mutation><field name="SLIDER">${numOnly(t)}</field></shadow>`,
};

function imgLiteral(rows) {
  const w = rows[0].length;
  rows.forEach((r, i) => {
    if (r.length !== w) throw new Error(`img row ${i} width ${r.length} != ${w}: ${r}`);
    if (!/^[.0-9a-f]*$/.test(r)) throw new Error(`img row ${i} bad chars: ${r}`);
  });
  return "img`\n" + rows.map((r) => r.replace(/\./g, "0")).join("\n") + "\n`";
}

function imgPicker(rows) {
  return `<shadow type="screen_image_picker"><field name="img">${imgLiteral(rows)}</field></shadow>`;
}

function animPicker(frames) {
  const body = frames.map((f) => imgLiteral(f)).join(",");
  return `<shadow type="animation_editor"><field name="frames">[${body}]</field></shadow>`;
}

// ---------------- core builders ----------------
function block(type, inner, attrs = "") {
  return `<block type="${type}" id="${nid()}"${attrs}>${inner || ""}</block>`;
}

function value(name, shadowXml, blockXml) {
  return `<value name="${name}">${shadowXml}${blockXml || ""}</value>`;
}

function listPush(listVar, valueBlock) {
  return block("array_push", value("list", sh.num(0), vget(listVar)) + value("value", sh.num(0), valueBlock));
}
function listLen(listVar) {
  return block("lists_length", value("LIST", sh.num(0), vget(listVar)));
}
function listGet(listVar, idx) {
  // idx may be block XML (nested under a default shadow) or a shadow/number
  const a = (typeof idx === "string" && idx.startsWith("<block")) ? { shadow: sh.num(0), block: idx } : { shadow: idx };
  return block("lists_index_get", value("LIST", sh.num(0), vget(listVar)) + value("INDEX", a.shadow, a.block));
}
function listSet(listVar, idx, val) {
  // idx/val may be block XML (nested under default shadows) or shadows
  const asSide = (x) => (typeof x === "string" && x.startsWith("<block")) ? { shadow: sh.num(0), block: x } : { shadow: x };
  const a = asSide(idx), b = asSide(val);
  return block("lists_index_set", value("LIST", sh.num(0), vget(listVar)) + value("INDEX", a.shadow, a.block) + value("VALUE", b.shadow, b.block));
}
function forOfList(loopVar, listBlock, stmts) {
  return `<block type="pxt_controls_for_of" id="${nid()}">` + value("VAR", sh.reporter(loopVar)) + value("LIST", sh.num(0), listBlock) + `<statement name="DO">${chain(stmts)}</statement></block>`;
}
function forLoop(loopVar, to, stmts) {
  // to may be a number, a shadow, or a block expression
  const t = (typeof to === "string" && (to.startsWith("<block") || to.startsWith("<shadow")))
    ? (to.startsWith("<block") ? { shadow: sh.whole(10), block: to } : { shadow: to })
    : { shadow: sh.whole(numOnly(to)) };
  return `<block type="pxt_controls_for" id="${nid()}">` + value("VAR", sh.reporter(loopVar)) + value("TO", t.shadow, t.block) + `<statement name="DO">${chain(stmts)}</statement></block>`;
}
function settingsExists(name) {
  return block("block_settings_exists", value("name", sh.text(name)));
}
function settingsWriteNumberArray(name) {
  return block("block_settings_write_number_array", value("name", sh.text(name)) + value("value", sh.num(0), block("lists_create_with", `<mutation items="0"></mutation>`)));
}
function settingsReadNumberArray(name) {
  return block("block_settings_read_number_array", value("name", sh.text(name)));
}
function settingsWriteString(name, strBlock) {
  return block("block_settings_write_string", value("name", sh.text(name)) + value("value", sh.text(""), strBlock));
}
// block-accepting variants: the key/message itself is a computed block
function settingsReadStringBlock(nameBlock) {
  return block("block_settings_read_string", value("name", sh.text(""), nameBlock));
}
function settingsWriteStringBlock(nameBlock, strBlock) {
  return block("block_settings_write_string", value("name", sh.text(""), nameBlock) + value("value", sh.text(""), strBlock));
}
function settingsReadString(name) {
  return block("block_settings_read_string", value("name", sh.text(name)));
}
function stringSplit(strBlock, sep) {
  return block("string_split", value("this", sh.text(""), strBlock) + value("sep", sh.text(sep)));
}
function textSpriteCreate(text) {
  // text may be a plain string, a text shadow, or a block (e.g. text_join)
  const isBlock = typeof text === "string" && text.startsWith("<block");
  const isShadow = typeof text === "string" && text.startsWith("<shadow");
  return block("textsprite_create", `<mutation xmlns="http://www.w3.org/1999/xhtml" _expanded="0" _input_init="true"></mutation>` + value("text", isBlock ? sh.text("") : (isShadow ? text : sh.text(text)), isBlock ? text : undefined) + value("fg", sh.color(1)));
}
function tsSetText(spriteXml, textBlock) {
  return block("TextSprite_setText", value("this", sh.num(0), spriteXml) + value("text", sh.text(""), textBlock));
}
function tsSetFont(spriteXml, h) {
  return block("TextSprite_setMaxFontHeight", value("this", sh.num(0), spriteXml) + value("height", sh.num(h)));
}
function destroyAllOfKind(kindName) {
  return block("sprites_destroy_all_sprites_of_kind", value("kind", sh.kind(kindName)));
}
function emptyList() {
  return block("lists_create_with", `<mutation items="0"></mutation>`);
}
// fixed 5-slot list literal — the board is a TOP-5
function list5(itemShadow) {
  let values = "";
  for (let k = 0; k < 5; k++) values += value("ADD" + k, itemShadow);
  return block("lists_create_with", `<mutation items="5"></mutation>` + values);
}
// 50-slot list of the SAME block expression — used to seed sprite lists with
// a hidden text sprite so the list decompiles as TextSprite[] (a number-seeded
// list decompiles as number[] and fails TS assignment)
function list50Of(blockXml) {
  let values = "";
  for (let k = 0; k < 50; k++) values += value("ADD" + k, null, blockXml);
  return block("lists_create_with", `<mutation items="50"></mutation>` + values);
}
function side(v) {
  return { shadow: sh.num(0), block: v };
}
function textJoinBB(b0, b1) {
  // each arg may be a block xml string or a literal text shadow
  const asSide = (x) => (typeof x === "string" && x.startsWith("<block"))
    ? { shadow: sh.text(""), block: x }
    : { shadow: x };
  const a = asSide(b0), b = asSide(b1);
  return block("text_join", `<mutation items="2"></mutation>` + value("ADD0", a.shadow, a.block) + value("ADD1", b.shadow, b.block));
}
function textJoin(t, blockXml) {
  return block("text_join", `<mutation items="2"></mutation>` + value("ADD0", sh.text(t)) + value("ADD1", sh.text(""), blockXml));
}
function vget(name) {
  return block("variables_get", `<field name="VAR" id="${varId[name]}">${name}</field>`);
}

function argumentReporter(name, typename) {
  return block("argument_reporter_custom", `<mutation typename="${typename || "Sprite"}"></mutation><field name="VALUE">${name}</field>`);
}

// chain: join statement blocks with <next>. Blockly requires <next> to be a
// child of the preceding block (before its closing tag), not a sibling.
function chain(stmts) {
  let out = "";
  for (let i = stmts.length - 1; i >= 0; i--) {
    if (!out) { out = stmts[i]; continue; }
    const idx = stmts[i].lastIndexOf("</block>");
    if (idx < 0) throw new Error("chain(): statement missing closing </block>");
    out = stmts[i].slice(0, idx) + "<next>" + out + "</next>" + stmts[i].slice(idx);
  }
  return out;
}

function setVar(name, valueXml) {
  // valueXml is either a block (nested under a default shadow) or a full
  // value-side XML such as a text shadow
  const isBlock = typeof valueXml === "string" && valueXml.startsWith("<block");
  return block("variables_set", `<field name="VAR" id="${varId[name]}">${name}</field>` + value("VALUE", isBlock ? sh.num(0) : valueXml, isBlock ? valueXml : undefined));
}
function setVarBool(name, boolVal) {
  return block("variables_set", `<field name="VAR" id="${varId[name]}">${name}</field>` + value("VALUE", sh.bool(boolVal)));
}
function setVarExpr(name, shadowXml, exprXml) {
  return block("variables_set", `<field name="VAR" id="${varId[name]}">${name}</field>` + value("VALUE", shadowXml, exprXml));
}
function setVarNum(name, n) {
  return block("variables_set", `<field name="VAR" id="${varId[name]}">${name}</field>` + value("VALUE", sh.num(n)));
}
function changeVar(name, delta) {
  return block("variables_change", `<field name="VAR" id="${varId[name]}">${name}</field>` + value("VALUE", sh.num(delta)));
}
function changeVarExpr(name, shadowXml, exprXml) {
  return block("variables_change", `<field name="VAR" id="${varId[name]}">${name}</field>` + value("VALUE", shadowXml, exprXml));
}

// logic / math reporters
function cmp(op, aSide, bSide) {
  // sides: {shadow, block?}
  return block("logic_compare", `<field name="OP">${op}</field>` + value("A", aSide.shadow, aSide.block) + value("B", bSide.shadow, bSide.block));
}
function and(a, b) {
  return block("logic_operation", `<field name="OP">AND</field>` + value("A", sh.bool("TRUE"), a) + value("B", sh.bool("TRUE"), b));
}
function or(a, b) {
  return block("logic_operation", `<field name="OP">OR</field>` + value("A", sh.bool("TRUE"), a) + value("B", sh.bool("TRUE"), b));
}
function not(x) {
  return block("logic_negate", value("BOOL", sh.bool("TRUE"), x));
}
function arith(op, aSide, bSide) {
  return block("math_arithmetic", `<field name="OP">${op}</field>` + value("A", aSide.shadow, aSide.block) + value("B", bSide.shadow, bSide.block));
}
function randXPos() {
  // randomly x=168 or x=204 (same two lanes as trees/birds)
  return arith("ADD", { shadow: sh.num(168) }, { shadow: sh.num(0), block: arith("MULTIPLY", { shadow: sh.num(36) }, { shadow: sh.num(0), block: random(0, 1) }) });
}
function constrain(v, low, high) {
  return block("math_constrain_value", value("value", sh.num(50), v) + value("low", sh.num(low)) + value("high", sh.num(high)));
}
function modulo(a, b) {
  return block("math_modulo", value("DIVIDEND", sh.num(0), a) + value("DIVISOR", sh.num(b)));
}
function random(min, limit) {
  return block("device_random", value("min", sh.num(min)) + value("limit", sh.num(limit)));
}
function scoreReporter() {
  return block("hudScore");
}
function lifeReporter() {
  return block("hudLife");
}

// if with N conditions + optional else. conds: [condBlock...], branches: [[stmts]...], elseStmts: [stmts]|null
function ifStmt(conds, branches, elseStmts) {
  const n = conds.length;
  const hasElse = elseStmts && elseStmts.length > 0;
  let mutation = "";
  if (n > 1 || hasElse) {
    mutation = `<mutation ${n > 1 ? `elseif="${n - 1}" ` : ""}${hasElse ? `else="1"` : ""}></mutation>`;
  }
  let inner = mutation;
  conds.forEach((c, i) => {
    inner += value("IF" + i, sh.bool("TRUE"), c);
  });
  branches.forEach((b, i) => {
    inner += `<statement name="DO${i}">${chain(b)}</statement>`;
  });
  if (hasElse) inner += `<statement name="ELSE">${chain(elseStmts)}</statement>`;
  return block("controls_if", inner);
}


// the 3 editable letter slots live at entrySprites[2..4]; index 0 is the game
// title, 1 is ENTER NAME, 5 is the caret — offset every nameI lookup by 2
function letterSlot() {
  return listGet("entrySprites", arith("ADD", { shadow: sh.num(0), block: vget("nameI") }, { shadow: sh.num(2) }));
}
function caretSprite() {
  return listGet("entrySprites", sh.num(5));
}
function caretMove() {
  return setPos(caretSprite(), 0, 35, null, arith("ADD", { shadow: sh.num(68) }, { shadow: sh.num(12), block: arith("MULTIPLY", { shadow: sh.num(0), block: vget("nameI") }, { shadow: sh.num(12) }) }));
}
// ---------------- game statement builders ----------------
function splash(title, subtitle) {
  return block("gameSplash", `<mutation xmlns="http://www.w3.org/1999/xhtml" _expanded="1" _input_init="true"></mutation>` + value("title", sh.text(title)) + value("subtitle", sh.text(subtitle)));
}
function setBackgroundColor(idx) {
  return block("gamesetbackgroundcolor", value("color", sh.color(idx)));
}
function setLife(n) { return block("hudSetLife", value("value", sh.num(n))); }
function setScore(n) { return block("hudsetScore", value("value", sh.num(n))); }
function changeScore(n) { return block("hudChangeScoreBy", value("value", sh.num(n))); }
function changeLife(n) { return block("hudChangeLifeBy", value("value", sh.num(n))); }

function createSprite(rows, kind) {
  return block("spritescreate", value("img", imgPicker(rows)) + value("kind", sh.kind(kind)));
}
function setPos(spriteXml, x, y, yBlock, xBlock) {
  return block("spritesetpos", value("sprite", sh.num(0), spriteXml) + value("x", sh.pos(x), xBlock) + value("y", sh.pos(y), yBlock));
}
function setVel(spriteXml, vxShadow, vxBlock, vyShadow, vyBlock) {
  return block("spritesetvel", value("sprite", sh.num(0), spriteXml) + value("vx", vxShadow, vxBlock) + value("vy", vyShadow, vyBlock));
}
function setImage(spriteXml, rows) {
  return block("spritesetimage", value("sprite", sh.num(0), spriteXml) + value("img", imgPicker(rows)));
}
function setFlag(spriteXml, flag, onShadow, onBlock) {
  return block("spritesetsetflag", `<field name="flag">${flag}</field>` + value("sprite", sh.num(0), spriteXml) + value("on", onShadow, onBlock));
}
function stayInScreen(spriteXml, on) {
  return block("spritesetsetstayinscreen", value("sprite", sh.num(0), spriteXml) + value("on", sh.toggle(on)));
}
function runAnim(spriteXml, frames, interval, loop) {
  return block("run_image_animation", value("sprite", sh.num(0), spriteXml) + value("frames", animPicker(frames)) + value("frameInterval", sh.time(interval)) + value("loop", sh.toggle(loop)));
}
function stopAnims(spriteXml) {
  return block("stop_animations", `<field name="type">animation.AnimationTypes.All</field>` + value("sprite", sh.num(0), spriteXml));
}
function destroy(spriteXml) {
  return block("spritedestroy2", `<mutation xmlns="http://www.w3.org/1999/xhtml" _expanded="0" _input_init="true"></mutation>` + value("sprite", sh.num(0), spriteXml));
}
function playMusic(melody, tempo, mode) {
  const playable = `<shadow type="music_string_playable">` + value("melody", `<shadow type="melody_editor"><field name="melody">&quot;${esc(melody)}&quot;</field></shadow>`) + value("tempo", sh.tempo(tempo)) + `</shadow>`;
  return block("music_playable_play", `<field name="playbackMode">${mode}</field>` + value("toPlay", playable));
}
function getY(spriteXml) {
  return block("Sprite_blockCombine_get", `<field name="property">Sprite.y</field>` + value("mySprite", sh.num(0), spriteXml));
}

// ---------------- top-level event blocks ----------------
function onStart(stmts) {
  return `<block type="pxt-on-start" id="${nid()}" x="0" y="0"><statement name="HANDLER">${chain(stmts)}</statement></block>`;
}
function foreverLoop(stmts, x, y) {
  return `<block type="forever" id="${nid()}" x="${x}" y="${y}"><statement name="HANDLER">${chain(stmts)}</statement></block>`;
}
function gameInterval(ms, stmts, x, y) {
  return `<block type="gameinterval" id="${nid()}" x="${x}" y="${y}">` + value("period", sh.time(ms)) + `<statement name="HANDLER">${chain(stmts)}</statement></block>`;
}
function gameUpdate(stmts, x, y) {
  return `<block type="gameupdate" id="${nid()}" x="${x}" y="${y}"><statement name="HANDLER">${chain(stmts)}</statement></block>`;
}
function keyOnEvent(button, event, stmts, x, y) {
  return `<block type="keyonevent" id="${nid()}" x="${x}" y="${y}"><field name="button">${button}</field><field name="event">${event}</field><statement name="HANDLER">${chain(stmts)}</statement></block>`;
}
function spritesOverlap(kind, otherKind, stmts, x, y) {
  const spriteParam = value("HANDLER_DRAG_PARAM_sprite", `<shadow type="argument_reporter_custom"><mutation typename="Sprite"></mutation><field name="VALUE">sprite</field></shadow>`);
  const otherParam = value("HANDLER_DRAG_PARAM_otherSprite", `<shadow type="argument_reporter_custom"><mutation typename="Sprite"></mutation><field name="VALUE">otherSprite</field></shadow>`);
  return `<block type="spritesoverlap" id="${nid()}" x="${x}" y="${y}">` + spriteParam + value("kind", sh.kind(kind)) + otherParam + value("otherKind", sh.kind(otherKind)) + `<statement name="HANDLER">${chain(stmts)}</statement></block>`;
}
function lifeZeroEvent(stmts, x, y) {
  return `<block type="gamelifeevent" id="${nid()}" x="${x}" y="${y}"><statement name="HANDLER">${chain(stmts)}</statement></block>`;
}
function onScore(score, stmts, x, y) {
  return `<block type="gameonscore" id="${nid()}" x="${x}" y="${y}">` + value("score", sh.num(score)) + `<statement name="HANDLER">${chain(stmts)}</statement></block>`;
}
function forOfKind(loopVar, kind, stmts, x, y) {
  const list = block("allOfKind", value("kind", sh.kind(kind)));
  return `<block type="pxt_controls_for_of" id="${nid()}" x="${x}" y="${y}">` + value("VAR", sh.reporter(loopVar)) + value("LIST", sh.num(0), list) + `<statement name="DO">${chain(stmts)}</statement></block>`;
}
function functionDef(name, functionid, stmts, x, y) {
  return `<block type="function_definition" id="${nid()}" x="${x}" y="${y}"><mutation name="${name}" functionid="${functionid}"></mutation><field name="function_name">${name}</field><statement name="STACK">${chain(stmts)}</statement></block>`;
}
function functionCall(name, functionid) {
  return block("function_call", `<mutation name="${name}" functionid="${functionid}"></mutation>`);
}
function setGameOverMessage(text, win) {
  return block("game_setgameovermessage", value("message", sh.text(text)) + value("win", sh.winlose(win)));
}
// message built from a block (e.g. text_join with the rank) — must nest the
// block under the value, not escape it into the text shadow
function setGameOverMessageBlock(msgBlock, win) {
  return block("game_setgameovermessage", value("message", sh.text(""), msgBlock) + value("win", sh.winlose(win)));
}
function setGameOverEffect(effect, win) {
  return block("game_setgameovereffect", `<field name="effect">${effect}</field>` + value("win", sh.winlose(win)));
}
// screen effects live in pxt-common-packages libs/game (no extension needed);
// the effect is a FIELD, not a value: <field name="effect">effects.confetti</field>
function confetti() {
  return block("particlesStartScreenAnimation", `<mutation xmlns="http://www.w3.org/1999/xhtml" _expanded="0" _input_init="false"></mutation><field name="effect">effects.confetti</field>`);
}
function gameOver2(win) {
  return block("gameOver2", value("win", sh.winlose(win)));
}

// =====================================================================
// GAME
// =====================================================================
const other = () => argumentReporter("otherSprite");

// helper: move world sprites at a fraction of effSpeed
function worldMove(kindName, fractionNum, x, y) {
  // vx = 0 - effSpeed / fractionNum ; vy = 0
  const vxExpr = arith("MINUS", { shadow: sh.num(0) }, { shadow: sh.num(2), block: fractionNum === 1 ? vget("effSpeed") : arith("DIVIDE", { shadow: sh.num(0), block: vget("effSpeed") }, { shadow: sh.num(fractionNum) }) });
  return forOfKind("temp", kindName, [setVel(vget("temp"), sh.speed(-100), vxExpr, sh.speed(0))], x, y);
}

const topBlocks = [];

// ---------- ON START ----------
const NO_SPLASH = !!process.env.NO_SPLASH;
const startStmts = [
  setBackgroundColor(9),
  ...(NO_SPLASH ? [setVarBool("started", "TRUE")] : []),
];
topBlocks.push(
  onStart(startStmts.concat([
    setLife(3),
    setScore(0),
    setVarNum("speed", 100),
    setVarNum("effSpeed", 100),
    setVarNum("vy", 0),
    setVarNum("gravity", 20),
    setVarNum("stage", 0),
    setVarBool("jumpHeld", "FALSE"),
    setVarBool("grounded", "TRUE"),
    setVarBool("ducking", "FALSE"),
    ...(NO_SPLASH ? [] : [setVarBool("started", "FALSE")]),
    setVarNum("starMs", 0),
    setVarNum("hitInvMs", 0),
    setVarNum("slowMs", 0),
    setVarBool("nightMode", "FALSE"),
    setVarBool("blinkOn", "FALSE"),
    setVar("dino", createSprite(S.dino1, "Player")),
    stayInScreen(vget("dino"), "true"),
    setPos(vget("dino"), 24, 100),
    runAnim(vget("dino"), [S.dino1, S.dino2], 150, "true"),
    // ground line (static, never moves: kind Projectile is not swept by the tick loop)
    setVar("temp", createSprite(S.ground, "Projectile")),
    setPos(vget("temp"), 80, 109),
    // daytime sun (stationary; swapped for the moon at night)
    setVar("sunSpr", createSprite(S.sun, "Projectile")),
    setPos(vget("sunSpr"), 138, 30),
    setVarNum("vol", 4),
    playMusic("C5 E5 G5 A5 G5 E5 C5 D5 ", 120, "music.PlaybackMode.LoopingInBackground"),
    // leaderboard + name entry (started stays false until the name is confirmed)
    setVarNum("nameI", 0),
    setVarNum("charI", 0),
    setVarBool("entryMode", "TRUE"),
    setVarBool("overMode", "FALSE"),
    setVarNum("page", 0),
    setVarNum("myRank", 0),
    setVarNum("myScore", 0),
    setVar("myName", sh.text("")),
    setVarNum("lbCount", 0),
    setVarNum("eCount", 0),
    setVarNum("rCount", 0),
    // fixed 50-slot boards so all list IO is lists_index_get/set (proven blocks)
    setVarExpr("lbScores", sh.num(0), list5(sh.num(0))),
    setVarExpr("nameArr", sh.text(""), list5(sh.text(""))),
    listSet("lbScores", sh.whole(0), sh.num(100)),
    listSet("lbScores", sh.whole(1), sh.num(50)),
    listSet("nameArr", sh.whole(0), sh.text("AAA")),
    listSet("nameArr", sh.whole(1), sh.text("BBB")),
    setVarNum("lbCount", 2),
    // hidden empty-text sprite seeds the sprite lists so they type as TextSprite[]
    setVar("ts", textSpriteCreate(sh.text(""))),
    setVarExpr("entrySprites", sh.num(0), list50Of(vget("ts"))),
    setVarExpr("boardRows", sh.num(0), list50Of(vget("ts"))),
    setVarExpr("slots", sh.num(0), block("lists_create_with", `<mutation items="3"></mutation>` + value("ADD0", sh.num(0)) + value("ADD1", sh.num(0)) + value("ADD2", sh.num(0)))),
    setVarExpr("letters", sh.num(0), block("lists_create_with", `<mutation items="26"></mutation>` +
      ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"].map((L, k) => value("ADD" + k, sh.text(L))).join(""))),
    ...(NO_SETTINGS ? [] : [functionCall("lb_settings_load", "F_lbload")]),
    functionCall("lb_entry_show", "F_eshow"),
    functionCall("lb_board_show", "F_bshow"),
  ]))
);

// ---------- SELFTEST (test builds only) ----------
// Loop A fires once at ~2s: fake a finished run (score 123, name ZQX) through
// lb_submit + lb_board_show. Loop B fires once at ~60s: leave entry mode and
// start gameplay the same way the real A=OK confirm does (kept long so the
// submitted board stays on screen for screenshot verification).
if (process.env.SELFTEST) {
  topBlocks.push(
    foreverLoop([
      block("device_pause", value("pause", sh.time(2000))),
      ifStmt([cmp("EQ", { shadow: sh.num(0), block: vget("selftestPhase") }, { shadow: sh.num(0) })], [
        [
          setScore(123),
          setVar("myName", sh.text("ZQX")),
          functionCall("lb_submit", "F_lbsub"),
          functionCall("lb_board_show", "F_bshow"),
          setVarNum("selftestPhase", 1),
        ],
      ]),
    ], 0, 0)
  );
  topBlocks.push(
    foreverLoop([
      block("device_pause", value("pause", sh.time(parseInt(process.env.SELFTEST_START_MS, 10) || 60000))),
      ifStmt([cmp("EQ", { shadow: sh.num(0), block: vget("selftestPhase") }, { shadow: sh.num(1) })], [
        [
          forLoop("i", arith("MINUS", { shadow: sh.num(0), block: vget("eCount") }, { shadow: sh.num(1) }), [
            [destroy(listGet("entrySprites", vget("i")))],
          ]),
          forLoop("i", arith("MINUS", { shadow: sh.num(0), block: vget("rCount") }, { shadow: sh.num(1) }), [
            [destroy(listGet("boardRows", vget("i")))],
          ]),
          setVarNum("eCount", 0),
          setVarNum("rCount", 0),
          setVarBool("entryMode", "FALSE"),
          setVarBool("started", "TRUE"),
          setVarNum("selftestPhase", 2),
        ],
      ]),
    ], 0, 400)
  );
}

// ---------- AUTO-JUMP (test builds only) ----------
if (process.env.AUTOJUMP) {
  topBlocks.push(
    gameInterval(1500, [
      setVarNum("vy", -200),
      setVarBool("grounded", "FALSE"),
      setVarBool("jumpHeld", "TRUE"),
      stopAnims(vget("dino")),
      setImage(vget("dino"), S.dinoJump),
      setVel(vget("dino"), sh.speed(0), null, sh.speed(-200)),
    ], 3250, 0)
  );
}

// ---------- SCORE TICK (forever) ----------
topBlocks.push(
  foreverLoop(
    [
      block("device_pause", value("pause", sh.time(100))),
      ifStmt([vget("started")], [
        [
          changeScore(SCORE_STEP),
          setVar("speed", constrain(arith("ADD", { shadow: sh.num(100) }, { shadow: sh.num(3), block: arith("DIVIDE", { shadow: sh.num(0), block: scoreReporter() }, { shadow: sh.num(3) }) }), 100, 350)),
          // STAGE UP every 500 points: silently harder (pairs + speed), no pause
          ifStmt([and(vget("started"), cmp("GTE", { shadow: sh.num(0), block: scoreReporter() }, { shadow: sh.num(500), block: arith("MULTIPLY", { shadow: sh.num(0), block: arith("ADD", { shadow: sh.num(0), block: vget("stage") }, { shadow: sh.num(1) }) }, { shadow: sh.num(500) }) }))], [
            [changeVar("stage", 1)],
          ]),
        ],
      ]),
    ],
    0, 900
  )
);

// ---------- WORLD TICK (every 100ms) ----------
const tick = [];
// star timer
tick.push(
  ifStmt([cmp("GT", { shadow: sh.num(0), block: vget("starMs") }, { shadow: sh.num(0) })], [
    [
      changeVar("starMs", -100),
      ifStmt([cmp("LTE", { shadow: sh.num(0), block: vget("starMs") }, { shadow: sh.num(0) })], [[functionCall("update_dino_image", "F_uddi")]]),
    ],
  ])
);
// hit invincibility timer + blink
tick.push(
  ifStmt([cmp("GT", { shadow: sh.num(0), block: vget("hitInvMs") }, { shadow: sh.num(0) })], [
    [
      changeVar("hitInvMs", -100),
      setVarExpr("blinkOn", sh.bool("TRUE"), not(vget("blinkOn"))),
      setFlag(vget("dino"), "SpriteFlag.Invisible", sh.toggle("false"), vget("blinkOn")),
      ifStmt([cmp("LTE", { shadow: sh.num(0), block: vget("hitInvMs") }, { shadow: sh.num(0) })], [
        [setFlag(vget("dino"), "SpriteFlag.Invisible", sh.toggle("false"))],
      ]),
    ],
  ])
);
// slow-mo timer
tick.push(ifStmt([cmp("GT", { shadow: sh.num(0), block: vget("slowMs") }, { shadow: sh.num(0) })], [[changeVar("slowMs", -100)]]));
// effective world speed
tick.push(
  ifStmt([cmp("GT", { shadow: sh.num(0), block: vget("slowMs") }, { shadow: sh.num(0) })], [
    [setVar("effSpeed", arith("DIVIDE", { shadow: sh.num(0), block: vget("speed") }, { shadow: sh.num(2) }))],
  ], [setVar("effSpeed", vget("speed"))])
);
// sweep world sprite velocities
tick.push(worldMove("Enemy", 1, 0, 2500));
// birds glide at half world speed (their own kind, so the Enemy sweep
// can't snap them back to full speed)
tick.push(worldMove("Bird", 2, 0, 2450));
tick.push(worldMove("Star", 1, 0, 2700));
tick.push(worldMove("Heart", 1, 0, 2900));
tick.push(worldMove("Bolt", 1, 0, 3100));
tick.push(worldMove("Cloud", 2, 0, 3300));
// day / night cycle every 150 points: the sun and moon swap places (both are
// stationary Projectile-kind sprites so they hang in the sky)
tick.push(setVar("phase", modulo(scoreReporter(), 300)));
  tick.push(
    ifStmt([and(not(vget("nightMode")), cmp("GTE", { shadow: sh.num(0), block: vget("phase") }, { shadow: sh.num(150) }))], [
      [
        setBackgroundColor(15),
        setVarBool("nightMode", "TRUE"),
      destroy(vget("sunSpr")),
      setVar("moonSpr", createSprite(S.moon, "Projectile")),
      setPos(vget("moonSpr"), 128, 26),
    ],
  ])
);
tick.push(
  ifStmt([and(vget("nightMode"), cmp("LT", { shadow: sh.num(0), block: vget("phase") }, { shadow: sh.num(150) }))], [
    [
      setBackgroundColor(9),
      setVarBool("nightMode", "FALSE"),
      destroy(vget("moonSpr")),
      setVar("sunSpr", createSprite(S.sun, "Projectile")),
      setPos(vget("sunSpr"), 138, 30),
    ],
  ])
);
topBlocks.push(gameInterval(100, tick, 0, 1500));

// ---------- OBSTACLE SPAWNER (every 1200ms) ----------
if (!process.env.NO_OBSTACLES) topBlocks.push(
  gameInterval(1200, [
    ifStmt([vget("started")], [
      [
        setVar("pick", random(1, 10)),
        ifStmt(
          [cmp("LTE", { shadow: sh.num(0), block: vget("pick") }, { shadow: sh.num(4) }), cmp("LTE", { shadow: sh.num(0), block: vget("pick") }, { shadow: sh.num(6) })],
          [
            [
              setVar("r2", random(1, 2)),
              ifStmt([cmp("EQ", { shadow: sh.num(0), block: vget("r2") }, { shadow: sh.num(1) })], [
                [setVar("temp", createSprite(S.cactus1, "Enemy"))],
              ], [setVar("temp", createSprite(S.cactus2, "Enemy"))]),
              setPos(vget("temp"), 168, 100),
              setVel(vget("temp"), sh.speed(-100), arith("MINUS", { shadow: sh.num(0) }, { shadow: sh.num(0), block: vget("speed") }), sh.speed(0)),
              setFlag(vget("temp"), "SpriteFlag.AutoDestroy", sh.toggle("true")),
              ifStmt([cmp("GTE", { shadow: sh.num(0), block: vget("stage") }, { shadow: sh.num(3) })], [
                [
                  setVar("temp", createSprite(S.cactus1, "Enemy")),
                  setPos(vget("temp"), 196, 100),
                  setVel(vget("temp"), sh.speed(-100), arith("MINUS", { shadow: sh.num(0) }, { shadow: sh.num(0), block: vget("speed") }), sh.speed(0)),
                  setFlag(vget("temp"), "SpriteFlag.AutoDestroy", sh.toggle("true")),
                ],
              ]),
            ],
            [
              setVar("temp", createSprite(treeVar(), "Enemy")),
              setPos(vget("temp"), 168, 90),
              setVel(vget("temp"), sh.speed(-100), arith("MINUS", { shadow: sh.num(0) }, { shadow: sh.num(0), block: vget("speed") }), sh.speed(0)),
              setFlag(vget("temp"), "SpriteFlag.AutoDestroy", sh.toggle("true")),
              ifStmt([cmp("GTE", { shadow: sh.num(0), block: vget("stage") }, { shadow: sh.num(2) })], [
                [
                  setVar("temp", createSprite(treeVar(), "Enemy")),
                  setPos(vget("temp"), 194, 90),
                  setVel(vget("temp"), sh.speed(-100), arith("MINUS", { shadow: sh.num(0) }, { shadow: sh.num(0), block: vget("speed") }), sh.speed(0)),
                  setFlag(vget("temp"), "SpriteFlag.AutoDestroy", sh.toggle("true")),
                ],
              ]),
            ],
          ],
          [
            // birds are their own kind: the Enemy sweep forces full speed on
            // everything in it, which would cancel the slower flight below
            setVar("temp", createSprite(S.bird1, "Bird")),
            setPos(vget("temp"), 168, 72),
            runAnim(vget("temp"), [S.bird1, S.bird2], 200, "true"),
            setVel(vget("temp"), sh.speed(-30), arith("MINUS", { shadow: sh.num(0) }, { shadow: sh.num(0), block: arith("DIVIDE", { shadow: sh.num(0), block: vget("speed") }, { shadow: sh.num(2) }) }), sh.speed(0)),
            setFlag(vget("temp"), "SpriteFlag.AutoDestroy", sh.toggle("true")),
            ifStmt([cmp("GTE", { shadow: sh.num(0), block: vget("stage") }, { shadow: sh.num(1) })], [
              [
                setVar("temp", createSprite(S.bird2, "Bird")),
                setPos(vget("temp"), 204, 72),
                runAnim(vget("temp"), [S.bird1, S.bird2], 200, "true"),
                setVel(vget("temp"), sh.speed(-30), arith("MINUS", { shadow: sh.num(0) }, { shadow: sh.num(0), block: arith("DIVIDE", { shadow: sh.num(0), block: vget("speed") }, { shadow: sh.num(2) }) }), sh.speed(0)),
                setFlag(vget("temp"), "SpriteFlag.AutoDestroy", sh.toggle("true")),
              ],
            ]),
          ]
        ),
      ],
    ]),
  ], 0, 3500)
);

// ---------- POWER-UP SPAWNER (every 7s, 60%) ----------
if (!process.env.NO_POWERUPS) topBlocks.push(
  gameInterval(7000, [
    ifStmt([and(vget("started"), block("percentchance", value("percentage", sh.percent(60))))], [
      [
        setVar("pick", random(1, 3)),
        ifStmt(
          [cmp("EQ", { shadow: sh.num(0), block: vget("pick") }, { shadow: sh.num(1) }), cmp("EQ", { shadow: sh.num(0), block: vget("pick") }, { shadow: sh.num(2) })],
          [
            [
              setVar("temp", createSprite(S.starPow, "Star")),
              setPos(vget("temp"), 168, 40, random(40, 88), randXPos()),
              setVel(vget("temp"), sh.speed(-100), arith("MINUS", { shadow: sh.num(0) }, { shadow: sh.num(0), block: vget("speed") }), sh.speed(0)),
              setFlag(vget("temp"), "SpriteFlag.AutoDestroy", sh.toggle("true")),
            ],
            [
              setVar("temp", createSprite(S.heart, "Heart")),
              setPos(vget("temp"), 168, 40, random(40, 88), randXPos()),
              setVel(vget("temp"), sh.speed(-100), arith("MINUS", { shadow: sh.num(0) }, { shadow: sh.num(0), block: vget("speed") }), sh.speed(0)),
              setFlag(vget("temp"), "SpriteFlag.AutoDestroy", sh.toggle("true")),
            ],
          ],
          [
            setVar("temp", createSprite(S.bolt, "Bolt")),
            setPos(vget("temp"), 168, 40, random(40, 88), randXPos()),
            setVel(vget("temp"), sh.speed(-100), arith("MINUS", { shadow: sh.num(0) }, { shadow: sh.num(0), block: vget("speed") }), sh.speed(0)),
            setFlag(vget("temp"), "SpriteFlag.AutoDestroy", sh.toggle("true")),
          ]
        ),
      ],
    ]),
  ], 0, 4400)
);
// fix power-up Y: use a random 40..88 in a follow-up statement is complex; do it inline above via setpos random:
// (kept simple: fixed y=40 mid-air, reachable by jump)

// ---------- CLOUD SPAWNER (every 2.6s, 70%) ----------
topBlocks.push(
  gameInterval(2600, [
    ifStmt([and(vget("started"), block("percentchance", value("percentage", sh.percent(70))))], [
      [
        setVar("temp", createSprite(cloudVar(), "Cloud")),
        setPos(vget("temp"), 168, 14, random(10, 22)),
        setVel(vget("temp"), sh.speed(-50), arith("MINUS", { shadow: sh.num(0) }, { shadow: sh.num(2), block: arith("DIVIDE", { shadow: sh.num(0), block: vget("speed") }, { shadow: sh.num(2) }) }), sh.speed(0)),
        setFlag(vget("temp"), "SpriteFlag.AutoDestroy", sh.toggle("true")),
      ],
    ]),
  ], 0, 5300)
);

// ---------- JUMP (A pressed) ----------
topBlocks.push(
  keyOnEvent("controller.A", "ControllerButtonEvent.Pressed", [
    ifStmt([vget("overMode")], [
      // game over screen: A restarts back to the name/score screen
      [functionCall("restart_run", "F_rst")],
    ], [
      ifStmt([vget("entryMode")], [
        [
          tsSetText(letterSlot(), listGet("letters", vget("charI"))),
          listSet("slots", vget("nameI"), vget("charI")),
          changeVar("nameI", 1),
          ifStmt([cmp("GTE", { shadow: sh.num(0), block: vget("nameI") }, { shadow: sh.num(3) })], [
            [
              setVarExpr("myName", sh.text(""), textJoinBB(listGet("letters", listGet("slots", sh.num(0))), textJoinBB(listGet("letters", listGet("slots", sh.num(1))), listGet("letters", listGet("slots", sh.num(2)))))),
              setVarBool("entryMode", "FALSE"),
              forLoop("i", arith("MINUS", { shadow: sh.num(0), block: vget("eCount") }, { shadow: sh.num(1) }), [
                [destroy(listGet("entrySprites", vget("i")))],
              ]),
              forLoop("i", arith("MINUS", { shadow: sh.num(0), block: vget("rCount") }, { shadow: sh.num(1) }), [
                [destroy(listGet("boardRows", vget("i")))],
              ]),
              setVarNum("eCount", 0),
              setVarNum("rCount", 0),
              setVarBool("started", "TRUE"),
            ],
          ], [
            // not done yet: sync the cycle letter to the next slot's
            // pre-filled letter, then slide the caret under it (without this,
            // charI carried over from the previous slot — picking B then A,A
            // filed BBB)
            setVarExpr("charI", sh.num(0), listGet("slots", vget("nameI"))),
            caretMove(),
          ]),
        ],
      ], [
        ifStmt([and(vget("started"), and(vget("grounded"), not(vget("ducking"))))], [
          [
            setVarNum("vy", -200),
            setVarBool("grounded", "FALSE"),
            setVarBool("jumpHeld", "TRUE"),
            stopAnims(vget("dino")),
            setImage(vget("dino"), S.dinoJump),
            setVel(vget("dino"), sh.speed(0), null, sh.speed(-200)),
            playMusic("C5 E5 ", 400, "music.PlaybackMode.InBackground"),
          ],
        ]),
      ]),
    ]),
  ], 900, 0)
);
// B = backspace on the name screen / DONE in gameplay / restart on over screen
topBlocks.push(
  keyOnEvent("controller.B", "ControllerButtonEvent.Pressed", [
    ifStmt([vget("overMode")], [
      // game over screen: B also restarts back to the name/score screen
      [functionCall("restart_run", "F_rst")],
    ], [
      ifStmt([vget("entryMode")], [
        [
          ifStmt([cmp("GT", { shadow: sh.num(0), block: vget("nameI") }, { shadow: sh.num(0) })], [
            [
              changeVar("nameI", -1),
              // restore the letter that was in the slot and move the caret back
              setVarExpr("charI", sh.num(0), listGet("slots", vget("nameI"))),
              tsSetText(letterSlot(), listGet("letters", vget("charI"))),
              caretMove(),
            ],
          ]),
        ],
      ], [
        ifStmt([vget("started")], [
          [
            // file the score, then a custom over screen (no game.over reset)
            functionCall("lb_submit", "F_lbsub"),
            setVarBool("overMode", "TRUE"),
            setVarBool("started", "FALSE"),
            // clear whatever is still in flight: obstacles keep drifting
            // otherwise and could hit the idle dino after the run has ended
            destroyAllOfKind("Enemy"),
            destroyAllOfKind("Bird"),
            destroyAllOfKind("Star"),
            destroyAllOfKind("Heart"),
            destroyAllOfKind("Bolt"),
            destroyAllOfKind("Cloud"),
            ifStmt([cmp("GT", { shadow: sh.num(0), block: vget("myRank") }, { shadow: sh.num(0) })], [
              [
                setVar("ts", textSpriteCreate(textJoin("DONE!  RANK #", vget("myRank")))),
                tsSetFont(vget("ts"), 8),
                setPos(vget("ts"), 80, 25),
                listSet("entrySprites", vget("eCount"), vget("ts")),
                changeVar("eCount", 1),
              ],
            ], [
              [
                setVar("ts", textSpriteCreate(sh.text("DONE!"))),
                tsSetFont(vget("ts"), 8),
                setPos(vget("ts"), 80, 25),
                listSet("entrySprites", vget("eCount"), vget("ts")),
                changeVar("eCount", 1),
              ],
            ]),
            setVar("ts", textSpriteCreate(textJoin("SCORE ", scoreReporter()))),
            tsSetFont(vget("ts"), 5),
            setPos(vget("ts"), 80, 44),
            listSet("entrySprites", vget("eCount"), vget("ts")),
            changeVar("eCount", 1),
            setVar("ts", textSpriteCreate(sh.text("PRESS A"))),
            tsSetFont(vget("ts"), 4),
            setPos(vget("ts"), 80, 58),
            listSet("entrySprites", vget("eCount"), vget("ts")),
            changeVar("eCount", 1),
          ],
        ]),
      ]),
    ]),
  ], 1250, 300)
);

// releasing A ends the higher-jump hold
topBlocks.push(
  keyOnEvent("controller.A", "ControllerButtonEvent.Released", [
    setVarBool("jumpHeld", "FALSE"),
  ], 1250, 0)
);

// ---------- NAME ENTRY: up/down cycle letters, left/right page the board ----------
topBlocks.push(
  keyOnEvent("controller.up", "ControllerButtonEvent.Pressed", [
    ifStmt([vget("entryMode")], [
      [
        changeVar("charI", 1),
        ifStmt([cmp("GT", { shadow: sh.num(0), block: vget("charI") }, { shadow: sh.num(25) })], [
          [setVarNum("charI", 0)],
        ]),
        tsSetText(letterSlot(), listGet("letters", vget("charI"))),
      ],
    ]),
  ], 1250, 600)
);
// DOWN: in entry mode it cycles the letter backward; in gameplay it ducks.
// pxt keeps only the LAST handler per button+event, so these MUST be one
// merged handler (a separate letter-cycle handler gets silently dropped).
topBlocks.push(
  keyOnEvent("controller.down", "ControllerButtonEvent.Pressed", [
    ifStmt([vget("entryMode")], [
      [
        changeVar("charI", -1),
        ifStmt([cmp("LT", { shadow: sh.num(0), block: vget("charI") }, { shadow: sh.num(0) })], [
          [setVarNum("charI", 25)],
        ]),
        tsSetText(letterSlot(), listGet("letters", vget("charI"))),
      ],
    ], [
      ifStmt([and(vget("started"), and(vget("grounded"), not(vget("ducking"))))], [
        [
          setVarBool("ducking", "TRUE"),
          stopAnims(vget("dino")),
          setImage(vget("dino"), S.dinoDuck),
          setPos(vget("dino"), 24, 104),
        ],
      ]),
    ]),
  ], 1250, 900)
);
// ---------- VOLUME (left/right on the name screen) ----------
// The board is a single top-5 page, so the D-pad's left/right adjusts volume.
topBlocks.push(
  keyOnEvent("controller.left", "ControllerButtonEvent.Pressed", [
    ifStmt([vget("entryMode")], [
      [
        setVarExpr("vol", sh.num(0), constrain(arith("MINUS", { shadow: sh.num(0), block: vget("vol") }, { shadow: sh.num(1) }), 0, 8)),
        block("synth_set_volume", value("volume", sh.num(255), constrain(arith("MULTIPLY", { shadow: sh.num(0), block: vget("vol") }, { shadow: sh.num(32) }), 0, 255))),
        tsSetText(vget("volSpr"), textJoinBB(textJoinBB(sh.text("<< VOL "), vget("vol")), sh.text(" >>"))),
      ],
    ]),
  ], 1250, 1200)
);
topBlocks.push(
  keyOnEvent("controller.right", "ControllerButtonEvent.Pressed", [
    ifStmt([vget("entryMode")], [
      [
        setVarExpr("vol", sh.num(0), constrain(arith("ADD", { shadow: sh.num(0), block: vget("vol") }, { shadow: sh.num(1) }), 0, 8)),
        block("synth_set_volume", value("volume", sh.num(255), constrain(arith("MULTIPLY", { shadow: sh.num(0), block: vget("vol") }, { shadow: sh.num(32) }), 0, 255))),
        tsSetText(vget("volSpr"), textJoinBB(textJoinBB(sh.text("<< VOL "), vget("vol")), sh.text(" >>"))),
      ],
    ]),
  ], 1250, 1500)
);
topBlocks.push(
  keyOnEvent("controller.down", "ControllerButtonEvent.Released", [
    ifStmt([vget("ducking")], [
      [
        setVarBool("ducking", "FALSE"),
        setPos(vget("dino"), 24, 100),
        functionCall("update_dino_image", "F_uddi"),
      ],
    ]),
  ], 900, 700)
);

// ---------- GRAVITY + VARIABLE JUMP + LANDING (game update) ----------
// While rising with A held, gravity is light (higher jump); releasing A or
// falling uses heavy gravity (short hop, fast descent). vy is mirrored onto
// the sprite every frame; landing when falling back to ground level.
topBlocks.push(
  gameUpdate([
    ifStmt([vget("started")], [
      [
        ifStmt([not(vget("grounded"))], [
          [
            ifStmt([and(vget("jumpHeld"), cmp("LT", { shadow: sh.num(0), block: vget("vy") }, { shadow: sh.num(0) }))], [
              [setVarNum("gravity", 8)],
            ], [setVarNum("gravity", 20)]),
            changeVarExpr("vy", sh.num(0), vget("gravity")),
            ifStmt([and(cmp("GT", { shadow: sh.num(0), block: vget("vy") }, { shadow: sh.num(0) }), cmp("GTE", { shadow: sh.num(0), block: getY(vget("dino")) }, { shadow: sh.num(100) }))], [
              [
                setPos(vget("dino"), 24, 100),
                setVarNum("vy", 0),
                setVel(vget("dino"), sh.speed(0), null, sh.speed(0)),
                setVarBool("grounded", "TRUE"),
                functionCall("update_dino_image", "F_uddi"),
              ],
            ], [
              setVel(vget("dino"), sh.speed(0), null, sh.speed(0), vget("vy")),
            ]),
          ],
        ]),
      ],
    ]),
  ], 900, 1000)
);

// ---------- COLLISION: PLAYER vs ENEMY ----------
// every overlap body is gated on started: leftover sprites after a run ends
// (or a stray event during entry/over screens) must never drain lives or
// double-submit the score
topBlocks.push(
  spritesOverlap("Player", "Enemy", [
    ifStmt([vget("started")], [
      [
        ifStmt([cmp("GT", { shadow: sh.num(0), block: vget("starMs") }, { shadow: sh.num(0) })], [
          [
            destroy(other()),
            changeScore(50),
            playMusic("G5 C6 ", 400, "music.PlaybackMode.InBackground"),
          ],
        ], [
          ifStmt([cmp("LTE", { shadow: sh.num(0), block: vget("hitInvMs") }, { shadow: sh.num(0) })], [
            [
              changeLife(-1),
              destroy(other()),
              setVarNum("hitInvMs", 1500),
              setVarBool("blinkOn", "TRUE"),
              setFlag(vget("dino"), "SpriteFlag.Invisible", sh.toggle("true")),
              playMusic("E3 C3 ", 300, "music.PlaybackMode.InBackground"),
            ],
          ]),
        ]),
      ],
    ]),
  ], 1800, 0)
);
// birds fly at half speed but hit just as hard — same damage rules as Enemy
topBlocks.push(
  spritesOverlap("Player", "Bird", [
    ifStmt([vget("started")], [
      [
        ifStmt([cmp("GT", { shadow: sh.num(0), block: vget("starMs") }, { shadow: sh.num(0) })], [
          [
            destroy(other()),
            changeScore(50),
            playMusic("G5 C6 ", 400, "music.PlaybackMode.InBackground"),
          ],
        ], [
          ifStmt([cmp("LTE", { shadow: sh.num(0), block: vget("hitInvMs") }, { shadow: sh.num(0) })], [
            [
              changeLife(-1),
              destroy(other()),
              setVarNum("hitInvMs", 1500),
              setVarBool("blinkOn", "TRUE"),
              setFlag(vget("dino"), "SpriteFlag.Invisible", sh.toggle("true")),
              playMusic("E3 C3 ", 300, "music.PlaybackMode.InBackground"),
            ],
          ]),
        ]),
      ],
    ]),
  ], 1800, 250)
);

// ---------- POWER-UP PICKUPS ----------
topBlocks.push(
  spritesOverlap("Player", "Star", [
    ifStmt([vget("started")], [
      [
        setVarNum("starMs", 5000),
        destroy(other()),
        playMusic("C5 E5 G5 C6 ", 400, "music.PlaybackMode.InBackground"),
        functionCall("update_dino_image", "F_uddi"),
      ],
    ]),
  ], 1800, 500)
);
topBlocks.push(
  spritesOverlap("Player", "Heart", [
    ifStmt([vget("started")], [
      [
        ifStmt([cmp("LT", { shadow: sh.num(0), block: lifeReporter() }, { shadow: sh.num(5) })], [[changeLife(1)]]),
        destroy(other()),
        playMusic("C5 E5 G5 C6 ", 400, "music.PlaybackMode.InBackground"),
      ],
    ]),
  ], 1800, 800)
);
topBlocks.push(
  spritesOverlap("Player", "Bolt", [
    ifStmt([vget("started")], [
      [
        setVarNum("slowMs", 5000),
        destroy(other()),
        playMusic("G5 E5 C5 ", 400, "music.PlaybackMode.InBackground"),
      ],
    ]),
  ], 1800, 1100)
);

// ---------- GAME OVER (life zero) + WIN (score 500) ----------
// On death: lay the T-Rex flat on the ground (dead pose), make sure it is
// visible (clear any mercy-blink), stop animations, then show the over screen.
// helper: remove every sprite of a kind so the death scene is clean
function destroyAllOfKind(kindName) {
  return block("sprites_destroy_all_sprites_of_kind", value("kind", sh.kind(kindName)));
}
topBlocks.push(
  lifeZeroEvent([
    stopAnims(vget("dino")),
    setImage(vget("dino"), S.dinoDead),
    setPos(vget("dino"), 24, 100),
    setVel(vget("dino"), sh.speed(0), null, sh.speed(0)),
    setFlag(vget("dino"), "SpriteFlag.Invisible", sh.toggle("false")),
    destroyAllOfKind("Enemy"),
    destroyAllOfKind("Bird"),
    destroyAllOfKind("Star"),
    destroyAllOfKind("Heart"),
    destroyAllOfKind("Bolt"),
    destroyAllOfKind("Cloud"),
    playMusic("E3 C3 G2 ", 200, "music.PlaybackMode.InBackground"),
    // file the score into the board, then show a custom over screen (no
    // game.over — its reset would re-seed the board in on-start)
    functionCall("lb_submit", "F_lbsub"),
    setVarBool("overMode", "TRUE"),
    setVarBool("started", "FALSE"),
    setVar("ts", textSpriteCreate(sh.text("GAME OVER!"))),
    tsSetFont(vget("ts"), 8),
    setPos(vget("ts"), 80, 25),
    listSet("entrySprites", vget("eCount"), vget("ts")),
    changeVar("eCount", 1),
    setVar("ts", textSpriteCreate(textJoin("SCORE ", scoreReporter()))),
    tsSetFont(vget("ts"), 5),
    setPos(vget("ts"), 80, 44),
    listSet("entrySprites", vget("eCount"), vget("ts")),
    changeVar("eCount", 1),
    setVar("ts", textSpriteCreate(sh.text("PRESS A"))),
    tsSetFont(vget("ts"), 4),
    setPos(vget("ts"), 80, 58),
    listSet("entrySprites", vget("eCount"), vget("ts")),
    changeVar("eCount", 1),
  ], 2600, 0)
);
// ---------- update_dino_image FUNCTION ----------
topBlocks.push(
  functionDef(
    "update_dino_image",
    "F_uddi",
    [
      ifStmt(
        [cmp("GT", { shadow: sh.num(0), block: vget("starMs") }, { shadow: sh.num(0) }), not(vget("grounded")), vget("ducking")],
        [
          [stopAnims(vget("dino")), runAnim(vget("dino"), [S.star1, S.star2], 150, "true")],
          [stopAnims(vget("dino")), setImage(vget("dino"), S.dinoJump)],
          [stopAnims(vget("dino")), setImage(vget("dino"), S.dinoDuck)],
        ],
        [stopAnims(vget("dino")), runAnim(vget("dino"), [S.dino1, S.dino2], 150, "true")]
      ),
    ],
    2600, 700
  )
);

// ---------- restart_run FUNCTION ----------
// Back to the name/score screen WITHOUT a game reset: all variables (the
// leaderboard!) survive; only the run state is rewound. The name slots come
// back pre-filled because slots[] was never cleared.
topBlocks.push(
  functionDef(
    "restart_run",
    "F_rst",
    [
      setVarBool("overMode", "FALSE"),
      setVarBool("entryMode", "TRUE"),
      setVarBool("started", "FALSE"),
      setLife(3),
      setScore(0),
      setVarNum("speed", 100),
      setVarNum("effSpeed", 100),
      setVarNum("vy", 0),
      setVarNum("gravity", 20),
      setVarNum("stage", 0),
      setVarBool("jumpHeld", "FALSE"),
      setVarBool("grounded", "TRUE"),
      setVarBool("ducking", "FALSE"),
      setVarNum("starMs", 0),
      setVarNum("hitInvMs", 0),
      setVarNum("slowMs", 0),
      setVarBool("blinkOn", "FALSE"),
      // a run that ended at night leaves the moon up: swap it back to the sun
      // so the entry screen is a clean day scene and the next nightfall can't
      // spawn a second moon next to the leftover one
      ifStmt([vget("nightMode")], [
        [
          destroy(vget("moonSpr")),
          setVar("sunSpr", createSprite(S.sun, "Projectile")),
          setPos(vget("sunSpr"), 138, 30),
        ],
      ]),
      setVarBool("nightMode", "FALSE"),
      setFlag(vget("dino"), "SpriteFlag.Invisible", sh.toggle("false")),
      setPos(vget("dino"), 24, 100),
      setVel(vget("dino"), sh.speed(0), null, sh.speed(0)),
      functionCall("update_dino_image", "F_uddi"),
      setBackgroundColor(9),
      functionCall("lb_entry_show", "F_eshow"),
      functionCall("lb_board_show", "F_bshow"),
    ],
    2600, 1000
  )
);

// ---------- LEADERBOARD FUNCTION DEFINITIONS ----------
// Kept at the END of the top-block document order: the Blockly XML loader
// aborts at the first unknown block type and drops every later block, so any
// extension-dependent code must not sit in front of proven game code.
// Boards are fixed 50-slot lists; only lists_index_get/set are used (push /
// pop / split do not exist as core Arcade blocks).

// F_eshow: name entry UI (top half) — rebuilt on every restart
topBlocks.push(
  functionDef("lb_entry_show", "F_eshow", [
    forLoop("i", arith("MINUS", { shadow: sh.num(0), block: vget("eCount") }, { shadow: sh.num(1) }), [
      [destroy(listGet("entrySprites", vget("i")))],
    ]),
    forLoop("i", arith("MINUS", { shadow: sh.num(0), block: vget("rCount") }, { shadow: sh.num(1) }), [
      [destroy(listGet("boardRows", vget("i")))],
    ]),
    setVarNum("eCount", 0),
    setVarNum("rCount", 0),
    // every entry-screen sprite is tracked so the confirm path clears them all
    setVar("ts", textSpriteCreate(sh.text("T-REX RUN!"))),
    setPos(vget("ts"), 80, 7),
    tsSetFont(vget("ts"), 8),
    listSet("entrySprites", vget("eCount"), vget("ts")),
    changeVar("eCount", 1),
    setVar("ts", textSpriteCreate(sh.text("ENTER NAME"))),
    setPos(vget("ts"), 80, 18),
    tsSetFont(vget("ts"), 6),
    listSet("entrySprites", vget("eCount"), vget("ts")),
    changeVar("eCount", 1),
    forLoop("i", sh.whole(2), [
      // pre-fill from slots[] so a returning player sees their last name
      setVar("ts", textSpriteCreate(listGet("letters", listGet("slots", vget("i"))))),
      tsSetFont(vget("ts"), 8),
      setPos(vget("ts"), 0, 28, null, arith("ADD", { shadow: sh.num(68) }, { shadow: sh.num(12), block: arith("MULTIPLY", { shadow: sh.num(0), block: vget("i") }, { shadow: sh.num(12) }) })),
      listSet("entrySprites", vget("eCount"), vget("ts")),
      changeVar("eCount", 1),
    ]),
    setVar("ts", textSpriteCreate(sh.text("^"))),
    setPos(vget("ts"), 68, 35),
    tsSetFont(vget("ts"), 6),
    listSet("entrySprites", vget("eCount"), vget("ts")),
    changeVar("eCount", 1),
    setVar("ts", textSpriteCreate(sh.text("UP/DOWN  A=OK  B=BACK"))),
    setPos(vget("ts"), 80, 42),
    tsSetFont(vget("ts"), 4),
    listSet("entrySprites", vget("eCount"), vget("ts")),
    changeVar("eCount", 1),
    setVar("ts", textSpriteCreate(sh.text("TOP SCORES"))),
    setPos(vget("ts"), 80, 54),
    tsSetFont(vget("ts"), 5),
    listSet("entrySprites", vget("eCount"), vget("ts")),
    changeVar("eCount", 1),
    // volume indicator: << VOL n >>, adjusted with D-pad left/right here
    setVar("volSpr", textSpriteCreate(textJoinBB(textJoinBB(sh.text("<< VOL "), vget("vol")), sh.text(" >>")))),
    tsSetFont(vget("volSpr"), 4),
    setPos(vget("volSpr"), 80, 103),
    listSet("entrySprites", vget("eCount"), vget("volSpr")),
    changeVar("eCount", 1),
  ], 0, 6600)
);

// F_bshow: render 10 leaderboard rows for the current page (top 50 across 5 pages)
topBlocks.push(
  functionDef("lb_board_show", "F_bshow", [
    forLoop("i", arith("MINUS", { shadow: sh.num(0), block: vget("rCount") }, { shadow: sh.num(1) }), [
      [destroy(listGet("boardRows", vget("i")))],
    ]),
    setVarNum("rCount", 0),
    // top-5 board: exactly five rows
    forLoop("i", sh.whole(4), [
      setVarExpr("bIdx", sh.num(0), vget("i")),
      ifStmt([and(
        cmp("LT", side(vget("bIdx")), side(vget("lbCount"))),
        cmp("GT", { shadow: sh.num(0), block: listGet("lbScores", vget("bIdx")) }, { shadow: sh.num(0) })
      )], [
        [
          setVar("ts", textSpriteCreate(
            textJoinBB(
              textJoinBB(textJoinBB(arith("ADD", { shadow: sh.num(0), block: vget("bIdx") }, { shadow: sh.num(1) }), sh.text(". ")), listGet("nameArr", vget("bIdx"))),
              textJoinBB(sh.text(" "), listGet("lbScores", vget("bIdx")))
            ))),
          tsSetFont(vget("ts"), 6),
          setPos(vget("ts"), 80, 0, arith("ADD", { shadow: sh.num(62) }, { shadow: sh.num(6), block: arith("MULTIPLY", { shadow: sh.num(0), block: vget("i") }, { shadow: sh.num(6) }) })),
          listSet("boardRows", vget("rCount"), vget("ts")),
          changeVar("rCount", 1),
        ],
      ]),
    ]),
  ], 0, 7300)
);

// F_lbsub: insert myScore/myName into the fixed-slot top-5 (sorted desc).
// Insert at the end slot, then bubble down with one full adjacent-swap pass —
// every statement mirrors a decompile-proven shape (see loader pitfalls).
// Scores of 0 are ignored (and clear a stale rank so an instant B-quit can't
// show the previous run's "RANK #N").
topBlocks.push(
  functionDef("lb_submit", "F_lbsub", [
    setVarNum("myRank", 0),
    setVarExpr("myScore", sh.num(0), scoreReporter()),
    ifStmt([cmp("GT", side(vget("myScore")), { shadow: sh.num(0) })], [
      [
        // qualifies: board not full, or beats the current lowest entry
        setVarExpr("ok", sh.bool("FALSE"), block("logic_operation", `<field name="OP">OR</field>` +
          value("A", sh.bool("TRUE"), cmp("LT", side(vget("lbCount")), { shadow: sh.num(5) })) +
          value("B", sh.bool("TRUE"), cmp("GT", side(vget("myScore")), { shadow: sh.num(0), block: listGet("lbScores", sh.num(4)) })))),
        ifStmt([vget("ok")], [
          [
            setVarExpr("lastI", sh.num(0), constrain(vget("lbCount"), 0, 4)),
            listSet("lbScores", vget("lastI"), vget("myScore")),
            listSet("nameArr", vget("lastI"), vget("myName")),
            ifStmt([cmp("LT", side(vget("lbCount")), { shadow: sh.num(5) })], [
              [changeVar("lbCount", 1)],
            ]),
            // full bubble sort (49 passes): one pass moves the new entry up
            // only one slot, so repeat until it settles (ties stay ahead of it)
            forLoop("pass", sh.whole(4), [
              [forLoop("a", sh.whole(3), [
                [ifStmt([cmp("LT", { shadow: sh.num(0), block: listGet("lbScores", vget("a")) }, { shadow: sh.num(0), block: listGet("lbScores", arith("ADD", { shadow: sh.num(0), block: vget("a") }, { shadow: sh.num(1) })) })], [
                  [
                    setVarExpr("tmpS", sh.num(0), listGet("lbScores", arith("ADD", { shadow: sh.num(0), block: vget("a") }, { shadow: sh.num(1) }))),
                    setVarExpr("tmpN", sh.text(""), listGet("nameArr", arith("ADD", { shadow: sh.num(0), block: vget("a") }, { shadow: sh.num(1) }))),
                    listSet("lbScores", arith("ADD", { shadow: sh.num(0), block: vget("a") }, { shadow: sh.num(1) }), listGet("lbScores", vget("a"))),
                    listSet("nameArr", arith("ADD", { shadow: sh.num(0), block: vget("a") }, { shadow: sh.num(1) }), listGet("nameArr", vget("a"))),
                    listSet("lbScores", vget("a"), vget("tmpS")),
                    listSet("nameArr", vget("a"), vget("tmpN")),
                  ],
                ])],
              ])],
            ]),
            // rank = first slot (from the top) whose score is below mine
            setVarNum("myRank", 0),
            forLoop("i", arith("MINUS", { shadow: sh.num(0), block: vget("lbCount") }, { shadow: sh.num(1) }), [
              [ifStmt([and(cmp("EQ", side(vget("myRank")), { shadow: sh.num(0) }), cmp("LT", { shadow: sh.num(0), block: listGet("lbScores", vget("i")) }, side(vget("myScore"))))], [
                [setVarExpr("myRank", sh.num(0), arith("ADD", { shadow: sh.num(0), block: vget("i") }, { shadow: sh.num(1) }))],
              ])],
            ]),
            ...(NO_SETTINGS ? [] : [functionCall("lb_settings_save", "F_lbsave")]),
          ],
        ]),
      ],
    ]),
  ], 2600, 1400)
);

// F_lbload / F_lbsave: settings persistence (settings build only). Names are
// stored as one settings string per slot ("lbN0".."lbN49") because Arcade
// blocks have no string split.
if (!NO_SETTINGS) {
  topBlocks.push(
    functionDef("lb_settings_load", "F_lbload", [
      ifStmt([settingsExists("lbScores")], [
        [
          // defensive: a failed/empty settings read must not wipe the seeds
          setVarExpr("lbScores", sh.num(0), settingsReadNumberArray("lbScores")),
          ifStmt([cmp("GT", { shadow: sh.num(0), block: block("lists_length", value("VALUE", sh.num(0), vget("lbScores"))) }, { shadow: sh.num(0) })], [
            [
              forLoop("i", sh.whole(4), [
                [listSet("nameArr", vget("i"), settingsReadStringBlock(textJoin("lbN", vget("i"))))],
              ]),
              setVarNum("lbCount", 0),
              forLoop("i", sh.whole(4), [
                [ifStmt([cmp("GT", { shadow: sh.num(0), block: listGet("lbScores", vget("i")) }, { shadow: sh.num(0) })], [
                  [setVarExpr("lbCount", sh.num(0), arith("ADD", { shadow: sh.num(0), block: vget("i") }, { shadow: sh.num(1) }))],
                ])],
              ]),
            ],
          ]),
        ],
      ]),
    ], 2600, 1700)
  );
  topBlocks.push(
    functionDef("lb_settings_save", "F_lbsave", [
      settingsWriteNumberArray("lbScores"),
      forLoop("i", sh.whole(4), [
        [settingsWriteStringBlock(textJoin("lbN", vget("i")), listGet("nameArr", vget("i")))],
      ]),
    ], 2600, 2000)
  );
}

// ---------- WIN at 500: champion screen (kept LAST in document order — the
// loader aborts at the first block type it can't resolve, and only this
// handler uses particlesStartScreenAnimation) ----------
// game.onScore fires on every crossing of 500, including DOWNWARD when
// restart_run resets the score to 0 — the guard ignores that re-fire.
topBlocks.push(
  onScore(500, [
    ifStmt([and(vget("started"), not(vget("overMode")))], [
      [
        // celebrate on a clean scene: clear the mercy-blink, sweep the world
        setFlag(vget("dino"), "SpriteFlag.Invisible", sh.toggle("false")),
        destroyAllOfKind("Enemy"),
        destroyAllOfKind("Bird"),
        destroyAllOfKind("Star"),
        destroyAllOfKind("Heart"),
        destroyAllOfKind("Bolt"),
        destroyAllOfKind("Cloud"),
        functionCall("lb_submit", "F_lbsub"),
        setVarBool("overMode", "TRUE"),
        setVarBool("started", "FALSE"),
        confetti(),
        playMusic("C5 E5 G5 C6 ", 400, "music.PlaybackMode.InBackground"),
        setVar("ts", textSpriteCreate(sh.text("YOU WIN!"))),
        tsSetFont(vget("ts"), 8),
        setPos(vget("ts"), 80, 25),
        listSet("entrySprites", vget("eCount"), vget("ts")),
        changeVar("eCount", 1),
        setVar("ts", textSpriteCreate(textJoin("SCORE ", scoreReporter()))),
        tsSetFont(vget("ts"), 5),
        setPos(vget("ts"), 80, 44),
        listSet("entrySprites", vget("eCount"), vget("ts")),
        changeVar("eCount", 1),
        setVar("ts", textSpriteCreate(sh.text("PRESS A"))),
        tsSetFont(vget("ts"), 4),
        setPos(vget("ts"), 80, 58),
        listSet("entrySprites", vget("eCount"), vget("ts")),
        changeVar("eCount", 1),
      ],
    ]),
  ], 2900, 2300)
);

// ---------------- assemble XML ----------------
let vars = "<variables>";
kindVars.forEach((k) => (vars += `<variable type="KIND_SpriteKind" id="${varId[k]}">${k}</variable>`));
plainVars.forEach((v) => (vars += `<variable id="${varId[v]}">${v}</variable>`));
vars += "</variables>";

const xml = `<xml xmlns="https://developers.google.com/blockly/xml">${vars}${topBlocks.join("")}</xml>`;

// well-formedness check (stack tag matcher)
function checkXml(s) {
  const re = /<\/?([a-zA-Z_][\w.-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g;
  const stack = [];
  let m;
  const textRe = /[^<>/]+/g;
  while ((m = re.exec(s))) {
    const [full, tag] = m;
    if (full.startsWith("</")) {
      const top = stack.pop();
      if (top !== tag) throw new Error(`Mismatched tag: expected </${top}> got </${tag}> at index ${m.index}`);
    } else if (!full.endsWith("/>")) {
      stack.push(tag);
    }
  }
  if (stack.length) throw new Error("Unclosed tags: " + stack.join(","));
  return true;
}
checkXml(xml);

// corruption audit: block markup must never appear escaped inside a field,
// and each <value> may hold at most one direct-child shadow + one direct-child
// block (nested shadows inside blocks are fine — e.g. music_string_playable)
if (/&lt;(block|value|shadow|field|xml|next|variable)/.test(xml)) throw new Error("escaped block markup leaked into a field");
{
  const tagRe = /<(\/?)(value|shadow|block|field)\b[^>]*?(\/?)>/g;
  const stack = []; // {tag, shadows, blocks}
  let m;
  while ((m = tagRe.exec(xml))) {
    const closing = m[1] === "/";
    const selfClose = m[3] === "/";
    const tag = m[2];
    if (closing) {
      const top = stack.pop();
      if (!top || top.tag !== tag) throw new Error("audit stack mismatch at " + m.index);
      if (top.tag === "value") {
        if (top.shadows > 1) throw new Error("value with " + top.shadows + " direct shadows: " + xml.slice(Math.max(0, m.index - 200), m.index));
        if (top.blocks > 1) throw new Error("value with " + top.blocks + " direct blocks");
      }
      continue;
    }
    const parent = stack.length ? stack[stack.length - 1] : null;
    if (!selfClose) stack.push({ tag, shadows: 0, blocks: 0 });
    if (parent && parent.tag === "value") {
      if (tag === "shadow") parent.shadows++;
      if (tag === "block") parent.blocks++;
    }
  }
  if (stack.length) throw new Error("audit: unclosed " + stack.map(s => s.tag).join(","));
}

// sanity: every referenced VAR id exists in registry
for (const m of xml.matchAll(/<field name="VAR" id="([^"]+)">/g)) {
  if (!Object.values(varId).includes(m[1])) { console.log("BADVAR " + JSON.stringify({ id: String(m[1]), ctx: xml.slice(Math.max(0, m.index - 300), m.index + 120) })); }
}

const outDir = __dirname;
fs.writeFileSync(path.join(outDir, "main.blocks"), xml, "utf8");
fs.writeFileSync(path.join(outDir, "main.ts"), "\n", "utf8");
fs.writeFileSync(path.join(outDir, "assets.json"), "", "utf8");
// Extensions: arcade-text is REQUIRED — textsprite_create/setText/setFont
// live in it, and without it those blocks are unknown and abort the whole
// workspace load. settings-blocks only when settings persistence is enabled
// (NO_SETTINGS session-mode stays ext-light).
const projectName = process.env.PROJNAME || (process.env.SELFTEST ? "T-Rex Run SelfTest" : "T-Rex Run");
const deps = { device: "*", "arcade-text": "github:microsoft/arcade-text#v1.3.0" };
if (!NO_SETTINGS) deps["settings-blocks"] = "github:microsoft/pxt-settings-blocks#v1.0.0";
fs.writeFileSync(
  path.join(outDir, "pxt.json"),
  JSON.stringify(
    {
      name: projectName,
      description: "A Chrome-style dinosaur endless runner built entirely with MakeCode Arcade block code.",
      dependencies: deps,
      files: ["main.blocks", "main.ts", "README.md", "assets.json"],
      supportedTargets: ["arcade"],
      preferredEditor: "blocksprj",
    },
    null,
    4
  ) + "\n",
  "utf8"
);
console.log("OK main.blocks bytes:", xml.length, "deps:", Object.keys(deps).join(","), "name:", projectName);
