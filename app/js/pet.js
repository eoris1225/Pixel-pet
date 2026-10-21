/* The pet: animations and behaviour ported from prototype/pixel-pet.html (sprites in sprites.js are used as they are).
   Drawn on the #fg canvas, above the world. The room, the food/fun/energy/clean stats and the old buttons are gone. */
"use strict";

const W = 180;
let H = 320, FEET = 250, PEEK_BOT = 264, TOP_Y = 40;
const fg = document.getElementById("fg");
const ctx = fg.getContext("2d");
const OUT = "#3a2a1a";

// what the app tells the pet
const G = { pet: "mochi", sleeping: false, wantSleep: false, equip: null, lowMood: false };

function gridToCanvas(rows, pal) {
  const h = rows.length, w = rows[0].length;
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d");
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const col = pal[rows[y][x]];
    if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
  }
  c.grid = rows;                       // kept so items can find the face on this exact frame
  return c;
}
// names a motion's frames the way Pixel Pet Studio does ("mochi-wave:3"), for per-frame item corrections
const tagFrames = (imgs, set) => { imgs.forEach((c, i) => c.key = set + ":" + i); return imgs; };
function px(x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), w, h); }

const PETS = [
  { id:"nori",  body:"Y", tip:5, pal:{K:OUT, Y:"#ffe9b0", P:"#ff9db4", W:"#ffffff"} },
  { id:"mochi", body:"W", tip:2, pal:{K:OUT, W:"#fffaf0", P:"#ff9db4", L:"#e2e9eb", N:"#ccd6dc", Q:"#b8c8d0", M:"#c496a2"} },
  { id:"sora",  body:"W", tip:2, pal:{K:OUT, W:"#fffaf0", S:"#9fd3f5", P:"#ff9db4", R:"#f07070"} },
];
const PET = Object.fromEntries(PETS.map(p => [p.id, p]));

/* ---------- frames built from the base sprite ---------- */
const INFO = {};
for (const p of PETS) {
  const g = SPRITES[p.id];
  let eR = -1, dup = -1;
  for (let r = 0; r < g.length - 3 && eR < 0; r++) {
    const a = g[r], b = g[r + 1];
    if (a[9] === "K" && a[10] === "K" && b[8] === "K" && b[10] === "W" && b[11] === "K") eR = r;
  }
  for (let r = g.length - 4; r > eR + 4 && dup < 0; r--) if (g[r] === g[r - 1]) dup = r;
  INFO[p.id] = { eR, dup, w: g[0].length, h: g.length };
}
/* face : normal | blink | sleep | happy    body : base | squash | stretch    ear / step : -1 | 0 | 1 */
const FCACHE = {};
function frame(id, o) {
  const key = id + o.face + o.body + o.ear + o.step;
  if (FCACHE[key]) return FCACHE[key];
  const p = PET[id], info = INFO[id];
  let g = SPRITES[id].map(r => r.split(""));
  const n = info.w;
  if (o.face !== "normal" && info.eR >= 0) {
    const eR = info.eR;
    for (const bx of [8, 16]) {
      for (let r = eR; r < eR + 4; r++) for (let c = bx; c < bx + 4; c++)
        if (g[r][c] === "K" || g[r][c] === "W") g[r][c] = p.body;
      const set = (r, c) => { g[eR + r][bx + c] = "K"; };
      if (o.face === "blink") { set(2,0); set(2,1); set(2,2); set(2,3); }
      if (o.face === "sleep") { set(2,0); set(3,1); set(3,2); set(2,3); }
      if (o.face === "happy") { set(1,1); set(1,2); set(2,0); set(2,3); }
    }
  }
  if (o.ear) for (let r = 0; r < p.tip; r++) {
    const row = g[r], nr = Array(n).fill("B");
    for (let c = 0; c < n; c++) { const s = c - o.ear; if (s >= 0 && s < n) nr[c] = row[s]; }
    g[r] = nr;
  }
  if (o.step) {
    const h = g.length, lo = o.step < 0 ? 0 : 15, hi = o.step < 0 ? 14 : n;
    for (let c = lo; c < hi; c++) {
      if (g[h - 1][c] === "K") { g[h - 1][c] = "B"; if (g[h - 2][c] !== "B") g[h - 2][c] = "K"; }
    }
  }
  if (info.dup > 0) {
    if (o.body === "squash") g.splice(info.dup, 1);
    if (o.body === "stretch") g.splice(info.dup, 0, g[info.dup].slice());
  }
  FCACHE[key] = gridToCanvas(g.map(r => r.join("")), p.pal); FCACHE[key].key = id + "-base:0";
  return FCACHE[key];
}
const BASE_POSE = () => ({ face:"normal", body:"base", ear:0, step:0, yoff:0 });

