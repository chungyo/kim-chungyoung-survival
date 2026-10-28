// 적 15종 도트. 시대(0~4) × 종류(basic/fast/tank) × 4방향 × 4프레임.
// 사람형은 humanoid 빌더, 물건형(학습지·전단지·문제집·소주병·맥주잔·주전자)은 각자 그리기 함수로 만든다.
// 채색만 하고 외곽선은 outlined()가 마지막에 두른다. 빛은 왼쪽 위에서 온다.

import { P, makeCanvas, mirrorX, silhouette, outlined } from './pixel.js';

const px = (ctx, x, y, c) => {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, 1, 1);
};
const box = (ctx, x, y, w, h, c) => {
  if (w <= 0 || h <= 0) return;
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
};
const clear = (ctx, x, y) => ctx.clearRect(x, y, 1, 1);

// 같은 좌표면 프레임이 바뀌어도 무늬가 그대로인 해시 (위장 무늬용)
const hash = (x, y) => {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
  return (h >>> 0) / 4294967296;
};

// ── 공통: 4방향 × 4프레임 세트 만들기 ──
// frame 0·2 = 다리 모은 자세, 1·3 = 다리 벌린 자세 (서로 반대 다리)
function build(W, H, draw) {
  const make = (dir, f) => {
    const [c, ctx] = makeCanvas(W, H);
    draw(ctx, dir, f);
    return outlined(c);
  };
  const frames = { down: [], up: [], left: [], right: [] };
  for (let f = 0; f < 4; f++) {
    frames.down.push(make('down', f));
    frames.up.push(make('up', f));
    const left = make('left', f);
    frames.left.push(left);
    frames.right.push(mirrorX(left));
  }
  const white = {};
  for (const [dir, list] of Object.entries(frames)) white[dir] = list.map((c) => silhouette(c, P.white));
  const w = frames.down[0].width, h = frames.down[0].height;
  return { w, h, footY: h - 1, frames, white };
}

// ════════════════════════════════════════════
// 사람형
// ════════════════════════════════════════════

const HUMAN_DEFAULTS = {
  armW: 2, topPad: 0, hairStyle: 'short', face: 'neutral',
  skin: P.skin, skinShade: P.skinMid, hair: P.navy, hairLight: P.darkSlate,
  shoe: P.deepBrown, shoeLight: P.darkBrown,
};

function humanoid(spec) {
  const s = { ...HUMAN_DEFAULTS, ...spec };
  s.legW ??= Math.floor(s.torsoW / 2) - 1;
  const W = s.W;
  const H = s.topPad + 1 + s.headH + s.torsoH + s.legH;
  return build(W, H, (ctx, dir, f) => drawHuman(ctx, s, dir, f, W, H));
}

function drawHuman(ctx, s, dir, f, W, H) {
  const sw = f === 1 ? 1 : f === 3 ? -1 : 0;
  const bob = f % 2;
  const g = {
    W, floor: H - 1, sw,
    yHead: s.topPad + bob + (s.slump ? 1 : 0),
    yTorso: s.topPad + bob + s.headH,
    yLegs: s.topPad + bob + s.headH + s.torsoH,
    float: f >= 2 ? 1 : 0,
  };
  if (dir === 'left') sideHuman(ctx, s, g);
  else frontBackHuman(ctx, s, dir === 'down', g);
  if (s.bubble) bubble(ctx, W - 9, g.float);
  if (s.calendar) calendar(ctx, Math.round(W / 2) - 4, g.float);
}

// 사람 몸통 위 위장 무늬
function camo(ctx, x, y, w, h) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      const r = hash(xx, yy);
      if (r < 0.16) px(ctx, xx, yy, P.darkGreen);
      else if (r < 0.26) px(ctx, xx, yy, P.deepBrown);
      else if (r < 0.34) px(ctx, xx, yy, P.green);
    }
  }
}

function legFront(ctx, s, x, yTop, yBottom, shade) {
  const h = yBottom - yTop + 1;
  const shoeH = s.torsoW >= 12 ? 2 : 1;
  if (s.shorts) {
    box(ctx, x, yTop, s.legW, 2, shade ? s.bottomShade : s.bottom);
    box(ctx, x, yTop + 2, s.legW, h - 2 - shoeH, shade ? s.skinShade : s.skin);
  } else {
    box(ctx, x, yTop, s.legW, h - shoeH, shade ? s.bottomShade : s.bottom);
    if (s.camo) camo(ctx, x, yTop, s.legW, h - shoeH);
    if (s.stripe) box(ctx, shade ? x + s.legW - 1 : x, yTop, 1, h - shoeH, P.white);
  }
  box(ctx, x, yBottom - shoeH + 1, s.legW, shoeH, s.shoe);
  if (!shade) px(ctx, x, yBottom - shoeH + 1, s.shoeLight);
}

function armFront(ctx, s, x, y, len, shade) {
  const sleeve = shade ? s.topShade : s.top;
  const handH = s.armW >= 3 ? 2 : 1;
  if (s.shortSleeve) {
    box(ctx, x, y, s.armW, 2, sleeve);
    box(ctx, x, y + 2, s.armW, len - 2, shade ? s.skinShade : s.skin);
  } else if (s.rolled) {
    box(ctx, x, y, s.armW, Math.ceil(len / 2), sleeve);
    box(ctx, x, y + Math.ceil(len / 2), s.armW, len - Math.ceil(len / 2), shade ? s.skinShade : s.skin);
  } else {
    box(ctx, x, y, s.armW, len - handH, sleeve);
    if (s.camo) camo(ctx, x, y, s.armW, len - handH);
    if (s.stripe) box(ctx, shade ? x + s.armW - 1 : x, y, 1, len - handH, P.white);
    box(ctx, x, y + len - handH, s.armW, handH, shade ? s.skinShade : s.skin);
  }
}

