// 시대별 경계 있는 맵 (1200×900). 바닥은 한 장의 캔버스로 미리 그리고,
// 나무·건물처럼 키 큰 것은 props로 따로 두어 캐릭터와 baseY로 앞뒤 정렬한다.
import { P, makeCanvas, outlined, rng, rect, disc, ring, line, ditherGlow } from './pixel.js';

export const MAP_W = 1200, MAP_H = 900;

const TAU = Math.PI * 2;
const START = { x: 600, y: 480 };
const START_ZONE = { x: START.x - 220, y: START.y - 160, w: 440, h: 320 };

const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const th = (x, y) => (BAYER[((y % 4) + 4) % 4][((x % 4) + 4) % 4] + 0.5) / 16;
const clamp01 = (v) => (v < 0 ? 0 : v > 0.999 ? 0.999 : v);

const rgbCache = {};
function rgb(hex) {
  if (!rgbCache[hex]) {
    const n = parseInt(hex.slice(1), 16);
    rgbCache[hex] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  return rgbCache[hex];
}

// ── 바닥 그리기 도구 ──

function valueNoise(cell, rand) {
  const gw = Math.ceil(MAP_W / cell) + 3, gh = Math.ceil(MAP_H / cell) + 3;
  const grid = Float32Array.from({ length: gw * gh }, () => rand());
  return (x, y) => {
    const gx = Math.max(0, x) / cell, gy = Math.max(0, y) / cell;
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    let tx = gx - x0, ty = gy - y0;
    tx = tx * tx * (3 - 2 * tx);
    ty = ty * ty * (3 - 2 * ty);
    const i = y0 * gw + x0;
    const a = grid[i], b = grid[i + 1], c = grid[i + gw], d = grid[i + gw + 1];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  };
}

// 어두운→밝은 순서의 색 배열을 노이즈 + 베이어 디더링으로 섞는 함수를 만든다
function noise(ramp, { cell = 64, seed = 1, contrast = 1.5, detail = 0.35, grain = 0.1, bias = 0 } = {}) {
  const rand = rng(seed);
  const n1 = valueNoise(cell, rand);
  const n2 = valueNoise(Math.max(4, cell / 4), rand);
  const r2 = rng(seed * 31 + 7);
  return (x, y) => {
    let v = n1(x, y) * (1 - detail) + n2(x, y) * detail;
    v = clamp01((v - 0.5) * contrast + 0.5 + bias + (r2() - 0.5) * grain);
    const f = v * (ramp.length - 1);
    let i = Math.floor(f);
    if (f - i > th(x, y) && i < ramp.length - 1) i++;
    return ramp[i];
  };
}

// 영역의 픽셀마다 fn(x, y)이 돌려준 색을 칠한다 (null이면 그대로 둔다)
function paint(ctx, x0, y0, w, h, fn) {
  x0 = Math.max(0, Math.floor(x0));
  y0 = Math.max(0, Math.floor(y0));
  w = Math.min(Math.ceil(w), MAP_W - x0);
  h = Math.min(Math.ceil(h), MAP_H - y0);
  if (w <= 0 || h <= 0) return;
  const img = ctx.getImageData(x0, y0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const col = fn(x0 + x, y0 + y);
      if (!col) continue;
      const c = rgb(col);
      const k = (y * w + x) * 4;
      d[k] = c[0];
      d[k + 1] = c[1];
      d[k + 2] = c[2];
      d[k + 3] = 255;
    }
  }
  ctx.putImageData(img, x0, y0);
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}

