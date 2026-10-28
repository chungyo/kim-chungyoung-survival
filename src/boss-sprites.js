// 보스 5종과 보스 탄 도트. 실제 장면이 아니라 그때 느낀 감정을 추상적으로 그린다.
// 얼굴 없는 실루엣, 안개, 디더링, 바랜 색 + 강조색 하나.
import { P, makeCanvas, silhouette, rng, rect, disc, ring, line, ditherGlow } from './pixel.js';

const px = (ctx, x, y, c) => {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, 1, 1);
};

// 칠해진 영역의 가장자리 픽셀을 외곽선 색으로 바꾼다 (안쪽 외곽선)
function edgeOutline(ctx, w, h, color = P.ink, keep = () => false) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const a = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[(y * w + x) * 4 + 3]);
  const edges = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!a(x, y) || keep(x, y)) continue;
      if (!a(x - 1, y) || !a(x + 1, y) || !a(x, y - 1) || !a(x, y + 1)) edges.push([x, y]);
    }
  }
  for (const [x, y] of edges) px(ctx, x, y, color);
}

// 가장자리를 갉아먹듯 지워서 흩어지는 느낌을 준다. bottomFrom 아래로는 점점 더 많이 지운다
function dissolve(ctx, w, h, { edge = 0.2, bottomFrom = h, bottomMax = 0.85, seed = 1 } = {}) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const rand = rng(seed);
  const a = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[(y * w + x) * 4 + 3]);
  const kill = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!a(x, y)) continue;
      const isEdge = !a(x - 1, y) || !a(x + 1, y) || !a(x, y - 1) || !a(x, y + 1);
      let p = isEdge ? edge : 0;
      if (y >= bottomFrom) p = Math.max(p, ((y - bottomFrom) / Math.max(1, h - bottomFrom)) * bottomMax);
      if (rand() < p) kill.push((y * w + x) * 4 + 3);
    }
  }
  for (const i of kill) d[i] = 0;
  ctx.putImageData(img, 0, 0);
}

function build(w, h, draw, n = 4) {
  const frames = [];
  for (let f = 0; f < n; f++) {
    const [c, ctx] = makeCanvas(w, h);
    draw(ctx, f, w, h);
    frames.push(c);
  }
  return { w, h, footY: h - 1, frames, white: frames.map((c) => silhouette(c, P.white)) };
}

// ── 1 · 이건 왜 틀렸니: 뒤엉킨 문제집과 시험지 탑, 몸 곳곳에서 깜빡이는 빨간 채점 눈, 빨간 펜 팔 ──
const BOOKS = [
  { w: 38, h: 6, dx: 0, c: P.navy, pages: true },
  { w: 34, h: 5, dx: 2, c: P.darkSlate },
  { w: 36, h: 6, dx: -2, c: P.deepBrown, pages: true },
  { w: 30, h: 5, dx: 3, c: P.navy },
  { w: 32, h: 6, dx: -1, c: P.darkSlate, pages: true },
  { w: 26, h: 5, dx: 2, c: P.purple },
  { w: 28, h: 5, dx: -3, c: P.navy, pages: true },
  { w: 22, h: 5, dx: 1, c: P.darkSlate },
  { w: 18, h: 4, dx: -1, c: P.deepBrown, pages: true },
];
const STUDY_EYES = [
  { x: 13, y: 47, t: 'o' }, { x: 33, y: 43, t: 'x' }, { x: 20, y: 36, t: 'o' }, { x: 30, y: 30, t: 'o' },
  { x: 14, y: 26, t: 'x' }, { x: 25, y: 20, t: 'o' }, { x: 18, y: 13, t: 'x' }, { x: 29, y: 10, t: 'o' },
];

function sheet(ctx, x0, y0, len, slope, dir = 1) {
  // 비스듬히 삐져나온 시험지 한 장
  for (let i = 0; i < len; i++) {
    const x = x0 + i * dir;
    const y = y0 + Math.round(i * slope);
    rect(ctx, x, y, 1, 6, P.lightGray);
    px(ctx, x, y, P.ink);
    px(ctx, x, y + 6, P.ink);
    if (i % 3 === 1) px(ctx, x, y + 2, P.gray);
    if (i % 3 === 2) px(ctx, x, y + 4, P.gray);
  }
  px(ctx, x0 + (len - 1) * dir, y0 + Math.round((len - 1) * slope) + 2, P.red);
  px(ctx, x0 + (len - 2) * dir, y0 + Math.round((len - 2) * slope) + 3, P.red);
}

