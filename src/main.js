import { ERAS, ERA_SECONDS, DEMO, ERA_HP, ERA_XP, ERA_SPAWN, ENEMY_TYPES, PLAYER, WEAPONS, HEAL_CARD, BOSSES, xpToNext } from './data.js';
import { makeBoss, updateBoss, updateBullets, drawBoss, drawBullets, drawFinale, dday, FINALE_HIT } from './boss.js';
import { P, makeCanvas, silhouette, ring } from './pixel.js';
import { playerSprite, playerDataURL, PLAYER_W, PLAYER_FOOT } from './art/characters.js';
import { enemySprite } from './art/characters.js';
import { buildMap } from './art/world.js';
import { projSprite, projFrames } from './items.js';
import { iconURL } from './art/icons.js';
import { drawEffect, drawParticles, updateParticles, burst, pixelText, shadow, clearTextCache } from './fx.js';
import { updateWeapons, updateProjectile, drawProjectile, drawAgents } from './weapons.js';
import { createInput } from './input.js';
import * as ui from './ui.js';
import * as audio from './audio.js';
import { sfx } from './audio.js';

// 디버그: ?bot (자동 플레이) ?bot=wander (초보 흉내) ?bot=idle &speed=4 &era=3 (0~4) &god (무적) &pause &demo (시연하기)
const params = new URLSearchParams(location.search);
const DEBUG = {
  bot: params.has('bot'),
  idle: params.get('bot') === 'idle',
  wander: params.get('bot') === 'wander',
  rush: params.get('bot') === 'rush',
  speed: Math.max(1, Number(params.get('speed')) || 1),
  era: Math.min(ERAS.length - 1, Math.max(0, Number(params.get('era')) || 0)),
  god: params.has('god'),
  pause: params.has('pause'), // 실시간 진행을 멈추고 __sim으로만 움직인다 (연출 프레임 확인용)
  demo: params.has('demo'), // 봇으로 시연하기 모드 확인
};

const TAU = Math.PI * 2;
const VIEW_MIN = 270; // 화면의 짧은 변에 보이는 월드 픽셀 수 (폰에서도 캐릭터가 너무 작지 않게)
const MAX_ENEMIES = 340;
const CELL = 32; // 적 충돌 격자
const OCELL = 64; // 장애물 격자

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const [buf, bctx] = makeCanvas(1, 1);
const input = createInput(canvas, document.getElementById('joystick'));
const view = { S: 1, w: 0, h: 0, x: 0, y: 0 };

const g = { mode: 'title', grid: new Map(), ogrid: new Map(), map: null };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cellKey = (cx, cy) => (cx + 32768) * 65536 + (cy + 32768);
const lookOf = (era) => ERAS[era].look;
// 시연하기면 라운드가 짧다
const eraSeconds = () => (g.demo ? DEMO.eraSeconds : ERA_SECONDS);

// ── 상태 ──

function newGame(demo = false) {
  Object.assign(g, {
    mode: 'play', demo, era: DEBUG.era, eraTime: 0, clock: 0, trans: null, irisOpen: 1,
    player: { x: 0, y: 0, hp: PLAYER.hp, face: { x: 0, y: 1 }, dir: 'down', inv: 0, hurt: 0, anim: 0, moving: false },
    weapons: {}, order: [], cd: {}, stats: null,
    enemies: [], projectiles: [], gems: [], effects: [], texts: [], particles: [],
    level: 1, xp: 0, pendingLevels: 0, kills: 0, rebirths: 0,
    spawnAcc: 0, formationT: 2, agentAngle: 0, abcIndex: 0, ease: 1, shake: 0,
    boss: null, bullets: [], bossT: 0, bossTime: 0, vision: 0, dark: 0, resumeMode: 'play',
    log: { levelsAtEra: 1, deaths: 0, peak: 0 },
  });
  computeStats();
  // 디버그로 중간 시대부터 시작하면 지난 시대 무기를 Lv3으로 준다
  for (let i = 0; i < DEBUG.era; i++) {
    for (const id of ERAS[i].weapons) {
      g.weapons[id] = 3;
      g.order.push(id);
    }
    g.level += 8;
  }
  computeStats();
  g.player.hp = g.stats.maxHp;
  loadMap(DEBUG.era);
  beginTransition(DEBUG.era, true);
}

function computeStats() {
  const L = (id) => (g.weapons[id] ? WEAPONS[id].levels[g.weapons[id] - 1] : {});
  const all = L('minji').all ?? 0;
  const prevMax = g.stats?.maxHp ?? PLAYER.hp;
  g.stats = {
    speed: PLAYER.speed * (1 + (L('inline').speed ?? 0) + all),
    dmgMul: 1 + all + (L('drill').atk ?? 0),
    cdMul: 1 / (1 + all + (L('todo').atkSpeed ?? 0)),
    maxHp: Math.round(PLAYER.hp * (1 + all)),
    magnet: PLAYER.magnet * (1 + (L('vote').magnet ?? 0)),
    xpMul: 1 + (L('vote').xp ?? 0),
    dodge: L('stealth').dodge ?? 0,
    regen: L('gift').regen ?? 0,
  };
  if (g.stats.maxHp > prevMax) g.player.hp += g.stats.maxHp - prevMax;
}

function currentAge() {
  return ERAS[g.era].stage;
}

// ── 맵과 장애물 ──

function loadMap(era) {
  g.map = buildMap(era);
  g.mapEra = era;
  g.ogrid = new Map();
  for (const o of g.map.obstacles) {
    for (let cx = Math.floor(o.x / OCELL); cx <= Math.floor((o.x + o.w) / OCELL); cx++) {
      for (let cy = Math.floor(o.y / OCELL); cy <= Math.floor((o.y + o.h) / OCELL); cy++) {
        const k = cellKey(cx, cy);
        if (!g.ogrid.has(k)) g.ogrid.set(k, []);
        g.ogrid.get(k).push(o);
      }
    }
  }
  g.player.x = g.map.start.x;
  g.player.y = g.map.start.y;
}

function nearObstacles(x, y, fn) {
  const cx = Math.floor(x / OCELL), cy = Math.floor(y / OCELL);
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const list = g.ogrid.get(cellKey(cx + i, cy + j));
      if (list) for (const o of list) fn(o);
    }
  }
}

function blocked(x, y, r) {
  let hit = false;
  nearObstacles(x, y, (o) => {
    if (x > o.x - r && x < o.x + o.w + r && y > o.y - r && y < o.y + o.h + r) hit = true;
  });
  return hit;
}

// 장애물에 박히면 가장 가까운 바깥으로 밀어낸다 (벽을 따라 미끄러진다)
function pushOut(ent, r) {
  nearObstacles(ent.x, ent.y, (o) => {
    const nx = clamp(ent.x, o.x, o.x + o.w), ny = clamp(ent.y, o.y, o.y + o.h);
    const dx = ent.x - nx, dy = ent.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) return;
    if (d2 > 1e-4) {
      const d = Math.sqrt(d2);
      ent.x += (dx / d) * (r - d);
      ent.y += (dy / d) * (r - d);
    } else {
      const left = ent.x - o.x, right = o.x + o.w - ent.x, top = ent.y - o.y, bottom = o.y + o.h - ent.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) ent.x = o.x - r;
      else if (m === right) ent.x = o.x + o.w + r;
      else if (m === top) ent.y = o.y - r;
      else ent.y = o.y + o.h + r;
    }
  });
  ent.x = clamp(ent.x, r, g.map.w - r);
  ent.y = clamp(ent.y, r, g.map.h - r);
}

