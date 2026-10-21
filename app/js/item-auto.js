/* Items that place themselves on every frame of every motion, by finding the face in the pixel grid.
   Shared by the game (items.js) and Pixel Pet Studio (studio/), so both show exactly the same thing.
   A grid is an array of strings, one letter per pixel ("B" = empty, "K" = outline, others = the pet's colours).
   Per-frame corrections made in the studio live in ITEM_FIX (item-fix.js): { "item": { "set:frame": {dx, dy, hide} } }. */
"use strict";

const TEAR = { main: "#8fd0f6", tip: "#bfe5fb" };

// the body's own outline (the biggest connected run of outline): ear tips and limbs belong to it, pupils never do
function mainOutline(grid) {
  const h = grid.length, w = grid[0].length, at = (x, y) => (y >= 0 && y < h && x >= 0 && x < w ? grid[y][x] : "B");
  const main = new Set(), seen = new Set(); let best = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (at(x, y) !== "K" || seen.has(x + "," + y)) continue;
    const comp = [], stack = [[x, y]]; seen.add(x + "," + y);
    while (stack.length) {
      const [px, py] = stack.pop(); comp.push(px + "," + py);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const k = (px + dx) + "," + (py + dy);
        if (at(px + dx, py + dy) === "K" && !seen.has(k)) { seen.add(k); stack.push([px + dx, py + dy]); }
      }
    }
    if (comp.length > best.length) best = comp;
  }
  best.forEach(k => main.add(k));
  return main;
}

// eyes: a white highlight pixel with outline on at least three sides marks a pupil; nearby highlights
// are one eye, and the eye's extent is the outline right around them. Faces turned away and closed or blinking
// eyes have no such highlight, so nothing is drawn there.
function findEyes(grid) {
  const h = grid.length, w = grid[0].length, at = (x, y) => (y >= 0 && y < h && x >= 0 && x < w ? grid[y][x] : "B");
  const hi = [];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    if (at(x, y) !== "W") continue;                                   // the white catch-light, not a cheek or body colour
    const k = (at(x - 1, y) === "K") + (at(x + 1, y) === "K") + (at(x, y - 1) === "K") + (at(x, y + 1) === "K");
    if (k >= 3) hi.push([x, y]);
  }
  const groups = [];
  for (const p of hi) {                                              // a pupil's catch-light is one or two touching pixels
    const g = groups.find(g => g.pts.length < 2 && g.pts.some(q => Math.abs(q[0] - p[0]) <= 1 && Math.abs(q[1] - p[1]) <= 1));
    if (g) g.pts.push(p); else groups.push({ pts: [p] });
  }
  const main = mainOutline(grid);
  const eyes = groups.map(g => {
    const xs = g.pts.map(p => p[0]), ys = g.pts.map(p => p[1]);
    let x0 = Math.min(...xs) - 1, x1 = Math.max(...xs) + 1, y0 = Math.min(...ys) - 1, y1 = Math.max(...ys) + 1;
    let kx0 = 1e9, kx1 = -1, ky0 = 1e9, ky1 = -1;                  // the outline pixels of the eye inside that box
    let own = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (at(x, y) === "K" && !main.has(x + "," + y)) {
      own++; kx0 = Math.min(kx0, x); kx1 = Math.max(kx1, x); ky0 = Math.min(ky0, y); ky1 = Math.max(ky1, y);
    }
    return { n: g.pts.length, own, x0: kx0, x1: kx1, y0: ky0, y1: ky1, cx: (kx0 + kx1) / 2, cy: (ky0 + ky1) / 2 };
  }).filter(e => e.own >= 4);
  // two eyes side by side (the highest such pair: a mouth sits lower), else one eye with a full highlight (a profile)
  let best = null;
  for (let i = 0; i < eyes.length; i++) for (let j = i + 1; j < eyes.length; j++) {
    const a = eyes[i], b = eyes[j], dx = Math.abs(a.cx - b.cx);
    if (Math.abs(a.cy - b.cy) <= 2 && dx >= 4 && dx <= 14 && (!best || a.cy + b.cy < best[0].cy + best[1].cy)) best = a.cx < b.cx ? [a, b] : [b, a];
  }
  if (best) return best;
  const big = eyes.filter(e => e.n >= 2 && e.own >= 8 && e.cy < grid.length * 0.6).sort((a, b) => a.cy - b.cy);   // a whole pupil, in the upper face
  return big.length ? [big[0]] : [];
}

// tears: a short stream under each eye, on the side towards the middle of the face; it stops at outline or empty space
function autoTears(grid) {
  const eyes = findEyes(grid), out = [];
  if (!eyes.length) return out;
  const mid = eyes.length === 2 ? (eyes[0].cx + eyes[1].cx) / 2 : eyes[0].cx;
  for (const e of eyes) {
    const x = eyes.length === 2 ? (e.cx < mid ? Math.ceil(e.cx) : Math.floor(e.cx)) : Math.round(e.cx);
    const run = [];
    for (let k = 1; k <= 4; k++) {
      const y = e.y1 + k, c = grid[y] && grid[y][x];
      if (!c || c === "B" || c === "K") break;
      run.push([x, y, k === 4 ? TEAR.tip : TEAR.main]);
    }
    if (run.length >= 2) out.push(...run);                              // no room for a real drop: leave it off
  }
  return out;
}

