/* Weather over the meadow: clear, cloudy, rain, thunderstorm, snow and fog, easing from one to the next.
   By default the game picks it (by the season and the time of day, the same for everyone on the same day and hour);
   in the settings it can follow the real weather where the player is (Open-Meteo, with the player's permission for
   their location), falling back to the game's own weather when that cannot be fetched.
   It greys and darkens the sky and brings grey clouds, wets the grass, piles snow on the land and the sign, lays fog
   low over the meadow, rains or snows over everything (the pet too), flashes lightning, leaves a rainbow when the rain
   stops in the daytime, blows the grass about, and the pet says something when it changes.
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
  wet: 0, depth: 0, bow: 0, bowT: 0, flash: 0, bolt: null, nextBolt: 0, said: "", sayAt: -1e9 };
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
function newDrop(top) { return { x: Math.random() * (W + 40) - 20, y: top ? -Math.random() * 40 : Math.random() * H, v: 230 + Math.random() * 90, len: 3 + (Math.random() * 3 | 0), gy: groundY() }; }
function newFlake(top) { return { x: Math.random() * W, y: top ? -Math.random() * 30 : Math.random() * H, v: 14 + Math.random() * 16, s: Math.random() < 0.25 ? 2 : 1, p: Math.random() * 6, gy: groundY(), rest: 0 }; }

function weatherUpdate(now, dt) {
  const s = Math.min(0.1, dt / 1000), w = weatherNow(), L = WX_LOOK[w.kind], day = darkAt(worldHour()) < 0.5;
  const before = WX.kind; WX.kind = w.kind; WX.src = w.src;
  // opening the game, it is already raining (or snowing, the snow lying): the weather is there from the first frame
  if (!WX.started) { WX.started = true; Object.assign(WX, L); WX.wet = L.rain ? 0.7 : 0; WX.depth = L.snow ? 0.8 : 0; return; }
  // ease every part towards the new weather over some seconds (rain and snow start a little after the clouds come)
  const ease = (k, rate) => { WX[k] += Math.max(-rate * s, Math.min(rate * s, L[k] - WX[k])); };
  ease("cover", 0.08); ease("fog", 0.06); ease("storm", 0.2);
  ease("rain", WX.cover > 0.6 || L.rain < WX.rain ? 0.12 : 0); ease("snow", WX.cover > 0.5 || L.snow < WX.snow ? 0.08 : 0);
  const windT = Math.max(L.wind, w.wind || 0); WX.wind += (windT - WX.wind) * Math.min(1, s * 0.3);
  // the ground gets wet in the rain and dries off; snow piles up and melts (faster in rain)
  WX.wet = Math.max(0, Math.min(1, WX.wet + (WX.rain > 0.05 ? WX.rain * s / 15 : -s / 90)));
  WX.depth = Math.max(0, Math.min(1, WX.depth + (WX.snow > 0.05 ? WX.snow * s / 40 : -s / (WX.rain > 0.1 ? 25 : 80))));
  // the rain stops in the daytime: a rainbow for a while
  if (WX.rain < 0.05 && wxPrev >= 0.05 && L.rain === 0 && L.snow === 0 && day && WX.wet > 0.3) WX.bowT = now;
  wxPrev = WX.rain;
  WX.bow = WX.bowT ? Math.max(0, Math.min(1, (now - WX.bowT) / 3000) * Math.min(1, (45000 - (now - WX.bowT)) / 8000)) : 0;
  if (WX.bowT && now - WX.bowT > 45000) WX.bowT = 0;
  // lightning now and then in a storm: a bolt and a flash, sometimes a second flicker
  WX.flash = Math.max(0, WX.flash - s * 4);
  if (WX.storm > 0.5 && now > WX.nextBolt) {
    if (WX.nextBolt) {
      const x = 20 + Math.random() * (W - 40), pts = [[x, 0]];
      let px = x, py = 0; while (py < horizon - 10) { py += 6 + Math.random() * 10; px += (Math.random() - 0.5) * 14; pts.push([px, py]); }
      WX.bolt = { pts, t: now }; WX.flash = 0.55;
      if (Math.random() < 0.5) setTimeout(() => { WX.flash = Math.max(WX.flash, 0.35); }, 160);
    }
    WX.nextBolt = now + 5000 + Math.random() * 9000;
  }
  if (WX.bolt && now - WX.bolt.t > 180) WX.bolt = null;
  // keep as many drops and flakes as the weather calls for
  const nd = Math.round(WX.rain * 150), nf = Math.round(WX.snow * 110);
  const fillD = nd - DROPS.length > 20, fillF = nf - FLAKES.length > 20;   // a lot at once (loading into rain): all over at once
  while (DROPS.length < nd) DROPS.push(newDrop(!fillD)); DROPS.length = Math.min(DROPS.length, nd);
  while (FLAKES.length < nf) FLAKES.push(newFlake(!fillF)); FLAKES.length = Math.min(FLAKES.length, nf);
  const blow = (typeof wind !== "undefined" ? wind : 1) * (20 + WX.wind * 70);
  for (const d of DROPS) {
    d.y += d.v * s; d.x -= blow * 0.6 * s;
    if (d.y >= d.gy) { if (SPLASH.length < 60) SPLASH.push({ x: d.x, y: d.gy, t: now }); Object.assign(d, newDrop(true)); }
    if (d.x < -20) d.x += W + 40;
  }
  for (const f of FLAKES) {
    if (f.rest) { if (now - f.rest > 1600) Object.assign(f, newFlake(true)); continue; }
    f.y += f.v * s; f.x += (Math.sin(now / 700 + f.p) * 8 - blow * 0.25) * s;
    if (f.x < -4) f.x += W + 8; if (f.x > W + 4) f.x -= W + 8;
    if (f.y >= f.gy) { f.y = f.gy; f.rest = now; }
  }
  for (const c of GREY) c.x += c.v * s * (1 + WX.wind * 3);
  for (let i = SPLASH.length - 1; i >= 0; i--) if (now - SPLASH[i].t > 120) SPLASH.splice(i, 1);
  // the pet says something when the weather turns (not at every little flicker, and not while studying hard)
  if (before !== WX.kind && now > 4000 && now - WX.sayAt > 20000) { WX.sayAt = now; WX.said = WX.kind; weatherSay(WX.kind); }
  if (WX.bowT && now - WX.bowT > 3500 && now - WX.bowT < 3600 && now - WX.sayAt > 5000) { WX.sayAt = now; weatherSay("rainbow"); }
}
const WX_SAY = {
  clear: ["날이 개었다!", "해님 나왔다~", "하늘 맑다!"],
  cloudy: ["구름이 많아졌네", "하늘이 꾸물꾸물…"],
  rain: ["비 온다…", "빗소리 들으면서 공부하기 좋다", "우산 없는데…"],
  storm: ["천둥이다!! 무서워…", "번쩍했어!", "으아 비 엄청 와"],
  snow: ["눈이다!!", "하얗게 쌓이겠다~", "손 시려…"],
  fog: ["안개 꼈네", "앞이 잘 안 보여…"],
  rainbow: ["무지개다!!", "우와 무지개!"],
};
function weatherSay(kind) {
  if (typeof say !== "function" || typeof S === "undefined" || !S.pet || (typeof G !== "undefined" && G.sleeping)) return;
  if (typeof bubbleUntil !== "undefined" && performance.now() < bubbleUntil) return;
  const l = WX_SAY[kind]; if (l) say(l[Math.random() * l.length | 0], 3000);
}

/* ---------- drawing ---------- */
// over the sky and its white clouds: overcast greys and darkens it (darker in a storm), and grey clouds gather; a
// rainbow after rain
let greyClouds = [], greyKey = "";
const GREY = Array.from({ length: 7 }, (_, i) => ({ tpl: i % 4, x: Math.random() * W * 1.4 - 30, y: 10 + Math.random() * 90, v: 2 + Math.random() * 2.5, k: i / 7 }));
function weatherSky(g, now, h) {
  const d = darkAt(h);
  if (WX.cover > 0.02) {
    const c = mixc(mixc(hex("#9aa3b4"), hex("#5c6479"), WX.storm * 0.8 + WX.rain * 0.2), hex("#2a3048"), d);
    g.fillStyle = css(c, WX.cover * (0.55 + WX.storm * 0.15)); g.fillRect(0, 0, W, horizon + 24);
  }
  if (WX.bow > 0.01 && d < 0.6) {                          // seven thin bands, low over the far hills
    const cx = W * 0.62, cy = horizon + 30, cols = ["#ff8a8a", "#ffb36b", "#ffe27a", "#9fe08c", "#86c9f0", "#8f9cf0", "#c39cf0"];
    cols.forEach((col, i) => {
      const r = 92 - i; g.fillStyle = css(hex(col), WX.bow * 0.42 * (1 - d));
      for (let x = -r; x <= r; x++) { const y = Math.round(cy - Math.sqrt(r * r - x * x)); if (y < horizon - 4) g.fillRect(Math.round(cx + x), y, 1, 1); }
    });
  }
  const key = Math.round(h * 4) + ":" + Math.round(WX.storm * 2);
  if (key !== greyKey && typeof renderCloud === "function") {
    greyKey = key;
    const base = mixc(hex(WX.storm > 0.5 ? "#9aa1b2" : "#c3c9d4"), hex("#3c4260"), d);
    greyClouds = CLOUD_SHAPES.slice(0, 4).map(sh => renderCloud(sh, base, mixc(base, hex("#000000"), 0.12), mixc(base, hex("#000000"), 0.2)));
  }
  for (const c of GREY) {
    if (c.k > WX.cover) continue;
    const im = greyClouds[c.tpl]; if (!im) continue;
    if (c.x > W + 4) { c.x = -im.width - Math.random() * 40; c.y = 10 + Math.random() * 90; }
    g.globalAlpha = Math.min(1, (WX.cover - c.k) * 4); g.drawImage(im, Math.round(c.x), Math.round(c.y)); g.globalAlpha = 1;
  }
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
// over everything (the pet too): rain, splashes, snow, lightning, a veil of fog
function weatherFront(g, now) {
  const d = darkAt(worldHour());
  if (WX.fog > 0.02) { g.fillStyle = css(mixc(hex("#e6ecf2"), hex("#4a5274"), d), WX.fog * 0.16); g.fillRect(0, 0, W, H); }
  if (DROPS.length) {
    const col = css(mixc(hex("#d8e8ff"), hex("#8a9ad0"), d), 0.55), sl = (typeof wind !== "undefined" ? wind : 1) * (20 + WX.wind * 70) * 0.6;
    g.fillStyle = col;
    for (const r of DROPS) { const dx = sl / r.v; for (let i = 0; i < r.len; i++) g.fillRect(Math.round(r.x + dx * i), Math.round(r.y - i), 1, 1); }
    g.fillStyle = css(mixc(hex("#eef5ff"), hex("#9aa8d8"), d), 0.7);
    for (const p of SPLASH) { const x = Math.round(p.x), y = Math.round(p.y); g.fillRect(x - 1, y - 1, 1, 1); g.fillRect(x + 1, y - 1, 1, 1); }
  }
  if (FLAKES.length) {
    const col = mixc(hex("#ffffff"), hex("#b8c0e8"), d * 0.7);
    for (const f of FLAKES) {
      const a = f.rest ? Math.max(0, 1 - (now - f.rest) / 1600) : 0.95; if (a <= 0) continue;
      g.fillStyle = css(col, a); g.fillRect(Math.round(f.x), Math.round(f.y), f.s, f.s);
    }
  }
  if (WX.bolt) {
    g.fillStyle = "#fff7c8"; const p = WX.bolt.pts;
    for (let i = 1; i < p.length; i++) {
      const [x0, y0] = p[i - 1], [x1, y1] = p[i], n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
      for (let k = 0; k <= n; k++) g.fillRect(Math.round(x0 + (x1 - x0) * k / n), Math.round(y0 + (y1 - y0) * k / n), 1, 1);
    }
  }
  if (WX.flash > 0.01) { g.fillStyle = `rgba(255,255,240,${(WX.flash * 0.6).toFixed(3)})`; g.fillRect(0, 0, W, H); }
}
// the weather's wind on the grass and flowers (scene.js), and in the gusts that carry 욱's licence
const weatherWind = () => 1 + WX.wind * 1.6;
