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
function fork(p, main, light, flat = false, paw = PET[p].pal[PET[p].body], hands = [7, 22]) {
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
    if (!flat) for (const hx2 of hands) d.grid(HAND, { K: OUT, W: paw }, hx2 - 1, at(hx2) - 1);   // where her own hands are
  }, false);
}

// 욱: a long yellow staff with white caps at both ends, tilted a little, with the rabbit she doodled on it (a dark speck)
// 욱's rabbit pole is rubber: it bends. bend = how far its two ends sit below a straight pole (minus: above), in pixels;
// paw = the colour of her two paws gripping it (none when it is flat on the grass or behind her back)
function staff(p, flat = false, bend = 0, paw = null, twist = 0, hands = [7, 22]) {
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
    if (paw) for (const hx of hands) d.grid(HAND, { K: OUT, W: paw }, hx - 1, at(hx));   // where her own hands are
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
function rubberStaff(bend, paw, flat = false, twist = 0, one = false) {
  const k = "rub:" + bend + ":" + paw + ":" + flat + ":" + twist + ":" + one;
  return ITEM_CACHE[k] || (ITEM_CACHE[k] = staff("nori", flat, bend, paw, twist, one ? [7] : [7, 22]));
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
    // her camera (as in the anime): a dark grey body with a light top band, the button on top left of middle, a little
    // viewfinder at the right, the big round lens right of middle with the flash and a grip line to its left, on a light blue strap that goes up behind her arms
    camera: { layer: "front", auto: "camera", build: () => pixmap(d => {   // the inventory picture; in play placed per frame (below)
      d.line(8, 20, 5, 18, CAMERA_PAL.s); d.line(20, 20, 23, 18, CAMERA_PAL.s);   // the strap, round behind her arms
      d.grid(CAMERA, CAMERA_PAL, 9, 18);
    }, false) },
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
    // her weeding licence, small and neat like the old note: a pale grey card with a little green crown and the title,
    // her photo (pink ears) at the right and her grade under a thin line
    pass: { layer: "front", auto: "pass", build: () => pixmap(d => {   // drawn here for the inventory; in play placed per frame (below)
      d.rect(9, 11, 11, 6, "#eef0f2");
      for (const x of [10, 12, 14]) d.put(x, 12, "#7cc46b"); d.rect(10, 13, 5, 1, "#7cc46b");   // the crown
      d.rect(10, 15, 4, 1, "#9b8e7a");                                                          // the title
      d.rect(15, 12, 4, 4, "#ffffff");                                                          // the photo
      d.put(15, 12, "#f5aab6"); d.put(17, 12, "#f5aab6"); d.rect(15, 13, 3, 3, "#fcf4ca");
      d.put(15, 14, "#5a4636"); d.put(17, 14, "#5a4636");
      d.rect(10, 16, 9, 1, "#d2d6da");                                                          // the line under the title
    }) },
    pajama: { layer: "front", auto: "pajama", under: true, build: () => onesieIcon("nori") },
    // a pudding on a stemmed glass dish (as in the anime), raised like Gatsby's toast in her other paw
    pudding: { layer: "front", auto: "pudding", build: () => pixmap(d => {   // the inventory picture; in play placed per frame (below)
      PUDDING.forEach((r, j) => [...r].forEach((ch, i) => { if (PUDDING_PAL[ch]) d.put(8 + i, 9 + j, PUDDING_PAL[ch]); }));
    }, false) },
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
const WEAPON_ONE = { mochi: paw => fork("mochi", "#f59ab6", "#ffd0de", false, paw, [22]) };   // held in the one paw she has free (치카: the bear is in her other arm)
const WEAPON_PJ = { mochi: () => fork("mochi", "#f59ab6", "#ffd0de", false, PAJAMA.mochi.main), sora: () => fork("sora", "#4f9fe0", "#a9d6f7", false, PAJAMA.sora.main) };
const WEAPON_MID = { mochi: 10, sora: 10, nori: 14 };                       // the middle of the handle, where it turns
// 치카 with her fork too: the bear hugged in one arm against her side (away from her pochette); her other paw keeps the fork
function teddyOneArm(grid) {
  const eyes = findEyes(grid);
  if (!eyes.length) return [];
  const cx = eyes.length === 2 ? (eyes[0].cx + eyes[1].cx) / 2 : eyes[0].cx, mid = grid[0].length / 2;
  const bottom = Math.max(...eyes.map(e => e.y1)) + 15;
  const x0 = Math.round(cx - (TEDDY[0].length - 1) / 2) - 7, y0 = bottom - TEDDY.length + 1, out = [];
  out.push(...armOff(grid, y0 + 3, y0 + 7).filter(([x]) => x < mid));
  TEDDY.forEach((row, y) => [...row].forEach((ch, x) => { if (TEDDY_PAL[ch]) out.push([x0 + x, y0 + y, TEDDY_PAL[ch]]); }));
  const px = x0 - 1;
  TEDDY_PAW.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== ".") out.push([px + x, y0 + 6 + y, ch === "K" ? TEDDY_PAL.K : "body"]); }));
  return out;
}
// any little picture turned to an angle, pixel for pixel (the guitar's way: blown up smoothly, turned, sampled back)
const TURNED = {};
function turnedSprite(key, src, deg) {
  const k = key + ":" + Math.round(deg); if (TURNED[k]) return TURNED[k];
  const w = src.width, h = src.height, d = src.getContext("2d").getImageData(0, 0, w, h).data;
  let big = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => { const i = (y * w + x) * 4; return d[i + 3] > 128 ? "rgb(" + d[i] + "," + d[i + 1] + "," + d[i + 2] + ")" : null; }));
  for (let i = 0; i < 3; i++) big = scale2x(big);
  const D = Math.ceil(Math.hypot(w, h)) + 2, r = deg * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r);
  const cv = document.createElement("canvas"); cv.width = D; cv.height = D; const g = cv.getContext("2d");
  for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
    const X = x + 0.5 - D / 2, Y = y + 0.5 - D / 2, u = Math.floor((c * X + sn * Y + w / 2) * 8), v = Math.floor((-sn * X + c * Y + h / 2) * 8);
    const col = big[v] && big[v][u]; if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
  }
  return (TURNED[k] = cv);
}
// Everything on at once: she has two paws, so she keeps her weapon in one (her left, at its grip end, so it still
// swings and twirls as always) and uses the other for her other thing: 치카 hugs her bear in her left arm (the fork in her
// right), 욱 holds up her pudding in her right paw (the pole in her left). (하와 keeps both paws on her trident; her camera then just hangs from her neck.)
function weaponOneHand(petId, equip) {
  return petId === "mochi" && equip.teddy && (typeof teddyHugged !== "function" || teddyHugged())
      || petId === "nori" && equip.pudding;
}
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
  if (grid[0].length > 60) return [];                          // close-ups keep their own look
  const out = [], put = (rows, pal, x0, y0) => rows.forEach((r, j) => [...r].forEach((ch, i) => { if (pal[ch]) out.push([x0 + i, y0 + j, pal[ch]]); }));
  const f = faceOf(grid), b = faceOf(SPRITES[pet]);
  // her cheeks (little pink patches): two show when she faces us, one in profile
  const cheeks = []; grid.forEach((r, y) => [...r].forEach((c, x) => { if (c !== "P") return;
    const k = cheeks.find(q => q.pts.some(([a, c]) => Math.abs(a - x) <= 2 && Math.abs(c - y) <= 2));
    if (k) { k.pts.push([x, y]); k.n++; k.x = k.pts.reduce((m, p) => m + p[0], 0) / k.n; k.y = k.pts.reduce((m, p) => m + p[1], 0) / k.n; } else cheeks.push({ x, y, n: 1, pts: [[x, y]] }); }));
  const blush = cheeks.filter(c => c.n >= 2 && c.n <= 14 && c.y > (f ? f.cy - 4 : 0));   // a lone pink pixel is not a cheek
  let x0 = 1e9, x1 = -1;
  grid.forEach(r => { const q = r.search(/[^B]/); if (q >= 0) { x0 = Math.min(x0, q); x1 = Math.max(x1, r.length - 1 - [...r].reverse().join("").search(/[^B]/)); } });
  const eyes = f ? findEyes(grid) : [], profile = f && eyes.length < 2 && blush.length < 2;
  if (f && b && profile) {                                     // side on: the lens edge-on in front of her eye, its arm back to her ear
    const s = f.cx > (x0 + x1) / 2 ? 1 : -1, e = eyes[0] || { cx: f.cx - 0.5, y0: Math.round(f.cy - 4) };
    const lens = ["KKKKK.", "KGWGGK", "KGGGGK", ".KgggK", "..KKK."];   // seen from the side: a narrow slanted lens over the whole eye
    const ex = (e.x0 != null ? (s > 0 ? e.x0 - 1 : e.x1 - 4) : Math.round(e.cx) - 3), ey = (e.y0 != null ? e.y0 : Math.round(e.cy) - 2) - 1;
    lens.forEach((r, j) => [...r].forEach((ch, i) => { if (SHADES_PAL[ch]) out.push([s > 0 ? ex + i : ex + 5 - i, ey + j, SHADES_PAL[ch]]); }));
    for (let k = 1; k <= 6; k++) { const x = s > 0 ? ex - k : ex + 5 + k; if (grid[ey + 1] && grid[ey + 1][x] && grid[ey + 1][x] !== "B") out.push([x, ey + 1, OUT]); }   // the arm back to her ear
  } else if (f && b) {                                         // facing us: a lens over each eye (one eye shut or hidden: its lens still there)
    const dx = Math.round(f.cx - b.cx), dy = Math.round(f.cy - b.cy);
    let lenses;
    if (eyes.length === 2) lenses = [[Math.floor(eyes[0].cx) - 3, eyes[0].y0 - 1], [Math.ceil(eyes[1].cx) - 3, eyes[1].y0 - 1]];
    else if (eyes.length === 1) {
      const e = eyes[0], other = blush.reduce((m, c) => Math.abs(c.x - e.cx) > Math.abs(m.x - e.cx) ? c : m, blush[0]), left = other.x > e.cx;
      const a = [left ? Math.floor(e.cx) - 3 : Math.ceil(e.cx) - 3, e.y0 - 1]; lenses = left ? [a, [a[0] + 9, a[1]]] : [[a[0] - 9, a[1]], a];
    } else lenses = [[6 + dx, 16 + dy], [15 + dx, 16 + dy]];
    const on = (x, y) => grid[y] && grid[y][x] && grid[y][x] !== "B";   // turned a little, the far lens goes round the side of her head
    for (const [lx, ly] of lenses) SHADES_LENS.forEach((r, j) => [...r].forEach((ch, i) => { if (SHADES_PAL[ch] && on(lx + i, ly + j)) out.push([lx + i, ly + j, SHADES_PAL[ch]]); }));
    { const [l, r] = lenses, y = Math.min(l[1], r[1]) + 1; for (let x = l[0] + 7; x < r[0]; x++) out.push([x, y, OUT]); }   // the bridge
  }
  // the chain goes round her neck, a little back from her face: below her head standing (in profile too), beside it
  // lying on her front, a band that sags out in the middle and wraps back round at both ends; only where her body is.
  // Facing away her head is where it would be: above her body by her own proportions, or lying, away from her tail
  const body = (x, y) => !!(grid[y] && grid[y][x] && grid[y][x] !== "B");
  let y0 = -1, y1 = -1, tx = 0, tn = 0;
  grid.forEach((r, y) => { if (/[^B]/.test(r)) { if (y0 < 0) y0 = y; y1 = y; }
    [...r].forEach((c, x) => { if (c === "W") { tx += x; tn++; } }); });
  const lying = f ? y1 - f.cy < f.ry + 3 : x1 - x0 + 1 > (y1 - y0 + 1) * 1.15;   // lying: hardly any of her below her face
  const tailRight = tn ? tx / tn > (x0 + x1) / 2 : true;
  // from behind: her nape is a set way down from the top of her head (where it gets wide, below her ears), whatever her legs do
  const wid = grid.map(r => { const q = r.search(/[^B]/); return q < 0 ? 0 : r.length - [...r].reverse().join("").search(/[^B]/) - q; });
  const headTop = wid.findIndex(v => v >= Math.max(...wid) * 0.6);
  const F = f || (lying ? { cx: tailRight ? x0 + 9.5 : x1 - 8.5, cy: y1 - 5.25, rx: 8.7, ry: 6 } : { cx: (x0 + x1) / 2 + 0.5, cy: headTop + 8.5, rx: 9.2, ry: 6 });
  const [ux, uy] = !lying ? [0, 1] : x1 - F.cx > F.cx - x0 ? [1, 0] : [-1, 0];
  // from behind, the back of it sits up at her nape and its sides drop away round to the front
  const back = !f && !lying, D = back ? 1.5 : uy ? F.ry + 1.5 : F.rx + 2, W = 10, sag = back ? -2.5 : 2.5;
  let at = t => [F.cx - 0.5 + ux * (D - sag * t * t) - uy * W * t, F.cy - 0.5 + uy * (D - sag * t * t) + ux * W * t];
  const side = f && !lying && profile;
  if (side) {                                                  // in profile: from the back of her neck down round under her chin
    const s = f.cx > (x0 + x1) / 2 ? 1 : -1, ax = (x0 + x1) / 2 - s * 6, ay = f.cy + 1, bx = f.cx - s, by = f.cy + f.ry + 2.5;
    at = t => { const q = (t + 1) / 2; return [ax + (bx - ax) * q, ay + (by - ay) * q + 2 * Math.sin(q * Math.PI)]; };
  }
  const face = (x, y) => f && ((x + 0.5 - f.cx) / f.rx) ** 2 + ((y + 0.5 - f.cy) / f.ry) ** 2 <= 1;
  const ok = (x, y) => body(x, y) && !(grid[y][x] === "W" && !f) && !face(x, y);   // never over her face, nor her white tail from behind
  const link = new Map();
  for (let k = 0; k <= 80; k++) { const [x, y] = at(k / 40 - 1).map(Math.round); if (ok(x, y)) link.set(x + "," + y, (x + y) % 2); }
  const ring = new Set();
  for (const key of link.keys()) { const [x, y] = key.split(",").map(Number); for (const [a, c] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = (x + a) + "," + (y + c); if (!link.has(n) && ok(x + a, y + c)) ring.add(n); } }
  for (const n of ring) { const [x, y] = n.split(",").map(Number); out.push([x, y, OUT]); }
  for (const [key, a] of link) { const [x, y] = key.split(",").map(Number); out.push([x, y, a ? "#ffe680" : "#d39a22"]); }
  if (f && uy && !side) { const [mx, my] = at(0).map(Math.round); if (body(mx, my + 4)) put(RABBIT, RABBIT_PAL, mx - 2, my + 1); }   // the rabbit at the front
  return out;
};
// 하와's camera on every motion: held in front of her belly where her paws are (it moves with her face), its strap round
// behind her arms; side on, a narrow body with the lens poking forward; from behind only the strap shows at her nape;
// lying down she is on top of it. Facing us it never mirrors (it is marked noMirror for the drawing)
const CAMERA = ["...KK......", "KKKKKKKKKKK", "KWWWWWWWKWK", "KDDDDKKKDDK", "KDKLKLLLKDK", "KDKDKLCLKDK", "KDKLKLLLKDK", "KDDDDKKKDDK", "KKKKKKKKKKK"];
const CAMERA_SIDE = ["KKKK..", "KWWK..", "KDDKKK", "KDDKLK", "KDDKKK", "KKKK.."];
const CAMERA_PAL = { K: OUT, W: "#f2f1ec", D: "#4a5256", L: "#c9d0d4", C: "#2f3539", s: "#8ccbe4", t: "#5d9fc2" };
ITEM_AUTO.camera = (grid, pet) => {
  if (grid[0].length > 60) return [];
  const out = [], body = (x, y) => !!(grid[y] && grid[y][x] && grid[y][x] !== "B");
  const put = (rows, x0, y0, flip) => rows.forEach((r, j) => [...r].forEach((ch, i) => { if (CAMERA_PAL[ch]) out.push([flip ? x0 + r.length - 1 - i : x0 + i, y0 + j, CAMERA_PAL[ch]]); }));
  let x0 = 1e9, x1 = -1, y1 = -1;
  grid.forEach((r, y) => { const q = r.search(/[^B]/); if (q >= 0) { x0 = Math.min(x0, q); x1 = Math.max(x1, r.length - 1 - [...r].reverse().join("").search(/[^B]/)); y1 = y; } });
  let f = faceOf(grid);
  const b = faceOf(SPRITES[pet]);
  if (!f && b && grid.some(r => r.includes("P"))) {            // eyes shut but her cheeks show: still facing us, her face where her body puts it
    let by = SPRITES[pet].length - 1; while (by > 0 && !/[^B]/.test(SPRITES[pet][by])) by--;
    f = { cx: b.cx + Math.round((x0 + x1) / 2 - (SPRITES[pet][0].length - 1) / 2), cy: b.cy + (y1 - by), rx: b.rx, ry: b.ry };
  }
  if (!f || !b) {                                              // from behind: the strap across her nape
    const wid = grid.map(r => { const q = r.search(/[^B]/); return q < 0 ? 0 : r.length - [...r].reverse().join("").search(/[^B]/) - q; });
    const y = wid.findIndex(v => v >= Math.max(...wid) * 0.6) + 10, mid = (x0 + x1) / 2;
    for (let x = x0; x <= x1; x++) { const yy = y + Math.round(1.5 * ((x - mid) / ((x1 - x0) / 2)) ** 2); if (body(x, yy) && grid[yy][x] !== "K") out.push([x, yy, CAMERA_PAL.s]); }
    return out;
  }
  if (y1 - f.cy < f.ry) return out;                             // lying on it
  const cheeks = []; grid.forEach((r, y) => [...r].forEach((c, x) => { if (c !== "P" || y < f.cy - 4) return;
    const k = cheeks.find(q => q.pts.some(([a, e]) => Math.abs(a - x) <= 2 && Math.abs(e - y) <= 2)); if (k) k.pts.push([x, y]); else cheeks.push({ pts: [[x, y]] }); }));
  const profile = faceOf(grid) && findEyes(grid).length < 2 && cheeks.filter(c => c.pts.length >= 2 && c.pts.length <= 14).length < 2;
  const dx = Math.round(f.cx - b.cx);
  if (profile) {                                               // side on, under her chin, the lens to the front
    const s = f.cx > (x0 + x1) / 2 ? 1 : -1, cx = Math.round(f.cx - s * 3);
    put(CAMERA_SIDE, s > 0 ? cx - 2 : cx - 3, Math.round(f.cy + f.ry) + 1, s < 0);
    return out;
  }
  const cx = 9 + dx, cy = Math.min(Math.round(f.cy) + 4, y1 - 7);   // just under her mouth, wherever her face is, and not off her feet
  // the strap: from the top corners of the camera up and out under her cheeks to the sides of her head, where it goes
  // round behind her neck; a light band with its darker underside
  for (const [sx, step] of [[cx, -1], [cx + 10, 1]])
    for (let k = 1; k < 14; k++) {
      const x = sx + step * k, y = cy + 1 - Math.floor((k + 1) / 2);
      const c = grid[y] && grid[y][x];
      if (!c || c === "B" || c === "K" || c === "P") break;
      out.push([x, y, CAMERA_PAL.s]);
      if (body(x, y + 1) && !"KP".includes(grid[y + 1][x])) out.push([x, y + 1, CAMERA_PAL.t]);
    }
  put(CAMERA, cx, cy, false);
  out.noMirror = true; out.box = { cx, cy };
  return out;
};
// lying down, her camera has fallen on the grass in front of her, face down: seen from above, its light top edge, its
// dark back with the little screen and viewfinder, a shadow under it; its strap runs from it up to her neck
const CAMERA_LIE = [
  ".KKKKKKKKKK.",
  "KWWWWWWWWWWK",
  "KKKKKKKKKKKK",
  "KDDDDDDDKKDK",
  "KDKKKKKDDDDK",
  "KDKSSSKDDLDK",
  "KDKKKKKDDDDK",
  ".KKKKKKKKKK.",
];
function lyingBox(grid) {
  let x0 = 1e9, x1 = -1, y1 = -1;
  grid.forEach((r, y) => { const q = r.search(/[^B]/); if (q >= 0) { x0 = Math.min(x0, q); x1 = Math.max(x1, r.length - 1 - [...r].reverse().join("").search(/[^B]/)); y1 = y; } });
  const f = faceOf(grid);
  return { x0, x1, y1, fx: f ? f.cx : (x0 + x1) / 2, side: f && f.cx < (x0 + x1) / 2 ? -1 : 1 };
}
// The camera stays put on the grass however she shifts about: it is placed once, on one lying frame, and every other
// frame only moves it by how that frame sits against it (frames are drawn centred on her and standing on her feet).
// Only the strap's far end follows her, to the side of her face on this frame
function cameraLying(grid, pet) {
  const out = [], ref = SORALOAF_IMG[12].grid, R = lyingBox(ref), B = lyingBox(grid);
  const sx = (grid[0].length >> 1) - (ref[0].length >> 1), sy = grid.length - ref.length;
  const side = R.side, left = Math.round(R.fx + side * 6) - 6 + sx, top = R.y1 - 4 + sy;
  for (let x = left + 1; x < left + 11; x++) out.push([x, top + 8, "rgba(40,60,40,0.25)"]);   // its shadow on the grass
  const pal = { K: OUT, W: "#f2f1ec", D: "#4a5256", S: "#a9c4d0", L: "#c9d0d4" };
  CAMERA_LIE.forEach((r, j) => [...r].forEach((ch, i) => { if (pal[ch]) out.push([left + i, top + j, pal[ch]]); }));
  // the strap: from the far top corner of the camera, sagging on the grass, up round the side of her face; a light
  // band with its darker edge, sampled along its curve and joined pixel by pixel so it never breaks
  const ax = side > 0 ? left : left + 11, ay = top + 2, bx = Math.round(B.fx - side * 7), by = B.y1 - 4;
  const n = 24, seen = new Set(), dot = (x, y) => { if (seen.has(x + "," + y)) return; seen.add(x + "," + y); out.push([x, y, CAMERA_PAL.s], [x, y + 1, CAMERA_PAL.t]); };
  let px = ax, py = ay;
  for (let k = 1; k <= n; k++) {
    const q = k / n, x = Math.round(ax + (bx - ax) * q), y = Math.round(ay + (by - ay) * q * q + Math.sin(q * Math.PI) * 1.5);
    while (px !== x || py !== y) { if (px !== x) px += Math.sign(x - px); else py += Math.sign(y - py); dot(px, py); }
  }
  return out;
}
// 욱's licence on every motion: on her forehead just above her eyes, moving with them; side on, the card edge-on
// in front of her forehead; from behind (or face down) it is out of sight. Facing us it never mirrors
ITEM_AUTO.pass = (grid, pet) => {
  if (grid[0].length > 60) return [];
  const f = faceOf(grid), b = faceOf(SPRITES[pet]);
  if (!f || !b) return [];
  const eyes = findEyes(grid), be = findEyes(SPRITES[pet]);
  const cheeks = []; grid.forEach((r, y) => [...r].forEach((c, x) => { if (c !== "P" || y < f.cy - 4) return;
    const k = cheeks.find(q => q.pts.some(([a, e]) => Math.abs(a - x) <= 2 && Math.abs(e - y) <= 2)); if (k) k.pts.push([x, y]); else cheeks.push({ pts: [[x, y]] }); }));
  const profile = eyes.length < 2 && cheeks.filter(c => c.pts.length >= 2 && c.pts.length <= 14).length < 2;
  const eTop = eyes.length ? Math.min(...eyes.map(e => e.y0)) : Math.round(f.cy - 4), bTop = Math.min(...be.map(e => e.y0));
  if (profile) {                                               // edge-on: a thin card standing on her forehead
    let x0 = 1e9, x1 = -1; grid.forEach(r => { const q = r.search(/[^B]/); if (q >= 0) { x0 = Math.min(x0, q); x1 = Math.max(x1, r.length - 1 - [...r].reverse().join("").search(/[^B]/)); } });
    const s = f.cx > (x0 + x1) / 2 ? 1 : -1, ex = eyes.length ? Math.round(eyes[0].cx) : Math.round(f.cx), out = [];
    ["KKK", "KGK", "KGK", "KGK", "KGK", "KGK", "KKK"].forEach((r, j) => [...r].forEach((ch, i) => out.push([ex - 1 + i, eTop - 8 + j, ch === "K" ? OUT : "#eef0f2"])));
    return out;
  }
  const mx = eyes.length === 2 ? (eyes[0].cx + eyes[1].cx) / 2 : f.cx - 0.5, bx = (be[0].cx + be[1].cx) / 2;
  const dx = Math.round(mx - bx), dy = eTop - bTop - 1;          // a row clear of her eyes
  const out = weaponPixels(pet, "pass").map(([x, y, c]) => [x + dx, y + dy, c]);
  out.noMirror = true;
  return out;
};
// the pudding: caramel on top, the custard flaring out, on a small stemmed glass. Row 8 is where her little paw holds
// the stem (like her paws on the pole), at her hand
const PUDDING = [
  "..KKK..",
  ".KCCCK.",
  ".KYYYK.",
  "KYYYyYK",
  "KKKKKKK",
  "KGGGGgK",
  ".KKGKK.",
  "..KGK..",
  "..KGK..",
  ".KKKKK.",
];
const PUDDING_PAL = { K: OUT, C: "#6b3b1c", Y: "#f7d276", y: "#e9b850", G: "#eef6fa", g: "#c3d8e4" };
const PUDDING_COLS = new Set(Object.values(PUDDING_PAL)), p0 = c => PUDDING_COLS.has(c) && c !== PUDDING_PAL.G && c !== PUDDING_PAL.g;   // the pudding itself (not its glass, nor her paw)
// 욱 holds it at her side in one little paw, as she holds her pole; it moves with her (from her face); side on, in the
// paw on the side she faces; from behind or lying down it is out of sight
ITEM_AUTO.pudding = (grid, pet) => puddingAt(grid, pet, -1);
// prefer: the paw she holds it in facing us (-1 her left / our left; 1 her right, when her pole is in her left)
function puddingAt(grid, pet, prefer) {
  if (grid[0].length > 60) return [];
  const o = weaponOffset(grid, pet), f = faceOf(grid);
  if (!o || !f) return [];
  let y1 = -1; grid.forEach((r, y) => { if (/[^B]/.test(r)) y1 = y; });
  if (y1 - f.cy < f.ry + 3) return [];
  const mid = grid[0].length / 2, eyes = findEyes(grid), cheeks = [];
  grid.forEach((r, y) => [...r].forEach((c, x) => { if (c !== "P" || y < f.cy - 4) return;
    const k = cheeks.find(q => q.pts.some(([a, e]) => Math.abs(a - x) <= 2 && Math.abs(e - y) <= 2)); if (k) k.pts.push([x, y]); else cheeks.push({ pts: [[x, y]] }); }));
  const profile = eyes.length < 2 && cheeks.filter(c => c.pts.length >= 2 && c.pts.length <= 14).length < 2;
  const side = profile ? (f.cx > mid ? 1 : -1) : prefer, at = (x, y) => (grid[y] && grid[y][x]) || "B";
  const edge = y => { const r = grid[y] || "", q = r.search(/[^B]/); return q < 0 ? -1 : side < 0 ? q : r.length - 1 - [...r].reverse().join("").search(/[^B]/); };
  // her hand on this frame: a paw waved up by her head, else the end of her arm (the little stub of outline, arm and
  // its inner line at her side, lowest one), else where her arm would be
  let hand = side < 0 && prefer < 0 ? waveHand(grid) : null;
  // (only as low as her arms go, so it is never her foot; the top of the stub, a little raised, where her paw is)
  if (!hand) for (let y = Math.round(f.cy); y <= ANCHOR[pet].arm + 2 + o.dy && !hand; y++) { const e = edge(y); if (e >= 0 && at(e, y) === "K" && !"KB".includes(at(e - side, y)) && at(e - 2 * side, y) === "K") hand = [e, y]; }
  if (!hand) { const y = ANCHOR[pet].arm + o.dy; hand = [edge(y) + side, y]; }
  const sx = hand[0] + side, hy = hand[1] - 1, gx = sx - 3, gy = hy - 8, out = [];   // the stem in her paw
  PUDDING.forEach((row, j) => [...row].forEach((ch, i) => { if (PUDDING_PAL[ch]) out.push([gx + i, gy + j, PUDDING_PAL[ch]]); }));
  HAND.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== ".") out.push([sx - 1 + i, hy - 1 + j, ch === "K" ? "outline" : "body"]); }));   // her paw round the stem
  return out;
}
// 하와's camera is lighter than she is: when she drops it floats up a little against its strap (it cannot go further than
// the strap lets it) and settles back on her when she lands. A small spring on how fast her face moves down the screen
// the pudding wobbles: its top swings the other way when she moves sideways and bobs when she goes up or down, then
// wobbles back and forth to rest (a loose spring). Tracked on where her face is on the screen
const PUDF = { x: 0, vx: 0, y: 0, vy: 0, sx: null, sy: null, t: 0 };
function puddingWobble(g, cache, grid) {
  if (!("fy" in cache)) { const f = faceOf(grid); cache.fy = f ? f.cy : 0; cache.fx = f ? f.cx : 0; }
  const now = performance.now(), dt = Math.min(0.05, (now - PUDF.t) / 1000), flip = g.getTransform().a < 0 ? -1 : 1;
  const sx = (g.worldX || 0) + SPRITE_PAD + cache.fx * flip, sy = (g.worldY || 0) + SPRITE_PAD + cache.fy;
  if (PUDF.sx === null || dt <= 0 || now - PUDF.t > 200) { Object.assign(PUDF, { sx, sy, t: now }); return { x: 0, y: 0, pop: 0, flip }; }
  const mvx = (sx - PUDF.sx) / dt, mvy = (sy - PUDF.sy) / dt;
  const tx = Math.max(-2, Math.min(2, -mvx * 0.03)), ty = Math.max(-1, Math.min(1, mvy * 0.01));
  PUDF.vx += (240 * (tx - PUDF.x) - 7 * PUDF.vx) * dt; PUDF.x += PUDF.vx * dt;
  PUDF.vy += (300 * (ty - PUDF.y) - 9 * PUDF.vy) * dt; PUDF.y += PUDF.vy * dt;
  PUDF.x = Math.max(-2, Math.min(2, PUDF.x)); PUDF.y = Math.max(-1, Math.min(1, PUDF.y));
  Object.assign(PUDF, { sx, sy, t: now });
  return { x: Math.round(PUDF.x), y: Math.round(PUDF.y), pop: puddingPop(), flip };
}
// dropped, the pudding jumps up off its glass (it is lighter than her and she is falling away under it) and comes back
// down onto it as she lands: it never leaves her, she catches it on the glass
const PUDL = { r: 0, v: 0 };
// driven by how fast she is really falling (not by her picture, which jumps from frame to frame), stepped in small
// even steps so it rises and comes down smoothly
function puddingPop() {
  const now = performance.now(); let dt = Math.min(0.05, (now - (PUDL.t || now)) / 1000); PUDL.t = now;
  const vb = typeof pet !== "undefined" && pet.act === "fall" ? Math.max(0, pet.vy) : 0;
  const target = -Math.min(7, vb * 0.03);
  while (dt > 0) { const h = Math.min(dt, 0.008); PUDL.v += (90 * (target - PUDL.r) - 17 * PUDL.v) * h; PUDL.r += PUDL.v * h; dt -= h; }
  if (PUDL.r > 0.6) { PUDL.r = 0.6; PUDL.v = -PUDL.v * 0.3; }      // it lands back on the glass with a little bounce
  return Math.round(Math.max(-7, PUDL.r));
}
// when she turns round, her pudding does not jump to her other side: it is swung across in front of her (a short
// eased slide with a little lift), from where it was on the screen to where it now is
const PUDS = { flip: null, sx: 0, off: 0, t0: 0, t: 0, cur: 0 };
function puddingSwap(g, img, px) {
  if (px.cx === undefined) px.cx = px.length ? px.reduce((m, p) => m + p[0], 0) / px.length : 0;
  const flip = g.getTransform().a < 0, w = img.width, sx = (g.worldX || 0) + SPRITE_PAD + (flip ? w - px.cx : px.cx), now = performance.now();
  if (PUDS.flip !== null && flip !== PUDS.flip && now - PUDS.t > 0 && now - PUDS.t < 300) { PUDS.off = PUDS.sx + PUDS.cur - sx; PUDS.t0 = now; }
  const q = Math.min(1, (now - PUDS.t0) / 240), e = 1 - (1 - q) * (1 - q) * (1 - q), cur = PUDS.off * (1 - e);
  Object.assign(PUDS, { flip, sx, t: now, cur });
  return { x: Math.round(cur * (flip ? -1 : 1)), y: -Math.round(Math.sin(e * Math.PI) * 3 * (Math.abs(PUDS.off) > 4 ? 1 : 0)) };
}
const CAMF = { r: 0, v: 0, y: null, t: 0 };
function cameraFloat() {                                        // (on how fast she really falls, in small even steps: smooth)
  const now = performance.now(); let dt = Math.min(0.05, (now - (CAMF.t || now)) / 1000); CAMF.t = now;
  const vb = typeof pet !== "undefined" && pet.act === "fall" ? Math.max(0, pet.vy) : 0, target = -Math.min(6, vb * 0.028);
  while (dt > 0) { const h = Math.min(dt, 0.008); CAMF.v += (110 * (target - CAMF.r) - 15 * CAMF.v) * h; CAMF.r += CAMF.v * h; dt -= h; }
  if (CAMF.r > 1) { CAMF.r = 1; CAMF.v = -CAMF.v * 0.3; }        // it drops back onto her and bumps once
  return Math.round(Math.max(-6, CAMF.r));
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
  const base = !pose || !pose.img, grid = base ? SPRITES[petId] : img.grid, one = weaponOneHand(petId, equip);   // one: her other paw is busy
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
    drawPaws(g, petId, equip, Math.abs(st.a - flatA) < 0.35 && !one ? [along(0), along(15)] : [along(0)]);
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
    drawPaws(g, petId, equip, (one ? [petId === "mochi" ? 8 : -7] : [-7, 8]).map(d => [cx + Math.cos(ang) * d, cy + Math.sin(ang) * d]));
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
    drawPaws(g, petId, equip, (one ? [petId === "mochi" ? 8 : -8] : [-8, 8]).map(d => [cx + Math.cos(ang) * d, cy + shift + Math.sin(ang) * d]));   // both hands up on the handle (or her left)
    return;
  }
  // in her hands: in front, or behind her (both long ends showing) while she faces away; swinging with what she does
  if (layer !== (o ? "front" : "back")) return;
  if (o) {                                                   // it is held in her own little paws: her side arms go
    const off = one ? cache.warm1 || (cache.warm1 = armOff(grid, arm + o.dy - 3, arm + o.dy + 1).filter(([x]) => petId === "mochi" ? x > w / 2 : x < w / 2))   // (her other arm is busy)
                    : cache.warm || (cache.warm = armOff(grid, arm + o.dy - 3, arm + o.dy + 1));
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
    ? rubberStaff(rubberBend(screenY(g) + oy), o ? pawColour(petId, equip) : null, !o, 0, one)
    : one ? (ITEM_CACHE["one:" + petId + !!pj] || (ITEM_CACHE["one:" + petId + !!pj] = WEAPON_ONE[petId](pj ? PAJAMA[petId].main : undefined)))
    : pj ? (ITEM_CACHE["pj:" + petId] || (ITEM_CACHE["pj:" + petId] = pj())) : itemImg(petId, WEAPON_OF[petId]);
  if (!sway) { g.drawImage(it.img, it.x + ox, it.y + oy); return; }
  const cx = mid + ox, cy = arm + oy;
  g.save(); g.translate(cx, cy); g.rotate(sway); g.drawImage(it.img, it.x + ox - cx, it.y + oy - cy); g.restore();
}

