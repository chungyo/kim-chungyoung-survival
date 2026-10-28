// 주인공 도트: 시대별 옷 5벌 × 4방향 × 걷기 4프레임. 머리:몸 ≈ 1:2.8 (20×34)
import { P, makeCanvas, mirrorX } from './pixel.js';

const PAL = {
  K: P.ink, H: P.navy, h: P.darkSlate,
  S: P.skin, s: P.skinDark, M: P.skinMid,
  W: P.white, Z: P.navy, g: P.gray,
  R: P.red, Q: P.salmon, q: P.darkRed, Y: P.amber, x: P.darkBrown, b: P.skinLight,
  G: P.green, u: P.midGreen, r: P.brick,
  N: P.navy, n: P.ink, C: P.skinDark, c: P.brown,
  V: P.darkRed, v: P.deepBrown,
  A: P.darkGreen, a: P.midGreen, o: P.deepBrown,
  T: P.navy, t: P.ink, B: P.sky,
  D: P.slate, d: P.darkSlate, L: P.darkSlate, l: P.navy,
  J: P.blue, j: P.navy,
};

export const PLAYER_W = 20, PLAYER_H = 34, PLAYER_FOOT = 33;

// 옷 색: T 상의, t 상의 그늘, P 하의, p 하의 그늘
const BODY_COLORS = {
  elem: { T: 'G', t: 'u', P: 'D', p: 'd' },
  school: { T: 'N', t: 'n', P: 'C', p: 'c' },
  college: { T: 'V', t: 'v', P: 'J', p: 'j' },
  army: { T: 'A', t: 'o', P: 'A', p: 'o' },
  worker: { T: 'T', t: 't', P: 'L', p: 'l' },
};

