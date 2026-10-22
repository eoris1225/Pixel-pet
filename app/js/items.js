/* Level-up items: pixel art drawn on top of (or behind) the base sprite. The sprites themselves are never changed.
   Coordinates are in the base sprite's own pixels (top-left = 0,0); see the anchors below. */
"use strict";

// rows of the base sprites: head top line, top row of the eyes, the arms (hands at cols 4-6 and 22-24)
const ANCHOR = { mochi: { top: 2, eye: 9, arm: 20 }, sora: { top: 2, eye: 10, arm: 20 }, nori: { top: 10, eye: 17, arm: 28 } };

/* a tiny pixel builder: shapes go into a map of points, then an outline is added around them (like the sprites) */
function pixmap(build, outline = true) {
  const pts = new Map();
  const put = (x, y, c) => pts.set(Math.round(x) + "," + Math.round(y), c);
  const api = {
    put,
    rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, c); },
    line(x0, y0, x1, y1, c, w = 1) {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
      for (let k = 0; k <= n; k++) { const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n; for (let i = 0; i < w; i++) put(x + i, y, c); }
    },
    disc(cx, cy, r, c) { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) put(x, y, c); },
    grid(rows, pal, ox, oy) { rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) put(ox + x, oy + y, pal[ch]); })); },
  };
  build(api);
  if (outline) {
    const add = [];
    for (const k of pts.keys()) {
      const [x, y] = k.split(",").map(Number);
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const n = (x + dx) + "," + (y + dy); if (!pts.has(n)) add.push(n); }
    }
    add.forEach(n => pts.set(n, OUT));
  }
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const k of pts.keys()) { const [x, y] = k.split(",").map(Number); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const c = document.createElement("canvas"); c.width = x1 - x0 + 1; c.height = y1 - y0 + 1;
  const g = c.getContext("2d");
  for (const [k, col] of pts) { const [x, y] = k.split(",").map(Number); g.fillStyle = col; g.fillRect(x - x0, y - y0, 1, 1); }
  return { img: c, x: x0, y: y0 };
}

// the inventory picture of the pajamas: the character in her onesie
function onesieIcon(p) {
  const g = SPRITES[p], px = autoPajama(g, p), over = new Map(px.map(([x, y, c]) => [x + "," + y, c]));
  return pixmap(d => g.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === "B") return;
    d.put(x, y, over.get(x + "," + y) || PET[p].pal[ch]);
  })), false);
}
// the inventory picture of 하와's new bangs: her face with them on
function bangsIcon(p) {
  const g = SPRITES[p], over = new Map(autoBangs(g, p).map(([x, y, c]) => [x + "," + y, c]));
  return pixmap(d => g.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === "B" || y > ANCHOR[p].eye + 6) return;
    d.put(x, y, over.get(x + "," + y) || PET[p].pal[ch]);
  })), false);
}
// a beanie that takes the shape of the head (copied from the silhouette of the sprite, never drawn into it)
function headHat(p, main, rib) {
  const g = SPRITES[p], a = ANCHOR[p], bottom = a.eye - 3;
  return pixmap(d => {
    for (let y = 0; y <= bottom; y++) for (let x = 0; x < g[y].length; x++) {
      if (g[y][x] === "B") continue;
      const edge = g[y][x] === "K" && (x === 0 || g[y][x - 1] === "B" || g[y][x + 1] === "B" || y === 0 || g[y - 1][x] === "B");
      d.put(x, y, edge ? OUT : y >= bottom - 1 ? rib : main);
    }
    for (let x = 0; x < g[bottom].length; x++) if (g[bottom][x] !== "B") d.put(x, bottom + 1, OUT);
  }, false);
}
// Lv10 weapons, held in both hands across the belly like the plush toys and the anime.
// 치카 and 하와: a long-handled two-pronged fork (a weeding fork). The prongs spread from the handle, run forward and
// flick outward at the tips, packed with little white thorns along both their outer and inner edges. It is held slanting up
// towards the way she faces, her two little hands on the handle.
const PRONG = [[0, 0], [1, -1], [2, -2], [3, -3], [4, -4], [5, -4], [6, -5], [7, -5], [8, -5], [9, -5], [10, -5], [11, -6], [12, -7]];
const HAND = [".KK.", "KWWK", ".KK."];                   // a little paw over the handle
function fork(p, main, light, flat = false, paw = "#fffaf0") {
  const y = ANCHOR[p].arm, x0 = -6, x1 = 26, y0 = flat ? y : y + 4, y1 = flat ? y : y - 3;
  const at = x => Math.round(y0 + (x - x0) * (y1 - y0) / (x1 - x0));
  return pixmap(d => {
    const body = new Map(), put = (x, y, c) => body.set(x + "," + y, c);
    for (let x = x0; x <= x1; x++) {                                     // the handle, lit along its top, with a white grip at the end
      const grip = x <= 5;                                               // white from the end up to her lower hand
      put(x, at(x), grip ? "#ffffff" : light); put(x, at(x) + 1, grip ? "#e4ded2" : main);
    }
    const hx = x1 + 1, hy = y1;
    put(hx, hy, main); put(hx, hy + 1, main);
    const thorns = [];
    for (const s of [-1, 1]) PRONG.forEach(([px, py], i) => {          // s = -1: the upper prong, 1: the lower (mirrored)
      const yy = hy + (s < 0 ? py : 1 - py);
      put(hx + px, yy, main); put(hx + px, yy + s, light);              // two thick, lit on the outside
      if (i >= 2 && i % 2 === 0) thorns.push([hx + px, yy + 2 * s]);    // white thorns packed along the outer edge
      if (i >= 5 && i % 2 === 1) thorns.push([hx + px, yy - s]);        // and the inner one
    });
    for (const [x, y] of thorns) if (!body.has(x + "," + y)) put(x, y, "#ffffff");
    for (const [k, c] of body) { const [x, y] = k.split(",").map(Number); d.put(x, y, c); }
    for (const k of body.keys()) {                                       // outline round it all
      const [x, y] = k.split(",").map(Number);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!body.has((x + dx) + "," + (y + dy))) d.put(x + dx, y + dy, OUT);
    }
    if (!flat) for (const hx2 of [7, 22]) d.grid(HAND, { K: OUT, W: paw }, hx2 - 1, at(hx2) - 1);   // where her own hands are
  }, false);
}