// 치카's teddy bear (round head, little round ears, white muzzle): she hugs it in front of her belly.
// It is centred under her face and stands where her feet are, so it follows her through every motion.
const TEDDY = [
  ".KK.....KK.",
  "KNNK...KNNK",
  "KNNKKKKKNNK",
  ".KNNNNNNNK.",
  "KNNDNNNDNNK",
  "KNNNWWWNNNK",
  "KNNWWDWWNNK",
  ".KNNWWWNNK.",
  "..KKNNNKK..",
  ".KKnnnnnKK.",
  "KnnKnnnKnnK",
  ".KKnnnnnKK.",
  ".KnnKKKnnK.",
  ".KKK...KKK.",
];
const TEDDY_PAL = { K: "#3a2a1a", N: "#be8856", n: "#ac784a", W: "#fffaf0", D: "#4a3020" };
function autoTeddy(grid) {
  const eyes = findEyes(grid);
  if (!eyes.length) return [];                                        // facing away: the bear is hidden behind her
  const cx = eyes.length === 2 ? (eyes[0].cx + eyes[1].cx) / 2 : eyes[0].cx;
  const bottom = Math.max(...eyes.map(e => e.y1)) + 16;               // on the base pose: eyes end at row 12, feet at 28
  const x0 = Math.round(cx - (TEDDY[0].length - 1) / 2), y0 = bottom - TEDDY.length + 1, out = [];
  TEDDY.forEach((row, y) => [...row].forEach((ch, x) => { if (TEDDY_PAL[ch]) out.push([x0 + x, y0 + y, TEDDY_PAL[ch]]); }));
  return out;
}

// where the face is when findEyes sees no open eyes (closed or squinting eyes, a profile, a face pressed to the ground):
// a pupil touching the head's outline, still next to a cheek; else the hatched blush (pink with outline stripes) itself
function findFace(grid) {
  const h = grid.length, w = grid[0].length, at = (x, y) => (y >= 0 && y < h && x >= 0 && x < w ? grid[y][x] : "B");
  const pink = (x, y, r) => { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (at(x + i, y + j) === "P") return true; return false; };
  const eyes = [];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    if (at(x, y) !== "W") continue;
    const k = (at(x - 1, y) === "K") + (at(x + 1, y) === "K") + (at(x, y - 1) === "K") + (at(x, y + 1) === "K");
    let box = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) box += at(x + i, y + j) === "K";
    if (k >= 3 && box >= 5 && pink(x, y, 6) && !eyes.some(e => Math.abs(e.cx - x) <= 2 && Math.abs(e.cy - y) <= 2)) eyes.push({ cx: x, cy: y });
  }
  const cheeks = [];                                       // pink spots; a real cheek has outline stripes through it
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (at(x, y) !== "P") continue;
    let c = cheeks.find(c => c.pts.some(([px, py]) => Math.abs(px - x) <= 2 && Math.abs(py - y) <= 2));
    if (!c) cheeks.push(c = { pts: [], striped: false });
    c.pts.push([x, y]);
    if (at(x + 1, y) === "K" && at(x + 2, y) === "P") c.striped = true;
  }
  cheeks.forEach(c => { c.y1 = Math.max(...c.pts.map(p => p[1])); c.cx = c.pts.reduce((a, p) => a + p[0], 0) / c.pts.length; c.cy = c.pts.reduce((a, p) => a + p[1], 0) / c.pts.length; });
  const blush = cheeks.filter(c => c.pts.length <= 14);
  const pair = (list, far) => { let best = null;
    for (const a of list) for (const b of list) if (a.cx < b.cx && Math.abs(a.cy - b.cy) <= 2.5 && b.cx - a.cx >= (far > 14 ? 8 : 4) && b.cx - a.cx <= far && (far <= 14 || a.striped || b.striped)) best = best || [a, b];
    return best; };
  const ep = pair(eyes, 14);
  if (ep) { const d = ep[1].cx - ep[0].cx; return { cx: (ep[0].cx + ep[1].cx) / 2, cy: (ep[0].cy + ep[1].cy) / 2 + 3, rx: d / 2 + 5.2, ry: 6 }; }
  const cp = pair(blush, 20);
  if (cp) {                                                // the opening ends just under the cheeks (on a bowed head the chin is right there)
    const d = cp[1].cx - cp[0].cx, cy = (cp[0].cy + cp[1].cy) / 2;
    return { cx: (cp[0].cx + cp[1].cx) / 2 + 0.5, cy, rx: Math.max(6.5, d / 2 + 1.7), ry: 6, down: Math.max(cp[0].y1, cp[1].y1) + 2 - cy };
  }
  if (eyes.length) return { cx: eyes[0].cx, cy: eyes[0].cy + 3, rx: 6.5, ry: 6 };
  const one = blush.find(c => c.striped);
  if (one) {                                               // one cheek: a profile, the face sits between it and the middle of the body
    const c = { x: one.cx, y: one.cy }; let sx = 0, n = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (at(x, y) !== "B") { sx += x; n++; }
    const dir = Math.sign(sx / n - c.x) || 1;
    return { cx: c.x + 0.5 + dir * 3, cy: c.y - 1.5, rx: 6.5, ry: 6 };
  }
  return null;
}