function drawStudy(ctx, f, w, h) {
  const bob = f === 1 || f === 2 ? 1 : 0;
  ditherGlow(ctx, 24, 30, 24, P.purple, 0.5, 5 + f);
  // 탑 뒤로 드리운 그림자 망토: 아래로 넓게 퍼지며 흩어진다
  const rand = rng(900 + f * 31);
  for (let y = 14; y < h; y++) {
    const half = 10 + Math.round((y - 14) * 0.42);
    for (let x = 24 - half; x <= 24 + half; x++) {
      const edge = Math.abs(x - 24) / half;
      if (edge < 0.8 || rand() < 0.55 - (edge - 0.8) * 2) px(ctx, x, y, edge < 0.6 ? P.ink : P.navy);
    }
  }

  // 문제집 탑 (아래에서 위로)
  let y = h - 1;
  for (const b of BOOKS) {
    y -= b.h;
    const x = Math.round(24 - b.w / 2 + b.dx);
    const yy = y + (y < 30 ? bob : 0);
    rect(ctx, x, yy, b.w, b.h, P.ink);
    rect(ctx, x + 1, yy + 1, b.w - 2, b.h - 2, b.c);
    if (b.pages) {
      rect(ctx, x + 2, yy + b.h - 2, b.w - 4, 1, P.lightGray);
      for (let i = x + 3; i < x + b.w - 3; i += 3) px(ctx, i, yy + b.h - 2, P.gray);
    } else {
      rect(ctx, x + Math.floor(b.w / 2) - 3, yy + 1, 6, b.h - 2, P.slate);
    }
  }
  // 맨 위: 구겨진 시험지 머리와 둘둘 말린 시험지 뿔
  const top = y + bob;
  disc(ctx, 23, top - 2, 6, P.lightGray);
  ring(ctx, 23, top - 2, 6, 1, P.ink);
  line(ctx, 19, top - 4, 26, top - 1, P.gray);
  line(ctx, 20, top, 27, top - 5, P.gray);
  for (const dir of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const hx = 23 + dir * (5 + Math.round(i * 0.7)), hy = top - 6 - i;
      rect(ctx, hx - 1, hy, 3, 1, P.ink);
      px(ctx, hx, hy, i > 3 ? P.red : P.lightGray);
    }
  }

  // 양옆으로 삐져나온 시험지
  sheet(ctx, 7, 36 + bob, 8, -0.4, -1);
  sheet(ctx, 41, 24 + bob, 7, 0.3, 1);
  sheet(ctx, 8, 18 + bob, 6, 0.5, -1);

  // 빨간 펜 팔: 몸 오른쪽에서 뻗어 나와 흔들린다
  const sway = [0, 1, 2, 1][f];
  const ax = 36, ay = 22 + bob, bx = 46, by = 38 + sway;
  line(ctx, ax, ay, bx, by, P.ink, 4);
  line(ctx, ax, ay, bx, by, P.red, 2);
  line(ctx, ax + 1, ay, bx + 1, by, P.darkRed, 1);
  px(ctx, bx, by + 1, P.ink);
  px(ctx, bx, by + 2, P.ink);
  rect(ctx, ax - 1, ay - 1, 3, 2, P.white);

  // 깜빡이는 채점 눈 (동그라미·X)
  STUDY_EYES.forEach((e, i) => {
    if ((i + f) % 3 === 0) return;
    const ey = e.y + (e.y < 30 ? bob : 0);
    if (e.t === 'o') {
      ring(ctx, e.x, ey, 2, 1, P.red);
      px(ctx, e.x, ey, P.ink);
    } else {
      line(ctx, e.x - 2, ey - 2, e.x + 2, ey + 2, P.red);
      line(ctx, e.x - 2, ey + 2, e.x + 2, ey - 2, P.red);
    }
  });
}

