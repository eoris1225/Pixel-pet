/* The study app around the pet: character choice, study timer (start / rest / end), levels and items,
   to-do list, statistics, settings, the first-time tutorial. Everything is saved in this browser (localStorage).
   All screens live on the same 180x320 pixel grid as the game; #app is scaled up by a whole number. */
"use strict";

const $ = s => document.querySelector(s);
const appEl = $("#app"), stage = $("#stage"), frameEl = $("#frame");
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- saved state ---------- */
const KEY = window.PP_TEST ? "pixelpet.test.v1" : "pixelpet.study.v1";   // the item test page keeps its own save
function freshState() {
  return { v: 1, pet: null, chars: {}, setup: null, tutorialDone: false,
    subjects: DEFAULT_SUBJECTS.map(([name, color], i) => ({ id: "s" + i, name, color })),
    todos: {}, sessions: [], timer: null, sideOpen: true };
}
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return Object.assign(freshState(), s); } catch (e) {}
  return freshState();
}
let S = load();
let wiping = false;                                       // set while resetting, so the page-hide save cannot write the old data back
function save() { if (wiping) return; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
function charState(id) { return S.chars[id] || (S.chars[id] = { exp: 0, equip: {}, shownLv: 1 }); }
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ---------- time helpers ---------- */
const pad = n => String(n).padStart(2, "0");
const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayKey = () => dkey(new Date());
const parseKey = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
function fmtDur(ms) {
  const m = Math.floor(ms / 60000), h = Math.floor(m / 60);
  return h ? `${h}시간${m % 60 ? " " + (m % 60) + "분" : ""}` : `${m}분`;
}
function fmtTimer(ms) {
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60;
  return h ? `${h}:${pad(m)}` : `${pad(m)}:${pad(s % 60)}`;
}
const fmtHM = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/* ---------- levels: 1 per hour, 1 per 50 minutes in the burning time ---------- */
const isBurning = ms => { const h = new Date(ms).getHours(); return h >= LEVEL.burnFrom && h < LEVEL.burnTo; };
function nextBoundary(t) {
  const a = new Date(t), b = new Date(t);
  a.setHours(LEVEL.burnFrom, 0, 0, 0); b.setHours(LEVEL.burnTo, 0, 0, 0);
  return Math.min(...[a.getTime(), b.getTime(), a.getTime() + 86400000].filter(x => x > t));
}
function expBetween(a, b) {                 // in levels
  let e = 0, t = a;
  while (t < b) {
    const end = Math.min(b, nextBoundary(t));
    e += (end - t) / ((isBurning(t) ? LEVEL.burnMin : LEVEL.normalMin) * 60000);
    t = end;
  }
  return e;
}
const MAX_EXP = LEVEL.max - 1;
const lvOf = e => Math.min(LEVEL.max, 1 + Math.floor(e + 1e-9));
const segEnd = (t, s) => s.b ?? t.endAt ?? Date.now();
function sessionSums(t) {
  let study = 0, rest = 0, exp = 0, burn = false;
  for (const s of t.segs) {
    const b = segEnd(t, s);
    if (s.k === "s") { study += b - s.a; exp += expBetween(s.a, b); if (isBurning(s.a) || isBurning(b - 1)) burn = true; }
    else rest += b - s.a;
  }
  return { study, rest, exp, burn };
}
function curExp(id = S.pet) {
  let e = charState(id).exp;
  if (S.timer && S.timer.pet === id) e += sessionSums(S.timer).exp;
  return Math.min(MAX_EXP, e);
}
const timerState = () => !S.timer ? "idle" : S.timer.segs[S.timer.segs.length - 1].k === "s" ? "run" : "rest";
function equipOf(id) {
  const lv = lvOf(curExp(id)), cs = charState(id), out = {};
  for (const [need, item] of ITEM_LIST[id]) out[item] = lv >= need && !!cs.equip[item];
  return out;
}

/* ---------- one resolution for everything: 180x320, scaled by a whole number when the screen allows ---------- */
H = 320; FEET = 272; PEEK_BOT = 282; TOP_Y = 30;      // close-ups rise from just above the button plaque
fg.width = W; fg.height = H;
sceneResize();
let K = 2;
function layout() {
  const vw = innerWidth, vh = innerHeight;
  const s = Math.min((vw - 8) / W, (vh - 22) / H);
  K = s >= 2 ? Math.floor(s) : Math.max(0.5, s);
  frameEl.style.width = W * K + "px"; frameEl.style.height = H * K + "px";
  frameEl.style.left = Math.round((vw - W * K) / 2) + "px"; frameEl.style.top = Math.round((vh - H * K - 10) / 2) + "px";
  appEl.style.transform = `scale(${K})`;
}
// a phone keyboard shrinks the window: keep the frame's size and only slide it up so the field stays in view
let lastW = innerWidth;
const editing = () => { const a = document.activeElement; return !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA"); };
function keepFieldVisible() {
  const a = document.activeElement; if (!a) return;
  const vh = window.visualViewport ? visualViewport.height : innerHeight, r = a.getBoundingClientRect();
  const over = r.bottom + 12 - vh;
  if (over > 0) frameEl.style.top = Math.round(parseFloat(frameEl.style.top) - over) + "px";
}
function onResize() {
  if (editing() && innerWidth === lastW) { keepFieldVisible(); return; }
  lastW = innerWidth; layout();
}
addEventListener("resize", onResize);
if (window.visualViewport) visualViewport.addEventListener("resize", onResize);
addEventListener("focusout", () => setTimeout(() => { if (!editing()) layout(); }, 120));

/* ---------- pixel icons ---------- */
const ICONS = {
  "tab-stats": ["...KKKKK...", "..KWWWWWK..", ".KWWWKWWWK.", "KWWWWKWWWWK", "KWWWWKWWWWK", "KWWWWKKKWWK", "KWWWWWWWWWK", ".KWWWWWWWK.", "..KWWWWWK..", "...KKKKK..."],
  "tab-todo": [".K..K..K...", "KKKKKKKKKK.", "KRRRRRRRRK.", "KKKKKKKKKK.", "KWWWWWWWWK.", "KWKWKWKWWK.", "KWWWWWWWWK.", "KWKWKWKWWK.", "KWWWWWWWWK.", "KKKKKKKKKK."],
  "tab-settings": ["....KKK....", ".KK.KGK.KK.", ".KGKKGKKGK.", "..KGGGGGK..", "KKKGGKGGKKK", "KGGGK.KGGGK", "KKKGGKGGKKK", "..KGGGGGK..", ".KGKKGKKGK.", ".KK.KGK.KK.", "....KKK...."],
  open: ["..K", ".K.", "K..", ".K.", "..K"], closed: ["K..", ".K.", "..K", ".K.", "K.."],
  back: ["...K", "..K.", ".K..", "K...", ".K..", "..K.", "...K"],
  next: ["K...", ".K..", "..K.", "...K", "..K.", ".K..", "K..."],
  x: ["K...K", ".K.K.", "..K..", ".K.K.", "K...K"],
  plus: ["..K..", "..K..", "KKKKK", "..K..", "..K.."],
  grip: ["KKKKK", ".....", "KKKKK", ".....", "KKKKK"],
  play: ["K......", "KKK....", "KKKKK..", "KKKKKKK", "KKKKK..", "KKK....", "K......"],
  pause: ["KK.KK", "KK.KK", "KK.KK", "KK.KK", "KK.KK", "KK.KK", "KK.KK"],
  stop: ["KKKKKKK", "KKKKKKK", "KKKKKKK", "KKKKKKK", "KKKKKKK", "KKKKKKK", "KKKKKKK"],
  play5: ["K....", "KKK..", "KKKKK", "KKK..", "K...."],
  pause5: ["KK.KK", "KK.KK", "KK.KK", "KK.KK", "KK.KK"],
  stop5: ["KKKKK", "KKKKK", "KKKKK", "KKKKK", "KKKKK"],
  flame: ["..O..", ".OO..", ".OYO.", "OYYO.", "OYWYO", "OYWYO", ".OOO."],
};
const IPAL_UI = { K: OUT, W: "#fffdf6", R: "#ff9db4", G: "#c9d1e0", O: "#ff7a4d", Y: "#ffd25e" };
function paintIcon(canvas, name) {
  const rows = ICONS[name]; if (!rows) return;
  const w = Math.max(...rows.map(r => r.length));
  if (!canvas.dataset.fixed) { canvas.width = w; canvas.height = rows.length; canvas.style.width = w + "px"; canvas.style.height = rows.length + "px"; }
  const g = canvas.getContext("2d"); g.clearRect(0, 0, canvas.width, canvas.height);
  const img = gridToCanvas(rows.map(r => r.padEnd(w, ".")), IPAL_UI);
  g.drawImage(img, (canvas.width - img.width) >> 1, (canvas.height - img.height) >> 1);
}
const paintIcons = root => root.querySelectorAll("canvas[data-icon]").forEach(c => paintIcon(c, c.dataset.icon));
const icon = (name, cls = "") => `<canvas data-icon="${name}" class="${cls}"></canvas>`;
// rich text for explanations: {start} {rest} {end} become the real keys in miniature, {stats} {todo} {settings} the tab icons
const KEYS = { start: ["mint", "play5", "시작"], rest: ["lilac", "pause5", "휴식"], end: ["peach", "stop5", "끝"] };
const NUM_COLORS = ["#ffb3c7", "#9fd3f5", "#ffd96b", "#b6ecae", "#d9cdff"];
function rich(textStr) {
  return esc(fixJosa(textStr)).replace(/\{(\w+)\}(\S*)(?: (\S+))?/g, (m, k, tail, word) => {
    // a key or icon stays on one line with the word that belongs to it ("[시작]을", "[설정] 설정의")
    const keep = s => `<span style="white-space:nowrap">${s}${tail}${word && !KEYS[k] ? " " + word : ""}</span>${word && KEYS[k] ? " " + word : ""}`;
    if (KEYS[k]) return keep(`<span class="kbd pxb ${KEYS[k][0]}">${icon(KEYS[k][1])}${KEYS[k][2]}</span>`);
    if (["stats", "todo", "settings"].includes(k)) return keep(`<span class="tabi pxb soft"><canvas data-icon="tab-${k}"></canvas></span>`);
    return m;
  });
}
const numBadge = n => `<span class="nb f-num s" style="--face:${NUM_COLORS[(n - 1) % NUM_COLORS.length]}">${n}</span>`;
for (const id of ["tab-stats", "tab-todo", "tab-settings"]) { const c = $("#" + id + " canvas"); c.dataset.fixed = 1; paintIcon(c, id); }
paintIcons(document);
paintIcon($("#hud-burn"), "flame");
// the paper and panels of the UI take a tint for each friend (style.css; the accent, keys and ink stay as they are):
// 치카 lavender (c), 하와 sky blue (b), 욱 cream (a). ?ui=a/b/c (or the test page) holds one tint for every friend
const PET_UI = { mochi: "c", sora: "b", nori: "a" };
let uiPick = new URLSearchParams(location.search).get("ui");
const applyUi = () => setUiLook(uiPick || PET_UI[appEl.dataset.pet] || "a");
function setUiLook(k) {
  if (k && k !== "a") document.documentElement.dataset.ui = k; else delete document.documentElement.dataset.ui;
  const c = document.createElement("canvas"); c.width = 6; c.height = 6; const g = c.getContext("2d");   // paper with a faint pixel dot pattern for the screens
  g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--dot").trim() || "#f7e9c9"; g.fillRect(0, 0, 1, 1); g.fillRect(3, 3, 1, 1);
  appEl.style.setProperty("--dots", `url(${c.toDataURL()})`);
}
applyUi();
// pixel patterns for the heads and windows: light diagonal stripes, a scalloped hem, a dithered dim
{ const pat = (w, h, px, col) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); g.fillStyle = col;
    px.forEach(([x, y]) => g.fillRect(x, y, 1, 1)); return `url(${c.toDataURL()})`; };
  appEl.style.setProperty("--stripes", pat(6, 6, [[0, 5], [1, 4], [2, 3], [3, 2], [4, 1], [5, 0]], "rgba(255,255,255,.2)"));
  appEl.style.setProperty("--hem", pat(6, 3, [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [1, 1], [2, 1], [3, 1], [4, 1], [2, 2], [3, 2]], "#000"));
  appEl.style.setProperty("--dither", pat(2, 2, [[0, 0], [1, 1]], "rgba(44,32,50,.22)")); }

