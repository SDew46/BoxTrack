import { ld, sv, toast, fmtWt, fmtDate, fmtSecs, getUnit, getPR, openOverlay, closeOverlay, userDataCache } from './app.js';
import { TRACKED_LIFTS, CAT_META } from './data.js';
import { db } from './firebase.js';
import { collection, deleteDoc, doc } from 'firebase/firestore';

// PROGRESS
function renderProgress(){renderStreak();renderLifts();renderRecentSessions();renderFreestyleSessions();renderBoxingLog();}
function renderFreestyleSessions(){
  var sessions=ld('freestyleSessions',[]);
  var el=document.getElementById('freestyle-sessions-list');if(!el)return;
  if(!sessions.length){
    el.innerHTML='<div class="empty-state" style="padding:24px"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><div class="empty-state-head">NO SESSIONS YET</div><div class="empty-state-sub">Complete a Freestyle session to see it here.</div></div>';
    return;
  }
  el.innerHTML=sessions.slice(-5).reverse().map(function(s){
    return '<div class="rec-sess"><div class="rs-hd"><div><span class="rs-date">'+fmtDate(s.date)+'</span></div><div style="display:flex;align-items:center;gap:8px"><span style="font-size:10px;color:var(--muted)">'+(s.totalMins||s.totalMinutes||0)+' min</span><span class="tag" style="color:var(--red);background:rgba(230,57,70,0.12)">BOX</span></div></div><div class="rs-pills"><span class="rs-pill">'+s.rounds+' rounds</span><span class="rs-pill">'+(s.roundDurationMins||s.roundDuration||3)+' min rounds</span></div></div>';
  }).join('');
}
function getMondayOfWeek(date){
  var d=new Date(date);var day=d.getDay();var diff=day===0?-6:1-day;
  d.setDate(d.getDate()+diff);d.setHours(0,0,0,0);return d;
}
function renderStreak(){
  var all=ld('sessions',[]),classes=ld('boxingClasses',[]);
  var allDates=new Set([...all.map(function(s){return s.date;}),...classes.map(function(c){return c.date;})]);
  var streak=0;
  var thisMonday=getMondayOfWeek(new Date());
  for(var w=0;w<52;w++){
    var ws=new Date(thisMonday);ws.setDate(thisMonday.getDate()-w*7);
    var we=new Date(ws);we.setDate(ws.getDate()+6);we.setHours(23,59,59,999);
    var hasSession=[...allDates].some(function(d){var dt=new Date(d+'T00:00:00');return dt>=ws&&dt<=we;});
    if(hasSession){streak++;}else if(w>0){break;}
  }
  var total=all.length+classes.length;
  if(total===0){
    document.getElementById('streak-area').innerHTML='<div class="empty-state"><svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><div class="empty-state-head">YOUR JOURNEY STARTS HERE</div><div class="empty-state-sub">Complete your first session to start tracking progress.</div></div>';
    return;
  }
  var heroNum=streak>0?streak:total;
  var heroLbl=streak>0?'WEEK STREAK':'SESSIONS LOGGED';
  var heroSub=streak>0?'weeks with at least one session':'';
  var heroCtx=streak>0?(streak===1?'Keep it going this week.':streak>=4?'Exceptional consistency.':'Consistency wins fights.'):'Train this week to start your streak.';
  var freeSessions=ld('freestyleSessions',[]);
  var totalRounds=freeSessions.reduce(function(a,s){return a+(s.rounds||0);},0);
  var statRows='<div style="display:flex;gap:24px;margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">'
    +'<div><div class="stat-n" style="color:var(--gold)">'+all.length+'</div><div class="stat-l">Gym</div></div>'
    +'<div><div class="stat-n" style="color:var(--gold)">'+classes.length+'</div><div class="stat-l">Boxing</div></div>'
    +'<div><div class="stat-n" style="color:var(--gold)">'+totalRounds+'</div><div class="stat-l">Rounds</div></div>'
    +'</div>';
  document.getElementById('streak-area').innerHTML='<div class="prog-card" style="padding:24px 20px">'
    +'<div class="streak-big">'+heroNum+'</div>'
    +'<div class="streak-lbl">'+heroLbl+'</div>'
    +(heroSub?'<div style="font-size:12px;color:var(--dim);margin-top:2px;font-weight:600;letter-spacing:0.5px">'+heroSub+'</div>':'')
    +'<div class="streak-hint">'+heroCtx+'</div>'
    +statRows+'</div>';
}
function calc1RM(weight,reps){if(reps===1)return weight;return Math.round(weight*(1+reps/30));}
function buildNarrative(history){
  if(history.length<2)return '<div style="font-size:14px;color:var(--dim);margin-bottom:8px">Keep going — trends show after 2 sessions</div>';
  var now=new Date(),cutoff=new Date(now);cutoff.setDate(now.getDate()-28);
  var recent=history.filter(function(h){return new Date(h.date+'T00:00:00')>=cutoff;});
  var older=history.filter(function(h){return new Date(h.date+'T00:00:00')<cutoff;});
  var bestNow=recent.length?Math.max.apply(null,recent.map(function(h){return h.kg;})):null;
  var bestOld=older.length?Math.max.apply(null,older.map(function(h){return h.kg;})):null;
  if(bestNow===null||bestOld===null)return '<div style="font-size:14px;color:var(--dim);margin-bottom:8px">Keep going — trends show after 2 sessions</div>';
  var diff=+(bestNow-bestOld).toFixed(1);
  if(diff>0)return '<div style="font-size:14px;color:var(--green);margin-bottom:8px">↑ '+diff+'kg added in the last 4 weeks</div>';
  if(diff===0)return '<div style="font-size:14px;color:var(--muted);margin-bottom:8px">Consistent — holding '+fmtWt(bestNow)+'</div>';
  return '<div style="font-size:14px;color:var(--muted);margin-bottom:8px">Consistent — holding '+fmtWt(bestNow)+'</div>';
}
function renderLifts(){
  var all=ld('sessions',[]);var liftMap={};
  TRACKED_LIFTS.forEach(function(l){liftMap[l.name]=[];});
  all.forEach(function(s){s.exercises.forEach(function(ex){
    var tracked=TRACKED_LIFTS.find(function(l){return l.name===ex.name||l.name===ex.originalName;});
    if(!tracked)return;
    var kgs=(ex.sets||[]).map(function(r){return parseFloat(r.kg);}).filter(function(v){return !isNaN(v)&&v>0;});
    if(!kgs.length)return;
    var maxKg=Math.max.apply(null,kgs);
    var maxSet=(ex.sets||[]).find(function(r){return parseFloat(r.kg)===maxKg;});
    var maxReps=parseFloat((maxSet&&maxSet.reps)||1)||1;
    liftMap[tracked.name].push({date:s.date,kg:maxKg,e1rm:calc1RM(maxKg,maxReps)});
  });});
  var content=document.getElementById('prog-content');
  if(!all.length){content.innerHTML='<div class="empty-state"><svg viewBox="0 0 24 24"><line x1="4" y1="20" x2="20" y2="20"/><rect x="8" y="12" width="3" height="8"/><rect x="13" y="8" width="3" height="12"/><rect x="18" y="4" width="3" height="16"/></svg><div class="empty-state-head">NO LIFT DATA YET</div><div class="empty-state-sub">Log a strength session to start tracking your numbers.</div></div>';return;}
  content.innerHTML=TRACKED_LIFTS.map(function(lift){
    var history=liftMap[lift.name];
    if(!history.length)return '<div class="prog-card"><div class="pc-ttl">'+lift.name+'<span class="pc-best">No data</span></div><div class="pc-sub">'+lift.sessLabel+'</div><div class="empty">Log this lift to start tracking.</div></div>';
    var best=Math.max.apply(null,history.map(function(h){return h.kg;}));
    var bestE1rm=Math.max.apply(null,history.map(function(h){return h.e1rm||h.kg;}));
    var chart=history.length>=2?buildChart(history,lift.color):'';
    var pr=getPR(lift.name);
    var prHtml=pr?('<div style="font-size:13px;color:var(--gold);margin-bottom:2px">PB '+fmtWt(pr.kg)+'</div><div style="font-size:12px;color:var(--dim);margin-bottom:8px">Set '+fmtDate(pr.date)+'</div>'):'';
    var narrative=buildNarrative(history);
    var rows=history.slice(-5).reverse().map(function(h,i,arr){
      var prev=i<arr.length-1?arr[i+1].kg:null;var delta='';
      if(prev!==null){var d=+(h.kg-prev).toFixed(1);if(d>0)delta='<span class="delta d-up">+'+d+'</span>';else if(d<0)delta='<span class="delta d-dn">'+d+'</span>';else delta='<span class="delta d-eq">—</span>';}
      return '<div class="lr"><span class="lr-date">'+fmtDate(h.date)+'</span>'+delta+'<span class="lr-wt" style="color:var(--gold)">'+fmtWt(h.kg)+'</span></div>';
    }).join('');
    return '<div class="prog-card"><div class="pc-ttl">'+lift.name+'<span class="pc-best">Best: '+fmtWt(best)+'</span></div><div class="pc-sub">'+lift.sessLabel+'</div>'+prHtml+'<div class="pc-1rm">Est. 1RM: '+fmtWt(bestE1rm)+' <span style="font-weight:400;color:var(--dim)">(Epley)</span></div>'+narrative+chart+rows+'</div>';
  }).join('');
}
function renderRecentSessions(){const all=ld('sessions',[]);const el=document.getElementById('recent-list');if(!all.length){el.innerHTML='<div class="empty-state"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><div class="empty-state-head">NO SESSIONS YET</div><div class="empty-state-sub">Pick a session from the Train tab and log your first workout.</div></div>';return;}el.innerHTML=all.slice(-5).reverse().map(s=>{const meta=CAT_META[s.cat]||CAT_META.CUSTOM;const pills=[...s.exercises,...(s.extras||[])].filter(ex=>(ex.sets||[]).some(r=>r.kg)).map(ex=>{const maxKg=Math.max(...ex.sets.map(r=>parseFloat(r.kg)).filter(v=>!isNaN(v)));return `<span class="rs-pill" style="${ex.extra?'color:var(--gold)':''}">${ex.name} · ${fmtWt(maxKg)}</span>`;}).join('');return `<div class="rec-sess"><div class="rs-hd"><div><span class="rs-date">${fmtDate(s.date)}</span>${s.sessName?`<div style="font-size:10px;color:var(--muted);margin-top:1px">${s.sessName}</div>`:''}</div><div style="display:flex;align-items:center;gap:6px">${s.duration?`<span style="font-size:10px;color:var(--dim)">⏱${s.duration}m</span>`:''}<span class="tag" style="color:${meta.color};background:${meta.color}18">${s.cat}</span></div></div>${pills?`<div class="rs-pills">${pills}</div>`:'<div style="font-size:12px;color:var(--dim)">No weights recorded</div>'}${s.notes?`<div class="rs-note">"${s.notes}"</div>`:''}</div>`;}).join('');}
function renderBoxingLog(){const classes=ld('boxingClasses',[]),wrap=document.getElementById('boxing-log-wrap'),empty=document.getElementById('boxing-log-empty'),list=document.getElementById('boxing-log-list');if(!classes.length){wrap.style.display='none';empty.style.display='block';empty.innerHTML='<div class="empty-state"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg><div class="empty-state-head">NO ROUNDS LOGGED YET</div><div class="empty-state-sub">Head to the Box tab and start your first round.</div></div>';return;}wrap.style.display='block';empty.style.display='none';const fm={great:'f-gr',good:'f-gd',ok:'f-ok',hard:'f-hd'},fl={great:'Great',good:'Good',ok:'OK',hard:'Tough'};list.innerHTML=classes.slice(-8).reverse().map((c,ri)=>{const realIdx=classes.length-1-ri;return `<div class="bi"><div><span class="bi-date">${fmtDate(c.date)}</span>${c.notes?`<div style="font-size:11px;color:var(--muted);margin-top:2px">${c.notes}</div>`:''}</div><div style="display:flex;align-items:center;gap:7px"><span class="fp ${fm[c.feel]||'f-gd'}">${fl[c.feel]||'Good'}</span><button class="del-x" onclick="delBoxing(${realIdx})">×</button></div></div>`;}).join('');}
function delBoxing(idx){
  if(!confirm('Delete this boxing class?'))return;
  if(userDataCache.boxingSessions!==null){
    var classes=userDataCache.boxingSessions.filter(function(s){return s.type==='class';});
    var entry=classes[idx];
    if(entry&&entry._firestoreId&&window.currentUser){
      deleteDoc(doc(db,'users',window.currentUser.uid,'boxingSessions',entry._firestoreId)).catch(function(){});
    }
    var globalIdx=userDataCache.boxingSessions.indexOf(entry);
    if(globalIdx>-1)userDataCache.boxingSessions.splice(globalIdx,1);
  }
  renderProgress();
}
function buildChart(history,color){const vals=history.map(h=>h.kg);const min=Math.min(...vals)*0.92,max=Math.max(...vals)*1.08;const w=300,h=46,pad=8;const pts=vals.map((v,i)=>{const x=pad+(i/(vals.length-1))*(w-pad*2);const y=h-pad-((v-min)/(max-min||1))*(h-pad*2);return x.toFixed(1)+','+y.toFixed(1);}).join(' ');const last=pts.split(' ').pop().split(',');const fill=pts+' '+(w-pad).toFixed(1)+','+h+' '+pad+','+h;const cid='g'+color.replace('#','');return '<svg class="spark" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none"><defs><linearGradient id="'+cid+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="'+color+'" stop-opacity="0.22"/><stop offset="100%" stop-color="'+color+'" stop-opacity="0"/></linearGradient></defs><polygon points="'+fill+'" fill="url(#'+cid+')"/><polyline points="'+pts+'" fill="none" stroke="'+color+'" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/><circle cx="'+last[0]+'" cy="'+last[1]+'" r="3" fill="'+color+'"/></svg>';}

// ─── EXPOSE TO HTML ONCLICK HANDLERS ─────────────────────────────────────────
export { renderProgress };
window.renderProgress = renderProgress;
window.delBoxing = delBoxing;

