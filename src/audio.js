// 효과음·배경음. 소리 파일 없이 Web Audio로 8비트 소리를 그 자리에서 만든다.
// 브라우저는 사용자가 한 번 누르거나 키를 치기 전에는 소리를 막아서, 그때 처음 켠다.

const SFX_VOL = 0.5;
const BGM_VOL = 0.3;
const DUCK = 0.35; // 일시정지 중 배경음 크기

function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}

function save(key, on) {
  try {
    localStorage.setItem(key, on ? '1' : '0');
  } catch {
    // 저장이 막혀 있어도 이번 판에서는 그대로 동작한다
  }
}

export const settings = { sfx: load('ls-sfx', true), bgm: load('ls-bgm', true) };

let ac = null, sfxBus, bgmBus, noiseBuf;
const waves = {};
let ducked = false;
let wanted = null; // 지금 틀어야 할 곡 (소리가 켜지기 전에 정해질 수 있다)
let song = null; // 지금 재생 중인 곡

export function unlock() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    // 소리가 한꺼번에 겹쳐도 찢어지지 않게 눌러 준다
    const comp = ac.createDynamicsCompressor();
    comp.connect(ac.destination);
    sfxBus = ac.createGain();
    bgmBus = ac.createGain();
    sfxBus.connect(comp);
    bgmBus.connect(comp);
    applyVolumes();
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    waves.pulse12 = pulseWave(0.125);
    waves.pulse25 = pulseWave(0.25);
    setInterval(tick, 25);
  }
  if (ac.state === 'suspended') ac.resume();
  if (wanted && !song) startSong(wanted);
}
addEventListener('pointerdown', unlock, true);
addEventListener('keydown', unlock, true);
// 다른 탭으로 가거나 폰 화면이 꺼지면 소리도 멈춘다
document.addEventListener('visibilitychange', () => {
  if (!ac) return;
  if (document.hidden) ac.suspend();
  else ac.resume();
});

// 패미컴 소리처럼 폭이 좁은 네모파
function pulseWave(duty) {
  const n = 48, real = new Float32Array(n), imag = new Float32Array(n);
  for (let k = 1; k < n; k++) real[k] = Math.sin(Math.PI * k * duty) / k;
  return ac.createPeriodicWave(real, imag);
}

function applyVolumes() {
  const t = ac.currentTime;
  sfxBus.gain.setTargetAtTime(settings.sfx ? SFX_VOL : 0, t, 0.03);
  bgmBus.gain.setTargetAtTime(settings.bgm ? BGM_VOL * (ducked ? DUCK : 1) : 0, t, 0.08);
}

export function setEnabled(kind, on) {
  settings[kind] = on;
  save(`ls-${kind}`, on);
  if (ac) applyVolumes();
}

// 디버그용: 지금 소리 상태
export const state = () => ({ ctx: ac?.state ?? 'none', song: song?.id ?? null, wanted, ...settings, ducked, played: { ...played } });

export function duck(on) {
  ducked = on;
  if (ac) applyVolumes();
}