// Lv6 pajamas: a hooded onesie in the character's colour. Everything but the face turns into the suit, so her own
// ears become the hood's ears; a lighter rim marks the hood opening and two white buttons sit on the chest.
// The opening reaches well above the eyes, like the figures: 욱's brows show, and 하와's bangs in a deeper blue.
// Facing away, the whole body is the suit (the back of the hood). 욱's white tail pokes out of it. Close-ups keep their own look.
const PAJAMA = {
  mochi: { main: "#ffbdd0", shade: "#f29ab5", rim: "#ffdbe6", up: 2.5 },
  sora:  { main: "#acdaf8", shade: "#84bfeb", rim: "#d6eefd", up: 4, bangs: "S", bang: "#5eaee6" },
  nori:  { main: "#ffd766", shade: "#efb53a", rim: "#ffeaa8", keep: "W", up: 5 },
};
function autoPajama(grid, pet) {
  const h = grid.length, w = grid[0].length, pal = PAJAMA[pet];
  if (!pal || w > 60) return [];
  const eyes = findEyes(grid);
  let face = null;
  if (eyes.length === 2) { const d = eyes[1].cx - eyes[0].cx; face = { cx: (eyes[0].cx + eyes[1].cx) / 2 + 0.5, cy: (eyes[0].cy + eyes[1].cy) / 2 + 2.5, rx: d / 2 + 5.2, ry: 6 }; }
  else if (eyes.length === 1) face = { cx: eyes[0].cx + 0.5, cy: eyes[0].cy + 2.5, rx: 6.5, ry: 6 };
  else face = findFace(grid);
  if (face) {                                              // the opening ends just under the mouth, so a low face (a bow) leaves the body to the suit
    const main = mainOutline(grid); let low = -1;
    for (let y = Math.ceil(face.cy); y <= face.cy + face.ry; y++) for (let x = Math.floor(face.cx - 3); x <= face.cx + 3; x++)
      if (grid[y] && grid[y][x] === "K" && !main.has(x + "," + y)) low = Math.max(low, y);
    face.down = Math.min(face.down || face.ry, low < 0 ? face.ry : Math.max(2.5, low + 1.5 - face.cy));
  }
  const ell = (x, y, grow) => {
    if (!face) return false;
    const dy = y + 0.5 - face.cy, ry = dy < 0 ? face.ry + (pal.up || 0) : face.down, ex = dy < 0 && pal.up ? 4 : 2;   // 하와's top is squarer, to show her bangs
    return Math.abs((x + 0.5 - face.cx) / (face.rx + grow)) ** ex + Math.abs(dy / (ry + grow)) ** ex <= 1;
  };
  const out = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = grid[y][x];
    if (c === "B" || c === "K" || (pal.keep && pal.keep.includes(c))) continue;
    if (ell(x, y, 0)) { if (pal.bangs && pal.bangs.includes(c)) out.push([x, y, pal.bang]); continue; }
    // a gloomy shadow (Q) stays on the face only: the suit itself is plain
    out.push([x, y, ell(x, y, 1.3) ? pal.rim : "LNM".includes(c) ? pal.shade : pal.main]);
  }
  if (face) {                                              // two buttons down the front, as far as the body has room
    const bx = Math.floor(face.cx), top = Math.ceil(face.cy + face.down) + 1;
    const ok = y => { const c = grid[y] && grid[y][bx]; return c && c !== "B" && c !== "K" && !ell(bx, y, 1.3); };
    const first = [top, top + 1].find(ok);
    if (first !== undefined) {
      const gap = ok(first + 3) && ok(first + 4) ? 3 : 2;
      for (const y of [first, first + gap]) {
        if (!ok(y)) continue;
        out.push([bx, y, "#ffffff"]);
        if (gap === 3 && ok(y + 1)) out.push([bx, y + 1, pal.shade]);
      }
    }
  }
  return out;
}

const ITEM_AUTO = { tears: autoTears, teddy: autoTeddy, pajama: autoPajama };

// the pixels of an auto item on one frame, with the studio's correction for that frame applied
function autoItemPixels(item, grid, key) {
  const fix = (typeof ITEM_FIX !== "undefined" && ITEM_FIX[item] && ITEM_FIX[item][key]) || null;
  if (fix && fix.hide) return [];
  const px = ITEM_AUTO[item](grid, key.split("-")[0]);           // the key starts with the pet ("mochi-wave:3")
  return fix ? px.map(([x, y, c]) => [x + (fix.dx || 0), y + (fix.dy || 0), c]) : px;
}
