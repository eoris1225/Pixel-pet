/* The world behind the pet: a sky that follows the user's local clock (dawn, day, golden hour, sunset, dusk, night),
   sun and a moon in its real phase, stars, drifting clouds (now and then one with a face), birds, a sparrow that
   visits the sign, butterflies, fireflies, swaying grass and flowers, and the wooden sign clock.
   Preview any time of day with ?hour=18.5 and fast-forward with ?speed=600 in the URL. */
"use strict";

const bg = document.getElementById("bg");
const sctx = bg.getContext("2d");

/* ---------- time ---------- */
const QS = new URLSearchParams(location.search);
const T_FIX = QS.has("hour") ? parseFloat(QS.get("hour")) : null;
const T_SPEED = QS.has("speed") ? Math.max(1, parseFloat(QS.get("speed"))) : 1;
const T_START = Date.now();
function worldHour() {
  const run = (Date.now() - T_START) * T_SPEED / 3600000;
  if (T_FIX !== null) return ((T_FIX + run) % 24 + 24) % 24;
  const d = new Date(T_START + (Date.now() - T_START) * T_SPEED);
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

/* ---------- colour helpers ---------- */
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c, a = 1) => a >= 1 ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// the sky in five bands, from straight up down to the horizon, through the day: deep night navy, violet before dawn,
// pink and gold at sunrise, clear blue through the day (deepest at noon), gold in the late afternoon, a purple,
// magenta and orange sunset, indigo dusk
const SKY = [
  [0,    "#0b1030", "#121a44", "#1a2456", "#233064", "#2e3b6e"],
  [4.3,  "#0e1236", "#191d4c", "#28295e", "#3a336c", "#4b3e74"],
  [5.3,  "#1f2558", "#363a78", "#5e5390", "#a26e9c", "#e2939a"],
  [6.1,  "#36579e", "#5b77b8", "#9a94c0", "#eab0a8", "#ffcf9e"],
  [7.2,  "#4a86d4", "#69a2e2", "#8ebcec", "#b8d6f2", "#e2eef5"],
  [11.5, "#2f7fdc", "#4c98e8", "#72b3f0", "#9fcdf6", "#d2e9fb"],
  [15.5, "#3e86d6", "#5c9de2", "#82b5ea", "#acccf0", "#dfe7ef"],
  [17.3, "#4f74c0", "#7590d0", "#a8a9d4", "#e6bcaa", "#ffd198"],
  [18.4, "#353a86", "#5c55a0", "#a76a9e", "#ea8478", "#ffae64"],
  [19.2, "#20275f", "#352f76", "#5c4386", "#8f5582", "#c3687a"],
  [20.2, "#121848", "#1b225a", "#262d68", "#323872", "#3e437a"],
  [24,   "#0b1030", "#121a44", "#1a2456", "#233064", "#2e3b6e"],
].map(([h, ...c]) => [h, ...c.map(hex)]);
function sky5(h) {
  let i = 0; while (i < SKY.length - 2 && SKY[i + 1][0] <= h) i++;
  const a = SKY[i], b = SKY[i + 1], t = smooth(0, 1, (h - a[0]) / (b[0] - a[0]));
  return [1, 2, 3, 4, 5].map(k => mixc(a[k], b[k], t));
}
function skyAt(h) { const c = sky5(h); return [c[0], c[2], c[4]]; }   // top, middle, horizon
// how dark (night) and how warm (sunrise / sunset light) it is
const darkAt = h => 1 - smooth(4.6, 7.0, h) + smooth(18.6, 20.6, h);
const warmAt = h => Math.max(Math.exp(-(((h - 6.2) / 0.9) ** 2)), Math.exp(-(((h - 18.4) / 1.0) ** 2)));

/* ---------- random but stable layout ---------- */
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const STARS = Array.from({ length: 80 }, () => ({ x: rnd() * W, y: rnd(), b: 0.35 + rnd() * 0.65, p: rnd() * 6 }));
const TUFTS = Array.from({ length: 46 }, () => ({ x: rnd() * W, y: rnd(), h: 2 + (rnd() * 3 | 0), p: rnd() * 6 }));
const FLOWERS = Array.from({ length: 16 }, () => ({ x: 4 + rnd() * (W - 8), y: rnd(), c: ["#ffffff", "#ffc4d6", "#ffe58a", "#d9c8ff", "#ffffff"][rnd() * 5 | 0], p: rnd() * 6 }));

let horizon = 210;
const SIGN_X = 26;


