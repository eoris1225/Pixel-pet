/* The world behind the pet: a sky that follows the user's local clock (dawn, day, golden hour, sunset, dusk, night)
   and the season (its colours, and its clouds', taken from the reference pixel-art packs), sun and a moon in its real
   phase, stars, drifting clouds of many kinds and sizes (now and then one with a face), birds, a sparrow that visits
   the sign, butterflies, fireflies, hills with a wood, a big tree and little pines, the meadow with swaying grass and
   flowers, and the wooden sign clock.
   Preview any time of day with ?hour=18.5, a season with ?season=autumn, and fast-forward with ?speed=600. */
"use strict";

const bg = document.getElementById("bg");
const sctx = bg.getContext("2d");

/* ---------- time ---------- */
const QS = new URLSearchParams(location.search);
let T_FIX = QS.has("hour") ? parseFloat(QS.get("hour")) : null, T_FIX_AT = Date.now();
const T_SPEED = QS.has("speed") ? Math.max(1, parseFloat(QS.get("speed"))) : 1;
const T_START = Date.now();
function worldHour() {
  if (T_FIX !== null) return ((T_FIX + (Date.now() - T_FIX_AT) * T_SPEED / 3600000) % 24 + 24) % 24;
  const d = new Date(T_START + (Date.now() - T_START) * T_SPEED);
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

/* ---------- colour helpers ---------- */
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c, a = 1) => a >= 1 ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// how the scene sits with her and the buttons (they are pastel, outlined in dark ink): an outline round the clouds
// and the trees ("self": the thing's own deepest tone; "ink": the trees in the ink of her outline, the clouds still in
// their own, as ink on them is too heavy), and the colours softened
// towards her warm paper ("soft": a little less saturated, a little creamier). Candidates to pick from: ?look=b
// The user picked B (lines in their own tone), then asked for the clouds without lines (as they were before), softer
// lines on the trees and the warm pastel colours: F
const LOOKS = { a: { line: "", soft: 0 }, b: { line: "self", soft: 0, clouds: 1 }, c: { line: "ink", soft: 0, clouds: 1 }, d: { line: "", soft: 1 },
  e: { line: "ink", soft: 1, clouds: 1 }, f: { line: "self", soft: 1, clouds: 1 } };
let LOOK = LOOKS[QS.get("look")] || LOOKS.f; LOOK.key = LOOKS[QS.get("look")] ? QS.get("look") : "f";
// (in the sky the most vivid colours, a sunset's gold on the clouds, are calmed the most: vivid; k: how much)
function softc(c, k = 1, vivid = 0) {
  if (!LOOK.soft) return c;
  k *= LOOK.soft;
  const l = (c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11), sat = Math.max(...c) - Math.min(...c);
  const calm = 0.06 * k + clampv((sat - 70) / 120, 0, 1) * vivid;
  return mixc(mixc(c, [l, l, l], Math.min(0.6, calm)), [255, 240, 214], 0.13 * k);
}
// a 1px line round what is drawn in an image (onto its clear pixels next to it): each line pixel is the colour of
// the thing beside it taken a step towards its own deepest tone D, so the line follows it (light beside its lit edge,
// deeper beside its shade) and is never black; where its edge is dark already, it needs no line (skip; a cloud is lined all round). own(i): whether the
// pixel i may be lined (not a tree's trunk). Not below its last row
const lum = c => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
function outlineData(d, w, h, D, minA = 128, own = null, k = 0.5, skip = true) {
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] >= minA && (!own || own(y * w + x)), add = [], lD = lum(D);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3] >= minA) continue;
    let best = -1, bl = -1;                                 // the lightest thing beside it
    for (const [X, Y] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (Y === h || !on(X, Y)) continue;
      const j = (Y * w + X) * 4, l = lum([d[j], d[j + 1], d[j + 2]]); if (l > bl) { bl = l; best = j; }
    }
    if (best < 0 || (skip && bl < lD * 1.35 + 10)) continue;
    const c = mixc([d[best], d[best + 1], d[best + 2]], D, k);
    add.push([(y * w + x) * 4, c, d[best + 3]]);
  }
  for (const [i, c, a] of add) { d[i] = Math.round(c[0]); d[i + 1] = Math.round(c[1]); d[i + 2] = Math.round(c[2]); d[i + 3] = a; }
}
const INK = [58, 42, 26];
// a colour deeper but clear, not muddy: its own hue, more saturated, darker (for a line)
function clearDeep(c, sat = 1.2, dark = 0.8) {
  const [r, g, b] = c.map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let hh = 0, sv = 0;
  if (d > 1e-6) {
    sv = d / (1 - Math.abs(2 * l - 1));
    hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; if (hh < 0) hh += 6;
  }
  const L = l * dark, Sv = Math.min(1, sv * sat), C = (1 - Math.abs(2 * L - 1)) * Sv, X = C * (1 - Math.abs((hh % 2 + 2) % 2 - 1)), m = L - C / 2;
  const [a, e, f] = hh < 1 ? [C, X, 0] : hh < 2 ? [X, C, 0] : hh < 3 ? [0, C, X] : hh < 4 ? [0, X, C] : hh < 5 ? [X, 0, C] : [C, 0, X];
  return [a + m, e + m, f + m].map(v => Math.round(clampv(v, 0, 1) * 255));
}

// shadows thrown by the sun, away from it: a point h pixels up falls k*h sideways and sy*h down the screen (the sun is
// in the sky behind the scene, so shadows come towards us, longer as it sinks). None at night, fading in and out
// round sunrise and sunset, weaker under cloud
function sunCast(h = worldHour()) {
  if (h < 5.6 || h > 19.3) return null;
  const p = (h - 6) / 13, alt = Math.sin(Math.PI * clampv(p, 0, 1)), dir = clampv((p - 0.5) * 2, -1, 1);
  const cover = typeof WX !== "undefined" ? WX.cover || 0 : 0;
  const a = smooth(5.6, 6.6, h) * (1 - smooth(18.3, 19.3, h)) * (1 - 0.85 * cover);
  if (a < 0.03) return null;
  return { k: -dir * (0.12 + 1.0 * (1 - alt)), sy: 0.1 + 0.22 * (1 - alt), a };
}
// the ground pixels a shape's shadow covers: alpha (RGBA) data of w x h whose top-left is at ox, oy; groundRow is the
// ground under it. Each row is run on to where the next row up falls, so long shadows have no gaps
function castPixels(d, w, h, ox, oy, groundRow, S) {
  const seen = new Set(), out = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3] < 128) continue;
    const up = groundRow - (oy + y); if (up < 0) continue;
    const Y = groundRow + Math.round(up * S.sy), a = Math.round(up * S.k), b = Math.round((up + 1) * S.k);
    for (let X = ox + x + Math.min(a, b); X <= ox + x + Math.max(a, b); X++) {
      const key = Y * 4096 + X; if (seen.has(key)) continue; seen.add(key); out.push([X, Y]);
    }
  }
  return out;
}
const shadowRGB = h => (landP ? litc(mixc(landP.dark[0], [24, 30, 56], 0.35), h) : [50, 60, 60]).map(Math.round);

// The sky in five bands (straight up down to the horizon) and the clouds in five tones (lit tops down to the deepest
// shade), through the day in each season. Every colour is taken as it is from the reference pixel-art packs in
// assets/refs (named at the end of each row): sky bands read off a clear column of the picture, cloud tones its most
// used cloud colours from light to dark. Clouds shade towards the sky's own colour, as in those pictures.
const SKY_NIGHT_SP = ["0d1328 121830 171f43 19265d 192561", "1c61a6 0f4a97 092e7f 19265d 171f43"];   // Ocean 6
const SKY_NIGHT_WI = ["061027 0e1c3e 132b51 143c71 245b9a", "1c61a6 0f4a97 092e7f 19265d 171f43"];   // Winternight sky, Ocean 6 clouds
const SKY_PREDAWN  = ["1d4282 214a8b 265495 33609b 4b6a9b", "928ecf 6373c4 5470bc 3e679b 294f8f"];   // Ocean sky and sun, ocean clouds
const SKY_DAWN     = ["3e679b 6e739d bc83b0 e290a2 f8a7a4", "fdd3b6 f8abb7 d09bc6 928ecf 6373c4"];   // Ocean sky and sun, ocean clouds
const SKY_TABLE = {
  spring: [
    [0, ...SKY_NIGHT_SP], [4.3, ...SKY_PREDAWN], [5.3, ...SKY_DAWN],
    [6.1,  "556f9d 857c9b c88ca1 f89ca4 fab7b2", "fdd3b6 f8abb7 d09bc6 928ecf 6373c4"],   // Ocean sky and sun, ocean clouds
    [7.2,  "65bae3 65bae3 65bae3 a6d8ee bce1f1", "e8f2f4 d4edf4 bce1f1 a6d8ee 8db2c2"],   // nature 2
    [11.5, "64a4ec 67a6ed 6faced 77b4ed 80bdf3", "e9f2f7 d1e4ee bdd9e7 9fd1ec 8dc7f5"],   // Ocean 3
    [15.5, "08a6d5 08a6d5 08a6d5 79ccdc bde0e6", "f7f8fa e3eff3 bde0e6 79ccdc 3e8ea9"],   // nature 1
    [17.3, "90b7c6 90b7c6 9abbc4 9abbc4 aac4c1", "ebf1cf d6dec8 c3cdc2 b4c2c2 aac4c1"],   // nature 4
    [18.4, "406aa4 556ea4 65729e af7079 ebb084", "ebb084 e28b70 d9776a af7079 725d7c"],   // Ocean 5
    [19.2, "3f6ca3 4a6da3 5a70a1 6c739f 926986", "af7079 926986 725d7c 655879 514f74"],   // Ocean 5, its shaded clouds
    [20.4, ...SKY_NIGHT_SP], [24, ...SKY_NIGHT_SP],
  ],
  summer: [
    [0, ...SKY_NIGHT_WI], [4.3, ...SKY_PREDAWN], [5.3, ...SKY_DAWN],
    [6.1,  "556f9d 857c9b c88ca1 f89ca4 fab7b2", "f5f5d3 ffe39a fec786 f18d73 bd6c73"],   // Ocean sky and sun, Ocean 2
    [7.2,  "3a73d4 4e82d3 6091d8 7faee3 99c4ed", "f9fefc e3eff6 c9ddf1 88b7e5 6b94d2"],   // assetpack skies, summer 4
    [11.5, "3e97b3 42aaca 5dbdd6 76cbdf a3dee7", "d8f8f3 a3dee7 99d9e5 76cbdf 5dbdd6"],   // summer 2
    [15.5, "496ebd 4d77c2 5283c1 85aed9 b9d0f0", "dbe1eb cad9ed aac0e1 9dbbe3 83a8d7"],   // Ocean 4
    [17.3, "376e95 4986aa 7da2b1 9cabb7 c4a996", "e1ccab dcbaa0 d7b295 9f999c 8b96a3"],   // summer 8
    [18.4, "7597a4 8aa7b2 978c9c f18d73 fec786", "ffe39a fec06d fc9c72 e47472 b55b75"],   // Ocean 2
    [19.2, "4f6fa2 5e70a0 6c739f 926986 bd6c73", "bd6c73 b55b75 825665 634d64 514f74"],   // Ocean 5 sky, Ocean 2 shades
    [20.4, ...SKY_NIGHT_WI], [24, ...SKY_NIGHT_WI],
  ],
  autumn: [
    [0, "0d1328 121830 171f43 19265d 192561", "446b96 374d65 303e4b 2a3642 232d37"],      // Ocean 6 sky, winter 8 clouds
    [4.3, ...SKY_PREDAWN], [5.3, ...SKY_DAWN],
    [6.1,  "556f9d 857c9b c88ca1 f89ca4 fab7b2", "fbf7f8 f9e0eb d09bc6 928ecf 6373c4"],   // Ocean sky and sun, autumn 1
    [7.2,  "90b7c6 9abbc4 b6d7d9 deefff fcf1f6", "fbf7f8 fcf1f6 f9e0eb c3b0ce a19098"],   // nature 4, autumn 4, autumn 1
    [11.5, "76b9e3 76b9e3 76b9e3 b1cae1 dce5ec", "eaf6fc dce5ec b1cae1 6c9dc4 56729a"],   // nature 3
    [15.5, "b6d7d9 b6d7d9 b6d7d9 c9d5d3 dae0dc", "f4f4f4 d8d8d8 bfbfbf 9abbc4 8db2c2"],   // autumn 4
    [17.3, "a3bedb a3bedb ababb5 d8b3a3 f1c6a3", "f1c6a3 e4bca3 d9b2a3 9ea5b5 7e91ac"],   // Ocean 8
    [18.4, "8e9db2 a3bedb ababb5 d8b3a3 f1c6a3", "f1c6a3 d9b2a3 8e9db2 6d85a7 495c88"],   // Ocean 8
    [19.2, "3e517b 495c88 536897 5d75a1 d8b3a3", "d8b3a3 7e91ac 6d85a7 536897 3e517b"],   // Ocean 8, its lower clouds
    [20.4, "0d1328 121830 171f43 19265d 192561", "446b96 374d65 303e4b 2a3642 232d37"],
    [24,   "0d1328 121830 171f43 19265d 192561", "446b96 374d65 303e4b 2a3642 232d37"],
  ],
  winter: [
    [0, "061027 0e1c3e 132b51 143c71 245b9a", "5587b0 446b96 376fa0 374d65 303e4b"],      // Winternight sky, winter 8 clouds
    [4.3,  "0e1c3e 132b51 143c71 194784 245b9a", "6373c4 5470bc 3e679b 294f8f 1d4282"],   // Winternight sky, ocean clouds
    [5.3, ...SKY_DAWN],
    [6.1,  "5d7dc3 7a93cb 88ace8 a7b7e8 c3b0ce", "c3b0ce 9ebbec 7a93cb 686890 555584"],   // winter nature 4
    [7.2,  "75a4d8 7cabd9 8ab6db 92b9da c2e5ff", "fdf5e2 d4ecff c2e5ff 99d0f9 88c4f1"],   // winter 2, winter nature 2
    [11.5, "799ee2 81a7e7 84aae9 98ace1 afaed8", "ffffff c9d1dc becfdf a3bfd6 84aed2"],   // winter 3, winter nature 1
    [15.5, "88c4f1 99d0f9 a4d8ff a4d8ff c2e5ff", "d4ecff cde9ff c2e5ff 99d0f9 88c4f1"],   // winter nature 2
    [17.3, "4073a2 4073a2 4d7599 4d7599 df9278", "fcc87f fcb47a ffa07a df9278 415792"],   // winter 6
    [18.4, "47477b 555584 686890 7a93cb c3b0ce", "c3b0ce 7a93cb 686890 555584 47477b"],   // winter nature 4
    [19.2, "0e1d42 13224d 16355d 194784 245b9a", "686890 555584 47477b 3a4b76 374d65"],   // Winternight sky, winter nature 4
    [20.4, "061027 0e1c3e 132b51 143c71 245b9a", "5587b0 446b96 376fa0 374d65 303e4b"],
    [24,   "061027 0e1c3e 132b51 143c71 245b9a", "5587b0 446b96 376fa0 374d65 303e4b"],
  ],
};
for (const k in SKY_TABLE) SKY_TABLE[k] = SKY_TABLE[k].map(([h, s, c]) => [h, s.split(" ").map(x => hex("#" + x)), c.split(" ").map(x => hex("#" + x))]);
// how much of each season it is today: each holds its own months and eases into the next over two weeks either side
// of the 1st of March, June, September and December. Preview one with ?season=spring (summer, autumn, winter)
let skySeason = SKY_TABLE[QS.get("season")] ? QS.get("season") : null;
function seasonMix() {
  if (skySeason) return [[skySeason, 1]];
  const d = typeof gameDate === "function" ? gameDate() : new Date(), doy = (d - new Date(d.getFullYear(), 0, 1)) / 86400000;
  const B = [[59, "winter", "spring"], [151, "spring", "summer"], [243, "summer", "autumn"], [334, "autumn", "winter"]];
  for (const [b, from, to] of B) {
    const dd = ((doy - b + 548) % 365) - 183;            // days past this boundary, wrapped round the year
    if (Math.abs(dd) < 14) { const t = smooth(-14, 14, dd); return [[from, 1 - t], [to, t]]; }
  }
  return [[doy < 59 || doy >= 334 ? "winter" : doy < 151 ? "spring" : doy < 243 ? "summer" : "autumn", 1]];
}
// the five sky bands [0] and five cloud tones [1] at this hour, mixed across the seasons of the day
function skyRow(h) {
  const out = [[0, 1, 2, 3, 4].map(() => [0, 0, 0]), [0, 1, 2, 3, 4].map(() => [0, 0, 0])];
  for (const [name, wgt] of seasonMix()) {
    const T = SKY_TABLE[name]; let i = 0; while (i < T.length - 2 && T[i + 1][0] <= h) i++;
    const a = T[i], b = T[i + 1], t = smooth(0, 1, (h - a[0]) / (b[0] - a[0]));
    for (let j = 0; j < 2; j++) for (let k = 0; k < 5; k++) { const c = mixc(a[j + 1][k], b[j + 1][k], t); for (let q = 0; q < 3; q++) out[j][k][q] += c[q] * wgt; }
  }
  const nk = 1 - 0.75 * darkAt(h);                     // (at night less: the night keeps the packs' deep, clear blue)
  if (LOOK.soft) out.forEach((row, j) => { for (let k = 0; k < 5; k++) row[k] = softc(row[k], (j ? 1.3 : 1) * nk, (j ? 0.45 : 0.2) * nk); });   // (the clouds' tones softer still)
  return out;
}
const sky5 = h => skyRow(h)[0];
function skyAt(h) { const c = sky5(h); return [c[0], c[2], c[4]]; }   // top, middle, horizon
// how dark (night) and how warm (sunrise / sunset light) it is
const darkAt = h => 1 - smooth(4.6, 7.0, h) + smooth(18.6, 20.6, h);
const warmAt = h => Math.max(Math.exp(-(((h - 6.2) / 0.9) ** 2)), Math.exp(-(((h - 18.4) / 1.0) ** 2)));

/* ---------- random but stable layout ---------- */
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const STARS = Array.from({ length: 80 }, () => ({ x: rnd() * W, y: rnd() ** 1.5, b: 0.35 + rnd() * 0.65, p: rnd() * 6 }));   // (thicker high up)
const TUFTS = Array.from({ length: 46 }, () => ({ x: rnd() * W, y: rnd(), h: 2 + (rnd() * 3 | 0), p: rnd() * 6 }));
const FLOWERS = Array.from({ length: 16 }, () => ({ x: 4 + rnd() * (W - 8), y: rnd(), c: ["#ffffff", "#ffc4d6", "#ffe58a", "#d9c8ff", "#ffffff"][rnd() * 5 | 0], p: rnd() * 6 }));

let horizon = 210;
const SIGN_X = 26;


