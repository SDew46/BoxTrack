import { savedInstallPrompt } from './app.js';

var igOnComplete = null;

function detectPlatform() {
  var ua = navigator.userAgent;
  var isAndroid = /Android/i.test(ua);
  var isIOS = /iPhone|iPad/i.test(ua);
  var isChrome = /Chrome/i.test(ua) && !/Edge|EdgA/i.test(ua);

  if (isAndroid && savedInstallPrompt) return 'android-prompt';
  if (isAndroid) return 'android-manual';
  if (isIOS && !isChrome) return 'ios';
  return 'other';
}

function handleInstallAccepted() {
  var gate = document.getElementById('install-gate');
  if (gate) {
    gate.innerHTML =
      '<div class="ig-installed-screen">' +
        '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>' +
        '<h2 class="ig-installed-title">INSTALLED!</h2>' +
        '<p class="ig-installed-sub">Open 8RB from your home screen.</p>' +
      '</div>';
  }
  setTimeout(function() {
    if (igOnComplete) igOnComplete();
  }, 3000);
}

function handleInstallDismissed() {
  localStorage.setItem('installGateDismissed', '1');
  var gate = document.getElementById('install-gate');
  if (gate) {
    gate.style.transition = 'opacity 0.3s ease';
    gate.style.opacity = '0';
    setTimeout(function() {
      if (gate.parentNode) gate.parentNode.removeChild(gate);
      if (igOnComplete) igOnComplete();
    }, 300);
  } else {
    if (igOnComplete) igOnComplete();
  }
}

function showInstallGate(onComplete) {
  igOnComplete = onComplete;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var platform = detectPlatform();

  var gate = document.createElement('div');
  gate.id = 'install-gate';
  gate.setAttribute('role', 'region');
  gate.setAttribute('aria-label', 'Install 8RB app');
  if (reduced) gate.classList.add('ig-reduced');

  var shareIconSvg =
    '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>' +
      '<polyline points="16 6 12 2 8 6"/>' +
      '<line x1="12" y1="2" x2="12" y2="15"/>' +
    '</svg>';

  var platformHtml = '';
  if (platform === 'android-manual') {
    platformHtml =
      '<div class="ig-platform-card" role="region" aria-label="Install instructions">' +
        '<p class="ig-card-label">TAP &#x22EE; THEN</p>' +
        '<p class="ig-card-action">Add to Home Screen</p>' +
      '</div>';
  } else if (platform === 'ios') {
    platformHtml =
      '<div class="ig-platform-card ig-ios-card" role="region" aria-label="iOS install instructions">' +
        '<span class="ig-card-label">TAP</span>' +
        shareIconSvg +
        '<span class="ig-card-label">THEN</span>' +
        '<span class="ig-card-action">Add to Home Screen</span>' +
      '</div>';
  } else if (platform === 'other') {
    platformHtml =
      '<p class="ig-platform-instruction">' +
        'Open this page in Chrome on your phone and tap Add to Home Screen for the best experience.' +
      '</p>';
  }

  gate.innerHTML =
    '<img class="ig-watermark" src="8RB.webp" alt="" aria-hidden="true">' +
    '<span class="ig-gym-label">8RB BY 8 ROUNDS BOXING</span>' +
    '<h1 class="ig-headline">GET THE APP</h1>' +
    '<p class="ig-subtext">Add 8RB to your home screen for the full experience.</p>' +
    platformHtml +
    '<a class="ig-continue-link" role="button" tabindex="0" id="ig-continue-btn" aria-label="Continue in browser without installing">Continue in browser &#x2192;</a>';

  if (platform === 'android-prompt') {
    var installBtn = document.createElement('button');
    installBtn.id = 'ig-install-btn';
    installBtn.setAttribute('aria-label', 'Add 8RB to home screen');
    installBtn.textContent = 'ADD TO HOME SCREEN';
    if (reduced) installBtn.style.animation = 'none';
    installBtn.addEventListener('click', function() {
      var prompt = savedInstallPrompt;
      if (!prompt) { handleInstallDismissed(); return; }
      prompt.prompt();
      prompt.userChoice.then(function(result) {
        if (result.outcome === 'accepted') {
          sessionStorage.setItem('installAccepted', '1');
          handleInstallAccepted();
        }
      });
    });
    gate.appendChild(installBtn);
  }

  document.body.appendChild(gate);

  var continueBtn = document.getElementById('ig-continue-btn');
  continueBtn.addEventListener('click', handleInstallDismissed);
  continueBtn.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleInstallDismissed(); }
  });
}

window.showInstallGate = showInstallGate;