function frontBackHuman(ctx, s, front, g) {
  const { W, floor, yHead, yTorso, yLegs, sw } = g;
  const tw = s.torsoW, th = s.torsoH;
  const tx = Math.round((W - tw) / 2);
  const lx = tx + 1, rx = tx + tw - 1 - s.legW;

  // 앞모습에서 배낭 윗부분이 어깨 뒤로 보인다
  if (s.ruck && front) {
    box(ctx, tx - 1, yTorso - 4, tw + 2, 5, P.darkGreen);
    box(ctx, tx, yTorso - 5, tw, 2, P.brown);
    box(ctx, tx, yTorso - 4, tw, 1, P.darkBrown);
  }

  // 다리 (걸을 때 한쪽을 1px 든다)
  legFront(ctx, s, lx, yLegs, floor - (sw > 0 ? 1 : 0), false);
  legFront(ctx, s, rx, yLegs, floor - (sw < 0 ? 1 : 0), true);

  // 몸통
  box(ctx, tx, yTorso, tw, th, s.top);
  if (s.camo) camo(ctx, tx, yTorso, tw, th);
  box(ctx, tx, yTorso, 1, th, s.topLight);
  box(ctx, tx + tw - 1, yTorso, 1, th, s.topShade);
  clear(ctx, tx, yTorso);
  clear(ctx, tx + tw - 1, yTorso);
  if (s.belt) box(ctx, tx, yTorso + th - 1, tw, 1, s.belt);
  if (s.stripe) {
    box(ctx, tx + 1, yTorso + 1, 1, th - 1, P.white);
    box(ctx, tx + tw - 2, yTorso + 1, 1, th - 1, P.white);
  }

  const mid = tx + tw / 2; // 몸 가운데 (두 픽셀 사이)
  if (front) {
    if (s.collar) {
      px(ctx, mid - 2, yTorso, P.white);
      px(ctx, mid + 1, yTorso, P.white);
      px(ctx, mid - 1, yTorso, P.white);
      px(ctx, mid, yTorso, P.white);
      px(ctx, mid - 1, yTorso + 1, P.white);
      px(ctx, mid, yTorso + 1, P.white);
    }
    if (s.tie) {
      px(ctx, mid - 1, yTorso + 1, s.tie);
      px(ctx, mid, yTorso + 1, s.tie);
      box(ctx, mid - 1 + (tw >= 12 ? 0 : 0), yTorso + 2, tw >= 10 ? 2 : 1, th - 3, s.tie);
    }
    if (s.lanyard) {
      px(ctx, mid - 3, yTorso, P.sky);
      px(ctx, mid + 2, yTorso, P.sky);
      px(ctx, mid - 3, yTorso + 1, P.sky);
      px(ctx, mid + 2, yTorso + 1, P.sky);
      px(ctx, mid - 2, yTorso + 2, P.sky);
      px(ctx, mid + 1, yTorso + 2, P.sky);
      box(ctx, mid - 2, yTorso + 3, 2, 2, P.white);
      px(ctx, mid - 2, yTorso + 3, P.sky);
    }
    if (s.ruck) {
      box(ctx, tx + 1, yTorso, 1, th - 1, P.darkGreen);
      box(ctx, tx + tw - 2, yTorso, 1, th - 1, P.darkGreen);
      box(ctx, tx + 1, yTorso + 3, tw - 2, 1, P.darkGreen);
    }
    if (s.buttons) for (let i = 2; i < th - 1; i += 2) px(ctx, mid - 1, yTorso + i, P.amber);
  }

  // 팔 (앞뒤로 흔들리는 걸 길이 차이로 표현)
  const amp = s.run ? 2 : 1;
  const ay = yTorso + 1;
  const lenL = th - (sw > 0 ? amp : 0) + (sw < 0 ? 1 : 0);
  const lenR = th - (sw < 0 ? amp : 0) + (sw > 0 ? 1 : 0);
  // 휴대폰 든 팔: 앞모습은 화면 오른쪽, 뒷모습은 화면 왼쪽
  if (s.phone && front) raisedArm(ctx, s, tx + tw, ay, true);
  else armFront(ctx, s, tx + tw, ay, lenR, true);
  if (s.phone && !front) raisedArm(ctx, s, tx - s.armW, ay, false);
  else armFront(ctx, s, tx - s.armW, ay, lenL, false);

  // 머리
  const hx = Math.round((W - s.headW) / 2);
  if (front) headFront(ctx, s, hx, yHead);
  else headBack(ctx, s, hx, yHead);

  // 배낭 (뒷모습에서는 몸통 대부분을 덮는다)
  if (s.ruck && !front) {
    box(ctx, tx - 1, yTorso - 3, tw + 2, th + 3, P.midGreen);
    box(ctx, tx - 1, yTorso - 3, 1, th + 3, P.green);
    box(ctx, tx + tw, yTorso - 3, 1, th + 3, P.darkGreen);
    box(ctx, tx - 1, yTorso - 5, tw + 2, 2, P.brown);
    box(ctx, tx - 1, yTorso - 4, tw + 2, 1, P.darkBrown);
    box(ctx, tx + 1, yTorso + 1, tw - 2, 3, P.darkGreen);
    box(ctx, tx + 2, yTorso + 1, tw - 4, 1, P.green);
    px(ctx, Math.floor(mid) - 1, yTorso + 2, P.lightGray);
    px(ctx, Math.floor(mid), yTorso + 2, P.lightGray);
  }

  if (s.tray && front) trayFront(ctx, tx - s.armW - 1, yTorso + th - 3, tw + s.armW * 2 + 2, true);
  if (s.tray && !front) {
    box(ctx, tx - s.armW - 1, yTorso + th - 3, 1, 2, P.lightGray);
    box(ctx, tx + tw + s.armW, yTorso + th - 3, 1, 2, P.gray);
  }
  if (s.laptop && front) {
    box(ctx, tx + 1, yTorso + 2, tw - 2, 4, P.darkSlate);
    box(ctx, tx + 1, yTorso + 2, tw - 2, 1, P.slate);
    box(ctx, tx + tw - 2, yTorso + 3, 1, 3, P.navy);
    px(ctx, Math.floor(mid) - 1, yTorso + 4, P.lightGray);
    px(ctx, Math.floor(mid), yTorso + 4, P.lightGray);
    px(ctx, tx, yTorso + 4, s.skin);
    px(ctx, tx + tw - 1, yTorso + 4, s.skinShade);
  }
}

function raisedArm(ctx, s, x, yShoulder, shade) {
  // 팔을 머리 옆으로 번쩍 들고 휴대폰을 흔든다
  const top = yShoulder - 5;
  box(ctx, x, top + 2, s.armW, 6, shade ? s.topShade : s.top);
  box(ctx, x, top + 1, s.armW, 1, s.skin);
  box(ctx, x, top - 2, 2, 3, P.navy);
  px(ctx, x, top - 2, P.sky);
  px(ctx, x + 1, top - 1, P.cyan);
}

function trayFront(ctx, x, y, w, front) {
  box(ctx, x, y, w, 2, P.lightGray);
  box(ctx, x, y + 1, w, 1, P.gray);
  if (!front) return;
  box(ctx, x + 2, y - 2, 3, 2, P.white);
  px(ctx, x + 3, y - 3, P.white);
  box(ctx, x + 6, y - 1, 2, 1, P.red);
  px(ctx, x + 6, y - 2, P.darkRed);
  box(ctx, x + w - 5, y - 1, 3, 1, P.green);
  px(ctx, x + w - 4, y - 2, P.midGreen);
}

function hairFront(ctx, s, x, y, w) {
  const hair = s.hair, light = s.hairLight;
  switch (s.hairStyle) {
    case 'buzz':
      box(ctx, x, y, w, 2, hair);
      for (let i = 1; i < w - 1; i += 2) px(ctx, x + i, y + 2, P.skinDark);
      px(ctx, x + 2, y, light);
      break;
    case 'spiky':
      box(ctx, x, y, w, 3, hair);
      for (let i = 0; i < w; i += 2) px(ctx, x + i, y - 1, hair);
      px(ctx, x + 1, y - 2, hair);
      px(ctx, x + w - 2, y - 2, hair);
      box(ctx, x, y + 3, 1, 2, hair);
      box(ctx, x + w - 1, y + 3, 1, 2, hair);
      px(ctx, x + 2, y, light);
      px(ctx, x + 3, y + 1, light);
      break;
    case 'neat':
      box(ctx, x, y, w, 2, hair);
      box(ctx, x, y + 2, Math.ceil(w / 2) + 1, 1, hair);
      box(ctx, x, y + 3, 1, 2, hair);
      box(ctx, x + w - 1, y + 2, 1, 3, hair);
      px(ctx, x + 2, y, light);
      px(ctx, x + 3, y, light);
      break;
    case 'messy':
      box(ctx, x, y, w, 2, hair);
      for (let i = 0; i < w; i++) if (i % 3 !== 1) px(ctx, x + i, y + 2, hair);
      px(ctx, x - 1, y + 1, hair);
      px(ctx, x + w, y + 1, hair);
      px(ctx, x + 1, y - 1, hair);
      px(ctx, x + w - 3, y - 1, hair);
      box(ctx, x, y + 3, 1, 2, hair);
      box(ctx, x + w - 1, y + 3, 1, 2, hair);
      px(ctx, x + 2, y, light);
      break;
    default: // short
      box(ctx, x, y, w, 2, hair);
      for (let i = 0; i < w; i++) if (i % 3 !== 2) px(ctx, x + i, y + 2, hair);
      box(ctx, x, y + 3, 1, 2, hair);
      box(ctx, x + w - 1, y + 3, 1, 2, hair);
      px(ctx, x + 2, y, light);
      px(ctx, x + 3, y, light);
  }
}