// 욱: a long yellow staff with white caps at both ends, tilted a little, with the rabbit she doodled on it (a dark speck)
function staff(p, flat = false) {
  const y = ANCHOR[p].arm + 1, x0 = -8, x1 = 36, rise = flat ? 0 : 6;
  return pixmap(d => {
    for (let x = x0; x <= x1; x++) {
      const yy = y + Math.round(rise / 2 - (x - x0) * rise / (x1 - x0)), cap = x - x0 < 4 || x1 - x < 4;
      d.put(x, yy, cap ? "#ffffff" : "#fff1b8");
      d.put(x, yy + 1, cap ? "#f4efe4" : "#ffd25e");
      d.put(x, yy + 2, cap ? "#d9d2c4" : "#e8a93a");
    }
    const dx = x0 + 9, dy = y + Math.round(rise / 2 - 9 * rise / (x1 - x0)) + 1;
    d.put(dx, dy, "#5a4636"); d.put(dx + 1, dy, "#9a7a3e");                 // the doodle
  });
}

const POCHETTE = [
  ".PP...PP.",
  "PPPPPPPPP",
  "PPDPPPDPP",
  "PPPWWWPPP",
  "PPWWDWWPP",
  ".pPWWWPp.",
  "..ppppp..",
];
const bagStrap = d => d.line(4, 17, 17, 21, "#fff7ea");                  // the strap, from her shoulder to her hip
const bagFace = d => d.grid(POCHETTE, { P: "#f7a8bd", p: "#ec8fab", W: "#fffaf0", D: "#5a4636" }, 16, 20);
// 하와's guitar, drawn level like the teddy (its outline taken from the anime, 26 px long at her size): a round lower bout, a smaller upper bout,
// a dark sound hole with the strings over it, the bridge, a short neck and a headstock with pegs
const GUITAR = [
  "....KKKK..................",
  "..KKTTTTKK................",
  ".KTTTTTTTTK.KKKK..........",
  ".KTTTTTTTTTKTTTTKK...KKKKK",
  "KTTTTTTHHTTTTTTTTTKKKKNNNK",
  "KTRSSSHHHHSSSSSSSSFFFNDDNK",
  "KTRTTTHHHHTTTTTTTTFFFNDDNK",
  "KTRSSSHHHHSSSSSSSSFFFNDDNK",
  "KTTTTTTHHTTTTTTTTTKKKKNNNK",
  ".KLTTTTTTTTKTTTTKK...KKKKK",
  ".KLLTTTTTTK.KKKK..........",
  "..KKLLTTKK................",
  "....KKKK..................",
];
const GUITAR_PAL = { K: OUT, T: "#d9a15e", L: "#eaba7a", H: "#4a2e1c", R: "#7a4a2a", S: "#b07640", F: "#6e4228", N: "#be7d46", D: "#6e4228" };
const STRUM_FEET = ["KWKWK", "KWKWK", ".K.K."];          // her two thin legs hanging down; the guitar hides their tops
const GUITAR_BACK = { deg: -40, x: 12, foot: 28 };       // slung on her back: turned up to her right shoulder, no lower than her feet
/* the guitar just turned, the way pixel art is rotated (RotSprite): the level drawing is blown up 8x with Scale2x, which
   rounds its stair-steps into smooth lines, turned, and each pixel then takes the colour at its own middle. Kept per angle */
function scale2x(src) {
  const h = src.length, w = src[0].length, out = Array.from({ length: h * 2 }, () => Array(w * 2).fill(null));
  const at = (x, y) => (src[y] && x >= 0 && x < w ? src[y][x] : null);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const P = src[y][x], A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
    out[2 * y][2 * x] = C === A && C !== D && A !== B ? A : P;
    out[2 * y][2 * x + 1] = A === B && A !== C && B !== D ? B : P;
    out[2 * y + 1][2 * x] = D === C && D !== B && C !== A ? C : P;
    out[2 * y + 1][2 * x + 1] = B === D && B !== A && D !== C ? D : P;
  }
  return out;
}
const GUITAR_BIG = (() => { let g = GUITAR.map(r => [...r].map(ch => GUITAR_PAL[ch] || null)); for (let i = 0; i < 3; i++) g = scale2x(g); return g; })();
const GUITAR_TURNED = {};
function guitarTurned(deg) {
  if (GUITAR_TURNED[deg]) return GUITAR_TURNED[deg];
  const h = GUITAR.length, w = GUITAR[0].length, D = Math.ceil(Math.hypot(w, h)) + 2;
  const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  const cv = document.createElement("canvas"); cv.width = D; cv.height = D;
  const g = cv.getContext("2d");
  for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
    const X = x + 0.5 - D / 2, Y = y + 0.5 - D / 2;
    const u = Math.floor((c * X + s * Y + w / 2) * 8), v = Math.floor((-s * X + c * Y + h / 2) * 8);
    const col = GUITAR_BIG[v] && GUITAR_BIG[v][u];
    if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
  }
  return (GUITAR_TURNED[deg] = cv);
}
/* for a play frame, worked out once against where the guitar lies on it:
   patch - her own inner lines right beside the guitar, painted over in her colour so its edge isn't doubled
   arm   - her arm over the guitar (from the clip), and edge - its outline, only where it lies on the guitar */
