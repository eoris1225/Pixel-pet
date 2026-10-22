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
function fork(p, main, light, flat = false, paw = PET[p].pal[PET[p].body]) {
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
// 욱's rabbit pole is rubber: it bends. bend = how far its two ends sit below a straight pole (minus: above), in pixels;
// paw = the colour of her two paws gripping it (none when it is flat on the grass or behind her back)
function staff(p, flat = false, bend = 0, paw = null, twist = 0) {
  const y = ANCHOR[p].arm + 1, x0 = -8, x1 = 36, rise = flat ? 0 : 6, mid = 14, half = 22;
  // twist: spun fast, its two ends trail behind the turn, one up and one down (an S)
  const at = x => y + Math.round(rise / 2 - (x - x0) * rise / (x1 - x0) + bend * ((x - mid) / half) ** 2 + twist * ((x - mid) / half) ** 3);
  return pixmap(d => {
    for (let x = x0; x <= x1; x++) {
      const yy = at(x), cap = x - x0 < 4 || x1 - x < 4;
      d.put(x, yy, cap ? "#ffffff" : "#fff1b8");
      d.put(x, yy + 1, cap ? "#f4efe4" : "#ffd25e");
      d.put(x, yy + 2, cap ? "#d9d2c4" : "#e8a93a");
    }
    const dx = x0 + 9, dy = at(dx) + 1;
    d.put(dx, dy, "#5a4636"); d.put(dx + 1, dy, "#9a7a3e");                 // the doodle
    if (paw) for (const hx of [7, 22]) d.grid(HAND, { K: OUT, W: paw }, hx - 1, at(hx));   // where her own hands are
  });
}
// the pole's rubber: its ends lag behind her as she moves and wobble back, around a slight sag
const RUBBER = { b: 1, v: 0, t: 0, y: null };
function rubberBend(holdY) {
  const now = performance.now(), dt = Math.min(0.05, (now - RUBBER.t) / 1000);
  if (now - RUBBER.t > 300 || RUBBER.y === null) Object.assign(RUBBER, { b: 1, v: 0, y: holdY });
  else {
    RUBBER.v += (RUBBER.y - holdY) * 9;                    // lifted: the ends are left behind and dip; dropped: they flick up
    const act = typeof pet !== "undefined" ? pet.act : "";
    // falling, the air bends its ends up and they flutter; landing, they slam down and boing back
    const rest = act === "fall" ? -2.5 + Math.sin(now / 55) * 1.2 : 1;
    if (act === "land" && RUBBER.act === "fall") RUBBER.v += 70;
    RUBBER.act = act;
    RUBBER.v += (-(RUBBER.b - rest) * 160 - RUBBER.v * 7) * dt;
    RUBBER.b = Math.max(-3, Math.min(4, RUBBER.b + RUBBER.v * dt));
    RUBBER.y = holdY;
  }
  RUBBER.t = now;
  return Math.round(RUBBER.b);
}
function rubberStaff(bend, paw, flat = false, twist = 0) {
  const k = "rub:" + bend + ":" + paw + ":" + flat + ":" + twist;
  return ITEM_CACHE[k] || (ITEM_CACHE[k] = staff("nori", flat, bend, paw, twist));
}
// spinning it round (during her spin and twirl, like a knight twirling a spear): it whirls round her paws, speeding up
// and slowing down to stop level again; spun fast its rubber ends trail in an S, and white swooshes follow them
function spinPole(g, equip, cx, cy, t, len, paws = true) {
  const q = Math.min(1, t / len), N = len > 1500 ? 3 : 2;   // whole turns, so it ends level as it began
  const th = 2 * Math.PI * N * (q - Math.sin(2 * Math.PI * q) / (2 * Math.PI)), speed = (1 - Math.cos(2 * Math.PI * q)) / 2;
  const f = rubberStaff(0, null, true, Math.round(speed * 3)), mid = 14, arm = ANCHOR.nori.arm + 1.5;
  // the circle it turns in leans back (seen at a slant, an ellipse), so its ends never dig into the grass
  const TILT = 0.5;
  g.save(); g.translate(Math.round(cx), Math.round(cy)); g.scale(1, TILT); g.rotate(th);
  g.drawImage(f.img, f.x - mid, f.y - arm);
  g.restore();
  if (speed > 0.25) {                                       // the swooshes: arcs of light behind both ends
    const span = 1.6 * speed;
    for (const end of [0, Math.PI]) for (let k = 1; k <= 16; k++) for (const R of [21, 18]) {
      const a = th + end - span * k / 16;
      g.globalAlpha = (1 - k / 16) * 0.85 * speed; g.fillStyle = "#ffffff";
      g.fillRect(Math.round(cx + Math.cos(a) * R), Math.round(cy + Math.sin(a) * R * TILT), 1, 1);
    }
    g.globalAlpha = 1;
  }
  if (paws) drawPaws(g, "nori", equip, [[cx, cy]]);
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
  ".KTTTTTTTTK.KKKK......P.P.",
  ".KTTTTTTTTTKTTTTKK...KKKKK",
  "KTTTTTTHHTTTTTTTTTKKKKNNNK",
  "KTRSSSHHHHSSSSSSSSFFFNDDNK",
  "KTRTTTHHHHTTTTTTTTFFFNDDNK",
  "KTRSSSHHHHSSSSSSSSFFFNDDNK",
  "KTTTTTTHHTTTTTTTTTKKKKNNNK",
  ".KLTTTTTTTTKTTTTKK...KKKKK",
  ".KLLTTTTTTK.KKKK......P.P.",
  "..KKLLTTKK................",
  "....KKKK..................",
];
const GUITAR_PAL = { K: OUT, T: "#d9a15e", L: "#eaba7a", H: "#4a2e1c", R: "#7a4a2a", S: "#b07640", F: "#6e4228", N: "#be7d46", D: "#6e4228", P: "#fbeed5" };   // P: the white tuning pegs
const STRUM_FEET = ["KWKWK", "KWKWK", ".K.K."];          // her two thin legs hanging down; the guitar hides their tops
const GUITAR_REST = -172;                                 // put down: lying on the grass, its head pointing away from her
const GUITAR_BACK = { deg: -20, x: 15, foot: 28 };       // slung on her back: its body out by her left foot, its head up past her right
                                                          // cheek, never lower than her feet
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
const bigGuitar = rows => { let g = rows.map(r => [...r].map(ch => GUITAR_PAL[ch] || null)); for (let i = 0; i < 3; i++) g = scale2x(g); return g; };
// lying on the grass it is seen from above at a slant: the same guitar, flattened to every other row or so
const GUITAR_FLAT = [0, 1, 3, 4, 5, 6, 7, 8, 9, 11, 12].map(i => GUITAR[i]);
const GUITAR_BIG = bigGuitar(GUITAR), GUITAR_FLAT_BIG = bigGuitar(GUITAR_FLAT);
const GUITAR_TURNED = {};
function guitarTurned(deg, flat = false) {
  deg = ((Math.round(deg) % 360) + 540) % 360 - 180;
  const key = deg + (flat ? "f" : "");
  if (GUITAR_TURNED[key]) return GUITAR_TURNED[key];
  const src = flat ? GUITAR_FLAT : GUITAR, big = flat ? GUITAR_FLAT_BIG : GUITAR_BIG;
  const h = src.length, w = src[0].length, D = Math.ceil(Math.hypot(w, h)) + 2;
  const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  const cv = document.createElement("canvas"); cv.width = D; cv.height = D;
  const g = cv.getContext("2d");
  for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
    const X = x + 0.5 - D / 2, Y = y + 0.5 - D / 2;
    const u = Math.floor((c * X + s * Y + w / 2) * 8), v = Math.floor((-s * X + c * Y + h / 2) * 8);
    const col = big[v] && big[v][u];
    if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
  }
  return (GUITAR_TURNED[key] = cv);
}
/* her lines right beside the guitar on a play frame, worked out once: painted over in her colour so its edge isn't
   doubled (she and the guitar make one shape; only its outside edge keeps a line) */
