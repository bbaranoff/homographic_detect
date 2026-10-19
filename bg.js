// bg.js
// ---- punycode decode (RFC 3492) ----
const B=36,T_MIN=1,T_MAX=26,SKEW=38,DAMP=700,BIAS0=72,N0=128,DELIM="-";
function b2d(c){ if(c-48<10)return c-22; if(c-65<26)return c-65; if(c-97<26)return c-97; return B; }
function adapt(d,n,first){
  d=first?Math.floor(d/DAMP):d>>1; d+=Math.floor(d/n);
  let k=0; while(d>((B-T_MIN)*T_MAX)>>1){ d=Math.floor(d/(B-T_MIN)); k+=B; }
  return Math.floor(k+(B-T_MIN+1)*d/(d+SKEW));
}
function punyDecode(input){
  const out=[]; let i=0,n=N0,bias=BIAS0;
  let basic=input.lastIndexOf(DELIM); if(basic<0) basic=0;
  for(let j=0;j<basic;j++){ const c=input.charCodeAt(j); if(c>=0x80) throw 0; out.push(c); }
  let idx=basic>0?basic+1:0;
  while(idx<input.length){
    const oldi=i; let w=1;
    for(let k=B;;k+=B){
      if(idx>=input.length) throw 0;
      const digit=b2d(input.charCodeAt(idx++)); if(digit>=B) throw 0;
      i+=digit*w;
      const t=k<=bias?T_MIN:(k>=bias+T_MAX?T_MAX:k-bias);
      if(digit<t) break; w*=(B-t);
    }
    const len=out.length+1;
    bias=adapt(i-oldi,len,oldi===0);
    n+=Math.floor(i/len); i%=len; out.splice(i++,0,n);
  }
  return String.fromCodePoint(...out);
}

// ---- classification par script ----
const NAMED=["Latin","Cyrillic","Greek","Armenian","Han","Hiragana","Katakana","Hangul","Bopomofo","Arabic","Hebrew","Thai","Devanagari"];
const RES=NAMED.map(s=>[s,new RegExp(`\\p{Script=${s}}`,"u")]);
const CONFUSABLE=new Set(["Latin","Cyrillic","Greek","Armenian"]);
const CJK=new Set(["Han","Hiragana","Katakana","Hangul","Bopomofo"]);
const INVISIBLE=/[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/;

function scriptOf(ch){ for(const [name,re] of RES) if(re.test(ch)) return name; return null; }

function classifyLabel(label){
  if(INVISIBLE.test(label)) return {level:"red",reason:"caractère invisible / override bidi"};
  const scripts=new Set();
  for(const ch of label){ const s=scriptOf(ch); if(s) scripts.add(s); }
  const conf=[...scripts].filter(s=>CONFUSABLE.has(s));
  if(conf.length>=2) return {level:"red",reason:`mélange ${conf.join(" + ")} dans un même label`,scripts:[...scripts]};
  if(scripts.size>=2){
    const ok=[...scripts].every(s=>CJK.has(s)||s==="Latin");
    return ok?{level:"ok",scripts:[...scripts]}:{level:"yellow",reason:"mélange de scripts inhabituel",scripts:[...scripts]};
  }
  if(scripts.size===1){
    const s=[...scripts][0];
    if(s==="Latin") return {level:"ok",scripts:[s]};
    if(CONFUSABLE.has(s)) return {level:"yellow",reason:`label entièrement en ${s} (confusable possible)`,scripts:[s]};
    return {level:"ok",scripts:[s]}; // all-Han, all-Thai… légitime
  }
  return {level:"ok",scripts:[]};
}

function inspect(host){
  const out=[];
  for(const label of host.split(".")){
    if(!label.startsWith("xn--")) continue;
    let uni; try{ uni=punyDecode(label.slice(4)); }
    catch{ out.push({label,level:"yellow",reason:"punycode illisible",unicode:"?"}); continue; }
    out.push({label,unicode:uni,...classifyLabel(uni)});
  }
  return out;
}

// ---- hook ----
const RANK={ok:0,yellow:1,red:2};
const THEME={
  red:   {colors:{toolbar_field:"#c0392b",toolbar_field_text:"#ffffff",toolbar_field_border:"#8e1b12"}},
  yellow:{colors:{toolbar_field:"#e67e22",toolbar_field_text:"#000000",toolbar_field_border:"#a85a10"}}
};
function setBadge(tabId,text,color){
  browser.action.setBadgeText({tabId,text});
  if(color) browser.action.setBadgeBackgroundColor({tabId,color});
}
async function apply(tabId){
  let tab; try{ tab=await browser.tabs.get(tabId); }catch{ return; }
  let host=""; try{ host=new URL(tab.url).hostname; }catch{}
  const f=inspect(host);
  const worst=f.reduce((m,x)=>RANK[x.level]>RANK[m]?x.level:m,"ok");
  if(worst==="red") setBadge(tabId,"⚠","#c0392b");
  else if(worst==="yellow") setBadge(tabId,"?","#e67e22");
  else setBadge(tabId,"","");
  if(!tab.active) return;                       // le thème est par fenêtre : seul l'onglet actif compte
  if(worst==="ok") browser.theme.reset(tab.windowId);
  else browser.theme.update(tab.windowId,THEME[worst]);
  const bad=f.filter(x=>x.level!=="ok");
  if(bad.length) console.warn(host,bad);
}
browser.tabs.onUpdated.addListener((tabId,info)=>{ if(info.url) apply(tabId); });
browser.tabs.onActivated.addListener(({tabId})=>apply(tabId));
browser.tabs.query({active:true}).then(ts=>ts.forEach(t=>apply(t.id)));
// ---- blocage avant requête ----
const allowed=new Set();   // hôtes acceptés « quand même », durée de la session
browser.webRequest.onBeforeRequest.addListener(d=>{
  let host; try{ host=new URL(d.url).hostname; }catch{ return {}; }
  if(allowed.has(host)) return {};
  const red=inspect(host).filter(x=>x.level==="red");
  if(!red.length) return {};
  const q=new URLSearchParams({u:d.url,r:red.map(x=>`${x.unicode} — ${x.reason}`).join(" | ")});
  return {redirectUrl:browser.runtime.getURL("warn.html")+"?"+q};
},{urls:["<all_urls>"],types:["main_frame"]},["blocking"]);

browser.runtime.onMessage.addListener(m=>{
  if(m.allow){ try{ allowed.add(new URL(m.allow).hostname); }catch{} }
});
