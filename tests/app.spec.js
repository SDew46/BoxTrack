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

  // At least one session card should be present
  const cards = page.locator('#train-lib .sc');
  await expect(cards.first()).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: TRAIN tab — tapping a session opens log view
// ─────────────────────────────────────────────────────────────────────────────
test('TRAIN tab — tapping a session opens log view', async ({ page, mockFirebase }) => {
  await loadApp(page, mockFirebase);

  await page.locator('.nb-train').click();
  await page.waitForSelector('#train-lib', { state: 'visible', timeout: 8000 });

  // Expand the first session card
  await page.locator('#train-lib .sc .sc-hd').first().click();

  // Click the "LET'S WORK" button inside the expanded card
  await page.locator('#train-lib button:has-text("LET\'S WORK")').first().click();

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
  // Do NOT set up Firebase mocks — real Firebase CDN will 404 in isolation,
  // but we use a firestore mock that returns no user via the auth mock.
  // Instead: navigate without any mock and the real auth mock returns no user.
  // We do this by navigating and waiting for #auth-screen directly.
  // The page will attempt to load Firebase from CDN; since we're offline/CI
  // the auth listener never fires OR fires with null. Either way auth-screen
  // should appear. We wait generously.

  // Navigate without mocking — app detects no auth and shows sign-in screen
  await page.goto(APP_URL);

  // The app shows #auth-screen if no user is authenticated
  // (after splash dismisses). We allow a generous timeout since the real
  // Firebase CDN request may time out or the app may show auth screen quickly.
  try {
    // First try: wait for auth-screen to be visible (no-mock path)
    await page.waitForSelector('#auth-screen', { state: 'visible', timeout: 8000 });
    await expect(page.locator('#auth-screen')).toBeVisible();
  } catch (e) {
    // Fallback: if the real CDN loaded (local machine has internet), the app
    // may show auth screen after onAuthStateChanged fires with null.
    await expect(page.locator('#auth-screen')).toBeVisible({ timeout: 5000 });
  }

  // App content should NOT be visible
  await expect(page.locator('#app-content')).toBeHidden();
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
// Test 11: SGPT member sees SGPT section in TRAIN tab
// ─────────────────────────────────────────────────────────────────────────────
test('SGPT member sees SGPT sessions section in TRAIN tab', async ({ page, mockFirebaseAsSgpt }) => {
  await mockFirebaseAsSgpt(null);
  await page.addInitScript(() => { localStorage.setItem('installGateDismissed', '1'); });
  await page.goto(APP_URL);
  await page.waitForSelector('#app-content', { state: 'visible', timeout: APP_CONTENT_TIMEOUT });

  await page.locator('.nb-train').click();
  await page.waitForSelector('#train-lib', { state: 'visible', timeout: 8000 });

  // SGPT section should be visible
  await expect(page.locator('#sgpt-section')).toBeVisible({ timeout: 5000 });

  // At least one SGPT session card should be present inside the section
  await expect(page.locator('#sgpt-section .sc').first()).toBeVisible({ timeout: 5000 });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 12: Standard member does NOT see SGPT section
// ─────────────────────────────────────────────────────────────────────────────
test('Standard member does not see SGPT sessions section', async ({ page, mockFirebase }) => {
  await loadApp(page, mockFirebase);

  await page.locator('.nb-train').click();
  await page.waitForSelector('#train-lib', { state: 'visible', timeout: 8000 });

  // SGPT section should NOT be visible for standard member
  const sgptSection = page.locator('#sgpt-section');
  // Either hidden or display:none — not visible
  await expect(sgptSection).toBeHidden({ timeout: 3000 });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 13: Assigned session appears at top of TRAIN tab
// ─────────────────────────────────────────────────────────────────────────────
test('Assigned session appears at top of TRAIN tab', async ({ page, mockFirebase }) => {
  // Use the assigned-session mock which seeds a pending session for today
  await mockFirebase('firebase-firestore-assigned.mock.js');
  await page.addInitScript(() => { localStorage.setItem('installGateDismissed', '1'); });
  await page.goto(APP_URL);
  await page.waitForSelector('#app-content', { state: 'visible', timeout: APP_CONTENT_TIMEOUT });

  await page.locator('.nb-train').click();
  await page.waitForSelector('#train-lib', { state: 'visible', timeout: 8000 });

  // Assigned sessions area should contain the "ASSIGNED BY YOUR COACH" label
  await expect(page.locator('#assigned-sessions-area')).toContainText('ASSIGNED BY YOUR COACH', { timeout: 5000 });

  // START SESSION button should be present
  await expect(page.locator('#assigned-sessions-area button:has-text("START SESSION")')).toBeVisible({ timeout: 5000 });
});

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
