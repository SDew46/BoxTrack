import { auth, db } from './firebase.js';
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, getRedirectResult, GoogleAuthProvider, signOut as fbSignOut,
  sendEmailVerification, sendPasswordResetEmail, deleteUser, updateProfile, reload
} from 'firebase/auth';
import {
  doc, getDoc, setDoc, getDocs, collection, addDoc, deleteDoc, serverTimestamp, writeBatch, onSnapshot, updateDoc
} from 'firebase/firestore';
import { EQUIP_OPTIONS, ACCENT_COLORS } from './data.js';

// ─── DEBUG FLAG ───────────────────────────────────────────────────────────────
const DEBUG = false;

// ─── SECURITY UTILITIES ───────────────────────────────────────────────────────
export function sanitise(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

export function isSafeEmbedUrl(url) {
  return typeof url === 'string' &&
    url.startsWith('https://www.youtube.com/embed/');
}

function sanitiseImport(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  ['__proto__', 'constructor', 'prototype'].forEach(function(k) { delete obj[k]; });
  Object.keys(obj).forEach(function(k) {
    if (typeof obj[k] === 'object') sanitiseImport(obj[k]);
  });
  return obj;
}

function hasLongString(obj) {
  if (typeof obj === 'string') return obj.length > 500;
  if (typeof obj === 'object' && obj !== null) {
    return Object.values(obj).some(function(v) { return hasLongString(v); });
  }
  return false;
}

function chunkArray(arr, size) {
  var chunks = [];
  for (var i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ─── SHARED MUTABLE STATE ──────────────────────────────────────────────────────
// Assigned to window so train.js / box.js can read as bare names and write as window.x
window.activeEquipment = new Set(EQUIP_OPTIONS.map(e => e.id));
window.activeLogSession = null;
window.currentUser = null;
window.userProfile = null;
window.activeAssignedSessionId = null;

// ─── USER DATA CACHE ───────────────────────────────────────────────────────────
// null = not yet loaded from Firestore (fall back to localStorage).
// Once loaded, ld() returns from cache instead of localStorage for these keys.
export var userProfile = null; // populated by ensureUserProfile on every sign-in
export const userDataCache = {
  sessions: null,
  boxingSessions: null,   // covers freestyle timer sessions + boxing class logs
  customCombos: null,
  customSessions: null,
  assignedSessions: null
};

// ─── STORAGE ───────────────────────────────────────────────────────────────────
export const ld = (k, fb) => {
  if (window.currentUser) {
    if (k === 'sessions' && userDataCache.sessions !== null) return userDataCache.sessions;
    if (k === 'freestyleSessions' && userDataCache.boxingSessions !== null)
      return userDataCache.boxingSessions.filter(function(s){return s.type === 'freestyle';});
    if (k === 'boxingClasses' && userDataCache.boxingSessions !== null)
      return userDataCache.boxingSessions.filter(function(s){return s.type === 'class';});
    if (k === 'customCombos' && userDataCache.customCombos !== null) return userDataCache.customCombos;
    if (k === 'customSessions' && userDataCache.customSessions !== null) return userDataCache.customSessions;
  }
  try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch(e) { return fb; }
};
export const sv = (k, v) => localStorage.setItem(k, JSON.stringify(v));
export const getUnit = () => ld('unit', 'kg');
export const fmtWt = v => v ? v + getUnit() : '—';
export function fmtDate(str) {
  var d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'2-digit'});
}
export function fmtSecs(s) {
  var m = Math.floor(s / 60);
  return m + ':' + (s % 60).toString().padStart(2, '0');
}
var toastTimer;
export function toast(msg, err) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = err ? 'var(--red)' : 'var(--green)';
  t.style.color = err ? '#fff' : '#000';
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){t.classList.remove('show');}, 2400);
}

// ─── NAV ───────────────────────────────────────────────────────────────────────
var lastProgressRead = 0;
export function showPage(id) {
  ['train','box','progress','profile'].forEach(function(p, i) {
    document.getElementById('page-'+p).classList.toggle('active', p === id);
    document.querySelectorAll('.nav-btn')[i].classList.toggle('on', p === id);
  });
  if (id === 'train') { checkDeload(); applyBranding(); }
  if (id === 'box') { initBoxPage(); }
  if (id === 'progress') {
    var now = Date.now();
    if (now - lastProgressRead < 60000 && userDataCache.sessions !== null) {
      renderProgress(); // data fresh — use cache, skip Firestore re-fetch
    } else {
      lastProgressRead = now;
      renderProgress();
    }
  }
  if (id === 'profile') { renderProfile(); }
}
export function openOverlay(id) { document.getElementById(id).classList.add('open'); }
export function closeOverlay(id, e) {
  if (e && e.target !== document.getElementById(id)) return;
  document.getElementById(id).classList.remove('open');
}

// ─── BRANDING ─────────────────────────────────────────────────────────────────
export function initBranding() {
  var sw = document.getElementById('color-swatches'); if (!sw) return;
  var cur = ld('accentColor', '#D63040');
  sw.innerHTML = ACCENT_COLORS.map(function(c) {
    return '<div class="sw ' + (c.val === cur ? 'on' : '') + '" style="background:' + c.val + '" onclick="setAccent(\'' + c.val + '\')"></div>';
  }).join('');
  var inp = document.getElementById('brand-name-inp');
  if (inp) { var n = ld('appName', ''); if (n) inp.value = n; }
}
export function applyBranding() {
  var color = ld('accentColor', '#D63040'), name = ld('appName', '') || '8RB';
  document.documentElement.style.setProperty('--accent', color);
  var el = document.getElementById('train-title');
  if (el) {
    var sub = name === '8RB' ? 'by 8 Rounds Boxing' : '';
    el.innerHTML = '<div class="sh-wordmark-main">' + sanitise(name) + '</div>' + (sub ? '<div class="sh-wordmark-sub">' + sub + '</div>' : '');
  }
  var eye = document.getElementById('train-eye'); if (eye) eye.style.color = color;
}
function saveBrandName() { sv('appName', document.getElementById('brand-name-inp').value || ''); applyBranding(); }
function setAccent(val) {
  sv('accentColor', val);
  document.querySelectorAll('.sw').forEach(function(s) { s.classList.toggle('on', s.style.background === val || s.style.backgroundColor === val); });
  applyBranding(); toast('Accent colour updated');
}
export function openSettings() { initBranding(); renderSettingsPanel(); document.getElementById('settings-ov').classList.add('open'); }
function closeSettings(e) { if (e && e.target !== document.getElementById('settings-ov')) return; document.getElementById('settings-ov').classList.remove('open'); }
function closeSettingsBtn() { document.getElementById('settings-ov').classList.remove('open'); }

