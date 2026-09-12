// Slices top-level blocks out of main.blocks into probe variants for
// loader-abort bisection. Usage: node probe.js <outFile> <selector>...
// Selectors: onstart, A, B, Bnosubmit, Bnobranch, defs, tick, forever
const fs = require("fs");

function splitTops(xml) {
  const vEnd = xml.indexOf("</variables>") + "</variables>".length;
  const head = xml.slice(0, vEnd);
  const body = xml.slice(vEnd, xml.lastIndexOf("</xml>"));
  const tops = [];
  let depth = 0, start = -1;
  const re = /<(\/?)block\b[^>]*?>/g;
  let m;
  while ((m = re.exec(body))) {
    if (m[1] === "/") {
      depth--;
      if (depth === 0) tops.push(body.slice(start, re.lastIndex));
    } else {
      if (depth === 0) start = m.index;
      depth++;
    }
  }
  if (depth !== 0) throw new Error("unbalanced " + depth);
  return { head, tops };
}

function label(t) {
  const type = (t.match(/<block type="([^"]+)"/) || [])[1];
  const btn = (t.match(/name="button">([^<]*)/) || [])[1];
  const fn = (t.match(/mutation name="([a-z_]+)" functionid/) || [])[1];
  const y = (t.match(/ y="(\d+)"/) || [])[1];
  const x = (t.match(/ x="(\d+)"/) || [])[1];
  return `${type}${btn ? ":" + btn : ""}${fn ? ":" + fn : ""}@${x},${y}`;
}

const xml = fs.readFileSync("main.blocks", "utf8");
const { head, tops } = splitTops(xml);
const labelled = tops.map((t) => ({ t, l: label(t) }));
labelled.forEach((e, i) => console.log(i, e.l));

const want = process.argv.slice(3);
function pick(pred) {
  return labelled.filter((e) => pred(e.l)).map((e) => e.t);
}
const sets = {
  onstart: (l) => l.startsWith("pxt-on-start"),
  A: (l) => l.startsWith("keyonevent:controller.A@900,0"),
  B: (l) => l.startsWith("keyonevent:controller.B"),
  defs: (l) => l.startsWith("function_definition"),
  forever: (l) => l.startsWith("forever"),
  tick: (l) => l.startsWith("gameinterval@0,1500"),
};
let chosen = [];
for (const w of want) {
  if (sets[w]) chosen = chosen.concat(sets[w] === null ? [] : pick(sets[w]));
  else throw new Error("unknown selector " + w);
}
const out = head + chosen.join("") + "</xml>";
fs.writeFileSync(process.argv[2], out, "utf8");
console.log("WROTE", process.argv[2], chosen.length, "top blocks,", out.length, "bytes");