function strumClean(img) {
  if (img._clean) return img._clean;
  const p = img.play, gc = guitarTurned(p.ga), gx = Math.round(p.x - gc.width / 2), gy = Math.round(p.y - gc.height / 2);
  const d = gc.getContext("2d").getImageData(0, 0, gc.width, gc.height).data;
  const on = (x, y) => { const u = x - gx, v = y - gy; return u >= 0 && v >= 0 && u < gc.width && v < gc.height && d[(v * gc.width + u) * 4 + 3] > 0; };
  const grid = img.grid, at = (x, y) => (grid[y] && grid[y][x]) || "B", N4 = [[1,0],[-1,0],[0,1],[0,-1]];
  const inShape = (x, y) => at(x, y) !== "B" || on(x, y), patch = [];
  for (let y = 0; y < grid.length; y++) for (let x = 0; x < grid[0].length; x++) {
    const c = at(x, y);
    if (c === "W" || c === "S" || c === "P" || on(x, y) || !N4.every(([i, j]) => inShape(x + i, y + j))) continue;
    let near = false; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (on(x + i, y + j)) near = true;
    if (near) patch.push([x, y]);
  }
  return (img._clean = patch);
}
// her paws while she plays, along the guitar (from its middle: along the neck, across it; minus is up). Her right paw
// hangs over the top just past the sound hole and strums down and up across the strings; her left grips the neck and
// shifts along it now and then, like changing chords
const STRUM_PAW = [".KKK.", "KWWWK", "KWWWK", ".KKK."];
const FRET_PAW = [".KK.", "KWWK", "KWWK", ".KK."];
function strumPaws(t) {
  const swing = [-6, -5, -3.5, -2, -1, -1, -2, -3.5, -5, -6][Math.floor(t / 45) % 10];   // down across the strings and back up
  const chord = [7, 7, 8.5, 8.5, 10, 8.5][Math.floor(t / 650) % 6];
  return [[-4, swing, STRUM_PAW], [chord, -1.5, FRET_PAW]];
}
// the lowest row of the turned guitar, in its own canvas
function guitarBottom(deg, flat) {
  const c = guitarTurned(deg, flat); if ("_bot" in c) return c._bot;
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let b = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i]) b = Math.floor((i >> 2) / c.width);
  return (c._bot = b);
}
// how far below its middle the turned guitar reaches
function guitarDrop(deg) {
  const c = guitarTurned(deg); if ("_drop" in c) return c._drop;
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let b = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i]) b = Math.floor((i >> 2) / c.width);
  return (c._drop = b - Math.round(c.height / 2) + 0.5);
}
// the guitar on her back eases after where her frame puts it (so it never jumps with her outline from frame to frame),
// tips a few degrees with her sway (walking, dancing, waving), and when she turns round it swings across to her other
// side instead of jumping there. One state for front and back views, so the turn is eased too
const GSW = {};
function guitarSway(x, y, deg) {
  const now = performance.now(), st = GSW.s, sw = typeof weaponSway === "function" ? weaponSway() * 180 / Math.PI * 0.6 : 0;
  const tdeg = deg + (Math.cos(deg * Math.PI / 180) < 0 ? -sw : sw);
  if (!st || now - st.t > 300) GSW.s = { x, y, deg: tdeg, t: now };
  else {
    const k = 1 - Math.exp(-(now - st.t) / 120), d = ((tdeg - st.deg) % 360 + 540) % 360 - 180;   // the short way round
    st.x += (x - st.x) * k; st.y += (y - st.y) * k; st.deg += d * k; st.t = now;
  }
  return { x: Math.round(GSW.s.x), y: Math.round(GSW.s.y), deg: Math.round(GSW.s.deg) };
}
// the lowest row of her on a frame (her soles): what she carries never hangs below it
function soles(grid) { let y = grid.length - 1; while (y > 0 && !/[^B]/.test(grid[y])) y--; return y; }
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
    // big round-cornered dark brown sunglasses with a white glint, and a chunky twisted gold chain with a little gold rabbit head
    shades: { layer: "front", auto: "shades", build: () => pixmap(d => {   // the inventory picture; in play placed per frame (below)
      const e = ANCHOR.nori.eye - 1;
      d.grid([
        ".....KKKKK....KKKKK.....",
        "....KGWWGGKKKKGWWGGK....",
        "....KGGGGGK..KGGGGGK....",
        "....KGGGGGK..KGGGGGK....",
        "....KgggggK..KgggggK....",
        ".....KKKKK....KKKKK.....",
      ], { K: OUT, G: "#5b3324", g: "#7a4632", W: "#ffffff" }, 2, e);
      const sag = x => 26 + Math.round(1.6 * (1 - ((x - 13.5) / 9) ** 2));
      for (let x = 5; x <= 22; x++) {                    // the twist: light and dark links alternating
        const y = sag(x), a = x % 2;
        d.put(x, y - 1, OUT); d.put(x, y, a ? "#ffe680" : "#d39a22"); d.put(x, y + 1, OUT);
      }
      d.grid([".K.K.", "KYKYK", "KYYYK", "KdYdK", ".KKK."], { K: OUT, Y: "#ffd84a", d: "#8a5a1a" }, 11, sag(13) + 1);   // a little rabbit head hanging in the middle
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
// 욱's sunglasses and gold chain on every motion: a lens over each open eye (eyes shut: where her face has gone), the
// chain across her body below her face, only where her body is, with the little rabbit head hanging in the middle
const SHADES_LENS = [".KKKKK.", "KGWWGGK", "KGGGGGK", "KGGGGGK", "KgggggK", ".KKKKK."];
const SHADES_PAL = { K: OUT, G: "#5b3324", g: "#7a4632", W: "#ffffff" };
const RABBIT = [".K.K.", "KYKYK", "KYYYK", "KdYdK", ".KKK."], RABBIT_PAL = { K: OUT, Y: "#ffd84a", d: "#8a5a1a" };
ITEM_AUTO.shades = (grid, pet) => {
  const out = [], put = (rows, pal, x0, y0) => rows.forEach((r, j) => [...r].forEach((ch, i) => { if (pal[ch]) out.push([x0 + i, y0 + j, pal[ch]]); }));
  const f = faceOf(grid), b = faceOf(SPRITES[pet]);
  if (!f || !b) return out;                                    // facing away
  const dx = Math.round(f.cx - b.cx), dy = Math.round(f.cy - b.cy), eyes = findEyes(grid);
  const lenses = eyes.length === 2 ? [[Math.floor(eyes[0].cx) - 3, eyes[0].y0 - 1], [Math.ceil(eyes[1].cx) - 3, eyes[1].y0 - 1]]
    : eyes.length === 1 ? [[Math.round(eyes[0].cx - 3), eyes[0].y0 - 1]]
    : f.rx > 7 ? [[6 + dx, 16 + dy], [15 + dx, 16 + dy]] : [[Math.round(f.cx - 3.5), 16 + dy]];
  for (const [x, y] of lenses) put(SHADES_LENS, SHADES_PAL, x, y);
  if (lenses.length === 2) { const [l, r] = lenses, y = Math.min(l[1], r[1]) + 1; for (let x = l[0] + 7; x < r[0]; x++) out.push([x, y, OUT]); }   // the bridge
  const body = (x, y) => !!(grid[y] && grid[y][x] && grid[y][x] !== "B");
  const cx = 13.5 + dx, sag = x => 26 + dy + Math.round(1.6 * (1 - ((x - cx) / 9) ** 2));
  for (let x = Math.round(cx - 9); x <= Math.round(cx + 9); x++) {   // the twist: light and dark links alternating
    const y = sag(x); if (!body(x, y - 1) || !body(x, y + 1)) continue;
    out.push([x, y - 1, OUT], [x, y, x % 2 ? "#ffe680" : "#d39a22"], [x, y + 1, OUT]);
  }
  const m = Math.floor(cx); if (body(m, sag(m) + 3)) put(RABBIT, RABBIT_PAL, m - 2, sag(m) + 1);
  return out;
};
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
// a paw raised by her head, waving (욱's jump): the outermost pixel of her on her left, from her ears down to her eyes,
// when it sticks right out to the frame's edge
const NORI_JUMP = { t: 0 };
function waveHand(grid) {
  const f = faceOf(grid); if (!f) return null;
  const edge = y => (grid[y] || "").search(/[^B]/);
  for (let y = Math.max(0, Math.round(f.cy - 8)); y <= Math.round(f.cy - 1); y++) {
    const x = edge(y);                                       // right out at the edge, and jutting past her side below it
    if (x >= 0 && x <= 1 && edge(y + 3) >= x + 2) return [x + 1, y];
  }
  return null;
}
const screenY = g => (g.worldY || 0) + g.getTransform().f;   // her height on the screen, even drawn on her own canvas
const pawColour = (petId, equip) => equip.pajama && typeof PAJAMA !== "undefined" ? PAJAMA[petId].main : PET[petId].pal[PET[petId].body];
function drawPaws(g, petId, equip, pts) {
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
  if (petId === "nori" && typeof pet !== "undefined" && (pet.act === "spin" || pet.act === "twirl") && pose === pet._pose) {
    if (layer !== (o ? "front" : "back")) return;            // twirled round in front of her; behind her (hidden by her body) facing away
    const t = performance.now() - pet.t0, len = pet.act === "spin" ? SPIN_LEN : TWIRL_LEN;
    const cx = mid + (o ? o.dx : Math.round(w / 2 - 14)), cy = arm - 2 + (o ? o.dy : soles(grid) - soles(SPRITES.nori) - 4) + shift;
    spinPole(g, equip, cx, cy, t, len, !!o);
    return;
  }
  // 욱 holding her pole, on screen: one eased state for it whatever she is doing (held up, let go, landing, jumping,
  // walking), so it never jumps from one way of holding it to another
  if (petId === "nori" && typeof pet !== "undefined" && pose === pet._pose && o && pet.act !== "dance") {
    // 욱's jump: when she has a paw up by her head, waving, the pole goes up with it in that one paw, held near its end,
    // reaching up and out and swaying as she waves (and bending, being rubber); otherwise in both paws as usual. Where it
    // is, its tilt and where she grips it all ease from one to the other, so it never jumps
    if (layer !== "front") return;
    const hand = cache.wave !== undefined ? cache.wave : (cache.wave = waveHand(grid));
    // she never lets go with her left paw (it grips the pole 7 px in from its left end... its own x 7): to wave she lets go
    // with her right, lifts her left by her head and the pole comes up with it, swung round in that paw, the long end
    // reaching up and out; the paw leads and the pole swings after it
    const G7 = 7, flatA = Math.atan2(-6, 44);
    const tgt = hand ? { x: hand[0], y: hand[1], a: -2.3 + (hand[1] - 17) * 0.2 }
                     : { x: mid + o.dx + Math.cos(flatA) * (G7 - mid), y: arm + 1.5 + o.dy + Math.sin(flatA) * (G7 - mid), a: flatA + weaponSway() };
    const now = performance.now(), st = NORI_JUMP;
    if (now - st.t > 300) Object.assign(st, tgt);
    else {
      const kp = 1 - Math.exp(-(now - st.t) / 45), ka = 1 - Math.exp(-(now - st.t) / 95);
      st.x += (tgt.x - st.x) * kp; st.y += (tgt.y - st.y) * kp; st.a += (tgt.a - st.a) * ka;
    }
    st.t = now;
    const f = rubberStaff(rubberBend(screenY(g) + st.y), null, true), row = ANCHOR.nori.arm + 1.5;
    g.save(); g.translate(Math.round(st.x), Math.round(st.y) + shift); g.rotate(st.a);
    g.drawImage(f.img, f.x - G7, f.y - row);
    g.restore();
    // her paws: the left one always at its grip; the right one on it too while it is level in front of her
    const along = d => [st.x + Math.cos(st.a) * d, st.y + shift + Math.sin(st.a) * d];
    drawPaws(g, petId, equip, Math.abs(st.a - flatA) < 0.35 ? [along(0), along(15)] : [along(0)]);
    return;
  }
  if (!base && typeof pet !== "undefined" && pet.act === "dance") {   // dancing: held across her belly, tipped to the beat
    if (layer !== "front") return;
    // it stays in her arms (moving with her body) and only its tilt follows her hands on each step of the dance: the
    // slant between her two hands, or tipped up toward the one hand she has out; kept small so it never flails
    const hd = cache.hands || (cache.hands = findHands(grid)), f = petId === "nori" ? rubberStaff(rubberBend(screenY(g) + arm), null, true) : weaponFlat(petId);
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
    const q = LIFT[+/(\d+)$/.exec(img.key)[1]], f = petId === "nori" ? rubberStaff(rubberBend(screenY(g) + arm), null, true) : weaponFlat(petId), top = grid.findIndex(r => /[^B]/.test(r));
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
  if (o) {                                                   // it is held in her own little paws: her side arms go
    const off = cache.warm || (cache.warm = armOff(grid, arm + o.dy - 3, arm + o.dy + 1));
    for (const [x, y, c] of off) { if (c === "clear") g.clearRect(x, y + shift, 1, 1); else { g.fillStyle = OUT; g.fillRect(x, y + shift, 1, 1); } }
  }
  const pj = equip.pajama && WEAPON_PJ[petId], sway = weaponSway();
  // facing away it is behind her at the height of her arms above her feet, whatever the frame's size
  let ox = o ? o.dx : Math.round(w / 2 - 14), oy = (o ? o.dy : soles(grid) - soles(SPRITES[petId]) - (petId === "nori" ? 4 : 0)) + shift;
  if (o && !base && typeof pet !== "undefined") {             // a traced motion: ease from frame to frame
    const sm = smoothHold(pet.act + pet.t0 + petId, o.dx, o.dy, 0);
    ox = Math.round(sm.x); oy = Math.round(sm.y) + shift;
  }
  const it = petId === "nori"                                 // 욱's rubber pole, bent as it is right now; her paws on it unless it is behind her
    ? rubberStaff(rubberBend(screenY(g) + oy), o ? pawColour(petId, equip) : null, !o)
    : pj ? (ITEM_CACHE["pj:" + petId] || (ITEM_CACHE["pj:" + petId] = pj())) : itemImg(petId, WEAPON_OF[petId]);
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
          g.fillStyle = paw; for (const [x, y] of strumClean(img)) g.fillRect(x, y, 1, 1);
          put(STRUM_FEET, p.fx + 1, p.fy);
          drawGuitar(g, p.x, p.y, p.ga);
          const r = p.ga * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r), t = typeof pet !== "undefined" ? performance.now() - pet.t0 : 0;
          for (const [u, v, rows] of strumPaws(t)) put(rows, Math.round(p.x + c * u - sn * v - rows[0].length / 2), Math.round(p.y + sn * u + c * v - rows.length / 2));
        }
        continue;
      }
      // lying down, or put down and not picked up yet: it is on the grass (drawn by pet.js)
      if (img.lying || (typeof gprop !== "undefined" && gprop.state !== "held" && typeof pet !== "undefined" && pose && pose === pet._pose)) continue;
      const base = !pose || !pose.img, grid = base ? SPRITES[petId] : img.grid, shift = base && 20 >= INFO[petId].dup ? dy : 0;
      const cache = base ? (ITEM_CACHE["base:" + petId] || (ITEM_CACHE["base:" + petId] = {})) : (img._auto || (img._auto = {}));
      if (!("go" in cache)) {                             // where it hangs on this frame; facing us even with her eyes shut (found by her
        const w = weaponOffset(grid, petId), f = faceOf(grid), b = faceOf(SPRITES[petId]);   // cheeks) counts as front
        const o = w || (f && f.rx > 7 && b ? { dx: Math.round(f.cx - b.cx), dy: Math.round(f.cy - b.cy) } : null);
        // her body barely moves under the guitar: a face found far off (paws up by her cheeks) is not followed down
        cache.go = o && { dx: Math.max(-4, Math.min(4, o.dx)), dy: Math.max(-2, Math.min(3, o.dy)) };
      }
      const o = cache.go;
      // like the pochette: when her plain sprite is just turned the other way to walk back, it stays on the same side
      const keep = base && g.getTransform().a < 0;
      if (keep) { g.save(); g.translate(grid[0].length, 0); g.scale(-1, 1); }
      if (o && layer === "back") {                         // it hangs on her loosely: it follows her a moment late and sways as she moves
        const s = guitarSway(GUITAR_BACK.x + o.dx, GUITAR_BACK.foot - guitarDrop(GUITAR_BACK.deg) + o.dy + shift, GUITAR_BACK.deg);
        drawGuitar(g, s.x, Math.min(s.y, soles(grid) + shift - guitarDrop(s.deg)), s.deg);
      }
      if (o && layer === "front") {                       // its strap across her chest, from her right shoulder to her left hip
        const row = y => { const r = grid[y] || ""; const q = r.search(/[^B]/); return q < 0 ? null : [q, r.length - 1 - [...r].reverse().join("").search(/[^B]/)]; };
        const fy = faceOf(SPRITES[petId]).cy + o.dy, sy = Math.round(fy + 4), hy = Math.round(fy + 10), a1 = row(sy), a2 = row(hy);
        // it starts just inside her shoulder, sags a little across her chest and runs to her left side, where it meets the guitar
        const x0 = a1 && a1[1] - 1, x1 = a2 && a2[0];
        if (a1 && a2) {                                   // a thin band: the strap, and its darker underside
          const n = Math.abs(x0 - x1), pts = new Map();
          for (let k = 0; k <= n; k++) { const t = k / n; pts.set(Math.round(x0 + (x1 - x0) * t), Math.round(sy + (hy - sy) * t + 1.6 * 4 * t * (1 - t))); }
          for (const [x, y] of pts) { g.fillStyle = "#a8743f"; g.fillRect(x, y + shift, 1, 1); g.fillStyle = "#5e3a22"; g.fillRect(x, y + 1 + shift, 1, 1); }
        }
      }
      if (!o && layer === "front") {                      // from behind it lies over her back, mirrored about her middle
        let x0 = 1e9, x1 = -1, bottom = grid.length - 1;
        grid.forEach(r => { const q = r.search(/[^B]/); if (q >= 0) { x0 = Math.min(x0, q); x1 = Math.max(x1, r.length - 1 - [...r].reverse().join("").search(/[^B]/)); } });
        while (bottom > 0 && !/[^B]/.test(grid[bottom])) bottom--;
        const cx = (x0 + x1) / 2, oy = bottom - (SPRITES[petId].length - 1);
        const s = guitarSway(Math.round(cx * 2) - (GUITAR_BACK.x + Math.round(cx - 14)), GUITAR_BACK.foot - guitarDrop(180 - GUITAR_BACK.deg) + oy, 180 - GUITAR_BACK.deg);
        drawGuitar(g, s.x, Math.min(s.y, soles(grid) - guitarDrop(s.deg)), s.deg);
      }
      if (keep) g.restore();
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