/* ---------- Korean particles: picked from the last sound of the word before them ---------- */
// jong: 0 = no final consonant, 8 = ㄹ, otherwise another final consonant (digits are read aloud: 0 영, 1 일, 3 삼 ...)
function jong(word) {
  const ch = String(word).trim().slice(-1);
  const c = ch.charCodeAt(0);
  if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28;
  if (/[0-9]/.test(ch)) return [21, 8, 0, 16, 0, 0, 1, 8, 8, 0][+ch];      // 영 일 이 삼 사 오 육 칠 팔 구
  return 0;
}
const PAIRS = { "을": ["을", "를"], "를": ["을", "를"], "이": ["이", "가"], "가": ["이", "가"], "은": ["은", "는"], "는": ["은", "는"], "과": ["과", "와"], "와": ["과", "와"] };
function josa(word, p) {
  const j = jong(word);
  if (p === "으로" || p === "로") return j && j !== 8 ? "으로" : "로";            // ㄹ takes 로: 칼로, 연필로
  if (p === "이에요" || p === "예요") return j ? "이에요" : "예요";
  const pr = PAIRS[p]; return pr ? (j ? pr[0] : pr[1]) : p;
}
// "치카(으)로", "욱을(를)", "하와이(가)" style markers in a line are resolved automatically
function fixJosa(textStr) {
  return String(textStr)
    .replace(/([가-힣0-9]+)\(으\)로/g, (m, w) => w + josa(w, "로"))
    .replace(/([가-힣0-9]+)(을|를|이|가|은|는|과|와)\((을|를|이|가|은|는|과|와)\)/g, (m, w, a) => w + josa(w, a))
    .replace(/([가-힣0-9]+)\((이|가|을|를|은|는|과|와)\)/g, (m, w, a) => w + josa(w, a));
}

/* ---------- dialogue temperature: which typeface a line is spoken in ---------- */
function tempOf(textStr, petId) {
  if (/…|\.\./.test(textStr)) return "low";                                    // timid, trailing off
  if (petId === "nori" && (/!!!/.test(textStr) || /^우라아아/.test(textStr))) return "peak";   // 욱 shouting: the one loud font
  if (/!!/.test(textStr)) return "high";                                      // excited
  return "mid";
}
const tClass = (textStr, petId) => "t-" + tempOf(textStr, petId);

/* ---------- portraits: sprites drawn 1:1 on the same grid ---------- */
const portraits = [];
function portrait(canvas, id, withItems, w = 44, h = 44, bg = null) {
  canvas.width = w; canvas.height = h;
  const p = { canvas, id, withItems, bg, phase: Math.random() * 1000 };
  portraits.push(p); return p;
}
function drawPortraits(now) {
  for (let i = portraits.length - 1; i >= 0; i--) {
    const p = portraits[i];
    if (!p.canvas.isConnected) { portraits.splice(i, 1); continue; }
    if (!p.canvas.offsetParent) continue;
    const g = p.canvas.getContext("2d"), t = now + p.phase, ph = (t % 1300) / 1300;
    const pose = BASE_POSE();
    pose.body = ph < 0.4 ? "base" : ph < 0.55 ? "squash" : ph < 0.85 ? "base" : "stretch";
    if (t % 3700 < 140) pose.face = "blink";
    if (p.happy && now < p.happy) pose.face = "happy";
    g.clearRect(0, 0, p.canvas.width, p.canvas.height);
    if (p.bg) p.bg(g, now);
    drawSprite(g, p.id, pose, p.canvas.width >> 1, p.canvas.height - (p.bg ? 8 : 3), 1, p.withItems ? equipOf(p.id) : null, !!p.bg);
  }
}
function drawHudFace() {
  const c = $("#hud-face"), g = c.getContext("2d"), id = S.pet || "mochi";
  const img = frame(id, BASE_POSE()), top = id === "nori" ? 9 : 1;
  g.clearRect(0, 0, 29, 20); g.drawImage(img, 0, top, 29, 20, 0, 0, 29, 20);
}
// a little sky-and-grass picture behind the inventory preview
function miniWorld(g) {
  const w = g.canvas.width, h = g.canvas.height;
  [["#a9dcf6", 0, 18], ["#bfe5fb", 18, 14], ["#dff3ff", 32, 10]].forEach(([c, y, hh]) => { g.fillStyle = c; g.fillRect(0, y, w, hh); });
  g.fillStyle = "#9fd6ab"; g.fillRect(0, 42, w, 4); g.fillStyle = "#88cd8c"; g.fillRect(0, 46, w, h - 46);
  g.fillStyle = "#a6dea4"; g.fillRect(0, 46, w, 1);
  g.fillStyle = "#ffffff"; [[14, 8, 16], [20, 6, 8], [124, 14, 20], [130, 12, 10]].forEach(([x, y, ww]) => g.fillRect(x, y, ww, 3));
  g.fillStyle = "#ffe58a"; g.fillRect(150, 5, 6, 6); g.fillRect(149, 6, 8, 4);
}

