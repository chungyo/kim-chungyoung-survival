// 시대별 충영과 경험에서 태어난 적 도트.
import { makeCanvas, mirrorX, silhouette, outlined } from '../pixel.js';
const R=(c,x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
const ink='#29243b', skin='#efb393', hair='#292b3f';
const costumes={
 elem:{top:'#ffbb65',shade:'#d87c70',bottom:'#608ca1',accent:'#f8e4ba'},
 school:{top:'#506790',shade:'#3d4f73',bottom:'#384057',accent:'#f0d4bc'},
 college:{top:'#c76a69',shade:'#904f65',bottom:'#475c76',accent:'#f1e8d4'},
 army:{top:'#385c7c',shade:'#304a65',bottom:'#2c405b',accent:'#e9c780'},
 worker:{top:'#4faaa1',shade:'#387d82',bottom:'#373b56',accent:'#e8cc90'},
};
export const PLAYER_W=20, PLAYER_H=34, PLAYER_FOOT=33;
function person(look,dir,frame){
 const [img,c]=makeCanvas(20,34), s=costumes[look];
 const bob=frame%2, side=dir==='right', back=dir==='up', walk=frame===1?1:frame===3?-1:0;
 // 그림자가 아닌 신발과 걸음은 발 기준을 유지한다.
 R(c,5+walk,27,4,5,ink); R(c,11-walk,27,4,5,ink);
 R(c,5+walk,30,5,2,look==='elem'?'#f3c66f':'#e7dfcf'); R(c,11-walk,30,5,2,look==='elem'?'#f3c66f':'#e7dfcf');
 R(c,5,23,10,5,s.bottom);R(c,4,14+bob,12,10,s.shade);R(c,5,13+bob,10,10,s.top);
 R(c,3,15+bob,2,7,ink);R(c,15,15+bob,2,7,ink);R(c,3,19+bob,2,3,skin);R(c,15,19+bob,2,3,skin);
 if(look==='elem'){R(c,4,16+bob,2,6,'#b65462');R(c,14,16+bob,2,6,'#b65462');}
 if(look==='worker'){R(c,7,17+bob,6,5,'#e8e2c9');R(c,8,18+bob,4,2,'#6797b3');}
 if(look==='army'){R(c,8,15+bob,4,3,'#d4bc80');R(c,4,13+bob,12,2,'#c6ab76');}
 if(look==='college'){R(c,8,14+bob,3,6,'#f3e5d2');R(c,11,14+bob,2,6,'#6685b6');}
 if(look==='school'){R(c,8,14+bob,4,4,'#ece1d0');R(c,9,15+bob,2,4,'#c87475');}
 R(c,5,4+bob,10,10,ink);R(c,6,5+bob,8,8,back?hair:skin);
 R(c,4,3+bob,12,4,hair);R(c,5,2+bob,10,3,hair);R(c,5,6+bob,2,3,hair);
 if(!back){
   if(side){R(c,12,8+bob,2,2,ink);R(c,14,9+bob,2,2,skin);}
   else {R(c,7,8+bob,1,2,ink);R(c,12,8+bob,1,2,ink);R(c,9,11+bob,3,1,'#bc6b69');}
   if(look==='elem') { R(c,5,7+bob,10,1,ink);R(c,5,9+bob,4,1,ink);R(c,11,9+bob,4,1,ink);R(c,5,7+bob,1,3,ink);R(c,8,7+bob,1,3,ink);R(c,11,7+bob,1,3,ink);R(c,14,7+bob,1,3,ink); }
 }
 if(look==='army'){R(c,4,2+bob,12,3,'#345779');R(c,6,1+bob,8,2,'#446f8d');}
 return img;
}
const playerCache=new Map();
export function playerSprite(look){
 if(!playerCache.has(look)){
  const down=[0,1,2,3].map(f=>person(look,'down',f)), up=[0,1,2,3].map(f=>person(look,'up',f));
  const right=[0,1,2,3].map(f=>person(look,'right',f)),left=right.map(mirrorX);
  playerCache.set(look,{down,up,right,left,downright:right,downleft:left,upright:right,upleft:left});
 }
 return playerCache.get(look);
}
export function playerDataURL(look,scale=6){const src=playerSprite(look).down[0], [c,ctx]=makeCanvas(src.width*scale,src.height*scale);ctx.drawImage(src,0,0,c.width,c.height);return c.toDataURL();}

// 개별 테마: 스케이트/바퀴/악보, 시험/게임/책, 단어/동사/사전,
// 알림/순찰/방패, 버그/알림/요구사항. 눈을 달아 적으로 보이게 한다.
function drawEnemy(c,era,type,f){
 const y=f%2, tank=type===2, x=tank?2:4, w=tank?24:20;
 const color=[['#ec9479','#f0c165','#ba82a1'],['#f2dbc3','#9a81b7','#b98e76'],['#85a4be','#e8e0c9','#c57970'],['#f0bf73','#81b3bd','#7297aa'],['#ec847c','#e7bd73','#967fb6']][era][type];
 if(era===0 && type===1){ // 도망가는 자전거 바퀴
  c.strokeStyle=ink;c.lineWidth=3;c.beginPath();c.arc(14,13+y,9,0,Math.PI*2);c.stroke(); c.strokeStyle=color;c.lineWidth=3;c.beginPath();c.arc(14,13+y,6,0,Math.PI*2);c.stroke();R(c,13,5+y,2,17,ink);R(c,6,12+y,16,2,ink);
 } else if(era===0 && type===0){ // 인라인
  R(c,7,5+y,11,12,ink);R(c,8,6+y,9,9,color);R(c,7,15+y,15,5,ink);R(c,8,16+y,13,3,'#f5dfbb');R(c,8,21+y,4,4,ink);R(c,17,21+y,4,4,ink);
 } else if(era===3 && type===2){ // 묵직한 경계 방패
  R(c,x,3+y,w,17,ink);R(c,x+2,5+y,w-4,13,color);R(c,x+5,18+y,w-10,5,color);R(c,12,7+y,4,11,'#e8d4a1');
 } else if(era===4 && type===0){ // 버그
  R(c,5,8+y,18,13,ink);R(c,7,9+y,14,10,color);R(c,11,5+y,6,4,color);for(const xx of [2,23]) for(const yy of [9,15])R(c,xx,yy+y,3,2,ink);
 } else if(type===1 && (era===1||era===4)){ // 게임기 / 알림
  R(c,x,5+y,w,16,ink);R(c,x+2,7+y,w-4,12,color);
  if(era===1){R(c,7,10+y,7,7,'#4e536e');R(c,10,8+y,2,11,'#4e536e');R(c,19,10+y,3,3,'#f8e6d5');}
  else {R(c,9,8+y,10,7,'#f5e6cd');R(c,13,17+y,3,2,'#c76762');}
 } else { // 표지, 종이, 책, 단어 카드
  R(c,x,4+y,w,19,ink);R(c,x+2,6+y,w-4,15,color);R(c,x+4,8+y,w-8,2,'#f8e7ce');
  if(tank){R(c,x+3,19+y,w-6,2,'#f8e7ce');R(c,x+6,11+y,w-12,2,'#735c70');}
  else {R(c,x+4,12+y,w-8,1,'#9c7f84');R(c,x+4,15+y,w-8,1,'#9c7f84');}
 }
 // 눈과 발은 모든 적에 공통으로 있어 정적 오브젝트와 구분된다.
 R(c,9,11+y,3,3,ink);R(c,17,11+y,3,3,ink);R(c,10,11+y,1,1,'#fff8e9');R(c,18,11+y,1,1,'#fff8e9');
 R(c,8,24,4,2,ink);R(c,16,24,4,2,ink);
}
const enemyCache=new Map();
export function enemySprite(era,type){
 const key=`${era}:${type}`; if(enemyCache.has(key))return enemyCache.get(key);
 const ti={basic:0,fast:1,tank:2}[type];if(ti===undefined||era<0||era>4)throw new Error(`unknown enemy ${key}`);
 const frames={};for(const dir of ['down','up','left','right'])frames[dir]=[0,1,2,3].map(f=>{const [img,c]=makeCanvas(28,27);drawEnemy(c,era,ti,f);return img;});
 const white={};for(const dir of Object.keys(frames))white[dir]=frames[dir].map(img=>silhouette(img,'#ffffff'));
 const set={w:28,h:27,footY:26,frames,white};enemyCache.set(key,set);return set;
}
