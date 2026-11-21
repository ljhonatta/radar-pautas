/* Radar Trader · Estúdio de vídeo (Reels 1080×1920).
   Notícia → roteiro (IA, ficha ou o seu) → narração (voz da OpenAI ou seu áudio) → cenas animadas com legenda → MP4.
   Linguagem visual: palco escuro com luz de cima, um objeto 3D de "argila" por cena, cards com número grande e
   legenda palavra por palavra. Grade fixa (margem 72px), uma cor de destaque, sem brilho exagerado. */
(function(){
const W=1080,H=1920,MX=72,FPS=30;
const VOZES={ash:"Ash (masculina, natural)",onyx:"Onyx (grave)",echo:"Echo (masculina leve)",nova:"Nova (feminina)",coral:"Coral (feminina calma)",sage:"Sage (feminina)",alloy:"Alloy (neutra)"};
const OBJETOS={"seta-baixo":"Seta para baixo","seta-cima":"Seta para cima",termometro:"Termômetro (juros)",pilha:"Pilha de dinheiro",moedas:"Moedas",predio:"Prédio (Bolsa, BC)",
  "placa-pare":"Placa de pare",alvo:"Alvo",relogio:"Relógio",calendario:"Calendário",cartao:"Cartão",escudo:"Escudo",lupa:"Lupa",barras:"Barras",
  pessoa:"Personagem",grupo:"Grupo de pessoas",cifrao:"Símbolo R$",barril:"Barril de petróleo",cofre:"Cofrinho",casa:"Casa",carrinho:"Carrinho de compras",monitor:"Tela com gráfico",megafone:"Megafone",balanca:"Balança",nenhum:"Sem objeto"};
const TIPOS_V={cena:"Cena montada (vários elementos)",numero:"Número em destaque",objeto:"Objeto + frase",grafico:"Gráfico",comparativo:"Antes × depois",lista:"Lista",citacao:"Citação",titulo:"Título",fim:"Fechamento (seguir)"};
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
    const dia=PAR().dia;if(dia){fonte(g,900,150);g.textAlign="center";g.fillStyle="#26272b";g.fillText(dia,0,120);}
    else{for(let r=0;r<3;r++)for(let c=0;c<5;c++){const on=r===1&&c===3;g.fillStyle=on?A:"rgba(0,0,0,.16)";rr(g,-150+c*62,-50+r*62,44,40,8);g.fill();}}break;}
  case "cartao":{g.save();g.rotate(-.12);ext(g,P,g=>{rr(g,-210,-130,420,260,30);},18,{face:mix(P.clay,A,.25)});g.fillStyle="#d8c690";rr(g,-160,-50,74,56,10);g.fill();
    g.fillStyle="rgba(0,0,0,.25)";for(let i=0;i<4;i++)rr(g,-160+i*86,60,66,16,8),g.fill();g.restore();break;}
  case "escudo":{ext(g,P,g=>{g.beginPath();g.moveTo(0,-210);g.lineTo(170,-150);g.lineTo(170,-10);g.bezierCurveTo(170,110,80,170,0,210);g.bezierCurveTo(-80,170,-170,110,-170,-10);g.lineTo(-170,-150);g.closePath();},30);
    g.strokeStyle=A;g.lineWidth=26;g.lineCap="round";g.lineJoin="round";const k=ease.out(f);g.beginPath();g.moveTo(-70,0);g.lineTo(-70+50*cl(k*2),50*cl(k*2));if(k>.5)g.lineTo(-20+110*cl((k-.5)*2),50-130*cl((k-.5)*2));g.stroke();break;}
  case "lupa":{g.save();g.rotate(-.5);ext(g,P,g=>{rr(g,-26,110,52,170,20);},22);g.restore();ext(g,P,g=>{g.beginPath();g.arc(0,-30,150,0,7);g.arc(0,-30,108,0,7,true);},28);
    const le=g.createRadialGradient(-40,-80,10,0,-30,112);le.addColorStop(0,"#f3f6f8");le.addColorStop(.7,"#c9d2d8");le.addColorStop(1,mix("#c9d2d8",A,.35));g.fillStyle=le;g.beginPath();g.arc(0,-30,108,0,7);g.fill();
    g.strokeStyle=rgba(A,.9);g.lineWidth=6;g.beginPath();g.arc(0,-30,112,0,7);g.stroke();g.fillStyle="rgba(255,255,255,.55)";g.beginPath();g.ellipse(-44,-84,30,13,-.6,0,7);g.fill();break;}
  case "pessoa":{const k=ease.out(f);
    ext(g,P,g=>{rr(g,-34,40,30,140,14);},12);ext(g,P,g=>{rr(g,4,40,30,140,14);},12); // pernas
    ext(g,P,g=>{rr(g,-70,-90,140,150,40);},18,{face:"#2b2c31",lado:"#1c1d21"}); // tronco (terno)
    g.fillStyle=A;g.save();g.beginPath();g.moveTo(-60,-80);g.lineTo(-40,-90);g.lineTo(60,40);g.lineTo(40,52);g.closePath();g.globalAlpha=.9*k+.1;g.fill();g.restore(); // faixa
    ext(g,P,g=>{rr(g,-96,-80,30,120,15);},10,{face:"#2b2c31",lado:"#1c1d21"});ext(g,P,g=>{rr(g,66,-80,30,120,15);},10,{face:"#2b2c31",lado:"#1c1d21"}); // braços
    ext(g,P,g=>{g.beginPath();g.arc(0,-140,46,0,7);},14); // cabeça
    g.fillStyle="#f6f5f1";g.beginPath();g.moveTo(-14,-88);g.lineTo(14,-88);g.lineTo(0,-50);g.closePath();g.fill();break;}
  case "grupo":{for(const [x,s] of [[-150,.62],[150,.62],[0,.75]]){g.save();g.translate(x,40*(1-s)/.4);g.scale(s,s);
      ext(g,P,g=>{rr(g,-60,-80,120,170,40);},14,{face:x?P.clay:mix(P.clay,A,.35)});ext(g,P,g=>{g.beginPath();g.arc(0,-130,44,0,7);},12);g.restore();}break;}
  case "cifrao":{fonte(g,900,300);g.textAlign="center";g.textBaseline="middle";const tx=PAR().simbolo||"R$";
    for(let i=26;i>0;i-=1.5){g.fillStyle=i>14?P.clayS:P.clayD;g.fillText(tx,i*.42,10+i*.62);}
    const gr=g.createLinearGradient(-150,-150,150,150);gr.addColorStop(0,mix(A,"#ffffff",.35));gr.addColorStop(1,A);g.fillStyle=gr;g.fillText(tx,0,10);g.textBaseline="alphabetic";break;}
  case "barril":{const cor=mix("#2b2c31",A,.15);g.fillStyle="#1a1b1f";g.beginPath();g.ellipse(0,170,120,34,0,0,7);g.fill();
    g.fillStyle=cor;rr(g,-120,-170,240,340,16);g.fill();const gr=g.createLinearGradient(-120,0,120,0);gr.addColorStop(0,"rgba(255,255,255,.18)");gr.addColorStop(.4,"rgba(255,255,255,.04)");gr.addColorStop(1,"rgba(0,0,0,.35)");g.fillStyle=gr;rr(g,-120,-170,240,340,16);g.fill();
    g.fillStyle=A;for(const y of [-100,90])g.fillRect(-120,y,240,16);g.fillStyle="#3a3b41";g.beginPath();g.ellipse(0,-170,120,34,0,0,7);g.fill();g.strokeStyle="rgba(255,255,255,.4)";g.lineWidth=3;g.stroke();
    g.fillStyle="#111";g.beginPath();g.ellipse(50,-172,18,6,0,0,7);g.fill();break;}
  case "cofre":{ext(g,P,g=>{g.beginPath();g.ellipse(0,0,190,140,0,0,7);},26,{face:mix(P.clay,A,.25)});ext(g,P,g=>{g.beginPath();g.ellipse(185,10,44,52,0,0,7);},14,{face:mix(P.clay,A,.35)});
    for(const x of [-110,-30,50,120])ext(g,P,g=>{rr(g,x-20,110,40,70,12);},10,{face:mix(P.clay,A,.25)});
    g.fillStyle="#26272b";rr(g,-50,-138,100,14,7);g.fill();g.beginPath();g.arc(100,-40,10,0,7);g.fill();
    const k=ease.out(cl(f*1.5));if(k<1){g.save();g.translate(0,-180-160*(1-k));ext(g,P,g=>{g.beginPath();g.ellipse(0,0,46,46,0,0,7);},10,{face:mix(A,"#ffffff",.25)});g.restore();}break;}
  case "casa":{ext(g,P,g=>{g.beginPath();g.moveTo(-200,-20);g.lineTo(0,-200);g.lineTo(200,-20);g.closePath();},26,{face:mix(P.clay,A,.55)});ext(g,P,g=>{rr(g,-160,-30,320,210,8);},26);
    g.fillStyle="#26272b";rr(g,-40,60,80,120,8);g.fill();g.fillStyle=rgba(A,.8);rr(g,60,10,70,60,6);g.fill();rr(g,-130,10,70,60,6);g.fill();break;}
  case "carrinho":{g.strokeStyle=P.clay;g.lineWidth=18;g.lineCap="round";g.lineJoin="round";g.beginPath();g.moveTo(-220,-140);g.lineTo(-170,-140);g.lineTo(-120,80);g.lineTo(150,80);g.stroke();
    ext(g,P,g=>{g.beginPath();g.moveTo(-160,-100);g.lineTo(200,-100);g.lineTo(160,40);g.lineTo(-125,40);g.closePath();},20);
    const n=Math.round(4*ease.out(f));for(let i=0;i<n;i++)ext(g,P,g=>{rr(g,-110+i*70,-170+(i%2)*20,56,80,10);},10,{face:i%2?mix(P.clay,A,.6):mix(P.clay,"#7fb3ff",.25)});
    for(const x of [-90,120]){g.fillStyle="#26272b";g.beginPath();g.arc(x,130,26,0,7);g.fill();g.strokeStyle=P.clay;g.lineWidth=6;g.stroke();}break;}
  case "monitor":{ext(g,P,g=>{rr(g,-30,120,60,70,8);},12);ext(g,P,g=>{rr(g,-120,180,240,20,8);},10);ext(g,P,g=>{rr(g,-230,-170,460,300,22);},22,{face:"#2b2c31",lado:"#1c1d21"});
    g.fillStyle="#0d0e11";rr(g,-206,-148,412,256,12);g.fill();const dir=PAR().direcao==="cai"?-1:1,m=Math.max(2,Math.floor(ease.inout(cl(f))*24));
    g.strokeStyle=dir>0?P.pos:P.neg;g.lineWidth=6;g.lineJoin="round";g.beginPath();for(let i=0;i<=m;i++){const x=-186+i*16,y=-20-dir*(i*7-80)+Math.sin(i*1.9)*18;i?g.lineTo(x,y):g.moveTo(x,y);}g.stroke();break;}
  case "megafone":{g.save();g.rotate(-.25);ext(g,P,g=>{g.beginPath();g.moveTo(-140,-50);g.lineTo(120,-150);g.lineTo(120,150);g.lineTo(-140,50);g.closePath();},26,{face:mix(P.clay,A,.25)});
    ext(g,P,g=>{rr(g,-200,-50,70,100,14);},18);ext(g,P,g=>{rr(g,-120,40,40,110,14);},12);g.restore();
    g.strokeStyle=A;g.lineWidth=10;g.lineCap="round";for(const r of [70,120]){g.globalAlpha=.4+.6*Math.abs(Math.sin(t*3+r));g.beginPath();g.arc(140,-40,r,-.6,.6);g.stroke();}g.globalAlpha=1;break;}
  case "balanca":{const inc=.18*Math.sin(t*1.4)*(1-ease.out(cl(f)))+(PAR().direcao==="cai"?-.12:.12)*ease.out(cl(f));
    ext(g,P,g=>{rr(g,-80,150,160,30,10);},12);ext(g,P,g=>{rr(g,-12,-150,24,310,10);},12);g.save();g.translate(0,-150);g.rotate(inc);ext(g,P,g=>{rr(g,-210,-10,420,20,10);},10);
    for(const x of [-190,190]){g.save();g.translate(x,0);g.rotate(-inc);g.strokeStyle=P.clayD;g.lineWidth=4;g.beginPath();g.moveTo(0,0);g.lineTo(-60,120);g.moveTo(0,0);g.lineTo(60,120);g.stroke();
      ext(g,P,g=>{g.beginPath();g.ellipse(0,125,80,20,0,0,7);},10,{face:x<0?mix(P.clay,A,.4):P.clay});g.restore();}g.restore();break;}
  case "barras":{const dir=PAR().direcao==="cai"?-1:1;const hs=dir>0?[110,190,290]:[290,190,110];
    hs.forEach((h,i)=>{const hh=h*ease.out(cl(f*1.3-i*.15));ext(g,P,g=>{rr(g,-200+i*140,170-hh,110,hh,10);},26,{face:i===(dir>0?2:0)?mix(P.clay,A,.6):P.clay});});break;}
  }
}