function helmetFront(ctx, x, y, w) {
  box(ctx, x - 1, y, w + 2, 4, P.midGreen);
  clear(ctx, x - 1, y);
  clear(ctx, x + w, y);
  box(ctx, x, y - 1, w, 1, P.midGreen);
  px(ctx, x, y - 1, P.green);
  box(ctx, x + 1, y, 2, 1, P.green);
  box(ctx, x - 1, y + 3, w + 2, 1, P.darkGreen);
  box(ctx, x + w, y + 1, 1, 2, P.darkGreen);
  for (let i = 0; i < w; i += 3) px(ctx, x + i + 1, y + 2, P.darkGreen);
}

function headFront(ctx, s, x, y) {
  const w = s.headW, h = s.headH;
  const skin = s.faceSkin ?? s.skin;
  box(ctx, x, y, w, h, skin);
  box(ctx, x + w - 1, y + 2, 1, h - 2, s.faceShade ?? s.skinShade);
  box(ctx, x + 1, y + h - 1, w - 2, 1, s.faceShade ?? s.skinShade);
  if (s.helmet) helmetFront(ctx, x, y, w);
  else hairFront(ctx, s, x, y, w);
  clear(ctx, x, y + h - 1);
  clear(ctx, x + w - 1, y + h - 1);
  if (!s.helmet) {
    clear(ctx, x, y);
    clear(ctx, x + w - 1, y);
  }

  // 표정
  const eL = x + Math.floor(w / 2) - 2, eR = x + Math.ceil(w / 2) + 1;
  const ey = y + h - 4;
  const mx = x + Math.floor(w / 2) - (w % 2 ? 0 : 1);
  const mw = w % 2 ? 1 : 2;
  const my = y + h - 2;
  switch (s.face) {
    case 'gloomy':
      box(ctx, eL - 1, ey + 1, 2, 1, P.ink);
      box(ctx, eR, ey + 1, 2, 1, P.ink);
      px(ctx, eL - 1, ey + 2, P.purple);
      px(ctx, eR + 1, ey + 2, P.purple);
      for (let i = 1; i < w - 1; i += 2) px(ctx, x + i, y + 3, P.slate);
      box(ctx, mx, my, mw, 1, P.darkBrown);
      break;
    case 'angry':
      px(ctx, eL - 1, ey - 1, P.ink);
      px(ctx, eL, ey, P.ink);
      px(ctx, eR + 1, ey - 1, P.ink);
      px(ctx, eR, ey, P.ink);
      px(ctx, eL, ey + 1, P.ink);
      px(ctx, eR, ey + 1, P.ink);
      box(ctx, mx, my - 1, mw, 2, P.ink);
      box(ctx, mx, my, mw, 1, P.darkRed);
      px(ctx, x + w - 2, y + 2, P.red);
      px(ctx, x + w - 3, y + 3, P.red);
      px(ctx, x + w - 1, y + 3, P.red);
      break;
    case 'tired':
      box(ctx, eL - 1, ey + 1, 2, 1, P.ink);
      box(ctx, eR, ey + 1, 2, 1, P.ink);
      px(ctx, eL - 1, ey + 2, P.purple);
      px(ctx, eL, ey + 2, P.pink);
      px(ctx, eR, ey + 2, P.pink);
      px(ctx, eR + 1, ey + 2, P.purple);
      box(ctx, mx, my, mw, 1, P.skinDark);
      break;
    case 'strained':
      px(ctx, eL, ey, P.ink);
      px(ctx, eL, ey + 1, P.ink);
      px(ctx, eR, ey, P.ink);
      px(ctx, eR, ey + 1, P.ink);
      box(ctx, mx, my, mw, 1, P.ink);
      px(ctx, x + w, ey - 1, P.cyan);
      px(ctx, x + w, ey, P.sky);
      break;
    case 'shout':
      px(ctx, eL, ey, P.ink);
      px(ctx, eL, ey + 1, P.ink);
      px(ctx, eR, ey, P.ink);
      px(ctx, eR, ey + 1, P.ink);
      box(ctx, mx, my - 1, Math.max(2, mw), 2, P.ink);
      px(ctx, mx, my, P.darkRed);
      break;
    case 'smug':
      box(ctx, eL - 1, ey + 1, 2, 1, P.ink);
      box(ctx, eR, ey + 1, 2, 1, P.ink);
      px(ctx, eL - 1, ey - 1, P.ink);
      px(ctx, eR + 1, ey - 1, P.ink);
      box(ctx, mx, my, mw + 1, 1, P.ink);
      px(ctx, mx + mw + 1, my - 1, P.ink);
      break;
    default:
      px(ctx, eL, ey, P.ink);
      px(ctx, eL, ey + 1, P.ink);
      px(ctx, eR, ey, P.ink);
      px(ctx, eR, ey + 1, P.ink);
      box(ctx, mx, my, mw, 1, P.skinDark);
  }
}

function headBack(ctx, s, x, y) {
  const w = s.headW, h = s.headH;
  box(ctx, x, y, w, h, s.skin);
  if (s.helmet) {
    box(ctx, x + 1, y + 4, w - 2, h - 4, s.skinShade);
    box(ctx, x + 2, y + h - 1, w - 4, 1, s.skin);
    helmetFront(ctx, x, y, w);
    box(ctx, x - 1, y + 3, w + 2, 1, P.darkGreen);
  } else if (s.hairStyle === 'buzz') {
    box(ctx, x, y, w, h - 2, s.hair);
    for (let i = 0; i < w; i += 2) px(ctx, x + i, y + h - 2, s.hair);
  } else {
    box(ctx, x, y, w, h - 1, s.hair);
    box(ctx, x + 1, y + 1, 1, 2, s.hairLight);
    if (s.hairStyle === 'spiky') for (let i = 0; i < w; i += 2) px(ctx, x + i, y - 1, s.hair);
    if (s.hairStyle === 'messy') {
      px(ctx, x + 1, y - 1, s.hair);
      px(ctx, x - 1, y + 1, s.hair);
      px(ctx, x + w, y + 1, s.hair);
    }
    box(ctx, x + 2, y + h - 1, w - 4, 1, s.skinShade);
    px(ctx, x - 1 + (w > 8 ? 0 : 0), y + Math.floor(h / 2), s.skin);
    px(ctx, x + w, y + Math.floor(h / 2), s.skinShade);
  }
  if (!s.helmet) {
    clear(ctx, x, y);
    clear(ctx, x + w - 1, y);
  }
  clear(ctx, x, y + h - 1);
  clear(ctx, x + w - 1, y + h - 1);
}