// ─── PROFILE TAB ───────────────────────────────────────────────────────────────
export function renderProfile() {
  var el = document.getElementById('profile-content');
  if (!el) return;
  var user = window.currentUser;
  if (!user) { el.innerHTML = '<div class="empty" style="padding:32px 0;color:var(--dim)">Not signed in.</div>'; return; }
  var providerLabel = (user.providerData && user.providerData[0] && user.providerData[0].providerId === 'google.com') ? 'Google' : 'Email & password';
  var displayName = user.displayName || '—';
  var unit = getUnit();
  var curAccent = ld('accentColor', '#D63040');
  var swatchHtml = ACCENT_COLORS.map(function(c) {
    return '<div class="sw ' + (c.val === curAccent ? 'on' : '') + '" style="background:' + c.val + '" onclick="setAccent(\'' + c.val + '\')"></div>';
  }).join('');
  el.innerHTML =
    '<div class="sec-lbl">ACCOUNT</div>'
    + '<div class="sg">'
      + '<div class="sr" id="pf-name-row">'
        + '<div style="flex:1"><div class="sr-lbl">Display Name</div><div class="sr-sub" id="pf-name-val">' + sanitise(displayName) + '</div></div>'
        + '<button class="sr-act" onclick="editDisplayName()">EDIT</button>'
      + '</div>'
      + '<div class="sr"><div style="flex:1"><div class="sr-lbl">Email</div><div class="sr-sub">' + sanitise(user.email || '—') + '</div></div></div>'
      + '<div class="sr"><div style="flex:1"><div class="sr-lbl">Signed in with</div><div class="sr-sub">' + providerLabel + '</div></div></div>'
      + '<div class="sr"><div style="flex:1"><div class="sr-lbl">Member since</div><div class="sr-sub" id="pf-join-date">—</div></div></div>'
      + '<div class="sr"><div style="flex:1"><div class="sr-lbl">Sign Out</div></div><button class="sr-act" onclick="handleSignOut()">SIGN OUT</button></div>'
    + '</div>'
    + '<div class="sec-lbl" style="margin-top:24px">SETTINGS</div>'
    + '<div class="sg">'
      + '<div class="sr"><div class="sr-lbl">Weight Units</div><div class="unit-seg"><button class="us ' + (unit==='kg'?'on':'') + '" id="pf-unit-kg" onclick="setUnit(\'kg\')">kg</button><button class="us ' + (unit==='lbs'?'on':'') + '" id="pf-unit-lbs" onclick="setUnit(\'lbs\')">lbs</button></div></div>'
      + '<div class="sr" style="flex-direction:column;align-items:flex-start;gap:8px"><div class="sr-lbl">Accent Colour</div><div class="swatches" id="pf-color-swatches">' + swatchHtml + '</div></div>'
    + '</div>'
    + '<div class="sec-lbl" style="margin-top:24px">APP</div>'
    + '<div class="sg">'
      + '<div class="sr"><div class="sr-lbl">Version</div><div style="font-size:12px;color:var(--dim)">8RB by 8 Rounds Boxing · v11.0.0</div></div>'
      + '<div class="sr"><div style="flex:1"><div class="sr-lbl">Install as App</div><div class="sr-sub">Chrome · tap ⋮ · Add to Home Screen</div></div></div>'
      + '<div class="sr"><div style="flex:1"><div class="sr-lbl">Rate this App</div><div class="sr-sub">Coming soon</div></div></div>'
    + '</div>'
    + '<div class="sec-lbl" style="margin-top:24px">DATA</div>'
    + '<div class="sg">'
      + '<div class="sr"><div style="flex:1"><div class="sr-lbl">Export Data</div><div class="sr-sub">Download your data as a backup file</div></div><button class="sr-act" onclick="exportData()">EXPORT</button></div>'
      + '<div class="sr"><div style="flex:1"><div class="sr-lbl">Import Data</div><div class="sr-sub">Restore sessions from a backup</div></div><button class="sr-act" onclick="document.getElementById(\'import-file\').click()">IMPORT</button></div>'
      + '<div class="sr"><div style="flex:1"><div class="sr-lbl" style="color:var(--red)">Delete Account</div><div class="sr-sub">Permanently deletes your account and all data. Cannot be undone.</div></div><button class="sr-act dng" onclick="confirmDeleteAccount()">DELETE</button></div>'
    + '</div>';
  // Patch in join date asynchronously — everything else renders immediately above
  getDoc(doc(db, 'users', user.uid, 'profile', 'data')).then(function(snap) {
    if (snap.exists() && snap.data().joinDate) {
      var jd = snap.data().joinDate.toDate ? snap.data().joinDate.toDate() : new Date(snap.data().joinDate);
      var joinEl = document.getElementById('pf-join-date');
      if (joinEl) joinEl.textContent = jd.toLocaleDateString('en-GB', {day:'numeric',month:'long',year:'numeric'});
    }
  }).catch(function(){});
}
function editDisplayName() {
  var row = document.getElementById('pf-name-row');
  if (!row) return;
  var cur = window.currentUser ? (window.currentUser.displayName || '') : '';
  row.innerHTML = '<div style="flex:1"><div class="sr-lbl">Display Name</div><input class="brand-inp" type="text" id="pf-edit-name" value="' + sanitise(cur) + '" placeholder="Your name" style="margin-top:4px"></div><button class="sr-act" onclick="saveDisplayName()">SAVE</button>';
  var inp = document.getElementById('pf-edit-name');
  if (inp) inp.focus();
}
async function saveDisplayName() {
  var inp = document.getElementById('pf-edit-name');
  if (!inp || !window.currentUser) return;
  var name = inp.value.trim();
  if (!name) { toast('Please enter a name', true); return; }
  if (name.length > 50) { toast('Name must be 50 characters or less', true); return; }
  try {
    await updateProfile(window.currentUser, {displayName: name});
    await setDoc(doc(db, 'users', window.currentUser.uid, 'profile', 'data'), {displayName: name}, {merge: true});
    toast('Name updated');
    renderProfile();
  } catch(e) { console.error('[8RB] saveDisplayName failed:', e); toast('Failed to update name', true); }
}
function savePfBrandName() {
  var inp = document.getElementById('pf-brand-name');
  sv('appName', inp ? inp.value : '');
  applyBranding();
}
export function renderSettingsPanel() {
  var u = getUnit();
  document.getElementById('unit-kg').classList.toggle('on', u === 'kg');
  document.getElementById('unit-lbs').classList.toggle('on', u === 'lbs');
  // Storage bar
  var total = 0;
  for (var k in localStorage) { if (localStorage.hasOwnProperty(k)) total += ((localStorage[k].length + k.length) * 2); }
  var kb = Math.round(total / 1024), pct = Math.min(100, Math.round(total / (5 * 1024 * 1024) * 100));
  var fill = document.getElementById('storage-fill'), txt = document.getElementById('storage-txt');
  if (fill) fill.style.width = pct + '%';
  if (txt) txt.textContent = kb + 'KB used of ~5MB';
  // User info row
  var userRow = document.getElementById('settings-user-row');
  if (userRow && window.currentUser) {
    var displayName = window.currentUser.displayName || '';
    var email = window.currentUser.email || '';
    userRow.innerHTML = '<div class="sr"><div style="flex:1"><div class="sr-lbl">' + sanitise(displayName || 'Account') + '</div><div class="sr-sub">' + sanitise(email) + '</div></div><button class="sr-act" onclick="handleSignOut()">SIGN OUT</button></div>';
  }
  // Version
  var verEl = document.getElementById('settings-version');
  if (verEl) verEl.textContent = '8RB by 8 Rounds Boxing · v11.0.0';
}

