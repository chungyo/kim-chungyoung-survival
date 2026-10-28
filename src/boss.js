// 보스전: 보스 움직임·공격(탄)·마지막 한 방 연출. 상태(g)와 도우미(api)는 main.js가 넘겨준다.
// 보스는 이길 수 없다. 공격은 시간이 갈수록 빨라지고, 시간이 다 되면 피할 수 없는 마지막 한 방이 온다.
import { BOSSES, BULLET_DMG } from './data.js';
import { P, rect, ring, line, rng, makeCanvas } from './pixel.js';
import { bulletSprite, bulletFrames } from './boss-sprites.js';
import { bossSprite } from './art/bosses.js';
import { pixelText } from './fx.js';
import { sfx } from './audio.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (k) => 1 - (1 - k) ** 3;
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const BULLET_R = { xmark: 4, grayball: 4, mail: 4, fog: 6, rain: 2 };

export function makeBoss(era, p, map) {
  const def = BOSSES[era];
  return {
    boss: true, def, era,
    x: clamp(p.x, 40, map.w - 40), y: clamp(p.y - 110, 50, map.h - 30),
    r: def.r, xp: 0, spr: bossSprite(def.id),
    alpha: 0, flash: 0, dead: false, hitCd: 0,
    fire: 1.2, spin: 0, volley: 0, wander: Math.random() * TAU, pending: [],
  };
}

// 보스 몸통 가운데 (탄이 나오는 곳)
const body = (b) => ({ x: b.x, y: b.y - b.spr.footY / 2 });

function shoot(g, kind, x, y, angle, speed, extra) {
  g.bullets.push({ kind, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: BULLET_R[kind], life: 8, seed: Math.random() * 8, ...extra });
}

// ── 움직임 ──
const MOVE = {
  // 머리 위에서 내려다보며 따라온다
  study(b, p, dt, k, g) {
    const tx = p.x, ty = p.y - 95 + Math.sin(g.clock * 1.4) * 6;
    b.x += (tx - b.x) * Math.min(1, dt * (0.8 + k));
    b.y += (ty - b.y) * Math.min(1, dt * (0.8 + k));
  },
  // 다가가도 늘 같은 거리만큼 멀어진다. 끝까지 돌아보지 않는다
  friend(b, p, dt) {
    let dx = b.x - p.x, dy = b.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d;
    dy /= d;
    // 화면 밖으로 나가진 않게, 손 닿지 않을 만큼만 떨어져 있다
    const tx = p.x + dx * 115, ty = p.y + dy * 100;
    const m = Math.hypot(tx - b.x, ty - b.y) || 1;
    // 멀어지면 빨리 따라붙어서 늘 같은 거리에 등을 보이고 서 있다
    const step = Math.min(m, (55 + m * 2) * dt);
    b.x += ((tx - b.x) / m) * step;
    b.y += ((ty - b.y) / m) * step;
  },
  // 주위를 천천히 맴돈다
  notice(b, p, dt) {
    b.wander += dt * 0.45;
    const tx = p.x + Math.cos(b.wander) * 130, ty = p.y + Math.sin(b.wander) * 95;
    b.x += (tx - b.x) * Math.min(1, dt * 1.2);
    b.y += (ty - b.y) * Math.min(1, dt * 1.2);
  },
  // 손전등 빛 가장자리를 흐릿하게 맴돈다
  night(b, p, dt, k, g) {
    b.wander += dt * 0.3;
    const rad = Math.max(30, g.vision - 6);
    const tx = p.x + Math.cos(b.wander) * rad, ty = p.y + Math.sin(b.wander) * rad * 0.8;
    b.x += (tx - b.x) * Math.min(1, dt * 0.7);
    b.y += (ty - b.y) * Math.min(1, dt * 0.7);
  },
  // 머리 위에 떠서 울린다
  calls(b, p, dt, k, g) {
    const shake = Math.sin(g.clock * 40) * 1.5;
    b.x += (p.x + shake - b.x) * Math.min(1, dt * 1.6);
    b.y += (p.y - 115 - b.y) * Math.min(1, dt * 1.6);
  },
};