/* ---------- clouds ---------- */
// Clouds as in the reference pixel art: no outline and nothing see-through. A cloud is one soft mass with a lumpy
// outline of small round bumps; its light is worked out over the whole mass (lit on the side towards the sun or the
// moon, shading down and away from it) and laid down in a few broad flat tones. Where two tones meet, the lighter one
// bulges into the darker in little round scallops, as in those pictures. The base is uneven, sometimes trailing thin
// wisps. Five kinds: towering cumulus, small puffs, long stratocumulus sheets and flat stepped streaks of cirrus.
const clampv = (v, a, b) => Math.max(a, Math.min(b, v));
// a box blur (run twice it is close to a soft gaussian), zero outside the grid
function blurGrid(src, w, h, r) {
  r = Math.max(1, Math.round(r));
  let a = src;
  for (let pass = 0; pass < 2; pass++) {
    const t = new Float32Array(w * h), o = new Float32Array(w * h), ps = new Float32Array(Math.max(w, h) + 1), d = 2 * r + 1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) ps[x + 1] = ps[x] + a[y * w + x];
      for (let x = 0; x < w; x++) t[y * w + x] = (ps[Math.min(w, x + r + 1)] - ps[Math.max(0, x - r)]) / d;
    }
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) ps[y + 1] = ps[y] + t[y * w + x];
      for (let y = 0; y < h; y++) o[y * w + x] = (ps[Math.min(h, y + r + 1)] - ps[Math.max(0, y - r)]) / d;
    }
    a = o;
  }
  return a;
}
// lay a soft mass out on a pixel grid from round lobes [x, y (up from the base), r, x-stretch] and pixels of a set
// tone [x, y, tone]: its outline (with small round bumps added along it), which way its surface faces at every pixel
// (from the outline blurred at two sizes, so the whole mass and its big swellings are rounded, not each lobe), how high
// each pixel sits in it, and the spots the scallops grow from
function blobLayout(lobes, fixed, R, dotSize = 1, floor = false) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const [x, y, r, sx = 1] of lobes) { x0 = Math.min(x0, x - r * sx); x1 = Math.max(x1, x + r * sx); y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r); }
  for (const [x, y] of fixed) { x0 = Math.min(x0, x); x1 = Math.max(x1, x + 1); y0 = Math.min(y0, y); y1 = Math.max(y1, y + 1); }
  const pad = 4; x0 = Math.floor(x0) - pad; y0 = Math.floor(y0) - pad;
  const w = Math.ceil(x1) + pad - x0 + 1, h = Math.ceil(y1) + pad - y0 + 1, n = w * h, m = new Float32Array(n);
  // floor: nothing below it: true, the base (y = 0); or a function giving the lowest y at each x (a rounded underside)
  const under = floor === true ? () => 0 : floor || null;
  const discG = (cx, cy, rx, ry, free) => {       // in grid pixels (y down); free: not cut by the floor
    for (let Y = Math.max(0, Math.floor(cy - ry)); Y <= Math.min(h - 1, cy + ry); Y++) for (let X = Math.max(0, Math.floor(cx - rx)); X <= Math.min(w - 1, cx + rx); X++) {
      if (under && !free && h + y0 - Y - 0.5 < under(X + x0 + 0.5)) continue;
      const dx = (X + 0.5 - cx) / rx, dy = (Y + 0.5 - cy) / ry; if (dx * dx + dy * dy <= 1) m[Y * w + X] = 1;
    }
  };
  // the big domes as round caps standing out of the picture: their height over every pixel is what the light falls on
  // (the small lobes only shape the outline)
  const zc = new Float32Array(n);
  for (const [x, y, r, sx = 1, big, free] of lobes) {
    const cx = x - x0, cy = h - (y - y0); discG(cx, cy, r * sx, r, free);
    if (big) for (let Y = Math.max(0, Math.floor(cy - r)); Y <= Math.min(h - 1, cy + r); Y++) for (let X = Math.max(0, Math.floor(cx - r * sx)); X <= Math.min(w - 1, cx + r * sx); X++) {
      const dx = (X + 0.5 - cx) / (r * sx), dy = (Y + 0.5 - cy) / r, d2 = dx * dx + dy * dy;
      if (d2 <= 1) zc[Y * w + X] = Math.max(zc[Y * w + X], 0.7 * r * (big === true ? 1 : big) * Math.sqrt(1 - d2));   // (big: true, or how high)
    }
  }
  let top = h, bot = 0;
  for (let k = 0; k < n; k++) if (m[k]) { const Y = k / w | 0; top = Math.min(top, Y); bot = Math.max(bot, Y); }
  const tone = new Int8Array(n).fill(-2);
  let area = 0; for (let k = 0; k < n; k++) if (m[k]) { tone[k] = -1; area++; }
  const alpha = new Float32Array(n).fill(1);
  for (const [x, y, t, a = 1] of fixed) { const X = x - x0, Y = h - 1 - (y - y0); if (X >= 0 && X < w && Y >= 0 && Y < h && tone[Y * w + X] === -2) { tone[Y * w + X] = t; alpha[Y * w + X] = a; } }
  // where there are no domes (sheets, the small lobes), the outline blurred stands in for the height
  const size = Math.sqrt(area), zs = clampv(size * 0.12, 1.5, 8), Bm = blurGrid(m, w, h, clampv(size * 0.12, 1, 6));
  for (let k = 0; k < n; k++) zc[k] = Math.max(zc[k], Bm[k] * zs);
  const z = blurGrid(zc, w, h, 1);
  const nx = new Float32Array(n), ny = new Float32Array(n), nz = new Float32Array(n), up = new Float32Array(n);
  for (let Y = 1; Y < h - 1; Y++) for (let X = 1; X < w - 1; X++) {
    const k = Y * w + X; if (tone[k] !== -1) continue;
    const vx = -(z[k + 1] - z[k - 1]) / 2, vy = (z[k + w] - z[k - w]) / 2, l = Math.hypot(vx, vy, 1);   // vy: up the picture
    nx[k] = vx / l; ny[k] = vy / l; nz[k] = 1 / l; up[k] = 1 - (Y - top) / Math.max(1, bot - top);
  }
  const dots = [], gs = clampv(size * 0.07, 1.6, 3.4) * dotSize;
  for (let Y = top; Y <= bot; Y += gs) for (let X = 0; X < w; X += gs) {
    const px = X + R() * gs, py = Y + R() * gs, k = (py | 0) * w + (px | 0);
    if (k >= 0 && k < n && tone[k] === -1) dots.push(px, py, gs * (0.75 + R() * 0.6), (R() - 0.5) * 0.02);
  }
  return { w, h, x0, base: h - 1 + y0, nx, ny, nz, up, tone, alpha, dots: new Float32Array(dots), area };
}
// the tone (0 lightest .. 4 darkest) of every pixel of a laid-out mass under light L: the light over the mass, split
// into tones so each covers its share (q: how much of it is in the lightest, the two lightest, ...), then the
// scallops laid from the darkest up, so the lighter tones bulge into the darker ones
function blobTones(s, L, q) {
  const { w, h, nx, ny, nz, up, tone, dots } = s, n = w * h, sv = new Float32Array(n), vals = [];
  for (let i = 0; i < n; i++) if (tone[i] === -1) { const v = 0.8 * (nx[i] * L[0] + ny[i] * L[1] + nz[i] * L[2]) + 0.2 * up[i]; sv[i] = v; vals.push(v); }
  vals.sort((a, b) => b - a);
  const T = q.map(f => vals[Math.min(vals.length - 1, Math.floor(f * vals.length))]);
  const tq = v => v > T[0] ? 0 : v > T[1] ? 1 : v > T[2] ? 2 : v > T[3] ? 3 : 4;
  const out = Int8Array.from(tone);
  for (let i = 0; i < n; i++) if (tone[i] === -1) out[i] = tq(sv[i]);
  const byTone = [[], [], [], [], []];
  for (let d = 0; d < dots.length; d += 4) { const k = (dots[d + 1] | 0) * w + (dots[d] | 0); byTone[tq(sv[k] + dots[d + 3])].push(d); }
  for (let t = 4; t >= 0; t--) for (const d of byTone[t]) {
    const cx = dots[d], cy = dots[d + 1], r = dots[d + 2];
    for (let Y = Math.max(0, Math.floor(cy - r)); Y <= Math.min(h - 1, cy + r); Y++) for (let X = Math.max(0, Math.floor(cx - r)); X <= Math.min(w - 1, cx + r); X++) {
      const k = Y * w + X; if (tone[k] === -1 && (X + 0.5 - cx) ** 2 + (Y + 0.5 - cy) ** 2 <= r * r) out[k] = t;
    }
  }
  return out;
}
// a long flat cloud as in the reference skies: a sheet thickest somewhere off its middle, its top swelling gently in a
// few long soft humps, its underside flatter, both edges stepped, its ends drawn out into thin pointed tails. Lit on
// top, a darker band along its underside. Pixels of a set tone, [x, y (up), tone], first ones laid down stay in front
function ribbon(fixed, x0, y0, w0, h0, R, alpha = 1) {
  const peak = 0.3 + R() * 0.4, humps = Array.from({ length: 1 + (R() * 3 | 0) }, () => [R(), 0.08 + R() * 0.16, 0.3 + R() * 0.6]);
  let jt = 0, jb = 0, run = 0;
  for (let x = 0; x < w0; x++) {
    const u = x / w0, v = u < peak ? u / peak : (1 - u) / (1 - peak), env = Math.pow(clampv(v, 0, 1), 0.7);
    let hump = 0; for (const [c, wd, a] of humps) hump += a * Math.exp(-(((u - c) / wd) ** 2));
    if (run-- <= 0) { run = 2 + (R() * 5 | 0); jt = R() < 0.5 ? 0 : R() < 0.5 ? 1 : -1; jb = R() < 0.6 ? 0 : 1; }   // the edges step now and then
    const top = Math.round(h0 * env * (0.5 + 0.5 * Math.min(1, hump)) + (env > 0.3 ? jt : 0)), bot = -Math.round(h0 * 0.28 * env + (env > 0.3 ? jb : 0));
    const th = top - bot; if (th < 1) continue;
    for (let y = bot; y < top; y++) {
      const fromTop = top - 1 - y, fromBot = y - bot;
      fixed.push([Math.round(x0 + x), Math.round(y0 + y), th <= 2 ? 1 : fromBot === 0 && th > 4 ? 3 : fromBot <= (th > 6 ? 1 : 0) ? 2 : fromTop < Math.max(1, th * 0.45) ? 0 : 1, alpha * (th <= 2 ? 0.7 : th <= 4 ? 0.85 : 1)]);
    }
  }
  // the tails: a thin line out from each end, stepping a pixel now and then, broken into dashes at its very tip
  for (const [end, dir] of [[0, -1], [w0 - 1, 1]]) {
    const len = 3 + R() * Math.min(24, w0 * 0.25); let y = 0;
    for (let k = 1; k <= len; k++) {
      if (k > len * 0.5 && R() < 0.12) y += R() < 0.5 ? 1 : -1;
      if (k > len * 0.7 && k % 2) continue;
      fixed.push([Math.round(x0 + end + dir * k), Math.round(y0 + y), 1, alpha * 0.6 * (1 - 0.5 * k / len)]);
    }
  }
}
// flat: its base hidden behind the land, so cut straight; otherwise (afloat) its underside rounded and lumpy
function cloudShape(kind, w0, h0, R = Math.random, flat = false) {
  const lobes = [], fixed = [];        // lobes: [x, y (up from the base), r, x-stretch, a big dome?, not cut by the floor?]
  const lobe = (x, y, r, sx = 1, big = false, free = false) => lobes.push([x, y, r, sx, big, free]);
  let floor = false;
  if (kind === "cirrus") {
    // thin streaks high up: two or three long slivers, staggered, each drawn out into pointed tails
    for (let j = 0, n = 1 + (R() * 3 | 0); j < n; j++) {
      const ww = w0 * (0.5 + R() * 0.5);
      ribbon(fixed, (w0 - ww) * R(), j * (3 + (R() * 3 | 0)), ww, 1.6 + R() * 1.8, R, 0.72);
    }
  } else if (kind === "strato") {
    // a long flat sheet, now and then with a smaller one lying behind it
    ribbon(fixed, 0, 0, w0, h0, R, 0.9);
    if (R() < 0.5) { const ww = w0 * (0.35 + R() * 0.35); ribbon(fixed, (R() < 0.5 ? -0.15 : 0.6) * w0 + R() * w0 * 0.2, h0 * (0.4 + R() * 0.4), ww, h0 * (0.4 + R() * 0.3), R, 0.75); }
  } else {
    // a cumulus (or a little puff) as in the reference skies: a heap on a flat base, highest in one tower and falling
    // away in rounded steps to either side, over a low band the whole width; every top edge a run of small round
    // bumps (smaller ones on the bigger), the inside all filled, nothing below the base
    const puff = kind === "puff", main = { c: kind === "tree" ? 0.5 : puff ? 0.4 + R() * 0.2 : 0.32 + R() * 0.36, a: 1, hw: puff ? 0.3 + R() * 0.12 : 0.22 + R() * 0.1 };
    const towers = [main];
    for (const side of [-1, 1]) {                                  // shoulders stepping down each side, more on the longer one
      let { c, a, hw } = main;
      const room = side < 0 ? main.c : 1 - main.c, n = puff ? (R() < 0.6 ? 1 : 0) : 1 + (room > 0.5 ? 1 : 0) + (R() < 0.4 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const nhw = puff ? 0.14 + R() * 0.1 : 0.09 + R() * 0.1;
        a *= puff ? 0.55 + R() * 0.2 : 0.5 + R() * 0.22; c += side * (hw * 0.8 + nhw * 0.55); hw = nhw;
        if (c - hw < -0.02 || c + hw > 1.02) break;
        towers.push({ c, a, hw });
      }
    }
    const hb = h0 * (puff ? 0.4 : 0.2 + R() * 0.1);                // the low band along the bottom
    towers.push({ c: 0.5, a: hb / h0, hw: 0.5, band: true });
    for (const t of towers) {
      const cx = t.c * w0, ry = Math.max(1.5, t.a * h0 * (t.band ? 1 : 0.9)), rx = Math.max(1.5, t.hw * w0);
      lobe(cx, 0, ry, rx / ry);                                      // its body (cut off at the base)
      const rc = clampv((t.band ? hb * 0.8 : t.a * h0 * 0.32), 3, 16);   // and big round puffs inside it, overlapping, each catching the light
      for (let y = rc * 0.8; y < ry - rc * 0.4; y += rc * (0.85 + R() * 0.2)) {
        const half = rx * Math.sqrt(Math.max(0, 1 - (y / ry) ** 2)) - rc * 0.6;
        for (let x = cx - half + R() * rc * 0.4; x <= cx + half + 0.01; x += rc * (0.95 + R() * 0.3)) lobe(x, y + (R() - 0.5) * rc * 0.3, rc * (0.85 + R() * 0.3), 1, 0.4);
      }
      const rb = clampv((t.band ? hb * 0.55 : t.a * h0 * 0.17), 1.6, 8);
      const arc = Math.PI * (rx + ry) / 2, n = Math.max(2, Math.round(arc / (rb * (1.15 + R() * 0.3))));
      for (let k = 0; k <= n; k++) {                                 // the bumps along its top edge
        const th = Math.PI * (0.04 + 0.92 * (k + (R() - 0.5) * 0.5) / n), r = rb * (0.75 + R() * 0.5);
        const px = cx + Math.cos(th) * rx, py = Math.sin(th) * ry, nx = Math.cos(th) / rx, ny = Math.sin(th) / ry, nl = Math.hypot(nx, ny);
        const x = px - nx / nl * r * 0.45, y = py - ny / nl * r * 0.45;
        if (y < r * 0.3) continue;
        lobe(x, y, r, 1, r >= 2.5);
        if (r >= 3 && R() < 0.6) { const a2 = Math.PI * (0.2 + R() * 0.6), r2 = r * (0.35 + R() * 0.15); lobe(x + Math.cos(a2) * r * 0.85, y + Math.sin(a2) * r * 0.85, r2); }
      }
    }
    if (flat) floor = true;
    else {
      // afloat, as the reference's little clouds: a shallow rounded belly, deepest in the middle, and a row of soft
      // flattened bumps along it (and at its ends)
      const depth = clampv(h0 * 0.14, 1.5, 7), cx = w0 / 2, half = w0 / 2;
      floor = x => -depth * Math.sqrt(Math.max(0, 1 - ((x - cx) / half) ** 2));
      const rbb = clampv(hb * 0.38, 1.2, 4.5);
      for (let x = rbb * 1.2; x < w0 - rbb * 1.2; x += rbb * (1.5 + R() * 0.9)) {
        const r = rbb * (0.75 + R() * 0.5); lobe(x, floor(x) + r * 0.5, r, 1.25 + R() * 0.4, false, true);
      }
    }
  }
  return blobLayout(lobes, fixed, R, 1, floor);
}
// where the light comes from: the sun's side by day (low and from the side at sunrise and sunset, from above at noon),
// the moon's at night; in steps, so the clouds are only repainted now and then
function cloudLight(h) {
  let p;
  if (h >= 5.3 && h <= 19.6) p = (h - 6) / 13;
  else p = 1 - ((h >= 18 ? h - 18 : h + 6) - 0.4) / 12.4;      // the moon crosses from right to left
  p = clampv(p, -0.05, 1.05);
  const alt = Math.sin(Math.PI * clampv(p, 0, 1));
  const sx = (p - 0.5) * 1.4, lx = Math.round(clampv(Math.sign(sx || -1) * Math.max(0.3, Math.abs(sx)), -0.5, 0.5) * 10) / 10, ly = 0.7, lz = 0.5;
  const m = Math.hypot(lx, ly, lz);
  return [lx / m, ly / m, lz / m];
}
// the five tones for this hour and weather: lit tops to deepest shade
function cloudPal(h) {
  let pal = skyRow(h)[1];
  const wx = typeof WX !== "undefined" ? WX : null, d = darkAt(h);
  if (wx && wx.cover > 0.05) {                                    // overcast: greyer, and darker under storm clouds
    const g = Math.min(1, wx.cover * 0.9), lit = mixc(hex("#e2e5ea"), hex("#5a6078"), d), sh = mixc(hex(wx.storm > 0.5 ? "#5d6476" : "#8a92a4"), hex("#262a44"), d);
    pal = pal.map((c, k) => mixc(c, mixc(lit, sh, k / 4), g * (0.8 + k * 0.03 + wx.storm * 0.2)));
  }
  if (typeof weatherVeil === "function") {                        // and dimmed into the grey of the sky, softer, less contrast
    const v = weatherVeil(h); if (v.a > 0) pal = pal.map(c => mixc(c, v.c, v.a * 0.7));
  }
  // the deeper tones lifted a little towards the lit one, so no cloud looks heavy (less so in a storm)
  const lift = 1 - (wx ? wx.storm * 0.8 : 0);
  pal = pal.map((c, k) => mixc(c, pal[0], [0, 0.08, 0.15, 0.22, 0.3][k] * lift));
  return pal;
}
// How see-through each kind is: cumulus and puffs are solid masses, fully opaque; a stratus sheet is nearly so (0.9),
// a smaller sheet lying behind it a little less (0.75), cirrus streaks are thin veils (0.72); and within a sheet its
// thin parts (two pixels or less) and its tails fade further, the tails more towards their tips, as do the wisps
// trailing under a cumulus (0.6)
// how much of a cloud is in its lightest tone, its two lightest, ... (small clouds in fewer tones)
const CLOUD_Q = [0.3, 0.52, 0.71, 0.87], PUFF_Q = [0.42, 0.75, 0.94, 1];
function paintCloud(c, pal, L) {
  const { w, h, area } = c.shape, tn = blobTones(c.shape, L, area < 90 ? PUFF_Q : CLOUD_Q);
  const line = LOOK.line && LOOK.clouds && (c.kind === "cu" || c.kind === "puff") ? 1 : 0, W2 = w + 2 * line, H2 = h + 2 * line;   // (room for an outline)
  if (!c.cv) { c.cv = document.createElement("canvas"); c.cv.width = W2; c.cv.height = H2; c.pad = line; }
  const g = c.cv.getContext("2d"), img = g.createImageData(W2, H2);
  for (let i = 0; i < w * h; i++) {
    const k = tn[i]; if (k < 0) continue;
    const col = pal[k], j = ((Math.floor(i / w) + line) * W2 + i % w + line) * 4;
    img.data[j] = col[0]; img.data[j + 1] = col[1]; img.data[j + 2] = col[2]; img.data[j + 3] = Math.round(255 * c.shape.alpha[i]);
  }
  if (line) outlineData(img.data, W2, H2, clearDeep(pal[4]), 200, null, 0.52, false);   // (round all of it, its shade too)
  g.putImageData(img, 0, 0);
}
// how big each kind comes, where it floats (its base, in the sky above the horizon) and how it drifts: the higher
// it is, the nearer, so the bigger and the faster
const logr = (a, b) => a * Math.pow(b / a, Math.random());
// the big cumulus low over the hills, numbered candidates (the same cloud for the same number): the user picks which
// may come (BIG_CU_PICK; empty: any)
const BIG_CU_PICK = [];
function bigCuShape(n) {
  let q = (n * 6271 + 99991) % 2147483647; const R = () => (q = (q * 48271) % 2147483647) / 2147483647; for (let i = 0; i < 5; i++) R();
  const w = 80 + R() * 70, h = Math.min(w * (0.35 + R() * 0.45), horizon * 0.5);
  return cloudShape("cu", Math.round(w), Math.round(h), R, true);
}
// the two big clouds traced from the reference packs (the user asked for them as they are): nature 2's cloud bank with
// its tower, and nature 5's towering cumulus; tones 0 (lit) .. 4 (deepest), at about a third of the reference's size.
// Their corners cut by the reference's frame are rounded off, their bases go under the land. Lit from the left as
// drawn, turned round when the sun is on the right
const REF_CLOUDS = [
  [
    "...............................................................1111111111111................................................................",
    "..............................................................111111111111111111............................................................",
    ".............................................................111111111111111111111..........................................................",
    "...........................................................331111111111111111111111.........................................................",
    "...........................................................3311111111111111111111111........................................................",
    "...........................................................3311111111111111100001111...222..................................................",
    "...........................................................111111111111001000000111111222211................................................",
    "...........................................................111111111110000000000111111111111................................................",
    "............................................................2211111111000000000001110001111122..............................................",
    ".........................................................22222111111110000000000001100000001222.............................................",
    "........................................................222221111111100000000000011000000000222.............................................",
    ".......................................................222222111111110000000000000000000000012..............................................",
    "......................................................3222222111111110000000000000000000000011..............................................",
    ".....................................................332222111111011000000000000000000000000000.............................................",
    ".....................................................33322111111000000000000000000000000000000000...........................................",
    ".....................................................3322211111100000000000000000000000000000000000.........................................",
    "......................................................2211111100000000000000000000000000000000000000........................................",
    "...............................................1111...11111111000000000000000000000000000000000000000.......................................",
    "............................................11111112.1111111100000000000000000000000000000000000000000......................................",
    "..........................................2111211122.111111100000000000000000000000000000000000000000.......................................",
    "..........................................22222222222111111000000000000000000000000000000000000000000.......................................",
    "...........................................2222222222111111000000000000000000000000000000000000000000.......................................",
    "....................................................221111100000000000000000000000000000000000000000........................................",
    "......................................................111111000000000000000000000000000000000000001.........................................",
    "..........................................................11100000000000000000000000000000000000021.........................................",
    ".........................................................2221000000000000000000000000000000000001222........................................",
    "......................................................2222210000000000000000000000000000000000011..2.....111................................",
    "......................................................2222210000000000000000000000000000000000........2221111111............................",
    ".....................................................22222210000000000000000000000000000000001........2221111111............................",
    "...................................................112222111000000000000000000000000000000011..........110001111............................",
    ".................................................11112221111002200000000000000000000000000111..........100000001............................",
    ".................................................1111122211112222000000000000000000000000000..........100000000000..........................",
    "..................................................111222222122222000000000000000000000000000..........10000000000000........................",
    "..................................................2222222222222222222110000000000000000000000.........100000000000000.......................",
    "..................................................2222222222222222222211000000000000000000000........1100000000000000.......................",
    "................................................112222222222222222222220000000000000000000000........1100000000000000.......................",
    "..............................................11112222222222222222222222000000000000000000000........11000000000000000.11...................",
    ".............................................111122222222222222222222222000000000000000000001........11000000000000000011111................",
    "........................................111..112222222222222222222111122200000000000000000001........1100000000000000011111111111111........",
    "........................................1112221122222222111122222111111121000000000000000001..........100000000000000111111111111111........",
    "....................................221111111111122222111111121111111111211000000000000000122........10000000000000000001111111111..........",
    "...................................2222111111111122221111111111110011111111100000000000000222........00000000000000000001111111.............",
    "...................................2222111111111122221111111111100000111112200000000000002222.......10000000000000000000111111..............",
    "................................22.22222111111111222111111111111000000111122222000000000010000......11000000000000000000011111..............",
    "................................222222222111111222211111111110000000000111122221110000000000000.....1110000000000000000000111...............",
    "...............................22222222221111122221111111111100000000000111222111100000000000000...22121000000000000000000011...............",
    "...................111111....22222222222211111222221111111000000000000000001221111000000000000000..222221000000000000000001101111...........",
    "..................21111111..222222222222211111222221111110000000000000000002221111100000000000000...222220000000000000000110000111..........",
    ".................211111111111112222222222111112222211110100000000000000000111211111000000000000000.22222200000000000000000000000111.........",
    ".................111111111111111222222221111122222221100000000000000000000011111111000000000000000012222221000000000000000000001111.........",
    ".................1111111111111112222222211112222222221000000000000000000000001111111100000000000000012222111000000000000000000110000........",
    ".................21111111111122222222222222222222222211100000000000000000000000111111000000000000000022221111111000000110000011100000.......",
    "..................11111111111222222222222222222222222111000011000000000000000001111110000000000000000222221211112200011111111111000000......",
    "..................1111111222222222222222222222222222222222011100000000000000000011111100000000000000222222221122222211111111111100000000....",
    "..................11111122222222222222222222222222222222222121110000000000000000111111100000000000022222222222222222211121121210000000000...",
    "...................1111222222222222222222222222222222222222222111000000000000000112211122110000001222222222222222222211222222210000000000...",
    "...................1112222222222222222222222222222222222222222111000000000000000222222222221111111222222222222222222222222221111110000000...",
    "....................122222222222222222222222222222222222222222222200000000000002222222222222222222222222222222222222222222211111111000000...",
    "....................22222222222222222222222222222222222222222222220001110000002222222222222222222222222222222222222222222222111111111111....",
    ".....................2222222222222222222222222222222222222222222222111111102022222222222222222222222222222222222222222222222221111111111..22",
    ".....................22222222222222222222222222222222222222222222222122111222222222222222222222222222222222222222222222222222211111111112222",
    "......................2222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222221111222222",
    "......................2222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222",
    "......................2222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222"
  ],
  [
    "......................................................00000....................................................................................",
    "......................................................0000001111141............................................................................",
    "......................................................00000000011111...........................................................................",
    "....................................................1400000000001111...........................................................................",
    ".................................................2221100000000000111221........................................................................",
    "..............................................11122210000000000111222334444....................................................................",
    ".............................................211110012000000001111222333444444.................................................................",
    ".............................................1111000000000000011113233333444444................................................................",
    ".............................................0010000000000000011133333333444444................................................................",
    "............................................000000000000001122122333333444444444...............................................................",
    "............................................0000000000000000222111113334444444444..............................................................",
    "............................................0000000000000000121111111344444444444..............................................................",
    "...........................................0000000000000000012211111134444444444...............................................................",
    "...........................................000000000000000002244311113344444444444.............................................................",
    "...........................................1000000000000100222444333333444444444444............................................................",
    "...........................................1000000000000022224444444334444444444444............................................................",
    "...........................................410000000000011222422444443444444444444.............................................................",
    "..........................................442110000000011112222224444444444444444..............................................................",
    "......................................11004122100000011111111111144444444444.444...............................................................",
    "......................................110011100000000001000111111444444444444..................................................................",
    "......................................100001000000000001000001111444444444444..................................................................",
    "....................................11000000000000000000000011111224344444444..................................................................",
    "....................................10000000000000000000000000111223334444444..................................................................",
    "...................................0000000000000000000000000001122223344444444.................................................................",
    "...................................00000000000000000000000000012222222444444444................................................................",
    "...................................00000000000000000000000000011222222444444444................................................................",
    "...................................10000000000000000000000000111112224444444444................................................................",
    "...................................00000000000000000000000011111111244444444444444.............................................................",
    "....................................0000000000000000000000011111111444444444444444444..........................................................",
    "...................................41110000000000000000000011111111244444444444444444..........................................................",
    "...................................41111100000000000000000000111111444444444444444444..........................................................",
    "....................................2221110000000000000000001111112444444444444444444..........................................................",
    "....................................2221111111111100000000001111122224444444444444444..........................................................",
    "............................1112....44422111111101100000000111222223334444444444444444.........................................................",
    "........................001111124....4422211100000110000011111122223332444444444444444.........................................................",
    "......................000000001133.....22200000000011111111111111133112244444444444444.........................................................",
    ".....................100000000013344....4000000000000110111111111111111244444444444............................................................",
    ".....................1000000001133344...40000000000000000011111111111112444444444444...........................................................",
    "....................10000000001133444..440000000000000000001111111111114444444444444..1111.....................................................",
    "....................0000000000333444..4400000000000000000001111111111111444444444444..111111...................................................",
    "...................00000000000133334.44200000000000000000001111111111111124444444444..2111122..................................................",
    "...................000000000002233344440000000000000000000001111111111111123224444...4411123333................................................",
    "..................0000000000012223344420000000000000000000000111111111111223334444...2111123333................................................",
    ".................10000000000011233444420000000000000000000000001111111111233334444..4111112333334..............................................",
    ".................11100000000111334444442000000000000000000000001111111111333334444.441112122333334.............................................",
    ".................11101000011111334444444000000000000000000000011111111133333334411.1411223333333334............................................",
    "................1111111000112223444444422000000000000011100001111111111333333444111111224444433333444..........................................",
    "...............111111110001122222444444200000000000001111110111111111113333334411111122244444433334444.........................................",
    "...............111111110001111222222442200000000000111111111111111111113333341122111222224442243334444.........................................",
    "..........11....11111111111111121112232330011000000111111111111111111233333342222222233322222223343333334......................................",
    ".......1111111..11111111111111111111212233111111011111111111111111122222322422222222333322222223343333344......................................",
    ".....22211111111111111111111122111211111111111111111121111111111111111222222222223333322222222233222233444.....................................",
    "....222221111111111111111111222221111111111211111111222211111111111111222222222223322222222222222222233344.....................................",
    "....222222111111111111111111111211112112221111111111222221211112221111222222222332222222222222222222233334.....................................",
    "....22222221221111111111111111111111111111111111111322222222222222222222222222222222222222222222222224..333.3..................................",
    "...222222222222111121111111111211111111111111112223333333222222222322222222222222222222222222222222222.333333..................................",
    "...3322222222222222221111111222222211121111111122233333332222222233322222222222232222222222222222222422332333..................................",
    "...333222222222222222222222222222222222222212222233333333322223323332222222222223222222222222222222.4222223334444..............................",
    "33333322222222222222222222222222222233233332232333333333333223333333333322222222223222233322222222.2222224444444444............................",
    "33333222222222222222222222222222222233333333332333333333333333333333333222222332223223333322222222.2222244444444444............................"
  ]
];
function refCloudShape(i, flip) {
  const g = REF_CLOUDS[i], h = g.length, w = g[0].length, fixed = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = g[y][x]; if (c !== ".") fixed.push([flip ? w - 1 - x : x, h - 1 - y, +c, 1]); }
  return blobLayout([], fixed, Math.random);
}
function newCloud(kind, x) {
  const R = Math.random;
  let w, h, base;
  if (kind === "cu") { w = 32 * Math.pow(150 / 32, Math.pow(R(), 1.5)); h = w * (0.35 + R() * 0.45); base = w > 80 ? horizon + 1 : horizon - 10 - R() * (horizon * 0.45); }   // (a big one stands on the land, its base hidden)
  else if (kind === "puff") { w = logr(7, 26); h = w * (0.35 + R() * 0.3); base = 22 + R() * (horizon - 50); }
  else if (kind === "strato") { w = logr(40, 140); h = 5 + R() * 8; base = 24 + R() * (horizon - 70); }
  else { w = logr(16, 90); h = 4; base = 8 + R() * (horizon * 0.55); }
  h = Math.min(h, horizon * 0.5);
  // a big one: now and then one of the two traced from the references, or one the user picked, or flat-based
  const big = kind === "cu" && w > 80, ref = big && R() < 0.45;
  const shape = ref ? refCloudShape(R() < 0.5 ? 0 : 1, cloudLight(worldHour())[0] > 0)
    : big ? (BIG_CU_PICK.length ? bigCuShape(BIG_CU_PICK[R() * BIG_CU_PICK.length | 0]) : cloudShape(kind, Math.round(w), Math.round(h), R, true))
    : cloudShape(kind, Math.round(w), Math.round(h)), near = 1 - clampv(base / horizon, 0, 1);
  return { kind, base, x: x === undefined ? -shape.w - R() * 40 : x, y: Math.round(base - shape.base), v: (0.5 + 2.6 * near) * (0.8 + R() * 0.4) * (kind === "cirrus" ? 1.3 : 1), shape, cv: null, key: "" };
}
const clouds = [];
// how many of each: the sky has a mood for every two hours (fair-weather puffs, towering cumulus, layered sheets, or
// high streaks), the same for everyone on that day and hour, and more and bigger clouds as the weather closes in
const CLOUD_MOODS = [
  { cu: 1, puff: 5, strato: 0, cirrus: 2 }, { cu: 3, puff: 2, strato: 0, cirrus: 1 },
  { cu: 1, puff: 2, strato: 3, cirrus: 1 }, { cu: 0, puff: 2, strato: 1, cirrus: 4 }, { cu: 2, puff: 3, strato: 1, cirrus: 1 },
];
function cloudWant() {
  const cover = typeof WX !== "undefined" ? WX.cover : 0, d = typeof gameDate === "function" ? gameDate() : new Date();
  let s = (d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate()) * 31 + Math.floor(worldHour() / 2) * 977;
  s = (s ^ (s >>> 7)) * 2654435761 >>> 0; s = (s ^ (s >>> 13)) * 1597334677 >>> 0;
  const m = CLOUD_MOODS[s % CLOUD_MOODS.length];
  return { cu: Math.round(m.cu + cover * 3), puff: Math.round(m.puff + cover * 2), strato: Math.round(m.strato + cover * 3), cirrus: Math.round(m.cirrus * (1 - cover)) };
}
let cloudsReady = false;
function seedClouds() {
  const want = cloudWant();
  for (const k in want) for (let i = 0; i < want[k]; i++) { const c = newCloud(k); c.x = Math.random() * (W + c.shape.w) - c.shape.w; clouds.push(c); }
  cloudsReady = true;
}
// 지나가유: a cloud with a face that floats by now and then and says hello. Its shape is now one of a few that only
// look a bit like something (not drawn as it: "oh, isn't that a rabbit?"): a few round masses laid out roughly as
// the thing is, every one a little off, with stray puffs on it, painted as every other cloud; or the plain cloud it
// first was. [name, lobes (x, y up from the base, r, x-stretch, a big dome?), its face: [on lobe, dx, dy, big?]]
let faceSeed = 5;
const FACE_BLOB = cloudShape("tree", 50, 26, () => (faceSeed = (faceSeed * 16807) % 2147483647) / 2147483647);
const VISITOR_SHAPES = {
  cloud: ["구름", null, null],
  rabbit: ["토끼", j => [[0, 8, j(10), 1.3, true], [15, 15, j(7), 1, true], [-13, 9, j(3.5)],
    ...[0, 1, 2, 3, 4].map(i => [13 - i * 0.6, 21 + i * 3, j(2.6) - i * 0.15]), ...[0, 1, 2, 3].map(i => [18 + i * 1.3, 21 + i * 2.6, j(2.4) - i * 0.15])], [1, 0, -1, 0]],
  bear: ["곰돌이", j => [[0, 10, j(11), 1.15, true], [-10, 20, j(4.5)], [10, 20, j(4.5)], [0, 5, j(4.5), 1.2]], [0, 0, 1, 1]],
  whale: ["고래", j => [[0, 8, j(9), 2.1, true], [-21, 11, j(3)], [-25, 15, j(3.4)], [-21, 16, j(2.6)], [14, 21, j(2)], [11, 24, j(2.4)], [17, 24, j(2.4)]], [0, 9, 1, 0]],
  heart: ["하트", j => [[-6, 16, j(7), 1, true], [6, 16, j(7), 1, true], [0, 10, j(7)], [0, 5, j(4.5)], [0, 1.5, j(2.5)]], [2, 0, 4, 0]],
  sheep: ["양", j => [[0, 10, j(8), 1.6, true], [-8, 15, j(4.5)], [0, 17, j(5)], [8, 15, j(4.5)], [-13, 10, j(4)], [13, 9, j(4)], [18, 9, j(4)],
    [-7, 2.6, 2.3], [-2, 2.6, 2.3], [4, 2.6, 2.3], [9, 2.6, 2.3]], [0, 3, 0, 0]],
  fish: ["물고기", j => [[0, 8, j(7), 1.8, true], [-15, 8, j(3)], [-19, 11.5, j(3.2)], [-19, 4.5, j(3.2)], [2, 15, j(2.6)]], [0, 4, 1, 0]],
  cat: ["고양이", j => [[0, 10, j(10), 1.25, true], [-8, 19, j(3.4)], [-9.5, 22.5, j(2)], [8, 19, j(3.4)], [9.5, 22.5, j(2)]], [0, 0, 0, 1]],
  pudding: ["푸딩", j => [[0, 7, j(9), 1.5, true], [0, 13, j(7.5), 1.35], [0, 17, j(6), 1.2], [0, 22, j(2.3)]], [0, 0, 2, 1]],
  bird: ["새", j => [[0, 8, j(6), 1.6, true], [11, 12, j(4)], [-2, 15, j(5), 1.6], [-12, 10, j(2.6)], [15, 12, j(1.6)]], [0, 3, 1, 0]],
};
// what it says as it goes by (mostly its name)
const VISITOR_LINES = ["지나가유~", "지나가유~", "지나가유~", "쉬엄쉬엄 해유~", "천천히 가유~", "열심히 하네유~", "구경 잘 하고 가유~"];
// which of each shape's numbered candidates may come by (the user picks them from a sheet of candidates): a list of
// numbers for a shape, [] to leave the shape out; a shape not listed comes in any form
const VISITOR_PICK = {};
// a shape (candidate number n: the same every time; none: any) and where its face goes (in the cloud's own pixels)
function visitorShape(kind, n) {
  let R = Math.random;
  if (n) { let q = (n * 7919 + 104729) % 2147483647; R = () => (q = (q * 48271) % 2147483647) / 2147483647; for (let i = 0; i < 5; i++) R(); }
  if (kind === "cloud") {
    const shape = n ? cloudShape("tree", 50, 26, R) : FACE_BLOB;
    return { shape, face: [shape.w / 2 | 0, Math.round(shape.base * 0.62), 1] };
  }
  const j = r => r * (0.85 + R() * 0.3), [, make, [fi, fdx, fdy, big]] = VISITOR_SHAPES[kind];
  const lobes = make(j).map(([x, y, r, sx = 1, big = false]) => [x + (R() - 0.5) * 1.6, y + (R() - 0.5) * 1.6, r, sx, big]);
  for (let i = 0, n = 2 + (R() * 3 | 0); i < n; i++) {           // a few stray puffs on its edge
    const [x, y, r] = lobes[R() * lobes.length | 0], a = R() * Math.PI;
    lobes.push([x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8, r * (0.3 + R() * 0.25)]);
  }
  const shape = blobLayout(lobes, [], R), [fx, fy] = lobes[fi];
  return { shape, face: [Math.round(fx + fdx - shape.x0), Math.round(shape.base + 1 - (fy + fdy)), big] };
}
// painted like every other cloud, with sleepy happy eyes, a little smile and pink cheeks, like the clouds in the sketch
// (a smaller face on a smaller head)
function renderVisitor(v, h, pal) {
  const c = { shape: v.shape, kind: "cu" }; paintCloud(c, pal, cloudLight(h));
  const g = c.cv.getContext("2d"), p = c.pad || 0, [fx, fy, big] = v.face, cx = fx + p, cy = fy + p;
  g.fillStyle = "#6a6f8e";
  if (big) {
    g.fillRect(cx - 7, cy, 3, 1); g.fillRect(cx - 8, cy - 1, 1, 1); g.fillRect(cx - 4, cy - 1, 1, 1);
    g.fillRect(cx + 5, cy, 3, 1); g.fillRect(cx + 4, cy - 1, 1, 1); g.fillRect(cx + 8, cy - 1, 1, 1);
    g.fillRect(cx - 1, cy + 3, 3, 1); g.fillRect(cx - 2, cy + 2, 1, 1); g.fillRect(cx + 2, cy + 2, 1, 1);
    g.fillStyle = "#ffb3c7"; g.fillRect(cx - 11, cy + 2, 3, 1); g.fillRect(cx + 9, cy + 2, 3, 1);
  } else {
    g.fillRect(cx - 4, cy, 2, 1); g.fillRect(cx - 5, cy - 1, 1, 1); g.fillRect(cx - 2, cy - 1, 1, 1);
    g.fillRect(cx + 2, cy, 2, 1); g.fillRect(cx + 1, cy - 1, 1, 1); g.fillRect(cx + 4, cy - 1, 1, 1);
    g.fillRect(cx, cy + 2, 1, 1); g.fillRect(cx - 1, cy + 1, 1, 1); g.fillRect(cx + 1, cy + 1, 1, 1);
    g.fillStyle = "#ffb3c7"; g.fillRect(cx - 7, cy + 1, 2, 1); g.fillRect(cx + 5, cy + 1, 2, 1);
  }
  return c.cv;
}
let faceCloud = null, nextFace = performance.now() + 25000, lastVisitor = "";
// the next one by (never the same shape twice running)
function sendVisitor(kind, n) {
  const ok = k => !VISITOR_PICK[k] || VISITOR_PICK[k].length;
  if (!kind) { const ks = Object.keys(VISITOR_SHAPES).filter(k => k !== lastVisitor && ok(k)); kind = ks[Math.random() * ks.length | 0]; }
  lastVisitor = kind;
  const picks = VISITOR_PICK[kind];
  if (!n && picks && picks.length) n = picks[Math.random() * picks.length | 0];
  const v = visitorShape(kind, n), line = VISITOR_LINES[Math.random() * VISITOR_LINES.length | 0];
  faceCloud = { kind, ...v, line, x: -v.shape.w - 4, y: 30 + Math.random() * 30, v: 4.5 + Math.random() * 1.5, t0: performance.now(), key: "", img: null };
}