// draws the equipped items of one layer, in the sprite's own pixels (the caller has set up the transform).
// Auto items are placed on this exact frame (cached on the frame); hand-placed ones only on base-sprite frames.
function drawItems(g, petId, equip, layer, dy, pose, img) {
  const art = ITEM_ART[petId];
  // the onesie goes on first; what hangs in front (her camera) goes on after what she holds (it hangs over the shaft)
  const rank = id => (art[id] || {}).under ? 0 : id === "camera" || id === "pudding" || id === "teddy" ? 2 : 1;   // (and what is in her other paw shows in front of her weapon)
  const order = ITEM_LIST[petId].slice().sort((p, q) => rank(p[1]) - rank(q[1]));
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
    if (equip[id] && a && a.auto === "weapon") {
      if (img && img.grid) drawWeapon(g, petId, layer, dy, pose, img, equip);
      continue;
    }
    if (!equip[id] || !a || a.layer !== layer) continue;
    if (a.auto) {
      if (!img || !img.grid) continue;
      if (a.auto === "teddy" && typeof teddyHugged === "function" && !teddyHugged()) continue;   // the bear is off in the world
      if (a.auto === "pass" && typeof licenceWorn === "function" && !licenceWorn()) continue;   // the licence is off in the world
      const lie = a.auto === "camera" && img.lying && pose && pose.img;   // lying down: it is on the grass in front of her
      // on the base pose the face is found on the plain sprite, so a blink does not make the item vanish
      const base = !pose || !pose.img, grid = base ? SPRITES[petId] : img.grid, shift = base ? dy : 0;
      const cache = base ? (ITEM_CACHE["base:" + petId] || (ITEM_CACHE["base:" + petId] = {})) : (img._auto || (img._auto = {}));
      const busy = a.auto === "teddy" && equip.fork ? "teddy1" : a.auto === "pudding" && equip.pencil ? "pudding1" : null;   // sharing her paws with her weapon
      let px = lie ? cache.cameraLie || (cache.cameraLie = cameraLying(grid, petId))
        : busy ? cache[busy] || (cache[busy] = busy === "teddy1" ? teddyOneArm(grid) : puddingAt(grid, petId, 1))
        : cache[a.auto] || (cache[a.auto] = autoItemPixels(a.auto, grid, base ? petId + "-base:0" : img.key || "", petId));
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
      const lift = a.auto === "camera" && !lie && typeof pet !== "undefined" && pose === pet._pose ? cameraFloat() : 0;   // light, it floats a little
      const wob = a.auto === "pudding" && typeof pet !== "undefined" && pose === pet._pose ? puddingWobble(g, cache, grid) : null;   // it wobbles
      const swap = a.auto === "pudding" && typeof pet !== "undefined" && pose === pet._pose ? puddingSwap(g, img, px) : null;   // turning round
      const ptop = wob ? px.reduce((m, p) => Math.min(m, p[1]), 1e9) : 0;
      const body = equip.pajama && typeof PAJAMA !== "undefined" ? PAJAMA[petId].main : PET[petId].pal[PET[petId].body];   // her paws: her own colour, or her onesie's
      // on the base pose the onesie is laid on the frame as it is drawn: ears flicked sideways, feet stepping, a row added
      // or dropped by breathing; a pixel lands only where this frame has her body
      const fg = base && each ? img.grid : null, ear = base && pose ? pose.ear || 0 : 0, tip = PET[petId].tip;
      const on = (x, y) => !fg || (fg[y] && fg[y][x] && !"BK".includes(fg[y][x]));
      // turning to walk the other way mirrors her picture, but not what she wears on one side: the pochette stays at
      // the same hip of hers, so on a mirrored base pose it is mirrored back
      const keepSide = (a.auto === "carry" && base || px.noMirror === true) && g.getTransform().a < 0, fw = (grid[0] || "").length - 1;
      for (const [xs, y, c] of px) {
        const wr = wob && p0(c) ? y - ptop : 9, wk = wr <= 2 ? 1 : wr === 3 ? 0.5 : 0;   // the custard's top swings, its foot less
        const x0 = (keepSide ? fw - xs : xs) + (wk ? Math.round(wob.x * wob.flip * wk) : 0) + (swap ? swap.x : 0), x = x0 + (each && y < tip ? ear : 0);
        // a stretch doubles the row at dup: the onesie covers both copies
        if (each && y === dup && shift > 0 && c !== "clear" && on(x, y)) { g.fillStyle = c === "body" ? body : c === "outline" ? OUT : c; g.fillRect(x, y, 1, 1); }
        const yy = y + (each ? (y >= dup ? shift : 0) : whole) + (lift && c !== CAMERA_PAL.s && c !== CAMERA_PAL.t ? lift : 0) + (wk === 1 && wr <= 1 ? wob.y : 0) + (wob && p0(c) && wr <= 3 ? wob.pop : 0) + (swap ? swap.y : 0);
        if (each && !on(x, yy)) continue;
        if (c === "clear") { g.clearRect(x, yy, 1, 1); continue; }   // her arm, now round the bear
        g.fillStyle = c === "body" ? body : c === "outline" ? OUT : c; g.fillRect(x, yy, 1, 1);
      }
      if (a.auto === "camera" && base && px.box && !lie && !equip.trident) {   // (her trident takes her paws)        // standing or walking she holds it in both paws (her arms go round to it)
        const k = cache.camHold || (cache.camHold = (() => { const { cx, cy } = px.box, o = [];
          for (const [x, y, c] of armOff(grid, cy + 1, cy + 8)) o.push([x, y, c]);
          for (const hx of [cx - 2, cx + 9]) [".KK.", "KWWK", ".KK."].forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== ".") o.push([hx + i, cy + 4 + j, ch === "K" ? "outline" : "body"]); }));
          return o; })());
        for (const [xs, y, c] of k) {
          const x = keepSide ? fw - xs : xs, yy = y + whole + (lift && c !== "clear" && x > px.box.cx - 3 && x < px.box.cx + 13 && y >= px.box.cy + 4 ? lift : 0);
          if (c === "clear") { g.clearRect(x, yy, 1, 1); continue; }
          g.fillStyle = c === "body" ? body : OUT; g.fillRect(x, yy, 1, 1);
        }
      }
      continue;
    }
    if (pose && pose.img) continue;
    const it = itemImg(petId, id);
    g.drawImage(it.img, it.x, it.y + (it.y >= INFO[petId].dup ? dy : 0));   // one piece, moving with where it is worn
  }
}