// ── 앞모습 ──
// 얼굴은 8칸, 머리카락은 위에서 조금 더 부풀어 있다
const FRONT_HAIR = [
  '.......KKKKKK.......',
  '.....KKHHHHHHKK.....',
  '....KHHHHhhHHHHK....',
  '....KHHHhhHHHHHK....',
  '....KHHHHHHHHHHK....',
  '....KHHHHHHHHHHK....',
  '....KHHSHHHHSSHK....',
  '.....KHSKSSKSHK.....',
  '.....KSSKSSKSSK.....',
  '.....KSSSSsSSSK.....',
  '......KSSMMSSK......',
  '.......KKSSKK.......',
];
const FRONT_CAP = [
  '.......KKKKKK.......',
  '.....KKRRRRRRKK.....',
  '....KRRRRQRRRRRK....',
  '....KRRRRYYRRRRK....',
  '...KqqqqqqqqqqqqK...',
  '.....KssssssssK.....',
  '.....KHSSSSSSHK.....',
];
const BACK_HAIR = [
  '.......KKKKKK.......',
  '.....KKHHHHHHKK.....',
  '....KHHHHhhHHHHK....',
  '....KHHHhhHHHHHK....',
  '....KHHHHHHHHHHK....',
  '....KHHHHHHHHHHK....',
  '....KHHHHHHHHHHK....',
  '....KSHHHHHHHHSK....',
  '....KSHHHHHHHHSK....',
  '.....KHHHHHHHHK.....',
  '......KHSSSSHK......',
  '.......KKSSKK.......',
];
const BACK_CAP = [
  '.......KKKKKK.......',
  '.....KKRRRRRRKK.....',
  '....KRRRRQRRRRRK....',
  '....KRRRRRRRRRRK....',
  '....KqqqqqqqqqqK....',
  '....KHHHHHHHHHHK....',
  '....KHHHHHHHHHHK....',
  '....KSHHHHHHHHSK....',
  '....KSHHHHHHHHSK....',
  '.....KSSSSSSSSK.....',
  '......KSSSSSSK......',
  '.......KKSSKK.......',
];
// ── 대각선 (3/4 각도, 오른쪽으로 돈 모습. 왼쪽은 좌우 반전) ──
// 아래 대각선: 눈·코·입이 오른쪽으로 치우치고 왼쪽에 귀가 보인다
const FRONT34_HAIR = [
  '.......KKKKKK.......',
  '.....KKHHHHHHKK.....',
  '....KHHHHhhHHHHK....',
  '....KHHHhhHHHHHK....',
  '....KHHHHHHHHHHK....',
  '....KHHHHHHHHHHK....',
  '....KHHHHSHHHSSK....',
  '....KHHsSKSSKSK.....',
  '....KHHsSKSSKSSK....',
  '.....KHSSSSSsSK.....',
  '......KSSSMMSK......',
  '.......KKSSKK.......',
];
const FRONT34_CAP = [
  '.......KKKKKK.......',
  '.....KKRRRRRRKK.....',
  '....KRRRRQRRRRRK....',
  '....KRRRRRYYRRRK....',
  '....KqqqqqqqqqqqqK..',
  '....KHHssssssssK....',
  '....KHHSSSSSSSSK....',
];
// 위 대각선: 뒷머리 오른쪽 끝으로 볼과 귀가 살짝 보인다
const BACK34_HAIR = [
  '.......KKKKKK.......',
  '.....KKHHHHHHKK.....',
  '....KHHHHhhHHHHK....',
  '....KHHHhhHHHHHK....',
  '....KHHHHHHHHHHK....',
  '....KHHHHHHHHHHK....',
  '....KHHHHHHHHHHK....',
  '....KHHHHHHHHSSK....',
  '....KHHHHHHHHSsK....',
  '.....KHHHHHHHSK.....',
  '......KHSSSSSK......',
  '.......KKSSKK.......',
];
const BACK34_CAP = [
  '.......KKKKKK.......',
  '.....KKRRRRRRKK.....',
  '....KRRRRQRRRRRK....',
  '....KRRRRRRRRRRK....',
  '....KqqqqqqqqqqqK...',
  '....KHHHHHHHHHHK....',
  '....KHHHHHHHHHHK....',
  '....KHHHHHHHHSSK....',
  '....KHHHHHHHHSsK....',
  '.....KSSSSSSSSK.....',
  '......KSSSSSSK......',
  '.......KKSSKK.......',
];

const BODY = [
  '....KKTTTTTTTTKK....',
  '...KTTTTTTTTTTTTK...',
  '..KTTKTTTTTTTTKTTK..',
  '..KTTKtTTTTTTTKTTK..',
  '..KTTKtTTTTTTTKTTK..',
  '..KTTKtTTTTTTTKTTK..',
  '..KSSKtTTTTTTTKSSK..',
  '..KSSKTTTTTTTTKSSK..',
  '..KKKKPPPPPPPPKKKK..',
  '.....KPPPKKPPPK.....',
  '.....KPPPKKPPPK.....',
  '.....KPPpKKPPpK.....',
  '.....KPPpKKPPpK.....',
  '.....KPPpKKPPpK.....',
  '.....KPPpKKPPpK.....',
  '.....KPPpKKPPpK.....',
  '.....KPPpKKPPpK.....',
  '.....KPPpKKPPpK.....',
  '.....KPPpKKPPpK.....',
  '....KZZZZKKZZZZK....',
  '....KKKKKKKKKKKK....',
  '....................',
];

