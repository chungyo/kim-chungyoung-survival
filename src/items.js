import { personalizedProjectile } from './art/icons.js';
// 무기 아이콘(16×16)과 투사체·경험치·파티클 도트. 전부 pixel.js 팔레트로만 그린다.
import { P, makeCanvas, fromGrid, outlined, rng } from './pixel.js';

// 격자용 한 글자 팔레트
const PAL = {
  k: P.ink, n: P.navy, d: P.darkSlate, s: P.slate, g: P.gray, l: P.lightGray, w: P.white,
  B: P.deepBrown, b: P.darkBrown, o: P.brown, O: P.orangeBrown, q: P.brick,
  1: P.skinDark, 2: P.skinMid, 3: P.skin, 4: P.skinLight,
  R: P.darkRed, r: P.red, H: P.hotPink, S: P.salmon, p: P.pink, u: P.purple,
  a: P.orange, m: P.amber, y: P.yellow,
  G: P.green, M: P.midGreen, D: P.darkGreen, T: P.deepTeal,
  U: P.blue, c: P.sky, C: P.cyan,
};

function grid(rows) {
  const w = rows[0].length;
  rows.forEach((row, i) => {
    if (row.length !== w) throw new Error(`grid row ${i} is ${row.length} wide, expected ${w}: "${row}"`);
  });
  return fromGrid(rows, PAL);
}

function px(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

// src를 (dx, dy)에 그린 w×h 캔버스
function placed(src, w, h, dx, dy) {
  const [c, ctx] = makeCanvas(w, h);
  ctx.drawImage(src, dx, dy);
  return c;
}

function rotated90(src, turns) {
  const [c, ctx] = makeCanvas(src.width, src.height);
  ctx.translate(src.width / 2, src.height / 2);
  ctx.rotate((turns * Math.PI) / 2);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return c;
}

// ── 공용 모양 ──

// 대각선 연필 (오른쪽 위가 뾰족한 끝)
function pencilDiagonal() {
  const [c, ctx] = makeCanvas(14, 14);
  for (let y = 0; y < 14; y++) {
    for (let x = 0; x < 14; x++) {
      const s = x + y - 13, a = x - y;
      if (Math.abs(s) > 1) continue;
      if (a >= 10 && s !== 0) continue;
      const t = s + 1;
      let col;
      if (a >= 11) col = P.darkSlate;
      else if (a >= 7) col = [P.skinLight, P.skinMid, P.skinDark][t];
      else if (a >= -6) col = [P.yellow, P.amber, P.orange][t];
      else if (a >= -9) col = [P.lightGray, P.gray, P.slate][t];
      else col = [P.salmon, P.salmon, P.pink][t];
      px(ctx, x, y, col);
    }
  }
  return c;
}

// 농구공. angle은 솔기 회전, curves는 큰 아이콘용 곡선 솔기
function ballArt(n, angle, curves) {
  const [c, ctx] = makeCanvas(n, n);
  const r = n / 2, ctr = (n - 1) / 2;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = x - ctr, dy = y - ctr;
      if (dx * dx + dy * dy > r * r - r * 0.3) continue;
      let col = P.orange;
      if (dx + dy < -r * 0.75) col = P.amber;
      else if (dx + dy > r * 0.8) col = P.brick;
      const u = cos * dx + sin * dy, v = -sin * dx + cos * dy;
      if (Math.abs(u) < 0.5 || Math.abs(v) < 0.5) col = P.deepBrown;
      if (curves) {
        const k = r * 1.55;
        for (const sgn of [-1, 1]) {
          const ox = sgn * k * cos, oy = sgn * k * sin;
          const d = Math.hypot(dx - ox, dy - oy);
          if (Math.abs(d - r * 1.05) < 0.55) col = P.deepBrown;
        }
      }
      px(ctx, x, y, col);
    }
  }
  if (!curves) px(ctx, Math.floor(ctr - r * 0.45), Math.floor(ctr - r * 0.45), P.yellow);
  return c;
}

// 개발을 상징하는 작은 노트북. 무기와 투사체에 같은 도트를 쓴다.
const PLAF_LOGO_14 = [
  '..............',
  '.kkkkkkkkkkkk.',
  '.kddddddddddk.',
  '.kdcddccddcdk.',
  '.kdccddccdddk.',
  '.kddddddddddk.',
  '.kdcddddccddk.',
  '.kddddddddddk.',
  '.kkkkkkkkkkkk.',
  'gggggggggggggg',
  '.llllllllllll.',
  '..gggggggggg..',
  '..............',
  '..............',
];
const PLAF_LOGO_16 = [
  '................',
  '..kkkkkkkkkkkk..',
  '..kddddddddddk..',
  '..kdcddccddcdk..',
  '..kdccddccdddk..',
  '..kddddddddddk..',
  '..kdcddddccddk..',
  '..kddddddddddk..',
  '..kddddddddddk..',
  '..kkkkkkkkkkkk..',
  '.gggggggggggggg.',
  '.llllllllllllll.',
  '..gggggggggggg..',
  '................',
  '................',
  '................',
];