// objeto que já terminou de entrar é desenhado uma vez numa imagem e reaproveitado nos quadros seguintes (gravação fluida)
const OBJ_VIVOS=new Set(["relogio","megafone","balanca"]),OBJ_CACHE=new Map();
function objetoRapido(g,P,nome,t,f){if(f<1||OBJ_VIVOS.has(nome)){objeto(g,P,nome,t,f);return;}
  const par=PAR(),k=[nome,P.a,P.a2,par.direcao||"",par.simbolo||"",par.dia||"",nome==="predio"?V?.predioTxt||"":""].join("|");let c=OBJ_CACHE.get(k);
  if(!c){c=document.createElement("canvas");c.width=c.height=1100;const x=c.getContext("2d");x.translate(550,520);x.scale(1.25,1.25);objeto(x,P,nome,t,1);
    if(OBJ_CACHE.size>80)OBJ_CACHE.clear();OBJ_CACHE.set(k,c);}
  g.drawImage(c,-550/1.25,-520/1.25,1100/1.25,1100/1.25);}

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
/* ---------------- cena montada: vários elementos entrando junto com a fala ----------------
   atores: [{tipo:"objeto"|"numero"|"etiqueta"|"citacao", objeto, valor, rotulo, texto, quem, gatilho, direcao}]
   Cada ator aparece na palavra "gatilho" da fala. Números ficam num card no alto (o mais novo substitui o anterior);
   objetos e etiquetas formam uma fileira no palco, cada um com a sua sombra e a sua etiqueta presa. */
let ATOR=null;const PAR=()=>ATOR||V?.cenas?.[cur]?.visual||{};
const semAcento=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9%$]/g,"");
function temposPalavras(c,i,dur){const ws=palavras(c.narracao);if(V._tw&&V._tw[i]&&V._tw[i].length===ws.length)return V._tw[i];
  const pesos=ws.map(w=>w.length+2+(/[.,;:!?…]$/.test(w)?4:0)),tot=pesos.reduce((a,b)=>a+b,0)||1,fala=Math.max(.5,dur-.25);let acc=0;return pesos.map(p=>{const s=acc/tot*fala;acc+=p;return s;});}
// instante (dentro da cena) em que cada ator entra
function entradas(c,i,dur){const at=(c.visual||{}).atores||[],ws=palavras(c.narracao).map(semAcento),tw=temposPalavras(c,i,dur);
  return at.map((a,k)=>{const gt=semAcento(String(a.gatilho||"").split(/\s+/)[0]);let j=gt?ws.findIndex(w=>w&&(w.startsWith(gt)||gt.startsWith(w)&&w.length>3)):-1;
    if(j<0)j=Math.round(k/Math.max(1,at.length)*Math.max(0,ws.length-1)*.8);return Math.max(.05,(tw[j]??0)-.1);});}
// atores herdados: a cena com "continua" mantém o palco da anterior e só acrescenta
function elenco(i,L){const c=V.cenas[i],v=c.visual||{},own=(v.atores||[]).map((a,k)=>({a,t:entradas(c,i,L.dur[i])[k],own:true}));
  if(!v.continua||i===0||(V.cenas[i-1].visual||{}).tipo!=="cena")return own;
  const ant=elenco(i-1,L).map(x=>({a:x.a,t:-99,own:false}));return [...ant,...own];}
function etiqueta(g,P,txt,x,y,k,forte){if(!txt||k<=0)return;fonte(g,700,24,"'JetBrains Mono',monospace");espaco(g,"2px");const t=String(txt).toUpperCase(),w=Math.min(W-2*MX,g.measureText(t).width+40);
  g.save();g.globalAlpha=k;g.translate(x,y+(1-k)*16);g.fillStyle=forte?P.a:"rgba(18,19,23,.92)";rr(g,-w/2,-24,w,48,10);g.fill();if(!forte){g.strokeStyle=rgba(P.a,.6);g.lineWidth=2;g.stroke();}
  g.fillStyle=forte?"#fff":P.txt;g.textAlign="center";g.fillText(t,0,9,w-30);espaco(g,"0px");g.restore();}
function laje(g,P,txt,k){ // etiqueta como bloco 3D no palco
  fonte(g,800,36);const ls=quebra(g,String(txt||"").toUpperCase(),330).slice(0,3),w=Math.max(220,Math.min(380,Math.max(...ls.map(l=>g.measureText(l).width))+60)),h=ls.length*44+50;
  g.save();g.rotate(-.04);ext(g,P,g=>{rr(g,-w/2,-h/2,w,h,10);},16,{face:mix(P.a,"#0e0f12",.15),lado:mix(P.a,"#000",.55),semBorda:true});
  g.fillStyle="#fff";g.textAlign="center";ls.forEach((l,j)=>g.fillText(l,0,-h/2+25+36+j*44));g.restore();}
function entradaObj(nome,k){ // deslocamento e escala de entrada por tipo de objeto
  if(nome==="seta-baixo")return {dy:-520*(1-ease.out(k))+Math.sin(k*Math.PI)*0,s:1,bounce:k>.6?Math.sin((k-.6)/.4*Math.PI)*-18:0};
  if(nome==="seta-cima")return {dy:420*(1-ease.out(k)),s:1,bounce:0};
  if(nome==="carrinho"||nome==="grupo")return {dx:-700*(1-ease.out(k)),s:1,bounce:0};
  return {dy:0,s:.55+.45*ease.back(k),bounce:0};}