/* ---------- traced animations (timings from the prototype) ---------- */
const PEEK_MS = [120,120,80,120,120,120,1160,120,120,120,480,480];
const POSE_IMG = POSES.map(g => gridToCanvas(g, PET.nori.pal));
const poseImg = i => i >= 100 ? JUMP_IMG[i - 100] : POSE_IMG[i];
const SIT_LEN = 380, STAND_LEN = 360;
const LIE_SEQ = [["sit",SIT_LEN,0], ...PEEK_MS.map((ms, i) => [i, ms]), [4,140],[5,140],["stand",STAND_LEN,5]];
const LIE_DUR = LIE_SEQ.reduce((a, f) => a + f[1], 0);
function seqPose(a, seq, t) {
  for (const [i, ms, f] of seq) {
    if (t < ms) {
      if (i === "sit") sitPose(a, t, poseImg(f), 0);
      else if (i === "stand") standPose(a, t, poseImg(f), 0);
      else a.img = poseImg(i);
      return;
    }
    t -= ms;
  }
  const last = seq[seq.length - 1]; if (typeof last[0] === "number") a.img = poseImg(last[0]);
}
const SPIN_IMG = SPINS.map(g => gridToCanvas(g, PET.nori.pal));
const SPIN_SEQ = [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 104, 102, 100, -1];
const SPIN_STEP = SPIN_SEQ.map(i => i < 0 ? 200 : 100);
const SPIN_LEN = SPIN_STEP.reduce((a, b) => a + b, 0);
function spinIndex(t) { for (let k = 0; k < SPIN_SEQ.length; k++) { if (t < SPIN_STEP[k]) return SPIN_SEQ[k]; t -= SPIN_STEP[k]; } return -1; }
const SORAHOP_IMG = SORAHOP.map(g => gridToCanvas(g, PET.sora.pal));
const SORA_ONCE = [[-1,120],[0,110],[1,100],[2,100],[3,110],[2,100],[0,120],[1,100],[2,100],[3,110],[2,100],[0,120],[-1,1]];
const seqLen = q => q.reduce((a, f) => a + f[1], 0);
function soraHop(seq, t, loop) { if (loop) t %= seqLen(seq); for (const [i, ms] of seq) { if (t < ms) return i; t -= ms; } return -1; }
const SORALOAF_IMG = SORALOAF.map(g => gridToCanvas(g, PET.sora.pal));
const sitEase = q => q <= 0 ? 0 : q >= 1 ? 1 : 1 - Math.pow(1 - q, 2);
function sitPose(a, t, loaf, drop = LOAF_DROP) {
  if (t < 140) { const q = sitEase(t / 140); a.img = null; a.body = "base"; a.sy = 1 - 0.2 * q; a.sx = 1 + 0.12 * q; return; }
  const q = (t - 140) / (SIT_LEN - 140);
  a.img = loaf; a.yoff = drop; a.sy = 1 + 0.12 * Math.cos(q * Math.PI * 1.5) * (1 - q); a.sx = 2 - a.sy;
}
function standPose(a, t, loaf, drop = LOAF_DROP) {
  if (t < 120) { const q = sitEase(t / 120); a.img = loaf; a.yoff = drop; a.sy = 1 - 0.14 * q; a.sx = 1 + 0.08 * q; return; }
  const q = (t - 120) / (STAND_LEN - 120);
  a.img = null; a.body = "base"; a.sy = 1 + 0.14 * Math.cos(q * Math.PI * 1.5) * (1 - q); a.sx = 2 - a.sy;
}
const LOAF_SEQ = [["sit", SIT_LEN], ...[0,1].flatMap(() => SORALOAF.map((_, i) => [i, i === 0 ? 80 : 40])), ["stand", STAND_LEN]];
const LOAF_LEN = LOAF_SEQ.reduce((a, f) => a + f[1], 0);
const LOAF_DROP = 3;
const SORADANCE_IMG = SORADANCE.map(g => gridToCanvas(g, PET.sora.pal));
const DANCE_MS = 83, DANCE_LEN = SORADANCE.length * DANCE_MS;
const NOTE_ICON = { Y: "noteEE", V: "noteV", T: "noteU" };
const danceFrame = t => Math.max(0, Math.min(SORADANCE.length - 1, Math.floor(t / DANCE_MS)));
const danceImg = t => SORADANCE_IMG[danceFrame(t)];
const MOCHIWAVE_IMG = tagFrames(MOCHIWAVE.map(g => gridToCanvas(g, PET.mochi.pal)), "mochi-wave");
const WAVE_MS = 100, WAVE_LEN = MOCHIWAVE.length * WAVE_MS;
const waveFrame = t => Math.max(0, Math.min(MOCHIWAVE.length - 1, Math.floor((t % WAVE_LEN) / WAVE_MS)));
const MOCHIGLOOM_IMG = tagFrames(MOCHIGLOOM.map(g => gridToCanvas(g, PET.mochi.pal)), "mochi-gloom");
const DASH_FROM = MOCHI_DASH.findIndex((d, i) => i > 0 && d.length);
const GLOOM_HOLD = 1600, GLOOM_BACK = [13, 12, 11, 10, 9, 8, 7], GLOOM_IN = (MOCHIGLOOM.length - 1) * WAVE_MS;
const GLOOM_MAIN = GLOOM_IN + GLOOM_HOLD + GLOOM_BACK.length * 90;
const GLOOM_LEN = SIT_LEN + GLOOM_MAIN + STAND_LEN;
function gloomPose(a, t) {
  if (t < SIT_LEN) { sitPose(a, t, MOCHIGLOOM_IMG[1], 0); return; }
  const tl = t - SIT_LEN;
  if (tl >= GLOOM_MAIN) { standPose(a, tl - GLOOM_MAIN, MOCHIGLOOM_IMG[GLOOM_BACK[GLOOM_BACK.length - 1]], 0); return; }
  const f = gloomFrame(tl); a.img = MOCHIGLOOM_IMG[f];
  if (tl < GLOOM_IN && (f === 8 || f === 9)) {
    const q = (tl - (f - 1) * WAVE_MS) / WAVE_MS;
    a.sy = f === 8 ? 0.92 + 0.08 * q : 1 + 0.03 * Math.sin(Math.PI * q); a.sx = 2 - a.sy;
  } else if (tl >= GLOOM_IN + GLOOM_HOLD) {
    const q = (tl - GLOOM_IN - GLOOM_HOLD) / (GLOOM_BACK.length * 90);
    a.sy = 1 + 0.04 * Math.sin(Math.PI * q); a.sx = 2 - a.sy;
  }
}
function gloomFrame(t) {
  if (t < GLOOM_IN) return Math.max(1, 1 + Math.floor(t / WAVE_MS));
  if (t < GLOOM_IN + GLOOM_HOLD) return MOCHIGLOOM.length - 1;
  return GLOOM_BACK[Math.min(GLOOM_BACK.length - 1, Math.floor((t - GLOOM_IN - GLOOM_HOLD) / 90))];
}
const MOCHIHOP_IMG = tagFrames(MOCHIHOP.map(g => gridToCanvas(g, PET.mochi.pal)), "mochi-hop");
const HOP_FALL_F = 7, HOP_NEAR_F = 10, HOP_LAND = 12, HOP_DROP_MIN = 40;
const SKYLAND_RUN = HOPT.ms.slice(HOP_LAND).reduce((a, b) => a + b, 0) + 160;
const HOP_SETTLE = 380, SKYLAND_LEN = SKYLAND_RUN + HOP_SETTLE;
function skylandPose(a, t) {
  if (t < SKYLAND_RUN) { const f = skylandFrame(t); a.img = MOCHIHOP_IMG[f]; a.yoff = HOPT.y[f]; return; }
  t -= SKYLAND_RUN; const L = HOPT.ms.length - 1;
  if (t < 140) { const q = sitEase(t / 140); a.img = MOCHIHOP_IMG[L]; a.yoff = HOPT.y[L]; a.sy = 1 - 0.07 * q; a.sx = 1 + 0.045 * q; return; }
  const q = (t - 140) / (HOP_SETTLE - 140);
  a.img = null; a.body = "base"; a.face = "happy"; a.sy = 1 + 0.07 * Math.cos(q * Math.PI * 1.5) * (1 - q); a.sx = 2 - a.sy;
}
function skylandFrame(t) { for (let i = HOP_LAND; i < HOPT.ms.length; i++) { if (t < HOPT.ms[i]) return i; t -= HOPT.ms[i]; } return HOPT.ms.length - 1; }
function hopLines(box, f, now) {
  const V = HOPFX.lines[f]; if (!V || !V.length) return;
  ctx.fillStyle = OUT;
  for (const [x, y, len] of V[Math.floor(now / 90) % 2]) ctx.fillRect(box.x + x, box.y + y, 1, len);
}
function hopDust(box, f) {
  const D = HOPFX.dust[f] || []; if (!D.length) return;
  const last = HOPFX.dust.reduce((m, d, i) => d.length ? i : m, 0), al = f >= last - 2 ? 0.45 + 0.25 * (last - f) : 1;
  drawCloud(D.map(([x, y, r]) => ({ x: box.x + x, y: box.y + y, r: Math.max(3, r * 2.2) })), al);
}
const MOCHIBOX_IMG = tagFrames(MOCHIBOX.map(g => gridToCanvas(g, PET.mochi.pal)), "mochi-dash");
const BOX_MS = MOCHIBOX.map((_, i) => i <= 17 ? 55 : i <= 22 ? 65 : i <= 24 ? 50 : i <= 31 ? 60 : 85);
BOX_MS[BOX_MS.length - 1] += 500;
const BOX_RUN = BOX_MS.reduce((a, b) => a + b, 0), DASH_LEN = BOX_RUN + STAND_LEN;
function boxFrame(t) { for (let i = 0; i < BOX_MS.length; i++) { if (t < BOX_MS[i]) return i; t -= BOX_MS[i]; } return BOX_MS.length - 1; }
const boxBody = (f, sgn) => sgn * (BOXMOVE.world[f] + BOXMOVE.cent[f] - BOXMOVE.cent[0]);
function startDash(now) {
  const reach = Math.abs(boxBody(MOCHIBOX.length - 1, 1)) + 18;
  const sgn = pet.x - reach > 14 ? 1 : pet.x + reach < W - 14 ? -1 : 0;
  if (!sgn) return false;
  pet.dash = { x0: pet.x, sgn, moved: false, f: -1 }; pet.dir = -sgn; startAct("dash", now); return true;
}
let now_ = 0;
function dashDust(box, front) {
  if (pet.act !== "dash" || !pet.dash) return;
  const t = now_ - pet.t0; if (t >= BOX_RUN) return;
  const D = DASH_DUST[boxFrame(t)]; if (!D) return;
  const flip = pet.dash.sgn < 0, img = MOCHIBOX_IMG[0];
  const cs = D.c.filter(c => !!c[3] === front).map(([x, y, r]) => ({ x: box.x + (flip ? img.width - x : x), y: box.y + y, r: Math.max(2.3, r * 1.55) }));
  drawCloud(cs, D.a);
}
const SORASLEEP_IMG = SORASLEEP.map(g => gridToCanvas(g, PET.sora.pal));
function loafPose(a, t) {
  for (const [i, ms] of LOAF_SEQ) {
    if (t < ms) {
      if (i === "sit") sitPose(a, t, SORALOAF_IMG[0]);
      else if (i === "stand") standPose(a, t, SORALOAF_IMG[SORALOAF.length - 1]);
      else { a.img = SORALOAF_IMG[i]; a.yoff = LOAF_DROP; }
      return;
    }
    t -= ms;
  }
}
const PEEK_IMG = PEEKS.map(g => gridToCanvas(g, PET.nori.pal));
const PEEK_STEP = PEEKS.map((_, i) => i === 0 ? 80 : 40);
const PEEK_LEN = PEEK_STEP.reduce((a, b) => a + b, 0);
const PEEK_RISE = 650, PEEK_DOWN = 550;
function peekIndex(t) { for (let k = 0; k < PEEK_STEP.length; k++) { if (t < PEEK_STEP[k]) return k; t -= PEEK_STEP[k]; } return 0; }
const SORA_PEEK_IMG = SORAPEEKS.map(g => gridToCanvas(g, PET.sora.pal));
const SORA_LICK = SORAPEEKS.slice(0, 20).map((_, i) => [i, i === 0 ? 120 : 40]);
const SORA_LICK_LEN = SORA_LICK.reduce((a, f) => a + f[1], 0);
const SORA_WAIT_MAX = 7000, SORA_AFTER = 800, SORA_PEEK_X = 30;
function soraPeekImg(pk, t) {
  if (pk.phase === "lick") { for (const [i, ms] of SORA_LICK) { if (t < ms) return SORA_PEEK_IMG[i]; t -= ms; } return SORA_PEEK_IMG[19]; }
  if (pk.phase === "wait" || pk.phase === "after") return SORA_PEEK_IMG[20 + Math.floor(t / 110) % 4];
  return SORA_PEEK_IMG[20];
}
function startPeek(now) {
  const side = G.pet === "sora" || pet.z > SIGN_Z ? 1 : pet.x < 90 ? -1 : 1;   // from behind the sign she leaves to the right, away from it
  pet.act = "peek"; pet.peek = { phase: "out", t0: now, side, edge: side < 0 ? -24 : W + 24, kind: G.pet };
  pet.target = pet.peek.edge;
}
const TWIRL_IMG = TWIRLS.map(g => gridToCanvas(g, PET.nori.pal));
const TWIRL_SEQ = [-1, ...TWIRLS.map((_, i) => i), -1];
const TWIRL_STEP = TWIRL_SEQ.map(i => i < 0 ? 180 : (i === 0 ? 80 : 40));
const TWIRL_LEN = TWIRL_STEP.reduce((a, b) => a + b, 0);
function twirlIndex(t) { for (let k = 0; k < TWIRL_SEQ.length; k++) { if (t < TWIRL_STEP[k]) return TWIRL_SEQ[k]; t -= TWIRL_STEP[k]; } return -1; }
const JUMP_IMG = JUMPS.map(g => gridToCanvas(g, PET.nori.pal));
const JUMP_SEQ = [-1, 13, 14, 15, 16, 17, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, -1];
const JUMP_STEP = JUMP_SEQ.map(i => i < 0 ? 160 : 40);
const JUMP_LEN = JUMP_STEP.reduce((a, b) => a + b, 0);
function jumpIndex(t, loop) {
  if (loop) t %= JUMP_LEN;
  for (let k = 0; k < JUMP_SEQ.length; k++) { if (t < JUMP_STEP[k]) return JUMP_SEQ[k]; t -= JUMP_STEP[k]; }
  return -1;
}
const LIE_DOWN = [["sit",SIT_LEN,5],[5,80],[6,160],[7,160],[8,160],[9,160],[10,220],[11,320]];
const GET_UP   = [[0,240],[1,160],[2,130],[3,130],[4,130],[5,320],["stand",STAND_LEN,5]];
const seqDur = s => s.reduce((a, b) => a + b[1], 0);

