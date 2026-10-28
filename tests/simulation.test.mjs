import test from 'node:test';
import assert from 'node:assert/strict';

// 브라우저가 아닐 때도 엔진과 새 도트의 연결을 검증하기 위한 최소 DOM/Canvas 구현.
class Context {
  constructor(canvas){this.canvas=canvas;this.fillStyle='#000';this.globalAlpha=1;}
  fillRect(){} clearRect(){} drawImage(){} save(){} restore(){} translate(){} scale(){} rotate(){} setTransform(){}
  beginPath(){} arc(){} stroke(){} fillText(){}
  measureText(text){return {width:String(text).length*7};}
  getImageData(x,y,w,h){return {data:new Uint8ClampedArray(w*h*4)};}
  putImageData(){}
}
class Element {
  constructor(){this.style={};this.dataset={};this.hidden=false;this.innerHTML='';this.textContent='';this.classList={add(){},remove(){},toggle(){}};}
  addEventListener(){} setPointerCapture(){} querySelector(){return new Element();}
  play(){return Promise.resolve();} pause(){}
  querySelectorAll(selector){return Array.from({length:selector==='i'?5:3},()=>new Element());}
  getBoundingClientRect(){return {width:960,height:640,left:0,top:0};}
}
class Canvas extends Element {
  constructor(){super();this.width=1;this.height=1;this.ctx=new Context(this);}
  getContext(){return this.ctx;}
  toDataURL(){return 'data:image/png;base64,AA==';}
}
const nodes=new Map();
globalThis.window=globalThis;
globalThis.innerWidth=960;globalThis.innerHeight=640;globalThis.devicePixelRatio=1;
globalThis.location={search:'?bot&god&pause&demo'};
globalThis.document={createElement(type){return type==='canvas'?new Canvas():new Element();},getElementById(id){if(!nodes.has(id))nodes.set(id,id==='game'?new Canvas():new Element());return nodes.get(id);},addEventListener(){},fonts:{load:()=>Promise.resolve()},hidden:false};
globalThis.addEventListener=()=>{};globalThis.requestAnimationFrame=()=>0;
globalThis.localStorage={getItem(){return null;},setItem(){}};
globalThis.setTimeout=()=>0;globalThis.clearTimeout=()=>{};
await import('../src/main.js');

test('새 맵과 도트로 시연 모드가 모든 시대를 거쳐 엔딩에 도달한다',()=>{
 const result=globalThis.__sim(300);
 assert.equal(result.mode,'clear');assert.equal(result.era,4);
 assert.match(nodes.get('overlay').innerHTML,/<video/);
 nodes.get('ending-skip').onclick();
 assert.match(nodes.get('overlay').innerHTML,/30살\(진\), 아직 성장 중/);
 nodes.get('replay-ending').onclick();
 assert.match(nodes.get('overlay').innerHTML,/<video/);
 nodes.get('ending-video').onended();
 assert.match(nodes.get('overlay').innerHTML,/30살\(진\), 아직 성장 중/);
 nodes.get('go').onclick();
 assert.equal(globalThis.__game.mode,'transition');
 assert.equal(nodes.get('hud').hidden,false);
});