function desCena(g,P,c,i,tc,L,tAbs){const v=c.visual||{},el=elenco(i,L);
  // número: só o mais recente que já entrou
  const nums=el.filter(x=>x.a.tipo==="numero"&&tc>=x.t);const num=nums[nums.length-1];
  const cits=el.filter(x=>x.a.tipo==="citacao"&&tc>=x.t);const cit=cits[cits.length-1];
  const palco=el.filter(x=>x.a.tipo==="objeto"||x.a.tipo==="etiqueta").slice(-4);
  const n=palco.length,esc=(n<=1?1.05:n===2?.8:n===3?.62:.5)*(cit?.8:1),gap=n<=1?0:(W-2*MX-40)/(n),x0=W/2-gap*(n-1)/2,base=cit?1230:num?1170:1090;
  palco.forEach((x,j)=>{const k=cl((tc-x.t)/.6);if(k<=0)return;ATOR=x.a;const px=x0+j*gap,py=base-40+Math.sin(tAbs*1.5+j)*7;
    g.save();if(x.a.tipo==="etiqueta"){g.translate(px,py-60);const s=esc*1.05*(.6+.4*ease.back(k));g.scale(s,s);g.globalAlpha*=cl(k*2);laje(g,P,x.a.texto||x.a.rotulo,k);g.restore();}
    else{const e=entradaObj(x.a.objeto,k);g.translate(px+(e.dx||0),py+(e.dy||0)+(e.bounce||0));g.scale(esc*e.s,esc*e.s);g.globalAlpha*=cl(k*2.5);
      g.save();g.translate(0,190);sombra(g,170);g.restore();objetoRapido(g,P,x.a.objeto,tAbs,x.t<-50?1:cl((tc-x.t)/1.4));g.restore();
      if(x.a.rotulo)etiqueta(g,P,x.a.rotulo,px,py-250*esc-30,ease.out(cl((tc-x.t-.25)/.4)),false);}
    ATOR=null;});
  if(num)cardNumero(g,P,num.a,tc-num.t,n?690:950);
  else if(cit)desCitacao(g,P,{frase:cit.a.frase||cit.a.texto,quem:cit.a.quem},tc-cit.t,n?870:1080);
}
function desenhar(g,tAbs,L){
  const P=paleta();let i=L.ini.findIndex((s,k)=>tAbs<s+L.dur[k]);if(i<0)i=L.ini.length-1;
  const c=V.cenas[i],tc=tAbs-L.ini[i],dur=L.dur[i],v=c.visual||{},tipo=v.tipo||"objeto";
  const continua=tipo==="cena"&&v.continua&&i>0,proxContinua=(V.cenas[i+1]?.visual||{}).continua&&(V.cenas[i+1]?.visual||{}).tipo==="cena"&&tipo==="cena";
  const sai=proxContinua?1:cl((dur-tc)/.28),ent=cl(tc/.3),al=Math.min(sai,1);const cy=tipo==="fim"?1000:1060;
  g.setTransform(1,0,0,1,0,0);fundo(g,tAbs,P,cy);
  // câmera: aproximação lenta durante a cena
  // câmera: aproxima devagar; cena nova entra subindo um pouco (cena que continua não pula)
  const zoom=1+.05*ease.inout(cl(tc/Math.max(1,dur)))+(continua?0:.04*(1-ease.out(cl(tc/.45))));const sobe=continua?0:60*(1-ease.out(cl(tc/.45)));
  g.save();g.translate(W/2,cy+sobe);g.scale(zoom,zoom);g.translate(-W/2,-cy);
  g.globalAlpha=al;
  const obj=v.objeto&&v.objeto!=="nenhum"?v.objeto:null;
  if(tipo==="numero"||tipo==="objeto"||tipo==="titulo"){
    if(obj){const k=ease.back(cl(tc/.55));g.save();g.translate(W/2,cy-40+Math.sin(tAbs*1.6)*9);g.scale(.62+.38*k,.62+.38*k);g.rotate(Math.sin(tAbs*.9)*.025);
      g.save();g.translate(0,190);sombra(g,170);g.restore();objetoRapido(g,P,obj,tAbs,cl(tc/1.2));g.restore();}
    if(tipo==="numero")cardNumero(g,P,v,tc,obj?720:1000);
    else if(tipo==="titulo")cardFrase(g,P,v.texto||c.narracao,tc,obj?700:1000,obj?64:84);
    else if(v.texto)cardFrase(g,P,v.texto,tc,700,52);
  }else if(tipo==="grafico"){desGrafico(g,P,v,tc);}
  else if(tipo==="comparativo"){desComp(g,P,v,tc);}
  else if(tipo==="lista"){desLista(g,P,v,tc);}
  else if(tipo==="citacao"){desCitacao(g,P,v,tc);}
  else if(tipo==="fim"){desFim(g,P,v,tc,tAbs);}
  else if(tipo==="cena"){desCena(g,P,c,i,tc,L,tAbs);}
  g.restore();g.globalAlpha=1;
  cabecalho(g,P,c,Math.min(continua?1:ent,sai)*.999+.001);
  if(v.topico)etiqueta(g,P,v.topico,W/2,290,ease.out(cl((tc-.1)/.4))*Math.min(1,sai),true);
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
function desCitacao(g,P,v,tc,yb){const k=ease.out(prog(tc,.1,.5));const x=MX+10,w=W-2*MX-20;let fs=58,ls;
  for(;fs>=36;fs-=4){fonte(g,800,fs);ls=quebra(g,"“"+(v.frase||"")+"”",w-110);if(ls.length*(fs*1.2)+190<=(yb||1080)-340)break;}ls=ls.slice(0,6);
  const lh=fs*1.2,h=ls.length*lh+190,y=Math.max(340,(yb||1080)-h);card(g,P,x,y,w,h,k,(1-k)*30);g.save();g.globalAlpha=k;g.translate(0,(1-k)*30);g.fillStyle=P.txt;g.textAlign="left";
  ls.forEach((l,i)=>g.fillText(l,x+60,y+90+i*lh));fonte(g,600,26,"'JetBrains Mono',monospace");espaco(g,"2px");g.fillStyle=P.a2;g.fillText("— "+String(v.quem||"").toUpperCase().slice(0,48),x+60,y+h-50);espaco(g,"0px");g.restore();}
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
// Fish Audio passa pela ponte na Vercel (a API deles não aceita chamada do navegador); mesmas chaves do "Vídeo clássico"
const fishKey=()=>LSv.get("radar-fish-key",""),fishVoz=()=>LSv.get("radar-fish-voz","");
const PONTE_FISH="https://estudio-de-cards.vercel.app/api/fish";
// direção de voz: a base vale para todo o vídeo; cada cena ganha um ajuste conforme o papel dela
const INSTR_BASE="Português do Brasil, sotaque brasileiro natural. Você é um criador de conteúdo de economia gravando um Reels que precisa prender a atenção: "+
  "energia alta e contagiante, sorriso na voz, entonação que sobe e desce (nunca monótono), ênfase forte nos números e nas palavras-chave, "+
  "pausas curtas e intencionais nas vírgulas e reticências, perguntas com entonação de pergunta. Ritmo dinâmico, sem pressa e sem arrastar. Nada de tom de locutor de rádio, de leitura ou de robô.";
function direcao(c,i,n){const cap=String(c.cap||"").toUpperCase(),t=(c.visual||{}).tipo;
  if(i===0)return "Abertura: comece com impacto, como quem conta uma novidade surpreendente para um amigo; energia máxima, segure a atenção nos primeiros segundos.";
  if(t==="fim")return "Fechamento: tom caloroso e convidativo, sorrindo, chamando para a ação com convicção.";
  if(t==="numero"||/N[ÚU]MERO|CONTA/.test(cap))return "Cena de número: faça uma micro pausa antes do número e dê ênfase forte nele, como uma revelação.";
  if(/IMPACTO|IMPORTA/.test(cap))return "Cena de impacto: tom sério e firme, ênfase na consequência, mostrando por que isso mexe com a vida de quem assiste.";
  if(/ENTENDA/.test(cap))return "Cena didática: tom de professor descontraído, claro e simpático, como quem desenrola um conceito difícil.";
  if(/AGORA|OBSERV/.test(cap))return "Cena de expectativa: tom de suspense leve, criando curiosidade pelo que vem a seguir.";
  if(t==="citacao")return "Cena de citação: tom de quem conta o que alguém importante disse, com ênfase na frase.";
  return "Cena de desenvolvimento: tom de conversa animada, avançando a história com ritmo.";}
function textoNarr(){return V.cenas.map(c=>String(c.narracao||"").trim()).filter(Boolean).map(t=>/[.!?…]$/.test(t)?t:t+".").join(" ");}
const pont=t=>{t=String(t||"").trim();return /[.!?…]$/.test(t)?t:t+".";};
async function vozOpenAI(txt,instr){const key=oaKey();if(!key)throw {code:"sem_chave"};let r;
  for(const modelo of ["gpt-4o-mini-tts","tts-1-hd"]){r=await fetch("https://api.openai.com/v1/audio/speech",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},
      body:JSON.stringify({model:modelo,voice:V.voz||"ash",input:txt,response_format:"mp3",...(modelo==="gpt-4o-mini-tts"?{instructions:INSTR_BASE+" "+(instr||"")}:{speed:1.08})})});
    if(r.ok)break;if(r.status===401)throw {code:"bad_key"};}
  if(!r.ok)throw {code:"http_"+r.status};return await r.arrayBuffer();}
// se a voz escolhida não existe para esta chave (chave de outro espaço de trabalho do ElevenLabs), usa uma voz da própria conta:
// primeiro uma chamada "Yuri", depois uma brasileira, depois a primeira disponível
let EL_TROCA=null;
async function vozDaConta(){const r=await fetch("https://api.elevenlabs.io/v1/voices",{headers:{"xi-api-key":elKey()}});if(!r.ok)return null;const vs=(await r.json()).voices||[];
  const br=v=>/portug|brazil|brasil|pt-br|\bpt\b/i.test(JSON.stringify(v.labels||{})+" "+(v.description||""));
  return vs.find(v=>v.voice_id===VOZ_PADRAO_EL.id)||vs.find(v=>/yuri/i.test(v.name))||vs.find(br)||vs[0]||{voice_id:VOZ_PADRAO_EL.id,name:"George"};}