function pathDist(pts, x, y) {
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, segDist(x, y, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  return d;
}

// 곡선 길: 점들을 캣멀롬으로 부드럽게 이은 뒤 굵기 r로 칠한다
function smoothPath(pts, steps = 8) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function shadow(m, cx, cy, rx, ry) {
  paint(m.g, cx - rx - 1, cy - ry - 1, rx * 2 + 3, ry * 2 + 3, (x, y) => {
    const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
    if (d > 1) return null;
    return d < 0.55 || (x + y) % 2 === 0 ? m.shadow : null;
  });
}

// ── 소품 그리기 도구 ──

// 덩어리 여러 개로 된 둥근 모양 (나무 수관, 덤불, 바위). ramp는 어두운→밝은 순
function lumpy(ctx, cx, cy, R, ramp, rand, { lumps = 6, squash = 0.85, size = [0.4, 0.55] } = {}) {
  const cl = [{ x: 0, y: 0, r: R * 0.8 }];
  for (let i = 0; i < lumps; i++) {
    const a = rand() * TAU, d = R * (0.2 + rand() * 0.26);
    cl.push({ x: Math.cos(a) * d, y: Math.sin(a) * d * squash, r: R * (size[0] + rand() * (size[1] - size[0])) });
  }
  const n = ramp.length;
  for (let y = -R - 1; y <= R + 1; y++) {
    for (let x = -R - 1; x <= R + 1; x++) {
      let best = null, bv = 0;
      for (const c of cl) {
        const v = 1 - Math.hypot(x - c.x, (y - c.y) / squash) / c.r;
        if (v > bv) {
          bv = v;
          best = c;
        }
      }
      if (!best) continue;
      const gl = (x * 0.55 + y * 0.8) / R;
      const lo = ((x - best.x) * 0.6 + (y - best.y) * 0.8) / best.r;
      const v = gl * 0.5 + lo * 0.6 + (rand() - 0.5) * 0.12;
      const t = (th(x + 64, y + 64) - 0.5) * 0.35;
      let idx;
      if (n >= 4) idx = v > 0.55 + t ? 0 : v > 0.08 + t ? 1 : v > -0.48 + t ? 2 : 3;
      else idx = v > 0.3 + t ? 0 : v > -0.35 + t ? 1 : 2;
      ctx.fillStyle = ramp[Math.min(idx, n - 1)];
      ctx.fillRect(cx + x, cy + y, 1, 1);
    }
  }
}

const GREEN = [P.deepTeal, P.darkGreen, P.midGreen, P.green];
const NIGHT_GREEN = [P.ink, P.deepTeal, P.darkGreen, P.midGreen];

const treeCache = new Map();
function tree(seed, R = 16, ramp = GREEN) {
  const key = `${seed}|${R}|${ramp[0]}`;
  if (!treeCache.has(key)) treeCache.set(key, drawTree(seed, R, ramp));
  return treeCache.get(key);
}

function drawTree(seed, R, ramp) {
  const rand = rng(seed);
  const trunkH = Math.round(R * 0.8);
  const W = R * 2 + 4, H = R * 2 + trunkH;
  const [c, ctx] = makeCanvas(W, H);
  const cx = W >> 1, cy = R + 1;
  const tw = Math.max(4, Math.round(R / 3)), tx = cx - (tw >> 1), ty = cy + Math.round(R * 0.4);
  rect(ctx, tx, ty, tw, H - ty, P.darkBrown);
  rect(ctx, tx, ty, 1, H - ty, P.brown);
  rect(ctx, tx + tw - 1, ty, 1, H - ty, P.deepBrown);
  rect(ctx, tx - 1, H - 2, tw + 2, 2, P.darkBrown);
  lumpy(ctx, cx, cy, R, ramp, rand);
  return { img: outlined(c), foot: { dx: tx - 1, dy: H - 4, w: tw + 4, h: 5 }, shadow: { rx: Math.round(R * 0.75), ry: Math.max(3, Math.round(R * 0.28)) } };
}

function bush(seed, R = 9, ramp = GREEN, flowers = null) {
  const rand = rng(seed);
  const W = R * 2 + 4, H = Math.round(R * 1.5) + 4;
  const [c, ctx] = makeCanvas(W, H);
  lumpy(ctx, W >> 1, H - Math.round(R * 0.75) - 2, R, ramp, rand, { lumps: 5, squash: 0.7 });
  if (flowers) {
    for (let i = 0; i < R; i++) {
      const x = 3 + Math.floor(rand() * (W - 6)), y = 2 + Math.floor(rand() * (H - 6));
      const d = ctx.getImageData(x, y, 1, 1).data;
      if (d[3]) rect(ctx, x, y, 1, 1, flowers[i % flowers.length]);
    }
  }
  return { img: outlined(c), foot: null, shadow: { rx: R, ry: Math.max(2, Math.round(R * 0.3)) } };
}

function rock(seed, R = 6, solid = false) {
  const rand = rng(seed);
  const W = R * 2 + 4, H = Math.round(R * 1.4) + 4;
  const [c, ctx] = makeCanvas(W, H);
  lumpy(ctx, W >> 1, H - Math.round(R * 0.7) - 2, R, [P.darkSlate, P.slate, P.gray, P.lightGray], rand, { lumps: 2, squash: 0.7, size: [0.5, 0.7] });
  return { img: outlined(c), foot: solid ? { dx: 2, dy: H - 6, w: W - 2, h: 6 } : null, shadow: { rx: R, ry: 2 } };
}

function finishProp(c, foot, sh) {
  return { img: outlined(c), foot, shadow: sh };
}

function fenceH(len, wood = true) {
  const H = 18;
  const [c, ctx] = makeCanvas(len, H);
  const [base, light, dark] = wood ? [P.brown, P.orangeBrown, P.darkBrown] : [P.lightGray, P.white, P.gray];
  for (const ry of [5, 11]) {
    rect(ctx, 0, ry, len, 3, base);
    rect(ctx, 0, ry, len, 1, light);
    rect(ctx, 0, ry + 2, len, 1, dark);
  }
  for (let x = 1; x < len - 3; x += 13) {
    rect(ctx, x, 2, 4, H - 2, base);
    rect(ctx, x, 2, 1, H - 2, light);
    rect(ctx, x + 3, 2, 1, H - 2, dark);
    rect(ctx, x + 1, 1, 2, 1, light);
  }
  return finishProp(c, { dx: 0, dy: H - 3, w: len + 2, h: 5 }, null);
}

function glyphs(ctx, x, y, w, color, rand, rows = 1) {
  for (let r = 0; r < rows; r++) {
    let gx = x;
    while (gx < x + w - 3) {
      const gw = 2 + Math.floor(rand() * 2);
      for (let i = 0; i < gw; i++) for (let j = 0; j < 4; j++) if (rand() < 0.55 || j === 0) rect(ctx, gx + i, y + r * 6 + j, 1, 1, color);
      gx += gw + 2;
    }
  }
}

function signboard(seed, board = P.blue, accent = P.amber) {
  const rand = rng(seed);
  const W = 38, H = 42;
  const [c, ctx] = makeCanvas(W, H);
  for (const px of [6, 30]) {
    rect(ctx, px, 18, 3, H - 18, P.darkBrown);
    rect(ctx, px, 18, 1, H - 18, P.brown);
  }
  rect(ctx, 1, 2, W - 2, 20, board);
  rect(ctx, 1, 2, W - 2, 1, P.white);
  rect(ctx, 1, 21, W - 2, 1, P.ink);
  rect(ctx, 2, 4, 6, 6, accent);
  glyphs(ctx, 10, 4, 25, P.white, rand, 1);
  glyphs(ctx, 4, 12, 31, P.white, rand, 1);
  return finishProp(c, { dx: 6, dy: H - 3, w: 28, h: 4 }, { rx: 14, ry: 3 });
}

function slide() {
  const W = 50, H = 42;
  const [c, ctx] = makeCanvas(W, H);
  for (const x of [5, 13]) {
    rect(ctx, x, 6, 2, H - 6, P.slate);
    rect(ctx, x, 6, 1, H - 6, P.lightGray);
  }
  for (let y = 12; y < H - 2; y += 5) rect(ctx, 5, y, 10, 1, P.lightGray);
  rect(ctx, 3, 5, 16, 4, P.sky);
  rect(ctx, 3, 5, 16, 1, P.cyan);
  rect(ctx, 3, 0, 2, 6, P.red);
  rect(ctx, 17, 0, 2, 6, P.red);
  rect(ctx, 3, 0, 16, 2, P.red);
  for (let i = 0; i < 30; i++) {
    const x = 18 + i, y = 7 + Math.round(i * 0.95);
    if (y > H - 4) break;
    rect(ctx, x, y, 2, 5, P.amber);
    rect(ctx, x, y, 2, 1, P.yellow);
    rect(ctx, x, y + 4, 2, 1, P.orange);
  }
  rect(ctx, 26, 20, 2, H - 20, P.slate);
  return finishProp(c, { dx: 2, dy: H - 4, w: W - 2, h: 5 }, { rx: 22, ry: 4 });
}

function reed(seed) {
  const rand = rng(seed);
  const [c, ctx] = makeCanvas(9, 18);
  for (let i = 0; i < 3; i++) {
    const x = 1 + i * 3, top = 2 + Math.floor(rand() * 5);
    rect(ctx, x, top, 1, 18 - top, i % 2 ? P.midGreen : P.green);
    if (rand() < 0.7) {
      rect(ctx, x, top - 1, 2, 4, P.darkBrown);
      rect(ctx, x, top - 1, 1, 1, P.brown);
    }
  }
  return { img: c, foot: null, shadow: null };
}

function lamp(warm = true, night = true) {
  const W = 20, H = 66;
  const [c, ctx] = makeCanvas(W, H);
  const head = warm ? [P.amber, P.yellow] : [P.lightGray, P.white];
  if (night) ditherGlow(ctx, 13, 9, 9, warm ? P.amber : P.lightGray, 0.45, 3);
  rect(ctx, 5, 8, 3, H - 8, P.darkSlate);
  rect(ctx, 5, 8, 1, H - 8, P.slate);
  rect(ctx, 3, H - 4, 7, 4, P.darkSlate);
  rect(ctx, 3, H - 4, 7, 1, P.slate);
  rect(ctx, 5, 6, 10, 2, P.darkSlate);
  rect(ctx, 10, 6, 8, 3, P.slate);
  rect(ctx, 11, 9, 6, 2, head[0]);
  rect(ctx, 12, 9, 3, 1, head[1]);
  return finishProp(c, { dx: 4, dy: H - 3, w: 8, h: 4 }, null);
}

function bench() {
  const W = 30, H = 15;
  const [c, ctx] = makeCanvas(W, H);
  rect(ctx, 0, 1, W, 3, P.brown);
  rect(ctx, 0, 1, W, 1, P.orangeBrown);
  rect(ctx, 0, 6, W, 4, P.brown);
  rect(ctx, 0, 6, W, 1, P.orangeBrown);
  rect(ctx, 0, 9, W, 1, P.darkBrown);
  for (const x of [2, W - 4]) rect(ctx, x, 4, 2, H - 4, P.darkSlate);
  return finishProp(c, { dx: 0, dy: H - 5, w: W + 2, h: 6 }, { rx: 14, ry: 2 });
}

function hoop() {
  const W = 26, H = 60;
  const [c, ctx] = makeCanvas(W, H);
  rect(ctx, 12, 18, 3, H - 18, P.slate);
  rect(ctx, 12, 18, 1, H - 18, P.gray);
  rect(ctx, 9, H - 3, 9, 3, P.darkSlate);
  rect(ctx, 1, 0, 24, 16, P.white);
  rect(ctx, 1, 15, 24, 1, P.lightGray);
  rect(ctx, 8, 5, 10, 8, P.red);
  rect(ctx, 9, 6, 8, 6, P.white);
  rect(ctx, 7, 16, 12, 2, P.orange);
  for (let y = 18; y < 25; y++) for (let x = 8; x < 18; x++) if ((x + y) % 2 === 0 && x > 7 + (y - 18) / 3 && x < 18 - (y - 18) / 3) rect(ctx, x, y, 1, 1, P.white);
  return finishProp(c, { dx: 10, dy: H - 3, w: 9, h: 4 }, { rx: 6, ry: 2 });
}

function flagpole(kind = 'korea') {
  const W = 26, H = 86;
  const [c, ctx] = makeCanvas(W, H);
  rect(ctx, 3, 3, 2, H - 3, P.lightGray);
  rect(ctx, 4, 3, 1, H - 3, P.gray);
  rect(ctx, 2, 0, 4, 3, P.amber);
  rect(ctx, 1, H - 3, 6, 3, P.slate);
  if (kind === 'korea') {
    rect(ctx, 5, 4, 19, 13, P.white);
    rect(ctx, 5, 16, 19, 1, P.lightGray);
    disc(ctx, 14, 10, 3, P.blue);
    rect(ctx, 11, 7, 7, 3, P.red);
    rect(ctx, 12, 10, 2, 1, P.red);
    for (const [x, y] of [[7, 5], [21, 5], [7, 14], [21, 14]]) rect(ctx, x, y, 2, 2, P.ink);
  } else {
    const col = kind === 'school' ? P.sky : P.red;
    rect(ctx, 5, 4, 19, 13, col);
    rect(ctx, 5, 4, 19, 1, P.white);
    disc(ctx, 14, 10, 3, P.amber);
  }
  return finishProp(c, { dx: 1, dy: H - 3, w: 8, h: 4 }, { rx: 4, ry: 2 });
}

function goal() {
  const W = 54, H = 30;
  const [c, ctx] = makeCanvas(W, H);
  for (let y = 3; y < H - 1; y++) for (let x = 3; x < W - 3; x++) if ((x + y) % 3 === 0) rect(ctx, x, y, 1, 1, P.lightGray);
  rect(ctx, 0, 0, W, 2, P.white);
  rect(ctx, 0, 0, 2, H, P.white);
  rect(ctx, W - 2, 0, 2, H, P.white);
  return { img: outlined(c), foot: null, shadow: null };
}

function pullupBars() {
  const W = 44, H = 38;
  const [c, ctx] = makeCanvas(W, H);
  const posts = [[2, 4], [21, 10], [40, 16]];
  for (const [x, top] of posts) {
    rect(ctx, x, top, 2, H - top, P.slate);
    rect(ctx, x, top, 1, H - top, P.gray);
  }
  rect(ctx, 2, 6, 21, 2, P.lightGray);
  rect(ctx, 21, 12, 21, 2, P.lightGray);
  return finishProp(c, { dx: 1, dy: H - 3, w: W, h: 4 }, { rx: 20, ry: 2 });
}

function trashBags(seed) {
  const rand = rng(seed);
  const W = 24, H = 16;
  const [c, ctx] = makeCanvas(W, H);
  for (const [x, y, r] of [[6, 9, 6], [16, 10, 5], [11, 5, 4]]) {
    lumpy(ctx, x, y, r, [P.slate, P.gray, P.lightGray], rand, { lumps: 2, squash: 0.85 });
    rect(ctx, x, y - r, 1, 2, P.ink);
  }
  return finishProp(c, null, { rx: 10, ry: 2 });
}

function sandbags(len) {
  const H = 18;
  const [c, ctx] = makeCanvas(len, H);
  for (let row = 0; row < 2; row++) {
    const y = 8 - row * 7, off = row ? 5 : 0;
    for (let x = off; x < len - 6; x += 11) {
      rect(ctx, x + 1, y, 9, 8, P.skinMid);
      rect(ctx, x, y + 1, 11, 6, P.skinMid);
      rect(ctx, x + 1, y, 9, 2, P.skinLight);
      rect(ctx, x, y + 6, 11, 2, P.skinDark);
      rect(ctx, x + 5, y + 2, 1, 4, P.brown);
    }
  }
  return finishProp(c, { dx: 0, dy: H - 9, w: len + 2, h: 10 }, null);
}

function truck() {
  const W = 88, H = 50;
  const [c, ctx] = makeCanvas(W, H);
  rect(ctx, 26, 4, 60, 30, P.midGreen);
  rect(ctx, 26, 4, 60, 3, P.green);
  rect(ctx, 26, 30, 60, 4, P.darkGreen);
  for (let x = 32; x < 84; x += 12) rect(ctx, x, 6, 1, 26, P.darkGreen);
  rect(ctx, 24, 34, 64, 6, P.deepTeal);
  rect(ctx, 2, 14, 24, 26, P.darkGreen);
  rect(ctx, 2, 14, 24, 2, P.midGreen);
  rect(ctx, 4, 17, 14, 9, P.darkSlate);
  rect(ctx, 5, 18, 5, 3, P.sky);
  rect(ctx, 0, 34, 4, 6, P.ink);
  rect(ctx, 1, 28, 3, 3, P.yellow);
  rect(ctx, 30, 22, 8, 6, P.ink);
  rect(ctx, 31, 23, 2, 4, P.white);
  for (const x of [8, 50, 70]) {
    disc(ctx, x + 5, 42, 6, P.ink);
    disc(ctx, x + 5, 42, 3, P.darkSlate);
    rect(ctx, x + 4, 41, 2, 2, P.slate);
  }
  return finishProp(c, { dx: 1, dy: 30, w: W, h: 18 }, { rx: 44, ry: 5 });
}

function carSide(body, light, dark, seed = 1) {
  const W = 54, H = 26;
  const [c, ctx] = makeCanvas(W, H);
  rect(ctx, 2, 10, 50, 10, body);
  rect(ctx, 0, 12, 54, 6, body);
  rect(ctx, 2, 10, 50, 1, light);
  rect(ctx, 0, 17, 54, 2, dark);
  rect(ctx, 12, 2, 28, 9, body);
  rect(ctx, 12, 2, 28, 1, light);
  rect(ctx, 14, 3, 11, 7, P.darkSlate);
  rect(ctx, 27, 3, 11, 7, P.darkSlate);
  rect(ctx, 15, 4, 3, 2, P.sky);
  rect(ctx, 28, 4, 3, 2, P.sky);
  rect(ctx, 0, 12, 2, 3, P.yellow);
  rect(ctx, 52, 12, 2, 3, P.red);
  rect(ctx, 25, 12, 1, 6, dark);
  for (const x of [9, 41]) {
    disc(ctx, x, 20, 4, P.ink);
    rect(ctx, x - 1, 19, 2, 2, P.slate);
  }
  return finishProp(c, { dx: 1, dy: 8, w: W, h: 16 }, { rx: 26, ry: 3 });
}

function carFront(body, light, dark) {
  const W = 30, H = 34;
  const [c, ctx] = makeCanvas(W, H);
  rect(ctx, 3, 2, 24, 10, body);
  rect(ctx, 5, 3, 20, 7, P.darkSlate);
  rect(ctx, 6, 4, 6, 2, P.sky);
  rect(ctx, 1, 11, 28, 16, body);
  rect(ctx, 1, 11, 28, 1, light);
  rect(ctx, 1, 25, 28, 2, dark);
  rect(ctx, 3, 15, 6, 3, P.yellow);
  rect(ctx, 21, 15, 6, 3, P.yellow);
  rect(ctx, 11, 20, 8, 3, P.white);
  rect(ctx, 2, 27, 5, 5, P.ink);
  rect(ctx, 23, 27, 5, 5, P.ink);
  return finishProp(c, { dx: 1, dy: 12, w: W, h: 20 }, { rx: 14, ry: 3 });
}

function busStop() {
  const W = 66, H = 46;
  const [c, ctx] = makeCanvas(W, H);
  rect(ctx, 0, 0, W, 5, P.slate);
  rect(ctx, 0, 0, W, 1, P.lightGray);
  rect(ctx, 0, 4, W, 1, P.darkSlate);
  for (const x of [2, W - 4]) rect(ctx, x, 5, 2, H - 5, P.darkSlate);
  for (let y = 7; y < 36; y++) for (let x = 5; x < 40; x++) if ((x + y) % 2 === 0) rect(ctx, x, y, 1, 1, P.blue);
  rect(ctx, 42, 7, 20, 29, P.cyan);
  rect(ctx, 43, 8, 18, 27, P.white);
  rect(ctx, 45, 11, 14, 9, P.sky);
  rect(ctx, 45, 23, 14, 2, P.pink);
  rect(ctx, 45, 27, 10, 2, P.gray);
  rect(ctx, 6, 36, 34, 3, P.brown);
  rect(ctx, 6, 36, 34, 1, P.orangeBrown);
  rect(ctx, 8, 39, 2, H - 39, P.darkSlate);
  rect(ctx, 36, 39, 2, H - 39, P.darkSlate);
  return finishProp(c, { dx: 1, dy: H - 6, w: W, h: 6 }, { rx: 30, ry: 3 });
}

function planterTree(seed, night) {
  const t = tree(seed, 10, night ? NIGHT_GREEN : GREEN);
  const W = t.img.width, H = t.img.height + 4;
  const [c, ctx] = makeCanvas(W, H);
  ctx.drawImage(t.img, 0, 0);
  const px = (W >> 1) - 9;
  rect(ctx, px, H - 11, 18, 10, P.ink);
  rect(ctx, px + 1, H - 10, 16, 8, P.gray);
  rect(ctx, px + 1, H - 10, 16, 2, P.lightGray);
  rect(ctx, px + 1, H - 4, 16, 2, P.slate);
  return { img: c, foot: { dx: px, dy: H - 10, w: 18, h: 9 }, shadow: { rx: 10, ry: 2 } };
}

function pocha(seed) {
  const rand = rng(seed);
  const W = 74, H = 52;
  const [c, ctx] = makeCanvas(W, H);
  rect(ctx, 6, 18, 62, 30, P.darkBrown);
  rect(ctx, 8, 20, 58, 26, P.amber);
  for (let y = 20; y < 46; y++) for (let x = 8; x < 66; x++) if ((x * 3 + y * 5) % 11 === 0) rect(ctx, x, y, 1, 1, P.yellow);
  for (let i = 0; i < 4; i++) {
    const x = 14 + i * 14 + Math.floor(rand() * 4);
    rect(ctx, x, 26, 6, 6, P.darkBrown);
    rect(ctx, x - 1, 32, 8, 10, P.brown);
  }
  rect(ctx, 10, 38, 54, 4, P.red);
  rect(ctx, 10, 38, 54, 1, P.salmon);
  for (let i = 0; i < 5; i++) rect(ctx, 14 + i * 10, 34, 2, 4, P.midGreen);
  for (let y = 0; y < 20; y++) {
    const inset = Math.max(0, 10 - Math.floor(y / 2));
    rect(ctx, inset, y, W - inset * 2, 1, y < 2 ? P.amber : P.orange);
    for (let x = inset; x < W - inset; x += 8) rect(ctx, x, y, 3, 1, P.amber);
  }
  rect(ctx, 0, 18, W, 3, P.brick);
  for (let x = 0; x < W; x += 6) rect(ctx, x, 21, 3, 2, P.brick);
  rect(ctx, 0, 18, 6, 34, P.orange);
  rect(ctx, W - 6, 18, 6, 34, P.orange);
  rect(ctx, 0, 18, 2, 34, P.amber);
  rect(ctx, W - 2, 18, 2, 34, P.brick);
  rect(ctx, 6, 46, 62, 6, P.deepBrown);
  return finishProp(c, { dx: 1, dy: 36, w: W, h: 16 }, { rx: 36, ry: 4 });
}

function tableSet(seed) {
  const rand = rng(seed);
  const W = 46, H = 30;
  const [c, ctx] = makeCanvas(W, H);
  const stool = (x, y) => {
    const col = rand() < 0.5 ? [P.red, P.salmon, P.darkRed] : [P.blue, P.sky, P.navy];
    rect(ctx, x, y, 8, 6, col[0]);
    rect(ctx, x, y, 8, 2, col[1]);
    rect(ctx, x + 1, y + 6, 6, 3, col[2]);
  };
  stool(2, 4);
  stool(36, 4);
  rect(ctx, 10, 6, 26, 12, P.gray);
  rect(ctx, 11, 7, 24, 9, P.lightGray);
  rect(ctx, 11, 7, 24, 1, P.white);
  rect(ctx, 21, 18, 4, 8, P.slate);
  for (let i = 0; i < 3; i++) {
    const x = 14 + i * 6 + Math.floor(rand() * 2);
    rect(ctx, x, 2, 2, 7, P.midGreen);
    rect(ctx, x, 2, 1, 7, P.green);
    rect(ctx, x, 5, 2, 2, P.white);
  }
  rect(ctx, 28, 8, 3, 3, P.white);
  stool(4, 21);
  stool(34, 21);
  return finishProp(c, { dx: 9, dy: 14, w: 30, h: 10 }, { rx: 18, ry: 3 });
}

function parasolTable(seed) {
  const rand = rng(seed);
  const W = 44, H = 46;
  const [c, ctx] = makeCanvas(W, H);
  const cols = rand() < 0.5 ? [P.green, P.white] : [P.blue, P.white];
  for (let y = 0; y < 12; y++) {
    const half = Math.round(6 + y * 1.4);
    for (let x = -half; x <= half; x++) rect(ctx, 22 + x, y + 2, 1, 1, Math.floor((x + 40) / 5) % 2 ? cols[0] : cols[1]);
  }
  rect(ctx, 5, 14, 34, 2, P.ink);
  rect(ctx, 21, 0, 2, 3, P.lightGray);
  rect(ctx, 21, 14, 2, 22, P.lightGray);
  rect(ctx, 11, 30, 22, 5, P.gray);
  rect(ctx, 11, 30, 22, 1, P.lightGray);
  for (const x of [2, 34]) {
    rect(ctx, x, 30, 8, 6, P.lightGray);
    rect(ctx, x, 30, 8, 1, P.white);
    rect(ctx, x + 1, 36, 6, 8, P.gray);
  }
  return finishProp(c, { dx: 10, dy: 32, w: 26, h: 10 }, { rx: 18, ry: 3 });
}

function vending() {
  const W = 20, H = 34;
  const [c, ctx] = makeCanvas(W, H);
  rect(ctx, 0, 0, W, H, P.red);
  rect(ctx, 0, 0, W, 2, P.salmon);
  rect(ctx, W - 2, 0, 2, H, P.darkRed);
  rect(ctx, 2, 3, 12, 18, P.white);
  for (let y = 5; y < 20; y += 5) for (let x = 3; x < 13; x += 3) rect(ctx, x, y, 2, 3, [P.sky, P.amber, P.green, P.hotPink][(x + y) % 4]);
  rect(ctx, 15, 6, 3, 8, P.ink);
  rect(ctx, 2, 25, 12, 5, P.ink);
  return finishProp(c, { dx: 0, dy: H - 6, w: W + 2, h: 7 }, { rx: 10, ry: 2 });
}

function manhole(ctx, x, y) {
  disc(ctx, x, y, 7, P.ink);
  disc(ctx, x, y, 6, P.darkSlate);
  for (let i = -4; i <= 4; i += 2) rect(ctx, x - 5, y + i, 11, 1, P.navy);
}

function podium() {
  const W = 124, H = 44;
  const [c, ctx] = makeCanvas(W, H);
  rect(ctx, 0, 10, W, 14, P.lightGray);
  rect(ctx, 0, 10, W, 2, P.white);
  rect(ctx, 0, 24, W, 16, P.gray);
  rect(ctx, 0, 24, W, 1, P.slate);
  for (let x = 6; x < W - 6; x += 12) rect(ctx, x, 26, 1, 12, P.slate);
  for (const sx of [0, W - 18]) for (let k = 0; k < 4; k++) rect(ctx, sx + (sx ? 0 : 0), 24 + k * 4, 18, 4, k % 2 ? P.gray : P.lightGray);
  rect(ctx, 20, 0, 2, 10, P.slate);
  rect(ctx, W - 22, 0, 2, 10, P.slate);
  rect(ctx, 20, 2, W - 40, 1, P.slate);
  rect(ctx, 54, 4, 16, 6, P.darkBrown);
  rect(ctx, 54, 4, 16, 1, P.brown);
  return finishProp(c, { dx: 1, dy: 12, w: W, h: 30 }, null);
}

function flowerBed(seed, w = 64) {
  const rand = rng(seed);
  const H = 22;
  const [c, ctx] = makeCanvas(w, H);
  rect(ctx, 0, 6, w, H - 6, P.brick);
  rect(ctx, 0, 6, w, 1, P.salmon);
  rect(ctx, 3, 8, w - 6, H - 12, P.deepBrown);
  rect(ctx, 0, H - 3, w, 3, P.darkRed);
  for (let x = 6; x < w - 6; x += 9) {
    lumpy(ctx, x, 9, 5, [P.darkGreen, P.midGreen, P.green], rand, { lumps: 2, squash: 0.8 });
    for (let k = 0; k < 3; k++) rect(ctx, x - 3 + Math.floor(rand() * 6), 6 + Math.floor(rand() * 6), 1, 1, [P.hotPink, P.yellow, P.white, P.salmon][(x + k) % 4]);
  }
  return finishProp(c, { dx: 1, dy: 7, w, h: H - 6 }, null);
}

function shed() {
  const W = 58, H = 50;
  const [c, ctx] = makeCanvas(W, H);
  rect(ctx, 0, 0, W, 14, P.blue);
  for (let x = 0; x < W; x += 4) rect(ctx, x, 0, 1, 14, P.navy);
  rect(ctx, 0, 0, W, 1, P.sky);
  rect(ctx, 0, 13, W, 1, P.ink);
  rect(ctx, 2, 14, W - 4, H - 14, P.lightGray);
  rect(ctx, 2, 14, W - 4, 2, P.white);
  rect(ctx, 14, 22, 30, H - 22, P.slate);
  for (let y = 24; y < H - 2; y += 3) rect(ctx, 15, y, 28, 1, P.gray);
  rect(ctx, 2, H - 2, W - 4, 2, P.gray);
  return finishProp(c, { dx: 2, dy: 16, w: W - 2, h: H - 16 }, { rx: 26, ry: 3 });
}

function tireFlat(ctx, x, y) {
  disc(ctx, x, y, 7, P.ink);
  disc(ctx, x, y, 6, P.darkSlate);
  rect(ctx, x - 4, y - 5, 4, 1, P.slate);
  rect(ctx, x - 5, y - 4, 1, 3, P.slate);
  disc(ctx, x, y, 3, P.ink);
}

// ── 건물 ──

function windowCell(ctx, x, y, w, h, lit, rand, night) {
  rect(ctx, x, y, w, h, P.ink);
  if (lit) {
    rect(ctx, x + 1, y + 1, w - 2, h - 2, rand() < 0.3 ? P.yellow : P.amber);
    rect(ctx, x + 1, y + 1, 2, 1, P.white);
    if (rand() < 0.4) rect(ctx, x + 1 + Math.floor(rand() * (w - 4)), y + h - 5, 3, 4, P.orangeBrown);
  } else if (night) {
    rect(ctx, x + 1, y + 1, w - 2, h - 2, P.navy);
    rect(ctx, x + 1, y + 1, 1, h - 2, P.darkSlate);
  } else {
    rect(ctx, x + 1, y + 1, w - 2, h - 2, P.sky);
    rect(ctx, x + 1, y + h - 4, w - 2, 3, P.blue);
    for (let i = 0; i < Math.min(w, h) - 3; i++) rect(ctx, x + 2 + i, y + h - 3 - i, 1, 1, P.cyan);
  }
}

function schoolBuilding(rand) {
  const W = MAP_W, H = 130;
  const [c, ctx] = makeCanvas(W, H);
  rect(ctx, 0, 0, W, H, P.skinLight);
  rect(ctx, 0, 0, W, 8, P.lightGray);
  rect(ctx, 0, 0, W, 2, P.white);
  rect(ctx, 0, 7, W, 1, P.gray);
  const floors = [10, 48, 86];
  for (const fy of floors) {
    rect(ctx, 0, fy + 30, W, 4, P.blue);
    rect(ctx, 0, fy + 30, W, 1, P.sky);
    for (let x = 8; x < W - 20; x += 28) {
      if (x > 548 && x < 650) continue;
      windowCell(ctx, x, fy + 4, 20, 22, false, rand, false);
      if (rand() < 0.3) rect(ctx, x + 1, fy + 5, 7, 20, P.lightGray);
    }
  }
  for (let x = 0; x < W; x += 168) rect(ctx, x, 8, 4, H - 12, P.skinMid);
  rect(ctx, 540, 8, 120, H - 12, P.white);
  rect(ctx, 548, 8, 2, H - 12, P.lightGray);
  rect(ctx, 650, 8, 2, H - 12, P.lightGray);
  disc(ctx, 600, 28, 12, P.ink);
  disc(ctx, 600, 28, 10, P.white);
  rect(ctx, 600, 20, 1, 9, P.ink);
  rect(ctx, 600, 28, 6, 1, P.ink);
  rect(ctx, 562, 46, 76, 12, P.navy);
  for (let x = 566; x < 634; x += 6) rect(ctx, x, 49, 4, 6, P.white);
  rect(ctx, 556, 70, 88, 6, P.darkSlate);
  rect(ctx, 566, 76, 68, 48, P.ink);
  rect(ctx, 568, 78, 31, 46, P.sky);
  rect(ctx, 601, 78, 31, 46, P.sky);
  rect(ctx, 569, 79, 4, 30, P.cyan);
  rect(ctx, 602, 79, 4, 30, P.cyan);
  rect(ctx, 0, H - 6, W, 6, P.gray);
  rect(ctx, 0, H - 6, W, 1, P.lightGray);
  rect(ctx, 552, H - 6, 96, 6, P.lightGray);
  rect(ctx, 552, H - 3, 96, 1, P.gray);
  return c;
}

const SHOP_WALLS = [
  { base: P.darkBrown, light: P.brick, dark: P.deepBrown, brick: true },
  { base: P.darkSlate, light: P.slate, dark: P.navy, brick: false },
  { base: P.purple, light: P.pink, dark: P.navy, brick: false },
  { base: P.deepTeal, light: P.darkGreen, dark: P.ink, brick: true },
];
const NEON = [P.hotPink, P.cyan, P.yellow, P.green, P.salmon];
const AWNING = [[P.red, P.white], [P.blue, P.lightGray], [P.darkGreen, P.lightGray], [P.orange, P.yellow]];

function shopRow(rand, glows) {
  const W = MAP_W, H = 120;
  const [c, ctx] = makeCanvas(W, H);
  let x = 0, i = 0;
  while (x < W) {
    const w = Math.min(W - x, 120 + Math.floor(rand() * 60));
    const store = i === 4;
    const wall = store ? { base: P.gray, light: P.lightGray, dark: P.slate, brick: false } : SHOP_WALLS[Math.floor(rand() * SHOP_WALLS.length)];
    rect(ctx, x, 6, w, H - 6, wall.base);
    if (wall.brick) for (let y = 10; y < 66; y += 5) for (let bx = x + ((y / 5) % 2 ? 0 : 4); bx < x + w; bx += 9) rect(ctx, bx, y, 1, 4, wall.dark), rect(ctx, x, y + 4, w, 1, wall.dark);
    rect(ctx, x, 2, w, 5, P.ink);
    rect(ctx, x, 6, w, 1, wall.light);
    const cols = Math.max(2, Math.floor((w - 12) / 26));
    for (let k = 0; k < cols; k++) windowCell(ctx, x + 10 + k * 26, 14, 16, 18, rand() < 0.55, rand, true);
    const nw = Math.floor(w * 0.62), nx = x + Math.floor((w - nw) / 2), ny = 38;
    if (store) {
      rect(ctx, x + 4, ny, w - 8, 14, P.white);
      rect(ctx, x + 4, ny, w - 8, 4, P.purple);
      rect(ctx, x + 4, ny + 10, w - 8, 4, P.sky);
      glyphs(ctx, x + 20, ny + 5, 60, P.navy, rand);
    } else {
      const neon = NEON[Math.floor(rand() * NEON.length)];
      rect(ctx, nx - 1, ny - 1, nw + 2, 16, P.ink);
      rect(ctx, nx, ny, nw, 14, P.ink);
      rect(ctx, nx, ny, nw, 1, neon);
      rect(ctx, nx, ny + 13, nw, 1, neon);
      rect(ctx, nx, ny, 1, 14, neon);
      rect(ctx, nx + nw - 1, ny, 1, 14, neon);
      glyphs(ctx, nx + 4, ny + 4, nw - 6, neon, rand);
      for (let gy = ny - 4; gy < ny + 18; gy++) for (let gx = nx - 4; gx < nx + nw + 4; gx++) {
        const inside = gx >= nx - 1 && gx <= nx + nw && gy >= ny - 1 && gy <= ny + 14;
        if (!inside && (gx + gy) % 3 === 0 && rand() < 0.5) rect(ctx, gx, gy, 1, 1, neon);
      }
      glows.push({ x: nx + nw / 2, color: neon });
    }
    const [aw1, aw2] = store ? [P.sky, P.white] : AWNING[Math.floor(rand() * AWNING.length)];
    for (let ax = x; ax < x + w; ax += 8) {
      rect(ctx, ax, 60, 4, 9, aw1);
      rect(ctx, ax + 4, 60, 4, 9, aw2);
      rect(ctx, ax + 1, 69, 2, 2, aw1);
      rect(ctx, ax + 5, 69, 2, 2, aw2);
    }
    rect(ctx, x, 60, w, 1, P.ink);
    const glass = store ? [P.white, P.lightGray] : [P.amber, P.yellow];
    rect(ctx, x + 3, 72, w - 6, H - 76, P.ink);
    rect(ctx, x + 4, 73, w - 8, H - 78, glass[0]);
    for (let gx = x + 6; gx < x + w - 8; gx += 7) rect(ctx, gx, 74, 1, H - 80, glass[1]);
    if (store) {
      for (let sy = 80; sy < H - 8; sy += 8) rect(ctx, x + 8, sy, w - 30, 3, [P.sky, P.red, P.green][sy % 3]);
    } else {
      for (let k = 0; k < 3; k++) {
        const px = x + 10 + Math.floor(rand() * (w - 30));
        rect(ctx, px, 86, 6, 6, P.darkBrown);
        rect(ctx, px - 1, 92, 8, H - 96, P.brown);
      }
    }
    const dx = x + w - 22;
    rect(ctx, dx, 76, 14, H - 80, P.ink);
    rect(ctx, dx + 1, 77, 12, H - 82, store ? P.lightGray : P.darkBrown);
    rect(ctx, x, 6, 2, H - 6, P.ink);
    glows.push({ x: x + w / 2, color: null, store });
    x += w;
    i++;
  }
  rect(ctx, 0, H - 4, W, 4, P.slate);
  rect(ctx, 0, H - 4, W, 1, P.gray);
  return c;
}

function officeRow(rand, glows) {
  const W = MAP_W, H = 136;
  const [c, ctx] = makeCanvas(W, H);
  let x = 0, i = 0;
  while (x < W) {
    const w = Math.min(W - x, 140 + Math.floor(rand() * 80));
    const store = i === 3;
    const cafe = i === 1;
    const glassy = rand() < 0.5;
    rect(ctx, x, 0, w, H, glassy ? P.navy : P.darkSlate);
    rect(ctx, x, 0, w, 3, P.slate);
    for (let y = 8; y < H - 44; y += 14) {
      for (let wx = x + 6; wx < x + w - 10; wx += glassy ? 10 : 16) {
        const lit = rand() < 0.32;
        if (glassy) {
          rect(ctx, wx, y, 9, 11, lit ? (rand() < 0.5 ? P.amber : P.lightGray) : P.ink);
          if (lit) rect(ctx, wx, y, 9, 1, P.yellow);
        } else windowCell(ctx, wx, y, 12, 10, lit, rand, true);
      }
    }
    if (glassy) for (let wx = x; wx < x + w; wx += 30) rect(ctx, wx, 0, 1, H - 40, P.darkSlate);
    rect(ctx, x, H - 42, w, 4, P.ink);
    rect(ctx, x, H - 42, w, 1, P.slate);
    const glass = store ? [P.white, P.cyan] : cafe ? [P.amber, P.yellow] : [P.lightGray, P.white];
    rect(ctx, x + 4, H - 38, w - 8, 34, P.ink);
    rect(ctx, x + 5, H - 37, w - 10, 32, glass[0]);
    for (let gx = x + 8; gx < x + w - 8; gx += 12) rect(ctx, gx, H - 37, 1, 32, glass[1]);
    if (store) {
      rect(ctx, x + 4, H - 50, w - 8, 9, P.sky);
      rect(ctx, x + 4, H - 50, w - 8, 3, P.green);
      glyphs(ctx, x + 12, H - 46, 50, P.white, rand);
      for (let sy = H - 32; sy < H - 8; sy += 7) rect(ctx, x + 10, sy, w - 40, 3, [P.red, P.sky, P.amber][sy % 3]);
    } else if (cafe) {
      rect(ctx, x + 10, H - 52, 40, 10, P.darkGreen);
      glyphs(ctx, x + 13, H - 49, 34, P.lightGray, rand);
      for (let k = 0; k < 3; k++) rect(ctx, x + 14 + k * 22, H - 24, 8, 8, P.darkBrown);
    } else {
      rect(ctx, x + w / 2 - 12, H - 34, 24, 30, P.darkSlate);
      rect(ctx, x + w / 2 - 11, H - 33, 10, 28, P.sky);
      rect(ctx, x + w / 2 + 1, H - 33, 10, 28, P.sky);
      rect(ctx, x + 8, H - 52, 30, 8, P.slate);
      glyphs(ctx, x + 10, H - 50, 26, P.white, rand);
    }
    rect(ctx, x, 0, 2, H, P.ink);
    glows.push({ x: x + w / 2, store, cafe });
    x += w;
    i++;
  }
  rect(ctx, 0, H - 4, W, 4, P.gray);
  rect(ctx, 0, H - 4, W, 1, P.lightGray);
  return c;
}

function barracksRow(rand) {
  const W = MAP_W, H = 104;
  const [c, ctx] = makeCanvas(W, H);
  let x = 0;
  while (x < W) {
    const w = Math.min(W - x, 220 + Math.floor(rand() * 60));
    rect(ctx, x, 0, w, 30, P.darkGreen);
    for (let y = 0; y < 30; y += 4) rect(ctx, x, y, w, 1, P.deepTeal);
    rect(ctx, x, 26, w, 4, P.midGreen);
    rect(ctx, x, 29, w, 1, P.ink);
    rect(ctx, x, 30, w, H - 30, P.skinLight);
    rect(ctx, x, 30, w, 2, P.white);
    rect(ctx, x, H - 22, w, 2, P.skinMid);
    for (let wx = x + 12; wx < x + w - 24; wx += 30) windowCell(ctx, wx, 42, 18, 18, false, rand, false);
    const dx = x + Math.floor(w / 2) - 10;
    rect(ctx, dx, 68, 20, H - 72, P.ink);
    rect(ctx, dx + 1, 69, 18, H - 74, P.darkBrown);
    rect(ctx, dx + 1, 69, 18, 1, P.brown);
    rect(ctx, dx + 15, 84, 2, 2, P.amber);
    rect(ctx, x + 10, 70, 30, 10, P.white);
    glyphs(ctx, x + 12, 73, 26, P.red, rand);
    rect(ctx, x, 0, 2, H, P.ink);
    x += w + 0;
  }
  rect(ctx, 0, H - 4, W, 4, P.gray);
  rect(ctx, 0, H - 4, W, 1, P.lightGray);
  return c;
}

function reviewStand(rand) {
  const W = 210, H = 128;
  const [c, ctx] = makeCanvas(W, H);
  rect(ctx, 4, 24, W - 8, 60, P.skinLight);
  rect(ctx, 4, 24, W - 8, 2, P.white);
  rect(ctx, 70, 30, 70, 30, P.red);
  rect(ctx, 70, 30, 70, 2, P.salmon);
  glyphs(ctx, 76, 36, 60, P.white, rand, 2);
  disc(ctx, 105, 72, 7, P.amber);
  disc(ctx, 105, 72, 4, P.yellow);
  rect(ctx, 0, 6, W, 16, P.darkGreen);
  rect(ctx, 0, 6, W, 3, P.midGreen);
  rect(ctx, 0, 20, W, 2, P.deepTeal);
  rect(ctx, 8, 0, W - 16, 7, P.midGreen);
  rect(ctx, 8, 0, W - 16, 1, P.green);
  for (const px of [8, 58, 146, 196]) {
    rect(ctx, px, 22, 6, 64, P.lightGray);
    rect(ctx, px, 22, 2, 64, P.white);
    rect(ctx, px + 5, 22, 1, 64, P.gray);
  }
  rect(ctx, 0, 84, W, 10, P.lightGray);
  rect(ctx, 0, 84, W, 2, P.white);
  rect(ctx, 6, 94, W - 12, 10, P.gray);
  rect(ctx, 6, 94, W - 12, 1, P.lightGray);
  rect(ctx, 12, 104, W - 24, 10, P.slate);
  rect(ctx, 12, 104, W - 24, 1, P.gray);
  rect(ctx, 18, 114, W - 36, 12, P.darkSlate);
  rect(ctx, 18, 114, W - 36, 1, P.slate);
  rect(ctx, 93, 66, 24, 20, P.darkBrown);
  rect(ctx, 93, 66, 24, 2, P.brown);
  rect(ctx, 104, 60, 2, 7, P.ink);
  rect(ctx, 103, 58, 4, 3, P.slate);
  return outlined(c);
}

function barbedFenceH(len) {
  const H = 20;
  const [c, ctx] = makeCanvas(len, H);
  for (const wy of [4, 10, 16]) {
    for (let x = 0; x < len; x++) rect(ctx, x, wy + (x % 6 < 3 ? 0 : 1), 1, 1, P.gray);
    for (let x = 2; x < len; x += 6) {
      rect(ctx, x, wy - 1, 1, 1, P.lightGray);
      rect(ctx, x + 1, wy + 2, 1, 1, P.lightGray);
    }
  }
  for (let x = 1; x < len - 3; x += 24) {
    rect(ctx, x, 1, 3, H - 1, P.darkBrown);
    rect(ctx, x, 1, 1, H - 1, P.brown);
  }
  return { img: c, foot: null, shadow: null };
}

function meshFenceH(len) {
  const H = 26;
  const [c, ctx] = makeCanvas(len, H);
  for (let y = 4; y < H - 1; y++) for (let x = 0; x < len; x++) if ((x + y) % 4 === 0 || (x - y + 400) % 4 === 0) rect(ctx, x, y, 1, 1, P.midGreen);
  rect(ctx, 0, 2, len, 2, P.darkGreen);
  rect(ctx, 0, 2, len, 1, P.green);
  for (let x = 1; x < len - 3; x += 20) {
    rect(ctx, x, 1, 3, H - 1, P.darkGreen);
    rect(ctx, x, 1, 1, H - 1, P.green);
  }
  return { img: c, foot: null, shadow: null };
}

// ── 맵 조립 ──

function newMap(seed, shadowColor) {
  const [ground, g] = makeCanvas(MAP_W, MAP_H);
  return { w: MAP_W, h: MAP_H, ground, g, props: [], obstacles: [], start: { ...START }, rand: rng(seed), shadow: shadowColor, keepOut: [] };
}

const overlaps = (a, b, m = 0) => a.x - m < b.x + b.w && a.x + a.w + m > b.x && a.y - m < b.y + b.h && a.y + a.h + m > b.y;

// 소품을 발밑 가운데(fx)·발밑 아래끝(fy) 기준으로 놓는다
function put(m, prop, fx, fy, { solid = true, drawShadow = true } = {}) {
  const f = prop.foot ?? { dx: 0, dy: prop.img.height - 2, w: prop.img.width, h: 2 };
  const x = Math.round(fx - (f.dx + f.w / 2));
  const y = Math.round(fy - (f.dy + f.h));
  m.props.push({ img: prop.img, x, y, baseY: y + f.dy + f.h });
  const box = { x: x + f.dx, y: y + f.dy, w: f.w, h: f.h };
  if (solid && prop.foot) m.obstacles.push(box);
  if (drawShadow && prop.shadow) shadow(m, x + f.dx + f.w / 2, y + f.dy + f.h - 1, prop.shadow.rx, prop.shadow.ry);
  return box;
}

function canPlace(m, box, margin) {
  if (box.x < 40 || box.y < 40 || box.x + box.w > MAP_W - 40 || box.y + box.h > MAP_H - 40) return false;
  if (overlaps(box, START_ZONE)) return false;
  for (const k of m.keepOut) if (overlaps(box, k)) return false;
  for (const o of m.obstacles) if (overlaps(box, o, margin)) return false;
  return true;
}

// 영역 안 빈 곳에 무작위로 놓는다. 장애물끼리는 margin 이상 떨어뜨려 길을 막지 않는다
function scatter(m, make, count, area, { margin = 50, solid = true, keep = null } = {}) {
  let placed = 0;
  for (let tries = 0; tries < count * 30 && placed < count; tries++) {
    const prop = make(placed, tries);
    const f = prop.foot ?? { dx: 0, dy: prop.img.height - 4, w: prop.img.width, h: 4 };
    const fx = area.x + m.rand() * area.w, fy = area.y + m.rand() * area.h;
    const box = { x: fx - f.w / 2, y: fy - f.h, w: f.w, h: f.h };
    if (!canPlace(m, box, solid && prop.foot ? margin : 4)) continue;
    if (keep && !keep(fx, fy)) continue;
    put(m, prop, fx, fy, { solid });
    placed++;
  }
  return placed;
}

function border(m, { top = 40, bottom = 40, left = 40, right = 40 } = {}) {
  m.obstacles.push({ x: 0, y: 0, w: MAP_W, h: top });
  m.obstacles.push({ x: 0, y: MAP_H - bottom, w: MAP_W, h: bottom });
  m.obstacles.push({ x: 0, y: 0, w: left, h: MAP_H });
  m.obstacles.push({ x: MAP_W - right, y: 0, w: right, h: MAP_H });
}

function finish(m) {
  m.props.sort((a, b) => a.baseY - b.baseY);
  const { w, h, ground, props, obstacles, start } = m;
  return { w, h, ground, props, obstacles, start };
}

function sidewalkTiles(ctx, x0, y0, w, h, base, grout, seed) {
  const hash = (a, b) => (((a * 73856093) ^ (b * 19349663) ^ seed) >>> 0) % 1009;
  paint(ctx, x0, y0, w, h, (x, y) => {
    const row = Math.floor((y - y0) / 16), off = (row % 2) * 8;
    const col = Math.floor((x - x0 + off) / 16);
    const tx = (x - x0 + off) % 16, ty = (y - y0) % 16;
    if (tx === 0 || ty === 0) return grout;
    const k = hash(col, row);
    if (ty === 1 && k % 4 === 0) return P.slate;
    if ((x * 5 + y * 11 + k) % 53 === 0) return grout;
    return k % 9 === 0 ? grout : base;
  });
}

function asphalt(ctx, x0, y0, w, h, ramp, seed) {
  paint(ctx, x0, y0, w, h, noise(ramp, { cell: 30, seed, contrast: 1.1, detail: 0.6, grain: 0.35 }));
}

function curbH(ctx, x, y, w) {
  rect(ctx, x, y, w, 3, P.gray);
  rect(ctx, x, y, w, 1, P.lightGray);
  rect(ctx, x, y + 3, w, 1, P.ink);
}

function curbV(ctx, x, y, h) {
  rect(ctx, x, y, 3, h, P.gray);
  rect(ctx, x, y, 1, h, P.lightGray);
  rect(ctx, x + 3, y, 1, h, P.ink);
}

function roofBand(m, y, h, seed) {
  const rand = rng(seed);
  paint(m.g, 0, y, MAP_W, h, noise([P.deepTeal, P.darkGreen], { cell: 24, seed, contrast: 1.2, grain: 0.2 }));
  rect(m.g, 0, y, MAP_W, 4, P.slate);
  rect(m.g, 0, y, MAP_W, 1, P.gray);
  rect(m.g, 0, y + 4, MAP_W, 1, P.ink);
  for (let x = 0; x < MAP_W; x += 130 + Math.floor(rand() * 60)) {
    rect(m.g, x, y + 4, 2, h - 4, P.ink);
    const ax = x + 20 + Math.floor(rand() * 60), ay = y + 12 + Math.floor(rand() * (h - 26));
    rect(m.g, ax, ay, 16, 12, P.ink);
    rect(m.g, ax + 1, ay + 1, 14, 10, P.gray);
    rect(m.g, ax + 1, ay + 1, 14, 2, P.lightGray);
    ring(m.g, ax + 8, ay + 7, 3, 1, P.darkSlate);
  }
}

function sideWall(m, x, w, night, seed) {
  const rand = rng(seed);
  paint(m.g, x, 0, w, MAP_H, noise(night ? [P.ink, P.navy] : [P.darkBrown, P.brown], { cell: 20, seed, grain: 0.15 }));
  for (let y = 0; y < MAP_H; y += 18) {
    rect(m.g, x, y, w, 1, P.ink);
    if (night && rand() < 0.4) {
      const wy = y + 6;
      rect(m.g, x + 6, wy, w - 12, 6, rand() < 0.5 ? P.amber : P.darkSlate);
    }
  }
  rect(m.g, x === 0 ? w - 2 : x, 0, 2, MAP_H, night ? P.slate : P.orangeBrown);
}

// ── 시대 0 · 서울 초원 ──
function buildMeadow() {
  const m = newMap(101, P.darkGreen);
  const g = m.g;
  paint(g, 0, 0, MAP_W, MAP_H, noise([P.darkGreen, P.midGreen, P.midGreen, P.midGreen, P.midGreen, P.midGreen, P.green], { cell: 120, seed: 3, contrast: 1.8, detail: 0.28, grain: 0.12 }));
  const rand = rng(11);
  for (let i = 0; i < 4200; i++) {
    const x = Math.floor(rand() * MAP_W), y = Math.floor(rand() * MAP_H);
    const col = rand() < 0.5 ? P.darkGreen : rand() < 0.7 ? P.green : P.deepTeal;
    rect(g, x, y, 1, 2, col);
    rect(g, x + 1, y - 1, 1, 2, col);
    if (rand() < 0.3) rect(g, x - 1, y, 1, 1, col);
  }

  // 흙길
  const route = smoothPath([[0, 640], [180, 600], [330, 650], [470, 600], [620, 560], [780, 520], [930, 430], [1060, 400], [1200, 360]]);
  const branch = smoothPath([[930, 430], [900, 320], [940, 220], [900, 120], [920, 0]]);
  const pathFill = noise([P.brown, P.orangeBrown, P.orangeBrown, P.skinMid], { cell: 26, seed: 5, contrast: 1.3, grain: 0.25 });
  for (const pts of [route, branch]) {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const bx = Math.min(...xs) - 24, by = Math.min(...ys) - 24;
    paint(g, bx, by, Math.max(...xs) - bx + 24, Math.max(...ys) - by + 24, (x, y) => {
      const d = pathDist(pts, x, y);
      if (d < 14) return pathFill(x, y);
      if (d < 16) return (x + y) % 2 ? P.darkBrown : null;
      return null;
    });
  }
  for (let i = 0; i < 300; i++) {
    const p = route[Math.floor(rand() * route.length)];
    rect(g, p[0] + (rand() - 0.5) * 22, p[1] + (rand() - 0.5) * 22, 1, 1, rand() < 0.5 ? P.lightGray : P.darkBrown);
  }
  m.keepOut.push(...[route, branch].flatMap((pts) => pts.filter((_, i) => i % 3 === 0).map(([x, y]) => ({ x: x - 22, y: y - 22, w: 44, h: 44 }))));

  // 꽃밭
  const flowerCols = [P.white, P.yellow, P.salmon, P.hotPink, P.lightGray];
  for (let k = 0; k < 26; k++) {
    const cx = 60 + rand() * 1080, cy = 60 + rand() * 780;
    const col = flowerCols[k % flowerCols.length];
    for (let i = 0; i < 9; i++) {
      const x = Math.round(cx + (rand() - 0.5) * 50), y = Math.round(cy + (rand() - 0.5) * 30);
      rect(g, x - 1, y, 3, 1, col);
      rect(g, x, y - 1, 1, 3, col);
      rect(g, x, y, 1, 1, P.amber);
    }
  }

  // 연못
  const pond = { x: 210, y: 250, rx: 92, ry: 50 };
  const water = noise([P.blue, P.blue, P.sky], { cell: 30, seed: 9, contrast: 1.4, grain: 0.15 });
  paint(g, pond.x - pond.rx - 6, pond.y - pond.ry - 6, pond.rx * 2 + 12, pond.ry * 2 + 12, (x, y) => {
    const wob = Math.sin(x * 0.09) * 0.05 + Math.sin(y * 0.13) * 0.05;
    const d = ((x - pond.x) / pond.rx) ** 2 + ((y - pond.y) / pond.ry) ** 2 + wob;
    if (d > 1.12) return null;
    if (d > 1) return P.darkBrown;
    if (d > 0.9) return y > pond.y ? P.blue : P.navy;
    return water(x, y);
  });
  for (let i = 0; i < 26; i++) {
    const x = pond.x + (rand() - 0.5) * pond.rx * 1.3, y = pond.y + (rand() - 0.5) * pond.ry * 1.2;
    rect(g, x, y, 3 + rand() * 5, 1, rand() < 0.6 ? P.cyan : P.white);
  }
  for (let i = 0; i < 4; i++) {
    const x = pond.x - 40 + i * 26, y = pond.y - 10 + (i % 2) * 18;
    disc(g, x, y, 5, P.midGreen);
    rect(g, x - 1, y - 1, 2, 2, P.green);
    if (i % 2 === 0) rect(g, x + 1, y - 2, 2, 2, P.salmon);
  }
  m.obstacles.push({ x: pond.x - pond.rx * 0.88, y: pond.y - pond.ry * 0.78, w: pond.rx * 1.76, h: pond.ry * 1.56 });
  for (let i = 0; i < 14; i++) {
    const a = rand() * TAU;
    put(m, reed(i + 40), pond.x + Math.cos(a) * pond.rx * 1.02, pond.y + Math.sin(a) * pond.ry * 1.02 + 6, { solid: false });
  }

  // 모래 놀이터
  const sand = noise([P.skinMid, P.skinLight, P.skinLight], { cell: 20, seed: 13, grain: 0.3 });
  const pg = { x: 860, y: 640, w: 200, h: 120 };
  paint(g, pg.x - 2, pg.y - 2, pg.w + 4, pg.h + 4, (x, y) => {
    const inside = x >= pg.x && x < pg.x + pg.w && y >= pg.y && y < pg.y + pg.h;
    const edge = !inside;
    return edge ? P.darkBrown : (x - pg.x < 2 || y - pg.y < 2 ? P.skinDark : sand(x, y));
  });
  put(m, slide(), pg.x + 60, pg.y + 70);
  put(m, bench(), pg.x + 150, pg.y + 112);

  // 테두리 숲
  border(m, { top: 58, bottom: 44, left: 44, right: 44 });
  let s = 200;
  for (let pass = 0; pass < 2; pass++) {
    const inset = pass === 0 ? 14 : 38;
    // 테두리 숲은 나무 12종을 돌려 쓴다
    const bt = () => tree(200 + (s++ % 12), 15 + (s % 3) * 3);
    for (let x = -10; x < MAP_W + 20; x += 22 + rand() * 14) put(m, bt(), x, inset + 16 + rand() * 6, { solid: false });
    for (let x = -10; x < MAP_W + 20; x += 22 + rand() * 14) put(m, bt(), x, MAP_H - 40 + inset * 0.9 + rand() * 6, { solid: false });
    for (let y = 40; y < MAP_H - 30; y += 24 + rand() * 12) {
      put(m, bt(), inset - 6 + rand() * 8, y, { solid: false });
      put(m, bt(), MAP_W - inset + 6 - rand() * 8, y, { solid: false });
    }
  }

  // 학원 간판 (길가)
  put(m, signboard(71, P.blue, P.amber), 1010, 380);
  put(m, signboard(72, P.red, P.yellow), 860, 250);
  put(m, signboard(73, P.darkGreen, P.white), 300, 590);
  put(m, fenceH(80), 140, 700);
  put(m, fenceH(66), 560, 650);
  put(m, fenceH(80), 1040, 470);

  const inner = { x: 70, y: 80, w: MAP_W - 140, h: MAP_H - 150 };
  scatter(m, (i) => tree(500 + i, 16 + (i % 3) * 3), 12, inner, { margin: 60 });
  scatter(m, (i) => bush(600 + i, 8 + (i % 3) * 2, GREEN, i % 3 === 0 ? [P.white, P.salmon] : null), 26, inner, { solid: false });
  scatter(m, (i) => rock(700 + i, 9, true), 5, inner, { margin: 60 });
  scatter(m, (i) => rock(720 + i, 4 + (i % 3)), 18, inner, { solid: false });
  return finish(m);
}

// ── 시대 1 · 인천 학교 ──
function buildSchool() {
  const m = newMap(202, P.brown);
  const g = m.g;
  const rand = rng(21);
  paint(g, 0, 0, MAP_W, MAP_H, noise([P.brown, P.orangeBrown, P.orangeBrown, P.skinMid], { cell: 80, seed: 4, contrast: 1.4, grain: 0.22 }));
  for (let i = 0; i < 2600; i++) rect(g, rand() * MAP_W, rand() * MAP_H, 1, 1, rand() < 0.5 ? P.skinLight : P.darkBrown);

  // 트랙 (스타디움 모양 붉은 우레탄)
  const T = { cx: 560, cy: 520, half: 190, r: 160, band: 40 };
  const track = noise([P.darkRed, P.brick, P.brick], { cell: 16, seed: 6, contrast: 1.2, grain: 0.3 });
  const field = noise([P.orangeBrown, P.skinMid, P.skinMid], { cell: 60, seed: 8, contrast: 1.3, grain: 0.2 });
  paint(g, T.cx - T.half - T.r - 2, T.cy - T.r - 2, (T.half + T.r) * 2 + 4, T.r * 2 + 4, (x, y) => {
    const d = segDist(x, y, T.cx - T.half, T.cy, T.cx + T.half, T.cy);
    const inner = T.r - T.band;
    if (d > T.r) return null;
    if (d > T.r - 1.2 || (d < inner + 1.2 && d > inner - 0.2)) return P.white;
    if (d >= inner) {
      for (const lane of [inner + 10, inner + 20, inner + 30]) if (Math.abs(d - lane) < 0.6) return (x + y) % 5 ? P.lightGray : P.brick;
      return track(x, y);
    }
    return field(x, y);
  });
  rect(g, T.cx - 1, T.cy - T.r + T.band, 2, (T.r - T.band) * 2, P.lightGray);
  ring(g, T.cx, T.cy, 36, 1, P.lightGray);
  for (const side of [-1, 1]) {
    const gx = T.cx + side * (T.half + 30);
    rect(g, gx - (side > 0 ? 50 : 0), T.cy - 50, 50, 1, P.lightGray);
    rect(g, gx - (side > 0 ? 50 : 0), T.cy + 50, 50, 1, P.lightGray);
    rect(g, side > 0 ? gx - 50 : gx + 50, T.cy - 50, 1, 101, P.lightGray);
    put(m, goal(), gx + side * 8, T.cy + 16, { solid: false });
  }
  for (let i = 0; i < 6; i++) rect(g, T.cx - T.half - 20 + i * 12, T.cy + T.r - 12, 1, 10, P.white);

  // 농구 코트
  const C = { x: 935, y: 300, w: 200, h: 300 };
  const concrete = noise([P.slate, P.gray, P.gray], { cell: 30, seed: 12, contrast: 1.1, grain: 0.25 });
  paint(g, C.x - 10, C.y - 10, C.w + 20, C.h + 20, (x, y) => {
    const ix = x - C.x, iy = y - C.y;
    if (ix < 0 || iy < 0 || ix >= C.w || iy >= C.h) return concrete(x, y);
    if (ix < 2 || iy < 2 || ix >= C.w - 2 || iy >= C.h - 2) return P.white;
    if (Math.abs(iy - C.h / 2) < 1) return P.white;
    const keyW = 60;
    for (const ky of [0, C.h]) {
      const dy = Math.abs(iy - ky);
      if (Math.abs(ix - C.w / 2) < keyW / 2 && dy < 70) {
        if (Math.abs(ix - C.w / 2) > keyW / 2 - 2 || Math.abs(dy - 70) < 1) return P.white;
        return P.brick;
      }
      const arc = Math.hypot(ix - C.w / 2, dy);
      if (Math.abs(arc - 96) < 1 && dy < 100) return P.white;
    }
    const cc = Math.hypot(ix - C.w / 2, iy - C.h / 2);
    if (Math.abs(cc - 26) < 1) return P.white;
    return (ix + iy) % 7 === 0 ? P.navy : P.blue;
  });
  put(m, hoop(), C.x + C.w / 2, C.y + 22);
  put(m, hoop(), C.x + C.w / 2, C.y + C.h - 4);

  // 교사동
  const school = schoolBuilding(rand);
  m.props.push({ img: school, x: 0, y: 0, baseY: school.height });
  paint(g, 0, school.height, MAP_W, 8, (x, y) => ((x + y) % 2 === 0 ? m.shadow : null));
  put(m, flagpole('korea'), 520, 190);
  put(m, flagpole('school'), 680, 190);

  // 담장
  border(m, { top: school.height - 4, bottom: 36, left: 34, right: 34 });
  paint(g, 0, MAP_H - 36, MAP_W, 36, noise([P.slate, P.gray], { cell: 20, seed: 17, grain: 0.2 }));
  paint(g, 0, 0, 34, MAP_H, noise([P.slate, P.gray], { cell: 20, seed: 18, grain: 0.2 }));
  paint(g, MAP_W - 34, 0, 34, MAP_H, noise([P.slate, P.gray], { cell: 20, seed: 19, grain: 0.2 }));
  for (let x = 0; x < MAP_W; x += 120) {
    const f = meshFenceH(120);
    m.props.push({ img: f.img, x, y: MAP_H - 50, baseY: MAP_H - 24 });
  }
  for (const wx of [32, MAP_W - 36]) {
    rect(g, wx, 0, 4, MAP_H, P.darkGreen);
    for (let y = 130; y < MAP_H; y += 20) rect(g, wx - 1, y, 6, 3, P.midGreen);
  }

  const inner = { x: 60, y: 160, w: MAP_W - 120, h: MAP_H - 220 };
  const offTrack = (x, y) => segDist(x, y, T.cx - T.half, T.cy, T.cx + T.half, T.cy) > T.r + 16 && !(x > C.x - 20 && x < C.x + C.w + 20 && y > C.y - 20 && y < C.y + C.h + 20);
  for (let y = 180; y < MAP_H - 60; y += 70) {
    put(m, tree(800 + y, 15 + (y % 3) * 2), 70 + (y % 140 ? 0 : 14), y);
    put(m, tree(900 + y, 15 + (y % 4)), MAP_W - 70, y + 20);
  }
  put(m, pullupBars(), 170, 830);
  put(m, podium(), 600, 862);
  put(m, flowerBed(61), 380, 236);
  put(m, flowerBed(62), 820, 236);
  put(m, flowerBed(63, 48), 140, 520);
  put(m, shed(), 1010, 856);
  put(m, bench(), 360, 200);
  put(m, bench(), 760, 200);
  put(m, bench(), 400, 830);
  put(m, bench(), 760, 830);
  scatter(m, (i) => bush(1000 + i, 8 + (i % 2) * 2), 10, inner, { solid: false, keep: offTrack });
  scatter(m, (i) => rock(1100 + i, 3 + (i % 3)), 14, inner, { solid: false, keep: offTrack });
  return finish(m);
}

// ── 시대 2 · 가천대 앞 술집 거리 (밤) ──
function buildBarStreet() {
  const m = newMap(303, P.ink);
  const g = m.g;
  const rand = rng(31);
  const glows = [];
  const row = shopRow(rand, glows);
  m.props.push({ img: row, x: 0, y: 0, baseY: row.height });

  sidewalkTiles(g, 0, 120, MAP_W, 76, P.darkSlate, P.navy, 3);
  curbH(g, 0, 194, MAP_W);
  asphalt(g, 0, 198, MAP_W, 120, [P.ink, P.navy, P.navy], 4);
  for (let x = 10; x < MAP_W; x += 44) rect(g, x, 256, 22, 2, P.slate);
  for (let x = 560; x < 640; x += 12) rect(g, x, 204, 7, 108, P.gray);
  curbH(g, 0, 318, MAP_W);

  // 먹자골목 보도블록: 블록마다 톤이 조금씩 다르다
  const tones = [P.darkSlate, P.darkSlate, P.darkSlate, P.navy, P.slate];
  const hash = (a, b) => (((a * 73856093) ^ (b * 19349663)) >>> 0) % 997;
  paint(g, 0, 322, MAP_W, 530, (x, y) => {
    const row = Math.floor((y - 322) / 12), ry = (y - 322) % 12;
    const off = (row % 2) * 12, col = Math.floor((x + off) / 24), rx = (x + off) % 24;
    if (ry === 0 || rx === 0) return P.navy;
    const h = hash(col, row);
    const tone = tones[h % tones.length === 4 && h % 3 ? 0 : h % tones.length];
    if (ry === 1 && tone !== P.navy) return tone === P.slate ? P.gray : P.slate;
    if ((x * 7 + y * 13 + h) % 41 === 0) return P.navy;
    return tone;
  });
  roofBand(m, 852, 48, 9);
  sideWall(m, 0, 32, true, 10);
  sideWall(m, MAP_W - 32, 32, true, 11);
  border(m, { top: row.height - 4, bottom: 52, left: 32, right: 32 });

  // 가게 불빛이 보도에 비친다
  for (const gl of glows) {
    if (gl.color) ditherGlow(g, Math.round(gl.x), 136, 22, gl.color, 0.35, Math.round(gl.x));
    else {
      ditherGlow(g, Math.round(gl.x), 128, 44, gl.store ? P.slate : P.brown, 0.6, Math.round(gl.x) + 1);
      ditherGlow(g, Math.round(gl.x), 124, 26, gl.store ? P.gray : P.orangeBrown, 0.5, Math.round(gl.x) + 2);
      ditherGlow(g, Math.round(gl.x), 122, 12, gl.store ? P.lightGray : P.amber, 0.4, Math.round(gl.x) + 3);
    }
  }

  const lampAt = (x, y) => {
    ditherGlow(g, x + 8, y - 6, 54, P.brown, 0.5, x * 3 + y);
    ditherGlow(g, x + 8, y - 6, 32, P.orangeBrown, 0.45, x * 5 + y);
    ditherGlow(g, x + 8, y - 6, 14, P.amber, 0.4, x * 7 + y);
    put(m, lamp(true, true), x, y);
  };
  for (let x = 120; x < MAP_W; x += 240) lampAt(x, 192);
  for (const [x, y] of [[90, 470], [1110, 470], [330, 780], [870, 780], [600, 820]]) lampAt(x, y);

  // 포차와 테이블
  const tents = [[170, 450], [1030, 440], [200, 760], [1000, 770]];
  tents.forEach(([x, y], i) => {
    ditherGlow(g, x, y - 10, 62, P.brown, 0.5, i + 50);
    ditherGlow(g, x, y - 10, 38, P.orangeBrown, 0.45, i + 60);
    put(m, pocha(400 + i), x, y);
  });
  for (const [x, y] of [[300, 420], [290, 540], [910, 420], [920, 560], [340, 700], [860, 700], [480, 780], [720, 780]]) put(m, tableSet(x + y), x, y);
  for (const [x, y] of [[50, 340], [1150, 340], [60, 840], [1140, 840], [600, 130]]) put(m, trashBags(x), x, y, { solid: false });
  put(m, carSide(P.amber, P.yellow, P.orange), 160, 312);
  put(m, carSide(P.lightGray, P.white, P.gray), 1020, 312);
  return finish(m);
}

// ── 시대 3 · 21사단 신병교육대대 ──
function buildArmy() {
  const m = newMap(404, P.skinDark);
  const g = m.g;
  const rand = rng(41);
  paint(g, 0, 0, MAP_W, MAP_H, noise([P.skinDark, P.skinMid, P.skinMid, P.skinLight], { cell: 90, seed: 14, contrast: 1.3, grain: 0.2 }));
  for (let i = 0; i < 3000; i++) rect(g, rand() * MAP_W, rand() * MAP_H, 1, 1, rand() < 0.6 ? P.brown : P.skinLight);
  // 가장자리 잔디
  const grass = noise([P.darkGreen, P.midGreen, P.midGreen], { cell: 30, seed: 15, grain: 0.3 });
  paint(g, 0, 0, MAP_W, MAP_H, (x, y) => {
    const e = Math.min(x - 30, MAP_W - 30 - x, MAP_H - 30 - y);
    if (e > 34 || y < 100) return null;
    if (e > 26) return (x + y) % 2 === 0 && (x * 7 + y * 3) % 5 < 2 ? P.midGreen : null;
    return grass(x, y);
  });
  // 연병장 행진선
  const PG = { x: 240, y: 230, w: 720, h: 480 };
  for (let y = PG.y; y <= PG.y + PG.h; y += 48) for (let x = PG.x; x < PG.x + PG.w; x += 10) rect(g, x, y, 6, 1, P.white);
  for (let x = PG.x; x <= PG.x + PG.w; x += 80) for (let y = PG.y; y < PG.y + PG.h; y += 10) rect(g, x, y, 1, 4, P.skinLight);
  rect(g, PG.x - 2, PG.y - 2, PG.w + 4, 2, P.white);
  rect(g, PG.x - 2, PG.y + PG.h, PG.w + 4, 2, P.white);

  const bar = barracksRow(rand);
  m.props.push({ img: bar, x: 0, y: 0, baseY: bar.height });
  paint(g, 0, bar.height, MAP_W, 6, (x, y) => ((x + y) % 2 === 0 ? P.skinDark : null));
  const stand = reviewStand(rand);
  const sx = 600 - stand.width / 2, sy = 40;
  shadow(m, 600, sy + stand.height, 110, 8);
  m.props.push({ img: stand, x: sx, y: sy, baseY: sy + stand.height });
  m.obstacles.push({ x: sx + 4, y: sy + 80, w: stand.width - 8, h: stand.height - 82 });
  put(m, flagpole('korea'), 460, 200);
  put(m, flagpole('unit'), 740, 200);

  // 철조망
  border(m, { top: bar.height - 4, bottom: 30, left: 30, right: 30 });
  for (let x = 0; x < MAP_W; x += 120) {
    const f = barbedFenceH(120);
    m.props.push({ img: f.img, x, y: MAP_H - 30, baseY: MAP_H - 10 });
  }
  for (const wx of [14, MAP_W - 16]) {
    for (let y = 100; y < MAP_H; y++) rect(g, wx + (y % 6 < 3 ? 0 : 1), y, 1, 1, P.gray);
    for (let y = 100; y < MAP_H; y += 24) {
      rect(g, wx - 1, y, 4, 4, P.darkBrown);
      rect(g, wx - 1, y, 1, 4, P.brown);
    }
  }

  // 모래주머니 진지
  for (const [x, y, len] of [[130, 330, 66], [110, 520, 88], [170, 700, 66], [1050, 260, 66]]) put(m, sandbags(len), x, y);
  // 타이어 장애물 코스
  for (let r = 0; r < 6; r++) for (let k = 0; k < 2; k++) tireFlat(g, 1010 + k * 18 + (r % 2) * 9, 380 + r * 26);
  for (let r = 0; r < 4; r++) tireFlat(g, 1080 + (r % 2) * 9, 380 + r * 30);
  put(m, truck(), 960, 830);
  put(m, truck(), 1090, 760);
  for (const [x, y] of [[70, 200], [70, 420], [80, 640], [1130, 210], [1140, 600]]) put(m, tree(x + y, 14, GREEN), x, y);
  scatter(m, (i) => rock(1300 + i, 3 + (i % 3)), 16, { x: 60, y: 140, w: 1080, h: 700 }, { solid: false });
  return finish(m);
}

// ── 시대 4 · 퇴근 후 밤거리 ──
function buildNightCity() {
  const m = newMap(505, P.ink);
  const g = m.g;
  const rand = rng(51);
  const glows = [];
  const row = officeRow(rand, glows);
  m.props.push({ img: row, x: 0, y: 0, baseY: row.height });

  sidewalkTiles(g, 0, 0, MAP_W, MAP_H, P.darkSlate, P.navy, 21);
  const H = { y: 420, h: 120 }, V = { x: 540, w: 120 };
  asphalt(g, 0, H.y, MAP_W, H.h, [P.ink, P.navy, P.navy], 22);
  asphalt(g, V.x, row.height, V.w, MAP_H - row.height, [P.ink, P.navy, P.navy], 23);
  curbH(g, 0, H.y - 4, V.x);
  curbH(g, V.x + V.w, H.y - 4, MAP_W - V.x - V.w);
  curbH(g, 0, H.y + H.h, V.x);
  curbH(g, V.x + V.w, H.y + H.h, MAP_W - V.x - V.w);
  curbV(g, V.x - 4, row.height, H.y - row.height);
  curbV(g, V.x + V.w, row.height, H.y - row.height);
  curbV(g, V.x - 4, H.y + H.h + 4, MAP_H - H.y - H.h);
  curbV(g, V.x + V.w, H.y + H.h + 4, MAP_H - H.y - H.h);
  // 차선
  for (let x = 0; x < MAP_W; x++) if (x < V.x - 40 || x > V.x + V.w + 40) {
    rect(g, x, H.y + H.h / 2 - 2, 1, 1, P.amber);
    rect(g, x, H.y + H.h / 2 + 1, 1, 1, P.amber);
    if (x % 40 < 20) {
      rect(g, x, H.y + 30, 1, 1, P.gray);
      rect(g, x, H.y + 90, 1, 1, P.gray);
    }
  }
  for (let y = row.height; y < MAP_H; y++) if (y < H.y - 40 || y > H.y + H.h + 40) {
    rect(g, V.x + V.w / 2 - 2, y, 1, 1, P.amber);
    rect(g, V.x + V.w / 2 + 1, y, 1, 1, P.amber);
  }
  // 횡단보도
  for (let y = H.y + 4; y < H.y + H.h - 4; y += 12) {
    rect(g, V.x - 34, y, 26, 7, P.lightGray);
    rect(g, V.x + V.w + 8, y, 26, 7, P.lightGray);
  }
  for (let x = V.x + 4; x < V.x + V.w - 4; x += 12) {
    rect(g, x, H.y - 34, 7, 26, P.lightGray);
    rect(g, x, H.y + H.h + 8, 7, 26, P.lightGray);
  }
  roofBand(m, 856, 44, 24);
  sideWall(m, 0, 36, true, 25);
  sideWall(m, MAP_W - 36, 36, true, 26);
  border(m, { top: row.height - 4, bottom: 48, left: 36, right: 36 });

  for (const gl of glows) {
    const x = Math.round(gl.x);
    if (gl.store) {
      ditherGlow(g, x, 146, 56, P.blue, 0.7, x);
      ditherGlow(g, x, 142, 34, P.sky, 0.55, x + 1);
      ditherGlow(g, x, 138, 16, P.cyan, 0.4, x + 2);
    } else if (gl.cafe) {
      ditherGlow(g, x, 142, 40, P.darkBrown, 0.7, x);
      ditherGlow(g, x, 140, 22, P.brown, 0.5, x + 1);
    } else ditherGlow(g, x, 140, 30, P.slate, 0.6, x);
  }
  const lampAt = (x, y) => {
    ditherGlow(g, x + 8, y - 4, 52, P.slate, 0.65, x + y * 3);
    ditherGlow(g, x + 8, y - 4, 26, P.gray, 0.45, x + y * 5);
    put(m, lamp(false, true), x, y);
  };
  for (const [x, y] of [[370, 300], [830, 300], [370, 670], [830, 670], [200, 400], [960, 580], [280, 580], [900, 400], [500, 250], [690, 760]]) lampAt(x, y);

  // 주차된 차
  const cars = [[P.red, P.salmon, P.darkRed], [P.lightGray, P.white, P.gray], [P.navy, P.slate, P.ink], [P.amber, P.yellow, P.orange], [P.darkGreen, P.midGreen, P.deepTeal], [P.white, P.white, P.lightGray]];
  [[120, 440], [260, 440], [870, 528], [1040, 528], [140, 528], [1080, 440]].forEach(([x, y], i) => put(m, carSide(...cars[i % cars.length]), x, y));
  [[560, 230], [640, 290], [560, 700], [640, 820]].forEach(([x, y], i) => put(m, carFront(...cars[(i + 2) % cars.length]), x, y));

  put(m, busStop(), 300, 400);
  put(m, vending(), 352, 398);
  for (const [x, y] of [[180, 214], [260, 236], [420, 214]]) put(m, parasolTable(x + y), x, y);
  for (const [x, y] of [[300, 480], [600, 300], [900, 480], [600, 700]]) manhole(g, x, y);
  for (const x of [V.x - 8, V.x + V.w + 6]) for (const y of [H.y - 42, H.y + H.h + 38]) for (let k = 0; k < 3; k++) {
    rect(g, x - 1, y + k * 10, 4, 4, P.ink);
    rect(g, x, y + k * 10, 2, 3, P.lightGray);
  }
  for (const [x, y] of [[120, 300], [380, 300], [820, 300], [1080, 300], [120, 700], [400, 760], [820, 700], [1080, 760], [250, 840], [950, 840]]) put(m, planterTree(x * 7 + y, true), x, y);
  for (const [x, y] of [[470, 860], [740, 160], [1150, 380]]) put(m, trashBags(x + y), x, y, { solid: false });
  return finish(m);
}

const BUILDERS = [buildMeadow, buildSchool, buildBarStreet, buildArmy, buildNightCity];
const cache = new Map();

export function buildMap(era) {
  if (!cache.has(era)) cache.set(era, BUILDERS[era]());
  return cache.get(era);
}
