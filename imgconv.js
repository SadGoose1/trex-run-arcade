// Converts the user-provided source images into MakeCode Arcade sprite art
// (char rows over the fixed 16-color palette). Outputs:
//   hq/sprites_hq.js  - module.exports with char-row arrays ('.'=transparent)
//   hq/sheet.png      - contact sheet at 6x for visual review
//   hq/mock.png       - 160x120 mock of the game screen (day) + night strip
const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

// ---- Arcade palette (verified against live sim + pxt-arcade docs) ----
const PAL = {
  "1": [255, 255, 255], // white
  "2": [255, 33, 33],   // red
  "3": [255, 147, 196], // pink
  "4": [255, 129, 53],  // orange
  "5": [255, 246, 9],   // yellow
  "6": [36, 156, 163],  // teal
  "7": [120, 220, 82],  // green
  "8": [0, 63, 173],    // blue
  "9": [135, 242, 255], // cyan
  a: [142, 46, 196],    // purple
  b: [164, 131, 159],   // mauve
  c: [92, 64, 108],     // dark purple
  d: [229, 205, 196],   // pale beige
  e: [145, 70, 61],     // brown
  f: [0, 0, 0],         // black
};

function load(name) {
  return PNG.sync.read(fs.readFileSync(path.join(__dirname, "src-imgs", name)));
}

// Flood-fill background removal: seeds = [x,y] points. Each seed grows a BFS
// that only accepts pixels within tol of THAT SEED's color, so the fill cannot
// crawl gradients into the subject.
function removeBg(png, seeds, tol) {
  const { width: W, height: H, data } = png;
  const bg = new Uint8Array(W * H);
  const key = (x, y) => y * W + x;
  const colAt = (i) => [data[i << 2], data[(i << 2) + 1], data[(i << 2) + 2]];
  for (const [sx, sy] of seeds) {
    const [sr, sg, sb] = colAt(key(sx, sy));
    const q = [key(sx, sy)];
    if (bg[q[0]]) continue;
    bg[q[0]] = 1;
    while (q.length) {
      const k = q.pop();
      const x = k % W, y = (k / W) | 0;
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const nk = key(nx, ny);
        if (bg[nk]) continue;
        const [r2, g2, b2] = colAt(nk);
        const d = (sr - r2) ** 2 + (sg - g2) ** 2 + (sb - b2) ** 2;
        if (d <= tol * tol) { bg[nk] = 1; q.push(nk); }
      }
    }
  }
  for (let k = 0; k < W * H; k++) if (bg[k]) data[(k << 2) + 3] = 0;
  return bg;
}

// Connected opaque components, largest first: [{pixels:[k...], bbox}]
function components(png) {
  const { width: W, height: H, data } = png;
  const seen = new Uint8Array(W * H);
  const comps = [];
  for (let k0 = 0; k0 < W * H; k0++) {
    if (seen[k0] || data[(k0 << 2) + 3] === 0) continue;
    const q = [k0];
    seen[k0] = 1;
    const pixels = [];
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    while (q.length) {
      const k = q.pop();
      pixels.push(k);
      const x = k % W, y = (k / W) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const [nx, ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const nk = ny * W + nx;
        if (!seen[nk] && data[(nk << 2) + 3] !== 0) { seen[nk] = 1; q.push(nk); }
      }
    }
    comps.push({ pixels, bbox: { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 } });
  }
  comps.sort((a, b) => b.pixels.length - a.pixels.length);
  return comps;
}

