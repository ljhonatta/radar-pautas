/* Radar Trader · Estúdio de vídeo (Reels 1080×1920).
   Notícia → roteiro (IA, ficha ou o seu) → narração (voz da OpenAI ou seu áudio) → cenas animadas com legenda → MP4.
   Linguagem visual: palco escuro com luz de cima, um objeto 3D de "argila" por cena, cards com número grande e
   legenda palavra por palavra. Grade fixa (margem 72px), uma cor de destaque, sem brilho exagerado. */
(function(){
const W=1080,H=1920,MX=72,FPS=30;
const VOZES={ash:"Ash (masculina, natural)",onyx:"Onyx (grave)",echo:"Echo (masculina leve)",nova:"Nova (feminina)",coral:"Coral (feminina calma)",sage:"Sage (feminina)",alloy:"Alloy (neutra)"};
const OBJETOS={"seta-baixo":"Seta para baixo","seta-cima":"Seta para cima",termometro:"Termômetro (juros)",pilha:"Pilha de dinheiro",moedas:"Moedas",predio:"Prédio (Bolsa, BC)",
  "placa-pare":"Placa de pare",alvo:"Alvo",relogio:"Relógio",calendario:"Calendário",cartao:"Cartão",escudo:"Escudo",lupa:"Lupa",barras:"Barras",nenhum:"Sem objeto"};
const TIPOS_V={numero:"Número em destaque",objeto:"Objeto + frase",grafico:"Gráfico",comparativo:"Antes × depois",lista:"Lista",citacao:"Citação",titulo:"Título",fim:"Fechamento (seguir)"};
let V=null,cur=0,tocando=null,gravando=null;
/* o mesmo motor serve o Radar Trader e o Radar de Pautas: cada painel pode passar window.VIDEO_APP com os ganchos dele */
const APP=window.VIDEO_APP||{};const PFX=APP.pfx||"v";
const $v=id=>document.getElementById(PFX+id.slice(1));
const cv=()=>$v("vCanvas");

/* ---------------- utilidades ---------------- */
const ease={out:t=>1-Math.pow(1-t,3),inout:t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,back:t=>{const c=1.6;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2);}};
const cl=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const prog=(t,a,d)=>cl((t-a)/d);
function hex(c){c=c.replace("#","");if(c.length===3)c=c.split("").map(x=>x+x).join("");const n=parseInt(c,16);return [n>>16,(n>>8)&255,n&255];}
function mix(a,b,f){const x=hex(a),y=hex(b);return "#"+x.map((v,i)=>Math.round(v+(y[i]-v)*f).toString(16).padStart(2,"0")).join("");}
function rgba(c,a){const x=hex(c);return `rgba(${x[0]},${x[1]},${x[2]},${a})`;}
function rnd(s){let x=Math.sin(s*9301+49297)*233280;return x-Math.floor(x);}
const palavras=s=>String(s||"").trim().split(/\s+/).filter(Boolean);
function paleta(){const p=(APP.paleta&&APP.paleta(V))||(typeof PALETAS!=="undefined"&&PALETAS[V?.paleta])||PALETAS.laranja;
  return {a:p.a,a2:p.a2,bg0:"#16171b",bg1:"#08090b",txt:"#f4f3ef",sub:"#9a9ca3",card:"rgba(20,21,25,.86)",line:"rgba(255,255,255,.09)",
    clay:"#e8e6e1",clayD:"#a9a69f",clayS:"#7d7a74",neg:"#ff5a4e",pos:"#2fcf7a"};}
function rr(g,x,y,w,h,r){r=Math.min(r,w/2,h/2);g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
function fonte(g,peso,tam,fam){g.font=`${peso} ${tam}px ${fam||"'Archivo', 'Montserrat', sans-serif"}`;}
function cabe(g,txt,maxW,tam,min,peso,fam){let s=tam;fonte(g,peso,s,fam);while(g.measureText(txt).width>maxW&&s>min){s-=2;fonte(g,peso,s,fam);}return s;}
function quebra(g,txt,maxW){const out=[];let l="";for(const w of palavras(txt)){const t=l?l+" "+w:w;if(g.measureText(t).width>maxW&&l){out.push(l);l=w;}else l=t;}if(l)out.push(l);return out;}
function espaco(g,v){try{g.letterSpacing=v;}catch(e){}}
function numParts(v){const m=String(v||"").match(/^(.*?)([+-]?)(\d{1,3}(?:\.\d{3})+|\d+)(,\d+)?(.*)$/);if(!m)return null;
  return {pre:m[1]+m[2],n:parseFloat(m[3].replace(/\./g,"")+(m[4]?"."+m[4].slice(1):"")),dec:m[4]?m[4].length-1:0,mil:m[3].includes("."),suf:m[5]};}
function contar(v,f){const p=numParts(v);if(!p||f>=1)return String(v||"");const n=p.n*f;
  let s=n.toFixed(p.dec).replace(".",",");if(p.mil||p.n>=1000){const [i,d]=s.split(",");s=i.replace(/\B(?=(\d{3})+(?!\d))/g,".")+(d?","+d:"");}return p.pre+s+p.suf;}

/* ---------------- fundo: palco ---------------- */
let GRAO=null;
function grao(){if(GRAO)return GRAO;const c=document.createElement("canvas");c.width=c.height=256;const g=c.getContext("2d");const d=g.createImageData(256,256);
  for(let i=0;i<d.data.length;i+=4){const v=Math.random()*255;d.data[i]=d.data[i+1]=d.data[i+2]=v;d.data[i+3]=14;}g.putImageData(d,0,0);GRAO=c;return c;}
function fundo(g,t,P,cy){
  const bg=g.createLinearGradient(0,0,0,H);bg.addColorStop(0,P.bg0);bg.addColorStop(1,P.bg1);g.fillStyle=bg;g.fillRect(0,0,W,H);
  // cone de luz vindo de cima
  g.save();const cone=g.createLinearGradient(0,0,0,cy+140);cone.addColorStop(0,rgba("#ffffff",.0));cone.addColorStop(.35,rgba("#ffffff",.035));cone.addColorStop(1,rgba(P.a,.07));
  g.fillStyle=cone;g.beginPath();g.moveTo(W/2-70,0);g.lineTo(W/2+70,0);g.lineTo(W/2+330,cy+150);g.lineTo(W/2-330,cy+150);g.closePath();g.fill();g.restore();
  // chão: elipse iluminada
  const fl=g.createRadialGradient(W/2,cy+150,10,W/2,cy+150,360);fl.addColorStop(0,rgba(P.a,.30));fl.addColorStop(.45,rgba(P.a,.10));fl.addColorStop(1,rgba(P.a,0));
  g.save();g.translate(W/2,cy+150);g.scale(1,.24);g.translate(-W/2,-(cy+150));g.fillStyle=fl;g.beginPath();g.arc(W/2,cy+150,360,0,7);g.fill();g.restore();
  g.save();g.strokeStyle=rgba(P.a,.55);g.lineWidth=3;g.beginPath();g.ellipse(W/2,cy+150,250,58,0,0,7);g.stroke();g.restore();
  // poeira flutuando
  for(let i=0;i<46;i++){const sp=.15+rnd(i)*.35,x=(rnd(i+7)*W+Math.sin(t*.3+i)*18)%W,y=((rnd(i+3)*H-t*22*sp)%H+H)%H;const r=1.2+rnd(i+11)*2.6;
    g.fillStyle=`rgba(255,255,255,${.10+rnd(i+5)*.28})`;g.beginPath();g.arc(x,y,r,0,7);g.fill();}
  // vinheta
  const vg=g.createRadialGradient(W/2,H*.45,H*.25,W/2,H*.5,H*.75);vg.addColorStop(0,"rgba(0,0,0,0)");vg.addColorStop(1,"rgba(0,0,0,.55)");g.fillStyle=vg;g.fillRect(0,0,W,H);
}
function graoPor(g,t){const n=grao();g.save();g.globalAlpha=1;const ox=(Math.floor(t*24)*67)%256,oy=(Math.floor(t*24)*131)%256;
  g.translate(-ox,-oy);g.fillStyle=g.createPattern(n,"repeat");g.fillRect(0,0,W+256,H+256);g.restore();}

/* ---------------- objetos 3D de argila ----------------
   Cada objeto é um caminho 2D extrudado: várias cópias deslocadas (lateral escura) + face de cima com luz. */
function ext(g,P,path,prof,opt={}){const dx=.42,dy=.62,face=opt.face||P.clay,lado=opt.lado||P.clayD;
  for(let i=prof;i>0;i-=1.5){g.save();g.translate(i*dx,i*dy);path(g);g.fillStyle=i>prof*.6?P.clayS:lado;g.fill();g.restore();}
  path(g);const gr=g.createLinearGradient(-200,-260,200,260);gr.addColorStop(0,mix(face,"#ffffff",.35));gr.addColorStop(.55,face);gr.addColorStop(1,mix(face,"#000000",.12));
  g.fillStyle=opt.cor||gr;g.fill();if(!opt.semBorda){g.strokeStyle="rgba(255,255,255,.55)";g.lineWidth=2;g.stroke();}}
function sombra(g,w){g.save();g.scale(1,.22);const r=g.createRadialGradient(0,0,0,0,0,w*1.15);r.addColorStop(0,"rgba(0,0,0,.55)");r.addColorStop(.6,"rgba(0,0,0,.25)");r.addColorStop(1,"rgba(0,0,0,0)");g.fillStyle=r;g.beginPath();g.arc(0,0,w*1.15,0,7);g.fill();g.restore();}
function objeto(g,P,nome,t,f){ // f: 0→1 progresso de entrada (encher, crescer); desenha centrado em (0,0), base em y≈+170
  const A=P.a;
  switch(nome){
  case "seta-baixo": case "seta-cima":{const up=nome==="seta-cima";g.save();if(up)g.scale(1,-1);
    ext(g,P,g=>{g.beginPath();g.moveTo(-58,-200);g.lineTo(58,-200);g.lineTo(58,30);g.lineTo(130,30);g.lineTo(0,175);g.lineTo(-130,30);g.lineTo(-58,30);g.closePath();},34,{face:up?mix(P.clay,P.pos,.12):P.clay});g.restore();break;}
  case "termometro":{ext(g,P,g=>{rr(g,-46,-230,92,330,46);},28);ext(g,P,g=>{g.beginPath();g.arc(0,120,82,0,7);},28);
    const nv=-200+300*(1-.75*ease.out(f));g.fillStyle=A;rr(g,-24,nv,48,140+(-nv),24);g.fill();g.beginPath();g.arc(0,120,56,0,7);g.fill();
    g.strokeStyle="rgba(0,0,0,.25)";g.lineWidth=4;for(let i=0;i<6;i++){g.beginPath();g.moveTo(52,-180+i*42);g.lineTo(80,-180+i*42);g.stroke();}break;}
  case "pilha":{const n=Math.round(3+9*ease.out(f));for(let i=0;i<n;i++){const y=150-i*26;ext(g,P,g=>{rr(g,-150,y-20,300,40,8);},16,{face:mix(P.clay,A,.18),semBorda:true});
      g.fillStyle=rgba(A,.55);g.fillRect(-40,y-20,80,40);}break;}
  case "moedas":{for(const [x,c] of [[-110,5],[30,8],[150,4]]){const k=Math.round(c*ease.out(f))||1;for(let i=0;i<k;i++){const y=150-i*24;
      g.fillStyle=P.clayS;g.beginPath();g.ellipse(x,y+10,62,20,0,0,7);g.fill();g.fillStyle=P.clayD;g.fillRect(x-62,y-10,124,20);
      g.fillStyle=mix(P.clay,A,.3);g.beginPath();g.ellipse(x,y-10,62,20,0,0,7);g.fill();g.strokeStyle="rgba(255,255,255,.5)";g.lineWidth=2;g.stroke();}}break;}
  case "predio":{ext(g,P,g=>{g.beginPath();g.moveTo(-210,-110);g.lineTo(0,-215);g.lineTo(210,-110);g.closePath();},26);
    for(let i=0;i<5;i++)ext(g,P,g=>{rr(g,-180+i*80,-90,46,220,6);},20);ext(g,P,g=>{rr(g,-230,135,460,44,6);},22);
    fonte(g,800,26,"'JetBrains Mono',monospace");espaco(g,"6px");g.fillStyle=P.clayS;g.textAlign="center";g.fillText(V?.predioTxt||"BOLSA",0,-128);espaco(g,"0px");break;}
  case "placa-pare":{ext(g,P,g=>{rr(g,-12,0,24,200,6);},14);ext(g,P,g=>{g.beginPath();for(let i=0;i<8;i++){const a=Math.PI/8+i*Math.PI/4;g.lineTo(Math.cos(a)*150,-60+Math.sin(a)*150);}g.closePath();},26,{face:mix(P.clay,A,.5)});
    fonte(g,900,62);g.textAlign="center";g.fillStyle="#fff";g.fillText("PARE",0,-38);break;}
  case "alvo":{for(const [r,c] of [[170,P.clay],[124,mix(P.clay,A,.55)],[78,P.clay],[34,A]])ext(g,P,g=>{g.beginPath();g.arc(0,0,r,0,7);},r===170?30:4,{face:c,semBorda:r!==170});
    const k=ease.back(cl(f*1.4));g.save();g.translate(220-180*k,-220+180*k);g.strokeStyle=P.clayS;g.lineWidth=12;g.lineCap="round";g.beginPath();g.moveTo(0,0);g.lineTo(150,-150);g.stroke();
    g.fillStyle=A;g.beginPath();g.moveTo(150,-150);g.lineTo(110,-150);g.lineTo(150,-190);g.closePath();g.fill();g.restore();break;}
  case "relogio":{ext(g,P,g=>{g.beginPath();g.arc(0,0,175,0,7);},30);g.fillStyle="#fbfaf7";g.beginPath();g.arc(0,0,140,0,7);g.fill();
    g.strokeStyle=P.clayS;g.lineCap="round";for(let i=0;i<12;i++){const a=i*Math.PI/6;g.lineWidth=i%3?3:7;g.beginPath();g.moveTo(Math.cos(a)*118,Math.sin(a)*118);g.lineTo(Math.cos(a)*132,Math.sin(a)*132);g.stroke();}
    const a1=t*.9,a2=t*.08;g.strokeStyle="#222";g.lineWidth=12;g.beginPath();g.moveTo(0,0);g.lineTo(Math.cos(a2-1.6)*70,Math.sin(a2-1.6)*70);g.stroke();
    g.strokeStyle=A;g.lineWidth=7;g.beginPath();g.moveTo(0,0);g.lineTo(Math.cos(a1-1.6)*110,Math.sin(a1-1.6)*110);g.stroke();g.fillStyle="#222";g.beginPath();g.arc(0,0,14,0,7);g.fill();break;}
  case "calendario":{ext(g,P,g=>{rr(g,-190,-170,380,340,30);},30);g.fillStyle=A;rr(g,-190,-170,380,90,30);g.fill();g.fillRect(-190,-110,380,30);
    g.fillStyle=P.clayS;for(const x of [-100,100])rr(g,x-12,-200,24,64,12),g.fill();
    const dia=V?.cenas?.[cur]?.visual?.dia;if(dia){fonte(g,900,150);g.textAlign="center";g.fillStyle="#26272b";g.fillText(dia,0,120);}
    else{for(let r=0;r<3;r++)for(let c=0;c<5;c++){const on=r===1&&c===3;g.fillStyle=on?A:"rgba(0,0,0,.16)";rr(g,-150+c*62,-50+r*62,44,40,8);g.fill();}}break;}
  case "cartao":{g.save();g.rotate(-.12);ext(g,P,g=>{rr(g,-210,-130,420,260,30);},18,{face:mix(P.clay,A,.25)});g.fillStyle="#d8c690";rr(g,-160,-50,74,56,10);g.fill();
    g.fillStyle="rgba(0,0,0,.25)";for(let i=0;i<4;i++)rr(g,-160+i*86,60,66,16,8),g.fill();g.restore();break;}
  case "escudo":{ext(g,P,g=>{g.beginPath();g.moveTo(0,-210);g.lineTo(170,-150);g.lineTo(170,-10);g.bezierCurveTo(170,110,80,170,0,210);g.bezierCurveTo(-80,170,-170,110,-170,-10);g.lineTo(-170,-150);g.closePath();},30);
    g.strokeStyle=A;g.lineWidth=26;g.lineCap="round";g.lineJoin="round";const k=ease.out(f);g.beginPath();g.moveTo(-70,0);g.lineTo(-70+50*cl(k*2),50*cl(k*2));if(k>.5)g.lineTo(-20+110*cl((k-.5)*2),50-130*cl((k-.5)*2));g.stroke();break;}
  case "lupa":{g.save();g.rotate(-.5);ext(g,P,g=>{rr(g,-26,110,52,170,20);},22);g.restore();ext(g,P,g=>{g.beginPath();g.arc(0,-30,150,0,7);g.arc(0,-30,108,0,7,true);},28);
    const le=g.createRadialGradient(-40,-80,10,0,-30,112);le.addColorStop(0,"#f3f6f8");le.addColorStop(.7,"#c9d2d8");le.addColorStop(1,mix("#c9d2d8",A,.35));g.fillStyle=le;g.beginPath();g.arc(0,-30,108,0,7);g.fill();
    g.strokeStyle=rgba(A,.9);g.lineWidth=6;g.beginPath();g.arc(0,-30,112,0,7);g.stroke();g.fillStyle="rgba(255,255,255,.55)";g.beginPath();g.ellipse(-44,-84,30,13,-.6,0,7);g.fill();break;}
  case "barras":{const dir=V?.cenas?.[cur]?.visual?.direcao==="cai"?-1:1;const hs=dir>0?[110,190,290]:[290,190,110];
    hs.forEach((h,i)=>{const hh=h*ease.out(cl(f*1.3-i*.15));ext(g,P,g=>{rr(g,-200+i*140,170-hh,110,hh,10);},26,{face:i===(dir>0?2:0)?mix(P.clay,A,.6):P.clay});});break;}
  }
}

/* ---------------- peças de interface ---------------- */
function cabecalho(g,P,c,al){g.save();g.globalAlpha=al;fonte(g,600,22,"'JetBrains Mono',monospace");espaco(g,"4px");g.fillStyle=P.sub;g.textAlign="left";
  const marca=(V.marca||"RADAR TRADER")+"  ·  "+(V.handle||"");g.fillText(marca.toUpperCase(),MX,150);
  if(c.cap){fonte(g,700,24,"'JetBrains Mono',monospace");espaco(g,"3px");const tx=c.cap.toUpperCase(),w=g.measureText(tx).width+64;
    g.fillStyle="rgba(255,255,255,.06)";rr(g,MX,178,w,50,25);g.fill();g.strokeStyle=P.line;g.lineWidth=2;g.stroke();
    g.fillStyle=P.a;g.beginPath();g.arc(MX+26,203,7,0,7);g.fill();g.fillStyle=P.txt;g.fillText(tx,MX+44,212);}
  espaco(g,"0px");g.restore();}
function card(g,P,x,y,w,h,al,dy){g.save();g.globalAlpha=al;g.translate(0,dy);g.fillStyle=P.card;rr(g,x,y,w,h,22);g.fill();g.strokeStyle=P.line;g.lineWidth=2;g.stroke();
  g.fillStyle=P.a;rr(g,x,y+22,6,h-44,3);g.fill();g.restore();}
function cardNumero(g,P,v,t0,cy){const vis=v||{};const k=ease.out(prog(t0,.15,.55));if(k<=0)return;
  const val=contar(vis.valor,ease.out(prog(t0,.2,.9)));const max=W-2*MX-80;
  let s=cabe(g,String(vis.valor||""),max,150,64,900);fonte(g,900,s);espaco(g,"-3px");const vw=Math.min(max,g.measureText(String(vis.valor||"")).width);
  fonte(g,600,26,"'JetBrains Mono',monospace");espaco(g,"2px");const ls=quebra(g,String(vis.rotulo||"").toUpperCase(),Math.max(vw,520));
  const cw=Math.max(vw,Math.min(max,Math.max(...ls.map(l=>g.measureText(l).width),0)))+80,ch=s*.92+30+ls.length*38+40,x=(W-cw)/2,y=cy-ch;
  card(g,P,x,y,cw,ch,k,(1-k)*40);g.save();g.globalAlpha=k;g.translate(0,(1-k)*40);g.textAlign="center";fonte(g,900,s);espaco(g,"-3px");
  g.fillStyle=/^[-−]/.test(String(vis.valor||""))?P.txt:P.txt;g.fillText(val,W/2,y+30+s*.82);
  fonte(g,600,26,"'JetBrains Mono',monospace");espaco(g,"2px");g.fillStyle=P.sub;ls.forEach((l,i)=>g.fillText(l,W/2,y+30+s*.92+34+i*38));espaco(g,"0px");g.restore();}
function cardFrase(g,P,txt,t0,cy,tam){const k=ease.out(prog(t0,.15,.55));if(k<=0||!txt)return;const max=W-2*MX-90;fonte(g,800,tam||58);
  const ls=quebra(g,txt,max).slice(0,4);const lh=(tam||58)*1.15,cw=Math.min(W-2*MX,Math.max(...ls.map(l=>g.measureText(l).width))+90),ch=ls.length*lh+56,x=(W-cw)/2,y=cy-ch;
  card(g,P,x,y,cw,ch,k,(1-k)*40);g.save();g.globalAlpha=k;g.translate(0,(1-k)*40);g.fillStyle=P.txt;g.textAlign="center";
  ls.forEach((l,i)=>{g.fillText(l,W/2,y+28+lh*(i+.82));});g.restore();}
function legenda(g,P,c,tc,dur,tw){const ws=palavras(c.narracao);if(!ws.length)return;
  // tempo de cada palavra proporcional ao tamanho (+ pausa em pontuação)
  const pesos=ws.map(w=>w.length+2+(/[.,;:!?]$/.test(w)?4:0)),tot=pesos.reduce((a,b)=>a+b,0),fala=Math.max(.5,dur-.25);let acc=0;const ini=pesos.map(p=>{const s=acc/tot*fala;acc+=p;return s;});
  const tt=Array.isArray(tw)&&tw.length===ws.length?tw:ini; // com a narração "ouvida", usa o tempo real de cada palavra
  let iw=tt.findIndex((s,i)=>tc<(tt[i+1]??1e9));if(iw<0)iw=ws.length-1;if(tc<tt[0])iw=0;
  // blocos de até 6 palavras, quebrando em pontuação
  const blocos=[];let b=[];ws.forEach((w,i)=>{b.push(i);if(b.length>=6||/[.,;:!?]$/.test(w)&&b.length>=3){blocos.push(b);b=[];}});if(b.length)blocos.push(b);
  const bl=blocos.find(x=>x.includes(iw))||blocos[0];fonte(g,700,54);const max=W-2*MX-60;
  const linhas=[];let l=[];for(const i of bl){const tt=[...l,i].map(j=>ws[j]).join(" ");if(g.measureText(tt).width>max&&l.length){linhas.push(l);l=[i];}else l.push(i);}if(l.length)linhas.push(l);
  const y0=1530-(linhas.length-1)*34;g.textAlign="left";
  linhas.forEach((ln,li)=>{const tx=ln.map(j=>ws[j]).join(" "),tw=g.measureText(tx).width;let x=(W-tw)/2;const y=y0+li*68;
    g.fillStyle="rgba(8,9,11,.62)";rr(g,x-22,y-50,tw+44,66,14);g.fill();
    for(const j of ln){const w=ws[j]+" ";g.fillStyle=j<iw?P.txt:j===iw?P.a2:"rgba(244,243,239,.38)";g.fillText(w,x,y);x+=g.measureText(w).width;}});}
function rodape(g,P,i,n,al){g.save();g.globalAlpha=al;const y=1712,w=W-2*MX;g.fillStyle="rgba(255,255,255,.10)";rr(g,MX,y,w,5,3);g.fill();g.fillStyle=P.a;rr(g,MX,y,w*((i+1)/n),5,3);g.fill();g.restore();}

/* ---------------- cena ---------------- */
function desenhar(g,tAbs,L){
  const P=paleta();let i=L.ini.findIndex((s,k)=>tAbs<s+L.dur[k]);if(i<0)i=L.ini.length-1;
  const c=V.cenas[i],tc=tAbs-L.ini[i],dur=L.dur[i],v=c.visual||{},tipo=v.tipo||"objeto";
  const sai=cl((dur-tc)/.28),ent=cl(tc/.3),al=Math.min(sai,1);const cy=tipo==="fim"?1000:1060;
  g.setTransform(1,0,0,1,0,0);fundo(g,tAbs,P,cy);
  // câmera: aproximação lenta durante a cena
  const zoom=1+.035*ease.inout(cl(tc/Math.max(1,dur)));g.save();g.translate(W/2,cy);g.scale(zoom,zoom);g.translate(-W/2,-cy);
  g.globalAlpha=al;
  const obj=v.objeto&&v.objeto!=="nenhum"?v.objeto:null;
  if(tipo==="numero"||tipo==="objeto"||tipo==="titulo"){
    if(obj){const k=ease.back(cl(tc/.55));g.save();g.translate(W/2,cy-40+Math.sin(tAbs*1.6)*9);g.scale(.62+.38*k,.62+.38*k);g.rotate(Math.sin(tAbs*.9)*.025);
      g.save();g.translate(0,190);sombra(g,170);g.restore();objeto(g,P,obj,tAbs,cl(tc/1.2));g.restore();}
    if(tipo==="numero")cardNumero(g,P,v,tc,obj?720:1000);
    else if(tipo==="titulo")cardFrase(g,P,v.texto||c.narracao,tc,obj?700:1000,obj?64:84);
    else if(v.texto)cardFrase(g,P,v.texto,tc,700,52);
  }else if(tipo==="grafico"){desGrafico(g,P,v,tc);}
  else if(tipo==="comparativo"){desComp(g,P,v,tc);}
  else if(tipo==="lista"){desLista(g,P,v,tc);}
  else if(tipo==="citacao"){desCitacao(g,P,v,tc);}
  else if(tipo==="fim"){desFim(g,P,v,tc,tAbs);}
  g.restore();g.globalAlpha=1;
  cabecalho(g,P,c,Math.min(ent,sai)*.999+.001);
  legenda(g,P,c,tc,dur,V._tw&&V._tw[i]);rodape(g,P,i,V.cenas.length,1);
  graoPor(g,tAbs);return i;}
function desGrafico(g,P,v,tc){const x=MX+20,y=560,w=W-2*MX-40,h=640,k=ease.out(prog(tc,.1,.5));card(g,P,x,y,w,h,k,(1-k)*30);
  g.save();g.globalAlpha=k;g.strokeStyle="rgba(255,255,255,.06)";g.lineWidth=2;for(let i=1;i<5;i++){g.beginPath();g.moveTo(x+40,y+i*h/5);g.lineTo(x+w-40,y+i*h/5);g.stroke();}
  const dir=v.direcao==="cai"?-1:v.direcao==="oscila"?0:1,n=28,pts=[];for(let i=0;i<=n;i++){const f=i/n;let yy=dir?(.5-dir*(f-.5)*.75):.5;yy+=Math.sin(i*1.7)*.05+Math.sin(i*.6)*.06;pts.push([x+50+f*(w-130),y+70+yy*(h-170)]);}
  const d=ease.inout(prog(tc,.3,1.6)),m=Math.max(1,Math.floor(d*n));g.lineWidth=7;g.lineJoin="round";g.strokeStyle=dir<0?P.neg:P.a;g.beginPath();pts.slice(0,m+1).forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.stroke();
  const gr=g.createLinearGradient(0,y,0,y+h);gr.addColorStop(0,rgba(dir<0?P.neg:P.a,.25));gr.addColorStop(1,rgba(dir<0?P.neg:P.a,0));g.fillStyle=gr;g.beginPath();pts.slice(0,m+1).forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.lineTo(pts[m][0],y+h-40);g.lineTo(pts[0][0],y+h-40);g.closePath();g.fill();
  const e=pts[m];g.fillStyle="#fff";g.beginPath();g.arc(e[0],e[1],12,0,7);g.fill();
  if(v.valor){fonte(g,900,64);const tw=g.measureText(v.valor).width+40;g.fillStyle=dir<0?P.neg:P.a;rr(g,Math.min(e[0]-tw/2,x+w-tw-20),e[1]-110,tw,80,14);g.fill();g.fillStyle="#fff";g.textAlign="center";g.fillText(v.valor,Math.min(e[0],x+w-tw/2-20),e[1]-48);}
  if(v.rotulo){fonte(g,600,26,"'JetBrains Mono',monospace");espaco(g,"2px");g.fillStyle=P.sub;g.textAlign="left";g.fillText(String(v.rotulo).toUpperCase().slice(0,44),x+40,y+h-24);espaco(g,"0px");}
  g.restore();}
function desComp(g,P,v,tc){const its=(v.itens||[]).slice(0,3);if(!its.length)return;const x=MX+10,w=W-2*MX-20,pad=48,iw=w-2*pad;
  // cada linha: rótulo pequeno em cima; embaixo "antes → depois"
  const linhas=its.map(it=>{fonte(g,600,34);const an=quebra(g,String(it.antes||"—"),iw*.4).slice(0,2);fonte(g,900,52);const dp=quebra(g,String(it.depois||""),iw*.52).slice(0,2);return {it,an,dp,h:50+Math.max(an.length*42,dp.length*58)+34};});
  const h=40+linhas.reduce((a,l)=>a+l.h,0),y=1080-h,k=ease.out(prog(tc,.1,.5));card(g,P,x,y,w,h,k,(1-k)*30);
  g.save();g.globalAlpha=k;let yy=y+40;
  linhas.forEach((l,i)=>{const kk=ease.out(prog(tc,.3+i*.3,.5));g.save();g.globalAlpha=k*kk;
    if(i){g.strokeStyle=P.line;g.lineWidth=2;g.beginPath();g.moveTo(x+pad,yy-14);g.lineTo(x+w-pad,yy-14);g.stroke();}
    fonte(g,600,24,"'JetBrains Mono',monospace");espaco(g,"3px");g.fillStyle=P.sub;g.textAlign="left";g.fillText(String(l.it.rotulo||"").toUpperCase().slice(0,40),x+pad,yy+20);espaco(g,"0px");
    fonte(g,600,34);g.fillStyle=P.sub;l.an.forEach((t,j)=>{g.fillText(t,x+pad,yy+80+j*42);const tw=g.measureText(t).width;g.strokeStyle=rgba(P.neg,.8);g.lineWidth=3;g.beginPath();g.moveTo(x+pad,yy+68+j*42);g.lineTo(x+pad+tw,yy+68+j*42);g.stroke();});
    g.fillStyle=P.a;fonte(g,700,44);g.fillText("→",x+pad+iw*.43,yy+84);
    fonte(g,900,52);g.fillStyle=P.txt;l.dp.forEach((t,j)=>g.fillText(t,x+pad+iw*.5,yy+88+j*58));g.restore();yy+=l.h;});g.restore();}
function desLista(g,P,v,tc){const its=(v.itens||[]).slice(0,4);if(!its.length)return;const x=MX+10,w=W-2*MX-20;let y=1060;
  fonte(g,700,46);const blocos=its.map(t=>quebra(g,String(t),w-170).slice(0,3));const hs=blocos.map(b=>b.length*56+60),tot=hs.reduce((a,b)=>a+b+20,0);y=1060-tot;
  blocos.forEach((b,i)=>{const k=ease.out(prog(tc,.15+i*.35,.5));card(g,P,x,y,w,hs[i],k,(1-k)*30);g.save();g.globalAlpha=k;g.translate(0,(1-k)*30);
    g.fillStyle=P.a;g.beginPath();g.arc(x+70,y+hs[i]/2,30,0,7);g.fill();g.fillStyle="#fff";fonte(g,800,32,"'JetBrains Mono',monospace");g.textAlign="center";g.fillText(String(i+1),x+70,y+hs[i]/2+11);
    fonte(g,700,46);g.textAlign="left";g.fillStyle=P.txt;b.forEach((l,j)=>g.fillText(l,x+130,y+30+46+j*56));g.restore();y+=hs[i]+20;});}
function desCitacao(g,P,v,tc){const k=ease.out(prog(tc,.1,.5));const x=MX+10,w=W-2*MX-20;fonte(g,800,58);const ls=quebra(g,"“"+(v.frase||"")+"”",w-110).slice(0,6);
  const h=ls.length*70+190,y=1080-h;card(g,P,x,y,w,h,k,(1-k)*30);g.save();g.globalAlpha=k;g.translate(0,(1-k)*30);g.fillStyle=P.txt;g.textAlign="left";
  ls.forEach((l,i)=>g.fillText(l,x+60,y+90+i*70));fonte(g,600,26,"'JetBrains Mono',monospace");espaco(g,"2px");g.fillStyle=P.a2;g.fillText("— "+String(v.quem||"").toUpperCase().slice(0,48),x+60,y+h-50);espaco(g,"0px");g.restore();}
const IMGS={};
function img(src){if(!src)return null;if(IMGS[src])return IMGS[src].complete?IMGS[src]:null;const im=new Image();im.src=src;IMGS[src]=im;return null;}
function desFim(g,P,v,tc,tAbs){const b=(APP.marca?APP.marca(V):(typeof brandOf==="function"?brandOf(V.handle):{}))||{};const k=ease.back(cl(tc/.6));const cy=880;
  g.save();g.translate(W/2,cy);g.scale(.7+.3*k,.7+.3*k);g.globalAlpha=cl(tc/.4);g.strokeStyle=P.a;g.lineWidth=10;g.beginPath();g.arc(0,0,170,0,7);g.stroke();
  const fu=b.fotoUrl||(b.foto?blobSrc(b.foto):""),f=img(fu||b.logoUrl||"");g.save();g.beginPath();g.arc(0,0,158,0,7);g.clip();g.fillStyle="#141518";g.fillRect(-160,-160,320,320);
  if(f){const s=fu?Math.max(316/f.width,316/f.height):Math.min(230/f.width,230/f.height);g.drawImage(f,-f.width*s/2,-f.height*s/2,f.width*s,f.height*s);}g.restore();g.restore();
  const k2=ease.out(prog(tc,.35,.5));g.save();g.globalAlpha=k2;g.textAlign="center";fonte(g,900,cabe(g,b.nome||V.handle,W-2*MX,76,40,900));g.fillStyle=P.txt;g.fillText(b.nome||V.handle,W/2,1150);
  fonte(g,600,34,"'JetBrains Mono',monospace");g.fillStyle=P.sub;g.fillText(V.handle||"",W/2,1206);
  const bw=420,bx=(W-bw)/2,by=1260;g.fillStyle=P.a;rr(g,bx,by,bw,96,48);g.fill();fonte(g,800,44);g.fillStyle="#fff";g.fillText(v.texto||"Seguir",W/2,by+64);g.restore();}

/* ---------------- tempo ---------------- */
// com narração: as cenas seguem o tempo real da fala (V._durs); sem narração: estimativa pelo número de palavras
function linha(){const ini=[],dur=[];let t=0;V.cenas.forEach((c,i)=>{let d=V._buf&&V._durs?V._durs[i]:Math.max(2.4,palavras(c.narracao).length/2.6+.4);
  if((c.visual||{}).tipo==="fim")d=Math.max(d,3.2);ini.push(t);dur.push(d);t+=d;});return {ini,dur,total:t};}

/* ---------------- narração ---------------- */
let ACtx=null;const actx=()=>ACtx||(ACtx=new (window.AudioContext||window.webkitAudioContext)());
const LSv={get:(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:v;}catch(e){return d;}},set:(k,v)=>{try{v?localStorage.setItem(k,v):localStorage.removeItem(k);}catch(e){}}};
const elKey=()=>LSv.get("rv-eleven-key",""),oaKey=()=>window.radarKey?.get()||"";
const INSTR="Fale em português do Brasil, com sotaque brasileiro natural (paulistano neutro), como um jornalista de economia gravando um Reels: "+
  "tom de conversa, seguro e próximo, ritmo dinâmico com pausas curtas entre as frases, ênfase leve nos números. Nada de tom de locutor de rádio nem de robô.";
function textoNarr(){return V.cenas.map(c=>String(c.narracao||"").trim()).filter(Boolean).map(t=>/[.!?…]$/.test(t)?t:t+".").join(" ");}
async function vozOpenAI(txt){const key=oaKey();if(!key)throw {code:"sem_chave"};let r;
  for(const modelo of ["gpt-4o-mini-tts","tts-1-hd"]){r=await fetch("https://api.openai.com/v1/audio/speech",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},
      body:JSON.stringify({model:modelo,voice:V.voz||"ash",input:txt,response_format:"mp3",...(modelo==="gpt-4o-mini-tts"?{instructions:INSTR}:{speed:1.05})})});
    if(r.ok)break;if(r.status===401)throw {code:"bad_key"};}
  if(!r.ok)throw {code:"http_"+r.status};return await r.arrayBuffer();}
