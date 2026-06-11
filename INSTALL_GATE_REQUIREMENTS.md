# Install Gate Requirements
## 8RB by 8 Rounds Boxing
## For Claude Code execution — no interpretation required

---

## OVERVIEW

An install gate screen shown to users who open the app in a browser 
rather than from an installed PWA. Appears before authentication, 
before onboarding, before everything. Goal: get users to install 
the app as a PWA before they register, so their first experience 
is the full native-feeling app not a browser page.

Users who have already installed the app never see this screen.

---

## DETECTION

On every app load, before showing any screen, check if running 
as installed PWA:

```javascript
function isInstalledPWA() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://');
}
```

If `isInstalledPWA()` returns true:
- Skip install gate entirely
- Proceed to normal auth flow (resolveAuth)

If `isInstalledPWA()` returns false:
- Show install gate screen before anything else
- Do not show auth screen, onboarding, or app content

Store this check result in a module-level variable:
`var runningAsApp = isInstalledPWA();`

---

## INSTALL GATE SCREEN

### Trigger
Shown immediately after splash screen completes, 
only when `runningAsApp === false`.

### Layout
Full screen. Background: radial gradient from `#1a1a1a` 
at centre to `#0a0a0a` at edges (same as onboarding welcome screen).

**Element 1 — Background watermark**
8RB.webp, width 90vw, opacity 0.07, absolute centred.
Same breathing animation as onboarding: obBreathe 3s infinite.

**Element 2 — Top label**
Text: "8RB BY 8 ROUNDS BOXING"
Font: DM Sans, 11px, font-weight 600, uppercase, letter-spacing 4px
Colour: rgba(255,255,255,0.2)
Position: absolute top 52px, horizontally centred
Animation: fade in, 250ms, delay 300ms

**Element 3 — Headline**
Text: "GET THE APP"
Font: Bebas Neue, clamp(56px, 18vw, 96px)
Colour: #ffffff
Position: vertically centred upper half, horizontally centred
Animation: fade in + scale 0.92 → 1.0, 300ms ease-out, delay 200ms

**Element 4 — Subtext**
Text: "Add 8RB to your home screen for the full experience."
Font: DM Sans, 15px, colour rgba(255,255,255,0.45), 
line-height 1.6, text-align centre, max-width 280px
Position: 16px below headline
Animation: fade in, 250ms, delay 400ms

**Element 5 — Platform-specific install instruction**
Shown below subtext. Detected by user agent.

--- ANDROID CHROME ---
Show if: userAgent contains 'Android' and Chrome install 
prompt is available (beforeinstallprompt event fired)

Single button:
- Full width, fixed bottom 0, height 64px, no border-radius
- Background: var(--accent) red
- Text: "ADD TO HOME SCREEN" — Bebas Neue 22px, letter-spacing 2px, white
- Animation: slides up from translateY(64px) to translateY(0), 
  300ms ease-out, delay 700ms
- On tap: call savedInstallPrompt.prompt() 
  (the deferred beforeinstallprompt event)
- After prompt resolves: if user accepted, set 
  sessionStorage.setItem('installAccepted','1') 
  and proceed to auth flow
- If user dismissed: show "continue in browser" option

