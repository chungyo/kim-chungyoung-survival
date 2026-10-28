import test from 'node:test';
import assert from 'node:assert/strict';
import { ERAS, WEAPONS, BOSSES } from '../src/data.js';

test('다섯 시대에 실제 인생의 핵심 장면이 담긴다', () => {
  assert.equal(ERAS.length, 5);
  const story = ERAS.map(({ title, event, stage }) => `${title} ${event} ${stage}`).join(' ');
  for (const word of ['일산', '알미공원', '흑석동', '경문고', '재수', '한양대', '프랑스어', '청와대', '가천', '플래드랩스']) {
    assert.ok(story.includes(word), `${word} 누락`);
  }
  assert.equal(ERAS[0].stage, '어린 시절');
  assert.equal(ERAS[4].stage, '30살(진)');
});

test('각 시대에는 정상적으로 연결된 무기 세 개와 보스가 있다', () => {
  assert.equal(BOSSES.length, ERAS.length);
  for (const era of ERAS) {
    assert.equal(era.weapons.length, 3);
    for (const id of era.weapons) assert.ok(WEAPONS[id]?.levels.length > 0, id);
  }
  assert.equal(BOSSES.at(-1).name, '삼두의 마감');
});
