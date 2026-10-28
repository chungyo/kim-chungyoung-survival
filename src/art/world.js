// 김충영의 다섯 시기를 표현하는 오리지널 도트 월드.
import { makeCanvas, rng } from '../pixel.js';

const W = 1200, H = 900;
const palettes = [
  { base: '#8ecb99', light: '#a8dca9', dark: '#6fae85', path: '#e8c991', accent: '#efb96d' },
  { base: '#d9c9a9', light: '#eee0c6', dark: '#baa789', path: '#97a8b5', accent: '#d46d62' },
  { base: '#d5c4ae', light: '#eadcc8', dark: '#bba992', path: '#a4b8c6', accent: '#e39081' },
  { base: '#a1b8a6', light: '#c4c9b0', dark: '#778f80', path: '#d0c8b1', accent: '#557d9d' },
  { base: '#222c49', light: '#303b5a', dark: '#171e36', path: '#354562', accent: '#56cbbd' },
];
const R = (c, x, y, w, h, color) => { c.fillStyle=color; c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h)); };
function tree(c, x, y, scale=1) {
  c.save(); c.translate(x,y); c.scale(scale,scale);
  R(c,-3,-18,6,18,'#72564a'); R(c,-15,-31,30,17,'#437f67'); R(c,-11,-37,22,12,'#529775');
  R(c,-18,-27,36,8,'#4e906e'); R(c,-9,-33,9,4,'#82bd8d'); R(c,7,-27,7,3,'#68ab80'); c.restore();
}
function desk(c,x,y, era) {
  const dark='#433d4e', top=era===4?'#7d6783':'#9a7059';
  R(c,x-20,y-12,40,12,dark); R(c,x-18,y-14,36,10,top); R(c,x-17,y-3,4,8,dark); R(c,x+13,y-3,4,8,dark);
  if (era===4) { R(c,x-11,y-25,22,13,dark); R(c,x-9,y-23,18,9,'#355779'); R(c,x-7,y-21,8,1,'#8de1d1'); R(c,x-7,y-18,12,1,'#f0bb81'); }
  else if (era===1) { R(c,x-10,y-17,20,5,'#f2e8d4'); R(c,x-8,y-16,6,1,'#d17d70'); }
  else { R(c,x-8,y-18,16,6,'#f2e8d4'); R(c,x-6,y-17,6,1,'#7392ad'); }
}
function lamp(c,x,y,accent) {
  R(c,x-2,y-32,4,32,'#414354'); R(c,x-6,y-33,12,4,'#414354'); R(c,x-5,y-37,10,5,accent); R(c,x-3,y-40,6,3,'#f4e6bd');
}
function building(c,x,y,kind) {
  if(kind==='school') {
    R(c,x,y,160,66,'#9a6871'); R(c,x+5,y-8,150,11,'#5b5065'); R(c,x+9,y+4,142,53,'#f0d9bd');
    for(let dx=20;dx<145;dx+=31) { R(c,x+dx,y+14,17,20,'#718da4'); R(c,x+dx+2,y+16,13,16,'#c9dece'); R(c,x+dx+8,y+16,1,16,'#718da4'); }
    R(c,x+65,y+34,31,23,'#876d68'); R(c,x+74,y+39,12,18,'#4a5361');
  } else if(kind==='campus') {
    R(c,x,y,164,58,'#aa8376'); R(c,x+5,y-8,154,10,'#728598'); R(c,x+10,y+2,144,51,'#e9dfcc');
    for(let dx=22;dx<145;dx+=28) {R(c,x+dx,y+11,15,22,'#71879a'); R(c,x+dx+2,y+13,11,18,'#d4e4df');}
    R(c,x+69,y+29,27,24,'#71586a'); R(c,x+6,y-14,40,5,'#526c98'); R(c,x+46,y-14,40,5,'#f5f0e3'); R(c,x+86,y-14,40,5,'#cf7771');
  } else {
    R(c,x,y+13,172,54,'#777c73'); R(c,x+6,y+18,160,43,'#e2dfca');
    for(let dx=15;dx<160;dx+=26) { R(c,x+dx,y+26,16,26,'#748887'); R(c,x+dx+2,y+28,12,22,'#c9ddd2'); }
    R(c,x-8,y+12,188,8,'#355678'); R(c,x+6,y+3,160,9,'#426f94'); R(c,x+20,y-4,132,8,'#527fa5'); R(c,x+34,y-10,104,7,'#658bad');
    R(c,x+74,y+34,25,27,'#66585a');
  }
}
function prop(map, x, y, type, era, scale=1) {
  const [img,c]=makeCanvas(200,100); const ox=100, oy=88;
  if(type==='tree') tree(c,ox,oy,scale);
  else if(type==='desk') desk(c,ox,oy,era);
  else if(type==='lamp') lamp(c,ox,oy,era===4?'#73ded3':'#f4d38e');
  else if(type==='school'||type==='campus'||type==='guard') building(c,ox-86,oy-67,type);
  else if(type==='flower') { R(c,ox-10,oy-6,20,6,'#aa7c66'); R(c,ox-8,oy-9,16,4,'#66a381'); for(let i=0;i<4;i++)R(c,ox-8+i*5,oy-13,3,4,['#f7c6a3','#f7e5b6','#f19e9c'][i%3]); }
  else if(type==='bench') { R(c,ox-20,oy-14,40,5,'#846452');R(c,ox-18,oy-22,36,7,'#b58465');R(c,ox-17,oy-8,4,8,'#5c4a49');R(c,ox+13,oy-8,4,8,'#5c4a49'); }
  else if(type==='book') { R(c,ox-13,oy-16,26,15,'#775e75');R(c,ox-11,oy-19,24,13,'#f4e7cf');R(c,ox,oy-18,1,11,'#bba78d');R(c,ox-8,oy-15,6,1,'#df9e8a');R(c,ox+3,oy-15,6,1,'#82a6ae'); }
  else if(type==='robot') { R(c,ox-12,oy-21,24,20,'#31425c');R(c,ox-10,oy-24,20,15,'#7cd7ce');R(c,ox-7,oy-20,4,4,'#263952');R(c,ox+3,oy-20,4,4,'#263952');R(c,ox-3,oy-27,6,3,'#e6c683'); }
  else if(type==='shield') { R(c,ox-11,oy-23,22,20,'#385c7c');R(c,ox-8,oy-20,16,13,'#aac5c8');R(c,ox-2,oy-18,4,9,'#4c7891'); }
  else if(type==='skate') { R(c,ox-17,oy-15,26,10,'#6d5660');R(c,ox-14,oy-24,14,12,'#e79d7c');R(c,ox-12,oy-22,9,6,'#f6d1a5');R(c,ox-12,oy-4,5,4,'#38465a');R(c,ox+3,oy-4,5,4,'#38465a'); }
  else if(type==='violin') { R(c,ox-4,oy-28,8,19,'#66505b');R(c,ox-9,oy-21,18,14,'#c77e60');R(c,ox-7,oy-19,14,10,'#edae7b');R(c,ox-1,oy-31,2,21,'#f6deb5');R(c,ox+12,oy-27,2,23,'#f6deb5'); }
  else if(type==='game') { R(c,ox-20,oy-18,40,17,'#40455e');R(c,ox-17,oy-16,34,12,'#a18eb9');R(c,ox-12,oy-12,9,3,'#f5e6cc');R(c,ox-9,oy-15,3,9,'#f5e6cc');R(c,ox+9,oy-13,4,4,'#f3c777');R(c,ox+3,oy-9,3,3,'#ed8c80'); }
  else if(type==='flag') { R(c,ox-13,oy-29,3,29,'#605d70');R(c,ox-10,oy-28,8,17,'#5b84b2');R(c,ox-2,oy-28,8,17,'#f6e6ce');R(c,ox+6,oy-28,8,17,'#db827b'); }
  const px=x-ox, py=y-oy;
  map.props.push({img,x:px,y:py,baseY:y});
  if(['tree','desk','school','campus','guard','bench'].includes(type)) {
    const hw=['school','campus','guard'].includes(type)?65:type==='tree'?10:16;
    map.obstacles.push({x:x-hw,y:y-6,w:hw*2,h:10});
  }
}
function ground(c,era,p) {
  const rand=rng(20261028+era*71); R(c,0,0,W,H,p.base);
  for(let y=0;y<H;y+=24) for(let x=0;x<W;x+=24) {
    const v=rand(); if(v<.16) R(c,x,y,24,24,p.light); else if(v<.26) R(c,x,y,24,24,p.dark);
    if(era!==0) {R(c,x,y,24,1,p.dark); R(c,x,y,1,24,p.dark);} else if(v>.65) {R(c,x+7,y+9,2,2,p.dark);R(c,x+14,y+14,2,2,p.light);}
  }
  if(era===0) {
    R(c,0,375,W,125,p.path); R(c,0,380,W,3,'#f4dab1'); R(c,0,494,W,3,'#c59d73');
    R(c,370,0,100,H,p.path); R(c,374,0,3,H,'#f4dab1');
    R(c,750,510,310,190,'#5c9ea9'); R(c,770,526,270,158,'#88c6c3');
    for(let i=0;i<9;i++)R(c,790+i*29,550+(i%3)*35,18,2,'#bce0d3');
  } else if(era===1) {
    R(c,0,410,W,110,p.path); R(c,0,410,W,3,'#d7e5dd');R(c,0,517,W,3,'#6d8796');
    for(let x=70;x<W;x+=160){R(c,x,452,80,3,'#dce6de');}
  } else if(era===2) {
    R(c,0,390,W,120,p.path); R(c,0,390,W,4,'#8099a8');
    for(let x=40;x<W;x+=120){R(c,x,420,54,2,'#d8e1d8');R(c,x+25,470,54,2,'#d8e1d8');}
  } else if(era===3) {
    R(c,0,400,W,100,p.path);R(c,540,0,120,H,p.path);
    for(let y=20;y<H;y+=60)R(c,590,y,20,3,'#e8e0c5');
  } else {
    R(c,0,390,W,120,p.path);R(c,0,390,W,3,'#5c7c89');R(c,0,507,W,3,'#5c7c89');
    for(let x=40;x<W;x+=140){R(c,x,446,50,2,'#64d0bf');R(c,x+25,460,2,12,'#64d0bf');R(c,x+25,470,30,2,'#64d0bf');}
  }
}
const cache=new Map();
export function buildMap(era) {
  if(cache.has(era)) return cache.get(era);
  if(!palettes[era]) throw new Error(`unknown era: ${era}`);
  const [canvas,c]=makeCanvas(W,H), p=palettes[era]; ground(c,era,p);
  const map={w:W,h:H,ground:canvas,props:[],obstacles:[],start:{x:600,y:480}};
  const layout=[
    [['tree',100,280],['tree',250,300],['tree',420,245],['tree',920,285],['tree',1080,310],['tree',100,720],['tree',280,760],['tree',1130,720],['bench',340,340],['bench',720,360],['flower',505,350],['flower',670,535],['skate',480,560],['violin',700,560],['lamp',820,355],['lamp',170,560]],
    [['school',600,390],['desk',180,350],['desk',300,350],['desk',930,350],['desk',1050,350],['desk',210,640],['desk',340,640],['desk',830,650],['desk',960,650],['book',500,550],['game',700,550],['lamp',130,550],['lamp',1090,550]],
    [['campus',600,390],['tree',140,300],['tree',260,305],['tree',980,310],['tree',1090,300],['desk',230,620],['desk',360,650],['desk',820,620],['desk',970,660],['book',500,550],['flag',700,550],['lamp',130,560],['lamp',1070,560]],
    [['guard',600,390],['tree',170,300],['tree',1030,300],['tree',100,690],['tree',1100,690],['shield',340,350],['shield',860,350],['shield',300,650],['shield',900,650],['lamp',410,550],['lamp',790,550]],
    [['desk',175,300],['desk',325,305],['desk',480,405],['desk',720,405],['desk',880,300],['desk',1030,310],['desk',170,660],['desk',330,680],['desk',870,660],['desk',1030,670],['robot',500,320],['robot',700,320],['robot',500,560],['robot',700,560],['lamp',100,540],['lamp',1100,540]],
  ];
  for(const [type,x,y] of layout[era]) prop(map,x,y,type,era);
  cache.set(era,map); return map;
}
