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
function fork(p, main, light, flat = false) {
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
    if (!flat) for (const hx2 of [7, 22]) d.grid(HAND, { K: OUT, W: "#fffaf0" }, hx2 - 1, at(hx2) - 1);   // where her own hands are
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

const ITEM_ART = {
  mochi: {
    tears: { layer: "front", auto: "tears", build: () => pixmap(d => {          // build = the inventory icon; in play it is placed per frame
      const e = ANCHOR.mochi.eye + 4;
      for (const x of [10, 17]) { d.rect(x, e, 1, 3, "#8fd0f6"); d.put(x, e + 3, "#bfe5fb"); }
    }, false) },
    teddy: { layer: "front", auto: "teddy", build: () => pixmap(d => d.grid(TEDDY, TEDDY_PAL, 0, 0), false) },
    pajama: { layer: "front", auto: "pajama", under: true, build: () => onesieIcon("mochi") },
    bag: { layer: "front", build: () => pixmap(d => {
      d.line(6, 18, 18, 24, "#a8714a");
      d.rect(17, 23, 7, 5, "#ffc4a8"); d.rect(17, 23, 7, 2, "#f29b8a"); d.put(20, 25, "#fff4dc");
    }) },
    fork: { layer: "front", auto: "weapon", build: () => fork("mochi", "#f59ab6", "#ffd0de") },
  },
  sora: {
    beanie: { layer: "front", build: () => headHat("sora", "#9fd3f5", "#d6eefc") },
    guitar: { layer: "back", build: () => pixmap(d => {
      d.line(6, 20, 29, -1, "#8a5a35", 2);
      d.rect(28, -4, 3, 4, "#6e4528"); d.put(27, -3, "#e8d9c0"); d.put(31, -2, "#e8d9c0");
      d.disc(3, 25, 5.2, "#d29a62"); d.disc(6, 19, 4, "#d29a62"); d.disc(4.5, 22, 1.4, "#5a3a22");
    }) },
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
// still holds it, so it shows behind her with both long ends sticking out; lying down or asleep she leaves it on the
// grass beside her; on 치카's sky-landing it goes up and down with her arms; and it swings gently as she walks, dances
// or waves.
const WEAPON_OF = { mochi: "fork", sora: "trident", nori: "pencil" };
const WEAPON_FLAT = { mochi: () => fork("mochi", "#f59ab6", "#ffd0de", true), sora: () => fork("sora", "#4f9fe0", "#a9d6f7", true), nori: () => staff("nori", true) };
const WEAPON_MID = { mochi: 10, sora: 10, nori: 14 };                       // the middle of the handle, where it turns
function weaponFlat(pet) { const k = "flat:" + pet; return ITEM_CACHE[k] || (ITEM_CACHE[k] = WEAPON_FLAT[pet]()); }
function weaponPixels(pet) {
  const k = "px:" + pet; if (ITEM_CACHE[k]) return ITEM_CACHE[k];
  const it = itemImg(pet, WEAPON_OF[pet]), g = it.img.getContext("2d"), d = g.getImageData(0, 0, it.img.width, it.img.height).data, out = [];
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
function weaponMode(img) {
  const act = typeof pet !== "undefined" ? pet.act : "idle";
  if ((typeof G !== "undefined" && G.sleeping) || ["lieDown", "lie", "getUp", "loaf"].includes(act)) return "ground";
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
function drawWeapon(g, petId, layer, dy, pose, img) {
  const base = !pose || !pose.img, grid = base ? SPRITES[petId] : img.grid, shift = base ? dy : 0;
  const w = grid[0].length, h = grid.length, arm = ANCHOR[petId].arm, mode = weaponMode(img), mid = WEAPON_MID[petId];
  const cache = base ? (ITEM_CACHE["base:" + petId] || (ITEM_CACHE["base:" + petId] = {})) : (img._auto || (img._auto = {}));
  if (!("wo" in cache)) cache.wo = weaponOffset(grid, petId);
  const o = cache.wo;
  if (mode === "ground") {                                   // laid on the grass beside her, behind her
    if (layer !== "back") return;
    const f = weaponFlat(petId);
    g.drawImage(f.img, f.x + w - 2, f.y + h - 3 - arm + shift);   // the handle on the ground line, just past her side
    return;
  }
  if (mode === "lift") {                                     // arms going up and down: from across her belly to over her head
    if (layer !== "front") return;
    const q = LIFT[+/(\d+)$/.exec(img.key)[1]], f = weaponFlat(petId), top = grid.findIndex(r => /[^B]/.test(r));
    const hx = mid + (o ? o.dx : 0), hy = arm + 0.5 + (o ? o.dy : 0);
    const cx = hx + (w / 2 - hx) * q, cy = hy + (top + 1 - hy) * q;
    g.save(); g.translate(Math.round(cx), Math.round(cy) + shift); g.rotate(DIAG[petId] * (1 - q));
    g.drawImage(f.img, f.x - mid, f.y - arm);
    g.restore();
    return;
  }
  // in her hands: in front, or behind her (both long ends showing) while she faces away; swinging with what she does
  if (layer !== (o ? "front" : "back")) return;
  const it = itemImg(petId, WEAPON_OF[petId]), sway = weaponSway();
  const ox = o ? o.dx : Math.round(w / 2 - 14), oy = (o ? o.dy : h - INFO[petId].h) + shift;
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
    if (equip[id] && a && a.auto === "weapon") { if (img && img.grid) drawWeapon(g, petId, layer, dy, pose, img); continue; }
    if (!equip[id] || !a || a.layer !== layer) continue;
    if (a.auto) {
      if (!img || !img.grid) continue;
      if (a.auto === "teddy" && typeof teddyHugged === "function" && !teddyHugged()) continue;   // the bear is off in the world
      // on the base pose the face is found on the plain sprite, so a blink does not make the item vanish
      const base = !pose || !pose.img, grid = base ? SPRITES[petId] : img.grid, shift = base ? dy : 0;
      const cache = base ? (ITEM_CACHE["base:" + petId] || (ITEM_CACHE["base:" + petId] = {})) : (img._auto || (img._auto = {}));
      const px = cache[a.auto] || (cache[a.auto] = autoItemPixels(a.auto, grid, base ? petId + "-base:0" : img.key || ""));
      for (const [x, y, c] of px) { g.fillStyle = c; g.fillRect(x, y + shift, 1, 1); }
      continue;
    }
    if (pose && pose.img) continue;
    const it = itemImg(petId, id);
    g.drawImage(it.img, it.x, it.y + dy);
  }
}