const spawnRadius = () => Math.max(200, Math.hypot(view.w, view.h) / 2 + 16);

function spawnPoint() {
  const p = g.player, R = spawnRadius();
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * TAU, d = R + Math.random() * 50;
    const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
    if (x < 20 || y < 20 || x > g.map.w - 20 || y > g.map.h - 20 || blocked(x, y, 10)) continue;
    return { x, y };
  }
  for (let i = 0; i < 20; i++) {
    const x = 30 + Math.random() * (g.map.w - 60), y = 30 + Math.random() * (g.map.h - 60);
    if (!blocked(x, y, 10) && Math.hypot(x - p.x, y - p.y) > R * 0.8) return { x, y };
  }
  return null;
}

// ── 시대 전환 연출 ──
// 0.0  주변 적이 주인공 쪽부터 차례로 터지며 경험치로 빨려 들어온다
// 0.7  화면이 원형으로 좁아져 주인공만 비춘다
// 1.3  스포트라이트 안에서 옷이 점점 빠르게 깜빡이다가 번쩍하며 다음 시대 모습이 된다
// 2.2  완전히 암전 → 시대 카드. 그 사이 맵이 바뀐다
// 3.7  새 맵에서 원이 다시 열린다
const T = { RIPPLE: 0.7, SHRINK: 1.3, FLASH: 2.0, CLOSE: 2.2, DARK: 2.5, OPEN: 3.7, END: 4.3 };
const SPOT = 30;
const easeInOut = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

// next: 다음 시대 번호, 마지막 시대가 끝나면 'end'. intro면 암전 상태에서 바로 시작한다
function beginTransition(next, intro = false, fromDark = false) {
  const p = g.player;
  g.mode = 'transition';
  input.release();
  p.moving = false;
  g.projectiles = [];
  g.trans = { t: intro ? T.DARK : fromDark ? T.SHRINK : 0, next, card: false, faded: false, flashed: false, fromDark };
  for (const e of g.enemies) e.dieAt = Math.hypot(e.x - p.x, e.y - p.y) / 560;
}

function updateTransition(dt) {
  const tr = g.trans, p = g.player;
  tr.t += dt;
  p.hurt -= dt;
  for (const e of g.enemies) {
    if (tr.t >= e.dieAt - 0.08) e.flash = 0.1;
    if (tr.t < e.dieAt) continue;
    e.dead = true;
    g.gems.push({ x: e.x, y: e.y, v: e.xp, vac: true });
    if (g.effects.length < 120) g.effects.push({ kind: 'poof', x: e.x, y: e.y - e.spr.footY / 2, t: 0, dur: 0.3 });
  }
  g.enemies = g.enemies.filter((e) => !e.dead);
  updateGems(dt);
  if (tr.t >= T.SHRINK) p.dir = 'down';

  if (tr.next === 'end') {
    if (tr.t >= T.CLOSE) finish();
    return;
  }
  if (!tr.flashed && tr.t >= T.FLASH && tr.next !== g.era) {
    tr.flashed = true;
    sfx('era');
    p.hurt = 0.12;
    g.shake = 2;
    burst(g, p.x, p.y - 18, 22, [P.white, P.yellow, P.amber, P.cyan], 110, 0.6);
  }
  if (!tr.card && tr.t >= T.DARK) {
    tr.card = true;
    // 아직 날아오던 경험치는 암전 순간 한꺼번에 들어온다
    let xp = 0;
    for (const gem of g.gems) xp += gem.v;
    if (xp) gainXp(xp);
    Object.assign(g, { enemies: [], gems: [], effects: [], particles: [], texts: [] });
    if (g.mapEra !== tr.next) loadMap(tr.next);
    const era = ERAS[tr.next];
    ui.showEra({ age: era.stage, event: era.event, title: era.title });
    sfx('eraCard');
    audio.playMusic(`era${tr.next}`);
  }
  if (!tr.faded && tr.t >= T.OPEN - 0.15) {
    tr.faded = true;
    ui.fadeEra();
  }
  if (tr.t >= T.END) startEra(tr.next);
}

// 스포트라이트 반지름. null이면 가리지 않는다
function irisRadius() {
  const full = Math.hypot(view.w, view.h);
  if (g.mode === 'clear') return SPOT;
  if (g.mode === 'play') return g.irisOpen < 0.6 ? full * easeInOut(g.irisOpen / 0.6) : null;
  if (g.mode !== 'transition') return null;
  const t = g.trans.t;
  if (g.trans.fromDark && t < T.CLOSE) return t < T.SHRINK + 0.35 ? SPOT * easeInOut((t - T.SHRINK) / 0.35) : SPOT;
  if (t < T.RIPPLE) return null;
  if (t < T.SHRINK) return SPOT + (full - SPOT) * (1 - easeInOut((t - T.RIPPLE) / (T.SHRINK - T.RIPPLE)));
  if (t < T.CLOSE) return SPOT;
  if (t < T.DARK) return SPOT * (1 - (t - T.CLOSE) / (T.DARK - T.CLOSE));
  if (t < T.OPEN) return 0;
  return full * easeInOut(Math.min(1, (t - T.OPEN) / (T.END - T.OPEN)));
}

function drawIris(r) {
  const p = g.player;
  const cx = Math.round(p.x - view.x), cy = Math.round(p.y - 16 - view.y);
  bctx.setTransform(1, 0, 0, 1, 0, 0);
  bctx.fillStyle = P.ink;
  r = Math.max(0, Math.round(r));
  for (let y = 0; y < view.h; y++) {
    const dy = y - cy;
    if (Math.abs(dy) >= r) {
      bctx.fillRect(0, y, view.w, 1);
      continue;
    }
    const half = Math.floor(Math.sqrt(r * r - dy * dy));
    bctx.fillRect(0, y, cx - half, 1);
    bctx.fillRect(cx + half + 1, y, view.w - cx - half - 1, 1);
  }
  if (r > 2) ring(bctx, cx, cy, r, 1, P.darkSlate);
}

// 전환 중 주인공 옷: 스포트라이트 안에서 이전/다음 시대 옷이 점점 빠르게 번갈아 보인다
function shownLook() {
  const tr = g.trans;
  if (g.mode !== 'transition' || tr.next === 'end' || tr.next === g.era) return lookOf(g.era);
  if (tr.t >= T.FLASH) return lookOf(tr.next);
  if (tr.t < T.SHRINK + 0.15) return lookOf(g.era);
  const k = (tr.t - T.SHRINK) / (T.FLASH - T.SHRINK);
  const iv = 0.2 - 0.15 * k;
  return Math.floor((tr.t - T.SHRINK) / iv) % 2 ? lookOf(tr.next) : lookOf(g.era);
}