// ── 옆모습 (왼쪽을 본다. 오른쪽은 좌우 반전) ──

function legSide(ctx, s, x, yTop, yBottom, w, stride, back) {
  const span = Math.max(1, yBottom - yTop);
  const shoeH = s.torsoW >= 12 ? 2 : 1;
  for (let y = yTop; y <= yBottom; y++) {
    const off = Math.round((stride * (y - yTop)) / span);
    const isShoe = y > yBottom - shoeH;
    let col;
    if (isShoe) col = back ? s.shoe : s.shoeLight;
    else if (s.shorts) col = y < yTop + 2 ? (back ? s.bottomShade : s.bottom) : back ? s.skinShade : s.skin;
    else col = back ? s.bottomShade : s.bottom;
    box(ctx, x + off - (isShoe ? 1 : 0), y, w + (isShoe ? 1 : 0), 1, col);
    if (!isShoe && s.camo && !back) camo(ctx, x + off, y, w, 1);
    if (!isShoe && s.stripe && !back) px(ctx, x + off + w - 1, y, P.white);
  }
}

function sideHuman(ctx, s, g) {
  const { W, floor, yHead, yTorso, yLegs, sw } = g;
  const tw = Math.max(4, s.torsoW - 2), th = s.torsoH;
  const tx = Math.round((W - tw) / 2);
  const lean = s.run ? -1 : 0;
  const legW = Math.max(2, s.legW - (s.legW > 3 ? 1 : 0));
  const baseX = tx + Math.round((tw - legW) / 2);
  const stride = (s.run ? 3 : 2) * sw;

  // 뒷다리 → (배낭) → 몸통 → 앞다리 → 팔 → 머리
  legSide(ctx, s, baseX, yLegs, floor - (sw !== 0 && s.run ? 1 : 0), legW, stride, true);
  if (s.ruck) {
    box(ctx, tx + tw - 1, yTorso - 3, 5, th + 2, P.midGreen);
    box(ctx, tx + tw + 3, yTorso - 3, 1, th + 2, P.darkGreen);
    box(ctx, tx + tw - 1, yTorso - 5, 5, 2, P.brown);
    box(ctx, tx + tw - 1, yTorso - 4, 5, 1, P.darkBrown);
    box(ctx, tx + tw, yTorso + 1, 3, 3, P.darkGreen);
    px(ctx, tx + tw, yTorso + 1, P.green);
  }
  box(ctx, tx + lean, yTorso, tw, th, s.top);
  if (s.camo) camo(ctx, tx + lean, yTorso, tw, th);
  box(ctx, tx + lean, yTorso, 1, th, s.topLight);
  box(ctx, tx + lean + tw - 1, yTorso, 1, th, s.topShade);
  clear(ctx, tx + lean + tw - 1, yTorso);
  if (s.belt) box(ctx, tx + lean, yTorso + th - 1, tw, 1, s.belt);
  if (s.tie) box(ctx, tx + lean, yTorso + 1, 1, th - 2, s.tie);
  if (s.collar) px(ctx, tx + lean, yTorso, P.white);
  if (s.lanyard) px(ctx, tx + lean + 1, yTorso + 1, P.sky);
  legSide(ctx, s, baseX, yLegs, floor, legW, -stride, false);

  // 팔
  const ax = tx + lean + Math.floor(tw / 2) - 1;
  const ay = yTorso + 1;
  const len = th;
  const handH = s.armW >= 3 ? 2 : 1;
  if (s.phone) {
    box(ctx, ax - 1, ay - 1, s.armW, 2, s.top);
    box(ctx, ax - 3, ay - 3, s.armW, 3, s.top);
    px(ctx, ax - 4, ay - 4, s.skin);
    box(ctx, ax - 5, ay - 7, 2, 3, P.navy);
    px(ctx, ax - 5, ay - 7, P.cyan);
  } else if (s.run) {
    // 구부린 팔: 위팔은 아래로, 아래팔은 앞이나 뒤로
    box(ctx, ax, ay, s.armW, 3, s.top);
    const fx = sw > 0 ? ax + 2 : sw < 0 ? ax - 3 : ax - 1;
    box(ctx, Math.min(ax, fx), ay + 3, Math.abs(fx - ax) + s.armW, 1, s.shortSleeve || s.rolled ? s.skin : s.top);
    px(ctx, fx + (sw > 0 ? s.armW : -1) + (sw === 0 ? 0 : 0), ay + 3, s.skin);
  } else {
    const swing = -2 * sw;
    for (let i = 0; i < len; i++) {
      const off = Math.round((swing * i) / (len - 1));
      const isHand = i >= len - handH;
      const lower = i >= 2;
      let col = s.top;
      if (isHand) col = s.skin;
      else if ((s.shortSleeve && lower) || (s.rolled && i >= Math.ceil(len / 2))) col = s.skin;
      box(ctx, ax + off, ay + i, s.armW, 1, col);
      if (!isHand && col === s.top && s.camo) camo(ctx, ax + off, ay + i, s.armW, 1);
      if (!isHand && col === s.top && s.stripe) px(ctx, ax + off, ay + i, P.white);
    }
  }
  if (s.laptop) {
    box(ctx, ax - 1, yTorso + 2, 1, 5, P.navy);
    box(ctx, ax - 2, yTorso + 2, 1, 5, P.darkSlate);
  }
  if (s.tray) {
    const ty = yTorso + th - 3;
    box(ctx, tx + lean - 6, ty, 9, 2, P.lightGray);
    box(ctx, tx + lean - 6, ty + 1, 9, 1, P.gray);
    box(ctx, tx + lean - 5, ty - 2, 2, 2, P.white);
    px(ctx, tx + lean - 2, ty - 1, P.red);
    px(ctx, tx + lean, ty - 1, P.green);
  }

  headSide(ctx, s, Math.round((W - (s.headW - 1)) / 2) + lean, yHead);
}