// Drop small disconnected opaque islands (stray motifs/stars).
function dropSmallComponents(png, minPixels) {
  const { width: W, height: H, data } = png;
  const seen = new Uint8Array(W * H);
  const q = [];
  for (let k = 0; k < W * H; k++) {
    if (seen[k] || data[(k << 2) + 3] === 0) continue;
    q.length = 0;
    const comp = [];
    seen[k] = 1; q.push(k);
    while (q.length) {
      const c = q.pop();
      comp.push(c);
      const x = c % W, y = (c / W) | 0;
      for (const [nx, ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const nk = ny * W + nx;
        if (!seen[nk] && data[(nk << 2) + 3] !== 0) { seen[nk] = 1; q.push(nk); }
      }
    }
    if (comp.length < minPixels) for (const c of comp) data[(c << 2) + 3] = 0;
  }
}

function bbox(png) {
  const { width: W, height: H, data } = png;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (data[((y * W + x) << 2) + 3] !== 0) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

function crop(png, bb) {
  const out = new PNG({ width: bb.w, height: bb.h });
  for (let y = 0; y < bb.h; y++) for (let x = 0; x < bb.w; x++) {
    const si = ((bb.y0 + y) * png.width + (bb.x0 + x)) << 2;
    const di = (y * bb.w + x) << 2;
    for (let ch = 0; ch < 4; ch++) out.data[di + ch] = png.data[si + ch];
  }
  return out;
}

// Alpha-aware box downscale: color averages only opaque pixels so the removed
// background never tints edges; alpha is the coverage ratio.
function downscale(png, tw, th) {
  const { width: W, height: H, data } = png;
  const out = new PNG({ width: tw, height: th });
  for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) {
    const sx0 = Math.floor((tx * W) / tw), sx1 = Math.max(sx0 + 1, Math.floor(((tx + 1) * W) / tw));
    const sy0 = Math.floor((ty * H) / th), sy1 = Math.max(sy0 + 1, Math.floor(((ty + 1) * H) / th));
    let r = 0, g = 0, b = 0, n = 0, cov = 0, tot = 0;
    for (let y = sy0; y < sy1 && y < H; y++) for (let x = sx0; x < sx1 && x < W; x++) {
      const i = (y * W + x) << 2;
      tot++;
      if (data[i + 3] > 0) { cov++; n++; r += data[i]; g += data[i + 1]; b += data[i + 2]; }
    }
    const di = (ty * tw + tx) << 2;
    if (n === 0) { out.data[di + 3] = 0; continue; }
    const alpha = cov / tot;
    if (alpha < 0.45) { out.data[di + 3] = 0; continue; }
    out.data[di] = Math.round(r / n);
    out.data[di + 1] = Math.round(g / n);
    out.data[di + 2] = Math.round(b / n);
    out.data[di + 3] = 255;
  }
  return out;
}

// Kill semi-Background-tinted fringe pixels adjacent to transparency.
function defringe(png, bgColor, tol, passes = 2) {
  const { width: W, height: H, data } = png;
  for (let p = 0; p < passes; p++) {
    const kill = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) << 2;
      if (data[i + 3] === 0) continue;
      let edge = false;
      for (const [nx, ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) { edge = true; continue; }
        if (data[((ny * W + nx) << 2) + 3] === 0 || data[((ny * W + nx) << 2) + 3] === 0) { edge = true; break; }
      }
      if (!edge) continue;
      const d = (data[i] - bgColor[0]) ** 2 + (data[i + 1] - bgColor[1]) ** 2 + (data[i + 2] - bgColor[2]) ** 2;
      if (d <= tol * tol) kill.push(i);
    }
    for (const i of kill) data[i + 3] = 0;
    if (!kill.length) break;
  }
}

function nearestChar(rgb, sub) {
  let best = null, bd = Infinity;
  for (const ch of sub) {
    const p = PAL[ch];
    const d = (rgb[0] - p[0]) ** 2 + (rgb[1] - p[1]) ** 2 + (rgb[2] - p[2]) ** 2;
    if (d < bd) { bd = d; best = ch; }
  }
  return best;
}

// quantize: either a sub-palette array (nearest match) or a fn(rgb)->char
function quantize(png, subOrFn) {
  const { width: W, height: H, data } = png;
  const rows = [];
  for (let y = 0; y < H; y++) {
    let row = "";
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) << 2;
      if (data[i + 3] === 0) { row += "."; continue; }
      const rgb = [data[i], data[i + 1], data[i + 2]];
      row += typeof subOrFn === "function" ? subOrFn(rgb) : nearestChar(rgb, subOrFn);
    }
    rows.push(row);
  }
  return rows;
}

