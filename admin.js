import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  doc, getDoc, getDocs, setDoc, addDoc, collection,
  serverTimestamp, updateDoc, query, where
} from 'firebase/firestore';
import { EXERCISE_LIBRARY } from './data.js';

// ─── STATE ────────────────────────────────────────────────────────────────────
var currentCoach = null;
var allMembers = [];
var allSessions = [];
var activeSection = 'dashboard';
var sbSessionName = '';
var sbExercises = [];
var sbVisibility = 'sgpt';
var sbSessionType = 'straight_sets';
var sbTimeCap = 20;
var sbEmomInterval = 60;
var sbEmomRounds = 10;
var sbEditId = null;
var sbPt121Assigned = [];
var sendMode = 'all-sgpt';
var memberSearch = '';
var memberRoleFilter = 'all';
var membersPage = 0;
var MEMBERS_PER_PAGE = 20;
var sessionLibTab = 'sgpt';
var coachNotesValue = '';
var lockedPanelsData = {
  sgpt: { heading: '', body: '', url: '' },
  pt121: { heading: '', body: '', url: '' }
};

// ─── UTILS ────────────────────────────────────────────────────────────────────
function showToast(msg, isErr) {
  var t = document.getElementById('admin-toast');
  t.textContent = msg;
  t.className = 'admin-toast' + (isErr ? ' err' : '') + ' show';
  setTimeout(function() { t.className = 'admin-toast' + (isErr ? ' err' : ''); }, 2400);
}