// ─── SETTINGS ACTIONS ─────────────────────────────────────────────────────────
function setUnit(u) {
  sv('unit', u);
  ['unit-kg','pf-unit-kg'].forEach(function(id){var el=document.getElementById(id);if(el)el.classList.toggle('on',u==='kg');});
  ['unit-lbs','pf-unit-lbs'].forEach(function(id){var el=document.getElementById(id);if(el)el.classList.toggle('on',u==='lbs');});
  toast('Units set to ' + u);
}
function exportData() {
  var data = {sessions:ld('sessions',[]),boxingClasses:ld('boxingClasses',[]),customSessions:ld('customSessions',[]),customCombos:ld('customCombos',[]),equipment:ld('equipment',[]),unit:ld('unit','kg'),appName:ld('appName',''),accentColor:ld('accentColor',''),prs:ld('prs',{}),exportDate:new Date().toISOString()};
  var blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a'); a.href = url; a.download = '8rb-backup-' + new Date().toISOString().slice(0,10) + '.json'; a.click();
  URL.revokeObjectURL(url); toast('Data exported!');
}
function importData(e) {
  var file = e.target.files[0]; if (!file) return;
  var reader = new FileReader();
  reader.onload = function(ev) {
    try {
      var raw = ev.target.result;
      if (raw.length > 2 * 1024 * 1024) { toast('Import file is invalid or corrupt', true); return; }
      var data = JSON.parse(raw);
      sanitiseImport(data);
      if (JSON.stringify(data).length > 2 * 1024 * 1024) { toast('Import file is invalid or corrupt', true); return; }
      if (data.sessions !== undefined && !Array.isArray(data.sessions)) { toast('Import file is invalid or corrupt', true); return; }
      if (data.boxingClasses !== undefined && !Array.isArray(data.boxingClasses)) { toast('Import file is invalid or corrupt', true); return; }
      if (hasLongString(data)) { toast('Import file is invalid or corrupt', true); return; }
      if (data.sessions) sv('sessions', data.sessions);
      if (data.boxingClasses) sv('boxingClasses', data.boxingClasses);
      if (data.customSessions) sv('customSessions', data.customSessions);
      if (data.customCombos) sv('customCombos', data.customCombos);
      if (data.equipment) sv('equipment', data.equipment);
      if (data.unit) sv('unit', data.unit);
      if (data.appName) sv('appName', data.appName);
      if (data.accentColor) sv('accentColor', data.accentColor);
      if (data.prs) sv('prs', data.prs);
      initEquipment(); applyBranding(); renderLibrary(); renderCustomLib(); renderProgress(); renderSettingsPanel(); checkDeload();
      var count = (data.sessions||[]).length + (data.boxingClasses||[]).length;
      toast('Imported — ' + count + ' sessions restored');
    } catch(err) { toast('Import failed — file may be corrupt', true); }
  };
  reader.readAsText(file);
  e.target.value = '';
}
function clearAll() {
  if (!confirm('Delete ALL local data? Cannot be undone.')) return;
  localStorage.clear();
  window.activeLogSession = null;
  showLibraryView(); renderProgress(); renderSettingsPanel(); toast('All data cleared');
}

// ─── SERVICE WORKER ────────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    var hadController = !!navigator.serviceWorker.controller;
    var reloadPending = false;
    function reloadOnce() { if (!reloadPending) { reloadPending = true; window.location.reload(); } }
    navigator.serviceWorker.register('/BoxTrack/sw.js').then(function(reg) {
      reg.update();
      reg.addEventListener('updatefound', function() {
        var newWorker = reg.installing; if (!newWorker) return;
        newWorker.addEventListener('statechange', function() {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) reloadOnce();
        });
      });
    }).catch(function(){});
    navigator.serviceWorker.addEventListener('controllerchange', function() {
      if (hadController) reloadOnce(); hadController = true;
    });
  });
}

// ─── PR DETECTION ─────────────────────────────────────────────────────────────
export function detectPRs(record, allSessions) {
  var prs = ld('prs', {}); var prev = allSessions.slice(0, -1);
  record.exercises.forEach(function(ex) {
    var sets = (ex.sets||[]).filter(function(r){return parseFloat(r.kg) > 0;});
    if (!sets.length) return;
    var maxKg = Math.max.apply(null, sets.map(function(r){return parseFloat(r.kg);}));
    var prevBest = getPrevWtFromSessions(ex.name, prev);
    if (!prevBest || maxKg > prevBest.kg) prs[ex.name] = {kg:maxKg, date:record.date};
  });
  sv('prs', prs);
}
export function getPR(name) { var prs = ld('prs', {}); return prs[name] || null; }

