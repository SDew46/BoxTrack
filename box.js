import { ld, sv, toast, fmtSecs, getUnit, userDataCache } from './app.js';
import { COMBO_TIERS, LEGEND_COMBOS, TIER_DESCS, CORNER_QUOTES, PUNCH_NAMES, DEF_DISP, DEF_CALL } from './data.js';
import { COACH_AUDIO } from './coach-audio.js';
import { db } from './firebase.js';
import { collection, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';

// ─── BOX-ONLY STATE ───────────────────────────────────────────────────────────
const FS_REST_OPTIONS=[30,45,60,90,120];
let fsState={running:false,phase:'idle',totalRounds:6,currentRound:0,roundDurationMins:3,restDurationIdx:2,doubleRound:false,secondsLeft:0,interval:null,sessionStart:null};
let currentBoxTab='freestyle',currentTier='basics',currentComboIdx=0,currentComboList=[],currentDrillCombo=null;
let drillRunning=false,drillPunchIdx=0,drillInterval=null,voiceMode='numbers',tempoValue=5;
let comboBuilderSeq=[];
var audioUnlocked=false;var bellAudioObj=null;
var drillRound=0,drillElapsed=0,drillElapsedInterval=null;
var kpBodyMod=false;

// BOX PAGE
function showBoxTab(tab){
  currentBoxTab=tab;
  ['freestyle','drill','learn'].forEach(function(t){
    var el=document.getElementById('boxtab-'+t);
    var btn=document.getElementById('bxt-'+t);
    if(el)el.style.display=t===tab?'block':'none';
    if(btn)btn.classList.toggle('on',t===tab);
  });
  updateBtiIndicator();
  if(tab==='drill'){renderCOTD();showTier(currentTier||'basics');}
  if(tab==='learn'){renderLearnTab();}
  if(tab==='drill'||tab==='learn')stopDrill();
}
function initBoxPage(){
  updateFsPreUI();
  updateBtiIndicator();
}

// AUDIO
function unlockAudio(){
  if(audioUnlocked)return;
  try{var ctx=new(window.AudioContext||window.webkitAudioContext)();var buf=ctx.createBuffer(1,1,22050);var src=ctx.createBufferSource();src.buffer=buf;src.connect(ctx.destination);src.start(0);}catch(e){}
  audioUnlocked=true;
}
document.addEventListener('touchstart',unlockAudio,{passive:true});
document.addEventListener('click',unlockAudio);
var FS_BELL_SRC='data:audio/mp3;base64,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';
function playBell(){try{if(!bellAudioObj)bellAudioObj=new Audio(FS_BELL_SRC);bellAudioObj.currentTime=0;bellAudioObj.play().catch(function(){});}catch(e){}}
function playFsWarning(){playCoachAudio('ten-seconds');}

// ─── ELEVENLABS COACH AUDIO ───────────────────────────────────────────────────
var PUNCH_NUM_KEYS={1:'one',2:'two',3:'three',4:'four',5:'five',6:'six','b1':'body-jab','b2':null,'b3':null,'slip-l':'slip','slip-r':'slip','roll':'roll-left','roll-r':'roll-right','step':'step-out'};
var PUNCH_NAME_KEYS={1:'jab',2:'cross',3:'lead-hook',4:'rear-hook',5:'lead-upper',6:'rear-upper','b1':'body-jab','b2':null,'b3':null,'slip-l':'slip','slip-r':'slip','roll':'roll-left','roll-r':'roll-right','step':'step-out'};
var QUIP_KEYS=['good','sharp','nice-combo','stay-on-it','rhythm','hands-up','stay-sharp'];

function playCoachAudio(key){
  if(!key||!COACH_AUDIO[key])return;
  var a=new Audio(COACH_AUDIO[key]);
  a.volume=1.0;
  a.play().catch(function(){});
}

function getPunchKey(punch){
  var map=voiceMode==='names'?PUNCH_NAME_KEYS:PUNCH_NUM_KEYS;
  if(typeof punch==='number')return map[punch]||null;
  if(isBodyShot(punch))return map['b'+punch[1]]||null;
  return PUNCH_NUM_KEYS[punch]||null;
}

// FREESTYLE TIMER
function getFsWorkSecs(){return fsState.doubleRound?360:fsState.roundDurationMins*60;}
function getFsRestSecs(){return fsState.doubleRound?60:FS_REST_OPTIONS[fsState.restDurationIdx];}
function fsChangeRounds(d){
  if(fsState.running)return;
  fsState.totalRounds=Math.max(1,Math.min(12,fsState.totalRounds+d));
  document.getElementById('fs-rnd-disp').textContent=fsState.totalRounds;
  updateFsPreUI();
}
function fsChangeRoundDur(d){
  if(fsState.running||fsState.doubleRound)return;
  fsState.roundDurationMins=Math.max(1,Math.min(5,fsState.roundDurationMins+d));
  document.getElementById('fs-rdur-disp').textContent=fsState.roundDurationMins;
  updateFsPreUI();
}
function fsChangeRestDur(d){
  if(fsState.running||fsState.doubleRound)return;
  fsState.restDurationIdx=Math.max(0,Math.min(FS_REST_OPTIONS.length-1,fsState.restDurationIdx+d));
  var secs=FS_REST_OPTIONS[fsState.restDurationIdx];
  document.getElementById('fs-rdrest-disp').textContent=secs+'s';
  document.getElementById('fs-rest-lbl').textContent=secs+' seconds';
}
function toggleDouble(){
  if(fsState.running)return;
  fsState.doubleRound=!fsState.doubleRound;
  document.getElementById('dbl-tog').classList.toggle('on',fsState.doubleRound);
  document.getElementById('dbl-lbl').textContent=fsState.doubleRound?'On — 6 min':'Off';
  var rdurEl=document.getElementById('fs-rdur-disp');
  var rrestEl=document.getElementById('fs-rdrest-disp');
  if(rdurEl)rdurEl.textContent=fsState.doubleRound?'6':fsState.roundDurationMins;
  if(rrestEl)rrestEl.textContent=fsState.doubleRound?'60s':FS_REST_OPTIONS[fsState.restDurationIdx]+'s';
  updateFsPreUI();
}
function updateFsPreUI(){
  var wSecs=getFsWorkSecs();
  var digs=document.getElementById('t-digits');
  if(digs&&fsState.phase==='idle')digs.textContent=fmtSecs(wSecs);
  var rctr=document.getElementById('t-rctr');
  if(rctr&&fsState.phase==='idle')rctr.textContent=fsState.totalRounds+' ROUNDS';
  var dots=document.getElementById('rdots');
  if(dots)dots.innerHTML=Array.from({length:fsState.totalRounds},function(){return '<div class="rd"></div>';}).join('');
  var arc=document.getElementById('t-arc');
  if(arc){arc.style.strokeDashoffset='0';arc.style.stroke='var(--red)';}
  var ph=document.getElementById('t-phase');
  if(ph){ph.textContent='READY';ph.className='t-phase ready';}
  var btn=document.getElementById('fs-start-btn');
  if(btn&&fsState.phase==='idle')btn.textContent='START';
}
function toggleFreestyle(){
  unlockAudio();
  if(fsState.phase==='idle'){
    fsState.currentRound=1;
    fsState.phase='work';
    fsState.secondsLeft=getFsWorkSecs();
    fsState.running=true;
    fsState.sessionStart=Date.now();
    updateFsActiveUI();
    startFsTick();
    playBell();
    updateBtiIndicator();
  } else if(fsState.running){
    fsState.running=false;
    clearInterval(fsState.interval);
    var btn=document.getElementById('fs-start-btn');
    if(btn)btn.textContent='RESUME';
  } else {
    fsState.running=true;
    startFsTick();
    var btn2=document.getElementById('fs-start-btn');
    if(btn2)btn2.textContent='PAUSE';
  }
}
function updateFsActiveUI(){
  var isRest=fsState.phase==='rest';
  var total=isRest?getFsRestSecs():getFsWorkSecs();
  var pct=total>0?fsState.secondsLeft/total:1;
  var CIRC=552.92;
  var digs=document.getElementById('t-digits');
  if(digs)digs.textContent=fmtSecs(fsState.secondsLeft);
  var arc=document.getElementById('t-arc');
  if(arc){arc.style.strokeDashoffset=CIRC*(1-pct);arc.style.stroke=isRest?'var(--blue)':'var(--red)';}
  var ph=document.getElementById('t-phase');
  if(ph){ph.textContent=isRest?'REST':'ROUND '+fsState.currentRound;ph.className='t-phase '+(isRest?'rest':'work');}
  var rctr=document.getElementById('t-rctr');
  if(rctr)rctr.textContent=isRest?'ROUND '+(fsState.currentRound+1)+' COMING UP':'ROUND '+fsState.currentRound+' OF '+fsState.totalRounds;
  var dots=document.getElementById('rdots');
  if(dots)dots.innerHTML=Array.from({length:fsState.totalRounds},function(_,i){
    var cls='rd';
    if(i<fsState.currentRound-1)cls+=' done';
    else if(i===fsState.currentRound-1&&!isRest)cls+=' active';
    return '<div class="'+cls+'"></div>';
  }).join('');
  var btn=document.getElementById('fs-start-btn');
  if(btn)btn.textContent=fsState.running?'PAUSE':'RESUME';
}
function startFsTick(){
  clearInterval(fsState.interval);
  fsState.interval=setInterval(function(){
    if(!fsState.running)return;
    fsState.secondsLeft--;
    if(fsState.phase==='work'){
      if(fsState.secondsLeft===10)playFsWarning();
      if(fsState.secondsLeft<=0){
        playBell();
        if(fsState.currentRound>=fsState.totalRounds){
          fsState.running=false;
          clearInterval(fsState.interval);
          fsState.phase='done';
          showFsDoneOv();
          return;
        }
        fsState.phase='rest';
        fsState.secondsLeft=getFsRestSecs();
      }
    } else if(fsState.phase==='rest'){
      if(fsState.secondsLeft<=0){
        playBell();
        fsState.currentRound++;
        fsState.phase='work';
        fsState.secondsLeft=getFsWorkSecs();
      }
    }
    updateFsActiveUI();
    updateBtiIndicator();
  },1000);
}
function resetFreestyle(){
  clearInterval(fsState.interval);
  fsState.running=false;
  fsState.phase='idle';
  fsState.currentRound=0;
  fsState.secondsLeft=0;
  document.getElementById('fs-done-ov').classList.remove('show');
  updateFsPreUI();
  updateBtiIndicator();
}
function showFsDoneOv(){
  document.getElementById('fs-done-ov').classList.add('show');
  var elapsed=fsState.sessionStart?Math.round((Date.now()-fsState.sessionStart)/60000):0;
  var sub=document.getElementById('fsd-sub');
  if(sub)sub.textContent=fsState.currentRound+' rounds · '+elapsed+' min';
}
async function endFreestyleSession(){
  clearInterval(fsState.interval);
  fsState.running=false;
  document.getElementById('fs-round-ov').classList.remove('show');
  showFsDoneOv();
}
async function completeFsSession(){
  var elapsed=fsState.sessionStart?Math.round((Date.now()-fsState.sessionStart)/60000):0;
  var record={date:new Date().toISOString().split('T')[0],rounds:fsState.currentRound,roundDurationMins:fsState.roundDurationMins,restDurationSecs:FS_REST_OPTIONS[fsState.restDurationIdx],totalMins:elapsed,id:Date.now(),type:'freestyle'};
  if(userDataCache.boxingSessions!==null){
    userDataCache.boxingSessions=[...userDataCache.boxingSessions,record].sort(function(a,b){return a.date.localeCompare(b.date);});
  }
  document.getElementById('fs-done-ov').classList.remove('show');
  resetFreestyle();
  toast('Session saved!');
  if(window.currentUser){
    try{
      var docRef=await addDoc(collection(db,'users',window.currentUser.uid,'boxingSessions'),Object.assign({},record,{createdAt:serverTimestamp()}));
      var entry=userDataCache.boxingSessions&&userDataCache.boxingSessions.find(function(s){return s.id===record.id;});
      if(entry)entry._firestoreId=docRef.id;
    }catch(err){console.error('Firestore freestyle session save failed:',err);}
  }
}
function updateBtiIndicator(){
  var ind=document.getElementById('box-timer-ind');
  if(!ind)return;
  var onFreestyle=currentBoxTab==='freestyle';
  if(fsState.running&&!onFreestyle){
    ind.classList.add('show');
    var sp=document.getElementById('bti-round');
    if(sp)sp.textContent=fsState.currentRound;
  } else {
    ind.classList.remove('show');
  }
}

// DRILL TAB
function isBodyShot(p){return typeof p==='string'&&p.length===2&&p[0]==='b'&&!isNaN(parseInt(p[1]));}
function fmtSeq(seq){return seq.map(function(p){return typeof p==='number'?p:(DEF_DISP[p]||p);}).join(' — ');}
function buildDrillCard(combo,tier,delIdx){
  var chipsHtml=combo.seq.map(function(p){
    var isB=isBodyShot(p),isD=typeof p==='string'&&!isB;
    var disp=isB?('B'+p[1]):isD?(DEF_DISP[p]||p):p;
    return '<div class="pc pc-xs'+(isD?' def':'')+(isB?' body':'')+'">'+disp+'</div>';
  }).join('');
  var delBtn=typeof delIdx!=='undefined'?'<button class="drill-cc-del" onclick="event.stopPropagation();delCustomCombo('+delIdx+')">×</button>':'';
  var comboJson=JSON.stringify(combo).replace(/"/g,'&quot;');
  return '<div class="drill-cc"><div class="drill-cc-info"><div class="drill-cc-nm">'+combo.name+'</div><div class="drill-cc-chips">'+chipsHtml+'</div><div class="drill-cc-desc">'+combo.desc+'</div></div><div style="display:flex;gap:6px;align-items:center;flex-shrink:0">'+delBtn+'<button class="drill-cc-btn" onclick="openDrillPrep('+comboJson+',\''+tier+'\')">DRILL</button></div></div>';
}
var COTW_COMBO={name:'The Classic',seq:[1,2,3,2],desc:'Your bread and butter. Master this first.'};
function renderCOTD(){
  var area=document.getElementById('cotd-area');if(!area)return;
  var chipsHtml=COTW_COMBO.seq.map(function(p){return '<div class="pc pc-xs">'+p+'</div>';}).join('');
  var comboJson=JSON.stringify(COTW_COMBO).replace(/"/g,'&quot;');
  area.innerHTML='<div class="cotd" style="display:flex;align-items:center;gap:10px;padding:10px 13px"><div style="flex:1"><div class="cotd-eye" style="color:var(--gold)">COMBO OF THE WEEK</div><div style="display:flex;flex-wrap:wrap;gap:4px;margin:5px 0">'+chipsHtml+'</div><div class="cotd-nm">'+COTW_COMBO.name+'</div></div><button class="drill-cc-btn" style="border-color:var(--accent);color:var(--accent)" onclick="openDrillPrep('+comboJson+',\'basics\')">DRILL</button></div>';
}
function showTier(tier){
  currentTier=tier;
  ['basics','amateur','pro','champ','legends','mycombos'].forEach(function(t){
    var el=document.getElementById('tt-'+t);if(el)el.classList.toggle('on',t===tier);
  });
  var descEl=document.getElementById('drill-tier-desc');
  if(descEl)descEl.textContent=TIER_DESCS[tier]||'';
  renderTierContent(tier);
  if(tier!=='legends'&&tier!=='mycombos'){
    var td=COMBO_TIERS[tier];
    if(td&&td.combos&&td.combos.length){currentComboIdx=0;currentComboList=td.combos;}
  } else if(tier==='legends'){
    if(LEGEND_COMBOS[0]&&LEGEND_COMBOS[0].combos&&LEGEND_COMBOS[0].combos.length){currentComboList=LEGEND_COMBOS[0].combos;}
  } else {
    currentComboList=getCustomCombos();
  }
}
function renderTierContent(tier){
  var cont=document.getElementById('combo-tier-content');if(!cont)return;
  if(tier==='legends'){
    cont.innerHTML=LEGEND_COMBOS.map(function(legend,li){
      var combosHtml=legend.combos.map(function(c){return buildDrillCard(c,'legends');}).join('');
      return '<div class="leg-card"><div class="lc-hd" onclick="toggleLegend(\'leg-'+li+'\')"><div><div class="lc-nm">'+legend.name+'</div><div class="lc-style">'+legend.style+'</div></div><span id="chev-leg-'+li+'" style="color:var(--dim);font-size:12px;transition:transform 0.25s">▾</span></div><div class="lc-bd" id="leg-'+li+'"><div class="lc-in"><div class="lc-intro">"'+legend.intro+'"</div>'+combosHtml+'</div></div></div>';
    }).join('');
    return;
  }
  if(tier==='mycombos'){
    var customs=getCustomCombos();
    var listHtml=customs.length?customs.map(function(c,i){return buildDrillCard(c,'mycombos',i);}).join(''):'<div class="empty-state" style="padding:32px 24px"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg><div class="empty-state-head">NO COMBOS YET</div><div class="empty-state-sub">Build your first combination below.</div></div>';
    cont.innerHTML='<div style="padding:10px 16px 8px"><button class="abtn ab-g abtn-xl" onclick="openComboBuilder()">+ BUILD COMBO</button></div>'+listHtml;
    return;
  }
  var td=COMBO_TIERS[tier];if(!td)return;
  cont.innerHTML='<div class="drill-tier-intro">'+td.intro+'</div>'+td.combos.map(function(c){return buildDrillCard(c,tier);}).join('');
}
function toggleLegend(id){var body=document.getElementById(id),chev=document.getElementById('chev-'+id);var open=body?body.classList.toggle('open'):false;if(chev)chev.style.transform=open?'rotate(180deg)':'';}
function openDrillPrep(combo,tier){
  stopDrill();
  currentDrillCombo=combo;
  renderDrillDisplay(combo,-1);
  var dn=document.getElementById('drill-nm');if(dn)dn.textContent=combo.name;
  var btn=document.getElementById('drill-main-btn');if(btn){btn.textContent='START DRILL';btn.className='db-main db-go';}
  var nameEl=document.getElementById('dp-combo-name');if(nameEl)nameEl.textContent=combo.name;
  var badgeEl=document.getElementById('dp-tier-badge');
  if(badgeEl){var tl=COMBO_TIERS[tier]?COMBO_TIERS[tier].label:(tier.charAt(0).toUpperCase()+tier.slice(1));badgeEl.textContent=tl;}
  document.getElementById('drill-tab-list').style.display='none';
  document.getElementById('drill-tab-builder').style.display='none';
  document.getElementById('drill-tab-prep').style.display='block';
  window.scrollTo(0,0);
}
function showDrillList(){
  stopDrill();
  document.getElementById('drill-tab-list').style.display='block';
  document.getElementById('drill-tab-prep').style.display='none';
  document.getElementById('drill-tab-builder').style.display='none';
}
function renderDrillDisplay(combo,activeIdx){
  var el=document.getElementById('drill-seq');if(!el)return;
  el.innerHTML=combo.seq.map(function(p,i){
    var isB=isBodyShot(p),isD=typeof p==='string'&&!isB;
    var disp=isB?('B'+p[1]):isD?(DEF_DISP[p]||p):p;
    var sz=isD?'pc-def-sm':(isB?'pc-sm':'pc-lg');
    var extra=isD?'def':(isB?'body':'');
    var lit=i===activeIdx?' lit':'';var done=i<activeIdx?' done':'';
    return '<div class="pc '+sz+' '+extra+lit+done+'">'+disp+'</div>';
  }).join('');
}
function toggleDrill(){if(!currentDrillCombo){toast('Select a combo first',true);return;}if(drillRunning)stopDrill();else startDrill();}
// KEYPAD BUILDER
function openComboBuilder(){
  comboBuilderSeq=[];kpBodyMod=false;
  var bb=document.getElementById('kp-body-btn');if(bb)bb.classList.remove('active');
  document.getElementById('drill-tab-list').style.display='none';
  document.getElementById('drill-tab-prep').style.display='none';
  document.getElementById('drill-tab-builder').style.display='block';
  var sb=document.getElementById('kp-save-btn');if(sb)sb.style.display='none';
  document.getElementById('kp-name-ov').classList.remove('open');
  updateKpStrip();
  window.scrollTo(0,0);
}
function closeComboBuilder(){
  document.getElementById('drill-tab-builder').style.display='none';
  document.getElementById('drill-tab-list').style.display='block';
  showTier('mycombos');
}
function kpAddPunch(n){
  var val=kpBodyMod?('b'+n):n;
  comboBuilderSeq.push(val);
  if(kpBodyMod){kpBodyMod=false;var bb=document.getElementById('kp-body-btn');if(bb)bb.classList.remove('active');}
  updateKpStrip();updateKpSaveBtn();
}
function kpAddDef(def){
  if(kpBodyMod){kpBodyMod=false;var bb=document.getElementById('kp-body-btn');if(bb)bb.classList.remove('active');}
  comboBuilderSeq.push(def);updateKpStrip();updateKpSaveBtn();
}
function kpToggleBody(){
  kpBodyMod=!kpBodyMod;
  var bb=document.getElementById('kp-body-btn');if(bb)bb.classList.toggle('active',kpBodyMod);
}
function kpDel(){if(!comboBuilderSeq.length)return;comboBuilderSeq.pop();updateKpStrip();updateKpSaveBtn();}
function kpClear(){
  if(!comboBuilderSeq.length)return;
  if(!confirm('Clear this combo?'))return;
  comboBuilderSeq=[];kpBodyMod=false;
  var bb=document.getElementById('kp-body-btn');if(bb)bb.classList.remove('active');
  updateKpStrip();updateKpSaveBtn();
}
function updateKpStrip(){
  var strip=document.getElementById('kp-strip');if(!strip)return;
  if(!comboBuilderSeq.length){strip.innerHTML='<span class="kp-empty">TAP BELOW TO BUILD</span>';return;}
  strip.innerHTML=comboBuilderSeq.map(function(p,i){
    var isB=isBodyShot(p),isD=typeof p==='string'&&!isB;
    var disp=isB?('B'+p[1]):isD?(DEF_DISP[p]||p):p;
    var cls=isB?'kp-chip-body':isD?'kp-chip-def':'kp-chip-pn';
    return '<div class="kp-strip-chip '+cls+'" onclick="kpRemoveAt('+i+')">'+disp+'</div>';
  }).join('');
}
function kpRemoveAt(i){comboBuilderSeq.splice(i,1);updateKpStrip();updateKpSaveBtn();}
function updateKpSaveBtn(){var btn=document.getElementById('kp-save-btn');if(btn)btn.style.display=comboBuilderSeq.length>=2?'block':'none';}
function showKpNameInput(){
  var ov=document.getElementById('kp-name-ov');
  var inp=document.getElementById('kp-name-ov-inp');
  if(inp)inp.value='';
  if(ov)ov.classList.add('open');
  if(inp)setTimeout(function(){inp.focus();},300);
}
function closeKpNameOv(e){if(e&&e.target!==document.getElementById('kp-name-ov'))return;document.getElementById('kp-name-ov').classList.remove('open');}
async function confirmSaveCombo(){
  var inp=document.getElementById('kp-name-ov-inp');
  var name=inp?inp.value.trim():'';
  if(!name){toast('Please name your combo',true);return;}
  if(comboBuilderSeq.length<2){toast('Add at least 2 moves',true);return;}
  var existing=ld('customCombos',[]);
  if(existing.length>=50){toast("You've reached the limit. Delete a combo to save a new one.",true);return;}
  var newCombo={name:name,seq:[...comboBuilderSeq],desc:'Custom combination',id:Date.now()};
  if(userDataCache.customCombos!==null){
    userDataCache.customCombos.push(newCombo);
  }
  document.getElementById('kp-name-ov').classList.remove('open');
  toast('Combo saved!');
  closeComboBuilder();
  if(window.currentUser){
    try{
      var docRef=await addDoc(collection(db,'users',window.currentUser.uid,'customCombos'),Object.assign({},newCombo,{createdAt:serverTimestamp()}));
      var entry=userDataCache.customCombos&&userDataCache.customCombos.find(function(c){return c.id===newCombo.id;});
      if(entry)entry._firestoreId=docRef.id;
    }catch(err){console.error('Firestore combo save failed:',err);}
  }
}
function enterDrillFs(){
  var nav=document.querySelector('.nav');
  if(nav)nav.style.display='none';
  document.body.style.paddingBottom='0';
  var pageBox=document.getElementById('page-box');
  if(pageBox)pageBox.classList.add('drilling');
  window.scrollTo(0,0);
}
function exitDrillFs(){
  var nav=document.querySelector('.nav');
  if(nav)nav.style.display='';
  document.body.style.paddingBottom='';
  var pageBox=document.getElementById('page-box');
  if(pageBox)pageBox.classList.remove('drilling');
}
function endDrillMode(){stopDrill();}
function startDrill(){
  if(!currentDrillCombo)return;
  drillRunning=true;drillPunchIdx=0;drillRound=0;drillElapsed=0;
  enterDrillFs();
  updateDrillFsRound();
  var timer=document.getElementById('dfs-timer');
  if(timer)timer.textContent='0:00';
  clearInterval(drillElapsedInterval);
  drillElapsedInterval=setInterval(function(){
    drillElapsed++;
    var el=document.getElementById('dfs-timer');
    if(el)el.textContent=fmtSecs(drillElapsed);
  },1000);
  var btn=document.getElementById('drill-main-btn');
  if(btn){btn.textContent='STOP DRILL';btn.className='db-main db-stop';}
  runDrillStep();
}
function getTempoMs(){return 2000-(tempoValue-1)*(1600/9);}
function runDrillStep(){if(!drillRunning)return;const seq=currentDrillCombo.seq;if(drillPunchIdx>=seq.length){renderDrillDisplay(currentDrillCombo,-1);updateDrillFS('');if(Math.random()<0.2)speakCoachQuip();drillPunchIdx=0;drillRound++;updateDrillFsRound();drillInterval=setTimeout(runDrillStep,getTempoMs()*2);return;}const punch=seq[drillPunchIdx];renderDrillDisplay(currentDrillCombo,drillPunchIdx);updateDrillFS(punch);callPunch(punch);drillPunchIdx++;const isD=typeof punch==='string';drillInterval=setTimeout(runDrillStep,isD?getTempoMs()*1.3:getTempoMs());}
function updateDrillFsRound(){var el=document.getElementById('dfs-round');if(el)el.textContent='ROUND '+(drillRound+1);}
function updateDrillFS(punch){
  var fp=document.getElementById('dfs-punch');
  if(!fp)return;
  if(punch===''||punch===undefined){fp.textContent='';fp.className='dfs-punch';return;}
  var isB=isBodyShot(punch),isD=typeof punch==='string'&&!isB;
  var disp=isB?('B'+punch[1]):isD?(DEF_DISP[punch]||punch):punch;
  fp.textContent=disp;
  fp.className='dfs-punch';
  void fp.offsetWidth;
  fp.className='dfs-punch '+(isB?'body-calling':isD?'def-calling':'calling');
  setTimeout(function(){if(fp)fp.className='dfs-punch';},getTempoMs()*0.8);
}
function stopDrill(){
  drillRunning=false;clearTimeout(drillInterval);clearInterval(drillElapsedInterval);
  exitDrillFs();
  var btn=document.getElementById('drill-main-btn');
  if(btn){btn.textContent='START DRILL';btn.className='db-main db-go';}
  if(currentDrillCombo)renderDrillDisplay(currentDrillCombo,-1);
  updateDrillFS('');
}
function nextCombo(){
  stopDrill();
  if(!currentComboList.length)return;
  currentComboIdx=(currentComboIdx+1)%currentComboList.length;
  openDrillPrep(currentComboList[currentComboIdx],currentTier);
}
function drillRandom(){
  stopDrill();
  var safeTier=currentTier==='legends'||currentTier==='mycombos'?'basics':currentTier;
  var td=COMBO_TIERS[safeTier];
  var all=(td?td.combos:[]).concat(getCustomCombos());
  if(!all.length)return;
  var combo=all[Math.floor(Math.random()*all.length)];
  currentComboList=all;currentComboIdx=all.indexOf(combo);
  openDrillPrep(combo,currentTier);
  toast('Random — '+combo.name);
}

// LEARN TAB
var LEARN_CONTENT=[
  {title:'THE PUNCHES',cat:'FOUNDATION',video:'https://www.youtube.com/embed/SedKFKgpgbk',cue:"Every punch has a number: 1 Jab, 2 Cross, 3 Lead Hook, 4 Rear Hook, 5 Lead Uppercut, 6 Rear Uppercut. Learn these numbers — your coach will call them out and the app uses them throughout. Start with 1 and 2 before anything else."},
  {title:'DEFENCE',cat:'DEFENCE',video:'https://www.youtube.com/embed/i17tNtv8N2I',cue:"Defence keeps you safe and sets up your counters. Slip off the centreline rather than leaning back. Roll under hooks by bending your knees, not your waist. Good defence makes your offence twice as effective."},
  {title:'FOOTWORK',cat:'MOVEMENT',video:'https://www.youtube.com/embed/zhWfajP4EVU',cue:"Your feet are the foundation of everything. Stay on the balls of your feet, never cross your legs, and move the foot closest to your direction first. Good footwork puts you in range to punch and out of range to get hit."},
  {title:'SHADOW BOXING',cat:'TRAINING',video:'https://www.youtube.com/embed/J4j3AOVWuHE',cue:"Shadow boxing is how you build muscle memory between sessions. Throw every punch with intention — pretend your opponent is there. Use it to warm up before bag work and to practise combinations you've been drilling."},
  {title:'HAND WRAPPING',cat:'PREPARATION',video:'https://www.youtube.com/embed/KAjzx7IajQc',cue:"Always wrap before hitting the bag or pads — no exceptions. Wraps protect your knuckles, wrist, and the small bones in your hand. Ask your coach to check your wrapping technique the first few times."},
  {title:'COMBINATIONS',cat:'COMBINATIONS',video:'https://www.youtube.com/embed/stM-RjSq_ws',cue:"Combinations are sequences of punches thrown together. A 1-2 is a jab followed by a cross — the most fundamental combination in boxing. In the Drill tab, combinations are shown as numbers: 1-2-3 means jab, cross, lead hook. Start in Basics and work upward."},
];
function renderLearnTab(){
  var saved=ld('learnOpen',null);
  var cont=document.getElementById('learn-sections');if(!cont)return;
  cont.innerHTML=LEARN_CONTENT.map(function(card,ci){
    var open=saved?!!saved[ci]:ci===0;
    var videoHtml='<div class="lv-wrap">'
      +'<div class="lv-fallback"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill="var(--dim)" stroke="none"/></svg><span>VIDEO UNAVAILABLE — check back soon</span></div>'
      +'<iframe class="lv-iframe" id="lv-'+ci+'" src="'+card.video+'" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen onload="this.classList.add(\'loaded\')"></iframe>'
      +'</div>';
    return '<div class="learn-card">'
      +'<div class="learn-card-hd" onclick="toggleLearnCard('+ci+')">'
        +'<div class="learn-card-title">'+card.title+'</div>'
        +'<span class="learn-card-chev" id="lchev-'+ci+'" style="'+(open?'transform:rotate(180deg)':'')+'">▾</span>'
      +'</div>'
      +'<div class="learn-card-bd'+(open?' open':'')+'" id="lcard-'+ci+'">'
        +'<div class="learn-card-in">'
          +'<div class="learn-card-cat">'+card.cat+'</div>'
          +videoHtml
          +'<div class="learn-cue">'+card.cue+'</div>'
        +'</div>'
      +'</div>'
    +'</div>';
  }).join('');
}
function toggleLearnCard(ci){
  var bd=document.getElementById('lcard-'+ci),chev=document.getElementById('lchev-'+ci);
  if(!bd)return;
  var open=bd.classList.toggle('open');
  if(chev)chev.style.transform=open?'rotate(180deg)':'';
  var saved=ld('learnOpen',{});
  saved[ci]=open;
  sv('learnOpen',saved);
}
// PLATE CALCULATOR
function openPlateCalc(targetKg){document.getElementById('plate-ov').classList.add('open');document.getElementById('plate-unit-lbl').textContent=getUnit();const inp=document.getElementById('plate-input');if(targetKg){inp.value=targetKg;}else{inp.value='';}calcPlates();}
function closePlateCalc(e){if(e&&e.target!==document.getElementById('plate-ov'))return;document.getElementById('plate-ov').classList.remove('open');}
function calcPlates(){
  const target=parseFloat(document.getElementById('plate-input').value)||0;
  const unit=getUnit();
  const barWeight=unit==='kg'?20:45;
  const plateOptions=unit==='kg'?[25,20,15,10,5,2.5,1.25]:[45,35,25,10,5,2.5];
  const res=document.getElementById('plate-result');
  if(!target||target<=barWeight){res.innerHTML=`<div style="font-size:13px;color:var(--dim)">Enter a weight above ${barWeight}${unit}</div>`;return;}
  const perSide=(target-barWeight)/2;
  let remaining=perSide;
  const plates=[];
  plateOptions.forEach(p=>{const count=Math.floor(remaining/p);if(count>0){plates.push({weight:p,count});remaining=+(remaining-p*count).toFixed(2);}});
  if(remaining>0.1){res.innerHTML=`<div style="font-size:13px;color:var(--red)">Can't make ${target}${unit} with standard plates. Try ${Math.round((target-remaining*2)*2)/2}${unit}.</div>`;return;}
  const barHtml=`<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><div style="font-size:11px;color:var(--dim);font-weight:700;letter-spacing:1px;text-transform:uppercase;min-width:60px">Bar</div><div style="font-family:'Bebas Neue',sans-serif;font-size:18px;color:var(--muted)">${barWeight}${unit}</div></div>`;
  const platesHtml=plates.map(p=>`<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border2)"><div style="font-size:11px;color:var(--dim);font-weight:700;letter-spacing:1px;text-transform:uppercase;min-width:60px">${p.count}× each</div><div style="font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:1px;color:var(--gold)">${p.weight}${unit}</div></div>`).join('');
  const totalCheck=`<div style="margin-top:10px;font-size:12px;color:var(--muted)">Total: ${barWeight} + (${plates.map(p=>`${p.count*2}×${p.weight}`).join(' + ')}) = <strong style="color:var(--text)">${target}${unit}</strong></div>`;
  res.innerHTML=barHtml+platesHtml+totalCheck;
}

function callPunch(punch){playCoachAudio(getPunchKey(punch));}
function speakCoachQuip(){playCoachAudio(QUIP_KEYS[Math.floor(Math.random()*QUIP_KEYS.length)]);}
function setVoiceMode(mode){voiceMode=mode;document.getElementById('vo-num').classList.toggle('on',mode==='numbers');document.getElementById('vo-name').classList.toggle('on',mode==='names');}
function updateTempo(val){tempoValue=parseInt(val);const lbl=val<=2?'Slow':val<=4?'Learning':val<=6?'Sparring':val<=8?'Fast':'Pressure';document.getElementById('tempo-val-lbl').textContent=lbl;}
function getCustomCombos(){return userDataCache.customCombos!==null?userDataCache.customCombos:ld('customCombos',[]);}
function saveCustomCombo(){const combos=ld('customCombos',[]);if(combos.length>=50){toast("You've reached the limit. Delete a combo to save a new one.",true);return;}}
function delCustomCombo(i){
  if(!confirm('Delete this combo?'))return;
  if(userDataCache.customCombos!==null){
    var entry=userDataCache.customCombos[i];
    if(entry&&entry._firestoreId&&window.currentUser){
      deleteDoc(doc(db,'users',window.currentUser.uid,'customCombos',entry._firestoreId)).catch(function(){});
    }
    userDataCache.customCombos.splice(i,1);
  }
  renderTierContent('mycombos');toast('Combo deleted');
}

// ─── EXPOSE TO HTML ONCLICK HANDLERS ─────────────────────────────────────────
export { initBoxPage, updateFsPreUI, stopDrill };
window.initBoxPage = initBoxPage;
window.updateFsPreUI = updateFsPreUI;
window.stopDrill = stopDrill;
window.showBoxTab = showBoxTab;
window.toggleFreestyle = toggleFreestyle;
window.resetFreestyle = resetFreestyle;
window.fsChangeRounds = fsChangeRounds;
window.fsChangeRoundDur = fsChangeRoundDur;
window.fsChangeRestDur = fsChangeRestDur;
window.toggleDouble = toggleDouble;
window.completeFsSession = completeFsSession;
window.endFreestyleSession = endFreestyleSession;
window.showTier = showTier;
window.openDrillPrep = openDrillPrep;
window.showDrillList = showDrillList;
window.toggleDrill = toggleDrill;
window.nextCombo = nextCombo;
window.drillRandom = drillRandom;
window.endDrillMode = endDrillMode;
window.openComboBuilder = openComboBuilder;
window.closeComboBuilder = closeComboBuilder;
window.kpAddPunch = kpAddPunch;
window.kpAddDef = kpAddDef;
window.kpToggleBody = kpToggleBody;
window.kpDel = kpDel;
window.kpClear = kpClear;
window.kpRemoveAt = kpRemoveAt;
window.showKpNameInput = showKpNameInput;
window.closeKpNameOv = closeKpNameOv;
window.confirmSaveCombo = confirmSaveCombo;
window.delCustomCombo = delCustomCombo;
window.toggleLearnCard = toggleLearnCard;
window.openPlateCalc = openPlateCalc;
window.closePlateCalc = closePlateCalc;
window.calcPlates = calcPlates;
window.setVoiceMode = setVoiceMode;
window.updateTempo = updateTempo;
window.toggleLegend = toggleLegend;

export function resetBoxState() {
  if (fsState.interval) clearInterval(fsState.interval);
  fsState = {running:false,phase:'idle',totalRounds:6,currentRound:0,roundDurationMins:3,restDurationIdx:2,doubleRound:false,secondsLeft:0,interval:null,sessionStart:null};
  if (drillInterval) clearInterval(drillInterval);
  if (drillElapsedInterval) clearInterval(drillElapsedInterval);
  drillRunning = false; drillInterval = null; drillElapsedInterval = null;
  drillRound = 0; drillElapsed = 0;
}
window.resetBoxState = resetBoxState;
