/* The study app around the pet: character choice, study timer (start / rest / end), levels and items,
   to-do list, statistics, settings, the first-time tutorial. Everything is saved in this browser (localStorage). */
"use strict";

const $ = s => document.querySelector(s);
const appEl = $("#app"), stage = $("#stage");
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- saved state ---------- */
const KEY = "pixelpet.study.v1";
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
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
function charState(id) { return S.chars[id] || (S.chars[id] = { exp: 0, equip: {}, shownLv: 1 }); }
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ---------- time helpers ---------- */
const pad = n => String(n).padStart(2, "0");
const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayKey = () => dkey(new Date());
const parseKey = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
function fmtDur(ms) {
  const m = Math.floor(ms / 60000), h = Math.floor(m / 60);
  return h ? `${h}시간 ${m % 60 ? (m % 60) + "분" : ""}`.trim() : `${m}분`;
}
function fmtTimer(ms) {
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60;
  return h ? `${h}:${pad(m)}` : `${pad(m)}:${pad(s % 60)}`;
}
const fmtShort = ms => { const m = Math.floor(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)}:${pad(m % 60)}` : `${m}분`; };
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

/* ---------- layout: the world is 180 game pixels wide, as tall as the screen allows ---------- */
let sx = 2, sy = 2;
function layout() {
  const r = appEl.getBoundingClientRect();
  sx = r.width / W;
  H = Math.max(300, Math.min(460, Math.round(r.height / sx)));
  sy = r.height / H;
  FEET = H - 76; PEEK_BOT = H; TOP_Y = 44;          // close-ups rise from behind the button bar
  fg.width = W; fg.height = H;
  sceneResize();
  pet.x = Math.max(20, Math.min(W - 20, pet.x));
}
addEventListener("resize", layout);

/* ---------- pixel icons for the side tab ---------- */
const TAB_ICONS = {
  "tab-stats": [
    "...KKKKK...", "..KWWWWWK..", ".KWWWKWWWK.", "KWWWWKWWWWK", "KWWWWKWWWWK", "KWWWWKKKWWK", "KWWWWWWWWWK", ".KWWWWWWWK.", "..KWWWWWK..", "...KKKKK...",
  ],
  "tab-todo": [
    ".K..K..K..", "KKKKKKKKKK", "KRRRRRRRRK", "KKKKKKKKKK", "KWWWWWWWWK", "KWKWKWKWWK", "KWWWWWWWWK", "KWKWKWKWWK", "KWWWWWWWWK", "KKKKKKKKKK",
  ],
  "tab-settings": [
    "....KKK....", ".KK.KGK.KK.", ".KGKKGKKGK.", "..KGGGGGK..", "KKKGGKGGKKK", "KGGGK.KGGGK", "KKKGGKGGKKK", "..KGGGGGK..", ".KGKKGKKGK.", ".KK.KGK.KK.", "....KKK....",
  ],
};
for (const id in TAB_ICONS) {
  const rows = TAB_ICONS[id], w = Math.max(...rows.map(r => r.length));
  const c = gridToCanvas(rows.map(r => r.padEnd(w, ".")), { K: OUT, W: "#fffdf6", R: "#ff9db4", G: "#c9d1e0" });
  $("#" + id + " img").src = c.toDataURL();
}

/* ---------- portraits (character cards, settings, inventory, to-do) ---------- */
const portraits = [];
function portrait(canvas, id, withItems, size = 44) {
  canvas.width = size; canvas.height = size;
  const p = { canvas, id, withItems, phase: Math.random() * 1000 };
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
    drawSprite(g, p.id, pose, p.canvas.width / 2, p.canvas.height - 3, 1, p.withItems ? equipOf(p.id) : null, false);
  }
}
function drawHudFace() {
  const c = $("#hud-face"), g = c.getContext("2d"), id = S.pet || "mochi";
  const img = frame(id, BASE_POSE()), top = id === "nori" ? 8 : 0;
  c.width = 29; c.height = 22; g.clearRect(0, 0, 29, 22);
  g.drawImage(img, 0, top, 29, 22, 0, 0, 29, 22);
}

/* ---------- bubbles ---------- */
const petBubble = $("#pet-bubble"), worldBubble = $("#world-bubble");
let bubbleUntil = 0;
function say(textStr, ms = 4000) {
  petBubble.textContent = textStr; petBubble.hidden = false;
  petBubble.classList.remove("pop"); void petBubble.offsetWidth; petBubble.classList.add("pop");
  bubbleUntil = performance.now() + ms;
}
function placeBubble(el, gx, gy) {
  const r = appEl.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
  let left = gx * sx - w / 2; left = Math.max(8, Math.min(r.width - w - 8, left));
  el.style.left = left + "px"; el.style.top = Math.max(70, gy * sy - h - 12) + "px";
  el.style.setProperty("--tail", Math.max(14, Math.min(w - 14, gx * sx - left)) + "px");
}
let lastCheer = performance.now();
const pick = a => a[Math.random() * a.length | 0];

/* ---------- toast ---------- */
let toastT = 0;
function toast(msg, ms = 2600) {
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  t.style.animation = "none"; void t.offsetWidth; t.style.animation = "";
  clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, ms);
}

/* ---------- screens and modals ---------- */
let screenStack = [];
function openScreen(id) {
  const el = $("#" + id);
  if (!screenStack.includes(id)) screenStack.push(id);
  el.classList.add("show");
  el.style.zIndex = 30 + screenStack.length;
}
function closeScreen(id) {
  $("#" + id).classList.remove("show");
  screenStack = screenStack.filter(s => s !== id);
}
document.querySelectorAll("[data-back]").forEach(b => b.addEventListener("click", () => closeScreen(b.closest(".screen").id)));

const modal = $("#modal"), modalCard = $("#modal .modal-card");
let modalClose = null;
function openModal(html, onClose) {
  modalCard.innerHTML = html; modal.hidden = false; modalClose = onClose || null;
  const x = modalCard.querySelector(".x"); if (x) x.onclick = () => closeModal(true);
}
function closeModal(cancelled) { modal.hidden = true; modalCard.innerHTML = ""; const f = modalClose; modalClose = null; if (cancelled && typeof f === "function") f(); }
modal.addEventListener("pointerdown", e => { if (e.target === modal && modalClose !== "lock") closeModal(true); });
function confirmBox(msg, okLabel, onOk, cancelLabel = "취소") {
  openModal(`<h3>${msg}</h3><div class="modal-actions"><button class="btn" data-no>${cancelLabel}</button><button class="btn primary" data-ok>${okLabel}</button></div>`);
  modalCard.querySelector("[data-no]").onclick = () => closeModal(true);
  modalCard.querySelector("[data-ok]").onclick = () => { closeModal(false); onOk(); };
}

/* ---------- character select (first time and "캐릭터 변경") ---------- */
let selMode = "first", selPick = null, typer = 0;
function typeText(el, s) {
  clearInterval(typer); el.textContent = ""; let i = 0;
  typer = setInterval(() => { el.textContent = s.slice(0, ++i); if (i >= s.length) clearInterval(typer); }, 28);
}
function renderSelect(mode) {
  selMode = mode; selPick = mode === "change" ? S.pet : null;
  $("#scr-select .back").hidden = mode === "first";
  $("#sel-note").hidden = mode === "first";
  $("#sel-bubble").textContent = mode === "first" ? "마음에 드는 친구를 눌러 봐!" : "누구랑 같이 공부할래?";
  const row = $("#sel-row"); row.innerHTML = "";
  for (const id of CHAR_ORDER) {
    const c = CHARS[id], b = document.createElement("button");
    b.className = "sel-card"; b.dataset.id = id;
    b.style.setProperty("--c", c.color); b.style.setProperty("--c-soft", c.soft);
    b.innerHTML = `<canvas></canvas><span>${c.name}</span>`;
    b.setAttribute("aria-pressed", id === selPick);
    portrait(b.querySelector("canvas"), id, mode === "change");
    b.onclick = () => selectChar(id);
    row.appendChild(b);
  }
  updateSelInfo();
}
function selectChar(id) {
  selPick = id;
  document.querySelectorAll(".sel-card").forEach(b => b.setAttribute("aria-pressed", b.dataset.id === id));
  const p = portraits.find(p => p.canvas.closest(".sel-card")?.dataset.id === id); if (p) p.happy = performance.now() + 900;
  typeText($("#sel-bubble"), CHARS[id].intro);
  updateSelInfo();
}
function updateSelInfo() {
  const info = $("#sel-info");
  if (!selPick) { info.hidden = true; $("#sel-ok").disabled = true; return; }
  const c = CHARS[selPick], lv = S.chars[selPick] ? lvOf(curExp(selPick)) : 1;
  info.hidden = false;
  info.innerHTML = `<p>이름 : ${c.name}</p><p>특징 : ${c.trait}</p>${selMode === "change" && S.chars[selPick] ? `<p class="muted">지금 Lv.${lv}</p>` : ""}`;
  $("#sel-ok").disabled = selMode === "change" && selPick === S.pet;
}
$("#sel-ok").onclick = () => {
  const id = selPick; if (!id) return;
  if (selMode === "first") { setPet(id); closeScreen("scr-select"); askSetup(true); return; }
  if (S.timer) { toast("공부 중에는 바꿀 수 없어요. 먼저 [끝]을 눌러 주세요."); return; }
  const had = S.chars[id] && S.chars[id].exp > 0;
  const msg = had ? `${CHARS[id].name}(으)로 바꿀까요?<br><small class="muted">기존 데이터는 유지되고, ${CHARS[id].name}는 Lv.${lvOf(curExp(id))}부터 이어서 해요.</small>`
                  : `${CHARS[id].name}(으)로 바꿀까요?<br><small class="muted">기존 데이터는 유지가 되지만 새 캐릭터는 1레벨부터 다시 시작합니다.</small>`;
  confirmBox(msg, "바꾸기", () => {
    setPet(id); screenStack.slice().forEach(closeScreen); say(pick(CHARS[id].cheers));
  });
};
function setPet(id) {
  S.pet = id; charState(id); save();
  appEl.dataset.pet = id;
  petReset(id);
  drawHudFace();
  lastLv = lvOf(curExp());
}

/* ---------- first-run study time setup (also editable in settings) ---------- */
function askSetup(first) {
  const s = S.setup || { myMin: 120, goalMin: 180 };
  openModal(`
    ${first ? "" : '<button class="x" aria-label="닫기">✕</button>'}
    <span class="label-hl">나의 순공 시간?</span>
    <div class="time-in"><input type="number" min="0" max="24" id="my-h" value="${Math.floor(s.myMin / 60)}">시간
      <input type="number" min="0" max="59" step="5" id="my-m" value="${s.myMin % 60}">분 <span class="muted">(하루)</span></div>
    <span class="label-hl">목표 순공 시간?</span>
    <div class="time-in"><input type="number" min="0" max="24" id="goal-h" value="${Math.floor(s.goalMin / 60)}">시간
      <input type="number" min="0" max="59" step="5" id="goal-m" value="${s.goalMin % 60}">분 <span class="muted">(하루)</span></div>
    <p class="warn">(단, 달성 가능한 시간으로 설정 부탁!)</p>
    <button class="btn peach wide" id="setup-ok">확인</button>`, first ? "lock" : null);
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
    openModal(`<button class="x" aria-label="닫기">✕</button>
      <h3>무슨 공부 할 거야?</h3>
      <div class="chips">${S.subjects.map(s => `<button class="chip" data-id="${s.id}" style="--c:${s.color}" aria-pressed="${s.id === startPick}">${esc(s.name)}</button>`).join("")}</div>
      <div class="todo-add"><input class="field" id="new-subj" maxlength="12" placeholder="과목 추가"><button class="btn small" id="add-subj">추가</button></div>
      <p class="hint">과목을 골라야 시작할 수 있어요.</p>
      <div class="modal-actions"><button class="btn primary" id="go" ${startPick ? "" : "disabled"}>시작!</button></div>`);
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
  save(); syncControls();
  petHop(3); say(CHARS[S.pet].start, 2600); lastCheer = performance.now();
}
function openEndModal() {
  const t = S.timer; if (!t.endAt) t.endAt = Date.now(); save();
  const sum = sessionSums(t), sb = subj(t.subjectId), todos = S.todos[todayKey()] || [];
  const lvGain = Math.min(sum.exp, MAX_EXP - charState(t.pet).exp);
  openModal(`<button class="x" aria-label="닫기">✕</button>
    <h3>기록할까?</h3>
    <dl class="summary">
      <dt>과목</dt><dd><span class="tag" style="--c:${sb.color}">${esc(sb.name)}</span></dd>
      <dt>순공</dt><dd>${fmtDur(sum.study)}</dd>
      <dt>휴식</dt><dd>${fmtDur(sum.rest)}</dd>
      <dt>경험치</dt><dd>+${Math.round(Math.max(0, lvGain) * 100)}% 레벨 ${sum.burn ? '<span class="burn">버닝</span>' : ""}</dd>
    </dl>
    <span class="label-hl">무엇을 했어?</span>
    <textarea class="field" id="end-note" maxlength="300" placeholder="${esc(CHARS[t.pet].note)}"></textarea>
    ${todos.length ? `<p class="hint">끝낸 할 일이 있으면 체크해요</p><ul class="mini-todos">${todos.map(td => `<li><label><input type="checkbox" data-id="${td.id}" ${td.done ? "checked" : ""}>${esc(td.text)}</label></li>`).join("")}</ul>` : ""}
    <div class="modal-actions"><button class="btn" id="end-drop">기록 안 할래</button><button class="btn primary" id="end-save">기록하기</button></div>`,
    () => { t.endAt = null; save(); });      // closed: keep going
  modalCard.querySelectorAll(".mini-todos input").forEach(cb => cb.onchange = () => {
    const td = todos.find(x => x.id === cb.dataset.id); if (td) { td.done = cb.checked; save(); }
  });
  $("#end-save").onclick = () => { const note = $("#end-note").value.trim(); closeModal(false); finishSession(true, note); };
  $("#end-drop").onclick = () => {
    confirmBox("기록하지 않으면 이번 공부 시간과 경험치가 사라져요. 괜찮아?", "기록 안 할래", () => finishSession(false, ""), "돌아가기");
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
  if (keep) { say(CHARS[S.pet].end, 3000); petHop(4); toast("기록했어요!"); }
  else { const l = lvOf(curExp()); lastLv = l; charState(S.pet).shownLv = l; save(); }
}
function syncControls() {
  const st = timerState();
  btnStart.classList.toggle("running", st !== "idle");
  btnStart.querySelector(".ctl-main").textContent = st === "idle" ? "시작" : "공부 중";
  btnStart.querySelector(".ctl-sub").textContent = st === "idle" ? "" : subj(S.timer.subjectId).name;
  btnRest.disabled = st === "idle"; btnEnd.disabled = st === "idle";
  btnRest.classList.toggle("resting", st === "rest");
  btnRest.querySelector(".ctl-main").textContent = st === "rest" ? "다시 시작" : "휴식";
  G.studying = st === "run";
  petSetSleep(st === "rest");
}

/* ---------- HUD and level ups ---------- */
let lastLv = 1;
function updateHud() {
  if (!S.pet) return;
  const e = curExp(), lv = lvOf(e), frac = lv >= LEVEL.max ? 1 : e - Math.floor(e);
  const burning = isBurning(Date.now());
  $("#hud-lv").textContent = `Lv.${lv}`;
  $("#hud-bar").style.width = (frac * 100).toFixed(1) + "%";
  $("#hud-burn").hidden = !burning;
  const bar = $("#hud .bar"); bar.classList.toggle("burning", burning); bar.classList.toggle("max", lv >= LEVEL.max);
  $("#hud-next").textContent = lv >= LEVEL.max ? "MAX" : `다음 레벨까지 ${Math.ceil((1 - frac) * (burning ? LEVEL.burnMin : LEVEL.normalMin))}분`;
  const cs = charState(S.pet);
  if (lv > (cs.shownLv || 1)) {
    const fresh = ITEM_LIST[S.pet].filter(([need]) => need > (cs.shownLv || 1) && need <= lv);
    fresh.forEach(([, id]) => cs.equip[id] = true);
    cs.shownLv = lv; save();
    petCelebrate(); say(CHARS[S.pet].levelup, 3500);
    toast(fresh.length ? `Lv.${lv} 달성! 새 아이템: ${fresh.map(f => f[2]).join(", ")}` : `Lv.${lv} 달성!`, 3600);
  } else if (lv < (cs.shownLv || 1)) { cs.shownLv = lv; save(); }
  lastLv = lv;
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
function setSide(open) { side.classList.toggle("open", open); S.sideOpen = open; save(); }
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
function donut(parts, center, sub) {
  const total = parts.reduce((a, p) => a + p.v, 0), R = 40, C = 2 * Math.PI * R;
  let off = 0, arcs = "";
  if (!total) arcs = `<circle r="${R}" cx="60" cy="60" fill="none" stroke="#eadfc8" stroke-width="18"/>`;
  else for (const p of parts) {
    if (!p.v) continue;
    const len = p.v / total * C;
    arcs += `<circle r="${R}" cx="60" cy="60" fill="none" stroke="${p.c}" stroke-width="18" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 60 60)"/>`;
    off += len;
  }
  return `<svg viewBox="0 0 120 120" role="img" aria-label="${esc(center)}">${arcs}
    <circle r="${R + 10}" cx="60" cy="60" fill="none" stroke="${OUT}" stroke-width="2"/><circle r="${R - 10}" cx="60" cy="60" fill="#fffdf6" stroke="${OUT}" stroke-width="2"/>
    <text x="60" y="${sub ? 58 : 65}" text-anchor="middle" font-size="${sub ? 14 : 15}" fill="${OUT}" font-family="Jua, sans-serif">${esc(center)}</text>
    ${sub ? `<text x="60" y="75" text-anchor="middle" font-size="11" fill="#9b8e7a" font-family="Jua, sans-serif">${esc(sub)}</text>` : ""}</svg>`;
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
  $("#stats-body").innerHTML = `
    <div class="date-nav">
      <button class="nav-btn" id="d-prev" aria-label="이전 날">‹</button>
      <label class="date-chip">${day.getFullYear()}.${pad(day.getMonth() + 1)}.${pad(day.getDate())} ▾<input type="date" id="d-pick" value="${statsDay}" max="${todayKey()}"></label>
      <button class="nav-btn" id="d-next" aria-label="다음 날" ${isToday ? "disabled" : ""}>›</button>
    </div>
    <div class="card" id="day-card">
      <div class="donuts">
        <div class="donut-box"><h4>하루 과목</h4>${donut(parts.map(p => ({ v: p.v, c: p.c })), study ? fmtShort(study) : "기록 없음", study ? "순공" : "")}</div>
        <div class="donut-box"><h4>공부 & 휴식</h4>${donut([{ v: study, c: "#ffe58a" }, { v: rest, c: "#b9b4c9" }], study + rest ? Math.round(study / (study + rest) * 100) + "%" : "-", study + rest ? "공부" : "")}</div>
      </div>
      <ul class="legend">${parts.map(p => `<li><span class="dot" style="background:${p.c}"></span>${esc(p.n)}<b>${fmtDur(p.v)}</b></li>`).join("") || '<li class="muted">이 날은 아직 공부 기록이 없어요. 옆으로 밀어서 다른 날을 볼 수 있어요.</li>'}
        ${rest ? `<li><span class="dot" style="background:#b9b4c9"></span>휴식<b>${fmtDur(rest)}</b></li>` : ""}</ul>
    </div>
    ${goal ? `<div class="card"><h3>목표 순공 시간 <small class="muted">(임시)</small></h3>
      <div>${fmtDur(goal)} 중 <b>${fmtDur(study)}</b> · ${pct}%</div><div class="goal-bar"><i style="width:${pct}%"></i></div></div>` : ""}
    <div class="card">
      <div class="donuts">
        <div><h3>총 공부 시간</h3><div class="big-num">${Math.floor(totStudy / 3600000)}<small>시간</small> ${Math.floor(totStudy / 60000) % 60}<small>분</small></div><p class="muted" style="margin:2px 0 0;font-size:13px">(공부 시간만)</p></div>
        <div class="donut-box"><h4>공부 & 휴식</h4>${donut([{ v: totStudy, c: "#ffe58a" }, { v: totRest, c: "#b9b4c9" }], totStudy + totRest ? Math.round(totStudy / (totStudy + totRest) * 100) + "%" : "-", totStudy + totRest ? "공부" : "")}</div>
      </div>
    </div>
    ${daySess.length ? `<div class="card"><h3>이 날의 기록</h3><ul class="sess">${daySess.map(s => {
      const sb = subj(s.subjectId), st = new Date(s.segs[0].a), en = new Date(s.segs[s.segs.length - 1].b ?? Date.now());
      return `<li><span class="tag" style="--c:${sb.color}">${esc(sb.name)}</span> ${fmtHM(st)}~${s.live ? "지금" : fmtHM(en)} · 순공 ${fmtDur(clipSum(s.segs, 0, 9e15, "s"))} <span class="muted">· ${CHARS[s.pet] ? CHARS[s.pet].name : ""}</span>
        ${s.note ? `<div class="note">${esc(s.note)}</div>` : ""}</li>`; }).join("")}</ul></div>` : ""}`;
  const go = d => { const x = parseKey(statsDay); x.setDate(x.getDate() + d); if (dkey(x) > todayKey()) return; statsDay = dkey(x); renderStats(); };
  $("#d-prev").onclick = () => go(-1); $("#d-next").onclick = () => go(1);
  $("#d-pick").onchange = e => { if (e.target.value) { statsDay = e.target.value > todayKey() ? todayKey() : e.target.value; renderStats(); } };
  let x0 = null;
  const card = $("#day-card");
  card.onpointerdown = e => { x0 = e.clientX; };
  card.onpointerup = e => { if (x0 === null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); };
}