// ─── NUMPAD ────────────────────────────────────────────────────────────────────
var npTarget = null, npField = 'kg', npEi = 0, npSi = 0, npVal = '';
function openNumpad(inp, field, ei, si) {
  npTarget = inp; npField = field; npEi = ei; npSi = si; npVal = inp.value || '';
  var ex = window.activeLogSession && window.activeLogSession.exercises[ei];
  var exName = ex ? ex.displayName : 'Exercise';
  document.getElementById('np-ex').textContent = exName;
  document.getElementById('np-set').textContent = 'Set ' + (si+1) + ' — ' + (field === 'kg' ? getUnit() : 'Reps');
  var prev = ex ? (getPrevWt(ex.displayName) || getPrevWt(ex.name)) : null;
  var prevEl = document.getElementById('np-prev');
  if (prevEl) prevEl.textContent = prev ? 'Last: ' + fmtWt(prev.kg) + (prev.reps ? ' × ' + prev.reps : '') + '  —  ' + fmtDate(prev.date) : 'No previous data';
  var incrEl = document.getElementById('np-incr');
  if (incrEl) {
    if (field === 'kg') {
      incrEl.innerHTML = '<button class="dec" onclick="npIncr(-2.5)">−2.5</button><button class="dec" onclick="npIncr(-1.25)">−1.25</button><button class="inc" onclick="npIncr(1.25)">+1.25</button><button class="inc" onclick="npIncr(2.5)">+2.5</button>';
    } else {
      incrEl.innerHTML = '<button class="dec" onclick="npIncr(-1)">−1</button><button class="inc" onclick="npIncr(1)">+1</button>';
    }
  }
  updateNpDisplay();
  document.getElementById('numpad-ov').classList.add('open');
}
function npKey(k) { if (k === '.' && npVal.includes('.')) return; if (npVal === '0' && k !== '.') npVal = k; else npVal += k; updateNpDisplay(); }
function npDel() { npVal = npVal.slice(0, -1); updateNpDisplay(); }
function npIncr(d) { var cur = parseFloat(npVal)||0; var next = Math.max(0, +(cur+d).toFixed(2)); npVal = String(next); updateNpDisplay(); }
function updateNpDisplay() {
  var disp = document.getElementById('np-display'), plate = document.getElementById('np-plate');
  if (disp) { if (npVal === '') { disp.textContent = '—'; disp.className = 'np-display placeholder'; } else { disp.textContent = npVal + (npField === 'kg' ? getUnit() : ''); disp.className = 'np-display'; } }
  if (plate && npField === 'kg') { var kg = parseFloat(npVal)||0; plate.textContent = kg > 20 ? '20kg bar + ' + calcPlatesStr(kg) : ''; } else if (plate) { plate.textContent = ''; }
}
function calcPlatesStr(kg) { var side=(kg-20)/2; if(side<=0)return ''; var plates=[25,20,15,10,5,2.5,1.25],res=[]; plates.forEach(function(p){var c=Math.floor(side/p);if(c>0){res.push(c+'x'+p);side=+(side-c*p).toFixed(2);}}); return res.join(' / ')+' per side'; }
function npDone() { if (npTarget && npVal !== '') npTarget.value = npVal; document.getElementById('numpad-ov').classList.remove('open'); autosaveLog(); }
function npBgTap(e) { if (e.target === document.getElementById('numpad-ov')) document.getElementById('numpad-ov').classList.remove('open'); }


// ─── OFFLINE INDICATOR ─────────────────────────────────────────────────────────
function updateOfflineIndicator() {
  var dot = document.getElementById('offline-dot');
  if (!dot) return;
  if (!navigator.onLine) {
    dot.classList.add('show');
    dot.title = "You're offline. Changes will sync when connected.";
  } else {
    dot.classList.remove('show');
  }
}
window.addEventListener('online', updateOfflineIndicator);
window.addEventListener('offline', updateOfflineIndicator);

// ─── AUTH SCREEN HELPERS ───────────────────────────────────────────────────────
function showAuthForm(which) {
  ['auth-signin','auth-signup','auth-verify'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = id === which ? 'flex' : 'none';
  });
}
export function showSignInScreen() {
  var appEl = document.getElementById('app-content');
  var authEl = document.getElementById('auth-screen');
  if (appEl) appEl.style.display = 'none';
  if (authEl) authEl.style.display = 'flex';
  showAuthForm('auth-signin');
  clearAuthErrors();
}
export function showEmailVerificationScreen(email) {
  var appEl = document.getElementById('app-content');
  var authEl = document.getElementById('auth-screen');
  if (appEl) appEl.style.display = 'none';
  if (authEl) authEl.style.display = 'flex';
  showAuthForm('auth-verify');
  var emailEl = document.getElementById('verify-email-txt');
  if (emailEl) emailEl.textContent = email || '';
  var st = document.getElementById('verify-status');
  if (st) st.textContent = 'Waiting for verification…';
  var btn = document.getElementById('manual-verify-btn');
  if (btn) { btn.textContent = "I've verified my email — continue"; btn.disabled = false; }
  startVerificationPolling();
}
export function showApp() {
  var appEl = document.getElementById('app-content');
  var authEl = document.getElementById('auth-screen');
  if (authEl) authEl.style.display = 'none';
  if (appEl) appEl.style.display = '';
  updateOfflineIndicator();
  // Restore in-progress session
  var savedSess = ld('activeLogSession', null);
  if (savedSess) { window.activeLogSession = savedSess; showLogView(); }
  initEquipment();
  applyBranding();
  renderLibrary();
  checkDeload();
  updateFsPreUI();
  loadCoachesNotes();
  // Prompt migration if localStorage has existing session data
  checkMigration();
}
function clearAuthErrors() {
  ['auth-error','auth-error-signup'].forEach(function(id){
    var el=document.getElementById(id);if(el){el.textContent='';el.style.display='none';}
  });
}
function showAuthError(msg) {
  // Target the error div inside the currently visible form
  var inSignup=document.getElementById('auth-signup')&&document.getElementById('auth-signup').style.display!=='none';
  var id=inSignup?'auth-error-signup':'auth-error';
  var errEl=document.getElementById(id);
  if(errEl){errEl.textContent=msg;errEl.style.display='block';}
}