/* ---------- small icons and the 3x5 font ---------- */
const IPAL = { K:OUT, R:"#e2504a", W:"#ffffff", P:"#f27fa0", Y:"#ffd84d", E:"#f2d27a", G:"#6b7785", V:"#a497ef", U:"#9aaee6" };
const ICON_SRC = {
  hp:    [".P.P.","PWPPP","PPPPP",".PPP.","..P.."],
  spark: ["..Y..","..Y..","YYWYY","..Y..","..Y.."],
  spark2:[".Y.","YWY",".Y."],
  swish: [".G..G","G..G.",".G..G","G..G."],
  noteEE:["...KKKKK","...KEEEK","...K...K","...K...K",".KKK.KKK","KEEKKEEK",".KK..KK."],
  noteV: ["...K..","...KK.","...KVK","...K.K",".KKK..","KVVK..",".KK..."],
  noteU: ["...K..","...KK.","...KUK","...K.K",".KKK..","KUUK..",".KK..."],
};
const ICON = {};
for (const k in ICON_SRC) ICON[k] = gridToCanvas(ICON_SRC[k], IPAL);
const FONT = {
  A:"010101111101101",C:"011100100100011",I:"111010010010111",K:"101101110101101",L:"100100100100111",Z:"111001010100111",
  "0":"111101101101111","1":"010110010010111","2":"110001010100111","3":"110001010001110",
  "4":"101101111001001","5":"111100110001110","6":"011100111101111","7":"111001010010010","8":"111101111101111",
  "9":"111101111001110","!":"010010010000010",":":"000010000010000"," ":"000000000000000",
};
const tw = s => s.length * 4 - 1;
function text(s, x, y, col, g = ctx) {
  g.fillStyle = col;
  for (const ch of s.toUpperCase()) {
    const f = FONT[ch];
    if (f) for (let i = 0; i < 15; i++) if (f[i] === "1") g.fillRect(x + i % 3, y + (i / 3 | 0), 1, 1);
    x += 4;
  }
}
function textBig(s, x, y, col, k) {
  ctx.fillStyle = col;
  for (const ch of s.toUpperCase()) {
    const f = FONT[ch];
    if (f) for (let i = 0; i < 15; i++) if (f[i] === "1") ctx.fillRect(x + (i % 3) * k, y + (i / 3 | 0) * k, k, k);
    x += 4 * k;
  }
}

/* ---------- state ---------- */
// z is depth: how far back on the grass she stands (0 = the front line, Z_MAX = up by the hills). She is drawn z pixels higher,
// and once she is deeper than the sign's post she walks behind it.
const Z_MAX = 11, SIGN_Z = 4;
const pet = { x:90, z:0, tz:0, dir:1, act:"idle", t0:0, target:90, walked:0, blinkUntil:0, nextThink:0,
              petCooldown:0, earT:-9999, nextEar:0, lastStep:0, lastY:0, box:null };
let parts = [];
function startAct(a, now) { pet.act = a; pet.t0 = now; }
const busy = () => ["lieDown", "getUp", "peek", "held", "fall", "land", "skyland"].includes(pet.act);
function wakeUp(now) { if (G.pet === "nori" || G.pet === "sora") startAct("getUp", now); else { pet.act = "idle"; pet.nextThink = now + 1500; } }