// 그림의 실제 영역을 캔버스 가운데로 옮긴다 (제자리에서 돌도록)
function centered(src) {
  const { data } = src.getContext('2d').getImageData(0, 0, src.width, src.height);
  let x0 = src.width, y0 = src.height, x1 = -1, y1 = -1;
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      if (!data[(y * src.width + x) * 4 + 3]) continue;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  }
  const dx = Math.floor((src.width - (x1 - x0 + 1)) / 2) - x0;
  const dy = Math.floor((src.height - (y1 - y0 + 1)) / 2) - y0;
  return placed(src, src.width, src.height, dx, dy);
}

// 비스듬한 마이크: 왼쪽 위 그릴 머리, 오른쪽 아래 손잡이, 오른쪽 위 음파
function micArt() {
  const [c, ctx] = makeCanvas(14, 14);
  for (let y = 1; y <= 6; y++) {
    for (let x = 1; x <= 6; x++) {
      const edge = (y === 1 || y === 6) ? x < 2 || x > 5 : false;
      if (edge || ((x === 1 || x === 6) && (y === 1 || y === 6))) continue;
      const rim = y === 1 || y === 6 || x === 1 || x === 6;
      let col = rim ? P.slate : (x + y) % 2 ? P.gray : P.lightGray;
      if (x === 2 && y === 2) col = P.white;
      if (rim && (x + y > 9)) col = P.darkSlate;
      px(ctx, x, y, col);
    }
  }
  for (let y = 0; y < 14; y++) {
    for (let x = 0; x < 14; x++) {
      const a = x - y, s = x + y;
      if (Math.abs(a) > 1 || s < 12 || s > 24) continue;
      let col = a === -1 ? P.darkSlate : a === 0 ? P.navy : P.ink;
      if (s <= 13) col = a === 1 ? P.darkRed : P.red;
      px(ctx, x, y, col);
    }
  }
  for (const [x, y] of [[9, 1], [10, 2], [10, 3], [10, 4], [9, 5], [11, 0], [12, 1], [12, 2], [12, 3], [12, 4], [12, 5], [11, 6]]) px(ctx, x, y, P.cyan);
  return c;
}

// ── 아이콘 (14×14 그림 + 외곽선 = 16×16) ──