/* ---------- bubbles ---------- */
const petBubble = $("#pet-bubble"), worldBubble = $("#world-bubble");
let bubbleUntil = 0;
// resolves once every face used inside el has loaded, so a bubble never shows up empty and fills in late
function fontsReady(el) {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  const els = [el, ...el.querySelectorAll("*")], loads = [];
  for (const e of els) {
    const t = e.textContent; if (!t || !t.trim()) continue;
    const cs = getComputedStyle(e);                                     // style, weight, size and family only: no line height
    loads.push(document.fonts.load(`${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, t).catch(() => {}));
  }
  return Promise.all(loads);
}
let sayToken = 0;
function say(textStr, ms = 4000) {
  const bb = petBubble.querySelector(".bb"), my = ++sayToken;
  textStr = fixJosa(textStr);
  bb.textContent = textStr; bb.className = "bb pxp " + tClass(textStr, S.pet);
  fontsReady(bb).then(() => { if (my !== sayToken) return; petBubble.hidden = false; bubbleUntil = performance.now() + ms; });
}
function placeBubble(el, gx, gy, minTop = 30) {
  const w = el.offsetWidth, h = el.offsetHeight;
  const left = Math.max(3, Math.min(W - w - 3, Math.round(gx - w / 2)));
  el.style.left = left + "px"; el.style.top = Math.max(minTop, Math.round(gy - h - 6)) + "px";
  el.style.setProperty("--tail", Math.max(6, Math.min(w - 6, Math.round(gx - left))) + "px");
}
let lastCheer = performance.now();
const pick = a => a[Math.random() * a.length | 0];

/* ---------- toast ---------- */
let toastT = 0;
function toast(msg, ms = 2600, title) {
  const t = $("#toast");
  t.innerHTML = (title ? `<span class="lvup t-peak">${esc(title)}</span>` : "") + esc(fixJosa(msg));
  fontsReady(t).then(() => { t.hidden = false; });
  clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, ms);
}

/* ---------- screens and modals ---------- */
let screenStack = [];
function openScreen(id) {
  const el = $("#" + id);
  if (!screenStack.includes(id)) screenStack.push(id);
  el.classList.add("show"); el.style.zIndex = 30 + screenStack.length;
}
function closeScreen(id) { $("#" + id).classList.remove("show"); screenStack = screenStack.filter(s => s !== id); }
document.querySelectorAll("[data-back]").forEach(b => b.addEventListener("click", () => closeScreen(b.closest(".screen").id)));

const modal = $("#modal"), modalCard = $("#modal .modal-card");
let modalClose = null;
function openModal(title, html, onClose, closable = true) {
  modalCard.innerHTML = `<div class="win-t"><span class="grow">${title}</span>${closable ? `<button class="x pxb" aria-label="닫기">${icon("x")}</button>` : ""}</div>` + html;
  paintIcons(modalCard);
  modal.hidden = false; modalClose = onClose || null; modalCard.scrollTop = 0;
  const x = modalCard.querySelector(".x"); if (x) x.onclick = () => closeModal(true);
}
function closeModal(cancelled) { modal.hidden = true; modalCard.innerHTML = ""; const f = modalClose; modalClose = null; if (cancelled && typeof f === "function") f(); }
modal.addEventListener("pointerdown", e => { if (e.target === modal && modalClose !== "lock") closeModal(true); });
function confirmBox(msg, okLabel, onOk, cancelLabel = "취소") {
  openModal("확인", `<p>${msg}</p><div class="actions"><button class="btn pxb" data-no>${cancelLabel}</button><button class="btn pxb accent" data-ok>${okLabel}</button></div>`);
  modalCard.querySelector("[data-no]").onclick = () => closeModal(true);
  modalCard.querySelector("[data-ok]").onclick = () => { closeModal(false); onOk(); };
}

/* ---------- character select (first time and "캐릭터 변경") ---------- */
let selMode = "first", selPick = null, typer = 0;
function typeText(el, s) {
  clearInterval(typer);
  const shown = document.createElement("span"), rest = document.createElement("span"), my = ++typeToken;
  rest.style.visibility = "hidden"; el.replaceChildren(shown, rest);
  let i = 1; shown.textContent = s.slice(0, i); rest.textContent = s.slice(i);     // the bubble has its full size from the start
  el.style.visibility = "hidden";                                                   // ...and appears once its font is in
  fontsReady(el).then(() => {
    if (my !== typeToken) return;
    el.style.visibility = "";
    typer = setInterval(() => { i++; shown.textContent = s.slice(0, i); rest.textContent = s.slice(i); if (i >= s.length) clearInterval(typer); }, 30);
  });
}
let typeToken = 0;
function renderSelect(mode) {
  selMode = mode; selPick = mode === "change" ? S.pet : null;
  $("#scr-select .back").hidden = mode === "first";
  $("#sel-note").hidden = mode === "first";
  const st = $("#sel-text"); st.className = "bb pxp t-mid";
  st.textContent = mode === "first" ? "마음에 드는 친구를 눌러 봐!" : "누구랑 같이 공부할래?";
  const row = $("#sel-row"); row.innerHTML = "";
  for (const id of CHAR_ORDER) {
    const c = CHARS[id], b = document.createElement("button");
    b.className = "sel-card pxb"; b.dataset.id = id;
    b.style.setProperty("--c", c.color); b.style.setProperty("--c-soft", c.soft); b.style.setProperty("--c-deep", c.deep);
    b.innerHTML = `<canvas></canvas><span>${c.name}</span>`;
    b.setAttribute("aria-pressed", id === selPick);
    portrait(b.querySelector("canvas"), id, mode === "change", 44, 40);
    b.onclick = () => selectChar(id);
    row.appendChild(b);
  }
  updateSelInfo();
}
function selectChar(id) {
  selPick = id;
  document.querySelectorAll(".sel-card").forEach(b => b.setAttribute("aria-pressed", b.dataset.id === id));
  const p = portraits.find(p => p.canvas.closest(".sel-card")?.dataset.id === id); if (p) p.happy = performance.now() + 900;
  const st = $("#sel-text"); st.className = "bb pxp " + tClass(CHARS[id].intro, id).replace("t-peak", "t-high");
  typeText(st, CHARS[id].intro);
  pointSelTail(id);
  updateSelInfo();
}
// the select bubble's tail points at the chosen character
function pointSelTail(id) {
  const bub = $(".sel-bubble"), card = document.querySelector(`.sel-card[data-id="${id}"]`);
  if (!bub || !card) return;
  const a = bub.getBoundingClientRect(), c = card.getBoundingClientRect();
  bub.style.setProperty("--tail", Math.round((c.left + c.width / 2 - a.left) / K) + "px");
}
function updateSelInfo() {
  const info = $("#sel-info");
  if (!selPick) { info.hidden = true; $("#sel-ok").disabled = true; return; }
  const c = CHARS[selPick];
  info.hidden = false;
  info.innerHTML = `<p><b class="f-sm">이름</b>${c.name}${selMode === "change" && S.chars[selPick] ? ` <span class="f-num s muted">Lv.${lvOf(curExp(selPick))}</span>` : ""}</p><p><b class="f-sm">특징</b><span class="f-sm">${c.trait}</span></p>`;
  $("#sel-ok").disabled = selMode === "change" && selPick === S.pet;
}
$("#sel-ok").onclick = () => {
  const id = selPick; if (!id) return;
  if (selMode === "first") { setPet(id); closeScreen("scr-select"); askSetup(true); return; }
  if (S.timer) { toast("공부 중에는 바꿀 수 없어요. 먼저 끝을 눌러 주세요."); return; }
  const had = S.chars[id] && S.chars[id].exp > 0;
  const msg = `${CHARS[id].name}${josa(CHARS[id].name, "로")} 바꿀까요?<br><span class="muted">${had ? `기존 데이터는 유지되고, Lv.${lvOf(curExp(id))}부터 이어서 해요.` : "기존 데이터는 유지가 되지만 새 캐릭터는 1레벨부터 다시 시작합니다."}</span>`;
  confirmBox(msg, "바꾸기", () => { setPet(id); screenStack.slice().forEach(closeScreen); say(pick(CHARS[id].cheers)); });
};
function setPet(id) {
  S.pet = id; charState(id); save();
  appEl.dataset.pet = id; applyUi();
  petReset(id);
  drawHudFace();
}

/* ---------- first-run study time setup (also editable in settings) ---------- */
function askSetup(first) {
  const s = S.setup || { myMin: 120, goalMin: 180 };
  openModal("순공 시간", `
    <p class="lbl-mark">나의 순공 시간?</p>
    <div class="time-in"><input class="field" inputmode="numeric" id="my-h" value="${Math.floor(s.myMin / 60)}">시간
      <input class="field" inputmode="numeric" id="my-m" value="${s.myMin % 60}">분 <span class="f-sm muted">하루</span></div>
    <p class="lbl-mark">목표 순공 시간?</p>
    <div class="time-in"><input class="field" inputmode="numeric" id="goal-h" value="${Math.floor(s.goalMin / 60)}">시간
      <input class="field" inputmode="numeric" id="goal-m" value="${s.goalMin % 60}">분 <span class="f-sm muted">하루</span></div>
    <p class="warn f-sm">(단, 달성 가능한 시간으로 설정 부탁!)</p>
    <div class="actions"><button class="btn big pxb accent" id="setup-ok">확인</button></div>`, first ? "lock" : null, !first);
  $("#setup-ok").onclick = () => {
    const v = id => Math.max(0, parseInt($(id).value || "0", 10) || 0);
    const myMin = Math.min(1440, v("#my-h") * 60 + Math.min(59, v("#my-m")));
    const goalMin = Math.min(1440, v("#goal-h") * 60 + Math.min(59, v("#goal-m")));
    if (!goalMin) { toast("목표 시간을 정해 주세요!"); return; }
    S.setup = { myMin, goalMin }; save(); closeModal(false);
    if (first && !S.tutorialDone) setTimeout(startCoach, 350);
    else toast("목표 순공 시간을 저장했어요");
  };
}

/* ---------- study timer ---------- */
const btnStart = $("#btn-start"), btnRest = $("#btn-rest"), btnEnd = $("#btn-end");
btnStart.onclick = () => { if (!S.timer) openStartModal(); };
btnRest.onclick = () => {
  if (!S.timer) return;
  const t = S.timer, last = t.segs[t.segs.length - 1], now = Date.now();
  last.b = now; t.segs.push({ k: last.k === "s" ? "r" : "s", a: now, b: null }); save();
  if (timerState() === "rest") say(CHARS[S.pet].rest, 2500); else { say(pick(CHARS[S.pet].cheers), 2500); lastCheer = performance.now(); }
  syncControls();
};
btnEnd.onclick = () => { if (S.timer) openEndModal(); };

let startPick = null;
function openStartModal() {
  startPick = null;
  const render = () => {
    openModal("무슨 공부 할래?", `
      <div class="chips">${S.subjects.map(s => `<button class="chip pxb" data-id="${s.id}" style="--c:${s.color}" aria-pressed="${s.id === startPick}">${esc(s.name)}</button>`).join("")}</div>
      <div class="row2"><input class="field" id="new-subj" maxlength="10" placeholder="과목 추가"><button class="btn pxb" id="add-subj">추가</button></div>
      <p class="hint f-sm">과목을 골라야 시작할 수 있어요</p>
      <div class="actions"><button class="btn big pxb mint" id="go" ${startPick ? "" : "disabled"}>${icon("play", "ico")}시작</button></div>`);
    modalCard.querySelectorAll(".chip").forEach(b => b.onclick = () => { startPick = b.dataset.id; render(); });
    const add = () => { const n = $("#new-subj").value.trim(); if (!n) return; const s = addSubject(n); startPick = s.id; render(); };
    $("#add-subj").onclick = add; $("#new-subj").onkeydown = e => { if (e.key === "Enter" && !e.isComposing) add(); };
    $("#go").onclick = () => { if (startPick) { closeModal(false); startSession(startPick); } };
  };
  render();
}
function addSubject(name) {
  const used = new Set(S.subjects.map(s => s.color));
  const color = SUBJECT_COLORS.find(c => !used.has(c)) || SUBJECT_COLORS[S.subjects.length % SUBJECT_COLORS.length];
  const s = { id: uid(), name, color }; S.subjects.push(s); save(); return s;
}
// deleted subjects keep their name and colour in the statistics
const subj = id => S.subjects.find(s => s.id === id) || (S.removedSubjects || []).find(s => s.id === id) || { name: "(지운 과목)", color: "#ddd" };
function startSession(subjectId) {
  S.timer = { pet: S.pet, subjectId, segs: [{ k: "s", a: Date.now(), b: null }], endAt: null };
  save(); syncControls(); titleOnStart();
  petHop(3); say(CHARS[S.pet].start, 2600); lastCheer = performance.now();
}
function openEndModal() {
  const t = S.timer; if (!t.endAt) t.endAt = Date.now(); save();
  const sum = sessionSums(t), sb = subj(t.subjectId), todos = S.todos[todayKey()] || [];
  const gain = Math.max(0, Math.min(sum.exp, MAX_EXP - charState(t.pet).exp));
  openModal("기록할까?", `
    <dl class="summary">
      <dt class="f-sm">과목</dt><dd><span class="tag f-sm" style="--c:${sb.color}">${esc(sb.name)}</span></dd>
      <dt class="f-sm">순공</dt><dd class="f-num">${fmtTimer(sum.study)}</dd>
      <dt class="f-sm">휴식</dt><dd class="f-num">${fmtTimer(sum.rest)}</dd>
      <dt class="f-sm">경험치</dt><dd class="f-num">+${Math.round(gain * 100)}%${sum.burn ? ` ${icon("flame")}` : ""}</dd>
    </dl>
    <p class="lbl-mark">무엇을 했어?</p>
    <textarea class="field" id="end-note" maxlength="300" placeholder="${esc(CHARS[t.pet].note)}"></textarea>
    ${todos.length ? `<p class="hint f-sm">끝낸 할 일을 체크해요</p><ul class="mini-todos">${todos.map(td => `<li><button data-id="${td.id}"><span class="chk ${td.done ? "on" : ""}"></span>${esc(td.text)}</button></li>`).join("")}</ul>` : ""}
    <div class="actions"><button class="btn pxb" id="end-drop">안 할래</button><button class="btn pxb accent" id="end-save">기록하기</button></div>`,
    () => { t.endAt = null; save(); });      // closed: keep going
  modalCard.querySelectorAll(".mini-todos button").forEach(b => b.onclick = () => {
    const td = todos.find(x => x.id === b.dataset.id); if (!td) return;
    td.done = !td.done; save(); b.querySelector(".chk").classList.toggle("on", td.done);
  });
  $("#end-save").onclick = () => { const note = $("#end-note").value.trim(); closeModal(false); finishSession(true, note); };
  $("#end-drop").onclick = () => {
    confirmBox("기록하지 않으면 이번 공부 시간과 경험치가 사라져요. 괜찮아?", "안 할래", () => finishSession(false, ""), "돌아가기");
    modalClose = () => { if (S.timer) openEndModal(); };      // back to the end card
  };
}
function finishSession(keep, note) {
  const t = S.timer; if (!t) return;
  const end = t.endAt || Date.now();
  t.segs[t.segs.length - 1].b = end; delete t.endAt;
  if (keep) {
    const cs = charState(t.pet), sum = sessionSums(t);
    cs.exp = Math.min(MAX_EXP, cs.exp + sum.exp);
    S.sessions.push({ id: uid(), pet: t.pet, subjectId: t.subjectId, segs: t.segs, note });
  }
  S.timer = null; save(); syncControls();
  if (keep) { say(CHARS[S.pet].end, 3000); petHop(4); toast("기록했어요!"); setTimeout(checkTitles, 2800); }
  else { charState(S.pet).shownLv = lvOf(curExp()); save(); }
}
function syncControls() {
  const st = timerState();
  btnStart.classList.toggle("running", st !== "idle");
  btnStart.querySelector(".lbl").textContent = st === "idle" ? "시작" : subj(S.timer.subjectId).name;
  btnStart.querySelector(".dot-rec").hidden = st !== "run";
  btnStart.querySelector(".ico").hidden = st !== "idle";
  btnRest.disabled = st === "idle"; btnEnd.disabled = st === "idle";
  btnRest.classList.toggle("resting", st === "rest");
  btnRest.querySelector(".lbl").textContent = st === "rest" ? "다시" : "휴식";
  paintIcon(btnRest.querySelector(".ico"), st === "rest" ? "play" : "pause");
  G.studying = st === "run";
  petSetSleep(st === "rest");
}

/* ---------- HUD and level ups ---------- */
function updateHud() {
  if (!S.pet) return;
  const e = curExp(), lv = lvOf(e), frac = lv >= LEVEL.max ? 1 : e - Math.floor(e);
  const burning = isBurning(Date.now());
  $("#hud-lv").textContent = `Lv.${lv}`;
  { const wt = titleState().worn, el = $("#hud-title");
    if (el && el.dataset.tid !== (wt || "")) {
      el.dataset.tid = wt || ""; el.hidden = !wt;
      if (wt) { el.className = "f-xs" + titleFx(wt); el.setAttribute("style", titleStyle(wt)); el.innerHTML = titleIcon(wt) + `<span>${esc(titleName(wt))}</span>`; }
    } }
  $("#hud-bar").style.width = Math.round(frac * 130) + "px";
  $("#hud-burn").hidden = !burning;
  const bar = $("#hud .bar"); bar.classList.toggle("burning", burning); bar.classList.toggle("max", lv >= LEVEL.max);
  $("#hud-next").textContent = lv >= LEVEL.max ? "MAX" : `다음 레벨까지 ${Math.ceil((1 - frac) * (burning ? LEVEL.burnMin : LEVEL.normalMin))}분`;
  const cs = charState(S.pet);
  if (lv > (cs.shownLv || 1)) {
    const fresh = ITEM_LIST[S.pet].filter(([need]) => need > (cs.shownLv || 1) && need <= lv);
    fresh.forEach(([, id]) => cs.equip[id] = true);
    cs.shownLv = lv; save();
    petCelebrate(); say(CHARS[S.pet].levelup, 3500);
    toast(fresh.length ? `새 아이템: ${fresh.map(f => f[2]).join(", ")}` : `Lv.${lv} 달성!`, 3800, `LEVEL UP! Lv.${lv}`);
  } else if (lv < (cs.shownLv || 1)) { cs.shownLv = lv; save(); }
  G.equip = equipOf(S.pet);
  // 치카 gets gloomy when today's plan is falling apart (late and much left undone)
  const td = S.todos[todayKey()] || [], left = td.filter(x => !x.done).length;
  G.lowMood = new Date().getHours() >= 20 && left > 0 && left >= td.length / 2;
}
function signInfo() {
  const st = S.pet ? timerState() : "idle";
  if (st === "idle") {                      // the clock follows the world's time (the same as the device unless ?hour= previews another)
    const h = worldHour(), on = Math.floor(Date.now() / 1000) % 2;
    return { text: `${pad(Math.floor(h))}${on ? ":" : " "}${pad(Math.floor(h * 60) % 60)}`, mode: "clock" };
  }
  return { text: fmtTimer(sessionSums(S.timer).study), mode: st };
}

/* ---------- side tab ---------- */
const side = $("#sidetab");
function setSide(open) {
  side.classList.toggle("open", open); S.sideOpen = open; save();
  paintIcon($("#tab-toggle canvas"), open ? "open" : "closed");
}
$("#tab-toggle").onclick = () => setSide(!side.classList.contains("open"));
$("#tab-stats").onclick = () => { statsDay = todayKey(); renderStats(); openScreen("scr-stats"); };
$("#tab-todo").onclick = () => { renderTodo(); openScreen("scr-todo"); };
$("#tab-settings").onclick = () => { renderSettings(); openScreen("scr-settings"); };

/* ---------- statistics ---------- */
let statsDay = todayKey();
function allSessions() {
  const list = S.sessions.slice();
  if (S.timer) list.push({ id: "live", pet: S.timer.pet, subjectId: S.timer.subjectId, segs: S.timer.segs, live: true });
  return list;
}
function clipSum(segs, a, b, kind) {
  let ms = 0;
  for (const s of segs) if (s.k === kind) { const e = s.b ?? Date.now(); ms += Math.max(0, Math.min(e, b) - Math.max(s.a, a)); }
  return ms;
}
// a pixel donut: each pixel of the ring takes the colour of the slice its angle falls in
function drawDonut(canvas, parts, label, sub) {
  const S_ = 64, g = canvas.getContext("2d"), c = (S_ - 1) / 2;
  canvas.width = S_; canvas.height = S_;
  const total = parts.reduce((a, p) => a + p.v, 0);
  const img = g.createImageData(S_, S_), hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const ink = hexRgb(OUT), empty = hexRgb("#eadfc8"), paper = hexRgb("#fffaf0");
  const cols = parts.map(p => hexRgb(p.c));
  for (let y = 0; y < S_; y++) for (let x = 0; x < S_; x++) {
    const dx = x - c, dy = y - c, r = Math.sqrt(dx * dx + dy * dy);
    let col = null;
    if (r <= 31.5 && r > 30.5) col = ink;
    else if (r <= 30.5 && r > 19.5) {
      if (!total) col = empty;
      else {
        const f = ((Math.atan2(dx, -dy) / (2 * Math.PI)) + 1) % 1;
        let acc = 0; col = cols[cols.length - 1];
        for (let i = 0; i < parts.length; i++) { acc += parts[i].v / total; if (f < acc) { col = cols[i]; break; } }
      }
    } else if (r <= 19.5 && r > 18.5) col = ink;
    else if (r <= 18.5) col = paper;
    if (!col) continue;
    const i = (y * S_ + x) * 4; img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  canvas.dataset.label = label; canvas.dataset.sub = sub || "";
}
function donutBox(id, title, label, sub) {
  return `<div><h4 class="f-sm">${title}</h4><div class="dn"><canvas id="${id}"></canvas>
    <div class="dn-l"><span class="f-num">${esc(label)}</span>${sub ? `<span class="f-sm muted">${sub}</span>` : ""}</div></div></div>`;
}
function renderStats() {
  const day = parseKey(statsDay), a = day.getTime(), b = a + 86400000;
  const per = {}; let study = 0, rest = 0, totStudy = 0, totRest = 0;
  const daySess = [];
  for (const s of allSessions()) {
    const st = clipSum(s.segs, a, b, "s"), rs = clipSum(s.segs, a, b, "r");
    if (st || rs) daySess.push(s);
    per[s.subjectId] = (per[s.subjectId] || 0) + st; study += st; rest += rs;
    totStudy += clipSum(s.segs, 0, 9e15, "s"); totRest += clipSum(s.segs, 0, 9e15, "r");
  }
  const parts = Object.entries(per).filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]).map(([id, v]) => ({ v, c: subj(id).color, n: subj(id).name }));
  const goal = S.setup ? S.setup.goalMin * 60000 : 0, pct = goal ? Math.min(100, Math.round(study / goal * 100)) : 0;
  const isToday = statsDay === todayKey();
  const hm = ms => { const m = Math.floor(ms / 60000); return `${Math.floor(m / 60)}:${pad(m % 60)}`; };
  const ratio = (s, r) => s + r ? Math.round(s / (s + r) * 100) + "%" : "-";
  $("#stats-body").innerHTML = `
    <div class="date-nav">
      <button class="ibtn pxb" id="d-prev" aria-label="이전 날">${icon("back")}</button>
      <label class="date-chip pxb f-num s">${day.getFullYear()}.${pad(day.getMonth() + 1)}.${pad(day.getDate())}<input type="date" id="d-pick" value="${statsDay}" max="${todayKey()}"></label>
      <button class="ibtn pxb" id="d-next" aria-label="다음 날" ${isToday ? "disabled" : ""}>${icon("next")}</button>
    </div>
    <div class="card pxp" id="day-card">
      <div class="donuts">
        ${donutBox("dn-subj", "하루 과목", study ? hm(study) : "-", study ? "순공" : "")}
        ${donutBox("dn-day", "공부 & 휴식", ratio(study, rest), study + rest ? "공부" : "")}
      </div>
      <ul class="legend f-sm">${parts.map(p => `<li><span class="sw" style="--c:${p.c}"></span>${esc(p.n)}<b>${fmtDur(p.v)}</b></li>`).join("") || '<li class="muted t-low">이 날은 기록이 없어요…</li><li class="muted f-sm">옆으로 밀면 다른 날을 볼 수 있어요</li>'}
        ${rest ? `<li><span class="sw" style="--c:#b9b4c9"></span>휴식<b>${fmtDur(rest)}</b></li>` : ""}</ul>
    </div>
    ${goal ? `<div class="card pxp"><div class="card-t">목표 순공</div>
      <div class="f-sm">${fmtDur(goal)} 중 ${fmtDur(study)} <span class="f-num s">${pct}%</span></div><div class="goal-bar"><i style="width:${pct}%"></i></div></div>` : ""}
    <div class="card pxp">
      <div class="donuts">
        <div style="text-align:left"><div class="card-t">총 공부 시간</div><div class="f-num" style="margin:6px 0 2px">${hm(totStudy)}</div><p class="f-sm muted">공부 시간만</p></div>
        ${donutBox("dn-all", "공부 & 휴식", ratio(totStudy, totRest), totStudy + totRest ? "공부" : "")}
      </div>
    </div>
    ${daySess.length ? `<div class="card pxp"><div class="card-t">이 날의 기록</div><ul class="sess f-sm">${daySess.map(s => {
      const sb = subj(s.subjectId), st = new Date(s.segs[0].a), en = new Date(s.segs[s.segs.length - 1].b ?? Date.now());
      return `<li><span class="tag" style="--c:${sb.color}">${esc(sb.name)}</span> <span class="f-num s">${fmtHM(st)}~${s.live ? "" : fmtHM(en)}</span>${s.live ? "지금" : ""}<br><span class="muted">순공 ${fmtDur(clipSum(s.segs, 0, 9e15, "s"))} · ${CHARS[s.pet] ? CHARS[s.pet].name : ""}</span>
        ${s.note ? `<div class="note">${esc(s.note)}</div>` : ""}</li>`; }).join("")}</ul></div>` : ""}`;
  paintIcons($("#stats-body"));
  drawDonut($("#dn-subj"), parts.map(p => ({ v: p.v, c: p.c })));
  drawDonut($("#dn-day"), [{ v: study, c: "#ffe58a" }, { v: rest, c: "#b9b4c9" }]);
  drawDonut($("#dn-all"), [{ v: totStudy, c: "#ffe58a" }, { v: totRest, c: "#b9b4c9" }]);
  const go = d => { const x = parseKey(statsDay); x.setDate(x.getDate() + d); if (dkey(x) > todayKey()) return; statsDay = dkey(x); renderStats(); };
  $("#d-prev").onclick = () => go(-1); $("#d-next").onclick = () => go(1);
  $("#d-pick").onchange = e => { if (e.target.value) { statsDay = e.target.value > todayKey() ? todayKey() : e.target.value; renderStats(); } };
  let x0 = null;
  const card = $("#day-card");
  card.onpointerdown = e => { x0 = e.clientX; };
  card.onpointerup = e => { if (x0 === null) return; const dx = (e.clientX - x0) / K; x0 = null; if (Math.abs(dx) > 20) go(dx < 0 ? 1 : -1); };
}

/* ---------- to-do list ---------- */
function todayTodos() { const k = todayKey(); return S.todos[k] || (S.todos[k] = []); }
// the todo screen only checks things off; writing, fixing, deleting and reordering happen in the + window
function renderTodo() {
  const list = todayTodos(), c = CHARS[S.pet], allDone = list.length && list.every(t => t.done);
  const line = allDone ? c.todoDone : c.todo;
  $("#todo-body").innerHTML = `
    <div class="card pxp todo-hero">
      <canvas></canvas>
      <div><div class="card-t">오늘 할 일 <button class="ibtn pxb accent" id="todo-plus" aria-label="할 일 쓰고 고치기">${icon("plus")}</button></div><p class="${tClass(line, S.pet).replace("t-peak", "t-high")}">${esc(line)}</p></div>
    </div>
    ${list.length ? `<div class="todo-tools f-sm"><span><span class="f-num s">${list.filter(t => t.done).length}/${list.length}</span> 완료</span></div>` : ""}
    <ul class="todo-list" id="todo-list">${list.map(t => `
      <li data-id="${t.id}" class="pxp ${t.done ? "done" : ""}"><button class="chk ${t.done ? "on" : ""}" aria-label="완료 표시"></button><span class="t">${esc(t.text)}</span></li>`).join("")}</ul>
    ${list.length ? "" : '<p class="empty t-low">+ 를 눌러서 오늘 할 일을 적어 봐요…</p>'}`;
  paintIcons($("#todo-body"));
  portrait($("#todo-body .todo-hero canvas"), S.pet, true);
  $("#todo-plus").onclick = openTodoEditor;
  document.querySelectorAll("#todo-list li").forEach(li => {
    const t = list.find(x => x.id === li.dataset.id);
    li.onclick = () => {
      t.done = !t.done; save(); renderTodo();
      if (t.done) { petHop(2); if (list.every(x => x.done)) say(c.todoDone, 3000); }
    };
  });
}
function openTodoEditor() {
  const draft = todayTodos().map(t => ({ ...t }));
  openModal("오늘 할 일", `
    <div class="row2 todo-add"><input class="field" id="todo-in" maxlength="40" placeholder="예) 수학 문제집 3쪽"><button class="btn pxb accent" id="todo-add">추가</button></div>
    <ul class="todo-list edit" id="todo-edit-list"></ul>
    <div class="actions"><button class="btn big wide pxb accent" id="todo-done">완료</button></div>`);
  const ul = $("#todo-edit-list"), input = $("#todo-in");
  const draw = () => {
    ul.innerHTML = draft.length ? draft.map(t => `
      <li data-id="${t.id}" class="pxp ${t.done ? "done" : ""}"><input class="t" value="${esc(t.text)}" maxlength="40" aria-label="할 일 고치기">
        <button class="del" aria-label="지우기">${icon("x")}</button><button class="grip" aria-label="끌어서 순서 바꾸기">${icon("grip")}</button></li>`).join("")
      : '<li class="empty t-low">아직 할 일이 없어요…</li>';
    paintIcons(ul);
    ul.querySelectorAll("li[data-id]").forEach(li => {
      const t = draft.find(x => x.id === li.dataset.id);
      li.querySelector("input.t").oninput = e => { t.text = e.target.value; };
      li.querySelector(".del").onclick = () => { draft.splice(draft.indexOf(t), 1); draw(); };
      li.querySelector(".grip").onpointerdown = e => dragTodo(e, li, draft, draw);
    });
  };
  const add = () => { const v = input.value.trim(); if (!v) return; draft.push({ id: uid(), text: v, done: false }); input.value = ""; draw(); input.focus(); };
  $("#todo-add").onclick = add; input.onkeydown = e => { if (e.key === "Enter" && !e.isComposing) add(); };
  $("#todo-done").onclick = () => {
    if (input.value.trim()) add();                                     // a line typed but not added yet still counts
    S.todos[todayKey()] = draft.map(t => ({ ...t, text: t.text.trim() })).filter(t => t.text);
    save(); closeModal(false); renderTodo();
  };
  draw();
}
function dragTodo(e, li, list, redraw) {
  e.preventDefault();
  const ul = li.parentElement, k = li.getBoundingClientRect().height / li.offsetHeight || 1;   // screen px per page px
  const grab = e.clientY - li.getBoundingClientRect().top;
  li.classList.add("dragging");
  const follow = y => {                                 // lifted off the list, it rides under the finger
    li.style.transform = "none"; const top = li.getBoundingClientRect().top;
    li.style.transform = `translateY(${Math.round((y - grab - top) / k)}px)`;
  };
  const move = ev => {
    for (const s of ul.children) {
      if (s === li) continue;
      const r = s.getBoundingClientRect();
      if (ev.clientY > r.top && ev.clientY < r.bottom) {
        const before = ev.clientY > r.top + r.height / 2 ? s.nextSibling : s;
        if (before !== li && before !== li.nextSibling) {   // the others slide out of its way rather than jump
          const kids = [...ul.children].filter(x => x !== li), was = kids.map(x => x.getBoundingClientRect().top);
          ul.insertBefore(li, before);
          kids.forEach((x, n) => {
            const d = Math.round((was[n] - x.getBoundingClientRect().top) / k); if (!d) return;
            x.style.transition = "none"; x.style.transform = `translateY(${d}px)`; x.offsetHeight;
            x.style.transition = "transform .14s ease-out"; x.style.transform = "";
          });
          if (navigator.vibrate) navigator.vibrate(8);
        }
        break;
      }
    }
    follow(ev.clientY);
  };
  const up = () => {
    removeEventListener("pointermove", move); removeEventListener("pointerup", up); removeEventListener("pointercancel", up);
    li.style.transition = "transform .12s ease-out"; li.style.transform = "";   // set down in its new place
    const order = [...ul.children].map(x => x.dataset.id);
    list.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    setTimeout(redraw, 130);
  };
  addEventListener("pointermove", move); addEventListener("pointerup", up); addEventListener("pointercancel", up);
}

/* ---------- titles (칭호) ---------- */
// earned titles (and when), the one worn (shown in the HUD), taps on the pet, when the app was last open, and whether
// the 칭호 menu has shown its unlocking sparkle
function titleState() { return S.titles || (S.titles = { got: {}, worn: null, taps: 0, seen: 0, menuShown: false, back: false }); }
const titleName = id => (TITLES.find(t => t[0] === id) || [, ""])[1];
// each title's own look: its colours (face, shadow, text), a little pixel icon that moves (frames, ms each) and an
// effect on its plate (fx: a CSS class). Icons are 9x9 on the grid; "." is clear
const TL = { K: OUT, W: "#ffffff" };
const mirror = rows => rows.map(r => [...r].reverse().join(""));
const FIRE1 = ["....O....", "...OO....", "..OYO.O..", ".OYYOOO..", ".OYWYYO..", "OYYWWYYO.", "OYWWWWYO.", ".OYWWYO..", "..OOOO..."];
const TITLE_LOOK = {
  first: { face: "#d6f5cc", sh: "#8fcf86", ink: "#2f5a2c", fx: "steps", ms: [420, 420, 700], pal: { F: "#4f9a4a", f: "#9ccf95" }, frames: [
    [".F.F.....", "F...F....", ".FFF.....", ".FFF.....", ".........", ".........", ".........", ".........", "........."],
    [".f.f.....", "f...f....", ".fff.....", ".fff.....", ".........", ".....F.F.", "....F...F", ".....FFF.", ".....FFF."],
    [".f.f.....", "f...f....", ".fff.....", ".fff.....", ".........", ".....f.f.", "....f...f", ".....fff.", ".....fff."]] },
  stylist: { face: "#ffdcec", sh: "#f09cc0", ink: "#8a2d58", fx: "shine", ms: 300, pal: { ...TL, P: "#ff8fbf", p: "#ffc2dc", Y: "#ffd25e" }, frames: [
    ["KK.....KK", "KPKK.KKPK", "KPpPKPpPK", "KPPKYKPPK", "KPpPKPpPK", "KPKK.KKPK", "KK.....KK", ".........", "........."],
    ["KK.....KK", "KPKK.KKPK", "KPpPKPpPK", "KPPKYKPPK", "KPpPKPpPK", "KPKK.KKPK", "KK.....KK", ".......W.", "......W.W"]] },
  addict: { face: "#ffe0d6", sh: "#f2967c", ink: "#9a3020", fx: "beat", ms: [180, 160, 520], pal: { ...TL, R: "#f2545a", r: "#ff9aa0" }, frames: [
    [".KKK.KKK.", "KRRRKRRRK", "KRWrRRRRK", "KRrRRRRRK", "KRRRRRRRK", ".KRRRRRK.", "..KRRRK..", "...KRK...", "....K...."],
    [".........", "..KK.KK..", ".KRRKRRK.", ".KRWRRRK.", ".KRRRRRK.", "..KRRRK..", "...KRK...", "....K....", "........."],
    [".........", "..KK.KK..", ".KRRKRRK.", ".KRWRRRK.", ".KRRRRRK.", "..KRRRK..", "...KRK...", "....K....", "........."]] },
  easy: { face: "#d8ecff", sh: "#86b8e8", ink: "#2b5786", fx: "", ms: 380, pal: { ...TL, S: "#9fb6d0", T: "#c98f5e" }, frames: [
    ["..S.S....", ".S.S.....", "..S.S....", "KKKKKKK..", "KWTTTWKKK", "KWWWWWK.K", "KWWWWWKKK", ".KWWWK...", "..KKK...."],
    [".S.S.....", "..S.S....", ".S.S.....", "KKKKKKK..", "KWTTTWKKK", "KWWWWWK.K", "KWWWWWKKK", ".KWWWK...", "..KKK...."]] },
  overcome: { face: "#e8e0ff", sh: "#a896e8", ink: "#4a3a8c", fx: "", ms: [260, 260, 260, 1400], pal: { ...TL, R: "#f27f7f", G: "#5cb85c" }, frames: [
    ["KKKKKKKKK", "KRRRRRRRK", "KKKKKKKKK", "KWWWWWWWK", "KWWWWWWWK", "KWWWWWWWK", "KWWWWWWWK", "KWWWWWWWK", "KKKKKKKKK"],
    ["KKKKKKKKK", "KRRRRRRRK", "KKKKKKKKK", "KWWWWWWWK", "KWWWWWWWK", "KGWWWWWWK", "KWGWWWWWK", "KWWWWWWWK", "KKKKKKKKK"],
    ["KKKKKKKKK", "KRRRRRRRK", "KKKKKKKKK", "KWWWWWWWK", "KWWWWWWWK", "KGWWWGWWK", "KWGWGWWWK", "KWWGWWWWK", "KKKKKKKKK"],
    ["KKKKKKKKK", "KRRRRRRRK", "KKKKKKKKK", "KWWWWWWGK", "KWWWWWGWK", "KGWWWGWWK", "KWGWGWWWK", "KWWGWWWWK", "KKKKKKKKK"]] },
  dawn: { face: "#34407a", sh: "#1d2550", ink: "#eef0ff", fx: "night", ms: 500, pal: { M: "#fff2a8", m: "#e8d27a", s: "#ffffff", t: "#9aa6e0" }, frames: [
    [".......s.", "..MMM....", ".MMm.....", "MMm......", "MMm....t.", "MMm......", ".MMm.....", "..MMM..s.", "........."],
    [".......t.", "..MMM....", ".MMm.....", "MMm.....s", "MMm......", "MMm......", ".MMm.....", "..MMM..t.", "......s.."]] },
  back: { face: "#fff4c2", sh: "#e8c858", ink: "#7a5a10", fx: "glow", ms: [900, 140, 140, 900], pal: { ...TL, Y: "#ffe066", y: "#f2efe0", G: "#a0a4ad", L: "#ffd23a" }, frames: [
    [".........", "..KKKKK..", ".KyyyyyK.", "KyyWyyyyK", "KyyWyyyyK", ".KyyyyyK.", "..KGGGK..", "..KGGGK..", "...KKK..."],
    [".L.....L.", "L.KKKKK.L", ".KYYYYYK.", "KYYWYYYYK", "KYYWYYYYK", ".KYYYYYK.", "..KGGGK..", "..KGGGK..", "...KKK..."],
    [".........", "..KKKKK..", ".KyyyyyK.", "KyyWyyyyK", "KyyWyyyyK", ".KyyyyyK.", "..KGGGK..", "..KGGGK..", "...KKK..."],
    [".L.....L.", "L.KKKKK.L", ".KYYYYYK.", "KYYWYYYYK", "KYYWYYYYK", ".KYYYYYK.", "..KGGGK..", "..KGGGK..", "...KKK..."]] },
  collector: { face: "#fff0b8", sh: "#e0b23a", ink: "#7a4e00", fx: "rainbow", ms: 260, pal: { ...TL, Y: "#ffd23a", y: "#ffe98a", R: "#f25c6a", B: "#5c9cf2", G: "#4cc47a" }, frames: [
    [".........", "K...K...K", "KK.KyK.KK", "KYKYYYKYK", "KYYYRYYYK", "KyYYYYYyK", "KKKKKKKKK", ".........", "........."],
    [".........", "K...K...K", "KK.KyK.KK", "KYKYYYKYK", "KYYYBYYYK", "KyYYYYYyK", "KKKKKKKKK", ".........", "........."],
    [".........", "K...K...K", "KK.KyK.KK", "KYKYYYKYK", "KYYYGYYYK", "KyYYYYYyK", "KKKKKKKKK", ".........", "........."]] },
  fireman: { face: "#ffd9bc", sh: "#f08a4a", ink: "#8a3000", fx: "ember", ms: 160, pal: { ...TL, O: "#ff7a3a", Y: "#ffd25e" }, frames: [FIRE1, mirror(FIRE1)] },
  dungeon: { face: "#3e2a5c", sh: "#241638", ink: "#ffd96b", fx: "shine gold", ms: [1200, 90, 90, 90, 90], pal: { ...TL, L: "#b8c0d0", Y: "#ffc93a", P: "#7a5ab0" }, frames: [
    ["......KKK", ".....KWLK", "....KWLK.", ".K.KWLK..", ".KKWLK...", "..KYK....", ".KYKK....", "KYK.K....", "KK......."],
    ["......KKK", ".....KWLK", "....KWLK.", ".K.KWLK..", ".KKWWK...", "..KYK....", ".KYKK....", "KYK.K....", "KK......."],
    ["......KKK", ".....KWLK", "....KWLK.", ".K.KWWK..", ".KKWLK...", "..KYK....", ".KYKK....", "KYK.K....", "KK......."],
    ["......KKK", ".....KWLK", "....KWWK.", ".K.KWLK..", ".KKWLK...", "..KYK....", ".KYKK....", "KYK.K....", "KK......."],
    ["......KKK", ".....KWWK", "....KWLK.", ".K.KWLK..", ".KKWLK...", "..KYK....", ".KYKK....", "KYK.K....", "KK......."]] },
};
for (const L of Object.values(TITLE_LOOK)) L.imgs = L.frames.map(f => gridToCanvas(f, L.pal));
// the badge on the title she wears: a red check in a white box, drawn pixel by pixel
const WEAR_CHECK = gridToCanvas(["KKKKKKKKK", "KWWWWWWWK", "KWWWWWWRK", "KWWWWWRRK", "KRWWWRRWK", "KRRWRRWWK", "KWRRRWWWK", "KWWRWWWWK", "KKKKKKKKK"],
  { K: OUT, W: "#ffffff", R: "#e2504a" }).toDataURL();
// the icon canvases on screen, each moving through its frames
const titleIcons = [];
const titleIcon = (id, k = 1) => `<canvas class="ticon" data-tid="${id}" width="9" height="9" style="width:${9 * k}px;height:${9 * k}px"></canvas>`;
function drawTitleIcons(now, root = document) {
  root.querySelectorAll("canvas.ticon").forEach(c => {
    const L = TITLE_LOOK[c.dataset.tid]; if (!L || !c.offsetParent) return;
    const ms = Array.isArray(L.ms) ? L.ms : L.frames.map(() => L.ms), total = ms.reduce((a, b) => a + b, 0);
    let t = now % total, f = 0; while (t >= ms[f]) { t -= ms[f]; f++; }
    if (c._f === f) return; c._f = f;
    const g = c.getContext("2d"); g.clearRect(0, 0, 9, 9); g.drawImage(L.imgs[f], 0, 0);
  });
}
// a title as a plate in its own colours (with its effect), for the board, the HUD and the cards
const titleStyle = id => { const L = TITLE_LOOK[id]; return L ? `--face:${L.face};--sh:${L.sh};--tink:${L.ink}` : ""; };
const titleFx = id => (TITLE_LOOK[id] && TITLE_LOOK[id].fx ? " fx " + TITLE_LOOK[id].fx.split(" ").map(c => "fx-" + c).join(" ") : "");
// study time per day, and how much of it fell outside the burning time, from every saved session and the one running
function studyDays() {
  const days = {};
  for (const t of [...S.sessions, ...(S.timer ? [S.timer] : [])]) for (const sg of t.segs) {
    if (sg.k !== "s") continue;
    for (let a = sg.a, b = segEnd(t, sg); a < b;) {
      const mid = new Date(a); mid.setHours(24, 0, 0, 0);
      const e = Math.min(b, nextBoundary(a), mid.getTime()), d = days[dkey(new Date(a))] || (days[dkey(new Date(a))] = { study: 0, outside: 0 });
      d.study += e - a; if (!isBurning(a)) d.outside += e - a;
      a = e;
    }
  }
  return days;
}
// which titles' conditions are met now (retroactive: the saved study records count; taps and being away are counted
// from when titles came in)
function titleChecks() {
  const R = TITLE_RULE, ts = titleState(), days = Object.values(studyDays()), goal = S.setup ? S.setup.goalMin * 60000 : Infinity;
  const all = [...S.sessions, ...(S.timer ? [S.timer] : [])];
  const goals = days.filter(d => d.study >= goal).length, total = days.reduce((a, d) => a + d.study, 0);
  const maxed = CHAR_ORDER.every(id => lvOf(curExp(id)) >= LEVEL.max);
  const ok = {
    first: goals >= 1,
    stylist: CHAR_ORDER.some(id => { const eq = equipOf(id); return ITEM_LIST[id].every(([, it]) => eq[it]); }),
    addict: ts.taps >= R.taps,
    easy: all.some(t => t.segs.some(sg => sg.k === "s" && segEnd(t, sg) - sg.a >= R.noRestMs)),
    overcome: goals >= R.goals,
    dawn: all.filter(t => new Date(t.segs[0].a).getHours() < R.dawnTo && sessionSums(t).study >= R.dawnMinMs).length >= R.dawnTimes,
    back: false,                                                   // (given when she starts studying after a week away)
    fireman: days.filter(d => d.study > 0 && d.outside === 0).length >= R.fireDays,
    dungeon: maxed && total >= R.masterHours * 3600000 && goals >= R.masterGoals,
  };
  ok.collector = maxed && TITLES.every(([id]) => id === "collector" || ts.got[id] || ok[id]);
  return ok;
}
// give every title whose condition is met now; each new one is announced in turn
const titleQueue = [];
function checkTitles() {
  const ts = titleState(), ok = titleChecks(); let any = false;
  for (const [id] of TITLES) if (ok[id] && !ts.got[id]) { ts.got[id] = Date.now(); titleQueue.push(id); any = true; }
  if (any) { save(); announceTitle(); }
}
function giveTitle(id) { const ts = titleState(); if (ts.got[id]) return; ts.got[id] = Date.now(); titleQueue.push(id); save(); announceTitle(); checkTitles(); }
let announcing = false;
function announceTitle() {
  if (announcing || !titleQueue.length) return;
  announcing = true;
  const id = titleQueue.shift();
  toast(`「${titleName(id)}」 칭호를 얻었어요!`, 3200, "칭호 획득!");
  { const t = $("#toast"); t.insertAdjacentHTML("afterbegin", titleIcon(id, 2)); t.querySelector(".ticon").classList.add("toast-ic"); drawTitleIcons(performance.now(), t); }
  if (S.pet) petCelebrate();
  if ($("#scr-settings").classList.contains("show")) renderSettings();
  if ($("#scr-titles").classList.contains("show")) renderTitles();
  setTimeout(() => { announcing = false; announceTitle(); }, 3400);
}
// away for a week: noted when the app opens; the title comes when she starts studying again
function noteReturn() {
  const ts = titleState(), now = Date.now();
  if (ts.seen && now - ts.seen >= TITLE_RULE.awayDays * 86400000) ts.back = true;
  ts.seen = now; save();
}
function titleOnStart() { const ts = titleState(); if (ts.back) { ts.back = false; giveTitle("back"); } }
function renderTitles() {
  const ts = titleState(), n = TITLES.filter(([id]) => ts.got[id]).length;
  $("#titles-body").innerHTML = `
    <p class="titles-count f-sm">모은 칭호 <b class="f-num s">${n}</b> / ${TITLES.length}</p>
    <div class="titles">${TITLES.map(([id, name]) => {
      const got = !!ts.got[id], worn = ts.worn === id;
      return got ? `<button class="ttl pxb got ${worn ? "worn" : ""}${titleFx(id)}" data-id="${id}" style="${titleStyle(id)}">${titleIcon(id)}<span class="nm">${esc(name)}</span>${worn ? `<img class="wear" src="${WEAR_CHECK}" alt="착용">` : ""}</button>`
        : `<button class="ttl pxb" data-id="${id}"><span class="q f-num">?</span></button>`;
    }).join("")}</div>
    <p class="hint f-sm" style="text-align:center;margin-top:7px">얻은 칭호를 누르면 달 수 있어요 · 단 칭호에 ✓</p>`;
  drawTitleIcons(performance.now(), $("#titles-body"));
  document.querySelectorAll("#titles-body .ttl").forEach(b => b.onclick = () => {
    const id = b.dataset.id;
    if (!ts.got[id]) { toast("아직 얻지 못한 칭호예요"); return; }
    const t = TITLES.find(x => x[0] === id), d = new Date(ts.got[id]), worn = ts.worn === id;
    openModal("칭호", `
      <div class="ttl-card pxp${titleFx(id)}" style="${titleStyle(id)}">${titleIcon(id, 2)}<p class="ttl-name t-high">${esc(t[1])}</p></div>
      <p class="f-sm" style="text-align:center">${esc(t[2])}</p>
      <p class="f-sm muted" style="text-align:center">${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} 획득</p>
      <div class="actions"><button class="btn pxb ${worn ? "" : "accent"}" id="ttl-wear">${worn ? "떼기" : "달기"}</button></div>`);
    drawTitleIcons(performance.now(), modalCard);
    $("#ttl-wear").onclick = () => { ts.worn = worn ? null : id; save(); closeModal(false); renderTitles(); updateHud(); };
  });
}
// the 칭호 row in settings: chained shut with a padlock until 첫걸음, then it opens with a sparkle (once)
const LOCK = ["..KKK..", ".K...K.", ".K...K.", "KKKKKKK", "KYYYYYK", "KYYKYYK", "KYYKYYK", "KYYYYYK", "KKKKKKK"];
function chainRow(row) {
  const w = row.offsetWidth, h = row.offsetHeight; if (!w) return;
  const cv = document.createElement("canvas"); cv.className = "chains"; cv.width = w; cv.height = h; row.appendChild(cv);
  const g = cv.getContext("2d");
  const link = (x, y, k) => { g.fillStyle = OUT; g.fillRect(x - 1, y - 1, 3, 3); g.fillStyle = k % 2 ? "#c9ced6" : "#9aa1ad"; g.fillRect(x, y, 1, 1); };
  for (const [x0, y0, x1, y1] of [[3, 3, w - 4, h - 4], [3, h - 4, w - 4, 3]]) {
    const n = Math.round(Math.hypot(x1 - x0, y1 - y0) / 3);
    for (let k = 0; k <= n; k++) link(Math.round(x0 + (x1 - x0) * k / n), Math.round(y0 + (y1 - y0) * k / n), k);
  }
  const lk = document.createElement("canvas"); lk.className = "padlock";
  const img = gridToCanvas(LOCK.map(r => r.replace(/\./g, "B")), { K: OUT, Y: "#ffd25e" }); lk.width = img.width; lk.height = img.height;
  lk.getContext("2d").drawImage(img, 0, 0); row.appendChild(lk);
}
function sparkleRow(row) {
  const w = row.offsetWidth, h = row.offsetHeight; if (!w) return;
  const cv = document.createElement("canvas"); cv.className = "chains"; cv.width = w; cv.height = h; row.appendChild(cv);
  const g = cv.getContext("2d"), stars = Array.from({ length: 12 }, (_, i) => ({ x: 6 + Math.random() * (w - 12), y: 3 + Math.random() * (h - 6), t: i * 90 }));
  const t0 = performance.now();
  const step = now => {
    const t = now - t0; g.clearRect(0, 0, w, h);
    if (t > 1500) { cv.remove(); return; }
    for (const s of stars) {
      const k = (t - s.t) / 500; if (k < 0 || k > 1) continue;
      const r = k < 0.5 ? Math.round(k * 6) : Math.round((1 - k) * 6), x = Math.round(s.x), y = Math.round(s.y);
      g.fillStyle = "#f5b83a"; g.fillRect(x - r, y, 2 * r + 1, 1); g.fillRect(x, y - r, 1, 2 * r + 1);
      if (r >= 2) { g.fillStyle = "#ffd96b"; g.fillRect(x - 1, y - 1, 3, 3); }
      g.fillStyle = "#ffffff"; g.fillRect(x, y, 1, 1);
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  row.animate([{ filter: "brightness(1.12) saturate(1.4)" }, { filter: "none" }], { duration: 900, easing: "ease-out" });
}

/* ---------- settings ---------- */
function renderSettings() {
  const c = CHARS[S.pet], lv = lvOf(curExp());
  const row = (go, hl, label, extra = "") => `<button class="row pxb" data-go="${go}" style="--hl:${hl}"><span class="mk"></span><span class="grow">${label}</span>${extra}${icon("next")}</button>`;
  $("#settings-body").innerHTML = `
    <div class="set-pic pxp"><canvas></canvas><div><div class="card-t">${c.name} <span class="f-num s muted">Lv.${lv}</span></div><p class="f-sm">${esc(c.trait)}</p></div></div>
    <div class="rows">
      ${row("tutorial", "#ffb3c7", "튜토리얼")}
      ${row("change", "#9fd3f5", "캐릭터 변경")}
      ${row("inventory", "#ffd96b", "인벤토리")}
      ${row("titles", "#d9cdff", "칭호", titleState().worn ? `<span class="f-sm muted">${esc(titleName(titleState().worn))}</span>` : "")}
      ${row("goal", "#b6ecae", "목표 순공 시간", `<span class="f-sm muted">${S.setup ? fmtDur(S.setup.goalMin * 60000) : ""}</span>`)}
      ${row("subjects", "#d9cdff", "과목 관리")}
      ${row("weather", "#c9e6ff", "날씨", `<span class="f-sm muted">${WX_NAME[WX.kind]} · ${S.weatherMode === "real" ? "실제" : "게임"}</span>`)}
    </div>
    <button class="row pxb reset-row" data-go="reset" style="--hl:#ff9a8a"><span class="mk"></span><span class="grow">처음부터 다시 시작</span>${icon("next")}</button>`;
  paintIcons($("#settings-body"));
  portrait($("#settings-body .set-pic canvas"), S.pet, true);
  { const ts = titleState(), tr = $('#settings-body [data-go="titles"]');
    if (!ts.got.first) { tr.classList.add("locked"); requestAnimationFrame(() => chainRow(tr)); }
    else if (!ts.menuShown) { ts.menuShown = true; save(); requestAnimationFrame(() => sparkleRow(tr)); } }
  document.querySelectorAll("#settings-body .row").forEach(r => r.onclick = () => {
    const g = r.dataset.go;
    if (g === "tutorial") { renderTutorialPage(); openScreen("scr-tutorial"); }
    if (g === "change") { renderSelect("change"); openScreen("scr-select"); }
    if (g === "inventory") { renderInventory(); openScreen("scr-inventory"); }
    if (g === "titles") {
      if (!titleState().got.first) { const lk = r.querySelector(".padlock"); if (lk) lk.animate([{ transform: "translateX(0)" }, { transform: "translateX(-1px)" }, { transform: "translateX(1px)" }, { transform: "translateX(-1px)" }, { transform: "translateX(0)" }], { duration: 320, easing: "steps(4)" });
        toast(`「${titleName("first")}」 칭호를 얻으면 열려요`); return; }
      renderTitles(); openScreen("scr-titles");
    }
    if (g === "goal") askSetup(false);
    if (g === "subjects") openSubjects();
    if (g === "weather") openWeather();
    if (g === "reset") confirmBox("세 친구의 레벨과 아이템, 공부 기록, 할 일, 과목이 전부 지워지고 처음 화면으로 돌아가요.<br>되돌릴 수 없어요.", "전부 지우기", () => {
      wiping = true;
      try { localStorage.removeItem(KEY); } catch (e) {}
      location.reload();
    });
  });
}
// where the weather comes from: the game's own (by season and time of day), or the real weather where the player is
function openWeather() {
  const render = () => {
    const real = S.weatherMode === "real";
    const status = !real ? "계절과 시간에 맞춰 게임이 날씨를 정해요." : WX.real ? `지금 계신 곳 날씨: ${WX_NAME[WX.real.kind]}` : WX.realErr ? `${WX.realErr}. 그동안은 게임 날씨로 보여요.` : "날씨를 불러오는 중…";
    openModal("날씨", `
      <div class="rows">
        <button class="row pxb ${real ? "" : "on"}" data-wm="game" style="--hl:#b6ecae"><span class="mk"></span><span class="grow">게임 날씨</span>${real ? "" : "✓"}</button>
        <button class="row pxb ${real ? "on" : ""}" data-wm="real" style="--hl:#9fd3f5"><span class="mk"></span><span class="grow">실제 날씨 (위치 사용)</span>${real ? "✓" : ""}</button>
      </div>
      <p class="hint f-sm">${esc(status)}</p>
      <p class="hint f-sm">실제 날씨는 위치를 Open-Meteo에 보내 30분마다 불러와요.</p>`);
    modalCard.querySelectorAll("[data-wm]").forEach(b => b.onclick = () => {
      S.weatherMode = b.dataset.wm; save();
      if (S.weatherMode === "real") fetchRealWeather(true);
      render(); renderSettings();
    });
  };
  onWeatherStatus = () => { if (!modal.hidden && modalCard.querySelector("[data-wm]")) render(); renderSettings(); };
  render();
}
let onWeatherStatus = null;
function openSubjects() {
  const render = () => {
    openModal("과목 관리", `
      <ul class="subj-list">${S.subjects.map(s => `<li><span class="sw" style="--c:${s.color}"></span><span class="grow">${esc(s.name)}</span><button class="btn pxb f-sm" data-del="${s.id}">지우기</button></li>`).join("")}</ul>
      <div class="row2"><input class="field" id="new-subj" maxlength="10" placeholder="새 과목"><button class="btn pxb accent" id="add-subj">추가</button></div>
      <p class="hint f-sm">지운 과목의 기록은 통계에 남아요</p>`);
    modalCard.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
      if (S.timer && S.timer.subjectId === b.dataset.del) { toast("지금 공부 중인 과목이에요"); return; }
      const s = S.subjects.find(x => x.id === b.dataset.del);
      S.subjects = S.subjects.filter(x => x.id !== s.id); S.removedSubjects = (S.removedSubjects || []).concat(s); save(); render();
    });
    const add = () => { const n = $("#new-subj").value.trim(); if (n) { addSubject(n); render(); } };
    $("#add-subj").onclick = add; $("#new-subj").onkeydown = e => { if (e.key === "Enter" && !e.isComposing) add(); };
  };
  render();
}

function renderTutorialPage() {
  $("#tutorial-body").innerHTML = `
    <div class="card pxp"><ol class="steps">${TUTORIAL_STEPS.map((t, i) => `<li>${numBadge(i + 1)}<span>${rich(t)}</span></li>`).join("")}</ol></div>
    <button class="btn big wide pxb accent" id="tut-again">다시 보기</button>`;
  paintIcons($("#tutorial-body"));
  $("#tut-again").onclick = () => { screenStack.slice().forEach(closeScreen); setTimeout(startCoach, 300); };
}

function renderInventory() {
  const lv = lvOf(curExp()), cs = charState(S.pet);
  $("#inventory-body").innerHTML = `
    <div class="inv-preview pxp"><canvas></canvas></div>
    <div class="slots">${ITEM_LIST[S.pet].map(([need, id, name, part]) => {
      const open = lv >= need, on = open && cs.equip[id];
      return `<button class="slot pxb ${on ? "on" : ""}" data-id="${id}" ${open ? "" : "disabled"} aria-pressed="${!!on}">
        ${open ? "<canvas></canvas>" : '<span class="q f-num">?</span>'}
        <span class="nm">${open ? esc(name) : "???"}</span>
        <span class="sub f-xs">${on ? "착용 중" : open ? `Lv.${need} · ${part}` : `Lv.${need}`}</span></button>`;
    }).join("")}</div>
    <p class="hint t-low" style="text-align:center;margin-top:7px">누르면 붙였다 뗐다 할 수 있어요…</p>`;
  portrait($("#inventory-body .inv-preview canvas"), S.pet, true, 166, 64, miniWorld);
  document.querySelectorAll("#inventory-body .slot").forEach(b => {
    const id = b.dataset.id, cv = b.querySelector("canvas");
    if (cv) {
      const it = itemImg(S.pet, id); cv.width = 34; cv.height = 30;
      const g = cv.getContext("2d"), kk = it.img.width > 34 || it.img.height > 30 ? 0.5 : 1;   // big items shown at half size
      g.imageSmoothingEnabled = false;
      const w = Math.round(it.img.width * kk), h = Math.round(it.img.height * kk);
      g.drawImage(it.img, (34 - w) >> 1, (30 - h) >> 1, w, h);
    }
    if (!b.disabled) b.onclick = () => { cs.equip[id] = !cs.equip[id]; save(); G.equip = equipOf(S.pet); renderInventory(); checkTitles(); };
  });
}

/* ---------- tutorial coach marks ---------- */
let coachStep = -1, coachTarget = null;
function startCoach() {
  if (!S.pet) return;
  coachStep = -1; $("#coach").hidden = false; appEl.classList.add("coaching"); petHold(true);
  setSide(true); nextCoach();
}
function nextCoach() {
  coachStep++;
  if (coachTarget) { coachTarget.classList.remove("coach-target"); coachTarget = null; }
  const card = $("#coach .coach-card");
  if (coachStep >= TUTORIAL.length) return endCoach();
  const st = TUTORIAL[coachStep];
  card.classList.remove("fly"); card.style.transform = "";
  const p = card.querySelector("p");
  p.innerHTML = (st.num ? numBadge(st.num) + " " : "") + rich(st.text); paintIcons(p);
  card.style.visibility = "hidden"; fontsReady(card).then(() => { card.style.visibility = ""; });
  card.querySelector("small").textContent = coachStep === TUTORIAL.length - 1 ? "눌러서 시작하기" : "눌러서 계속";
  if (st.target) { coachTarget = $(st.target); coachTarget.classList.add("coach-target"); }
  placeCoachCard();
  if (st.fly) card.dataset.fly = "1"; else delete card.dataset.fly;
}
function placeCoachCard() {
  const card = $("#coach .coach-card");
  const box = pet.box || { x: pet.x - 14, y: FEET - 30, w: 28 };
  placeBubble(card, box.x + box.w / 2, box.y, 100);
}
function endCoach() {
  $("#coach").hidden = true; appEl.classList.remove("coaching"); petHold(false);
  S.tutorialDone = true; save(); coachStep = -1;
  say(pick(CHARS[S.pet].cheers));
}
$("#coach").addEventListener("click", () => {
  const card = $("#coach .coach-card");
  if (card.dataset.fly && !card.classList.contains("fly")) {
    // the explanation shrinks and flies into the settings tab, so you know where to find it again
    const t = $("#tab-settings").getBoundingClientRect(), c = card.getBoundingClientRect();
    const dx = Math.round((t.left + t.width / 2 - (c.left + c.width / 2)) / K), dy = Math.round((t.top + t.height / 2 - (c.top + c.height / 2)) / K);
    card.classList.add("fly");
    card.style.transform = `translate(${dx}px, ${dy}px) scale(.1)`;
    setTimeout(() => { nextCoach(); $("#tab-settings").animate([{ transform: "translateY(0)" }, { transform: "translateY(-2px)" }, { transform: "translateY(0)" }], { duration: 300, easing: "steps(3)" }); }, 800);
    return;
  }
  if (!card.classList.contains("fly")) nextCoach();
});

/* ---------- input on the world ---------- */
const toGame = e => { const r = appEl.getBoundingClientRect(); return [(e.clientX - r.left) / K, (e.clientY - r.top) / K]; };
stage.addEventListener("pointerdown", e => {
  const [x, y] = toGame(e);
  if (petPointerDown(e, x, y)) { try { stage.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault(); }
});
stage.addEventListener("pointermove", e => { const [x, y] = toGame(e); petPointerMove(e, x, y); });
stage.addEventListener("pointerup", e => petPointerUp(e));
stage.addEventListener("pointercancel", e => petPointerUp(e));
stage.addEventListener("contextmenu", e => e.preventDefault());
onPetTap = () => {
  if (performance.now() > bubbleUntil - 1000) say(pick(CHARS[S.pet].cheers), 2600);
  const ts = titleState(); ts.taps++; save(); if (ts.taps === TITLE_RULE.taps) checkTitles();
};

/* ---------- main loop ---------- */
let prev = performance.now(), hudT = 0, titleT = 0, ticonT = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.max(0, Math.min(100, now - prev)); prev = now;
  try {
    sceneUpdate(now, dt);
    weatherUpdate(now, dt);
    if (S.pet) petUpdate(now, dt);
    if (now - hudT > 250) { hudT = now; updateHud(); }
    if (S.pet && now - titleT > 5000) { titleT = now; titleState().seen = Date.now(); if (coachStep < 0) checkTitles(); }
    sceneRender(now, signInfo());
    shakeLayer(sctx, bg, false);
    if (S.pet) petRender(now); else ctx.clearRect(0, 0, W, H);
    if (S.pet && typeof sceneTint === "function") sceneTint(ctx, now);   // the sky's light on her
    if (S.pet && typeof sceneFront === "function") sceneFront(ctx, now);   // a butterfly passing in front of her (already lit)
    weatherFront(ctx, now);
    shakeLayer(ctx, fg, true);
    drawPortraits(now);
    if (now - ticonT > 60) { ticonT = now; drawTitleIcons(now); }
    // bubbles follow the pet and the passing cloud
    if (!petBubble.hidden) {
      if (now > bubbleUntil || !pet.box) petBubble.hidden = true;
      else placeBubble(petBubble, pet.box.x + pet.box.w / 2, pet.box.y);
    }
    const ws = sceneSpeech(now);
    worldBubble.hidden = !ws;
    if (ws) { const bb = worldBubble.firstElementChild; if (bb.textContent !== ws.text) bb.textContent = ws.text; placeBubble(worldBubble, ws.x, ws.y); }
    if (coachStep >= 0) placeCoachCard();
    // cheers now and then
    if (S.pet && coachStep < 0 && modal.hidden) {
      const st = timerState(), every = st === "run" ? CHEER_EVERY_MS : IDLE_CHEER_EVERY_MS;
      if (st !== "rest" && now - lastCheer > every) { lastCheer = now; say(pick(CHARS[S.pet].cheers)); if (st === "run") petHop(2); }
    }
  } catch (err) { console.error(err); }
}

/* ---------- boot ---------- */
layout();
setSide(S.sideOpen !== false);
if (S.timer && S.timer.endAt) { S.timer.endAt = null; save(); }      // the end card was open when the page closed
noteReturn();
{ const hl = $("#hud-lv"), ht = document.createElement("span"); ht.id = "hud-title"; ht.className = "f-xs"; ht.hidden = true; hl.after(ht); }
if (S.pet) {
  setPet(S.pet); syncControls();
  if (!S.setup) askSetup(true);
  else if (!S.tutorialDone) setTimeout(startCoach, 600);
} else { renderSelect("first"); openScreen("scr-select"); }
addEventListener("visibilitychange", save);
addEventListener("pagehide", save);
// wait for the pixel fonts so the first frame is never drawn in a fallback font
// every face is fetched up front (the ones the first screens need are waited for), so nothing appears in a fallback
// font or as an empty bubble the first time it is used
const FACES = ["PF", "Galmuri11", "Galmuri14", "Ramche", "PFSX", "Galmuri9", "Galmuri11B", "Galmuri11C", "GalmuriMono9", "Mulmaru", "Silver", "Roborobo", "PFS"];
const loader = document.getElementById("loader"), loaderBar = loader.querySelector("i");
{ const id = appEl.dataset.pet || "mochi", g = document.getElementById("loader-pet");   // the chosen pet hops while the fonts arrive
  const img = gridToCanvas(SPRITES[id], PET[id].pal); g.width = img.width; g.height = img.height; g.getContext("2d").drawImage(img, 0, 0); }
let loaded = 0;
const faceLoads = document.fonts ? FACES.map(f => document.fonts.load(`16px "${f}"`, "가나다Aa1").catch(() => {})
  .then(() => { loaded++; loaderBar.style.width = Math.round(8 + 92 * loaded / FACES.length) + "%"; })) : [];
Promise.all(faceLoads.slice(0, 6)).then(() => {
  requestAnimationFrame(loop);
  loaderBar.style.width = "100%";
  setTimeout(() => { loader.classList.add("done"); setTimeout(() => loader.remove(), 300); }, 200);
});
