/* Items that place themselves on every frame of every motion, by finding the face in the pixel grid.
   Shared by the game (items.js) and Pixel Pet Studio (studio/), so both show exactly the same thing.
   A grid is an array of strings, one letter per pixel ("B" = empty, "K" = outline, others = the pet's colours).
   Per-frame corrections made in the studio live in ITEM_FIX (item-fix.js): { "item": { "set:frame": {dx, dy, hide} } }. */
"use strict";

const TEAR = { main: "#8fd0f6", tip: "#bfe5fb" };

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
  // the body's own outline (the biggest connected run of outline): ear tips and limbs belong to it, pupils never do
  const main = new Set(); {
    const seen = new Set(); let best = [];
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
  }
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

// Lv6 pajamas: a hooded onesie in the character's colour. Everything but the face turns into the suit, so her own
// ears become the hood's ears; a lighter rim marks the hood opening and two white buttons sit on the chest.
// Facing away, the whole body is the suit (the back of the hood). Close-ups keep their own look.
const PAJAMA = {
  mochi: { main: "#ffbdd0", shade: "#f29ab5", rim: "#ffdbe6" },
  sora:  { main: "#acdaf8", shade: "#84bfeb", rim: "#d6eefd" },
  nori:  { main: "#ffd766", shade: "#efb53a", rim: "#ffeaa8" },
};
function autoPajama(grid, pet) {
  const h = grid.length, w = grid[0].length, pal = PAJAMA[pet];
  if (!pal || w > 60) return [];
  const eyes = findEyes(grid);
  let face = null;
  if (eyes.length === 2) { const d = eyes[1].cx - eyes[0].cx; face = { cx: (eyes[0].cx + eyes[1].cx) / 2 + 0.5, cy: (eyes[0].cy + eyes[1].cy) / 2 + 2.5, rx: d / 2 + 5.2, ry: 6 }; }
  else if (eyes.length === 1) face = { cx: eyes[0].cx + 0.5, cy: eyes[0].cy + 2.5, rx: 6.5, ry: 6 };
  const ell = (x, y, grow) => face && ((x + 0.5 - face.cx) / (face.rx + grow)) ** 2 + ((y + 0.5 - face.cy) / (face.ry + grow)) ** 2 <= 1;
  const out = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = grid[y][x];
    if (c === "B" || c === "K" || ell(x, y, 0)) continue;
    out.push([x, y, ell(x, y, 1.3) ? pal.rim : "LNQM".includes(c) ? pal.shade : pal.main]);
  }
  if (face) {                                              // two buttons down the front
    const bx = Math.floor(face.cx), by = Math.ceil(face.cy + face.ry) + 2;
    for (const y of [by, by + 3]) {
      const c = grid[y] && grid[y][bx];
      if (c && c !== "B" && c !== "K") { out.push([bx, y, "#ffffff"]); if (grid[y + 1] && grid[y + 1][bx] !== "K" && grid[y + 1][bx] !== "B") out.push([bx, y + 1, pal.shade]); }
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