function fmtDate(ts) {
  if (!ts) return '—';
  var d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateStr(str) {
  if (!str) return '—';
  var d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function sanitise(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── NAV ──────────────────────────────────────────────────────────────────────
function showSection(name) {
  activeSection = name;
  ['dashboard', 'members', 'sessions', 'assignments', 'settings'].forEach(function(s) {
    var el = document.getElementById('section-' + s);
    if (el) el.style.display = s === name ? '' : 'none';
    var nav = document.getElementById('nav-' + s);
    if (nav) nav.classList.toggle('active', s === name);
  });
  if (name === 'dashboard') renderDashboard();
  else if (name === 'members') renderMembersTable();
  else if (name === 'sessions') renderSessionsSection();
  else if (name === 'assignments') renderAssignmentsSection();
  else if (name === 'settings') renderSettingsSection();
}
window.showSection = showSection;

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function renderDashboard() {
  var sgptCount = allMembers.filter(function(m) { return m.sgpt === true; }).length;
  var pt121Count = allMembers.filter(function(m) { return m.pt121 === true; }).length;
  var activeSess = allSessions.filter(function(s) { return s.active !== false; });
  var sgptSess = activeSess.filter(function(s) { return s.visibility === 'sgpt'; }).length;
  var pt121Sess = activeSess.filter(function(s) { return s.visibility === 'pt121'; }).length;

  document.getElementById('section-dashboard').innerHTML =
    '<div class="section-hd"><div class="section-ttl">DASHBOARD</div></div>' +
    '<div class="dash-stats">' +
      '<div class="stat-card"><div class="stat-val">' + allMembers.length + '</div><div class="stat-lbl">TOTAL MEMBERS</div></div>' +
      '<div class="stat-card"><div class="stat-val gold">' + sgptCount + '</div><div class="stat-lbl">SGPT MEMBERS</div></div>' +
      '<div class="stat-card"><div class="stat-val gold">' + pt121Count + '</div><div class="stat-lbl">1-2-1 PT MEMBERS</div></div>' +
      '<div class="stat-card"><div class="stat-val">' + activeSess.length + '</div><div class="stat-lbl">ACTIVE SESSIONS</div></div>' +
    '</div>' +
    '<div class="dash-section">' +
      '<div class="section-ttl" style="font-size:22px">QUICK ACTIONS</div>' +
      '<div class="quick-actions">' +
        '<button class="quick-btn" onclick="startNewSession(\'sgpt\')">+ NEW SGPT SESSION</button>' +
        '<button class="quick-btn" onclick="startNewSession(\'pt121\')">+ NEW 1-2-1 SESSION</button>' +
        '<button class="quick-btn" onclick="showSection(\'assignments\')">ASSIGN SESSION</button>' +
        '<button class="quick-btn" onclick="showSection(\'members\')">MANAGE MEMBERS</button>' +
      '</div>' +
    '</div>' +
    '<div class="dash-section">' +
      '<div class="section-ttl" style="font-size:22px">SESSIONS BREAKDOWN</div>' +
      '<div class="dash-breakdown">' +
        '<div class="breakdown-card"><div class="breakdown-val gold">' + sgptSess + '</div><div class="breakdown-lbl">SGPT SESSIONS</div></div>' +
        '<div class="breakdown-card"><div class="breakdown-val gold">' + pt121Sess + '</div><div class="breakdown-lbl">1-2-1 PT SESSIONS</div></div>' +
      '</div>' +
    '</div>';
}

window.startNewSession = function(vis) {
  sbVisibility = vis;
  sbEditId = null;
  sbSessionName = '';
  sbExercises = [];
  sbPt121Assigned = [];
  sbSessionType = 'straight_sets';
  sessionLibTab = vis;
  showSection('sessions');
};

// ─── MEMBERS ──────────────────────────────────────────────────────────────────
async function loadMembers() {
  try {
    var snap = await getDocs(collection(db, 'gym', '8RB', 'members'));
    allMembers = snap.docs.map(function(d) { return Object.assign({ uid: d.id }, d.data()); });
    allMembers.sort(function(a, b) {
      var an = (a.displayName || a.email || '').toLowerCase();
      var bn = (b.displayName || b.email || '').toLowerCase();
      return an < bn ? -1 : an > bn ? 1 : 0;
    });
  } catch(err) { console.error('Failed to load members:', err); }
}

function getFilteredMembers() {
  var q = memberSearch.toLowerCase();
  return allMembers.filter(function(m) {
    var matchSearch = !q
      || (m.displayName && m.displayName.toLowerCase().includes(q))
      || (m.email && m.email.toLowerCase().includes(q));
    var matchRole = memberRoleFilter === 'all' ? true
      : memberRoleFilter === 'coach' ? m.role === 'coach'
      : memberRoleFilter === 'sgpt' ? m.sgpt === true
      : memberRoleFilter === 'pt121' ? m.pt121 === true
      : (m.role !== 'coach' && !m.sgpt && !m.pt121);
    return matchSearch && matchRole;
  });
}

function renderMembersTable() {
  var filtered = getFilteredMembers();
  var totalPages = Math.max(1, Math.ceil(filtered.length / MEMBERS_PER_PAGE));
  if (membersPage >= totalPages) membersPage = Math.max(0, totalPages - 1);
  var pageMembers = filtered.slice(membersPage * MEMBERS_PER_PAGE, (membersPage + 1) * MEMBERS_PER_PAGE);

  var filterBtns = [
    { v: 'all', l: 'All' },
    { v: 'member', l: 'Standard' },
    { v: 'sgpt', l: 'SGPT' },
    { v: 'pt121', l: '1-2-1' },
    { v: 'coach', l: 'Coach' }
  ].map(function(f) {
    return '<button class="filter-btn' + (memberRoleFilter === f.v ? ' active' : '') + '" onclick="setMemberRoleFilter(\'' + f.v + '\')">' + f.l + '</button>';
  }).join('');

  var rows = pageMembers.map(function(m) {
    var badges = '';
    if (m.role === 'coach') {
      badges = '<span class="role-badge role-coach">COACH</span>';
    } else {
      if (m.sgpt) badges += '<span class="role-badge role-sgpt">SGPT</span> ';
      if (m.pt121) badges += '<span class="role-badge role-pt121">1-2-1</span>';
      if (!m.sgpt && !m.pt121) badges = '<span class="role-badge role-member">MEMBER</span>';
    }
    var actions = '';
    if (currentCoach && m.uid !== currentCoach.uid && m.role !== 'coach') {
      var sgptBtn = m.sgpt === true
        ? '<button class="tbl-btn tbl-btn-remove" onclick="toggleSgpt(\'' + m.uid + '\',false)">REMOVE SGPT</button>'
        : '<button class="tbl-btn tbl-btn-assign" onclick="toggleSgpt(\'' + m.uid + '\',true)">ASSIGN SGPT</button>';
      var pt121Btn = m.pt121 === true
        ? '<button class="tbl-btn tbl-btn-remove" onclick="togglePt121(\'' + m.uid + '\',false)">REMOVE 1-2-1</button>'
        : '<button class="tbl-btn tbl-btn-assign2" onclick="togglePt121(\'' + m.uid + '\',true)">ASSIGN 1-2-1</button>';
      actions = '<div class="tbl-actions">' + sgptBtn + pt121Btn + '</div>';
    }
    return '<tr>' +
      '<td><div class="mem-name">' + sanitise(m.displayName || 'Unknown') + '</div><div class="mem-email">' + sanitise(m.email || '') + '</div></td>' +
      '<td>' + badges + '</td>' +
      '<td class="mem-joined">' + fmtDate(m.joinDate) + '</td>' +
      '<td>' + actions + '</td>' +
    '</tr>';
  }).join('');

  var emptyRow = !pageMembers.length
    ? '<tr><td colspan="4" class="tbl-empty">No members match this filter.</td></tr>'
    : '';

  var pagination = totalPages > 1
    ? '<div class="pagination">' +
        '<button onclick="membersPagePrev()" ' + (membersPage === 0 ? 'disabled' : '') + '>← Prev</button>' +
        '<span>' + (membersPage + 1) + ' / ' + totalPages + '</span>' +
        '<button onclick="membersPageNext()" ' + (membersPage >= totalPages - 1 ? 'disabled' : '') + '>Next →</button>' +
      '</div>'
    : '';

  document.getElementById('section-members').innerHTML =
    '<div class="section-hd"><div class="section-ttl">MEMBERS</div><div class="section-sub">' + allMembers.length + ' registered</div></div>' +
    '<div class="members-toolbar">' +
      '<input class="search-inp" type="text" placeholder="Search by name or email…" value="' + sanitise(memberSearch) + '" oninput="setMemberSearch(this.value)">' +
      '<div class="filter-btns">' + filterBtns + '</div>' +
    '</div>' +
    '<div class="table-wrap">' +
      '<table class="members-table">' +
        '<thead><tr><th>MEMBER</th><th>ROLE</th><th>JOINED</th><th>ACTIONS</th></tr></thead>' +
        '<tbody>' + rows + emptyRow + '</tbody>' +
      '</table>' +
    '</div>' +
    pagination;
}

window.setMemberSearch = function(val) {
  memberSearch = val;
  membersPage = 0;
  renderMembersTable();
};

window.setMemberRoleFilter = function(f) {
  memberRoleFilter = f;
  membersPage = 0;
  renderMembersTable();
};

window.membersPagePrev = function() {
  if (membersPage > 0) { membersPage--; renderMembersTable(); }
};

window.membersPageNext = function() {
  var total = Math.ceil(getFilteredMembers().length / MEMBERS_PER_PAGE);
  if (membersPage < total - 1) { membersPage++; renderMembersTable(); }
};

window.toggleSgpt = async function(uid, grant) {
  try {
    await updateDoc(doc(db, 'users', uid, 'profile', 'data'), { sgpt: grant });
    await updateDoc(doc(db, 'gym', '8RB', 'members', uid), { sgpt: grant });
    var m = allMembers.find(function(x) { return x.uid === uid; });
    if (m) m.sgpt = grant;
    renderMembersTable();
    showToast(grant ? 'SGPT ACCESS GRANTED' : 'SGPT ACCESS REMOVED');
  } catch(err) { showToast('UPDATE FAILED — TRY AGAIN', true); }
};

window.togglePt121 = async function(uid, grant) {
  try {
    await updateDoc(doc(db, 'users', uid, 'profile', 'data'), { pt121: grant });
    await updateDoc(doc(db, 'gym', '8RB', 'members', uid), { pt121: grant });
    var m = allMembers.find(function(x) { return x.uid === uid; });
    if (m) m.pt121 = grant;
    renderMembersTable();
    showToast(grant ? '1-2-1 ACCESS GRANTED' : '1-2-1 ACCESS REMOVED');
  } catch(err) { showToast('UPDATE FAILED — TRY AGAIN', true); }
};

// ─── SESSIONS ─────────────────────────────────────────────────────────────────
async function loadAllSessions() {
  try {
    var snap = await getDocs(collection(db, 'gym', '8RB', 'sessions'));
    allSessions = snap.docs.map(function(d) { return Object.assign({ _id: d.id }, d.data()); });
    allSessions.sort(function(a, b) {
      var at = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate().getTime() : 0;
      var bt = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate().getTime() : 0;
      return bt - at;
    });
  } catch(err) { console.error('Failed to load sessions:', err); }
}

function renderSessionsSection() {
  var activeSgpt = allSessions.filter(function(s) { return s.visibility === 'sgpt' && s.active !== false; });
  var activePt121 = allSessions.filter(function(s) { return s.visibility === 'pt121' && s.active !== false; });
  var archived = allSessions.filter(function(s) { return s.active === false; });
  var libSessions = sessionLibTab === 'sgpt' ? activeSgpt : sessionLibTab === 'pt121' ? activePt121 : archived;

  var tabBtns =
    '<div class="lib-tabs">' +
      '<button class="lib-tab' + (sessionLibTab === 'sgpt' ? ' active' : '') + '" onclick="setSessionLibTab(\'sgpt\')">SGPT (' + activeSgpt.length + ')</button>' +
      '<button class="lib-tab' + (sessionLibTab === 'pt121' ? ' active' : '') + '" onclick="setSessionLibTab(\'pt121\')">1-2-1 (' + activePt121.length + ')</button>' +
      '<button class="lib-tab' + (sessionLibTab === 'archived' ? ' active' : '') + '" onclick="setSessionLibTab(\'archived\')">ARCHIVED (' + archived.length + ')</button>' +
    '</div>';

  var libHtml = libSessions.length ? libSessions.map(function(s) {
    var n = (s.exercises || []).length;
    var visPill = s.visibility === 'sgpt'
      ? '<span class="vis-pill vis-sgpt">SGPT</span>'
      : '<span class="vis-pill vis-pt121">1-2-1</span>';
    var btns = s.active !== false
      ? '<button class="lib-btn lib-btn-edit" onclick="editSession(\'' + s._id + '\')">EDIT</button>' +
        '<button class="lib-btn lib-btn-dup" onclick="duplicateSession(\'' + s._id + '\')">DUPE</button>' +
        '<button class="lib-btn lib-btn-arc" onclick="archiveSession(\'' + s._id + '\')">ARCHIVE</button>'
      : '<button class="lib-btn lib-btn-restore" onclick="restoreSession(\'' + s._id + '\')">RESTORE</button>';
    return '<div class="lib-card">' +
      '<div class="lib-card-hd">' + visPill + '<div class="lib-card-name">' + sanitise(s.name) + '</div></div>' +
      '<div class="lib-card-meta">' + n + (n === 1 ? ' exercise' : ' exercises') + (s.sessionType && s.sessionType !== 'straight_sets' ? ' · ' + s.sessionType.replace(/_/g, ' ').toUpperCase() : '') + '</div>' +
      '<div class="lib-card-btns">' + btns + '</div>' +
    '</div>';
  }).join('') : '<div class="lib-empty">No sessions here yet.</div>';

  document.getElementById('section-sessions').innerHTML =
    '<div class="section-hd"><div class="section-ttl">SESSIONS</div></div>' +
    '<div class="sessions-split">' +
      '<div class="lib-panel">' + tabBtns + '<div id="lib-list">' + libHtml + '</div></div>' +
      '<div class="builder-panel">' + buildBuilderHtml() + '</div>' +
    '</div>';

  checkSbReady();
}

function buildBuilderHtml() {
  var visBtns =
    '<div class="vis-toggle" style="margin-top:6px;margin-bottom:16px">' +
      '<button class="vis-btn' + (sbVisibility === 'sgpt' ? ' active' : '') + '" onclick="setSbVisibility(\'sgpt\')">SGPT</button>' +
      '<button class="vis-btn' + (sbVisibility === 'pt121' ? ' active' : '') + '" onclick="setSbVisibility(\'pt121\')">1-2-1 PT</button>' +
    '</div>';

  var typeOpts = [
    { v: 'straight_sets', l: 'Straight Sets' },
    { v: 'amrap', l: 'AMRAP' },
    { v: 'emom', l: 'EMOM' },
    { v: 'circuit', l: 'Circuit' }
  ].map(function(o) {
    return '<option value="' + o.v + '"' + (sbSessionType === o.v ? ' selected' : '') + '>' + o.l + '</option>';
  }).join('');

  var amrapExtras = sbSessionType === 'amrap'
    ? '<div class="sb-field" style="margin-bottom:14px">' +
        '<label class="sb-lbl">TIME CAP (MINUTES)</label>' +
        '<input class="sb-num-inp" type="number" id="sb-timecap" min="5" max="60" value="' + sbTimeCap + '" oninput="updateSbTimeCap(this.value)" style="width:80px;margin-top:6px">' +
      '</div>'
    : '';

  var emomExtras = sbSessionType === 'emom'
    ? '<div style="display:flex;gap:12px;margin-bottom:14px">' +
        '<div class="sb-field"><label class="sb-lbl">INTERVAL (SECS)</label><input class="sb-num-inp" type="number" id="sb-emom-interval" min="30" max="300" value="' + sbEmomInterval + '" oninput="updateSbEmomInterval(this.value)" style="width:80px;margin-top:6px"></div>' +
        '<div class="sb-field"><label class="sb-lbl">ROUNDS</label><input class="sb-num-inp" type="number" id="sb-emom-rounds" min="1" max="60" value="' + sbEmomRounds + '" oninput="updateSbEmomRounds(this.value)" style="width:80px;margin-top:6px"></div>' +
      '</div>'
    : '';

  var pt121Checklist = '';
  if (sbVisibility === 'pt121') {
    var pt121Members = allMembers.filter(function(m) { return m.role !== 'coach'; });
    var clRows = pt121Members.map(function(m) {
      var checked = sbPt121Assigned.indexOf(m.uid) > -1 ? ' checked' : '';
      var tag = m.pt121 ? ' <span class="pt121-tag">[1-2-1]</span>' : (m.sgpt ? ' <span class="sgpt-tag">[SGPT]</span>' : '');
      return '<label class="member-check-row"><input type="checkbox" value="' + m.uid + '"' + checked + ' onchange="toggleSbPt121Member(this.value,this.checked)"> ' + sanitise(m.displayName || m.email || m.uid) + tag + '</label>';
    }).join('');
    pt121Checklist = '<div class="sb-lbl" style="margin-bottom:6px">WHO CAN SEE THIS SESSION</div>' +
      '<div class="pt121-checklist">' + (clRows || '<div style="color:var(--dim);font-size:13px;padding:8px 0">No members yet.</div>') + '</div>' +
      '<div style="margin-bottom:16px"></div>';
  }

  var exListHtml = sbExercises.length ? sbExercises.map(function(ex, i) {
    var restOpts = [30, 45, 60, 90, 120].map(function(s) {
      return '<option value="' + s + '"' + (ex.rest === s ? ' selected' : '') + '>' + s + 's</option>';
    }).join('');
    var typePills = ['standard', 'superset', 'amrap', 'emom'].map(function(t) {
      var lbl = t === 'standard' ? 'Standard' : t === 'superset' ? 'Superset' : t.toUpperCase();
      return '<button class="ex-type-pill' + (ex.exType === t ? ' active' : '') + '" onclick="setSbExType(' + i + ',\'' + t + '\')">' + lbl + '</button>';
    }).join('');
    return '<div class="sb-ex-row">' +
      '<div class="sb-ex-hd">' +
        '<span class="sb-ex-name-lbl">' + sanitise(ex.name) + '</span>' +
        '<button class="sb-remove-btn" onclick="removeSbEx(' + i + ')">×</button>' +
      '</div>' +
      '<div class="ex-type-pills">' + typePills + '</div>' +
      '<div class="sb-ex-controls">' +
        '<div class="sb-field"><label class="sb-lbl">SETS</label><input class="sb-num-inp" type="number" min="1" max="20" value="' + ex.sets + '" oninput="updateSbEx(' + i + ',\'sets\',this.value)" style="margin-top:4px"></div>' +
        '<div class="sb-field"><label class="sb-lbl">REPS</label><input class="sb-num-inp" type="number" min="1" max="100" value="' + ex.reps + '" oninput="updateSbEx(' + i + ',\'reps\',this.value)" style="margin-top:4px"></div>' +
        '<div class="sb-field"><label class="sb-lbl">REST</label><select class="sb-sel" onchange="updateSbEx(' + i + ',\'rest\',+this.value)" style="margin-top:4px">' + restOpts + '</select></div>' +
      '</div>' +
      '<input class="sb-note-inp" type="text" placeholder="Coach note (optional)" value="' + sanitise(ex.note || '') + '" oninput="updateSbEx(' + i + ',\'note\',this.value)">' +
    '</div>';
  }).join('') : '<div class="sb-no-ex">No exercises added yet.</div>';

  var editLabel = sbEditId ? 'UPDATE SESSION' : 'SAVE SESSION';

  return '<div class="builder-hd">' + (sbEditId ? 'EDIT SESSION' : 'NEW SESSION') + '</div>' +
    '<div class="builder-body">' +
      '<div class="sb-lbl">SESSION NAME</div>' +
      '<input class="sb-name-inp" id="sb-session-name" type="text" placeholder="Name this session" value="' + sanitise(sbSessionName) + '" oninput="updateSbName(this.value)">' +
      '<div class="sb-lbl">VISIBILITY</div>' +
      visBtns +
      '<div class="sb-lbl">SESSION TYPE</div>' +
      '<select class="sb-sel" id="sb-session-type" style="width:100%;margin-top:6px;margin-bottom:14px" onchange="setSbSessionType(this.value)">' + typeOpts + '</select>' +
      amrapExtras +
      emomExtras +
      pt121Checklist +
      '<div class="sb-lbl" style="margin-bottom:8px">EXERCISES</div>' +
      '<div id="sb-exercise-list">' + exListHtml + '</div>' +
      '<button class="sb-add-btn" onclick="openExerciseSearch()">+ ADD EXERCISE</button>' +
      '<button class="admin-save-btn" id="sb-save-btn" onclick="saveAdminSession()" disabled>' + editLabel + '</button>' +
      (sbEditId ? '<button class="sb-cancel-btn" onclick="cancelSbEdit()">CANCEL EDIT</button>' : '') +
    '</div>';
}

function checkSbReady() {
  var btn = document.getElementById('sb-save-btn');
  if (!btn) return;
  btn.disabled = !(sbSessionName.trim() && sbExercises.length > 0);
}

window.updateSbName = function(val) { sbSessionName = val; checkSbReady(); };
window.updateSbTimeCap = function(val) { sbTimeCap = +val || 20; };
window.updateSbEmomInterval = function(val) { sbEmomInterval = +val || 60; };
window.updateSbEmomRounds = function(val) { sbEmomRounds = +val || 10; };

window.setSessionLibTab = function(tab) { sessionLibTab = tab; renderSessionsSection(); };

window.setSbVisibility = function(vis) { sbVisibility = vis; renderSessionsSection(); };

window.setSbSessionType = function(type) { sbSessionType = type; renderSessionsSection(); };

window.toggleSbPt121Member = function(uid, checked) {
  if (checked) {
    if (sbPt121Assigned.indexOf(uid) === -1) sbPt121Assigned.push(uid);
  } else {
    sbPt121Assigned = sbPt121Assigned.filter(function(u) { return u !== uid; });
  }
};

window.setSbExType = function(i, type) {
  sbExercises[i].exType = type;
  renderSessionsSection();
};

window.updateSbEx = function(i, field, val) {
  if (field === 'sets' || field === 'reps' || field === 'rest') {
    sbExercises[i][field] = +val || sbExercises[i][field];
  } else {
    sbExercises[i][field] = val;
  }
  checkSbReady();
};

window.removeSbEx = function(i) {
  sbExercises.splice(i, 1);
  renderSessionsSection();
};

window.saveAdminSession = async function() {
  if (!sbSessionName.trim() || !sbExercises.length) return;
  var btn = document.getElementById('sb-save-btn');
  btn.disabled = true;
  btn.textContent = 'SAVING…';

  var exercises = sbExercises.map(function(ex) {
    return {
      name: ex.name,
      displayName: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      scheme: ex.sets + 'x' + ex.reps,
      rest: ex.rest,
      type: ex.exType || 'standard',
      note: ex.note || '',
      alts: []
    };
  });

  var sessDoc = {
    name: sbSessionName.trim(),
    visibility: sbVisibility,
    sessionType: sbSessionType,
    exercises: exercises,
    active: true,
    source: 'coach'
  };
  if (sbSessionType === 'amrap') sessDoc.timeCap = sbTimeCap;
  if (sbSessionType === 'emom') { sessDoc.emomInterval = sbEmomInterval; sessDoc.emomRounds = sbEmomRounds; }
  if (sbVisibility === 'pt121') sessDoc.assignedTo = sbPt121Assigned.slice();

  try {
    if (sbEditId) {
      await updateDoc(doc(db, 'gym', '8RB', 'sessions', sbEditId), sessDoc);
      var idx = allSessions.findIndex(function(s) { return s._id === sbEditId; });
      if (idx > -1) allSessions[idx] = Object.assign({ _id: sbEditId }, sessDoc);
      showToast('SESSION UPDATED');
    } else {
      sessDoc.createdAt = serverTimestamp();
      sessDoc.createdBy = currentCoach ? currentCoach.uid : '';
      var ref = await addDoc(collection(db, 'gym', '8RB', 'sessions'), sessDoc);
      allSessions.unshift(Object.assign({ _id: ref.id }, sessDoc));
      showToast('SESSION SAVED');
    }
    sbEditId = null;
    sbSessionName = '';
    sbExercises = [];
    sbPt121Assigned = [];
    sbSessionType = 'straight_sets';
    renderSessionsSection();
  } catch(err) {
    showToast('SAVE FAILED — TRY AGAIN', true);
    btn.disabled = false;
    btn.textContent = sbEditId ? 'UPDATE SESSION' : 'SAVE SESSION';
  }
};

window.cancelSbEdit = function() {
  sbEditId = null;
  sbSessionName = '';
  sbExercises = [];
  sbPt121Assigned = [];
  sbSessionType = 'straight_sets';
  renderSessionsSection();
};

window.editSession = function(id) {
  var sess = allSessions.find(function(s) { return s._id === id; });
  if (!sess) return;
  sbEditId = id;
  sbSessionName = sess.name || '';
  sbVisibility = sess.visibility || 'sgpt';
  sbSessionType = sess.sessionType || 'straight_sets';
  sbTimeCap = sess.timeCap || 20;
  sbEmomInterval = sess.emomInterval || 60;
  sbEmomRounds = sess.emomRounds || 10;
  sbPt121Assigned = (sess.assignedTo || []).slice();
  sbExercises = (sess.exercises || []).map(function(ex) {
    return { name: ex.name, sets: ex.sets || 3, reps: ex.reps || 8, rest: ex.rest || 60, exType: ex.type || 'standard', note: ex.note || '' };
  });
  renderSessionsSection();
};

window.duplicateSession = function(id) {
  var sess = allSessions.find(function(s) { return s._id === id; });
  if (!sess) return;
  sbEditId = null;
  sbSessionName = sess.name + ' (copy)';
  sbVisibility = sess.visibility || 'sgpt';
  sbSessionType = sess.sessionType || 'straight_sets';
  sbTimeCap = sess.timeCap || 20;
  sbEmomInterval = sess.emomInterval || 60;
  sbEmomRounds = sess.emomRounds || 10;
  sbPt121Assigned = [];
  sbExercises = (sess.exercises || []).map(function(ex) {
    return { name: ex.name, sets: ex.sets || 3, reps: ex.reps || 8, rest: ex.rest || 60, exType: ex.type || 'standard', note: ex.note || '' };
  });
  renderSessionsSection();
};

window.archiveSession = async function(id) {
  try {
    await updateDoc(doc(db, 'gym', '8RB', 'sessions', id), { active: false });
    var s = allSessions.find(function(x) { return x._id === id; });
    if (s) s.active = false;
    renderSessionsSection();
    showToast('SESSION ARCHIVED');
  } catch(err) { showToast('ARCHIVE FAILED', true); }
};

window.restoreSession = async function(id) {
  try {
    await updateDoc(doc(db, 'gym', '8RB', 'sessions', id), { active: true });
    var s = allSessions.find(function(x) { return x._id === id; });
    if (s) s.active = true;
    renderSessionsSection();
    showToast('SESSION RESTORED');
  } catch(err) { showToast('RESTORE FAILED', true); }
};

// ─── EXERCISE SEARCH ──────────────────────────────────────────────────────────
window.openExerciseSearch = function() {
  document.getElementById('sb-search-inp').value = '';
  filterExerciseSearch();
  document.getElementById('sb-search-overlay').classList.add('show');
  document.getElementById('sb-search-inp').focus();
};

window.closeExerciseSearch = function() {
  document.getElementById('sb-search-overlay').classList.remove('show');
};

function filterExerciseSearch() {
  var q = (document.getElementById('sb-search-inp').value || '').toLowerCase();
  var results = q
    ? EXERCISE_LIBRARY.filter(function(ex) { return ex.name.toLowerCase().includes(q); })
    : EXERCISE_LIBRARY;
  document.getElementById('sb-search-results').innerHTML = results.map(function(ex) {
    var escaped = ex.name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return '<div class="sb-search-item" onclick="addSbExercise(\'' + escaped + '\')">' + sanitise(ex.name) + '</div>';
  }).join('');
}

window.filterExerciseSearch = filterExerciseSearch;

window.addSbExercise = function(name) {
  sbExercises.push({ name: name, sets: 3, reps: 8, rest: 60, exType: 'standard', note: '' });
  window.closeExerciseSearch();
  renderSessionsSection();
};

// ─── ASSIGNMENTS ──────────────────────────────────────────────────────────────
function renderAssignmentsSection() {
  var activeSess = allSessions.filter(function(s) { return s.active !== false; });
  var today = new Date().toISOString().split('T')[0];

  var sgptOpts = activeSess.filter(function(s) { return s.visibility === 'sgpt'; }).map(function(s) {
    return '<option value="' + s._id + '">' + sanitise(s.name) + '</option>';
  }).join('');
  var pt121Opts = activeSess.filter(function(s) { return s.visibility === 'pt121'; }).map(function(s) {
    return '<option value="' + s._id + '">' + sanitise(s.name) + '</option>';
  }).join('');
  var optGroups = (sgptOpts ? '<optgroup label="SGPT">' + sgptOpts + '</optgroup>' : '') +
                  (pt121Opts ? '<optgroup label="1-2-1 PT">' + pt121Opts + '</optgroup>' : '');

  var nonCoach = allMembers.filter(function(m) { return m.role !== 'coach'; });
  var checklistHtml = nonCoach.map(function(m) {
    var tags = '';
    if (m.sgpt) tags += ' <span class="sgpt-tag">[SGPT]</span>';
    if (m.pt121) tags += ' <span class="pt121-tag">[1-2-1]</span>';
    return '<label class="member-check-row"><input type="checkbox" id="achk-' + m.uid + '" value="' + m.uid + '" onchange="checkAssignReady()"> ' + sanitise(m.displayName || m.email || m.uid) + tags + '</label>';
  }).join('');

  document.getElementById('section-assignments').innerHTML =
    '<div class="section-hd"><div class="section-ttl">ASSIGN SESSION</div></div>' +
    '<div class="assignments-split">' +
      '<div class="assign-form-panel">' +
        '<div class="sb-lbl">SESSION</div>' +
        '<select class="admin-select" id="assign-sess-sel" onchange="checkAssignReady()">' +
          '<option value="">Select a session…</option>' + optGroups +
        '</select>' +
        '<div class="sb-lbl">FOR DATE</div>' +
        '<input class="admin-date-inp" type="date" id="assign-date" value="' + today + '" min="' + today + '" onchange="checkAssignReady()">' +
        '<div class="sb-lbl">SEND TO</div>' +
        '<div class="send-toggle">' +
          '<button class="send-opt' + (sendMode === 'all-sgpt' ? ' on' : '') + '" onclick="setSendMode(\'all-sgpt\')">ALL SGPT</button>' +
          '<button class="send-opt' + (sendMode === 'all-pt121' ? ' on' : '') + '" onclick="setSendMode(\'all-pt121\')">ALL 1-2-1</button>' +
          '<button class="send-opt' + (sendMode === 'specific' ? ' on' : '') + '" onclick="setSendMode(\'specific\')">SPECIFIC</button>' +
        '</div>' +
        '<div id="assign-checklist" style="' + (sendMode === 'specific' ? '' : 'display:none;') + 'background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:8px 12px;margin-bottom:14px;max-height:280px;overflow-y:auto">' +
          (checklistHtml || '<div style="color:var(--dim);font-size:13px;padding:8px 0">No members yet.</div>') +
        '</div>' +
        '<button class="admin-save-btn" id="assign-btn" onclick="doAssignSession()" disabled>ASSIGN</button>' +
      '</div>' +
      '<div class="assign-hist-panel">' +
        '<div class="assign-hist-hd">' +
          '<span class="sb-lbl">RECENT ASSIGNMENTS</span>' +
          '<button class="refresh-btn" onclick="loadAssignmentHistory()">↻ Refresh</button>' +
        '</div>' +
        '<div id="assign-history-container"><div style="color:var(--dim);font-size:13px">Loading…</div></div>' +
      '</div>' +
    '</div>';

  loadAssignmentHistory();
}

window.setSendMode = function(mode) {
  sendMode = mode;
  var cl = document.getElementById('assign-checklist');
  if (cl) cl.style.display = mode === 'specific' ? '' : 'none';
  document.querySelectorAll('.send-opt').forEach(function(b, i) {
    b.classList.toggle('on', (i === 0 && mode === 'all-sgpt') || (i === 1 && mode === 'all-pt121') || (i === 2 && mode === 'specific'));
  });
  checkAssignReady();
};

function checkAssignReady() {
  var sessEl = document.getElementById('assign-sess-sel');
  var dateEl = document.getElementById('assign-date');
  var sessOk = !!(sessEl && sessEl.value);
  var dateOk = !!(dateEl && dateEl.value);
  var recipOk = sendMode === 'all-sgpt'
    ? allMembers.some(function(m) { return m.sgpt === true; })
    : sendMode === 'all-pt121'
    ? allMembers.some(function(m) { return m.pt121 === true; })
    : document.querySelectorAll('#assign-checklist input:checked').length > 0;
  var btn = document.getElementById('assign-btn');
  if (btn) btn.disabled = !(sessOk && dateOk && recipOk);
}
window.checkAssignReady = checkAssignReady;

window.doAssignSession = async function() {
  var sessId = document.getElementById('assign-sess-sel').value;
  var forDate = document.getElementById('assign-date').value;
  var sess = allSessions.find(function(s) { return s._id === sessId; });
  if (!sess || !forDate) return;

  var recipients;
  if (sendMode === 'all-sgpt') {
    recipients = allMembers.filter(function(m) { return m.sgpt === true; }).map(function(m) { return m.uid; });
  } else if (sendMode === 'all-pt121') {
    recipients = allMembers.filter(function(m) { return m.pt121 === true; }).map(function(m) { return m.uid; });
  } else {
    recipients = Array.from(document.querySelectorAll('#assign-checklist input:checked')).map(function(el) { return el.value; });
  }

  if (!recipients.length) { showToast('No recipients selected', true); return; }

  var btn = document.getElementById('assign-btn');
  btn.disabled = true;
  btn.textContent = 'ASSIGNING…';

  try {
    for (var i = 0; i < recipients.length; i++) {
      await addDoc(collection(db, 'users', recipients[i], 'assignedSessions'), {
        sessionData: sess,
        sessionName: sess.name,
        assignedBy: currentCoach ? currentCoach.uid : '',
        assignedAt: serverTimestamp(),
        assignedFor: forDate,
        status: 'pending'
      });
    }
    showToast('ASSIGNED TO ' + recipients.length + ' MEMBER' + (recipients.length !== 1 ? 'S' : ''));
    document.getElementById('assign-sess-sel').value = '';
    document.getElementById('assign-date').value = new Date().toISOString().split('T')[0];
    checkAssignReady();
    loadAssignmentHistory();
  } catch(err) {
    showToast('ASSIGNMENT FAILED — TRY AGAIN', true);
  } finally {
    btn.textContent = 'ASSIGN';
    checkAssignReady();
  }
};

window.loadAssignmentHistory = async function() {
  var container = document.getElementById('assign-history-container');
  if (!container) return;
  container.innerHTML = '<div style="color:var(--dim);font-size:13px">Loading…</div>';
  try {
    var rows = [];
    for (var i = 0; i < allMembers.length; i++) {
      var m = allMembers[i];
      var snap = await getDocs(collection(db, 'users', m.uid, 'assignedSessions'));
      snap.docs.forEach(function(d) {
        rows.push(Object.assign({ _memberName: m.displayName || m.email }, d.data()));
      });
    }
    rows.sort(function(a, b) {
      var at = a.assignedAt && a.assignedAt.toDate ? a.assignedAt.toDate().getTime() : 0;
      var bt = b.assignedAt && b.assignedAt.toDate ? b.assignedAt.toDate().getTime() : 0;
      return bt - at;
    });
    rows = rows.slice(0, 50);
    if (!rows.length) { container.innerHTML = '<div style="color:var(--dim);font-size:13px">No assignments yet.</div>'; return; }
    var html = '<table class="hist-table"><thead><tr><th>MEMBER</th><th>SESSION</th><th>DATE</th><th>STATUS</th></tr></thead><tbody>';
    rows.forEach(function(r) {
      var statusHtml = r.status === 'completed'
        ? '<span class="hist-done">✓ Done</span>'
        : r.status === 'expired'
        ? '<span class="hist-expired">✕ Expired</span>'
        : '<span class="hist-pending">⏱ Pending</span>';
      html += '<tr><td>' + sanitise(r._memberName || '') + '</td><td>' + sanitise(r.sessionName || '') + '</td><td>' + fmtDateStr(r.assignedFor) + '</td><td>' + statusHtml + '</td></tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  } catch(err) {
    container.innerHTML = '<div style="color:var(--red);font-size:13px">Failed to load history.</div>';
  }
};

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
async function loadCoachNotes() {
  try {
    var snap = await getDoc(doc(db, 'gym', '8RB', 'config', 'main'));
    if (snap.exists()) coachNotesValue = snap.data().coachNotes || '';
  } catch(err) { console.warn('Failed to load coach notes:', err); }
}

async function loadLockedPanels() {
  try {
    var snap = await getDoc(doc(db, 'gym', '8RB', 'config', 'locked-panels'));
    if (snap.exists()) {
      var d = snap.data();
      lockedPanelsData.sgpt = Object.assign({ heading: '', body: '', url: '' }, d.sgpt || {});
      lockedPanelsData.pt121 = Object.assign({ heading: '', body: '', url: '' }, d.pt121 || {});
    }
  } catch(err) { console.warn('Failed to load locked panels:', err); }
}

function makeTeaserPreview(tier) {
  var headingEl = document.getElementById(tier + '-teaser-heading');
  var bodyEl = document.getElementById(tier + '-teaser-body');
  var urlEl = document.getElementById(tier + '-teaser-url');
  var h = headingEl ? headingEl.value : lockedPanelsData[tier].heading;
  var b = bodyEl ? bodyEl.value : lockedPanelsData[tier].body;
  var u = urlEl ? urlEl.value : (lockedPanelsData[tier].url || 'https://8roundsboxing.com');
  if (!h && !b) return '<div style="color:var(--dim);font-size:13px">Fill in heading and body to preview.</div>';
  return '<div class="tp-heading">' + sanitise(h) + '</div>' +
    '<div class="tp-body">' + sanitise(b) + '</div>' +
    '<div class="tp-link">Speak to Darren at the gym or <a href="' + sanitise(u) + '" target="_blank" rel="noopener noreferrer">visit our website →</a></div>';
}

function renderSettingsSection() {
  document.getElementById('section-settings').innerHTML =
    '<div class="section-hd"><div class="section-ttl">SETTINGS</div></div>' +

    '<div class="settings-card">' +
      '<div class="settings-card-ttl">COACH\'S NOTES</div>' +
      '<div class="settings-card-sub">Shown on the Train tab for all members.</div>' +
      '<textarea class="admin-textarea" id="settings-notes-ta" maxlength="1000" oninput="onNotesInput()" placeholder="Write your notes for members here…">' + sanitise(coachNotesValue) + '</textarea>' +
      '<div class="admin-charcount"><span id="notes-char-count">' + coachNotesValue.length + '</span> / 1000</div>' +
      '<button class="admin-save-btn" id="save-notes-btn" style="width:auto;padding:0 32px" onclick="saveCoachNotes()">SAVE NOTES</button>' +
    '</div>' +

    '<div class="settings-card">' +
      '<div class="settings-card-ttl">SGPT LOCKED PANEL</div>' +
      '<div class="settings-card-sub">What non-SGPT members see when the SGPT section is locked.</div>' +
      '<div class="sb-lbl">HEADING</div>' +
      '<input class="sb-name-inp" id="sgpt-teaser-heading" type="text" placeholder="e.g. SMALL GROUP PERSONAL TRAINING" value="' + sanitise(lockedPanelsData.sgpt.heading) + '" oninput="updateTeaserPreview(\'sgpt\')">' +
      '<div class="sb-lbl">BODY TEXT</div>' +
      '<textarea class="admin-textarea" id="sgpt-teaser-body" style="min-height:80px" placeholder="Short description…" oninput="updateTeaserPreview(\'sgpt\')">' + sanitise(lockedPanelsData.sgpt.body) + '</textarea>' +
      '<div class="sb-lbl">LINK URL</div>' +
      '<input class="sb-name-inp" id="sgpt-teaser-url" type="url" placeholder="https://8roundsboxing.com" value="' + sanitise(lockedPanelsData.sgpt.url) + '" oninput="updateTeaserPreview(\'sgpt\')" style="margin-bottom:12px">' +
      '<div class="preview-label">PREVIEW</div>' +
      '<div class="teaser-preview" id="teaser-preview-sgpt">' + makeTeaserPreview('sgpt') + '</div>' +
      '<button class="admin-save-btn" style="width:auto;padding:0 32px;margin-top:16px" onclick="saveLockedPanel(\'sgpt\')">SAVE SGPT PANEL</button>' +
    '</div>' +

    '<div class="settings-card">' +
      '<div class="settings-card-ttl">1-2-1 PT LOCKED PANEL</div>' +
      '<div class="settings-card-sub">What non-1-2-1 members see when the 1-2-1 section is locked.</div>' +
      '<div class="sb-lbl">HEADING</div>' +
      '<input class="sb-name-inp" id="pt121-teaser-heading" type="text" placeholder="e.g. 1-2-1 PERSONAL TRAINING" value="' + sanitise(lockedPanelsData.pt121.heading) + '" oninput="updateTeaserPreview(\'pt121\')">' +
      '<div class="sb-lbl">BODY TEXT</div>' +
      '<textarea class="admin-textarea" id="pt121-teaser-body" style="min-height:80px" placeholder="Short description…" oninput="updateTeaserPreview(\'pt121\')">' + sanitise(lockedPanelsData.pt121.body) + '</textarea>' +
      '<div class="sb-lbl">LINK URL</div>' +
      '<input class="sb-name-inp" id="pt121-teaser-url" type="url" placeholder="https://8roundsboxing.com" value="' + sanitise(lockedPanelsData.pt121.url) + '" oninput="updateTeaserPreview(\'pt121\')" style="margin-bottom:12px">' +
      '<div class="preview-label">PREVIEW</div>' +
      '<div class="teaser-preview" id="teaser-preview-pt121">' + makeTeaserPreview('pt121') + '</div>' +
      '<button class="admin-save-btn" style="width:auto;padding:0 32px;margin-top:16px" onclick="saveLockedPanel(\'pt121\')">SAVE 1-2-1 PANEL</button>' +
    '</div>';
}

window.onNotesInput = function() {
  var ta = document.getElementById('settings-notes-ta');
  var ct = document.getElementById('notes-char-count');
  if (ta && ct) ct.textContent = ta.value.length;
};

window.saveCoachNotes = async function() {
  var ta = document.getElementById('settings-notes-ta');
  var notes = ta ? ta.value : '';
  var btn = document.getElementById('save-notes-btn');
  btn.disabled = true; btn.textContent = 'SAVING…';
  try {
    await setDoc(doc(db, 'gym', '8RB', 'config', 'main'), {
      coachNotes: notes,
      coachNotesUpdatedAt: serverTimestamp(),
      coachNotesUpdatedBy: currentCoach ? (currentCoach.displayName || currentCoach.email) : 'coach'
    }, { merge: true });
    coachNotesValue = notes;
    showToast("COACH'S NOTES SAVED");
  } catch(err) {
    showToast('SAVE FAILED — TRY AGAIN', true);
  } finally {
    btn.disabled = false; btn.textContent = 'SAVE NOTES';
  }
};

window.saveLockedPanel = async function(tier) {
  var headingEl = document.getElementById(tier + '-teaser-heading');
  var bodyEl = document.getElementById(tier + '-teaser-body');
  var urlEl = document.getElementById(tier + '-teaser-url');
  if (!headingEl) return;
  var panelData = {
    heading: headingEl.value,
    body: bodyEl ? bodyEl.value : '',
    url: urlEl ? urlEl.value : ''
  };
  lockedPanelsData[tier] = panelData;
  var patch = {};
  patch[tier] = panelData;
  try {
    await setDoc(doc(db, 'gym', '8RB', 'config', 'locked-panels'), patch, { merge: true });
    showToast((tier === 'sgpt' ? 'SGPT' : '1-2-1') + ' PANEL SAVED');
  } catch(err) {
    showToast('SAVE FAILED — TRY AGAIN', true);
  }
};

window.updateTeaserPreview = function(tier) {
  var el = document.getElementById('teaser-preview-' + tier);
  if (el) el.innerHTML = makeTeaserPreview(tier);
};

// ─── SIGN OUT ─────────────────────────────────────────────────────────────────
window.adminSignOut = async function() {
  try { await signOut(auth); window.location.href = 'index.html'; } catch(e) {}
};

// ─── AUTH GATE ────────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async function(user) {
  var gate = document.getElementById('admin-gate');
  var shell = document.getElementById('admin-shell');
  if (!user) { window.location.href = 'index.html'; return; }
  try {
    var profileSnap = await getDoc(doc(db, 'users', user.uid, 'profile', 'data'));
    if (!profileSnap.exists() || profileSnap.data().role !== 'coach') {
      gate.textContent = 'Access denied.';
      setTimeout(function() { window.location.href = 'index.html'; }, 1500);
      return;
    }
    currentCoach = user;
    gate.style.display = 'none';
    shell.style.display = 'flex';
    document.getElementById('admin-coach-name').textContent = user.displayName || user.email;
    await loadCoachNotes();
    await loadLockedPanels();
    await loadMembers();
    await loadAllSessions();
    showSection('dashboard');
  } catch(err) {
    gate.textContent = 'Error checking access. Please try again.';
    console.error(err);
  }
});