/* ---------- clouds ---------- */
// Clouds as in pixel art: no outline, puffs each lit from the sun's side (top left), darker down to a flat shadowed
// base, in five shades taken from the sky at this hour (white and blue-grey by day, gold and violet at sunset, dim
// blue at night; greyer as the weather closes in). Every cloud is a new shape. Three layers drift at their own
// speeds: big banks of cumulus low over the hills, middle clouds, and thin streaks of stratus.
function cloudShape(w0, h0, kind) {
  const R = Math.random, lv = [];
  if (kind === "streak") {
    // a wisp of stratus: a few flat runs stacked like steps, the middle one longest, tapering at the ends
    const rows = [[0.25, 0.75, 0], [0.05, 0.95, 1], [0.15, 0.7, 2]];
    if (R() < 0.5) rows.push([0.4, 0.85, 3]);
    const w = Math.round(w0), h = rows.length, out = new Uint8Array(w * h).fill(255);
    rows.forEach(([a, b, k], y) => { const x0 = Math.round((a + (R() - 0.5) * 0.1) * w), x1 = Math.round((b + (R() - 0.5) * 0.1) * w); for (let x = Math.max(0, x0); x < Math.min(w, x1); x++) out[y * w + x] = k; });
    return { w, h, lv: out };
  }
  // a cumulus as in painted pixel art: flat tones, no shading inside a puff. Its whole bumpy shape in the shadow tone,
  // then the same puffs a little smaller and nudged towards the sun (up and left) in lighter tones, two or three times,
  // so the light catches the tops in layered lobes; a darker flat line along its base
  const circles = [], n = Math.max(3, Math.round(w0 / (kind === "bank" ? 10 : 8)));
  for (let i = 0; i < n; i++) {
    const q = (i + 0.5) / n, cx = q * w0 + (R() - 0.5) * 5, tall = Math.sin(q * Math.PI) ** 0.8;
    const r = Math.max(3, (0.28 + 0.6 * tall) * h0 * (0.7 + R() * 0.4) * 0.6);
    circles.push([cx, -r * (0.7 + R() * 0.25), r]);
    if (tall > 0.5 && R() < 0.85) circles.push([cx + (R() - 0.5) * r * 0.8, -r * (1.3 + R() * 0.3), r * (0.45 + R() * 0.25)]);   // a puff on top
    if (R() < 0.5) circles.push([cx + (R() - 0.5) * r * 1.6, -r * 0.45, r * (0.4 + R() * 0.2)]);                                   // a small one at the side
  }
  // the puffs are lumpy, not round: a little wider than tall, their edge wobbling in and out
  circles.forEach(c => c.push(R() * 6, R() * 6));
  const reach = ([cx, cy, r, p1, p2], x, y, k) => {
    const dx = (x - cx) / 1.18, dy = y - cy, a = Math.atan2(dy, dx), rr = r * k * (1 + 0.13 * Math.sin(3 * a + p1) + 0.08 * Math.sin(5 * a + p2));
    return dx * dx + dy * dy <= rr * rr;
  };
  let x0 = 1e9, x1 = -1e9, y0 = 1e9;
  for (const [cx, cy, r] of circles) { x0 = Math.min(x0, cx - r * 1.4); x1 = Math.max(x1, cx + r * 1.4); y0 = Math.min(y0, cy - r * 1.25); }
  const w = Math.ceil(x1 - x0) + 2, h = Math.ceil(-y0) + 1, ox = x0 - 1, oy = y0;
  const inAny = (x, y, k, dx, dy) => circles.some(c => reach(c, x + 0.5 + ox - dx, y + 0.5 + oy - dy, k));
  const out = new Uint8Array(w * h).fill(255);
  // [size, shift x, shift y, tone]: the light from above and a little left, so the lit tops are broad and the shade
  // gathers along the underside
  const layers = [[1, 0, 0, 3], [0.9, -0.8, -2.2, 2], [0.72, -1.6, -4, 1], [0.48, -2.2, -5.6, 0]];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!inAny(x, y, 1, 0, 0) || y + oy > 0) continue;
    let k = 3;
    for (const [sz, dx, dy, t] of layers.slice(1)) if (inAny(x, y, sz, dx, dy)) k = t;
    if (y === h - 1 || (y === h - 2 && R() < 0.3)) k = 4;           // the base in shadow
    out[y * w + x] = k;
  }
  return { w, h, lv: out };
}
// the five shades for this hour and weather: lit tops to shadowed bases
const CLOUD_KEYS = [   // [hour, lit, shadow]   (tones between them: lit tops, shadowed base)
  [0, "#7e86bc", "#222858"], [4.6, "#8a86bc", "#2a2a5e"], [5.5, "#ffc2c0", "#6a5c9c"], [6.4, "#fff0d8", "#9a9ccc"],
  [7.6, "#ffffff", "#a7bddc"], [15.8, "#ffffff", "#a9bcd6"], [17.4, "#fff4dc", "#b2a6c8"], [18.4, "#ffc79c", "#73609a"],
  [19.2, "#e6a0aa", "#45407a"], [20.2, "#8c90c6", "#272c5e"], [24, "#7e86bc", "#222858"],
].map(([h, a, b]) => [h, hex(a), hex(b)]);
function cloudPal(h) {
  let i = 0; while (i < CLOUD_KEYS.length - 2 && CLOUD_KEYS[i + 1][0] <= h) i++;
  const A = CLOUD_KEYS[i], B = CLOUD_KEYS[i + 1], t = smooth(0, 1, (h - A[0]) / (B[0] - A[0]));
  let lit = mixc(A[1], B[1], t), sh = mixc(A[2], B[2], t);
  const wx = typeof WX !== "undefined" ? WX : null, d = darkAt(h);
  if (wx && wx.cover > 0.05) {                                    // overcast: greyer, and darker under storm clouds
    const g = Math.min(1, wx.cover * 0.9);
    lit = mixc(lit, mixc(hex("#e2e5ea"), hex("#5a6078"), d), g * (0.55 + wx.storm * 0.3));
    sh = mixc(sh, mixc(hex(wx.storm > 0.5 ? "#5d6476" : "#8a92a4"), hex("#262a44"), d), g * (0.6 + wx.storm * 0.3));
  }
  return [0, 0.22, 0.46, 0.72, 1].map(q => mixc(lit, sh, q));
}
function paintCloud(c, pal) {
  const { w, h, lv } = c.shape;
  if (!c.cv) { c.cv = document.createElement("canvas"); c.cv.width = w; c.cv.height = h; }
  const g = c.cv.getContext("2d"), img = g.createImageData(w, h);
  for (let i = 0; i < w * h; i++) { const k = lv[i]; if (k === 255) continue; const col = pal[k]; img.data[i * 4] = col[0]; img.data[i * 4 + 1] = col[1]; img.data[i * 4 + 2] = col[2]; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
}
const CLOUD_LAYERS = {
  bank:   { w: [70, 130], h: [28, 48], v: [0.5, 1.1] },
  mid:    { w: [30, 72],  h: [14, 28], v: [1.8, 3.4] },
  streak: { w: [26, 80],  h: [3, 5],   v: [3, 5.5] },
};
function newCloud(kind, x) {
  const L = CLOUD_LAYERS[kind], R = (a) => a[0] + Math.random() * (a[1] - a[0]);
  const w = Math.round(R(L.w)), h = Math.round(R(L.h));
  const y = kind === "bank" ? horizon - 12 - h + Math.random() * 8 : kind === "mid" ? 26 + Math.random() * Math.max(30, horizon - 110) : 16 + Math.random() * Math.max(30, horizon - 70);
  return { kind, x: x === undefined ? -w - Math.random() * 40 : x, y, v: R(L.v), shape: cloudShape(w, h, kind), cv: null, key: "" };
}
const clouds = [];
// how many of each there are: a little different every couple of hours, and more as the weather clouds over
function cloudWant() {
  const cover = typeof WX !== "undefined" ? WX.cover : 0, b = Math.floor(worldHour() / 2), base = 0.5 + 0.5 * Math.sin(b * 2.3 + 1);
  return { bank: Math.round(1 + base * 2 + cover * 2), mid: Math.round(1 + base * 2 + cover * 5), streak: Math.round(1 + (1 - cover) * 2 + warmAt(worldHour()) * 3) };
}
let cloudsReady = false;
function seedClouds() {
  const want = cloudWant();
  for (const k in want) for (let i = 0; i < want[k]; i++) clouds.push(newCloud(k, Math.random() * (W + 60) - 60));
  cloudsReady = true;
}
// the cloud with a face that floats by now and then (and says hello)
const FACE_SHAPE = [[11,13,8],[22,10,11],[34,12,9],[44,15,6],[16,17,6],[30,17,7]];
function renderCloud(circles, fill, shade, rim, face) {
  let x1 = 0, y1 = 0;
  circles.forEach(([x, y, r]) => { x1 = Math.max(x1, x + r + 2); y1 = Math.max(y1, y + r + 2); });
  const w = Math.ceil(x1), h = Math.ceil(y1);
  const inside = (x, y) => circles.some(([cx, cy, r]) => (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"), img = g.createImageData(w, h);
  let top = h, bot = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x, y)) { top = Math.min(top, y); bot = Math.max(bot, y); }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!inside(x, y)) continue;
    const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
    const lower = (y - top) / Math.max(1, bot - top) > 0.62 + 0.08 * Math.sin(x * 0.7);
    const col = edge ? rim : lower ? shade : fill;
    const i = (y * w + x) * 4;
    img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  if (face) {                                   // sleepy happy eyes and a little smile, like the clouds in the sketch
    const cx = w / 2 | 0, cy = (top + bot) / 2 + 1 | 0;
    g.fillStyle = "#6a6f8e";
    g.fillRect(cx - 7, cy, 3, 1); g.fillRect(cx - 8, cy - 1, 1, 1); g.fillRect(cx - 4, cy - 1, 1, 1);
    g.fillRect(cx + 5, cy, 3, 1); g.fillRect(cx + 4, cy - 1, 1, 1); g.fillRect(cx + 8, cy - 1, 1, 1);
    g.fillRect(cx - 1, cy + 3, 3, 1); g.fillRect(cx - 2, cy + 2, 1, 1); g.fillRect(cx + 2, cy + 2, 1, 1);
    g.fillStyle = "rgba(255,150,180,0.55)"; g.fillRect(cx - 11, cy + 2, 3, 2); g.fillRect(cx + 9, cy + 2, 3, 2);
  }
  return c;
}
let cloudImgs = [], faceImg = null, cloudKey = "";
function cloudColors(h) {
  const d = darkAt(h), wm = warmAt(h);
  const day = { f: hex("#ffffff"), s: hex("#dbe8f6"), r: hex("#c5d8ee") };
  const warm = { f: hex("#fff0e6"), s: hex("#f6bfb3"), r: hex("#eaa49c") };
  const night = { f: hex("#646ca4"), s: hex("#4f568e"), r: hex("#454b82") };
  const pick = k => mixc(mixc(day[k], warm[k], wm * 0.85), night[k], d * 0.92);
  return [pick("f"), pick("s"), pick("r")];
}
let faceCloud = null, nextFace = performance.now() + 25000;