function startEra(i) {
  if (DEBUG.bot && i !== g.era) {
    console.log(`[era ${g.era} 끝] Lv ${g.level} (+${g.level - g.log.levelsAtEra}) · 처치 ${g.kills} · 사망 ${g.log.deaths} · 적 최대 ${g.log.peak}`);
    g.log.levelsAtEra = g.level;
    g.log.peak = 0;
  }
  if (g.mapEra !== i) loadMap(i);
  Object.assign(g, { era: i, eraTime: 0, spawnAcc: 0, formationT: 2, ease: 1 });
  const gained = [];
  for (const id of ERAS[i].weapons) {
    if (g.weapons[id]) continue;
    g.weapons[id] = 1;
    g.order.push(id);
    gained.push(WEAPONS[id].name);
  }
  computeStats();
  g.player.hp = g.stats.maxHp;
  g.snapshot = { weapons: { ...g.weapons }, order: [...g.order], level: g.level, xp: g.xp, kills: g.kills };
  ui.hideEra();
  g.trans = null;
  g.mode = 'play';
  if (gained.length) ui.toast('새 능력 3개 획득!', gained.join(' · '), 3200);
}

// ── 보스전 ──
// 1분이 지나면 잡몹이 흩어지고 보스와 단둘이 남는다. 보스는 이길 수 없고, 쓰러져야 다음 시대로 넘어간다.
const bossApi = { hurt: (dmg, opts) => hurt(dmg, opts), view, get map() { return g.map; } };
const FINALE_TIME = 2;

function beginBoss() {
  const p = g.player;
  g.mode = 'bossIntro';
  g.bossIntro = { t: 0, card: false, spawned: false, faded: false };
  g.projectiles = [];
  g.bullets = [];
  g.bossT = 0;
  g.bossTime = BOSSES[g.era].time * (g.demo ? DEMO.boss : 1);
  g.vision = 84;
  input.release();
  audio.stopMusic(1.2);
  for (const e of g.enemies) e.dieAt = Math.hypot(e.x - p.x, e.y - p.y) / 560;
}

function updateBossIntro(dt) {
  const s = g.bossIntro;
  s.t += dt;
  g.clock += dt;
  g.dark = Math.min(1, s.t / 1.2);
  // 남은 잡몹은 가까운 쪽부터 흩어져 경험치가 된다
  for (const e of g.enemies) {
    if (e.boss) continue;
    if (s.t >= e.dieAt - 0.08) e.flash = 0.1;
    if (s.t < e.dieAt) continue;
    e.dead = true;
    g.gems.push({ x: e.x, y: e.y, v: e.xp, vac: true });
    if (g.effects.length < 120) g.effects.push({ kind: 'poof', x: e.x, y: e.y - e.spr.footY / 2, t: 0, dur: 0.3 });
  }
  g.enemies = g.enemies.filter((e) => !e.dead);
  updateGems(dt);
  if (!s.card && s.t >= 0.9) {
    s.card = true;
    ui.showBossIntro({ name: BOSSES[g.era].name });
    sfx('bossIntro');
  }
  if (!s.spawned && s.t >= 1.3) {
    s.spawned = true;
    g.boss = makeBoss(g.era, g.player, g.map);
    g.enemies.push(g.boss);
  }
  if (g.boss) g.boss.alpha = Math.min(1, g.boss.alpha + dt * 0.8);
  if (!s.faded && s.t >= 2.9) {
    s.faded = true;
    ui.fadeEra();
  }
  if (s.t >= 3.2) {
    ui.hideEra();
    // 가득 찬 체력으로 맞선다
    g.player.hp = g.stats.maxHp;
    g.player.inv = 0.8;
    g.mode = 'boss';
    ui.showBossBar(g.era === ERAS.length - 1 ? `${BOSSES[g.era].name} · 끝까지 버텨라!` : BOSSES[g.era].name);
    audio.playMusic('boss');
  }
}

function updateBossFight(dt) {
  g.clock += dt;
  g.bossT += dt;
  updatePlayer(dt);
  buildGrid();
  updateWeapons(g, dt);
  g.projectiles = g.projectiles.filter((pr) => updateProjectile(pr, g, dt));
  updateCamera();
  updateBoss(g, dt, bossApi);
  updateBullets(g, dt, bossApi);
  updateGems(dt);
  if (g.mode !== 'boss') return;
  // 시간이 다 되면 피할 수 없는 마지막 한 방
  if (g.bossT >= g.bossTime) {
    if (g.era === ERAS.length - 1) {
      g.boss = null;
      g.enemies = [];
      g.bullets = [];
      ui.hideBossBar();
      finish();
    } else beginFinale();
    return;
  }
  if (g.pendingLevels > 0) beginLevelUp();
}

// 시간이 다 되거나 그전에 쓰러지면, 보스마다 다른 마지막 한 방이 화면을 덮는다
function beginFinale() {
  g.mode = 'bossFinale';
  g.finale = { t: 0, hit: false };
  g.bullets = [];
  input.release();
  audio.stopMusic(0.4);
  sfx('finale');
}

function updateBossFinale(dt) {
  g.clock += dt;
  g.finale.t += dt;
  const k = Math.min(1, g.finale.t / FINALE_TIME);
  // 조교님 드릴 말씀이...: 손전등이 깜빡이다 꺼진다
  if (g.boss.def.id === 'night') g.vision = Math.sin(g.finale.t * 38) > -0.3 ? 44 * (1 - k) : 0;
  const hit = FINALE_HIT[g.boss.def.id];
  if (!g.finale.hit && hit != null && k >= hit) {
    g.finale.hit = true;
    g.shake = 7;
    sfx('impact');
  }
  g.shake = Math.max(g.shake, 1.5);
  if (g.finale.t >= FINALE_TIME) bossDefeat();
}

function bossDefeat() {
  if (g.mode === 'bossDown') return;
  g.mode = 'bossDown';
  g.down = { t: 0, last: g.era === ERAS.length - 1 };
  g.player.hp = 0;
  g.player.hurt = 0.4;
  g.bullets = [];
  g.projectiles = [];
  g.pendingLevels = 0;
  input.release();
  ui.hideBossBar();
  ui.hideOverlay();
}

function updateBossDown(dt) {
  const d = g.down;
  d.t += dt;
  g.clock += dt * 0.3;
  g.player.hurt -= dt;
  // 마지막 보스: 하얗게 사라진 뒤 엔딩
  if (d.last) {
    if (d.t >= 2.6) {
      g.enemies = [];
      g.boss = null;
      g.player.hp = g.stats.maxHp;
      finish();
    }
    return;
  }
  // 그 외: 암전 → 스포트라이트가 열리며 다음 시대로
  if (d.t >= 1.8) {
    g.enemies = [];
    g.boss = null;
    g.dark = 0;
    g.player.hp = g.stats.maxHp;
    beginTransition(g.era + 1, false, true);
  }
}

// ── 레벨업 ──

function gainXp(v) {
  g.xp += v * g.stats.xpMul * ERA_XP[g.era];
  let need = xpToNext(g.level);
  while (g.xp >= need) {
    g.xp -= need;
    g.level++;
    g.pendingLevels++;
    need = xpToNext(g.level);
  }
}

