import { ld, sv, toast, showPage, openOverlay, closeOverlay, fmtWt, fmtDate, fmtSecs, getUnit, detectPRs, getPR, getPrevWtFromSessions, userDataCache, userProfile } from './app.js';
import { SESSIONS, EQUIP_OPTIONS, CAT_META, EXERCISE_LIBRARY, getSessName } from './data.js';
import { db } from './firebase.js';
import { collection, addDoc, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';

// ─── TRAIN-ONLY STATE ─────────────────────────────────────────────────────────
let extraCount=0,restTimers={},selectedFeel='',csbExercises=[],editingCustomId=null;
let swapState={sessId:null,exIdx:null,selected:null},histFilter='all',sessionStartTime=null,durInterval=null,setTypeState={};
let wuState={running:false,stepIdx:0,secsLeft:0,interval:null};
var restFsEi=-1,restFsSecs=0,restFsRem=0,restFsInterval=null;
var csbSessionType=null,csbExTypes=[],csbEmomInterval=60;
var CSB_EX_TYPES={straight_sets:['standard','superset','amrap','ladder','pyramid','drop_set'],circuit:['standard','amrap','ladder','pyramid','drop_set'],amrap:['standard'],emom:['standard']};
var CSB_EX_LABELS={standard:'Standard',superset:'Superset',amrap:'AMRAP',ladder:'Ladder',pyramid:'Pyramid',drop_set:'Drop Set'};

// ─── AUDIO: REST DONE BEEP ────────────────────────────────────────────────────
function playRestDone(){
  try{
    var ctx=new(window.AudioContext||window.webkitAudioContext)();
    var o=ctx.createOscillator(),g=ctx.createGain();
    o.connect(g);g.connect(ctx.destination);
    o.frequency.value=587;
    g.gain.setValueAtTime(0.4,ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.4);
    o.start(ctx.currentTime);o.stop(ctx.currentTime+0.4);
  }catch(e){}
}

// DELOAD
function checkDeload(){
  const area=document.getElementById('deload-area');if(!area)return;
  if(ld('deloadDismissed',false)){area.innerHTML='';return;}
  const s=ld('sessions',[]),last=ld('lastDeloadSession',0),since=s.filter(x=>x.id>last).length;
  if(since>=4)area.innerHTML=`<div class="deload"><div class="deload-txt">💪 ${since} sessions done — consider a deload this week.</div><button class="pill gd on" onclick="dismissDeload()">Got it</button></div>`;
  else area.innerHTML='';
}
function dismissDeload(){const s=ld('sessions',[]);sv('lastDeloadSession',s.length?s[s.length-1].id:0);sv('deloadDismissed',true);setTimeout(()=>sv('deloadDismissed',false),7*24*60*60*1000);document.getElementById('deload-area').innerHTML='';toast('Deload week noted');}

// EQUIPMENT
function initEquipment(){
  const saved=ld('equipment',null);activeEquipment=saved&&saved.length?new Set(saved):new Set(EQUIP_OPTIONS.map(function(e){return e.id;}));
  document.getElementById('equip-grid').innerHTML=EQUIP_OPTIONS.map(e=>`<div class="eq ${activeEquipment.has(e.id)?'on':''}" id="ec-${e.id}" onclick="toggleEquip('${e.id}')">${e.label}</div>`).join('');
}
function toggleEquip(id){activeEquipment.has(id)?activeEquipment.delete(id):activeEquipment.add(id);sv('equipment',[...activeEquipment]);document.getElementById('ec-'+id).classList.toggle('on',activeEquipment.has(id));renderLibrary();}
function sessAvail(sess){return(sess.equip||[]).every(e=>activeEquipment.has(e));}

// LIBRARY
let currentCat='gu';

function sessionVisibleToUser(sess){
  // Standard sessions in data.js are always visible; only explicitly inactive sessions
  // (active === false) are hidden from non-coaches.
  if(sess.active===false){var role=(window.userProfile&&window.userProfile.role)||'member';return role==='coach';}
  return true;
}

function showCat(cat){
  currentCat=cat;
  const clsMap={gu:'on',td:'on-b',core:'on-g',bw:'on-m',custom:'on-p'};
  ['gu','td','core','bw','custom'].forEach(c=>{document.getElementById('lib-'+c).style.display=c===cat?'flex':'none';const btn=document.getElementById('ct-'+c);if(btn)btn.className='cat-btn'+(c===cat?' '+clsMap[c]:'');});
  if(cat==='custom')renderCustomLib();
}


function renderLibrary(){
  var role=(window.userProfile&&window.userProfile.role)||'member';
  const catMap={gu:'GU',td:'TD',core:'CORE',bw:'BW'};
  Object.entries(catMap).forEach(([key,catId])=>{
    const cont=document.getElementById('lib-'+key);if(!cont)return;
    const meta=CAT_META[catId];
    cont.innerHTML=SESSIONS.filter(s=>s.cat===catId&&sessionVisibleToUser(s)).map(sess=>{
      const avail=sessAvail(sess);
      const exRows=sess.exercises.map((ex,ei)=>{
        var scheme=ex.scheme||(ex.sets+'×'+ex.reps);
        var hasAlts=ex.alts&&ex.alts.length>0;
        var swapBtn=hasAlts?'<button class="sw-pill '+(sess._swaps&&sess._swaps[ei]?'on':'')+'" id="sb-'+sess.id+'-'+ei+'" onclick="event.stopPropagation();openSwap(\''+sess.id+'\','+ei+')">'+(sess._swaps&&sess._swaps[ei]?'SWAPPED':'SWAP')+'</button>':'';
        return '<div class="ex-row"><div style="flex:1"><div class="ex-nm" id="pn-'+sess.id+'-'+ei+'">'+ex.name+'</div>'+(ex.note?'<div class="ex-nt">'+ex.note+'</div>':'')+'</div><div class="ex-rt"><span class="ex-sc">'+scheme+'</span>'+swapBtn+'</div></div>';
      }).join('');
      var dname=getSessName(sess.id)||sess.name;
      var inactiveBadge=sess.active===false&&role==='coach'?'<span style="font-size:9px;font-weight:700;letter-spacing:1px;background:var(--border);color:var(--dim);padding:2px 6px;border-radius:10px;margin-left:6px">INACTIVE</span>':'';
      var opacity=sess.active===false&&role==='coach'?'opacity:0.5;':'';
      var finisherHtml=sess.finisher?'<div class="fin-strip"><div class="fin-lbl">Finisher</div><div class="fin-txt">'+sess.finisher+'</div></div>':'';
      return '<div class="sc '+(avail?'':'na')+'" id="sc-'+sess.id+'" style="'+opacity+'"><div class="sc-hd" onclick="toggleSC(\''+sess.id+'\')"><div><div class="sc-nm" style="color:'+meta.color+'">'+dname+inactiveBadge+'</div><div class="sc-sb">'+(sess.sub||sess.description||'')+'</div></div><div style="display:flex;align-items:center;gap:8px"><div class="dot '+(avail?'dot-on':'dot-off')+'"></div><span id="chev-'+sess.id+'" style="color:var(--dim);font-size:12px;transition:transform 0.25s">▾</span></div></div><div class="sc-bd" id="scb-'+sess.id+'"><div class="sc-in">'+exRows+finisherHtml+'<button class="abtn '+meta.abtn+' abtn-xl" onclick="useSession(\''+sess.id+'\')" style="margin-top:16px">LET\'S WORK</button></div></div></div>';
    }).join('');
  });
  renderSgptSection();
  renderPt121Section();
  renderAssignedSessions();
}

var LOCK_SVG='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
var CHEV_SVG='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';

function buildLockedSection(label,tier,heading,body,url){
  var safeUrl=url?url.replace(/"/g,'&quot;'):'https://8roundsboxing.com';
  return '<div class="tier-section-head tier-section-locked"><span>'+label+'</span>'+LOCK_SVG+'</div>'
    +'<div style="padding:0 16px 16px">'
      +'<div class="tier-locked-card" id="locked-card-'+tier+'" onclick="toggleTierTeaser(\''+tier+'\')"><span>Tap to learn more</span>'+CHEV_SVG+'</div>'
      +'<div class="tier-teaser-panel" id="teaser-'+tier+'" style="display:none">'
        +'<div class="tier-teaser-heading">'+heading+'</div>'
        +'<div class="tier-teaser-body">'+body+'</div>'
        +'<div class="tier-teaser-link">Speak to Darren at the gym or <a href="'+safeUrl+'" target="_blank" rel="noopener noreferrer">visit our website &#8594;</a></div>'
      +'</div>'
    +'</div>';
}

function toggleTierTeaser(tier){
  var panel=document.getElementById('teaser-'+tier);
  var card=document.getElementById('locked-card-'+tier);
  if(!panel)return;
  var isOpen=panel.style.display==='block';
  ['sgpt','pt121'].forEach(function(t){
    var p=document.getElementById('teaser-'+t);
    var c=document.getElementById('locked-card-'+t);
    if(p)p.style.display='none';
    if(c)c.classList.remove('open');
  });
  if(!isOpen){
    panel.style.display='block';
    if(card)card.classList.add('open');
  }
}

function buildProgCards(sessions,startFn){
  if(!sessions.length){
    return '<div class="tier-empty">Your coach is setting up your programme.</div>';
  }
  return sessions.map(function(sess){
    var n=(sess.exercises||[]).length;
    var fid=sess._firestoreId||'';
    return '<div class="prog-card" id="prog-'+fid+'">'
      +'<div style="flex:1;min-width:0">'
        +'<div style="font-family:\'Bebas Neue\',sans-serif;font-size:24px;color:var(--text);line-height:1.1">'+sanitiseTrainStr(sess.name)+'</div>'
        +'<div style="font-family:\'DM Sans\',sans-serif;font-size:13px;color:var(--muted);margin-top:2px">'+n+(n===1?' exercise':' exercises')+'</div>'
      +'</div>'
      +'<button class="prog-start-btn" onclick="'+startFn+'(\''+fid+'\')">START</button>'
    +'</div>';
  }).join('');
}

function toggleSectionCollapse(section){
  var body=document.getElementById(section+'-section-body');
  var chev=document.getElementById(section+'-collapse-chev');
  if(!body)return;
  var isOpen=body.style.display!=='none';
  body.style.display=isOpen?'none':'';
  if(chev)chev.style.transform=isOpen?'rotate(-90deg)':'';
}
window.toggleSectionCollapse=toggleSectionCollapse;

function toggleFreeTrainSection(){
  var body=document.getElementById('free-train-body');
  var chev=document.getElementById('free-train-chev');
  if(!body)return;
  var isOpen=body.style.display!=='none';
  body.style.display=isOpen?'none':'';
  if(chev)chev.style.transform=isOpen?'rotate(-90deg)':'';
}
window.toggleFreeTrainSection=toggleFreeTrainSection;

function renderSgptSection(){
  var area=document.getElementById('sgpt-section');
  if(!area)return;
  var role=(window.userProfile&&window.userProfile.role)||'member';
  var isSgpt=!!(window.userProfile&&window.userProfile.sgpt===true);
  var isCoach=role==='coach';
  if(!isCoach&&!isSgpt){
    var panels=userDataCache.lockedPanels;
    var sp=(panels&&panels.sgpt)?panels.sgpt:{};
    var heading=sanitiseTrainStr(sp.heading||'Small Group Personal Training');
    var body=sanitiseTrainStr(sp.body||'Small Group PT is coached strength and conditioning in a small group setting — programming written for you, the same group week to week.');
    var url=sp.url||'https://8roundsboxing.com';
    area.innerHTML=buildLockedSection('SGPT','sgpt',heading,body,url);
    return;
  }
  var cardsHtml=buildProgCards(userDataCache.sgptSessions||[],'useSgptSession');
  area.innerHTML='<div class="tier-section-head" onclick="toggleSectionCollapse(\'sgpt\')" role="button" style="cursor:pointer;justify-content:space-between">'
    +'<span>YOUR SGPT PROGRAMME</span>'
    +'<span id="sgpt-collapse-chev" style="font-size:12px;color:var(--dim);transition:transform 0.25s">&#9662;</span>'
    +'</div>'
    +'<div id="sgpt-section-body">'
    +'<div style="padding:0 16px 8px">'+cardsHtml+'</div>'
    +'</div>';
}

function renderPt121Section(){
  var area=document.getElementById('pt121-section');
  if(!area)return;
  var role=(window.userProfile&&window.userProfile.role)||'member';
  var isPt121=!!(window.userProfile&&window.userProfile.pt121===true);
  var isCoach=role==='coach';
  if(!isCoach&&!isPt121){
    var panels=userDataCache.lockedPanels;
    var pp=(panels&&panels.pt121)?panels.pt121:{};
    var heading=sanitiseTrainStr(pp.heading||'1-2-1 Personal Training');
    var body=sanitiseTrainStr(pp.body||'1-2-1 Personal Training is one-on-one coaching with Darren — your own programme, your own pace, fully tailored.');
    var url=pp.url||'https://8roundsboxing.com';
    area.innerHTML=buildLockedSection('1-2-1 PT','pt121',heading,body,url);
    return;
  }
  var cardsHtml=buildProgCards(userDataCache.pt121Sessions||[],'usePt121Session');
  area.innerHTML='<div class="tier-section-head" onclick="toggleSectionCollapse(\'pt121\')" role="button" style="cursor:pointer;justify-content:space-between">'
    +'<span>YOUR 1-2-1 PROGRAMME</span>'
    +'<span id="pt121-collapse-chev" style="font-size:12px;color:var(--dim);transition:transform 0.25s">&#9662;</span>'
    +'</div>'
    +'<div id="pt121-section-body">'
    +'<div style="padding:0 16px 8px">'+cardsHtml+'</div>'
    +'</div>';
}

function useSgptSession(firestoreId){
  try {
    if(!firestoreId){
      console.error('[8RB SGPT] useSgptSession called with empty firestoreId');
      toast('Session ID missing — please refresh',true);
      return;
    }
    var all=userDataCache.sgptSessions||[];
    console.log('[8RB SGPT] useSgptSession id='+firestoreId+' cache='+all.length);
    var sess=all.find(function(s){return s._firestoreId===firestoreId;});
    if(!sess){
      var ids=all.map(function(s){return s._firestoreId||'NONE';}).join(',');
      console.error('[8RB SGPT] Session not found. id='+firestoreId+' available=['+ids+']');
      toast('Session not found — please refresh',true);
      return;
    }
    window.activeLogSession={
      id:firestoreId,
      cat:'SGPT',
      name:sess.name,
      custom:false,
      warmup:[],
      exercises:(sess.exercises||[]).map(function(ex){
        return Object.assign({},ex,{scheme:ex.scheme||(ex.sets+'×'+ex.reps),displayName:ex.displayName||ex.name,swapped:false});
      })
    };
    sv('activeLogSession',window.activeLogSession);
    restTimers={};sessionStartTime=null;setTypeState={};clearInterval(durInterval);
    showLogView();
  } catch(err) {
    console.error('[8RB SGPT] useSgptSession failed:',err);
    toast('Failed to start: '+(err.message||'unknown error'),true);
  }
}
window.useSgptSession=useSgptSession;

function usePt121Session(firestoreId){
  try {
    if(!firestoreId){
      console.error('[8RB PT121] usePt121Session called with empty firestoreId');
      toast('Session ID missing — please refresh',true);
      return;
    }
    var all=userDataCache.pt121Sessions||[];
    console.log('[8RB PT121] usePt121Session id='+firestoreId+' cache='+all.length);
    var sess=all.find(function(s){return s._firestoreId===firestoreId;});
    if(!sess){
      var ids=all.map(function(s){return s._firestoreId||'NONE';}).join(',');
      console.error('[8RB PT121] Session not found. id='+firestoreId+' available=['+ids+']');
      toast('Session not found — please refresh',true);
      return;
    }
    window.activeLogSession={
      id:firestoreId,
      cat:'SGPT',
      name:sess.name,
      custom:false,
      warmup:[],
      exercises:(sess.exercises||[]).map(function(ex){
        return Object.assign({},ex,{scheme:ex.scheme||(ex.sets+'×'+ex.reps),displayName:ex.displayName||ex.name,swapped:false});
      })
    };
    sv('activeLogSession',window.activeLogSession);
    restTimers={};sessionStartTime=null;setTypeState={};clearInterval(durInterval);
    showLogView();
  } catch(err){
    console.error('[8RB PT121] usePt121Session failed:',err);
    toast('Failed to start: '+(err.message||'unknown error'),true);
  }
}
window.usePt121Session=usePt121Session;

export function resetTrainState() {
  Object.keys(restTimers).forEach(function(k){clearInterval(restTimers[k].interval);});
  restTimers={};setTypeState={};
  window.activeLogSession=null;
  sv('activeLogSession',null);
  sv('logAutosave',null);
}
window.resetTrainState=resetTrainState;

function renderAssignedSessions(){
  var area=document.getElementById('assigned-sessions-area');
  if(area)area.innerHTML='';
}
function toggleSC(id){const b=document.getElementById('scb-'+id),c=document.getElementById('chev-'+id);const o=b.classList.toggle('open');if(c)c.style.transform=o?'rotate(180deg)':'';}
function renderCustomLib(){
  const customs=ld('customSessions',[]),cont=document.getElementById('custom-cards'),empty=document.getElementById('custom-empty');
  if(!customs.length){empty.style.display='block';cont.innerHTML='';return;}
  empty.style.display='none';
  cont.innerHTML=customs.map((sess,idx)=>{const meta=CAT_META[sess.cat]||CAT_META.CUSTOM;const rows=(sess.exercises||[]).map(ex=>`<div class="ex-row"><div class="ex-nm">${ex.name}</div><div class="ex-rt"><span class="ex-sc">${ex.sets||''}${ex.sets&&ex.reps?' × ':''}${ex.reps||''}</span></div></div>`).join('');return `<div class="sc" id="csc-${idx}"><div class="sc-hd" onclick="toggleSC('csc-${idx}')"><div><div class="sc-nm" style="color:${meta.color}">${sess.name}</div><div class="sc-sb">${meta.label}</div></div><span id="chev-csc-${idx}" style="color:var(--dim);font-size:12px;transition:transform 0.25s">▾</span></div><div class="sc-bd" id="scb-csc-${idx}"><div class="sc-in">${rows||'<div class="empty">No exercises.</div>'}${sess.finisher?`<div class="fin-strip"><div class="fin-lbl">Finisher</div><div class="fin-txt">${sess.finisher}</div></div>`:''}<button class="abtn ab-p abtn-xl" onclick="useCustomSession(${idx})" style="margin-top:16px">LET'S WORK</button><div style="display:flex;gap:8px;margin-top:8px"><button class="pill" onclick="editCustom(${idx})">EDIT</button><button class="pill" onclick="delCustom(${idx})" style="color:var(--red)">DELETE</button></div></div></div></div>`;}).join('');
}

// SWAP
function openSwap(sessId,exIdx){const sess=SESSIONS.find(s=>s.id===sessId);if(!sess)return;const ex=sess.exercises[exIdx];swapState={sessId,exIdx,selected:ex.name};document.getElementById('swap-ttl').textContent=ex.name;const opts=[{name:ex.name,reason:'Keep the original.'},...ex.alts];document.getElementById('swap-opts').innerHTML=opts.map((a,i)=>`<div class="alt-opt ${i===0?'sel':''}" id="ao-${i}" onclick="selAlt(${i},'${a.name.replace(/'/g,"\\'")}')"><div class="alt-nm">${i===0?'✓ '+a.name+' (original)':a.name}</div><div class="alt-rs">${a.reason}</div></div>`).join('');openOverlay('swap-modal');}
function selAlt(i,name){document.querySelectorAll('.alt-opt').forEach((el,j)=>el.classList.toggle('sel',j===i));swapState.selected=name;}
function confirmSwap(){const{sessId,exIdx,selected}=swapState;const sess=SESSIONS.find(s=>s.id===sessId);if(!sess||!selected)return;const orig=sess.exercises[exIdx].name;const isOrig=selected===orig;if(!sess._swaps)sess._swaps={};isOrig?delete sess._swaps[exIdx]:sess._swaps[exIdx]=selected;const n=document.getElementById(`pn-${sessId}-${exIdx}`);if(n)n.textContent=selected;const sb=document.getElementById(`sb-${sessId}-${exIdx}`);if(sb){sb.classList.toggle('on',!isOrig);sb.textContent=isOrig?'SWAP':'SWAPPED';}closeOverlay('swap-modal');toast('Exercise updated');}

function sanitiseTrainStr(str){if(typeof str!=='string')return '';return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

// USE SESSION
function useSession(sessId){const sess=SESSIONS.find(s=>s.id===sessId);if(!sess)return;window.activeLogSession={id:sess.id,cat:sess.cat,name:sess.name||getSessName(sess.id),custom:false,warmup:sess.warmup||[],exercises:sess.exercises.map((ex,i)=>({...ex,scheme:ex.scheme||(ex.sets+'×'+ex.reps),displayName:(sess._swaps&&sess._swaps[i])?sess._swaps[i]:(ex.displayName||ex.name),swapped:!!(sess._swaps&&sess._swaps[i])}))};sv('activeLogSession',window.activeLogSession);restTimers={};sessionStartTime=null;setTypeState={};clearInterval(durInterval);showLogView();}

function startAssignedSession(firestoreId){
  try {
    if(!firestoreId){
      console.error('[8RB ASSIGN] startAssignedSession called with empty firestoreId');
      toast('Assignment ID missing — please refresh',true);
      return;
    }
    var all=userDataCache.assignedSessions||[];
    console.log('[8RB ASSIGN] startAssignedSession id='+firestoreId+' cache='+all.length);
    var s=all.find(function(a){return a._firestoreId===firestoreId;});
    if(!s){
      var ids=all.map(function(a){return a._firestoreId||'NONE';}).join(',');
      console.error('[8RB ASSIGN] Assignment not found. id='+firestoreId+' available=['+ids+']');
      toast('Assigned session not found — please refresh',true);
      return;
    }
    if(!s.sessionData){
      console.error('[8RB ASSIGN] sessionData missing. id='+firestoreId+' keys=['+Object.keys(s).join(',')+']');
      toast('Session data missing — contact your coach',true);
      return;
    }
    window.activeAssignedSessionId=firestoreId;
    var sd=s.sessionData;
    window.activeLogSession={
      id:sd.id||'assigned-'+firestoreId,
      cat:sd.cat||'SGPT',
      name:s.sessionName||sd.name||'Assigned Session',
      custom:false,
      warmup:sd.warmup||[],
      exercises:(sd.exercises||[]).map(function(ex){
        return Object.assign({},ex,{
          scheme:ex.scheme||(ex.sets+'×'+ex.reps),
          displayName:ex.displayName||ex.name,
          swapped:false
        });
      })
    };
    sv('activeLogSession',window.activeLogSession);
    restTimers={};sessionStartTime=null;setTypeState={};clearInterval(durInterval);
    showLogView();
  } catch(err) {
    console.error('[8RB ASSIGN] startAssignedSession failed:',err);
    toast('Failed to start: '+(err.message||'unknown error'),true);
  }
}
function useCustomSession(idx){const customs=ld('customSessions',[]),sess=customs[idx];if(!sess)return;window.activeLogSession={id:'custom-'+idx,cat:sess.cat,name:sess.name,custom:true,warmup:[],exercises:(sess.exercises||[]).map(ex=>({...ex,displayName:ex.name,swapped:false}))};sv('activeLogSession',window.activeLogSession);restTimers={};sessionStartTime=null;setTypeState={};clearInterval(durInterval);showLogView();toast('Session loaded');}
function showLogView(){document.getElementById('train-lib').style.display='none';document.getElementById('train-log').style.display='block';const meta=CAT_META[activeLogSession.cat]||CAT_META.CUSTOM;document.getElementById('log-eye').textContent=meta.label;document.getElementById('log-eye').style.color=meta.color;document.getElementById('log-title').textContent=activeLogSession.name;buildLogForm();renderWarmup();restoreAutosave();renderHistory();}
function showLibraryView(){document.getElementById('train-lib').style.display='block';document.getElementById('train-log').style.display='none';renderAssignedSessions();}
function confirmClearSess(){if(!confirm('Change session? Unsaved data will be lost.'))return;clearActiveSession();}
function clearActiveSession(){window.activeLogSession=null;sv('activeLogSession',null);extraCount=0;restTimers={};setTypeState={};clearInterval(durInterval);sessionStartTime=null;sv('logAutosave',null);showLibraryView();}


// WARMUP
function renderWarmup(){const area=document.getElementById('warmup-area');if(!activeLogSession?.warmup?.length){area.innerHTML='';return;}const steps=activeLogSession.warmup;wuState={running:false,stepIdx:0,secsLeft:steps[0].secs,interval:null};area.innerHTML=`<div class="wu-card"><div class="wu-hd" onclick="toggleWarmup()"><div class="wu-lbl">⏱ WARM-UP</div><span style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--dim)">MORE ▾</span></div><div class="wu-bd" id="wu-bd"><div class="wu-in"><div id="wu-steps">${steps.map((s,i)=>`<div class="wu-row ${i===0?'act':''}" id="wu-step-${i}"><span>${s.name}</span><span>${fmtSecs(s.secs)}</span></div>`).join('')}</div><div class="wu-ctrl"><div class="wu-time" id="wu-cd">${fmtSecs(steps[0].secs)}</div><button class="wu-btn wu-go" id="wu-btn" onclick="toggleWarmupTimer()">START</button><button class="wu-btn wu-sk" onclick="skipWuStep()">SKIP</button></div></div></div></div>`;}
function toggleWarmup(){document.getElementById('wu-bd')?.classList.toggle('open');}
function toggleWarmupTimer(){if(wuState.running){clearInterval(wuState.interval);wuState.running=false;document.getElementById('wu-btn').textContent='RESUME';}else{wuState.running=true;document.getElementById('wu-btn').textContent='PAUSE';wuState.interval=setInterval(()=>{wuState.secsLeft--;const cd=document.getElementById('wu-cd');if(cd)cd.textContent=fmtSecs(wuState.secsLeft);if(wuState.secsLeft<=0)advanceWuStep();},1000);}}
function advanceWuStep(){const steps=activeLogSession.warmup;const el=document.getElementById('wu-step-'+wuState.stepIdx);if(el){el.classList.remove('act');el.classList.add('dn');}wuState.stepIdx++;if(wuState.stepIdx>=steps.length){clearInterval(wuState.interval);wuState.running=false;const cd=document.getElementById('wu-cd');if(cd)cd.textContent='DONE';const btn=document.getElementById('wu-btn');if(btn){btn.textContent='DONE';btn.style.background='var(--green)';}playRestDone();toast('Warm-up complete!');return;}const next=document.getElementById('wu-step-'+wuState.stepIdx);if(next)next.classList.add('act');wuState.secsLeft=steps[wuState.stepIdx].secs;const cd=document.getElementById('wu-cd');if(cd)cd.textContent=fmtSecs(wuState.secsLeft);playRestDone();}
function skipWuStep(){clearInterval(wuState.interval);wuState.running=false;advanceWuStep();const btn=document.getElementById('wu-btn');if(btn&&wuState.stepIdx<(activeLogSession.warmup||[]).length)btn.textContent='START';}

// LOG FORM
const DEFAULT_REST_KEY='globalRestSecs';
function getGlobalRest(){return ld(DEFAULT_REST_KEY,60);}
function setGlobalRest(s){sv(DEFAULT_REST_KEY,s);document.getElementById('global-rest-lbl').textContent=fmtSecs(s);}
function editGlobalRest(){var opts=[30,45,60,90,120,180];var cur=getGlobalRest();var menu=opts.map(function(o){var active=o===cur;var bdr='1px solid '+(active?'var(--blue)':'var(--border)');var bg=active?'rgba(69,123,157,0.15)':'none';var col=active?'var(--blue)':'var(--muted)';var onclick='setGlobalRest('+o+');closeOverlay(\'rest-pick-modal\')';return '<button onclick="'+onclick+'" style="flex:1;padding:13px;font-size:18px;letter-spacing:2px;border:'+bdr+';border-radius:6px;background:'+bg+';color:'+col+';cursor:pointer">'+fmtSecs(o)+'</button>';}).join('');document.getElementById('rest-pick-content').innerHTML='<div style="display:flex;flex-wrap:wrap;gap:8px">'+menu+'</div>';openOverlay('rest-pick-modal');}
function initGlobalRestLbl(){const el=document.getElementById('global-rest-lbl');if(el)el.textContent=fmtSecs(getGlobalRest());}

function buildLogForm(){
  if(!activeLogSession)return;
  var meta=CAT_META[activeLogSession.cat]||CAT_META.CUSTOM;
  initGlobalRestLbl();
  var html='';
  activeLogSession.exercises.forEach(function(ex,ei){
    var prev=getPrevWt(ex.displayName)||getPrevWt(ex.name);
    var suggestedKg=prev?+(prev.kg+2.5).toFixed(1):null;
    var prevHtml='';
    if(prev){
      var skg=suggestedKg||0;
      prevHtml='<div class="prev-bar"><span>Last: '+fmtWt(prev.kg)+(prev.reps?' × '+prev.reps:'')+' — '+fmtDate(prev.date)+'</span><span class="prev-up" onclick="fillSuggestedKg('+ei+','+skg+')">↑ '+fmtWt(skg)+' fill</span></div>';
    }
    var st=setTypeState[ei]||'standard';
    var restSecs=(activeLogSession.exercises[ei]._restOverride)||getGlobalRest();
    var typeBtns=['standard','superset','amrap','ladder','pyramid'].map(function(t){
      return '<button class="stp '+(st===t?'on':'')+'" onclick="setSetType('+ei+',\''+t+'\')">'+t.charAt(0).toUpperCase()+t.slice(1)+'</button>';
    }).join('');
    var typeBtnLabel=st==='standard'?'TYPE':st.toUpperCase();
    var typeActive=st!=='standard'?' active':'';
    var swappedBadge=ex.swapped?'<span class="lex-bdg" style="margin-left:8px">Swapped</span>':'';
    var setContent=buildSetContent(ei,ex,meta.color,st,suggestedKg,restSecs);
    var isOpen=ei===0;
    var exLib=EXERCISE_LIBRARY.find(function(e){return e.name===ex.displayName;})||EXERCISE_LIBRARY.find(function(e){return e.name===ex.name;});
    var refBtn=exLib&&exLib.ref?'<button class="lex-ref-btn" id="lex-ref-'+ei+'" onclick="event.stopPropagation();openExRef('+ei+')" aria-label="Technique reference for '+ex.displayName+'">?</button>':'';
    html+='<div class="lex'+(isOpen?' open':'')+'" id="lex-'+ei+'">'
      +'<div class="lex-hd" onclick="toggleExercise('+ei+')">'
        +'<div style="flex:1;min-width:0">'
          +'<div class="lex-nm">'+ex.displayName+swappedBadge+'</div>'
          +'<div class="lex-scheme">'+ex.scheme+'</div>'
        +'</div>'
        +refBtn
        +'<button class="lex-type-btn'+typeActive+'" id="type-btn-'+ei+'" onclick="event.stopPropagation();toggleTypePicker('+ei+')">'+typeBtnLabel+'</button>'
        +'<span class="lex-chevron">&#8964;</span>'
      +'</div>'
      +'<div class="lex-body" id="lex-body-'+ei+'" style="display:'+(isOpen?'block':'none')+'">'
        +'<div class="stype-picker" id="stype-'+ei+'" style="display:none">'+typeBtns+'</div>'
        +prevHtml
        +'<div id="set-content-'+ei+'">'+setContent+'</div>'
      +'</div>'
    +'</div>';
  });
  document.getElementById('log-exercises').innerHTML=html;
  document.getElementById('extras-list').innerHTML='';
  document.getElementById('session-notes').value='';
  extraCount=0;
}

function toggleTypePicker(ei){const p=document.getElementById('stype-'+ei);p.style.display=p.style.display==='none'?'flex':'none';}
function toggleExercise(ei){if(!activeLogSession)return;var isOpen=document.getElementById('lex-body-'+ei).style.display!=='none';activeLogSession.exercises.forEach(function(_,i){var body=document.getElementById('lex-body-'+i);var card=document.getElementById('lex-'+i);if(body){body.style.display='none';if(card)card.classList.remove('open');}});if(!isOpen){var body=document.getElementById('lex-body-'+ei);var card=document.getElementById('lex-'+ei);if(body){body.style.display='block';if(card)card.classList.add('open');}}}
function setSetType(ei,type){
  setTypeState[ei]=type;
  if(!activeLogSession)return;
  const ex=activeLogSession.exercises[ei];
  const meta=CAT_META[activeLogSession.cat]||CAT_META.CUSTOM;
  const prev=getPrevWt(ex.displayName)||getPrevWt(ex.name);
  const suggestedKg=prev?+(prev.kg+2.5).toFixed(1):null;
  const restSecs=activeLogSession.exercises[ei]._restOverride||getGlobalRest();
  document.querySelectorAll(`#stype-${ei} .stp`).forEach(btn=>btn.classList.toggle('on',btn.textContent.toLowerCase()===type));
  const typeBtn=document.getElementById('type-btn-'+ei);
  if(typeBtn){typeBtn.textContent=type==='standard'?'TYPE':type.toUpperCase();typeBtn.classList.toggle('active',type!=='standard');}
  const cont=document.getElementById('set-content-'+ei);
  if(cont)cont.innerHTML=buildSetContent(ei,ex,meta.color,type,suggestedKg,restSecs);
  document.getElementById('stype-'+ei).style.display='none';
}
function buildSetContent(ei,ex,color,type,suggestedKg,restSecs){
  const rs=restSecs||getGlobalRest();
  if(type==='amrap')return '<div class="amrap-blk">'
    +'<div class="amrap-row"><span class="amrap-lbl">Duration</span><div style="display:flex;align-items:center;gap:4px"><input class="amrap-inp" type="number" placeholder="6" id="amrap-mins-'+ei+'" min="1" max="30"><span class="amrap-unit">min</span></div></div>'
    +'<div class="amrap-row"><span class="amrap-lbl">Weight</span><div style="display:flex;align-items:center;gap:4px"><input class="amrap-inp" type="number" placeholder="—" id="amrap-kg-'+ei+'" min="0" step="2.5"><span class="amrap-unit">'+getUnit()+'</span></div></div>'
    +'<div class="amrap-row"><span class="amrap-lbl">Rounds completed</span><div style="display:flex;align-items:center;gap:4px"><input class="amrap-inp" type="number" placeholder="0" id="amrap-score-'+ei+'" min="0" step="0.5"><span class="amrap-unit"></span></div></div>'
    +'</div>';
  if(type==='superset'){
    var ssPartner='<div class="ss-partner">'
      +'<div class="ss-partner-lbl">SUPERSET WITH</div>'
      +'<input class="ss-name-inp" type="text" placeholder="Partner exercise name..." id="ss-name-'+ei+'">'
      +'<div class="col-row"><div class="col-h">#</div><div class="col-h">'+getUnit()+'</div><div class="col-h">REPS</div><div class="col-h"></div></div>'
      +'<div class="set-rows" id="ssr-'+ei+'">'+makeSupersetRow(ei,0)+'</div>'
      +'<button class="add-set" onclick="addSupersetRow('+ei+')">＋ Add set</button>'
    +'</div>';
    return makeSetGrid(ei,ex,color,suggestedKg,rs)+ssPartner;
  }
  if(type==='pyramid')return `<div class="pyr-note">Pyramid: increase weight each set, decrease reps.</div>${makeSetGrid(ei,ex,color,suggestedKg,rs)}`;
  if(type==='ladder')return `<div class="pyr-note">Ladder: 1 rep, 2 reps, 3... up to target, back down.</div>${makeSetGrid(ei,ex,color,suggestedKg,rs)}`;
  return makeSetGrid(ei,ex,color,suggestedKg,rs);
}
function parseTargetSets(scheme){
  if(!scheme)return 3;
  var m=scheme.match(/^(\d+)/);
  return m?Math.max(1,parseInt(m[1])):3;
}
function changeSets(ei,delta){
  var cont=document.getElementById('sr-'+ei);
  var valEl=document.getElementById('sets-val-'+ei);
  if(!cont||!valEl)return;
  var current=cont.querySelectorAll('.set-row').length;
  if(delta<0&&current<=1)return;
  if(delta>0){
    var ex=activeLogSession&&activeLogSession.exercises[ei];
    var meta=CAT_META[(activeLogSession&&activeLogSession.cat)]||CAT_META.CUSTOM;
    var prev=ex?(getPrevWt(ex.displayName)||getPrevWt(ex.name)):null;
    var suggestedKg=prev?+(prev.kg+2.5).toFixed(1):null;
    var d=document.createElement('div');
    d.innerHTML=makeSetRow(ei,current,true,meta.color,suggestedKg);
    cont.appendChild(d.firstElementChild);
  } else {
    var rows=cont.querySelectorAll('.set-row');
    rows[rows.length-1].remove();
  }
  valEl.textContent=cont.querySelectorAll('.set-row').length;
  autosaveLog();
}
function makeSetGrid(ei,ex,color,suggestedKg,restSecs){
  var rs=restSecs||getGlobalRest();
  var target=parseTargetSets(ex.scheme);
  var rows='';
  for(var i=0;i<target;i++){rows+=makeSetRow(ei,i,i>0,color,suggestedKg);}
  return '<div class="sets-stepper">'
    +'<span class="sets-stepper-lbl">SETS</span>'
    +'<div style="display:flex;align-items:center;gap:16px">'
    +'<button class="sets-stepper-btn" onclick="changeSets('+ei+',-1)">−</button>'
    +'<span class="sets-stepper-val" id="sets-val-'+ei+'">'+target+'</span>'
    +'<button class="sets-stepper-btn" onclick="changeSets('+ei+',1)">+</button>'
    +'</div>'
    +'</div>'
    +'<div class="col-row"><div class="col-h">#</div><div class="col-h">'+getUnit()+'</div><div class="col-h">REPS</div><div class="col-h"></div></div>'
    +'<div class="set-rows" id="sr-'+ei+'">'+rows+'</div>'
    +'<div class="rest-inline" id="rest-inline-'+ei+'"><div class="rest-left"><button class="rest-pill" id="rb-'+ei+'" onclick="startRest('+ei+','+rs+')">'+fmtSecs(rs)+'</button><span class="rest-cd" id="rcd-'+ei+'" style="display:none"></span></div><span class="rest-edit" onclick="editExRest('+ei+')">override</span></div>'
    +'<button class="add-set" onclick="addSetRow('+ei+',\''+color+'\','+( suggestedKg||0)+')">＋ Add set</button>';
}
function makeSetRow(ei,si,del,col,prefill){
  var kg=prefill||'';
  return '<div class="set-row" id="row-'+ei+'-'+si+'">'
    +'<span class="set-n" style="color:'+(col||'var(--dim)')+'">'+( si+1)+'</span>'
    +'<input class="si" type="text" inputmode="none" placeholder="—" id="kv-'+ei+'-'+si+'" value="'+kg+'" readonly onclick="openNumpad(this,\'kg\','+ei+','+si+')">'
    +'<input class="si" type="text" inputmode="none" placeholder="—" id="rv-'+ei+'-'+si+'" readonly onclick="openNumpad(this,\'reps\','+ei+','+si+')">'
    +'<button class="set-check" id="sc-'+ei+'-'+si+'" onclick="completeSet('+ei+','+si+')">'
    +'<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>'
    +'</button>'
  +'</div>';
}
function completeSet(ei,si){
  const btn=document.getElementById(`sc-${ei}-${si}`);
  const kInput=document.getElementById(`kv-${ei}-${si}`);
  const rInput=document.getElementById(`rv-${ei}-${si}`);
  if(!btn)return;
  const wasDone=btn.classList.contains('done');
  btn.classList.toggle('done',!wasDone);
  if(kInput)kInput.classList.toggle('done-input',!wasDone);
  if(rInput)rInput.classList.toggle('done-input',!wasDone);
  if(!wasDone){
    startDurTracker();
    autosaveLog();
    const ex=activeLogSession?.exercises[ei];
    const rs=(ex&&ex._restOverride)||getGlobalRest();
    startRest(ei,rs);
  }
}
function fillSuggestedKg(ei,kg){
  const cont=document.getElementById('sr-'+ei);
  if(!cont)return;
  cont.querySelectorAll('.set-row').forEach((_,si)=>{
    const inp=document.getElementById('kv-'+ei+'-'+si);
    if(inp&&!inp.value)inp.value=kg;
  });
  autosaveLog();
  toast('Weight filled — adjust if needed');
}
function editExRest(ei){const opts=[30,45,60,90,120,180];const exRest=activeLogSession&&activeLogSession.exercises[ei]&&activeLogSession.exercises[ei]._restOverride;const cur=exRest||getGlobalRest();const menu=opts.map(function(o){const active=o===cur;const bdr='1px solid '+(active?'var(--blue)':'var(--border)');const bg=active?'rgba(69,123,157,0.15)':'none';const col=active?'var(--blue)':'var(--muted)';return '<button onclick="setExRest('+ei+','+o+');closeOverlay(\'rest-pick-modal\')" style="flex:1;padding:13px;font-size:18px;letter-spacing:2px;border:'+bdr+';border-radius:6px;background:'+bg+';color:'+col+';cursor:pointer">'+fmtSecs(o)+'</button>';}).join('');document.getElementById('rest-pick-content').innerHTML='<div style="font-size:12px;color:var(--dim);margin-bottom:10px">Override rest for this exercise</div><div style="display:flex;flex-wrap:wrap;gap:8px">'+menu+'</div>';openOverlay('rest-pick-modal');}
function setExRest(ei,secs){
  if(!activeLogSession?.exercises[ei])return;
  activeLogSession.exercises[ei]._restOverride=secs;
  const btn=document.getElementById('rb-'+ei);
  if(btn)btn.textContent=fmtSecs(secs);
  toast('Rest set to '+fmtSecs(secs));
}
function onSetInput(ei){startDurTracker();autosaveLog();}
function addSetRow(ei,col,prefill){
  const cont=document.getElementById('sr-'+ei);
  if(!cont)return;
  const n=cont.querySelectorAll('.set-row').length;
  const d=document.createElement('div');
  d.innerHTML=makeSetRow(ei,n,true,col,prefill);
  cont.appendChild(d.firstElementChild);
}
function removeRow(rId,cId){document.getElementById(rId)?.remove();document.getElementById(cId)?.querySelectorAll('.set-row').forEach((r,i)=>r.querySelector('.set-n').textContent=i+1);autosaveLog();}
function makeSupersetRow(ei,si){
  return '<div class="set-row" id="ssrow-'+ei+'-'+si+'">'
    +'<span class="set-n">'+(si+1)+'</span>'
    +'<input class="si" type="text" inputmode="none" placeholder="—" id="skv-'+ei+'-'+si+'" value="" readonly onclick="openNumpad(this,\'kg\','+ei+','+si+')">'
    +'<input class="si" type="text" inputmode="none" placeholder="—" id="srv-'+ei+'-'+si+'" readonly onclick="openNumpad(this,\'reps\','+ei+','+si+')">'
    +'<button class="set-check" id="ssc-'+ei+'-'+si+'" onclick="completeSupersetRow('+ei+','+si+')">'
    +'<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>'
    +'</button>'
  +'</div>';
}
function addSupersetRow(ei){
  var cont=document.getElementById('ssr-'+ei);if(!cont)return;
  var n=cont.querySelectorAll('.set-row').length;
  var d=document.createElement('div');d.innerHTML=makeSupersetRow(ei,n);
  cont.appendChild(d.firstElementChild);
}
function completeSupersetRow(ei,si){
  var btn=document.getElementById('ssc-'+ei+'-'+si);
  var kInput=document.getElementById('skv-'+ei+'-'+si);
  var rInput=document.getElementById('srv-'+ei+'-'+si);
  if(!btn)return;
  var wasDone=btn.classList.contains('done');
  btn.classList.toggle('done',!wasDone);
  if(kInput)kInput.classList.toggle('done-input',!wasDone);
  if(rInput)rInput.classList.toggle('done-input',!wasDone);
  if(!wasDone)autosaveLog();
}
function getPrevWt(name){const all=ld('sessions',[]);for(let i=all.length-1;i>=0;i--){const ex=[...(all[i].exercises||[]),...(all[i].extras||[])].find(e=>e.name===name||e.originalName===name);if(ex){const valid=(ex.sets||[]).filter(r=>r.kg&&parseFloat(r.kg)>0);if(valid.length){const maxKg=Math.max(...valid.map(r=>parseFloat(r.kg)));return{kg:maxKg,reps:valid.find(r=>parseFloat(r.kg)===maxKg)?.reps||'',date:all[i].date};}}}return null;}
function startDurTracker(){if(sessionStartTime)return;sessionStartTime=Date.now();durInterval=setInterval(()=>{const e=Math.floor((Date.now()-sessionStartTime)/1000);const el=document.getElementById('dur-display');if(el)el.textContent=`${Math.floor(e/60)}:${(e%60).toString().padStart(2,'0')}`;},1000);}
function autosaveLog(){if(!activeLogSession)return;const data={date:document.getElementById('log-date')?.value||'',notes:document.getElementById('session-notes')?.value||'',sets:{}};activeLogSession.exercises.forEach((ex,ei)=>{const cont=document.getElementById('sr-'+ei);if(!cont)return;data.sets[ei]=[];cont.querySelectorAll('.set-row').forEach((row,si)=>{data.sets[ei].push({k:document.getElementById('kv-'+ei+'-'+si)?.value||'',r:document.getElementById('rv-'+ei+'-'+si)?.value||''});});});sv('logAutosave',data);}
function restoreAutosave(){const data=ld('logAutosave',null);if(!data||!activeLogSession)return;if(data.date){const el=document.getElementById('log-date');if(el)el.value=data.date;}if(data.notes){const el=document.getElementById('session-notes');if(el)el.value=data.notes;}if(data.sets){activeLogSession.exercises.forEach((ex,ei)=>{const saved=data.sets[ei];if(!saved?.length)return;const cont=document.getElementById('sr-'+ei);if(!cont)return;const meta=CAT_META[activeLogSession.cat]||CAT_META.CUSTOM;const prev=getPrevWt(ex.displayName)||getPrevWt(ex.name);const suggestedKg=prev?+(prev.kg+2.5).toFixed(1):null;while(cont.querySelectorAll('.set-row').length<saved.length){const n=cont.querySelectorAll('.set-row').length;const d=document.createElement('div');d.innerHTML=makeSetRow(ei,n,true,meta.color,suggestedKg);cont.appendChild(d.firstElementChild);}saved.forEach((v,si)=>{const k=document.getElementById('kv-'+ei+'-'+si);const r=document.getElementById('rv-'+ei+'-'+si);if(k)k.value=v.k||v.s||'';if(r)r.value=v.r||'';if(v.k||v.r)startDurTracker();});});}}var restFsEi=-1,restFsSecs=0,restFsRem=0,restFsInterval=null;
function startRest(ei,secs){
  Object.keys(restTimers).forEach(function(k){clearInterval(restTimers[k].interval);delete restTimers[k];});
  restFsEi=ei;restFsSecs=secs;restFsRem=secs;
  var nextEl=document.getElementById('rfs-next');
  if(nextEl){
    var isLast=!activeLogSession||ei>=activeLogSession.exercises.length-1;
    var setsCompleted=document.querySelectorAll('#sr-'+ei+' .set-check.done').length>0;
    if(isLast){
      nextEl.textContent='LAST EXERCISE';
    }else if(setsCompleted){
      nextEl.textContent='NEXT: '+activeLogSession.exercises[ei+1].displayName;
    }else{
      nextEl.textContent='';
    }
  }
  var rfs=document.getElementById('rest-fs');
  if(rfs){rfs.classList.add('open');}
  updateRfsCount();
  clearInterval(restFsInterval);
  restFsInterval=setInterval(function(){
    restFsRem--;
    updateRfsCount();
    if(restFsRem<=0){
      clearInterval(restFsInterval);
      closeRestFs();
      playRestDone();
      toast('REST DONE. NEXT SET.');
    }
  },1000);
}
function updateRfsCount(){
  var el=document.getElementById('rfs-count');
  if(el)el.textContent=fmtSecs(Math.max(0,restFsRem));
}
function skipRest(){
  clearInterval(restFsInterval);
  closeRestFs();
}
function closeRestFs(){
  var rfs=document.getElementById('rest-fs');
  if(rfs)rfs.classList.remove('open');
}
function addExtra(){var id=extraCount++;var d=document.createElement('div');d.className='extra-card';d.id='extra-'+id;d.innerHTML='<div class="extra-hd"><input class="extra-inp" type="text" placeholder="Exercise name..." id="en-'+id+'"><button class="sdel" onclick="document.getElementById(\'extra-'+id+'\').remove()">×</button></div><div class="col-row"><div class="col-h">#</div><div class="col-h">'+getUnit()+'</div><div class="col-h">Reps</div><div class="col-h"></div></div><div class="set-rows" id="xsr-'+id+'">'+makeExRow(id,0,false)+'</div><button class="add-set" onclick="addExRow('+id+')">＋ Add set</button>';document.getElementById('extras-list').appendChild(d);}
function makeExRow(id,si,del){var vis=del?'':'visibility:hidden';return '<div class="set-row" id="xrow-'+id+'-'+si+'"><span class="set-n">'+(si+1)+'</span><input class="si" type="number" placeholder="—" min="1" id="xsv-'+id+'-'+si+'"><input class="si" type="number" placeholder="—" min="1" id="xrv-'+id+'-'+si+'"><input class="si" type="number" placeholder="—" min="0" step="0.5" id="xkv-'+id+'-'+si+'"><button class="sdel" style="'+vis+'" onclick="removeRow(\'xrow-'+id+'-'+si+'\',\'xsr-'+id+'\')">×</button></div>';}
function addExRow(id){const cont=document.getElementById('xsr-'+id);const n=cont.querySelectorAll('.set-row').length;const d=document.createElement('div');d.innerHTML=makeExRow(id,n,true);cont.appendChild(d.firstElementChild);}

// SAVE SESSION
async function saveSession(){
  var saveBtn=document.querySelector('.save-wrap button');
  if(saveBtn){saveBtn.disabled=true;saveBtn.textContent='SAVING…';}
  function reEnableBtn(){if(saveBtn){saveBtn.disabled=false;saveBtn.textContent='SAVE SESSION';}}
  const date=document.getElementById('log-date').value;if(!date){toast('Please select a date',true);reEnableBtn();return;}if(!window.activeLogSession){toast('Select a session first',true);reEnableBtn();return;}
  // Duplicate prevention — same session type + date saved within 60 seconds
  if(userDataCache.sessions!==null){
    var dup=userDataCache.sessions.find(function(s){return s.sessId===window.activeLogSession.id&&s.date===date&&(Date.now()-s.id)<60000;});
    if(dup){toast('Session already saved',true);reEnableBtn();return;}
  }
  const duration=sessionStartTime?Math.floor((Date.now()-sessionStartTime)/60000):0;
  const exercises=window.activeLogSession.exercises.map((ex,ei)=>{const st=setTypeState[ei]||'standard';if(st==='amrap'){const mins=document.getElementById('amrap-mins-'+ei)?.value||'';const score=document.getElementById('amrap-score-'+ei)?.value||'';const kg=document.getElementById('amrap-kg-'+ei)?.value||'';return{name:ex.displayName,originalName:ex.name,swapped:ex.swapped,setType:'amrap',amrapMins:mins,amrapScore:score,sets:kg?[{kg,reps:score,sets:''}]:[]};}if(st==='superset'){const cont=document.getElementById('sr-'+ei);const sets=[];if(cont)cont.querySelectorAll('.set-row').forEach((row,si)=>{const k=document.getElementById('kv-'+ei+'-'+si)?.value;const r=document.getElementById('rv-'+ei+'-'+si)?.value;if(k||r)sets.push({sets:'',reps:r||'',kg:k||''});});const ssName=(document.getElementById('ss-name-'+ei)?.value||'').trim();const ssCont=document.getElementById('ssr-'+ei);const ssSets=[];if(ssCont)ssCont.querySelectorAll('.set-row').forEach((row,si)=>{const k=document.getElementById('skv-'+ei+'-'+si)?.value;const r=document.getElementById('srv-'+ei+'-'+si)?.value;if(k||r)ssSets.push({sets:'',reps:r||'',kg:k||''});});return{name:ex.displayName,originalName:ex.name,swapped:ex.swapped,setType:'superset',sets,supersetWith:ssName?{name:ssName,sets:ssSets}:undefined};}const cont=document.getElementById('sr-'+ei);const sets=[];if(cont)cont.querySelectorAll('.set-row').forEach((row,si)=>{const k=document.getElementById('kv-'+ei+'-'+si)?.value;const r=document.getElementById('rv-'+ei+'-'+si)?.value;if(k||r)sets.push({sets:'',reps:r||'',kg:k||''});});return{name:ex.displayName,originalName:ex.name,swapped:ex.swapped,setType:st,sets};});
  const extras=[];document.querySelectorAll('.extra-card').forEach(el=>{const id=el.id.replace('extra-','');const name=(document.getElementById('en-'+id)?.value||'').trim();if(!name)return;const cont=document.getElementById('xsr-'+id);const sets=[];if(cont)cont.querySelectorAll('.set-row').forEach((row,si)=>{const s=document.getElementById('xsv-'+id+'-'+si)?.value;const r=document.getElementById('xrv-'+id+'-'+si)?.value;const k=document.getElementById('xkv-'+id+'-'+si)?.value;if(s||r||k)sets.push({sets:s||'',reps:r||'',kg:k||''});});extras.push({name,sets,extra:true});});
  const notes=document.getElementById('session-notes').value.trim();
  const record={id:Date.now(),date,cat:window.activeLogSession.cat,sessId:window.activeLogSession.id,sessName:window.activeLogSession.name,exercises,extras,notes,duration};
  sv('logAutosave',null);clearInterval(durInterval);sessionStartTime=null;
  // Update in-memory cache first so UI reflects change immediately
  if(userDataCache.sessions!==null){
    userDataCache.sessions=[...userDataCache.sessions,record].sort((a,b)=>a.date.localeCompare(b.date));
    detectPRs(record,userDataCache.sessions);
  } else {
    detectPRs(record,[record]);
  }
  showDone(record);buildLogForm();renderHistory();checkDeload();
  // Write to Firestore in background
  if(window.currentUser){
    try{
      const docRef=await addDoc(collection(db,'users',window.currentUser.uid,'sessions'),Object.assign({},record,{createdAt:serverTimestamp()}));
      const entry=userDataCache.sessions&&userDataCache.sessions.find(function(s){return s.id===record.id;});
      if(entry)entry._firestoreId=docRef.id;
      // Mark assigned session complete if one was active
      if(window.activeAssignedSessionId){
        var assignedId=window.activeAssignedSessionId;
        window.activeAssignedSessionId=null;
        try{
          await updateDoc(doc(db,'users',window.currentUser.uid,'assignedSessions',assignedId),{status:'completed',completedAt:serverTimestamp()});
          var aEntry=userDataCache.assignedSessions&&userDataCache.assignedSessions.find(function(a){return a._firestoreId===assignedId;});
          if(aEntry){aEntry.status='completed';}
        }catch(e){console.warn('Failed to mark assigned session complete:',e);}
      }
    }catch(err){console.error('Firestore session save failed:',err);}
  }
}
function showDone(record){
  const allS=ld('sessions',[]);
  var setsLogged=0,vol=0;
  record.exercises.forEach(function(ex){
    var sets=(ex.sets||[]).filter(function(r){return r.kg||r.reps;});
    setsLogged+=sets.length;
    sets.forEach(function(r){
      var kg=parseFloat(r.kg)||0,reps=parseFloat(r.reps)||1;
      vol+=kg*reps;
    });
  });
  var volRound=Math.round(vol);
  var prevSessions=allS.slice(0,-1).filter(function(s){return s.sessId===record.sessId;});
  var vsHtml='';
  if(!prevSessions.length){
    vsHtml='<div class="done-stat-lbl">VS LAST TIME</div><div class="done-stat-val" style="color:var(--muted);font-size:14px">First time —<br>nothing to compare yet</div>';
  } else {
    var prev=prevSessions[prevSessions.length-1];
    var prevVol=0;
    (prev.exercises||[]).forEach(function(ex){
      (ex.sets||[]).forEach(function(r){prevVol+=((parseFloat(r.kg)||0)*(parseFloat(r.reps)||1));});
    });
    var diff=volRound-Math.round(prevVol);
    if(diff>0)vsHtml='<div class="done-stat-lbl">VS LAST TIME</div><div class="done-stat-val" style="color:var(--green);font-size:22px">+'+diff+'kg total volume</div>';
    else if(diff<0)vsHtml='<div class="done-stat-lbl">VS LAST TIME</div><div class="done-stat-val" style="color:var(--red);font-size:22px">'+diff+'kg total volume</div>';
    else vsHtml='<div class="done-stat-lbl">VS LAST TIME</div><div class="done-stat-val" style="color:var(--muted);font-size:18px">Same volume</div>';
  }
  var prs=ld('prs',{});
  var prBanners=[];
  record.exercises.forEach(function(ex){
    var maxKg=Math.max.apply(null,(ex.sets||[]).map(function(r){return parseFloat(r.kg)||0;}));
    if(maxKg>0&&prs[ex.name]&&prs[ex.name].kg===maxKg){
      var prev2=getPrevWtFromSessions(ex.name,allS.slice(0,-1));
      if(!prev2||maxKg>prev2.kg)prBanners.push('NEW PB — '+ex.name+' '+fmtWt(maxKg));
    }
  });
  var prArea=document.getElementById('done-pr-area');
  if(prArea)prArea.innerHTML=prBanners.length?'<div class="done-pr-strip">'+prBanners.map(function(b){return '<div class="done-pr-line">'+b+'</div>';}).join('')+'</div>':'';
  document.getElementById('done-ttl').textContent='GOOD WORK.';
  document.getElementById('done-sub').textContent=record.sessName+' — '+fmtDate(record.date)+'. '+setsLogged+' SETS LOGGED.';
  var statsEl=document.getElementById('done-stats');
  statsEl.innerHTML='<div class="done-stat"><div class="done-stat-lbl">SETS LOGGED</div><div class="done-stat-val" id="ds-sets">0</div></div>'
    +'<div class="done-stat"><div class="done-stat-lbl">TOTAL VOLUME</div><div class="done-stat-val" id="ds-vol">0'+getUnit()+'</div></div>'
    +'<div class="done-stat"><div class="done-stat-lbl">SESSION TIME</div><div class="done-stat-val" id="ds-time">'+(record.duration?record.duration+' min':'—')+'</div></div>'
    +'<div class="done-stat">'+vsHtml+'</div>';
  document.getElementById('done-ov').classList.add('open');
  countUp('ds-sets',0,setsLogged,800);
  countUp('ds-vol',0,volRound,800,getUnit());
}
function countUp(id,from,to,dur,suffix){
  var el=document.getElementById(id);if(!el)return;
  var start=Date.now(),range=to-from;
  (function tick(){
    var elapsed=Date.now()-start,progress=Math.min(elapsed/dur,1);
    var val=Math.round(from+range*(1-Math.pow(1-progress,3)));
    el.textContent=val+(suffix||'');
    if(progress<1)requestAnimationFrame(tick);
  })();
}
function closeDone(){document.getElementById('done-ov').classList.remove('open');clearActiveSession();}
// getPrevWtFromSessions is imported from app.js — no local duplicate needed

// HISTORY
function filterHist(cat,btn){histFilter=cat;document.querySelectorAll('#hfilt .pill').forEach(b=>b.classList.remove('on'));btn.classList.add('on');renderHistory();}
function renderHistory(){const all=ld('sessions',[]);const filtered=histFilter==='all'?all:all.filter(s=>s.cat===histFilter);const el=document.getElementById('sess-history');if(!el)return;if(!filtered.length){el.innerHTML='<div class="empty-state" style="padding:32px 24px"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><div class="empty-state-head">'+(histFilter==='all'?'NO SESSIONS YET':'NO '+histFilter+' SESSIONS')+'</div><div class="empty-state-sub">'+(histFilter==='all'?'Your completed sessions will appear here.':'No sessions logged for this category yet.')+'</div></div>';return;}el.innerHTML=filtered.slice().reverse().map((s,ri)=>{const realIdx=all.indexOf(s);const meta=CAT_META[s.cat]||CAT_META.CUSTOM;const allEx=[...s.exercises,...(s.extras||[])];const exHtml=allEx.map(ex=>{if(ex.setType==='amrap')return `<div class="hi-ex"><div class="hi-ex-nm">${ex.name} <span style="font-size:9px;color:var(--blue);font-weight:700">AMRAP</span></div><div style="font-size:13px;padding:4px 0">${ex.amrapMins?ex.amrapMins+' min — ':''}<strong>${ex.amrapScore||'—'} rounds</strong></div></div>`;const valid=(ex.sets||[]).filter(r=>r.sets||r.reps||r.kg);if(!valid.length)return '';return `<div class="hi-ex"><div class="hi-ex-nm">${ex.name}${ex.swapped?' <span style="font-size:9px;color:var(--gold);font-weight:700">SWAP</span>':''}${ex.extra?' <span style="font-size:9px;color:var(--gold);font-weight:700">EXTRA</span>':''}${ex.setType&&ex.setType!=='standard'?' <span style="font-size:9px;color:var(--blue);font-weight:700">'+ex.setType.toUpperCase()+'</span>':''}</div><div class="hi-grid"><span></span><span class="hg-h">Sets</span><span class="hg-h">Reps</span><span class="hg-h">Wt</span>${valid.map((r,i)=>`<span class="hg-l">Set ${i+1}</span><span class="hg-v">${r.sets||'—'}</span><span class="hg-v">${r.reps||'—'}</span><span class="hg-v">${r.kg?fmtWt(parseFloat(r.kg)):'—'}</span>`).join('')}</div></div>`;}).join('');return `<div class="hi"><div class="hi-hd" onclick="toggleHist('hb-${realIdx}')"><div><span class="hi-date">${fmtDate(s.date)}</span>${s.sessName?`<div style="font-size:10px;color:var(--muted);margin-top:2px">${s.sessName}</div>`:''}</div><div style="display:flex;gap:5px;align-items:center"><span class="tag" style="color:${meta.color};background:${meta.color}18">${s.cat}</span><button class="del-x" onclick="event.stopPropagation();delSession(${realIdx})">×</button></div></div><div class="hi-bd" id="hb-${realIdx}"><div class="hi-in">${exHtml||'<div class="empty">No data entered.</div>'}${s.notes?`<div class="hi-notes">${s.notes}</div>`:''}<div style="font-size:11px;color:var(--dim);margin-top:5px">${s.duration?`⏱ ${s.duration} min`:''}</div></div></div></div>`;}).join('');}
function toggleHist(id){document.getElementById(id)?.classList.toggle('open');}
function delSession(idx){
  if(!confirm('Delete this session?'))return;
  if(userDataCache.sessions!==null){
    var entry=userDataCache.sessions[idx];
    if(entry&&entry._firestoreId&&window.currentUser){
      deleteDoc(doc(db,'users',window.currentUser.uid,'sessions',entry._firestoreId)).catch(function(e){console.error('Firestore delete failed:',e);});
    }
    userDataCache.sessions.splice(idx,1);
  }
  renderHistory();toast('Session deleted');
}

// BOXING CLASS
function openBoxingModal(){selectedFeel='';document.getElementById('boxing-date').value=new Date().toISOString().split('T')[0];document.getElementById('boxing-notes').value='';document.querySelectorAll('.feel-opt').forEach(el=>el.classList.remove('sel'));openOverlay('boxing-modal');}
function selFeel(el,feel){selectedFeel=feel;document.querySelectorAll('.feel-opt').forEach(e=>e.classList.remove('sel'));el.classList.add('sel');}
async function saveBoxingClass(){
  const date=document.getElementById('boxing-date').value;if(!date){toast('Please select a date',true);return;}
  const notes=document.getElementById('boxing-notes').value.trim();
  const record={date,feel:selectedFeel||'good',notes,id:Date.now(),type:'class'};
  if(userDataCache.boxingSessions!==null){
    userDataCache.boxingSessions=[...userDataCache.boxingSessions,record].sort((a,b)=>a.date.localeCompare(b.date));
  }
  closeOverlay('boxing-modal');toast('Boxing class logged!');renderProgress();
  if(window.currentUser){
    try{
      const docRef=await addDoc(collection(db,'users',window.currentUser.uid,'boxingSessions'),Object.assign({},record,{createdAt:serverTimestamp()}));
      const entry=userDataCache.boxingSessions&&userDataCache.boxingSessions.find(function(s){return s.id===record.id;});
      if(entry)entry._firestoreId=docRef.id;
    }catch(err){console.error('Firestore boxing class save failed:',err);}
  }
}

// CSB
var csbSessionType=null,csbExTypes=[],csbEmomInterval=60;
var CSB_EX_TYPES={
  straight_sets:['standard','superset','amrap','ladder','pyramid','drop_set'],
  circuit:['standard','amrap','ladder','pyramid','drop_set'],
  amrap:['standard'],
  emom:['standard']
};
var CSB_EX_LABELS={standard:'Standard',superset:'Superset',amrap:'AMRAP',ladder:'Ladder',pyramid:'Pyramid',drop_set:'Drop Set'};
function selectCSBType(type){
  if(csbSessionType&&csbSessionType!==type&&csbExercises.length){
    if(!confirm('Changing session type will reset your exercise configuration. Continue?'))return;
    csbExercises=[];csbExTypes=[];
  }
  csbSessionType=type;
  document.querySelectorAll('.csb-type-card').forEach(function(c){c.classList.toggle('sel',c.dataset.type===type);});
  document.getElementById('csb-amrap-extra').style.display=type==='amrap'?'block':'none';
  document.getElementById('csb-emom-extra').style.display=type==='emom'?'block':'none';
  document.getElementById('csb-details').style.display='block';
  renderCSBList();
}
function selectEmomInterval(btn,secs){
  csbEmomInterval=secs;
  document.querySelectorAll('#csb-emom-interval .pill').forEach(function(b){b.classList.remove('on');});
  btn.classList.add('on');
}
function openCSB(editIdx){
  editingCustomId=editIdx!==undefined?editIdx:null;
  csbExercises=[];csbExTypes=[];csbSessionType=null;csbEmomInterval=60;
  document.getElementById('csb-name').value='';
  document.getElementById('csb-finisher').value='';
  document.getElementById('ex-search').value='';
  document.getElementById('ex-results').style.display='none';
  document.getElementById('csb-details').style.display='none';
  document.getElementById('csb-amrap-extra').style.display='none';
  document.getElementById('csb-emom-extra').style.display='none';
  document.querySelectorAll('.csb-type-card').forEach(function(c){c.classList.remove('sel');});
  document.getElementById('csb-ttl').textContent=editIdx!==undefined?'Edit Session':'Build Session';
  if(editIdx!==undefined){
    var customs=ld('customSessions',[]),sess=customs[editIdx];
    if(sess){
      document.getElementById('csb-name').value=sess.name||'';
      document.getElementById('csb-finisher').value=sess.finisher||'';
      csbExercises=(sess.exercises||[]).map(function(e){return Object.assign({},e);});
      csbExTypes=(sess.exTypes||csbExercises.map(function(){return 'standard';}));
      var st=sess.sessionType||'straight_sets';
      csbSessionType=st;
      document.querySelectorAll('.csb-type-card').forEach(function(c){c.classList.toggle('sel',c.dataset.type===st);});
      document.getElementById('csb-details').style.display='block';
      document.getElementById('csb-amrap-extra').style.display=st==='amrap'?'block':'none';
      document.getElementById('csb-emom-extra').style.display=st==='emom'?'block':'none';
    }
  }
  renderCSBList();
  openOverlay('csb-modal');
}
function editCustom(idx){openCSB(idx);}
function delCustom(idx){
  if(!confirm('Delete this custom session?'))return;
  if(userDataCache.customSessions!==null){
    var entry=userDataCache.customSessions[idx];
    if(entry&&entry._firestoreId&&window.currentUser){
      deleteDoc(doc(db,'users',window.currentUser.uid,'customSessions',entry._firestoreId)).catch(function(){});
    }
    userDataCache.customSessions.splice(idx,1);
  }
  renderCustomLib();toast('Session deleted');
}
function addBlankEx(){
  csbExercises.push({name:'',sets:'3',reps:'10',rest:60});
  csbExTypes.push('standard');
  renderCSBList();
}
function addCSBExFromLib(name){
  csbExercises.push({name:name,sets:'3',reps:'10',rest:60});
  csbExTypes.push('standard');
  renderCSBList();
  document.getElementById('ex-search').value='';
  document.getElementById('ex-results').style.display='none';
}
function setCsbExType(i,type){
  csbExTypes[i]=type;
  renderCSBList();
}
function renderCSBList(){
  var types=csbSessionType?CSB_EX_TYPES[csbSessionType]:CSB_EX_TYPES.straight_sets;
  document.getElementById('csb-ex-list').innerHTML=csbExercises.map(function(ex,i){
    var exType=csbExTypes[i]||'standard';
    var typePills=types.length>1?('<div class="csb-ex-types">'+types.map(function(t){
      return '<button class="stp '+(exType===t?'on':'')+'" onclick="setCsbExType('+i+',\''+t+'\')">'+CSB_EX_LABELS[t]+'</button>';
    }).join('')+'</div>'):'';
    var isAmrap=exType==='amrap';
    var setField=isAmrap
      ?('<div><div style="font-size:9px;color:var(--dim);letter-spacing:1px;text-transform:uppercase;margin-bottom:3px">Time (s)</div><input class="csb-m" type="number" placeholder="60" value="'+(ex.amrapTime||60)+'" oninput="csbExercises['+i+'].amrapTime=this.value"></div>')
      :('<div><div style="font-size:9px;color:var(--dim);letter-spacing:1px;text-transform:uppercase;margin-bottom:3px">Sets</div><input class="csb-m" type="number" placeholder="3" value="'+(ex.sets||'')+'" oninput="csbExercises['+i+'].sets=this.value"></div>');
    var dropNote=exType==='drop_set'?'<div style="font-size:12px;color:var(--muted);padding:4px 0">Complete to failure → reduce weight 20% → continue once.</div>':'';
    return '<div class="csb-ex"><button class="csb-d" onclick="removeCsbEx('+i+')">×</button>'
      +'<input class="csb-m" style="width:100%;text-align:left;margin-bottom:7px" type="text" placeholder="Exercise name" value="'+(ex.name||'')+'" oninput="csbExercises['+i+'].name=this.value">'
      +typePills
      +dropNote
      +'<div class="csb-row">'
        +setField
        +'<div><div style="font-size:9px;color:var(--dim);letter-spacing:1px;text-transform:uppercase;margin-bottom:3px">Reps</div><input class="csb-m" type="number" placeholder="10" value="'+(ex.reps||'')+'" oninput="csbExercises['+i+'].reps=this.value"></div>'
        +'<div><div style="font-size:9px;color:var(--dim);letter-spacing:1px;text-transform:uppercase;margin-bottom:3px">Rest (s)</div><input class="csb-m" type="number" placeholder="60" value="'+(ex.rest||60)+'" oninput="csbExercises['+i+'].rest=parseInt(this.value)||60"></div>'
      +'</div></div>';
  }).join('');
}
function removeCsbEx(i){csbExercises.splice(i,1);csbExTypes.splice(i,1);renderCSBList();}
function searchEx(){const q=document.getElementById('ex-search').value.toLowerCase().trim();const res=document.getElementById('ex-results');if(!q){res.style.display='none';return;}const matches=EXERCISE_LIBRARY.filter(e=>e.name.toLowerCase().includes(q)||e.muscles.toLowerCase().includes(q)).slice(0,10);if(!matches.length){res.style.display='none';return;}res.style.display='block';res.innerHTML=matches.map(e=>'<div class="ex-ri" onclick="addCSBExFromLib(\''+e.name.replace(/'/g,"\\'")+'\')">'+ e.name+'<small>'+e.muscles+'</small></div>').join('');}
async function saveCustomSess(){
  if(!csbSessionType){toast('Choose a session type first',true);return;}
  var name=document.getElementById('csb-name').value.trim();
  if(!name){toast('Please name your session',true);return;}
  if(!csbExercises.length){toast('Add at least one exercise',true);return;}
  var extra={};
  if(csbSessionType==='amrap'){extra.amrapCap=parseInt(document.getElementById('csb-amrap-cap').value)||20;extra.amrapTargetRounds=document.getElementById('csb-amrap-rounds').value||null;}
  if(csbSessionType==='emom'){extra.emomDur=parseInt(document.getElementById('csb-emom-dur').value)||20;extra.emomInterval=csbEmomInterval;}
  var sess={name:name,cat:'CUSTOM',sessionType:csbSessionType,finisher:document.getElementById('csb-finisher').value.trim(),exercises:csbExercises.map(function(e){return Object.assign({},e);}),exTypes:csbExTypes.slice(),extra:extra,createdAt:Date.now()};
  var isEdit=editingCustomId!==null;
  if(userDataCache.customSessions!==null){
    if(isEdit){
      var oldEntry=userDataCache.customSessions[editingCustomId];
      if(oldEntry){
        Object.assign(oldEntry,sess);
        if(oldEntry._firestoreId&&window.currentUser){
          // For edits, we'd need setDoc — for simplicity in Step 2, delete and re-add
          deleteDoc(doc(db,'users',window.currentUser.uid,'customSessions',oldEntry._firestoreId)).catch(function(){});
          addDoc(collection(db,'users',window.currentUser.uid,'customSessions'),Object.assign({},sess,{createdAt:serverTimestamp()})).then(function(ref){oldEntry._firestoreId=ref.id;}).catch(function(){});
        }
      }
    } else {
      userDataCache.customSessions.push(sess);
      if(window.currentUser){
        addDoc(collection(db,'users',window.currentUser.uid,'customSessions'),Object.assign({},sess,{createdAt:serverTimestamp()})).then(function(ref){sess._firestoreId=ref.id;}).catch(function(){});
      }
    }
  }
  closeOverlay('csb-modal');renderCustomLib();showCat('custom');
  toast(isEdit?'Session updated!':'Session saved!');editingCustomId=null;
}

// ─── EXERCISE REFERENCE OVERLAY ──────────────────────────────────────────────
var exRefOpener = null;
var exRefGestureReady = false;

function initExRefGestures() {
  if (exRefGestureReady) return;
  exRefGestureReady = true;
  var sheet = document.getElementById('ex-ref-sheet');
  if (sheet) {
    var startY = 0;
    sheet.addEventListener('touchstart', function(e){startY=e.touches[0].clientY;},{passive:true});
    sheet.addEventListener('touchend', function(e){if(e.changedTouches[0].clientY-startY>60)closeExRef();},{passive:true});
  }
  document.addEventListener('keydown', function(e){
    if(e.key==='Escape'){var s=document.getElementById('ex-ref-sheet');if(s&&s.style.display!=='none')closeExRef();}
  });
}

function openExRef(ei) {
  initExRefGestures();
  var ex=activeLogSession&&activeLogSession.exercises[ei];
  if(!ex)return;
  var exLib=EXERCISE_LIBRARY.find(function(e){return e.name===ex.displayName;})||EXERCISE_LIBRARY.find(function(e){return e.name===ex.name;});
  if(!exLib||!exLib.ref)return;
  var ref=exLib.ref;
  exRefOpener=document.getElementById('lex-ref-'+ei);
  var nameEl=document.getElementById('ex-ref-name');
  var cueEl=document.getElementById('ex-ref-cue');
  var iframeEl=document.getElementById('ex-ref-iframe');
  var creditEl=document.getElementById('ex-ref-credit');
  var fallbackEl=document.getElementById('ex-ref-fallback');
  if(nameEl)nameEl.textContent=ex.displayName;
  if(cueEl)cueEl.textContent=ref.cue;
  if(iframeEl){
    iframeEl.style.display='block';
    iframeEl.src=ref.url+'?playsinline=1';
    iframeEl.setAttribute('aria-label','Technique video for '+ex.displayName);
    iframeEl.setAttribute('title','Technique video for '+ex.displayName);
    iframeEl.onerror=function(){iframeEl.style.display='none';if(fallbackEl)fallbackEl.style.display='flex';};
  }
  if(fallbackEl)fallbackEl.style.display='none';
  if(creditEl){
    if(ref.credit){creditEl.textContent='Video: '+ref.credit;creditEl.style.display='block';}
    else{creditEl.style.display='none';}
  }
  var backdrop=document.getElementById('ex-ref-backdrop');
  var sheet=document.getElementById('ex-ref-sheet');
  if(backdrop)backdrop.style.display='block';
  if(sheet){
    sheet.style.display='flex';
    sheet.style.transition='none';
    sheet.style.transform='translateY(100%)';
    requestAnimationFrame(function(){
      sheet.style.transition='transform 250ms ease-out';
      sheet.style.transform='translateY(0)';
    });
  }
  setTimeout(function(){var c=document.getElementById('ex-ref-close');if(c)c.focus();},260);
}

function closeExRef() {
  var sheet=document.getElementById('ex-ref-sheet');
  var backdrop=document.getElementById('ex-ref-backdrop');
  if(sheet){
    sheet.style.transition='transform 200ms ease-in';
    sheet.style.transform='translateY(100%)';
    setTimeout(function(){
      sheet.style.display='none';
      var iframe=document.getElementById('ex-ref-iframe');
      if(iframe)iframe.src='';
    },200);
  }
  if(backdrop)backdrop.style.display='none';
  if(exRefOpener){exRefOpener.focus();exRefOpener=null;}
}

// ─── EXPOSE TO HTML ONCLICK HANDLERS ─────────────────────────────────────────
export { checkDeload, initEquipment, renderLibrary, renderCustomLib, showLibraryView, showLogView };
window.checkDeload = checkDeload;
window.initEquipment = initEquipment;
window.toggleEquip = toggleEquip;
window.renderLibrary = renderLibrary;
window.renderCustomLib = renderCustomLib;
window.showLibraryView = showLibraryView;
window.showLogView = showLogView;
window.showCat = showCat;
window.toggleSC = toggleSC;
window.openSwap = openSwap;
window.selAlt = selAlt;
window.confirmSwap = confirmSwap;
window.useSession = useSession;
window.useCustomSession = useCustomSession;
window.confirmClearSess = confirmClearSess;
window.toggleWarmup = toggleWarmup;
window.toggleWarmupTimer = toggleWarmupTimer;
window.skipWuStep = skipWuStep;
window.editGlobalRest = editGlobalRest;
window.setGlobalRest = setGlobalRest;
window.toggleTypePicker = toggleTypePicker;
window.toggleExercise = toggleExercise;
window.setSetType = setSetType;
window.changeSets = changeSets;
window.completeSet = completeSet;
window.fillSuggestedKg = fillSuggestedKg;
window.editExRest = editExRest;
window.setExRest = setExRest;
window.onSetInput = onSetInput;
window.addSetRow = addSetRow;
window.removeRow = removeRow;
window.addSupersetRow = addSupersetRow;
window.completeSupersetRow = completeSupersetRow;
window.skipRest = skipRest;
window.addExtra = addExtra;
window.addExRow = addExRow;
window.saveSession = saveSession;
window.closeDone = closeDone;
window.filterHist = filterHist;
window.renderHistory = renderHistory;
window.toggleHist = toggleHist;
window.delSession = delSession;
window.openBoxingModal = openBoxingModal;
window.selFeel = selFeel;
window.saveBoxingClass = saveBoxingClass;
window.selectCSBType = selectCSBType;
window.selectEmomInterval = selectEmomInterval;
window.openCSB = openCSB;
window.editCustom = editCustom;
window.delCustom = delCustom;
window.addBlankEx = addBlankEx;
window.addCSBExFromLib = addCSBExFromLib;
window.setCsbExType = setCsbExType;
window.renderCSBList = renderCSBList;
window.removeCsbEx = removeCsbEx;
window.searchEx = searchEx;
window.saveCustomSess = saveCustomSess;
window.getPrevWt = getPrevWt;
window.autosaveLog = autosaveLog;
window.buildLogForm = buildLogForm;
window.openExRef = openExRef;
window.closeExRef = closeExRef;
window.showSgptCat = showSgptCat;
window.startAssignedSession = startAssignedSession;
window.renderAssignedSessions = renderAssignedSessions;
window.renderSgptSection = renderSgptSection;
window.renderPt121Section = renderPt121Section;
window.toggleTierTeaser = toggleTierTeaser;