// ── 공격 (다음 공격까지 남은 시간을 돌려준다) ──
const ATTACK = {
  // 빨간 X 표시를 사방으로. 시간이 갈수록 촘촘해지고 일부는 나를 노린다
  study(b, p, k, g) {
    const c = body(b);
    const n = 12 + Math.round(14 * k), spd = 60 + 60 * k;
    for (let i = 0; i < n; i++) shoot(g, 'xmark', c.x, c.y, b.spin + (i / n) * TAU, spd);
    b.spin += 0.33;
    if (b.volley++ % 2 === 1 || k > 0.6) {
      const aim = Math.atan2(p.y - 14 - c.y, p.x - c.x);
      for (const s of [-0.2, -0.07, 0.07, 0.2]) shoot(g, 'xmark', c.x, c.y, aim + s, spd * 1.3);
    }
    return 1.1 - 0.55 * k;
  },
  // 회색으로 바랜 농구공(함께했던 기억)이 넘어와 화면 안을 튕겨 다닌다
  friend(b, p, k, g) {
    const c = body(b);
    const n = 2 + Math.floor(k * 3);
    for (let i = 0; i < n; i++) {
      const aim = Math.atan2(p.y - 14 - c.y, p.x - c.x) + (i === 0 ? 0 : (Math.random() - 0.5) * 1.2);
      shoot(g, 'grayball', c.x, c.y, aim, 140 + 60 * k, { bounce: true, life: 10 });
    }
    return 1 - 0.6 * k;
  },
  // 화면 가장자리에서 봉투가 줄지어 날아온다
  notice(b, p, k, g, api) {
    const rows = k > 0.5 ? 2 : 1;
    for (let r = 0; r < rows; r++) mailRow(p, k, g, api);
    return 0.85 - 0.45 * k;
  },
  // 손전등 빛 바깥에서 검은 안개가 천천히 조여 온다
  night(b, p, k, g) {
    const n = 1 + Math.floor(2 * k);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, d = g.vision + 34;
      shoot(g, 'fog', p.x + Math.cos(a) * d, p.y - 14 + Math.sin(a) * d, a + Math.PI, 28 + 36 * k, { home: true, life: 12 });
    }
    return 0.8 - 0.45 * k;
  },
  // 진동 파문이 늘 두 번 연달아 퍼진다. 고리에 난 틈으로 피해야 한다
  calls(b, p, k, g) {
    const c = body(b);
    const ringAt = () => g.bullets.push({
      kind: 'ring', x: c.x, y: c.y, r: 6, speed: 80 + 40 * k, max: 520, life: 99,
      gap: Math.atan2(p.y - 14 - c.y, p.x - c.x) + (Math.random() - 0.5) * 2.4, gapHalf: 0.45 - 0.15 * k,
    });
    ringAt();
    b.pending.push({ t: 0.5, fn: ringAt });
    return 2.6 - 1.2 * k;
  },
};

// 올것이 왔다: 화면 가장자리에서 봉투가 한 줄로 날아온다
function mailRow(p, k, g, api) {
  const v = api.view;
  const n = 4 + Math.floor(4 * k), spd = 95 + 70 * k;
  const edge = Math.floor(Math.random() * 4);
  const sx = edge === 0 ? v.x - 8 : edge === 1 ? v.x + v.w + 8 : v.x + Math.random() * v.w;
  const sy = edge === 2 ? v.y - 8 : edge === 3 ? v.y + v.h + 8 : v.y + Math.random() * v.h;
  const aim = Math.atan2(p.y - 14 - sy, p.x - sx);
  const nx = -Math.sin(aim), ny = Math.cos(aim);
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * 20;
    shoot(g, 'mail', sx + nx * off, sy + ny * off, aim, spd, { life: 9 });
  }
}

// 상심이 크시겠어요: 차가운 비가 내린다. 맞으면 잠깐 느려진다
function rain(g, dt, k, api) {
  const v = api.view;
  g.rainAcc = (g.rainAcc || 0) + (8 + 18 * k) * dt;
  while (g.rainAcc >= 1) {
    g.rainAcc--;
    g.bullets.push({ kind: 'rain', x: v.x + Math.random() * v.w, y: v.y - 6, vx: -12, vy: 125 + 40 * k, r: BULLET_R.rain, life: 4, seed: 0, slow: true });
  }
}

