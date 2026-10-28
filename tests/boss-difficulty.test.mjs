import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.addEventListener = () => {};
globalThis.document = { addEventListener: () => {} };
const { updateBullets } = await import('../src/boss.js');

function damageFrom(bullet) {
  const hits = [];
  const game = { player: { x: 0, y: 14 }, bullets: [bullet] };
  updateBullets(game, 0, { view: { x: -100, y: -100, w: 200, h: 200 }, hurt: (damage, options) => hits.push({ damage, options }) });
  return hits;
}

test('최종 보스 충격파는 21의 피해를 준다', () => {
  const hits = damageFrom({ kind: 'ring', x: -10, y: 0, r: 10, speed: 0, max: 100, life: 10, gap: Math.PI, gapHalf: 0.3 });
  assert.equal(hits[0].damage, 21);
});

test('최종 보스 빗방울은 둔화 효과와 함께 5의 피해를 준다', () => {
  const hits = damageFrom({ kind: 'rain', x: 0, y: 0, vx: 0, vy: 0, r: 2, life: 10, slow: true });
  assert.equal(hits[0].damage, 5);
  assert.deepEqual(hits[0].options, { slow: 1 });
});

test('다른 보스의 봉투 공격 피해는 유지된다', () => {
  const hits = damageFrom({ kind: 'mail', x: 0, y: 0, vx: 0, vy: 0, r: 4, life: 10 });
  assert.equal(hits[0].damage, 18);
});
