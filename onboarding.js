import { showApp, showPage } from './app.js';
import { db } from './firebase.js';
import { doc, setDoc } from 'firebase/firestore';

// ─── MODULE STATE ──────────────────────────────────────────────────────────────
var obUser = null;
var obReduced = false;

// Duration constants — zeroed when prefers-reduced-motion is set
var DUR_SCREEN = 300;
var DUR_OVERLAY = 250;
var DUR_EXIT = 200;
var DUR_FINAL = 400;

var STAGE_DATA = [
  {
    label: 'TRAIN',
    ariaLabel: 'Step 2 of 5: Train',
    progress: '25%',
    desc: 'Your strength and conditioning sessions live here. Choose a workout, log your sets, and track your weights over time. Built around 8RB\'s programming — start with Squat Day if you\'re not sure where to begin.',
    next: 'NEXT →'
  },
  {
    label: 'BOX',
    ariaLabel: 'Step 3 of 5: Box',
    progress: '50%',
    desc: 'Your virtual boxing coach. FREESTYLE gives you a round timer for bag work and shadow boxing. DRILL calls combinations for you to follow — start with Basics. LEARN is your technique library. Use it at the gym or anywhere you can shadow box.',
    next: 'NEXT →'
  },
  {
    label: 'PROGRESS',
    ariaLabel: 'Step 4 of 5: Progress',
    progress: '75%',
    desc: 'Nothing here yet — and that\'s exactly right. Every session you log shows up here. Your weights, your streaks, your personal bests. Check back after your first workout and you\'ll start to see your journey take shape.',
    next: 'NEXT →'
  },
  {
    label: 'PROFILE',
    ariaLabel: 'Step 5 of 5: Profile',
    progress: '100%',
    desc: 'Your account, your settings, your data. Change your units, update your display name, or sign out here. Your training data is securely backed up to the cloud and follows you across devices.',
    next: 'LET\'S GO →'
  }
];

var PAGES = ['train', 'box', 'progress', 'profile'];
var currentStageIdx = 0; // 0–3 maps to STAGE_DATA

// ─── ENTRY POINT ──────────────────────────────────────────────────────────────
function startOnboarding(user, welcomeMsg) {
  obUser = user;
  obReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (obReduced) {
    DUR_SCREEN = 0; DUR_OVERLAY = 0; DUR_EXIT = 0; DUR_FINAL = 0;
  }

  var wrap = document.getElementById('ob-wrap');
  if (!wrap) { showApp(); return; }
  wrap.style.display = 'block';

  // Render the app fully in the background before showing anything
  showApp();

  showStage2(user, welcomeMsg);
}

// ─── STAGE 2 — WELCOME ────────────────────────────────────────────────────────
function showStage2(user, welcomeMsg) {
  var name = (user && user.displayName) ? user.displayName.toUpperCase() : 'CHAMPION';

  var nameEl = document.getElementById('ob-name');
  if (nameEl) {
    nameEl.textContent = name;
    nameEl.style.fontSize = name.length > 12 ? '72px' : '';
  }

  var wmEl = document.getElementById('ob-wm-text');
  if (wmEl) wmEl.textContent = welcomeMsg || 'Your coach has set this up for you.';

  var welcome = document.getElementById('ob-welcome');
  if (welcome) welcome.style.display = 'flex';

  var overlay = document.getElementById('ob-overlay');
  var final = document.getElementById('ob-final');
  if (overlay) overlay.style.display = 'none';
  if (final) final.style.display = 'none';

  var cta = document.getElementById('ob-cta-welcome');
  if (cta) cta.onclick = goToStage3;
}

// ─── STAGE 3 — FIRST TOUR SLIDE ───────────────────────────────────────────────
function goToStage3() {
  var welcome = document.getElementById('ob-welcome');
  if (welcome) {
    welcome.style.transition = 'opacity ' + DUR_SCREEN + 'ms ease-out';
    welcome.style.opacity = '0';
  }

  setTimeout(function() {
    if (welcome) welcome.style.display = 'none';
    currentStageIdx = 0;
    showOverlayStage();
  }, DUR_SCREEN || 10);
}