/* ---------- critters ---------- */
let flock = null, nextFlock = performance.now() + 6000;
let star = null, nextStar = performance.now() + 9000;
let flies = Array.from({ length: 12 }, () => ({ x: rnd() * W, y: 0, vx: 0, vy: 0, p: rnd() * 6 }));
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
const treeCv = document.createElement("canvas"), treeG = treeCv.getContext("2d");
let cacheKey = "";

function sceneResize() {
  horizon = FEET - 46;
  bg.width = W; bg.height = H;
  skyCv.width = W; skyCv.height = H; landCv.width = W; landCv.height = H; treeCv.width = W; treeCv.height = H;
  cacheKey = "";
  STARS.forEach(s => s.yy = 4 + s.y * (horizon - 30));
  TUFTS.forEach(t => t.yy = horizon + 6 + t.y * (H - horizon - 8));
  FLOWERS.forEach(f => f.yy = horizon + 10 + f.y * (FEET - horizon + 8));
  TUFTS.sort((a, b) => a.yy - b.yy);
}

// for the test page: set the hour (null: back to the clock) or the season (null: by the date), or start a new sky of clouds
function setWorldHour(h) { T_FIX = h; T_FIX_AT = Date.now(); cacheKey = ""; }
function setSkySeason(name) { skySeason = SKY_TABLE[name] ? name : null; cacheKey = ""; }
function newSky() { clouds.length = 0; seedClouds(); }
function setLook(k) { LOOK = LOOKS[k] || LOOKS.f; LOOK.key = k; cacheKey = ""; for (const c of clouds) { c.cv = null; c.key = ""; } }

