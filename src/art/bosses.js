// 다섯 시기의 도전을 상징하는 오리지널 보스 도트.
import { makeCanvas, silhouette } from '../pixel.js';
const R=(c,x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
const K='#282a40', W='#f5e6d2', Y='#f2bd6f', T='#73c8bb', U='#a995c4', Red='#e77c75';
function frame(id,f){
 const [img,c]=makeCanvas(64,64), bob=f%2;
 // 공통 그림자 / 몸체
 R(c,12,51,40,5,'#3d344c'); R(c,10,29+bob,44,21,K);R(c,13,31+bob,38,17,'#4c536e');
 if(id==='study'){ // 연습을 거듭하는 거대한 악기
  R(c,24,7+bob,16,36,K);R(c,27,8+bob,10,33,'#c47b62');R(c,22,14+bob,20,9,'#dda17a');R(c,20,29+bob,24,10,'#dda17a');R(c,29,3+bob,6,7,K);R(c,31,8+bob,2,29,W);R(c,18,8+bob,2,35,W);R(c,46,19+bob,4,4,Y);
 }else if(id==='friend'){ // 성적표와 게임기
  R(c,13,8+bob,38,28,K);R(c,16,10+bob,32,23,'#a48fb4');R(c,19,13+bob,13,17,'#f2dfc5');R(c,34,14+bob,10,9,'#544f71');R(c,37,16+bob,4,2,T);R(c,38,15+bob,2,5,T);R(c,37,26+bob,5,3,Red);
 }else if(id==='notice'){ // 재수의 거대한 책과 프랑스어 낱말
  R(c,11,9+bob,42,29,K);R(c,14,11+bob,17,24,'#e8d8bf');R(c,33,11+bob,17,24,'#c98479');R(c,30,10+bob,3,26,K);for(let yy=16;yy<31;yy+=5){R(c,17,yy+bob,11,2,'#a58d8f');R(c,36,yy+bob,10,2,'#f4dfcb');}
 }else if(id==='night'){ // 야간 경계 등불
  R(c,18,8+bob,28,33,K);R(c,22,12+bob,20,24,'#597d91');R(c,26,16+bob,12,16,Y);R(c,30,3+bob,4,7,'#b9c6bc');R(c,27,0+bob,10,3,'#d2cfaa');R(c,24,38+bob,16,4,'#aac7bd');
 }else { // 버그·AI 환각·요구사항의 세 얼굴
  for(const [x,y,col] of [[9,16,Red],[25,8,U],[41,16,Y]]){R(c,x,y+bob,15,15,K);R(c,x+2,y+2+bob,11,11,col);R(c,x+4,y+5+bob,2,2,W);R(c,x+9,y+5+bob,2,2,W);R(c,x+5,y+10+bob,5,1,K);}
  R(c,22,31+bob,20,12,'#24344e');R(c,25,34+bob,14,2,T);R(c,28,38+bob,8,2,W);
 }
 return img;
}
const cache=new Map();
export function bossSprite(id){
 if(!cache.has(id)){const frames=[0,1,2,3].map(f=>frame(id,f));cache.set(id,{w:64,h:64,footY:63,frames,white:frames.map(img=>silhouette(img,'#ffffff'))});}return cache.get(id);
}
