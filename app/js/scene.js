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

// sky: [hour, top, middle, horizon]
const SKY = [
  [0,    "#161b40", "#232a5a", "#363d78"],
  [4.0,  "#1a1f4a", "#2a3066", "#454986"],
  [5.2,  "#2d3370", "#5b5896", "#c48bb0"],
  [6.0,  "#5a6cad", "#c69ac0", "#ffc0a0"],
  [7.0,  "#82b1e3", "#cfe0f2", "#ffe2c6"],
  [9.0,  "#88caf3", "#bde5fb", "#e9f7ff"],
  [12.0, "#7bc1f0", "#b3e0fa", "#e2f4ff"],
  [15.5, "#84c2ee", "#bee0f6", "#f4efdc"],
  [17.2, "#8eb1e2", "#e6c2c9", "#ffd3a6"],
  [18.3, "#7c84c6", "#f0a2ae", "#ffb589"],
  [19.0, "#5a5e9e", "#b885b4", "#f3a39a"],
  [19.8, "#33386f", "#5c5690", "#8f72a6"],
  [21.0, "#1e2452", "#2c3366", "#414784"],
  [24.0, "#161b40", "#232a5a", "#363d78"],
].map(([h, ...c]) => [h, ...c.map(hex)]);
function skyAt(h) {
  let i = 0; while (i < SKY.length - 2 && SKY[i + 1][0] <= h) i++;
  const a = SKY[i], b = SKY[i + 1], t = smooth(0, 1, (h - a[0]) / (b[0] - a[0]));
  return [mixc(a[1], b[1], t), mixc(a[2], b[2], t), mixc(a[3], b[3], t)];
}
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
const CLOUD_SHAPES = [
  [[10,8,6],[18,6,8],[27,8,6],[34,10,4]],
  [[8,7,5],[15,5,7],[23,7,5]],
  [[9,9,6],[18,6,9],[29,7,7],[38,10,5],[46,11,3]],
  [[7,6,4],[13,5,5],[19,6,4]],
  [[10,10,7],[21,7,10],[33,9,8],[43,12,5]],
];
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
const clouds = [];
function newCloud(x, layer) {
  const far = layer === 0;
  return { tpl: rnd() * CLOUD_SHAPES.length | 0, x, y: (far ? 22 : 46) + rnd() * Math.max(40, horizon - (far ? 90 : 110)), v: far ? 1.3 + rnd() * 0.8 : 2.6 + rnd() * 1.6, layer };
}
for (let i = 0; i < 7; i++) clouds.push(newCloud(rnd() * W, i < 3 ? 0 : 1));
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

function paintSky(h) {
  const [top, mid, low] = skyAt(h);
  const img = skyG.createImageData(W, H), N = 10;
  const band = y => { const t = Math.min(1, y / horizon); return t < 0.55 ? mixc(top, mid, t / 0.55) : mixc(mid, low, (t - 0.55) / 0.45); };
  const pal = []; for (let k = 0; k <= N; k++) pal.push(band(k / N * horizon));
  for (let y = 0; y < H; y++) {
    const f = Math.min(1, y / horizon) * N, k = Math.floor(f), fr = f - k;
    for (let x = 0; x < W; x++) {
      const c = pal[Math.min(N, fr > BAYER[(y & 3) * 4 + (x & 3)] ? k + 1 : k)];
      const i = (y * W + x) * 4; img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
    }
  }
  skyG.putImageData(img, 0, 0);
}
function paintLand(h) {
  const g = landG, skyLow = skyAt(h)[2];
  g.clearRect(0, 0, W, H);
  const fill = (fn, col) => { g.fillStyle = css(col); for (let x = 0; x < W; x++) { const y = Math.round(fn(x)); g.fillRect(x, y, 1, H - y); } };
  const far = x => ridge(x, horizon - 17, [[5, 0.035, 1], [3, 0.09, 2]]);
  const mid = x => ridge(x, horizon - 7, [[4, 0.05, 4], [2, 0.12, 0]]);
  const near = x => ridge(x, horizon + 2, [[1.5, 0.08, 1]]);
  fill(far, lit("#b9dfc9", h, 0.35, skyLow));
  // little round trees on the far hill
  [[132, 3], [141, 4], [150, 3], [22, 3]].forEach(([tx, r]) => {
    const y = Math.round(far(tx));
    g.fillStyle = css(lit("#9a7a5c", h, 0.3, skyLow)); g.fillRect(tx, y - 3, 1, 4);
    g.fillStyle = css(lit("#8fcf9c", h, 0.3, skyLow));
    for (let dy = -r; dy <= r; dy++) { const hw = Math.round(Math.sqrt(r * r - dy * dy)); g.fillRect(tx - hw, y - 4 - r + dy, hw * 2 + 1, 1); }
  });
  fill(mid, lit("#9fd6ab", h, 0.15, skyLow));
  g.fillStyle = css(lit("#b6e4bd", h, 0.15, skyLow)); for (let x = 0; x < W; x++) g.fillRect(x, Math.round(mid(x)), 1, 1);
  fill(near, lit("#88cd8c", h));
  g.fillStyle = css(lit("#a6dea4", h)); for (let x = 0; x < W; x++) g.fillRect(x, Math.round(near(x)), 1, 1);
  // the meadow gets a touch deeper towards the front, in dithered steps
  const deep = lit("#78bf7e", h);
  for (let y = horizon + 18; y < H; y++) {
    const q = Math.min(1, (y - horizon - 18) / 50);
    for (let x = 0; x < W; x++) if (q > BAYER[(y & 3) * 4 + (x & 3)]) { g.fillStyle = css(deep); g.fillRect(x, y, 1, 1); }
  }
}