/* ---------- critters ---------- */
let flock = null, nextFlock = performance.now() + 6000;
let star = null, nextStar = performance.now() + 9000;
let flies = Array.from({ length: 12 }, () => ({ x: rnd() * W, y: 0, vx: 0, vy: 0, p: rnd() * 6 }));
let fly = null, nextFly = performance.now() + 15000;               // a butterfly
let sparrow = null, nextSparrow = performance.now() + 30000;       // visits the sign
const SPARROW = [
  [".KKK..", "KNNNKO", "KNWNNK", ".KNNNK", "..K.K."],               // perched
  [".KKK..", "KNNNKO", "KNWNNK", ".KNNNK", "..KK.."],               // pecking (head lower is implied by the hop)
];
const SPARROW_PAL = { K: OUT, N: "#b88a64", W: "#fff4e6", O: "#f2a33a" };
const SPARROW_IMG = SPARROW.map(g => gridToCanvas(g.map(r => r.replace(/\./g, "B")), SPARROW_PAL));

/* ---------- cached sky + land ---------- */
const skyCv = document.createElement("canvas"), skyG = skyCv.getContext("2d");
const landCv = document.createElement("canvas"), landG = landCv.getContext("2d");
let cacheKey = "";
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);

function sceneResize() {
  horizon = FEET - 46;
  bg.width = W; bg.height = H;
  skyCv.width = W; skyCv.height = H; landCv.width = W; landCv.height = H;
  cacheKey = "";
  STARS.forEach(s => s.yy = 4 + s.y * (horizon - 30));
  TUFTS.forEach(t => t.yy = horizon + 6 + t.y * (H - horizon - 8));
  FLOWERS.forEach(f => f.yy = horizon + 10 + f.y * (FEET - horizon + 8));
  TUFTS.sort((a, b) => a.yy - b.yy);
}

