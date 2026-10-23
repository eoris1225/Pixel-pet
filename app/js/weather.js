/* Weather over the meadow: clear, cloudy, rain, thunderstorm, snow and fog, easing from one to the next.
   By default the game picks it (by the season and the time of day, the same for everyone on the same day and hour);
   in the settings it can follow the real weather where the player is (Open-Meteo, with the player's permission for
   their location), falling back to the game's own weather when that cannot be fetched.
   It greys and darkens the sky and brings grey clouds, wets the grass, piles snow on the land and the sign, lays fog
   low over the meadow, rains or snows over everything (the pet too), flashes lightning, leaves a rainbow when the rain
   stops in the daytime, and blows the grass about.
   Preview with ?weather=rain (clear, cloudy, rain, storm, snow, fog). */
"use strict";

const WX_KINDS = ["clear", "cloudy", "rain", "storm", "snow", "fog"];
const WX_NAME = { clear: "맑음", cloudy: "흐림", rain: "비", storm: "천둥번개", snow: "눈", fog: "안개" };
// what each kind of weather brings (each eases towards these): cloud cover, rain, snow, fog, lightning, wind
const WX_LOOK = {
  clear:  { cover: 0.05, rain: 0, snow: 0, fog: 0, storm: 0, wind: 0 },
  cloudy: { cover: 0.65, rain: 0, snow: 0, fog: 0, storm: 0, wind: 0.2 },
  rain:   { cover: 0.85, rain: 0.6, snow: 0, fog: 0.1, storm: 0, wind: 0.3 },
  storm:  { cover: 1, rain: 1, snow: 0, fog: 0.15, storm: 1, wind: 0.8 },
  snow:   { cover: 0.75, rain: 0, snow: 0.7, fog: 0.1, storm: 0, wind: 0.15 },
  fog:    { cover: 0.45, rain: 0, snow: 0, fog: 0.85, storm: 0, wind: 0 },
};
const WX = { kind: "clear", force: null, real: null, realAt: 0, realErr: "", cover: 0.05, rain: 0, snow: 0, fog: 0, storm: 0, wind: 0,
  wet: 0, depth: 0, bow: 0, bowT: 0, flash: 0, strike: null, far: null, nextBolt: 0, nextFar: 0, shake: 0 };
{ const q = new URLSearchParams(location.search).get("weather"); if (WX_KINDS.includes(q)) WX.force = q; }

