'use strict';
const $=s=>document.querySelector(s);
const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const D0=()=>ymd(new Date());
const addD=(s,n)=>{const[y,m,d]=s.split('-').map(Number);return ymd(new Date(y,m-1,d+n))};
const num=s=>{s=String(s??'').trim().replace(',','.');if(s==='')return null;const n=Number(s);return isFinite(n)?n:null};
const f=(n,d=0)=>n==null?'unbekannt':n.toLocaleString('de-DE',{maximumFractionDigits:d,minimumFractionDigits:d});
const dv=x=>x==null?'':String(x).replace('.',',');
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const dfmt=s=>s.split('-').reverse().join('.');
const sum=a=>a.reduce((x,y)=>x+y,0);
const sg=n=>(n>0?'+':n<0?'−':'')+f(Math.abs(n));
const r=(a,b)=>`<div class="row"><span>${a}</span><b>${b}</b></div>`;
const sel=(id,o,v,x='')=>`<select id=${id} ${x}>${o.map(([k,l])=>`<option value="${k}" ${String(k)===String(v)?'selected':''}>${l}</option>`).join('')}</select>`;
const age=dob=>{const[y,m,d]=dob.split('-').map(Number),n=new Date();return n.getFullYear()-y-((n.getMonth()+1<m||(n.getMonth()+1===m&&n.getDate()<d))?1:0)};

/* Speicher: IndexedDB, Schema-Version 1 */
const ST=['kv','food','work','weight','days','foods'];let db;
const opendb=()=>new Promise((res,rej)=>{const q=indexedDB.open('bilanz',1);
 q.onupgradeneeded=()=>{const d=q.result,h=n=>d.objectStoreNames.contains(n);
  if(!h('kv'))d.createObjectStore('kv');
  ['food','work'].forEach(n=>{if(!h(n))d.createObjectStore(n,{keyPath:'id',autoIncrement:true}).createIndex('date','date')});
  ['weight','days'].forEach(n=>{if(!h(n))d.createObjectStore(n,{keyPath:'date'})});
  if(!h('foods'))d.createObjectStore('foods',{keyPath:'name'})};
 q.onsuccess=()=>{db=q.result;res()};q.onerror=()=>rej(q.error)});
const tx=(s,m,fn)=>new Promise((res,rej)=>{const t=db.transaction(s,m);const q=fn(t.objectStore(s));t.oncomplete=()=>res(q&&q.result);t.onerror=t.onabort=()=>rej(t.error)});
const all=s=>tx(s,'readonly',o=>o.getAll());
const get=(s,k)=>tx(s,'readonly',o=>o.get(k));
const put=(s,v)=>tx(s,'readwrite',o=>o.put(v));
const del=(s,k)=>tx(s,'readwrite',o=>o.delete(k));
const kv=k=>get('kv',k);
const kset=(k,v)=>tx('kv','readwrite',o=>o.put(v,k));
const byDate=(s,d)=>tx(s,'readonly',o=>o.index('date').getAll(d));
window.onunhandledrejection=e=>alert('Speichern fehlgeschlagen: '+((e.reason&&e.reason.message)||e.reason));

/* Berechnung: Mifflin-St-Jeor, Alltagsfaktor, MET-basiertes Training (netto) */
const PAL={1:['Überwiegend sitzend',1.2],2:['Leicht aktiv, viel Stehen oder Gehen',1.3],3:['Aktiv im Alltag',1.4],4:['Körperlich anstrengender Alltag',1.5]};
const MET={kraft:['Krafttraining mit Zusatzgewicht',3.5,5,6],koerper:['Körpergewichtsübungen',3.8,5,8],ausdauer:['Ausdauer, z. B. Stairmaster',6,9,11]};
function calc(p){const b=10*p.kg+6.25*p.cm-5*age(p.dob)+(p.sex==='m'?5:-161),t=b*PAL[p.pal][1],pd=(p.rate||0)*7700/7;
 let adj=p.goal==='ab'?-Math.min(pd,t*.25):p.goal==='auf'?Math.min(pd,500):0,g=t+adj;const fl=p.sex==='m'?1500:1200,cap=g<fl;if(cap)g=fl;if(p.manual)g=p.manual;
 return{bmr:Math.round(b),tdee:Math.round(t),goal:Math.round(g),capped:cap&&!p.manual,credit:p.credit,tol:p.tol}}