function strumClean(img) {
  if (img._clean) return img._clean;
  const p = img.play, gc = guitarTurned(p.ga), gx = Math.round(p.x - gc.width / 2), gy = Math.round(p.y - gc.height / 2);
  const d = gc.getContext("2d").getImageData(0, 0, gc.width, gc.height).data;
  const on = (x, y) => { const u = x - gx, v = y - gy; return u >= 0 && v >= 0 && u < gc.width && v < gc.height && d[(v * gc.width + u) * 4 + 3] > 0; };
  const grid = img.grid, at = (x, y) => (grid[y] && grid[y][x]) || "B", N4 = [[1,0],[-1,0],[0,1],[0,-1]];
  const patch = [], arm = [], edge = [];
  // she and the guitar together make one shape: next to the guitar, her lines that aren't on its outside edge (and any
  // gap left between her and it) become her colour
  const inShape = (x, y) => at(x, y) !== "B" || on(x, y);
  for (let y = 0; y < grid.length; y++) for (let x = 0; x < grid[0].length; x++) {
    const c = at(x, y);
    if (c === "W" || c === "S" || c === "P" || on(x, y) || !N4.every(([i, j]) => inShape(x + i, y + j))) continue;
    let near = false; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (on(x + i, y + j)) near = true;
    if (near) patch.push([x, y]);
  }
  const A = new Set();
  p.arms.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === "W") { A.add(x + "," + y); arm.push([x, y]); } }));
  const E = new Set();
  for (const [x, y] of arm) for (const [i, j] of N4) { const k = (x + i) + "," + (y + j); if (!A.has(k) && !E.has(k) && on(x + i, y + j)) { E.add(k); edge.push([x + i, y + j]); } }
  return (img._clean = { patch, arm, edge });
}
// how far below its middle the turned guitar reaches
function guitarDrop(deg) {
  const c = guitarTurned(deg); if ("_drop" in c) return c._drop;
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let b = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i]) b = Math.floor((i >> 2) / c.width);
  return (c._drop = b - Math.round(c.height / 2) + 0.5);
}
function drawGuitar(g, x, y, deg) { const c = guitarTurned(deg); g.drawImage(c, Math.round(x - c.width / 2), Math.round(y - c.height / 2)); }
function guitarArt() { return pixmap(d => d.grid(GUITAR, GUITAR_PAL, 0, 8), false); }
const ITEM_ART = {
  mochi: {
    tears: { layer: "front", auto: "tears", build: () => pixmap(d => {          // build = the inventory icon; in play it is placed per frame
      const e = ANCHOR.mochi.eye + 4;
      for (const x of [10, 17]) { d.rect(x, e, 1, 3, "#8fd0f6"); d.put(x, e + 3, "#bfe5fb"); }
    }, false) },
    teddy: { layer: "front", auto: "teddy", build: () => pixmap(d => d.grid(TEDDY, TEDDY_PAL, 0, 0), false) },
    pajama: { layer: "front", auto: "pajama", under: true, build: () => onesieIcon("mochi") },
    // 치카's pochette: a round pink bear face (little ears, white muzzle) on a long thin cream strap, worn across her body
    bag: { layer: "front", auto: "carry", build: () => pixmap(d => { bagStrap(d); bagFace(d); }) },
    fork: { layer: "front", auto: "weapon", build: () => fork("mochi", "#f59ab6", "#ffd0de") },
  },
  sora: {
    beanie: { layer: "front", auto: "bangs", build: () => bangsIcon("sora") },   // her bangs restyled (item id kept for saves)
    guitar: { layer: "back", auto: "guitar", build: () => guitarArt() },
    pajama: { layer: "front", auto: "pajama", under: true, build: () => onesieIcon("sora") },
    camera: { layer: "front", build: () => pixmap(d => {
      d.line(7, 17, 11, 21, "#6cb8e6"); d.line(21, 17, 17, 21, "#6cb8e6");
      d.rect(10, 21, 9, 6, "#f4f1ea"); d.rect(10, 21, 9, 1, "#4a4f6e"); d.rect(11, 20, 3, 1, "#4a4f6e");
      d.disc(14.5, 24, 1.9, "#4a4f6e"); d.put(14, 23, "#a6d6f2"); d.put(17, 22, "#ffd84d");
    }) },
    trident: { layer: "front", auto: "weapon", build: () => fork("sora", "#4f9fe0", "#a9d6f7") },
  },
  nori: {
    shades: { layer: "front", build: () => pixmap(d => {
      const e = ANCHOR.nori.eye - 1;
      d.grid([
        "KKKKKK..KKKKKK",
        "KGGgGKKKKGGgGK",
        "KGGGGK..KGGGGK",
        ".KGGK....KGGK.",
      ], { K: OUT, G: "#3d3f5c", g: "#9aa0c8" }, 7, e);
      for (let x = 8; x <= 20; x++) d.put(x, 26 + Math.round(2.6 * (1 - ((x - 14) / 6.5) ** 2)), "#e0a93a");
      d.grid([".P.P.", "PPPPP", ".PPP.", "..P.."], { P: "#ff9db4" }, 12, 29);
    }, false) },
    pass: { layer: "front", build: () => pixmap(d => {
      d.rect(9, 11, 11, 6, "#fffdf5");
      d.rect(11, 12, 7, 1, "#9b8e7a"); d.rect(11, 14, 5, 1, "#c9bea8");
      d.rect(16, 14, 2, 2, "#e2504a"); d.put(13, 10, "#7cc46b"); d.put(14, 10, "#7cc46b"); d.put(15, 10, "#7cc46b");
    }) },
    pajama: { layer: "front", auto: "pajama", under: true, build: () => onesieIcon("nori") },
    pudding: { layer: "front", build: () => pixmap(d => {          // in her other hand
      const y = ANCHOR.nori.arm;
      d.rect(-2, y + 2, 9, 1, "#ffffff");
      d.rect(-1, y - 2, 7, 4, "#ffe08a"); d.rect(0, y - 3, 5, 1, "#ffe08a");
      d.rect(0, y - 4, 5, 2, "#a8642e"); d.put(1, y - 4, "#d48a4a");
    }) },
    pencil: { layer: "front", auto: "weapon", build: () => staff("nori") },
  },
};
const ITEM_CACHE = {};
function itemImg(pet, id) {
  const k = pet + ":" + id;
  return ITEM_CACHE[k] || (ITEM_CACHE[k] = ITEM_ART[pet][id].build());
}
// Lv10 weapons are their own thing, like 치카's bear: held across her belly they move with her face; turned away she
// still holds it, so it shows behind her with both long ends sticking out; lying down or asleep she lays it on the
// grass beside her, where it stays (pet.js); on 치카's sky-landing it goes up and down with her arms; and it swings gently as she walks, dances
// or waves.
const WEAPON_OF = { mochi: "fork", sora: "trident", nori: "pencil" };
const WEAPON_FLAT = { mochi: () => fork("mochi", "#f59ab6", "#ffd0de", true), sora: () => fork("sora", "#4f9fe0", "#a9d6f7", true), nori: () => staff("nori", true) };
// in her onesie the paws on the handle are the onesie's colour
const WEAPON_PJ = { mochi: () => fork("mochi", "#f59ab6", "#ffd0de", false, PAJAMA.mochi.main), sora: () => fork("sora", "#4f9fe0", "#a9d6f7", false, PAJAMA.sora.main) };
const WEAPON_MID = { mochi: 10, sora: 10, nori: 14 };                       // the middle of the handle, where it turns
function weaponFlat(pet) { const k = "flat:" + pet; return ITEM_CACHE[k] || (ITEM_CACHE[k] = WEAPON_FLAT[pet]()); }
function weaponPixels(pet, id = WEAPON_OF[pet]) {
  const k = "px:" + pet + ":" + id; if (ITEM_CACHE[k]) return ITEM_CACHE[k];
  const it = itemImg(pet, id), g = it.img.getContext("2d"), d = g.getImageData(0, 0, it.img.width, it.img.height).data, out = [];
  for (let y = 0; y < it.img.height; y++) for (let x = 0; x < it.img.width; x++) {
    const i = (y * it.img.width + x) * 4; if (d[i + 3] < 128) continue;
    out.push([it.x + x, it.y + y, "#" + [d[i], d[i + 1], d[i + 2]].map(v => v.toString(16).padStart(2, "0")).join("")]);
  }
  return (ITEM_CACHE[k] = out);
}
// where her hands are on this frame, as an offset from the base pose: from her face, kept inside her arms when the
// face sits low; null when she faces away
function weaponOffset(grid, pet) {
  const f = faceOf(grid), b = faceOf(SPRITES[pet]);
  if (!f || !b) return null;
  const dx = Math.round(f.cx - b.cx);
  let dy = Math.round(f.cy - b.cy), bottom = grid.length - 1;
  while (bottom > 0 && !/[^B]/.test(grid[bottom])) bottom--;
  const held = ANCHOR[pet].arm + dy;
  if (held > bottom - 3) dy -= held - (bottom - 3);
  return { dx, dy };
}
ITEM_AUTO.weapon = (grid, pet) => {
  if (!WEAPON_OF[pet] || grid[0].length > 60) return [];
  const o = weaponOffset(grid, pet);
  return o ? weaponPixels(pet).map(([x, y, c]) => [x + o.dx, y + o.dy, c]) : [];
};
// 치카's sky-landing: how far her arms are up on each frame of it (0 = the weapon across her belly, 1 = flat over her head),
// so the weapon rises and comes back down with her arms instead of jumping
const LIFT = { 10: 0.45, 11: 0.75, 12: 1, 13: 1, 14: 1, 15: 1, 16: 0.8, 17: 0.6, 18: 0.4, 19: 0.2 };
const DIAG = { mochi: Math.atan2(-7, 32), sora: Math.atan2(-7, 32), nori: Math.atan2(-6, 44) };   // the slant she holds it at
// things she wears on her body (치카's pochette) go with her the same way as what she holds, hidden when she faces away
// facing away she still wears it: the strap runs the other way across her back, and the bag hangs behind her hip,
// showing only where it sticks out past her body
function pixList(key, build) {
  if (ITEM_CACHE[key]) return ITEM_CACHE[key];
  const it = pixmap(build), d = it.img.getContext("2d").getImageData(0, 0, it.img.width, it.img.height).data, out = [];
  for (let y = 0; y < it.img.height; y++) for (let x = 0; x < it.img.width; x++) {
    const i = (y * it.img.width + x) * 4; if (d[i + 3] < 128) continue;
    out.push([it.x + x, it.y + y, "#" + [d[i], d[i + 1], d[i + 2]].map(v => v.toString(16).padStart(2, "0")).join("")]);
  }
  return (ITEM_CACHE[key] = out);
}
// the pouch seen side on (a profile): a slim pink oval with its little ear on top
const POCHETTE_SIDE = [
  ".p..",
  "pPP.",
  "PPPp",
  "PPPp",
  "PPPp",
  ".PPp",
  "..p.",
];
const bagSide = d => d.grid(POCHETTE_SIDE, { P: "#f7a8bd", p: "#ec8fab" }, 0, 0);
// one unbroken strap: a cream line with an outline, from her shoulder to the top of the pouch
const strapLine = (x0, y0, x1, y1) => pixList("strap:" + [x0, y0, x1, y1], d => d.line(x0, y0, x1, y1, "#fff7ea"));
ITEM_AUTO.carry = (grid, pet) => {
  if (grid[0].length > 60) return [];
  const at = (x, y) => (grid[y] && grid[y][x]) || "B";
  // her body on this frame: its sides on a row, its top and bottom
  const row = y => { const r = grid[y] || ""; const a = r.search(/[^B]/); return a < 0 ? null : [a, r.length - 1 - [...r].reverse().join("").search(/[^B]/)]; };
  let top = 0, bottom = grid.length - 1;
  while (top < bottom && !/[^B]/.test(grid[top])) top++;
  while (bottom > 0 && !/[^B]/.test(grid[bottom])) bottom--;
  const f = faceOf(grid), o = f && weaponOffset(grid, pet);
  // A cross-body strap is a loop: from the pouch it runs up across her to the far shoulder, over it, and down her back
  // to the pouch again. From any side we see one run of it, from the pouch to where it goes over her shoulder: that end
  // is on her outline, at the shoulder line just under her face (never across her face, never stopping mid-body).
  const sy = Math.round(f ? f.cy + 4 : top + (bottom - top) * 0.6);
  const sides = row(sy);
  if (!sides) return [];
  const front = f && f.rx > 7;                                  // two eyes: she faces us; one (or a cheek): a profile
  // bowed down on a landing, or flat on the ground after a tumble: her face sits low (or she is long and flat), so the
  // pouch has slid round to rest on the ground at her hip, and the strap comes to it from round her side
  const wide = sides && (() => { let a = 1e9, b = -1; for (let y = top; y <= bottom; y++) { const r = row(y); if (r) { a = Math.min(a, r[0]); b = Math.max(b, r[1]); } } return b - a + 1; })();
  if (f && (f.cy > top + (bottom - top) * 0.55 || wide > (bottom - top + 1) * 1.3)) {
    const faceLeft = f.cx - 0.5 < (sides[0] + sides[1]) / 2 + 2;   // facing us or to the left: the pouch at her right
    let hip = sides;                                            // her widest point low down: where her hip is
    for (let y = bottom - 10; y <= bottom - 3; y++) { const r = row(y); if (r && r[1] - r[0] > hip[1] - hip[0]) hip = r; }
    const bx = faceLeft ? hip[1] - 6 : hip[0] - 2, by = bottom - 6;
    const bag = pixList("bagface", bagFace).map(([x, y, c]) => [x - 16 + bx, y - 20 + by, c]);
    const ty = Math.max(top + 2, by - 5), side = row(ty) || hip, tx = faceLeft ? side[1] : side[0];   // her outline on that side
    return strapLine(tx, ty, bx + 4, by + 1).concat(bag);
  }
  if (front && o) {                                              // across her front: her left shoulder to the pouch at her right hip
    const bag = pixList("bagface", bagFace).map(([x, y, c]) => [x + o.dx, y + o.dy, c]);
    return strapLine(sides[0], sy, 17 + o.dx, 20 + o.dy).concat(bag);
  }
  if (f) {
    // a profile. The pouch hangs at her left hip (our right when she faces us). Turned to our right we see that side:
    // it hangs at her front, side on, the strap from her back shoulder. Turned to our left that hip is on her far side:
    // it hangs behind her and peeks out past her back, still on our right, so it does not hop across on a turn
    const mid = (sides[0] + sides[1]) / 2, dir = f.cx - 0.5 >= mid ? 1 : -1;
    const hip = row(bottom - 4) || sides, bx = hip[1] - 2, by = bottom - 9;
    const bag = pixList("bagside", bagSide).map(([x, y, c]) => [x + bx, y + by, c]);
    if (dir > 0) return strapLine(sides[0], sy, bx + 1, by + 1).concat(bag);
    return bag.map(([x, y, c]) => [x + 2, y, c]).filter(([x, y]) => at(x, y) === "B");
  }
  // her back: from her right shoulder down across her back to the pouch peeking out past her left hip
  const hip = row(bottom - 6) || sides, bx = hip[0] - 3, by = bottom - 9;
  const bag = pixList("bagface", bagFace).map(([x, y, c]) => [x - 16 + bx, y - 20 + by, c]).filter(([x, y]) => at(x, y) === "B");
  return strapLine(sides[1], sy, bx + 4, by + 1).concat(bag);
};
function weaponMode(img) {
  const act = typeof pet !== "undefined" ? pet.act : "idle";
  if (typeof wprop !== "undefined" && wprop.state !== "held" && typeof G !== "undefined" && WEAPON_OF[G.pet]) return "away";   // set down in the world (pet.js)
  if (act === "strum") return "away";                       // both paws are on her guitar
  const m = /^mochi-hop:(\d+)$/.exec((img && img.key) || "");
  if (m && LIFT[+m[1]]) return "lift";
  return "held";
}
// a gentle swing that goes with what she is doing: a bob in step while walking, a sway while dancing or waving
function weaponSway() {
  if (typeof pet === "undefined") return 0;
  const t = performance.now() - pet.t0, deg = Math.PI / 180;
  switch (pet.act) {
    case "walk": return Math.sin(pet.walked / 3 * Math.PI / 2) * 4 * deg;
    case "dance": return Math.sin(t / 170) * 12 * deg;
    case "wave": return Math.sin(t / 140) * 8 * deg;
    case "pet": return Math.sin(t / 70) * 6 * deg * Math.max(0, 1 - t / 600);
    case "land": return Math.sin(t / 60) * 5 * deg * Math.max(0, 1 - t / 460);
    default: return 0;
  }
}
// her hands on a frame where they are drawn out from her body (하와's dance): on each side, the short run of rows where
// the outline juts out past the rows a few above and below it, between her face and her feet
// her little paws on the handle wherever she is gripping it (the fork only), in her own colour or her onesie's
function drawPaws(g, petId, equip, pts) {
  if (petId === "nori") return;
  const paw = equip.pajama && typeof PAJAMA !== "undefined" ? PAJAMA[petId].main : PET[petId].pal[PET[petId].body];
  for (const [x, y] of pts) HAND.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch === ".") return;
    g.fillStyle = ch === "K" ? OUT : paw; g.fillRect(Math.round(x) - 2 + i, Math.round(y) - 1 + j, 1, 1);
  }));
}
// what she holds eases from frame to frame instead of jumping with every redrawn frame of a motion: it moves a good
// part of the way toward where this frame puts it (no springs, no overshoot), and stays put on a frame that cannot tell
const WSM = { x: 0, y: 0, a: 0, t: 0, key: "" };
function smoothHold(key, x, y, a) {
  const now = performance.now(), fresh = WSM.key !== key || now - WSM.t > 300;
  if (fresh) { if (x === null) return null; Object.assign(WSM, { x, y, a, t: now, key }); return WSM; }
  if (x !== null) { const k = 1 - Math.exp(-(now - WSM.t) / 110); WSM.x += (x - WSM.x) * k; WSM.y += (y - WSM.y) * k; WSM.a += (a - WSM.a) * k; }
  WSM.t = now; return WSM;
}
function findHands(grid) {
  const h = grid.length, f = faceOf(grid), top = f ? Math.round(f.cy) : Math.round(h * 0.35), out = {};
  for (const side of [-1, 1]) {
    const edge = y => { const r = grid[y] || ""; const i = side < 0 ? r.search(/[^B]/) : r.length - 1 - [...r].reverse().join("").search(/[^B]/); return i < 0 || i >= r.length ? null : i; };
    let best = null;
    for (let y = top; y < h - 7; y++) {
      const e = edge(y), a = edge(y - 3), b = edge(y + 3); if (e === null || a === null || b === null) continue;
      const jut = side < 0 ? Math.min(a, b) - e : e - Math.max(a, b);   // how far this row sticks out
      if (jut >= 2 && (!best || jut > best.jut)) best = { jut, x: e - side, y };
    }
    if (best) out[side < 0 ? "l" : "r"] = [best.x, best.y];
  }
  return out;
}
function drawWeapon(g, petId, layer, dy, pose, img, equip = {}) {
  const base = !pose || !pose.img, grid = base ? SPRITES[petId] : img.grid;
  const w = grid[0].length, h = grid.length, arm = ANCHOR[petId].arm, mode = weaponMode(img), mid = WEAPON_MID[petId];
  // breathing (squash / stretch) adds or drops a row low on her body: what she holds above it bobs with her, the ground does not
  const shift = base && arm >= INFO[petId].dup ? dy : 0;
  const cache = base ? (ITEM_CACHE["base:" + petId] || (ITEM_CACHE["base:" + petId] = {})) : (img._auto || (img._auto = {}));
  if (!("wo" in cache)) cache.wo = weaponOffset(grid, petId);
  const o = cache.wo;
  if (mode === "away") return;                               // lying on the grass where she put it (drawn by pet.js)
  if (!base && typeof pet !== "undefined" && pet.act === "dance") {   // dancing: held across her belly, tipped to the beat
    if (layer !== "front") return;
    // it stays in her arms (moving with her body) and only its tilt follows her hands on each step of the dance: the
    // slant between her two hands, or tipped up toward the one hand she has out; kept small so it never flails
    const hd = cache.hands || (cache.hands = findHands(grid)), f = weaponFlat(petId);
    let ang = DIAG[petId];
    if (hd.l && hd.r) ang = Math.max(-0.35, Math.min(0.35, Math.atan2(hd.r[1] - hd.l[1], hd.r[0] - hd.l[0])));
    else if (hd.r) ang = -0.3; else if (hd.l) ang = 0.3;
    const sm = smoothHold("dance" + pet.t0 + petId, o ? mid + o.dx : null, o ? arm + 0.5 + o.dy : null, ang)
      || { x: mid, y: arm + 0.5, a: ang };
    const cx = sm.x, cy = sm.y; ang = sm.a;
    g.save(); g.translate(Math.round(cx), Math.round(cy)); g.rotate(ang);
    g.drawImage(f.img, f.x - mid, f.y - arm);
    g.restore();
    drawPaws(g, petId, equip, [-7, 8].map(d => [cx + Math.cos(ang) * d, cy + Math.sin(ang) * d]));
    return;
  }
  if (mode === "lift") {                                     // arms going up and down: from across her belly to over her head
    if (layer !== "front") return;
    const q = LIFT[+/(\d+)$/.exec(img.key)[1]], f = weaponFlat(petId), top = grid.findIndex(r => /[^B]/.test(r));
    const hx = mid + (o ? o.dx : 0), hy = arm + 0.5 + (o ? o.dy : 0);
    const cx = hx + (w / 2 - hx) * q, cy = hy + (top + 1 - hy) * q;
    const ang = DIAG[petId] * (1 - q);
    g.save(); g.translate(Math.round(cx), Math.round(cy) + shift); g.rotate(ang);
    g.drawImage(f.img, f.x - mid, f.y - arm);
    g.restore();
    drawPaws(g, petId, equip, [-8, 8].map(d => [cx + Math.cos(ang) * d, cy + shift + Math.sin(ang) * d]));   // both hands up on the handle
    return;
  }
  // in her hands: in front, or behind her (both long ends showing) while she faces away; swinging with what she does
  if (layer !== (o ? "front" : "back")) return;
  if (o && petId !== "nori") {                               // the fork is held in her own little paws: her side arms go
    const off = cache.warm || (cache.warm = armOff(grid, arm + o.dy - 3, arm + o.dy + 1));
    for (const [x, y, c] of off) { if (c === "clear") g.clearRect(x, y + shift, 1, 1); else { g.fillStyle = OUT; g.fillRect(x, y + shift, 1, 1); } }
  }
  const pj = equip.pajama && WEAPON_PJ[petId], sway = weaponSway();
  const it = pj ? (ITEM_CACHE["pj:" + petId] || (ITEM_CACHE["pj:" + petId] = pj())) : itemImg(petId, WEAPON_OF[petId]);
  let ox = o ? o.dx : Math.round(w / 2 - 14), oy = (o ? o.dy : h - INFO[petId].h) + shift;
  if (o && !base && typeof pet !== "undefined") {             // a traced motion: ease from frame to frame
    const sm = smoothHold(pet.act + pet.t0 + petId, o.dx, o.dy, 0);
    ox = Math.round(sm.x); oy = Math.round(sm.y) + shift;
  }
  if (!sway) { g.drawImage(it.img, it.x + ox, it.y + oy); return; }
  const cx = mid + ox, cy = arm + oy;
  g.save(); g.translate(cx, cy); g.rotate(sway); g.drawImage(it.img, it.x + ox - cx, it.y + oy - cy); g.restore();
}