// ── 옆모습 (오른쪽을 본다) ──
const SIDE_HAIR = [
  '.......KKKKKK.......',
  '.....KKHHHHHHK......',
  '....KHHHHhhHHHK.....',
  '....KHHHHHHhHHHK....',
  '....KHHHHHHHHHHK....',
  '....KHHHHHHHHHHHK...',
  '....KHHHHHHHHSSHK...',
  '....KHHHHHSSHKSK....',
  '....KHHHsSSSSKSK....',
  '....KHHSSSSSSSSSK...',
  '.....KHSSSSSSMK.....',
  '......KKKSSSKK......',
];
const SIDE_CAP = [
  '.......KKKKKK.......',
  '.....KKRRRRRRK......',
  '....KRRRQRRRRRK.....',
  '....KRRRRRRRRYRK....',
  '....KqqqqqqqqqqqqqK.',
  '....KHHHHHsssssK....',
  '....KHHHHHHSSSSK....',
];
const SIDE_TORSO = [
  '.......KTTTTK.......',
  '......KTTTTTTK......',
  '......KtTTTTTK......',
  '......KtTTTTTK......',
  '......KtTTTTTK......',
  '......KtTTTTTK......',
  '......KtTTTTTK......',
  '......KtTTTTTK......',
  '......KKKKKKKK......',
];

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const both = (...pts) => pts.flatMap(([x, y]) => [[x, y], [19 - x, y]]);
const cols = (xs, ys) => xs.flatMap((x) => ys.map((y) => [x, y]));
const recolor = (rows, map) => rows.map((row) => row.replace(/[TtPp]/g, (c) => map[c]));
const grid = (rows) => rows.map((row) => {
  if (row.length !== 20) throw new Error(`row width ${row.length}: ${row}`);
  return [...row];
});

function put(g, ch, pts) {
  for (const [x, y] of pts) if (g[y] && x >= 0 && x < 20) g[y][x] = ch;
}

// 반바지·짧은 소매처럼 특정 줄의 옷 색을 피부로 바꾼다
function skinRows(g, ys, from, shade) {
  for (const y of ys) for (let x = 0; x < 20; x++) {
    if (g[y][x] === from) g[y][x] = 'S';
    else if (g[y][x] === shade) g[y][x] = 's';
  }
}

const FRONT = {
  elem(g) {
    skinRows(g, range(25, 30), 'D', 'd');
    put(g, 'r', cols([7, 12], range(12, 16)));
    put(g, 'r', cols([1, 18], range(13, 18)));
    for (let x = 0; x < 20; x++) if (g[31][x] === 'Z') g[31][x] = 'W';
    put(g, 'g', [[5, 33], [8, 33], [11, 33], [14, 33]]);
  },
  school(g) {
    // 사진 속 교복: 검정 블레이저 + 베이지 파이핑, 흰 셔츠, 금색·갈색 줄무늬 넥타이, 카키 바지
    put(g, 'b', [[7, 12], [12, 12], [8, 13], [11, 13], [8, 14], [11, 14], [9, 15], [10, 15]]);
    put(g, 'W', [[8, 12], [11, 12]]);
    put(g, 'Y', [[9, 12], [10, 12], [9, 13], [10, 13]]);
    put(g, 'x', [[9, 14], [10, 14]]);
    put(g, 'Y', [[9, 17]]);
    put(g, 'b', [[6, 18], [7, 18], [12, 18], [13, 18]]);
    put(g, 'b', both([3, 17], [4, 17]));
  },
  college(g) {
    put(g, 'W', both(...cols([3, 4], range(14, 17)), [4, 13], [5, 13]));
    put(g, 'W', cols(range(6, 13), [19]));
    put(g, 'Y', [[7, 14], [8, 14], [7, 15]]);
    put(g, 'W', [[9, 12], [10, 12]]);
  },
  army(g) {
    const spots = [[7, 13], [12, 14], [8, 16], [11, 17], [3, 15], [16, 16], [10, 19], [13, 18], [6, 22], [12, 23], [7, 25], [13, 26], [6, 28], [11, 21]];
    put(g, 'a', spots.filter((_, i) => i % 2 === 0));
    put(g, 'o', spots.filter((_, i) => i % 2 === 1));
  },
  worker(g) {
    put(g, 'S', both(...cols([3, 4], [16, 17])));
    put(g, 'B', [[8, 12], [11, 12], [9, 13], [10, 13]]);
    put(g, 'W', cols([9, 10], [14, 15]));
    put(g, 'B', [[9, 14], [10, 14]]);
  },
};

