// 화면 위 DOM: 타이틀·레벨업 카드·시대 카드·환생·클리어·일시정지·HUD·토스트
import { sfx } from './audio.js';

const $ = (id) => document.getElementById(id);
const overlay = $('overlay');
let keyHandler = null;

addEventListener('keydown', (e) => keyHandler?.(e));

function show(html, kind = '') {
  overlay.innerHTML = html;
  overlay.dataset.kind = kind;
  overlay.classList.toggle('era-mode', kind === 'era');
  overlay.classList.toggle('levelup', kind === 'levelup');
  overlay.classList.remove('fade-out', 'closing');
  overlay.hidden = false;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function hideOverlay() {
  overlay.hidden = true;
  overlay.innerHTML = '';
  overlay.dataset.kind = '';
  overlay.classList.remove('era-mode', 'levelup', 'fade-out', 'closing');
  keyHandler = null;
}

// 시대 카드는 다른 화면(레벨업 등)을 건드리지 않게 자기일 때만 닫는다
export function fadeEra() {
  if (overlay.dataset.kind === 'era') overlay.classList.add('fade-out');
}

export function hideEra() {
  if (overlay.dataset.kind === 'era') hideOverlay();
}

function onConfirm(fn) {
  keyHandler = (e) => {
    if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      fn();
    }
  };
}

// 버튼 메뉴: ↑↓(←→)로 고르고 Enter, 마우스·터치는 올리면 고르고 누르면 실행
function menuNav(buttons, onAct, { onEscape, onDraw } = {}) {
  let focus = 0;
  const draw = () => {
    onDraw?.();
    buttons.forEach((b, i) => b.classList.toggle('focus', i === focus));
  };
  buttons.forEach((b, i) => {
    b.onclick = () => onAct(b.dataset.act, draw);
    // 마우스로 누른 버튼에 포커스가 남으면 Enter가 두 번 먹으니 포커스를 주지 않는다
    b.onmousedown = (e) => e.preventDefault();
    b.onpointerenter = () => {
      focus = i;
      draw();
    };
  });
  const MOVE = { ArrowUp: -1, KeyW: -1, ArrowLeft: -1, KeyA: -1, ArrowDown: 1, KeyS: 1, ArrowRight: 1, KeyD: 1 };
  keyHandler = (e) => {
    if (e.code === 'Escape' && onEscape) {
      e.preventDefault();
      onEscape();
    } else if (MOVE[e.code]) {
      e.preventDefault();
      focus = (focus + MOVE[e.code] + buttons.length) % buttons.length;
      sfx('tick');
      draw();
    } else if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      onAct(buttons[focus].dataset.act, draw);
    }
  };
  draw();
}

export function showTitle({ onStart, onDemo }) {
  show(`
    <div class="title-content">
      <p class="title-kicker">CHUNGYOUNG'S LIFE ADVENTURE</p>
      <h1>김충영<br><span>서바이벌</span></h1>
      <p class="title-tagline">인라인으로 달리던 꼬마가<br>AI와 함께 내일을 만들어가기까지.</p>
      <div class="title-chapters" aria-label="다섯 시대">일산 <b>·</b> 흑석동 <b>·</b> 프랑스어 <b>·</b> 청와대 <b>·</b> 개발자</div>
      <div class="menu">
        <button class="btn" data-act="start">인생 시작하기 <span aria-hidden="true">→</span></button>
        <button class="btn ghost" data-act="demo">빠르게 시연하기 <small>시대마다 15초</small></button>
      </div>
      <p class="title-controls">WASD / 방향키 이동 &nbsp;·&nbsp; 공격 자동 &nbsp;·&nbsp; ESC 일시정지</p>
    </div>`, 'title');
  menuNav([...overlay.querySelectorAll('.menu .btn')], (act) => (act === 'demo' ? onDemo() : onStart()));
}

export function showEra({ age, event, title }) {
  show(`
    <div class="era-card">
      <div class="age-big">${esc(age)}</div>
      <p class="event">${esc(event)}</p>
      <p class="title">「${esc(title)}」</p>
    </div>`, 'era');
  keyHandler = null;
}

// 카드는 하나씩 튀어 올라오고, 고르면 그 카드는 번쩍이며 빨려 들어가고 나머지는 떨어진다
const PICK_MS = 420;

