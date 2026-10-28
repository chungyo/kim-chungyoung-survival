// 모든 도트가 같이 쓰는 팔레트와 그리기 도구.
// 팔레트는 Endesga 32. 여기 없는 색은 쓰지 않는다.

export const P = {
  ink: '#181425', navy: '#262b44', darkSlate: '#3a4466', slate: '#5a6988', gray: '#8b9bb4', lightGray: '#c0cbdc', white: '#ffffff',
  deepBrown: '#3e2731', darkBrown: '#733e39', brown: '#b86f50', orangeBrown: '#d77643', brick: '#be4a2f',
  skinDark: '#c28569', skinMid: '#e4a672', skin: '#e8b796', skinLight: '#ead4aa',
  darkRed: '#a22633', red: '#e43b44', hotPink: '#ff0044', salmon: '#f6757a', pink: '#b55088', purple: '#68386c',
  orange: '#f77622', amber: '#feae34', yellow: '#fee761',
  green: '#63c74d', midGreen: '#3e8948', darkGreen: '#265c42', deepTeal: '#193c3e',
  blue: '#124e89', sky: '#0099db', cyan: '#2ce8f5',
};

export const DIRS = ['down', 'up', 'left', 'right'];

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

// 문자 격자 → 캔버스. '.'은 투명, 나머지 글자는 pal에서 색을 찾는다.
export function fromGrid(rows, pal) {
  const [c, ctx] = makeCanvas(rows[0].length, rows.length);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const col = pal[ch];
      if (!col) throw new Error(`palette has no '${ch}'`);
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  return c;
}

export function mirrorX(src) {
  const [c, ctx] = makeCanvas(src.width, src.height);
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return c;
}

// 맞았을 때 번쩍이는 용도: 같은 모양을 한 색으로 칠한 캔버스
export function silhouette(src, color = P.white) {
  const [c, ctx] = makeCanvas(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, src.width, src.height);
  return c;
}

// 투명하지 않은 픽셀 둘레에 1px 외곽선을 두른다 (캔버스가 사방 1px씩 커진다)
export function outlined(src, color = P.ink) {
  const w = src.width + 2, h = src.height + 2;
  const [c, ctx] = makeCanvas(w, h);
  const sil = silhouette(src, color);
  for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2]]) ctx.drawImage(sil, dx, dy);
  ctx.drawImage(src, 1, 1);
  return c;
}

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// 안티앨리어싱 없는 원 (채우기)
export function disc(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  cx = Math.round(cx);
  cy = Math.round(cy);
  r = Math.round(r);
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y + r * 0.8));
    ctx.fillRect(cx - half, cy + y, half * 2 + 1, 1);
  }
}

// 안티앨리어싱 없는 고리 (두께 t)
export function ring(ctx, cx, cy, r, t, color) {
  ctx.fillStyle = color;
  cx = Math.round(cx);
  cy = Math.round(cy);
  const ro = Math.round(r), ri = Math.max(0, ro - t);
  for (let y = -ro; y <= ro; y++) {
    const outer = Math.floor(Math.sqrt(Math.max(0, ro * ro - y * y + ro * 0.8)));
    const inner = Math.abs(y) < ri ? Math.floor(Math.sqrt(Math.max(0, ri * ri - y * y + ri * 0.8))) : -1;
    if (inner < 0) ctx.fillRect(cx - outer, cy + y, outer * 2 + 1, 1);
    else {
      ctx.fillRect(cx - outer, cy + y, outer - inner, 1);
      ctx.fillRect(cx + inner + 1, cy + y, outer - inner, 1);
    }
  }
}

// 브레젠험 직선 (굵기 w)
export function line(ctx, x0, y0, x1, y1, color, w = 1) {
  ctx.fillStyle = color;
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  const o = Math.floor(w / 2);
  for (;;) {
    ctx.fillRect(x0 - o, y0 - o, w, w);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

// 체크무늬 디더링으로 영역을 두 색 사이로 채운다 (빛 웅덩이, 그림자 등)
export function dither(ctx, x, y, w, h, color, density = 0.5, seed = 1) {
  const rand = rng(seed);
  ctx.fillStyle = color;
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const checker = (xx + yy) % 2 === 0;
      if ((density >= 0.5 ? checker || rand() < (density - 0.5) * 2 : checker && rand() < density * 2)) ctx.fillRect(x + xx, y + yy, 1, 1);
    }
  }
}

// 원형으로 갈수록 옅어지는 디더링 빛 (밤 맵 가로등 등)
export function ditherGlow(ctx, cx, cy, r, color, strength = 0.6, seed = 7) {
  const rand = rng(seed);
  ctx.fillStyle = color;
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const d = Math.sqrt(x * x + y * y) / r;
      if (d > 1) continue;
      const p = (1 - d) * strength;
      const bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]][(y + 64) % 4][(x + 64) % 4] / 16;
      if (p > bayer + (rand() - 0.5) * 0.05) ctx.fillRect(cx + x, cy + y, 1, 1);
    }
  }
}