// draws the equipped items of one layer, in the sprite's own pixels (the caller has set up the transform).
// Auto items are placed on this exact frame (cached on the frame); hand-placed ones only on base-sprite frames.
function drawItems(g, petId, equip, layer, dy, pose, img) {
  const art = ITEM_ART[petId];
  const order = ITEM_LIST[petId].slice().sort((p, q) => !!(art[q[1]] || {}).under - !!(art[p[1]] || {}).under);   // the onesie goes on first
  for (const [, id] of order) {
    const a = art[id];
    if (equip[id] && a && a.auto === "guitar") {           // slung on her back: behind her from the front, over her back from behind
      if (!img || !img.grid) continue;
      if (img.play) {                                     // playing it: where hers is on this frame, her legs under it, her arms on it
        if (layer === "front") {
          const p = img.play, paw = equip.pajama && typeof PAJAMA !== "undefined" ? PAJAMA[petId].main : PET[petId].pal[PET[petId].body];
          const put = (rows, x, y) => rows.forEach((row, j) => [...row].forEach((ch, k) => { if (ch !== ".") { g.fillStyle = ch === "K" ? OUT : paw; g.fillRect(x + k, y + j, 1, 1); } }));
          const k = strumClean(img);
          g.fillStyle = paw; for (const [x, y] of k.patch) g.fillRect(x, y, 1, 1);
          put(STRUM_FEET, p.fx + 1, p.fy);
          drawGuitar(g, p.x, p.y, p.ga);
          g.fillStyle = OUT; for (const [x, y] of k.edge) g.fillRect(x, y, 1, 1);
          g.fillStyle = paw; for (const [x, y] of k.arm) g.fillRect(x, y, 1, 1);
        }
        continue;
      }
      const base = !pose || !pose.img, grid = base ? SPRITES[petId] : img.grid, shift = base && 20 >= INFO[petId].dup ? dy : 0;
      const cache = base ? (ITEM_CACHE["base:" + petId] || (ITEM_CACHE["base:" + petId] = {})) : (img._auto || (img._auto = {}));
      if (!("wo" in cache)) cache.wo = weaponOffset(grid, petId);
      const o = cache.wo;
      if (o && layer === "back") drawGuitar(g, GUITAR_BACK.x + o.dx, GUITAR_BACK.foot - guitarDrop(GUITAR_BACK.deg) + o.dy + shift, GUITAR_BACK.deg);
      if (o && layer === "front") {                       // its strap across her chest, from her right shoulder to her left hip
        const row = y => { const r = grid[y] || ""; const q = r.search(/[^B]/); return q < 0 ? null : [q, r.length - 1 - [...r].reverse().join("").search(/[^B]/)]; };
        const f = faceOf(grid), sy = Math.round(f.cy + 4), hy = Math.round(f.cy + 10), a1 = row(sy), a2 = row(hy);
        if (a1 && a2) for (const [x, y, c] of pixList("gstrap:" + [a1[1], sy, a2[0], hy], d => d.line(a1[1], sy, a2[0], hy, "#9a6a3e"))) { g.fillStyle = c; g.fillRect(x, y + shift, 1, 1); }
      }
      if (!o && layer === "front") {                      // from behind it lies over her back, mirrored about her middle
        let x0 = 1e9, x1 = -1, bottom = grid.length - 1;
        grid.forEach(r => { const q = r.search(/[^B]/); if (q >= 0) { x0 = Math.min(x0, q); x1 = Math.max(x1, r.length - 1 - [...r].reverse().join("").search(/[^B]/)); } });
        while (bottom > 0 && !/[^B]/.test(grid[bottom])) bottom--;
        const cx = (x0 + x1) / 2, oy = bottom - (SPRITES[petId].length - 1);
        drawGuitar(g, Math.round(cx * 2) - (GUITAR_BACK.x + Math.round(cx - 14)), GUITAR_BACK.foot - guitarDrop(180 - GUITAR_BACK.deg) + oy, 180 - GUITAR_BACK.deg);
      }
      continue;
    }
    if (equip[id] && a && a.auto === "weapon") { if (img && img.grid) drawWeapon(g, petId, layer, dy, pose, img, equip); continue; }
    if (!equip[id] || !a || a.layer !== layer) continue;
    if (a.auto) {
      if (!img || !img.grid) continue;
      if (a.auto === "teddy" && typeof teddyHugged === "function" && !teddyHugged()) continue;   // the bear is off in the world
      // on the base pose the face is found on the plain sprite, so a blink does not make the item vanish
      const base = !pose || !pose.img, grid = base ? SPRITES[petId] : img.grid, shift = base ? dy : 0;
      const cache = base ? (ITEM_CACHE["base:" + petId] || (ITEM_CACHE["base:" + petId] = {})) : (img._auto || (img._auto = {}));
      let px = cache[a.auto] || (cache[a.auto] = autoItemPixels(a.auto, grid, base ? petId + "-base:0" : img.key || "", petId));
      if (a.auto === "bangs" && equip.pajama) {      // in her onesie the new bangs show only in the hood's opening, in its deeper blue
        const key = "bangsPJ";
        if (!cache[key]) {
          const pj = PAJAMA[petId], suit = cache.pajama || (cache.pajama = autoItemPixels("pajama", grid, base ? petId + "-base:0" : img.key || "", petId));
          const hood = new Set(suit.filter(p => p[2] !== pj.bang).map(p => p[0] + "," + p[1]));
          cache[key] = px.filter(p => !hood.has(p[0] + "," + p[1])).map(([x, y, c]) => [x, y, c === BANGS[petId] ? pj.bang : c]);
        }
        px = cache[key];
      }
      // breathing adds or drops a row low on her body: the pajama follows her pixel for pixel, while a solid thing (the bear
      // in her arms) moves as one piece with the part of her that holds it, so it never comes apart
      const dup = INFO[petId].dup, top = px.reduce((m, p) => Math.min(m, p[1]), 1e9), whole = top >= dup ? shift : 0;
      const each = a.auto === "pajama";
      const body = equip.pajama && typeof PAJAMA !== "undefined" ? PAJAMA[petId].main : PET[petId].pal[PET[petId].body];   // her paws: her own colour, or her onesie's
      // on the base pose the onesie is laid on the frame as it is drawn: ears flicked sideways, feet stepping, a row added
      // or dropped by breathing; a pixel lands only where this frame has her body
      const fg = base && each ? img.grid : null, ear = base && pose ? pose.ear || 0 : 0, tip = PET[petId].tip;
      const on = (x, y) => !fg || (fg[y] && fg[y][x] && !"BK".includes(fg[y][x]));
      // turning to walk the other way mirrors her picture, but not what she wears on one side: the pochette stays at
      // the same hip of hers, so on a mirrored base pose it is mirrored back
      const keepSide = a.auto === "carry" && base && g.getTransform().a < 0, fw = (SPRITES[petId][0] || "").length - 1;
      for (const [xs, y, c] of px) {
        const x0 = keepSide ? fw - xs : xs, x = x0 + (each && y < tip ? ear : 0);
        // a stretch doubles the row at dup: the onesie covers both copies
        if (each && y === dup && shift > 0 && c !== "clear" && on(x, y)) { g.fillStyle = c === "body" ? body : c === "outline" ? OUT : c; g.fillRect(x, y, 1, 1); }
        const yy = y + (each ? (y >= dup ? shift : 0) : whole);
        if (each && !on(x, yy)) continue;
        if (c === "clear") { g.clearRect(x, yy, 1, 1); continue; }   // her arm, now round the bear
        g.fillStyle = c === "body" ? body : c === "outline" ? OUT : c; g.fillRect(x, yy, 1, 1);
      }
      continue;
    }
    if (pose && pose.img) continue;
    const it = itemImg(petId, id);
    g.drawImage(it.img, it.x, it.y + (it.y >= INFO[petId].dup ? dy : 0));   // one piece, moving with where it is worn
  }
}