async function vozEleven(txt,voz){const r=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voz)}?output_format=mp3_44100_128`,{method:"POST",
    headers:{"xi-api-key":elKey(),"Content-Type":"application/json"},body:JSON.stringify({text:txt,model_id:"eleven_multilingual_v2",language_code:"pt",voice_settings:{stability:.45,similarity_boost:.8,style:.25,use_speaker_boost:true}})});
  if(r.status===401)throw {code:"eleven_key"};if(!r.ok)throw {code:"eleven_"+r.status};return await r.arrayBuffer();}
// "ouve" o áudio pronto para saber o tempo de cada palavra (legenda e cortes de cena no tempo exato)
async function ouvir(mp3){const key=oaKey();if(!key)return null;try{const fd=new FormData();fd.append("file",new Blob([mp3],{type:"audio/mpeg"}),"narracao.mp3");fd.append("model","whisper-1");
    fd.append("language","pt");fd.append("response_format","verbose_json");fd.append("timestamp_granularities[]","word");
    const r=await fetch("https://api.openai.com/v1/audio/transcriptions",{method:"POST",headers:{"Authorization":"Bearer "+key},body:fd});if(!r.ok)return null;const j=await r.json();
    return Array.isArray(j.words)&&j.words.length?j.words.map(w=>({w:String(w.word||""),s:+w.start,e:+w.end})):null;}catch(e){return null;}}
function alinhar(dur,ouvidas){const cenas=V.cenas.map(c=>palavras(c.narracao));const tot=cenas.reduce((a,b)=>a+b.length,0);if(!tot){V._durs=V.cenas.map(()=>dur/V.cenas.length);V._tw=null;return;}
  // tempo de cada palavra do roteiro: pelo áudio "ouvido" (mesma ordem, ajustado pela contagem) ou proporcional ao tamanho
  let tempos=[];
  if(ouvidas&&ouvidas.length){const n=ouvidas.length;for(let k=0;k<tot;k++){const j=Math.min(n-1,Math.round(k*(n/tot)));tempos.push(ouvidas[j].s);}}
  else{const ws=cenas.flat(),pesos=ws.map(w=>w.length+2+(/[.,;:!?]$/.test(w)?5:0)),sp=pesos.reduce((a,b)=>a+b,0);let acc=0;tempos=pesos.map(p=>{const s=acc/sp*dur;acc+=p;return s;});}
  let k=0;const ini=[];cenas.forEach(ws=>{ini.push(ws.length?Math.max(0,tempos[k]-.12):null);k+=ws.length;});
  for(let i=0;i<ini.length;i++)if(ini[i]==null)ini[i]=i?ini[i-1]:0;ini[0]=0;
  V._durs=ini.map((s,i)=>((i+1<ini.length?ini[i+1]:dur+.6)-s));k=0;V._tw=cenas.map((ws,i)=>{const t=ws.map((w,j)=>tempos[k+j]-ini[i]);k+=ws.length;return t;});}
async function narrar(){if(!V)return false;const txt=textoNarr();if(!txt){st("O roteiro está vazio.","err");return false;}
  const ev=$v("vVoz").value||"";const usarEl=ev.startsWith("el:")&&elKey();
  if(!usarEl&&!oaKey()){st("Para a narração, coloque a chave da OpenAI na aba Marca (ou ligue o ElevenLabs aqui embaixo).","err");return false;}
  st(usarEl?"Gravando a narração com a voz do ElevenLabs…":"Gravando a narração…");$v("vNarrar").disabled=true;
  try{const mp3=usarEl?await vozEleven(txt,ev.slice(3)):await vozOpenAI(txt);V._buf=await actx().decodeAudioData(mp3.slice(0));V._audioProprio=false;
    st("Sincronizando a legenda com a fala…");const ouvidas=await ouvir(mp3);alinhar(V._buf.duration,ouvidas);
    st(`Narração pronta (${Math.round(V._buf.duration)}s)${ouvidas?", legenda no tempo exato da fala":""}. Toque em Assistir ou Gravar vídeo.`,"ok");return true;}
  catch(e){const c=e?.code||"";st(c==="bad_key"?"A chave da OpenAI foi recusada.":c==="eleven_key"?"A chave do ElevenLabs foi recusada.":c==="sem_chave"?"Coloque a chave da OpenAI na aba Marca.":"Não consegui gravar a narração agora ("+c+"). Tente de novo.","err");return false;}
  finally{$v("vNarrar").disabled=false;renderLista();quadro();}}
async function audioProprio(f){try{const ab=await f.arrayBuffer();V._buf=await actx().decodeAudioData(ab.slice(0));V._audioProprio=true;st("Sincronizando a legenda com o seu áudio…");
  const ouvidas=f.size<24e6?await ouvir(ab):null;alinhar(V._buf.duration,ouvidas);
  st(`Áudio carregado (${Math.round(V._buf.duration)}s)${ouvidas?", legenda sincronizada com a fala":". Sem a chave da OpenAI, as cenas foram divididas pelo tamanho de cada fala"}.`,"ok");renderLista();quadro();}
  catch(e){st("Não consegui ler esse áudio. Use MP3 ou M4A.","err");}}
async function carregarVozesEleven(){const k=elKey();if(!k)return;try{const r=await fetch("https://api.elevenlabs.io/v1/voices",{headers:{"xi-api-key":k}});if(!r.ok)throw 0;
    const j=await r.json();const vs=(j.voices||[]).map(v=>({id:v.voice_id,nome:v.name,br:/portug|brazil|brasil|pt-br/i.test(JSON.stringify(v.labels||{})+" "+(v.description||"")+" "+v.name)}));
    vs.sort((a,b)=>b.br-a.br||a.nome.localeCompare(b.nome));VOZES_EL=vs;renderVozes();st(`${vs.length} vozes do ElevenLabs carregadas${vs.some(v=>v.br)?" (as brasileiras aparecem primeiro)":""}.`,"ok");}
  catch(e){st("Não consegui ler suas vozes do ElevenLabs. Confira a chave.","err");}}
let VOZES_EL=[];
function renderVozes(){const sel=$v("vVoz");if(!sel)return;const atual=V?.vozSel||LSv.get("rv-voz-sel","oa:ash");
  sel.innerHTML=`<optgroup label="OpenAI (sotaque brasileiro por instrução)">${Object.entries(VOZES).map(([k,v])=>`<option value="oa:${k}">${v}</option>`).join("")}</optgroup>`+
    (VOZES_EL.length?`<optgroup label="ElevenLabs (mais natural)">${VOZES_EL.map(v=>`<option value="el:${esc(v.id)}">${esc(v.nome)}${v.br?" · BR":""}</option>`).join("")}</optgroup>`:"");
  sel.value=[...sel.options].some(o=>o.value===atual)?atual:(VOZES_EL.find(v=>v.br)?"el:"+VOZES_EL.find(v=>v.br).id:"oa:ash");if(V){V.vozSel=sel.value;V.voz=sel.value.startsWith("oa:")?sel.value.slice(3):V.voz;}}

/* ---------------- roteiro ---------------- */
const cortaP=(s,n)=>{const w=palavras(s);return w.length>n?w.slice(0,n).join(" ").replace(/[,;:]$/,"")+".":w.join(" ");};
function frases(s){return String(s||"").split(/(?<=[.!?])\s+/).filter(x=>palavras(x).length>2);}
function objetoPara(txt){const s=String(txt||"").toLowerCase();
  if(/juro|selic|di\b|taxa/.test(s))return "termometro";if(/d[oó]lar|c[aâ]mbio|moeda|real\b/.test(s))return "moedas";if(/bolsa|ibovespa|b3|a[cç][oõ]es/.test(s))return "predio";
  if(/cai|queda|recu|despenc|perd/.test(s))return "seta-baixo";if(/sob|alta|dispar|cresc|avan/.test(s))return "seta-cima";if(/d[ií]vida|gasto|bilh|trilh|milh/.test(s))return "pilha";
  if(/prazo|dia \d|data|semana|m[eê]s/.test(s))return "calendario";if(/risco|seguran|prote/.test(s))return "escudo";if(/cart[aã]o|cr[eé]dito|financ/.test(s))return "cartao";
  if(/suspen|para|circuit/.test(s))return "placa-pare";return "alvo";}
function numeroEm(s){const re=/(R\$|US\$)?\s?[+-]?\d[\d.,]*\s?(%|mi\b|bi\b|tri\b|mil\b|bilh(?:ões|ão)|milh(?:ões|ão)|trilh(?:ões|ão)|pontos)?/gi;let m;
  while((m=re.exec(String(s||"")))){const t=m[0].trim(),antes=String(s).slice(Math.max(0,m.index-1),m.index);
    if(antes==="("||/^\d{1,2}$/.test(t)&&!m[1]&&!m[2]||/^(19|20)\d\d$/.test(t))continue; // dia do mês, ano, número solto
    if(m[1]||m[2]||/[.,]\d/.test(t)||/^\d{3,}$/.test(t.replace(/\D/g,"")))return t;}return "";}
const fimTxt=()=>APP.cta?APP.cta(V):`Siga ${V.handle} para entender o mercado todos os dias.`;
const fimBotao=()=>APP.botao?APP.botao(V):"Seguir";
function roteiroDaFicha(n){const cs=[];const add=(cap,narr,visual)=>narr&&cs.push({cap,narracao:cortaP(narr,26),visual});
  add("A NOTÍCIA",(n.gancho?plain(n.gancho)+". ":"")+(frases(n.resumo)[0]||n.titulo),{tipo:"titulo",texto:plain(n.gancho||n.titulo),objeto:objetoPara(n.titulo)});
  const base=(n.explicacao||[])[0]||(n.fatos||[]).slice(0,2).join(" ");
  frases(base).slice(0,2).forEach(f=>{const num=numeroEm(f);add("O FATO",f,num?{tipo:"numero",valor:num,rotulo:cortaP(f.replace(num,""),8).replace(/\.$/,""),objeto:objetoPara(f)}:{tipo:"objeto",objeto:objetoPara(f)});});
  (n.numeros||[]).slice(0,2).forEach(x=>add("OS NÚMEROS",`${x.valor}: ${x.rotulo}.`,{tipo:"numero",valor:x.valor,rotulo:x.rotulo,objeto:objetoPara(x.rotulo+" "+x.valor)}));
  if((n.comparativo||[]).length)add("ANTES × DEPOIS","Veja o que mudou: "+n.comparativo.map(x=>`${x.item}, de ${x.antes} para ${x.depois}`).join("; ")+".",{tipo:"comparativo",itens:n.comparativo.map(x=>({rotulo:x.item,antes:x.antes,depois:x.depois}))});
  if((n.declaracoes||[]).length){const d=n.declaracoes[0];add("QUEM FALOU",`${d.quem.split(",")[0]} resumiu assim: ${d.oque}`,{tipo:"citacao",frase:d.oque,quem:d.quem});}
  frases(n.porQueImporta||n.dor).slice(0,1).forEach(f=>add("POR QUE IMPORTA",f,{tipo:"objeto",objeto:objetoPara(f)}));
  frases(n.impactoMercado).slice(0,1).forEach(f=>add("O IMPACTO",f,{tipo:"grafico",direcao:/cai|queda|recu|press/.test(f)?"cai":"sobe",rotulo:"movimento ilustrativo"}));
  frases(n.entenda||n.angulo).slice(0,1).forEach(f=>add(n.entenda?"ENTENDA":"O CAMINHO",f,{tipo:"objeto",objeto:n.entenda?"lupa":"alvo"}));
  frases(n.observar).slice(0,1).forEach(f=>add("E AGORA",f,{tipo:"objeto",objeto:"calendario"}));
  add("",fimTxt(),{tipo:"fim",texto:fimBotao()});return cs;}
function roteiroDoTexto(txt){const ps=String(txt||"").split(/\n\s*\n|\n/).map(x=>x.trim()).filter(Boolean);
  const cs=ps.map((p,i)=>{const num=numeroEm(p);return {cap:i?"":"A NOTÍCIA",narracao:p,visual:num&&i?{tipo:"numero",valor:num,rotulo:cortaP(p.replace(num,""),7).replace(/\.$/,""),objeto:objetoPara(p)}:{tipo:i?"objeto":"titulo",texto:i?"":cortaP(p,9),objeto:objetoPara(p)}};});
  cs.push({cap:"",narracao:fimTxt(),visual:{tipo:"fim",texto:fimBotao()}});return cs;}
const iaOk=()=>APP.temIA?APP.temIA():(typeof temIA==="function"&&temIA());
async function roteiroIA(modo){if(!iaOk()){st("Para a IA escrever o roteiro, coloque a chave da OpenAI na aba Marca. Usei a ficha da notícia.","err");V.cenas=roteiroDaFicha(V.noticia);pronto();return false;}
  const n=V.noticia;st("Escrevendo o roteiro…");
  const mat=modo==="meu"?`ROTEIRO DO USUÁRIO (mantenha as falas, só ajuste para ficarem naturais e divida em cenas): ${$v("vMeu").value}`:
    `NOTÍCIA: ${JSON.stringify({titulo:n.titulo,resumo:n.resumo,explicacao:n.explicacao,fatos:n.fatos,numeros:n.numeros,comparativo:n.comparativo,declaracoes:n.declaracoes,porQueImporta:n.porQueImporta,impactoMercado:n.impactoMercado,entenda:n.entenda,observar:n.observar,dor:n.dor,angulo:n.angulo,fonte:n.fonte})}`;
  const contexto=APP.contexto?APP.contexto(V):`Perfil ${V.handle}: notícias do mercado financeiro explicadas de um jeito simples para quem investe ou quer começar.`;
  const prompt=`Você é roteirista de Reels em português do Brasil. ${contexto}
