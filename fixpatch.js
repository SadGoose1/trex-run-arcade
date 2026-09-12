// Fix the plainVars edit in patch_lb2.js to match generate.js exactly, then append the new vars.
const fs = require("fs");
const cur = '"dino", "temp", "pick", "r2", "speed", "effSpeed", "vy", "gravity", "jumpHeld", "stage", "grounded", "ducking", "started", "starMs", "hitInvMs", "slowMs", "nightMode", "blinkOn", "phase", "nameI", "charI", "entryMode", "page", "myRank", "myScore", "myName", "lbScores", "lbNames", "nameArr", "tmpStr", "insIdx", "letterIdx", "letters", "entrySprites", "idx"';
const neu = cur + ', "slots", "first", "cIdx", "nm", "nm2", "i", "bIdx"';

// 1. update generate.js directly (that is the end goal anyway)
let g = fs.readFileSync("generate.js", "utf8");
const gv = 'const plainVars = [' + cur + '];';
if (!g.includes(gv)) { console.error("generate.js plainVars not matched"); process.exit(1); }
g = g.replace(gv, 'const plainVars = [' + neu + '];');
fs.writeFileSync("generate.js", g);

// 2. neutralize the "more vars" edit inside patch_lb2.js (already applied directly)
let p = fs.readFileSync("patch_lb2.js", "utf8");
const start = p.indexOf("// ---------- 1. more variables ----------");
const end = p.indexOf("// ---------- 2. textJoinBB");
if (start < 0 || end < 0) { console.error("markers missing"); process.exit(1); }
p = p.slice(0, start) + "// ---------- 1. more variables (applied directly to generate.js) ----------\n" + p.slice(end);
fs.writeFileSync("patch_lb2.js", p);
console.log("vars updated in generate.js; patch edit neutralized");