function headSide(ctx, s, x, y) {
  const w = s.headW - 1, h = s.headH;
  const skin = s.faceSkin ?? s.skin;
  box(ctx, x, y, w, h, skin);
  box(ctx, x + 1, y + h - 1, w - 2, 1, s.faceShade ?? s.skinShade);
  const ey = y + h - 4;
  if (s.helmet) {
    box(ctx, x - 1, y, w + 2, 4, P.midGreen);
    box(ctx, x, y - 1, w, 1, P.midGreen);
    box(ctx, x + 1, y, 2, 1, P.green);
    box(ctx, x - 2, y + 3, w + 3, 1, P.darkGreen);
    box(ctx, x + w, y + 1, 1, 2, P.darkGreen);
    px(ctx, x + 3, y + 2, P.darkGreen);
    clear(ctx, x - 1, y);
    clear(ctx, x + w, y);
  } else {
    const hair = s.hair;
    box(ctx, x, y, w, 2, hair);
    box(ctx, x + w - 3, y, 3, h - 2, hair);
    if (s.hairStyle === 'buzz') {
      px(ctx, x + 2, y + 2, P.skinDark);
    } else {
      box(ctx, x, y + 2, 2, 1, hair);
      px(ctx, x + 3, y + 2, hair);
      if (s.hairStyle === 'spiky') {
        for (let i = 1; i < w; i += 2) px(ctx, x + i, y - 1, hair);
        px(ctx, x + w, y + 1, hair);
      }
      if (s.hairStyle === 'messy') {
        px(ctx, x - 1, y + 1, hair);
        px(ctx, x + 2, y - 1, hair);
        px(ctx, x + w, y + 2, hair);
      }
    }
    px(ctx, x + 2, y, s.hairLight);
    clear(ctx, x, y);
    clear(ctx, x + w - 1, y);
  }
  // 귀
  px(ctx, x + w - 4, ey, s.skinShade);
  px(ctx, x + w - 4, ey + 1, s.skinShade);
  // 코 (앞으로 1px 튀어나온다)
  px(ctx, x - 1, ey + 1, skin);
  clear(ctx, x + w - 1, y + h - 1);
  clear(ctx, x + w - 2, y + h - 1);
  clear(ctx, x, y + h - 1);

  const ex = x + 1;
  switch (s.face) {
    case 'gloomy':
      px(ctx, ex, ey + 1, P.ink);
      px(ctx, ex, ey + 2, P.purple);
      px(ctx, ex + 1, y + 3, P.slate);
      px(ctx, ex + 3, y + 3, P.slate);
      px(ctx, x, y + h - 2, P.ink);
      break;
    case 'angry':
      px(ctx, ex + 1, ey - 1, P.ink);
      px(ctx, ex, ey, P.ink);
      px(ctx, ex, ey + 1, P.ink);
      px(ctx, x, y + h - 2, P.darkRed);
      px(ctx, x + 1, y + h - 2, P.ink);
      px(ctx, x + w - 2, y + 3, P.red);
      break;
    case 'tired':
      px(ctx, ex, ey + 1, P.ink);
      px(ctx, ex + 1, ey + 1, P.ink);
      px(ctx, ex, ey + 2, P.pink);
      px(ctx, x, y + h - 2, P.skinDark);
      break;
    case 'strained':
      px(ctx, ex, ey, P.ink);
      px(ctx, ex, ey + 1, P.ink);
      px(ctx, x, y + h - 2, P.ink);
      px(ctx, x + w - 2, ey - 1, P.cyan);
      break;
    case 'shout':
      px(ctx, ex, ey, P.ink);
      px(ctx, ex, ey + 1, P.ink);
      px(ctx, x, y + h - 3, P.ink);
      px(ctx, x, y + h - 2, P.darkRed);
      break;
    case 'smug':
      px(ctx, ex, ey + 1, P.ink);
      px(ctx, ex + 1, ey + 1, P.ink);
      px(ctx, ex + 1, ey - 1, P.ink);
      px(ctx, x, y + h - 2, P.ink);
      break;
    default:
      px(ctx, ex, ey, P.ink);
      px(ctx, ex, ey + 1, P.ink);
      px(ctx, x, y + h - 2, P.skinDark);
  }
}

// 머리 위에 뜨는 말풍선 "!" (오늘까지 되죠?)
function bubble(ctx, x, lift) {
  const y = 1 - lift;
  box(ctx, x, y, 8, 6, P.white);
  clear(ctx, x, y);
  clear(ctx, x + 7, y);
  clear(ctx, x, y + 5);
  clear(ctx, x + 7, y + 5);
  box(ctx, x + 1, y + 5, 6, 1, P.lightGray);
  px(ctx, x + 2, y + 6, P.white);
  px(ctx, x + 1, y + 7, P.white);
  box(ctx, x + 3, y + 1, 2, 2, P.red);
  px(ctx, x + 3, y + 4, P.red);
  px(ctx, x + 4, y + 4, P.red);
  px(ctx, x + 4, y + 3, P.darkRed);
}

// 머리 위에 뜨는 달력 (회의 가능하세요?)
function calendar(ctx, x, lift) {
  const y = 2 - lift;
  box(ctx, x, y, 8, 7, P.white);
  box(ctx, x, y, 8, 2, P.red);
  box(ctx, x, y + 1, 8, 1, P.darkRed);
  px(ctx, x + 2, y - 1, P.lightGray);
  px(ctx, x + 5, y - 1, P.lightGray);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) px(ctx, x + 1 + c * 2, y + 3 + r * 2, P.gray);
  px(ctx, x + 5, y + 5, P.red);
  box(ctx, x, y + 6, 8, 1, P.lightGray);
}

// ════════════════════════════════════════════
// 물건형 몬스터
// ════════════════════════════════════════════

// 작은 발: 걸음마다 한쪽씩 든다
function feet(ctx, xL, xR, y, f, col = P.darkSlate) {
  const liftL = f === 1 ? 1 : 0, liftR = f === 3 ? 1 : 0;
  box(ctx, xL, y - liftL, 2, 1 + liftL, col);
  box(ctx, xR, y - liftR, 2, 1 + liftR, col);
}

// 밀린 학습지: 하얀 문제지에 빨간 채점 자국, 펄럭이며 걷는다
function stickFeet(ctx, xL, xR, yTop, yFoot, f) {
  const liftL = f === 1 ? 1 : 0, liftR = f === 3 ? 1 : 0;
  box(ctx, xL, yTop, 1, yFoot - yTop - liftL, P.darkSlate);
  box(ctx, xR, yTop, 1, yFoot - yTop - liftR, P.darkSlate);
  box(ctx, xL - 1, yFoot - liftL, 2, 1, P.navy);
  box(ctx, xR, yFoot - liftR, 2, 1, P.navy);
}

function drawWorksheet(ctx, dir, f) {
  const hop = f % 2;
  const y0 = 1 - hop;
  const wave = f === 1 ? 1 : f === 3 ? -1 : 0;
  const o = (r) => (r < 3 ? wave : 0);
  if (dir === 'left') {
    const x = 3;
    for (let r = 0; r < 12; r++) {
      box(ctx, x + o(r), y0 + r, 6, 1, P.white);
      px(ctx, x + o(r) + 5, y0 + r, P.lightGray);
    }
    box(ctx, x + 1, y0 + 9, 3, 1, P.lightGray);
    box(ctx, x + 1, y0 + 5, 1, 2, P.ink);
    px(ctx, x, y0 + 8, P.ink);
    px(ctx, x + 3 + o(1), y0 + 1, P.red);
    px(ctx, x + 4 + o(2), y0 + 2, P.red);
    stickFeet(ctx, x + 2, x + 4, y0 + 12, 14, f);
    return;
  }
  const x = 1;
  for (let r = 0; r < 12; r++) {
    box(ctx, x + o(r), y0 + r, 10, 1, P.white);
    px(ctx, x + o(r) + 9, y0 + r, P.lightGray);
  }
  box(ctx, x, y0 + 11, 10, 1, P.lightGray);
  // 접힌 모서리
  clear(ctx, x + 9 + wave, y0);
  px(ctx, x + 8 + wave, y0, P.lightGray);
  px(ctx, x + 8 + wave, y0 + 1, P.gray);
  if (dir === 'down') {
    // 이름 칸, 빨간 동그라미 점수
    box(ctx, x + 1 + o(1), y0 + 1, 3, 1, P.gray);
    px(ctx, x + 6 + o(1), y0 + 1, P.red);
    px(ctx, x + 5 + o(2), y0 + 2, P.red);
    px(ctx, x + 7 + o(2), y0 + 2, P.red);
    px(ctx, x + 6, y0 + 3, P.red);
    // 질린 얼굴
    box(ctx, x + 2, y0 + 5, 1, 2, P.ink);
    box(ctx, x + 6, y0 + 5, 1, 2, P.ink);
    box(ctx, x + 3, y0 + 8, 3, 1, P.ink);
    px(ctx, x + 2, y0 + 9, P.ink);
    px(ctx, x + 6, y0 + 9, P.ink);
    // 빨간 X
    px(ctx, x + 7, y0 + 8, P.red);
    px(ctx, x + 8, y0 + 9, P.red);
    px(ctx, x + 7, y0 + 10, P.red);
    px(ctx, x + 8, y0 + 8, P.red);
    px(ctx, x + 7, y0 + 9, P.red);
    box(ctx, x + 1, y0 + 10, 4, 1, P.lightGray);
  } else {
    // 뒷면: 스테이플러 자국과 비치는 줄
    px(ctx, x + 1, y0 + 1, P.gray);
    px(ctx, x + 2, y0 + 1, P.gray);
    box(ctx, x + 2, y0 + 5, 6, 1, P.lightGray);
    box(ctx, x + 2, y0 + 8, 4, 1, P.lightGray);
  }
  stickFeet(ctx, x + 3, x + 6, y0 + 12, 14, f);
}

