// 게임 데이터: 시대·적·무기·보스의 이름·문구·수치. 밸런스와 문구는 여기서만 고치면 된다.
// 그림은 maps.js(맵), enemy-sprites.js(적), items.js(아이콘·투사체), sprites.js(주인공)에 있다.

export const ERA_SECONDS = 60;
// 시연하기: 발표 때 빨리 보여 주려고 라운드를 줄이고, 적과 경험치를 늘리고, 보스전도 짧게 한다
export const DEMO = { eraSeconds: 15, spawn: 1.6, xp: 3, boss: 0.4 };

export const ERAS = [
  {
    stage: '어린 시절', title: '일산의 꼬마 마스터',
    event: '일산에서 태어나 알미공원에서 인라인과 자전거를 익히고, 발레와 바이올린을 배워 콩쿠르 수상!',
    look: 'elem',
    enemies: { basic: { name: '넘어지는 인라인' }, fast: { name: '도망가는 자전거 바퀴' }, tank: { name: '끝나지 않는 연습곡' } },
    weapons: ['pencil', 'inline', 'abc'],
  },
  {
    stage: '학창 시절', title: '흑석동 전교 1등과 경문고의 소환사',
    event: '백석동에서 흑석동으로 이사! 전교 1등을 거쳐 경문고에서는 롤에 푹 빠졌다.',
    look: 'school',
    enemies: { basic: { name: '밀려오는 시험지' }, fast: { name: '랭크전 연패' }, tank: { name: '끝없는 숙제 산더미' } },
    weapons: ['ball', 'vote', 'heart'],
  },
  {
    stage: '새로운 도전', title: '재수 끝에 만난 프랑스어',
    event: '재수를 거쳐 한양대 ERICA에서 프랑스어를 공부하다.',
    look: 'college',
    enemies: { basic: { name: '프랑스어 단어장' }, fast: { name: '불규칙 동사' }, tank: { name: '두꺼운 프랑스어 사전' } },
    weapons: ['vocal', 'minji', 'cram'],
  },
  {
    stage: '군 복무', title: '청와대의 든든한 경비',
    event: '대통령 경호처에서 청와대 군 복무!',
    look: 'army', formation: true,
    enemies: { basic: { name: '반짝이는 경계 알림' }, fast: { name: '분주한 순찰 일정' }, tank: { name: '묵직한 책임감' } },
    weapons: ['drill', 'stealth', 'gift'],
  },
  {
    stage: '30살(진)', title: '문과에서 AI 개발자로 진화!',
    event: '가천대학교 AI 소프트웨어 공학과, MacBook 개발 그리고 플래드랩스!',
    look: 'worker',
    enemies: { basic: { name: '빨간 에러 메시지' }, fast: { name: '밀려오는 알림' }, tank: { name: '끝나지 않는 요구사항' } },
    weapons: ['agents', 'todo', 'plaf'],
  },
];

// 시대가 지날수록 적이 단단해진다 (지난 시대 무기가 계속 쌓이므로)
export const ERA_HP = [1, 2.4, 4.4, 7, 11];
// 시대마다 레벨업이 5번 안팎이 되도록 경험치 가치를 맞춘다
export const ERA_XP = [0.65, 0.65, 0.75, 0.7, 1.3];
export const ERA_SPAWN = [
  { base: 2.0, grow: 2.6 },
  { base: 3.4, grow: 4.2 },
  { base: 4.4, grow: 4.8 },
  { base: 5.4, grow: 5.4 },
  { base: 7.5, grow: 8.0 },
];

export const ENEMY_TYPES = {
  basic: { hp: 8, speed: 34, dmg: 12, xp: 1, size: 18, r: 7 },
  fast: { hp: 5, speed: 66, dmg: 9, xp: 1, size: 15, r: 6 },
  tank: { hp: 45, speed: 24, dmg: 18, xp: 5, size: 28, r: 10 },
};