// ── 2 · 너가 그러면 안됐지: 바랜 교복의 뒷모습, 가장자리가 흩어지고 한쪽에 노을빛 ──
function drawFriend(ctx, f, w, h) {
  const breathe = f === 1 || f === 2 ? 1 : 0; // 상체가 아주 살짝 오르내린다
  const up = -breathe;
  const cx = 17;

  // 다리와 신발 (흐릿한 카키 → 회색)
  for (let y = 35; y <= 49; y++) {
    rect(ctx, cx - 7, y, 6, 1, P.gray);
    rect(ctx, cx + 1, y, 6, 1, P.gray);
    px(ctx, cx - 2, y, P.slate);
    px(ctx, cx + 1, y, P.slate);
    if ((y * 3) % 7 === 0) px(ctx, cx - 5, y, P.skinDark);
    if ((y * 5) % 9 === 0) px(ctx, cx + 4, y, P.skinDark);
  }
  rect(ctx, cx - 8, 50, 7, 3, P.darkSlate);
  rect(ctx, cx + 1, 50, 7, 3, P.darkSlate);

  // 상체: 바랜 블레이저 뒷모습, 어깨가 살짝 처져 있다
  for (let y = 17; y <= 35; y++) {
    const half = y === 17 ? 7 : y === 18 ? 9 : 10;
    rect(ctx, cx - half, y + up, half * 2 + 1, 1, P.slate);
  }
  // 팔 (몸 옆에 늘어뜨림)
  for (let y = 19; y <= 33; y++) {
    rect(ctx, cx - 12, y + up, 3, 1, P.slate);
    rect(ctx, cx + 10, y + up, 3, 1, P.slate);
  }
  rect(ctx, cx - 12, 34 + up, 3, 2, P.gray);
  rect(ctx, cx + 10, 34 + up, 3, 2, P.gray);
  // 블레이저 그늘, 등 트임
  for (let y = 20; y <= 35; y++) px(ctx, cx - 9, y + up, P.darkSlate);
  for (let y = 28; y <= 35; y++) px(ctx, cx, y + up, P.darkSlate);
  rect(ctx, cx - 3, 17 + up, 7, 1, P.lightGray); // 셔츠 깃

  // 목과 뒷머리
  rect(ctx, cx - 2, 15 + up, 5, 2, P.gray);
  for (let y = 2; y <= 15; y++) {
    const t = (y - 8.5) / 6.8;
    const half = Math.round(6.5 * Math.sqrt(Math.max(0, 1 - t * t)));
    if (half > 0) rect(ctx, cx - half, y + up, half * 2 + 1, 1, P.darkSlate);
  }
  px(ctx, cx - 7, 9 + up, P.gray);
  px(ctx, cx + 7, 9 + up, P.gray);
  line(ctx, cx - 2, 4 + up, cx + 1, 3 + up, P.slate);
  line(ctx, cx + 2, 6 + up, cx + 4, 5 + up, P.slate);

  edgeOutline(ctx, w, h, P.ink);

  // 한쪽에 남은 노을빛
  const img = ctx.getImageData(0, 0, w, h).data;
  for (let y = 2; y < 46; y++) {
    for (let x = 0; x < w; x++) {
      if (img[(y * w + x) * 4 + 3]) {
        px(ctx, x + 1, y, y < 17 ? P.orangeBrown : P.amber);
        if (y % 3 === 0 && y > 17) px(ctx, x + 2, y, P.orangeBrown);
        break;
      }
    }
  }

  // 점점 흩어진다: 가장자리와 발밑부터
  dissolve(ctx, w, h, { edge: 0.18, bottomFrom: 40, bottomMax: 0.7, seed: 31 + f * 7 });
}

