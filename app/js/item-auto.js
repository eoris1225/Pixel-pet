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

const ITEM_AUTO = { tears: autoTears };

// the pixels of an auto item on one frame, with the studio's correction for that frame applied
function autoItemPixels(item, grid, key) {
  const fix = (typeof ITEM_FIX !== "undefined" && ITEM_FIX[item] && ITEM_FIX[item][key]) || null;
  if (fix && fix.hide) return [];
  const px = ITEM_AUTO[item](grid);
  return fix ? px.map(([x, y, c]) => [x + (fix.dx || 0), y + (fix.dy || 0), c]) : px;
}
