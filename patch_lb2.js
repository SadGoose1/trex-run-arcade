const fs = require("fs");
let s = fs.readFileSync("generate.js", "utf8");
let n = 0;
function rep(oldStr, newStr, label) {
  if (!s.includes(oldStr)) { console.error("NOT FOUND: " + label); process.exit(1); }
  s = s.replace(oldStr, newStr);
  n++;
}

// ---------- 1. more variables (applied directly to generate.js) ----------
// ---------- 2. textJoinBB: join two block values ----------
rep(
  `function textJoin(t, blockXml) {`,
  `function textJoinBB(b0, b1) {
  return block("text_join", \`<mutation items="2"></mutation>\` + value("ADD0", sh.text(""), b0) + value("ADD1", sh.text(""), b1));
}
function emptyList() {
  return block("lists_create_with", \`<mutation items="0"></mutation>\`);
}
function textJoin(t, blockXml) {`,
  "textJoinBB + emptyList");

// ---------- 3. on-start: entry/leaderboard init replaces started=true ----------
rep(
  `    playMusic("C5 E5 G5 A5 G5 E5 C5 D5 ", 120, "music.PlaybackMode.LoopingInBackground"),
    setVarBool("started", "TRUE"),
  ])
);`,
`    playMusic("C5 E5 G5 A5 G5 E5 C5 D5 ", 120, "music.PlaybackMode.LoopingInBackground"),
    // leaderboard + name entry (started stays false until the name is confirmed)
    setVarNum("nameI", 0),
    setVarNum("charI", 0),
    setVarBool("entryMode", "TRUE"),
    setVarNum("page", 0),
    setVarNum("myRank", 0),
    setVarNum("myScore", 0),
    setVar("myName", sh.text("")),
    setVar("lbScores", sh.num(0), emptyList()),
    setVar("lbNames", sh.text("")),
    setVar("entrySprites", sh.num(0), emptyList()),
    setVar("slots", sh.num(0), block("lists_create_with", \`<mutation items="3"></mutation>\` + value("ADD0", sh.num(0)) + value("ADD1", sh.num(0)) + value("ADD2", sh.num(0)))),
    ifStmt([not(settingsExists("lbScores"))], [
      [
        settingsWriteNumberArray("lbScores"),
        settingsWriteString("lbNames", sh.text("AAA,BBB")),
        settingsWriteNumberArray("lbScores2"),
      ],
    ]),
    setVar("lbScores", sh.num(0), settingsReadNumberArray("lbScores")),
    setVar("lbNames", sh.text(""), settingsReadString("lbNames")),
    setVar("letters", sh.num(0), block("lists_create_with", \`<mutation items="26" horizontalafter="26"></mutation>\` +
      ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"].map((L) => value("ADD" + "ABCDEFGHIJKLMNOPQRSTUVWXYZ".indexOf(L), sh.text(L))).join(""))),
    functionCall("lb_entry_show", "F_eshow"),
    functionCall("lb_board_show", "F_bshow"),
  ])
);`,
  "on-start entry init");

// ---------- 4. A handler: entry confirm vs jump ----------
rep(
`topBlocks.push(
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
);`,
`topBlocks.push(
  keyOnEvent("controller.A", "ControllerButtonEvent.Pressed", [
    ifStmt([vget("entryMode")], [
      [
        // lock in the current letter
        tsSetText(listGet("entrySprites", vget("nameI")), listGet("letters", vget("charI"))),
        listSet("slots", vget("nameI"), vget("charI")),
        changeVar("nameI", 1),
        ifStmt([cmp("GTE", { shadow: sh.num(0), block: vget("nameI") }, { shadow: sh.num(3) })], [
          [
            // all three letters done: build name and start
            setVar("myName", sh.text(""), textJoinBB(listGet("letters", listGet("slots", sh.num(0))), textJoinBB(listGet("letters", listGet("slots", sh.num(1))), listGet("letters", listGet("slots", sh.num(2)))))),
            setVarBool("entryMode", "FALSE"),
            destroyAllOfKind("Entry"),
            destroyAllOfKind("Board"),
            setVarBool("started", "TRUE"),
          ],
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
  ], 900, 0)
);`,
  "A handler rework");

// ---------- 5. B handler: back a slot vs DONE (with submit) ----------
rep(
`topBlocks.push(
  keyOnEvent("controller.B", "ControllerButtonEvent.Pressed", [
    ifStmt([and(vget("started"), not(vget("paused")))], [
      [
        setGameOverMessage("DONE! GREAT RUN!", "true"),
        setGameOverEffect("effects.confetti", "true"),
        gameOver2("true"),
      ],
    ]),
  ], 1250, 300)
);`,
`topBlocks.push(
  keyOnEvent("controller.B", "ControllerButtonEvent.Pressed", [
    ifStmt([vget("entryMode")], [
      [
        ifStmt([cmp("GT", { shadow: sh.num(0), block: vget("nameI") }, { shadow: sh.num(0) })], [
          [
            changeVar("nameI", -1),
            tsSetText(listGet("entrySprites", vget("nameI")), listGet("letters", vget("charI"))),
          ],
        ]),
      ],
    ], [
      ifStmt([vget("started")], [
        [
          functionCall("lb_submit", "F_lbsub"),
          setGameOverMessage(textJoin("DONE!  RANK #", vget("myRank")), "true"),
          setGameOverEffect("effects.confetti", "true"),
          gameOver2("true"),
        ],
      ]),
    ]),
  ], 1250, 300)
);`,
  "B handler rework");

fs.writeFileSync("generate.js", s);
console.log("applied " + n + " edits (lb part 2)");