// 레벨업 직전: 0.45초 멈추고 주인공 발밑에서 금빛 기둥과 고리가 퍼진 뒤 카드가 뜬다
function beginLevelUp() {
  const p = g.player;
  if (g.mode !== 'lvIntro' && g.mode !== 'levelup') g.resumeMode = g.mode;
  g.mode = 'lvIntro';
  g.lvIntro = 0.45;
  input.release();
  sfx('levelup');
  g.effects.push({ kind: 'levelup', x: p.x, y: p.y, t: 0, dur: 0.7 });
  burst(g, p.x, p.y - 16, 20, [P.yellow, P.amber, P.white], 110, 0.7, -80);
  g.texts.push({ x: p.x, y: p.y - 52, text: 'LEVEL UP!', color: P.yellow, t: 0 });
}

function openLevelUp() {
  g.mode = 'levelup';
  input.release();
  const cards = ERAS[g.era].weapons.map((id) => {
    const lv = g.weapons[id];
    if (lv >= 5) return { heal: HEAL_CARD.heal, icon: iconURL('heal', 1), name: HEAL_CARD.name, quote: HEAL_CARD.quote, lvLabel: 'MAX', effect: HEAL_CARD.text };
    const def = WEAPONS[id];
    return { id, icon: iconURL(id, 1), name: def.name, quote: def.quote, lvLabel: `Lv ${lv + 1}`, effect: def.levels[lv].text };
  });
  const pick = (i) => {
    const card = cards[i];
    const p = g.player;
    // 고른 직후: 주인공 주변으로 고리와 반짝이가 터진다
    if (card.heal) {
      p.hp = Math.min(g.stats.maxHp, p.hp + card.heal);
      sfx('heal');
      g.effects.push({ kind: 'glow', x: p.x, y: p.y - 14, r: 24, color: P.green, t: 0, dur: 0.45 });
      burst(g, p.x, p.y - 16, 14, [P.green, P.white], 90, 0.55, -40);
      g.texts.push({ x: p.x, y: p.y - 50, text: `+${card.heal}`, color: P.green, t: 0 });
    } else {
      g.weapons[card.id]++;
      computeStats();
      sfx('power');
      g.effects.push({ kind: 'glow', x: p.x, y: p.y - 14, r: 26, color: P.amber, t: 0, dur: 0.45 });
      burst(g, p.x, p.y - 16, 16, [P.amber, P.yellow, P.white], 100, 0.55, -40);
      g.texts.push({ x: p.x, y: p.y - 50, text: `Lv ${g.weapons[card.id]}`, color: P.amber, t: 0 });
    }
    g.pendingLevels--;
    ui.hideOverlay();
    if (g.pendingLevels > 0) beginLevelUp();
    else g.mode = g.resumeMode;
  };
  ui.showLevelUp(cards, pick);
  sfx('cards');
  if (DEBUG.bot) pick(Math.floor(Math.random() * cards.length));
}

// ── 사망 · 환생 · 클리어 ──

function die() {
  g.mode = 'dead';
  g.log.deaths++;
  input.release();
  audio.stopMusic(0.5);
  sfx('death');
  ui.showDeath({ age: currentAge(), onRebirth: rebirth });
  if (DEBUG.bot) rebirth();
}

function rebirth() {
  if (g.mode !== 'dead') return;
  const s = g.snapshot;
  Object.assign(g, {
    weapons: { ...s.weapons }, order: [...s.order], level: s.level, xp: s.xp, kills: s.kills,
    cd: {}, enemies: [], projectiles: [], gems: [], effects: [], texts: [], particles: [],
    pendingLevels: 0, eraTime: 0, spawnAcc: 0, formationT: 2, rebirths: g.rebirths + 1,
    boss: null, bullets: [], bossT: 0, vision: 0, dark: 0,
    // 같은 시대에서 다시 태어날수록 조금씩 쉬워진다
    ease: Math.max(0.3, g.ease * 0.75),
  });
  computeStats();
  g.player.hp = g.stats.maxHp;
  g.player.inv = 1.5;
  g.irisOpen = 0;
  g.player.x = g.map.start.x;
  g.player.y = g.map.start.y;
  ui.hideOverlay();
  ui.hideBossBar();
  g.mode = 'play';
  sfx('rebirth');
  audio.playMusic(`era${g.era}`);
  ui.toast('김충영으로 다시 도전!', `${ERAS[g.era].stage}부터 다시`);
}

function finish() {
  g.mode = 'clear';
  input.release();
  ui.hideHUD();
  if (DEBUG.bot) console.log(`[클리어] Lv ${g.level} · 처치 ${g.kills} · 사망 ${g.log.deaths}`);
  const showResults = () => {
    audio.playMusic('ending');
    ui.showClear({ kills: g.kills, level: g.level, rebirths: g.rebirths, onRestart: () => { ui.hideOverlay(); ui.initHUD(ERAS.length, pauseGame); newGame(g.demo); }, onReplay: showFilm });
  };
  const showFilm = () => {
    audio.stopMusic(0.3);
    ui.showEndingVideo({ onComplete: showResults });
  };
  showFilm();
}

// ── 적 격자 (투사체 충돌용) ──

function buildGrid() {
  g.grid.clear();
  for (const e of g.enemies) {
    if (e.dead) continue;
    const k = cellKey(Math.floor(e.x / CELL), Math.floor(e.y / CELL));
    let list = g.grid.get(k);
    if (!list) g.grid.set(k, (list = []));
    list.push(e);
  }
}

g.forEachNear = (x, y, r, fn) => {
  const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
  const y0 = Math.floor((y - r) / CELL), y1 = Math.floor((y + r) / CELL);
  for (let cx = x0; cx <= x1; cx++) {
    for (let cy = y0; cy <= y1; cy++) {
      const list = g.grid.get(cellKey(cx, cy));
      if (list) for (const e of list) if (!e.dead) fn(e);
    }
  }
};