export function updateBoss(g, dt, api) {
  const b = g.boss, p = g.player, def = b.def;
  const k = clamp(g.bossT / g.bossTime, 0, 1);
  b.alpha = Math.min(1, b.alpha + dt * 1.5);
  b.flash -= dt;
  b.hitCd -= dt;
  MOVE[def.id](b, p, dt, k, g, api);
  // 보스는 언제나 화면 안에 보인다 (도망쳐도 화면 가장자리에 붙어 따라온다)
  const v = api.view, half = b.spr.w / 2;
  b.x = clamp(b.x, v.x + half + 4, v.x + v.w - half - 4);
  b.y = clamp(b.y, v.y + b.spr.footY + 36, v.y + v.h - 6);
  if (def.contact && b.hitCd <= 0 && (b.x - p.x) ** 2 + (b.y - p.y) ** 2 < (b.r + 8) ** 2) {
    b.hitCd = 0.6;
    api.hurt(def.contact);
  }
  b.fire -= dt;
  if (b.fire <= 0) {
    b.fire = ATTACK[def.id](b, p, k, g, api);
    sfx('bossShot');
  }
  b.pending = b.pending.filter((ev) => {
    ev.t -= dt;
    if (ev.t > 0) return true;
    ev.fn();
    return false;
  });
  if (def.id === 'calls') rain(g, dt, k, api);
  if (def.id === 'night') g.vision = 84 - 40 * k;
}

export function updateBullets(g, dt, api) {
  const p = g.player, v = api.view;
  const px = p.x, py = p.y - 14;
  for (const s of g.bullets) {
    s.life -= dt;
    if (s.kind === 'ring') {
      s.r += s.speed * dt;
      if (s.r > s.max) s.life = 0;
      if (!s.hit && Math.abs(Math.hypot(px - s.x, py - s.y) - s.r) < 5) {
        const off = angDiff(Math.atan2(py - s.y, px - s.x), s.gap);
        if (Math.abs(off) > s.gapHalf) {
          s.hit = true;
          api.hurt(BULLET_DMG.ring);
        }
      }
      continue;
    }
    if (s.home) {
      const want = Math.atan2(py - s.y, px - s.x);
      const cur = Math.atan2(s.vy, s.vx), spd = Math.hypot(s.vx, s.vy);
      const turn = clamp(angDiff(want, cur), -1.6 * dt, 1.6 * dt);
      s.vx = Math.cos(cur + turn) * spd;
      s.vy = Math.sin(cur + turn) * spd;
    }
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    // 튕기는 공은 화면(카메라) 안에 갇혀 있다
    if (s.bounce) {
      if (s.x < v.x + 4) { s.x = v.x + 4; s.vx = Math.abs(s.vx); }
      if (s.x > v.x + v.w - 4) { s.x = v.x + v.w - 4; s.vx = -Math.abs(s.vx); }
      if (s.y < v.y + 4) { s.y = v.y + 4; s.vy = Math.abs(s.vy); }
      if (s.y > v.y + v.h - 4) { s.y = v.y + v.h - 4; s.vy = -Math.abs(s.vy); }
    }
    if ((s.x - px) ** 2 + (s.y - py) ** 2 < (s.r + 7) ** 2) {
      s.life = 0;
      api.hurt(BULLET_DMG[s.kind], s.slow ? { slow: 1 } : null);
    }
  }
  g.bullets = g.bullets.filter((s) => s.life > 0);
}

// ── 그리기 ──

export function drawBoss(ctx, g, alphaMul = 1) {
  const b = g.boss;
  if (!b) return;
  const i = Math.floor(g.clock * 6) % b.spr.frames.length;
  const x = Math.round(b.x - b.spr.w / 2), y = Math.round(b.y - b.spr.footY);
  let a = b.alpha * alphaMul;
  if (b.def.id === 'night') a *= 0.55 + 0.35 * Math.abs(Math.sin(g.clock * 3.1) * Math.sin(g.clock * 7.3));
  ctx.globalAlpha = a;
  ctx.drawImage(b.spr.frames[i], x, y);
  // 맞으면 몸 주변 안개까지 하얗게 번쩍이니 반투명하게 덧칠한다
  if (b.flash > 0) {
    ctx.globalAlpha = a * 0.6;
    ctx.drawImage(b.spr.white[i], x, y);
  }
  ctx.globalAlpha = 1;
  if (b.def.id === 'notice' && g.mode !== 'bossIntro') {
    const img = pixelText(`D-${dday(g)}`, { font: '10px Galmuri9', color: P.red });
    ctx.drawImage(img, Math.round(b.x - img.width / 2), Math.round(b.y - b.spr.footY - img.height - 2));
  }
}