const ek=(e,w,kg)=>{const m=e.m||sum(e.s.map(s=>(s.r||0)*3+60))/60;return m>0?Math.round((MET[e.t||w.type][1+w.int]-1)*kg*m/60):null};
const wk=(w,kg)=>{if(w.kcal!=null)return w.kcal;if(w.min)return Math.round((MET[w.type][1+w.int]-1)*kg*w.min/60);const a=w.ex.map(e=>ek(e,w,kg)).filter(v=>v!=null);return a.length?sum(a):null};
const ev=(e,w,kg)=>w.min||w.kcal!=null?'':(v=>v==null?'':' (ca. '+v+' kcal)')(ek(e,w,kg));
const trn=(wo,d)=>{let k=0,u=0;wo.forEach(w=>{const v=wk(w,d.kg);v==null?u++:k+=v});return{k,u}};
const snap=async date=>{let d=await get('days',date);if(!d){const p=await kv('p');if(!p)return null;d={date,...calc(p),kg:p.kg,done:false};await put('days',d)}return d};
const refresh=async()=>{const p=await kv('p'),d=await get('days',D0());if(p&&d)await put('days',{...d,...calc(p),kg:p.kg})};

/* Kalorienschätzung aus Freitext: eingebaute Liste, Richtwerte kcal je 100 g oder ml und Standardportion in g. Nudeln, Reis, Kartoffeln, Fleisch gelten als gekocht oder gebraten. */
const FD='brot,vollkornbrot,toast,toastbrot,graubrot,mischbrot:250:45;brötchen,semmel,weckle,schrippe:270:60;brezel,breze:300:80;croissant:410:60;knäckebrot:340:10;haferflocken,müsli,porridge:370:50;cornflakes:375:30;nudeln,spaghetti,pasta:150:250;reis:130:200;kartoffeln,kartoffel,kartoffelpüree:80:200;pommes:300:150;pizza:250:300;döner,dürüm:215:350;burger,hamburger,cheeseburger:250:200;erdnussbutter:600:15;nutella,nussnougatcreme:540:15;butter:740:10;margarine:720:10;marmelade,konfitüre:250:20;honig:300:20;frischkäse:250:30;hummus:230:30;käse,gouda,emmentaler,cheddar:360:30;mozzarella:250:125;feta:260:50;parmesan:400:10;schinken:120:20;salami:400:15;bratwurst,würstchen,wurst:290:100;ei,eier,spiegelei,rührei:145:55;joghurt,naturjoghurt:65:150;fruchtjoghurt:100:150;skyr:65:150;quark,magerquark:70:125;milch:64:200;hafermilch,sojamilch,mandelmilch:45:200;cappuccino,latte macchiato,milchkaffee:45:250;kaffee,tee,wasser:1:200;cola,limonade,fanta,sprite,eistee:42:330;orangensaft,apfelsaft,saft:45:200;bier:43:500;rotwein,weißwein,weisswein,sekt:75:150;apfel:52:180;banane:90:120;orange,mandarine,clementine:47:120;birne:55:170;erdbeeren,erdbeere,beeren,himbeeren,blaubeeren:40:100;trauben,weintrauben:70:100;melone,wassermelone:30:200;ananas:55:100;avocado:160:150;tomate,tomaten:18:100;gurke:12:100;paprika:30:150;karotte,möhre,karotten,möhren:40:80;salat:20:100;brokkoli,blumenkohl,gemüse,zucchini:35:150;zwiebel:40:80;pilze,champignons:22:100;nüsse,mandeln,walnüsse,cashews,haselnüsse,erdnüsse:620:30;chips:530:50;schokolade:540:20;schokoriegel,müsliriegel,proteinriegel,snickers,twix:450:50;keks,kekse,plätzchen:470:10;kuchen,torte:380:100;eis,eiscreme:210:100;gummibärchen,gummibären:350:25;hähnchen,hühnchen,pute,hähnchenbrust:150:150;steak,rindfleisch,hackfleisch,hack:220:150;schnitzel,schweinefleisch:230:150;lachs:200:150;thunfisch:130:100;fisch,fischstäbchen:170:100;tofu:120:100;linsen,kichererbsen,bohnen:130:150;suppe,eintopf:60:300;soße,sauce,sosse:80:100;olivenöl,öl:880:10;zucker:400:5;mayonnaise,mayo:700:15;ketchup:100:15;sahne:300:30;proteinshake,eiweißshake:120:300'.split(';').map(x=>{const[a,k,g]=x.split(':'),n=a.split(',');return{n:n[0][0].toUpperCase()+n[0].slice(1),a:n,k:+k,g:+g}});
const hit=(w,a)=>a.length<4?new RegExp('(^|[^a-zäöüß])'+a+'(e|er|s|n)?($|[^a-zäöüß])').test(w):w.includes(a);
function est(txt){const items=[],miss=[];
 txt.toLowerCase().split(/\s+(?:mit|und|plus|dazu)\s+|\s*[,+&]\s*/).forEach(p=>{p=p.trim();if(!p)return;
  const m=p.match(/^(\d+(?:[.,]\d+)?)\s*(?:(x|g|gr|ml|el|tl|scheibe[n]?|stück|stk|portion(?:en)?|tasse[n]?|glas|gläser|becher|dose[n]?)(?![a-zäöüß]))?\.?\s*(.*)$/),n=m?parseFloat(m[1].replace(',','.')):1,u=(m&&m[2])||'',w=m?m[3]:p;
  let b=null,l=0;FD.forEach(d=>d.a.forEach(a=>{if(a.length>l&&hit(w,a)){b=d;l=a.length}}));
  if(!b)return miss.push(p);
  const g=/^(g|gr|ml)$/.test(u)?n:u==='el'?n*15:u==='tl'?n*5:n*b.g;items.push({n:b.n,g,k:Math.round(g*b.k/100)})});
 return{items,miss,tot:sum(items.map(i=>i.k))}}