// ── 소리 재료 ──

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function hz(name) {
  const m = /^([A-G])([#b]?)(\d)$/.exec(name);
  const semi = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12;
  return 440 * 2 ** ((semi - 69) / 12);
}

// vib: [초당 떨림, 떨리는 폭(Hz)] — 목소리·호루라기처럼 음이 떨리게
function osc(wave, freq, t, dur, vol, out, { to, attack = 0.004, vib } = {}) {
  const o = ac.createOscillator(), gn = ac.createGain();
  if (waves[wave]) o.setPeriodicWave(waves[wave]);
  else o.type = wave;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  if (vib) {
    const lfo = ac.createOscillator(), depth = ac.createGain();
    lfo.frequency.value = vib[0];
    depth.gain.value = vib[1];
    lfo.connect(depth);
    depth.connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
  }
  gn.gain.setValueAtTime(0.0001, t);
  gn.gain.linearRampToValueAtTime(vol, t + attack);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(gn);
  gn.connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function hiss(t, dur, vol, out, { type = 'highpass', freq = 3000, to, q = 0.8 } = {}) {
  const src = ac.createBufferSource(), f = ac.createBiquadFilter(), gn = ac.createGain();
  src.buffer = noiseBuf;
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  gn.gain.setValueAtTime(vol, t);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f);
  f.connect(gn);
  gn.connect(out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

const arp = (wave, names, t, step, dur, vol) => names.forEach((n, i) => osc(wave, hz(n), t + i * step, dur, vol, sfxBus));
// 같은 소리가 계속 나도 덜 지겹게 음높이를 조금씩 흔든다
const vary = (amt = 0.12) => 1 + (Math.random() - 0.5) * amt;
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// ── 효과음 ── gap: 같은 소리를 이 간격(초) 안에 또 내지 않는다 (적이 한꺼번에 맞아도 시끄럽지 않게)
let gemCombo = 0, lastGem = 0;
const SFX = {
  // 스킬이 적에게 맞는 '탁' / 쓰러질 때 '뿅' (뿅은 몇 가지 음 중에서 골라 경쾌하게)
  hit: {
    gap: 0.04,
    play(t) {
      const k = vary(0.3);
      osc('square', 480 * k, t, 0.045, 0.09, sfxBus, { to: 160 * k });
      hiss(t, 0.03, 0.07, sfxBus, { freq: 1800 * k });
    },
  },
  kill: {
    gap: 0.045,
    play(t) {
      const f = hz(pick(['E5', 'G5', 'A5', 'C6', 'D6']));
      osc('pulse25', f, t, 0.07, 0.08, sfxBus, { to: f * 2 });
      hiss(t, 0.04, 0.03, sfxBus, { freq: 5000 });
    },
  },
  gem: {
    gap: 0.03,
    play(t) {
      // 연달아 주우면 음이 조금씩 올라간다
      gemCombo = t - lastGem < 0.25 ? Math.min(12, gemCombo + 1) : 0;
      lastGem = t;
      osc('pulse25', 1000 * 2 ** (gemCombo / 24), t, 0.05, 0.05, sfxBus);
    },
  },
  hurt: {
    gap: 0.1,
    play(t) {
      osc('square', 200, t, 0.18, 0.22, sfxBus, { to: 60 });
      hiss(t, 0.14, 0.22, sfxBus, { type: 'lowpass', freq: 1200, to: 200 });
    },
  },
  dodge: {
    gap: 0.1,
    play(t) {
      hiss(t, 0.18, 0.12, sfxBus, { type: 'bandpass', freq: 800, to: 4000, q: 2 });
      osc('triangle', 500, t, 0.15, 0.12, sfxBus, { to: 1400 });
    },
  },
  levelup: { play: (t) => arp('pulse25', ['C5', 'E5', 'G5', 'C6'], t, 0.065, 0.14, 0.13) },
  // 레벨업 카드가 하나씩 튀어 오를 때 (카드 등장 애니메이션 간격에 맞춤)
  cards: { play: (t) => [0, 0.08, 0.16].forEach((d, i) => osc('triangle', 660 * 2 ** (i / 12), t + 0.08 + d, 0.05, 0.1, sfxBus)) },
  pick: {
    play(t) {
      osc('square', hz('G5'), t, 0.07, 0.12, sfxBus);
      osc('square', hz('D6'), t + 0.06, 0.12, 0.12, sfxBus);
    },
  },
  power: {
    play(t) {
      osc('pulse25', hz('C6'), t, 0.1, 0.1, sfxBus, { to: hz('C7') });
      hiss(t, 0.2, 0.04, sfxBus, { freq: 6000 });
    },
  },
  heal: {
    play(t) {
      osc('triangle', hz('C5'), t, 0.25, 0.18, sfxBus, { to: hz('G5') });
      osc('triangle', hz('E5'), t + 0.08, 0.25, 0.14, sfxBus, { to: hz('C6') });
    },
  },
  // 시대 전환: 옷이 바뀌며 번쩍일 때 / 나이 카드가 뜰 때
  era: {
    play(t) {
      osc('square', 220, t, 0.4, 0.09, sfxBus, { to: 1760 });
      hiss(t, 0.35, 0.07, sfxBus, { freq: 5000 });
    },
  },
  eraCard: {
    play(t) {
      osc('triangle', 130, t, 0.3, 0.35, sfxBus, { to: 55 });
      hiss(t, 0.12, 0.08, sfxBus, { type: 'lowpass', freq: 800 });
    },
  },
  bossIntro: {
    play(t) {
      osc('sine', 90, t, 1.1, 0.5, sfxBus, { to: 32 });
      hiss(t, 0.9, 0.25, sfxBus, { type: 'lowpass', freq: 600, to: 80 });
      osc('square', hz('E2'), t + 0.05, 0.9, 0.05, sfxBus);
      osc('square', hz('A#2'), t + 0.05, 0.9, 0.05, sfxBus);
    },
  },
  bossShot: { gap: 0.18, play: (t) => osc('triangle', 300, t, 0.12, 0.07, sfxBus, { to: 150 }) },
  // 마지막 한 방: 낮게 차오르다가 화면을 덮는 순간 쾅
  finale: {
    play(t) {
      osc('sawtooth', 70, t, 1.4, 0.07, sfxBus, { to: 280, attack: 0.5 });
      hiss(t, 1.4, 0.06, sfxBus, { type: 'lowpass', freq: 200, to: 2000 });
    },
  },
  impact: {
    play(t) {
      osc('sine', 110, t, 0.7, 0.6, sfxBus, { to: 30 });
      hiss(t, 0.6, 0.45, sfxBus, { type: 'lowpass', freq: 1800, to: 120 });
    },
  },
  death: {
    play(t) {
      arp('square', ['E5', 'C5', 'A4', 'E4'], t, 0.13, 0.16, 0.12);
      osc('triangle', 220, t + 0.5, 0.6, 0.2, sfxBus, { to: 55 });
    },
  },
  rebirth: { play: (t) => arp('triangle', ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'], t, 0.05, 0.12, 0.12) },
  // 무기를 쓸 때 (무기마다 다른 소리)
  // 연필: 슉 하고 날아가며 사각
  pencil: {
    gap: 0.12,
    play(t) {
      const k = vary();
      osc('pulse12', 1600 * k, t, 0.05, 0.05, sfxBus, { to: 900 * k });
      hiss(t, 0.06, 0.04, sfxBus, { type: 'bandpass', freq: 4200, to: 2400, q: 3 });
    },
  },
  // 버터 발음: 혀 굴리는 듯 오르내리는 세 음
  abc: {
    gap: 0.2,
    play(t) {
      const notes = pick([['A5', 'C6', 'E6'], ['E6', 'C6', 'A5'], ['G5', 'B5', 'D6']]);
      notes.forEach((n, i) => osc('pulse25', hz(n), t + i * 0.035, 0.06, 0.05, sfxBus, { vib: [18, 20] }));
    },
  },
  // 농구공: 바닥에 튀는 통 + 고무 울림
  ball: {
    gap: 0.15,
    play(t) {
      osc('triangle', 240, t, 0.1, 0.22, sfxBus, { to: 100 });
      hiss(t, 0.05, 0.08, sfxBus, { type: 'lowpass', freq: 500 });
      osc('sine', 620, t, 0.06, 0.03, sfxBus, { to: 520 });
    },
  },
  bounce: {
    gap: 0.06,
    play(t) {
      const k = vary(0.2);
      osc('triangle', 320 * k, t, 0.08, 0.16, sfxBus, { to: 150 * k });
      hiss(t, 0.04, 0.06, sfxBus, { type: 'lowpass', freq: 700 });
    },
  },
  // 사랑은 폭발이야: 날아갈 때 뾰로롱, 터질 때 펑 + 반짝반짝
  heart: {
    gap: 0.2,
    play(t) {
      osc('triangle', hz('C6'), t, 0.09, 0.09, sfxBus, { to: hz('G6') });
      osc('pulse25', hz('E6'), t + 0.05, 0.07, 0.04, sfxBus);
      osc('pulse25', hz('G6'), t + 0.09, 0.08, 0.035, sfxBus);
      hiss(t, 0.12, 0.025, sfxBus, { freq: 7000 });
    },
  },
  boom: {
    gap: 0.08,
    play(t) {
      const k = vary(0.2);
      // 뽀용 하고 부풀었다가
      osc('square', 900 * k, t, 0.07, 0.06, sfxBus, { to: 300 * k });
      // 펑
      hiss(t + 0.03, 0.3, 0.16, sfxBus, { type: 'lowpass', freq: 3200, to: 200 });
      osc('sine', 170 * k, t + 0.03, 0.26, 0.3, sfxBus, { to: 50 });
      // 하트 조각이 반짝이며 흩어진다
      ['E6', 'G#6', 'B6', 'E7'].forEach((n, i) => osc('triangle', hz(n) * k, t + 0.08 + i * 0.04, 0.07, 0.04, sfxBus));
    },
  },
  // 고막 브레이커: 떨리는 목소리 '아~' + 마이크 울림
  vocal: {
    gap: 0.2,
    play(t) {
      const f = hz(pick(['E4', 'G4', 'A4']));
      osc('sawtooth', f, t, 0.32, 0.05, sfxBus, { vib: [7, f * 0.03], attack: 0.03 });
      osc('square', f * 1.5, t, 0.3, 0.025, sfxBus, { vib: [7, f * 0.045], attack: 0.03 });
      hiss(t, 0.22, 0.04, sfxBus, { type: 'bandpass', freq: 1500, q: 2 });
      osc('sine', f * 4, t + 0.02, 0.2, 0.02, sfxBus, { to: f * 3.6 });
    },
  },
  // 벼락치기: 지지직 하고 떨어지는 번개
  zap: {
    gap: 0.08,
    play(t) {
      osc('sawtooth', 1800, t, 0.1, 0.05, sfxBus, { to: 200 });
      for (let i = 0; i < 3; i++) hiss(t + i * 0.03, 0.025, 0.08, sfxBus, { freq: 3000 + i * 1500 });
      osc('square', 70, t + 0.02, 0.12, 0.06, sfxBus, { to: 40 });
    },
  },
  // 동작 봐라: 호루라기 삑 + 땅 울림
  thud: {
    gap: 0.2,
    play(t) {
      osc('sine', 2600, t, 0.22, 0.08, sfxBus, { vib: [28, 90] });
      osc('sine', 140, t + 0.05, 0.22, 0.32, sfxBus, { to: 45 });
      hiss(t + 0.05, 0.14, 0.14, sfxBus, { type: 'lowpass', freq: 900 });
    },
  },
  // AI 에이전트: 미사일 발사 슈웅, 맞으면 퍽
  missile: {
    gap: 0.15,
    play(t) {
      hiss(t, 0.18, 0.06, sfxBus, { type: 'bandpass', freq: 600, to: 2600, q: 1.5 });
      osc('pulse12', 400, t, 0.14, 0.035, sfxBus, { to: 1200 });
      osc('square', 1760, t, 0.03, 0.025, sfxBus);
    },
  },
  pop: {
    gap: 0.07,
    play(t) {
      const k = vary(0.25);
      hiss(t, 0.1, 0.11, sfxBus, { type: 'lowpass', freq: 2600 * k, to: 400 });
      osc('square', 220 * k, t, 0.07, 0.05, sfxBus, { to: 80 });
      hiss(t + 0.04, 0.03, 0.04, sfxBus, { freq: 6000 });
    },
  },
  // PLAF 부메랑: 휘잉 날아갔다가 돌아오는 소리
  boomerang: {
    gap: 0.25,
    play(t) {
      hiss(t, 0.22, 0.07, sfxBus, { type: 'bandpass', freq: 500, to: 2000, q: 4 });
      hiss(t + 0.22, 0.22, 0.05, sfxBus, { type: 'bandpass', freq: 2000, to: 600, q: 4 });
      osc('triangle', 600, t, 0.22, 0.05, sfxBus, { to: 950 });
      osc('triangle', 950, t + 0.22, 0.22, 0.04, sfxBus, { to: 620 });
    },
  },
  // 메뉴
  start: { play: (t) => arp('pulse25', ['G4', 'C5', 'E5', 'G5'], t, 0.05, 0.1, 0.1) },
  tick: { gap: 0.03, play: (t) => osc('pulse25', 880, t, 0.04, 0.08, sfxBus) },
  ok: { play: (t) => arp('pulse25', ['E5', 'B5'], t, 0.05, 0.08, 0.1) },
  pause: { play: (t) => arp('pulse25', ['B5', 'E5'], t, 0.06, 0.08, 0.1) },
};

const lastAt = {};
const played = {}; // 디버그용: 효과음별로 실제 낸 횟수
export function sfx(name) {
  const s = SFX[name];
  if (!s || !ac || !settings.sfx || ac.state !== 'running') return;
  const now = ac.currentTime;
  if (now - (lastAt[name] ?? -1) < (s.gap ?? 0)) return;
  lastAt[name] = now;
  played[name] = (played[name] ?? 0) + 1;
  s.play(now + 0.005);
}

// ── 배경음 ──
// 한 칸 = 8분음표. 'C5' 음 / '-' 앞 음 이어서 / '.' 쉼 / '|'는 마디 구분(무시). 드럼은 k 킥, s 스네어, h 하이햇.
const SONGS = {
  title: {
    bpm: 96,
    voices: [
      { wave: 'triangle', vol: 0.22, notes: 'E5 - G5 - A5 - G5 E5 | D5 - C5 - D5 - E5 - | E5 - G5 - C6 - B5 A5 | G5 - - - . . . .' },
      { wave: 'pulse25', vol: 0.06, notes: 'C3 . G3 . E3 . G3 . | A2 . E3 . C3 . E3 . | F2 . C3 . A2 . C3 . | G2 . D3 . B2 . D3 .' },
    ],
    drums: '. . h . . . h .',
  },
  // 서울: 신나는 어린 시절
  era0: {
    bpm: 144,
    voices: [
      { wave: 'pulse25', vol: 0.09, notes: 'C5 E5 G5 E5 C6 - G5 . | A5 G5 E5 C5 D5 - . . | F5 A5 C6 A5 G5 E5 C5 E5 | D5 - G4 - C5 - . .' },
      { wave: 'triangle', vol: 0.22, notes: 'C3 C4 G3 C4 C3 C4 G3 C4 | A2 A3 E3 A3 A2 A3 E3 A3 | F2 F3 C3 F3 F2 F3 C3 F3 | G2 G3 D3 G3 G2 G3 B2 G3' },
    ],
    drums: 'k h s h k h s h',
  },
  // 인천: 질주하는 10대
  era1: {
    bpm: 152,
    voices: [
      { wave: 'square', vol: 0.07, notes: 'A4 C5 E5 - A5 - E5 C5 | B4 D5 G5 - D5 - B4 G4 | A4 C5 F5 - C5 - A4 F4 | G#4 B4 E5 - D5 C5 B4 G#4' },
      { wave: 'triangle', vol: 0.22, notes: 'A2 A2 A3 A2 A2 A2 A3 A2 | G2 G2 G3 G2 G2 G2 G3 G2 | F2 F2 F3 F2 F2 F2 F3 F2 | E2 E2 E3 E2 E2 E2 E3 E2' },
    ],
    drums: 'k h s h k k s h',
  },
  // 가천대: 쿵짝쿵짝 술자리
  era2: {
    bpm: 128,
    voices: [
      { wave: 'pulse25', vol: 0.09, notes: 'F5 . A5 . C6 . A5 . | G5 . Bb5 . D6 - C6 . | A5 . F5 . C5 . F5 A5 | G5 - E5 - C5 - . .' },
      { wave: 'triangle', vol: 0.22, notes: 'F2 . C3 . F2 . C3 . | G2 . D3 . G2 . D3 . | F2 . C3 . F2 . A2 . | C3 . G2 . C3 . E3 .' },
    ],
    drums: 'k . s . k k s .',
  },
  // 21사단: 행진곡
  era3: {
    bpm: 116,
    voices: [
      { wave: 'square', vol: 0.07, notes: 'D5 - D5 D5 F5 - D5 - | A5 - G5 F5 E5 - . . | F5 - F5 F5 A5 - F5 - | E5 - D5 C#5 D5 - . .' },
      { wave: 'triangle', vol: 0.22, notes: 'D3 . A2 . D3 . A2 . | A2 . E3 . A2 . E3 . | D3 . A2 . D3 . A2 . | A2 . A2 . D3 . . .' },
    ],
    drums: 'k s k s k s s s',
  },
  // 플래드랩스: 쉴 틈 없이 몰아치는 일
  era4: {
    bpm: 160,
    voices: [
      { wave: 'pulse12', vol: 0.08, notes: 'E5 G5 B5 G5 E5 G5 B5 G5 | C5 E5 G5 E5 C5 E5 G5 E5 | D5 F#5 A5 F#5 D5 F#5 A5 F#5 | B4 D#5 F#5 D#5 B4 D#5 F#5 A5' },
      { wave: 'triangle', vol: 0.24, notes: 'E2 E2 E3 E2 E2 E2 E3 E2 | C2 C2 C3 C2 C2 C2 C3 C2 | D2 D2 D3 D2 D2 D2 D3 D2 | B1 B1 B2 B1 B1 B1 B2 B1' },
    ],
    drums: 'k h s h k k s h',
  },
  // 보스: 낮게 깔린 소리와 심장 소리
  boss: {
    bpm: 80,
    voices: [
      { wave: 'square', vol: 0.05, attack: 0.3, notes: 'E4 - - - F4 - - - | . . . . . . . . | E4 - - - A#3 - - - | . . . . . . . .' },
      { wave: 'triangle', vol: 0.26, notes: 'E2 - - - - - - - | E2 - - - - - - - | E2 - - - - - - - | F2 - - - - - - -' },
    ],
    drums: 'k k . . . . . .',
  },
  ending: {
    bpm: 88,
    voices: [
      { wave: 'triangle', vol: 0.22, notes: 'G5 - E5 - C5 - E5 - | F5 - A5 - G5 - - - | E5 - C5 - A4 - C5 - | D5 - - - G4 - - - | E5 - G5 - C6 - B5 - | A5 - F5 - A5 - - - | G5 - E5 - D5 - E5 - | C5 - - - - - . .' },
      { wave: 'pulse25', vol: 0.05, notes: 'C3 . G3 . E3 . G3 . | F2 . C3 . A2 . C3 . | A2 . E3 . C3 . E3 . | G2 . D3 . B2 . D3 . | C3 . G3 . E3 . G3 . | F2 . C3 . A2 . C3 . | G2 . D3 . B2 . D3 . | C3 . G3 . C4 . . .' },
    ],
  },
};

// 악보 글자 → 칸마다 { f: 주파수, len: 칸 수 }
function parse(str) {
  const tokens = str.split(/\s+/).filter((s) => s && s !== '|');
  const events = new Array(tokens.length).fill(null);
  let last = null;
  tokens.forEach((tok, i) => {
    if (tok === '-') {
      if (last) last.len++;
    } else if (tok === '.') {
      last = null;
    } else {
      last = events[i] = { f: hz(tok), len: 1 };
    }
  });
  return events;
}

for (const s of Object.values(SONGS)) {
  for (const v of s.voices) v.events = parse(v.notes);
  if (s.drums) s.beats = s.drums.split(/\s+/).filter(Boolean);
}

function startSong(id) {
  const out = ac.createGain();
  const t = ac.currentTime;
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(1, t + 0.4);
  out.connect(bgmBus);
  song = { id, def: SONGS[id], out, step: 0, next: t + 0.05 };
}

function stopSong(fade) {
  if (!song) return;
  const { out } = song, t = ac.currentTime;
  out.gain.cancelScheduledValues(t);
  out.gain.setValueAtTime(out.gain.value, t);
  out.gain.linearRampToValueAtTime(0, t + fade);
  setTimeout(() => out.disconnect(), (fade + 0.5) * 1000);
  song = null;
}

// 같은 곡이 이미 나오고 있으면 처음부터 다시 틀지 않는다
export function playMusic(id) {
  wanted = id;
  if (!ac || song?.id === id) return;
  stopSong(0.6);
  startSong(id);
}

export function stopMusic(fade = 0.6) {
  wanted = null;
  if (ac) stopSong(fade);
}

// 0.12초 앞까지 미리 음을 예약해 둔다
function tick() {
  if (!song || ac.state !== 'running') return;
  const dur = 60 / song.def.bpm / 2;
  // 화면이 꺼졌다 돌아오면 밀린 음을 한꺼번에 내지 않고 지금부터 이어 간다
  if (song.next < ac.currentTime - 0.1) song.next = ac.currentTime + 0.02;
  while (song.next < ac.currentTime + 0.12) {
    if (settings.bgm) playStep(song, song.step, song.next, dur);
    song.step++;
    song.next += dur;
  }
}

function playStep(s, step, t, dur) {
  for (const v of s.def.voices) {
    const ev = v.events[step % v.events.length];
    if (ev) note(v, ev.f, t, ev.len * dur, s.out);
  }
  if (!s.def.beats) return;
  const beat = s.def.beats[step % s.def.beats.length];
  if (beat.includes('k')) osc('sine', 150, t, 0.12, 0.5, s.out, { to: 42 });
  if (beat.includes('s')) {
    hiss(t, 0.09, 0.18, s.out, { freq: 1800 });
    osc('triangle', 190, t, 0.05, 0.1, s.out);
  }
  if (beat.includes('h')) hiss(t, 0.025, 0.06, s.out, { freq: 7500 });
}

function note(v, f, t, len, out) {
  const o = ac.createOscillator(), gn = ac.createGain();
  if (waves[v.wave]) o.setPeriodicWave(waves[v.wave]);
  else o.type = v.wave;
  o.frequency.value = f;
  const a = v.attack ?? 0.01, end = t + len * 0.92;
  gn.gain.setValueAtTime(0, t);
  gn.gain.linearRampToValueAtTime(v.vol, t + a);
  gn.gain.exponentialRampToValueAtTime(v.vol * 0.55, Math.max(t + a + 0.01, end - 0.02));
  gn.gain.linearRampToValueAtTime(0, end);
  o.connect(gn);
  gn.connect(out);
  o.start(t);
  o.stop(end + 0.02);
}