/* ---------- particles ---------- */
function spawn(type, x, y, vx, vy, life) { parts.push({ type, x, y, vx, vy, life, max: life, seed: Math.random() * 6 }); }
function hearts(x, y, n) { for (let i = 0; i < n; i++) spawn("heart", x + (i - (n - 1) / 2) * 7, y - i * 3, (i - (n - 1) / 2) * 4, -16 - i * 3, 1300 + i * 150); }
function sparks(x, y, n) { for (let i = 0; i < n; i++) { const a = Math.PI * 2 * i / n; spawn("spark", x + Math.cos(a) * 10, y + Math.sin(a) * 8, Math.cos(a) * 18, Math.sin(a) * 18 - 8, 900 + i * 40); } }
function note(x, y, vx, vy, frames, kind) {
  spawn("note", x, y, vx / DANCE_MS * 1000, vy / DANCE_MS * 1000, Math.max(4, frames) * DANCE_MS + 300);
  parts[parts.length - 1].k = NOTE_ICON[kind];
}
function swishMark(x, y, vx, vy, frames) {
  spawn("note", x, y, vx / WAVE_MS * 1000, vy / WAVE_MS * 1000, Math.max(3, frames) * WAVE_MS + 300);
  parts[parts.length - 1].k = "swish";
}
/* dust cloud: round puffs merged into one outlined cloud */
const PUFF_FILL = [251, 248, 240], PUFF_LINE = [176, 158, 132], PUFF_SHADE = [218, 205, 184];
const puffCv = document.createElement("canvas"), puffCtx = puffCv.getContext("2d");
function drawCloud(circles, alpha) {
  if (!circles.length || alpha <= 0) return;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const P = circles.map(c => { x0 = Math.min(x0, c.x - c.r); y0 = Math.min(y0, c.y - c.r); x1 = Math.max(x1, c.x + c.r); y1 = Math.max(y1, c.y + c.r); return { ...c, a: alpha }; });
  x0 = Math.floor(x0) - 1; y0 = Math.floor(y0) - 1; const w = Math.ceil(x1) - x0 + 2, h = Math.ceil(y1) - y0 + 2;
  const al = new Float32Array(w * h), shade = new Uint8Array(w * h), own = new Int16Array(w * h).fill(-1);
  P.forEach((p, k) => { for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
    const dx = xx + x0 + 0.5 - p.x, dy = yy + y0 + 0.5 - p.y;
    if (dx * dx + dy * dy <= p.r * p.r) { al[yy * w + xx] = Math.max(al[yy * w + xx], p.a); own[yy * w + xx] = k; }
  } });
  P.forEach((p, k) => { for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
    const dx = xx + x0 + 0.5 - p.x, dy = yy + y0 + 0.5 - p.y, d2 = dx * dx + dy * dy;
    if (k % 2 === 0 && dy < -0.45 * p.r && d2 <= p.r * p.r && d2 > (p.r - 1) * (p.r - 1) && own[yy * w + xx] === k && k > 0) {
      if (P.some((q, j) => j < k && (xx + x0 + 0.5 - q.x) ** 2 + (yy + y0 + 0.5 - q.y) ** 2 < q.r * q.r)) shade[yy * w + xx] = 1;
    }
  } });
  puffCv.width = w; puffCv.height = h;
  const img = puffCtx.createImageData(w, h);
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
    const i = yy * w + xx, a = al[i]; if (!a) continue;
    const edge = !al[i - 1] || !al[i + 1] || !al[i - w] || !al[i + w] || xx === 0 || yy === 0 || xx === w - 1 || yy === h - 1;
    const c = edge ? PUFF_LINE : shade[i] ? PUFF_SHADE : PUFF_FILL;
    img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = Math.round(a * 230);
  }
  puffCtx.putImageData(img, 0, 0);
  ctx.drawImage(puffCv, x0, y0);
}
function dust(x, y) { spawn("dust", x - 2, y, -10, -4, 320); spawn("dust", x + 2, y, 10, -4, 320); }
function updateParts(dt) {
  const s = dt / 1000;
  for (const p of parts) {
    p.life -= dt; p.x += p.vx * s; p.y += p.vy * s;
    if (p.type === "heart") p.x += Math.sin((p.max - p.life) / 180 + p.seed) * 0.15;
    if (p.type === "note") p.y += Math.sin((p.max - p.life) / 120 + p.seed) * 0.08;
  }
  parts = parts.filter(p => p.life > 0);
}
function drawParts(now) {
  for (const p of parts) {
    if (p.type !== "note" && p.life < 260 && Math.floor(p.life / 60) % 2) continue;
    const x = Math.round(p.x), y = Math.round(p.y);
    if (p.type === "heart") ctx.drawImage(ICON.hp, x - 2, y - 2);
    else if (p.type === "spark") ctx.drawImage((Math.floor(now / 90 + p.seed) % 2) ? ICON.spark : ICON.spark2, x - 2, y - 2);
    else if (p.type === "note") {
      const im = ICON[p.k]; ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 300));
      ctx.drawImage(im, x - (im.width >> 1), y - (im.height >> 1)); ctx.globalAlpha = 1;
    }
    else if (p.type === "dust") px(x, y, p.life > 160 ? 2 : 1, p.life > 160 ? 2 : 1, "#f7e8cc");
  }
}

/* ---------- what the app can ask for ---------- */
function petReset(id) {
  G.pet = id; G.sleeping = false; G.wantSleep = false;
  Object.assign(pet, { x:90, dir:1, act:"idle", bubble:null, peek:null, dash:null, nextThink: performance.now() + 1200 });
  parts = [];
}
function petHop(n = 3) {             // a happy hop with hearts (start, tap, level up)
  const now = performance.now();
  if (busy() || G.sleeping) return;
  startAct("pet", now); hearts(pet.x, FEET - INFO[G.pet].h - 2, n);
}
function petCelebrate() {
  const now = performance.now();
  if (pet.act === "peek" || pet.act === "held" || pet.act === "fall") return;
  if (G.sleeping) { G.sleeping = false; G.wantSleep = false; }
  pet.act = "idle"; startAct("pet", now);
  hearts(pet.x, FEET - INFO[G.pet].h - 2, 5); sparks(pet.x, FEET - INFO[G.pet].h / 2, 8);
}
function petSetSleep(v) { G.wantSleep = !!v; }
// stand still in the middle (for the tutorial): breathing and blinking go on, nothing else starts
function petHold(on) {
  G.still = !!on;
  if (!on) return;
  Object.assign(pet, { act: "idle", x: 90, dir: 1, peek: null, dash: null });
  if (prop.state !== "hug") prop.state = "hug";
}

/* ---------- input: tap to pet, press and hold to pick up ---------- */
let press = null;
const GRAB_OK = ["idle", "walk", "lie", "spin", "twirl", "pet", "loaf", "dance", "wave", "gloom"];
const GRAB_HOLD = 260;
let onPetTap = null;
function grab(now) {
  press.grabbed = true;
  const h = INFO[G.pet].h;
  pet.act = "held"; pet.t0 = now; pet.hy = FEET; pet.bounced = false;
  pet.grabDy = Math.max(6, Math.min(h - 4, FEET - press.y));
}
function petPointerDown(e, x, y) {
  const now = performance.now();
  if (pet.act === "peek" && pet.peek.kind === "sora" && pet.peek.phase === "wait" && y >= TOP_Y && y < PEEK_BOT) {
    pet.peek.phase = "lick"; pet.peek.t0 = now; hearts(x, y, 3); return true;
  }
  y += Math.round(pet.z);                                  // into her own ground line
  const info = INFO[G.pet], sx = pet.x - (info.w >> 1) - 3, sy = FEET - info.h - 10;
  if (x >= sx && x < sx + info.w + 6 && y >= sy && y < FEET + 4) {
    press = { id: e.pointerId, t0: now, x, y, sx: x, sy: y, lx: x, ly: y, lt: now, vx: 0, vy: 0,
              canGrab: GRAB_OK.includes(pet.act) && !G.sleeping, grabbed: false };
    return true;
  }
  return false;
}
function petPointerMove(e, x, y) {
  if (!press || e.pointerId !== press.id) return;
  y += Math.round(pet.z);
  const now = performance.now(), dt = Math.max(8, now - press.lt);
  press.vx = press.vx * 0.5 + (x - press.lx) / dt * 1000 * 0.5;
  press.vy = press.vy * 0.5 + (y - press.ly) / dt * 1000 * 0.5;
  press.lx = press.x = x; press.ly = press.y = y; press.lt = now;
  if (!press.grabbed && press.canGrab && now - press.t0 > 120 && Math.hypot(x - press.sx, y - press.sy) > 4) grab(now);
}
function petPointerUp(e) {
  if (!press || e.pointerId !== press.id) return;
  const now = performance.now();
  if (press.grabbed) {
    if (now - press.lt > 90) { press.vx = 0; press.vy = 0; }
    pet.act = "fall"; pet.t0 = now;
    pet.skyDrop = G.pet === "mochi" && FEET - pet.hy >= HOP_DROP_MIN;
    pet.vx = Math.max(-140, Math.min(140, press.vx * 0.45));
    pet.vy = Math.max(-170, Math.min(220, press.vy * 0.45));
  } else if (now - press.t0 < 350 && now > pet.petCooldown) {
    pet.petCooldown = now + 900;
    if (!busy() && !G.sleeping) { startAct("pet", now); hearts(pet.x, FEET - INFO[G.pet].h - 2, 2); }
    if (onPetTap) onPetTap();
  }
  press = null;
}