// ─── OVERLAY STAGE DISPLAY ────────────────────────────────────────────────────
function showOverlayStage() {
  var data = STAGE_DATA[currentStageIdx];

  // Navigate the background app tab
  showPage(PAGES[currentStageIdx]);

  // Dim the app
  dimApp(true);

  // Populate sheet content
  var labelEl = document.getElementById('ob-sheet-label');
  var descEl = document.getElementById('ob-sheet-desc');
  var nextEl = document.getElementById('ob-next');
  var fillEl = document.getElementById('ob-progress-fill');
  var sheetEl = document.getElementById('ob-sheet');

  if (labelEl) labelEl.textContent = data.label;
  if (descEl) descEl.textContent = data.desc;
  if (nextEl) nextEl.textContent = data.next;
  if (fillEl) fillEl.style.width = data.progress;
  if (sheetEl) sheetEl.setAttribute('aria-label', data.ariaLabel);

  // Wire buttons
  var skipEl = document.getElementById('ob-skip');
  if (skipEl) skipEl.onclick = skipToFinal;
  if (nextEl) {
    nextEl.onclick = (currentStageIdx < STAGE_DATA.length - 1) ? goToNextOverlayStage : goToStage7;
  }

  // Show overlay
  var overlay = document.getElementById('ob-overlay');
  if (overlay) overlay.style.display = 'block';

  // Animate sheet in
  if (sheetEl) {
    sheetEl.style.transform = 'translateY(100%)';
    sheetEl.style.transition = 'none';
    requestAnimationFrame(function() {
      sheetEl.style.transition = 'transform ' + DUR_OVERLAY + 'ms ease-out';
      sheetEl.style.transform = 'translateY(0)';
    });
  }
}

// ─── ADVANCE OVERLAY STAGE ────────────────────────────────────────────────────
function goToNextOverlayStage() {
  var sheetEl = document.getElementById('ob-sheet');

  // Exit sheet
  if (sheetEl) {
    sheetEl.style.transition = 'transform ' + DUR_EXIT + 'ms ease-in';
    sheetEl.style.transform = 'translateY(100%)';
  }

  setTimeout(function() {
    currentStageIdx++;
    showOverlayStage();
  }, DUR_EXIT || 10);
}

// ─── SKIP ─────────────────────────────────────────────────────────────────────
function skipToFinal() {
  var sheetEl = document.getElementById('ob-sheet');
  if (sheetEl) {
    sheetEl.style.transition = 'transform ' + DUR_EXIT + 'ms ease-in';
    sheetEl.style.transform = 'translateY(100%)';
  }
  setTimeout(function() {
    showPage('train');
    goToStage7();
  }, DUR_EXIT || 10);
}

// ─── STAGE 7 — FINAL SCREEN ───────────────────────────────────────────────────
function goToStage7() {
  var overlay = document.getElementById('ob-overlay');
  if (overlay) overlay.style.display = 'none';

  // Remove app dim
  dimApp(false);

  // Populate final screen name
  var name = (obUser && obUser.displayName) ? obUser.displayName.toUpperCase() : 'CHAMPION';
  var fNameEl = document.getElementById('ob-f-name');
  if (fNameEl) {
    fNameEl.textContent = name;
    fNameEl.style.fontSize = name.length > 12 ? '72px' : '';
  }

  // Show final screen and fade in
  var final = document.getElementById('ob-final');
  if (final) {
    final.style.display = 'flex';
    // Force reflow so transition fires
    final.offsetHeight; // eslint-disable-line no-unused-expressions
    final.classList.add('ob-final-in');
  }

  // Trigger element animations (add class after a brief delay to let final screen render)
  setTimeout(function() {
    var els = ['ob-f-gym-label', 'ob-f-name', 'ob-sweep', 'ob-f-headline', 'ob-f-sub'];
    els.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.classList.add('ob-anim');
    });
  }, 50);

  // Wire CTA
  var ctaFinal = document.getElementById('ob-cta-final');
  if (ctaFinal) ctaFinal.onclick = completeOnboarding;
}

// ─── COMPLETE ─────────────────────────────────────────────────────────────────
async function completeOnboarding() {
  // Await the Firestore write so the local cache is committed before navigation.
  // This means Firestore remains the source of truth — changing onboarded:false
  // in the console will re-trigger onboarding on next sign-in on any device.
  if (obUser) {
    try {
      await setDoc(doc(db, 'users', obUser.uid, 'profile', 'data'), { onboarded: true }, { merge: true });
    } catch(e) {
      console.warn('[8RB] onboarded write failed, proceeding anyway:', e);
    }
  }

  // Navigate to TRAIN
  showPage('train');

  // Fade out final screen then hide wrap
  var final = document.getElementById('ob-final');
  if (final) {
    final.style.transition = 'opacity 300ms ease-in';
    final.style.opacity = '0';
  }
  setTimeout(function() {
    var wrap = document.getElementById('ob-wrap');
    if (wrap) wrap.style.display = 'none';
    if (final) { final.style.opacity = ''; final.classList.remove('ob-final-in'); }
  }, DUR_SCREEN || 10);
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function dimApp(on) {
  var appEl = document.getElementById('app-content');
  if (!appEl) return;
  if (on) {
    appEl.style.transition = 'filter 200ms ease-out';
    appEl.style.filter = 'brightness(0.4)';
  } else {
    appEl.style.transition = 'filter 200ms ease-out';
    appEl.style.filter = '';
  }
}

// ─── EXPOSE ENTRY POINT ───────────────────────────────────────────────────────
window.startOnboarding = startOnboarding;