const BACK = {
  elem(g) {
    skinRows(g, range(25, 30), 'D', 'd');
    // 등에 멘 커다란 책가방
    put(g, 'K', [...cols(range(5, 14), [12, 20]), ...cols([5, 14], range(12, 20))]);
    put(g, 'r', cols(range(6, 13), range(13, 19)));
    put(g, 'R', cols(range(6, 13), range(13, 14)));
    put(g, 'K', cols(range(6, 13), [15]));
    put(g, 'Y', [[9, 15], [10, 15]]);
    put(g, 'q', cols([13], range(16, 19)));
    for (let x = 0; x < 20; x++) if (g[31][x] === 'Z') g[31][x] = 'W';
    put(g, 'g', [[5, 33], [8, 33], [11, 33], [14, 33]]);
  },
  school(g) {
    put(g, 'b', both([3, 17], [4, 17]));
    put(g, 'n', cols([9, 10], range(17, 19)));
  },
  college(g) {
    put(g, 'W', both(...cols([3, 4], range(14, 17)), [4, 13], [5, 13]));
    put(g, 'W', cols(range(6, 13), [19]));
    put(g, 'W', cols(range(7, 12), [14]));
    put(g, 'W', [[6, 15], [13, 15]]);
  },
  army(g) {
    const spots = [[8, 13], [11, 14], [7, 16], [12, 17], [3, 15], [16, 16], [10, 18], [6, 19], [7, 22], [12, 23], [6, 25], [13, 26], [8, 28], [11, 21]];
    put(g, 'a', spots.filter((_, i) => i % 2 === 0));
    put(g, 'o', spots.filter((_, i) => i % 2 === 1));
  },
  worker(g) {
    put(g, 'S', both(...cols([3, 4], [16, 17])));
    put(g, 'B', [[8, 12], [11, 12]]);
  },
};

// view: front(정면) · back(뒤) · front34(아래 대각선) · back34(위 대각선)
const HEADS = {
  front: { hair: FRONT_HAIR, cap: [...FRONT_CAP, ...FRONT_HAIR.slice(7)] },
  back: { hair: BACK_HAIR, cap: BACK_CAP },
  front34: { hair: FRONT34_HAIR, cap: [...FRONT34_CAP, ...FRONT34_HAIR.slice(7)] },
  back34: { hair: BACK34_HAIR, cap: BACK34_CAP },
};

function frontGrid(look, view) {
  const head = HEADS[view][look === 'army' ? 'cap' : 'hair'];
  const g = grid([...head, ...recolor(BODY, BODY_COLORS[look])]);
  (view.startsWith('back') ? BACK : FRONT)[look](g);
  if (view.endsWith('34')) turnBody(g, view === 'front34');
  if (look === 'elem' && view === 'front') {
    for (const x of [6, 7, 8, 9, 10, 11, 12, 13]) g[8][x] = 'K';
    for (const x of [6, 9, 10, 13]) g[9][x] = 'K';
  }
  return g;
}

// 대각선: 몸이 오른쪽으로 돌아 먼 쪽(왼쪽) 팔이 반쯤 가려지고, 앞모습이면 가슴 장식도 한 칸 따라간다
function turnBody(g, front) {
  for (let y = 13; y <= 19; y++) {
    g[y][1] = '.';
    g[y][2] = '.';
    g[y][3] = 'K';
  }
  g[13][3] = '.';
  g[13][4] = 'K';
  g[20][2] = '.';
  if (!front) return;
  for (let y = 12; y <= 19; y++) {
    for (let x = 12; x >= 6; x--) g[y][x + 1] = g[y][x];
  }
}

