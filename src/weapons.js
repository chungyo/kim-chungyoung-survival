import { WEAPONS } from './data.js';
import { P } from './pixel.js';
import { projSprite, projFrames } from './items.js';
import { pixelText, burst } from './fx.js';
import { sfx } from './audio.js';

const TAU = Math.PI * 2;
const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

export function updateWeapons(g, dt) {
  g.agentAngle += dt * 2.2;
  for (const id of g.order) {
    const def = WEAPONS[id];
    if (def.passive) continue;
    g.cd[id] = (g.cd[id] ?? 0.2) - dt;
    if (g.cd[id] > 0) continue;
    const L = def.levels[g.weapons[id] - 1];
    // 쏠 대상이 없으면 잠깐 뒤에 다시 시도
    const fired = FIRE[id](g, L) !== false;
    g.cd[id] = fired ? L.cd * g.stats.cdMul : 0.15;
    if (fired) sfx(FIRE_SFX[id]);
  }
}

// 무기를 쓸 때 나는 소리 (audio.js의 효과음 이름)
const FIRE_SFX = {
  pencil: 'pencil', abc: 'abc', ball: 'ball', heart: 'heart', vocal: 'vocal',
  cram: 'zap', drill: 'thud', agents: 'missile', plaf: 'boomerang',
};

export function agentPositions(g) {
  const lv = g.weapons.agents;
  if (!lv) return [];
  const n = WEAPONS.agents.levels[lv - 1].agents;
  return Array.from({ length: n }, (_, i) => {
    const a = g.agentAngle + (i / n) * TAU;
    return { x: g.player.x + Math.cos(a) * 30, y: g.player.y + Math.sin(a) * 20 };
  });
}

function shoot(g, kind, x, y, angle, speed, extra) {
  g.projectiles.push({
    kind, x, y, angle,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    speed, r: 5, pierce: 1, life: 1.5, hit: new Set(),
    ...extra,
  });
}