async function vozEleven(txt,voz,ant,dep){if(EL_TROCA&&EL_TROCA.de===voz)voz=EL_TROCA.para;
  const pede=v=>fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(v)}?output_format=mp3_44100_128`,{method:"POST",
    headers:{"xi-api-key":elKey(),"Content-Type":"application/json"},body:JSON.stringify({text:txt,model_id:"eleven_multilingual_v2",previous_text:ant||undefined,next_text:dep||undefined,
      voice_settings:{stability:.32,similarity_boost:.8,style:.6,use_speaker_boost:true}})});
  let r=await pede(voz);
  if(r.status===404||r.status===400&&/voice/i.test(await r.clone().text())){const alt=await vozDaConta();
    if(alt&&alt.voice_id!==voz){EL_TROCA={de:voz,para:alt.voice_id,nome:alt.name};r=await pede(alt.voice_id);}}
  if(r.status===401)throw {code:"eleven_key"};
  if(!r.ok){let m="";try{const j=await r.json();m=j?.detail?.message||j?.detail?.status||(typeof j?.detail==="string"?j.detail:"");}catch(e){}throw {code:"eleven_"+r.status,msg:m};}
  return await r.arrayBuffer();}
function pedacos(txt,max){const fr=txt.split(/(?<=[.!?…])\s+/),out=[];let a="";for(const f of fr){if((a+" "+f).trim().length>max&&a){out.push(a.trim());a=f;}else a=(a+" "+f).trim();}if(a)out.push(a);return out;}
async function vozFish(txt){const partes=[];for(const t of pedacos(txt,1800)){
    const r=await fetch(PONTE_FISH,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key:fishKey(),voz:fishVoz(),text:t})});
    if(!r.ok){let m="";try{m=(await r.json())?.error?.message||"";}catch(e){}throw {code:r.status===401?"fish_key":r.status===402?"fish_credito":"fish_"+r.status,msg:m};}
    partes.push(new Uint8Array(await r.arrayBuffer()));}
  const tot=partes.reduce((a,b)=>a+b.length,0),u=new Uint8Array(tot);let o=0;for(const p of partes){u.set(p,o);o+=p.length;}return u.buffer;}
// tira o silêncio que as vozes deixam no começo e no fim, para a pausa entre cenas ser a que a gente escolhe
function aparar(b){const d=b.getChannelData(0),lim=.012,sr=b.sampleRate;let i=0,j=d.length-1;while(i<d.length&&Math.abs(d[i])<lim)i++;while(j>i&&Math.abs(d[j])<lim)j--;
  i=Math.max(0,i-Math.round(sr*.04));j=Math.min(d.length-1,j+Math.round(sr*.12));const out=actx().createBuffer(1,Math.max(1,j-i),sr);
  const m=new Float32Array(j-i);for(let c=0;c<b.numberOfChannels;c++){const x=b.getChannelData(c);for(let k=0;k<m.length;k++)m[k]+=x[i+k]/b.numberOfChannels;}out.copyToChannel(m,0);return out;}
// pausas entre cenas: maior depois do gancho e antes do fechamento
function pausa(i,n){if(i===0)return .55;if(i===n-2)return .5;return .32;}
function emendar(bufs){const sr=bufs[0].sampleRate,n=bufs.length;let tot=0;const ini=[];bufs.forEach((b,i)=>{ini.push(tot);tot+=b.length/sr+(i<n-1?pausa(i,n):.4);});
  const out=actx().createBuffer(1,Math.ceil(tot*sr),sr),d=out.getChannelData(0);bufs.forEach((b,i)=>d.set(b.getChannelData(0),Math.round(ini[i]*sr)));return {buf:out,ini,lens:bufs.map(b=>b.length/sr)};}
function wav(b){const d=b.getChannelData(0),sr=b.sampleRate,ab=new ArrayBuffer(44+d.length*2),v=new DataView(ab),w=(o,s)=>[...s].forEach((c,i)=>v.setUint8(o+i,c.charCodeAt(0)));
  w(0,"RIFF");v.setUint32(4,36+d.length*2,true);w(8,"WAVEfmt ");v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,sr,true);v.setUint32(28,sr*2,true);
  v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,"data");v.setUint32(40,d.length*2,true);for(let i=0;i<d.length;i++)v.setInt16(44+i*2,Math.max(-1,Math.min(1,d[i]))*32767,true);return ab;}
// "ouve" o áudio pronto para saber o tempo de cada palavra (legenda no tempo exato da fala)
async function ouvir(audio,tipo){const key=oaKey();if(!key)return null;try{const fd=new FormData();fd.append("file",new Blob([audio],{type:tipo||"audio/mpeg"}),tipo==="audio/wav"?"narracao.wav":"narracao.mp3");fd.append("model","whisper-1");
    fd.append("language","pt");fd.append("response_format","verbose_json");fd.append("timestamp_granularities[]","word");
    const r=await fetch("https://api.openai.com/v1/audio/transcriptions",{method:"POST",headers:{"Authorization":"Bearer "+key},body:fd});if(!r.ok)return null;const j=await r.json();
    return Array.isArray(j.words)&&j.words.length?j.words.map(w=>({w:String(w.word||""),s:+w.start,e:+w.end})):null;}catch(e){return null;}}
// áudio enviado pelo usuário (um arquivo só): divide pelas palavras ouvidas ou pelo tamanho das falas
function alinhar(dur,ouvidas){const cenas=V.cenas.map(c=>palavras(c.narracao));const tot=cenas.reduce((a,b)=>a+b.length,0);if(!tot){V._durs=V.cenas.map(()=>dur/V.cenas.length);V._tw=null;return;}
  let tempos=[];
  if(ouvidas&&ouvidas.length){const n=ouvidas.length;for(let k=0;k<tot;k++){const j=Math.min(n-1,Math.round(k*(n/tot)));tempos.push(ouvidas[j].s);}}
  else{const ws=cenas.flat(),pesos=ws.map(w=>w.length+2+(/[.,;:!?]$/.test(w)?5:0)),sp=pesos.reduce((a,b)=>a+b,0);let acc=0;tempos=pesos.map(p=>{const s=acc/sp*dur;acc+=p;return s;});}
  let k=0;const ini=[];cenas.forEach(ws=>{ini.push(ws.length?Math.max(0,tempos[k]-.12):null);k+=ws.length;});
  for(let i=0;i<ini.length;i++)if(ini[i]==null)ini[i]=i?ini[i-1]:0;ini[0]=0;
  V._durs=ini.map((s,i)=>((i+1<ini.length?ini[i+1]:dur+.6)-s));k=0;V._tw=cenas.map((ws,i)=>{const t=ws.map((w,j)=>tempos[k+j]-ini[i]);k+=ws.length;return t;});}
// narração gerada cena a cena: sabemos onde cada cena começa; as palavras ouvidas só afinam a legenda dentro de cada cena
function alinharCenas(E,ouvidas){const n=V.cenas.length;V._durs=E.ini.map((s,i)=>(i+1<n?E.ini[i+1]:E.buf.duration+.3)-s);
  V._tw=V.cenas.map((c,i)=>{const ws=palavras(c.narracao);if(!ws.length)return [];const a=E.ini[i],b=a+E.lens[i];
    const dentro=(ouvidas||[]).filter(w=>w.s>=a-.05&&w.s<b+.05);
    if(dentro.length>=Math.max(2,ws.length*.5)){return ws.map((w,j)=>dentro[Math.min(dentro.length-1,Math.round(j*dentro.length/ws.length))].s-a);}
    const pesos=ws.map(w=>w.length+2+(/[.,;:!?…]$/.test(w)?5:0)),sp=pesos.reduce((x,y)=>x+y,0);let acc=0;return pesos.map(p=>{const s=acc/sp*E.lens[i];acc+=p;return s;});});}
async function narrar(){if(!V)return false;if(!textoNarr()){st("O roteiro está vazio.","err");return false;}
  const ev=$v("vVoz").value||(elKey()?"el:"+VOZ_PADRAO_EL.id:"");const usarEl=ev.startsWith("el:")&&elKey(),usarFish=ev==="fish";
  if(usarFish&&!fishKey()){st("Coloque a chave do Fish Audio e o ID da voz em \"Fish Audio\" aqui embaixo.","err");return false;}
  if(!usarEl&&!usarFish&&!oaKey()){st("Para a narração, coloque a chave da OpenAI na aba Marca (ou ligue o Fish Audio ou o ElevenLabs aqui embaixo).","err");return false;}
  const nome=usarFish?"Fish Audio":usarEl?"ElevenLabs":"OpenAI";$v("vNarrar").disabled=true;
  try{const cs=V.cenas,n=cs.length,bufs=new Array(n);let feitos=0;st(`Gravando a narração (${nome}): 0 de ${n} cenas…`);
    const uma=async i=>{const t=pont(cs[i].narracao);if(!String(cs[i].narracao||"").trim()){bufs[i]=actx().createBuffer(1,Math.round(actx().sampleRate*.6),actx().sampleRate);return;}
      const mp3=usarFish?await vozFish(t):usarEl?await vozEleven(t,ev.slice(3),cs[i-1]?.narracao,cs[i+1]?.narracao):await vozOpenAI(t,direcao(cs[i],i,n));
      bufs[i]=aparar(await actx().decodeAudioData(mp3.slice(0)));feitos++;st(`Gravando a narração (${nome}): ${feitos} de ${n} cenas…`);};
    const fila=[...Array(n).keys()];await Promise.all(Array.from({length:4},async()=>{while(fila.length)await uma(fila.shift());}));
    const E=emendar(bufs);V._buf=E.buf;V._audioProprio=false;st("Sincronizando a legenda com a fala…");
    const ouvidas=await ouvir(wav(E.buf),"audio/wav");alinharCenas(E,ouvidas);
    st(`Narração pronta (${Math.round(E.buf.duration)}s, com pausas entre as cenas)${ouvidas?", legenda no tempo exato da fala":""}${EL_TROCA?`. A voz escolhida não está na conta desta chave do ElevenLabs; usei "${EL_TROCA.nome}"`:""}. Toque em Assistir ou Gravar vídeo.`,"ok");return true;}
  catch(e){const c=e?.code||"";
    if(/^eleven_/.test(c)&&oaKey()&&!V._semEleven){ // ElevenLabs recusou de vez: a narração sai na voz da OpenAI para o vídeo não parar
      V._semEleven=true;const sel=$v("vVoz");sel.value="oa:ash";V.vozSel="oa:ash";V.voz="ash";$v("vNarrar").disabled=false;
      const ok=await narrar();V._semEleven=false;if(ok)st($v("vStatus").textContent+` (O ElevenLabs recusou: ${e.msg||c.slice(7)}. Esta narração saiu na voz da OpenAI; confira a chave do ElevenLabs na aba Marca.)`,"err");return ok;}
    st(c==="bad_key"?"A chave da OpenAI foi recusada.":c==="eleven_key"?"A chave do ElevenLabs foi recusada.":/^eleven_/.test(c)?"O ElevenLabs recusou ("+c.slice(7)+(e.msg?": "+e.msg:"")+"). Confira se a chave é do mesmo espaço de trabalho onde está a voz.":c==="fish_key"?"A chave do Fish Audio foi recusada.":c==="fish_credito"?"Sua conta do Fish Audio está sem crédito.":/^fish_/.test(c)?"O Fish Audio não respondeu ("+c.slice(5)+(e.msg?": "+e.msg:"")+").":c==="sem_chave"?"Coloque a chave da OpenAI na aba Marca.":"Não consegui gravar a narração agora ("+c+"). Tente de novo.","err");return false;}
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
// voz padrão da narração (ElevenLabs, quando há chave): George, voz padrão do ElevenLabs que existe em toda conta.
// O Yuri (brasileiro) fica logo abaixo na lista como alternativa.
const VOZ_PADRAO_EL={id:"JBFqnCBsd6RMkjVDRZzb",nome:"George (padrão)"};
const VOZ_YURI={id:"WSBwiRQRmi2mEG7BfKwS",nome:"Yuri (brasileiro)"};
function renderVozes(){const sel=$v("vVoz");if(!sel)return;const temEl=!!elKey();let atual=V?.vozSel||LSv.get("rv-voz-sel","");
  if(temEl&&(!atual||atual==="oa:ash"))atual="el:"+VOZ_PADRAO_EL.id; // com ElevenLabs ligado, o padrão é o Yuri
  const outras=[VOZ_YURI,...VOZES_EL.filter(v=>v.id!==VOZ_YURI.id)].filter(v=>v.id!==VOZ_PADRAO_EL.id);
  sel.innerHTML=`<optgroup label="ElevenLabs (mais natural)"><option value="el:${VOZ_PADRAO_EL.id}"${temEl?"":" disabled"}>${VOZ_PADRAO_EL.nome}${temEl?"":" · cole a chave do ElevenLabs abaixo"}</option>${temEl?outras.map(v=>`<option value="el:${esc(v.id)}">${esc(v.nome)}${v.br?" · BR":""}</option>`).join(""):""}</optgroup>`+
    `<optgroup label="OpenAI (sotaque brasileiro por instrução)">${Object.entries(VOZES).map(([k,v])=>`<option value="oa:${k}">${v}</option>`).join("")}</optgroup>`+
    `<optgroup label="Fish Audio (sua voz)"><option value="fish"${fishKey()&&fishVoz()?"":" disabled"}>Fish Audio${fishVoz()?" · voz "+esc(fishVoz().slice(0,8)):" (configure abaixo)"}</option></optgroup>`;
  const ok=[...sel.options].some(o=>o.value===atual&&!o.disabled);sel.value=ok?atual:(temEl?"el:"+VOZ_PADRAO_EL.id:"oa:ash");
  if(V){V.vozSel=sel.value;if(sel.value.startsWith("oa:"))V.voz=sel.value.slice(3);}}

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
  const gat=(f,x)=>{const w=palavras(x||"").find(p=>p.length>3);return w||palavras(f)[1]||"";};
  const ob=f=>({tipo:"objeto",objeto:objetoPara(f),gatilho:gat(f)});
  add("A NOTÍCIA",(n.gancho?plain(n.gancho)+". ":"")+(frases(n.resumo)[0]||n.titulo),{tipo:"cena",topico:plain(n.gancho||n.titulo).split(" ").slice(0,6).join(" "),atores:[{tipo:"objeto",objeto:"pessoa",gatilho:""},{...ob(n.titulo),gatilho:palavras(n.resumo||n.titulo)[3]||""}]});
  const base=(n.explicacao||[])[0]||(n.fatos||[]).slice(0,2).join(" ");
  frases(base).slice(0,2).forEach((f,j)=>{const num=numeroEm(f);const at=[ob(f)];if(num)at.push({tipo:"numero",valor:num,rotulo:cortaP(f.replace(num,""),7).replace(/\.$/,""),gatilho:palavras(num)[palavras(num).length-1]});
    add("O FATO",f,{tipo:"cena",topico:j?"":"O QUE ACONTECEU",continua:j>0,atores:at});});
  const nums=(n.numeros||[]).slice(0,3);
  if(nums.length){const f=nums.map(x=>`${x.valor}, ${x.rotulo}`).join(". ")+".";
    add("OS NÚMEROS",f,{tipo:"cena",topico:"OS NÚMEROS",atores:nums.map((x,j)=>({tipo:"objeto",objeto:objetoPara(x.rotulo+" "+x.valor),rotulo:cortaP(x.rotulo,3).replace(/\.$/,""),gatilho:palavras(x.valor)[0]})).concat(nums.map(x=>({tipo:"numero",valor:x.valor,rotulo:x.rotulo,gatilho:palavras(x.valor)[0]})))});}
  if((n.comparativo||[]).length)add("ANTES × DEPOIS","Veja o que mudou: "+n.comparativo.map(x=>`${x.item}, de ${x.antes} para ${x.depois}`).join("; ")+".",{tipo:"comparativo",itens:n.comparativo.map(x=>({rotulo:x.item,antes:x.antes,depois:x.depois}))});
  (n.detalhes||[]).slice(0,2).forEach((d,j)=>add("OS DETALHES",d,{tipo:"cena",topico:j?"":"OS DETALHES",continua:j>0,atores:[{...ob(d),rotulo:numeroEm(d)||""}]}));
  if((n.declaracoes||[]).length){const d=n.declaracoes[0];add("QUEM FALOU",`${d.quem.split(",")[0]} resumiu assim: ${d.oque}`,{tipo:"cena",topico:"O QUE DISSERAM",atores:[{tipo:"objeto",objeto:"pessoa",rotulo:d.quem.split(",")[0],gatilho:""},{tipo:"citacao",frase:d.oque,quem:d.quem,gatilho:"assim"}]});}
  frases(n.porQueImporta||n.dor).slice(0,1).forEach(f=>add("POR QUE IMPORTA",f,{tipo:"cena",topico:"POR QUE IMPORTA",atores:[{tipo:"objeto",objeto:"grupo",gatilho:""},ob(f)]}));
  frases(n.impactoMercado).slice(0,1).forEach(f=>add("O IMPACTO",f,{tipo:"cena",topico:"O SEU BOLSO",atores:[{tipo:"objeto",objeto:"monitor",direcao:/cai|queda|recu|press/.test(f)?"cai":"sobe",gatilho:""},ob(f)]}));
  frases(n.entenda||n.angulo).slice(0,1).forEach(f=>add(n.entenda?"ENTENDA":"O CAMINHO",f,{tipo:"cena",topico:n.entenda?"ENTENDA":"O CAMINHO",atores:[{tipo:"objeto",objeto:n.entenda?"lupa":"alvo",gatilho:""}]}));
  frases(n.observar).slice(0,1).forEach(f=>add("E AGORA",f,{tipo:"cena",topico:"O QUE VEM AÍ",atores:[{tipo:"objeto",objeto:"calendario",gatilho:""},{tipo:"objeto",objeto:"relogio",gatilho:palavras(f)[Math.floor(palavras(f).length/2)]}]}));
  add("",fimTxt(),{tipo:"fim",texto:fimBotao()});
  // objetos repetidos em cenas seguidas viram outro parecido
  let ant=new Set();cs.forEach(c=>{const v=c.visual||{};if(v.tipo!=="cena"){ant=new Set();return;}const agora=new Set();(v.atores||[]).forEach(a=>{if(a.tipo==="objeto"&&!v.continua&&ant.has(a.objeto)){const op=(ALT[a.objeto]||["alvo","barras"]).find(o=>!ant.has(o));if(op)a.objeto=op;}if(a.tipo==="objeto")agora.add(a.objeto);});ant=agora;});
  return cs;}
function roteiroDoTexto(txt){const ps=String(txt||"").split(/\n\s*\n|\n/).map(x=>x.trim()).filter(Boolean);
  const cs=ps.map((p,i)=>{const num=numeroEm(p),at=[{tipo:"objeto",objeto:i?objetoPara(p):"pessoa",gatilho:""}];if(i===0)at.push({tipo:"objeto",objeto:objetoPara(p),gatilho:palavras(p)[3]||""});
    if(num)at.push({tipo:"numero",valor:num,rotulo:cortaP(p.replace(num,""),7).replace(/\.$/,""),gatilho:palavras(num)[0]});return {cap:i?"":"A NOTÍCIA",narracao:p,visual:{tipo:"cena",topico:i?"":cortaP(p,6).replace(/\.$/,"").toUpperCase(),atores:at}};});
  cs.push({cap:"",narracao:fimTxt(),visual:{tipo:"fim",texto:fimBotao()}});return cs;}
const iaOk=()=>APP.temIA?APP.temIA():(typeof temIA==="function"&&temIA());
async function roteiroIA(modo){if(!iaOk()){st("Para a IA escrever o roteiro, coloque a chave da OpenAI na aba Marca. Usei a ficha da notícia.","err");V.cenas=roteiroDaFicha(V.noticia);pronto();return false;}
  const n=V.noticia;st("Escrevendo o roteiro…");
  const mat=modo==="meu"?`ROTEIRO DO USUÁRIO (mantenha as falas, só ajuste para ficarem naturais e divida em cenas): ${$v("vMeu").value}`:
    `NOTÍCIA: ${JSON.stringify({titulo:n.titulo,resumo:n.resumo,explicacao:n.explicacao,fatos:n.fatos,numeros:n.numeros,comparativo:n.comparativo,declaracoes:n.declaracoes,porQueImporta:n.porQueImporta,impactoMercado:n.impactoMercado,entenda:n.entenda,observar:n.observar,dor:n.dor,angulo:n.angulo,fonte:n.fonte})}`;
  const contexto=APP.contexto?APP.contexto(V):`Perfil ${V.handle}: notícias do mercado financeiro explicadas de um jeito simples para quem investe ou quer começar.`;
  const prompt=`Você é roteirista de Reels em português do Brasil. ${contexto}