let AUTO='';
window.fest=()=>{const q=est($('#fn').value),fe=$('#fe'),fk=$('#fk');
 if(!q.items.length){fe.textContent=q.miss.length?'Nicht erkannt: '+q.miss.join(', ')+'. Bitte Kalorien selbst eintragen.':'';return}
 fe.innerHTML=q.items.map(i=>esc(i.n)+' '+f(i.g)+' g: '+f(i.k)+' kcal').join('<br>')+'<br><b>Grobe Schätzung: '+f(q.tot)+' kcal</b>'+(q.miss.length?'<br>Nicht erkannt: '+esc(q.miss.join(', ')):'');
 if(!$('#fp').value&&(fk.value===''||fk.value===AUTO)){AUTO=dv(q.tot);fk.value=AUTO}};

/* Oberfläche */
let tab='heute',cur=D0(),per=30,pex='',W=null,IMP=null;
const TABS=[['heute','Heute'],['ernaehrung','Ernährung'],['training','Training'],['fortschritt','Fortschritt'],['einst','Einstellungen']];
const MEALS=['Frühstück','Mittagessen','Abendessen','Snacks'];
const render=async top=>{const h=await({heute:vToday,ernaehrung:vFood,training:vTrain,fortschritt:vProg,einst:vSet}[tab])();
 $('#v').innerHTML=h;$('#nav').innerHTML=TABS.map(([k,l])=>`<button class="${k===tab?'on':''}" onclick="go('${k}')">${l}</button>`).join('');if(top)scrollTo(0,0)};
window.go=t=>{tab=t;render(1)};window.dd=n=>{cur=addD(cur,n);render()};
const dn=()=>`<div class="row"><button class="b g" onclick="dd(-1)">Zurück</button><input type=date value="${cur}" onchange="cur=this.value||cur;render()" style="margin:0;text-align:center"><button class="b g" onclick="dd(1)">Weiter</button></div>`;
window.sheet=h=>{let s=$('#sh');if(!s){s=document.createElement('div');s.id='sh';document.body.append(s)}s.innerHTML='<div>'+h+'</div>'};
window.closeSheet=()=>{const s=$('#sh');if(s)s.remove()};