const ICON_ART = {
  pencil: pencilDiagonal,
  inline: () => grid([
    '..............',
    '..rrrR........',
    '..CccU........',
    '..CwcU........',
    '..CcwU........',
    '..CwcU........',
    '..CcccUU......',
    '..CccccccU....',
    '..CcccccccccU.',
    '..UUUUUUUUUUU.',
    '..ggggggggggg.',
    '..yy.yy.yy.yy.',
    '..mm.mm.mm.mm.',
    '..............',
  ]),
  abc: () => grid([
    '..............',
    '.wwwwwwwwwwww.',
    'wwwwwwwwwwwwww',
    'wwrwwUUwwwMMww',
    'wrwrwUwUwMwwww',
    'wrrrwUUwwMwwww',
    'wrwrwUwUwMwwww',
    'wrwrwUUwwwMMww',
    'wwwwwwwwwwwwww',
    '.llllllllllll.',
    '..ll..........',
    '.l............',
    '..............',
    '..............',
  ]),
  ball: () => ballArt(14, Math.PI / 4, true),
  vote: () => grid([
    '....wwwww.....',
    '....wwrww.....',
    '....wrwrw.....',
    '....wwrww.....',
    '.gllkkkkkkllg.',
    '.gggggggggggg.',
    '.CccccccccccU.',
    '.CccwwwwwwccU.',
    '.CccwUUUUwccU.',
    '.CccwwwwwwccU.',
    '.CccccccccccU.',
    '.cccccccccccU.',
    '.UUUUUUUUUUUU.',
    '..............',
  ]),
  heart: () => grid([
    '.............l',
    '...........gl.',
    '..HHHH..HHHHg.',
    '.HSSHHHHHHHHH.',
    '.HSwHHHHHHHHH.',
    '.HHHHHHHHHHHR.',
    '..HHHHHHHHHR..',
    '...HHHHHHHR...',
    '....HHHHHR....',
    '....oHHHR.....',
    '...o..HR......',
    '..o...........',
    '.ww...........',
    '.w............',
  ]),
  vocal: micArt,
  minji: () => grid([
    '..............',
    '....SH.HH.....',
    '...SwHHHHR....',
    '...HHHHHHR....',
    '....HHHHR.....',
    '.....HHR......',
    '....yyRyyy....',
    '...ymmmmmma...',
    '..ymm....mma..',
    '..ym......ma..',
    '..ym......ma..',
    '..mmm....maa..',
    '...mmmmmaaa...',
    '....aaaaaa....',
  ]),
  cram: () => grid([
    '..........yy..',
    '.........yym..',
    '.wwwwwwwyym...',
    '.wggggwyym....',
    '.wwwwwyyyyyym.',
    '.wggggwwyym...',
    '.wwwwwwyym....',
    '.wggggyym.....',
    '.wwwwyym......',
    '.wgggym.......',
    '.wwwwy........',
    '.wwrrwww......',
    '.wrwwrww......',
    '.llrrlll......',
  ]),
  drill: () => grid([
    '..............',
    '.........gl...',
    '........rgl.yy',
    '......rrrgl...',
    '....Srrrrgl...',
    'ddrrrrrrrgl...',
    'ddwwwwwwwgl.yy',
    'ddwwwwwwwgl.yy',
    'ddRRRRRRRgl...',
    '....RRRRRgl...',
    '......RRRgl...',
    '........Rgl.yy',
    '.........gl...',
    '..............',
  ]),
  stealth: () => grid([
    '..............',
    '....DDDDDD....',
    '...DMMMMMMD...',
    '..DMMGMMMMMD..',
    '..DDDDDDDDDD..',
    '...33333332...',
    '...3k33k332...',
    '...33333332...',
    '....333332....',
    '..MMMMMMMMMM..',
    '.MMMMDMMMMMMM.',
    '.MMMMMMMMMMMM.',
    '.MDMMMMMMDMMM.',
    '.MMMMMMMMMMMM.',
  ]),
  gift: () => grid([
    '..............',
    '..............',
    '..............',
    '44444444444444',
    '42444444444424',
    '44244444444244',
    '4442SH4HH42444',
    '4444HHHHH24444',
    '44444HHH444444',
    '444444H4444444',
    '44444444444444',
    '44444444444444',
    '22222222222222',
    '..............',
  ]),
  agents: () => grid([
    '......rr......',
    '......dd......',
    '..llllllllll..',
    '..lwllllllll..',
    'ddlnnnnnnnnldd',
    'ddlnCCnnCCnldd',
    'ddlnCCnnCCnldd',
    '..lnnnnnnnnl..',
    '..lnnccccnnl..',
    '..lnnnnnnnnl..',
    '..gggggggggg..',
    '....dd..dd....',
    '....mm..mm....',
    '..............',
  ]),
  todo: () => grid([
    '.....gddg.....',
    '.oooogllgooob.',
    '.oowwwwwwwwwb.',
    '.oowGGwggggwb.',
    '.oowGGwwwwwwb.',
    '.oowwwwwwwwwb.',
    '.oowGGwgggwwb.',
    '.oowGGwwwwwwb.',
    '.oowwwwwwwwwb.',
    '.oowllwggggwb.',
    '.oowllwwwwwwb.',
    '.oowwwwwwwwwb.',
    '.oolllllllllb.',
    '.bbbbbbbbbbbb.',
  ]),
  plaf: () => grid(PLAF_LOGO_14),
  heal: () => grid([
    '..............',
    '..............',
    '....wwwwww....',
    '..wwwwwwwwww..',
    '.wwlwwwwwwlww.',
    '.wwwwwlwwwwlw.',
    'UUUUUUUUUUUUUU',
    '.cwcccccccccU.',
    '.cwcccccccccU.',
    '..ccccccccU...',
    '...cccccccU...',
    '....UUUUUU....',
    '..............',
    '..............',
  ]),
};

// 은신: 오른쪽 아래로 갈수록 체크무늬로 사라진다
function dissolve(c) {
  const ctx = c.getContext('2d');
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const t = x + y;
      if ((t > 15 && (x + y) % 2 === 0) || (t > 21 && x % 2 === 0) || t > 25) ctx.clearRect(x, y, 1, 1);
    }
  }
  for (const [x, y] of [[13, 9], [11, 13], [14, 12]]) px(ctx, x, y, P.lightGray);
  return c;
}

