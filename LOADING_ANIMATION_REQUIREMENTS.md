# Loading Screen Animation Requirements
## 8RB by 8 Rounds Boxing
## For Claude Code execution — no interpretation required

---

## OVERVIEW

Replace the blank loading state shown between splash completion and auth resolution with a boxing-themed animated loading screen. Uses the combo chip design language from the DRILL tab to reinforce the app's boxing identity.

Applies to:
- The "resuming session" state (returning signed-in user)
- The Google sign-in redirect return state (iOS specifically)
- Any other loading state currently showing "Resuming your session..." or similar

---

## VISUAL LAYOUT

Full-screen centred composition, vertical stack:

**Element 1 — 8RB logo watermark**
- Position: absolute centre, behind other elements
- Width: 90vw
- Opacity: 0.07
- No animation
- Same watermark treatment used in the onboarding welcome screen

**Element 2 — 8RB logo (main)**
- Size: 80px width
- Opacity: 0.9
- Vertical position: 40% from top
- Slow pulse animation: scale 0.97 → 1.0 over 3000ms, ease-in-out, infinite loop

**Element 3 — Combo chip sequence**
- Position: 24px below main logo
- Three chips displayed horizontally: `1` `2` `3`
- Spacing between chips: 12px

Chip styling (default/off state):
- Width: 48px
- Height: 48px
- Background: `#1e1e1e`
- Border: 1px solid `--border`
- Border-radius: 12px
- Font: Bebas Neue 24px
- Colour: `--dim`
- Display: flex, centred

Chip styling (active/lit state):
- Background: `--accent` (red)
- Border: 1px solid `--accent`
- Colour: white
- Box-shadow: 0 0 12px rgba(214, 48, 64, 0.4) (subtle red glow)

**Element 4 — Loading text**
- Position: 24px below chips
- Text: "Getting ready..."
- Font: DM Sans 13px --dim
- Letter-spacing: 0.5px
- No animation

---

## CHIP ANIMATION SEQUENCE

Timing:
- 0ms: chip 1 lights up (transitions from default to active)
- 300ms: chip 2 lights up (chip 1 stays lit)
- 600ms: chip 3 lights up (chips 1 and 2 stay lit)
- 900ms: all three fade back to default state (200ms transition)
- 1200ms: cycle restarts from 0ms

Transition on light-up: 150ms ease-out (background, border, colour, box-shadow all animate together)
Transition on fade-out: 200ms ease-in

Implementation via CSS keyframes + JS setInterval, or pure CSS animation with staggered animation-delay. Prefer pure CSS if possible for performance.

Reduced motion:
- If `prefers-reduced-motion` is set: disable all animations
- Show all three chips in lit state statically
- No logo pulse
- Loading text visible without motion

---

## BACKGROUND

Same as splash / onboarding welcome:
- Radial gradient from `#1a1a1a` at centre to `#0a0a0a` at edges

Full viewport height and width.
z-index: 8000 (above main app, below install gate which is 10000, below onboarding which is 10000)

---

## WHERE IT REPLACES EXISTING STATES

Replace the existing `showGoogleLoadingScreen()` function in app.js entirely.
Replace the "resuming your session" loading state added in the auth flash fix.
Any place currently showing a plain loading state during auth resolution.

Rename the function to `showLoadingScreen(message)` where message is optional:
- Default message: "Getting ready..."
- Custom messages accepted for context (e.g. "Signing you in..." for the Google redirect return)

```javascript
function showLoadingScreen(message) {
  message = message || 'Getting ready...';
  var authEl = document.getElementById('auth-screen');
  var appEl = document.getElementById('app-content');
  if (appEl) appEl.style.display = 'none';
  if (authEl) {
    authEl.style.display = 'flex';
    authEl.innerHTML = 
      '<div class="loading-screen">' +
      '  <img src="8RB.webp" class="loading-logo-watermark" aria-hidden="true">' +
      '  <img src="8RB.webp" class="loading-logo-main">' +
      '  <div class="loading-chips">' +
      '    <span class="chip" data-chip="1">1</span>' +
      '    <span class="chip" data-chip="2">2</span>' +
      '    <span class="chip" data-chip="3">3</span>' +
      '  </div>' +
      '  <div class="loading-text">' + sanitise(message) + '</div>' +
      '</div>';
  }
}

function hideLoadingScreen() {
  var authEl = document.getElementById('auth-screen');
  if (authEl) authEl.innerHTML = '';
}
```