function lit(c, h, haze = 0, skyH = null) {
  let x = hex(c);
  if (haze && skyH) x = mixc(x, skyH, haze);
  x = mixc(x, hex("#ff9e72"), warmAt(h) * 0.16);
  x = mixc(x, hex("#1b2648"), darkAt(h) * 0.64);
  return x;
}
const ridge = (x, base, parts) => base + parts.reduce((a, [amp, f, p]) => a + amp * Math.sin(x * f + p), 0);

// in flat bands, as in pixel art: each of the five steps split in three, with an ordered dither where two bands meet
const SKY_AT = [0, 0.3, 0.56, 0.8, 1];
function paintSky(h) {
  const c5 = sky5(h), pal = [];
  for (let k = 0; k < 4; k++) for (let j = 0; j < 3; j++) pal.push(mixc(c5[k], c5[k + 1], j / 3));
  pal.push(c5[4]);
  const img = skyG.createImageData(W, H), N = pal.length - 1;
  for (let y = 0; y < H; y++) {
    const t = Math.min(1, y / horizon);
    let k = 0; while (k < 3 && SKY_AT[k + 1] <= t) k++;
    const f = (k + (t - SKY_AT[k]) / (SKY_AT[k + 1] - SKY_AT[k])) * 3, i0 = Math.min(N, Math.floor(f)), fr = f - i0;
    for (let x = 0; x < W; x++) {
      const c = pal[Math.min(N, fr > BAYER[(y & 3) * 4 + (x & 3)] ? i0 + 1 : i0)];
      const i = (y * W + x) * 4; img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
    }
  }
  skyG.putImageData(img, 0, 0);
}
// the meadow under the sky: far hills hazy with the sky's colour, a line of trees, a rounder near hill, all with their
// crests catching the light (gold and pink at sunrise and sunset), and the grass in front textured with little strokes
// of light and shade that get bigger towards you, as in painted pixel landscapes
let lseed = 11;
const lrng = () => (lseed = (lseed * 48271) % 2147483647) / 2147483647;
const STROKES = Array.from({ length: 260 }, () => ({ x: lrng(), y: lrng(), l: lrng(), k: lrng() }));
function paintLand(h) {
  const g = landG, skyLow = skyAt(h)[2], wm = warmAt(h);
  g.clearRect(0, 0, W, H);
  const fill = (fn, col) => { g.fillStyle = css(col); for (let x = 0; x < W; x++) { const y = Math.round(fn(x)); g.fillRect(x, y, 1, H - y); } };
  const crest = (fn, col, n = 1) => { g.fillStyle = css(col); for (let x = 0; x < W; x++) g.fillRect(x, Math.round(fn(x)), 1, n); };
  const sunlit = (c, haze, k = 0.6) => mixc(lit(c, h, haze, skyLow), hex("#ffcf8a"), wm * k * (1 - darkAt(h)));   // a crest in the low sun
  const far = x => ridge(x, horizon - 17, [[5, 0.035, 1], [3, 0.09, 2]]);
  const mid = x => ridge(x, horizon - 7, [[4, 0.05, 4], [2, 0.12, 0]]);
  const near = x => ridge(x, horizon + 2, [[1.5, 0.08, 1]]);
  fill(far, lit("#a9d6c8", h, 0.5, skyLow));
  crest(far, sunlit("#cdeadb", 0.45));
  // little round trees on the far hill
  [[132, 3], [141, 4], [150, 3], [22, 3]].forEach(([tx, r]) => {
    const y = Math.round(far(tx));
    g.fillStyle = css(lit("#8a7a6c", h, 0.4, skyLow)); g.fillRect(tx, y - 3, 1, 4);
    g.fillStyle = css(lit("#86c39a", h, 0.4, skyLow));
    for (let dy = -r; dy <= r; dy++) { const hw = Math.round(Math.sqrt(r * r - dy * dy)); g.fillRect(tx - hw, y - 4 - r + dy, hw * 2 + 1, 1); }
    g.fillStyle = css(sunlit("#a9dbb3", 0.35)); g.fillRect(tx - Math.round(r * 0.6), y - 4 - r * 2 + 1, Math.round(r), 1);   // lit on top
  });
  fill(mid, lit("#8fcf9e", h, 0.22, skyLow));
  crest(mid, sunlit("#b8e6bf", 0.18));
  // the mid hill shades a little into its dip behind the near one
  g.fillStyle = css(lit("#7fc291", h, 0.22, skyLow)); for (let x = 0; x < W; x++) { const y0 = Math.round(near(x)) - 3; if (Math.round(mid(x)) < y0) g.fillRect(x, y0, 1, 3); }
  fill(near, lit("#80c886", h));
  crest(near, sunlit("#b2e5a6", 0, 0.7));
  // the meadow gets a touch deeper towards the front, in dithered steps
  const deep = lit("#6cb575", h);
  for (let y = horizon + 18; y < H; y++) {
    const q = Math.min(1, (y - horizon - 18) / 60);
    for (let x = 0; x < W; x++) if (q > BAYER[(y & 3) * 4 + (x & 3)]) { g.fillStyle = css(deep); g.fillRect(x, y, 1, 1); }
  }
  // strokes of light (the sun's side) and shade in the grass, small far off and longer close by
  const hi = sunlit("#a7dc9c", 0, 0.5), lo = lit("#5ea86a", h), top = horizon + 6;
  for (const st of STROKES) {
    const y = Math.round(top + st.y * st.y * (H - top)), near_ = (y - top) / (H - top), len = 1 + Math.round(st.l * (1 + near_ * 5));
    g.fillStyle = css(st.k < 0.55 ? hi : lo); g.fillRect(Math.round(st.x * W), y, len, 1);
  }
}