/* ---------- which weather ---------- */
// the game's own weather: one pick per two hours of the in-game clock, from the season's odds, seeded by the date
const WX_SEASON = {   // [clear, cloudy, rain, storm, snow, fog]
  winter: [0.35, 0.28, 0.02, 0, 0.27, 0.08], spring: [0.45, 0.28, 0.18, 0.03, 0, 0.06],
  summer: [0.36, 0.22, 0.24, 0.15, 0, 0.03], autumn: [0.5, 0.28, 0.14, 0.02, 0, 0.06],
};
function gameDate() { return typeof T_START !== "undefined" ? new Date(T_START + (Date.now() - T_START) * T_SPEED) : new Date(); }
function gameWeather() {
  const d = gameDate(), m = d.getMonth() + 1, block = Math.floor(worldHour() / 2);
  const season = m === 12 || m <= 2 ? "winter" : m <= 5 ? "spring" : m <= 8 ? "summer" : "autumn";
  let s = (d.getFullYear() * 1000 + d.getMonth() * 40 + d.getDate()) * 13 + block * 7919;   // a small hash of the day and block
  s = (s ^ (s >>> 7)) * 2654435761 >>> 0; s = (s ^ (s >>> 13)) * 1597334677 >>> 0;
  let r = (s % 10000) / 10000;
  const odds = WX_SEASON[season];
  for (let i = 0; i < odds.length; i++) { if ((r -= odds[i]) < 0) return WX_KINDS[i]; }
  return "clear";
}
const realOn = () => typeof S !== "undefined" && S.weatherMode === "real";
// the real weather: WMO weather codes from Open-Meteo's current conditions
function wmoKind(code) {
  if (code >= 95) return "storm";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if (code === 45 || code === 48) return "fog";
  if (code >= 2) return "cloudy";
  return "clear";
}
let wxFetching = false;
function fetchRealWeather(force = false) {
  if (!realOn() || wxFetching || (!force && Date.now() - WX.realAt < 30 * 60000)) return;
  wxFetching = true;
  const fail = msg => { wxFetching = false; WX.real = null; WX.realErr = msg; WX.realAt = Date.now() - 25 * 60000; if (typeof onWeatherStatus === "function") onWeatherStatus(); };
  if (!navigator.geolocation) return fail("이 브라우저에서는 위치를 쓸 수 없어요");
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude: la, longitude: lo } = pos.coords;
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const to = setTimeout(() => ctl && ctl.abort(), 9000);
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${la.toFixed(2)}&longitude=${lo.toFixed(2)}&current=weather_code,wind_speed_10m`, ctl ? { signal: ctl.signal } : {})
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(j => {
        clearTimeout(to); wxFetching = false;
        const c = j && j.current; if (!c || typeof c.weather_code !== "number") return fail("날씨를 읽지 못했어요");
        WX.real = { kind: wmoKind(c.weather_code), wind: Math.min(1, (c.wind_speed_10m || 0) / 40) };
        WX.realAt = Date.now(); WX.realErr = ""; if (typeof onWeatherStatus === "function") onWeatherStatus();
      })
      .catch(() => { clearTimeout(to); fail("날씨 서버에 연결하지 못했어요"); });
  }, () => fail("위치 권한이 없어요"), { timeout: 10000, maximumAge: 30 * 60000 });
}
function weatherNow() {
  if (WX.force) return { kind: WX.force, src: "test" };
  if (realOn()) { fetchRealWeather(); if (WX.real) return { kind: WX.real.kind, src: "real", wind: WX.real.wind }; }
  return { kind: gameWeather(), src: "game" };
}

/* ---------- particles ---------- */
const DROPS = [], FLAKES = [], SPLASH = [];
let wxPrev = 0;
const groundY = () => horizon + 8 + Math.random() * (H - horizon - 8);
// a raindrop: near ones (z 1) longer, faster and clearer, far ones short, slow and faint
function newDrop(top) {
  const z = Math.random();
  return { x: Math.random() * (W + 40) - 20, y: top ? -Math.random() * 40 : Math.random() * H, z, v: 170 + z * 130 + Math.random() * 30, len: 2 + Math.round(z * 2), gy: groundY() };
}
function newFlake(top) { return { x: Math.random() * W, y: top ? -Math.random() * 30 : Math.random() * H, v: 14 + Math.random() * 16, s: Math.random() < 0.25 ? 2 : 1, p: Math.random() * 6, gy: groundY(), rest: 0 }; }

function weatherUpdate(now, dt) {
  const s = Math.min(0.1, dt / 1000), w = weatherNow(), L = WX_LOOK[w.kind], day = darkAt(worldHour()) < 0.5;
  WX.kind = w.kind; WX.src = w.src;
  // opening the game, it is already raining (or snowing, the snow lying): the weather is there from the first frame
  if (!WX.started) { WX.started = true; newPuddles(); Object.assign(WX, L); WX.wet = L.rain ? 0.7 : 0; WX.pud = L.rain ? 0.8 : 0; WX.depth = L.snow ? 0.8 : 0; return; }
  // ease every part towards the new weather over some seconds (rain and snow start a little after the clouds come)
  const ease = (k, rate) => { WX[k] += Math.max(-rate * s, Math.min(rate * s, L[k] - WX[k])); };
  ease("cover", 0.08); ease("fog", 0.06); ease("storm", 0.2);
  ease("rain", WX.cover > 0.6 || L.rain < WX.rain ? 0.12 : 0); ease("snow", WX.cover > 0.5 || L.snow < WX.snow ? 0.08 : 0);
  const windT = Math.max(L.wind, w.wind || 0); WX.wind += (windT - WX.wind) * Math.min(1, s * 0.3);
  // the ground gets wet in the rain and dries off; snow piles up and melts (faster in rain)
  WX.wet = Math.max(0, Math.min(1, WX.wet + (WX.rain > 0.05 ? WX.rain * s / 15 : -s / 90)));
  WX.depth = Math.max(0, Math.min(1, WX.depth + (WX.snow > 0.05 ? WX.snow * s / 40 : -s / (WX.rain > 0.1 ? 25 : 80))));
  // puddles fill in the rain and dry off over a few minutes
  if (WX.pud < 0.04) { if (WX.rain > 0.05 && !WX.pudNew) { newPuddles(); WX.pudNew = true; } else if (WX.rain <= 0.05) WX.pudNew = false; }   // a new rain, new puddles
  WX.pud = Math.max(0, Math.min(1, (WX.pud || 0) + (WX.rain > 0.05 ? WX.rain * s / 14 : -s / 200)));
  if (WX.rain > 0.05 && WX.pud > 0.15 && Math.random() < WX.rain * s * 9) PUDDLES.length && RIPPLES.push({ p: Math.random() * PUDDLES.length | 0, u: Math.random() * 2 - 1, v: Math.random() * 2 - 1, t: now });
  for (let i = RIPPLES.length - 1; i >= 0; i--) if (now - RIPPLES[i].t > 600) RIPPLES.splice(i, 1);
  // the rain stops in the daytime: a rainbow for a while
  if (WX.rain < 0.05 && wxPrev >= 0.05 && L.rain === 0 && L.snow === 0 && day && WX.wet > 0.3) WX.bowT = now;
  wxPrev = WX.rain;
  WX.bow = WX.bowT ? Math.max(0, Math.min(1, (now - WX.bowT) / 4000) * Math.min(1, (70000 - (now - WX.bowT)) / 10000)) : 0;
  if (WX.bowT && now - WX.bowT > 70000) WX.bowT = 0;
  // lightning in a storm, told mostly by the sky: the whole sky blazes up and the clouds light from within, flickering
  // two or three times as a real stroke does (now and then a bolt shows under a cloud), and a moment later the
  // thunder rolls and the meadow shakes. Between strikes, far-off flickers glow low behind the hills
  if (WX.storm > 0.5 && now > WX.nextBolt) {
    if (WX.nextBolt) startStrike(now);
    WX.nextBolt = now + 3500 + Math.random() * 6500;
  }
  if (WX.storm > 0.3 && now > WX.nextFar) {
    if (WX.nextFar) WX.far = { t: now, x: Math.random() * W, k: 0.5 + Math.random() * 0.5 };
    WX.nextFar = now + 1500 + Math.random() * 3500;
  }
  const st = WX.strike;
  WX.flash = st ? st.pulses.reduce((a, [dt, amp]) => now - st.t >= dt ? Math.max(a, amp * Math.exp(-(now - st.t - dt) / 90)) : a, 0) : 0;
  if (st && now - st.t > 1200 && now > st.rumble + st.roll) WX.strike = null;
  // the thunder: a rumble that shakes the meadow, strongest at first and dying away
  const r = st ? (now - st.rumble) / st.roll : 1;
  WX.shake = r >= 0 && r < 1 ? st.loud * (1 - r) * (1 - r) : 0;
  shakeStage(now);
  // keep as many drops and flakes as the weather calls for
  const nd = Math.round(WX.rain * 80), nf = Math.round(WX.snow * 110);
  const fillD = nd - DROPS.length > 20, fillF = nf - FLAKES.length > 20;   // a lot at once (loading into rain): all over at once
  while (DROPS.length < nd) DROPS.push(newDrop(!fillD)); DROPS.length = Math.min(DROPS.length, nd);
  while (FLAKES.length < nf) FLAKES.push(newFlake(!fillF)); FLAKES.length = Math.min(FLAKES.length, nf);
  const blow = (typeof wind !== "undefined" ? wind : 1) * (20 + WX.wind * 70);
  for (const d of DROPS) {
    d.y += d.v * s; d.x -= blow * 0.6 * s;
    if (d.y >= d.gy) { if (d.z > 0.55 && SPLASH.length < 24) SPLASH.push({ x: d.x, y: d.gy, t: now }); Object.assign(d, newDrop(true)); }
    if (d.x < -20) d.x += W + 40;
  }
  for (const f of FLAKES) {
    if (f.rest) { if (now - f.rest > 1600) Object.assign(f, newFlake(true)); continue; }
    f.y += f.v * s; f.x += (Math.sin(now / 700 + f.p) * 8 - blow * 0.25) * s;
    if (f.x < -4) f.x += W + 8; if (f.x > W + 4) f.x -= W + 8;
    if (f.y >= f.gy) { f.y = f.gy; f.rest = now; }
  }
  for (let i = SPLASH.length - 1; i >= 0; i--) if (now - SPLASH[i].t > 120) SPLASH.splice(i, 1);
}
function startStrike(now) {
  const near = Math.random() < 0.6, main = near ? 1 : 0.6;   // a near strike blazes and cracks; a far one glows and grumbles
  const pulses = [[0, main], [60 + Math.random() * 40, 0.25], [150 + Math.random() * 120, main * (0.7 + Math.random() * 0.3)]];
  if (Math.random() < 0.6) pulses.push([380 + Math.random() * 200, main * 0.5]);
  const x = 20 + Math.random() * (W - 40);
  WX.strike = { t: now, x, pulses, bolt: near && Math.random() < 0.6 ? boltPath(x) : null,
    rumble: now + (near ? 250 : 900) + Math.random() * 500, roll: near ? 1400 : 2200, loud: near ? 2 : 1 };
}
// a jagged bolt from under the cloud nearest above x down to the far hills, with a branch
function boltPath(x) {
  let top = 20;
  if (typeof clouds !== "undefined") for (const c of clouds) if (c.kind !== "cirrus" && x > c.x && x < c.x + c.shape.w) top = Math.max(top, c.y + c.shape.h - 3);
  const pts = [[x, top]]; let px = x, py = top;
  while (py < horizon - 6) { py += 4 + Math.random() * 8; px += (Math.random() - 0.5) * 12; pts.push([px, Math.min(py, horizon - 6)]); }
  const i = 1 + (Math.random() * (pts.length - 2) | 0), br = [pts[i]]; let bx = pts[i][0], by = pts[i][1];
  for (let k = 0; k < 3; k++) { by += 4 + Math.random() * 6; bx += (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 5); br.push([bx, by]); }
  return [pts, br];
}
// the meadow shakes by whole pixels while the thunder rolls: each layer is shifted inside its own canvas (the
// strip left at the edge keeps what was there), so nothing outside the picture ever shows
let shakeAt = 0;
function shakeStage(now) {
  if (WX.shake > 0.05) { if (now - shakeAt > 50) { shakeAt = now; WX.sx = Math.round(WX.shake * (Math.random() < 0.5 ? -1 : 1)); WX.sy = Math.random() < WX.shake * 0.3 ? 1 : 0; } }
  else WX.sx = WX.sy = 0;
}
function shakeLayer(g, cv, clear) {
  const dx = WX.sx || 0, dy = WX.sy || 0; if (!dx && !dy) return;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); if (clear) g.globalCompositeOperation = "copy";
  g.drawImage(cv, dx, dy); g.restore();
}

/* ---------- drawing ---------- */
// over the sky, behind its clouds (which scene.js greys and gathers as it clouds over): overcast greys and darkens it
// (darker in a storm); a rainbow after rain
// the grey of an overcast sky and how thick it lies (the clouds take it too, scene.js cloudPal)
function weatherVeil(h) {
  const c = mixc(mixc(hex("#a3aab8"), hex("#5c6479"), WX.storm * 0.8 + WX.rain * 0.3), hex("#2a3048"), darkAt(h));
  return { c, a: WX.cover <= 0.08 ? 0 : WX.cover * (0.42 + WX.storm * 0.25) };
}
const FLASH = [232, 228, 255];   // lightning's light: white with a little violet
function weatherSky(g, now, h) {
  const d = darkAt(h), v = weatherVeil(h);
  if (v.a > 0) { g.fillStyle = css(v.c, v.a); g.fillRect(0, 0, W, horizon + 24); }
  if (WX.far) {                                            // a far flicker: a glow low over the hills, there and gone
    const t = now - WX.far.t, a = WX.far.k * (t < 70 ? 1 : t < 140 ? 0.3 : t < 220 ? 0.7 : Math.exp(-(t - 220) / 120)) * WX.storm;
    if (t > 1200) WX.far = null;
    else for (let y = horizon - 40; y < horizon + 2; y += 3) for (let x = Math.round(WX.far.x - 60); x < WX.far.x + 60; x += 3) {
      const q = (1 - Math.abs(x - WX.far.x) / 60) * ((y - horizon + 40) / 42);
      if (q > 0) { g.fillStyle = css(FLASH, a * q * 0.35); g.fillRect(x, y, 3, 3); }
    }
  }
  const st = WX.strike, f = WX.flash;
  if (st && f > 0.01) {                                    // the sky blazes up, brightest round the strike
    g.fillStyle = css(FLASH, f * 0.5); g.fillRect(0, 0, W, horizon + 24);
    for (let x = 0; x < W; x += 4) { const q = Math.exp(-(((x + 2 - st.x) / 55) ** 2)); if (q > 0.05) { g.fillStyle = css(FLASH, f * 0.4 * q); g.fillRect(x, 0, 4, horizon + 24); } }
    if (st.bolt && now - st.t < 520 && f > 0.15) {        // the bolt, under the clouds (they are drawn over it)
      for (const [line, wgt] of [[st.bolt[0], 1], [st.bolt[1], 0.6]]) for (let i = 1; i < line.length; i++) {
        const [x0, y0] = line[i - 1], [x1, y1] = line[i], n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
        for (let k = 0; k <= n; k++) {
          const x = Math.round(x0 + (x1 - x0) * k / n), y = Math.round(y0 + (y1 - y0) * k / n);
          g.fillStyle = css(FLASH, Math.min(1, f) * 0.45 * wgt); g.fillRect(x - 1, y, 3, 1);
          g.fillStyle = css([255, 255, 245], Math.min(1, f * 1.4) * wgt); g.fillRect(x, y, 1, 1);
        }
      }
    }
  }
  if (WX.bow > 0.01 && d < 0.6) { g.globalAlpha = WX.bow * (1 - d); g.drawImage(rainbowImage(), 0, 0); g.globalAlpha = 1; }
}
// the rainbow after rain, low over the far hills: seven soft bands two pixels wide with checkered seams, brightest
// up in its arch and fading into the hills at its feet, the sky a little lighter inside it, and a faint second bow
// outside with its colours the other way round
const BOW = ["#ff8f8f", "#ffb877", "#ffe48a", "#a6e39a", "#8fd0f2", "#9aa6f0", "#c6a3f0"].map(hex);
let bowCv = null, bowFor = -1;
function rainbowImage() {
  if (bowCv && bowFor === horizon) return bowCv;
  bowFor = horizon; bowCv = document.createElement("canvas"); bowCv.width = W; bowCv.height = horizon;
  const g = bowCv.getContext("2d"), img = g.createImageData(W, horizon), cx = W * 0.62, cy = horizon + 34, R0 = 100, R1 = 121;
  for (let y = 0; y < horizon - 2; y++) for (let x = 0; x < W; x++) {
    const dd = Math.hypot(x + 0.5 - cx, y + 0.5 - cy), up = smooth(0, 46, horizon - 2 - y), i = (y * W + x) * 4;
    let c = null, a = 0;
    const k = (R0 - dd) / 2;                                     // the main bow
    if (k >= 0 && k < 7) {
      let b = Math.floor(k); const f = k - b;
      if (f > 0.75 && b < 6 && (x + y) % 2) b++;                // a checkered seam into the next band
      c = BOW[b]; a = 0.6 * up * (b === 6 ? 0.75 : 1);
    } else if (dd < R0 && dd > R0 - 34) { c = [255, 255, 245]; a = 0.07 * up * (1 - (R0 - dd) / 34); }   // lighter inside
    const k2 = (R1 - dd) / 1.4;                                  // the faint second bow, colours reversed
    if (k2 >= 0 && k2 < 7) { c = BOW[6 - Math.floor(k2)]; a = 0.16 * up; }
    if (c && a > 0.01) { img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = Math.round(a * 255); }
  }
  g.putImageData(img, 0, 0);
  return bowCv;
}
// on the land, under the grass and the sign: the wet grass darkens, snow lies on the land (the tufts poke through)
// (the land's own shape in one colour: snow white, blue at night; and a shade for grey days and wet grass)
const snowCv = document.createElement("canvas"), shadeCv = document.createElement("canvas"); let snowKey = "";
function landIn(cv, col) {
  cv.width = W; cv.height = H; const sg = cv.getContext("2d");
  sg.clearRect(0, 0, W, H); sg.drawImage(landCv, 0, 0);
  sg.globalCompositeOperation = "source-in"; sg.fillStyle = col; sg.fillRect(0, 0, W, H); sg.globalCompositeOperation = "source-over";
}
function weatherLand(g, now, h) {
  if (typeof landCv === "undefined") return;
  const d = darkAt(h), k = Math.round(h * 4) + ":" + H;
  if (k !== snowKey) { snowKey = k; landIn(snowCv, css(mixc(hex("#f4f8ff"), hex("#7c86b8"), d * 0.8))); landIn(shadeCv, "#1e2c48"); }
  const shade = WX.cover * 0.12 + WX.storm * 0.1 + WX.wet * 0.12;   // a grey day dims the meadow, wet grass is darker
  if (shade > 0.01) { g.globalAlpha = shade; g.drawImage(shadeCv, 0, 0); g.globalAlpha = 1; }
  if (WX.depth > 0.02) { g.globalAlpha = Math.min(0.8, WX.depth * 0.85); g.drawImage(snowCv, 0, 0); g.globalAlpha = 1; }
  if (WX.pud > 0.04 && WX.depth < 0.15 && typeof mainSeason === "function" && mainSeason() !== "winter") drawPuddles(g, now, h);
}
// puddles on the meadow after rain. Each rain lays out new ones (newPuddles): a few, here and there, bigger near and
// smaller and flatter far off, each a main oval with a couple of lobes so no two are alike. They grow as they fill and
// shrink as they dry, and each is a mirror: the sky over the horizon turned upside down (clouds, the rainbow, the sun),
// and her too, upside down under her feet when she stands by one; rings spread on them while it rains.
// [x, rows below the horizon, width, lobes [dx, dy, rx, ry], [left, right] reach from x]
const PUDDLES = [], RIPPLES = [];
function newPuddles() {
  PUDDLES.length = 0; RIPPLES.length = 0;
  const n = 3 + (Math.random() * 3 | 0), signDy = FEET - 4 - horizon;
  for (let tries = 0; tries < 80 && PUDDLES.length < n; tries++) {
    const dy = Math.round(10 + Math.random() * 46), w = Math.round((10 + dy * 0.45) * (0.6 + Math.random() * 0.7));
    const cx = Math.round(w / 2 + 3 + Math.random() * (W - w - 6));
    if (Math.abs(cx - SIGN_X) < w / 2 + 8 && Math.abs(dy - signDy) < 8) continue;          // not round the sign's post
    if (PUDDLES.some(([x2, dy2, w2]) => Math.abs(dy - dy2) < 7 + (w + w2) * 0.06 && Math.abs(cx - x2) < (w + w2) / 2 + 4)) continue;
    const ry0 = Math.max(1.2, w * (0.12 + dy * 0.0015)), lobes = [[0, 0, w / 2, ry0]];
    for (let k = 1 + (Math.random() * 3 | 0); k > 0; k--)
      lobes.push([(Math.random() - 0.5) * w * 0.7, (Math.random() - 0.5) * ry0 * 0.9, w * (0.18 + Math.random() * 0.22), ry0 * (0.55 + Math.random() * 0.5)]);
    PUDDLES.push([cx, dy, w, lobes, [Math.min(...lobes.map(l => l[0] - l[2])), Math.max(...lobes.map(l => l[0] + l[2]))]]);
  }
}
const pudK = () => Math.sqrt(smooth(0.04, 0.6, WX.pud));
function inThis(p, x, y, q) {
  const [cx, dy, , lobes] = p, cy = horizon + dy;
  return lobes.some(([ox, oy, rx, ry]) => ((x + 0.5 - cx - ox * q) / (rx * q)) ** 2 + ((y + 0.5 - cy - oy * q) / (ry * q)) ** 2 < 1);
}
// whether a point of the meadow is under water now (no grass tufts or flowers stand in a puddle)
function inPuddle(x, y) {
  if (!(WX.pud > 0.04) || WX.depth >= 0.15) return false;
  const q = pudK();
  return PUDDLES.some(p => inThis(p, x, y, q) || inThis(p, x, y + 1, q) || inThis(p, x + 1, y, q) || inThis(p, x - 1, y, q));
}
// how much of the water a pixel has round it (0..1, cached while the puddle keeps its size): the edges fade out
function pudMask(p, q) {
  const key = Math.round(q * 40) * 1000 + horizon;
  if (p.mk && p.mk.key === key) return p.mk;
  const [cx, dy, , lobes, [l0, l1]] = p, cy = horizon + dy, ryM = Math.max(...lobes.map(l => Math.abs(l[1]) + l[3])) * q;
  const x0 = Math.floor(cx + l0 * q) - 4, x1 = Math.ceil(cx + l1 * q) + 4, y0 = Math.floor(cy - ryM) - 2, y1 = Math.ceil(cy + ryM) + 2;
  const w = x1 - x0 + 1, hh = y1 - y0 + 1, inn = new Uint8Array(w * hh), cov = new Float32Array(w * hh);
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) inn[y * w + x] = inThis(p, x0 + x, y0 + y, q) ? 1 : 0;
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {       // a flat window (puddles lie flat): 7 wide, 3 high
    let n = 0, t = 0;
    for (let v = -1; v <= 1; v++) for (let u = -3; u <= 3; u++) { const yy = y + v, xx = x + u; t++; if (yy >= 0 && yy < hh && xx >= 0 && xx < w) n += inn[yy * w + xx]; }
    cov[y * w + x] = n / t;
  }
  return (p.mk = { key, x0, y0, w, hh, inn, cov });
}
function drawPuddles(g, now, h) {
  const q = pudK(), sky = g.getImageData(0, 0, W, horizon).data;
  const feetRow = typeof pet !== "undefined" ? Math.round(FEET - 1 - pet.z) : -99, px0 = typeof pet !== "undefined" ? Math.round(pet.x) - 20 : 0;
  let me = null;
  try { if (typeof fg !== "undefined" && feetRow > 0) me = fg.getContext("2d").getImageData(px0, feetRow - 40, 40, 40).data; } catch (e) {}
  const rim = typeof landP !== "undefined" && landP ? litc(landP.dark[0], h) : [70, 90, 70], tint = mixc(hex("#8fb0cc"), hex("#1e2848"), darkAt(h) * 0.7);
  PUDDLES.forEach((p, pi) => {
    const [cx, dy, w, lobes] = p, cy = horizon + dy;
    if (w * q < 3) return;
    const M = pudMask(p, q), ryM = Math.max(...lobes.map(l => Math.abs(l[1]) + l[3])) * q;
    const mine = me && cy - ryM <= feetRow + 3 && cy + ryM >= feetRow - 1;   // she shows only in a puddle she stands at
    for (let yy = 0; yy < M.hh; yy++) for (let xx = 0; xx < M.w; xx++) {
      const x = M.x0 + xx, y = M.y0 + yy, c0 = M.cov[yy * M.w + xx];
      if (x < 0 || x >= W || c0 <= 0.02) continue;
      const inside = M.inn[yy * M.w + xx];
      if (!inside) {                                             // the wet ground round it, darker, fading away
        g.fillStyle = css(rim, Math.min(0.22, c0 * 0.5)); g.fillRect(x, y, 1, 1); continue;
      }
      const sy = Math.max(0, Math.min(horizon - 1, Math.round(horizon - 3 - (y - horizon) * 0.9)));
      let j = (sy * W + x) * 4, c = [sky[j], sky[j + 1], sky[j + 2]];
      if (mine && y > feetRow && Math.abs(x - pet.x) < 20) {   // her reflection, upside down below her feet
        const my = 2 * feetRow - y - (feetRow - 40), mx = x - px0;
        if (my >= 0 && my < 40) { const m = (my * 40 + mx) * 4; if (me[m + 3] > 200) c = mixc([me[m], me[m + 1], me[m + 2]], tint, 0.25); }
      }
      let col = mixc(c, tint, 0.28);
      if (yy > 0 && !M.inn[(yy - 1) * M.w + xx] && c0 > 0.5) col = mixc(col, [255, 255, 255], 0.12);   // the far bank's light on the water
      // the water thins out to its edge: full in the middle, fading in steps over the last pixels
      const a = Math.min(1, Math.max(0.25, (c0 - 0.3) / 0.45));
      g.fillStyle = css(softc(col), Math.round(a * 4) / 4); g.fillRect(x, y, 1, 1);
    }
    for (const r of RIPPLES) {                                   // rings spreading where drops fall
      if (r.p !== pi) continue;
      const t = (now - r.t) / 600, rr = 1 + t * 4, ox = cx + r.u * w * q * 0.3, oy = cy + r.v * lobes[0][3] * q * 0.5;
      g.fillStyle = css([235, 244, 255], 0.5 * (1 - t));
      for (let a = 0; a < 12; a++) { const x = Math.round(ox + Math.cos(a / 12 * Math.PI * 2) * rr), y = Math.round(oy + Math.sin(a / 12 * Math.PI * 2) * rr * 0.35);
        if (inThis(p, x, y, q * 0.85)) g.fillRect(x, y, 1, 1); }
    }
  });
}
// fog lying low over the meadow (in front of the sign's post, under its board: it stays readable)
function weatherFog(g, now, h) {
  const d = darkAt(h);
  if (WX.fog > 0.02) {
    const c = mixc(hex("#e6ecf2"), hex("#4a5274"), d);
    for (let y = horizon - 40; y < H; y += 2) { const a = WX.fog * 0.5 * Math.min(1, (y - horizon + 40) / 60); g.fillStyle = css(c, a); g.fillRect(0, y, W, 2); }
  }
}
// a cap of snow on top of the sign board (drawn again with the sign over a pet behind it)
function weatherCap(g, h) {
  const cap = Math.round(WX.depth * 2.4); if (!cap) return;
  const by = FEET - 4 - 27, d = darkAt(h);
  g.fillStyle = css(mixc(hex("#ffffff"), hex("#8d96c4"), d * 0.8)); g.fillRect(SIGN_X - 13, by - cap, 27, cap); g.fillRect(SIGN_X - 12, by - cap - 1, 25, 1);
}
// over everything (the pet too): rain, splashes, snow, the lightning's light, a veil of fog
function weatherFront(g, now) {
  const d = darkAt(worldHour());
  if (WX.fog > 0.02) { g.fillStyle = css(mixc(hex("#e6ecf2"), hex("#4a5274"), d), WX.fog * 0.16); g.fillRect(0, 0, W, H); }
  if (DROPS.length) {
    // soft and thin: a pale streak, fainter the farther off (two depths), its head a touch brighter; little splashes
    const base = mixc(hex("#dfeaf8"), hex("#8a9ad0"), d), sl = (typeof wind !== "undefined" ? wind : 1) * (20 + WX.wind * 70) * 0.6;
    for (const [lo, hi, a] of [[0, 0.55, 0.16], [0.55, 1.01, 0.3]]) {
      g.fillStyle = css(base, a);
      for (const r of DROPS) { if (r.z < lo || r.z >= hi) continue; const dx = sl / r.v; for (let i = 1; i < r.len; i++) g.fillRect(Math.round(r.x + dx * i), Math.round(r.y - i), 1, 1); }
      g.fillStyle = css(base, a * 1.5);
      for (const r of DROPS) if (r.z >= lo && r.z < hi) g.fillRect(Math.round(r.x), Math.round(r.y), 1, 1);
    }
    g.fillStyle = css(mixc(hex("#eef5ff"), hex("#9aa8d8"), d), 0.35);
    for (const p of SPLASH) { const x = Math.round(p.x), y = Math.round(p.y); g.fillRect(x - 1, y - 1, 1, 1); g.fillRect(x + 1, y - 1, 1, 1); }
  }
  if (FLAKES.length) {
    const col = mixc(hex("#ffffff"), hex("#b8c0e8"), d * 0.7);
    for (const f of FLAKES) {
      const a = f.rest ? Math.max(0, 1 - (now - f.rest) / 1600) : 0.95; if (a <= 0) continue;
      g.fillStyle = css(col, a); g.fillRect(Math.round(f.x), Math.round(f.y), f.s, f.s);
    }
  }
  if (WX.flash > 0.01) { g.fillStyle = css(FLASH, WX.flash * 0.22); g.fillRect(0, 0, W, H); }   // the meadow (and she) lit a moment
}
// the weather's wind on the grass and flowers (scene.js), and in the gusts that carry 욱's licence
const weatherWind = () => 1 + WX.wind * 1.6;