g.nearest = (x, y, maxR, exclude) => {
  let best = null, bestD = maxR * maxR;
  for (const e of g.enemies) {
    if (e.dead || exclude?.has(e)) continue;
    const d = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
};

g.enemiesWithin = (x, y, r) => g.enemies.filter((e) => !e.dead && (e.x - x) ** 2 + (e.y - y) ** 2 <= r * r);

g.randomNear = (x, y, r, exclude) => {
  const pool = g.enemiesWithin(x, y, r).filter((e) => !exclude?.has(e));
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
};

g.damage = (e, amount, dx = 0, dy = 0, kb = 0) => {
  if (e.dead) return;
  if (e.boss) {
    e.flash = 0.08;
    sfx('hit');
    if (g.effects.length < 120 && Math.random() < 0.4) g.effects.push({ kind: 'hit', x: e.x + (Math.random() - 0.5) * 16, y: e.y - e.spr.footY / 2 + (Math.random() - 0.5) * 16, t: 0, dur: 0.14 });
    return;
  }
  const dmg = amount * g.stats.dmgMul;
  e.hp -= dmg;
  e.flash = 0.09;
  sfx('hit');
  if (kb) {
    const d = Math.hypot(dx, dy) || 1;
    const k = (kb * 3) / (e.type === 'tank' ? 3 : 1);
    e.kx += (dx / d) * k;
    e.ky += (dy / d) * k;
  }
  const bodyY = e.y - e.spr.footY / 2;
  // 숫자는 일부만 띄워야 화면이 안 지저분하다
  if (g.texts.length < 24 && (dmg >= 40 || Math.random() < 0.25)) g.texts.push({ x: e.x + (Math.random() - 0.5) * 6, y: bodyY - 6, text: String(Math.round(dmg)), color: dmg >= 40 ? P.amber : P.white, small: true, t: 0 });
  if (g.effects.length < 120 && Math.random() < 0.5) g.effects.push({ kind: 'hit', x: e.x, y: bodyY, t: 0, dur: 0.14 });
  if (e.hp <= 0) {
    e.dead = true;
    g.kills++;
    sfx('kill');
    // 시연하기는 직접 잡은 적만 경험치를 더 준다 (보스 등장 때 흩어지는 적까지 늘리면 카드가 한꺼번에 몰린다)
    g.gems.push({ x: e.x, y: e.y, v: e.xp * (g.demo ? DEMO.xp : 1), vac: false });
    if (g.effects.length < 120) g.effects.push({ kind: 'poof', x: e.x, y: bodyY, t: 0, dur: 0.3 });
  }
};

g.addText = (x, y, text, color = P.white) => g.texts.push({ x, y, text, color, t: 0 });

// ── 적 ──

function makeEnemy(type, x, y) {
  const t = ENEMY_TYPES[type];
  const hp = t.hp * ERA_HP[g.era];
  return {
    type, x, y, hp, r: t.r, xp: t.xp,
    speed: t.speed * (1 + g.era * 0.05) * (0.9 + Math.random() * 0.2),
    dmg: t.dmg * (1 + g.era * 0.25) * g.ease,
    spr: enemySprite(g.era, type),
    dir: 'down', anim: Math.random() * 4,
    kx: 0, ky: 0, flash: 0, hitCd: 0, dead: false,
  };
}

function spawnEnemies(dt) {
  const sp = ERA_SPAWN[g.era];
  const progress = g.eraTime / eraSeconds();
  g.spawnAcc += (sp.base + sp.grow * progress) * g.ease * (g.demo ? DEMO.spawn : 1) * dt;
  while (g.spawnAcc >= 1) {
    g.spawnAcc--;
    if (g.enemies.length >= MAX_ENEMIES) continue;
    const roll = Math.random();
    const type = roll < 0.07 + progress * 0.06 ? 'tank' : roll < 0.35 ? 'fast' : 'basic';
    const at = spawnPoint();
    if (at) g.enemies.push(makeEnemy(type, at.x, at.y));
  }
  if (ERAS[g.era].formation) {
    g.formationT -= dt;
    if (g.formationT <= 0) {
      g.formationT = 6;
      spawnFormation();
    }
  }
}

// 21사단: 훈련병이 가로줄 대열로 행진해 지나간다
function spawnFormation() {
  const p = g.player, R = spawnRadius();
  const a = Math.random() * TAU;
  const dir = { x: -Math.cos(a), y: -Math.sin(a) };
  const cx = p.x + Math.cos(a) * R, cy = p.y + Math.sin(a) * R;
  for (let i = -6; i <= 6; i++) {
    const x = cx - dir.y * i * 17, y = cy + dir.x * i * 17;
    if (x < 20 || y < 20 || x > g.map.w - 20 || y > g.map.h - 20 || blocked(x, y, 8)) continue;
    const e = makeEnemy('basic', x, y);
    e.march = { vx: dir.x * 40, vy: dir.y * 40 };
    g.enemies.push(e);
  }
  g.addText(p.x, p.y - 50, '대열 맞춰 전진!', P.amber);
}

// 대각선으로 움직일 때 앞모습·옆모습이 번갈아 깜빡이지 않도록,
// 지금 보는 방향을 바꾸려면 다른 축이 확실히(1.3배) 커야 한다
// 주인공은 8방향: 45° 부채꼴로 나누되, 지금 방향은 경계를 10°쯤 넘어야 바뀐다
const DIR8 = ['right', 'downright', 'down', 'downleft', 'left', 'upleft', 'up', 'upright'];
function faceDir8(dx, dy, cur) {
  const a = Math.atan2(dy, dx);
  const ci = DIR8.indexOf(cur);
  if (ci >= 0) {
    const center = (ci * Math.PI) / 4;
    const diff = Math.atan2(Math.sin(a - center), Math.cos(a - center));
    if (Math.abs(diff) < Math.PI / 8 + 0.18) return cur;
  }
  return DIR8[(Math.round(a / (Math.PI / 4)) + 8) % 8];
}

function faceDir(dx, dy, cur) {
  const ax = Math.abs(dx), ay = Math.abs(dy);
  const side = cur === 'left' || cur === 'right';
  const horizontal = side ? ax * 1.3 >= ay : ax > ay * 1.3;
  return horizontal ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
}

function updateEnemies(dt) {
  const p = g.player, R = spawnRadius();
  const decay = Math.exp(-10 * dt);
  for (const e of g.enemies) {
    let mx, my;
    if (e.march) {
      mx = e.march.vx;
      my = e.march.vy;
      if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 > (R * 1.9) ** 2) e.dead = true;
    } else {
      const dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > R * 1.6) {
        // 너무 멀어진 적은 화면 밖 다른 곳에서 다시 나타난다
        const at = spawnPoint();
        if (at) {
          e.x = at.x;
          e.y = at.y;
        }
        continue;
      }
      mx = (dx / d) * e.speed;
      my = (dy / d) * e.speed;
    }
    e.x += mx * dt;
    e.y += my * dt;
    e.dir = faceDir(mx, my, e.dir);
    e.anim += dt * (e.type === 'fast' ? 11 : e.type === 'tank' ? 6 : 8);
    if (e.kx || e.ky) {
      e.x += e.kx * dt;
      e.y += e.ky * dt;
      e.kx *= decay;
      e.ky *= decay;
      if (Math.abs(e.kx) + Math.abs(e.ky) < 1) e.kx = e.ky = 0;
    }
    pushOut(e, e.r);
    e.flash -= dt;
    e.hitCd -= dt;
    const rr = e.r + PLAYER.radius;
    if (e.hitCd <= 0 && p.inv <= 0 && (e.x - p.x) ** 2 + (e.y - p.y) ** 2 < rr * rr) hurtPlayer(e);
  }
}

function separate() {
  for (const list of g.grid.values()) {
    const n = Math.min(list.length, 10);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = list[i], b = list[j];
        if (a.boss || b.boss) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const min = (a.r + b.r) * 0.85;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0.01 && d2 < min * min) {
          const d = Math.sqrt(d2);
          const push = (min - d) / 2 / d;
          a.x -= dx * push;
          a.y -= dy * push;
          b.x += dx * push;
          b.y += dy * push;
        }
      }
    }
  }
}