/* ---------- to-do list ---------- */
let todoEdit = false, todoAdding = false;
function todayTodos() { const k = todayKey(); return S.todos[k] || (S.todos[k] = []); }
function renderTodo() {
  const list = todayTodos(), c = CHARS[S.pet], allDone = list.length && list.every(t => t.done);
  $("#todo-body").innerHTML = `
    <div class="card todo-hero">
      <div class="pic"><canvas></canvas></div>
      <div><h3>오늘 할 일 <button class="plus" id="todo-plus" aria-label="할 일 추가">+</button></h3><p>${esc(allDone ? c.todoDone : c.todo)}</p></div>
    </div>
    ${todoAdding ? `<div class="card"><span class="label-hl">할 일</span><div class="todo-add"><input class="field" id="todo-in" maxlength="60" placeholder="예) 수학 문제집 3쪽"><button class="btn primary small" id="todo-add">추가</button></div></div>` : ""}
    <div class="todo-tools"><span>${list.filter(t => t.done).length} / ${list.length} 완료</span>
      ${list.length ? `<button class="btn small" id="todo-edit">${todoEdit ? "완료" : "✎ 수정"}</button>` : ""}</div>
    <ul class="todo-list" id="todo-list">${list.map(t => `
      <li data-id="${t.id}" class="${t.done ? "done" : ""}">
        ${todoEdit ? "" : `<button class="chk" aria-label="완료 표시">${t.done ? "✓" : ""}</button>`}
        ${todoEdit ? `<input class="t" value="${esc(t.text)}" maxlength="60" aria-label="할 일 고치기">` : `<span class="t">${esc(t.text)}</span>`}
        ${todoEdit ? `<button class="del" aria-label="지우기">⊗</button><button class="grip" aria-label="끌어서 순서 바꾸기">≡</button>` : ""}
      </li>`).join("")}</ul>
    ${list.length ? "" : '<p class="empty">+ 를 눌러서 오늘 할 일을 적어 봐요</p>'}`;
  portrait($("#todo-body .pic canvas"), S.pet, true);
  $("#todo-plus").onclick = () => { todoAdding = !todoAdding; renderTodo(); if (todoAdding) $("#todo-in").focus(); };
  if (todoAdding) {
    const add = () => { const v = $("#todo-in").value.trim(); if (!v) return; list.push({ id: uid(), text: v, done: false }); save(); renderTodo(); $("#todo-in").focus(); };
    $("#todo-add").onclick = add; $("#todo-in").onkeydown = e => { if (e.key === "Enter" && !e.isComposing) add(); };
  }
  const editBtn = $("#todo-edit"); if (editBtn) editBtn.onclick = () => { todoEdit = !todoEdit; renderTodo(); };
  document.querySelectorAll("#todo-list li").forEach(li => {
    const t = list.find(x => x.id === li.dataset.id);
    const chk = li.querySelector(".chk");
    if (chk) chk.onclick = () => {
      t.done = !t.done; save(); renderTodo();
      if (t.done) { petHop(2); if (list.every(x => x.done)) { say(c.todoDone, 3000); } }
    };
    const inp = li.querySelector("input.t"); if (inp) inp.onchange = () => { const v = inp.value.trim(); if (v) { t.text = v; save(); } };
    const del = li.querySelector(".del"); if (del) del.onclick = () => { list.splice(list.indexOf(t), 1); save(); renderTodo(); };
    const grip = li.querySelector(".grip"); if (grip) grip.onpointerdown = e => dragTodo(e, li, list);
  });
}
function dragTodo(e, li, list) {
  e.preventDefault();
  const ul = li.parentElement;
  li.classList.add("dragging");
  const move = ev => {
    for (const s of ul.children) {
      if (s === li) continue;
      const r = s.getBoundingClientRect();
      if (ev.clientY > r.top && ev.clientY < r.bottom) { ul.insertBefore(li, ev.clientY > r.top + r.height / 2 ? s.nextSibling : s); break; }
    }
  };
  const up = () => {
    removeEventListener("pointermove", move); removeEventListener("pointerup", up); removeEventListener("pointercancel", up);
    const order = [...ul.children].map(x => x.dataset.id);
    list.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)); save(); renderTodo();
  };
  addEventListener("pointermove", move); addEventListener("pointerup", up); addEventListener("pointercancel", up);
}