// ── 3 · 올것이 왔다: 붉은 도장이 찍힌 거대한 봉투, 열린 틈으로 어둠이 새어 나온다 ──
function drawNotice(ctx, f, w, h) {
  const bob = [0, 1, 2, 1][f];
  const top = 14 + bob, left = 3, right = w - 4, bottom = 39 + bob;
  const mid = Math.floor(w / 2);

  // 봉투 뒤로 드리운 어둠
  ditherGlow(ctx, mid, top + 12, 26, P.ink, 0.55, 3 + f);

  // 열린 덮개 (위로 젖혀진 누런 공문 봉투 덮개)
  for (let y = top - 9; y <= top; y++) {
    const half = Math.round(((y - (top - 9)) / 9) * (mid - left));
    rect(ctx, mid - half, y, half * 2 + 1, 1, P.brown);
  }
  // 봉투 안쪽 어둠
  rect(ctx, left + 1, top, right - left - 1, 4, P.ink);
  // 봉투 몸통 (누런 공문 봉투)
  rect(ctx, left, top + 3, right - left + 1, bottom - top - 2, P.skinDark);
  rect(ctx, left, bottom - 2, right - left + 1, 2, P.brown);
  rect(ctx, left, top + 3, right - left + 1, 1, P.skinMid);
  // 앞면 접힌 선
  line(ctx, left + 1, bottom - 1, mid, top + 13, P.brown);
  line(ctx, right - 1, bottom - 1, mid, top + 13, P.brown);
  // 주소 줄
  rect(ctx, left + 4, bottom - 9, 12, 1, P.darkBrown);
  rect(ctx, left + 4, bottom - 7, 9, 1, P.darkBrown);
  edgeOutline(ctx, w, h, P.ink, (x, y) => y < top - 1 && (y < top - 9 || Math.abs(x - mid) > ((y - (top - 9)) / 9) * (mid - left) + 1));

  // 틈에서 피어오르는 어둠: 덮개 위로 연기처럼, 몸통 위로는 손가락처럼 번진다
  const rand = rng(77 + f * 13);
  ditherGlow(ctx, mid, top - 4, 14, P.purple, 0.6, 9 + f);
  for (let i = 0; i < 46; i++) {
    const x = mid - 15 + Math.floor(rand() * 30);
    const y = top - 1 - Math.floor(rand() * rand() * 14);
    px(ctx, x, y, rand() < 0.55 ? P.ink : P.purple);
  }
  for (let i = 0; i < 7; i++) {
    let x = left + 4 + Math.floor(rand() * (right - left - 8));
    const len = 2 + Math.floor(rand() * 4) + ((f + i) % 2);
    for (let k = 0; k < len; k++) {
      px(ctx, x, top + 4 + k, k === len - 1 ? P.purple : P.ink);
      if (rand() < 0.3) x += rand() < 0.5 ? -1 : 1;
    }
  }

  // 붉은 도장
  const sx = mid + 9, sy = top + 15;
  disc(ctx, sx, sy, 5, P.red);
  ring(ctx, sx, sy, 5, 1, P.darkRed);
  ring(ctx, sx, sy, 3, 1, P.darkRed);
  px(ctx, sx - 1, sy - 1, P.darkRed);
  px(ctx, sx + 1, sy, P.darkRed);
  px(ctx, sx, sy + 1, P.darkRed);

  // 아래로 떨어지는 어둠 방울
  const drips = [[mid - 12, 2], [mid + 3, 4], [mid + 15, 3]];
  drips.forEach(([x, len], i) => {
    const l = len + ((f + i) % 3);
    for (let k = 1; k <= l; k++) px(ctx, x, bottom + k, k === l ? P.navy : P.ink);
  });
}