export function showLevelUp(cards, onPick) {
  show(`
    <h2 class="lv-title">레벨업!</h2>
    <div class="cards">
      ${cards.map((c, i) => `
        <button class="card" style="--i:${i}" data-i="${i}">
          <div class="top"><img class="icon" src="${c.icon}" alt=""><span class="lvl">${c.lvLabel}</span></div>
          <div class="name">${esc(c.name)}</div>
          <div class="quote">${esc(c.quote)}</div>
          <div class="effect">${esc(c.effect)}</div>
          <div class="key">[${i + 1}]</div>
        </button>`).join('')}
    </div>`, 'levelup');
  let chosen = false;
  const choose = (i) => {
    if (chosen) return;
    chosen = true;
    keyHandler = null;
    sfx('pick');
    overlay.querySelectorAll('.card').forEach((el, j) => el.classList.add(j === i ? 'picked' : 'dismissed'));
    overlay.classList.add('closing');
    setTimeout(() => onPick(i), PICK_MS);
  };
  overlay.querySelectorAll('.card').forEach((el) => {
    el.onclick = () => choose(Number(el.dataset.i));
  });
  keyHandler = (e) => {
    const n = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[e.code];
    if (n !== undefined && n < cards.length) choose(n);
  };
}

// 보스 등장: 이름이 떨리며 나타난다 (시대 카드처럼 투명 배경, 알아서 사라짐)
export function showBossIntro({ name }) {
  show(`
    <div class="boss-card">
      <p class="boss-label">보스 등장</p>
      <div class="boss-title">${esc(name)}</div>
    </div>`, 'era');
  keyHandler = null;
}

const bossbar = { root: $('bossbar'), name: $('boss-name'), fill: $('boss-fill'), label: '', pct: -1 };
export function showBossBar(name) {
  bossbar.root.hidden = false;
  updateBossBar(name, 0);
}
export function updateBossBar(label, frac) {
  if (label !== bossbar.label) bossbar.name.textContent = bossbar.label = label;
  const pct = Math.round(frac * 200) / 2;
  if (pct !== bossbar.pct) bossbar.fill.style.width = `${(bossbar.pct = pct)}%`;
}
export function hideBossBar() {
  bossbar.root.hidden = true;
}

export function showDeath({ age, onRebirth }) {
  show(`
    <h2>다시 태어나도 김충영</h2>
    <p>${esc(age)}, 그 시절로 돌아갑니다</p>
    <button class="btn" id="go">김충영으로 환생하기</button>`);
  $('go').onclick = onRebirth;
  onConfirm(onRebirth);
}

export function showEndingVideo({ onComplete }) {
  show(`
    <div class="ending-film">
      <video id="ending-video" src="assets/chungyoung-ending.mp4" controls autoplay playsinline preload="auto" aria-label="김충영 서바이벌 엔딩 영상"></video>
      <div class="ending-film-actions">
        <p id="ending-message" role="status">소리와 함께 감상해 주세요.</p>
        <button class="btn ghost" id="ending-skip">결과 보기</button>
      </div>
    </div>`, 'ending-video');
  const video = $('ending-video');
  let finished = false;
  const complete = () => {
    if (finished) return;
    finished = true;
    video.pause();
    onComplete();
  };
  video.onended = complete;
  video.onplaying = () => {
    if (!finished) $('ending-message').textContent = '소리와 함께 감상해 주세요.';
  };
  video.onerror = () => {
    if (!finished) $('ending-message').textContent = '영상을 불러오지 못했습니다. 결과 보기로 계속할 수 있어요.';
  };
  $('ending-skip').onclick = complete;
  keyHandler = (e) => {
    if (e.code === 'Escape') { e.preventDefault(); complete(); }
  };
  video.play().catch(() => {
    if (!finished && video.paused) $('ending-message').textContent = '영상의 재생 버튼을 누르면 소리와 함께 시작됩니다.';
  });
}

export function showClear({ kills, level, rebirths, onRestart, onReplay }) {
  show(`
    <h1>30살(진), 아직 성장 중!</h1>
    <p>개발자 · AI 엔지니어 · PM<br>세 가지 힘을 모아, 다음 도전으로!</p>
    <dl class="stats">
      <dt>처치</dt><dd>${kills.toLocaleString()}</dd>
      <dt>최종 레벨</dt><dd>${level}</dd>
      <dt>환생</dt><dd>${rebirths}번</dd>
    </dl>
    <button class="btn" id="go">인생 2회차</button>
    <button class="btn ghost" id="replay-ending">엔딩 다시 보기</button>`);
  $('go').onclick = onRestart;
  $('replay-ending').onclick = onReplay;
  keyHandler = (e) => {
    if (e.code !== 'Enter' && e.code !== 'Space') return;
    e.preventDefault();
    if (e.target?.id === 'replay-ending') onReplay();
    else onRestart();
  };
}