// 걷기: 한쪽 다리를 한 칸 들어 올린다
function liftLeg(g, x0, x1) {
  const out = g.map((row) => [...row]);
  for (let y = 22; y < out.length; y++) {
    for (let x = x0; x <= x1; x++) out[y][x] = y + 1 < g.length ? g[y + 1][x] : '.';
  }
  return out;
}

// ── 옆모습 조립 ──
function stamp(g, rows, y0) {
  rows.forEach((row, i) => {
    for (let x = 0; x < 20; x++) if (row[x] !== '.') g[y0 + i][x] = row[x];
  });
}

// 다리 한 짝 = 외곽선 + 2칸. xs는 줄마다 다리 왼쪽 외곽선 위치 (엉덩이 → 발목)
function leg(g, y0, xs, fill, foot) {
  xs.forEach((x, i) => {
    const y = y0 + i;
    g[y][x] = 'K';
    g[y][x + 1] = fill;
    g[y][x + 2] = fill;
    g[y][x + 3] = 'K';
  });
  const [fx, fy] = foot;
  g[fy][fx] = 'K';
  for (let i = 1; i <= 3; i++) g[fy][fx + i] = 'Z';
  g[fy][fx + 4] = 'K';
  for (let i = 0; i <= 4; i++) g[fy + 1][fx + i] = 'K';
}

const LEG = {
  straight: { rows: 10, xs: [8, 8, 8, 8, 8, 8, 8, 8, 8, 8], foot: [8, 31] },
  forward: { rows: 9, xs: [8, 8, 9, 9, 10, 10, 11, 11, 12], foot: [12, 31] },
  back: { rows: 9, xs: [8, 8, 7, 7, 6, 6, 5, 5, 4], foot: [4, 31] },
  lifted: { rows: 8, xs: [8, 8, 8, 7, 7, 7, 6, 6], foot: [6, 29] },
};

// 4프레임: 모은 자세 → 앞다리 딛기 → 뒷다리 넘기기 → 반대 다리 딛기
const SIDE_POSES = [
  { lift: 0, far: 'straight', near: 'straight', swing: 0 },
  { lift: 1, far: 'back', near: 'forward', swing: -2 },
  { lift: 0, far: 'lifted', near: 'straight', swing: 0 },
  { lift: 1, far: 'forward', near: 'back', swing: 2 },
];

function sideGrid(look, frame) {
  const map = BODY_COLORS[look];
  const g = Array.from({ length: PLAYER_H }, () => Array(20).fill('.'));
  const pose = SIDE_POSES[frame];
  const y0 = pose.lift;
  const hip = 21 + y0;

  // 먼 다리(그늘색)를 먼저, 가까운 다리를 위에 그린다
  for (const [which, fill] of [[pose.far, map.p], [pose.near, map.P]]) {
    const L = LEG[which];
    leg(g, which === 'straight' || which === 'lifted' ? 21 : hip, L.xs, fill, L.foot);
  }

  // 몸통과 머리 (다리를 넘길 때 한 칸 올라간다)
  const head = look === 'army' ? [...SIDE_CAP, ...SIDE_HAIR.slice(7)] : SIDE_HAIR;
  stamp(g, [...head, ...recolor(SIDE_TORSO, map)], y0);

  // 앞쪽 팔: 가까운 다리와 반대로 흔든다 (어깨는 고정, 아래로 갈수록 더 벌어진다)
  const armDx = (y) => (y >= 18 ? pose.swing : y >= 16 ? pose.swing / 2 : 0);
  for (let y = 13; y <= 20; y++) {
    const dx = armDx(y);
    const yy = y + y0;
    if (y === 20) {
      for (let x = 9; x <= 12; x++) g[yy][x + dx] = 'K';
      continue;
    }
    const fill = y >= 18 ? 'S' : map.T;
    g[yy][9 + dx] = 'K';
    g[yy][10 + dx] = fill;
    g[yy][11 + dx] = fill;
    g[yy][12 + dx] = 'K';
  }

  SIDE[look](g, y0, armDx);
  if (look === 'elem') {
    for (const x of [10, 11, 12, 13]) g[8 + y0][x] = 'K';
    g[9 + y0][10] = 'K';
    g[9 + y0][13] = 'K';
  }
  return g;
}

