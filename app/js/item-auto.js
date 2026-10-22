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

// her arms taken away (when she holds something in front of her with her own little paws). Each arm is a small bulge
// outside her body whose inner line is her body's edge: the bulge is cleared, that line becomes her outline (her own waist,
// not wide shoulders) and the hip just below is kept in line. "clear", "outline" and "body" are filled in by whoever draws.
// Rows y1..y2 are searched for the arm (her legs, lower down, look alike).
function armOff(grid, y1, y2) {
  const out = [], at = (x, y) => (grid[y] && grid[y][x]) || "B";
  for (const side of [-1, 1]) {
    const edge = y => { const r = grid[y]; if (!r) return -1; const i = side < 0 ? r.search(/[^B]/) : r.length - 1 - [...r].reverse().join("").search(/[^B]/); return i < 0 || i >= r.length ? -1 : i; };
    const arm = [];                                          // rows where the arm shows: outline, a pixel of arm, its inner line
    for (let y = y1; y <= y2; y++) { const e = edge(y); if (e >= 0 && at(e, y) === "K" && !"KB".includes(at(e - side, y)) && at(e - 2 * side, y) === "K") arm.push(y); }
    if (!arm.length) continue;
    const top = Math.max(0, arm[0] - 2), bot = arm[arm.length - 1], waist = edge(bot) - 2 * side;
    for (let y = top; y <= bot + 1; y++) {
      const e = edge(y); if (e < 0) continue;
      // her own edge: the arm's inner line, one in at the shoulder, and the hip just below kept in line with the waist
      const tx = y > bot ? ((waist - e) * -side > 0 ? waist : e) : arm.includes(y) ? e - 2 * side : e - side;
      if (tx === e && y > bot) continue;
      for (let x = e; x !== tx; x -= side) out.push([x, y, "clear"]);
      out.push([tx, y, "outline"]);
    }
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
const TEDDY_PAW = [".KK.", "KWWK", ".KK."];
const TEDDY_PAL = { K: "#3a2a1a", N: "#be8856", n: "#ac784a", W: "#fffaf0", D: "#4a3020" };
function autoTeddy(grid) {
  const eyes = findEyes(grid);
  if (!eyes.length) return [];                                        // facing away: the bear is hidden behind her
  const cx = eyes.length === 2 ? (eyes[0].cx + eyes[1].cx) / 2 : eyes[0].cx;
  const bottom = Math.max(...eyes.map(e => e.y1)) + 15;               // held a little up off her feet (base pose: eyes end at row 12)
  const x0 = Math.round(cx - (TEDDY[0].length - 1) / 2), y0 = bottom - TEDDY.length + 1, out = [];
  // her arms go round the bear instead of hanging at her sides; two little paws hold the bear's sides
  out.push(...armOff(grid, y0 + 3, y0 + 7));
  TEDDY.forEach((row, y) => [...row].forEach((ch, x) => { if (TEDDY_PAL[ch]) out.push([x0 + x, y0 + y, TEDDY_PAL[ch]]); }));
  for (const px of [x0 - 1, x0 + TEDDY[0].length - 3]) TEDDY_PAW.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== ".") out.push([px + x, y0 + 6 + y, ch === "K" ? TEDDY_PAL.K : "body"]);   // where her arms were
  }));
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

// the face on one frame (its centre and size), from open eyes or else from the cheeks; null when she faces away
function faceOf(grid) {
  const eyes = findEyes(grid);
  if (eyes.length === 2) { const d = eyes[1].cx - eyes[0].cx; return { cx: (eyes[0].cx + eyes[1].cx) / 2 + 0.5, cy: (eyes[0].cy + eyes[1].cy) / 2 + 2.5, rx: d / 2 + 5.2, ry: 6 }; }
  if (eyes.length === 1) return { cx: eyes[0].cx + 0.5, cy: eyes[0].cy + 2.5, rx: 6.5, ry: 6 };
  return findFace(grid);
}