/* ---------- update ---------- */
let wind = 1;
function sceneUpdate(now, dt) {
  const s = dt / 1000, h = worldHour(), dark = darkAt(h);
  wind = 0.8 + 0.5 * Math.sin(now / 9000) + 0.2 * Math.sin(now / 2300);
  for (const c of clouds) {
    c.x += c.v * s * (0.8 + wind * 0.3);
    const w = cloudImgs[c.tpl] ? cloudImgs[c.tpl].width : 50;
    if (c.x > W + 4) Object.assign(c, newCloud(-w - rnd() * 30, c.layer));
  }
  if (!faceCloud && now > nextFace) { faceCloud = { x: -60, y: 34 + rnd() * 26, v: 5.5, t0: now }; }
  if (faceCloud) { faceCloud.x += faceCloud.v * s; if (faceCloud.x > W + 8) { faceCloud = null; nextFace = now + 90000 + rnd() * 120000; } }

  if (!flock && now > nextFlock && dark < 0.45) {
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

  if (!fly && now > nextFly && dark < 0.3) fly = { x: -6, y: FEET - 30, base: FEET - 26 - rnd() * 30, t: 0, c: ["#ffd84d", "#ffffff", "#ffb3c7", "#c6b5ff"][rnd() * 4 | 0] };
  if (fly) { fly.t += dt; fly.x += 12 * s; fly.y = fly.base + Math.sin(fly.t / 600) * 8 + Math.sin(fly.t / 170) * 2; if (fly.x > W + 6) { fly = null; nextFly = now + 30000 + rnd() * 40000; } }

  // a sparrow flies to the sign, hops and pecks for a while, then leaves
  const sx = SIGN_X + 4, sy = FEET - 36;          // standing on the top edge of the sign board
  if (!sparrow && now > nextSparrow && dark < 0.4) sparrow = { st: "in", x: W + 8, y: 50, t: 0, stay: 6000 + rnd() * 6000 };
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
function drawSun(h, g) {
  if (h < 5.3 || h > 19.6) return;
  const p = (h - 6) / 13, x = 12 + (W - 24) * Math.max(-0.05, Math.min(1.05, p));
  const y = horizon - 6 - Math.sin(Math.PI * Math.max(0, Math.min(1, p))) * (horizon - 50);
  const low = 1 - Math.sin(Math.PI * Math.max(0, Math.min(1, p)));
  const core = mixc(hex("#fff6c8"), hex("#ffb06a"), low), rim = mixc(hex("#ffe58a"), hex("#ff8f5a"), low);
  for (let r = 22, a = 0.05 + low * 0.06; r >= 10; r -= 4) { g.fillStyle = css(core, a); disc(g, x, y, r); }
  g.fillStyle = css(rim); disc(g, x, y, 7);
  g.fillStyle = css(core); disc(g, x, y, 6);
  g.fillStyle = "rgba(255,255,255,0.55)"; g.fillRect(Math.round(x) - 3, Math.round(y) - 3, 2, 1);
}
function disc(g, cx, cy, r) {
  cx = Math.round(cx); cy = Math.round(cy);
  for (let dy = -r; dy <= r; dy++) { const hw = Math.round(Math.sqrt(r * r - dy * dy)); g.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1); }
}
function moonPhase() { return (((Date.now() / 86400000 - 10962.76) % 29.530588853) + 29.530588853) % 29.530588853 / 29.530588853; }
function drawMoon(h, g) {
  const t = h >= 18 ? h - 18 : h + 6;                 // 18:00 -> 0, 06:00 -> 12
  if (t < 0.6 || t > 12.6) return;
  const p = (t - 0.6) / 12, x = W - 16 - (W - 32) * p, y = horizon - 8 - Math.sin(Math.PI * p) * (horizon - 46);
  const ph = moonPhase(), r = 6, k = Math.cos(2 * Math.PI * ph);
  g.fillStyle = "rgba(255,244,214,0.07)"; disc(g, x, y, 14); disc(g, x, y, 10);
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (dx * dx + dy * dy > r * r + 0.5) continue;
    const sq = Math.sqrt(Math.max(0, 1 - (dy / r) ** 2)), xn = (dx + 0.5) / r;
    const on = ph < 0.5 ? xn > sq * k : xn < -sq * k;
    g.fillStyle = on ? ((dx === -2 && dy === 1) || (dx === 2 && dy === -2) ? "#efe2bd" : "#fff4d6") : "rgba(140,150,200,0.28)";
    g.fillRect(Math.round(x) + dx, Math.round(y) + dy, 1, 1);
  }
}
const BIRD = [["X...X", ".X.X.", "..X.."], ["..X..", ".X.X.", "X...X"]];
function drawGlyph(g, rows, x, y, col) { g.fillStyle = col; rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === "X") g.fillRect(Math.round(x) + i, Math.round(y) + j, 1, 1); }); }