const SIDE = {
  elem(g, y0) {
    // 등 뒤 책가방
    for (let y = 12; y <= 20; y++) {
      g[y + y0][3] = 'K';
      for (let x = 4; x <= 6; x++) g[y + y0][x] = y === 12 || y === 20 ? 'K' : y < 15 ? 'R' : 'r';
    }
    put(g, 'r', [[8, 12 + y0], [8, 13 + y0]]);
    // 반바지 아래 맨다리, 인라인 부츠와 바퀴
    skinRows(g, range(25, 30), 'D', 'd');
    for (let y = 0; y < PLAYER_H; y++) for (let x = 0; x < 20; x++) if (g[y][x] === 'Z') g[y][x] = 'W';
    for (let y = 0; y < PLAYER_H - 2; y++) {
      for (let x = 0; x < 20; x++) if (g[y][x] === 'W' && g[y + 1][x] === 'K' && x % 2 === 1) g[y + 2][x] = 'g';
    }
  },
  school(g, y0, armDx) {
    put(g, 'W', [[10, 12 + y0], [11, 12 + y0]]);
    for (const x of [10, 11]) g[17 + y0][x + armDx(17)] = 'b';
  },
  college(g, y0, armDx) {
    for (let y = 13; y <= 17; y++) for (const x of [10, 11]) g[y + y0][x + armDx(y)] = 'W';
    for (let x = 7; x <= 12; x++) if (g[19 + y0][x] === 'V' || g[19 + y0][x] === 'v') g[19 + y0][x] = 'W';
  },
  army(g, y0) {
    put(g, 'a', [[8, 14 + y0], [12, 16 + y0], [7, 18 + y0]]);
    put(g, 'o', [[12, 13 + y0], [8, 17 + y0], [11, 19 + y0]]);
    // 다리 위장무늬: 다리 색 칸 중 일부만 바꾼다
    for (let y = 22; y <= 30; y++) for (let x = 0; x < 20; x++) {
      if (g[y][x] === 'A' && (x * 7 + y * 3) % 5 === 0) g[y][x] = 'a';
    }
  },
  worker(g, y0, armDx) {
    for (const y of [16, 17]) for (const x of [10, 11]) g[y + y0][x + armDx(y)] = 'S';
    put(g, 'B', [[11, 12 + y0], [13, 13 + y0]]);
    put(g, 'W', [[13, 14 + y0], [13, 15 + y0]]);
  },
};

function toCanvas(g) {
  const [c, ctx] = makeCanvas(20, g.length);
  g.forEach((row, y) => row.forEach((ch, x) => {
    if (ch === '.') return;
    ctx.fillStyle = PAL[ch];
    ctx.fillRect(x, y, 1, 1);
  }));
  return c;
}

const cache = new Map();
export function playerSprite(look) {
  if (!cache.has(look)) {
    const walk = (g) => [g, liftLeg(g, 4, 9), g, liftLeg(g, 10, 15)].map(toCanvas);
    const right = [0, 1, 2, 3].map((f) => toCanvas(sideGrid(look, f)));
    const downright = walk(frontGrid(look, 'front34'));
    const upright = walk(frontGrid(look, 'back34'));
    cache.set(look, {
      down: walk(frontGrid(look, 'front')),
      up: walk(frontGrid(look, 'back')),
      right,
      left: right.map(mirrorX),
      downright,
      downleft: downright.map(mirrorX),
      upright,
      upleft: upright.map(mirrorX),
    });
  }
  return cache.get(look);
}

export function playerDataURL(look, scale = 6) {
  const src = playerSprite(look).down[0];
  const [c, ctx] = makeCanvas(src.width * scale, src.height * scale);
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL();
}