${mat}
Escreva um roteiro de vídeo vertical de 55 a 80 segundos, falado como um criador de conteúdo brasileiro que prende a atenção: energia, curiosidade e ritmo de Reels. Use frases curtas de impacto, perguntas que puxam a próxima cena ("E sabe o que aconteceu depois?"), viradas ("E não parou aí…"), reticências e vírgulas para marcar pausas, ponto de exclamação com moderação, expressões naturais do dia a dia. Nada de clichê de coach, sem emoji, sem prometer ganho, sem recomendar compra ou venda. Escreva os números por extenso quando ajudar a leitura em voz alta (ex.: "cinco reais e noventa e três"), mas no campo "valor" do visual use o número curto. Só use números, nomes e fatos do material.
Estrutura: gancho forte na primeira cena; o que aconteceu; os números; por que importa; o que muda para quem assiste; um conceito explicado; o que observar; fechamento: ${fimTxt()}
Divida em 9 a 12 cenas de 8 a 24 palavras cada. O vídeo precisa ser visual e "montado" junto com a fala, como uma animação explicativa: a maioria das cenas é do tipo "cena", com 2 a 4 elementos que vão aparecendo um a um, cada um na palavra da fala que o menciona.
Formato do visual "cena": {"tipo":"cena","topico":"faixa no topo, até 6 palavras em caixa alta (ex: POR QUE TANTO MEDO? A CONTA)","continua":false,"atores":[...]}
Elementos possíveis em "atores" (cada um com "gatilho": a palavra exata da fala em que ele entra):
- {"tipo":"objeto","objeto":"um dos objetos","rotulo":"etiqueta presa nele, até 4 palavras, ex: ITAÚ −14% ou DÍVIDA","direcao":"sobe|cai (para seta, barras, tela e balança)","gatilho":""}
- {"tipo":"numero","valor":"número curto do material, ex: R$ 11 tri, −20%, 5,93","rotulo":"até 7 palavras","gatilho":""}  (vira um card grande no alto; um número novo substitui o anterior)
- {"tipo":"etiqueta","texto":"bloco de texto no palco, até 6 palavras, ex: FLÁVIO · 70 A 90% DE CHANCE","gatilho":""}
- {"tipo":"citacao","frase":"paráfrase curta","quem":"nome e cargo do material","gatilho":""}
Use "continua":true quando a cena seguinte é sobre o mesmo assunto: o palco da cena anterior fica e só ganha os elementos novos (ex.: uma seta para cada empresa que caiu, a pilha da dívida que depois ganha o card do número).
Para comparar (empresas, antes e depois, setores), use vários objetos lado a lado, cada um com seu rótulo. Para listas de coisas do dia a dia (gasolina, comida, remédio), um objeto por item com o rótulo do item.
Pode usar de vez em quando os visuais simples: {"tipo":"grafico","direcao":"sobe|cai|oscila","valor":"","rotulo":""}, {"tipo":"comparativo","itens":[{"rotulo":"","antes":"","depois":""}]}, {"tipo":"lista","itens":[""]}.
A última cena é {"tipo":"fim","texto":"${fimBotao()}"}.
Objetos possíveis: ${Object.keys(OBJETOS).filter(k=>k!=="nenhum").join(", ")}. "pessoa" é um personagem (use para governo, presidente, investidor, consumidor), "grupo" para pessoas em geral.
"cap" é a etiqueta do capítulo em 1 ou 2 palavras (ex: A NOTÍCIA, A CONTA, O IMPACTO, ENTENDA, E AGORA).
Responda só com JSON: {"cenas":[{"cap":"","narracao":"","visual":{"tipo":"cena","topico":"","continua":false,"atores":[{"tipo":"objeto","objeto":"","rotulo":"","gatilho":""}]}}],"legenda":"legenda do post com 2 parágrafos, a fonte e 5 hashtags"}`;
  try{const r=await sample.json(prompt,{cache:false});if(!Array.isArray(r?.cenas)||!r.cenas.length)throw {code:"invalid_json"};
    V.cenas=r.cenas.map(c=>({cap:String(c.cap||""),narracao:String(c.narracao||""),visual:limpaVisual(c.visual,c.narracao)}));
    const ult=V.cenas[V.cenas.length-1];if(ult.visual.tipo!=="fim")V.cenas.push({cap:"",narracao:fimTxt(),visual:{tipo:"fim",texto:fimBotao()}});else ult.visual.texto=ult.visual.texto||fimBotao();
    V.legendaPost=String(r.legenda||"");pronto("Roteiro pronto.");return true;}
  catch(e){st("A IA não respondeu agora. Usei a ficha da notícia; tente de novo depois.","err");V.cenas=roteiroDaFicha(n);pronto();return false;}}
function limpaVisual(v,narr){v=v&&typeof v==="object"?v:{};const tipo=TIPOS_V[v.tipo]?v.tipo:"objeto";const o={tipo};
  for(const k of ["valor","rotulo","texto","frase","quem","direcao","dia","topico"])if(v[k])o[k]=String(v[k]);
  if(tipo==="cena"){o.continua=!!v.continua;o.atores=(Array.isArray(v.atores)?v.atores:[]).slice(0,4).map(a=>{const t=["objeto","numero","etiqueta","citacao"].includes(a?.tipo)?a.tipo:"objeto";const x={tipo:t};
      for(const k of ["valor","rotulo","texto","frase","quem","direcao","gatilho"])if(a?.[k])x[k]=String(a[k]);if(t==="objeto")x.objeto=OBJETOS[a?.objeto]&&a.objeto!=="nenhum"?a.objeto:objetoPara((a?.rotulo||"")+" "+narr);return x;});
    if(!o.atores.length)o.atores=[{tipo:"objeto",objeto:objetoPara(narr)}];o.objeto="nenhum";return o;}
  if(Array.isArray(v.itens))o.itens=v.itens.slice(0,4).map(x=>typeof x==="object"?{rotulo:String(x.rotulo||x.item||""),antes:String(x.antes||""),depois:String(x.depois||"")}:String(x));
  o.objeto=OBJETOS[v.objeto]?v.objeto:(["numero","objeto","titulo"].includes(tipo)?objetoPara(narr+" "+(v.rotulo||"")):"nenhum");return o;}
const ALT={moedas:["pilha","barras","seta-cima","cartao"],pilha:["moedas","barras","predio"],termometro:["barras","seta-cima","relogio"],predio:["barras","seta-baixo","alvo"],
  "seta-baixo":["barras","placa-pare","escudo"],"seta-cima":["barras","alvo","moedas"],alvo:["escudo","lupa","barras"],calendario:["relogio","alvo"],relogio:["calendario","alvo"],
  escudo:["alvo","lupa"],lupa:["alvo","escudo"],cartao:["moedas","pilha"],"placa-pare":["seta-baixo","escudo"],barras:["seta-cima","moedas","alvo"]};
function variar(cs){let ant="";const usados={};cs.forEach(c=>{const v=c.visual||{};if(v.tipo==="cena"){ant="";return;}if(!v.objeto||v.objeto==="nenhum"){ant="";return;}
  if(v.objeto===ant||(usados[v.objeto]||0)>=2){const op=(ALT[v.objeto]||["alvo","barras","lupa"]).find(o=>o!==ant&&(usados[o]||0)<2);if(op)v.objeto=op;}
  usados[v.objeto]=(usados[v.objeto]||0)+1;ant=v.objeto;});return cs;}
function pronto(msg){cur=0;variar(V.cenas);V._buf=null;V._durs=null;V._tw=null;V.legendaPost=V.legendaPost||legendaLocal();salvar();renderLista();renderCena();quadro();if(msg)st(msg,"ok");}
function legendaLocal(){const n=V.noticia;return APP.legenda?APP.legenda(V):`${plain(n.gancho||n.titulo)}\n\n${(n.explicacao||[]).slice(0,2).join("\n\n")||n.resumo}\n\nFonte: ${n.fonte}\n\n${fimTxt()}\n\nConteúdo informativo, não é recomendação de investimento.\n\n#mercadofinanceiro #investimentos #economia #bolsadevalores #trader`;}

