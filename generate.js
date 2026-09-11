// Generates main.blocks (MakeCode Arcade block XML) for "T-Rex Run".
// Every block type/field/value name below was verified against real
// MakeCode Arcade projects (see research notes) so the XML loads natively
// in the Blocks editor.
const fs = require("fs");
const path = require("path");
const S = require("./sprites.js");

let idc = 0;
const nid = () => "blk" + (++idc);

// ---------------- variables registry ----------------
const kindVars = ["Player", "Projectile", "Enemy", "Star", "Heart", "Bolt", "Cloud"];
const plainVars = ["dino", "temp", "pick", "r2", "speed", "effSpeed", "vy", "gravity", "jumpHeld", "grounded", "ducking", "started", "starMs", "hitInvMs", "slowMs", "nightMode", "blinkOn", "phase"];
const varId = {};
kindVars.forEach((k) => (varId[k] = "kind_" + k.toLowerCase()));
plainVars.forEach((v) => (varId[v] = "var_" + v));

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ---------------- shadows (literal pickers) ----------------
const sh = {
  num: (n) => `<shadow type="math_number"><field name="NUM">${n}</field></shadow>`,
  whole: (n) => `<shadow type="math_whole_number"><field name="NUM">${n}</field></shadow>`,
  bool: (b) => `<shadow type="logic_boolean"><field name="BOOL">${b}</field></shadow>`,
  text: (t) => `<shadow type="text"><field name="TEXT">${esc(t)}</field></shadow>`,
  time: (ms) => `<shadow type="timePicker"><field name="ms">${ms}</field></shadow>`,
  speed: (v) => `<shadow type="spriteSpeedPicker"><field name="speed">${v}</field></shadow>`,
  pos: (v) => `<shadow type="positionPicker"><field name="index">${v}</field></shadow>`,
  color: (i) => `<shadow type="colorindexpicker"><field name="index">${i}</field></shadow>`,
  toggle: (b) => `<shadow type="toggleOnOff"><field name="on">${b}</field></shadow>`,
  kind: (k) => `<shadow type="spritekind"><field name="MEMBER">${k}</field></shadow>`,
  winlose: (b) => `<shadow type="toggleWinLose"><field name="win">${b}</field></shadow>`,
  reporter: (name) => `<shadow type="variables_get_reporter"><field name="VAR" id="${varId[name]}">${name}</field></shadow>`,
  percent: (p) => `<shadow type="math_number_minmax"><mutation min="0" max="Infinity" label="Percentage" precision="0"></mutation><field name="SLIDER">${p}</field></shadow>`,
  tempo: (t) => `<shadow type="math_number_minmax"><mutation min="40" max="500" label="Tempo" precision="0"></mutation><field name="SLIDER">${t}</field></shadow>`,
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
  return block("variables_set", `<field name="VAR" id="${varId[name]}">${name}</field>` + value("VALUE", sh.num(0), valueXml));
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
function not(x) {
  return block("logic_negate", value("BOOL", sh.bool("TRUE"), x));
}
function arith(op, aSide, bSide) {
  return block("math_arithmetic", `<field name="OP">${op}</field>` + value("A", aSide.shadow, aSide.block) + value("B", bSide.shadow, bSide.block));
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
function setPos(spriteXml, x, y, yBlock) {
  return block("spritesetpos", value("sprite", sh.num(0), spriteXml) + value("x", sh.pos(x)) + value("y", sh.pos(y), yBlock));
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
function setGameOverEffect(effect, win) {
  return block("game_setgameovereffect", `<field name="effect">${effect}</field>` + value("win", sh.winlose(win)));
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
  ...(NO_SPLASH ? [] : [splash("T-REX RUN!", "A = JUMP   DOWN = DUCK   REACH 500 TO WIN!")]),
  setBackgroundColor(14),
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
    playMusic("C5 E5 G5 A5 G5 E5 C5 D5 ", 120, "music.PlaybackMode.LoopingInBackground"),
    ...(NO_SPLASH ? [] : [setVarBool("started", "TRUE")]),
  ]))
);

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
          changeScore(1),
          setVar("speed", constrain(arith("ADD", { shadow: sh.num(100) }, { shadow: sh.num(2), block: arith("DIVIDE", { shadow: sh.num(0), block: scoreReporter() }, { shadow: sh.num(2) }) }), 100, 250)),
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
tick.push(worldMove("Star", 1, 0, 2700));
tick.push(worldMove("Heart", 1, 0, 2900));
tick.push(worldMove("Bolt", 1, 0, 3100));
tick.push(worldMove("Cloud", 2, 0, 3300));
// day / night cycle every 150 points
tick.push(setVar("phase", modulo(scoreReporter(), 300)));
tick.push(
  ifStmt([and(not(vget("nightMode")), cmp("GTE", { shadow: sh.num(0), block: vget("phase") }, { shadow: sh.num(150) }))], [
    [
      setBackgroundColor(1),
      setVarBool("nightMode", "TRUE"),
      setVar("temp", createSprite(S.moon, "Cloud")),
      setPos(vget("temp"), 120, 10),
      setFlag(vget("temp"), "SpriteFlag.AutoDestroy", sh.toggle("true")),
    ],
  ])
);
tick.push(
  ifStmt([and(vget("nightMode"), cmp("LT", { shadow: sh.num(0), block: vget("phase") }, { shadow: sh.num(150) }))], [
    [setBackgroundColor(14), setVarBool("nightMode", "FALSE")],
  ])
);
topBlocks.push(gameInterval(100, tick, 0, 1500));