async function vToday(){const p=await kv('p');if(!p)return'<h1>Ersteinrichtung</h1><p class="m">Alle Angaben bleiben auf diesem Gerät. Sie dienen nur der Schätzung deines Kalorienbedarfs.</p>'+pform(null);
 const d=await snap(cur),fo=await byDate('food',cur),wo=await byDate('work',cur),e=sum(fo.map(x=>x.kcal)),t=trn(wo,d),cr=Math.round(t.k*d.credit/100),bud=d.goal+cr-e,bal=Math.round(e-d.tdee-t.k),bk=await kv('bk');
 const old=(fo.length||wo.length)&&(!bk||Date.now()-bk>14*864e5);
 return`<h1>Heute</h1>${dn()}${old?`<div class="card m">Letzte Sicherung: ${bk?new Date(bk).toLocaleDateString('de-DE'):'noch nie'}. Unter Einstellungen kannst du alle Daten exportieren.</div>`:''}
<div class="card"><div class="m">${bud>=0?'Verbleibendes Essensbudget':'Über dem Essensziel'}</div><div class="big ${bud<0?'neg':''}">${f(Math.abs(bud))} kcal</div><div class="bar"><i style="width:${Math.min(100,e/(d.goal+cr)*100)}%"></i></div></div>
<div class="card">${r('Ruheenergiebedarf, geschätzt',f(d.bmr)+' kcal')}${r('Tagesbedarf ohne erfasstes Training, geschätzt',f(d.tdee)+' kcal')}${r('Trainingsverbrauch, geschätzt',!wo.length?'kein Training':t.u&&!t.k?'unbekannt':f(t.k)+' kcal'+(t.u?' (+'+t.u+' ohne Angabe)':''))}${r('Essensziel',f(d.goal)+' kcal')}${r('Angerechnete Trainingskalorien',f(cr)+' kcal')}${r('Gegessen',f(e)+' kcal')}${r('Energiebilanz, geschätzt',bal===0?'ausgeglichen':sg(bal)+' kcal ('+(bal>0?'Überschuss':'Defizit')+')')}
<div class="m">Essensziel und Energiebilanz sind verschiedene Größen: Die Bilanz vergleicht die Aufnahme mit dem geschätzten Gesamtverbrauch aus Tagesbedarf und Training. Trainings ohne Verbrauchsangabe fehlen darin.${d.capped?' Das Ziel wurde auf die Mindestmenge begrenzt.':''}${d.done?'':' Der Tag ist nicht als vollständig markiert, die Bilanz gilt nur vorläufig.'}</div></div>
<label class="row"><span>Tag vollständig erfasst</span><input type=checkbox ${d.done?'checked':''} onchange="done(this.checked)"></label>
<h2>Mahlzeiten und Training</h2><div class="card">${MEALS.map(m=>r(m,f(sum(fo.filter(x=>x.meal===m).map(x=>x.kcal)))+' kcal')).join('')}${wo.map(w=>r(esc(w.name),w.min?w.min+' min':'Dauer offen')).join('')}</div>`}
window.done=async c=>{const d=await snap(cur);await put('days',{...d,done:c});render()};

async function vFood(){const fo=await byDate('food',cur);
 return`<h1>Ernährung</h1>${dn()}<button class="b" style="width:100%;margin:8px 0" onclick="fform()">Eintrag hinzufügen</button>`+MEALS.map(m=>{const a=fo.filter(x=>x.meal===m);
 return`<h2>${m}, ${f(sum(a.map(x=>x.kcal)))} kcal</h2>`+(a.map(x=>`<div class="card row" onclick="fform(${x.id})"><span>${esc(x.name)}<div class="m">${x.amount!=null?f(x.amount,0)+' g oder ml':x.est?'Schätzung':'Gesamtwert'}</div></span><b>${f(x.kcal)} kcal</b></div>`).join('')||'<div class="m">Keine Einträge</div>')}).join('')}
window.fform=async id=>{AUTO='';const x=id?await get('food',id):{meal:MEALS[0]},fs=await all('foods'),rc=[...new Set((await all('food')).reverse().map(a=>a.name))].slice(0,8);
 sheet(`<h1>${id?'Eintrag bearbeiten':'Eintrag hinzufügen'}</h1>${rc.map(n=>`<button class="b g" style="margin:0 6px 6px 0;min-height:36px" onclick="qf(this.textContent)">${esc(n)}</button>`).join('')}
<label>Name</label><input id=fn list=fl value="${esc(x.name||'')}" oninput="fpick(this.value);fest()"><datalist id=fl>${fs.map(a=>`<option value="${esc(a.name)}">`).join('')}</datalist><div id=fe class="m"></div>
<label>Mahlzeit</label>${sel('fm',MEALS.map(m=>[m,m]),x.meal)}
<label>kcal pro 100 g oder 100 ml</label><input id=fp inputmode=decimal value="${dv(x.per100)}">
<label>Menge in g oder ml</label><input id=fa inputmode=decimal value="${dv(x.amount)}">
<label>Oder Gesamt-kcal ohne Mengenberechnung</label><input id=fk inputmode=decimal value="${x.per100==null?dv(x.kcal):''}">
<label class=row><span>Als eigenes Lebensmittel speichern</span><input id=fs type=checkbox></label>
<button class="b" style="width:100%" onclick="fsave(${id||0})">Speichern</button>${id?`<button class="b d" onclick="fdel(${id})">Löschen</button>`:''}<button class="b g" style="width:100%;margin-top:8px" onclick="closeSheet()">Abbrechen</button>`)};
window.fpick=async n=>{const g=await get('foods',n)||(await all('food')).reverse().find(a=>a.name===n&&a.per100!=null);if(g)$('#fp').value=dv(g.per100)};
window.qf=n=>{$('#fn').value=n;fpick(n)};
window.fsave=async id=>{const n=$('#fn').value.trim(),p=num($('#fp').value),a=num($('#fa').value),k=num($('#fk').value),kc=p!=null&&a!=null?p*a/100:k;
 if(!n||kc==null||kc<0||kc>10000)return alert('Bitte einen Namen und entweder kcal pro 100 g mit Menge oder Gesamt-kcal angeben. Fehlende Werte zählen nicht als null.');
 const x={date:cur,meal:$('#fm').value,name:n,per100:p,amount:a,kcal:Math.round(kc)};if(p==null&&AUTO&&$('#fk').value===AUTO)x.est=1;if(id)x.id=id;
 await put('food',x);if($('#fs').checked&&p!=null)await put('foods',{name:n,per100:p});await snap(cur);closeSheet();render()};