function lit(c, h, haze = 0, skyH = null) {
  let x = hex(c);
  if (haze && skyH) x = mixc(x, skyH, haze);
  x = mixc(x, hex("#ff9e72"), warmAt(h) * 0.16);
  x = mixc(x, hex("#172a5e"), darkAt(h) * 0.64);
  return x;
}
const ridge = (x, base, parts) => base + parts.reduce((a, [amp, f, p]) => a + amp * Math.sin(x * f + p), 0);

// in flat bands as in the reference skies: each of the five steps split in three, every band one flat colour, and
// only where two bands meet a short strip of checkered pixels of both
const SKY_AT = [0, 0.3, 0.56, 0.8, 1];
function paintSky(h) {
  const c5 = sky5(h), pal = [];
  for (let k = 0; k < 4; k++) for (let j = 0; j < 3; j++) pal.push(mixc(c5[k], c5[k + 1], j / 3).map(Math.round));
  pal.push(c5[4].map(Math.round));
  const img = skyG.createImageData(W, H), N = pal.length - 1;
  for (let y = 0; y < H; y++) {
    const t = Math.min(1, y / horizon);
    let k = 0; while (k < 3 && SKY_AT[k + 1] <= t) k++;
    const f = (k + (t - SKY_AT[k]) / (SKY_AT[k + 1] - SKY_AT[k])) * 3, i0 = Math.min(N, Math.floor(f)), fr = f - i0;
    for (let x = 0; x < W; x++) {
      const c = pal[Math.min(N, fr > 0.82 && (x + y) & 1 ? i0 + 1 : i0)];
      const i = (y * W + x) * 4; img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
    }
  }
  skyG.putImageData(img, 0, 0);
}
// the land in each season, its colours taken as they are from the reference packs: far hills, the wood along the
// near hill, the meadow in bands from the far plain (lightest) to the front (darkest) and its dark tufts, the big
// tree's leaves (lit to deepest) and bark, and the little pines
const LAND_TABLE = {
  spring: { hill: "94cba3 82bc9c", wood: "347e5d 295d50 244c44", grass: "8ec44c 67b75b 52b155 4fa760 369f5c", dark: "299b68",   // nature 2, nature 1
            leaf: "8ec44c 67b75b 52b155 4fa760 369f5c 299b68", bark: "5a4e44 4a4039 423934", pine: "5c9e56 40924a 2d6818 26521f 21412c",   // nature 2, nature 1, summer 4
            fleck: "ffc4d6 ffffff ffe58a" },
  summer: { hill: "589d66 438f6c", wood: "4a7a54 476750 345948", grass: "89c07d 7eb03f 6dab48 5da245 599442", dark: "4a7a54",   // summer 2, summer 5, nature 5
            leaf: "6d974d 1e8e60 1f7f41 156a33 02592e 0b4423", bark: "5a4e44 4a4039 423934", pine: "5c9e56 40924a 2d6818 26521f 21412c",   // nature 5, summer 4
            fleck: "ffe58a ffffff 9fd3f5" },
  autumn: { hill: "a59760 89855c", wood: "935949 774d3a 4f3327", grass: "a59760 89855c 85895c 7a6543 676a47", dark: "6f5a3a",   // autumn 1
            leaf: "cb8b61 cb8b61 cb8b61 935949 774d3a 4f3327", bark: "4f3327 341919 211313", pine: "436648 37593e 2a4937 25402d 203025",   // autumn 1, nature 4
            fleck: "cb8b61 935949 a59760" },                                                                                     // fallen leaves, dry grass
  winter: { hill: "c9d1dc a3bfd6", wood: "54697c 4e616f 344d5f", grass: "ffffff c9d1dc becfdf a3bfd6 9cafbd", dark: "7c8992",   // winter nature 1, 3
            leaf: "ffffff c9d1dc becfdf a3bfd6 84aed2 5e95c5", bark: "5a4e44 4a4039 423934", pine: "ffffff 4e616f 344d5f 2c3841 17202c",   // snow (winter nature 1), firs (winter nature 3)
            fleck: "54697c 4e616f 7c8992" },                                                                                     // dry stalks through the snow
};
for (const k in LAND_TABLE) for (const f in LAND_TABLE[k]) LAND_TABLE[k][f] = LAND_TABLE[k][f].split(" ").map(x => hex("#" + x));
function landPal() {
  const out = {};
  for (const [name, wgt] of seasonMix()) for (const f in LAND_TABLE[name]) {
    out[f] = out[f] || LAND_TABLE[name][f].map(() => [0, 0, 0]);
    LAND_TABLE[name][f].forEach((c, i) => { for (let q = 0; q < 3; q++) out[f][i][q] += c[q] * wgt; });
  }
  if (LOOK.soft) for (const f in out) out[f] = out[f].map(c => softc(c));
  return out;
}
const mainSeason = () => seasonMix().reduce((a, b) => (b[1] > a[1] ? b : a))[0];
// a land colour at this hour: hazed towards the sky low down (far off), warmed by a low sun, darkened at night
function litc(c, h, haze = 0, skyH = null) {
  let x = c;
  if (haze && skyH) x = mixc(x, skyH, haze);
  x = mixc(x, hex("#ff9e72"), warmAt(h) * 0.16);
  return mixc(x, hex("#172a5e"), darkAt(h) * 0.64).map(Math.round);
}
// the land's layout, the same every time (its own seeded random)
let lseed = 11;
const lrng = () => (lseed = (lseed * 48271) % 2147483647) / 2147483647;
const TEETH = Array.from({ length: 5 * 180 }, () => lrng());
const PATCHES = Array.from({ length: 9 }, () => ({ x: lrng() * 200 - 10, b: 1 + (lrng() * 3 | 0), w: 14 + lrng() * 30, d: 1 + lrng() * 3, p: lrng() * 6 }));
const DOTS = Array.from({ length: 70 }, () => ({ x: lrng(), y: lrng(), c: lrng() }));
const MARKS = Array.from({ length: 90 }, () => ({ x: lrng(), y: lrng(), k: lrng() }));
const CROWNS = []; for (let x = 92; x < 186; x += 2.5 + lrng() * 2.5) CROWNS.push([x, 2 + lrng() * 2.2, lrng() * 3]);
for (let x = -6; x < 14; x += 2.5 + lrng() * 2) CROWNS.push([x, 1.8 + lrng() * 1.8, lrng() * 2]);
/* the trees, each its own object drawn as in the reference pictures (nature 1's big tree, summer 4's firs), as a
   map of tones made once: 0-4 leaves (lit to deepest), 5-7 bark (lit, plain, shaded), -1 nothing */
