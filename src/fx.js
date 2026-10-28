// 픽셀 이펙트: 충격파·음파·폭발·번개·연기·파티클·글자. 전부 저해상도 버퍼에 정수 좌표로 그린다.
import { P, makeCanvas, disc, ring } from './pixel.js';
import { projSprite, projFrames } from './items.js';

const TAU = Math.PI * 2;
const easeOut = (k) => 1 - (1 - k) ** 3;

// ── 글자: 픽셀 폰트를 그린 뒤 반투명 픽셀을 없애 또렷하게 만든다 ──
const textCache = new Map();
// 픽셀 폰트가 늦게 로드되면 대체 글꼴로 그려둔 글자를 버리고 다시 그린다
export const clearTextCache = () => textCache.clear();
export function pixelText(str, { font = '10px Galmuri9', color = P.white, outline = P.ink } = {}) {
  const key = `${str}|${font}|${color}|${outline}`;
  if (textCache.has(key)) return textCache.get(key);
  const [m, mctx] = makeCanvas(1, 1);
  mctx.font = font;
  const w = Math.ceil(mctx.measureText(str).width) + 4;
  const size = parseInt(font, 10);
  const h = size + 6;
  const [c, ctx] = makeCanvas(w, h);
  ctx.font = font;
  ctx.textBaseline = 'top';
  ctx.fillStyle = color;
  ctx.fillText(str, 2, 2);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    solid[i] = d[i * 4 + 3] > 110 ? 1 : 0;
    d[i * 4 + 3] = solid[i] ? 255 : 0;
  }
  ctx.putImageData(img, 0, 0);
  if (outline) {
    const out = ctx.getImageData(0, 0, w, h);
    const o = out.data;
    const rgb = [1, 3, 5].map((i) => parseInt(outline.slice(i, i + 2), 16));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (solid[i]) continue;
        const near = (x > 0 && solid[i - 1]) || (x < w - 1 && solid[i + 1]) || (y > 0 && solid[i - w]) || (y < h - 1 && solid[i + w]);
        if (near) {
          o[i * 4] = rgb[0];
          o[i * 4 + 1] = rgb[1];
          o[i * 4 + 2] = rgb[2];
          o[i * 4 + 3] = 255;
        }
      }
    }
    ctx.putImageData(out, 0, 0);
  }
  textCache.set(key, c);
  return c;
}

// ── 그림자: 캐릭터 발밑 납작한 타원 ──
const shadowCache = new Map();
export function shadow(w) {
  if (!shadowCache.has(w)) {
    const h = Math.max(3, Math.round(w / 3));
    const [c, ctx] = makeCanvas(w, h);
    ctx.fillStyle = P.ink;
    for (let y = 0; y < h; y++) {
      const t = (y + 0.5) / h * 2 - 1;
      const half = Math.round((w / 2) * Math.sqrt(1 - t * t));
      ctx.fillRect(Math.round(w / 2 - half), y, half * 2, 1);
    }
    shadowCache.set(w, c);
  }
  return shadowCache.get(w);
}

// 부채꼴 호를 점으로 찍는다
function arcPixels(ctx, cx, cy, r, a0, a1, color, thick = 1) {
  ctx.fillStyle = color;
  const step = 0.8 / Math.max(r, 1);
  for (let a = a0; a <= a1; a += step) {
    for (let t = 0; t < thick; t++) {
      ctx.fillRect(Math.round(cx + Math.cos(a) * (r - t)), Math.round(cy + Math.sin(a) * (r - t)), 1, 1);
    }
  }
}

// ── 파티클 ──
export function burst(g, x, y, n, colors, speed = 60, life = 0.5, grav = 0) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    const s = speed * (0.4 + Math.random() * 0.8);
    g.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - grav * 0.15,
      life: life * (0.6 + Math.random() * 0.6), t: 0, grav,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() < 0.3 ? 2 : 1,
    });
  }
}

export function updateParticles(g, dt) {
  for (const p of g.particles) {
    p.t += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += p.grav * dt;
    p.vx *= 1 - 3 * dt;
    p.vy *= 1 - 3 * dt;
  }
  g.particles = g.particles.filter((p) => p.t < p.life);
  if (g.particles.length > 900) g.particles.splice(0, g.particles.length - 900);
}

export function drawParticles(ctx, g) {
  for (const p of g.particles) {
    ctx.fillStyle = p.color;
    const s = p.t > p.life * 0.6 ? 1 : p.size;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
  }
}