/* ---------- which frame to show right now ---------- */
function petPose(now) {
  const a = BASE_POSE(), t = Math.max(0, now - pet.t0);
  if (pet.act === "lieDown") { if (G.pet === "sora") sitPose(a, t, SORASLEEP_IMG[0]); else if (G.pet === "nori") seqPose(a, LIE_DOWN, t); return a; }
  if (pet.act === "getUp") { if (G.pet === "sora") standPose(a, t, SORASLEEP_IMG[0]); else if (G.pet === "nori") seqPose(a, GET_UP, t); return a; }
  if (G.sleeping && !["held", "fall", "land", "skyland"].includes(pet.act)) {
    if (G.pet === "nori") { a.img = POSE_IMG[Math.floor(now / 1100) % 2 ? 0 : 11]; return a; }
    if (G.pet === "sora") { a.img = SORASLEEP_IMG[Math.floor(now / 1100) % 2 ? 0 : 1]; a.yoff = LOAF_DROP; return a; }
    a.face = "sleep"; a.body = Math.floor(now / 1100) % 2 ? "squash" : "base"; return a;
  }
  if (pet.act === "lie") { seqPose(a, LIE_SEQ, t); return a; }
  switch (pet.act) {
    case "walk": { const k = Math.floor(pet.walked / 3) % 4; a.step = [-1, 0, 1, 0][k]; a.yoff = k % 2 ? -1 : 0; break; }
    case "pet": {
      if (G.pet === "nori") { const j = jumpIndex(t, false); if (j >= 0) a.img = JUMP_IMG[j]; break; }
      if (G.pet === "sora") { const j = soraHop(SORA_ONCE, t, false); if (j >= 0) { a.img = SORAHOP_IMG[j]; a.flip = pet.dir > 0; } break; }
      a.face = "happy";
      if (t < 100) a.body = "squash";
      else if (t < 380) { a.body = "stretch"; a.yoff = -Math.round(Math.sin((t - 100) / 280 * Math.PI) * 4); }
      else if (t < 470) a.body = "squash";
      a.ear = [0, 0, 1, -1, 1, -1, 0][Math.min(6, Math.floor(t / 110))];
      break;
    }
    case "held": {
      if (G.pet === "nori") a.img = JUMP_IMG[[0, 1, 2, 3, 2, 1][Math.floor(t / 130) % 6]];
      else { a.body = "stretch"; a.face = "happy"; a.ear = Math.floor(t / 220) % 2 ? 1 : -1; a.step = Math.floor(t / 220) % 2 ? 1 : -1; }
      a.yoff = Math.round(pet.hy - FEET + Math.sin(t / 170));
      break;
    }
    case "fall": {
      if (G.pet === "nori") a.img = JUMP_IMG[pet.vy < 0 ? 4 : 8];
      else if (G.pet === "mochi" && pet.skyDrop) { a.hopF = FEET - pet.hy < 14 && pet.vy > 0 ? HOP_NEAR_F : HOP_FALL_F; a.img = MOCHIHOP_IMG[a.hopF]; }
      else { a.body = "stretch"; a.ear = -1; }
      a.yoff = Math.round(pet.hy - FEET);
      break;
    }
    case "land": {
      if (G.pet === "nori") a.img = JUMP_IMG[[11, 12, 12, 11, 10][Math.min(4, Math.floor(t / 90))]];
      else { a.body = t < 220 ? "squash" : "base"; a.face = "happy"; }
      break;
    }
    case "peek": {
      const ph = pet.peek.phase;
      if (ph === "out" || ph === "in") { const k = Math.floor(pet.walked / 3) % 4; a.step = [-1, 0, 1, 0][k]; a.yoff = k % 2 ? -1 : 0; }
      else a.hidden = true;
      break;
    }
    case "dance": { a.img = danceImg(t); break; }
    case "wave": { a.img = MOCHIWAVE_IMG[waveFrame(t)]; break; }
    case "skyland": { skylandPose(a, t); break; }
    case "dash": {
      const d = pet.dash, L = MOCHIBOX.length - 1;
      if (!d) break;
      if (t < BOX_RUN) { const f = boxFrame(t); a.img = MOCHIBOX_IMG[f]; a.flip = d.sgn < 0; a.dx = d.x0 + d.sgn * (BOXMOVE.world[f] - BOXMOVE.cent[0]) - pet.x; }
      else { standPose(a, t - BOX_RUN, MOCHIBOX_IMG[L], 0); if (a.img) { a.flip = d.sgn < 0; a.dx = -d.sgn * BOXMOVE.cent[L]; } }
      break;
    }
    case "gloom": { gloomPose(a, t); break; }
    case "loaf": { loafPose(a, t); break; }
    case "twirl": { const j = twirlIndex(t); if (j >= 0) a.img = TWIRL_IMG[j]; break; }
    case "spin": { const j = spinIndex(t); if (j >= 100) a.img = TWIRL_IMG[j - 100]; else if (j >= 0) a.img = SPIN_IMG[j]; break; }
    default: {                       // breathing loop: base -> squash -> base -> stretch
      const per = 1300, ph = (now % per) / per;
      a.body = ph < 0.4 ? "base" : ph < 0.55 ? "squash" : ph < 0.85 ? "base" : "stretch";
      const e = now - pet.earT;
      if (e >= 0 && e < 400) a.ear = [1, 0, 1, 0][Math.floor(e / 100)];
      if (now < pet.blinkUntil) a.face = "blink";
    }
  }
  return a;
}

/* ---------- 치카's teddy bear: a little object in the world, not a sticker on her ----------
   hug   : in her arms (drawn by items.js on the frames where her face shows)
   ground: set down or dropped; she walks over and picks it up when she is free
   fly   : slipped out of her arms, tumbling in 90-degree steps; she catches it if it comes down on her
   lift  : the short hop back into her arms */
