/* Radar de Pautas no GitHub Pages: substitui o window.claude do artifact.
   - pautas e coletas: lidas de data/pautas.json e data/meta.json (gravados pelo GitHub Actions)
   - marca, carrosséis, vídeos e imagens: guardados neste navegador (localStorage)
   - IA: OpenAI, com a chave que você coloca na aba Marca (fica só neste navegador) */
(function(){
const LS={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(e){return d;}},
 set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(e){return false;}}};
const REPO=(()=>{const h=location.hostname,p=location.pathname.split("/").filter(Boolean);
 return h.endsWith(".github.io")?`${h.split(".")[0]}/${p[0]||"radar-pautas"}`:"ljhonatta/radar-pautas";})();
window.RADAR_REPO=REPO;

/* ---------- banco ---------- */
const listeners={};
function emit(path){(listeners[path]||[]).forEach(f=>f());}
function on(path,f){(listeners[path]=listeners[path]||[]).push(f);f();}
let PAUTAS=[],META={},MARCA0={};
const local=name=>LS.get("radar-db-"+name,{});
function snapCol(name){
 let rows;
 if(name==="pautas")rows=PAUTAS.map(p=>[p.id,p]);
 else if(name==="marca"){const m=local("marca");const ids=new Set([...Object.keys(MARCA0),...Object.keys(m)]);rows=[...ids].map(id=>[id,Object.assign({},MARCA0[id],m[id])]);}
 else rows=Object.entries(local(name));
 return rows;
}
function snapDoc(path){
 const [c,id]=path.split("/");
 if(c==="meta"){if(id==="config")return {triggerId:"github"};const s=id.replace("coleta-","");return META[s]||null;}
 const r=snapCol(c).find(x=>x[0]===id);return r?r[1]:null;
}
function query(name){let ord=null,lim=1e9;
 const q={orderBy(f,dir){ord=[f,dir];return q;},limit(n){lim=n;return q;},
  doc(id){return docRef(name+"/"+(id||(Date.now().toString(36)+Math.random().toString(36).slice(2,8))));},
  onSnapshot(cb){on(name,()=>{let rows=snapCol(name);
   if(ord)rows=rows.slice().sort((a,b)=>{const x=String(a[1][ord[0]]||""),y=String(b[1][ord[0]]||"");return ord[1]==="desc"?y.localeCompare(x):x.localeCompare(y);});
   cb({docs:rows.slice(0,lim).map(([id,d])=>({id,data:()=>d}))});});return ()=>{};}};
 return q;}
function docRef(path){const [c,id]=path.split("/");
 return {id,
  onSnapshot(cb){on(c,()=>{const d=snapDoc(path);cb({exists:!!d,data:()=>d});});return ()=>{};},
  async set(data){const all=local(c);all[id]=data;if(!LS.set("radar-db-"+c,all))throw {code:"quota"};emit(c);},
  async delete(){const all=local(c);delete all[id];LS.set("radar-db-"+c,all);emit(c);}};}
const db={collection:query,doc:docRef};

async function carregar(){
 try{const t="?t="+Date.now();
  const [p,m]=await Promise.all([fetch("data/pautas.json"+t).then(r=>r.json()),fetch("data/meta.json"+t).then(r=>r.json())]);
  PAUTAS=(Array.isArray(p)?p:[]).filter(x=>x&&x.id);META=m||{};emit("pautas");emit("meta");
 }catch(e){const s=document.getElementById("dbstatus");if(s){s.textContent="Não consegui ler as pautas agora. Recarregue a página.";s.className="status err";}}}
const pronto=Promise.all([fetch("data/marca.json").then(r=>r.json()).then(m=>{MARCA0=m||{};}).catch(()=>{}),carregar()]);
setInterval(carregar,10*60e3);

/* ---------- imagens (logo e capa) ---------- */
const assets={async upload(blob){const id="a"+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
 const url=await new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.readAsDataURL(blob);});
 const all=LS.get("radar-assets",{});all[id]=url;if(!LS.set("radar-assets",all))throw {code:"quota"};return {id};}};
window.radarBlob=id=>{if(/^logo-[a-z]+$/.test(id))return "data/"+id+".png";return LS.get("radar-assets",{})[id]||"data:,";};

/* ---------- downloads ---------- */
const downloads={async save({filename,data}){const u=URL.createObjectURL(data);const a=document.createElement("a");a.href=u;a.download=filename;
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60e3);}};

/* ---------- IA (OpenAI) ---------- */
const KEY="radar-openai-key";
window.radarKey={get:()=>{try{return localStorage.getItem(KEY)||"";}catch(e){return "";}},set:v=>{try{v?localStorage.setItem(KEY,v):localStorage.removeItem(KEY);return true;}catch(e){return false;}}};
const sample={async json(prompt,opts={}){
 const key=window.radarKey.get();if(!key)throw {code:"no_key"};
 const model=opts.modelTier==="complex"?(LS.get("radar-modelo-forte","")||"gpt-4o"):(LS.get("radar-modelo","")||"gpt-4o-mini");
 let r;
 try{r=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",signal:opts.signal,
  headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},
  body:JSON.stringify({model,response_format:{type:"json_object"},messages:[{role:"system",content:"Responda sempre em JSON válido."},{role:"user",content:prompt}]})});}
 catch(e){if(e&&e.name==="AbortError")throw e;throw {code:"network"};}
 if(r.status===401)throw {code:"bad_key"};
 if(r.status===429)throw {code:"rate_limited"};
 if(!r.ok)throw {code:"http_"+r.status};
 const j=await r.json();try{return JSON.parse(j.choices[0].message.content);}catch(e){throw {code:"invalid_json"};}}};

/* ---------- "Atualizar agora" abre o workflow no GitHub ---------- */
const mcp={async callTool(){window.open(`https://github.com/${REPO}/actions/workflows/coleta.yml`,"_blank","noopener");}};

const caps={db,sample,downloads,assets,mcp};
window.claude={use:async x=>{await pronto;if(!(x in caps))throw {code:"not_declared"};return caps[x];}};
})();