/* ---------- update ---------- */
let wind = 1;
function sceneUpdate(now, dt) {
  const s = dt / 1000, h = worldHour(), dark = darkAt(h);
  wind = (0.8 + 0.5 * Math.sin(now / 9000) + 0.2 * Math.sin(now / 2300)) * (typeof weatherWind === "function" ? weatherWind() : 1);
  const foul = typeof WX !== "undefined" && (WX.rain > 0.2 || WX.snow > 0.3 || WX.storm > 0.3);   // birds and butterflies keep out of the rain
  if (!cloudsReady && horizon) seedClouds();
  const want = cloudWant(), have = {};
  for (let i = clouds.length - 1; i >= 0; i--) {
    const c = clouds[i];
    c.x += c.v * s * (0.8 + wind * 0.3);
    if (c.x > W + 4) {                                        // off the right: a new one comes in on the left (or not, as the sky clears)
      if ((have[c.kind] || 0) >= want[c.kind]) { clouds.splice(i, 1); continue; }
      clouds[i] = newCloud(c.kind);
    }
    have[c.kind] = (have[c.kind] || 0) + 1;
  }
  for (const k in want) for (let n = have[k] || 0; n < want[k]; n++) clouds.push(newCloud(k));   // more drifting in
  if (!faceCloud && now > nextFace) { faceCloud = { x: -60, y: 34 + rnd() * 26, v: 5.5, t0: now }; }
  if (faceCloud) { faceCloud.x += faceCloud.v * s; if (faceCloud.x > W + 8) { faceCloud = null; nextFace = now + 90000 + rnd() * 120000; } }

  if (!flock && now > nextFlock && dark < 0.45 && !foul) {
    const dir = rnd() < 0.5 ? 1 : -1, n = 2 + (rnd() * 4 | 0);
    flock = { dir, x: dir > 0 ? -20 : W + 20, y: 40 + rnd() * 70, v: 16 + rnd() * 8,
      birds: Array.from({ length: n }, (_, i) => ({ dx: -i * 7 * dir + rnd() * 3, dy: (i % 2 ? 4 : -2) * Math.ceil(i / 2) + rnd() * 2, p: rnd() * 6 })) };
  }
  if (flock) { flock.x += flock.dir * flock.v * s; if (flock.x < -60 || flock.x > W + 60) { flock = null; nextFlock = now + 22000 + rnd() * 30000; } }

  if (!star && now > nextStar && dark > 0.7) star = { x: 20 + rnd() * 140, y: 8 + rnd() * 50, vx: -70 - rnd() * 40, vy: 30 + rnd() * 15, t: 0 };
  if (star) { star.t += dt; star.x += star.vx * s; star.y += star.vy * s; if (star.t > 900) { star = null; nextStar = now + 12000 + rnd() * 26000; } }

  for (const f of flies) {
    f.vx += (rnd() - 0.5) * 18 * s; f.vy += (rnd() - 0.5) * 14 * s; f.vx *= 0.98; f.vy *= 0.98;
    f.x = (f.x + f.vx * s + W) % W; if (!f.y) f.y = horizon + rnd() * (FEET - horizon);
    f.y = Math.max(horizon - 20, Math.min(FEET + 6, f.y + f.vy * s));
  }

  if (!fly && now > nextFly && dark < 0.3 && !foul) fly = { x: -6, y: FEET - 30, base: FEET - 26 - rnd() * 30, t: 0, c: ["#ffd84d", "#ffffff", "#ffb3c7", "#c6b5ff"][rnd() * 4 | 0] };
  if (fly) { fly.t += dt; fly.x += 12 * s; fly.y = fly.base + Math.sin(fly.t / 600) * 8 + Math.sin(fly.t / 170) * 2; if (fly.x > W + 6) { fly = null; nextFly = now + 30000 + rnd() * 40000; } }

  // a sparrow flies to the sign, hops and pecks for a while, then leaves
  const sx = SIGN_X + 4, sy = FEET - 36;          // standing on the top edge of the sign board
  if (!sparrow && now > nextSparrow && dark < 0.4 && !foul) sparrow = { st: "in", x: W + 8, y: 50, t: 0, stay: 6000 + rnd() * 6000 };
  if (sparrow) {
    const b = sparrow; b.t += dt;
    if (b.st === "in") {
      const dx = sx - b.x, dy = sy - b.y, d = Math.hypot(dx, dy), step = 40 * s;
      if (d <= step) { b.x = sx; b.y = sy; b.st = "sit"; b.t = 0; } else { b.x += dx / d * step; b.y += dy / d * step; }
    } else if (b.st === "sit" && b.t > b.stay) { b.st = "out"; b.t = 0; }
    else if (b.st === "out") { b.x -= 42 * s; b.y -= 24 * s; if (b.x < -10) { sparrow = null; nextSparrow = now + 50000 + rnd() * 70000; } }
  }
}