`hideLoadingScreen()` clears the container when the app is ready to render or when the actual sign-in screen needs to display.

---

## CSS ADDITIONS

Add to styles.css:

```css
.loading-screen {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  background: radial-gradient(circle at center, #1a1a1a 0%, #0a0a0a 100%);
  z-index: 8000;
}

.loading-logo-watermark {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 90vw;
  max-width: 500px;
  opacity: 0.07;
  pointer-events: none;
}

.loading-logo-main {
  width: 80px;
  height: auto;
  opacity: 0.9;
  animation: loading-pulse 3s ease-in-out infinite;
}

.loading-chips {
  display: flex;
  gap: 12px;
}

.loading-chips .chip {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1e1e1e;
  border: 1px solid var(--border);
  border-radius: 12px;
  font-family: 'Bebas Neue', sans-serif;
  font-size: 24px;
  color: var(--dim);
  transition: all 200ms ease-in;
  animation: chip-cycle 1200ms infinite;
}

.loading-chips .chip[data-chip="1"] { animation-delay: 0ms; }
.loading-chips .chip[data-chip="2"] { animation-delay: 300ms; }
.loading-chips .chip[data-chip="3"] { animation-delay: 600ms; }

.loading-text {
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  color: var(--dim);
  letter-spacing: 0.5px;
}

@keyframes loading-pulse {
  0%, 100% { transform: scale(0.97); }
  50% { transform: scale(1.0); }
}

@keyframes chip-cycle {
  0% {
    background: #1e1e1e;
    border-color: var(--border);
    color: var(--dim);
    box-shadow: none;
  }
  25%, 50% {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
    box-shadow: 0 0 12px rgba(214, 48, 64, 0.4);
    transition: all 150ms ease-out;
  }
  75%, 100% {
    background: #1e1e1e;
    border-color: var(--border);
    color: var(--dim);
    box-shadow: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .loading-logo-main {
    animation: none;
  }
  .loading-chips .chip {
    animation: none;
    background: var(--accent);
    border-color: var(--accent);
    color: white;
  }
}
```

---

## ACCESSIBILITY

- Loading screen has `role="status"` and `aria-live="polite"`
- Loading text is announced by screen readers
- Chips have `aria-hidden="true"` (purely decorative)
- Logo watermark has `aria-hidden="true"` (purely decorative)
- Main logo has `alt="8RB"` for context
- Reduced motion honoured

---

## FILES TO CHANGE

- `app.js` — replace showGoogleLoadingScreen() with showLoadingScreen(message), add hideLoadingScreen(), update all call sites
- `styles.css` — add .loading-screen and related styles
- No changes to HTML or other files

---

## VERSION
Bump to 12.2.0 on completion (after the routines and LEARN library builds).
Update CLAUDE.md — new loading screen replaces all previous loading states.

---

## TESTING CHECKLIST
1. Sign out, sign back in — combo chip animation appears during auth resolution
2. Reopen the installed PWA — combo chip animation appears briefly before app renders
3. Google sign-in redirect return on iOS — combo chip animation appears with "Signing you in..." text
4. Animation cycles smoothly with no stuttering
5. Chips light up in sequence 1, 2, 3 then fade
6. Logo pulses subtly
7. `prefers-reduced-motion` enabled — all animations stop, chips show statically lit
8. Loading screen dismisses cleanly when app renders
9. No visual overlap between loading screen and other screens
10. Run acorn on all JS files
11. Run Playwright suite — update test 9 if it checks for the previous loading text