${mat}
Escreva um roteiro de vídeo vertical de 55 a 80 segundos, falado como um brasileiro explicando para um amigo: frases curtas, ritmo de conversa, expressões naturais do dia a dia, nada de clichê, sem emoji, sem prometer ganho, sem recomendar compra ou venda. Escreva os números por extenso quando ajudar a leitura em voz alta (ex.: "cinco reais e noventa e três"), mas no campo "valor" do visual use o número curto. Só use números, nomes e fatos do material.
Estrutura: gancho forte na primeira cena; o que aconteceu; os números; por que importa; o que muda para quem assiste; um conceito explicado; o que observar; fechamento: ${fimTxt()}
Divida em 9 a 13 cenas. Cada cena tem uma fala de 8 a 22 palavras e UM visual:
- "numero": {"valor":"número curto do material, ex: R$ 11 tri, -20%, 5,93","rotulo":"até 7 palavras","objeto":"um objeto"}
- "objeto": {"objeto":"um objeto","texto":"opcional, até 6 palavras"}
- "grafico": {"direcao":"sobe|cai|oscila","valor":"opcional, número do material","rotulo":"até 6 palavras"}
- "comparativo": {"itens":[{"rotulo":"","antes":"","depois":""}]} só com valores do material
- "lista": {"itens":["até 3 itens de até 9 palavras"]}
- "citacao": {"frase":"paráfrase curta","quem":"nome e cargo do material"}
- "titulo": {"texto":"até 8 palavras","objeto":"um objeto"}
- a última cena é {"tipo":"fim","texto":"${fimBotao()}"}
Objetos possíveis: ${Object.keys(OBJETOS).join(", ")}. Varie os visuais; não repita o mesmo objeto em cenas seguidas.
"cap" é a etiqueta do capítulo em 1 ou 2 palavras (ex: A NOTÍCIA, A CONTA, O IMPACTO, ENTENDA, E AGORA).
Responda só com JSON: {"cenas":[{"cap":"","narracao":"","visual":{"tipo":"","...":""}}],"legenda":"legenda do post com 2 parágrafos, a fonte e 5 hashtags"}`;
  try{const r=await sample.json(prompt,{cache:false});if(!Array.isArray(r?.cenas)||!r.cenas.length)throw {code:"invalid_json"};
    V.cenas=r.cenas.map(c=>({cap:String(c.cap||""),narracao:String(c.narracao||""),visual:limpaVisual(c.visual,c.narracao)}));
    const ult=V.cenas[V.cenas.length-1];if(ult.visual.tipo!=="fim")V.cenas.push({cap:"",narracao:fimTxt(),visual:{tipo:"fim",texto:fimBotao()}});else ult.visual.texto=ult.visual.texto||fimBotao();
    V.legendaPost=String(r.legenda||"");pronto("Roteiro pronto.");return true;}
  catch(e){st("A IA não respondeu agora. Usei a ficha da notícia; tente de novo depois.","err");V.cenas=roteiroDaFicha(n);pronto();return false;}}
function limpaVisual(v,narr){v=v&&typeof v==="object"?v:{};const tipo=TIPOS_V[v.tipo]?v.tipo:"objeto";const o={tipo};
  for(const k of ["valor","rotulo","texto","frase","quem","direcao","dia"])if(v[k])o[k]=String(v[k]);
  if(Array.isArray(v.itens))o.itens=v.itens.slice(0,4).map(x=>typeof x==="object"?{rotulo:String(x.rotulo||x.item||""),antes:String(x.antes||""),depois:String(x.depois||"")}:String(x));
  o.objeto=OBJETOS[v.objeto]?v.objeto:(["numero","objeto","titulo"].includes(tipo)?objetoPara(narr+" "+(v.rotulo||"")):"nenhum");return o;}
const ALT={moedas:["pilha","barras","seta-cima","cartao"],pilha:["moedas","barras","predio"],termometro:["barras","seta-cima","relogio"],predio:["barras","seta-baixo","alvo"],
  "seta-baixo":["barras","placa-pare","escudo"],"seta-cima":["barras","alvo","moedas"],alvo:["escudo","lupa","barras"],calendario:["relogio","alvo"],relogio:["calendario","alvo"],
  escudo:["alvo","lupa"],lupa:["alvo","escudo"],cartao:["moedas","pilha"],"placa-pare":["seta-baixo","escudo"],barras:["seta-cima","moedas","alvo"]};
function variar(cs){let ant="";const usados={};cs.forEach(c=>{const v=c.visual||{};if(!v.objeto||v.objeto==="nenhum"){ant="";return;}
  if(v.objeto===ant||(usados[v.objeto]||0)>=2){const op=(ALT[v.objeto]||["alvo","barras","lupa"]).find(o=>o!==ant&&(usados[o]||0)<2);if(op)v.objeto=op;}
  usados[v.objeto]=(usados[v.objeto]||0)+1;ant=v.objeto;});return cs;}
function pronto(msg){cur=0;variar(V.cenas);V._buf=null;V._durs=null;V._tw=null;V.legendaPost=V.legendaPost||legendaLocal();salvar();renderLista();renderCena();quadro();if(msg)st(msg,"ok");}
function legendaLocal(){const n=V.noticia;return APP.legenda?APP.legenda(V):`${plain(n.gancho||n.titulo)}\n\n${(n.explicacao||[]).slice(0,2).join("\n\n")||n.resumo}\n\nFonte: ${n.fonte}\n\n${fimTxt()}\n\nConteúdo informativo, não é recomendação de investimento.\n\n#mercadofinanceiro #investimentos #economia #bolsadevalores #trader`;}