/* ---------- drawing ---------- */
// the sun and the moon as in pixel art: a flat disc with a lighter core and a darker rim, inside stepped rings of glow.
// Their size changes a little from day to day: the sun a touch bigger in winter (when the earth is nearest it), the
// moon bigger near perigee (its "supermoon"), and both bigger low on the horizon
const dayNum = () => (typeof gameDate === "function" ? gameDate() : new Date()).getTime() / 86400000;
function rings(g, x, y, r, col, a) { for (let k = 3; k >= 1; k--) { g.fillStyle = css(col, a * (4 - k) / 3); disc(g, x, y, r + k * 3 + 1); } }
function drawSun(h, g) {
  if (h < 5.3 || h > 19.6) return;
  const p = (h - 6) / 13, x = 12 + (W - 24) * Math.max(-0.05, Math.min(1.05, p));
  const alt = Math.sin(Math.PI * Math.max(0, Math.min(1, p))), y = horizon - 6 - alt * (horizon - 50), low = 1 - alt;
  const doy = (dayNum() % 365.25) / 365.25, r = Math.round(6 + 0.8 * Math.cos(2 * Math.PI * doy) + low * 1.6);
  const core = mixc(hex("#fffbe6"), hex("#ffc27a"), low), mid = mixc(hex("#fff0b0"), hex("#ffa25c"), low), rim = mixc(hex("#ffd977"), hex("#ff7e4e"), low);
  rings(g, x, y, r, mixc(hex("#fff3c4"), hex("#ffb27a"), low), 0.09 + low * 0.08);
  g.fillStyle = css(rim); disc(g, x, y, r);
  g.fillStyle = css(mid); disc(g, x - 0.5, y - 0.5, r - 1);
  g.fillStyle = css(core); disc(g, x - 1, y - 1, Math.max(1, r - 3));
}
function disc(g, cx, cy, r) {
  cx = Math.round(cx); cy = Math.round(cy);
  for (let dy = -r; dy <= r; dy++) { const hw = Math.round(Math.sqrt(r * r - dy * dy)); g.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1); }
}
function moonPhase() { return (((Date.now() / 86400000 - 10962.76) % 29.530588853) + 29.530588853) % 29.530588853 / 29.530588853; }
// the moon is up every night (in its real phase): the lit part pale gold with grey seas and a bright rim towards the
// light, the dark part dim blue (it still shows against the sky, earthshine), in a soft glow that grows as it fills
const MOON_SEAS = [[-0.35, -0.25, 0.28], [0.15, -0.4, 0.2], [0.25, 0.2, 0.3], [-0.2, 0.35, 0.18], [0.45, -0.05, 0.12]];
function drawMoon(h, g) {
  const t = h >= 18 ? h - 18 : h + 6;                 // 18:00 -> 0, 06:00 -> 12
  if (t < 0.4 || t > 12.8) return;
  const p = (t - 0.4) / 12.4, x = Math.round(W - 18 - (W - 36) * p), alt = Math.sin(Math.PI * p), y = Math.round(horizon - 10 - alt * (horizon - 56));
  const ph = moonPhase(), k = Math.cos(2 * Math.PI * ph), full = (1 - k) / 2;
  const peri = Math.cos(2 * Math.PI * ((dayNum() - 10962.3) / 27.5545)), r = Math.round(7 + 1.2 * peri + (1 - alt) * 1.2);
  const vis = smooth(0.15, 0.55, darkAt(h)); if (vis <= 0.02) return;   // pale and then gone as day comes on
  g.save(); g.globalAlpha = vis;
  rings(g, x, y, r, hex("#fff2cf"), 0.04 + full * 0.08);
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (dx * dx + dy * dy > r * r + 0.5) continue;
    const sq = Math.sqrt(Math.max(0, 1 - (dy / r) ** 2)), xn = (dx + 0.5) / r;
    const on = ph < 0.5 ? xn > sq * k : xn < -sq * k;
    let c;
    if (!on) c = "#3a4378";
    else {
      const sea = MOON_SEAS.some(([sx, sy, sr]) => (dx / r - sx) ** 2 + (dy / r - sy) ** 2 < sr * sr);
      const rimLit = dx * dx + dy * dy > (r - 1.2) ** 2 && (ph < 0.5 ? dx > 0 : dx < 0);
      c = rimLit ? "#fffaf0" : sea ? "#ddd2b0" : "#f6ecd0";
    }
    g.fillStyle = c; g.fillRect(x + dx, y + dy, 1, 1);
  }
  g.restore();
}
const BIRD = [["X...X", ".X.X.", "..X.."], ["..X..", ".X.X.", "X...X"]];
function drawGlyph(g, rows, x, y, col) { g.fillStyle = col; rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === "X") g.fillRect(Math.round(x) + i, Math.round(y) + j, 1, 1); }); }

