// @ts-check
const { test, expect } = require('./fixtures');
const path = require('path');

const APP_URL = '/BoxTrack/';
const APP_CONTENT_TIMEOUT = 15000;

// Helper: navigate with Firebase mocked, wait for app to load
// Sets installGateDismissed so all standard tests skip the install gate.
async function loadApp(page, mockFirebase, firestoreMock) {
  await mockFirebase(firestoreMock || null);
  await page.addInitScript(() => {
    localStorage.setItem('installGateDismissed', '1');
  });
  await page.goto(APP_URL);
  // Wait for splash to go away and app-content to appear
  await page.waitForSelector('#app-content', { state: 'visible', timeout: APP_CONTENT_TIMEOUT });
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: App loads, all nav tabs visible
// ─────────────────────────────────────────────────────────────────────────────
test('App loads — all four nav tabs visible', async ({ page, mockFirebase }) => {
  await loadApp(page, mockFirebase);

  await expect(page.locator('.nb-train')).toBeVisible();
  await expect(page.locator('.nb-box')).toBeVisible();
  await expect(page.locator('.nb-progress')).toBeVisible();
  await expect(page.locator('.nb-profile')).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: TRAIN tab session library renders
// ─────────────────────────────────────────────────────────────────────────────
test('TRAIN tab — session library renders with at least one session card', async ({ page, mockFirebase }) => {
  await loadApp(page, mockFirebase);

  // Click Train nav to ensure we're on the right tab
  await page.locator('.nb-train').click();
  await page.waitForSelector('#train-lib', { state: 'visible', timeout: 8000 });

  // Session list renders immediately
  await page.waitForSelector('#session-list', { state: 'visible', timeout: 5000 });

  // At least one routine card should be present (from mock routines data)
  const cards = page.locator('#session-list .routine-card');
  await expect(cards.first()).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: TRAIN tab — tapping a session opens log view
// ─────────────────────────────────────────────────────────────────────────────
test('TRAIN tab — tapping a session opens log view', async ({ page, mockFirebase }) => {
  await loadApp(page, mockFirebase);

  await page.locator('.nb-train').click();
  await page.waitForSelector('#train-lib', { state: 'visible', timeout: 8000 });

  // Wait for the routine list to render
  await page.waitForSelector('#session-list .routine-card', { state: 'visible', timeout: 5000 });

  // Click the START button on the first routine card directly
  await page.locator('#session-list .routine-card .sc-start-btn').first().click();

  // Log view should be visible, library should be hidden
  await expect(page.locator('#train-log')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#train-lib')).toBeHidden();
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 4: BOX tab — three tabs visible
// ─────────────────────────────────────────────────────────────────────────────
test('BOX tab — FREESTYLE, DRILL and LEARN tabs visible', async ({ page, mockFirebase }) => {
  await loadApp(page, mockFirebase);

  await page.locator('.nb-box').click();

  await expect(page.locator('#bxt-freestyle')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#bxt-drill')).toBeVisible();
  await expect(page.locator('#bxt-learn')).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 5: BOX tab FREESTYLE — shows 3:00 timer and START button
// ─────────────────────────────────────────────────────────────────────────────
test('BOX tab FREESTYLE — shows 3:00 and START button', async ({ page, mockFirebase }) => {
  await loadApp(page, mockFirebase);

  await page.locator('.nb-box').click();
  // FREESTYLE is the default active tab
  await expect(page.locator('#boxtab-freestyle')).toBeVisible({ timeout: 5000 });

  // Timer should show 3:00
  await expect(page.locator('#t-digits')).toHaveText('3:00');

  // START button should be visible
  await expect(page.locator('#fs-start-btn')).toContainText('START');
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 6: BOX tab DRILL — Combo of the Week card visible
// ─────────────────────────────────────────────────────────────────────────────
test('BOX tab DRILL — Combo of the Week card is visible', async ({ page, mockFirebase }) => {
  await loadApp(page, mockFirebase);

  await page.locator('.nb-box').click();
  await page.locator('#bxt-drill').click();

  // Wait for the drill tab content to be visible
  await expect(page.locator('#boxtab-drill')).toBeVisible({ timeout: 5000 });

  // The cotd-area is rendered by box.js initBoxPage/renderCOTW
  // It contains text "COMBO OF THE WEEK"
  await expect(page.locator('#cotd-area')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#cotd-area')).toContainText('COMBO', { timeout: 5000 });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 7: PROGRESS tab — weekly summary banner visible
// ─────────────────────────────────────────────────────────────────────────────
test('PROGRESS tab — weekly summary banner visible', async ({ page, mockFirebase }) => {
  await loadApp(page, mockFirebase);

  await page.locator('.nb-progress').click();

  // Wait for the banner to render
  await expect(page.locator('#weekly-banner')).toBeVisible({ timeout: 8000 });

  // Banner should have some content (not be empty)
  await expect(page.locator('#weekly-banner')).not.toBeEmpty({ timeout: 5000 });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 8: PROFILE tab — account section visible
// ─────────────────────────────────────────────────────────────────────────────
test('PROFILE tab — account section with Sign Out visible', async ({ page, mockFirebase }) => {
  await loadApp(page, mockFirebase);

  await page.locator('.nb-profile').click();

  // Wait for profile-content to be populated
  await expect(page.locator('#profile-content')).not.toBeEmpty({ timeout: 8000 });

  // Sign Out button should be present
  await expect(page.locator('#profile-content')).toContainText('SIGN OUT', { timeout: 5000 });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 9: Auth screen shows when NOT authenticated
// ─────────────────────────────────────────────────────────────────────────────
test('Auth screen shows when not authenticated', async ({ page }) => {
  // Use the no-user auth mock so onAuthStateChanged fires with null deterministically.
  const MOCKS_DIR = path.resolve(__dirname, 'mocks');
  await page.route('**/firebase-app.js', r => r.fulfill({ status:200, contentType:'text/javascript; charset=utf-8', path: path.join(MOCKS_DIR,'firebase-app.mock.js') }));
  await page.route('**/firebase-auth.js', r => r.fulfill({ status:200, contentType:'text/javascript; charset=utf-8', path: path.join(MOCKS_DIR,'firebase-auth-nouser.mock.js') }));
  await page.route('**/firebase-firestore.js', r => r.fulfill({ status:200, contentType:'text/javascript; charset=utf-8', path: path.join(MOCKS_DIR,'firebase-firestore.mock.js') }));
  // Skip the install gate (it blocks splash completion otherwise)
  await page.addInitScript(() => { localStorage.setItem('installGateDismissed', '1'); });

  await page.goto(APP_URL);

  // onAuthStateChanged fires with null → resolveAuth → showSignInScreen
  await page.waitForSelector('#auth-screen', { state: 'visible', timeout: 8000 });
  await expect(page.locator('#auth-screen')).toBeVisible();

  // App content should NOT be visible
  await expect(page.locator('#app-content')).toBeHidden();
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 9b: Resuming state shows when lastSignedIn flag is set
// ─────────────────────────────────────────────────────────────────────────────
test('Loading screen shows when lastSignedIn flag is recent', async ({ page }) => {
  // Set a fresh lastSignedIn timestamp before navigation so the app shows
  // the combo chip loading screen instead of the sign-in form.
  await page.addInitScript(() => {
    localStorage.setItem('8rb.lastSignedIn', Date.now().toString());
    localStorage.setItem('installGateDismissed', '1');
  });
  await page.goto(APP_URL);
  // The module-level check runs synchronously on load — loading screen should
  // be visible before onAuthStateChanged fires.
  await expect(page.locator('#auth-screen')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.loading-screen')).toBeVisible();
  await expect(page.locator('.loading-text')).toContainText('Getting ready...');
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 10: Onboarding shows for a new (never-onboarded) user
// ─────────────────────────────────────────────────────────────────────────────
test('Onboarding shows for a new user with no profile', async ({ page, mockFirebase }) => {
  // Use the new-user variant firestore mock (all getDoc returns exists=false)
  // This causes ensureUserProfile to create profile with onboarded:false
  // which triggers startOnboarding() instead of showApp()
  await mockFirebase('firebase-firestore-newuser.mock.js');
  // Mock display-mode: standalone so install gate is skipped
  await page.addInitScript(() => {
    const orig = window.matchMedia.bind(window);
    window.matchMedia = function(query) {
      if (query === '(display-mode: standalone)') {
        return { matches: true, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false };
      }
      return orig(query);
    };
  });
  await page.goto(APP_URL);

  // Onboarding wraps in #ob-wrap (outside #app-content so brightness filter doesn't affect it)
  await page.waitForSelector('#ob-wrap', { state: 'visible', timeout: APP_CONTENT_TIMEOUT });
  await expect(page.locator('#ob-wrap')).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 11: SGPT member sees SGPT sessions in the flat session list
// ─────────────────────────────────────────────────────────────────────────────
test('SGPT member sees SGPT sessions in the flat session list', async ({ page, mockFirebaseAsSgpt }) => {
  await mockFirebaseAsSgpt(null);
  await page.addInitScript(() => { localStorage.setItem('installGateDismissed', '1'); });
  await page.goto(APP_URL);
  await page.waitForSelector('#app-content', { state: 'visible', timeout: APP_CONTENT_TIMEOUT });

  await page.locator('.nb-train').click();
  await page.waitForSelector('#train-lib', { state: 'visible', timeout: 8000 });

  // Routine list renders with at least one card (from mock SGPT routines)
  await page.waitForSelector('#session-list .routine-card', { state: 'visible', timeout: 5000 });
  await expect(page.locator('#session-list .routine-card').first()).toBeVisible({ timeout: 5000 });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 12: Standard member sees session list without SGPT section headers
// ─────────────────────────────────────────────────────────────────────────────
test('Standard member sees routine list — no section headers', async ({ page, mockFirebase }) => {
  await loadApp(page, mockFirebase);

  await page.locator('.nb-train').click();
  await page.waitForSelector('#train-lib', { state: 'visible', timeout: 8000 });

  // Routine list renders
  await page.waitForSelector('#session-list .routine-card', { state: 'visible', timeout: 5000 });
  await expect(page.locator('#session-list .routine-card').first()).toBeVisible();

  // No old SGPT section, free-train header, or progression model
  await expect(page.locator('#sgpt-section')).toHaveCount(0);
  await expect(page.locator('#free-train-head')).toHaveCount(0);
  await expect(page.locator('.tier-locked-card')).toHaveCount(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 13: (removed — assigned sessions UI removed in v12.2.0)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Test 14: Install gate shown when not running as PWA
// ─────────────────────────────────────────────────────────────────────────────
test('Install gate shown when not running as PWA — dismisses to auth flow', async ({ page, mockFirebase }) => {
  // Mock Firebase but do NOT set installGateDismissed (bypasses loadApp helper)
  await mockFirebase(null);
  // Playwright runs in browser mode (not standalone), so isInstalledPWA() returns false
  await page.goto(APP_URL);

  // Install gate should appear after splash
  await page.waitForSelector('#install-gate', { state: 'attached', timeout: APP_CONTENT_TIMEOUT });
  await expect(page.locator('#install-gate')).toBeVisible({ timeout: 5000 });

  // App content should NOT be visible (install gate blocks it)
  // Note: #auth-screen may be visible underneath the gate (getRedirectResult flow),
  // but #app-content must be hidden until the gate is dismissed.
  await expect(page.locator('#app-content')).toBeHidden({ timeout: 3000 });

  // Tap "Continue in browser"
  await page.locator('#ig-continue-btn').click();

  // Install gate should be gone
  await expect(page.locator('#install-gate')).toBeHidden({ timeout: 3000 });

  // App content should now be visible (Firebase mock has authenticated, onboarded user)
  await page.waitForSelector('#app-content', { state: 'visible', timeout: APP_CONTENT_TIMEOUT });
});