// ---------- OBSTACLE SPAWNER (every 900ms) ----------
if (!process.env.NO_OBSTACLES) topBlocks.push(
  gameInterval(900, [
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
            ],
            [
              setVar("temp", createSprite(S.tree, "Enemy")),
              setPos(vget("temp"), 168, 90),
              setVel(vget("temp"), sh.speed(-100), arith("MINUS", { shadow: sh.num(0) }, { shadow: sh.num(0), block: vget("speed") }), sh.speed(0)),
              setFlag(vget("temp"), "SpriteFlag.AutoDestroy", sh.toggle("true")),
            ],
          ],
          [
            setVar("temp", createSprite(S.birdWingUp, "Enemy")),
            setPos(vget("temp"), 168, 88),
            runAnim(vget("temp"), [S.birdWingUp, S.birdWingDown], 200, "true"),
            setVel(vget("temp"), sh.speed(-100), arith("MINUS", { shadow: sh.num(0) }, { shadow: sh.num(0), block: vget("speed") }), sh.speed(0)),
            setFlag(vget("temp"), "SpriteFlag.AutoDestroy", sh.toggle("true")),
          ]
        ),
      ],
    ]),
  ], 0, 3500)
);

// ---------- POWER-UP SPAWNER (every 7s, 60%) ----------
topBlocks.push(
  gameInterval(7000, [
    ifStmt([and(vget("started"), block("percentchance", value("percentage", sh.percent(60))))], [
      [
        setVar("pick", random(1, 3)),
        ifStmt(
          [cmp("EQ", { shadow: sh.num(0), block: vget("pick") }, { shadow: sh.num(1) }), cmp("EQ", { shadow: sh.num(0), block: vget("pick") }, { shadow: sh.num(2) })],
          [
            [
              setVar("temp", createSprite(S.starPow, "Star")),
              setPos(vget("temp"), 168, 40, random(40, 88)),
              setVel(vget("temp"), sh.speed(-100), arith("MINUS", { shadow: sh.num(0) }, { shadow: sh.num(0), block: vget("speed") }), sh.speed(0)),
              setFlag(vget("temp"), "SpriteFlag.AutoDestroy", sh.toggle("true")),
            ],
            [
              setVar("temp", createSprite(S.heart, "Heart")),
              setPos(vget("temp"), 168, 40, random(40, 88)),
              setVel(vget("temp"), sh.speed(-100), arith("MINUS", { shadow: sh.num(0) }, { shadow: sh.num(0), block: vget("speed") }), sh.speed(0)),
              setFlag(vget("temp"), "SpriteFlag.AutoDestroy", sh.toggle("true")),
            ],
          ],
          [
            setVar("temp", createSprite(S.bolt, "Bolt")),
            setPos(vget("temp"), 168, 40, random(40, 88)),
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
        setVar("temp", createSprite(S.cloud, "Cloud")),
        setPos(vget("temp"), 168, 14),
        setVel(vget("temp"), sh.speed(-50), arith("MINUS", { shadow: sh.num(0) }, { shadow: sh.num(2), block: arith("DIVIDE", { shadow: sh.num(0), block: vget("speed") }, { shadow: sh.num(2) }) }), sh.speed(0)),
        setFlag(vget("temp"), "SpriteFlag.AutoDestroy", sh.toggle("true")),
      ],
    ]),
  ], 0, 5300)
);

// ---------- JUMP (A pressed) ----------
topBlocks.push(
  keyOnEvent("controller.A", "ControllerButtonEvent.Pressed", [
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
  ], 900, 0)
);
// releasing A ends the higher-jump hold
topBlocks.push(
  keyOnEvent("controller.A", "ControllerButtonEvent.Released", [
    setVarBool("jumpHeld", "FALSE"),
  ], 1250, 0)
);

// ---------- DUCK (down pressed / released) ----------
topBlocks.push(
  keyOnEvent("controller.down", "ControllerButtonEvent.Pressed", [
    ifStmt([and(vget("started"), and(vget("grounded"), not(vget("ducking"))))], [
      [
        setVarBool("ducking", "TRUE"),
        stopAnims(vget("dino")),
        setImage(vget("dino"), S.dinoDuck),
        setPos(vget("dino"), 24, 104),
      ],
    ]),
  ], 900, 400)
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
topBlocks.push(
  spritesOverlap("Player", "Enemy", [
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
  ], 1800, 0)
);

// ---------- POWER-UP PICKUPS ----------
topBlocks.push(
  spritesOverlap("Player", "Star", [
    setVarNum("starMs", 5000),
    destroy(other()),
    playMusic("C5 E5 G5 C6 ", 400, "music.PlaybackMode.InBackground"),
    functionCall("update_dino_image", "F_uddi"),
  ], 1800, 500)
);
topBlocks.push(
  spritesOverlap("Player", "Heart", [
    ifStmt([cmp("LT", { shadow: sh.num(0), block: lifeReporter() }, { shadow: sh.num(5) })], [[changeLife(1)]]),
    destroy(other()),
    playMusic("C5 E5 G5 C6 ", 400, "music.PlaybackMode.InBackground"),
  ], 1800, 800)
);
topBlocks.push(
  spritesOverlap("Player", "Bolt", [
    setVarNum("slowMs", 5000),
    destroy(other()),
    playMusic("G5 E5 C5 ", 400, "music.PlaybackMode.InBackground"),
  ], 1800, 1100)
);

// ---------- GAME OVER (life zero) + WIN (score 500) ----------
// On death: lay the T-Rex flat on the ground (dead pose), make sure it is
// visible (clear any mercy-blink), stop animations, then show the over screen.
topBlocks.push(
  lifeZeroEvent([
    stopAnims(vget("dino")),
    setImage(vget("dino"), S.dinoDead),
    setPos(vget("dino"), 24, 100),
    setVel(vget("dino"), sh.speed(0), null, sh.speed(0)),
    setFlag(vget("dino"), "SpriteFlag.Invisible", sh.toggle("false")),
    playMusic("E3 C3 G2 ", 200, "music.PlaybackMode.InBackground"),
    setGameOverMessage("GAME OVER! NICE RUN!", "false"),
  ], 2600, 0)
);
topBlocks.push(
  onScore(500, [
    setGameOverMessage("YOU SURVIVED! CHAMPION!", "true"),
    setGameOverEffect("effects.confetti", "true"),
    gameOver2("true"),
  ], 2600, 350)
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

// sanity: every referenced VAR id exists in registry
for (const m of xml.matchAll(/<field name="VAR" id="([^"]+)">/g)) {
  if (!Object.values(varId).includes(m[1])) throw new Error("Unknown VAR id " + m[1]);
}

const outDir = __dirname;
fs.writeFileSync(path.join(outDir, "main.blocks"), xml, "utf8");
fs.writeFileSync(path.join(outDir, "main.ts"), "\n", "utf8");
fs.writeFileSync(path.join(outDir, "assets.json"), "", "utf8");
fs.writeFileSync(
  path.join(outDir, "pxt.json"),
  JSON.stringify(
    {
      name: "T-Rex Run",
      description: "A Chrome-style dinosaur endless runner built entirely with MakeCode Arcade block code.",
      dependencies: { device: "*" },
      files: ["main.blocks", "main.ts", "README.md", "assets.json"],
      supportedTargets: ["arcade"],
      preferredEditor: "blocksprj",
    },
    null,
    4
  ) + "\n",
  "utf8"
);
console.log("OK main.blocks bytes:", xml.length);