let lastSign = null;                                    // what the sign showed this frame, to draw it again over a pet behind it
function drawSign(g, now, h, info, over = false) {
  const bx = SIGN_X - 14, base = FEET - 4, by = base - 27, bw = 29, bh = 15;
  const glow = darkAt(h);
  if (!over) groundShadow(g, SIGN_X + 1, base + 1, 14, 0.8);
  if (glow > 0.3 && !over) { for (let r = 26, a = 0.035 * glow; r >= 12; r -= 5) { g.fillStyle = `rgba(255,214,140,${a})`; disc(g, SIGN_X, by + 7, r); } }
  const shade = c => css(mixc(hex(c), hex("#1b2648"), glow * 0.35));
  g.fillStyle = OUT; g.fillRect(SIGN_X - 2, by + bh, 4, base - by - bh + 1);
  g.fillStyle = shade("#a8714a"); g.fillRect(SIGN_X - 1, by + bh, 2, base - by - bh);
  g.fillStyle = OUT; g.fillRect(bx + 1, by, bw - 2, bh); g.fillRect(bx, by + 1, bw, bh - 2);
  g.fillStyle = shade("#c98f5e"); g.fillRect(bx + 1, by + 1, bw - 2, bh - 2);
  g.fillStyle = shade("#f6dcb0"); g.fillRect(bx + 3, by + 3, bw - 6, bh - 6);
  g.fillStyle = shade("#a8714a"); g.fillRect(bx + 1, by + bh - 2, bw - 2, 1);
  const s = info.text, mode = info.mode;
  text(s, SIGN_X - (tw(s) >> 1), by + 5, mode === "run" ? "#d0485a" : mode === "rest" ? "#6a63b8" : OUT, g);
  if (mode === "run" && Math.floor(now / 600) % 2) { g.fillStyle = "#e2504a"; g.fillRect(SIGN_X - 1, by - 3, 3, 2); g.fillRect(SIGN_X, by - 4, 1, 4); }
  if (mode === "rest") text("Z", bx + bw - 4, by - 6 - (Math.floor(now / 500) % 2), "#6a63b8", g);
  // a few blades of grass around the post
  g.fillStyle = css(lit("#5fae6b", h));
  [[-4, 3], [-3, 2], [3, 2], [4, 3]].forEach(([dx, hh]) => g.fillRect(SIGN_X + dx, base - hh + 1, 1, hh));
}

function drawSparrow(g, now) {
  if (!sparrow) return;
  const b = sparrow, flying = b.st !== "sit";
  const hop = !flying && Math.floor(b.t / 700) % 4 === 1 ? -1 : 0, peck = !flying && Math.floor(b.t / 400) % 5 === 2;
  const im = SPARROW_IMG[peck ? 1 : 0];
  g.save();                                           // drawn facing right; flipped while she flies leftwards
  if (flying) { g.translate(Math.round(b.x) + im.width, 0); g.scale(-1, 1); g.drawImage(im, 0, Math.round(b.y)); }
  else g.drawImage(im, Math.round(b.x), Math.round(b.y) + hop + (peck ? 1 : 0));
  g.restore();
  if (flying) { g.fillStyle = "#b88a64"; const up = Math.floor(now / 90) % 2; g.fillRect(Math.round(b.x) + 2, Math.round(b.y) + (up ? -1 : 2), 3, 1); }
}
// the sign (and a sparrow on it) once more, over a pet who has walked behind it
function drawSignOver(g, now) {
  if (!lastSign) return;
  drawSign(g, now, lastSign.h, lastSign.info, true);
  if (typeof weatherCap === "function") weatherCap(g, lastSign.h);
  drawSparrow(g, now);
}