const prop = { state: "hug", x: 0, y: 0, z: 0, vx: 0, vy: 0, rot: 0, spin: 0, t0: 0, fx: 0, fy: 0, ready: 0, lastAct: "" };
const teddyOn = () => G.pet === "mochi" && !!(G.equip && G.equip.teddy);
const teddyHugged = () => !teddyOn() || prop.state === "hug";
let TEDDY_ROT = null;
function teddyImg(rot) {                // the bear turned in quarter turns, pixel for pixel
  if (!TEDDY_ROT) {
    const base = gridToCanvas(TEDDY.map(r => r.replace(/\./g, "B")), TEDDY_PAL);
    TEDDY_ROT = [0, 1, 2, 3].map(q => {
      const c = document.createElement("canvas"), side = q % 2;
      c.width = side ? base.height : base.width; c.height = side ? base.width : base.height;
      const g = c.getContext("2d"); g.translate(q === 1 ? c.width : q === 2 ? c.width : 0, q === 2 ? c.height : q === 3 ? c.height : 0);
      g.rotate(q * Math.PI / 2); g.drawImage(base, 0, 0); return c;
    });
  }
  return TEDDY_ROT[((rot % 4) + 4) % 4];
}
function teddyDown(now, x, rot) {
  Object.assign(prop, { state: "ground", x: Math.max(10, Math.min(W - 10, x)), y: FEET + 2, z: pet.z, vx: 0, vy: 0, rot, ready: now + 900 });
}
// she sets it down: it moves from her arms to its place on the grass (a little lift, then down) instead of jumping there
function teddyPlace(now, x, rot) {
  Object.assign(prop, { state: "place", t0: now, fx: pet.x, fy: FEET - 1, tx: Math.max(10, Math.min(W - 10, x)), trot: rot, z: pet.z, rot: 0 });
}
function teddyToss(now, vx, vy, spin) {                  // it leaves her arms wherever she is: up in the air when she is dropped
  const y = (pet.act === "fall" || pet.act === "held" ? pet.hy : FEET) - 6;
  Object.assign(prop, { state: "fly", x: pet.x, y, z: pet.z, vx, vy, spin, t0: now, rot: 0 });
}
function updateTeddy(now, dt) {
  if (!teddyOn()) { prop.state = "hug"; prop.lastAct = pet.act; return; }
  const s = dt / 1000, act = pet.act, began = act !== prop.lastAct;
  prop.lastAct = act;
  if (prop.state === "hug" && began) {
    const side = pet.x < W / 2 ? 1 : -1;
    if (act === "wave") teddyPlace(now, pet.x + side * 19, 0);                      // puts it down to wave both hands
    else if (act === "lieDown" || (G.sleeping && act !== "held" && act !== "fall")) teddyPlace(now, pet.x + side * 19, 1);   // tucked in beside her
    else if (act === "peek") teddyPlace(now, pet.x, 0);                              // left where she was
    else if (act === "dash") teddyToss(now, pet.dir * 70, -120, pet.dir);            // loses grip as she dives
    else if (act === "fall" && FEET - pet.hy >= 14) teddyToss(now, (pet.vx || 0) * 0.5, -170, pet.vx < 0 ? -1 : 1);   // thrown: it flies off her and spins (a little lift, she keeps hold)
  }
  if (prop.state === "fly") {
    prop.vy += 520 * s; prop.x += prop.vx * s; prop.y += prop.vy * s;
    if (prop.x < 8 || prop.x > W - 8) { prop.vx = -prop.vx * 0.6; prop.x = Math.max(8, Math.min(W - 8, prop.x)); }
    prop.rot = prop.spin ? Math.floor((now - prop.t0) / 90) * prop.spin : 0;
    // she catches it when it comes down onto her and she is standing
    const free = ["idle", "walk", "land", "pet"].includes(pet.act) && !G.sleeping;
    if (prop.vy > 0 && free && Math.abs(prop.x - pet.x) < 14 && prop.y > FEET - 30 && prop.y < FEET - 6) {
      Object.assign(prop, { state: "lift", t0: now, fx: prop.x, fy: prop.y, arc: 0, dur: 160 }); hearts(pet.x, FEET - 34, 2); return;   // into her arms, not snapped there
    }
    if (prop.y >= FEET + 2) {
      prop.y = FEET + 2;
      if (prop.vy > 140) { prop.vy = -prop.vy * 0.35; prop.vx *= 0.6; dust(prop.x, FEET + 1); }
      else { teddyDown(now, prop.x, ((Math.round(prop.rot) % 2) + 2) % 2); dust(prop.x, FEET + 1); }
    }
  }
  if (prop.state === "lift") {
    const q = Math.min(1, (now - prop.t0) / (prop.dur || 260)), arc = prop.arc ?? 10;
    prop.x = prop.fx + (pet.x - prop.fx) * q; prop.y = prop.fy + (FEET - 1 - prop.fy) * q - Math.sin(q * Math.PI) * arc; prop.rot = 0;
    if (q >= 1) Object.assign(prop, { state: "hug", arc: undefined, dur: undefined });
  }
  if (prop.state === "place") {
    const q = Math.min(1, (now - prop.t0) / 300);
    prop.x = prop.fx + (prop.tx - prop.fx) * q; prop.y = prop.fy + (FEET + 2 - prop.fy) * q - Math.sin(q * Math.PI) * 6;
    prop.rot = q > 0.6 ? prop.trot : 0;
    if (q >= 1) teddyDown(now, prop.tx, prop.trot);
  }
}
// her Lv10 weapon, set down on the grass while she lies down, loafs or sleeps: like the bear it stays where she put it
// (it does not hop to her other side when she turns), she lays it down and picks it up again
const wprop = { state: "held", x: 0, y: 0, z: 0, fx: 0, fy: 0, tx: 0, side: 1, t0: 0 };
const weaponOn = () => typeof WEAPON_OF !== "undefined" && !!(G.equip && G.equip[WEAPON_OF[G.pet]]);
function updateWeaponProp(now) {
  if (!weaponOn()) { wprop.state = "held"; return; }
  const rest = G.sleeping || G.wantSleep && pet.act === "lieDown" || ["lieDown", "lie", "getUp", "loaf"].includes(pet.act);
  const hands = FEET - (INFO[G.pet].h - ANCHOR[G.pet].arm);
  if (rest && wprop.state === "held") {
    const side = (pet.x < W / 2 ? 1 : -1) * (teddyOn() && prop.state !== "hug" ? -1 : 1);   // the other side from her bear
    Object.assign(wprop, { state: "place", t0: now, fx: pet.x, fy: hands, tx: Math.max(16, Math.min(W - 16, pet.x + side * 24)), side, z: pet.z });
  }
  if (rest && wprop.state === "ground") wprop.ready = now + 900;          // she goes back for it once she is up (fetchWeapon)
  if (wprop.state === "place") {
    const q = Math.min(1, (now - wprop.t0) / 320);
    wprop.x = wprop.fx + (wprop.tx - wprop.fx) * q; wprop.y = wprop.fy + (FEET - 2 - wprop.fy) * q - Math.sin(q * Math.PI) * 6;
    if (q >= 1) { wprop.state = "ground"; wprop.ready = now + 900; }
  }
  if (wprop.state === "lift") {
    const q = Math.min(1, (now - wprop.t0) / 260);
    wprop.x = wprop.fx + (pet.x - wprop.fx) * q; wprop.y = wprop.fy + (hands - wprop.fy) * q - Math.sin(q * Math.PI) * 8;
    if (q >= 1) wprop.state = "held";
  }
}
// when she is free and her weapon is on the grass, she walks over and picks it up, like her bear
function fetchWeapon(now) {
  if (!weaponOn() || wprop.state !== "ground" || now < (wprop.ready || 0) || G.sleeping || G.wantSleep) return false;
  const dx = wprop.x - pet.x;
  if (Math.abs(dx) > 12 || Math.abs(wprop.z - pet.z) > 1.5) { pet.act = "walk"; pet.target = wprop.x - Math.sign(dx) * 10; pet.tz = wprop.z; return true; }
  Object.assign(wprop, { state: "lift", t0: now, fx: wprop.x, fy: wprop.y });
  pet.dir = Math.sign(dx) || pet.dir; startAct("pet", now); return true;
}
function drawWeaponProp(front) {
  if (!weaponOn() || wprop.state === "held" || (wprop.state === "ground") === front) return;   // on the ground behind her, moving in front
  const f = weaponFlat(G.pet), mid = WEAPON_MID[G.pet], arm = ANCHOR[G.pet].arm;
  ctx.save(); ctx.translate(Math.round(wprop.x), Math.round(wprop.y) - Math.round(wprop.z)); if (wprop.side < 0) ctx.scale(-1, 1);   // pointing away from her
  ctx.drawImage(f.img, f.x - mid, f.y - arm);
  ctx.restore();
}
// when she is free and her bear is on the ground, she goes to get it (called before she picks something else to do)
function fetchTeddy(now) {
  if (!teddyOn() || prop.state !== "ground" || now < prop.ready || G.sleeping || G.wantSleep) return false;
  const dx = prop.x - pet.x;
  if (Math.abs(dx) > 9 || Math.abs(prop.z - pet.z) > 1.5) { pet.act = "walk"; pet.target = prop.x - Math.sign(dx) * 7; pet.tz = prop.z; return true; }
  Object.assign(prop, { state: "lift", t0: now, fx: prop.x, fy: prop.y });
  pet.dir = Math.sign(dx) || pet.dir; startAct("pet", now); return true;
}
function drawTeddy(front) {
  if (!teddyOn() || prop.state === "hug") return;
  // on the ground it is behind her and in the air in front; but when she trips or tumbles, the bear she dropped stays in
  // front of her
  const tumble = ["dash", "fall", "land", "skyland"].includes(pet.act);
  if ((prop.state === "ground" && !tumble) === front) return;
  const im = teddyImg(prop.rot), x = Math.round(prop.x - im.width / 2), y = Math.round(prop.y - im.height) - Math.round(prop.z);
  if (prop.state === "ground") groundShadow(ctx, prop.x, Math.round(prop.y) - Math.round(prop.z) - 1, im.width - 2, 1);
  ctx.drawImage(im, x, y);
}

// the next point to head for on the way to (target, tz): she never steps from in front of the sign to behind it (or back)
// while her body overlaps its post, so she goes round it, crossing that line beside the sign instead
function aroundSign() {
  const tx = pet.target, tz = pet.tz;
  if ((pet.z - SIGN_Z) * (tz - SIGN_Z) >= 0) return [tx, tz];
  const gap = (INFO[G.pet].w >> 1) + 3;
  const xc = pet.x + (tx - pet.x) * (SIGN_Z - pet.z) / (tz - pet.z);
  if (Math.abs(xc - SIGN_X) >= gap + 3) return [tx, tz];
  if (Math.abs(pet.x - SIGN_X) < gap + 3) return [SIGN_X + gap + 4, pet.z];   // step out to the side first
  return [pet.x, tz];                                                     // then cross the line clear of the post
}
// somewhere to stroll to: across the grass and up or down it; now and then over to the sign, in front of it or behind
function pickWalk() {
  if (Math.random() < 0.3) { pet.target = SIGN_X + (Math.random() - 0.5) * 18; pet.tz = Math.random() < 0.55 ? Z_MAX - Math.random() * 3 : Math.random() * 2; return; }
  pet.target = 36 + Math.random() * 108;
  pet.tz = Math.random() < 0.3 ? pet.z : Math.random() * Z_MAX;
}