// 한 번 부딪히면 크게 깎이는 대신, 맞은 뒤 0.6초는 다시 맞지 않아 둘러싸여도 순식간에 녹지는 않는다
const ENEMY_HIT_CD = 0.6;
const PLAYER_INV = 0.6;

function hurtPlayer(e) {
  e.hitCd = ENEMY_HIT_CD;
  hurt(e.dmg);
}

function hurt(dmg, opts) {
  const p = g.player;
  if (DEBUG.god || p.inv > 0 || p.hp <= 0) return;
  if (opts?.slow) p.slow = opts.slow;
  if (Math.random() < g.stats.dodge) {
    p.inv = PLAYER_INV;
    g.addText(p.x, p.y - 46, '작업 회피!', P.cyan);
    sfx('dodge');
    return;
  }
  p.hp -= dmg;
  // 보스전에서는 무적 시간이 더 짧다
  p.inv = g.boss ? 0.45 : PLAYER_INV;
  p.hurt = 0.18;
  g.shake = Math.max(g.shake, dmg >= 15 ? 4 : 3);
  sfx('hurt');
  g.texts.push({ x: p.x + (Math.random() - 0.5) * 8, y: p.y - 44, text: `-${Math.round(dmg)}`, color: P.red, t: 0 });
  burst(g, p.x, p.y - 18, 6, [P.red, P.salmon], 70, 0.35);
  if (p.hp <= 0) {
    p.hp = 0;
    if (g.boss && g.era !== ERAS.length - 1) beginFinale();
    else die();
  }
}

// ── 플레이어 · 경험치 ──

function botVector() {
  const p = g.player;
  if (DEBUG.rush) {
    const t = g.nearest(p.x, p.y, 2000);
    if (t) {
      const d = Math.hypot(t.x - p.x, t.y - p.y) || 1;
      return { x: (t.x - p.x) / d, y: (t.y - p.y) / d };
    }
  }
  if (DEBUG.wander) {
    const a = Math.floor(g.clock / 1.5) * 2.399;
    return { x: Math.cos(a), y: Math.sin(a) };
  }
  // 사람처럼 미리 피한다: 가까운 적일수록 강하게 밀려나고, 벽에 몰리지 않게 맵 가운데 쪽으로 돌며 움직인다
  const R = 120;
  let ax = 0, ay = 0;
  for (const e of g.enemies) {
    const dx = p.x - e.x, dy = p.y - e.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.5 && d < R) {
      const w = ((R - d) / R) ** 2;
      ax += (dx / d) * w;
      ay += (dy / d) * w;
    }
  }
  ax += Math.cos(g.clock * 0.5) * 0.15 + ((g.map.w / 2 - p.x) / g.map.w) * 0.8;
  ay += Math.sin(g.clock * 0.5) * 0.15 + ((g.map.h / 2 - p.y) / g.map.h) * 0.8;
  const len = Math.hypot(ax, ay) || 1;
  return { x: ax / len, y: ay / len };
}

function updatePlayer(dt) {
  const p = g.player;
  const v = DEBUG.idle ? { x: 0, y: 0 } : DEBUG.bot ? botVector() : input.vector();
  p.moving = v.x !== 0 || v.y !== 0;
  if (p.moving) {
    const speed = g.stats.speed * (p.slow > 0 ? 0.6 : 1);
    p.x += v.x * speed * dt;
    p.y += v.y * speed * dt;
    const len = Math.hypot(v.x, v.y);
    p.face = { x: v.x / len, y: v.y / len };
    const turned = faceDir8(v.x, v.y, p.dir);
    // 방향을 바꾸면 걷기 동작을 처음부터 시작한다
    if (turned !== p.dir) p.anim = 1;
    p.dir = turned;
    p.anim += dt * 10;
  }
  pushOut(p, PLAYER.radius);
  p.inv -= dt;
  p.hurt -= dt;
  p.slow = (p.slow || 0) - dt;
  if (g.stats.regen) p.hp = Math.min(g.stats.maxHp, p.hp + g.stats.regen * dt);
}

function updateGems(dt) {
  const p = g.player;
  const m2 = g.stats.magnet ** 2;
  for (const gem of g.gems) {
    const dx = p.x - gem.x, dy = p.y - gem.y;
    const d2 = dx * dx + dy * dy;
    if (!gem.vac && d2 > m2) continue;
    gem.vac = true;
    gem.sp = Math.min(560, (gem.sp ?? 80) + 900 * dt);
    const d = Math.sqrt(d2) || 1;
    if (d < 8) {
      gem.taken = true;
      gainXp(gem.v);
      sfx('gem');
      continue;
    }
    gem.x += (dx / d) * gem.sp * dt;
    gem.y += (dy / d) * gem.sp * dt;
  }
  g.gems = g.gems.filter((gem) => !gem.taken);
  // 바닥에 너무 많이 쌓이면 오래된 것끼리 합친다
  if (g.gems.length > 500) {
    const old = g.gems.splice(0, 100);
    const sum = old.reduce((s, gem) => s + gem.v, 0);
    g.gems.push({ x: old[0].x, y: old[0].y, v: sum, vac: false });
  }
}

function updateEffects(dt) {
  for (const fx of g.effects) fx.t += dt;
  g.effects = g.effects.filter((fx) => fx.t < fx.dur);
  for (const t of g.texts) {
    t.t += dt;
    t.y -= (t.small ? 26 : 18) * dt;
  }
  g.texts = g.texts.filter((t) => t.t < (t.small ? 0.5 : 0.9));
  updateParticles(g, dt);
  g.shake = Math.max(0, g.shake - dt * 12);
}

// ── 메인 업데이트 ──

function update(dt) {
  if (g.mode === 'title') return;
  updateEffects(dt);
  if (g.mode === 'transition') {
    updateTransition(dt);
    return;
  }
  if (g.mode === 'lvIntro') {
    g.lvIntro -= dt;
    if (g.lvIntro <= 0) openLevelUp();
    return;
  }
  if (g.mode === 'bossIntro') return updateBossIntro(dt);
  if (g.mode === 'boss') return updateBossFight(dt);
  if (g.mode === 'bossFinale') return updateBossFinale(dt);
  if (g.mode === 'bossDown') return updateBossDown(dt);
  if (g.mode !== 'play') return;

  g.clock += dt;
  g.irisOpen += dt;
  g.eraTime += dt;
  updatePlayer(dt);
  spawnEnemies(dt);
  updateEnemies(dt);
  if (g.mode !== 'play') return;

  buildGrid();
  separate();
  updateWeapons(g, dt);
  g.projectiles = g.projectiles.filter((p) => updateProjectile(p, g, dt));
  g.enemies = g.enemies.filter((e) => !e.dead);
  g.log.peak = Math.max(g.log.peak, g.enemies.length);
  updateGems(dt);

  if (g.eraTime >= eraSeconds()) {
    beginBoss();
    return;
  }
  if (g.pendingLevels > 0) beginLevelUp();
}