window.fdel=async id=>{if(confirm('Eintrag löschen?')){await del('food',id);closeSheet();render()}};

async function vTrain(){const wo=await byDate('work',cur),d=await snap(cur);
 const L=wo.map(w=>{const v=wk(w,d.kg);
 return`<div class="card"><div class="row"><b>${esc(w.name)}</b><span>${w.min?w.min+' min':'Dauer offen'}</span></div><div class="m">${MET[w.type][0]}, ${v==null?'Verbrauch unbekannt':f(v)+' kcal '+(w.kcal!=null?'manuell':'geschätzt')}</div>${w.ex.map(e=>`<div class="m">${esc(e.n)}: ${e.s.map(s=>s.r+' Wdh.'+(s.k?' mit '+f(s.k,1)+' kg':'')).join(', ')||(e.m?f(e.m)+' min':'ohne Sätze')}${ev(e,w,d.kg)}</div>`).join('')}<div class="row"><button class="b g" onclick="wform(${w.id})">Bearbeiten</button><button class="b g" onclick="wdup(${w.id})">Duplizieren</button></div></div>`}).join('');
 return`<h1>Training</h1>${dn()}<button class="b" style="width:100%;margin:8px 0" onclick="wform()">Workout hinzufügen</button>`+(L||'<div class="m">Keine Trainings an diesem Tag</div>')}
window.wform=async id=>{W=id?await get('work',id):{date:cur,name:'',type:'kraft',int:1,min:'',kcal:'',note:'',ex:[]};wr()};
const wr=()=>sheet(`<h1>Workout</h1><label>Name</label><input value="${esc(W.name)}" oninput="W.name=this.value">
<label>Art, für die Verbrauchsschätzung</label><select onchange="W.type=this.value">${Object.entries(MET).map(([k,v])=>`<option value=${k} ${k===W.type?'selected':''}>${v[0]}</option>`).join('')}</select>
<label>Intensität</label><select onchange="W.int=+this.value">${['Leicht','Mittel','Hoch'].map((t,i)=>`<option value=${i} ${i===W.int?'selected':''}>${t}</option>`).join('')}</select>
<label>Gesamtdauer in Minuten (optional, ersetzt die Schätzung aus Sätzen und Übungsminuten)</label><input inputmode=decimal value="${dv(W.min)}" oninput="W.min=this.value">
<label>Verbrauchte aktive kcal manuell (optional, ohne Grundumsatz, ersetzt die Schätzung)</label><input inputmode=decimal value="${dv(W.kcal)}" oninput="W.kcal=this.value">
<label>Notiz</label><input value="${esc(W.note)}" oninput="W.note=this.value">
<h2>Übungen</h2>${W.ex.map((e,i)=>`<div class="card"><input placeholder="Übung" value="${esc(e.n)}" onchange="exn(${i},this.value)"><div class="g2"><select onchange="W.ex[${i}].t=this.value">${Object.entries(MET).map(([k,v])=>`<option value=${k} ${k===(e.t||W.type)?'selected':''}>${v[0].split(/[ ,]/)[0]}</option>`).join('')}</select><input inputmode=decimal placeholder="Minuten, optional" value="${dv(e.m)}" oninput="W.ex[${i}].m=this.value"></div>${e.s.map((s,j)=>`<div class="g2"><input inputmode=decimal placeholder="Wiederholungen" value="${dv(s.r)}" oninput="W.ex[${i}].s[${j}].r=this.value"><input inputmode=decimal placeholder="Zusatzgewicht in kg" value="${dv(s.k)}" oninput="W.ex[${i}].s[${j}].k=this.value"></div>`).join('')}<button class="b g" onclick="W.ex[${i}].s.push({r:'',k:''});wr()">Satz hinzufügen</button> <button class="b d" onclick="W.ex.splice(${i},1);wr()">Entfernen</button></div>`).join('')}
<button class="b g" onclick="W.ex.push({n:'',s:[],t:W.type,m:''});wr()">Übung hinzufügen</button>
<button class="b" style="width:100%;margin-top:14px" onclick="wsave()">Speichern</button>${W.id?'<button class="b d" onclick="wdel()">Löschen</button>':''}<button class="b g" style="width:100%;margin-top:8px" onclick="closeSheet()">Abbrechen</button>`);
window.exn=async(i,v)=>{v=v.trim();W.ex[i].n=v;if(/stair|lauf|rad|ergo|ruder|schwimm|seil|cross|ellip|walk|geh/i.test(v))W.ex[i].t='ausdauer';if(v&&!W.ex[i].s.length){const l=(await all('work')).sort((a,b)=>a.date<b.date?1:-1).map(w=>w.ex.find(e=>e.n===v)).find(Boolean);if(l){W.ex[i].s=l.s.map(s=>({...s}));W.ex[i].t=l.t||W.ex[i].t;W.ex[i].m=l.m}}wr()};
window.wsave=async()=>{const m=num(W.min),k=num(W.kcal);if(!W.name.trim())return alert('Bitte einen Namen angeben.');
 if((m!=null&&(m<=0||m>600))||(k!=null&&(k<0||k>5000)))return alert('Bitte plausible Werte für Dauer und kcal eingeben.');
 const w={...W,name:W.name.trim(),min:m,kcal:k,ex:W.ex.filter(e=>e.n).map(e=>({n:e.n,t:e.t||W.type,m:num(e.m),s:e.s.map(s=>({r:num(s.r),k:num(s.k)})).filter(s=>s.r!=null)}))};
 await put('work',w);await snap(w.date);closeSheet();render()};
