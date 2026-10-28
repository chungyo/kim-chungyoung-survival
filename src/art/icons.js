// 인생의 장면을 아이템으로 바꾼 오리지널 픽셀 아이콘.
import { makeCanvas } from '../pixel.js';
const R=(c,x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
const K='#27334b', W='#f9edda', T='#70d2c3', Y='#f8c778', Rr='#ee8a80', U='#9a91c4';
function draw(c,id){
 // 대부분 아이콘을 감싸는 그림자와 빛은 게임의 다른 도트와 같은 크기다.
 if(id==='pencil'){ // 바이올린 활과 바이올린
  R(c,5,7,12,13,K);R(c,7,8,8,11,'#bd735d');R(c,9,4,4,16,'#e5a878');R(c,10,2,2,4,K);R(c,5,13,12,2,'#f7d8a7');R(c,18,3,2,18,W);
 }else if(id==='inline'){R(c,5,4,9,12,K);R(c,7,5,7,9,Y);R(c,5,14,15,5,K);R(c,6,15,13,3,Rr);R(c,7,19,4,4,K);R(c,15,19,4,4,K);R(c,8,20,2,2,T);R(c,16,20,2,2,T);
 }else if(id==='abc'){ // 발레 슈즈
  R(c,5,12,7,8,K);R(c,6,11,5,7,'#f5c4bf');R(c,12,8,7,11,K);R(c,13,7,5,10,'#f5c4bf');R(c,7,4,2,8,Rr);R(c,15,2,2,7,Rr);R(c,5,8,5,2,Rr);
 }else if(id==='ball'){ // 게임 컨트롤러
  R(c,3,7,18,12,K);R(c,5,8,14,9,'#9085bd');R(c,7,10,5,2,W);R(c,8,9,2,5,W);R(c,16,10,2,2,Y);R(c,14,13,2,2,Rr);R(c,2,15,4,5,K);R(c,18,15,4,5,K);
 }else if(id==='vote'){ // 전교 1등 트로피
  R(c,7,4,10,10,K);R(c,9,5,6,8,Y);R(c,4,5,3,7,Y);R(c,17,5,3,7,Y);R(c,10,14,4,4,K);R(c,7,18,10,3,Y);R(c,6,21,12,2,K);
 }else if(id==='heart'){ // 아이디어 전구
  R(c,7,4,10,12,K);R(c,8,5,8,9,Y);R(c,10,15,4,3,'#f1dbb0');R(c,9,19,6,2,K);R(c,11,8,2,5,W);R(c,3,6,2,2,Y);R(c,19,6,2,2,Y);
 }else if(id==='vocal'){ // 봉주르 소리
  R(c,3,7,8,10,K);R(c,5,9,4,6,T);R(c,11,9,4,6,'#f1d9bc');R(c,15,7,3,10,Rr);R(c,19,6,2,12,W);
 }else if(id==='minji'){ // 성장하는 책
  R(c,3,8,18,13,K);R(c,5,9,7,10,'#f3e3c9');R(c,12,9,7,10,'#eacdb9');R(c,11,8,2,12,K);R(c,7,12,3,1,Rr);R(c,15,12,3,1,T);R(c,10,4,4,3,Y);
 }else if(id==='cram'){R(c,12,2,6,2,Y);R(c,9,4,7,5,Y);R(c,7,9,8,4,Y);R(c,10,13,5,3,Y);R(c,7,16,5,5,Y);R(c,5,21,5,2,Rr);
 }else if(id==='drill'){ // 경호 방패
  R(c,4,3,16,14,K);R(c,6,5,12,12,'#6799aa');R(c,8,17,8,3,'#6799aa');R(c,10,20,4,2,'#6799aa');R(c,10,7,4,8,Y);
 }else if(id==='stealth'){R(c,6,3,12,18,K);R(c,8,5,8,14,'#7292ad');R(c,11,8,2,7,W);R(c,4,9,2,7,T);R(c,18,9,2,7,T);
 }else if(id==='gift'){R(c,4,8,16,12,K);R(c,6,10,12,8,'#f0d7c8');R(c,10,11,4,6,Rr);R(c,9,12,6,4,Rr);R(c,7,4,10,4,'#9ac4b6');
 }else if(id==='agents'){R(c,4,6,16,14,K);R(c,6,8,12,10,T);R(c,8,10,3,3,K);R(c,14,10,3,3,K);R(c,10,3,4,3,Y);R(c,2,11,2,5,T);R(c,20,11,2,5,T);
 }else if(id==='todo'){R(c,5,4,14,18,K);R(c,7,5,10,15,W);for(let y=8;y<=16;y+=4){R(c,8,y,2,2,T);R(c,12,y,4,1,'#7f8e9e');}R(c,9,2,6,3,Y);
 }else if(id==='plaf'){R(c,3,5,18,13,K);R(c,5,7,14,9,'#547590');R(c,7,9,5,1,T);R(c,7,12,9,1,Y);R(c,2,18,20,3,'#c3c6c1');R(c,4,21,16,1,K);
 }else if(id==='heal'){R(c,4,7,16,14,K);R(c,6,9,12,10,'#f0d7c8');R(c,10,10,4,7,Rr);R(c,8,12,8,3,Rr);R(c,8,4,8,3,T);
 }
}
const cache=new Map(), urls=new Map();
export function weaponIcon(id){if(!cache.has(id)){const [img,c]=makeCanvas(24,24);draw(c,id);cache.set(id,img);}return cache.get(id);}
export function iconURL(id,scale=3){const key=`${id}@${scale}`;if(!urls.has(key)){const src=weaponIcon(id),[img,c]=makeCanvas(24*scale,24*scale);c.drawImage(src,0,0,img.width,img.height);urls.set(key,img.toDataURL());}return urls.get(key);}
export function personalizedProjectile(kind){return ({pencil:'pencil',ball:'ball',heart:'heart',boomerang:'plaf',ballet:'abc'})[kind] ? weaponIcon(({pencil:'pencil',ball:'ball',heart:'heart',boomerang:'plaf',ballet:'abc'})[kind]) : null;}