// ── 그리기 (저해상도 버퍼에 그린 뒤 정수배로 키운다) ──

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  // 숨겨진 탭처럼 창 크기가 0으로 잡혀도 화면(=적 스폰 거리)이 0이 되지 않게 한다
  canvas.width = Math.round((innerWidth || 800) * dpr);
  canvas.height = Math.round((innerHeight || 600) * dpr);
  view.S = Math.max(1, Math.round(Math.min(canvas.width, canvas.height) / VIEW_MIN));
  view.w = Math.ceil(canvas.width / view.S);
  view.h = Math.ceil(canvas.height / view.S);
  buf.width = view.w;
  buf.height = view.h;
  bctx.imageSmoothingEnabled = false;
  ctx.imageSmoothingEnabled = false;
}

// 카메라: 주인공을 가운데 두되 맵 밖은 안 보이게. 보스 탄이 화면 기준으로 움직여서 업데이트에서도 부른다
function updateCamera() {
  const p = g.player, map = g.map;
  view.x = map.w <= view.w ? Math.round((map.w - view.w) / 2) : clamp(Math.round(p.x - view.w / 2), 0, map.w - view.w);
  view.y = map.h <= view.h ? Math.round((map.h - view.h) / 2) : clamp(Math.round(p.y - 18 - view.h / 2), 0, map.h - view.h);
}

const whiteCache = new WeakMap();
function white(img) {
  if (!whiteCache.has(img)) whiteCache.set(img, silhouette(img, P.white));
  return whiteCache.get(img);
}

const inView = (x, y, m = 40) => x > view.x - m && x < view.x + view.w + m && y > view.y - m && y < view.y + view.h + m * 2;

function drawPlayer() {
  const p = g.player;
  const frames = playerSprite(shownLook())[p.dir];
  let f = p.moving && g.mode === 'play' ? frames[Math.floor(p.anim) % frames.length] : frames[0];
  if (p.hurt > 0) f = white(f);
  if (p.inv > 0 && p.hurt <= 0 && Math.floor(p.inv * 14) % 2 === 0) bctx.globalAlpha = 0.5;
  bctx.drawImage(f, Math.round(p.x - PLAYER_W / 2), Math.round(p.y - PLAYER_FOOT));
  bctx.globalAlpha = 1;
}

function drawEnemy(e) {
  const s = e.spr;
  const set = e.flash > 0 ? s.white : s.frames;
  const frames = set[e.dir];
  bctx.drawImage(frames[Math.floor(e.anim) % frames.length], Math.round(e.x - s.w / 2), Math.round(e.y - s.footY));
}

function render() {
  bctx.setTransform(1, 0, 0, 1, 0, 0);
  bctx.fillStyle = P.ink;
  bctx.fillRect(0, 0, view.w, view.h);

  if (g.mode !== 'title' && g.map) {
    const p = g.player, map = g.map;
    updateCamera();
    const sx = g.shake ? Math.round((Math.random() - 0.5) * g.shake * 2) : 0;
    const sy = g.shake ? Math.round((Math.random() - 0.5) * g.shake * 2) : 0;
    bctx.setTransform(1, 0, 0, 1, -view.x + sx, -view.y + sy);

    // 바닥
    const gx = Math.max(0, view.x), gy = Math.max(0, view.y);
    const gw = Math.min(map.w, view.x + view.w) - gx, gh = Math.min(map.h, view.y + view.h) - gy;
    if (gw > 0 && gh > 0) bctx.drawImage(map.ground, gx, gy, gw, gh, gx, gy, gw, gh);

    // 경험치 보석
    const gemFrame = Math.floor(g.clock * 6) % projFrames('gem');
    for (const gem of g.gems) {
      if (!inView(gem.x, gem.y)) continue;
      const tier = gem.v >= 20 ? 3 : gem.v >= 5 ? 2 : gem.v >= 2 ? 1 : 0;
      const img = projSprite('gem', gemFrame, tier);
      bctx.drawImage(img, Math.round(gem.x - img.width / 2), Math.round(gem.y - img.height));
    }

    // 그림자 → 소품·적·주인공을 발 위치 기준으로 앞뒤 정렬
    bctx.globalAlpha = 0.35;
    const shown = [];
    for (const e of g.enemies) {
      if (e.boss || !inView(e.x, e.y)) continue;
      shown.push(e);
      const sh = shadow(Math.max(8, Math.round(e.spr.w * 0.7)));
      bctx.drawImage(sh, Math.round(e.x - sh.width / 2), Math.round(e.y - sh.height / 2));
    }
    const psh = shadow(14);
    bctx.drawImage(psh, Math.round(p.x - 7), Math.round(p.y - psh.height / 2));
    bctx.globalAlpha = 1;

    const items = [];
    for (const pr of map.props) {
      if (pr.x > view.x + view.w || pr.x + pr.img.width < view.x || pr.y > view.y + view.h || pr.y + pr.img.height < view.y) continue;
      items.push({ y: pr.baseY, prop: pr });
    }
    for (const e of shown) items.push({ y: e.y, e });
    items.push({ y: p.y, player: true });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) {
      if (it.prop) bctx.drawImage(it.prop.img, it.prop.x, it.prop.y);
      else if (it.e) drawEnemy(it.e);
      else drawPlayer();
    }
    // 스포트라이트 연출 중에는 나무 뒤에 있어도 주인공이 보이게 맨 위에 한 번 더 그린다
    if (g.mode === 'transition' && g.trans.t >= T.RIPPLE) drawPlayer();

    // 보스 무대: 맵이 어두워지고 보스·탄·주인공만 또렷하게 남는다
    if (g.dark > 0) {
      bctx.globalAlpha = 0.5 * g.dark;
      bctx.fillStyle = P.ink;
      bctx.fillRect(view.x - 4, view.y - 4, view.w + 8, view.h + 8);
      bctx.globalAlpha = 1;
      drawBoss(bctx, g);
      drawBullets(bctx, g);
      if (g.mode !== 'bossDown' || g.down.t < 1) drawPlayer();
    }

    // 체력바
    bctx.fillStyle = P.ink;
    bctx.fillRect(Math.round(p.x - 9), Math.round(p.y + 3), 18, 3);
    bctx.fillStyle = p.hurt > 0 ? P.white : P.red;
    bctx.fillRect(Math.round(p.x - 8), Math.round(p.y + 4), Math.round(16 * Math.max(0, p.hp / g.stats.maxHp)), 1);

    for (const pr of g.projectiles) drawProjectile(bctx, pr, g.clock);
    drawAgents(bctx, g);
    for (const fx of g.effects) drawEffect(bctx, fx);
    drawParticles(bctx, g);
    for (const t of g.texts) {
      const img = pixelText(t.text, t.small ? { font: '8px Galmuri7', color: t.color } : { font: '10px Galmuri9', color: t.color });
      bctx.drawImage(img, Math.round(t.x - img.width / 2), Math.round(t.y));
    }
    // 조교님 드릴 말씀이...: 손전등 빛 밖은 어둠
    if (g.boss?.def.id === 'night' && (g.mode === 'boss' || g.mode === 'bossFinale' || g.mode === 'lvIntro' || g.mode === 'levelup')) {
      bctx.globalAlpha = 0.95;
      drawIris(g.vision);
      bctx.globalAlpha = 1;
      // 어둠 속에서도 실루엣과 안개는 희미하게 비친다 (피할 수는 있게)
      bctx.setTransform(1, 0, 0, 1, -view.x + sx, -view.y + sy);
      drawBoss(bctx, g, 0.45);
      bctx.globalAlpha = 0.6;
      drawBullets(bctx, g);
      bctx.globalAlpha = 1;
    }
    // 마지막 한 방도 화면과 같이 흔들린다
    bctx.setTransform(1, 0, 0, 1, sx, sy);
    if (g.mode === 'bossFinale') drawFinale(bctx, g, view, Math.min(1, g.finale.t / FINALE_TIME));
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    if (g.mode === 'bossDown') {
      bctx.globalAlpha = Math.min(1, g.down.t / (g.down.last ? 1.6 : 0.9));
      bctx.fillStyle = g.down.last ? P.white : P.ink;
      bctx.fillRect(0, 0, view.w, view.h);
      bctx.globalAlpha = 1;
    }

    // 맞으면 화면이 붉게 번쩍이고, 체력이 30% 아래면 화면 가장자리가 붉게 깜빡인다
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.fillStyle = P.red;
    if (p.hurt > 0) {
      bctx.globalAlpha = 0.2;
      bctx.fillRect(0, 0, view.w, view.h);
    }
    if (g.mode === 'play' && p.hp < g.stats.maxHp * 0.3) {
      bctx.globalAlpha = 0.3 + 0.2 * Math.sin(g.clock * 9);
      for (let i = 0; i < 3; i++) {
        const t = 2 + i * 3;
        bctx.globalAlpha *= 0.75;
        bctx.fillRect(0, 0, view.w, t);
        bctx.fillRect(0, view.h - t, view.w, t);
        bctx.fillRect(0, 0, t, view.h);
        bctx.fillRect(view.w - t, 0, t, view.h);
      }
    }
    bctx.globalAlpha = 1;
    const r = irisRadius();
    if (r !== null) drawIris(r);
  }

  ctx.drawImage(buf, 0, 0, view.w * view.S, view.h * view.S);
}