// ── 4 · 조교님 드릴 말씀이...: 어둠 속 얼굴 없는 실루엣. 가장자리가 안개처럼 깜빡이며 흩어진다 ──
function drawNight(ctx, f, w, h) {
  const cx = 18;
  const [c, g] = makeCanvas(w, h);
  // 머리
  for (let y = 4; y <= 15; y++) {
    const t = (y - 9.5) / 5.8;
    const half = Math.round(5.5 * Math.sqrt(Math.max(0, 1 - t * t)));
    if (half > 0) rect(g, cx - half, y, half * 2 + 1, 1, P.ink);
  }
  rect(g, cx - 2, 15, 5, 2, P.ink);
  // 몸: 좁은 어깨, 늘어진 팔
  for (let y = 17; y <= 36; y++) {
    const half = y < 19 ? 7 : 8;
    rect(g, cx - half, y, half * 2 + 1, 1, P.ink);
  }
  for (let y = 19; y <= 34; y++) {
    rect(g, cx - 11, y, 3, 1, P.ink);
    rect(g, cx + 9, y, 3, 1, P.ink);
  }
  for (let y = 37; y <= 50; y++) {
    rect(g, cx - 6, y, 5, 1, P.ink);
    rect(g, cx + 2, y, 5, 1, P.ink);
  }
  // 아주 흐린 윤곽 빛
  for (let y = 5; y <= 13; y++) px(g, cx - 4 + Math.abs(y - 9) / 2, y, P.navy);
  for (let y = 18; y <= 34; y++) px(g, cx - 7, y, P.navy);
  rect(g, cx - 5, 18, 3, 1, P.darkSlate);
  rect(g, cx + 3, 18, 3, 1, P.darkSlate);
  px(g, cx - 2, 5, P.darkSlate);
  px(g, cx - 1, 4, P.slate);
  for (let y = 20; y <= 33; y += 3) px(g, cx + 11, y, P.slate);

  // 흩어지는 가장자리 (프레임마다 다르게 깜빡)
  dissolve(g, w, h, { edge: 0.35, bottomFrom: 30, bottomMax: 0.9, seed: 101 + f * 17 });

  // 뒤를 감싸는 안개: 어두운 배경에서도 형체가 보이도록 아주 옅은 빛
  ditherGlow(ctx, cx, 26, 20, P.darkSlate, 0.3, 21 + f);
  ditherGlow(ctx, cx, 44, 16, P.purple, 0.45, 41 + f);
  ctx.drawImage(c, 0, 0);

  // 지직거림: 한 프레임은 몸 한 줄이 옆으로 밀린다
  if (f === 2) {
    const band = ctx.getImageData(0, 21, w, 3);
    ctx.clearRect(0, 21, w, 3);
    ctx.putImageData(band, 2, 21);
  }
  // 발밑으로 번지는 안개 알갱이
  const rand = rng(55 + f * 9);
  for (let i = 0; i < 26; i++) {
    const x = cx - 13 + Math.floor(rand() * 27);
    const y = 42 + Math.floor(rand() * 11);
    px(ctx, x, y, rand() < 0.6 ? P.ink : P.navy);
  }
}

// ── 5 · 상심이 크시겠어요: 어둠 속에서 진동하는 휴대폰, 곁을 떠다니다 멀어지는 따뜻한 빛 두 개 ──
function warmLight(ctx, x, y, r) {
  ditherGlow(ctx, x, y, r + 5, P.orange, 0.45, Math.round(x * 7 + y));
  ring(ctx, x, y, r + 1, 1, P.amber);
  disc(ctx, x, y, r, P.amber);
  disc(ctx, x, y, Math.max(0, r - 1), P.skinLight);
  px(ctx, x, y, P.white);
}

function drawCalls(ctx, f, w, h) {
  const bob = f % 2;
  ditherGlow(ctx, w / 2, h / 2, 25, P.purple, 0.35, 61 + f);
  // 버그·AI 환각·끝없는 요구사항이 하나로 뭉친 보스.
  rect(ctx, 8, 25 + bob, 32, 20, P.ink);
  rect(ctx, 11, 27 + bob, 26, 16, P.navy);
  for (const [x, y, color] of [[3, 15, P.red], [17, 7, P.purple], [31, 15, P.amber]]) {
    rect(ctx, x, y + bob, 14, 14, P.ink);
    rect(ctx, x + 2, y + 2 + bob, 10, 10, color);
    rect(ctx, x + 4, y + 5 + bob, 2, 2, P.white);
    rect(ctx, x + 8, y + 5 + bob, 2, 2, P.white);
    rect(ctx, x + 5, y + 9 + bob, 4, 1, P.ink);
  }
  rect(ctx, 18, 32 + bob, 12, 2, P.sky);
  rect(ctx, 20, 37 + bob, 8, 2, P.white);
}

const BOSSES = {
  study: () => build(48, 56, drawStudy),
  friend: () => build(36, 54, drawFriend),
  notice: () => build(56, 44, drawNotice),
  night: () => build(38, 54, drawNight),
  calls: () => build(48, 56, drawCalls),
};

const bossCache = new Map();
export function bossSprite(id) {
  if (!bossCache.has(id)) bossCache.set(id, BOSSES[id]());
  return bossCache.get(id);
}

// ── 보스 탄 ──
function frameSet(w, h, n, draw) {
  return Array.from({ length: n }, (_, f) => {
    const [c, ctx] = makeCanvas(w, h);
    draw(ctx, f, w, h);
    return c;
  });
}