function aimAt(from, to) {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

const FIRE = {
  pencil(g, L) {
    const p = g.player;
    const target = g.nearest(p.x, p.y, 320);
    if (!target) return false;
    const base = aimAt(p, target);
    const spread = L.count === 1 ? [0] : L.count === 2 ? [-0.09, 0.09] : [-0.2, 0, 0.2];
    for (const s of spread) shoot(g, 'pencil', p.x, p.y, base + s, 340, { r: 4, pierce: L.pierce, dmg: L.dmg, life: 1.1, kb: 10 });
  },

  abc(g, L) {
    const p = g.player;
    for (let i = 0; i < L.n; i++) {
      const angle = L.ring ? (i / L.n) * TAU : Math.random() * TAU;
      const ch = L.ring ? ABC[i] : ABC[(g.abcIndex++) % 3];
      shoot(g, 'letter', p.x, p.y, angle, 170, { ch, r: 6, dmg: L.dmg, life: 1.1, kb: 15 });
    }
  },

  ball(g, L) {
    const p = g.player;
    const first = g.nearest(p.x, p.y, 300);
    if (!first) return false;
    for (let i = 0; i < L.balls; i++) {
      const target = i === 0 ? first : g.randomNear(p.x, p.y, 260) || first;
      shoot(g, 'ball', p.x, p.y, aimAt(p, target), 270, { target, r: 6, dmg: L.dmg, bounces: L.bounces, life: 4, kb: 20 });
    }
  },

  heart(g, L) {
    const p = g.player;
    if (!g.nearest(p.x, p.y, 380)) return false;
    for (let i = 0; i < L.n; i++) {
      const target = g.randomNear(p.x, p.y, 220) || g.nearest(p.x, p.y, 380);
      shoot(g, 'heart', p.x, p.y, aimAt(p, target), 210, { r: 6, dmg: L.dmg, radius: L.radius, life: 1.6, explode: true });
    }
  },

  vocal(g, L) {
    const p = g.player;
    const ang = Math.atan2(p.face.y, p.face.x);
    const half = (L.arc * Math.PI) / 360;
    g.forEachNear(p.x, p.y, L.range + 12, (e) => {
      const dx = e.x - p.x, dy = e.y - p.y;
      if (dx * dx + dy * dy > (L.range + e.r) ** 2) return;
      let diff = Math.atan2(dy, dx) - ang;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      if (Math.abs(diff) <= half) g.damage(e, L.dmg, dx, dy, 45);
    });
    g.effects.push({ kind: 'cone', x: p.x, y: p.y - 14, ang, half, range: L.range, t: 0, dur: 0.38 });
    for (let i = 0; i < 3; i++) {
      const a = ang + (Math.random() * 2 - 1) * half;
      g.effects.push({ kind: 'note', x: p.x, y: p.y - 18, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90 - 20, variant: i % 2, t: 0, dur: 0.6 });
    }
  },

  cram(g, L) {
    const p = g.player;
    const pool = g.enemiesWithin(p.x, p.y, 260);
    if (!pool.length) return false;
    for (let i = 0; i < L.n && pool.length; i++) {
      const e = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      g.forEachNear(e.x, e.y, 24, (o) => {
        if (dist2(o, e) <= (16 + o.r) ** 2) g.damage(o, L.dmg);
      });
      g.effects.push({ kind: 'bolt', x: e.x, y: e.y, t: 0, dur: 0.3 });
      burst(g, e.x, e.y, 6, [P.yellow, P.white, P.amber], 70, 0.35);
    }
  },

  drill(g, L) {
    const p = g.player;
    g.forEachNear(p.x, p.y, L.radius + 12, (e) => {
      const dx = e.x - p.x, dy = e.y - p.y;
      if (dx * dx + dy * dy <= (L.radius + e.r) ** 2) g.damage(e, L.dmg, dx, dy, 70);
    });
    g.effects.push({ kind: 'ring', x: p.x, y: p.y - 4, r: L.radius, t: 0, dur: 0.45 });
    burst(g, p.x, p.y, 14, [P.lightGray, P.skinLight, P.white], 120, 0.4);
    g.shake = Math.max(g.shake, 2);
    g.addText(p.x, p.y - 46, '철통 경계!', P.red);
  },

  agents(g, L) {
    const p = g.player;
    if (!g.nearest(p.x, p.y, 320)) return false;
    const taken = new Set();
    for (const a of agentPositions(g)) {
      for (let m = 0; m < L.missiles; m++) {
        const target = g.randomNear(p.x, p.y, 300, taken) || g.nearest(a.x, a.y, 320);
        if (!target) continue;
        taken.add(target);
        const angle = aimAt(a, target) + (Math.random() - 0.5) * 1.6;
        shoot(g, 'missile', a.x, a.y, angle, 230, { target, r: 4, dmg: L.dmg, life: 2.6 });
      }
    }
  },

  plaf(g, L) {
    const p = g.player;
    let angles;
    if (L.allDirs) {
      angles = Array.from({ length: L.n }, (_, i) => (i / L.n) * TAU);
    } else {
      const target = g.nearest(p.x, p.y, 300);
      if (!target) return false;
      const base = aimAt(p, target);
      angles = Array.from({ length: L.n }, (_, i) => base + (i - (L.n - 1) / 2) * 0.45);
    }
    for (const angle of angles) {
      shoot(g, 'boomerang', p.x, p.y, angle, 250, {
        r: 8 * L.size, size: L.size, dmg: L.dmg, out: true, dist: 0, range: 135, life: 4, hits: new Map(), spin: 0,
      });
    }
  },
};

// ── 투사체 ──

function hitTest(p, g, onHit) {
  let alive = true;
  g.forEachNear(p.x, p.y, p.r + 16, (e) => {
    if (!alive || e.dead || p.hit.has(e)) return;
    if (dist2(e, p) > (e.r + p.r) ** 2) return;
    alive = onHit(e) !== false;
  });
  return alive;
}

function explode(g, x, y, radius, dmg) {
  g.forEachNear(x, y, radius + 12, (e) => {
    if (dist2(e, { x, y }) <= (radius + e.r) ** 2) g.damage(e, dmg, e.x - x, e.y - y, 30);
  });
  g.effects.push({ kind: 'boom', x, y: y - 8, r: radius, t: 0, dur: 0.35 });
  sfx('boom');
  burst(g, x, y - 8, 10, [P.hotPink, P.salmon, P.white], 90, 0.45);
}

function move(p, dt) {
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.life -= dt;
  return p.life > 0;
}

function steer(p, target, dt, turn) {
  const want = Math.atan2(target.y - p.y, target.x - p.x);
  let diff = want - p.angle;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  p.angle += Math.max(-turn * dt, Math.min(turn * dt, diff));
  p.vx = Math.cos(p.angle) * p.speed;
  p.vy = Math.sin(p.angle) * p.speed;
}

const UPDATE = {
  straight(p, g, dt) {
    if (!move(p, dt)) return false;
    return hitTest(p, g, (e) => {
      p.hit.add(e);
      if (p.explode) {
        explode(g, p.x, p.y, p.radius, p.dmg);
        return false;
      }
      g.damage(e, p.dmg, p.vx, p.vy, p.kb ?? 0);
      return --p.pierce > 0;
    });
  },

  ball(p, g, dt) {
    if (p.target && !p.target.dead) steer(p, p.target, dt, 30);
    if (!move(p, dt)) return false;
    return hitTest(p, g, (e) => {
      p.hit.add(e);
      g.damage(e, p.dmg, p.vx, p.vy, p.kb);
      sfx('bounce');
      if (--p.bounces < 0) return false;
      p.target = g.nearest(p.x, p.y, 170, p.hit);
      return !!p.target;
    });
  },

  missile(p, g, dt) {
    if (Math.random() < 0.6) g.particles.push({ x: p.x, y: p.y - 14, vx: (Math.random() - 0.5) * 10, vy: -8, life: 0.35, t: 0, grav: 0, color: Math.random() < 0.5 ? P.lightGray : P.gray, size: 1 });
    if (!p.target || p.target.dead) p.target = g.nearest(p.x, p.y, 320);
    if (p.target) steer(p, p.target, dt, 7);
    if (!move(p, dt)) return false;
    return hitTest(p, g, (e) => {
      g.damage(e, p.dmg, p.vx, p.vy, 15);
      sfx('pop');
      return false;
    });
  },

  boomerang(p, g, dt) {
    p.spin += dt * 18;
    p.life -= dt;
    if (p.life <= 0) return false;
    if (p.out) {
      const sp = p.speed * Math.max(0.2, 1 - p.dist / p.range);
      p.x += Math.cos(p.angle) * sp * dt;
      p.y += Math.sin(p.angle) * sp * dt;
      p.dist += sp * dt;
      if (p.dist >= p.range * 0.97) p.out = false;
    } else {
      const pl = { x: g.player.x, y: g.player.y };
      const d = Math.sqrt(dist2(p, pl)) || 1;
      if (d < 12) return false;
      p.x += ((pl.x - p.x) / d) * p.speed * 1.15 * dt;
      p.y += ((pl.y - p.y) / d) * p.speed * 1.15 * dt;
    }
    g.forEachNear(p.x, p.y, p.r + 16, (e) => {
      if (e.dead || dist2(e, p) > (e.r + p.r) ** 2) return;
      if ((p.hits.get(e) ?? -1) > g.clock) return;
      p.hits.set(e, g.clock + 0.45);
      g.damage(e, p.dmg, e.x - p.x, e.y - p.y, 25);
    });
    return true;
  },
};

const KIND_UPDATE = { pencil: 'straight', letter: 'straight', heart: 'straight', ball: 'ball', missile: 'missile', boomerang: 'boomerang' };

export function updateProjectile(p, g, dt) {
  return UPDATE[KIND_UPDATE[p.kind]](p, g, dt);
}

// ── 그리기 ──

// 회전하는 도트는 22.5° 단위로 끊어서 돌려야 덜 뭉개진다
function drawRotated(ctx, img, x, y, angle) {
  const snap = Math.round(angle / (Math.PI / 8)) * (Math.PI / 8);
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(snap);
  ctx.drawImage(img, -Math.round(img.width / 2), -Math.round(img.height / 2));
  ctx.restore();
}

function drawCentered(ctx, img, x, y) {
  ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height / 2));
}

const LIFT = 14;

export function drawProjectile(ctx, p, clock) {
  const y = p.y - LIFT;
  switch (p.kind) {
    case 'pencil':
      drawRotated(ctx, projSprite('pencil'), p.x, y, p.angle);
      break;
    case 'letter':
      // 버터 발음이라 노란 글자
      drawCentered(ctx, projSprite('ballet'), p.x, y);
      break;
    case 'ball':
      drawCentered(ctx, projSprite('ball', Math.floor(clock * 14) % projFrames('ball')), p.x, y);
      break;
    case 'heart':
      drawCentered(ctx, projSprite('heart', Math.floor(clock * 6) % projFrames('heart')), p.x, y);
      break;
    case 'missile':
      drawRotated(ctx, projSprite('missile', Math.floor(clock * 16) % projFrames('missile')), p.x, y, p.angle);
      break;
    case 'boomerang':
      drawCentered(ctx, projSprite('boomerang', Math.floor(p.spin) % projFrames('boomerang')), p.x, y);
      break;
  }
}

export function drawAgents(ctx, g) {
  const f = projSprite('agent', Math.floor(g.clock * 8) % projFrames('agent'));
  for (const a of agentPositions(g)) drawCentered(ctx, f, a.x, a.y - 24);
}