/* ---------- update ---------- */
function petUpdate(now, dt) {
  updateParts(dt);
  const dur = { skyland:SKYLAND_LEN, gloom:GLOOM_LEN, dash:DASH_LEN, wave:WAVE_LEN,
    pet:(G.pet === "nori" ? JUMP_LEN : G.pet === "sora" ? seqLen(SORA_ONCE) : 520), dance:DANCE_LEN, lie:LIE_DUR,
    lieDown:(G.pet === "nori" ? seqDur(LIE_DOWN) : G.pet === "sora" ? SIT_LEN : 1), getUp:(G.pet === "nori" ? seqDur(GET_UP) : G.pet === "sora" ? STAND_LEN : 1),
    spin:SPIN_LEN, twirl:TWIRL_LEN, land:460, loaf:LOAF_LEN }[pet.act];
  if (dur && now - pet.t0 >= dur) { pet.act = "idle"; pet.nextThink = now + 1500; }

  // fall asleep / wake up when the app asks (rest time), once she is free
  if (G.wantSleep !== G.sleeping && (pet.act === "idle" || pet.act === "walk" || pet.act === "lie" || pet.act === "loaf" || pet.act === "pet" || pet.act === "gloom" || pet.act === "wave" || pet.act === "dance" || pet.act === "spin" || pet.act === "twirl")) {
    G.sleeping = G.wantSleep;
    if (G.sleeping) { pet.act = "idle"; startAct("lieDown", now); }
    else wakeUp(now);
  }

  if (G.pet === "sora" && pet.act === "dance") {
    const f = danceFrame(now - pet.t0);
    if (pet.noteT0 !== pet.t0) { pet.noteT0 = pet.t0; pet.noteF = -1; }
    const sw = SORADANCE[0][0].length, sh = SORADANCE[0].length;
    const sx = Math.round(pet.x) - (sw >> 1), sy = FEET - sh;
    for (let k = pet.noteF + 1; k <= f; k++) for (const [nx, ny, c, vx, vy, n] of DANCE_NOTES[k]) note(sx + nx, sy + ny, vx, vy, n, c);
    pet.noteF = f;
  }
  if (G.pet === "mochi" && pet.act === "wave") {
    const t = Math.max(0, now - pet.t0), f = Math.floor(t / WAVE_MS);
    if (pet.noteT0 !== pet.t0) { pet.noteT0 = pet.t0; pet.noteF = -1; }
    const sw = MOCHIWAVE[0][0].length, sh = MOCHIWAVE[0].length;
    const sx = Math.round(pet.x) - (sw >> 1), sy = FEET - sh;
    for (let k = pet.noteF + 1; k <= Math.min(f, MOCHIWAVE.length - 1); k++)
      for (const [nx, ny, c, vx, vy, n] of MOCHI_SWISH[k]) swishMark(sx + nx, sy + ny, vx, vy, n);
    pet.noteF = Math.max(pet.noteF, f);
  }
  if (pet.act === "dash" && pet.dash) {
    const d = pet.dash, t = now - pet.t0, L = MOCHIBOX.length - 1;
    if (t >= BOX_RUN && !d.moved) { d.moved = true; pet.x = d.x0 + boxBody(L, d.sgn); }
  }
  if (!G.sleeping && now > pet.blinkUntil + 2500 && Math.random() < dt / 1500) pet.blinkUntil = now + 140;
  if (!G.sleeping && pet.act === "idle" && now > pet.nextEar) { pet.earT = now; pet.nextEar = now + 3000 + Math.random() * 5000; }

  updateTeddy(now, dt);
  updateWeaponProp(now);
  if (G.still) pet.nextThink = now + 1500;                               // the tutorial is talking: she stands and listens
  else if (pet.act === "idle" && !G.sleeping && !G.wantSleep && now > prop.ready && fetchTeddy(now)) {}
  else if (pet.act === "idle" && !G.sleeping && !G.wantSleep && fetchWeapon(now)) {}
  else if (pet.act === "idle" && !G.sleeping && !G.wantSleep && now > pet.nextThink) {
    pet.nextThink = now + 2500 + Math.random() * 3500;
    const r = Math.random(), calm = G.studying;          // fewer big moves while you study
    if (G.pet === "nori" && r < (calm ? 0.35 : 0.3)) startAct("lie", now);
    else if (G.pet === "nori" && r < 0.45) startAct("spin", now);
    else if (G.pet === "nori" && r < 0.58) startAct("twirl", now);
    else if (G.pet === "nori" && !calm && r < 0.66) startPeek(now);
    else if (G.pet === "sora" && r < (calm ? 0.35 : 0.2)) startAct("loaf", now);
    else if (G.pet === "sora" && r < 0.34) startAct("pet", now);
    else if (G.pet === "sora" && r < 0.42) startAct("dance", now);
    else if (G.pet === "sora" && !calm && r < 0.5) startPeek(now);
    else if (G.pet === "mochi" && r < (G.lowMood ? 0.4 : 0.08)) startAct("gloom", now);   // 치카 gets gloomy when her plan falls apart
    else if (G.pet === "mochi" && r < 0.3) startAct("wave", now);
    else if (G.pet === "mochi" && r < 0.45 && startDash(now)) {}
    else if (r < 0.7) { pet.act = "walk"; pickWalk(); }
  }
  if (press && !press.grabbed && press.canGrab && now - press.t0 > GRAB_HOLD) grab(now);
  if (pet.act === "held" && press) {
    const h = INFO[G.pet].h;
    const tx = Math.max(14, Math.min(W - 14, press.x));
    const ty = Math.max(TOP_Y + h + 4, Math.min(FEET, press.y + pet.grabDy));
    const k = Math.min(1, dt / 1000 * 14);
    if (Math.abs(tx - pet.x) > 0.6) pet.dir = Math.sign(tx - pet.x);
    pet.x += (tx - pet.x) * k; pet.hy += (ty - pet.hy) * k;
  }
  if (pet.act === "fall") {
    const s_ = dt / 1000;
    pet.vy += 1100 * s_; pet.hy += pet.vy * s_;
    pet.x = Math.max(14, Math.min(W - 14, pet.x + pet.vx * s_)); pet.vx *= Math.pow(0.4, s_);
    if (pet.hy >= FEET) {
      pet.hy = FEET;
      if (pet.skyDrop) { pet.skyDrop = false; pet.act = "skyland"; pet.t0 = now; pet.vx = 0; }
      else if (pet.vy > 280 && !pet.bounced) { pet.vy = -pet.vy * 0.25; pet.bounced = true; dust(pet.x, FEET - 1); }
      else { pet.act = "land"; pet.t0 = now; dust(pet.x - 7, FEET - 1); dust(pet.x + 7, FEET - 1); }
    }
  }
  if (pet.act === "peek") {
    const pk = pet.peek, t = now - pk.t0;
    if (pk.phase === "out" || pk.phase === "in") {
      const dx = pet.target - pet.x;
      if (Math.abs(dx) < 1) {
        if (pk.phase === "out") { pk.phase = "rise"; pk.t0 = now; }
        else { pet.act = "idle"; pet.nextThink = now + 1500; }
      } else {
        const step = Math.min(Math.abs(dx), 34 * dt / 1000); pet.dir = Math.sign(dx); pet.x += pet.dir * step; pet.walked += step;
        const clear = pet.z <= SIGN_Z || Math.abs(pet.x - SIGN_X) >= (INFO[G.pet].w >> 1) + 3;   // not through the sign's post
        if (clear) pet.z = Math.max(0, pet.z - step * 0.5);
        pet.tz = 0;                                                     // close-ups come up from the front edge
        const k = Math.floor(pet.walked / 3) % 4;
        if (k !== pet.lastStep && (k === 0 || k === 2) && pet.x > 0 && pet.x < W) dust(pet.x - pet.dir * 8, FEET - 1);
        pet.lastStep = k;
      }
    } else if (pk.phase === "rise" && t >= PEEK_RISE) { pk.phase = pk.kind === "sora" ? "wait" : "show"; pk.t0 = now; }
    else if (pk.phase === "show" && t >= PEEK_LEN) { pk.phase = "down"; pk.t0 = now; }
    else if (pk.phase === "wait" && t >= SORA_WAIT_MAX) { pk.phase = "down"; pk.t0 = now; }
    else if (pk.phase === "lick" && t >= SORA_LICK_LEN) { pk.phase = "after"; pk.t0 = now; }
    else if (pk.phase === "after" && t >= SORA_AFTER) { pk.phase = "down"; pk.t0 = now; }
    else if (pk.phase === "down" && t >= PEEK_DOWN) { pk.phase = "in"; pk.t0 = now; pet.x = pk.edge; pet.target = 90; }
  }
  if (pet.act === "walk") {
    if (Math.hypot(pet.target - pet.x, (pet.tz - pet.z) * 1.6) < 1) pet.act = "idle";
    else {
      const [gx, gz] = aroundSign();
      const dx = gx - pet.x, dz = gz - pet.z, dist = Math.max(0.001, Math.hypot(dx, dz * 1.6));   // depth reads shorter on screen, so it is walked slower
      const step = Math.min(dist, 16 * dt / 1000);
      if (Math.abs(dx) > 0.5) pet.dir = Math.sign(dx);
      pet.x += dx / dist * step; pet.z += dz / dist * step; pet.walked += step;
    }
    const k = Math.floor(pet.walked / 3) % 4;
    if (k !== pet.lastStep && (k === 0 || k === 2)) dust(pet.x - pet.dir * 8, FEET - 1);
    pet.lastStep = k;
  }
}