function toneMap(w, h) {
  const t = new Int8Array(w * h).fill(-1);
  return { w, h, t, set(X, Y, v) { X = Math.round(X); Y = Math.round(Y); if (X >= 0 && X < w && Y >= 0 && Y < h) t[Y * w + X] = v; }, get(X, Y) { return X >= 0 && X < w && Y >= 0 && Y < h ? t[Y * w + X] : -1; } };
}
// a bough from (x, y) (y up from the ground) leaning ang from straight up, len long, thick at the root; its tip back
function bough(m, ox, x, y, ang, len, thick) {
  for (let k = 0; k <= len; k++) {
    const px = x + Math.sin(ang) * k, py = y + Math.cos(ang) * k, th = Math.max(1, Math.round(thick * (1 - k / len * 0.7)));
    for (let j = 0; j < th; j++) m.set(ox + px + j, m.h - 1 - py, j === 0 && th > 1 ? 5 : j === th - 1 ? 7 : 6);
  }
  return [x + Math.sin(ang) * len, y + Math.cos(ang) * len];
}
// the big tree, traced pixel for pixel from the small tree in nature 5 (its outline, its leaf clumps and their light,
// its trunk): 0-5 its leaves from the lightest flecks to the darkest, 6 and 8 its bark; only the colours change, with
// the seasons. In winter the same outline holds bare boughs instead: a leader up the middle and boughs off it,
// angled up and out, with twigs
const TREE_N5 = [
  ".....................22......................",
  ".....................223.....................",
  "....................20033....................",
  "..................33000333...................",
  ".................3330011133..................",
  "................22.22231133..................",
  "...............222.2233333...................",
  ".............332222333333....................",
  "............33322223333333..33...............",
  "............332222333333333333...............",
  "...............222333333333333...............",
  ".............222222311333333333..............",
  ".............2222221113333333333.............",
  "............21200221133334433333.............",
  "...........2110002222333444433...............",
  ".........22111002222223444444................",
  ".........2111122222222344444444..............",
  "..........211122222222233444444..............",
  "...........212222233322344444445.............",
  "...........22..2223333334444444555...........",
  "................222322333344444455...........",
  "..........22..11122222223444.4445............",
  ".........20011111222222224433................",
  ".......2200011111222222222344444.............",
  ".......22002111122223222223444444............",
  "........222222222223322223334444455..........",
  ".........22222222222332233334444555..........",
  "..........222222222223334434444455...........",
  ".........222222222222344444444444............",
  ".........222222222222244444444444............",
  "........2222222222222224444444544............",
  "........222222222222322344444555.............",
  "........22.222222200333344444455.............",
  "............22222000333444444444.55..........",
  "............22222001133444444444.555.........",
  "...33...22222222222111334444444.55544........",
  "...333..22222222222111133444444445444.444....",
  "....3311.22222222222111333444444444444444....",
  "....2111..00022222223333344434444444444445...",
  "...2211110000222222223333443344444444444555..",
  "...2221110002222222223443333444444444444455..",
  "..222221111222222233334443344444444444444....",
  "..2222222222222222233444443444444444444......",
  ".....2222222222332234444444444444444444......",
  "...222222222223333334444444444444444444.44...",
  "...222222222233223333344444444444444444444...",
  "....222222223322232233344444444444444444444..",
  "....2222222222222222344444444444444444444444.",
  "...33222222222222222244444444444444444444444.",
  "..333233222222222222234444444444444444444....",
  "..33.333222222222222223444444444444444444455.",
  ".....3311122222222232233444444444444444444555",
  ".......11112222233333333344444444444444444335",
  "........111222222223333334444444444444444333.",
  "....222211122222222233344444444444444443333..",
  "....22222222222222222334444444444444444433...",
  ".222222222222222222223334444444444444444433..",
  "33222222222222222223333444444444444444444333.",
  "33322222222222222233333444444444444444333333.",
  "3332222222222222223322244433444444443333333..",
  ".32222222222222222222222333344444444333..33..",
  "..222222222222222222232233344444444433.......",
  "..22222222222222222223333344444444554........",
  "..22222222222222222223333344444444555........",
  "...2222222222222222222223333444344455........",
  "....32222222222222222222333344333444.33......",
  "...332222222222222222223333333333443333......",
  "..333222222222222222222333333333333333.......",
  "..33222222222222222222233333333333333........",
  "....222.332222222222222223333333333333.......",
  ".......3332222222222222222333333333333.......",
  ".......3322222222222223222333333.3333........",
  "........222222222222223333333333...33........",
  "........222222222222222333...................",
  "..........22282222222223333..................",
  "............8822.222.833333..................",
  "..............88..88.8833....................",
  "...............88.88.888.....................",
  "................6666.888.....................",
  ".................666.888.....................",
  "..................666688.....................",
  "...................66688.....................",
  "....................6688.....................",
  ".....................888.....................",
  ".....................88......................",
  "....................888......................",
  "....................888......................",
  "....................888......................",
  "....................888......................",
  "....................888......................",
  "....................8888.....................",
  "....................8888.....................",
  "...................88888.....................",
  "...................88888.....................",
  "...................88888.....................",
  "...................88888.....................",
  "...................88888.....................",
  "...................88888.....................",
];
function tracedTree(rows) {
  const w = rows[0].length, h = rows.length, m = toneMap(w, h);
  rows.forEach((r, Y) => { for (let X = 0; X < w; X++) if (r[X] !== ".") m.t[Y * w + X] = +r[X]; });
  return { m, ox: rows[h - 1].indexOf("8") + 2 };
}
// in winter, the same tree bare. Its own trunk stays, and the lit bough off it, up to where its leaves begin;
// from there it branches the way this tall broadleaf does: the trunk runs on up to the top a little crooked, putting
// out branches steeply upward at uneven gaps and angles, longer low down, and they and the limb on the left fork in two
// (now and then three) at uneven angles and lengths, thinner each time, within the outline its leaves had. Snow lies only along the tops of
// the boughs that lean over, not the upright ones (0 snow, 1 its shade, 6 and 8 bark)
function bareTree(rows, R, o = {}) {
  const gap = o.gap || 4, lean = o.lean || 0.45, crook = o.crook || 0.35, forks = o.forks || 2, sideLen = o.len || 0.5;
  const w = rows[0].length, h = rows.length, m = toneMap(w, h);
  // its trunk and the lit bough off it, as traced, up to where they go in among the leaves (row 78)
  rows.forEach((r, Y) => { if (Y >= 78) for (let X = 0; X < w; X++) if (r[X] === "6" || r[X] === "8") m.t[Y * w + X] = +r[X]; });
  const span = rows.map(r => { const a = r.search(/[0-5]/); return a < 0 ? null : [a, Math.max(...[..."012345"].map(c => r.lastIndexOf(c)))]; });
  const top = span.findIndex(v => v);
  const bot = span.length - 1 - [...span].reverse().findIndex(v => v);   // (low down where the boughs set out, anywhere goes)
  const inside = (X, Y) => { if (Y < top - 1) return false; if (Y >= bot - 4) return true; for (let d = 0; d < 4; d++) { const sp = span[Y + d] || span[Y - d]; if (sp) return X >= sp[0] - 1 && X <= sp[1] + 1; } return true; };
  const grow = (x, y, ang, len, thick, depth) => {
    let lastX = -1, lastY = -1;
    for (let k = 0; k < len; k++) {
      if (k % 3 === 0) ang += (R() - 0.5) * crook;                        // a little crooked
      ang *= 0.97;                                                         // and drawn slowly upright
      x += Math.sin(ang); y -= Math.cos(ang);
      const X = Math.round(x), Y = Math.round(y);
      if (!inside(X, Y)) { x -= Math.sin(ang); y += Math.cos(ang); depth = Math.min(depth, 0); break; }   // stop on the last pixel drawn
      if (X === lastX && Y === lastY) continue; lastX = X; lastY = Y;
      m.set(X, Y, 8); if (thick > 1) m.set(X + (Math.sin(ang) > 0.4 ? 0 : 1), Y + (Math.sin(ang) > 0.4 ? 1 : 0), thick > 2 ? 6 : 8);
      if (Math.abs(Math.sin(ang)) > 0.55 && m.get(X, Y - 1) < 0 && R() < 0.6) m.set(X, Y - 1, R() < 0.8 ? 0 : 1);   // snow on a leaning bough
    }
    if (depth <= 0) {                                                      // a twig at the very end
      for (const d of [R() < 0.5 ? -0.45 : 0.4]) if (R() < 0.6) {
        let tx = x, ty = y, ta = ang + d + (R() - 0.5) * 0.3;
        for (let k = 0; k < 2 + R() * 2; k++) { tx += Math.sin(ta); ty -= Math.cos(ta); if (inside(Math.round(tx), Math.round(ty)) && m.get(Math.round(tx), Math.round(ty)) < 0) m.set(tx, ty, 8); }
      }
      return;
    }
    const n = R() < 0.15 ? 3 : 2, spread = 0.3 + R() * 0.25, tilt = (R() - 0.5) * 0.25;
    for (let i = 0; i < n; i++) {
      const f = n === 2 ? (i ? 1 : -1) : i - 1, uneven = 0.75 + R() * 0.5;
      grow(x, y, ang + tilt + f * spread * uneven, len * (0.78 + R() * 0.2), Math.max(1, thick - 1), depth - 1);
    }
  };
  // the trunk on up to the top, a little crooked, putting out branches as it goes: at uneven gaps, mostly to
  // alternate sides but not always, steeply up, longer low down where the leaves were wide, each forking once or twice
  // (as thick as it is where it goes in among the leaves, narrowing gradually to a single pixel near the top)
  let x = 22, y = 78, ang = 0.03, side = 1, next = 3 + (R() * 3 | 0);
  for (let k = 0; y > top + 2; k++) {
    if (k % 4 === 0) ang = clampv(ang + (R() - 0.5) * 0.18, -0.12, 0.12);
    x += Math.sin(ang); y -= Math.cos(ang);
    const X = Math.round(x), Y = Math.round(y), up = (78 - Y) / (78 - top), thick = up < 0.3 ? 3 : up < 0.65 ? 2 : 1;
    for (let j = 0; j < thick; j++) m.set(X - (thick > 2 ? 1 : 0) + j, Y, 8);
    if (--next <= 0 && Y > top + 8) {
      side = R() < 0.7 ? -side : side;
      const low = (Y - top) / (78 - top), sp = span[Y] || span[Y + 1] || [X - 8, X + 8], room = side > 0 ? sp[1] - X : X - sp[0];
      const a = side * (0.3 + low * lean + R() * 0.25);                   // lower ones lean out further, upper ones steeper
      grow(X, Y, a, Math.max(3, room / Math.sin(Math.abs(a)) * (sideLen + R() * 0.3)), Y > 50 ? 2 : 1, low > 0.45 ? forks : R() < 0.4 ? forks - 1 : 0);
      next = gap + (R() * 5 | 0);
    }
  }
  grow(16.5, 78.5, -0.62, 10, 2, 3);                                       // its lit bough to the left, carrying on the way it went
  // keep only what joins on to the trunk: anything left loose (a stub, a twig) goes
  const keep = new Uint8Array(w * h), st = [];
  for (let X = 0; X < w; X++) if (m.get(X, h - 1) >= 0) { keep[(h - 1) * w + X] = 1; st.push([X, h - 1]); }
  while (st.length) {
    const [X, Y] = st.pop();
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = X + dx, ny = Y + dy, k = ny * w + nx;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && !keep[k] && m.t[k] >= 0) { keep[k] = 1; st.push([nx, ny]); }
    }
  }
  for (let k = 0; k < w * h; k++) if (!keep[k]) m.t[k] = -1;
  return { m, ox: rows[h - 1].indexOf("8") + 2 };
}
// a fir: tiers of drooping boughs, each wider at its foot with its tips hanging a pixel lower, lit on the left and
// shaded on the right, darker clumps here and there, a thin spire on top and a stub of trunk under it
function makePine(Hh, R) {
  const wmax = Math.round(Hh * 0.46), w = wmax + 8, h = Hh + 7, m = toneMap(w, h), cx = w >> 1, nT = Math.max(3, Math.round(Hh / 6));
  const tierW = Array.from({ length: nT + 1 }, () => 0.85 + R() * 0.3), tierS = Array.from({ length: nT + 1 }, () => (R() - 0.5) * 1.5), rows = [];
  for (let y = 0; y < 3; y++) { m.set(cx - 1, h - 1 - y, 6); m.set(cx, h - 1 - y, 7); }
  for (let y = 0; y < Hh; y++) {
    const t = y / Hh, ti = Math.floor(t * nT), f = 1 - ((t * nT) % 1), Y = h - 3 - y;
    const hw = Math.round(wmax / 2 * (0.12 + 0.88 * (1 - t)) * (0.45 + 0.55 * f) * tierW[ti]), sh = Math.round(tierS[ti] * f);
    rows.push({ Y, hw, sh, f, ti });
    for (let x = -hw; x <= hw; x++) {
      const u = x / Math.max(1, hw);
      let tone = u < -0.4 ? 1 : u < 0.3 ? 2 : 3;
      if (f > 0.82 && y > 0 && R() < 0.75) tone = Math.min(4, tone + 1);   // the foot of each tier mostly in shade
      m.set(cx + x + (Math.abs(u) > 0.6 ? sh : 0), Y, tone);
    }
    if (f > 0.75 && hw > 1) {                                           // drooping tips, one or two pixels
      const dl = 1 + (R() < 0.4), dr = 1 + (R() < 0.4);
      for (let k = 1; k <= dl; k++) m.set(cx - hw - 1 + sh, Y + k - 1, k > 1 ? 3 : 2);
      for (let k = 1; k <= dr; k++) m.set(cx + hw + 1 + sh, Y + k - 1, 4);
    }
    if (f < 0.25 && hw > 1) m.set(cx - hw + 1, Y, 0);                    // light catching a tier's top
  }
  for (let k = 0; k < Hh * 0.6; k++) {                                  // clumps of needles a tone darker, more on the right
    const X = cx + Math.round((R() - 0.3) * wmax * 0.4), Y = h - 3 - Math.round(R() * Hh * 0.9), t = m.get(X, Y);
    if (t >= 1 && t <= 3) { m.set(X, Y, t + 1); if (m.get(X + 1, Y) === t) m.set(X + 1, Y, t + 1); if (m.get(X, Y + 1) >= 1) m.set(X, Y + 1, Math.min(4, t + 1)); }
  }
  m.set(cx, h - 3 - Hh, 2); m.set(cx, h - 4 - Hh, 3); m.set(cx, h - 5 - Hh, 3);
  return { m, ox: cx, rows, top: h - 5 - Hh };
}
// a fir in winter, as in winter nature 3: on every tier a band of snow lying along its spreading boughs, out on both
// sides of the trunk, a pixel or two deep with gaps here and there, and a cap on the spire (0 is snow)
function snowy(t, R) {
  const m = toneMap(t.m.w, t.m.h); m.t.set(t.m.t);
  const cx = t.ox, tiers = {};
  for (const r of t.rows) if (r.hw > 1 && (!tiers[r.ti] || Math.abs(r.f - 0.7) < Math.abs(tiers[r.ti].f - 0.7))) tiers[r.ti] = r;
  for (const { Y, hw, sh } of Object.values(tiers)) for (let x = -hw; x <= hw; x++) {
    const u = Math.abs(x) / hw; if (u < 0.25 || R() < 0.15) continue;
    const X = cx + x + (u > 0.6 ? sh : 0);
    if (m.get(X, Y) >= 0) m.set(X, Y, 0);
    if (u > 0.45 && R() < 0.6 && m.get(X, Y - 1) >= 0) m.set(X, Y - 1, 0);
    else if (u > 0.45 && m.get(X, Y - 1) < 0 && R() < 0.5) m.set(X, Y - 1, 0);
  }
  m.set(cx, t.top, 0); m.set(cx, t.top + 1, 0);
  return { m, ox: t.ox };
}
const TREE_OBJS = [   // [kind, x, how far below the horizon it stands (or "hill"), the tree]
  ["pine", 46, "hill", makePine(14, lrng)], ["pine", 54, "hill", makePine(10, lrng)], ["pine", 79, "hill", makePine(17, lrng)],
  ["pine", 7, 9, makePine(46, lrng)],
  ["broad", 140, 14, tracedTree(TREE_N5)],
];
for (const o of TREE_OBJS) if (o[0] === "pine") o[3].snow = snowy(o[3], lrng);
const seeded = q => () => (q = (q * 48271) % 2147483647) / 2147483647;
const BARE_TREE = bareTree(TREE_N5, seeded(173), { gap: 7, lean: 0.7, forks: 1, len: 0.65 });   // the one picked: sparse boughs spreading wide
const FALLEN = Array.from({ length: 26 }, () => [lrng(), lrng(), lrng()]);   // leaves on the grass round the big tree in autumn
const BAND_Y = [0, 6, 14, 25, 40];                 // where each band of the meadow starts, below the horizon

let landP = null;                                    // this minute's land colours (for the swaying grass)
function paintLand(h) {
  const g = landG, skyLow = skyAt(h)[2], P = landP = landPal();
  g.clearRect(0, 0, W, H);
  const col = (c, haze = 0) => css(litc(c, h, haze, skyLow));
  const fillTo = (fn, c, y1 = H) => { g.fillStyle = c; for (let x = 0; x < W; x++) { const y = Math.round(fn(x)); if (y < y1) g.fillRect(x, y, 1, y1 - y); } };
  // the far hills: big soft shapes hazy with the sky, each a little darker on its lower slope
  const back = x => ridge(x, horizon - 22, [[7, 0.021, 1.3], [3, 0.06, 0.4]]);
  const front = x => ridge(x, horizon - 9, [[5, 0.028, 4], [2, 0.08, 1]]);
  fillTo(back, col(P.hill[0], 0.6)); fillTo(x => back(x) + 7 + 4 * Math.sin(x * 0.04 + 2), col(P.hill[1], 0.6));
  // the wood along the near hill: round crowns in a jagged line, lit on their upper left
  const crowns = CROWNS.map(([x, r, k]) => [x, front(x) - r * 0.6 - k, r]);
  for (const [cx, cy, r] of crowns) { g.fillStyle = col(P.wood[2], 0.25); disc(g, cx, cy, Math.round(r)); }
  for (const [cx, cy, r] of crowns) { g.fillStyle = col(P.wood[1], 0.25); disc(g, cx - 0.6, cy - 0.6, Math.max(1, Math.round(r) - 1)); }
  for (const [cx, cy, r] of crowns) { g.fillStyle = col(P.wood[0], 0.25); g.fillRect(Math.round(cx - r * 0.6), Math.round(cy - r * 0.7), Math.max(1, Math.round(r * 0.8)), 1); }
  fillTo(front, col(P.hill[0], 0.3)); fillTo(x => front(x) + 5 + 3 * Math.sin(x * 0.05), col(P.hill[1], 0.3));
  paintCave(g, col, Math.round(front(CAVE.x)));
  // the meadow, band by band, each with a ragged top edge of grass blades
  for (let b = 0; b < 5; b++) {
    g.fillStyle = col(P.grass[b], b ? 0 : 0.15);
    for (let x = 0; x < W; x++) {
      const t = TEETH[b * 180 + x], y = Math.round(horizon + BAND_Y[b] + (b ? 1.5 * Math.sin(x * 0.07 + b * 2) : 0)) - (b && t > 0.55 ? (t > 0.85 ? 2 : 1) : 0);
      g.fillRect(x, y, 1, H - y);
    }
  }
  // lighter patches in the grass, ragged along the top like the bands
  for (const pt of PATCHES) {
    const y0 = horizon + BAND_Y[pt.b] + 3 + pt.d * 2;
    g.fillStyle = col(P.grass[pt.b - 1]);
    for (let x = Math.round(pt.x); x < pt.x + pt.w; x++) {
      const u = (x - pt.x) / pt.w, th = Math.round((1.2 + pt.d) * Math.sin(Math.PI * u)), t = TEETH[(pt.b * 180 + x * 7) % 900];
      if (th > 0) g.fillRect(x, Math.round(y0 - th - (t > 0.7 ? 1 : 0)), 1, th * 2);
    }
  }
  // dotted over the far and middle grass: little flowers in spring and summer, fallen leaves and dry grass in autumn,
  // stalks through the snow in winter; nearer, marks of grass: tufts, tall dry blades in autumn, bare stalks in winter
  const se = mainSeason();
  for (const d of DOTS) { g.fillStyle = col(P.fleck[d.c * 3 | 0]); const x = Math.round(d.x * W), y = Math.round(horizon + 3 + d.y * d.y * 34); g.fillRect(x, y, 1, 1); if (se === "autumn" && d.c < 0.66) g.fillRect(x + 1, y, 1, 1); }
  for (const m of MARKS) {
    const y = Math.round(horizon + 16 + m.y * (H - horizon - 16)), x = Math.round(m.x * W), big = y > FEET;
    if (se === "winter") { if (m.k < 0.5) { g.fillStyle = col(P.fleck[m.k < 0.25 ? 0 : 1]); g.fillRect(x, y - 1, 1, 2); g.fillRect(x + 1, y - (big ? 2 : 1), 1, 1); } continue; }
    if (se === "autumn") {
      g.fillStyle = col(m.k < 0.5 ? P.grass[0] : P.dark[0]); g.fillRect(x, y - 2, 1, 3); g.fillRect(x + 1, y - 1, 1, 2); if (big) g.fillRect(x - 1, y - 3, 1, 3);
      if (m.k > 0.85) { g.fillStyle = col(P.fleck[0]); g.fillRect(x + 3, y + 1, 2, 1); }
      continue;
    }
    g.fillStyle = col(m.k < 0.6 ? P.dark[0] : P.grass[m.k < 0.8 ? 1 : 2]);
    g.fillRect(x, y, 1, 1); g.fillRect(x - 1, y + 1, 1, 1); g.fillRect(x + 1, y + 1, 1, 1); if (big) g.fillRect(x, y - 1, 1, 1);
  }
  paintTrees(h, P, skyLow);
}
// a cave in the near hill: the hill swells up a little there (in its own colours), and at the swell's foot opens a low
// dark mouth framed by a few stones of the hill, with bushes of the wood either side (something lives in there: at
// night, now and then, its eyes shine)
const CAVE = { x: 31, y: 0 };
function paintCave(g, col, hy) {
  const P = landP, se = mainSeason(), rock = mixc(P.hill[1], P.wood[2], 0.45), rockHi = mixc(P.hill[0], P.hill[1], 0.5);
  // the swell: the hill's top colour, its far side in the hill's shade
  for (let dx = -10; dx <= 10; dx++) {
    const t = Math.round(5.5 * Math.cos(dx / 10 * Math.PI / 2) ** 1.4), x = CAVE.x + dx;
    if (t <= 0) continue;
    g.fillStyle = col(dx > 3 ? P.hill[1] : P.hill[0], 0.3); g.fillRect(x, hy - t, 1, t + 1);
  }
  // its mouth: an arch, darkest inside, a lip of stone over it and a stone or two at its feet
  const deep = col(mixc(P.wood[2], hex("#151320"), 0.55), 0.3), deeper = col(mixc(P.wood[2], hex("#0c0a14"), 0.75), 0.25);
  const top = dx => hy - 4 + (Math.abs(dx) === 3 ? 2 : Math.abs(dx) === 2 ? 1 : 0);
  for (let dx = -3; dx <= 3; dx++) { g.fillStyle = Math.abs(dx) < 2 ? deeper : deep; g.fillRect(CAVE.x + dx, top(dx), 1, hy + 3 - top(dx)); }
  g.fillStyle = col(rock, 0.3);
  for (let dx = -3; dx <= 3; dx++) g.fillRect(CAVE.x + dx, top(dx) - 1, 1, 1);
  g.fillRect(CAVE.x - 4, hy - 1, 1, 3); g.fillRect(CAVE.x + 4, hy, 1, 3);
  g.fillStyle = col(rockHi, 0.3); g.fillRect(CAVE.x - 2, top(-2) - 1, 2, 1); g.fillRect(CAVE.x - 5, hy + 1, 2, 1); g.fillRect(CAVE.x + 5, hy + 2, 1, 1);
  // bushes of the wood either side
  for (const [bx, r] of [[-8, 2.6], [-6, 1.6], [8, 2.2]]) {
    const cx = CAVE.x + bx, cy = hy - 1;
    g.fillStyle = col(P.wood[2], 0.25); disc(g, cx, cy, Math.round(r));
    g.fillStyle = col(P.wood[1], 0.25); disc(g, cx - 0.6, cy - 0.6, Math.max(1, Math.round(r) - 1));
    g.fillStyle = col(P.wood[0], 0.25); g.fillRect(Math.round(cx - r * 0.6), Math.round(cy - r * 0.7), Math.max(1, Math.round(r * 0.8)), 1);
  }
  if (se === "winter") { g.fillStyle = col(hex("#ffffff"), 0.2); for (let dx = -7; dx <= 7; dx++) { const t = Math.round(5.5 * Math.cos(dx / 10 * Math.PI / 2) ** 1.4); if (Math.abs(dx) > 3) g.fillRect(CAVE.x + dx, hy - t, 1, 1); } g.fillRect(CAVE.x - 3, top(-3) - 2, 7, 1); }
  CAVE.y = hy;
}
// the stump under the big tree (pet.js STUMP: 하와 sits on it to play), in the tree's own bark and a pale cut top with
// rings, lined like the trees (a step deeper than its bark, never ink), lit with the land; snow on its top in winter
const STUMP_MAP = ["....KKKKKKK....", "..KKtttttttKK..", ".KttrrrrrrrttK.", "KttrttrrrttrttK", "KbttrrrrrrrttbK", "KbbbtttttttbbbK",
  "KbBbbbbbbbbbBbK", "KbBbbbBbbbbbBbK", "KbbbbbBbbbBbbbK", "KKbbbbbbbbbbbKK"];