export const dday = (g) => Math.max(0, Math.ceil((1 - clamp(g.bossT / g.bossTime, 0, 1)) * 10));

function ringWithGap(ctx, s) {
  ctx.fillStyle = P.lightGray;
  const step = 0.9 / Math.max(6, s.r);
  for (let a = 0; a < TAU; a += step) {
    if (Math.abs(angDiff(a, s.gap)) <= s.gapHalf) continue;
    const x = Math.round(s.x + Math.cos(a) * s.r), y = Math.round(s.y + Math.sin(a) * s.r);
    ctx.fillRect(x, y, 2, 2);
  }
}

export function drawBullets(ctx, g) {
  for (const s of g.bullets) {
    if (s.kind === 'ring') {
      ringWithGap(ctx, s);
      continue;
    }
    const img = bulletSprite(s.kind, Math.floor(g.clock * 8 + s.seed) % bulletFrames(s.kind));
    ctx.drawImage(img, Math.round(s.x - img.width / 2), Math.round(s.y - img.height / 2));
  }
}

// 마지막 한 방 (화면 좌표). k: 0 → 1
// 화면이 흔들려도 가장자리가 비지 않게 M만큼 넉넉히 덮는다
const M = 8;
// 마지막 한 방이 '쾅' 하고 닿는 순간 (k). 이때 크게 흔들린다
export const FINALE_HIT = { study: 0.72, friend: 0.7, notice: 0.8, night: 0.8, calls: null };

export function drawFinale(ctx, g, view, k) {
  // 각 시기의 도전을 넘기며 다음 장으로 넘어가는 추상적 연출.
  const colors = { study: '#e8b37f', friend: '#a99bc8', notice: '#8fb4bd', night: '#6e95a4', calls: '#74cdbf' };
  const { w, h } = view;
  ctx.globalAlpha = Math.min(0.88, k * 0.9);
  ctx.fillStyle = '#16263e';
  ctx.fillRect(-8, -8, w + 16, h + 16);
  ctx.globalAlpha = 1;
  const radius = Math.max(1, Math.round(Math.max(w, h) * (0.12 + k * 0.65)));
  ring(ctx, w / 2, h / 2, radius, 3, colors[g.boss.def.id] || '#f2c879');
  for (let i = 0; i < 18; i++) {
    const x = (i * 73 + 19) % Math.max(1, w);
    const y = (i * 47 + 11) % Math.max(1, h);
    rect(ctx, x, y, 2, 2, i % 2 ? '#f2c879' : '#73c8bb');
  }
  if (k > 0.45) {
    const img = pixelText('다음 장으로', { color: '#f7e7ca' });
    ctx.drawImage(img, Math.round((w - img.width) / 2), Math.round(h / 2 - img.height / 2));
  }
}