// 학원 전단지: 형광 띠가 있는 전단지가 새처럼 날갯짓한다 (발 없음, 위아래로 둥실)
function drawFlyer(ctx, dir, f) {
  const flap = [0, 1, 2, 1][f]; // 0 위, 1 가운데, 2 아래
  const y0 = 3 + (f === 2 ? 1 : 0);
  if (dir === 'left') {
    // 옆모습: 앞으로 기울어 날아가는 전단지, 뒤쪽 날개가 펄럭인다
    const wing = flap === 0 ? [-3, -2, -1] : flap === 1 ? [2, 3, 4] : [6, 7, 8];
    wing.forEach((r, i) => {
      box(ctx, 8 + i, y0 + r, 5 - i, 1, P.lightGray);
      px(ctx, 8 + i, y0 + r, i === 0 ? P.white : P.lightGray);
    });
    for (let r = 0; r < 8; r++) {
      const xs = 3 + Math.floor(r / 3);
      box(ctx, xs, y0 + r, 6, 1, P.white);
      px(ctx, xs + 5, y0 + r, P.lightGray);
    }
    box(ctx, 3, y0, 6, 2, P.hotPink);
    box(ctx, 4, y0 + 1, 4, 1, P.amber);
    px(ctx, 4, y0 + 3, P.ink);
    px(ctx, 4, y0 + 4, P.ink);
    box(ctx, 6, y0 + 5, 2, 1, P.lightGray);
    box(ctx, 5, y0 + 6, 3, 1, P.sky);
    return;
  }
  const cx = 5;
  box(ctx, cx, y0, 6, 8, P.white);
  box(ctx, cx + 5, y0, 1, 8, P.lightGray);
  const front = dir === 'down';
  box(ctx, cx, y0, 6, 2, front ? P.hotPink : P.lightGray);
  if (front) {
    box(ctx, cx + 1, y0 + 1, 4, 1, P.amber);
    px(ctx, cx + 1, y0 + 3, P.ink);
    px(ctx, cx + 4, y0 + 3, P.ink);
    box(ctx, cx + 1, y0 + 5, 4, 1, P.lightGray);
    box(ctx, cx + 1, y0 + 6, 3, 1, P.sky);
  } else {
    box(ctx, cx + 1, y0 + 4, 4, 1, P.lightGray);
  }
  // 양쪽 날개
  const wing = (x, mirror) => {
    const rows = flap === 0 ? [-3, -2, -1] : flap === 1 ? [1, 2, 3] : [4, 5, 6];
    rows.forEach((r, i) => {
      const len = 4 - i;
      const sx = mirror ? x : x - len + 1;
      box(ctx, sx, y0 + r, len, 1, P.white);
      px(ctx, mirror ? sx + len - 1 : sx, y0 + r, i === 0 ? P.amber : P.lightGray);
    });
  };
  wing(cx - 1, false);
  wing(cx + 6, true);
}

// 문제집 (두께 5cm): 두꺼운 책 몬스터, 쿵쿵 걷는다
function drawBook(ctx, dir, f) {
  const stomp = f % 2; // 내딛는 프레임에서 납작해진다
  const top = 2 + stomp;
  const bottom = 19;
  const legY = 21;
  if (dir === 'left') {
    // 옆모습: 표지(앞) + 두꺼운 종이 단면 + 뒤표지
    const x = 5;
    const w = 10;
    box(ctx, x, top, 2, bottom - top, P.sky);
    box(ctx, x + 2, top, w - 4, bottom - top, P.white);
    for (let y = top + 1; y < bottom; y += 2) box(ctx, x + 2, y, w - 4, 1, P.lightGray);
    box(ctx, x + w - 2, top, 2, bottom - top, P.blue);
    box(ctx, x, top, w, 1, P.cyan);
    // 눈과 화난 눈썹 (종이 단면 앞쪽)
    px(ctx, x + 2, top + 3, P.ink);
    px(ctx, x + 3, top + 4, P.ink);
    box(ctx, x + 2, top + 5, 2, 2, P.white);
    px(ctx, x + 2, top + 6, P.ink);
    px(ctx, x + 2, top + 5, P.ink);
    box(ctx, x + 2, top + 10, 3, 1, P.ink);
    px(ctx, x + 3, top + 10, P.white);
    const s = f === 1 ? -2 : f === 3 ? 2 : 0;
    box(ctx, x + 2 + s, bottom, 3, 2, P.darkSlate);
    box(ctx, x + 5 - s, bottom, 3, 2, P.navy);
    box(ctx, x + 1 + s, legY, 4, 1, P.darkSlate);
    box(ctx, x + 4 - s, legY, 4, 1, P.navy);
    return;
  }
  const x = dir === 'up' ? 5 : 2;
  const w = 15 + stomp;
  const xx = x - stomp;
  if (dir === 'down') {
    // 앞표지: 하늘색 표지 + 노란 제목 띠, 오른쪽에 종이 두께가 보인다
    box(ctx, xx, top, w, bottom - top, P.sky);
    box(ctx, xx, top, 1, bottom - top, P.cyan);
    box(ctx, xx + w, top + 1, 3, bottom - top - 1, P.white);
    for (let y = top + 2; y < bottom; y += 2) box(ctx, xx + w, y, 3, 1, P.lightGray);
    box(ctx, xx + w + 2, top + 1, 1, bottom - top - 1, P.gray);
    box(ctx, xx, bottom - 1, w, 1, P.blue);
    box(ctx, xx + 1, top + 2, w - 2, 4, P.amber);
    box(ctx, xx + 1, top + 2, w - 2, 1, P.yellow);
    for (let i = 0; i < 4; i++) box(ctx, xx + 2 + i * 3, top + 4, 2, 1, P.darkBrown);
    // 화난 얼굴
    const fy = top + 8;
    px(ctx, xx + 3, fy, P.ink);
    px(ctx, xx + 4, fy + 1, P.ink);
    px(ctx, xx + w - 4, fy, P.ink);
    px(ctx, xx + w - 5, fy + 1, P.ink);
    box(ctx, xx + 3, fy + 2, 2, 2, P.white);
    box(ctx, xx + w - 5, fy + 2, 2, 2, P.white);
    px(ctx, xx + 4, fy + 3, P.ink);
    px(ctx, xx + w - 5, fy + 3, P.ink);
    box(ctx, xx + 5, fy + 6, w - 10, 1, P.ink);
    px(ctx, xx + 6, fy + 6, P.white);
    px(ctx, xx + w - 7, fy + 6, P.white);
  } else {
    // 뒤표지: 진한 파랑 + 바코드
    box(ctx, xx, top, w, bottom - top, P.blue);
    box(ctx, xx + w - 1, top, 1, bottom - top, P.navy);
    box(ctx, xx - 3, top + 1, 3, bottom - top - 1, P.white);
    for (let y = top + 2; y < bottom; y += 2) box(ctx, xx - 3, y, 3, 1, P.lightGray);
    box(ctx, xx + w - 7, bottom - 6, 5, 4, P.white);
    for (let i = 0; i < 5; i += 2) box(ctx, xx + w - 7 + i, bottom - 5, 1, 2, P.ink);
    box(ctx, xx + 2, top + 3, w - 4, 1, P.sky);
  }
  const s = f === 1 ? 1 : 0, t = f === 3 ? 1 : 0;
  box(ctx, x + 3, bottom, 3, 2 - s, P.darkSlate);
  box(ctx, x + w - 5, bottom, 3, 2 - t, P.navy);
  box(ctx, x + 2, legY - s, 4, 1, P.darkSlate);
  box(ctx, x + w - 5, legY - t, 4, 1, P.navy);
}

