// STATE
let activeEquipment=new Set(EQUIP_OPTIONS.map(e=>e.id));
let activeLogSession=null,extraCount=0,restTimers={},selectedFeel='',csbExercises=[],editingCustomId=null;
let swapState={sessId:null,exIdx:null,selected:null},histFilter='all',sessionStartTime=null,durInterval=null,setTypeState={};
let wuState={running:false,stepIdx:0,secsLeft:0,interval:null};
const FS_REST_OPTIONS=[30,45,60,90,120];
let fsState={running:false,phase:'idle',totalRounds:6,currentRound:0,roundDurationMins:3,restDurationIdx:2,doubleRound:false,secondsLeft:0,interval:null,sessionStart:null};
let currentBoxTab='freestyle',currentTier='basics',currentComboIdx=0,currentComboList=[],currentDrillCombo=null;
let drillRunning=false,drillPunchIdx=0,drillInterval=null,voiceMode='numbers',tempoValue=5;
let comboBuilderSeq=[],synth=null,voicesLoaded=false,preferredVoice=null;
var audioUnlocked=false;var bellAudioObj=null;

// STORAGE
const ld=(k,fb)=>{try{return JSON.parse(localStorage.getItem(k))??fb;}catch{return fb;}};
const sv=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const getUnit=()=>ld('unit','kg');
const fmtWt=v=>v?`${v}${getUnit()}`:'—';
function fmtDate(str){const d=new Date(str+'T00:00:00');return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'2-digit'});}
function fmtSecs(s){const m=Math.floor(s/60);return `${m}:${(s%60).toString().padStart(2,'0')}`;}
let toastTimer;
function toast(msg,err){const t=document.getElementById('toast');t.textContent=msg;t.style.background=err?'var(--red)':'var(--green)';t.style.color=err?'#fff':'#000';t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2400);}

// NAV
function showPage(id){
  ['train','box','progress'].forEach((p,i)=>{document.getElementById('page-'+p).classList.toggle('active',p===id);document.querySelectorAll('.nav-btn')[i].classList.toggle('on',p===id);});
  if(id==='train'){checkDeload();applyBranding();}
  if(id==='box'){initBoxPage();}
  if(id==='progress'){renderProgress();renderSettingsPanel();}
}
function openOverlay(id){document.getElementById(id).classList.add('open');}
function closeOverlay(id,e){if(e&&e.target!==document.getElementById(id))return;document.getElementById(id).classList.remove('open');}

// BRANDING
function initBranding(){
  const sw=document.getElementById('color-swatches');if(!sw)return;
  const cur=ld('accentColor','#E63946');
  sw.innerHTML=ACCENT_COLORS.map(c=>`<div class="sw ${c.val===cur?'on':''}" style="background:${c.val}" onclick="setAccent('${c.val}')"></div>`).join('');
  const inp=document.getElementById('brand-name-inp');if(inp){const n=ld('appName','');if(n)inp.value=n;}
}
function applyBranding(){
  const color=ld('accentColor','#E63946'),name=ld('appName','')||'8RB';
  document.documentElement.style.setProperty('--accent',color);
  const el=document.getElementById('train-title');
  if(el){
    var sub=name==='8RB'?'by 8 Rounds Boxing':'';
    el.innerHTML='<div class="sh-wordmark-main">'+name+'</div>'+(sub?'<div class="sh-wordmark-sub">'+sub+'</div>':'');
  }
  const eye=document.getElementById('train-eye');if(eye)eye.style.color=color;
}
function saveBrandName(){sv('appName',document.getElementById('brand-name-inp')?.value||'');applyBranding();}
function setAccent(val){sv('accentColor',val);document.querySelectorAll('.sw').forEach(s=>s.classList.toggle('on',s.style.background===val||s.style.backgroundColor===val));applyBranding();toast('Accent colour updated');}
function openSettings(){initBranding();renderSettingsPanel();document.getElementById('settings-ov').classList.add('open');}
function closeSettings(e){if(e&&e.target!==document.getElementById('settings-ov'))return;document.getElementById('settings-ov').classList.remove('open');}
function closeSettingsBtn(){document.getElementById('settings-ov').classList.remove('open');}
function renderSettingsPanel(){
  const u=getUnit();document.getElementById('unit-kg').classList.toggle('on',u==='kg');document.getElementById('unit-lbs').classList.toggle('on',u==='lbs');
  let total=0;for(let k in localStorage)if(localStorage.hasOwnProperty(k))total+=((localStorage[k].length+k.length)*2);
  const kb=Math.round(total/1024),pct=Math.min(100,Math.round(total/(5*1024*1024)*100));
  const fill=document.getElementById('storage-fill'),txt=document.getElementById('storage-txt');
  if(fill)fill.style.width=pct+'%';if(txt)txt.textContent=`${kb}KB used of ~5MB`;
}