/* ---------------- tocar e gravar ---------------- */
function quadro(){if(!V||!cv())return;const g=cv().getContext("2d");const L=linha();desenhar(g,(L.ini[cur]||0)+Math.min(1.6,(L.dur[cur]||2)*.7),L);
  $v("vTempo").textContent=`${Math.round(L.total)}s · ${V.cenas.length} cenas${V._buf?" · com narração":""}`;}
function parar(){if(tocando){tocando.stop=true;try{tocando.src.forEach(s=>s.stop());}catch(e){}tocando=null;}$v("vPlay").textContent="Assistir";}
function rodar(dest,onFrame){const ctx=actx(),L=linha(),g=cv().getContext("2d"),t0=ctx.currentTime+.3,src=[];
  if(V._buf){const s=ctx.createBufferSource();s.buffer=V._buf;s.connect(ctx.destination);if(dest)s.connect(dest);s.start(t0);src.push(s);}
  const est={stop:false,src};return {est,fim:new Promise(res=>{const passo=()=>{if(est.stop){res(false);return;}const t=ctx.currentTime-t0;
      if(t>=L.total+.2){res(true);return;}const i=desenhar(g,cl(t,0,L.total-.001),L);if(i!==cur){cur=i;marcar();}onFrame&&onFrame(cl(t/L.total));requestAnimationFrame(passo);};requestAnimationFrame(passo);})};}