// 소주병: 초록 병, 라벨 위에 얼굴
function drawBottle(ctx, dir, f) {
  const hop = f % 2;
  const tilt = f === 1 ? -1 : f === 3 ? 1 : 0;
  const y0 = 1 - hop;
  const x = 2;
  const side = dir === 'left';
  // 병목과 뚜껑 (기울면 위쪽이 한 칸 밀린다)
  box(ctx, x + 2 + tilt, y0, 4, 2, P.darkGreen);
  px(ctx, x + 2 + tilt, y0, P.midGreen);
  box(ctx, x + 2 + tilt, y0 + 2, 4, 3, P.midGreen);
  px(ctx, x + 2 + tilt, y0 + 2, P.green);
  box(ctx, x + 1, y0 + 5, 6, 1, P.midGreen);
  // 몸통
  box(ctx, x, y0 + 6, 8, 10, P.midGreen);
  box(ctx, x, y0 + 6, 1, 10, P.green);
  box(ctx, x + 1, y0 + 7, 1, 7, P.cyan);
  box(ctx, x + 7, y0 + 6, 1, 10, P.darkGreen);
  box(ctx, x, y0 + 15, 8, 1, P.darkGreen);
  if (dir === 'down') {
    box(ctx, x + 1, y0 + 8, 6, 5, P.white);
    box(ctx, x + 1, y0 + 8, 6, 1, P.sky);
    box(ctx, x + 6, y0 + 9, 1, 4, P.lightGray);
    px(ctx, x + 2, y0 + 10, P.ink);
    px(ctx, x + 5, y0 + 10, P.ink);
    px(ctx, x + 2, y0 + 9, P.ink);
    px(ctx, x + 5, y0 + 9, P.ink);
    box(ctx, x + 3, y0 + 12, 2, 1, P.salmon);
  } else if (side) {
    box(ctx, x + 1, y0 + 8, 4, 5, P.white);
    box(ctx, x + 1, y0 + 8, 4, 1, P.sky);
    px(ctx, x + 1, y0 + 9, P.ink);
    px(ctx, x + 1, y0 + 10, P.ink);
    px(ctx, x + 2, y0 + 12, P.salmon);
  } else {
    box(ctx, x + 1, y0 + 8, 6, 5, P.white);
    box(ctx, x + 2, y0 + 9, 4, 1, P.lightGray);
    box(ctx, x + 2, y0 + 11, 3, 1, P.lightGray);
    box(ctx, x + 6, y0 + 9, 1, 4, P.lightGray);
  }
  feet(ctx, x + 1, x + 5, 18, f);
}

// 맥주잔: 거품이 출렁이는 손잡이 달린 잔
function drawMug(ctx, dir, f) {
  const hop = f % 2;
  const y0 = 2 - hop;
  const slosh = f === 1 ? 1 : f === 3 ? -1 : 0;
  const x = dir === 'up' ? 4 : 2;
  const w = 8;
  // 잔 몸통
  box(ctx, x, y0 + 3, w, 9, P.amber);
  box(ctx, x, y0 + 3, 1, 9, P.yellow);
  box(ctx, x + w - 1, y0 + 3, 1, 9, P.orange);
  box(ctx, x, y0 + 11, w, 1, P.orange);
  px(ctx, x + 2, y0 + 9, P.yellow);
  px(ctx, x + 5, y0 + 6, P.yellow);
  px(ctx, x + 3, y0 + 5, P.white);
  // 거품 (넘친다)
  box(ctx, x - 1 + (slosh < 0 ? -1 : 0), y0 + 1, w + 2 + (slosh !== 0 ? 1 : 0), 2, P.white);
  box(ctx, x + 1 + slosh, y0, w - 2, 1, P.white);
  px(ctx, x + w - 1, y0 + 2, P.lightGray);
  px(ctx, (slosh >= 0 ? x : x + w - 1), y0 + 3 + (f % 2), P.white);
  // 손잡이
  const hx = dir === 'up' ? x - 3 : x + w;
  box(ctx, hx, y0 + 4, 3, 1, P.lightGray);
  box(ctx, dir === 'up' ? hx : hx + 2, y0 + 4, 1, 5, P.lightGray);
  box(ctx, hx, y0 + 8, 3, 1, P.gray);
  if (dir === 'down') {
    px(ctx, x + 2, y0 + 6, P.ink);
    px(ctx, x + 2, y0 + 7, P.ink);
    px(ctx, x + 5, y0 + 6, P.ink);
    px(ctx, x + 5, y0 + 7, P.ink);
    box(ctx, x + 3, y0 + 9, 2, 1, P.darkBrown);
  } else if (dir === 'left') {
    px(ctx, x + 1, y0 + 6, P.ink);
    px(ctx, x + 1, y0 + 7, P.ink);
    px(ctx, x, y0 + 9, P.darkBrown);
  }
  feet(ctx, x + 1, x + 5, 15, f);
}