// ── 이펙트 (g.effects 항목) ──
export function drawEffect(ctx, fx) {
  const k = Math.min(1, fx.t / fx.dur);
  switch (fx.kind) {
    case 'ring': {
      // "동작 봐라" 충격파: 하얀 고리가 빨갛게 식으며 퍼진다
      const r = fx.r * (0.2 + 0.8 * easeOut(k));
      ring(ctx, fx.x, fx.y, r, k < 0.35 ? 3 : 2, k < 0.35 ? P.white : P.red);
      if (k < 0.7) ring(ctx, fx.x, fx.y, r * 0.7, 1, P.salmon);
      break;
    }
    case 'cone': {
      // 밴드부 음파: 세 겹 호가 앞으로 밀려 나간다
      const a0 = fx.ang - fx.half, a1 = fx.ang + fx.half;
      for (let i = 0; i < 3; i++) {
        const kk = Math.min(1, k * 1.4 - i * 0.18);
        if (kk <= 0) continue;
        const r = fx.range * easeOut(kk);
        arcPixels(ctx, fx.x, fx.y, r, a0 + 0.08, a1 - 0.08, i === 0 ? P.white : i === 1 ? P.cyan : P.pink, kk < 0.6 ? 2 : 1);
      }
      break;
    }
    case 'boom': {
      // 하트 폭발: 분홍 원판이 터지고 테두리만 남는다
      const r = fx.r * (0.3 + 0.7 * easeOut(k));
      if (k < 0.35) disc(ctx, fx.x, fx.y, r * 0.85, k < 0.15 ? P.white : P.salmon);
      ring(ctx, fx.x, fx.y, r, 2, k < 0.5 ? P.hotPink : P.pink);
      break;
    }
    case 'bolt': {
      // 벼락치기: 위에서 내리꽂는 번개 + 바닥 섬광
      if (k < 0.6) {
        const f = projSprite('bolt', Math.floor(fx.t * 24) % projFrames('bolt'));
        ctx.drawImage(f, Math.round(fx.x - f.width / 2), Math.round(fx.y - f.height + 4));
      }
      if (k < 0.4) disc(ctx, fx.x, fx.y, 8 - k * 10, k < 0.2 ? P.white : P.yellow);
      ring(ctx, fx.x, fx.y, 6 + k * 14, 1, P.amber);
      break;
    }
    case 'poof': {
      const n = projFrames('poof');
      const f = projSprite('poof', Math.min(n - 1, Math.floor(k * n)));
      ctx.drawImage(f, Math.round(fx.x - f.width / 2), Math.round(fx.y - f.height / 2));
      break;
    }
    case 'levelup': {
      // 발밑에서 솟는 금빛 기둥 + 두 겹 고리
      const h = 70 * easeOut(Math.min(1, k * 2));
      const w = Math.max(2, Math.round(14 * (1 - k)));
      ctx.globalAlpha = 0.55 * (1 - k);
      ctx.fillStyle = P.yellow;
      ctx.fillRect(Math.round(fx.x - w / 2), Math.round(fx.y - h), w, Math.round(h));
      ctx.fillStyle = P.white;
      ctx.fillRect(Math.round(fx.x - w / 4), Math.round(fx.y - h), Math.max(1, Math.round(w / 2)), Math.round(h));
      ctx.globalAlpha = 1;
      ring(ctx, fx.x, fx.y - 4, 8 + 30 * easeOut(k), 2, k < 0.5 ? P.yellow : P.amber);
      if (k > 0.15) ring(ctx, fx.x, fx.y - 4, 4 + 22 * easeOut(k - 0.15), 1, P.white);
      break;
    }
    case 'glow': {
      ring(ctx, fx.x, fx.y, 6 + fx.r * easeOut(k), k < 0.4 ? 2 : 1, k < 0.3 ? P.white : fx.color);
      break;
    }
    case 'note': {
      const f = projSprite('note', 0, fx.variant);
      ctx.drawImage(f, Math.round(fx.x + fx.vx * fx.t - f.width / 2), Math.round(fx.y + fx.vy * fx.t - f.height / 2));
      break;
    }
    case 'hit': {
      const f = projSprite('spark', k < 0.5 ? 0 : 1);
      ctx.drawImage(f, Math.round(fx.x - f.width / 2), Math.round(fx.y - f.height / 2));
      break;
    }
  }
}