async function tocar(){if(tocando){parar();return;}await actx().resume();const r=rodar(null);tocando=r.est;$v("vPlay").textContent="Parar";await r.fim;if(tocando===r.est)parar();}
async function gravar(){if(!V||gravando)return false;const c=cv();
  if(!c.captureStream||typeof MediaRecorder==="undefined"){st("Este navegador não grava vídeo. Use o Chrome ou o Safari atualizado.","err");return false;}
  const mime=["video/mp4;codecs=avc1.42E01E,mp4a.40.2","video/mp4;codecs=avc1","video/mp4","video/webm;codecs=vp9,opus","video/webm"].find(m=>MediaRecorder.isTypeSupported(m));
  if(!mime){st("Este navegador não grava vídeo.","err");return false;}
  parar();await document.fonts.ready;const ctx=actx();await ctx.resume();
  const dest=ctx.createMediaStreamDestination(),vs=c.captureStream(FPS);
  const stream=new MediaStream([...vs.getVideoTracks(),...(V._buf?dest.stream.getAudioTracks():[])]);
  const chunks=[];const mr=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:10e6,audioBitsPerSecond:192e3});mr.ondataavailable=e=>e.data.size&&chunks.push(e.data);
  gravando=mr;$v("vRec").disabled=true;$v("vTudo").disabled=true;mr.start(500);
  const r=rodar(dest,p=>st(`Gravando o vídeo… ${Math.round(p*100)}% (deixe esta aba aberta na tela)`));tocando=r.est;await r.fim;tocando=null;
  mr.stop();await new Promise(x=>mr.onstop=x);gravando=null;$v("vRec").disabled=false;$v("vTudo").disabled=false;
  const ext=mime.startsWith("video/mp4")?"mp4":"webm";const blob=new Blob(chunks,{type:mime.split(";")[0]});
  const nome=`video-${(typeof slug==="function"?slug(V.handle):"perfil")||"perfil"}-${new Date().toISOString().slice(0,10)}.${ext}`;
  try{await downloads.save({filename:nome,data:blob});st((ext==="mp4"?"Vídeo MP4 pronto e baixado":"Vídeo baixado em WebM (este navegador não grava MP4; no Chrome atualizado ou no Safari sai em MP4)")+(V._buf?", com narração e legenda.":", sem narração."),"ok");return true;}
  catch(e){st("Não consegui baixar o vídeo.","err");return false;}}