// 막걸리 주전자: 찌그러진 노란 양은 주전자
function drawKettle(ctx, dir, f) {
  const stomp = f % 2;
  const y0 = 3 + stomp;
  const bodyY = y0 + 6;
  const bodyH = 11 - stomp;
  const x = 6;
  const w = 16 + stomp;
  // 손잡이 (몸통 위로 둥글게)
  const hy = y0 - 2;
  box(ctx, x + 3, hy, w - 6, 1, P.orangeBrown);
  px(ctx, x + 2, hy + 1, P.orangeBrown);
  px(ctx, x + w - 3, hy + 1, P.orangeBrown);
  box(ctx, x + 2, hy + 2, 1, 3, P.darkBrown);
  box(ctx, x + w - 3, hy + 2, 1, 3, P.darkBrown);
  // 뚜껑
  box(ctx, x + 4, y0 + 3, w - 8, 3, P.amber);
  box(ctx, x + 4, y0 + 3, w - 8, 1, P.yellow);
  box(ctx, x + Math.floor(w / 2) - 1, y0 + 1, 2, 2, P.orange);
  // 몸통
  box(ctx, x + 1, bodyY, w - 2, bodyH, P.amber);
  box(ctx, x, bodyY + 1, w, bodyH - 2, P.amber);
  box(ctx, x, bodyY + 1, 1, bodyH - 2, P.yellow);
  box(ctx, x + 1, bodyY, 2, 1, P.yellow);
  box(ctx, x + w - 1, bodyY + 1, 1, bodyH - 2, P.orange);
  box(ctx, x + 1, bodyY + bodyH - 1, w - 2, 1, P.orange);
  box(ctx, x + 2, bodyY + 2, 1, bodyH - 5, P.yellow);
  // 찌그러진 자국
  px(ctx, x + w - 4, bodyY + 3, P.orangeBrown);
  px(ctx, x + w - 5, bodyY + 4, P.orange);
  px(ctx, x + 4, bodyY + bodyH - 3, P.orangeBrown);
  // 주둥이
  const spout = (sx, toLeft) => {
    for (let i = 0; i < 5; i++) {
      const px0 = toLeft ? sx - i : sx + i;
      box(ctx, px0, bodyY + 3 - i, 1, 2, i === 4 ? P.orange : P.amber);
    }
    px(ctx, toLeft ? sx - 4 : sx + 4, bodyY - 2, P.orangeBrown);
  };
  if (dir === 'down') {
    spout(x - 1, true);
    const fy = bodyY + 3;
    px(ctx, x + 4, fy - 1, P.ink);
    px(ctx, x + 5, fy, P.ink);
    px(ctx, x + w - 5, fy - 1, P.ink);
    px(ctx, x + w - 6, fy, P.ink);
    box(ctx, x + 5, fy + 1, 1, 2, P.ink);
    box(ctx, x + w - 6, fy + 1, 1, 2, P.ink);
    box(ctx, x + 6, fy + 5, w - 12, 1, P.ink);
    box(ctx, x + 7, fy + 5, w - 14, 1, P.darkBrown);
  } else if (dir === 'left') {
    spout(x - 1, true);
    const fy = bodyY + 3;
    px(ctx, x + 2, fy - 1, P.ink);
    px(ctx, x + 3, fy, P.ink);
    box(ctx, x + 3, fy + 1, 1, 2, P.ink);
    box(ctx, x + 2, fy + 5, 3, 1, P.ink);
  } else {
    spout(x + w, false);
  }
  const s = f === 1 ? 1 : 0, t = f === 3 ? 1 : 0;
  const fy = 21;
  box(ctx, x + 3, fy - s, 4, 1 + s, P.darkBrown);
  box(ctx, x + w - 7, fy - t, 4, 1 + t, P.deepBrown);
}

function objectSet(W, H, draw) {
  return build(W, H, draw);
}

// ════════════════════════════════════════════
// 15종 정의
// ════════════════════════════════════════════

const SPECS = [
  {
    basic: () => objectSet(12, 16, drawWorksheet),
    fast: () => objectSet(16, 15, drawFlyer),
    tank: () => objectSet(22, 22, drawBook),
  },
  {
    basic: () => humanoid({
      W: 14, headW: 8, headH: 8, torsoW: 8, torsoH: 6, legH: 5, slump: true,
      top: P.navy, topLight: P.darkSlate, topShade: P.ink, collar: true, buttons: true,
      bottom: P.skinDark, bottomShade: P.brown, face: 'gloomy',
    }),
    fast: () => humanoid({
      W: 14, headW: 7, headH: 8, torsoW: 6, torsoH: 6, legH: 6, run: true, rolled: true,
      top: P.white, topLight: P.white, topShade: P.lightGray, tie: P.amber,
      bottom: P.skinDark, bottomShade: P.brown, hair: P.deepBrown, hairLight: P.darkBrown, hairStyle: 'messy',
      faceSkin: P.salmon, faceShade: P.skinDark, face: 'angry',
    }),
    tank: () => humanoid({
      W: 24, headW: 10, headH: 9, torsoW: 12, torsoH: 8, legH: 6, armW: 3, topPad: 2,
      top: P.midGreen, topLight: P.green, topShade: P.darkGreen, stripe: true,
      bottom: P.midGreen, bottomShade: P.darkGreen, shoe: P.lightGray, shoeLight: P.white,
      hairStyle: 'spiky', face: 'smug', tray: true,
    }),
  },
  {
    basic: () => objectSet(12, 19, drawBottle),
    fast: () => objectSet(16, 16, drawMug),
    tank: () => objectSet(28, 22, drawKettle),
  },
  {
    basic: () => humanoid({
      W: 14, headW: 8, headH: 8, torsoW: 8, torsoH: 6, legH: 5, topPad: 1, helmet: true, camo: true,
      top: P.midGreen, topLight: P.midGreen, topShade: P.darkGreen, belt: P.deepBrown,
      bottom: P.midGreen, bottomShade: P.darkGreen, shoe: P.navy, shoeLight: P.darkSlate, face: 'strained',
    }),
    fast: () => humanoid({
      W: 14, headW: 7, headH: 8, torsoW: 6, torsoH: 6, legH: 6, run: true, shortSleeve: true, shorts: true,
      top: P.lightGray, topLight: P.white, topShade: P.gray, bottom: P.navy, bottomShade: P.ink,
      shoe: P.white, shoeLight: P.white, hairStyle: 'buzz', hair: P.darkSlate, hairLight: P.slate, face: 'strained',
    }),
    tank: () => humanoid({
      W: 24, headW: 10, headH: 9, torsoW: 12, torsoH: 8, legH: 6, armW: 3, topPad: 6, helmet: true, camo: true, ruck: true,
      top: P.midGreen, topLight: P.midGreen, topShade: P.darkGreen, belt: P.deepBrown,
      bottom: P.midGreen, bottomShade: P.darkGreen, shoe: P.navy, shoeLight: P.darkSlate, face: 'strained',
    }),
  },
  {
    basic: () => humanoid({
      W: 14, headW: 8, headH: 8, torsoW: 8, torsoH: 6, legH: 5, hairStyle: 'neat',
      top: P.blue, topLight: P.sky, topShade: P.navy, collar: true, tie: P.red, lanyard: true,
      bottom: P.darkSlate, bottomShade: P.navy, shoe: P.deepBrown, face: 'tired',
    }),
    fast: () => humanoid({
      W: 16, headW: 7, headH: 8, torsoW: 6, torsoH: 6, legH: 6, topPad: 9, run: true, phone: true, bubble: true,
      top: P.white, topLight: P.white, topShade: P.lightGray, tie: P.sky,
      bottom: P.darkSlate, bottomShade: P.navy, hairStyle: 'short', face: 'shout',
    }),
    tank: () => humanoid({
      W: 24, headW: 10, headH: 9, torsoW: 12, torsoH: 8, legH: 6, armW: 3, topPad: 9, hairStyle: 'neat',
      hair: P.slate, hairLight: P.gray,
      top: P.gray, topLight: P.lightGray, topShade: P.slate, collar: true, tie: P.darkRed, laptop: true, calendar: true,
      bottom: P.slate, bottomShade: P.darkSlate, shoe: P.deepBrown, face: 'smug',
    }),
  },
];

const cache = new Map();

export function enemySprite(era, type) {
  const key = `${era}:${type}`;
  if (!cache.has(key)) {
    const make = SPECS[era]?.[type];
    if (!make) throw new Error(`no enemy sprite for era ${era} / ${type}`);
    cache.set(key, make());
  }
  return cache.get(key);
}