// 일시정지: 계속하기 · 효과음 · 배경음 · 처음으로. ↑↓로 고르고 Enter, ESC는 계속하기
export function showPause({ sfx: sfxOn, bgm, onResume, onToggle, onTitle }) {
  show(`
    <h2>일시정지</h2>
    <div class="menu">
      <button class="btn" data-act="resume">계속하기</button>
      <button class="btn ghost" data-act="sfx"></button>
      <button class="btn ghost" data-act="bgm"></button>
      <button class="btn ghost" data-act="title"></button>
    </div>
    <p class="muted">ESC 계속하기 · ↑↓ 고르기 · Enter 선택</p>`, 'pause');
  const buttons = [...overlay.querySelectorAll('.menu .btn')];
  const state = { sfx: sfxOn, bgm, sure: false };
  const label = () => {
    buttons[1].textContent = `효과음 ${state.sfx ? '켜짐' : '꺼짐'}`;
    buttons[2].textContent = `배경음 ${state.bgm ? '켜짐' : '꺼짐'}`;
    buttons[1].classList.toggle('off', !state.sfx);
    buttons[2].classList.toggle('off', !state.bgm);
    // 처음으로는 한 번 더 눌러야 간다 (실수로 진행을 날리지 않게)
    buttons[3].textContent = state.sure ? '정말 처음으로? 한 번 더!' : '처음으로';
    buttons[3].classList.toggle('warn', state.sure);
  };
  const act = (name, draw) => {
    if (name === 'resume') return onResume();
    if (name === 'title') {
      if (state.sure) return onTitle();
      state.sure = true;
    } else {
      state[name] = !state[name];
      onToggle(name, state[name]);
    }
    sfx('ok');
    draw();
  };
  menuNav(buttons, act, { onEscape: onResume, onDraw: label });
}

let toastTimer = 0;
export function toast(title, sub = '', ms = 2400) {
  const el = $('toast');
  el.innerHTML = `${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}`;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), ms);
}

// ── HUD ──
const hud = { root: $('hud'), age: $('age'), era: $('era-name'), lv: $('lv'), xp: $('xp-fill'), timeline: $('timeline'), weapons: $('weapons') };
const last = {};

export function initHUD(eraCount, onPause) {
  hud.timeline.innerHTML = Array.from({ length: eraCount }, () => '<div class="seg"><i></i></div>').join('');
  hud.segs = [...hud.timeline.querySelectorAll('i')];
  hud.root.hidden = false;
  // 폰에는 ESC가 없어서 화면 오른쪽 위 버튼으로 멈춘다
  $('pause-btn').hidden = false;
  $('pause-btn').onclick = onPause;
}

export function hideHUD() {
  hud.root.hidden = true;
  $('pause-btn').hidden = true;
  $('toast').hidden = true;
  hideBossBar();
}

function set(key, value, apply) {
  if (last[key] === value) return;
  last[key] = value;
  apply(value);
}

export function updateHUD({ age, eraTitle, era, eraProgress, level, xpFrac, chips }) {
  set('age', age, (v) => (hud.age.textContent = v));
  set('era', eraTitle, (v) => (hud.era.textContent = v));
  set('lv', level, (v) => (hud.lv.textContent = `Lv ${v}`));
  set('xp', Math.round(xpFrac * 200), (v) => (hud.xp.style.width = `${v / 2}%`));
  hud.segs.forEach((seg, i) => {
    const p = i < era ? 100 : i > era ? 0 : Math.round(eraProgress * 100);
    set(`seg${i}`, p, (v) => (seg.style.width = `${v}%`));
  });
  const sig = chips.map((c) => `${c.icon}${c.lv}${c.old ? 'o' : ''}`).join('|');
  set('chips', sig, () => {
    hud.weapons.innerHTML = chips.map((c) => `<span class="chip${c.old ? ' old' : ''}"><img src="${c.icon}" alt=""><b>${c.lv}</b></span>`).join('');
  });
}