--- ANDROID CHROME (prompt not available) ---
Show if: Android but beforeinstallprompt has not fired
(app may already be installed or browser doesn't support prompt)

Show instruction card:
Background: #141414, border-radius 12px, padding 20px, 
margin 0 24px
Content:
  - "TAP ⋮ THEN" — DM Sans 11px uppercase --dim, margin-bottom 8px
  - "Add to Home Screen" — DM Sans 16px font-weight 600 --text
  - Three dot menu icon SVG (24px, --muted) inline with text

--- iOS SAFARI ---
Show if: userAgent contains 'iPhone' or 'iPad' 
and NOT Chrome (to detect Safari specifically)

Show instruction card:
Background: #141414, border-radius 12px, padding 20px,
margin 0 24px
Content:
  - "TAP" — DM Sans 11px uppercase --dim
  - Share icon SVG (the iOS share box-with-arrow icon, 28px, --accent)
  - "THEN" — DM Sans 11px uppercase --dim  
  - "Add to Home Screen" — DM Sans 16px font-weight 600 --text
  Layout: flex row, align-items centre, gap 8px, flex-wrap wrap,
  justify-content centre

--- OTHER BROWSERS (desktop Chrome, Firefox, etc.) ---
Show generic instruction:
Text: "Open this page in Chrome on your phone and tap 
Add to Home Screen for the best experience."
Font: DM Sans, 14px, colour --muted, text-align centre,
padding 0 24px

**Element 6 — Continue in browser link**
Always shown below the platform instruction.
Margin-top: 24px
Text: "Continue in browser →"
Font: DM Sans, 13px, colour rgba(255,255,255,0.3)
No underline, cursor pointer
Minimum tap target: 44px height (use padding)
Animation: fade in, 250ms, delay 900ms

On tap:
- Set localStorage.setItem('installGateDismissed', '1')
- Proceed to normal auth flow (resolveAuth)
- Do NOT show install gate again this session

---

## BEFOREINSTALLPROMPT HANDLING

Add this event listener at the very top of app.js, 
before any other code runs:

```javascript
var savedInstallPrompt = null;
window.addEventListener('beforeinstallprompt', function(e) {
  e.preventDefault();
  savedInstallPrompt = e;
});
```

This captures the browser's install prompt so we can 
trigger it programmatically when the user taps the button.

Export savedInstallPrompt so install gate can access it.

---

## AFTER SUCCESSFUL INSTALL (Android)

When the user accepts the install prompt on Android:
1. The browser installs the app
2. The app may relaunch automatically as a PWA
3. On relaunch, `isInstalledPWA()` returns true
4. Install gate is skipped
5. Normal auth flow proceeds

If the app does not relaunch automatically:
Show a brief confirmation screen overlaying the install gate:

Background: same as install gate
Content (centred):
  - Checkmark icon SVG, 48px, --green
  - "INSTALLED!" — Bebas Neue 48px, white
  - "Open 8RB from your home screen." — DM Sans 15px --muted
  - No buttons — this screen is informational only

After 3 seconds: fade out and proceed to auth flow in browser.

---

## RE-SHOW LOGIC

The install gate is shown when ALL of these are true:
- `isInstalledPWA()` returns false
- `localStorage.getItem('installGateDismissed')` is not '1'

If the user previously dismissed via "Continue in browser":
- Skip the install gate
- Proceed directly to auth flow

This means a user who dismissed once won't be pestered again.
They can always install later from the browser menu.

Note: `installGateDismissed` is stored in localStorage, 
not sessionStorage, so it persists across sessions.

---

## INTEGRATION WITH EXISTING FLOW

Update the auth/splash flow in app.js:

Current flow:
splash → resolveAuth → (auth screen or app)

New flow:
splash → isInstalledPWA() check →
  if installed: resolveAuth → (auth screen or app)
  if not installed AND not dismissed: install gate →
    user installs or dismisses → resolveAuth → (auth screen or app)

The install gate sits between splash completion (onSplashDone) 
and resolveAuth. Update onSplashDone():

```javascript
export function onSplashDone() {
  splashDone = true;
  if (isInstalledPWA() || localStorage.getItem('installGateDismissed') === '1') {
    resolveAuth();
  } else {
    showInstallGate();
  }
}
```

showInstallGate() is defined in a new file: install-gate.js
It exports one function: showInstallGate()
When the user completes the install gate (installed or dismissed), 
it calls resolveAuth() directly.

---

## NEW FILE: install-gate.js

Create install-gate.js in the project root.
Add <script type="module" src="install-gate.js"></script> 
to index.html after app.js.
Add install-gate.js to sw.js cache list.

The file contains:
- showInstallGate() — renders and shows the install gate screen
- detectPlatform() — returns 'android-prompt', 'android-manual', 
  'ios', or 'other'
- handleInstallAccepted() — called after successful install
- handleInstallDismissed() — called when user taps continue in browser

---

## ACCESSIBILITY

- All tap targets minimum 44px height
- Install button and continue link have aria-labels
- Platform instruction cards have role="region" and aria-label
- prefers-reduced-motion: all animations instant
- Screen reader: announce "Install 8RB app" as page title 
  when install gate is shown

---

## SW.JS UPDATE

Add install-gate.js to the cached files list in sw.js 
so it works offline.

---

## PLAYWRIGHT TEST

Add one new test to tests/app.spec.js:

Test 14: Install gate shown when not running as PWA
- Mock display-mode as browser (not standalone)
- Confirm install gate screen is visible
- Confirm auth screen is NOT visible
- Tap "Continue in browser"
- Confirm auth screen becomes visible
- Confirm install gate is gone

---

## VERSION
Bump to 11.1.0 on completion.
Update CLAUDE.md.

---

## TESTING CHECKLIST
1. Open app in Chrome on Android — install gate appears
2. Install prompt button appears on Android if supported
3. Tapping install triggers native Android install prompt
4. After install, reopen from home screen — install gate skipped
5. Open in Safari on iPhone — iOS instruction shows with share icon
6. Tap "Continue in browser" — proceeds to auth, gate not shown again
7. Open app again in browser after dismissing — gate not shown again
8. Open from home screen after installing — gate never shown
9. Run Playwright test 14 — passes
10. Run full Playwright suite — all 14 tests pass
11. Run acorn on all JS files
