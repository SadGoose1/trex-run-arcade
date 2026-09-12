const fs = require("fs");
let s = fs.readFileSync("generate.js", "utf8");
let n = 0;
function rep(oldStr, newStr, label) {
  if (!s.includes(oldStr)) { console.error("NOT FOUND: " + label); process.exit(1); }
  s = s.replace(oldStr, newStr);
  n++;
}
const NOSET = `const NO_SETTINGS = !!process.env.NO_SETTINGS;`;

// 1. flag const
rep(`const SCORE_STEP = process.env.FASTSCORE ? 25 : 1;`,
    `const SCORE_STEP = process.env.FASTSCORE ? 25 : 1;\n${NOSET}`, "flag");

// 2. on-start: seed in-memory board instead of settings (when NO_SETTINGS), gate settings IO
rep(
`    ifStmt([not(settingsExists("lbScores"))], [
      [
        settingsWriteNumberArray("lbScores"),
        settingsWriteString("lbNames", sh.text("AAA,BBB")),
      ],
    ]),
    setVarExpr("lbScores", sh.num(0), settingsReadNumberArray("lbScores")),
    setVarExpr("lbNames", sh.text(""), settingsReadString("lbNames")),`,
`    ifStmt([not(settingsExists("lbScores"))], [
      [
        settingsWriteNumberArray("lbScores"),
        settingsWriteString("lbNames", sh.text("AAA,BBB")),
      ],
    ]),
    setVarExpr("lbScores", sh.num(0), settingsReadNumberArray("lbScores")),
    setVarExpr("lbNames", sh.text(""), settingsReadString("lbNames")),
    ...(NO_SETTINGS ? [
      setVarExpr("lbScores", sh.num(0), block("lists_create_with", \`<mutation items="2"></mutation>\` + value("ADD0", sh.num(100)) + value("ADD1", sh.num(50)))),
      setVarExpr("lbNames", sh.text(""), sh.text("AAA,BBB")),
    ] : []),`,
  "on-start seed");

// 3. lb_submit: skip persist writes when NO_SETTINGS
rep(
  `    settingsWriteNumberArray("lbScores"),
    settingsWriteString("lbNames", vget("tmpStr")),
  ], 0, 8000)`,
`    ...(NO_SETTINGS ? [] : [
      settingsWriteNumberArray("lbScores"),
      settingsWriteString("lbNames", vget("tmpStr")),
    ]),
  ], 0, 8000)`,
  "submit persist");

// 4. remove the title splash (entry screen is the title now)
rep(
  `    ...(NO_SPLASH ? [] : [splash("T-REX RUN!", "A = JUMP  DOWN = DUCK  B = DONE!")]),
`,
  ``,
  "remove title splash");

fs.writeFileSync("generate.js", s);
console.log("applied " + n + " edits");