/* ---------- settings ---------- */
function renderSettings() {
  const c = CHARS[S.pet], lv = lvOf(curExp());
  $("#settings-body").innerHTML = `
    <div class="set-pic"><canvas></canvas><div><h3>${c.name} <small class="muted">Lv.${lv}</small></h3><p>${esc(c.trait)}</p></div></div>
    <div class="rows">
      <button class="row" data-go="tutorial" style="--hl:#ffd6e0">튜토리얼 <span class="go">›</span></button>
      <button class="row" data-go="change" style="--hl:#cfe3ff">캐릭터 변경 <span class="go">›</span></button>
      <button class="row" data-go="inventory" style="--hl:#ffe3a8">인벤토리 <span class="go">›</span></button>
      <button class="row" data-go="goal" style="--hl:#d4f0c8">목표 순공 시간 <small>${S.setup ? fmtDur(S.setup.goalMin * 60000) : ""} · 임시</small><span class="go">›</span></button>
      <button class="row" data-go="subjects" style="--hl:#e6d9ff">과목 관리 <span class="go">›</span></button>
    </div>`;
  portrait($("#settings-body .set-pic canvas"), S.pet, true);
  document.querySelectorAll("#settings-body .row").forEach(r => r.onclick = () => {
    const g = r.dataset.go;
    if (g === "tutorial") { renderTutorialPage(); openScreen("scr-tutorial"); }
    if (g === "change") { renderSelect("change"); openScreen("scr-select"); }
    if (g === "inventory") { renderInventory(); openScreen("scr-inventory"); }
    if (g === "goal") askSetup(false);
    if (g === "subjects") openSubjects();
  });
}
function openSubjects() {
  const render = () => {
    openModal(`<button class="x" aria-label="닫기">✕</button><h3>과목 관리</h3>
      <ul class="subj-list">${S.subjects.map(s => `<li><span class="dot" style="background:${s.color}"></span><span>${esc(s.name)}</span><button class="btn small" data-del="${s.id}">지우기</button></li>`).join("")}</ul>
      <div class="todo-add"><input class="field" id="new-subj" maxlength="12" placeholder="새 과목"><button class="btn small primary" id="add-subj">추가</button></div>
      <p class="hint">지운 과목의 기록은 통계에 그대로 남아요.</p>`);
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
    <div class="card"><ol class="steps">
      <li>1시간마다 캐릭터가 레벨 업을 해요!</li>
      <li>버닝 시간은 18시~0시로, 이때는 레벨 업이 더 빨라요! (50분에 1레벨)</li>
      <li>캐릭터당 최대 레벨은 10레벨이에요!</li>
      <li>아이템은 탈부착이 가능해요! (설정 › 인벤토리)</li>
      <li>[시작]을 누르면 타이머가 작동되고, [끝]을 누르면 타이머가 멈추는 동시에 자신이 무엇을 했는지 작성해요!</li>
    </ol></div>
    <button class="btn primary wide" id="tut-again">튜토리얼 다시 보기</button>`;
  $("#tut-again").onclick = () => { screenStack.slice().forEach(closeScreen); setTimeout(startCoach, 380); };
}

function renderInventory() {
  const lv = lvOf(curExp()), cs = charState(S.pet);
  $("#inventory-body").innerHTML = `
    <div class="inv-preview"><span class="cl" style="left:18px;top:22px;width:46px;height:14px"></span><span class="cl" style="right:26px;top:44px;width:34px;height:10px"></span><canvas></canvas></div>
    <div class="slots">${ITEM_LIST[S.pet].map(([need, id, name]) => {
      const open = lv >= need;
      return `<button class="slot ${open ? (cs.equip[id] ? "on" : "") : "locked"}" data-id="${id}" ${open ? "" : "disabled"}>
        ${open ? "<canvas></canvas>" : '<span class="q">?</span>'}<span>${open ? esc(name) : "???"}</span><span class="lv">${open ? (cs.equip[id] ? "착용 중" : "눌러서 착용") : `Lv.${need}에 열려요`}</span></button>`;
    }).join("")}</div>
    <p class="hint" style="text-align:center">아이템을 누르면 붙였다 뗐다 할 수 있어요.</p>`;
  portrait($("#inventory-body .inv-preview canvas"), S.pet, true);
  document.querySelectorAll("#inventory-body .slot").forEach(b => {
    const id = b.dataset.id, cv = b.querySelector("canvas");
    if (cv) {
      const it = itemImg(S.pet, id), s = Math.max(it.img.width, it.img.height) + 4;
      cv.width = s; cv.height = s;
      cv.getContext("2d").drawImage(it.img, (s - it.img.width) >> 1, (s - it.img.height) >> 1);
    }
    if (!b.disabled) b.onclick = () => { cs.equip[id] = !cs.equip[id]; save(); G.equip = equipOf(S.pet); renderInventory(); };
  });
}

/* ---------- tutorial coach marks ---------- */
let coachStep = -1, coachTarget = null;
function startCoach() {
  if (!S.pet) return;
  coachStep = -1; $("#coach").hidden = false; appEl.classList.add("coaching");
  setSide(true); nextCoach();
}
function nextCoach() {
  coachStep++;
  if (coachTarget) { coachTarget.classList.remove("coach-target"); coachTarget = null; }
  const card = $("#coach .coach-card");
  if (coachStep >= TUTORIAL.length) return endCoach();
  const st = TUTORIAL[coachStep];
  card.classList.remove("fly"); card.style.transform = "";
  card.querySelector("p").textContent = st.text;
  card.querySelector("small").textContent = coachStep === TUTORIAL.length - 1 ? "눌러서 시작하기 ▸" : "눌러서 계속 ▸";
  if (st.target) { coachTarget = $(st.target); coachTarget.classList.add("coach-target"); }
  placeCoachCard();
  if (st.fly) card.dataset.fly = "1"; else delete card.dataset.fly;
}
function placeCoachCard() {
  const card = $("#coach .coach-card"), r = appEl.getBoundingClientRect();
  const box = pet.box || { x: pet.x - 14, y: FEET - 30, w: 28 };
  card.style.left = Math.max(10, Math.min(r.width - card.offsetWidth - 10, (box.x + box.w / 2) * sx - card.offsetWidth / 2)) + "px";
  card.style.top = Math.max(150, box.y * sy - card.offsetHeight - 18) + "px";
}
function endCoach() {
  $("#coach").hidden = true; appEl.classList.remove("coaching");
  S.tutorialDone = true; save(); coachStep = -1;
  say(pick(CHARS[S.pet].cheers));
}
$("#coach").addEventListener("click", () => {
  const card = $("#coach .coach-card");
  if (card.dataset.fly && !card.classList.contains("fly")) {
    // the explanation shrinks and flies into the settings tab, so you know where to find it again
    const t = $("#tab-settings").getBoundingClientRect(), c = card.getBoundingClientRect();
    card.classList.add("fly");
    card.style.transform = `translate(${t.left + t.width / 2 - (c.left + c.width / 2)}px, ${t.top + t.height / 2 - (c.top + c.height / 2)}px) scale(.08)`;
    setTimeout(() => { nextCoach(); const b = $("#tab-settings"); b.animate([{ transform: "scale(1)" }, { transform: "scale(1.25)" }, { transform: "scale(1)" }], { duration: 420 }); }, 900);
    return;
  }
  if (!card.classList.contains("fly")) nextCoach();
});

/* ---------- input on the world ---------- */
const toGame = e => { const r = stage.getBoundingClientRect(); return [(e.clientX - r.left) / sx, (e.clientY - r.top) / sy]; };
stage.addEventListener("pointerdown", e => {
  const [x, y] = toGame(e);
  if (petPointerDown(e, x, y)) { try { stage.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault(); }
});
stage.addEventListener("pointermove", e => { const [x, y] = toGame(e); petPointerMove(e, x, y); });
stage.addEventListener("pointerup", e => petPointerUp(e));
stage.addEventListener("pointercancel", e => petPointerUp(e));
stage.addEventListener("contextmenu", e => e.preventDefault());
onPetTap = () => { if (performance.now() > bubbleUntil - 1000) say(pick(CHARS[S.pet].cheers), 2600); };

/* ---------- main loop ---------- */
let prev = performance.now(), hudT = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.max(0, Math.min(100, now - prev)); prev = now;
  try {
    sceneUpdate(now, dt);
    if (S.pet) petUpdate(now, dt);
    if (now - hudT > 250) { hudT = now; updateHud(); }
    sceneRender(now, signInfo());
    if (S.pet) petRender(now); else ctx.clearRect(0, 0, W, H);
    drawPortraits(now);
    // bubbles follow the pet and the passing cloud
    if (!petBubble.hidden) {
      if (now > bubbleUntil || !pet.box) petBubble.hidden = true;
      else placeBubble(petBubble, pet.box.x + pet.box.w / 2, pet.box.y);
    }
    const ws = sceneSpeech(now);
    worldBubble.hidden = !ws;
    if (ws) { if (worldBubble.textContent !== ws.text) worldBubble.textContent = ws.text; placeBubble(worldBubble, ws.x, ws.y); }
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
if (S.pet) {
  setPet(S.pet); syncControls();
  if (!S.setup) askSetup(true);
  else if (!S.tutorialDone) setTimeout(startCoach, 600);
} else { renderSelect("first"); openScreen("scr-select"); }
addEventListener("visibilitychange", save);
addEventListener("pagehide", save);
requestAnimationFrame(loop);
