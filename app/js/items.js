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

// the sleeping cap leans over to one side, its tip and pompom hanging down
function nightcap(p, main, light) {
  const a = ANCHOR[p], top = a.top, x0 = 4;
  return pixmap(d => {
    const rows = [
      ".......AAAAA........",
      ".....AAAAAAAAA......",
      "....AAAaAAAAAAAA....",
      "...AAAAAaAAAAAAAAA..",
      "..AAAAAAAAaAAAAAAAWW",
      ".AAAAAAAAAAAAAAAAWWW",
      "RRRRRRRRRRRRRRRR.WW.",
      "RRRRRRRRRRRRRRRR....",
    ];
    d.grid(rows, { A: main, a: light, R: "#fffaf0", W: "#ffffff" }, x0, top - 6);
  });
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
function heldPole(p, main, light, kind) {
  const a = ANCHOR[p], hx = 24, top = a.arm - 13;
  return pixmap(d => {
    if (kind === "pencil") {
      d.put(hx + 1, top - 1, OUT);
      d.rect(hx, top, 3, 2, "#f6d7a7"); d.put(hx + 1, top, "#5a4636");
      d.rect(hx, top + 2, 3, 12, "#ffd25e"); d.rect(hx + 2, top + 2, 1, 12, "#f2b93b");
      d.rect(hx, top + 14, 3, 1, "#c9ccd6"); d.rect(hx, top + 15, 3, 2, "#ff9db4");
    } else {
      for (const k of [0, 2, 4]) d.rect(hx - 1 + k, top - 1, 1, 4, k === 4 ? light : main);
      d.rect(hx - 1, top + 3, 5, 1, main); d.rect(hx, top + 4, 3, 1, main);
      d.rect(hx + 1, top + 5, 1, 13, main); d.put(hx + 1, top + 5, light);
    }
  });
}

const ITEM_ART = {
  mochi: {
    tears: { layer: "front", hideOnBlink: true, build: () => pixmap(d => {
      const e = ANCHOR.mochi.eye + 4;
      for (const x of [10, 17]) { d.rect(x, e, 1, 3, "#8fd0f6"); d.put(x, e + 3, "#bfe5fb"); }
    }, false) },
    bearpin: { layer: "front", build: () => pixmap(d => d.grid([
      "NN...NN",
      "NONNNON",
      "NNNNNNN",
      "NKNNNKN",
      "NNOOONN",
      ".NNKNN.",
    ], { N: "#c98a5a", O: "#f3cfa0", K: OUT }, 16, -3)) },
    nightcap: { layer: "front", build: () => nightcap("mochi", "#ffb3c7", "#ffe3ea") },
    bag: { layer: "front", build: () => pixmap(d => {
      d.line(6, 18, 18, 24, "#a8714a");
      d.rect(17, 23, 7, 5, "#ffc4a8"); d.rect(17, 23, 7, 2, "#f29b8a"); d.put(20, 25, "#fff4dc");
    }) },
    fork: { layer: "front", build: () => heldPole("mochi", "#f7a8bd", "#ffd6e0") },
  },
  sora: {
    beanie: { layer: "front", build: () => headHat("sora", "#9fd3f5", "#d6eefc") },
    guitar: { layer: "back", build: () => pixmap(d => {
      d.line(6, 20, 29, -1, "#8a5a35", 2);
      d.rect(28, -4, 3, 4, "#6e4528"); d.put(27, -3, "#e8d9c0"); d.put(31, -2, "#e8d9c0");
      d.disc(3, 25, 5.2, "#d29a62"); d.disc(6, 19, 4, "#d29a62"); d.disc(4.5, 22, 1.4, "#5a3a22");
    }) },
    nightcap: { layer: "front", build: () => nightcap("sora", "#9fd3f5", "#e0f2fd") },
    camera: { layer: "front", build: () => pixmap(d => {
      d.line(7, 17, 11, 21, "#6cb8e6"); d.line(21, 17, 17, 21, "#6cb8e6");
      d.rect(10, 21, 9, 6, "#f4f1ea"); d.rect(10, 21, 9, 1, "#4a4f6e"); d.rect(11, 20, 3, 1, "#4a4f6e");
      d.disc(14.5, 24, 1.9, "#4a4f6e"); d.put(14, 23, "#a6d6f2"); d.put(17, 22, "#ffd84d");
    }) },
    trident: { layer: "front", build: () => heldPole("sora", "#6cb8e6", "#bfe5fb") },
  },
  nori: {
    shades: { layer: "front", build: () => pixmap(d => {
      const e = ANCHOR.nori.eye - 1;
      d.grid([
        "KKKKKK..KKKKKK",
        "KGGgGKKKKGGgGK",
        "KGGGGK..KGGGGK",
        ".KGGK....KGGK.",
      ], { K: OUT, G: "#3d3f5c", g: "#9aa0c8" }, 7, e);
      for (let x = 8; x <= 20; x++) d.put(x, 26 + Math.round(2.6 * (1 - ((x - 14) / 6.5) ** 2)), "#e0a93a");
      d.grid([".P.P.", "PPPPP", ".PPP.", "..P.."], { P: "#ff9db4" }, 12, 29);
    }, false) },
    pass: { layer: "front", build: () => pixmap(d => {
      d.rect(9, 11, 11, 6, "#fffdf5");
      d.rect(11, 12, 7, 1, "#9b8e7a"); d.rect(11, 14, 5, 1, "#c9bea8");
      d.rect(16, 14, 2, 2, "#e2504a"); d.put(13, 10, "#7cc46b"); d.put(14, 10, "#7cc46b"); d.put(15, 10, "#7cc46b");
    }) },
    nightcap: { layer: "front", build: () => nightcap("nori", "#ffd96b", "#fff3c4") },
    pudding: { layer: "front", build: () => pixmap(d => {          // in the other hand, so the pencil still fits
      const y = ANCHOR.nori.arm;
      d.rect(-2, y + 2, 9, 1, "#ffffff");
      d.rect(-1, y - 2, 7, 4, "#ffe08a"); d.rect(0, y - 3, 5, 1, "#ffe08a");
      d.rect(0, y - 4, 5, 2, "#a8642e"); d.put(1, y - 4, "#d48a4a");
    }) },
    pencil: { layer: "front", build: () => heldPole("nori", "#ffd25e", "#fff3c4", "pencil") },
  },
};
const ITEM_CACHE = {};
function itemImg(pet, id) {
  const k = pet + ":" + id;
  return ITEM_CACHE[k] || (ITEM_CACHE[k] = ITEM_ART[pet][id].build());
}

// draws the equipped items of one layer, in the sprite's own pixels (the caller has set up the transform)
function drawItems(g, petId, equip, layer, dy, pose) {
  const art = ITEM_ART[petId];
  for (const [, id] of ITEM_LIST[petId]) {
    if (!equip[id] || !art[id] || art[id].layer !== layer) continue;
    if (art[id].hideOnBlink && pose && pose.face !== "normal") continue;
    const it = itemImg(petId, id);
    g.drawImage(it.img, it.x, it.y + dy);
  }
}