function drawSign(g, now, h, info) {
  const bx = SIGN_X - 14, base = FEET - 4, by = base - 27, bw = 29, bh = 15;
  const glow = darkAt(h);
  if (glow > 0.3) { for (let r = 26, a = 0.035 * glow; r >= 12; r -= 5) { g.fillStyle = `rgba(255,214,140,${a})`; disc(g, SIGN_X, by + 7, r); } }
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

function sceneRender(now, signInfo) {
  const h = worldHour(), dark = darkAt(h);
  const key = (Math.round(h * 60)) + ":" + H;          // the sky and land are repainted once a game-minute
  if (key !== cacheKey) { cacheKey = key; paintSky(h); paintLand(h); }
  const ck = Math.round(h * 12) + "";
  if (ck !== cloudKey) {
    cloudKey = ck; const [f, s, r] = cloudColors(h);
    cloudImgs = CLOUD_SHAPES.map(sh => renderCloud(sh, f, s, r));
    faceImg = renderCloud(FACE_SHAPE, f, s, r, true);
  }
  const g = sctx;
  g.imageSmoothingEnabled = false;
  g.drawImage(skyCv, 0, 0);
  // stars
  if (dark > 0.05) for (const st of STARS) {
    const tw_ = 0.55 + 0.45 * Math.sin(now / 700 + st.p * 3);
    const a = dark * st.b * tw_; if (a < 0.08) continue;
    g.fillStyle = `rgba(255,250,230,${a.toFixed(2)})`;
    const x = Math.round(st.x), y = Math.round(st.yy);
    g.fillRect(x, y, 1, 1);
    if (st.b > 0.9 && tw_ > 0.8) { g.fillStyle = `rgba(255,250,230,${(a * 0.5).toFixed(2)})`; g.fillRect(x - 1, y, 1, 1); g.fillRect(x + 1, y, 1, 1); g.fillRect(x, y - 1, 1, 1); g.fillRect(x, y + 1, 1, 1); }
  }
  if (star) {
    const a = 1 - star.t / 900;
    for (let i = 0; i < 12; i++) { g.fillStyle = `rgba(255,255,240,${(a * (1 - i / 12)).toFixed(2)})`; g.fillRect(Math.round(star.x - star.vx / 90 * i * 0.5), Math.round(star.y - star.vy / 90 * i * 0.5), 1, 1); }
  }
  drawSun(h, g);
  drawMoon(h, g);
  // far clouds, then birds, then near clouds
  const drawC = c => { const im = cloudImgs[c.tpl]; if (!im) return; g.globalAlpha = c.layer === 0 ? 0.85 : 1; g.drawImage(im, Math.round(c.x), Math.round(c.y)); g.globalAlpha = 1; };
  clouds.filter(c => c.layer === 0).forEach(drawC);
  if (flock) {
    const col = css(mixc(hex("#5b6280"), hex("#3a2a40"), warmAt(h)));
    flock.birds.forEach(b => {
      const fl = Math.floor(now / 160 + b.p) % 2, bx = flock.x + b.dx, by = flock.y + b.dy + Math.sin(now / 500 + b.p) * 2;
      drawGlyph(g, BIRD[fl], bx, by, col);
    });
  }
  clouds.filter(c => c.layer === 1).forEach(drawC);
  if (faceCloud && faceImg) g.drawImage(faceImg, Math.round(faceCloud.x), Math.round(faceCloud.y + Math.sin(now / 900) * 1.5));
  g.drawImage(landCv, 0, 0);
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
  drawSign(g, now, h, signInfo);
  if (sparrow) {
    const b = sparrow, flying = b.st !== "sit";
    const hop = !flying && Math.floor(b.t / 700) % 4 === 1 ? -1 : 0, peck = !flying && Math.floor(b.t / 400) % 5 === 2;
    const im = SPARROW_IMG[peck ? 1 : 0];
    g.save();                                           // drawn facing right; flipped while she flies leftwards
    if (flying) { g.translate(Math.round(b.x) + im.width, 0); g.scale(-1, 1); g.drawImage(im, 0, Math.round(b.y)); }
    else g.drawImage(im, Math.round(b.x), Math.round(b.y) + hop + (peck ? 1 : 0));
    g.restore();
    if (flying) { g.fillStyle = "#b88a64"; const up = Math.floor(now / 90) % 2; g.fillRect(Math.round(b.x) + 2, Math.round(b.y) + (up ? -1 : 2), 3, 1); }
  }
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