// um toque: roteiro com IA → narração → legenda sincronizada → MP4
async function tudo(){if(!V)return;if(!oaKey()&&!elKey()){st("Para sair tudo pronto, coloque a chave da OpenAI na aba Marca.","err");return;}
  $v("vTudo").disabled=true;try{if(iaOk())await roteiroIA("ficha");if(!await narrar())return;await gravar();}finally{$v("vTudo").disabled=false;}}

/* ---------------- tela ---------------- */
function st(t,c){if(typeof setStatus==="function")setStatus(PFX+"Status",t,c);}
function salvar(){try{if(db&&V){const {_buf,_durs,_tw,...d}=V;db.doc("videos2/"+V.id).set({...d,atualizadoEm:new Date().toISOString()});}}catch(e){}}
function marcar(){$v("vLista").querySelectorAll(".vcena").forEach((b,i)=>b.setAttribute("aria-current",String(i===cur)));renderCena();}
function renderLista(){if(!V)return;$v("vLista").innerHTML=V.cenas.map((c,i)=>`<button class="vcena" data-vc="${i}" aria-current="${i===cur}"><span class="n">${String(i+1).padStart(2,"0")}</span><span class="t">${esc(c.narracao||"(sem fala)")}</span><span class="k">${esc(TIPOS_V[c.visual?.tipo]||"")}</span></button>`).join("");}
function renderCena(){if(!V)return;const c=V.cenas[cur];if(!c)return;const v=c.visual||{};
  $v("vcCap").value=c.cap||"";$v("vcNarr").value=c.narracao||"";$v("vcTipo").value=v.tipo||"objeto";$v("vcObj").value=v.objeto||"nenhum";
  $v("vcValor").value=v.valor||v.texto||v.frase||"";$v("vcRot").value=v.rotulo||v.quem||v.direcao||"";
  $v("vcItens").value=(v.itens||[]).map(x=>typeof x==="object"?`${x.rotulo}; ${x.antes}; ${x.depois}`:x).join("\n");
  const t=v.tipo;$v("vfValor").querySelector("span").textContent=t==="citacao"?"Frase":t==="titulo"||t==="objeto"||t==="fim"?"Texto na tela":"Número / valor";
  $v("vfRot").querySelector("span").textContent=t==="citacao"?"Quem falou":t==="grafico"?"Rótulo (ou: sobe / cai)":"Rótulo";
  $v("vfItens").hidden=!["lista","comparativo"].includes(t);$v("vfItens").querySelector("span").textContent=t==="comparativo"?"Linhas (item; antes; depois)":"Itens (um por linha)";
  $v("vfObj").hidden=!["numero","objeto","titulo"].includes(t);$v("vcIdx").textContent=`Cena ${cur+1} de ${V.cenas.length}`;}