// ---- image ops on char rows ----
const pad = (rows, w, h) => {
  const out = [];
  for (let y = 0; y < h; y++) {
    const r = rows[y] || "";
    out.push((r + ".".repeat(w)).slice(0, w));
  }
  return out;
};
function padTo(rows, w, h, anchor = "center") {
  const cw = Math.max(...rows.map((r) => r.length)), ch = rows.length;
  const xoff = anchor === "center" ? Math.floor((w - cw) / 2) : 0;
  const yoff = anchor === "bottom" ? h - ch : Math.floor((h - ch) / 2);
  const out = [];
  for (let y = 0; y < h; y++) {
    const src = rows[y - yoff] || "";
    let row = "";
    for (let x = 0; x < w; x++) row += src[x - xoff] || ".";
    out.push(row);
  }
  return out;
}
const flipH = (rows) => rows.map((r) => r.split("").reverse().join(""));
function flipV(rows) { return rows.slice().reverse(); }
function rotate90(rows) {
  // rotate counter-clockwise; h x w -> w x h
  const h = rows.length, w = rows[0].length;
  const out = [];
  for (let x = w - 1; x >= 0; x--) {
    let row = "";
    for (let y = 0; y < h; y++) row += rows[y][x];
    out.push(row);
  }
  return out;
}
// squash vertically to nh rows (resample), keeping the bottom row fixed
function squash(rows, nh) {
  const h = rows.length, w = rows[0].length;
  const out = [];
  for (let ty = 0; ty < nh; ty++) {
    const sy0 = Math.floor((ty * h) / nh), sy1 = Math.max(sy0 + 1, Math.floor(((ty + 1) * h) / nh));
    // majority vote per column
    let row = "";
    for (let x = 0; x < w; x++) {
      const counts = {};
      for (let sy = sy0; sy < sy1; sy++) { const c = rows[sy][x]; counts[c] = (counts[c] || 0) + 1; }
      let bc = ".", bn = 0;
      for (const c in counts) if (c !== "." && counts[c] > bn) { bn = counts[c]; bc = c; }
      row += bn > 0 ? bc : ".";
    }
    out.push(row);
  }
  return out;
}
// shift every row down by n (bottom rows fall off), blank rows on top
function shiftDown(rows, n) {
  const blank = ".".repeat(rows[0].length);
  const out = [];
  for (let y = 0; y < rows.length; y++) out.push(y < n ? blank : rows[y - n]);
  return out;
}

// ---- asset pipelines ----
function cutAsset(png, seeds, tol, opts = {}) {
  removeBg(png, seeds, tol);
  if (opts.dropSmall) dropSmallComponents(png, opts.dropSmall);
  let out = crop(png, bbox(png));
  if (opts.defringeBg) defringe(out, opts.defringeBg, opts.defringeTol || 55);
  return out;
}

const results = {};

// ===== DINO =====
{
  const png = load("dino.png");
  const W = png.width, H = png.height;
  // pastel body sits close to the white bg: keep the fill tolerance tight so
  // it cannot crawl into the subject
  const img = cutAsset(png, [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]], 10, { defringeBg: [255, 255, 255], defringeTol: 26 });
  const bbImg = crop(img, bbox(img));
  fs.writeFileSync(path.join(__dirname, "hq", "dino_crop.png"), PNG.sync.write(bbImg));
  results.dinoBase = padTo(quantize(downscale(bbImg, 24, 24), dinoChar), 24, 24);
}
// char mapper for the dino (soft pastel art, dark green spikes, yellow face)
function dinoChar(rgb) {
  const [r, g, b] = rgb;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  if (g > r + 15 && g > b + 5) return "7";          // green spikes
  if (r > 200 && g > 175 && b < 150) return "5";    // yellow face
  if (Math.min(r, g, b) > 215) return "1";          // white eye
  if (lum > 175) return "d";
  if (lum > 105) return "b";
  return "f";
}