/* ---------------- trilha de fundo ----------------
   Música composta aqui mesmo pelo navegador (sem direitos autorais de terceiros): bateria leve, baixo, acordes e arpejo.
   Ela abaixa sozinha enquanto a voz fala e sobe nas pausas. */
const TRILHAS={noticia:"Notícia (pulsante)",lofi:"Lo-fi (calma)",tensao:"Tensão (notícia pesada)",nenhuma:"Sem música"};
const NOTA=n=>440*Math.pow(2,(n-69)/12);
const ESTILOS={
  noticia:{bpm:104,acordes:[[57,60,64],[53,57,60],[48,52,55],[55,59,62]],baixo:[45,41,36,43],kick:[0,2,2.5],caixa:[1,3],hat:"8",arp:true,brilho:2600},
  lofi:{bpm:82,acordes:[[50,53,57,60],[55,59,62,65],[48,52,55,59],[57,60,64,67]],baixo:[38,43,36,45],kick:[0,1.75,2.5],caixa:[1,3],hat:"swing",arp:false,brilho:1500,vinil:true},
  tensao:{bpm:118,acordes:[[57,60,64],[57,60,65],[57,60,64],[56,60,63]],baixo:[45,45,45,44],kick:[0,1,2,3],caixa:[],hat:"16",arp:true,brilho:2000,pulso:true}};