// 바랜 농구공. 화면 밖 줄은 그리지 않는다
function drawFadedBall(ctx, cx, cy, R, w, h) {
  const y0 = Math.max(-M, cy - R), y1 = Math.min(h + M, cy + R);
  const lx = cx - Math.round(R * 0.06), ly = cy - Math.round(R * 0.06), lr = R * 0.9;
  for (let y = y0; y <= y1; y++) {
    const dy = y - cy;
    const half = Math.floor(Math.sqrt(R * R - dy * dy));
    ctx.fillStyle = P.ink;
    ctx.fillRect(cx - half, y, half * 2 + 1, 1);
    const inner = half - 2;
    if (inner > 0) {
      ctx.fillStyle = P.slate;
      ctx.fillRect(cx - inner, y, inner * 2 + 1, 1);
    }
    // 왼쪽 위가 밝은 면
    const ldy = y - ly;
    if (Math.abs(ldy) < lr) {
      const lh = Math.floor(Math.sqrt(lr * lr - ldy * ldy));
      ctx.fillStyle = P.gray;
      ctx.fillRect(lx - lh, y, lh * 2 + 1, 1);
    }
  }
  // 반짝임
  const sx = cx - R * 0.42, sy = cy - R * 0.45, sr = R * 0.12;
  for (let y = Math.round(sy - sr); y <= sy + sr; y++) {
    const sh = Math.floor(Math.sqrt(Math.max(0, sr * sr - (y - sy) ** 2)));
    ctx.fillStyle = P.lightGray;
    ctx.fillRect(Math.round(sx - sh), y, sh * 2 + 1, 1);
  }
  // 공 줄무늬: 가로·세로 한 줄씩, 양옆으로 휘어진 두 줄
  ctx.fillStyle = P.ink;
  ctx.fillRect(cx - 1, cy - R, 3, R * 2);
  ctx.fillRect(cx - R, cy - 1, R * 2, 3);
  const inside = (x, y) => (x - cx) ** 2 + (y - cy) ** 2 < (R - 2) ** 2;
  for (const side of [-1, 1]) {
    const ax = cx + side * 1.3 * R, ar = 0.95 * R;
    for (let y = y0; y <= y1; y++) {
      const dy = y - cy;
      if (Math.abs(dy) > ar) continue;
      const x = Math.round(ax - side * Math.sqrt(ar * ar - dy * dy));
      if (inside(x, y)) ctx.fillRect(x - 1, y, 3, 1);
    }
    for (let x = Math.max(-M, cx - R); x <= Math.min(w + M, cx + R); x++) {
      const dx = x - ax;
      if (Math.abs(dx) > ar) continue;
      const off = Math.sqrt(ar * ar - dx * dx);
      for (const y of [Math.round(cy - off), Math.round(cy + off)]) if (inside(x, y)) ctx.fillRect(x, y - 1, 1, 3);
    }
  }
}

// 모서리가 둥근 말풍선 (테두리 2, 아래에 꼬리)
function drawBubble(ctx, cx, cy, bw, bh) {
  const x0 = Math.round(cx - bw / 2), y0 = Math.round(cy - bh / 2), W = Math.round(bw), H = Math.round(bh);
  const r = Math.min(Math.round(6 + bh * 0.12), Math.floor(H / 2));
  for (let y = 0; y < H; y++) {
    const e = y < r ? r - y : y >= H - r ? y - (H - r - 1) : 0;
    const inset = e ? Math.round(r - Math.sqrt(Math.max(0, r * r - e * e))) : 0;
    rect(ctx, x0 + inset, y0 + y, W - inset * 2, 1, P.gray);
    if (y >= 2 && y < H - 2) rect(ctx, x0 + inset + 2, y0 + y, W - inset * 2 - 4, 1, P.navy);
  }
  // 꼬리는 풍선 아래 테두리를 덮으며 이어 그린다
  const tx = Math.round(cx - bw * 0.22);
  for (let i = 0; i < 9; i++) {
    const half = Math.max(0, 5 - Math.floor(i * 0.6));
    rect(ctx, tx - half - 2 + i, y0 + H - 2 + i, half * 2 + 4, 1, P.gray);
    if (half > 0) rect(ctx, tx - half + i, y0 + H - 2 + i, half * 2, 1, P.navy);
  }
}

// 흰 국화 한 송이 (13×13): 둥근 꽃잎 뭉치, 가운데는 옅은 노랑
let flower = null;
function flowerSprite() {
  if (flower) return flower;
  const [c, fctx] = makeCanvas(13, 13);
  ring(fctx, 6, 6, 6, 1, P.gray);
  ring(fctx, 6, 6, 5, 5, P.white);
  // 꽃잎 사이 홈이 테두리까지 파고들어 가장자리가 오돌토돌하다
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + 0.15;
    line(fctx, 6 + Math.cos(a) * 3, 6 + Math.sin(a) * 3, 6 + Math.cos(a) * 6, 6 + Math.sin(a) * 6, P.lightGray);
  }
  ring(fctx, 6, 6, 2, 2, P.skinLight);
  fctx.fillStyle = P.yellow;
  fctx.fillRect(6, 6, 1, 1);
  flower = c;
  return c;
}