// ─── LOAD USER DATA FROM FIRESTORE ────────────────────────────────────────────
export async function loadUserData(uid) {
  try {
    var [sessSnap, boxSnap, combosSnap, customSnap, assignedSnap] = await Promise.all([
      getDocs(collection(db, 'users', uid, 'sessions')),
      getDocs(collection(db, 'users', uid, 'boxingSessions')),
      getDocs(collection(db, 'users', uid, 'customCombos')),
      getDocs(collection(db, 'users', uid, 'customSessions')),
      getDocs(collection(db, 'users', uid, 'assignedSessions'))
    ]);
    userDataCache.sessions = sessSnap.docs.map(function(d){return Object.assign({_firestoreId:d.id}, d.data());}).sort(function(a,b){return a.date.localeCompare(b.date);});
    userDataCache.boxingSessions = boxSnap.docs.map(function(d){return Object.assign({_firestoreId:d.id}, d.data());}).sort(function(a,b){return a.date.localeCompare(b.date);});
    userDataCache.customCombos = combosSnap.docs.map(function(d){return Object.assign({_firestoreId:d.id}, d.data());});
    userDataCache.customSessions = customSnap.docs.map(function(d){return Object.assign({_firestoreId:d.id}, d.data());});
    userDataCache.assignedSessions = assignedSnap.docs.map(function(d){return Object.assign({_firestoreId:d.id}, d.data());});
  } catch(err) {
    console.warn('Failed to load from Firestore, using localStorage:', err);
    // userDataCache remains null — ld() will fall back to localStorage
  }
}

// ─── CREATE USER PROFILE ──────────────────────────────────────────────────────
async function createUserProfile(user, displayName) {
  try {
    var profileRef = doc(db, 'users', user.uid, 'profile', 'data');
    var existing = await getDoc(profileRef);
    if (!existing.exists()) {
      await setDoc(profileRef, {
        displayName: displayName || user.displayName || '',
        email: user.email || '',
        gym: '8RB',
        role: 'member',
        joinDate: serverTimestamp(),
        unit: 'kg',
        accentColour: '#D63040',
        onboarded: false
      });
    }
  } catch(err) { console.warn('Profile creation failed:', err); }
}

// ─── AUTH STATE LISTENER ──────────────────────────────────────────────────────
var authReady = false;
var authUser = null;
var splashDone = false;

// ─── VERIFY EMAIL POLLING ──────────────────────────────────────────────────────
var verifyPollInterval = null;
var verifyPollCount = 0;

function startVerificationPolling() {
  stopVerificationPolling();
  verifyPollCount = 0;
  verifyPollInterval = setInterval(async function() {
    verifyPollCount++;
    if (verifyPollCount > 20) {
      stopVerificationPolling();
      var st = document.getElementById('verify-status');
      if (st) st.textContent = 'Tap the button below if you\'ve verified.';
      return;
    }
    var user = auth.currentUser;
    if (!user) return;
    try {
      await reload(user);
      if (user.emailVerified) {
        stopVerificationPolling();
        authUser = user;
        window.currentUser = user;
        await user.getIdToken(true).catch(function(){});
        await launchApp(user);
      }
    } catch(e) { console.warn('[8RB] verify poll error:', e); }
  }, 3000);
}

function stopVerificationPolling() {
  if (verifyPollInterval) { clearInterval(verifyPollInterval); verifyPollInterval = null; }
}

async function handleManualVerifyCheck() {
  var user = auth.currentUser;
  if (DEBUG) console.log('[8RB] manualVerifyCheck: user=', user ? user.uid : 'null', 'emailVerified=', user ? user.emailVerified : 'N/A');
  if (!user) {
    console.warn('[8RB] manualVerifyCheck: no auth.currentUser — cannot proceed');
    return;
  }
  var btn = document.getElementById('manual-verify-btn');
  if (btn) { btn.textContent = 'Checking…'; btn.disabled = true; }
  try {
    await reload(user);
    if (DEBUG) console.log('[8RB] manualVerifyCheck: after reload emailVerified=', user.emailVerified);
    if (user.emailVerified) {
      stopVerificationPolling();
      authUser = user;
      window.currentUser = user;
      await user.getIdToken(true).catch(function(){});
      await launchApp(user);
    } else {
      if (btn) { btn.disabled = false; btn.textContent = 'Not verified yet — try again'; }
      setTimeout(function() { if (btn) btn.textContent = "I've verified my email — continue"; }, 2500);
    }
  } catch(e) {
    console.warn('[8RB] manualVerifyCheck error:', e);
    if (btn) { btn.disabled = false; btn.textContent = "I've verified my email — continue"; }
  }
}

// ─── ENSURE USER PROFILE ──────────────────────────────────────────────────────
// Safety net: if a verified user has no profile document, create one.
// This recovers from sign-up flows that failed partway through.
async function ensureUserProfile(user) {
  var provider = user.providerData.map(function(p){return p.providerId;}).join(',');
  if (DEBUG) console.log('[8RB] ensureUserProfile: uid=' + user.uid + ' provider=' + provider + ' emailVerified=' + user.emailVerified);
  try {
    var profileRef = doc(db, 'users', user.uid, 'profile', 'data');
    var existing = await getDoc(profileRef);
    if (DEBUG) console.log('[8RB] ensureUserProfile: profile exists=' + existing.exists());
    if (!existing.exists()) {
      console.error('[8RB] ensureUserProfile: PROFILE MISSING — creating now. Check sign-up flow for regressions.');
      var newProfile = {
        displayName: user.displayName || '',
        email: user.email || '',
        gym: '8RB',
        role: 'member',
        joinDate: serverTimestamp(),
        unit: 'kg',
        accentColour: '#D63040',
        onboarded: false
      };
      await setDoc(profileRef, newProfile);
      userProfile = { onboarded: false, role: 'member' };
      window.userProfile = userProfile;
      // Write to members registry for coach admin
      setDoc(doc(db, 'gym', '8RB', 'members', user.uid), {
        displayName: user.displayName || '',
        email: user.email || '',
        joinDate: serverTimestamp(),
        role: 'member'
      }, { merge: true }).catch(function(){});
      if (DEBUG) console.log('[8RB] ensureUserProfile: profile created successfully');
    } else {
      userProfile = existing.data();
      window.userProfile = userProfile;
      // Keep members registry in sync with current profile
      setDoc(doc(db, 'gym', '8RB', 'members', user.uid), {
        displayName: user.displayName || userProfile.displayName || '',
        email: user.email || userProfile.email || '',
        joinDate: userProfile.joinDate || null,
        role: userProfile.role || 'member'
      }, { merge: true }).catch(function(){});
    }
  } catch(err) {
    console.warn('[8RB] ensureUserProfile failed (Firestore may have blocked write):', err);
    // userProfile remains null — launchApp treats null as not onboarded
  }
}