function hud() {
  if (g.mode === 'title') return;
  if (g.boss && g.mode !== 'bossIntro' && g.mode !== 'bossDown') {
    const def = g.boss.def;
    ui.updateBossBar(g.era === ERAS.length - 1 ? `${def.name} · 끝까지 버텨라!` : def.id === 'notice' ? `${def.name}  D-${dday(g)}` : def.name, Math.min(1, g.bossT / g.bossTime));
  }
  // 시대 카드가 뜬 뒤부터 HUD도 다음 시대를 보여준다
  const next = g.mode === 'transition' && g.trans.card && g.trans.next !== 'end';
  const era = next ? g.trans.next : g.era;
  ui.updateHUD({
    age: next ? ERAS[era].stage : currentAge(),
    eraTitle: ERAS[era].title,
    era,
    eraProgress: next ? 0 : Math.min(1, g.eraTime / eraSeconds()),
    level: g.level,
    xpFrac: g.xp / xpToNext(g.level),
    chips: g.order.map((id) => ({ icon: iconURL(id, 1), lv: g.weapons[id], old: !ERAS[g.era].weapons.includes(id) })),
  });
}

// ── 일시정지 ──
// 게임이 돌아가는 중(일반 라운드·보스전)에만 멈출 수 있다. 레벨업·전환 연출 중에는 그 화면이 먼저다.

const canPause = () => !g.paused && (g.mode === 'play' || g.mode === 'boss');

function pauseGame() {
  if (g.paused) return resumeGame();
  if (!canPause()) return;
  g.paused = true;
  input.release();
  audio.duck(true);
  sfx('pause');
  ui.showPause({
    sfx: audio.settings.sfx,
    bgm: audio.settings.bgm,
    onResume: resumeGame,
    onToggle: (kind, on) => audio.setEnabled(kind, on),
    onTitle: goTitle,
  });
}

function resumeGame() {
  if (!g.paused) return;
  g.paused = false;
  input.release();
  audio.duck(false);
  ui.hideOverlay();
  sfx('ok');
}

function goTitle() {
  g.paused = false;
  g.mode = 'title';
  input.release();
  audio.duck(false);
  ui.hideHUD();
  ui.hideOverlay();
  showTitle();
}

addEventListener('keydown', (e) => {
  // 일시정지 메뉴가 ESC를 이미 썼으면(계속하기) 다시 멈추지 않는다
  if (e.code !== 'Escape' || e.defaultPrevented) return;
  e.preventDefault();
  pauseGame();
});
// 다른 탭으로 가거나 폰 화면이 꺼지면 알아서 멈춘다
document.addEventListener('visibilitychange', () => {
  if (document.hidden && canPause()) pauseGame();
});

// ── 루프 ──

let lastTime = performance.now();
function frame(now) {
  const real = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  const total = real * DEBUG.speed;
  const steps = Math.ceil(total / 0.034);
  if (!DEBUG.pause && !g.paused) for (let i = 0; i < steps; i++) update(total / steps);
  render();
  hud();
  requestAnimationFrame(frame);
}

addEventListener('resize', resize);
resize();
// 캔버스에 쓰는 픽셀 폰트는 DOM에서 안 쓰여서 직접 불러와야 한다
Promise.all(['8px Galmuri7', '10px Galmuri9'].map((f) => document.fonts.load(f))).then(clearTextCache);

// 시대 전환 중에 그림을 처음 만들면 화면이 멈칫하니, 시작 전에 전부 만들어 둔다
// (맵 하나에 60~450ms가 걸린다. 보통은 타이틀 화면 동안 이미 끝나 있다)
function preload() {
  ERAS.forEach((era, i) => {
    buildMap(i);
    playerSprite(era.look);
    for (const type of ['basic', 'fast', 'tank']) enemySprite(i, type);
  });
}

function start(demo = false) {
  preload();
  ui.initHUD(ERAS.length, pauseGame);
  sfx('start');
  newGame(demo);
}

function showTitle() {
  ui.showTitle({ hero: playerDataURL('worker', 5), onStart: () => start(false), onDemo: () => start(true) });
  audio.playMusic('title');
}

if (DEBUG.bot) start(DEBUG.demo);
else {
  showTitle();
  // 맵은 처음 만들 때 시간이 걸려서 타이틀 화면 동안 미리 만들어 둔다
  ERAS.forEach((_, i) => setTimeout(() => buildMap(i), 150 + i * 120));
}

window.__game = g;
window.__audio = audio.state;
window.__render = () => {
  render();
  hud();
};
// 디버그: 화면 없이 시뮬레이션을 빠르게 돌린다 (밸런스 확인용)
window.__sim = (seconds, dt = 1 / 30) => {
  for (let t = 0; t < seconds && g.mode !== 'clear'; t += dt) update(dt);
  return { mode: g.mode, era: g.era, eraTime: +g.eraTime.toFixed(1), level: g.level, kills: g.kills, deaths: g.log.deaths, enemies: g.enemies.length };
};
requestAnimationFrame(frame);
