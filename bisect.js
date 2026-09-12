const fs = require("fs");
let s = fs.readFileSync("generate.js", "utf8");
// NO_LB=1: skip lb function defs, entry/board show calls, dpad handlers, and A/B entry branches
if (process.env.NO_LB) {
  // 1. no lb functions
  s = s.replace(/\/\/ ---------- LEADERBOARD FUNCTIONS ----------[\s\S]*?\/\/ ---------- SCORE TICK \(forever\) ----------/,
    `// ---------- SCORE TICK (forever) ----------`);
  // 2. no entry/board calls in on-start
  s = s.replace(`    functionCall("lb_entry_show", "F_eshow"),
    functionCall("lb_board_show", "F_bshow"),
`, ``);
  // 3. A handler back to jump-only
  s = s.replace(/topBlocks\.push\(\n  keyOnEvent\("controller\.A", "ControllerButtonEvent\.Pressed", \[\n    ifStmt\(\[vget\("entryMode"\)\], \[[\s\S]*?\], \[\n      ifStmt\(\[and\(vget\("started"\), and\(vget\("grounded"\), not\(vget\("ducking"\)\)\)\], \[\n        \[\n          setVarNum\("vy", -200\),[\s\S]*?\], \[\n            \[\n              setVarBool\("entryMode", "FALSE"\),[\s\S]*?\], \[\n                \[\n                  setVar\("myName"[\s\S]*?\], 900, 0\)\n\);/, `SIMMARK`);
}
fs.writeFileSync("generate.debug.js", s);
console.log("bisect file written (NO_LB=" + (process.env.NO_LB || "off") + ")");