const TRILHA_CACHE={};
async function compor(estilo,dur){const E=ESTILOS[estilo];if(!E)return null;const k=estilo+"|"+Math.ceil(dur);if(TRILHA_CACHE[k])return TRILHA_CACHE[k];
  const sr=44100,len=Math.ceil((dur+1)*sr),oc=new OfflineAudioContext(2,len,sr),beat=60/E.bpm,bar=beat*4;
  const master=oc.createDynamicsCompressor();master.threshold.value=-18;master.ratio.value=3;const mg=oc.createGain();mg.gain.value=.9;master.connect(mg);mg.connect(oc.destination);
  const ruido=oc.createBuffer(1,sr,sr);{const d=ruido.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}
  // eco para o arpejo
  const eco=oc.createDelay(1);eco.delayTime.value=beat*.75;const fb=oc.createGain();fb.gain.value=.28;const ecoF=oc.createBiquadFilter();ecoF.type="lowpass";ecoF.frequency.value=2200;
  eco.connect(ecoF);ecoF.connect(fb);fb.connect(eco);const ecoOut=oc.createGain();ecoOut.gain.value=.35;ecoF.connect(ecoOut);ecoOut.connect(master);
  const env=(g,t,a,v,r)=>{g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+a);g.gain.exponentialRampToValueAtTime(.0008,t+a+r);};
  const kick=t=>{const o=oc.createOscillator(),g=oc.createGain();o.frequency.setValueAtTime(130,t);o.frequency.exponentialRampToValueAtTime(42,t+.12);env(g,t,.003,.9,.32);o.connect(g);g.connect(master);o.start(t);o.stop(t+.4);};
  const barulho=(t,tipo,f,v,r)=>{const s=oc.createBufferSource();s.buffer=ruido;const fl=oc.createBiquadFilter();fl.type=tipo;fl.frequency.value=f;const g=oc.createGain();env(g,t,.002,v,r);s.connect(fl);fl.connect(g);g.connect(master);s.start(t);s.stop(t+r+.05);};
  const tom=(t,n,d,v,tipo,f,dest)=>{const o=oc.createOscillator(),fl=oc.createBiquadFilter(),g=oc.createGain();o.type=tipo;o.frequency.value=NOTA(n);fl.type="lowpass";fl.frequency.value=f;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+.01);g.gain.setTargetAtTime(v*.5,t+.05,d*.3);g.gain.setTargetAtTime(0,t+d,.06);o.connect(fl);fl.connect(g);g.connect(dest||master);o.start(t);o.stop(t+d+.4);};
  const pad=(t,ns,d)=>ns.forEach(n=>[-6,6].forEach(det=>{const o=oc.createOscillator(),fl=oc.createBiquadFilter(),g=oc.createGain();o.type="sawtooth";o.frequency.value=NOTA(n);o.detune.value=det;
    fl.type="lowpass";fl.frequency.value=E.brilho*.5;fl.Q.value=.6;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.022,t+.6);g.gain.setValueAtTime(.022,t+d-.3);g.gain.linearRampToValueAtTime(0,t+d+.2);
    o.connect(fl);fl.connect(g);g.connect(master);o.start(t);o.stop(t+d+.3);}));
  const nb=Math.ceil(dur/bar)+1;
  for(let b=0;b<nb;b++){const t0=b*bar,ci=b%4,ac=E.acordes[ci],intro=b===0;
    pad(t0,ac,bar);
    if(!intro){E.kick.forEach(x=>kick(t0+x*beat));E.caixa.forEach(x=>barulho(t0+x*beat,"bandpass",1900,.32,.16));}
    const passos=E.hat==="16"?16:8;for(let s=0;s<passos;s++){let t=t0+s*bar/passos;if(E.hat==="swing"&&s%2)t+=bar/passos*.18;barulho(t,"highpass",7500,s%2?.07:.11,.04);}
    [0,1.5,2,3.5].forEach((x,j)=>{if(!intro||j===0)tom(t0+x*beat,E.baixo[ci]-(j===3?0:0),beat*(j%2?.45:.9),.28,"triangle",500);});
    if(E.pulso)for(let s=0;s<8;s++)tom(t0+s*bar/8,E.baixo[ci]+12,bar/8*.6,.08,"sawtooth",900);
    if(E.arp&&!intro){const ns=[...ac,ac[0]+12,...ac.slice().reverse()];for(let s=0;s<8;s++)tom(t0+s*bar/8,ns[s%ns.length]+12,bar/8*.5,.05,"square",E.brilho,eco),tom(t0+s*bar/8,ns[s%ns.length]+12,bar/8*.5,.05,"square",E.brilho);}
  }
  if(E.vinil){const s=oc.createBufferSource();s.buffer=ruido;s.loop=true;const fl=oc.createBiquadFilter();fl.type="bandpass";fl.frequency.value=3200;const g=oc.createGain();g.gain.value=.012;s.connect(fl);fl.connect(g);g.connect(master);s.start(0);}
  // entrada e saída suaves
  mg.gain.setValueAtTime(0,0);mg.gain.linearRampToValueAtTime(.9,1.2);mg.gain.setValueAtTime(.9,Math.max(1.3,dur-1.5));mg.gain.linearRampToValueAtTime(0,dur+.8);
  const out=await oc.startRendering();TRILHA_CACHE[k]=out;return out;}
// volume da trilha acompanha a voz: baixo enquanto fala, sobe nas pausas
function abaixarNaFala(gain,t0,base){const v=V._buf;gain.gain.setValueAtTime(base,t0);if(!v)return;const d=v.getChannelData(0),sr=v.sampleRate,jan=Math.round(sr*.1);let falando=null;
  for(let i=0;i<d.length;i+=jan){let m=0;for(let j=i;j<Math.min(d.length,i+jan);j++)m=Math.max(m,Math.abs(d[j]));const f=m>.02;
    if(f!==falando){gain.gain.setTargetAtTime(f?base*.32:base,t0+i/sr,f?.05:.35);falando=f;}}}
function trilhaSel(){return $v("vTrilha")?.value||LSv.get("rv-trilha","noticia");}
function trilhaVol(){return +($v("vTrilhaVol")?.value||LSv.get("rv-trilha-vol","0.5"));}

/* ---------------- tocar e gravar ---------------- */
function quadro(){if(!V||!cv())return;const g=cv().getContext("2d");const L=linha();desenhar(g,(L.ini[cur]||0)+Math.min(1.6,(L.dur[cur]||2)*.7),L);
  $v("vTempo").textContent=`${Math.round(L.total)}s · ${V.cenas.length} cenas${V._buf?" · com narração":""}`;}
function parar(){if(tocando){tocando.stop=true;try{tocando.src.forEach(s=>s.stop());}catch(e){}tocando=null;}$v("vPlay").textContent="Assistir";}
async function prepararTrilha(){const est=trilhaSel();if(est==="nenhuma")return null;if(!V._trilha||V._trilha.est!==est||V._trilha.dur<linha().total){
    st("Compondo a trilha…");V._trilha={est,dur:linha().total,buf:await compor(est,linha().total)};}return V._trilha.buf;}
function rodar(dest,onFrame,mus){const ctx=actx(),L=linha(),g=cv().getContext("2d"),t0=ctx.currentTime+.3,src=[];
  if(V._buf){const s=ctx.createBufferSource();s.buffer=V._buf;s.connect(ctx.destination);if(dest)s.connect(dest);s.start(t0);src.push(s);}
  if(mus){const s=ctx.createBufferSource(),gn=ctx.createGain();s.buffer=mus;s.connect(gn);gn.connect(ctx.destination);if(dest)gn.connect(dest);abaixarNaFala(gn,t0,trilhaVol()*.35);s.start(t0);s.stop(t0+L.total+.3);src.push(s);}
  const est={stop:false,src};return {est,fim:new Promise(res=>{const passo=()=>{if(est.stop){res(false);return;}const t=ctx.currentTime-t0;
      if(t>=L.total+.2){res(true);return;}const i=desenhar(g,cl(t,0,L.total-.001),L);if(i!==cur){cur=i;marcar();}onFrame&&onFrame(cl(t/L.total));requestAnimationFrame(passo);};requestAnimationFrame(passo);})};}
async function tocar(){if(tocando){parar();return;}await actx().resume();const mus=await prepararTrilha();const r=rodar(null,null,mus);tocando=r.est;$v("vPlay").textContent="Parar";await r.fim;if(tocando===r.est)parar();}
async function gravar(){if(!V||gravando)return false;const c=cv();
  if(!c.captureStream||typeof MediaRecorder==="undefined"){st("Este navegador não grava vídeo. Use o Chrome ou o Safari atualizado.","err");return false;}
  const mime=["video/mp4;codecs=avc1.42E01E,mp4a.40.2","video/mp4;codecs=avc1","video/mp4","video/webm;codecs=vp9,opus","video/webm"].find(m=>MediaRecorder.isTypeSupported(m));
  if(!mime){st("Este navegador não grava vídeo.","err");return false;}
  parar();await document.fonts.ready;const ctx=actx();await ctx.resume();const mus=await prepararTrilha();
  const dest=ctx.createMediaStreamDestination(),vs=c.captureStream(FPS);
  const stream=new MediaStream([...vs.getVideoTracks(),...(V._buf||mus?dest.stream.getAudioTracks():[])]);
  const chunks=[];const mr=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:10e6,audioBitsPerSecond:192e3});mr.ondataavailable=e=>e.data.size&&chunks.push(e.data);
  gravando=mr;$v("vRec").disabled=true;$v("vTudo").disabled=true;mr.start(500);
  const r=rodar(dest,p=>st(`Gravando o vídeo… ${Math.round(p*100)}% (deixe esta aba aberta na tela)`),mus);tocando=r.est;await r.fim;tocando=null;
  mr.stop();await new Promise(x=>mr.onstop=x);gravando=null;$v("vRec").disabled=false;$v("vTudo").disabled=false;
  const ext=mime.startsWith("video/mp4")?"mp4":"webm";const blob=new Blob(chunks,{type:mime.split(";")[0]});
  const nome=`video-${(typeof slug==="function"?slug(V.handle):"perfil")||"perfil"}-${new Date().toISOString().slice(0,10)}.${ext}`;
  try{await downloads.save({filename:nome,data:blob});st((ext==="mp4"?"Vídeo MP4 pronto e baixado":"Vídeo baixado em WebM (este navegador não grava MP4; no Chrome atualizado ou no Safari sai em MP4)")+(V._buf?", com narração e legenda":", sem narração")+(mus?" e trilha de fundo.":"."),"ok");return true;}
  catch(e){st("Não consegui baixar o vídeo.","err");return false;}}
