/* Item test page (test.html): every item unlocked, a panel to put items on and off, switch pets and play any motion.
   It keeps its own save (pixelpet.test.v1), so testing never touches real study records. */
"use strict";

(() => {
  const css = `
  #tp-toggle { position: fixed; right: 10px; top: 10px; z-index: 100; font: 700 14px system-ui, sans-serif; padding: 8px 12px;
    border: 2px solid #2c2032; border-radius: 10px; background: #fff4dc; color: #2c2032; box-shadow: 0 3px 0 #2c2032; }
  :host { all: initial; }
  #tp { position: fixed; z-index: 99; right: 10px; top: 56px; width: min(340px, calc(100vw - 20px)); max-height: calc(100vh - 70px);
    overflow-y: auto; background: rgba(255, 250, 240, .97); color: #2c2032; border: 2px solid #2c2032; border-radius: 12px;
    padding: 10px 12px 12px; font: 13px/1.4 system-ui, sans-serif; box-shadow: 0 4px 0 #2c2032; }
  #tp[hidden] { display: none; }
  #tp h3 { margin: 10px 0 6px; font-size: 12px; color: #8a7a66; font-weight: 700; }
  #tp h3:first-child { margin-top: 0; }
  #tp .row { display: flex; flex-wrap: wrap; gap: 6px; }
  #tp button { font: 600 13px system-ui, sans-serif; padding: 6px 10px; border: 1.5px solid #2c2032; border-radius: 8px;
    background: #fff; color: #2c2032; cursor: pointer; }
  #tp button:active { transform: translateY(1px); }
  #tp button.on { background: #ffd96b; }
  #tp button.pet.on { background: #b6ecae; }
  #tp .lv { font-size: 11px; color: #8a7a66; margin-left: 3px; }
  #tp label { display: flex; align-items: center; gap: 6px; margin-top: 8px; }
  #tp .note { margin-top: 10px; font-size: 11px; color: #8a7a66; }`;
  // the panel lives in its own shadow root, so the game's pixel styles never touch it
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>${css}</style><button id="tp-toggle">🧪 테스트</button><div id="tp"></div>`;
  const panel = root.getElementById("tp");
  root.getElementById("tp-toggle").onclick = () => { panel.hidden = !panel.hidden; };

  const NAMES = { mochi: "치카", sora: "하와", nori: "욱" };
  const now = () => performance.now();
  const go = fn => () => { G.sleeping = false; G.wantSleep = false; fn(now()); };
  const walkTo = (x, z) => go(() => { pet.act = "walk"; pet.target = x; pet.tz = z; });
  const drop = sky => go(() => { pet.act = "fall"; pet.t0 = now(); pet.hy = FEET - 90; pet.vx = 0; pet.vy = 0; pet.bounced = false; pet.skyDrop = sky; });
  const MOTIONS = {
    all: [["걷기", go(() => { pet.act = "walk"; pickWalk(); })], ["쓰다듬기", go(t => startAct("pet", t))],
          ["떨어뜨리기", drop(false)],
          ["표지판 앞", walkTo(SIGN_X, 0)], ["표지판 뒤", walkTo(SIGN_X, Z_MAX)], ["가운데로", walkTo(90, 0)]],
    mochi: [["손 흔들기", go(t => startAct("wave", t))], ["시무룩", go(t => startAct("gloom", t))],
            ["돌진", go(t => startDash(t))], ["하늘에서 착지", drop(true)]],
    sora: [["춤", go(t => startAct("dance", t))], ["기타 치기 (기타 착용)", go(t => { if (G.equip && G.equip.guitar) startAct("strum", t); })], ["식빵", go(t => startAct("loaf", t))], ["빼꼼", go(t => startPeek(t))]],
    nori: [["눕기", go(t => startAct("lie", t))], ["회전", go(t => startAct("spin", t))], ["빙글", go(t => startAct("twirl", t))],
           ["빼꼼", go(t => startPeek(t))]],
  };
  const LOOK_NAMES = [["a", "A 처음"], ["b", "B 윤곽선"], ["c", "C 나무 잉크선"], ["d", "D 파스텔"], ["e", "E 잉크선+파스텔"], ["f", "F 나무선+파스텔(지금)"]];
  const SEASONS = [["spring", "봄"], ["summer", "여름"], ["autumn", "가을"], ["winter", "겨울"]];
  const HOURS = [[5.3, "새벽"], [6.1, "해돋이"], [9, "아침"], [13, "낮"], [17.3, "늦은 오후"], [18.4, "노을"], [19.2, "저녁"], [23, "밤"]];
  let still = true;                                        // she only does what you press, unless you let her roam
  setInterval(() => { if (still && pet.act === "idle") pet.nextThink = now() + 1e9; }, 200);

  function render() {
    const id = S.pet, eq = charState(id).equip;
    panel.innerHTML = `
      <h3>캐릭터</h3><div class="row">${Object.keys(NAMES).map(p => `<button class="pet ${p === id ? "on" : ""}" data-pet="${p}">${NAMES[p]}</button>`).join("")}</div>
      <h3>아이템 (눌러서 착용 / 해제)</h3><div class="row">${ITEM_LIST[id].map(([lv, it, name]) =>
        `<button class="${eq[it] ? "on" : ""}" data-item="${it}">${name}<span class="lv">Lv${lv}</span></button>`).join("")}</div>
      <div class="row" style="margin-top:6px"><button data-all="1">전부 착용</button><button data-all="0">전부 해제</button></div>
      <h3>동작</h3><div class="row">${[...MOTIONS.all, ...MOTIONS[id]].map(([n], i) => `<button data-m="${i}">${n}</button>`).join("")}</div>
      <h3>날씨</h3><div class="row"><button data-wx="" class="${WX.force ? "" : "on"}">자동</button>${WX_KINDS.map(k => `<button data-wx="${k}" class="${WX.force === k ? "on" : ""}">${WX_NAME[k]}</button>`).join("")}</div>
      <h3>계절 (하늘 색)</h3><div class="row"><button data-se="" class="${skySeason ? "" : "on"}">자동</button>${SEASONS.map(([k, n]) => `<button data-se="${k}" class="${skySeason === k ? "on" : ""}">${n}</button>`).join("")}</div>
      <h3>시간</h3><div class="row"><button data-hr="" class="${T_FIX === null ? "on" : ""}">지금</button>${HOURS.map(([h, n]) => `<button data-hr="${h}" class="${T_FIX === h ? "on" : ""}">${n}</button>`).join("")}</div>
      <div class="row" style="margin-top:6px"><button data-bow="1">비 그친 뒤 (무지개·웅덩이)</button></div>
      <div class="row" style="margin-top:6px"><button data-sky="1">구름 새로 띄우기</button><button data-visit="1">모양 구름 띄우기</button><button data-bolt="1">번개 치기</button></div>
      <h3>UI 색감 후보</h3><div class="row">${[["a", "A 크림"], ["b", "B 하늘"], ["c", "C 라벤더"], ["old", "예전"]].map(([k, n]) => `<button data-ui="${k}" class="${(document.documentElement.dataset.ui || "a") === k ? "on" : ""}">${n}</button>`).join("")}</div>
      <h3>배경 스타일 후보</h3><div class="row">${LOOK_NAMES.map(([k, n]) => `<button data-look="${k}" class="${LOOK.key === k ? "on" : ""}">${n}</button>`).join("")}</div>
      <h3>칭호</h3><div class="row"><button data-ttl="all">모두 얻기</button><button data-ttl="first">첫걸음만</button><button data-ttl="reset">초기화</button><button data-ttl="taps">클릭 99번으로</button><button data-ttl="away">일주일 비우기</button></div>
      <h3>잠</h3><div class="row"><button data-sleep="1" class="${G.wantSleep ? "on" : ""}">재우기</button><button data-sleep="0">깨우기</button></div>
      <label><input type="checkbox" id="tp-still" ${still ? "checked" : ""}> 누른 동작만 하기 (꺼두면 평소처럼 알아서 움직여요)</label>
      <p class="note">이 페이지는 따로 저장돼서 실제 공부 기록에는 영향이 없어요.</p>`;
    panel.querySelectorAll("[data-pet]").forEach(b => b.onclick = () => { if (b.dataset.pet !== S.pet) { setPet(b.dataset.pet); G.equip = equipOf(S.pet); } render(); });
    panel.querySelectorAll("[data-item]").forEach(b => b.onclick = () => {
      eq[b.dataset.item] = !eq[b.dataset.item]; save(); G.equip = equipOf(S.pet); render();
    });
    panel.querySelectorAll("[data-all]").forEach(b => b.onclick = () => {
      for (const [, it] of ITEM_LIST[id]) eq[it] = b.dataset.all === "1";
      save(); G.equip = equipOf(S.pet); render();
    });
    const list = [...MOTIONS.all, ...MOTIONS[id]];
    panel.querySelectorAll("[data-m]").forEach(b => b.onclick = () => list[+b.dataset.m][1]());
    panel.querySelectorAll("[data-wx]").forEach(b => b.onclick = () => { WX.force = b.dataset.wx || null; render(); });
    panel.querySelectorAll("[data-se]").forEach(b => b.onclick = () => { setSkySeason(b.dataset.se || null); render(); });
    panel.querySelectorAll("[data-hr]").forEach(b => b.onclick = () => { setWorldHour(b.dataset.hr === "" ? null : +b.dataset.hr); render(); });
    panel.querySelector("[data-sky]").onclick = () => newSky();
    panel.querySelector("[data-bow]").onclick = () => { WX.force = "clear"; WX.rain = 0; WX.cover = 0.1; WX.wet = 0.8; WX.pud = 0.9; newPuddles(); WX.bowT = performance.now(); render(); };
    panel.querySelector("[data-visit]").onclick = () => sendVisitor();
    panel.querySelector("[data-bolt]").onclick = () => { if (WX.storm < 0.5) { WX.force = "storm"; render(); } startStrike(performance.now()); };
    panel.querySelectorAll("[data-ui]").forEach(b => b.onclick = () => { setUiLook(b.dataset.ui); render(); });
    panel.querySelectorAll("[data-look]").forEach(b => b.onclick = () => { setLook(b.dataset.look); render(); });
    panel.querySelectorAll("[data-ttl]").forEach(b => b.onclick = () => {
      const ts = titleState(), k = b.dataset.ttl;
      if (k === "all") TITLES.forEach(([id]) => { if (!ts.got[id]) ts.got[id] = Date.now(); });
      if (k === "first") giveTitle("first");
      if (k === "reset") Object.assign(ts, { got: {}, worn: null, taps: 0, menuShown: false, back: false });
      if (k === "taps") ts.taps = TITLE_RULE.taps - 1;
      if (k === "away") ts.back = true;                                   // as if she had been away a week: the next start gives 깨달은자
      save(); updateHud(); toast(k === "taps" ? "한 번 더 누르면 중독 주의!" : k === "away" ? "공부를 시작하면 깨달은자!" : "칭호 상태를 바꿨어요");
    });
    panel.querySelectorAll("[data-sleep]").forEach(b => b.onclick = () => { G.wantSleep = b.dataset.sleep === "1"; render(); });
    panel.querySelector("#tp-still").onchange = e => { still = e.target.checked; if (!still) pet.nextThink = now() + 500; };
  }
  render();
})();