// SETTINGS
function setUnit(u){sv('unit',u);document.getElementById('unit-kg').classList.toggle('on',u==='kg');document.getElementById('unit-lbs').classList.toggle('on',u==='lbs');toast('Units set to '+u);}
function exportData(){const data={sessions:ld('sessions',[]),boxingClasses:ld('boxingClasses',[]),customSessions:ld('customSessions',[]),customCombos:ld('customCombos',[]),equipment:ld('equipment',[]),unit:ld('unit','kg'),appName:ld('appName',''),accentColor:ld('accentColor',''),prs:ld('prs',{}),exportDate:new Date().toISOString()};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`8rb-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url);toast('Data exported!');}
function importData(e){
  var file=e.target.files[0];if(!file)return;
  var reader=new FileReader();
  reader.onload=function(ev){
    try{
      var data=JSON.parse(ev.target.result);
      if(data.sessions)sv('sessions',data.sessions);
      if(data.boxingClasses)sv('boxingClasses',data.boxingClasses);
      if(data.customSessions)sv('customSessions',data.customSessions);
      if(data.customCombos)sv('customCombos',data.customCombos);
      if(data.equipment)sv('equipment',data.equipment);
      if(data.unit)sv('unit',data.unit);
      if(data.appName)sv('appName',data.appName);
      if(data.accentColor)sv('accentColor',data.accentColor);
      if(data.prs)sv('prs',data.prs);
      initEquipment();
      applyBranding();
      renderLibrary();
      renderCustomLib();
      renderProgress();
      renderSettingsPanel();
      checkDeload();
      var count=(data.sessions||[]).length+(data.boxingClasses||[]).length;
      toast('Imported — '+count+' sessions restored');
    }catch(err){
      toast('Import failed — file may be corrupt',true);
    }
  };
  reader.readAsText(file);
  e.target.value='';
}
function clearAll(){if(!confirm('Delete ALL data? Cannot be undone.'))return;localStorage.clear();activeLogSession=null;showLibraryView();renderProgress();renderSettingsPanel();toast('All data cleared');}

// SERVICE WORKER
if('serviceWorker' in navigator){
  window.addEventListener('load',function(){
    // Track whether a SW was already controlling this page before registration.
    // Used to distinguish first install (no reload needed) from updates (reload needed).
    var hadController=!!navigator.serviceWorker.controller;
    // Single-fire reload guard — prevents double-reload if both updatefound
    // and controllerchange fire for the same update.
    var reloadPending=false;
    function reloadOnce(){if(!reloadPending){reloadPending=true;window.location.reload();}}

    navigator.serviceWorker.register('/BoxTrack/sw.js').then(function(reg){
      // Force the browser to check for an updated sw.js on every page load.
      // Without this, the browser may wait up to 24 h between checks.
      reg.update();
      // Detect a new SW being installed during this session.
      reg.addEventListener('updatefound',function(){
        var newWorker=reg.installing;
        if(!newWorker)return;
        newWorker.addEventListener('statechange',function(){
          // New SW finished installing. If something was already in control,
          // reload now — skipWaiting() in sw.js will have activated it.
          if(newWorker.state==='installed'&&navigator.serviceWorker.controller){
            reloadOnce();
          }
        });
      });
    }).catch(function(){});

    // Backup: reload when the controlling SW actually changes.
    // hadController guard prevents a reload on the very first SW install.
    navigator.serviceWorker.addEventListener('controllerchange',function(){
      if(hadController)reloadOnce();
      hadController=true;
    });
  });
}

// PR DETECTION
function detectPRs(record,allSessions){
  var prs=ld('prs',{});
  var prev=allSessions.slice(0,-1);
  record.exercises.forEach(function(ex){
    var sets=(ex.sets||[]).filter(function(r){return parseFloat(r.kg)>0;});
    if(!sets.length)return;
    var maxKg=Math.max.apply(null,sets.map(function(r){return parseFloat(r.kg);}));
    var prevBest=getPrevWtFromSessions(ex.name,prev);
    if(!prevBest||maxKg>prevBest.kg){
      prs[ex.name]={kg:maxKg,date:record.date};
    }
  });
  sv('prs',prs);
}
function getPR(name){var prs=ld('prs',{});return prs[name]||null;}

// NUMPAD
var npTarget=null,npField='kg',npEi=0,npSi=0,npVal='';
function openNumpad(inp,field,ei,si){
  npTarget=inp;npField=field;npEi=ei;npSi=si;
  npVal=inp.value||'';
  var ex=activeLogSession&&activeLogSession.exercises[ei];
  var exName=ex?ex.displayName:'Exercise';
  var setNum=si+1;
  document.getElementById('np-ex').textContent=exName;
  document.getElementById('np-set').textContent='Set '+setNum+' — '+(field==='kg'?getUnit():'Reps');
  var prev=ex?(getPrevWt(ex.displayName)||getPrevWt(ex.name)):null;
  var prevEl=document.getElementById('np-prev');
  if(prevEl)prevEl.textContent=prev?'Last: '+fmtWt(prev.kg)+(prev.reps?' × '+prev.reps:'')+'  —  '+fmtDate(prev.date):'No previous data';
  var incrEl=document.getElementById('np-incr');
  if(incrEl){
    if(field==='kg'){
      incrEl.innerHTML='<button class="dec" onclick="npIncr(-2.5)">−2.5</button><button class="dec" onclick="npIncr(-1.25)">−1.25</button><button class="inc" onclick="npIncr(1.25)">+1.25</button><button class="inc" onclick="npIncr(2.5)">+2.5</button>';
    } else {
      incrEl.innerHTML='<button class="dec" onclick="npIncr(-1)">−1</button><button class="inc" onclick="npIncr(1)">+1</button>';
    }
  }
  updateNpDisplay();
  document.getElementById('numpad-ov').classList.add('open');
}
function npKey(k){
  if(k==='.'&&npVal.includes('.'))return;
  if(npVal==='0'&&k!=='.')npVal=k;
  else npVal+=k;
  updateNpDisplay();
}
function npDel(){npVal=npVal.slice(0,-1);updateNpDisplay();}
function npIncr(d){
  var cur=parseFloat(npVal)||0;
  var next=Math.max(0,+(cur+d).toFixed(2));
  npVal=String(next);
  updateNpDisplay();
}
function updateNpDisplay(){
  var disp=document.getElementById('np-display');
  var plate=document.getElementById('np-plate');
  if(disp){
    if(npVal===''){disp.textContent='—';disp.className='np-display placeholder';}
    else{disp.textContent=npVal+(npField==='kg'?getUnit():'');disp.className='np-display';}
  }
  if(plate&&npField==='kg'){
    var kg=parseFloat(npVal)||0;
    plate.textContent=kg>20?'20kg bar + '+calcPlatesStr(kg):'';
  } else if(plate){plate.textContent='';}
}
function calcPlatesStr(kg){
  var side=(kg-20)/2;if(side<=0)return '';
  var plates=[25,20,15,10,5,2.5,1.25],res=[];
  plates.forEach(function(p){var c=Math.floor(side/p);if(c>0){res.push(c+'×'+p);side=+(side-c*p).toFixed(2);}});
  return res.join(' / ')+' per side';
}
function npDone(){
  if(npTarget&&npVal!=='')npTarget.value=npVal;
  document.getElementById('numpad-ov').classList.remove('open');
  autosaveLog();
}
function npBgTap(e){if(e.target===document.getElementById('numpad-ov'))document.getElementById('numpad-ov').classList.remove('open');}

// ONBOARDING
var obIdx=0;
function initOnboarding(){
  if(ld('onboarded',false))return;
  var ov=document.getElementById('onboarding');
  if(!ov)return;
  ov.classList.add('show');
  obIdx=0;
  updateObSlide();
  var wrap=ov.querySelector('.ob-slides-wrap');
  var startX=0;
  if(wrap){
    wrap.addEventListener('touchstart',function(e){startX=e.touches[0].clientX;},{passive:true});
    wrap.addEventListener('touchend',function(e){
      var dx=e.changedTouches[0].clientX-startX;
      if(Math.abs(dx)>50){if(dx<0&&obIdx<2)obIdx++;else if(dx>0&&obIdx>0)obIdx--;updateObSlide();}
    },{passive:true});
  }
}
function goToSlide(n){obIdx=n;updateObSlide();}
function updateObSlide(){
  var slides=document.getElementById('ob-slides');
  var dots=document.querySelectorAll('.ob-dot');
  if(slides)slides.style.transform='translateX(-'+obIdx+'00%)';
  dots.forEach(function(d,i){d.classList.toggle('on',i===obIdx);});
}
function finishOnboarding(){
  sv('onboarded',true);
  var ov=document.getElementById('onboarding');
  if(ov)ov.classList.remove('show');
}