// ===== TREES (3) =====
// The three trees in the source overlap so no natural gaps exist.
// Split the scene into three vertical thirds (matching the visual
// layout) and extract the largest component in each.
// trunk: warm/dark (olive-brown), canopy: green-dominant
function treeChar(rgb) {
  const [r, g, b] = rgb;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  if (g >= r - 4 && g >= b - 4 && lum >= 30) { // green-dominant
    if (lum > 110) return "7";
    if (lum > 60) return "6";
    return "c";
  }
  if (lum < 70) return "e"; // dark trunk/branch
  return "d";
}
{
  const src = load("trees.png");
  const W = src.width, H = src.height;
  const thirds = [[0, 100], [101, 201], [202, 303]];
  ["tree1", "tree2", "tree3"].forEach((name, i) => {
    const [rx0, rx1] = thirds[i];
    const sub = new PNG({ width: rx1 - rx0 + 1, height: H });
    for (let y = 0; y < H; y++) for (let x = rx0; x <= rx1; x++) {
      const si = (y * W + x) << 2, di = (y * sub.width + (x - rx0)) << 2;
      for (let c = 0; c < 4; c++) sub.data[di + c] = src.data[si + c];
    }
    // remove bg in this sub-scene independently (corner-seed tolerance 30)
    removeBg(sub, [[0, 0], [sub.width - 1, 0], [0, sub.height - 1], [sub.width - 1, sub.height - 1]], 30);
    const comps = components(sub);
    if (!comps.length) throw new Error("no tree component " + name);
    const bb = comps[0].bbox;
    // include trunk: extend bbox down 24px and sideways 6px to catch the base
    bb.x0 = Math.max(0, bb.x0 - 6); bb.x1 = Math.min(sub.width - 1, bb.x1 + 6);
    bb.y1 = Math.min(sub.height - 1, bb.y1 + 24);
    const img = crop(sub, bb);
    defringe(img, [95, 137, 72], 35);
    fs.writeFileSync(path.join(__dirname, "hq", name + "_crop.png"), PNG.sync.write(img));
    results[name] = padTo(quantize(downscale(img, 26, 32), treeChar), 26, 32, "bottom");
  });
}

// ===== SUN =====
{
  const png = load("sun.png");
  const W = png.width, H = png.height;
  const img = cutAsset(png, [[0,0],[W-1,0],[0,H-1],[W-1,H-1]], 30, { defringeBg: [254, 254, 254], defringeTol: 40 });
  const sq = downscale(img, 24, 24);
  results.sun = padTo(quantize(sq, sunChar), 24, 24);
}
function sunChar(rgb) {
  const [r, g, b] = rgb;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  if (Math.min(r, g, b) > 235) return "1";  // sparkles
  if (lum < 165 || (r > 200 && g < 190 && b < 120)) return "4"; // rim / rays
  return "5";
}

// ===== MOON =====
{
  const png = load("moon.png");
  const W = png.width, H = png.height;
  const seeds = [[0,0],[W-1,0],[0,H-1],[W-1,H-1],[0,(H/2)|0]];
  const img = cutAsset(png, seeds, 34, { dropSmall: 60, defringeBg: [217, 217, 217], defringeTol: 42 });
  const sq = downscale(img, 22, 22);
  results.moon = padTo(quantize(sq, moonChar), 22, 22);
}
// crescent: bright body -> white, mid shading -> warm beige, dark rim -> mauve
function moonChar(rgb) {
  const [r, g, b] = rgb;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  if (lum > 205) return "1";
  if (lum > 150) return "d";
  return "b";
}

// ===== CLOUDS (9) =====
{
  const src = load("clouds.png");
  const W = src.width, H = src.height;
  removeBg(src, [[0,0],[W-1,0],[0,H-1],[W-1,H-1]], 45);
  const comps = components(src).slice(0, 9);
  if (comps.length < 9) throw new Error("expected 9 clouds, got " + comps.length);
  // sort left-to-right, top-to-bottom for stable naming
  comps.sort((a, b) => (Math.floor(a.bbox.y0 / 100) - Math.floor(b.bbox.y0 / 100)) || (a.bbox.x0 - b.bbox.x0));
  for (let i = 0; i < 9; i++) {
    const img = crop(src, comps[i].bbox);
    defringe(img, [0, 173, 254], 65);
    const tw = Math.min(30, img.width), th = Math.max(8, Math.round((img.height / img.width) * tw));
    results["cloud" + (i + 1)] = padTo(quantize(downscale(img, tw, th), ["1", "d", "9"]), tw, th);
  }
}