export const PLAYER = { hp: 100, speed: 86, magnet: 52, radius: 7 };

export function xpToNext(level) {
  return 5 + level * 4;
}

export const WEAPONS = {
  // ── 시대 1 · 서울 ──
  pencil: {
    name: '콩쿠르의 바이올린 활',
    quote: '바이올린 콩쿠르에서 갈고닦은 활 솜씨!',
    levels: [
      { text: '가까운 적에게 바이올린 활 발사 (2마리 관통)', cd: 0.85, count: 1, pierce: 2, dmg: 10 },
      { text: '관통 +1', cd: 0.85, count: 1, pierce: 3, dmg: 10 },
      { text: '활 +1', cd: 0.85, count: 2, pierce: 3, dmg: 10 },
      { text: '데미지 +50%', cd: 0.85, count: 2, pierce: 3, dmg: 15 },
      { text: '활 3개를 부채꼴로, 관통 +1', cd: 0.8, count: 3, pierce: 4, dmg: 15 },
    ],
  },
  inline: {
    name: '알미공원 인라인',
    quote: '바람을 가르며 알미공원을 질주한다',
    passive: true,
    levels: [
      { text: '이동속도 +10%', speed: 0.1 },
      { text: '이동속도 +10%', speed: 0.2 },
      { text: '이동속도 +10%', speed: 0.3 },
      { text: '이동속도 +10%', speed: 0.4 },
      { text: '이동속도 +10%', speed: 0.5 },
    ],
  },
  abc: {
    name: '발레 스텝',
    quote: '빙글빙글 돌며 발레 슈즈가 사방으로 흩어진다',
    levels: [
      { text: '발레 슈즈 4개를 아무 방향으로 흩뿌림', cd: 1.2, n: 4, dmg: 8 },
      { text: '슈즈 +1', cd: 1.2, n: 5, dmg: 8 },
      { text: '데미지 +50%', cd: 1.2, n: 5, dmg: 12 },
      { text: '슈즈 +2', cd: 1.2, n: 7, dmg: 12 },
      { text: '슈즈 26개가 사방으로 터짐', cd: 1.6, n: 26, dmg: 14, ring: true },
    ],
  },

  // ── 시대 2 · 인천 ──
  ball: {
    name: '랭크전 탱탱볼',
    quote: '경문고 소환사의 연패를 튕겨낸다',
    levels: [
      { text: '적에 맞으면 다음 적에게 튕김 (3번)', cd: 1.5, balls: 1, bounces: 3, dmg: 14 },
      { text: '튕기는 횟수 +1', cd: 1.5, balls: 1, bounces: 4, dmg: 14 },
      { text: '컨트롤러 +1', cd: 1.5, balls: 2, bounces: 4, dmg: 14 },
      { text: '데미지 +40%', cd: 1.5, balls: 2, bounces: 5, dmg: 20 },
      { text: '튕기는 횟수 +2', cd: 1.4, balls: 2, bounces: 7, dmg: 20 },
    ],
  },
  vote: {
    name: '전교 1등 집중력',
    quote: '집중해서 경험치를 쏙쏙 끌어모은다',
    passive: true,
    levels: [
      { text: '경험치 끌어당기는 범위 +30%', magnet: 0.3, xp: 0 },
      { text: '범위 +20%, 경험치 획득 +10%', magnet: 0.5, xp: 0.1 },
      { text: '범위 +20%, 경험치 획득 +10%', magnet: 0.7, xp: 0.2 },
      { text: '범위 +20%, 경험치 획득 +10%', magnet: 0.9, xp: 0.3 },
      { text: '범위 +30%, 경험치 획득 +10%', magnet: 1.2, xp: 0.4 },
    ],
  },
  heart: {
    name: '문제 풀이의 번뜩임',
    quote: '풀었다! 주변까지 깨달음이 번진다',
    levels: [
      { text: '하트가 맞은 자리에서 터짐', cd: 1.4, n: 1, radius: 40, dmg: 12 },
      { text: '폭발 범위 +25%', cd: 1.4, n: 1, radius: 50, dmg: 12 },
      { text: '하트 +1', cd: 1.4, n: 2, radius: 50, dmg: 14 },
      { text: '데미지 +30%, 범위 +20%', cd: 1.4, n: 2, radius: 60, dmg: 18 },
      { text: '하트 +1, 범위 +15%', cd: 1.3, n: 3, radius: 70, dmg: 22 },
    ],
  },

  // ── 시대 3 · 가천대 ──
  vocal: {
    name: '봉주르 음파',
    quote: '프랑스어 인사가 음파가 되어 퍼진다',
    levels: [
      { text: '이동 방향 앞으로 음파를 쏴서 밀어냄', cd: 1.4, arc: 60, range: 90, dmg: 14 },
      { text: '각도·사거리 증가', cd: 1.4, arc: 75, range: 105, dmg: 14 },
      { text: '데미지 +35%', cd: 1.4, arc: 75, range: 110, dmg: 19 },
      { text: '각도·사거리 증가', cd: 1.3, arc: 95, range: 125, dmg: 19 },
      { text: '앞줄 전멸 각도', cd: 1.2, arc: 130, range: 145, dmg: 26 },
    ],
  },
  minji: {
    name: '재수 끝의 성장',
    quote: '포기하지 않고 쌓은 힘이 모든 능력치를 올린다',
    passive: true,
    levels: [
      { text: '공격력·이동속도·최대 체력·공격 속도 +5%', all: 0.05 },
      { text: '전부 +5%', all: 0.1 },
      { text: '전부 +5%', all: 0.15 },
      { text: '전부 +5%', all: 0.2 },
      { text: '전부 +5%', all: 0.25 },
    ],
  },
  cram: {
    name: '프랑스어 번개 암기',
    quote: '불규칙 동사도 번개처럼 외워보자',
    levels: [
      { text: '아무 적 머리 위로 번개 2개', cd: 1.7, n: 2, dmg: 24 },
      { text: '번개 +1', cd: 1.7, n: 3, dmg: 24 },
      { text: '데미지 +35%', cd: 1.7, n: 3, dmg: 32 },
      { text: '번개 +1', cd: 1.6, n: 4, dmg: 32 },
      { text: '번개 +2, 데미지 +25%', cd: 1.5, n: 6, dmg: 40 },
    ],
  },

  // ── 시대 4 · 21사단 ──
  drill: {
    name: '경호 충격파',
    quote: '집중력과 책임감을 모아 충격파를 날린다',
    levels: [
      { text: '3초마다 원형 충격파 + 공격력 +5%', cd: 3, radius: 75, dmg: 20, atk: 0.05 },
      { text: '범위 증가, 공격력 +5%', cd: 2.7, radius: 88, dmg: 20, atk: 0.1 },
      { text: '데미지 증가, 공격력 +5%', cd: 2.4, radius: 95, dmg: 28, atk: 0.15 },
      { text: '범위 증가, 공격력 +5%', cd: 2.1, radius: 110, dmg: 28, atk: 0.2 },
      { text: '연병장이 울린다, 공격력 +5%', cd: 1.8, radius: 130, dmg: 36, atk: 0.25 },
    ],
  },
  stealth: {
    name: '철통 방어',
    quote: '방심하지 않는 경계의 힘',
    passive: true,
    levels: [
      { text: '10% 확률로 피해 무시', dodge: 0.1 },
      { text: '회피 확률 +5%p', dodge: 0.15 },
      { text: '회피 확률 +5%p', dodge: 0.2 },
      { text: '회피 확률 +5%p', dodge: 0.25 },
      { text: '회피 확률 +5%p', dodge: 0.3 },
    ],
  },
  gift: {
    name: '잠깐의 휴식',
    quote: '다음 도전을 위해 체력을 회복한다',
    passive: true,
    levels: [
      { text: '1초마다 체력 0.5 회복', regen: 0.5 },
      { text: '회복량 증가 (1/초)', regen: 1 },
      { text: '회복량 증가 (1.5/초)', regen: 1.5 },
      { text: '회복량 증가 (2/초)', regen: 2 },
      { text: '회복량 증가 (3/초)', regen: 3 },
    ],
  },

  // ── 시대 5 · 플래드랩스 ──
  agents: {
    name: 'AI 에이전트 군단',
    quote: '아이디어를 함께 실험하는 에이전트 출동!',
    levels: [
      { text: '에이전트 2개가 돌면서 유도 미사일 발사', cd: 1.3, agents: 2, missiles: 1, dmg: 16 },
      { text: '에이전트 +1 (병렬 처리)', cd: 1.3, agents: 3, missiles: 1, dmg: 16 },
      { text: '미사일 +1', cd: 1.3, agents: 3, missiles: 2, dmg: 16 },
      { text: '에이전트 +1, 데미지 +25%', cd: 1.2, agents: 4, missiles: 2, dmg: 20 },
      { text: '에이전트 +1, 데미지 +25%', cd: 1.1, agents: 5, missiles: 2, dmg: 25 },
    ],
  },
  todo: {
    name: 'PM의 우선순위 정리',
    quote: '무엇부터 할지 정하면 손도 빨라진다',
    passive: true,
    levels: [
      { text: '공격 속도 +25%', atkSpeed: 0.25 },
      { text: '공격 속도 +15%', atkSpeed: 0.4 },
      { text: '공격 속도 +15%', atkSpeed: 0.55 },
      { text: '공격 속도 +15%', atkSpeed: 0.7 },
      { text: '공격 속도 +15%', atkSpeed: 0.85 },
    ],
  },
  plaf: {
    name: 'MacBook 코드 부메랑',
    quote: '코드는 돌아오고, 다시 고치며 성장한다',
    levels: [
      { text: '던지면 나갔다가 돌아오며 두 번 때림', cd: 1.9, n: 1, size: 1, dmg: 18 },
      { text: '부메랑 +1', cd: 1.9, n: 2, size: 1, dmg: 18 },
      { text: '크기·데미지 증가', cd: 1.9, n: 2, size: 1.35, dmg: 24 },
      { text: '부메랑 +1', cd: 1.8, n: 3, size: 1.35, dmg: 24 },
      { text: '매주 정기 활동: 사방으로 8개', cd: 1.8, n: 8, size: 1.5, dmg: 30, allDirs: true },
    ],
  },
};

// 시대가 끝나면(1분) 나오는 보스. 그 시절 이길 수 없었던 일이라 쓰러져야 다음 시대로 넘어간다.
// time: 이 시간이 지나면 피할 수 없는 마지막 한 방. contact: 몸에 닿으면 받는 피해(0이면 닿아도 안 아픔)
export const BOSSES = [
  { id: 'study', name: '콩쿠르의 떨림', time: 30, contact: 14, r: 19 },
  { id: 'friend', name: '시험과 랭크의 유혹', time: 35, contact: 0, r: 14 },
  { id: 'notice', name: '재수의 높은 벽', time: 40, contact: 18, r: 22 },
  { id: 'night', name: '끝나지 않는 야간 경계', time: 45, contact: 0, r: 15 },
  { id: 'calls', name: '삼두의 마감', time: 50, contact: 0, r: 19 },
];

// 보스 탄 피해 (rain은 맞으면 잠깐 느려진다)
export const BULLET_DMG = { xmark: 14, grayball: 16, mail: 18, fog: 20, ring: 21, rain: 5 };

export const HEAL_CARD = {
  name: '체력 회복',
  quote: '밥은 먹고 다니자',
  text: '체력 40 회복',
  heal: 40,
};