// ─── WELCOME MESSAGE ──────────────────────────────────────────────────────────
export async function loadWelcomeMessage() {
  var DEFAULT = 'Your coach has set this up for you.';
  try {
    var snap = await getDoc(doc(db, 'gym', '8RB', 'config', 'main'));
    if (snap.exists()) {
      var msg = snap.data().welcomeMessage;
      if (msg && msg.trim()) return msg.trim().slice(0, 80);
    }
  } catch(e) {}
  return DEFAULT;
}

// ─── EXPIRE OLD ASSIGNED SESSIONS ────────────────────────────────────────────
async function expireOldAssignedSessions(uid) {
  var cache = userDataCache.assignedSessions || [];
  var sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  var toExpire = cache.filter(function(s) {
    return s.status === 'pending' && new Date(s.assignedFor) < sevenDaysAgo;
  });
  for (var i = 0; i < toExpire.length; i++) {
    try {
      await updateDoc(doc(db, 'users', uid, 'assignedSessions', toExpire[i]._firestoreId), { status: 'expired' });
      toExpire[i].status = 'expired';
    } catch(e) {}
  }
}

// ─── LAUNCH APP — called after auth + data load ────────────────────────────
// Checks onboarded flag and either starts onboarding or shows app directly.
async function launchApp(user) {
  await ensureUserProfile(user);
  await loadUserData(user.uid);
  await expireOldAssignedSessions(user.uid);
  if (userProfile && userProfile.onboarded === true) {
    showApp();
  } else {
    var wm = await loadWelcomeMessage();
    if (typeof window.startOnboarding === 'function') {
      window.startOnboarding(user, wm);
    } else {
      showApp();
    }
  }
}

// ─── RESOLVE AUTH ─────────────────────────────────────────────────────────────
async function resolveAuth() {
  if (!splashDone || !authReady) return;
  var _cur = auth.currentUser;
  if (DEBUG) console.log('[8RB] resolveAuth:',
    'authUser=' + (authUser ? authUser.uid : 'none'),
    'emailVerified=' + (authUser ? authUser.emailVerified : 'N/A'),
    'auth.currentUser=' + (_cur ? _cur.uid : 'none'),
    'provider=' + (_cur && _cur.providerData[0] ? _cur.providerData[0].providerId : 'unknown'));
  if (authUser && authUser.emailVerified) {
    window.currentUser = authUser;
    // Force ID token refresh so Firestore security rules see the latest
    // email_verified state — needed after the password-reset-as-verification flow.
    await authUser.getIdToken(true).catch(function(e){ console.warn('[8RB] getIdToken refresh failed:', e); });
    await launchApp(authUser);
  } else if (authUser && !authUser.emailVerified) {
    if (DEBUG) console.log('[8RB] resolveAuth: email not verified, showing verify screen');
    showEmailVerificationScreen(authUser.email);
  } else {
    if (DEBUG) console.log('[8RB] resolveAuth: no user, showing sign-in');
    showSignInScreen();
  }
}

export function onSplashDone() {
  splashDone = true;
  resolveAuth();
}

// ─── iOS GOOGLE SIGN-IN FLASH FIX ────────────────────────────────────────────
// Show a loading screen immediately on redirect return so the sign-in form
// never flashes before auth state resolves.
function showGoogleLoadingScreen() {
  var authEl = document.getElementById('auth-screen');
  var appEl = document.getElementById('app-content');
  if (appEl) appEl.style.display = 'none';
  if (authEl) {
    authEl.style.display = 'flex';
    authEl.innerHTML =
      '<div style="display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;height:100%;gap:16px">' +
      '<img src="8RB.webp" style="width:80px;opacity:0.8;' +
      'animation:obBreathe 3s ease-in-out infinite">' +
      '<div style="font-family:\'DM Sans\',sans-serif;font-size:14px;' +
      'color:var(--muted)">Signing you in...</div>' +
      '</div>';
  }
}

if (sessionStorage.getItem('googleRedirectPending')) {
  showGoogleLoadingScreen();
}

// Handle return from Google signInWithRedirect — fires on page load after redirect
getRedirectResult(auth).then(function(result) {
  sessionStorage.removeItem('googleRedirectPending');
  if (result && result.user) {
    if (DEBUG) console.log('[8RB] getRedirectResult: Google redirect returned user', result.user.uid);
    // ensureUserProfile handles profile creation via resolveAuth — no extra action needed
  } else if (sessionStorage.getItem('googleRedirectPending') === null && !window.currentUser) {
    // Flag was set but no user returned — restore sign-in screen
    showSignInScreen();
  }
}).catch(function(err) {
  sessionStorage.removeItem('googleRedirectPending');
  if (err.code) {
    console.warn('[8RB] getRedirectResult error:', err.code, err.message);
    if (!window.currentUser) showAuthError('Google sign-in failed. Please try again.');
  }
});

// Attempt Firebase connection; fall back to localStorage-only mode on network failure
var firebaseAvailable = true;
try {
  onAuthStateChanged(auth, function(user) {
    authReady = true;
    authUser = user;
    resolveAuth();
  }, function(err) {
    // Auth listener error — go offline mode
    console.warn('Auth listener error:', err);
    authReady = true;
    authUser = null;
    resolveAuth();
  });
} catch(e) {
  firebaseAvailable = false;
  authReady = true;
  // Show app in offline mode after splash
  setTimeout(function() {
    splashDone = true;
    toast('Running in offline mode. Sign in when connected to sync your data.');
    showApp();
  }, 0);
}

// ─── SIGN IN ──────────────────────────────────────────────────────────────────
async function handleSignIn() {
  var emailEl = document.getElementById('signin-email');
  var passEl = document.getElementById('signin-password');
  var email = emailEl ? emailEl.value.trim() : '';
  var pass = passEl ? passEl.value : '';
  if (!email || !pass) { showAuthError('Please enter your email and password.'); return; }
  clearAuthErrors();
  var btn = document.getElementById('signin-btn');
  if (btn) { btn.textContent = 'SIGNING IN...'; btn.disabled = true; }
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    // onAuthStateChanged handles the rest
  } catch(err) {
    var msg = err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found'
      ? 'Incorrect email or password.' : 'Sign in failed. Please try again.';
    showAuthError(msg);
  } finally {
    if (btn) { btn.textContent = 'SIGN IN'; btn.disabled = false; }
  }
}