// ===== BIRD =====
{
  const png = load("bird.png");
  const W = png.width, H = png.height;
  const img = cutAsset(png, [[0,0],[W-1,0],[0,H-1],[W-1,H-1]], 30, { defringeBg: [245, 245, 245], defringeTol: 40 });
  fs.writeFileSync(path.join(__dirname, "hq", "bird_crop.png"), PNG.sync.write(img));
  const sq = downscale(img, 24, 16);
  const frame1 = quantize(sq, birdChar);
  results.bird1 = frame1;
  // flap frame: push the upper wing block down by 3 rows (wings lowered)
  results.bird2 = shiftDown(blackTop(frame1, 8), 3);
}
// bird mapper: navy wings->black, azure body->cyan, white belly->white, beak->yellow
function birdChar(rgb) {
  const [r, g, b] = rgb;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  if (Math.min(r, g, b) > 210) return "1";
  if (r > 200 && g > 170 && b < 120) return "5"; // beak
  if (b > r + 30 && b > 90) {
    if (lum < 90) return "f";   // navy wings
    return "9";                 // azure body
  }
  if (lum < 80) return "f";
  return "9";
}
// blank everything above a row, keeping only the lower block (used for flap)
function blackTop(rows, fromRow) {
  return rows.map((r, y) => (y < fromRow ? ".".repeat(r.length) : r));
}

// ===== derived dino poses =====
{
  const base = results.dinoBase;
  results.dino1 = base;
  results.dino2 = padTo(squash(base, 23), 24, 24, "bottom"); // running bounce
  results.dinoJump = base;
  results.dinoDuck = squash(base, 16).map((r) => r); // 24x16 duck
  results.dinoDead = rotate90(base); // lying on its side/back
  // star power: golden body
  const gold = (rows) => rows.map((r) => r
    .replace(/d/g, "5").replace(/b/g, "5").replace(/f/g, "4"));
  results.star1 = gold(results.dino1);
  results.star2 = gold(results.dino2);
}

// keep the old small props (unchanged art, corrected colors)
results.starPow = [
  "...5....",
  "...5....",
  ".55555..",
  "..555...",
  "..555...",
  ".5.5.5..",
  "........",
  "........",
];
results.heart = [
  ".22.22..",
  "2222222.",
  "2222222.",
  "2222222.",
  ".22222..",
  "..222...",
  "...2....",
  "........",
];
results.bolt = [
  "....55..",
  "...55...",
  "..55....",
  ".55555..",
  "...55...",
  "..55....",
  ".55.....",
  "........",
];
results.cactus1 = require("./sprites.js").cactus1;
results.cactus2 = require("./sprites.js").cactus2;
results.ground = require("./sprites.js").ground;

// ---- emit module ----
const order = ["dino1","dino2","dinoJump","dinoDuck","dinoDead","star1","star2",
  "tree1","tree2","tree3","sun","moon","cloud1","cloud2","cloud3","cloud4","cloud5",
  "cloud6","cloud7","cloud8","cloud9","bird1","bird2","starPow","heart","bolt",
  "cactus1","cactus2","ground"];
let out = "// HQ sprite art generated by imgconv.js from the user-provided images.\n";
out += "// Chars map to the Arcade palette (0=transparent,1=white,2=red,3=pink,\n";
out += "// 4=orange,5=yellow,6=teal,7=green,8=blue,9=cyan,a=purple,b=mauve,\n";
out += "// c=dark purple,d=pale,e=brown,f=black). '.' = transparent.\n\nmodule.exports = {\n";
for (const k of order) {
  if (!results[k]) { throw new Error("missing sprite " + k); }
  const rows = results[k];
  const w = rows[0].length;
  rows.forEach((r, i) => { if (r.length !== w) throw new Error(k + " row " + i + " width " + r.length + " != " + w); });
  out += "  " + k + ": [\n" + rows.map((r) => '    "' + r + '"').join(",\n") + "\n  ],\n";
}
out += "};\n";
fs.writeFileSync(path.join(__dirname, "hq", "sprites_hq.js"), out);