function editar(){const c=V.cenas[cur];if(!c)return;const v=c.visual=c.visual||{};const antes=c.narracao;c.cap=$v("vcCap").value;c.narracao=$v("vcNarr").value;v.tipo=$v("vcTipo").value;v.objeto=$v("vcObj").value;
  const a=$v("vcValor").value,b=$v("vcRot").value;delete v.valor;delete v.texto;delete v.frase;delete v.quem;delete v.rotulo;
  if(v.tipo==="citacao"){v.frase=a;v.quem=b;}else if(["titulo","objeto","fim"].includes(v.tipo))v.texto=a;else{v.valor=a;v.rotulo=b;if(v.tipo==="grafico")v.direcao=/cai|queda/i.test(b)?"cai":/oscil/i.test(b)?"oscila":"sobe";}
  const ls=$v("vcItens").value.split("\n").map(x=>x.trim()).filter(Boolean);v.itens=v.tipo==="comparativo"?ls.map(l=>{const p=l.split(";");return {rotulo:(p[0]||"").trim(),antes:(p[1]||"").trim(),depois:(p.slice(2).join(";")||"").trim()};}):ls;
  if(antes!==c.narracao&&V._buf&&!V._audioProprio){V._buf=null;V._durs=null;V._tw=null;st("A fala mudou: toque em Gerar narração de novo.");}
  renderCena();renderLista();quadro();salvar();}