// Lv6 pajamas: a hooded onesie in the character's colour. Everything but the face turns into the suit, so her own
// ears become the hood's ears; a lighter rim marks the hood opening and two white buttons sit on the chest.
// The opening reaches well above the eyes, like the figures: 욱's brows show, and 하와's bangs in a deeper blue.
// Facing away, the whole body is the suit (the back of the hood). 욱's white tail pokes out of it. Close-ups keep their own look.
const PAJAMA = {
  mochi: { main: "#ffbdd0", shade: "#f29ab5", rim: "#ffdbe6", up: 2.5, tail: true },   // her little round tail stays white
  sora:  { main: "#acdaf8", shade: "#84bfeb", rim: "#d6eefd", up: 4, bangs: "S", bang: "#5eaee6" },
  nori:  { main: "#ffd766", shade: "#efb53a", rim: "#ffe07e", keep: "W", up: 3 },   // her rim must not match her own face colour
};
// 치카's gloom shadow, in three strengths, as her own white body (#ffffff) looks under it; the suit is dimmed by the same amount
const GLOOM = { L: "#e2e9eb", N: "#ccd6dc", Q: "#b8c8d0" };
function dim(col, shadow) {
  const a = [1, 3, 5].map(i => parseInt(col.substr(i, 2), 16)), b = [1, 3, 5].map(i => parseInt(shadow.substr(i, 2), 16)), w = [255, 255, 255];
  return "#" + a.map((v, i) => Math.round(Math.min(255, v * b[i] / w[i])).toString(16).padStart(2, "0")).join("");
}
function autoPajama(grid, pet) {
  const h = grid.length, w = grid[0].length, pal = PAJAMA[pet];
  if (!pal || w > 60) return [];
  const face = faceOf(grid);
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
  // under a gloomy shadow the bare top of her head (still white) now shows inside the opening: shade it like the rest of the face
  let gloom = null; {
    const n = {};
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (GLOOM[grid[y][x]] && ell(x, y, 0)) n[grid[y][x]] = (n[grid[y][x]] || 0) + 1;
    const top = Object.keys(n).sort((a, b) => n[b] - n[a])[0];
    if (top && n[top] >= 12) gloom = GLOOM[top];
  }
  const inner = (x, y) => { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const r = grid[y + j]; if (!r || !r[x + i] || r[x + i] === "B") return false; } return true; };
  // 치카's tail: a little white patch (2 to 8 pixels) ringed all round by outline, away from her face
  const tail = new Set();
  if (pal.tail) {
    const seen = new Set();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (grid[y][x] !== "W" || seen.has(x + "," + y)) continue;
      const comp = [], stack = [[x, y]]; let closed = true; seen.add(x + "," + y);
      while (stack.length) {
        const [px, py] = stack.pop(); comp.push(px + "," + py);
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx = px + dx, ny = py + dy, k = nx + "," + ny, c = grid[ny] && grid[ny][nx];
          if (c === "W") { if (!seen.has(k)) { seen.add(k); stack.push([nx, ny]); } }
          else if (c !== "K") closed = false;
        }
      }
      if (closed && comp.length >= 2 && comp.length <= 8 && !comp.some(k => { const [cx, cy] = k.split(",").map(Number); return ell(cx, cy, 1.3); }))
        comp.forEach(k => tail.add(k));
    }
  }
  const out = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let c = grid[y][x];
    if (tail.has(x + "," + y)) continue;
    // 하와's hair lines (the bang edge, the parting) belong under the hood, not drawn across it: inner outline above the face
    // (no empty pixel around it, so not the silhouette) outside the opening becomes suit
    if (c === "K" && pal.bangs && face && y < face.cy && !ell(x, y, 0) && inner(x, y)) c = "S";
    if (c === "B" || c === "K" || (pal.keep && pal.keep.includes(c))) continue;
    if (ell(x, y, 0)) {
      if (pal.bangs && pal.bangs.includes(c)) out.push([x, y, pal.bang]);
      else if (gloom && c === "W") out.push([x, y, gloom]);
      continue;
    }
    const col = ell(x, y, 1.3) ? pal.rim : c === "M" ? pal.shade : pal.main;
    out.push([x, y, GLOOM[c] ? dim(col, GLOOM[c]) : col]);              // 치카's gloomy shadow falls on the suit as well
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

// 하와's Lv2 look: her bangs restyled, not a hat. Her blue hair comes down to just above her eyes in one straight edge,
// with a little notch rising to a point in the middle (like the anime), over her own sprite on every frame where she faces us
const BANGS = { sora: "#7ca8c7" };   // her own hair colour
function autoBangs(grid, pet) {
  const col = BANGS[pet], f = faceOf(grid);
  if (!col || !f || f.rx <= 7 || grid[0].length > 60) return [];                    // facing us (two eyes) only
  const h = grid.length, w = grid[0].length, at = (x, y) => (grid[y] && grid[y][x]) || "B", out = [];
  const edge = (x, y) => at(x - 1, y) === "B" || at(x + 1, y) === "B" || at(x, y - 1) === "B" || at(x, y + 1) === "B";
  let y0 = 0; while (y0 < h && !/S/.test(grid[y0])) y0++;                            // where her hair starts
  // the new hairline, just above her eyes; with her eyes shut the face is found from her cheeks and can sit low,
  // so it never comes down past a few rows above her cheeks
  let pTop = -1; for (let y = y0; y < h && pTop < 0; y++) if (grid[y].includes("P")) pTop = y;
  // and when her eyes show, two rows clear above them (her big eyes on the hop come up higher)
  const eyes = findEyes(grid), eTop = eyes.length ? Math.min(...eyes.map(e => e.y0)) : h;
  const hy = Math.min(Math.round(f.cy - 7), pTop < 0 ? h : pTop - 5, eTop - 3), cx = Math.floor(f.cx - 0.5);
  for (let y = y0; y <= hy + 1; y++) for (let x = 0; x < w; x++) {
    const c = at(x, y); if (c === "B" || (c === "K" && edge(x, y))) continue;        // her outline stays
    const mid = x === cx || x === cx + 1;
    const line = y === hy + 1 - (mid ? 1 : 0);                                       // the edge, notched up to a point in the middle
    const hair = y <= hy - (mid ? 1 : 0);
    if (hair) out.push([x, y, col]); else if (line) out.push([x, y, "#3a2a1a"]);
  }
  return out;
}

const ITEM_AUTO = { tears: autoTears, teddy: autoTeddy, pajama: autoPajama, bangs: autoBangs };

// the pixels of an auto item on one frame, with the studio's correction for that frame applied
function autoItemPixels(item, grid, key, pet) {
  const fix = (typeof ITEM_FIX !== "undefined" && ITEM_FIX[item] && ITEM_FIX[item][key]) || null;
  if (fix && fix.hide) return [];
  const px = ITEM_AUTO[item](grid, pet || key.split("-")[0]);    // the key starts with the pet ("mochi-wave:3"); frames without a key pass it
  return fix ? px.map(([x, y, c]) => [x + (fix.dx || 0), y + (fix.dy || 0), c]) : px;
}