// um toque: roteiro com IA → narração → legenda sincronizada → MP4
async function tudo(){if(!V)return;if(V._pronto&&V._buf){await gravar();return;} // vídeo pronto do robô: só gravarif(!oaKey()&&!elKey()&&!fishKey()){st("Para sair tudo pronto, coloque a chave da OpenAI na aba Marca.","err");return;}
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
  const t=v.tipo;$v("vfValor").querySelector("span").textContent=t==="cena"?"Faixa no topo (tópico)":t==="citacao"?"Frase":t==="titulo"||t==="objeto"||t==="fim"?"Texto na tela":"Número / valor";
  if(t==="cena"){$v("vcValor").value=v.topico||"";$v("vcRot").value=v.continua?"continua":"";$v("vcItens").value=(v.atores||[]).map(a=>[a.tipo,a.tipo==="objeto"?a.objeto:a.tipo==="numero"?a.valor:a.tipo==="citacao"?a.frase:a.texto,a.tipo==="citacao"?a.quem:a.rotulo||"",a.gatilho||""].join("; ")).join("\n");}
  $v("vfRot").querySelector("span").textContent=t==="citacao"?"Quem falou":t==="grafico"?"Rótulo (ou: sobe / cai)":"Rótulo";
  $v("vfItens").hidden=!["lista","comparativo","cena"].includes(t);$v("vfItens").querySelector("span").textContent=t==="cena"?"Elementos, um por linha: tipo; objeto ou valor; rótulo; palavra que faz aparecer (tipos: objeto, numero, etiqueta, citacao)":t==="comparativo"?"Linhas (item; antes; depois)":"Itens (um por linha)";
  if(t==="cena")$v("vfRot").querySelector("span").textContent="Escreva \"continua\" para manter o palco da cena anterior";
  $v("vfObj").hidden=!["numero","objeto","titulo"].includes(t);$v("vcIdx").textContent=`Cena ${cur+1} de ${V.cenas.length}`;}
function editar(){const c=V.cenas[cur];if(!c)return;const v=c.visual=c.visual||{};const antes=c.narracao;c.cap=$v("vcCap").value;c.narracao=$v("vcNarr").value;v.tipo=$v("vcTipo").value;v.objeto=$v("vcObj").value;
  const a=$v("vcValor").value,b=$v("vcRot").value;delete v.valor;delete v.texto;delete v.frase;delete v.quem;delete v.rotulo;
  if(v.tipo==="cena"){v.topico=a;v.continua=/continua/i.test(b);const ls=$v("vcItens").value.split("\n").map(x=>x.trim()).filter(Boolean);
    v.atores=ls.slice(0,4).map(l=>{const p=l.split(";").map(x=>x.trim());const tp=["objeto","numero","etiqueta","citacao"].includes(p[0])?p[0]:"objeto";const x={tipo:tp,gatilho:p[3]||""};
      if(tp==="objeto"){x.objeto=OBJETOS[p[1]]?p[1]:objetoPara(p[1]);x.rotulo=p[2]||"";}else if(tp==="numero"){x.valor=p[1]||"";x.rotulo=p[2]||"";}else if(tp==="citacao"){x.frase=p[1]||"";x.quem=p[2]||"";}else x.texto=p[1]||"";return x;});
    renderLista();quadro();salvar();return;}
  if(v.tipo==="citacao"){v.frase=a;v.quem=b;}else if(["titulo","objeto","fim"].includes(v.tipo))v.texto=a;else{v.valor=a;v.rotulo=b;if(v.tipo==="grafico")v.direcao=/cai|queda/i.test(b)?"cai":/oscil/i.test(b)?"oscila":"sobe";}
  const ls=$v("vcItens").value.split("\n").map(x=>x.trim()).filter(Boolean);v.itens=v.tipo==="comparativo"?ls.map(l=>{const p=l.split(";");return {rotulo:(p[0]||"").trim(),antes:(p[1]||"").trim(),depois:(p.slice(2).join(";")||"").trim()};}):ls;
  if(antes!==c.narracao&&V._buf&&!V._audioProprio){V._buf=null;V._durs=null;V._tw=null;st("A fala mudou: toque em Gerar narração de novo.");}
  renderCena();renderLista();quadro();salvar();}
function abrir(n){const perfis=APP.perfis?APP.perfis():(typeof perfisOrd==="function"?perfisOrd():[]);
  const h=APP.handle?APP.handle():((typeof atH==="function"&&atH(prefs.handle))||perfis[0]?.handle||"@seuperfil");
  V={id:"v"+Date.now().toString(36),noticiaId:n.id,noticia:n,handle:h,paleta:(typeof brandOf==="function"&&(brandOf(h)||{}).paleta)||prefs.paleta||"laranja",
    voz:"ash",vozSel:LSv.get("rv-voz-sel",""),marca:APP.marcaTopo?APP.marcaTopo():"Radar Trader",cenas:[],criadoEm:new Date().toISOString()};
  V.cenas=roteiroDaFicha(n);cur=0;(APP.mostrar||showTab)(APP.aba||"video");$v("vVazio").hidden=true;$v("vCorpo").hidden=false;$v("vbTitulo").textContent=n.titulo;$v("vbFonte").textContent=n.fonte||"";
  $v("vPerfil").innerHTML=perfis.map(p=>`<option value="${esc(p.handle)}" ${p.handle===h?"selected":""}>${esc(p.nome||p.handle)} · ${esc(p.handle)}</option>`).join("")||`<option>${esc(h)}</option>`;
  renderVozes();
  if(!APP.semCores)$v("vCor").innerHTML=Object.entries(PALETAS).filter(([k])=>k!=="claro").map(([k,p])=>`<button class="swc" data-vcor="${k}" aria-pressed="${k===V.paleta}" title="${p.nome}" style="--b1:${p.bg1};--a1:${p.a};--a2:${p.a2}"></button>`).join("");
  $v("vMeu").value="";$v("vElKey").value=elKey()?"••••••••"+elKey().slice(-4):"";
  pronto(iaOk()?"Pronto para gerar. Toque em Fazer tudo para sair o vídeo pronto, ou vá passo a passo.":"Roteiro montado com a ficha. Coloque a chave da OpenAI na aba Marca para a IA e a narração.");
  const b=APP.marca?APP.marca(V):(typeof brandOf==="function"?brandOf(h):{});if(b?.fotoUrl||b?.foto)img(b.fotoUrl||blobSrc(b.foto));if(b?.logoUrl)img(b.logoUrl);}
/* vídeos já narrados pelo robô do GitHub (coletor/narrar.py): roteiro + narração do ElevenLabs + tempo de cada palavra */
let PRONTOS={};
async function carregarProntos(){if(PFX!=="v")return;try{PRONTOS=(await (await fetch("data/videos/index.json?t="+Date.now())).json())||{};}catch(e){PRONTOS={};}marcarProntos();}
function marcarProntos(){document.querySelectorAll("[data-video]").forEach(b=>{if(PRONTOS[b.dataset.video]&&!b.dataset.pronto){b.dataset.pronto="1";b.textContent="Vídeo pronto";b.classList.add("primary");b.title="Roteiro e narração já feitos: é só gravar";}});}
async function abrirPronto(n){const info=PRONTOS[n.id];abrir(n);st("Carregando o vídeo pronto (roteiro e narração)…");
  try{const url=info.pasta,base=url.slice(0,url.lastIndexOf("/")+1);const j=await (await fetch(url+"?t="+Date.now())).json();
    const bufs=await Promise.all(j.cenas.map(c=>fetch(base+c.audio).then(x=>x.arrayBuffer()).then(ab=>actx().decodeAudioData(ab))));
    V.cenas=j.cenas.map(c=>({cap:String(c.cap||""),narracao:String(c.narracao||""),visual:limpaVisual(c.visual,c.narracao)}));
    if(j.perfil)V.handle=j.perfil;V.legendaPost=j.legenda||V.legendaPost;
    const E=emendar(bufs);V._buf=E.buf;V._audioProprio=false;V._pronto=true;
    V._durs=E.ini.map((s0,i)=>(i+1<E.ini.length?E.ini[i+1]:E.buf.duration+.3)-s0);V._tw=j.cenas.map(c=>Array.isArray(c.tw)?c.tw:null);
    cur=0;renderLista();renderCena();quadro();
    st(`Vídeo pronto: roteiro e narração do ElevenLabs já feitos (${Math.round(E.buf.duration)}s). Toque em Assistir ou Gravar vídeo.`,"ok");}
  catch(e){st("Não consegui carregar o vídeo pronto; montei pela ficha da notícia.","err");}}
if(PFX==="v"){carregarProntos();setInterval(carregarProntos,10*60e3);new MutationObserver(()=>marcarProntos()).observe(document.body,{childList:true,subtree:true});}
window.radarVideo={abrir,abrirPronto,compor,quadroEm:t=>{const L=linha();desenhar(cv().getContext("2d"),t,L);return L;}};
document.addEventListener("click",e=>{const b=e.target.closest(APP.botoes||"[data-video],#nbVideo");if(!b)return;e.stopPropagation();
  const n=APP.noticiaDe?APP.noticiaDe(b):(NEWS.find(x=>x.id===(b.dataset.video||(typeof deck!=="undefined"&&deck?.noticiaId)))||(typeof deck!=="undefined"&&deck?.noticia));if(!n)return;
  if(PRONTOS[n.id])abrirPronto(n);else abrir(n);},true);

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
  if($v("vTrilha")){$v("vTrilha").innerHTML=Object.entries(TRILHAS).map(([k,v])=>`<option value="${k}">${v}</option>`).join("");$v("vTrilha").value=LSv.get("rv-trilha","noticia");
    $v("vTrilhaVol").value=LSv.get("rv-trilha-vol","0.5");
    $v("vTrilha").onchange=e=>{LSv.set("rv-trilha",e.target.value);if(tocando)parar();st(e.target.value==="nenhuma"?"Vídeo sem música.":"Trilha trocada. Toque em Assistir para ouvir.");};
    $v("vTrilhaVol").oninput=e=>LSv.set("rv-trilha-vol",e.target.value);}
  if($v("vFishSalvar")){$v("vFishKey").value=fishKey()?"••••••••"+fishKey().slice(-4):"";$v("vFishVoz").value=fishVoz();
    $v("vFishSalvar").onclick=()=>{const k=$v("vFishKey").value.trim(),v=$v("vFishVoz").value.trim();if(k&&!k.startsWith("••"))LSv.set("radar-fish-key",k);LSv.set("radar-fish-voz",v);
      $v("vFishKey").value=fishKey()?"••••••••"+fishKey().slice(-4):"";if(V){V.vozSel="fish";LSv.set("rv-voz-sel","fish");}renderVozes();
      st(fishKey()&&v?"Fish Audio ligado: escolhido como voz da narração.":"Falta a chave ou o ID da voz do Fish Audio.",fishKey()&&v?"ok":"err");};}
  document.fonts?.ready.then(quadro);}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",ligarTela);else ligarTela();
})();