// ─── GOOGLE SIGN IN ───────────────────────────────────────────────────────────
async function handleGoogleSignIn() {
  clearAuthErrors();
  sessionStorage.setItem('googleRedirectPending', '1');
  try {
    var provider = new GoogleAuthProvider();
    var result = await signInWithPopup(auth, provider);
    sessionStorage.removeItem('googleRedirectPending');
    // ensureUserProfile handles profile creation via resolveAuth/onAuthStateChanged
    if (DEBUG) console.log('[8RB] Google popup sign-in complete:', result.user.uid);
  } catch(err) {
    sessionStorage.removeItem('googleRedirectPending');
    if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
      showAuthError('Google sign-in failed. Please try again.');
    }
  }
}

// ─── SIGN UP ──────────────────────────────────────────────────────────────────
async function handleSignUp() {
  var nameEl = document.getElementById('signup-name');
  var emailEl = document.getElementById('signup-email');
  var passEl = document.getElementById('signup-password');
  var confEl = document.getElementById('signup-confirm');
  var name = nameEl ? nameEl.value.trim() : '';
  var email = emailEl ? emailEl.value.trim() : '';
  var pass = passEl ? passEl.value : '';
  var conf = confEl ? confEl.value : '';
  if (!name) { showAuthError('Please enter your name.'); return; }
  if (!email) { showAuthError('Please enter your email.'); return; }
  if (pass.length < 8) { showAuthError('Password must be at least 8 characters.'); return; }
  if (pass !== conf) { showAuthError('Passwords do not match.'); return; }
  clearAuthErrors();
  var btn = document.getElementById('signup-btn');
  if (btn) { btn.textContent = 'CREATING...'; btn.disabled = true; }
  try {
    var result = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(result.user, { displayName: name }).catch(function(){});
    await sendEmailVerification(result.user);
    await createUserProfile(result.user, name);
    showEmailVerificationScreen(email);
  } catch(err) {
    var msg = err.code === 'auth/email-already-in-use'
      ? 'An account with this email already exists.'
      : 'Sign up failed. Please try again.';
    showAuthError(msg);
  } finally {
    if (btn) { btn.textContent = 'CREATE ACCOUNT'; btn.disabled = false; }
  }
}

// ─── FORGOT PASSWORD ──────────────────────────────────────────────────────────
async function handleForgotPassword() {
  var emailEl = document.getElementById('signin-email');
  var email = emailEl ? emailEl.value.trim() : '';
  if (!email) { showAuthError('Enter your email address above first.'); return; }
  try {
    await sendPasswordResetEmail(auth, email);
    showAuthError('Reset link sent to ' + email + '.');
  } catch(err) { showAuthError('Could not send reset email. Check the address and try again.'); }
}

// ─── RESEND VERIFICATION ──────────────────────────────────────────────────────
async function handleResendVerification() {
  var user = authUser || auth.currentUser;
  if (!user) return;
  try {
    await sendEmailVerification(user);
    toast('Verification email resent.');
  } catch(err) { toast('Could not resend. Please try again.', true); }
}

// ─── SIGN OUT ─────────────────────────────────────────────────────────────────
async function handleSignOut() {
  try {
    stopVerificationPolling();
    await fbSignOut(auth);
    window.currentUser = null;
    userDataCache.sessions = null; userDataCache.boxingSessions = null;
    userDataCache.customCombos = null; userDataCache.customSessions = null;
    userDataCache.assignedSessions = null;
    window.userProfile = null; userProfile = null;
    closeSettingsBtn();
    showSignInScreen();
  } catch(err) { toast('Sign out failed. Try again.', true); }
}

// ─── DELETE ACCOUNT ───────────────────────────────────────────────────────────
function confirmDeleteAccount() {
  var modal = document.getElementById('delete-account-modal');
  if (modal) modal.classList.add('open');
}
function cancelDeleteAccount() {
  var modal = document.getElementById('delete-account-modal');
  if (modal) modal.classList.remove('open');
}
async function executeDeleteAccount() {
  if (!window.currentUser) return;
  var btn = document.getElementById('delete-confirm-btn');
  if (btn) { btn.textContent = 'DELETING...'; btn.disabled = true; }
  try {
    var uid = window.currentUser.uid;
    // Delete all Firestore subcollections
    var colls = ['sessions','boxingSessions','customCombos','customSessions'];
    for (var ci = 0; ci < colls.length; ci++) {
      var snap = await getDocs(collection(db, 'users', uid, colls[ci]));
      if (snap.docs.length === 0) continue;
      var docChunks = chunkArray(snap.docs, 499);
      for (var ci2 = 0; ci2 < docChunks.length; ci2++) {
        var batch = writeBatch(db);
        docChunks[ci2].forEach(function(d) { batch.delete(d.ref); });
        await batch.commit();
      }
    }
    // Delete profile
    await deleteDoc(doc(db, 'users', uid, 'profile', 'data')).catch(function(){});
    // Delete auth record
    await deleteUser(window.currentUser);
    localStorage.clear();
    window.currentUser = null;
    cancelDeleteAccount();
    closeSettingsBtn();
    var authEl = document.getElementById('auth-screen');
    var appEl = document.getElementById('app-content');
    if (appEl) appEl.style.display = 'none';
    if (authEl) authEl.style.display = 'flex';
    showAuthForm('auth-signin');
    var errEl = document.getElementById('auth-error');
    if (errEl) { errEl.textContent = 'Your account has been deleted.'; errEl.style.display = 'block'; errEl.style.color = 'var(--muted)'; }
  } catch(err) {
    if (err.code === 'auth/requires-recent-login') {
      toast('Please sign out and sign back in before deleting your account.', true);
    } else {
      toast('Delete failed. Please try again.', true);
    }
    if (btn) { btn.textContent = 'DELETE EVERYTHING'; btn.disabled = false; }
  }
}

// ─── COACH'S NOTES ────────────────────────────────────────────────────────────
function renderCoachNotes(html) {
  var el = document.getElementById('coaches-notes-content');
  if (el) el.innerHTML = html;
}
function loadCoachesNotes() {
  // Show cached version immediately so notes survive every refresh
  var cached = localStorage.getItem('coachNotesHtml');
  if (cached) renderCoachNotes(cached);

  // Then fetch live from Firestore and update cache
  try {
    onSnapshot(doc(db, 'gym', '8RB', 'config', 'main'), function(snap) {
      if (!snap.exists() || !snap.data().coachNotes) return;
      var notes = snap.data().coachNotes;
      var html = notes.split('\n').filter(function(l){return l.trim();}).map(function(l){return '— ' + sanitise(l.trim());}).join('<br>');
      localStorage.setItem('coachNotesHtml', html);
      renderCoachNotes(html);
    }, function(err) {
      console.warn('Coach notes Firestore read failed (using cache/fallback):', err);
    });
  } catch(e) {}
}