function drawStump(g, h) {
  if (typeof STUMP === "undefined" || !landP) return;
  const se = mainSeason(), bark = mainSeason() === "autumn" ? LAND_TABLE.summer.bark.map(c => softc(c)) : landP.bark;   // (autumn's bark is near black)
  const wood = mixc(bark[0], hex("#e9cf9f"), 0.62), ring = mixc(bark[0], hex("#c99b6a"), 0.55);
  const P = { K: litc(mixc(bark[2], bark[1], 0.3), h), t: litc(wood, h), r: litc(ring, h), b: litc(mixc(bark[0], hex("#8a6a4c"), 0.35), h), B: litc(bark[1], h) };
  const gy = FEET - Math.round(STUMP.z), x0 = STUMP.x - 7, y0 = gy - STUMP_MAP.length;
  groundShadow(g, STUMP.x, gy, 15, 0.7);
  STUMP_MAP.forEach((row, j) => [...row].forEach((ch, i) => { if (P[ch]) { g.fillStyle = css(P[ch]); g.fillRect(x0 + i, y0 + j, 1, 1); } }));
  const sitting = typeof pet !== "undefined" && pet.act === "strum" && Math.abs(pet.x - STUMP.x) < 2;
  if (!sitting && (se === "winter" || typeof WX !== "undefined" && WX.depth > 0.2)) {
    g.fillStyle = css(litc(hex("#f4f7fc"), h)); g.fillRect(x0 + 4, y0, 7, 1); g.fillRect(x0 + 2, y0 + 1, 11, 1); g.fillRect(x0 + 2, y0 + 2, 11, se === "winter" || WX.depth > 0.5 ? 2 : 1);
  } else if (se === "spring" || se === "summer") {                 // a little sprout off its side
    g.fillStyle = css(litc(landP.grass[2], h)); g.fillRect(x0 + 13, y0 + 6, 1, 2); g.fillRect(x0 + 14, y0 + 5, 2, 1);
    g.fillStyle = css(litc(landP.grass[0], h)); g.fillRect(x0 + 12, y0 + 5, 1, 1);
  }
}
// at night, deep in the night mostly, a pair of eyes opens in the dark of the cave now and then: they glow, blink,
// look this way and that, and close again (sometimes two of them)
let caveEyes = null, nextEyes = performance.now() + 15000;
function drawCaveEyes(g, now, h) {
  const night = darkAt(h), late = h >= 21.5 || h < 4;
  if (!caveEyes && night > 0.8 && (late || Math.random() < 0.3) && now > nextEyes) {
    caveEyes = { t0: now, dur: 2600 + Math.random() * 2200, two: Math.random() < 0.25, c: Math.random() < 0.7 ? [255, 214, 90] : [255, 110, 110] };
    nextEyes = now + (late ? 25000 + Math.random() * 35000 : 60000 + Math.random() * 60000);
  }
  if (!caveEyes) return;
  const e = caveEyes, t = now - e.t0;
  if (t > e.dur || night < 0.6) { caveEyes = null; return; }
  const a = Math.min(1, t / 350, (e.dur - t) / 350);           // they open slowly and close
  const blink = (t > e.dur * 0.45 && t < e.dur * 0.45 + 130) || (t > e.dur * 0.8 && t < e.dur * 0.8 + 110);
  if (blink) return;
  const look = t < e.dur * 0.3 ? 0 : t < e.dur * 0.6 ? -1 : 1;
  const eye = (x, y, k) => {
    g.fillStyle = css(e.c, 0.28 * a * k); g.fillRect(x - 1, y, 1, 1); g.fillRect(x + 1, y, 1, 1); g.fillRect(x, y - 1, 1, 1); g.fillRect(x, y + 1, 1, 1);   // a faint glow round each
    g.fillStyle = css(mixc(e.c, [255, 255, 255], 0.35), a * k); g.fillRect(x, y, 1, 1);
  };
  const pair = (x, y, k) => { eye(x, y, k); eye(x + 3, y, k); };
  pair(CAVE.x - 2 + look, CAVE.y - 1, 1);
  if (e.two && t > 600) pair(CAVE.x + (look > 0 ? -3 : 1), CAVE.y + 1, 0.7);
}
// the trees on their own layer (over the snow), back to front, each with its shadow on the grass; the big tree as
// the season has it (green, autumn 1's peach and rust with fallen leaves round it, bare with snow on its boughs)
function paintTrees(h, P, skyLow) {
  const g = treeG, img = g.createImageData(W, H), se = mainSeason();
  TREE_CVS.length = 0;
  const sky3 = skyAt(h);
  const hill = x => ridge(x, horizon - 9, [[5, 0.028, 4], [2, 0.08, 1]]);
  for (const [kind, x, at, tree] of TREE_OBJS) {
    const haze = at === "hill" ? 0.25 : 0, base = at === "hill" ? Math.round(hill(x)) + 1 : horizon + at;
    const t = kind !== "broad" ? (se === "winter" ? tree.snow : tree) : se === "winter" ? BARE_TREE : tree;
    // firs: 0-4 needles, 5-7 bark; the big tree: 0-5 leaves, 6-8 bark. The sky's colour falls on them: the lit
    // tones take a little of the sky low down, the shaded ones a little of the sky overhead (gold at sunset, blue at night)
    const leaves = kind === "pine" ? P.pine : P.leaf, n = leaves.length;
    const pal = [...leaves, ...P.bark].map((c, i) => mixc(litc(c, h, haze, skyLow), mixc(sky3[2], sky3[0], Math.min(1, i / (n - 1))), 0.16).map(Math.round));
    if (at !== "hill") {                                              // its shadow on the grass
      const sh = litc(P.dark[0], h), hw = Math.round(t.m.w * 0.32);
      for (let dy = 0; dy < 3; dy++) for (let dx = -hw + dy * 3; dx < hw - dy * 3; dx++) { const i = ((base + dy - 1) * W + x + dx) * 4; img.data.set([...sh, 255], i); }
      const S = sunCast(h);                                           // and the sun's, long when it is low
      if (S) {
        const ad = new Uint8ClampedArray(t.m.w * t.m.h * 4); for (let i = 0; i < t.m.w * t.m.h; i++) ad[i * 4 + 3] = t.m.t[i] >= 0 ? 255 : 0;
        for (const [X, Y] of castPixels(ad, t.m.w, t.m.h, x - t.ox, base - (t.m.h - 1), base, S)) {
          if (X < 0 || X >= W || Y < 0 || Y >= H) continue;
          const i = (Y * W + X) * 4; if (img.data[i + 3] === 255) continue;
          img.data.set([...shadowRGB(h), Math.round(140 * S.a)], i);
        }
      }
      if (kind === "broad" && se === "autumn") for (const [u, v, c] of FALLEN) {
        const fx = Math.round(x + (u - 0.5) * 50), fy = Math.round(base - 1 + v * 7), col = litc(P.fleck[c < 0.6 ? 0 : 1], h);
        for (const dx of [0, 1]) img.data.set([...col, 255], (fy * W + fx + dx) * 4);
      }
    }
    // the tree itself on a canvas of its own, so the wind can sway its crown (its trunk stays put)
    // (with room for an outline round it, on the near trees, when the look has one)
    const { m, ox } = t, line = LOOK.line && at !== "hill" ? 1 : 0, w2 = m.w + 2 * line, h2 = m.h + line;
    const cv = document.createElement("canvas"); cv.width = w2; cv.height = h2;
    const ti = cv.getContext("2d").createImageData(w2, h2);
    for (let i = 0; i < m.w * m.h; i++) {
      const v = m.t[i]; if (v < 0) continue;
      const c = pal[v], j = ((Math.floor(i / m.w) + line) * w2 + i % m.w + line) * 4;
      ti.data[j] = c[0]; ti.data[j + 1] = c[1]; ti.data[j + 2] = c[2]; ti.data[j + 3] = 255;
    }
    if (line) {                                                       // round its leaves (or snow), not its trunk
      const tone = i => { const X = i % w2 - line, Y = Math.floor(i / w2) - line; return X >= 0 && Y >= 0 && X < m.w ? m.t[Y * m.w + X] : -1; };
      outlineData(ti.data, w2, h2, LOOK.line === "ink" ? mixc(litc(INK, h), pal[n - 1], 0.35) : pal[n - 1].map(v => v * 0.85), 128, i => tone(i) < n, 0.68);
    }
    cv.getContext("2d").putImageData(ti, 0, 0);
    TREE_CVS.push({ cv, x: x - ox - line, y: base - (m.h - 1) - line, stem: kind === "broad" ? 22 : 3, amp: kind === "broad" ? 2.2 : at === "hill" ? 0.8 : 1.3, ph: x * 0.37 });
  }
  g.putImageData(img, 0, 0);
}
const TREE_CVS = [];   // this minute's trees: { canvas, where, how tall its trunk is, how far its top sways, phase }

/* ---------- the wind in the trees, falling leaves, prints in the snow ---------- */
// the trees sway in the wind: each row of a crown is shifted by whole pixels, more the higher it is, nothing down the
// trunk; a slow swing with a quicker flutter on it, stronger as the wind gets up
function drawTrees(g, now) {
  for (const t of TREE_CVS) {
    // leaning with the wind (it blows left to right, as the clouds go) and swinging about that
    const sw = 0.55 + Math.sin(now / 1400 + t.ph) * 0.6 + Math.sin(now / 520 + t.ph * 2.3) * 0.25, H_ = t.cv.height;
    for (let r = 0; r < H_; r++) {
      const f = clampv((H_ - 1 - r - t.stem) / Math.max(1, H_ - t.stem), 0, 1), dx = Math.round(sw * wind * t.amp * Math.pow(f, 1.4));
      g.drawImage(t.cv, 0, r, t.cv.width, 1, t.x + dx, t.y + r, t.cv.width, 1);
    }
  }
}
// leaves come off the big tree now and then (more in a wind, most in autumn), flutter down with it and lie a while
const leaves = []; let nextLeaf = 0;
function updateLeaves(now, s) {
  const se = mainSeason();
  if (se !== "winter" && now > nextLeaf && leaves.length < 14) {
    if (se === "autumn" || wind > 1.1) leaves.push({ x: 128 + Math.random() * 28, y: horizon - 70 + Math.random() * 60, vy: 7 + Math.random() * 5, p: Math.random() * 6, c: Math.random(), land: horizon + 10 + Math.random() * 40, t: 0 });
    nextLeaf = now + (se === "autumn" ? 2500 + Math.random() * 3500 : 5000 + Math.random() * 7000) / Math.max(0.5, wind);
  }
  for (let i = leaves.length - 1; i >= 0; i--) {
    const l = leaves[i];
    if (l.y < l.land) { l.y = Math.min(l.land, l.y + l.vy * s); l.x += (wind * 9 + Math.sin(now / 420 + l.p) * 7) * s; }
    else if ((l.t += s) > 6) leaves.splice(i, 1);
  }
}
function drawLeaves(g, h) {
  if (!landP) return;
  for (const l of leaves) {
    g.globalAlpha = l.t > 4 ? Math.max(0, 1 - (l.t - 4) / 2) : 1;
    g.fillStyle = css(litc(mainSeason() === "autumn" ? landP.fleck[l.c < 0.6 ? 0 : 1] : landP.leaf[l.c < 0.6 ? 2 : 3], h)); g.fillRect(Math.round(l.x), Math.round(l.y), 2, 1);
    if (l.y < l.land && Math.floor(l.y / 3) % 2) g.fillRect(Math.round(l.x), Math.round(l.y) - 1, 1, 1);   // turning over as it falls
  }
  g.globalAlpha = 1;
}
// on snow (winter's snowfield, or snow lying after a snowfall) she leaves prints as she walks, left and right in turn,
// that fill in again over half a minute
const prints = []; let printX = null, printSide = 1;
const snowyGround = () => mainSeason() === "winter" || (typeof WX !== "undefined" && WX.depth > 0.25);
function updatePrints(now) {
  for (let i = prints.length - 1; i >= 0; i--) if (now - prints[i].t > 30000) prints.splice(i, 1);
  if (typeof pet === "undefined" || !snowyGround() || ["fall", "held", "peek"].includes(pet.act) || (typeof G !== "undefined" && !S.pet)) { printX = null; return; }
  if (printX === null) printX = pet.x;
  if (Math.abs(pet.x - printX) >= 6) {
    prints.push({ x: Math.round(pet.x), y: Math.round(FEET - pet.z) + (printSide > 0 ? 1 : 0), t: now });
    printSide = -printSide; printX = pet.x; if (prints.length > 90) prints.shift();
  }
}
function drawPrints(g, h) {
  if (!prints.length || !landP) return;
  const now = performance.now();
  for (const p of prints) {
    const a = 1 - (now - p.t) / 30000; if (a <= 0) continue;
    const band = [0, 6, 14, 25, 40].filter(b => p.y >= horizon + b).length - 1, snow = landP.grass[Math.max(0, band)];
    g.globalAlpha = Math.min(1, a * 1.4);                                                    // a little dent: shade in the snow's own colour,
    g.fillStyle = css(litc(mixc(snow, hex("#7895bb"), 0.5), h)); g.fillRect(p.x - 1, p.y, 2, 1);
    g.globalAlpha = Math.min(1, a * 1.4) * 0.7;                                              // its far edge softer, so it reads as a hollow
    g.fillStyle = css(litc(mixc(snow, hex("#7895bb"), 0.25), h)); g.fillRect(p.x - 1, p.y - 1, 2, 1);
  }
  g.globalAlpha = 1;
}
// the grass (or the snow) at her feet, over them. Only her own pixels are covered, with the ground just behind them
// (as the scene has it, in her shadow), so no grass comes and goes round her. The grass is fixed to the ground: its
// lowest row with a ragged top, here and there a blade tip a row higher bending with the wind; as she bobs or hops
// her feet come out of it on their own. In snow she sinks a row. Not while she is held up. Painted after her light
// (sceneTint) so the ground on her feet stays the ground's colour
let feetMarks = null, groundThings = [];
// a thing lying on the grass between x0 and x1 with its lowest pixels about row gy (pet.js onGrass)
function noteGround(g, x0, x1, gy) { const T = g.getTransform(); groundThings.push([Math.round(x0 + T.e), Math.round(x1 + T.e), Math.round(gy + T.f), Math.round(T.e)]); }
const grassK = wx => ((wx * 2654435761) >>> 0) % 7;
function sceneFeet(g, now, box) {
  feetMarks = null;
  const fm = typeof pet !== "undefined" ? pet._feetMask : null;
  if (!landP || !fm || pet.act === "held") return;
  const snow = snowyGround(), out = [], mine = (i, r) => fm.m[(1 - r) * fm.w + i] === 1;   // (her, not her shadow or what she holds)
  for (let i = 0; i < fm.w; i++) {
    const X = fm.x0 + i, wx = X - fm.wx, k = grassK(wx);
    if (mine(i, 0) && (snow || k < 5)) out.push([X, fm.gy, 0]);                       // the ground row, ragged in the grass
    if (!snow && k === 0) {                                                           // a blade tip, swaying, over her
      const sw = Math.round(Math.sin(now / 900 + wx * 0.15) * wind * 0.9);
      if (i + sw >= 0 && i + sw < fm.w && mine(i + sw, 1)) out.push([X + sw, fm.gy - 1, 1]);
    }
  }
  feetMarks = out;
}
// the grass over the lowest pixels of the things lying on it: in each column the lowest pixel near the ground
function groundMarks(g) {
  const out = [], snow = snowyGround(), b = typeof pet !== "undefined" && pet._box, now = performance.now();
  for (const [x0, x1, gy, ox] of groundThings) {
    const w = x1 - x0 + 1; if (w <= 0) continue;
    const d = g.getImageData(x0, gy - 3, w, 5).data, at = (i, r) => d[(r * w + i) * 4 + 3] > 200;
    for (let i = 0; i < w; i++) {
      const X = x0 + i, k = grassK(X - ox);
      if (b && X >= b.x && X < b.x + b.w && gy >= b.y && gy <= b.y + b.h + 2) continue;   // (not where she is)
      let r = 4; while (r >= 0 && !at(i, r)) r--; if (r < 1) continue;
      if (snow || k < 5) out.push([X, gy - 3 + r, 0]);
      if (!snow && k === 0 && at(i, r - 1)) out.push([X + Math.round(Math.sin(now / 900 + X * 0.15) * wind * 0.6), gy - 4 + r, 1]);
    }
  }
  groundThings = [];
  return out;
}
function paintFeet(g) {
  feetMarks = (feetMarks || []).concat(groundMarks(g));
  if (!feetMarks.length) return;
  let ax = 1e9, bx = -1e9, ay = 1e9, by = -1e9;
  for (const [x, y] of feetMarks) { ax = Math.min(ax, x); bx = Math.max(bx, x); ay = Math.min(ay, y); by = Math.max(by, y); }
  const w = bx - ax + 1, d = sctx.getImageData(ax, ay, w, by - ay + 1).data, h = worldHour();
  const tip = litc(mainSeason() === "autumn" ? landP.grass[0] : landP.dark[0], h), sh = [36, 44, 52];
  for (const [x, y, t] of feetMarks) {
    const i = ((y - ay) * w + x - ax) * 4, c = t ? tip : [d[i], d[i + 1], d[i + 2]];
    g.fillStyle = css(mixc(c, sh, 0.2).map(Math.round)); g.fillRect(x, y, 1, 1);    // in her shadow
  }
}
// the light of the sky on her (and what she holds): a little of the sky's colour, the gold of a low sun, the blue of
// night, laid over her layer as on the land, so she belongs in the scene at every hour. Her sprites are not changed;
// this is only how they are lit. (The sign, drawn over her when she is behind it, is lit already, so it goes back on.)
function sceneTint(g, now) {
  const h = worldHour(), d = darkAt(h), wm = warmAt(h), sky = skyAt(h);
  g.save(); g.globalCompositeOperation = "source-atop";
  g.fillStyle = css(sky[1], 0.1); g.fillRect(0, 0, W, H);
  if (wm > 0.02) { g.fillStyle = css(mixc(sky[2], hex("#ff9e72"), 0.7), wm * 0.16); g.fillRect(0, 0, W, H); }
  if (d > 0.02) { g.fillStyle = css(hex("#172a5e"), d * 0.45); g.fillRect(0, 0, W, H); }
  g.restore();
  paintFeet(g);
  if (typeof pet !== "undefined" && typeof SIGN_Z !== "undefined" && pet.z > SIGN_Z + 0.5) drawSignOver(g, now);
}