// ---- contact sheet at 6x on checker ----
function drawRows(png, rows, ox, oy, scale) {
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) {
    const c = rows[y][x];
    if (c === ".") continue;
    const p = PAL[c];
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const i = ((oy + y * scale + dy) * png.width + (ox + x * scale + dx)) << 2;
      png.data[i] = p[0]; png.data[i + 1] = p[1]; png.data[i + 2] = p[2]; png.data[i + 3] = 255;
    }
  }
}
const sheet = new PNG({ width: 1000, height: 760 });
for (let y = 0; y < sheet.height; y++) for (let x = 0; x < sheet.width; x++) {
  const i = (y * sheet.width + x) << 2;
  const v = ((x >> 3) + (y >> 3)) % 2 ? 235 : 220;
  sheet.data[i] = v; sheet.data[i + 1] = v; sheet.data[i + 2] = v; sheet.data[i + 3] = 255;
}
let sx = 10, sy = 10, rowH = 0;
const place = (rows, scale, label) => {
  const w = rows[0].length * scale, h = rows.length * scale;
  if (sx + w > sheet.width - 10) { sx = 10; sy += rowH + 14; rowH = 0; }
  drawRows(sheet, rows, sx, sy, scale);
  sx += w + 14; rowH = Math.max(rowH, h);
};
for (const k of order) place(results[k], k.startsWith("cloud") ? 5 : 6, k);
fs.writeFileSync(path.join(__dirname, "hq", "sheet.png"), PNG.sync.write(sheet));

// ---- mock game frame 160x120 (day) + night variant ----
function mock(night) {
  const m = new PNG({ width: 160, height: 120 });
  const bg = night ? PAL.f : PAL["8"];
  for (let i = 0; i < 160 * 120; i++) {
    m.data[(i << 2)] = bg[0]; m.data[(i << 2) + 1] = bg[1]; m.data[(i << 2) + 2] = bg[2]; m.data[(i << 2) + 3] = 255;
  }
  const put = (rows, cx, cy) => drawRows(m, rows, Math.round(cx - rows[0].length / 2), Math.round(cy - rows.length / 2), 1);
  // ground (center y=109)
  const groundRows = [];
  for (let r = 0; r < 2; r++) groundRows.push((r === 0 ? "d".repeat(160) : "e".repeat(160)));
  drawRows(m, groundRows, 0, 108, 1);
  put(results.sun, 138, 30);
  put(results.cloud1, 40, 14);
  put(results.cloud5, 90, 22);
  put(results.tree2, 140, 92);
  put(results.tree1, 60, 92);
  put(results.cactus2, 105, 100);
  put(results.bird1, 90, 82);
  put(results.dino1, 24, 96);
  if (night) { // moon replaces sun
    // paint over sun area
    for (let y = 12; y < 50; y++) for (let x = 118; x < 152; x++) {
      const i = (y * 160 + x) << 2;
      m.data[i] = bg[0]; m.data[i + 1] = bg[1]; m.data[i + 2] = bg[2];
    }
    put(results.moon, 130, 26);
    put(results.bird2, 90, 82);
    put(results.dino2, 24, 96);
  }
  return m;
}
fs.writeFileSync(path.join(__dirname, "hq", "mock_day.png"), PNG.sync.write(mock(false)));
const nightPng = mock(true);
// night strip under the day mock: combine into one image
const combo = new PNG({ width: 160, height: 244 });
combo.data.set(mock(false).data, 0);
combo.data.set(nightPng.data, 160 * 120 << 2);
fs.writeFileSync(path.join(__dirname, "hq", "mock.png"), PNG.sync.write(combo));

console.log("done. sprites:", order.join(","));
for (const k of order) console.log(k, results[k][0].length + "x" + results[k].length);