function abrir(n){const perfis=APP.perfis?APP.perfis():(typeof perfisOrd==="function"?perfisOrd():[]);
  const h=APP.handle?APP.handle():((typeof atH==="function"&&atH(prefs.handle))||perfis[0]?.handle||"@seuperfil");
  V={id:"v"+Date.now().toString(36),noticiaId:n.id,noticia:n,handle:h,paleta:(typeof brandOf==="function"&&(brandOf(h)||{}).paleta)||prefs.paleta||"laranja",
    voz:"ash",vozSel:LSv.get("rv-voz-sel","oa:ash"),marca:APP.marcaTopo?APP.marcaTopo():"Radar Trader",cenas:[],criadoEm:new Date().toISOString()};
  V.cenas=roteiroDaFicha(n);cur=0;(APP.mostrar||showTab)(APP.aba||"video");$v("vVazio").hidden=true;$v("vCorpo").hidden=false;$v("vbTitulo").textContent=n.titulo;$v("vbFonte").textContent=n.fonte||"";
  $v("vPerfil").innerHTML=perfis.map(p=>`<option value="${esc(p.handle)}" ${p.handle===h?"selected":""}>${esc(p.nome||p.handle)} · ${esc(p.handle)}</option>`).join("")||`<option>${esc(h)}</option>`;
  renderVozes();
  if(!APP.semCores)$v("vCor").innerHTML=Object.entries(PALETAS).filter(([k])=>k!=="claro").map(([k,p])=>`<button class="swc" data-vcor="${k}" aria-pressed="${k===V.paleta}" title="${p.nome}" style="--b1:${p.bg1};--a1:${p.a};--a2:${p.a2}"></button>`).join("");
  $v("vMeu").value="";$v("vElKey").value=elKey()?"••••••••"+elKey().slice(-4):"";
  pronto(iaOk()?"Pronto para gerar. Toque em Fazer tudo para sair o vídeo pronto, ou vá passo a passo.":"Roteiro montado com a ficha. Coloque a chave da OpenAI na aba Marca para a IA e a narração.");
  const b=APP.marca?APP.marca(V):(typeof brandOf==="function"?brandOf(h):{});if(b?.fotoUrl||b?.foto)img(b.fotoUrl||blobSrc(b.foto));if(b?.logoUrl)img(b.logoUrl);}
window.radarVideo={abrir};
document.addEventListener("click",e=>{const b=e.target.closest(APP.botoes||"[data-video],#nbVideo");if(!b)return;e.stopPropagation();
  const n=APP.noticiaDe?APP.noticiaDe(b):(NEWS.find(x=>x.id===(b.dataset.video||(typeof deck!=="undefined"&&deck?.noticiaId)))||(typeof deck!=="undefined"&&deck?.noticia));if(n)abrir(n);},true);

/* ---------------- eventos ---------------- */
function ligarTela(){if(!$v("vCanvas"))return;
  $v("vcTipo").innerHTML=Object.entries(TIPOS_V).map(([k,v])=>`<option value="${k}">${v}</option>`).join("");
  $v("vcObj").innerHTML=Object.entries(OBJETOS).map(([k,v])=>`<option value="${k}">${v}</option>`).join("");
  $v("vLista").addEventListener("click",e=>{const b=e.target.closest("[data-vc]");if(!b)return;parar();cur=+b.dataset.vc;marcar();quadro();});
  ["vcCap","vcNarr","vcValor","vcRot","vcItens"].forEach(id=>$v(id).addEventListener("input",editar));["vcTipo","vcObj"].forEach(id=>$v(id).addEventListener("change",editar));
  if($v("vCor"))$v("vCor").addEventListener("click",e=>{const b=e.target.closest("[data-vcor]");if(!b||!V)return;V.paleta=b.dataset.vcor;$v("vCor").querySelectorAll(".swc").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));quadro();salvar();});
  $v("vPerfil").onchange=e=>{V.handle=e.target.value;const f=V.cenas[V.cenas.length-1];if(f?.visual?.tipo==="fim"){f.narracao=fimTxt();V._buf=null;}renderLista();quadro();};
  $v("vVoz").onchange=e=>{V.vozSel=e.target.value;LSv.set("rv-voz-sel",V.vozSel);if(V.vozSel.startsWith("oa:"))V.voz=V.vozSel.slice(3);if(!V._audioProprio){V._buf=null;}st("Voz trocada. Toque em Gerar narração.");quadro();};
  $v("vIA").onclick=()=>roteiroIA("ficha");$v("vUsarMeu").onclick=()=>{const t=$v("vMeu").value.trim();if(!t){st("Escreva ou cole o seu roteiro: um parágrafo por cena.","err");return;}
    if(iaOk())roteiroIA("meu");else{V.cenas=roteiroDoTexto(t);pronto("Roteiro dividido em cenas. Ajuste o visual de cada uma se quiser.");}};
  $v("vFicha").onclick=()=>{V.cenas=roteiroDaFicha(V.noticia);pronto("Roteiro montado com a ficha da notícia.");};
  $v("vNarrar").onclick=narrar;$v("vAudio").onchange=e=>{const f=e.target.files[0];if(f)audioProprio(f);e.target.value="";};
  $v("vPlay").onclick=tocar;$v("vRec").onclick=gravar;$v("vTudo").onclick=tudo;
  $v("vElSalvar").onclick=()=>{const k=$v("vElKey").value.trim();if(k&&!k.startsWith("••")){LSv.set("rv-eleven-key",k);$v("vElKey").value="••••••••"+k.slice(-4);}carregarVozesEleven();};
  $v("vElRemover").onclick=()=>{LSv.set("rv-eleven-key","");VOZES_EL=[];$v("vElKey").value="";renderVozes();st("ElevenLabs desligado.");};
  $v("vMais").onclick=()=>{V.cenas.splice(cur+1,0,{cap:"",narracao:"",visual:{tipo:"objeto",objeto:"alvo"}});cur++;V._buf=null;renderLista();renderCena();quadro();};
  $v("vMenos").onclick=()=>{if(V.cenas.length<=1)return;V.cenas.splice(cur,1);cur=Math.max(0,cur-1);V._buf=null;renderLista();renderCena();quadro();};
  $v("vLeg").onclick=()=>{const t=V?.legendaPost||"";navigator.clipboard?.writeText(t).then(()=>st("Legenda do post copiada.","ok"),()=>st(t));};
  if(elKey())carregarVozesEleven();
  document.fonts?.ready.then(quadro);}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",ligarTela);else ligarTela();
})();
