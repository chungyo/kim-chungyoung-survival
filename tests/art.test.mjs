import test from 'node:test';
import assert from 'node:assert/strict';

// 의존성 없이 Canvas 호출 계약을 검사한다. 시각적 판단은 별도 렌더링으로 한다.
class FakeContext {
  constructor(canvas) { this.canvas=canvas; this.fillStyle='#000000'; this.strokeStyle='#000000'; this.ops=[]; }
  fillRect(x,y,w,h) { assert.ok(typeof this.fillStyle==='string' && this.fillStyle.length>0); this.ops.push(['rect',x,y,w,h,this.fillStyle]); }
  drawImage(...args) { assert.ok(args[0]); this.ops.push(['image',args[0].width,args[0].height,...args.slice(1)]); }
  save() {} restore() {} translate() {} scale() {} rotate() {} beginPath() {} arc() {} stroke() {} clearRect() {}
}
class FakeCanvas {
  width=0; height=0;
  constructor(){this.ctx=new FakeContext(this);}
  getContext(type){assert.equal(type,'2d');return this.ctx;}
  toDataURL(){return 'data:image/png;base64,AA==';}
}
globalThis.document={createElement(type){assert.equal(type,'canvas');return new FakeCanvas();}};
const {buildMap}=await import('../src/art/world.js');
const {playerSprite,playerDataURL,enemySprite}=await import('../src/art/characters.js');
const {weaponIcon,iconURL,personalizedProjectile}=await import('../src/art/icons.js');
const {bossSprite}=await import('../src/art/bosses.js');

test('다섯 시대 맵과 시작 지점을 생성한다',()=>{
 const maps=[0,1,2,3,4].map(buildMap);
 for(const m of maps){assert.equal(m.w,1200);assert.equal(m.h,900);assert.ok(m.props.length>=10);assert.ok(m.ground.ctx.ops.length>100);assert.ok(!m.obstacles.some(o=>m.start.x>=o.x && m.start.x<o.x+o.w && m.start.y>=o.y && m.start.y<o.y+o.h));}
 assert.equal(new Set(maps.map(m=>m.ground.ctx.ops[0].at(-1))).size,5);
});

test('모든 시대 캐릭터와 적 스프라이트가 각 방향과 피격 상태를 제공한다',()=>{
 for(const look of ['elem','school','college','army','worker']){
  const player=playerSprite(look);
  for(const d of ['down','up','left','right','downleft','downright','upleft','upright'])assert.equal(player[d].length,4);
  assert.match(playerDataURL(look),/^data:image\/png/);
 }
 for(let era=0;era<5;era++)for(const type of ['basic','fast','tank']){
  const e=enemySprite(era,type);assert.equal(e.w,28);assert.equal(e.footY,26);
  for(const dir of ['down','up','left','right']){assert.equal(e.frames[dir].length,4);assert.equal(e.white[dir].length,4);assert.ok(e.frames[dir][0].ctx.ops.length>0);}
 }
});

test('열다섯 아이콘과 다섯 보스가 실제 그리기 명령을 제공한다',()=>{
 const ids=['pencil','inline','abc','ball','vote','heart','vocal','minji','cram','drill','stealth','gift','agents','todo','plaf','heal'];
 for(const id of ids){assert.ok(weaponIcon(id).ctx.ops.length>0,id);assert.match(iconURL(id),/^data:image\/png/);}
 for(const id of ['study','friend','notice','night','calls']){const b=bossSprite(id);assert.equal(b.frames.length,4);assert.equal(b.white.length,4);assert.ok(b.frames[0].ctx.ops.length>0);}
 for(const kind of ['pencil','ball','heart','boomerang','ballet'])assert.ok(personalizedProjectile(kind));
 assert.equal(personalizedProjectile('gem'),null);
});