const iconCache = new Map();
// 노트북 아이콘을 어두운 타일 위에 올린다
function logoTile() {
  const [c, ctx] = makeCanvas(16, 16);
  ctx.fillStyle = P.ink;
  ctx.fillRect(1, 0, 14, 16);
  ctx.fillRect(0, 1, 16, 14);
  ctx.drawImage(grid(PLAF_LOGO_14), 1, 1);
  return c;
}

export function weaponIcon(id) {
  if (!iconCache.has(id)) {
    const art = ICON_ART[id];
    if (!art) throw new Error(`unknown icon: ${id}`);
    let c = id === 'plaf' ? logoTile() : outlined(art());
    if (id === 'stealth') c = dissolve(c);
    iconCache.set(id, c);
  }
  return iconCache.get(id);
}

const urlCache = new Map();
export function iconURL(id, scale = 3) {
  const key = `${id}@${scale}`;
  if (!urlCache.has(key)) {
    const src = weaponIcon(id);
    const [c, ctx] = makeCanvas(src.width * scale, src.height * scale);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, c.width, c.height);
    urlCache.set(key, c.toDataURL());
  }
  return urlCache.get(key);
}

// ── 투사체 · 줍는 것 · 파티클 ──

const GEM_TIERS = [
  [P.cyan, P.sky, P.blue],
  [P.green, P.midGreen, P.darkGreen],
  [P.salmon, P.red, P.darkRed],
  [P.yellow, P.amber, P.orange],
];

function gemFrame(variant, frame) {
  const [L, M, D] = GEM_TIERS[variant] ?? GEM_TIERS[0];
  const [c, ctx] = makeCanvas(3, 5);
  const art = ['.L.', 'LMD', 'LMD', 'MMD', '.D.'];
  art.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '.') px(ctx, x, y, { L, M, D }[ch]);
  }));
  if (frame === 1) px(ctx, 0, 1, P.white);
  if (frame === 2) px(ctx, 1, 0, P.white);
  return outlined(c);
}

function sparkFrame(frame) {
  const [c, ctx] = makeCanvas(5, 5);
  if (frame === 0) {
    for (const [x, y] of [[2, 0], [0, 2], [4, 2], [2, 4]]) px(ctx, x, y, P.amber);
    for (const [x, y] of [[2, 1], [1, 2], [3, 2], [2, 3]]) px(ctx, x, y, P.yellow);
    px(ctx, 2, 2, P.white);
  } else {
    for (const [x, y] of [[2, 1], [1, 2], [3, 2], [2, 3]]) px(ctx, x, y, P.yellow);
    px(ctx, 2, 2, P.white);
  }
  return c;
}

// 죽을 때 퍼지는 먼지 구름: 뭉쳤다가 작은 덩어리로 흩어지며 사라진다
function poofFrame(frame) {
  const [c, ctx] = makeCanvas(16, 16);
  const blob = (cx, cy, r, col) => {
    ctx.fillStyle = col;
    for (let y = -r; y <= r; y++) {
      const h = Math.floor(Math.sqrt(r * r - y * y + r * 0.6));
      ctx.fillRect(Math.round(cx - h), Math.round(cy + y), h * 2 + 1, 1);
    }
  };
  if (frame <= 1) {
    const R = frame === 0 ? 3 : 5;
    const puffs = [[8, 9, 1], [5, 9, 0.7], [11, 9, 0.7], [8, 6, 0.7]];
    for (const [x, y, s] of puffs) blob(x, y, Math.max(1, Math.round(R * s)), frame === 0 ? P.lightGray : P.gray);
    for (const [x, y, s] of puffs) blob(x - 1, y - 1, Math.max(0, Math.round(R * s) - 1), frame === 0 ? P.white : P.lightGray);
    if (frame === 0) px(ctx, 6, 7, P.white);
    return placed(outlined(c), 16, 16, -1, -1);
  }
  // 흩어지는 조각들
  const rand = rng(frame * 31);
  const spread = frame === 2 ? 4.5 : 6.5;
  const r = frame === 2 ? 2 : 1;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.4;
    const x = 8 + Math.cos(a) * spread, y = 8.5 + Math.sin(a) * spread * 0.85;
    blob(x, y, r, frame === 2 ? P.gray : P.slate);
    if (frame === 2) px(ctx, Math.round(x) - 1, Math.round(y) - 1, P.lightGray);
  }
  for (let i = 0; i < (frame === 2 ? 6 : 10); i++) px(ctx, Math.floor(2 + rand() * 12), Math.floor(2 + rand() * 12), frame === 2 ? P.lightGray : P.gray);
  return c;
}