window.wdel=async()=>{if(confirm('Workout löschen?')){await del('work',W.id);closeSheet();render()}};
window.wdup=async id=>{const w=await get('work',id);delete w.id;w.date=cur;await put('work',w);render()};

const chart=a=>{if(a.length<2)return'';const v=a.map(x=>x.kg),lo=Math.min(...v),s=(Math.max(...v)-lo)||1;
 return`<svg viewBox="0 0 300 100" style="width:100%"><polyline fill="none" stroke="#5fb3a1" stroke-width="2" points="${v.map((y,i)=>(i*300/(v.length-1)).toFixed(1)+','+(90-(y-lo)/s*80).toFixed(1)).join(' ')}"/></svg><div class="row m"><span>${f(lo,1)} kg</span><span>${f(Math.max(...v),1)} kg</span></div>`};
async function vProg(){const from=addD(D0(),-per+1),ws=(await all('weight')).sort((a,b)=>a.date<b.date?-1:1),wp=ws.filter(x=>x.date>=from),fo=await all('food'),aw=await all('work'),wo=aw.filter(x=>x.date>=from),days=(await all('days')).filter(x=>x.date>=from&&x.done);
 let ok=0,lo=0,hi=0,tot=0;days.forEach(d=>{const e=sum(fo.filter(x=>x.date===d.date).map(x=>x.kcal)),g=d.goal+trn(wo.filter(x=>x.date===d.date),d).k*d.credit/100,t=(d.tol||10)/100;tot+=e;e<g*(1-t)?lo++:e>g*(1+t)?hi++:ok++});
 const tr=wp.slice(-7),avg=tr.length?sum(tr.map(x=>x.kg))/tr.length:null,names=[...new Set(aw.flatMap(w=>w.ex.map(e=>e.n)))].sort();
 const eh=pex?aw.slice().sort((a,b)=>a.date<b.date?-1:1).map(w=>({date:w.date,e:w.ex.find(e=>e.n===pex)})).filter(x=>x.e&&x.e.s.length):[];
 return`<h1>Fortschritt</h1>${sel('pz',[[7,'Letzte 7 Tage'],[30,'Letzte 30 Tage'],[90,'Letzte 90 Tage'],[365,'Letzte 365 Tage']],per,'onchange="per=+this.value;render()"')}
<h2>Gewicht</h2><div class="card">${chart(wp)}<div class="m">${wp.length?'Aktuell '+f(wp.at(-1).kg,1)+' kg. Trend, Durchschnitt der letzten '+tr.length+' Einträge: '+f(avg,1)+' kg':'Keine Einträge im Zeitraum'}</div><div class="g2" style="margin-top:10px"><input id=wd type=date value="${D0()}"><input id=wkg inputmode=decimal placeholder="Gewicht in kg"></div><button class="b" style="width:100%" onclick="addW()">Gewicht speichern</button></div>
<h2>Ernährung</h2><div class="card">${days.length?r('Vollständig erfasste Tage',days.length)+r('Durchschnittliche Aufnahme',f(tot/days.length)+' kcal')+r('Im Zielbereich',ok)+r('Deutlich darunter',lo)+r('Deutlich darüber',hi):'<div class="m">Keine als vollständig markierten Tage im Zeitraum</div>'}<div class="m">Nur vollständig erfasste Tage zählen. Weniger zu essen als das Ziel gilt nicht als Erfolg. Toleranz einstellbar unter Einstellungen.</div></div>
<h2>Training</h2><div class="card">${r('Workouts',wo.length)}${r('Pro Woche',f(wo.length/per*7,1))}${r('Gesamtdauer erfasst',f(sum(wo.map(w=>w.min||0)))+' min')}</div>
<h2>Übung im Verlauf</h2><select onchange="pex=this.value;render()"><option value="">Übung wählen</option>${names.map(n=>`<option ${n===pex?'selected':''}>${esc(n)}</option>`).join('')}</select>${eh.map(x=>{const b=x.e.s.reduce((a,s)=>((s.k||0)>(a.k||0)||((s.k||0)===(a.k||0)&&s.r>a.r))?s:a),v=sum(x.e.s.map(s=>s.r*(s.k||0)));
 return`<div class="card"><div class="row"><b>${dfmt(x.date)}</b><span>${b.r} Wdh.${b.k?' mit '+f(b.k,1)+' kg':''}</span></div><div class="m">${v>0?'Volumen '+f(v)+' (Wiederholungen mal kg)':'Wiederholungen gesamt '+sum(x.e.s.map(s=>s.r))}</div></div>`}).join('')}`}