// ─── DATA MIGRATION (localStorage → Firestore) ────────────────────────────────
function checkMigration() {
  if (!window.currentUser) return;
  var uid = window.currentUser.uid;
  var key = 'migrationComplete_' + uid;
  // Carry forward old global flag so existing users aren't re-prompted
  if (ld('migrationComplete', false) && !ld(key, false)) { sv(key, true); }
  if (ld(key, false)) return;
  var existingSessions = JSON.parse(localStorage.getItem('sessions') || 'null');
  if (!existingSessions || !existingSessions.length) {
    sv(key, true); return;
  }
  var msg = 'We found ' + existingSessions.length + ' session(s) on this device. Import to your account?';
  if (confirm(msg)) {
    runMigration();
  } else {
    sv(key, true);
  }
}
async function runMigration() {
  if (!window.currentUser) return;
  var uid = window.currentUser.uid;
  var count = 0;
  try {
    var sessions = JSON.parse(localStorage.getItem('sessions') || '[]');
    var boxing = JSON.parse(localStorage.getItem('freestyleSessions') || '[]');
    var classes = JSON.parse(localStorage.getItem('boxingClasses') || '[]');
    var combos = JSON.parse(localStorage.getItem('customCombos') || '[]');
    var custom = JSON.parse(localStorage.getItem('customSessions') || '[]');
    var dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    var skipped = 0;
    for (var i = 0; i < sessions.length; i++) {
      if (!sessions[i].date || !dateRegex.test(sessions[i].date) || !Array.isArray(sessions[i].exercises)) {
        skipped++;
        continue;
      }
      await addDoc(collection(db, 'users', uid, 'sessions'), Object.assign({}, sessions[i], {createdAt: serverTimestamp()}));
      count++;
    }
    if (skipped > 0) console.log('[8RB] runMigration: skipped ' + skipped + ' invalid session records');
    for (var j = 0; j < boxing.length; j++) {
      await addDoc(collection(db, 'users', uid, 'boxingSessions'), Object.assign({}, boxing[j], {type:'freestyle', createdAt: serverTimestamp()}));
      count++;
    }
    for (var k = 0; k < classes.length; k++) {
      await addDoc(collection(db, 'users', uid, 'boxingSessions'), Object.assign({}, classes[k], {type:'class', createdAt: serverTimestamp()}));
      count++;
    }
    for (var l = 0; l < combos.length; l++) {
      await addDoc(collection(db, 'users', uid, 'customCombos'), Object.assign({}, combos[l], {createdAt: serverTimestamp()}));
    }
    for (var m = 0; m < custom.length; m++) {
      await addDoc(collection(db, 'users', uid, 'customSessions'), Object.assign({}, custom[m], {createdAt: serverTimestamp()}));
    }
    sv('migrationComplete_' + uid, true);
    await loadUserData(uid);
    renderProgress();
    toast(count + ' sessions imported successfully.');
  } catch(err) {
    console.error('Migration error:', err);
    toast('Import failed — your data is still on this device.', true);
  }
}

// ─── HELPER: getPrevWtFromSessions ────────────────────────────────────────────
export function getPrevWtFromSessions(name, sessions) {
  for (var i = sessions.length - 1; i >= 0; i--) {
    var ex = [...(sessions[i].exercises||[]),...(sessions[i].extras||[])].find(function(e){return e.name===name||e.originalName===name;});
    if (ex) { var valid=(ex.sets||[]).filter(function(r){return r.kg&&parseFloat(r.kg)>0;}); if(valid.length) return {kg:Math.max.apply(null,valid.map(function(r){return parseFloat(r.kg);}))}; }
  }
  return null;
}

// ─── SWITCH FORMS ─────────────────────────────────────────────────────────────
function switchToSignUp() { clearAuthErrors(); showAuthForm('auth-signup'); }
function switchToSignIn() { stopVerificationPolling(); clearAuthErrors(); showAuthForm('auth-signin'); }

// ─── PASSWORD VISIBILITY TOGGLE ───────────────────────────────────────────────
function togglePwVisibility(inputId, btn) {
  var inp = document.getElementById(inputId);
  if (!inp) return;
  var isText = inp.type === 'text';
  inp.type = isText ? 'password' : 'text';
  btn.textContent = isText ? 'SHOW' : 'HIDE';
}

// ─── EXPOSE ALL HTML-CALLED FUNCTIONS ON WINDOW ───────────────────────────────
window.showPage = showPage;
window.openOverlay = openOverlay;
window.closeOverlay = closeOverlay;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.closeSettingsBtn = closeSettingsBtn;
window.initBranding = initBranding;
window.applyBranding = applyBranding;
window.saveBrandName = saveBrandName;
window.setAccent = setAccent;
window.renderSettingsPanel = renderSettingsPanel;
window.setUnit = setUnit;
window.exportData = exportData;
window.importData = importData;
window.clearAll = clearAll;
window.openNumpad = openNumpad;
window.npKey = npKey;
window.npDel = npDel;
window.npIncr = npIncr;
window.npDone = npDone;
window.npBgTap = npBgTap;
window.handleSignIn = handleSignIn;
window.handleGoogleSignIn = handleGoogleSignIn;
window.handleSignUp = handleSignUp;
window.handleForgotPassword = handleForgotPassword;
window.handleResendVerification = handleResendVerification;
window.handleManualVerifyCheck = handleManualVerifyCheck;
window.handleSignOut = handleSignOut;
window.confirmDeleteAccount = confirmDeleteAccount;
window.cancelDeleteAccount = cancelDeleteAccount;
window.executeDeleteAccount = executeDeleteAccount;
window.switchToSignUp = switchToSignUp;
window.switchToSignIn = switchToSignIn;
window.togglePwVisibility = togglePwVisibility;
window.renderProfile = renderProfile;
window.loadWelcomeMessage = loadWelcomeMessage;
window.editDisplayName = editDisplayName;
window.saveDisplayName = saveDisplayName;
window.savePfBrandName = savePfBrandName;
