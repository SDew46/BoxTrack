import { ld, sv, toast, fmtWt, fmtDate, fmtSecs, getUnit, getPR, openOverlay, closeOverlay, userDataCache } from './app.js';
import { TRACKED_LIFTS, CAT_META } from './data.js';
import { db } from './firebase.js';
import { collection, deleteDoc, doc } from 'firebase/firestore';

// PROGRESS
function renderProgress(){renderWeeklySummary();renderLifts();renderRecentSessions();renderFreestyleSessions();renderBoxingLog();}
function renderFreestyleSessions(){
  var sessions=ld('freestyleSessions',[]);
  var el=document.getElementById('freestyle-sessions-list');if(!el)return;
  if(!sessions.length){
    el.innerHTML='<div class="empty-state" style="padding:24px"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><div class="empty-state-head">NO SESSIONS YET</div><div class="empty-state-sub">Complete a Freestyle session to see it here.</div></div>';
    return;
  }
  el.innerHTML=sessions.slice(-5).reverse().map(function(s){
    return '<div class="rec-sess"><div class="rs-hd"><div><span class="rs-date">'+fmtDate(s.date)+'</span></div>'
      +'<div style="display:flex;align-items:center;gap:8px"><span style="font-size:10px;color:var(--muted)">'+(s.totalMins||s.totalMinutes||0)+' min</span>'
      +'<span class="tag" style="color:var(--red);background:rgba(230,57,70,0.12)">BOX</span>'
      +'<button class="del-x" onclick="delFreestyleSession('+s.id+')">×</button></div></div>'
      +'<div class="rs-pills"><span class="rs-pill">'+s.rounds+' rounds</span><span class="rs-pill">'+(s.roundDurationMins||s.roundDuration||3)+' min rounds</span></div></div>';
  }).join('');
}
function delFreestyleSession(id){
  if(!confirm('Delete this session?'))return;
  if(userDataCache.boxingSessions!==null){
    var entry=userDataCache.boxingSessions.find(function(s){return s.id===id&&s.type==='freestyle';});
    if(entry&&entry._firestoreId&&window.currentUser){
      deleteDoc(doc(db,'users',window.currentUser.uid,'boxingSessions',entry._firestoreId)).catch(function(e){console.error('Firestore delete failed:',e);});
    }
    var idx=userDataCache.boxingSessions.indexOf(entry);
    if(idx>-1)userDataCache.boxingSessions.splice(idx,1);
  }
  renderProgress();
  toast('Session deleted');
}
function getMondayOfWeek(date){
  var d=new Date(date);var day=d.getDay();var diff=day===0?-6:1-day;
  d.setDate(d.getDate()+diff);d.setHours(0,0,0,0);return d;
}
function getWeekMessage(sessionsThisWeek,totalSessions,dayOfWeek){
  if(totalSessions===0)return "Your first session is waiting. Let's go.";
  if(sessionsThisWeek===0&&(dayOfWeek===1||dayOfWeek===2||dayOfWeek===3))return "New week. What are we doing today?";
  if(sessionsThisWeek===0&&(dayOfWeek===4||dayOfWeek===5))return "Week's not over. One session changes everything.";
  if(sessionsThisWeek===0&&(dayOfWeek===0||dayOfWeek===6))return "Still time. Make it count.";
  if(sessionsThisWeek===1)return "Good start. Build on it.";
  if(sessionsThisWeek===2)return "Momentum building. Keep going.";
  if(sessionsThisWeek===3)return "Strong week. Finish it well.";
  if(sessionsThisWeek>=4)return "Exceptional week. Your coach would be proud.";
}
function renderWeeklySummary(){
  var banner=document.getElementById('weekly-banner');
  if(!banner)return;
  if(window.currentUser&&userDataCache.sessions===null){
    banner.innerHTML='<div style="width:100%;padding:20px 16px;background:#141414;border-bottom:1px solid var(--border)"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px"><div><span style="font-family:\'Bebas Neue\',sans-serif;font-size:48px;color:var(--dim)">—</span><span style="font-family:\'DM Sans\',sans-serif;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:var(--dim);margin-left:6px;vertical-align:bottom">THIS WEEK</span></div></div><div style="font-family:\'DM Sans\',sans-serif;font-size:15px;color:var(--dim);line-height:1.5">Loading your week...</div></div>';
    return;
  }
  var now=new Date();
  var monday=getMondayOfWeek(now);
  var sunday=new Date(monday);sunday.setDate(monday.getDate()+6);sunday.setHours(23,59,59,999);
  var dayOfWeek=now.getDay();
  var sessions=ld('sessions',[]);
  var boxing=ld('boxingClasses',[]);
  var freestyle=ld('freestyleSessions',[]);
  function isThisWeek(dateStr){var d=new Date(dateStr+'T00:00:00');return d>=monday&&d<=sunday;}
  var gymThisWeek=sessions.filter(function(s){return isThisWeek(s.date);}).length;
  var boxingThisWeek=boxing.concat(freestyle).filter(function(s){return isThisWeek(s.date);}).length;
  var sessionsThisWeek=gymThisWeek+boxingThisWeek;
  var totalSessions=sessions.length+boxing.length+freestyle.length;
  var msg=getWeekMessage(sessionsThisWeek,totalSessions,dayOfWeek);
  var pillsHtml='';
  if(sessionsThisWeek>0){
    pillsHtml='<div style="display:flex;gap:16px;margin-top:10px">';
    if(gymThisWeek>0)pillsHtml+='<span style="font-family:\'DM Sans\',sans-serif;font-size:11px;color:var(--dim);background:#1e1e1e;padding:3px 8px;border-radius:20px">'+gymThisWeek+' GYM</span>';
    if(boxingThisWeek>0)pillsHtml+='<span style="font-family:\'DM Sans\',sans-serif;font-size:11px;color:var(--dim);background:#1e1e1e;padding:3px 8px;border-radius:20px">'+boxingThisWeek+' BOXING</span>';
    pillsHtml+='</div>';
  }
  banner.innerHTML='<div style="width:100%;padding:20px 16px;background:#141414;border-bottom:1px solid var(--border)">'
    +'<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">'
      +'<div>'
        +'<span style="font-family:\'Bebas Neue\',sans-serif;font-size:48px;color:var(--text)">'+sessionsThisWeek+'</span>'
        +'<span style="font-family:\'DM Sans\',sans-serif;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:var(--dim);margin-left:6px;vertical-align:bottom">THIS WEEK</span>'
      +'</div>'
      +'<div>'
        +'<span style="font-family:\'Bebas Neue\',sans-serif;font-size:24px;color:var(--gold)">'+totalSessions+'</span>'
        +'<span style="font-family:\'DM Sans\',sans-serif;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:var(--dim);margin-left:4px">TOTAL</span>'
      +'</div>'
    +'</div>'
    +'<div style="font-family:\'DM Sans\',sans-serif;font-size:15px;color:var(--muted);line-height:1.5">'+msg+'</div>'
    +pillsHtml
  +'</div>';
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
  if(diff>0)return '<span style="color:var(--green)">↑ '+fmtWt(diff)+' added in the last 4 weeks</span>';
  if(diff<0)return '<span style="color:var(--muted)">↓ '+fmtWt(Math.abs(diff))+' in the last 4 weeks — keep pushing</span>';
  return '<span style="color:var(--muted)">Consistent — holding '+fmtWt(bestNow)+'</span>';
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
function renderRecentSessions(){
  const all=ld('sessions',[]);
  const el=document.getElementById('recent-list');
  if(!el)return;
  if(!all.length){
    el.innerHTML='<div class="empty-state"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><div class="empty-state-head">NO SESSIONS YET</div><div class="empty-state-sub">Pick a session from the Train tab and log your first workout.</div></div>';
    return;
  }
  el.innerHTML=all.slice(-5).reverse().map(function(s){
    var meta=CAT_META[s.cat]||CAT_META.CUSTOM;
    var pills=[...s.exercises,...(s.extras||[])].filter(function(ex){return (ex.sets||[]).some(function(r){return r.kg;});}).map(function(ex){
      var maxKg=Math.max(...ex.sets.map(function(r){return parseFloat(r.kg);}).filter(function(v){return !isNaN(v);}));
      var exStyle=ex.extra?' style="color:var(--gold)"':'';
      return '<span class="rs-pill"'+exStyle+'>'+ex.name+' · '+fmtWt(maxKg)+'</span>';
    }).join('');
    var durHtml=s.duration?'<span style="font-size:10px;color:var(--dim)">⏱'+s.duration+'m</span>':'';
    var nameHtml=s.sessName?'<div style="font-size:10px;color:var(--muted);margin-top:1px">'+s.sessName+'</div>':'';
    var pillsHtml=pills?'<div class="rs-pills">'+pills+'</div>':'<div style="font-size:12px;color:var(--dim)">No weights recorded</div>';
    var notesHtml=s.notes?'<div class="rs-note">"'+s.notes+'"</div>':'';
    return '<div class="rec-sess">'
      +'<div class="rs-hd">'
        +'<div><span class="rs-date">'+fmtDate(s.date)+'</span>'+nameHtml+'</div>'
        +'<div style="display:flex;align-items:center;gap:6px">'
          +durHtml
          +'<span class="tag" style="color:'+meta.color+';background:'+meta.color+'18">'+s.cat+'</span>'
          +'<button class="del-x" onclick="delRecentSession('+s.id+')">×</button>'
        +'</div>'
      +'</div>'
      +pillsHtml
      +notesHtml
    +'</div>';
  }).join('');
}
function delRecentSession(id){
  if(!confirm('Delete this session?'))return;
  if(userDataCache.sessions!==null){
    var idx=userDataCache.sessions.findIndex(function(s){return s.id===id;});
    if(idx>-1){
      var entry=userDataCache.sessions[idx];
      if(entry&&entry._firestoreId&&window.currentUser){
        deleteDoc(doc(db,'users',window.currentUser.uid,'sessions',entry._firestoreId)).catch(function(e){console.error('Firestore delete failed:',e);});
      }
      userDataCache.sessions.splice(idx,1);
    }
  }
  renderProgress();
  toast('Session deleted');
}
function renderBoxingLog(){const classes=ld('boxingClasses',[]),wrap=document.getElementById('boxing-log-wrap'),empty=document.getElementById('boxing-log-empty'),list=document.getElementById('boxing-log-list');if(!classes.length){wrap.style.display='none';empty.innerHTML='<div class="empty-state"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg><div class="empty-state-head">NO CLASSES LOGGED YET</div><div class="empty-state-sub">Tap below to log a boxing class.</div></div><div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="ibtn" onclick="openBoxingModal()">+ Log Boxing Class</button></div>';return;}wrap.style.display='block';empty.style.display='none';const fm={great:'f-gr',good:'f-gd',ok:'f-ok',hard:'f-hd'},fl={great:'Great',good:'Good',ok:'OK',hard:'Tough'};list.innerHTML=classes.slice(-8).reverse().map((c,ri)=>{const realIdx=classes.length-1-ri;return `<div class="bi"><div><span class="bi-date">${fmtDate(c.date)}</span>${c.notes?`<div style="font-size:11px;color:var(--muted);margin-top:2px">${c.notes}</div>`:''}</div><div style="display:flex;align-items:center;gap:7px"><span class="fp ${fm[c.feel]||'f-gd'}">${fl[c.feel]||'Good'}</span><button class="del-x" onclick="delBoxing(${realIdx})">×</button></div></div>`;}).join('');}
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
window.delRecentSession = delRecentSession;
window.delFreestyleSession = delFreestyleSession;