/* ---------- update ---------- */
let wind = 1;
function sceneUpdate(now, dt) {
  const s = dt / 1000, h = worldHour(), dark = darkAt(h);
  updateLeaves(now, s); updatePrints(now);
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
  if (!faceCloud && now > nextFace) sendVisitor();
  if (faceCloud) { faceCloud.x += faceCloud.v * s; if (faceCloud.x > W + 8) { faceCloud = null; nextFace = now + 70000 + rnd() * 100000; } }


  if (!flock && now > nextFlock && dark < 0.45 && !foul) {
    const dir = rnd() < 0.5 ? 1 : -1, n = 2 + (rnd() * 4 | 0);
    flock = { dir, x: dir > 0 ? -20 : W + 20, y: 40 + rnd() * 70, v: 16 + rnd() * 8,
      birds: Array.from({ length: n }, (_, i) => ({ dx: -i * 7 * dir + rnd() * 3, dy: (i % 2 ? 4 : -2) * Math.ceil(i / 2) + rnd() * 2, p: rnd() * 6 })) };
  }
  if (flock) { flock.x += flock.dir * flock.v * s; if (flock.x < -60 || flock.x > W + 60) { flock = null; nextFlock = now + 22000 + rnd() * 30000; } }

  if (!star && now > nextStar && dark > 0.7) star = { x: 20 + rnd() * 140, y: 8 + rnd() * 50, vx: -70 - rnd() * 40, vy: 30 + rnd() * 15, t: 0 };
  if (star) { star.t += dt; star.x += star.vx * s; star.y += star.vy * s; if (star.t > 900) { star = null; nextStar = now + 12000 + rnd() * 26000; } }

  const hd = petHead();
  flies.forEach((f, i) => {
    f.vx += (rnd() - 0.5) * 18 * s; f.vy += (rnd() - 0.5) * 14 * s; f.vx *= 0.98; f.vy *= 0.98;
    if (hd && i < 4 && dark > 0.5) {                                   // a few come round her, drifting in loose loops
      const a = now / (1800 + i * 400) + i * 1.6, tx = hd.x + Math.cos(a) * (12 + i * 3), ty = hd.y + 8 + Math.sin(a * 1.3) * 7;
      f.vx += (tx - f.x) * 1.2 * s; f.vy += (ty - f.y) * 1.2 * s;
    }
    f.x = (f.x + f.vx * s + W) % W; if (!f.y) f.y = horizon + rnd() * (FEET - horizon);
    f.y = Math.max(horizon - 20, Math.min(FEET + 6, f.y + f.vy * s));
  });

  updateCritters(now, s, dark, foul);

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

/* ---------- little lives on the meadow ---------- */
// butterflies (wandering, resting on a flower, circling her head, landing on it), bees that visit the flowers, a frog
// by the puddles after rain. Each keeps to its season and to fair daylight, comes now and then and does not stay long; what passes in front of her is drawn over her (sceneFront)
const BFLY = [], BEES = [];
let nextBfly = performance.now() + R0(15000, 30000), frog = null, frogDone = false;
let nextBees = performance.now() + R0(20000, 40000);
function R0(a, b) { return a + Math.random() * (b - a); }
const R_ = R0;
function petHead() {
  if (typeof pet === "undefined" || !pet.box || ["held", "fall", "peek", "dash"].includes(pet.act)) return null;
  return { x: pet.box.x + pet.box.w / 2, y: pet.box.y + 2, still: pet.act === "idle" || (typeof G !== "undefined" && G.sleeping) };
}
const dryFlower = () => { const ok = FLOWERS.filter(f => !(typeof inPuddle === "function" && inPuddle(Math.round(f.x), Math.round(f.yy)))); return ok[Math.random() * ok.length | 0] || FLOWERS[0]; };
const airPoint = () => ({ x: R_(12, W - 12), y: R_(horizon - 24, FEET - 14) });
function steer(b, tx, ty, speed, s, k = 3) {
  const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy) || 1;
  b.vx += (dx / d * speed - b.vx) * Math.min(1, k * s); b.vy += (dy / d * speed - b.vy) * Math.min(1, k * s);
  b.x += b.vx * s; b.y += b.vy * s; if (Math.abs(b.vx) > 2) b.dir = Math.sign(b.vx);
  return d;
}
// butterfly kinds: wing colour a, its marks b, hind wing c, and where the marks go (tips, spots, bands)
const BFLY_KINDS = [
  { a: "#fff0a8", b: "#e9bd6a", c: "#ffe48e", m: "tips" },     // a pale yellow with amber tips
  { a: "#fffaf0", b: "#a9a7b8", c: "#f1ece2", m: "tips" },     // a cabbage white, grey tips
  { a: "#ffd0dc", b: "#fff6f8", c: "#ffbccd", m: "spots" },    // pink with white dots
  { a: "#c9e4f7", b: "#8fbfe3", c: "#b5d8f2", m: "tips" },     // a little blue
  { a: "#ddd2f8", b: "#9f8bd8", c: "#cbbcf2", m: "spots" },    // lavender with eye spots
  { a: "#fff1c4", b: "#a08064", c: "#f5e2a8", m: "bands" },    // a swallowtail, soft brown bands
];
// wings open (9x7, body k in the middle column, feelers on top), each wing edged a step deeper (e) so it reads on the
// grass; half open drops the outer columns; shut is the pair raised together, seen edge on
const BFLY_OPEN = {
  tips:  ["...k.k...", ".bbekebb.", "bbaakaabb", "eaaakaaae", ".eeakaee.", ".ecckcce.", "..ee.ee.."],
  spots: ["...k.k...", ".eeekeee.", "eaaakaaae", "eabakabae", ".eeakaee.", ".ecckcce.", "..ee.ee.."],
  bands: ["...k.k...", ".eeekeee.", "eabakabae", "eaabkbaae", ".eeakaee.", ".ebckcbe.", "..ee.ee.."],
};
const halfOf = rows => rows.map(r => r[0] + r.slice(2, 7) + r[8]);
const BFLY_SHUT = ["...k.k...", "..eeee...", "..eaae...", "..eabe...", "...eke...", "....k....", "........."];
function updateCritters(now, s, dark, foul) {
  const se = mainSeason(), day = dark < 0.3 && !foul, hd = petHead();
  // butterflies: now and then one comes (two at times in spring and summer), stays a little while and goes
  const most = !day ? 0 : se === "spring" || se === "summer" ? 2 : se === "autumn" ? 1 : 0;
  if (BFLY.length < most && now > nextBfly) {
    const left = Math.random() < 0.5, kind = BFLY_KINDS[Math.random() * BFLY_KINDS.length | 0];
    BFLY.push({ x: left ? -6 : W + 6, y: R_(horizon, FEET - 30), vx: 0, vy: 0, dir: left ? 1 : -1, st: "wander", t: 0, life: now + R_(20000, 45000),
      tx: R_(30, 150), ty: R_(horizon, FEET - 20), k: kind, p: Math.random() * 6 });
    nextBfly = now + (BFLY.length > 1 ? R_(60000, 120000) : Math.random() < 0.3 ? R_(8000, 20000) : R_(45000, 100000));
  }
  for (let i = BFLY.length - 1; i >= 0; i--) {
    const b = BFLY[i]; b.t += s * 1000; b.front = false;
    if ((!day || now > b.life) && b.st !== "leave" && !b.sit) { b.st = "leave"; b.tx = b.x < W / 2 ? -20 : W + 20; b.ty = b.y - 30; }
    const choose = () => {                                        // what next
      const r = Math.random(), fl = (se === "spring" || se === "summer") && FLOWERS.length;
      b.t = 0; b.near = false;
      if (now > b.life) { b.st = "leave"; b.tx = b.x < W / 2 ? -20 : W + 20; b.ty = R_(horizon - 40, horizon); }
      else if (hd && r < 0.3) { b.st = "orbit"; b.a = Math.atan2(b.y - hd.y, b.x - hd.x); b.dur = R_(4000, 7000); }
      else if (hd && hd.still && r < 0.42) b.st = "land";
      else if (fl && r < 0.7) { b.st = "flower"; b.f = dryFlower(); }
      else if (r < 0.9) { b.st = "wander"; const p = airPoint(); b.tx = p.x; b.ty = p.y; }
      else { b.st = "leave"; b.tx = Math.random() < 0.5 ? -20 : W + 20; b.ty = R_(horizon - 40, horizon); }
    };
    const bob = Math.sin(b.t / 160 + b.p) * 6;                    // the up-and-down of a butterfly's flight
    if (b.st === "wander") { if (steer(b, b.tx, b.ty + bob, 16, s) < 3) choose(); }
    else if (b.st === "leave") { steer(b, b.tx, b.ty + bob, 20, s); if (b.x < -15 || b.x > W + 15) { BFLY.splice(i, 1); nextBfly = Math.max(nextBfly, now + R_(30000, 70000)); } }
    else if (b.st === "flower") {
      const fx = b.f.x + 0.5, fy = b.f.yy - 6;
      if (b.sit) { b.x = fx; b.y = fy; b.vx = b.vy = 0; if (b.t > b.sit) { b.sit = 0; choose(); } }
      else if (steer(b, fx, fy, 14, s, 4) < 1.2) { b.sit = b.t + R_(2500, 6000); }
    } else if (b.st === "orbit") {
      if (!hd || b.t > b.dur) { choose(); continue; }
      b.a += 2.4 * s; const tx = hd.x + Math.cos(b.a) * 15, ty = hd.y + 6 + Math.sin(b.a) * 5 + bob * 0.3;
      if (b.near) { const k = Math.min(1, 8 * s), ox = b.x; b.x += (tx - b.x) * k; b.y += (ty - b.y) * k; b.vx = (b.x - ox) / (s || 1); if (Math.abs(b.vx) > 2) b.dir = Math.sign(b.vx); }
      else if (steer(b, tx, ty, 34, s, 6) < 4) b.near = true;        // fly in, then keep to the ring
      b.front = Math.sin(b.a) > 0;
    } else if (b.st === "land") {
      if (!hd) { choose(); continue; }
      const tx = hd.x + 3, ty = hd.y - 3;
      if (b.sit) { b.x = tx; b.y = ty; b.vx = b.vy = 0; b.front = true; if (b.t > b.sit || !hd.still) { b.sit = 0; choose(); } }
      else if (steer(b, tx, ty, 14, s, 5) < 1.2) b.sit = b.t + R_(3000, 7000);
      else b.front = b.y > hd.y;
    }
  }
  // bees: a pair comes to the flowers in spring and summer now and then, goes from flower to flower, and leaves
  if (!BEES.length && day && (se === "spring" || se === "summer") && now > nextBees) {
    const n = Math.random() < 0.5 ? 1 : 2, from = Math.random() < 0.5 ? -6 : W + 6;
    for (let k = 0; k < n; k++) BEES.push({ f: dryFlower(), x: from, y: horizon + R_(0, 20), p: Math.random() * 6, next: now + R_(3000, 7000), until: now + R_(15000, 30000) });
  }
  for (let i = BEES.length - 1; i >= 0; i--) {
    const e = BEES[i];
    if (now > e.until || !day) {                                  // off it goes
      e.x += (e.x < W / 2 ? -40 : 40) * s; e.y -= 8 * s;
      if (e.x < -8 || e.x > W + 8) { BEES.splice(i, 1); if (!BEES.length) nextBees = now + R_(60000, 150000); }
      continue;
    }
    if (now > e.next) { e.f = dryFlower(); e.next = now + R_(3000, 8000); }
    const tx = e.f.x + Math.sin(now / 230 + e.p) * 4, ty = e.f.yy - 8 + Math.sin(now / 170 + e.p * 2) * 2;
    e.x += (tx - e.x) * Math.min(1, 2.5 * s); e.y += (ty - e.y) * Math.min(1, 2.5 * s);
  }
  // a frog by the puddles after rain (not in winter), once per rain: it hops in, sits puffing its throat, hops to another
  // puddle or two, and leaves
  if (typeof WX !== "undefined" && WX.pud < 0.05) frogDone = false;
  const wetOk = typeof WX !== "undefined" && WX.pud > 0.3 && WX.rain < 0.3 && se !== "winter" && dark < 0.7 && PUDDLES.length;
  // she goes in hops of a few pixels towards where she is going (gx, gy), a little rest between hops
  const hopTo = (f, gx, gy) => { f.gx = gx; f.gy = gy; f.st = "hop"; f.t = 0; nextHop(f); };
  const nextHop = f => { const dx = f.gx - f.x, dy = f.gy - f.y, d = Math.hypot(dx, dy) || 1, st = Math.min(d, R_(9, 14));
    f.tx = f.x + dx / d * st; f.ty = f.y + dy / d * st; f.dir = Math.sign(dx) || f.dir || 1; };
  if (!frog && wetOk && !frogDone) {
    frogDone = true; const i = Math.random() * PUDDLES.length | 0, sp = frogSpot(i), left = sp.tx < W / 2;
    frog = { x: left ? -6 : W + 6, y: sp.ty, n: 0, dir: left ? 1 : -1 }; hopTo(frog, sp.tx, sp.ty);
  }
  if (frog) {
    const f = frog; f.t += s * 1000;
    if (f.st === "hop") {
      const q = Math.min(1, Math.max(0, f.t - 120) / 380);           // a breath, then the leap
      f.cx = f.x + (f.tx - f.x) * q; f.cy = f.y + (f.ty - f.y) * q - Math.sin(q * Math.PI) * 4;
      if (q >= 1) {
        f.x = f.tx; f.y = f.ty; f.t = 0;
        if (f.x < -5 || f.x > W + 5) frog = null;
        else if (Math.hypot(f.gx - f.x, f.gy - f.y) > 0.5) nextHop(f);
        else { f.st = "sit"; f.hold = R_(4000, 8000); }
      }
    } else if (f.t > f.hold) {
      if (!wetOk || f.n >= 2) hopTo(f, f.x < W / 2 ? -10 : W + 10, f.y);
      else { f.n++; const sp = frogSpot(Math.random() * PUDDLES.length | 0); hopTo(f, sp.tx, sp.ty); }
    }
    if (frog && f.st === "sit") { f.cx = f.x; f.cy = f.y; }
  }
}
// beside a puddle's front edge
function frogSpot(i) {
  const [cx, dy, , , [l0, l1]] = PUDDLES[i], q = typeof pudK === "function" ? pudK() : 1, right = Math.random() < 0.5;
  return { tx: Math.round(cx + (right ? l1 * q + 6 : l0 * q - 6)), ty: horizon + dy + 1, hops: 0 };
}
// a little frog facing right, outlined like the friends (g green, G shade, l belly, w eye white, k ink)
const FROG = ["...kk.kk..", "..kwkkwkk.", ".kgggggggk", "kgggggllgk", "kGGgggllk.", ".kkGkkkk.."];
const FROG_HOP = ["...kk.kk..", "..kwkkwkk.", ".kgggggggk", "kGgggglllk", "kGGkkkkk..", "kk........"];
// critters take the light of the meadow: the warm pastel, the sky's colour, the evening, a grey day
function bugc(c, h) {
  let x = softc(hex(c), 1.4);
  x = mixc(x, skyAt(h)[1], 0.1);
  if (typeof WX !== "undefined" && WX.cover > 0.05) x = mixc(x, hex("#a8adb8"), WX.cover * 0.25);
  x = mixc(x, hex("#ff9e72"), warmAt(h) * 0.16);
  return mixc(x, hex("#172a5e"), darkAt(h) * 0.64);
}
function paintMap(g, rows, x, y, r, pal, cx, alpha) {
  rows.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch === "." || !pal[ch]) return;
    g.fillStyle = alpha && alpha[ch] ? css(pal[ch], alpha[ch]) : css(pal[ch]); g.fillRect(x + (i - cx) * r, y + j, 1, 1);
  }));
}
function drawButterfly(g, b, h, now) {
  const x = Math.round(b.x), y = Math.round(b.y), resting = b.sit && b.t < b.sit;
  // wings: open, half, shut, half (slowly while resting, mostly open)
  const ph = resting ? [0, 0, 1, 2, 1, 0][Math.floor(now / 500 + b.p) % 6] : [0, 1, 2, 1][Math.floor(now / 80 + b.p) % 4];
  const k = b.k, pal = { a: bugc(k.a, h), b: bugc(k.b, h), c: bugc(k.c, h), k: bugc("#7a6656", h) };
  pal.e = mixc(mixc(pal.a, pal.b, 0.3), bugc("#7a6656", h), 0.28);
  if (ph === 1) paintMap(g, halfOf(BFLY_OPEN[k.m]), x, y - 3, 1, pal, 3);
  else paintMap(g, ph === 0 ? BFLY_OPEN[k.m] : BFLY_SHUT, x, y - 3, ph === 2 && (b.dir || 1) < 0 ? -1 : 1, pal, 4);
}
function drawCritters(g, now, h, front) {
  for (const b of BFLY) if (!!b.front === front) drawButterfly(g, b, h, now);
  if (front) return;
  for (const e of BEES) {
    const x = Math.round(e.x), y = Math.round(e.y), up = Math.floor(now / 60) % 2;
    g.fillStyle = css(bugc("#ffd86a", h)); g.fillRect(x, y, 3, 2); g.fillStyle = css(bugc("#7a6450", h)); g.fillRect(x + 1, y, 1, 2);
    g.fillStyle = "rgba(255,255,255,.7)"; g.fillRect(x + 1, y - 1 - up, 1, 1);
  }
  if (frog && frog.cx !== undefined) {
    const f = frog, x = Math.round(f.cx), y = Math.round(f.cy), r = f.dir || 1, air = f.st === "hop" && f.t > 180 && f.t < 440;
    const puff = f.st === "sit" ? Math.max(0, Math.sin(now / 260)) : 0;          // her throat swells and goes down
    const P = { g: bugc("#a6d98a", h), G: bugc("#7fbf72", h), l: bugc("#eaf6cf", h), w: bugc("#ffffff", h), k: bugc(OUT, h) };
    const rows = air ? FROG_HOP : FROG;
    paintMap(g, rows, x, y - rows.length, r, P, 5);
    if (puff > 0.3) { g.fillStyle = css(P.l); g.fillRect(x + 4 * r, y - 3, 1, puff > 0.75 ? 2 : 1); }
  }
}
// what flies in front of her, over her layer (called after she is drawn)
function sceneFront(g, now) { drawCritters(g, now, worldHour(), true); }

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
  const doy = (dayNum() % 365.25) / 365.25, r = Math.round(6 + 0.8 * Math.cos(2 * Math.PI * doy) + low * 2.4);
  // (Ocean's sun: a flat cream disc, a touch warmer at its edge, hardly any glow; gold-peach low down)
  const core = mixc(hex("#fffef0"), hex("#fffbd0"), low), mid = mixc(hex("#fff7cc"), hex("#ffe7a8"), low), rim = mixc(hex("#ffeaa0"), hex("#ffc58a"), low);
  rings(g, x, y, r, mixc(hex("#fff8dc"), hex("#ffd2a0"), low), 0.06 + low * 0.06);
  g.fillStyle = css(rim); disc(g, x, y, r);
  g.fillStyle = css(mid); disc(g, x - 0.5, y - 0.5, r - 1);
  g.fillStyle = css(core); disc(g, x - 1, y - 1, Math.max(1, r - 3));
  if (low > 0.55) {                                       // low: thin streaks of the sky drawn across its lower half
    const band = css(skyAt(h)[2], Math.min(1, (low - 0.55) * 3)), X = Math.round(x), Y = Math.round(y);
    [[2, 0.9], [4, 1.1], [6, 0.8]].forEach(([dy, w]) => { if (dy < r) { const hw = Math.round(Math.sqrt(r * r - dy * dy) * w); g.fillStyle = band; g.fillRect(X - hw - 1, Y + dy, hw * 2 + 3, 1); } });
  }
}
function disc(g, cx, cy, r) {
  cx = Math.round(cx); cy = Math.round(cy);
  for (let dy = -r; dy <= r; dy++) { const hw = Math.round(Math.sqrt(r * r - dy * dy)); g.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1); }
}
function moonPhase() { return (((Date.now() / 86400000 - 10962.76) % 29.530588853) + 29.530588853) % 29.530588853 / 29.530588853; }
// the moon is up every night (in its real phase), as in Ocean 6: the lit part pale cyan-white with soft blue seas, a
// white rim towards the light and a cooler edge away from it, the dark part dim blue (earthshine), in a cool glow that
// grows as it fills
const MOON_SEAS = [[-0.35, -0.25, 0.28], [0.15, -0.4, 0.2], [0.25, 0.2, 0.3], [-0.2, 0.35, 0.18], [0.45, -0.05, 0.12]];
function drawMoon(h, g) {
  const t = h >= 18 ? h - 18 : h + 6;                 // 18:00 -> 0, 06:00 -> 12
  if (t < 0.4 || t > 12.8) return;
  const p = (t - 0.4) / 12.4, x = Math.round(W - 18 - (W - 36) * p), alt = Math.sin(Math.PI * p), y = Math.round(horizon - 10 - alt * (horizon - 56));
  const ph = moonPhase(), k = Math.cos(2 * Math.PI * ph), full = (1 - k) / 2;
  const peri = Math.cos(2 * Math.PI * ((dayNum() - 10962.3) / 27.5545)), r = Math.round(7 + 1.2 * peri + (1 - alt) * 1.2);
  const vis = smooth(0.15, 0.55, darkAt(h)); if (vis <= 0.02) return;   // pale and then gone as day comes on
  g.save(); g.globalAlpha = vis;
  rings(g, x, y, r, hex("#a9dcf2"), 0.05 + full * 0.09);
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (dx * dx + dy * dy > r * r + 0.5) continue;
    const sq = Math.sqrt(Math.max(0, 1 - (dy / r) ** 2)), xn = (dx + 0.5) / r;
    const on = ph < 0.5 ? xn > sq * k : xn < -sq * k;
    let c;
    if (!on) c = "#2c3f7c";
    else {
      const sea = MOON_SEAS.some(([sx, sy, sr]) => (dx / r - sx) ** 2 + (dy / r - sy) ** 2 < sr * sr);
      const rimLit = dx * dx + dy * dy > (r - 1.2) ** 2 && (ph < 0.5 ? dx > 0 : dx < 0);
      const shadeSide = dx * dx + dy * dy > (r - 1.5) ** 2 && !rimLit;
      c = rimLit ? "#ffffff" : sea ? "#9fd6e8" : shadeSide ? "#b8e4f2" : "#e2f7fc";
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
  if (!over) { groundShadow(g, SIGN_X + 1, base + 1, 14, 0.8); signShadow(g, h, bx, by, bw, bh, base); }
  if (glow > 0.3 && !over) { for (let r = 26, a = 0.035 * glow; r >= 12; r -= 5) { g.fillStyle = `rgba(255,214,140,${a})`; disc(g, SIGN_X, by + 7, r); } }
  const shade = c => css(mixc(lit(c, h), lit(c, 12), 0.45));       // the day's light, a little held back (it is close by)
  // the post: lit on its left, a knot in it
  const pt = by + bh - 1;
  g.fillStyle = OUT; g.fillRect(SIGN_X - 2, pt, 4, base - pt + 1);
  g.fillStyle = shade("#ad7850"); g.fillRect(SIGN_X - 1, pt, 2, base - pt);
  g.fillStyle = shade("#c99568"); g.fillRect(SIGN_X - 1, pt, 1, base - pt);
  g.fillStyle = shade("#8c5d3d"); g.fillRect(SIGN_X, pt + 5, 1, 2); g.fillRect(SIGN_X, base - 3, 1, 1);
  // the board: a wooden frame with pixel-rounded corners, a lit top edge, a shaded foot, a little grain and four nails,
  // round a cream plaque that is shaded along its top and left (set into the frame)
  g.fillStyle = OUT; g.fillRect(bx + 1, by, bw - 2, bh); g.fillRect(bx, by + 1, bw, bh - 2);
  g.fillStyle = shade("#c98f5e"); g.fillRect(bx + 1, by + 1, bw - 2, bh - 2);
  g.fillStyle = shade("#dcaa76"); g.fillRect(bx + 2, by + 1, bw - 4, 1); g.fillRect(bx + 1, by + 2, 1, bh - 5);
  g.fillStyle = shade("#a8714a"); g.fillRect(bx + 1, by + bh - 3, bw - 2, 2); g.fillRect(bx + bw - 2, by + 2, 1, bh - 4);
  g.fillStyle = shade("#b77f53");                                    // grain
  [[5, 1, 4], [17, 1, 6], [9, bh - 3, 5], [21, bh - 3, 3]].forEach(([x, y, l]) => g.fillRect(bx + x, by + y, l, 1));
  g.fillStyle = shade("#f8e4bf"); g.fillRect(bx + 3, by + 3, bw - 6, bh - 6);
  g.fillStyle = shade("#e9cc9b"); g.fillRect(bx + 3, by + 3, bw - 6, 1); g.fillRect(bx + 3, by + 3, 1, bh - 6);
  g.fillStyle = shade("#7a5236"); [[2, 2], [bw - 3, 2], [2, bh - 4], [bw - 3, bh - 4]].forEach(([x, y]) => g.fillRect(bx + x, by + y, 1, 1));
  const s = info.text, mode = info.mode;
  text(s, SIGN_X - (tw(s) >> 1), by + 5, mode === "run" ? "#d0485a" : mode === "rest" ? "#6a63b8" : OUT, g);
  if (mode === "run" && Math.floor(now / 600) % 2) { g.fillStyle = "#e2504a"; g.fillRect(SIGN_X - 1, by - 3, 3, 2); g.fillRect(SIGN_X, by - 4, 1, 4); }
  if (mode === "rest") text("Z", bx + bw - 4, by - 6 - (Math.floor(now / 500) % 2), "#6a63b8", g);
  signFoot(g, now, h, base);
}
// round the foot of the post, in front of it: grass blades over it, and a little of the season (a clump of leaves
// with a flower in spring, leaves in summer, a few fallen leaves in autumn), all swaying with the wind; snow lies there
// in winter (weatherCap)
function signFoot(g, now, h, base) {
  if (!landP) return;
  const se = mainSeason(), snowy = typeof WX !== "undefined" && WX.depth > 0.25;
  const dark = css(litc(landP.dark[0], h)), mid = css(litc(landP.grass[0], h)), hi = css(litc(landP.grass[1], h));
  const sw = t => Math.round(Math.sin(now / 900 + t) * (typeof wind !== "undefined" ? wind : 1) * 0.7);
  if (se === "autumn") {
    [["#e39a5c", -6, 0], ["#c9694a", -4, 1], ["#e8b76a", 3, 0], ["#b65a45", 5, 1], ["#d98552", 1, 1]].forEach(([c, dx, dy]) => {
      g.fillStyle = css(lit(c, h)); g.fillRect(SIGN_X + dx, base + dy, 2, 1); });
    g.fillStyle = css(litc(landP.grass[0], h)); [[-3, 3], [2, 2], [4, 3]].forEach(([dx, hh], k) => g.fillRect(SIGN_X + dx + (sw(k) > 0 ? 1 : 0), base - hh + 1, 1, hh));
    return;
  }
  if (!snowy && se !== "winter") {
    // a clump of leaves: two to each side of the post, their tips nodding
    const leaf = (x, y, dir, c, t) => { const o = sw(t); g.fillStyle = c; g.fillRect(x, y, 2, 1); g.fillRect(x + dir + o, y - 1, 2, 1); };
    leaf(SIGN_X - 6, base, -1, mid, 0); leaf(SIGN_X - 4, base - 1, -1, hi, 1); leaf(SIGN_X + 3, base - 1, 1, hi, 2); leaf(SIGN_X + 4, base, 1, mid, 3);
    if (se === "spring") { g.fillStyle = css(lit("#ffd1dc", h)); g.fillRect(SIGN_X - 7 + sw(4), base - 3, 1, 1); g.fillStyle = css(lit("#ffe38a", h)); g.fillRect(SIGN_X - 7 + sw(4), base - 2, 1, 1); }
  }
  // blades in front of the post (over its foot), the grass layer it stands in
  g.fillStyle = dark; [[-2, 2], [-1, 3], [1, 2], [2, 3]].forEach(([dx, hh], k) => { g.fillRect(SIGN_X + dx, base - hh + 2, 1, hh - 1); g.fillRect(SIGN_X + dx + (sw(k + 5) > 0 ? 1 : 0), base - hh + 1, 1, 1); });
  g.fillStyle = hi; g.fillRect(SIGN_X - 1, base - 1, 1, 1); g.fillRect(SIGN_X + 2, base - 1, 1, 1);
}

// the sign's shadow from the sun: its board and post, cast on the grass
let signSh = { key: "", px: [] };
function signShadow(g, h, bx, by, bw, bh, base) {
  const S = sunCast(h); if (!S) return;
  const key = [S.k.toFixed(2), S.sy.toFixed(2), bx, by, base].join();
  if (signSh.key !== key) {
    const w = bw, hh = base - by + 1, d = new Uint8ClampedArray(w * hh * 4);
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
      const X = bx + x, Y = by + y, board = Y < by + bh && (x > 0 && x < w - 1 || (y > 0 && y < bh - 1)), post = Y >= by + bh && Math.abs(X - SIGN_X) <= 1;
      if (board || post) d[(y * w + x) * 4 + 3] = 255;
    }
    signSh = { key, px: castPixels(d, w, hh, bx, by, base, S) };
  }
  g.fillStyle = css(shadowRGB(h), 0.55 * S.a);
  for (const [X, Y] of signSh.px) g.fillRect(X, Y, 1, 1);
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

// lightning lights the clouds from within: each cloud's shape in the flash's light over it, the ones near the strike
// brightest, their thin edges glowing most (the glow shape is kept until the cloud is repainted)
function cloudFlash(g, cv, x, y) {
  const st = typeof WX !== "undefined" && WX.strike, f = st ? WX.flash : 0; if (f < 0.02) return;
  if (!cv._glow) {
    const gc = document.createElement("canvas"); gc.width = cv.width; gc.height = cv.height;
    const o = gc.getContext("2d"); o.drawImage(cv, 0, 0); o.globalCompositeOperation = "source-in"; o.fillStyle = "rgb(240,236,255)"; o.fillRect(0, 0, gc.width, gc.height);
    cv._glow = gc;
  }
  const near = Math.exp(-(((x + cv.width / 2 - st.x) / 70) ** 2));
  g.globalAlpha = Math.min(1, f * (0.35 + 0.55 * near)); g.drawImage(cv._glow, x, y); g.globalAlpha = 1;
}
function sceneRender(now, signInfo) {
  const h = worldHour(), dark = darkAt(h);
  const key = (Math.round(h * 60)) + ":" + H;          // the sky and land are repainted once a game-minute
  if (key !== cacheKey) { cacheKey = key; paintSky(h); paintLand(h); }
  const pal = cloudPal(Math.round(h * 60) / 60).map(c => c.map(v => Math.round(v))), pk = pal.map(c => c.join(",")).join("|");
  const ck = pk + "|" + cloudLight(h).join(",");                 // (the visiting cloud greys with the weather as the others do)
  if (faceCloud && faceCloud.key !== ck) {
    faceCloud.key = ck;
    faceCloud.img = renderVisitor(faceCloud, h, pal);
  }
  const g = sctx;
  g.imageSmoothingEnabled = false;
  g.drawImage(skyCv, 0, 0);
  // stars, as in the packs' nights: dots of cool white and pale blue and gold, the brightest a little four-point sparkle
  // that twinkles (its arms come and go)
  if (dark > 0.05) for (const st of STARS) {
    const tw_ = 0.55 + 0.45 * Math.sin(now / 700 + st.p * 3);
    const a = dark * st.b * tw_ * (typeof WX !== "undefined" ? 1 - WX.cover * 0.9 : 1); if (a < 0.08) continue;
    const c = st.p < 1.2 ? "200,225,255" : st.p < 1.8 ? "255,236,190" : "245,248,255", x = Math.round(st.x), y = Math.round(st.yy);
    g.fillStyle = `rgba(${c},${a.toFixed(2)})`; g.fillRect(x, y, 1, 1);
    if (st.b > 0.86 && tw_ > 0.6) {
      const arm = st.b > 0.96 && tw_ > 0.9 ? 2 : 1;
      g.fillStyle = `rgba(${c},${(a * 0.45).toFixed(2)})`;
      for (let k = 1; k <= arm; k++) { g.fillRect(x - k, y, 1, 1); g.fillRect(x + k, y, 1, 1); g.fillRect(x, y - k, 1, 1); g.fillRect(x, y + k, 1, 1); }
    }
  }
  if (star) {
    const a = 1 - star.t / 900;
    for (let i = 0; i < 12; i++) { g.fillStyle = `rgba(255,255,240,${(a * (1 - i / 12)).toFixed(2)})`; g.fillRect(Math.round(star.x - star.vx / 90 * i * 0.5), Math.round(star.y - star.vy / 90 * i * 0.5), 1, 1); }
  }
  // the sun and the moon behind everything, then the clouds from the far ones low over the hills to the near ones high
  // up, then birds
  drawSun(h, g);
  drawMoon(h, g);
  if (typeof weatherSky === "function") weatherSky(g, now, h);   // an overcast sky, a rainbow (behind the clouds, which grey themselves)
  const L = cloudLight(h), lk = pk + "|" + L.join(",");
  clouds.sort((a, b) => b.base - a.base);
  for (const c of clouds) {
    if (c.key !== lk) { c.key = lk; paintCloud(c, pal, L); c.cv._glow = null; }
    const x = Math.round(c.x) - (c.pad || 0), y = Math.round(c.y) - (c.pad || 0);
    g.drawImage(c.cv, x, y); cloudFlash(g, c.cv, x, y);
  }
  if (flock) {
    const col = css(mixc(hex("#5b6280"), hex("#3a2a40"), warmAt(h)));
    flock.birds.forEach(b => {
      const fl = Math.floor(now / 160 + b.p) % 2, bx = flock.x + b.dx, by = flock.y + b.dy + Math.sin(now / 500 + b.p) * 2;
      drawGlyph(g, BIRD[fl], bx, by, col);
    });
  }
  if (faceCloud && faceCloud.img) { const im = faceCloud.img, x = Math.round(faceCloud.x), y = Math.round(faceCloud.y + Math.sin(now / 900) * 1.5); g.drawImage(im, x, y); cloudFlash(g, im, x, y); }
  g.drawImage(landCv, 0, 0);
  drawCaveEyes(g, now, h);
  if (typeof weatherLand === "function") weatherLand(g, now, h);   // wet grass, snow
  g.drawImage(treeCv, 0, 0);                           // their shadows and the leaves fallen round them
  drawTrees(g, now);
  drawStump(g, h);
  drawLeaves(g, h);
  drawPrints(g, h);
  // grass tufts and flowers sway in the wind
  const blade = css(litc(landP.dark[0], h)), bladeHi = css(litc(landP.grass[1], h));
  for (const t of TUFTS) {
    const sw = Math.round(0.3 * wind + Math.sin(now / 900 - t.x * 0.15 + t.p * 0.3) * wind * 0.9);   // a wave of wind runs along the meadow
    const x = Math.round(t.x), y = Math.round(t.yy);
    if (typeof inPuddle === "function" && inPuddle(x, y)) continue;          // (none standing in a puddle)
    g.fillStyle = blade; g.fillRect(x, y - t.h + 2, 1, t.h - 1); g.fillRect(x + 2, y - t.h + 3, 1, t.h - 2); g.fillRect(x - 2, y - t.h + 3, 1, t.h - 2);
    g.fillRect(x + 2 + sw, y - t.h + 2, 1, 1); g.fillRect(x - 2 + sw, y - t.h + 2, 1, 1); g.fillRect(x + sw, y - t.h + 1, 1, 1);   // every blade's tip bends
    g.fillStyle = bladeHi; g.fillRect(x + sw + (sw > 0 ? 1 : sw < 0 ? -1 : 0), y - t.h, 1, 1);
  }
  const se = mainSeason();
  for (const f of FLOWERS) {
    if (se === "winter" || se === "autumn") break;                   // no flowers out in autumn and winter
    const sw = Math.round(Math.sin(now / 1100 + f.p) * wind * 0.8), x = Math.round(f.x), y = Math.round(f.yy);
    if (typeof inPuddle === "function" && inPuddle(x, y)) continue;
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
  drawCritters(g, now, h, false);
  if (dark > 0.5 && se !== "winter") for (const f of flies) {                 // no fireflies in winter
    const a = Math.max(0, Math.sin(now / 600 + f.p * 4)) * (dark - 0.5) * 2;
    if (a < 0.1) continue;
    g.fillStyle = `rgba(230,255,140,${(a * 0.35).toFixed(2)})`; g.fillRect(Math.round(f.x) - 1, Math.round(f.y) - 1, 3, 3);
    g.fillStyle = `rgba(245,255,170,${a.toFixed(2)})`; g.fillRect(Math.round(f.x), Math.round(f.y), 1, 1);
  }
}

// speech from the world (the passing cloud) in game pixels, for the HTML layer
function sceneSpeech(now) {
  if (!faceCloud || !faceCloud.img) return null;
  const x = faceCloud.x + faceCloud.img.width / 2;
  if (x < 20 || x > W - 10) return null;
  return { x, y: faceCloud.y - 2, text: faceCloud.line };
}