window.addW=async()=>{const kg=num($('#wkg').value),d=$('#wd').value;if(kg==null||kg<30||kg>300||!d)return alert('Bitte ein Gewicht zwischen 30 und 300 kg und ein Datum angeben.');
 await put('weight',{date:d,kg});const ws=(await all('weight')).sort((a,b)=>a.date<b.date?1:-1),p=await kv('p');if(p&&ws[0].date===d){p.kg=kg;await kset('p',p);await refresh()}render()};

const pform=p=>{p=p||{sex:'m',pal:2,goal:'halten',rate:0.25,credit:0,tol:10};return`
<label>Körpergröße in cm</label><input id=pc inputmode=decimal value="${dv(p.cm)}">
<label>Gewicht in kg</label><input id=pk inputmode=decimal value="${dv(p.kg)}">
<label>Geburtsdatum</label><input id=pd type=date value="${p.dob||''}">
<label>Geschlecht für die Formel (Mifflin-St-Jeor nutzt je Geschlecht eine andere Konstante, es dient nur der Berechnung)</label>${sel('ps',[['m','Männlich'],['w','Weiblich']],p.sex)}
<label>Alltagsaktivität ohne protokolliertes Training</label>${sel('pp',Object.entries(PAL).map(([k,v])=>[k,v[0]]),p.pal)}
<label>Ziel</label>${sel('pg',[['ab','Abnehmen'],['halten','Gewicht halten'],['auf','Muskelaufbau oder Zunehmen']],p.goal)}
<label>Zielgewicht in kg (optional)</label><input id=pt2 inputmode=decimal value="${dv(p.target)}">
<label>Tempo in kg pro Woche (bei Abnehmen und Zunehmen)</label>${sel('pr',[[0.25,'0,25 kg, moderat'],[0.5,'0,5 kg'],[0.75,'0,75 kg, Maximum']],p.rate)}
<label>Trainingskalorien auf das Essensbudget anrechnen (verändert nur das Budget, nicht den geschätzten Verbrauch)</label>${sel('pcr',[[0,'0 Prozent'],[50,'50 Prozent'],[100,'100 Prozent']],p.credit)}
<label>Toleranz für die Zielerreichung in Prozent</label><input id=pt inputmode=decimal value="${dv(p.tol)}">
<label>Kalorienziel manuell in kcal (optional, überschreibt die Berechnung)</label><input id=pm inputmode=decimal value="${dv(p.manual)}">
<button class="b" style="width:100%" onclick="psave()">Speichern</button>`};
window.psave=async()=>{const q=id=>num($('#'+id).value),p={cm:q('pc'),kg:q('pk'),dob:$('#pd').value,sex:$('#ps').value,pal:+$('#pp').value,goal:$('#pg').value,target:q('pt2'),rate:+$('#pr').value,credit:+$('#pcr').value,tol:q('pt')||10,manual:q('pm')};
 if(!(p.cm>=120&&p.cm<=230&&p.kg>=30&&p.kg<=300&&p.dob&&age(p.dob)>=18&&age(p.dob)<=90))return alert('Bitte plausible Werte eingeben: Größe 120 bis 230 cm, Gewicht 30 bis 300 kg, Alter 18 bis 90 Jahre. Die Formel gilt für Erwachsene.');
 if(p.manual!=null&&(p.manual<1000||p.manual>6000))return alert('Das manuelle Kalorienziel muss zwischen 1000 und 6000 kcal liegen.');
 await kset('p',p);await put('weight',{date:D0(),kg:p.kg});await refresh();render(1)};