/* ---------- drawing ---------- */
// sprite + items. Hand-placed items sit on the base-sprite frames (they follow squash, stretch and the flip);
// auto items (item-auto.js) find their place on every frame, traced motions included.
function drawSprite(g, id, pose, cx, feet, dir, equip, shadow = true) {
  const img = pose.img || frame(id, pose);
  if (pose.img) dir = pose.flip ? -1 : 1;
  const kx = pose.sx || 1, ky = pose.sy || 1;
  const dw = Math.round(img.width * kx), dh = Math.round(img.height * ky);
  cx += pose.dx || 0;
  const x = Math.round(cx) - (dw >> 1), y = feet - dh + pose.yoff;
  if (shadow) {                                     // as wide as her footprint; it shrinks and fades as she leaves the ground
    const up = Math.max(0, -pose.yoff), k = Math.max(0.45, 1 - up / 70);
    groundShadow(g, cx, feet, Math.round(footprint(img) * kx * k), Math.max(0.35, 1 - up / 90));
  }
  g.imageSmoothingEnabled = false;
  const items = equip && typeof drawItems === "function";
  g.save();
  g.translate(dir < 0 ? x + dw : x, y);
  g.scale((dir < 0 ? -1 : 1) * dw / img.width, dh / img.height);
  const dy = img.height - INFO[id].h;               // squash / stretch adds or drops a row low on the body (items below it shift)
  if (items) drawItems(g, id, equip, "back", dy, pose, img);
  g.drawImage(img, 0, 0);
  if (items) drawItems(g, id, equip, "front", dy, pose, img);
  g.restore();
  return { x, y, w: dw, h: dh };
}

// how wide she is where she touches the ground (the widest of her lowest rows), cached on the frame
function footprint(img) {
  if (img._foot) return img._foot;
  const gr = img.grid; if (!gr) return (img._foot = Math.round(img.width * 0.7));
  let w = 0;
  for (let y = gr.length - 1, n = 0; y >= 0 && n < 6; y--) {
    const r = gr[y], a = r.search(/[^B]/); if (a < 0) continue;
    n++; w = Math.max(w, r.length - 1 - r.split("").reverse().join("").search(/[^B]/) - a + 1);
  }
  return (img._foot = Math.max(8, w));
}
// a soft pixel ellipse on the grass: a darker core with a lighter rim, three rows deep
function groundShadow(g, cx, feet, w, alpha = 1) {
  const x = Math.round(cx), half = Math.max(3, (w >> 1) + 2);
  const rows = [[-2, half - 2, 0.14], [-1, half, 0.26], [0, half - 1, 0.22], [1, half - 4, 0.1]];
  for (const [dy, hw, a] of rows) {
    if (hw <= 0) continue;
    g.fillStyle = `rgba(36,44,52,${(a * alpha).toFixed(3)})`;
    g.fillRect(x - hw, feet + dy, hw * 2, 1);
    if (dy === -1 && hw > 6) { g.fillStyle = `rgba(36,44,52,${(0.1 * alpha).toFixed(3)})`; g.fillRect(x - hw + 4, feet - 1, hw * 2 - 8, 1); }   // a darker core right under her
  }
}

function petRender(now) {
  ctx.clearRect(0, 0, W, H);
  const pose = petPose(now);
  if (pet.lastY < -2 && pose.yoff === 0 && !G.sleeping) dust(pet.x, FEET - 1);
  pet.lastY = pose.yoff;
  now_ = now;
  if (pet.act === "dash" && !pose.hidden) {
    const img = pose.img || MOCHIBOX_IMG[0];
    dashDust({ x: Math.round(pet.x + (pose.dx || 0)) - (img.width >> 1), y: FEET - img.height + pose.yoff }, false);
  }
  drawTeddy(false); drawWeaponProp(false);
  ctx.save(); ctx.translate(0, -Math.round(pet.z));     // her depth on the grass
  const box = pose.hidden ? { x: pet.x, y: FEET - 30, w: 0, h: 30 } : drawSprite(ctx, G.pet, pose, pet.x, FEET, pet.dir, G.equip);
  if (G.pet === "mochi" && pet.act === "fall" && pet.skyDrop) hopLines(box, pose.hopF, now);
  if (G.pet === "mochi" && pet.act === "skyland" && now - pet.t0 < SKYLAND_RUN) { const f = skylandFrame(Math.max(0, now - pet.t0)); hopLines(box, f, now); hopDust(box, f); }
  if (pet.act === "dash" && !pose.hidden) dashDust(box, true);
  if (G.pet === "mochi" && pet.act === "gloom" && !pose.hidden) {
    const t = Math.max(0, now - pet.t0 - SIT_LEN), f = t >= GLOOM_MAIN ? 0 : gloomFrame(t), d = MOCHI_DASH[f];
    if (d && d.length) {
      let al = Math.min(1, (t - (DASH_FROM - 1) * WAVE_MS) / 300);
      if (t > GLOOM_IN + GLOOM_HOLD) al = Math.max(0, 1 - (t - GLOOM_IN - GLOOM_HOLD) / (GLOOM_BACK.length * 90 * 0.6));
      ctx.globalAlpha = Math.max(0, al); ctx.fillStyle = OUT;
      const cx = d.reduce((a, e) => a + e[0], 0) / d.length, cy = d.reduce((a, e) => a + e[1], 0) / d.length;
      [[-2, 3, 0], [0, 4, -1], [2, 3, 0]].forEach(([dx, len, dy], i) => {
        const wob = Math.floor(now / 380 + i) % 2;
        ctx.fillRect(box.x + Math.round(cx) + dx, box.y + Math.round(cy - 2) + dy + wob, 1, len);
      });
      ctx.globalAlpha = 1;
    }
  }
  drawParts(now);
  ctx.restore();
  box.y -= Math.round(pet.z);                            // back to screen space, for the Zzz and the speech bubble
  if (pet.z > SIGN_Z + 0.5 && typeof drawSignOver === "function") drawSignOver(ctx, now);   // behind the sign
  drawTeddy(true); drawWeaponProp(true);
  if (pet.act === "peek" && pet.peek.phase !== "out" && pet.peek.phase !== "in") {
    const pk = pet.peek, t = now - pk.t0, sora = pk.kind === "sora";
    let img = sora ? soraPeekImg(pk, t) : PEEK_IMG[0], off = 0;
    const ease = q => 1 - Math.pow(1 - Math.min(1, Math.max(0, q)), 3);
    if (pk.phase === "rise") off = 1 - ease(t / PEEK_RISE);
    else if (pk.phase === "down") off = ease(t / PEEK_DOWN);
    else if (!sora) img = PEEK_IMG[peekIndex(t)];
    const y = PEEK_BOT - img.height + Math.round(off * (img.height + 2));
    ctx.save(); ctx.beginPath(); ctx.rect(0, TOP_Y, W, PEEK_BOT - TOP_Y); ctx.clip();
    ctx.drawImage(img, sora ? SORA_PEEK_X : (W - img.width) >> 1, y);
    ctx.restore();
    if (sora && pk.phase === "wait" && (t % 900) < 650) {
      const bx = 4, by = y + 30 + Math.round(Math.sin(t / 160));
      px(bx + 1, by, 52, 15, OUT); px(bx, by + 1, 54, 13, OUT); px(bx + 1, by + 1, 52, 13, "#ffffff");
      textBig("CLICK!", bx + 4, by + 3, OUT, 2);
    }
  }
  if (G.sleeping && !pose.hidden) {
    for (let i = 0; i < 3; i++) {
      const ph = (now / 1500 + i / 3) % 1;
      text("Z", box.x + box.w - 4 + Math.round(ph * 8 + Math.sin(ph * 6) * 2), box.y - 2 - Math.round(ph * 18), "#ffffff");
    }
  }
  pet.box = pose.hidden ? null : box;
}