const BULLETS = {
  // 빨간 채점 X
  xmark: () => frameSet(9, 9, 2, (ctx, f) => {
    const o = f; // 흔들림
    line(ctx, 1, 1 + o, 7, 7 - o, P.ink, 3);
    line(ctx, 1, 7 - o, 7, 1 + o, P.ink, 3);
    line(ctx, 1, 1 + o, 7, 7 - o, P.red, 1);
    line(ctx, 1, 7 - o, 7, 1 + o, P.red, 1);
    px(ctx, 4, 4, P.salmon);
  }),
  // 바랜 회색 농구공 (기억)
  grayball: () => frameSet(9, 9, 4, (ctx, f) => {
    disc(ctx, 4, 4, 4, P.ink);
    disc(ctx, 4, 4, 3, P.gray);
    px(ctx, 3, 2, P.lightGray);
    px(ctx, 2, 3, P.lightGray);
    const seams = [
      [[1, 4, 7, 4], [4, 1, 4, 7]],
      [[2, 2, 6, 6], [2, 6, 6, 2]],
      [[1, 3, 7, 5], [3, 7, 5, 1]],
      [[1, 5, 7, 3], [5, 7, 3, 1]],
    ][f];
    for (const [x0, y0, x1, y1] of seams) line(ctx, x0, y0, x1, y1, P.darkSlate);
    ring(ctx, 4, 4, 4, 1, P.ink);
  }),
  // 붉은 봉인이 찍힌 작은 봉투
  mail: () => frameSet(11, 8, 2, (ctx, f) => {
    rect(ctx, 0, 0, 11, 8, P.ink);
    rect(ctx, 1, 1, 9, 6, P.lightGray);
    const v = f ? 2 : 3;
    line(ctx, 1, 1, 5, v + 1, P.gray);
    line(ctx, 9, 1, 5, v + 1, P.gray);
    rect(ctx, 4, v + 1, 3, 2, P.red);
    px(ctx, 5, v + 1, P.darkRed);
  }),
  // 어두운 안개 덩어리 (불안)
  fog: () => frameSet(14, 14, 3, (ctx, f) => {
    const rand = rng(300 + f * 23);
    for (let y = 0; y < 14; y++) {
      for (let x = 0; x < 14; x++) {
        const d = Math.hypot(x - 6.5, y - 6.5) / 7;
        if (d > 1) continue;
        const r = rand();
        if (d < 0.45) px(ctx, x, y, r < 0.7 ? P.ink : P.navy);
        else if (d < 0.75) { if (r < 0.75) px(ctx, x, y, r < 0.35 ? P.purple : P.navy); }
        else if (r < 0.35 + (x + y + f) % 2 * 0.2) px(ctx, x, y, P.purple);
      }
    }
    px(ctx, 4 + (f % 2), 4, P.darkSlate);
    px(ctx, 9, 8 - (f % 2), P.darkSlate);
  }),
  // 차가운 빗방울
  rain: () => frameSet(2, 6, 1, (ctx) => {
    px(ctx, 1, 0, P.lightGray);
    px(ctx, 1, 1, P.cyan);
    rect(ctx, 0, 2, 2, 3, P.cyan);
    rect(ctx, 0, 5, 2, 1, P.sky);
  }),
  // 흰 국화 꽃잎
  petal: () => frameSet(5, 4, 2, (ctx, f) => {
    if (f === 0) {
      rect(ctx, 1, 0, 3, 1, P.white);
      rect(ctx, 0, 1, 5, 2, P.white);
      rect(ctx, 1, 3, 3, 1, P.lightGray);
    } else {
      rect(ctx, 2, 0, 1, 1, P.white);
      rect(ctx, 1, 1, 3, 2, P.white);
      rect(ctx, 2, 3, 1, 1, P.lightGray);
    }
  }),
};

const bulletCache = new Map();
function bulletSet(kind) {
  if (!bulletCache.has(kind)) bulletCache.set(kind, BULLETS[kind]());
  return bulletCache.get(kind);
}

export function bulletFrames(kind) {
  return bulletSet(kind).length;
}

export function bulletSprite(kind, frame = 0) {
  const set = bulletSet(kind);
  return set[((frame % set.length) + set.length) % set.length];
}