async function vSet(){const p=await kv('p'),bk=await kv('bk');
 return`<h1>Einstellungen</h1>${pform(p)}<h2>Datensicherung</h2><div class="card"><div class="m">Letzte Sicherung: ${bk?new Date(bk).toLocaleString('de-DE'):'noch nie'}. Die Daten liegen nur im Browserspeicher dieses Geräts. Das Löschen von Website-Daten oder andere Speicherereignisse können sie entfernen, dauerhafte Speicherung ist nicht garantiert.</div>
<button class="b" style="width:100%;margin:10px 0" onclick="exp()">Alles exportieren (JSON)</button><label>Sicherung importieren</label><input type=file accept=".json,application/json" onchange="imp(this)"><button class="b d" onclick="wipeAll()">Alle Daten löschen</button></div>
<h2>Grundlagen</h2><div class="card m">Ruheenergiebedarf nach Mifflin-St-Jeor (Mifflin et al., 1990). Tagesbedarf gleich Ruheenergiebedarf mal Alltagsfaktor (1,2 / 1,3 / 1,4 / 1,5, eigene Annahmen ohne Sport). Training: (MET minus 1) mal kg mal Stunden, MET-Werte als Näherung angelehnt an das Compendium of Physical Activities; das Ruhe-MET von 1 ist im Tagesbedarf schon enthalten. Ziel: 7700 kcal je kg Körpergewicht als grobe Faustregel, Defizit höchstens 25 Prozent, Untergrenze 1200 kcal (weiblich) oder 1500 kcal (männlich). Ohne Gesamtdauer schätzt die App je Übung aus den Sätzen (pro Satz Wiederholungen mal 3 Sekunden plus 60 Sekunden Pause) oder aus den Übungsminuten; bei angegebener Gesamtdauer zählt nur diese. Kalorien aus Freitext stammen aus einer eingebauten Liste mit Standardportionen und sind grob. Alle Werte sind Schätzungen. Die App sendet keine Daten an Dritte.</div>`}
window.exp=async()=>{const o={app:'kt',v:1,at:new Date().toISOString(),kv:{p:await kv('p')}};for(const s of ST.slice(1))o[s]=await all(s);
 const b=new Blob([JSON.stringify(o)],{type:'application/json'}),n='bilanz-'+D0()+'.json',fl=new File([b],n,{type:'application/json'});
 if(navigator.canShare&&navigator.canShare({files:[fl]})){try{await navigator.share({files:[fl]})}catch(e){if(e.name==='AbortError')return;throw e}}
 else{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=n;a.click()}
 await kset('bk',Date.now());render()};
window.imp=async i=>{const t=await(i.files[0]&&i.files[0].text());if(!t)return;let o;try{o=JSON.parse(t)}catch{return alert('Die Datei ist kein gültiges JSON.')}
 if(!o||o.app!=='kt'||o.v!==1||!o.kv||ST.slice(1).some(s=>!Array.isArray(o[s])))return alert('Die Datei ist keine gültige Sicherung dieser App.');
 IMP=o;sheet(`<h1>Import</h1><p>Sicherung vom ${new Date(o.at).toLocaleString('de-DE')}: ${o.food.length} Ernährungseinträge, ${o.work.length} Workouts, ${o.weight.length} Gewichtseinträge. Alle vorhandenen Daten werden ersetzt.</p><button class="b" onclick="impgo()">Ersetzen</button> <button class="b g" onclick="closeSheet()">Abbrechen</button>`)};
window.impgo=()=>{const t=db.transaction(ST,'readwrite');ST.forEach(s=>t.objectStore(s).clear());ST.slice(1).forEach(s=>IMP[s].forEach(v=>t.objectStore(s).put(v)));if(IMP.kv.p)t.objectStore('kv').put(IMP.kv.p,'p');
 t.oncomplete=()=>{closeSheet();render(1)};t.onerror=t.onabort=()=>alert('Import fehlgeschlagen. Die vorhandenen Daten bleiben erhalten.')};
window.wipeAll=()=>{if(!confirm('Alle Daten unwiderruflich löschen?'))return;const t=db.transaction(ST,'readwrite');ST.forEach(s=>t.objectStore(s).clear());t.oncomplete=()=>render(1)};

const on=()=>{$('#off').hidden=navigator.onLine};addEventListener('online',on);addEventListener('offline',on);on();
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js');
opendb().then(()=>{render();if(navigator.storage&&navigator.storage.persist)navigator.storage.persist()}).catch(e=>{$('#v').innerHTML='<div class="card neg">Lokaler Speicher nicht verfügbar: '+esc(e.message)+'. Bitte nicht im privaten Modus verwenden.</div>'});