function sceneRender(now, signInfo) {
  const h = worldHour(), dark = darkAt(h);
  const key = (Math.round(h * 60)) + ":" + H;          // the sky and land are repainted once a game-minute
  if (key !== cacheKey) { cacheKey = key; paintSky(h); paintLand(h); }
  const ck = Math.round(h * 12) + "";
  if (ck !== cloudKey) { cloudKey = ck; const [f, s, r] = cloudColors(h); faceImg = renderCloud(FACE_SHAPE, f, s, r, true); }
  const pal = cloudPal(h), pk = pal.map(c => c.map(v => v | 0).join(",")).join("|");
  const g = sctx;
  g.imageSmoothingEnabled = false;
  g.drawImage(skyCv, 0, 0);
  // stars
  if (dark > 0.05) for (const st of STARS) {
    const tw_ = 0.55 + 0.45 * Math.sin(now / 700 + st.p * 3);
    const a = dark * st.b * tw_ * (typeof WX !== "undefined" ? 1 - WX.cover * 0.9 : 1); if (a < 0.08) continue;
    g.fillStyle = `rgba(255,250,230,${a.toFixed(2)})`;
    const x = Math.round(st.x), y = Math.round(st.yy);
    g.fillRect(x, y, 1, 1);
    if (st.b > 0.9 && tw_ > 0.8) { g.fillStyle = `rgba(255,250,230,${(a * 0.5).toFixed(2)})`; g.fillRect(x - 1, y, 1, 1); g.fillRect(x + 1, y, 1, 1); g.fillRect(x, y - 1, 1, 1); g.fillRect(x, y + 1, 1, 1); }
  }
  if (star) {
    const a = 1 - star.t / 900;
    for (let i = 0; i < 12; i++) { g.fillStyle = `rgba(255,255,240,${(a * (1 - i / 12)).toFixed(2)})`; g.fillRect(Math.round(star.x - star.vx / 90 * i * 0.5), Math.round(star.y - star.vy / 90 * i * 0.5), 1, 1); }
  }
  // the banks low over the hills, then birds, then the middle clouds and the streaks
  const drawC = c => { if (c.key !== pk) { c.key = pk; paintCloud(c, pal); } g.globalAlpha = c.kind === "streak" ? 0.85 : 1; g.drawImage(c.cv, Math.round(c.x), Math.round(c.y)); g.globalAlpha = 1; };
  clouds.filter(c => c.kind === "bank").forEach(drawC);
  drawSun(h, g);                                       // (over the low banks; the middle clouds and streaks can drift across it)
  drawMoon(h, g);
  if (flock) {
    const col = css(mixc(hex("#5b6280"), hex("#3a2a40"), warmAt(h)));
    flock.birds.forEach(b => {
      const fl = Math.floor(now / 160 + b.p) % 2, bx = flock.x + b.dx, by = flock.y + b.dy + Math.sin(now / 500 + b.p) * 2;
      drawGlyph(g, BIRD[fl], bx, by, col);
    });
  }
  clouds.filter(c => c.kind === "mid").forEach(drawC);
  clouds.filter(c => c.kind === "streak").forEach(drawC);
  if (faceCloud && faceImg) g.drawImage(faceImg, Math.round(faceCloud.x), Math.round(faceCloud.y + Math.sin(now / 900) * 1.5));
  if (typeof weatherSky === "function") weatherSky(g, now, h);   // overcast, grey clouds, a rainbow
  g.drawImage(landCv, 0, 0);
  if (typeof weatherLand === "function") weatherLand(g, now, h);   // wet grass, snow
  // grass tufts and flowers sway in the wind
  const blade = css(lit("#5fae6b", h)), bladeHi = css(lit("#a8e0a2", h));
  for (const t of TUFTS) {
    const sw = Math.round(Math.sin(now / 900 + t.x * 0.15 + t.p) * wind * 0.9);
    const x = Math.round(t.x), y = Math.round(t.yy);
    g.fillStyle = blade; g.fillRect(x, y - t.h + 1, 1, t.h); g.fillRect(x + 2, y - t.h + 2, 1, t.h - 1); g.fillRect(x - 2, y - t.h + 2, 1, t.h - 1);
    g.fillStyle = bladeHi; g.fillRect(x + sw, y - t.h, 1, 1);
  }
  for (const f of FLOWERS) {
    const sw = Math.round(Math.sin(now / 1100 + f.p) * wind * 0.8), x = Math.round(f.x), y = Math.round(f.yy);
    g.fillStyle = blade; g.fillRect(x, y - 3, 1, 3);
    const c = css(lit(f.c, h)), cx = x + sw, cy = y - 5;
    g.fillStyle = c; g.fillRect(cx - 1, cy, 3, 1); g.fillRect(cx, cy - 1, 1, 3);
    g.fillStyle = css(lit("#ffcf5a", h)); g.fillRect(cx, cy, 1, 1);
  }
  if (typeof weatherFog === "function") weatherFog(g, now, h);
  drawSign(g, now, h, signInfo);
  if (typeof weatherCap === "function") weatherCap(g, h);
  lastSign = { h, info: signInfo };
  drawSparrow(g, now);
  if (fly) {
    const open = Math.floor(now / 140) % 2, x = Math.round(fly.x), y = Math.round(fly.y);
    g.fillStyle = OUT; g.fillRect(x, y, 1, 2);
    g.fillStyle = fly.c; if (open) { g.fillRect(x - 2, y - 1, 2, 2); g.fillRect(x + 1, y - 1, 2, 2); } else { g.fillRect(x - 1, y - 1, 1, 2); g.fillRect(x + 1, y - 1, 1, 2); }
  }
  if (dark > 0.5) for (const f of flies) {
    const a = Math.max(0, Math.sin(now / 600 + f.p * 4)) * (dark - 0.5) * 2;
    if (a < 0.1) continue;
    g.fillStyle = `rgba(230,255,140,${(a * 0.35).toFixed(2)})`; g.fillRect(Math.round(f.x) - 1, Math.round(f.y) - 1, 3, 3);
    g.fillStyle = `rgba(245,255,170,${a.toFixed(2)})`; g.fillRect(Math.round(f.x), Math.round(f.y), 1, 1);
  }
}

// speech from the world (the passing cloud) in game pixels, for the HTML layer
function sceneSpeech(now) {
  if (!faceCloud || !faceImg) return null;
  const x = faceCloud.x + faceImg.width / 2;
  if (x < 20 || x > W - 10) return null;
  return { x, y: faceCloud.y - 2, text: "지나가유~" };
}