const BOLT_PATHS = [
  [[7, 0], [4, 9], [9, 17], [5, 27], [10, 35], [5, 45], [8, 54], [7, 63]],
  [[7, 0], [10, 8], [5, 18], [9, 26], [4, 36], [9, 44], [6, 54], [7, 63]],
];

function boltFrame(frame) {
  const [c, ctx] = makeCanvas(14, 64);
  const pts = BOLT_PATHS[frame];
  const stroke = (col, w) => {
    for (let i = 0; i < pts.length - 1; i++) {
      lineW(ctx, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], col, w);
    }
  };
  stroke(P.amber, 3);
  stroke(P.yellow, 2);
  stroke(P.white, 1);
  // 곁가지
  const [bx, by] = pts[3];
  lineW(ctx, bx, by, bx + (frame ? 4 : -4), by + 6, P.yellow, 1);
  // 땅에 닿는 섬광
  for (const [x, y, col] of [[5, 62, P.yellow], [9, 62, P.yellow], [3, 63, P.amber], [11, 63, P.amber], [6, 61, P.white], [8, 61, P.white]]) px(ctx, x, y, col);
  return c;
}

function lineW(ctx, x0, y0, x1, y1, color, w) {
  ctx.fillStyle = color;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  const o = Math.floor(w / 2);
  for (;;) {
    ctx.fillRect(x0 - o, y0, w, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

const PROJ = {
  pencil: {
    frames: 1,
    draw: () => outlined(grid([
      'SSlyyyyyyy4..',
      'ppgmmmmmmm22d',
      'ppsaaaaaaa1..',
    ])),
  },
  ball: {
    frames: 4,
    draw: (f) => outlined(ballArt(7, (f * Math.PI) / 8, false)),
  },
  heart: {
    frames: 2,
    draw: (f) => (f === 0
      ? outlined(grid([
        '.SH.HH.',
        'SwHHHHR',
        'HHHHHHR',
        '.HHHHR.',
        '..HHR..',
        '...R...',
      ]))
      : placed(outlined(grid([
        'SH.HH',
        'HHHHR',
        '.HHR.',
        '..R..',
      ])), 9, 8, 1, 1)),
  },
  missile: {
    frames: 2,
    draw: (f) => outlined(grid(f === 0
      ? ['..rlllll.', 'ymwwwwwwr', '..rggggg.']
      : ['..rlllll.', '.ywwwwwwr', '..rggggg.'])),
  },
  boomerang: {
    frames: 4,
    // 노트북이 90°씩 돌며 날아갔다 돌아온다
    draw: (f) => rotated90(outlined(grid(PLAF_LOGO_16)), f),
  },
  note: {
    frames: 1,
    draw: (f, v) => (v === 1
      ? outlined(grid([
        '..wwwww',
        '..w...w',
        '..w...w',
        '..w...w',
        'www.www',
        'wll.wll',
      ]))
      : outlined(grid([
        '..w..',
        '..ww.',
        '..w.w',
        '..w.w',
        'wwl..',
        'wll..',
      ]))),
  },
  agent: {
    frames: 4,
    draw: (f) => {
      const light = f < 2 ? 'r' : 'R';
      const art = grid([
        f % 2 === 0 ? 'lllllllll' : '...lll...',
        `....${light}....`,
        '..lllll..',
        '.lwllllg.',
        '.lnCnCnl.',
        '.lnnnnnl.',
        '..ggggg..',
        '..d...d..',
        f % 2 === 0 ? '..m...m..' : '..y...y..',
      ]);
      return placed(outlined(art), 11, 12, 0, f < 2 ? 1 : 0);
    },
  },
  gem: { frames: 3, draw: (f, v) => gemFrame(v, f) },
  spark: { frames: 2, draw: (f) => sparkFrame(f) },
  poof: { frames: 4, draw: (f) => poofFrame(f) },
  bolt: { frames: 2, draw: (f) => boltFrame(f) },
};

const projCache = new Map();
export function projSprite(kind, frame = 0, variant = 0) {
  const custom = personalizedProjectile(kind);
  if (custom) return custom;
  const def = PROJ[kind];
  if (!def) throw new Error(`unknown projectile: ${kind}`);
  const f = ((frame % def.frames) + def.frames) % def.frames;
  const key = `${kind}:${f}:${variant}`;
  if (!projCache.has(key)) projCache.set(key, def.draw(f, variant));
  return projCache.get(key);
}

export function projFrames(kind) {
  return PROJ[kind]?.frames ?? 1;
}
