# Onboarding Redesign Requirements
## 8RB by 8 Rounds Boxing
## For Claude Code execution — no interpretation required

---

## OVERVIEW

The onboarding sequence plays once per account, on first sign-in after account creation. It is never shown again once `onboarded: true` is written to the user's Firestore profile. It replaces the existing three-slide onboarding entirely.

The sequence has seven distinct stages:
1. Splash (existing — no changes required)
2. Welcome screen
3. TRAIN overlay
4. BOX overlay
5. PROGRESS overlay
6. PROFILE overlay
7. Final screen

A SKIP button is present on stages 3–6. Tapping SKIP jumps immediately to stage 7. Never shown on stages 2 or 7.

---

## BACKEND REQUIREMENTS

### Firestore addition — gym/8RB/config
Add one new field to the existing gym config document:

```
welcomeMessage: string (default: "Your coach has set this up for you.")
```

- Read on app load alongside coach notes
- Falls back to default string if field is missing or empty
- Editable by coach via admin interface in Step 3
- Maximum 80 characters — enforce in admin UI when built

### Profile document — no changes
`onboarded: true` is written to the user's Firestore profile document on completion of stage 7 (tapping START TRAINING). This is already specified in Step 2 requirements. Confirm it is implemented correctly.

---

## GLOBAL DESIGN TOKENS — ONBOARDING ONLY

These values apply exclusively to the onboarding sequence. They do not override the main app design tokens.

```css
--ob-bg: #0a0a0a;
--ob-bg-centre: #1a1a1a;
--ob-text: #ffffff;
--ob-muted: rgba(255,255,255,0.45);
--ob-dim: rgba(255,255,255,0.2);
--ob-red: #E63946;
--ob-gold: #E6A817;
--ob-blue: #457B9D;
--ob-overlay-bg: #111111;
--ob-sheet-height: 42vh;
--ob-transition: 250ms ease-out;
--ob-logo-opacity: 0.07;
```

---

## ANIMATION PRINCIPLES — ONBOARDING ONLY

All animations follow these rules without exception:

- Enter direction: translateY(20px) → translateY(0) or opacity 0 → 1. Never slide from side. Never bounce.
- Exit direction: opacity 1 → 0 or translateY(0) → translateY(20px)
- Duration: 250ms for overlays, 150ms for button states, 300ms for screen transitions
- Easing: ease-out on enter, ease-in on exit
- No animation plays more than once per session
- All animations respect `prefers-reduced-motion` — if reduced motion is set, all transitions are instant (0ms)

---

## STAGE 1 — SPLASH SCREEN
Existing implementation. No changes required.
"BOXING FOR EVERYONE" tagline must be present beneath the logo as specified in STEP1_REQUIREMENTS.md.

---

## STAGE 2 — WELCOME SCREEN

### Trigger
Shown immediately after splash screen completes, before the main app loads. Only shown if `onboarded !== true` on the user's profile document.

### Layout
Full screen. Background: radial gradient from `--ob-bg-centre` at centre to `--ob-bg` at edges.

Vertical composition, centred horizontally, with the following elements in order from top to bottom:

**Element 1 — Background logo watermark**
- 8RB.png
- Width: 90vw, maintaining aspect ratio
- Opacity: `--ob-logo-opacity` (0.07)
- Position: absolute, vertically centred, horizontally centred
- No animation — static

**Element 2 — Gym label**
- Text: "8RB BY 8 ROUNDS BOXING"
- Font: DM Sans, 11px, font-weight 600, uppercase, letter-spacing 4px
- Colour: `--ob-dim`
- Position: absolute top 52px, horizontally centred
- Animation: fade in, opacity 0 → 1, 250ms, delay 400ms

**Element 3 — Member name**
- Text: user's `displayName` from Firebase profile, converted to uppercase
- Font: Bebas Neue
- Font size: dynamic — use CSS clamp: `clamp(48px, 18vw, 120px)`
- For names longer than 12 characters: cap at 72px
- Colour: `--ob-text`
- Position: vertically centred on screen, horizontally centred
- Animation: fade in + scale, opacity 0 → 1 + scale 0.92 → 1.0, 300ms ease-out, delay 200ms
- If displayName is unavailable: show "CHAMPION" as fallback

**Element 4 — Welcome message**
- Line 1: "Welcome to 8RB." — DM Sans, 18px, font-weight 600, colour `--ob-text`
- Line 2: Content of `gym/8RB/config.welcomeMessage` — DM Sans, 15px, font-weight 400, colour `--ob-muted`, line-height 1.6, max-width 280px, text-align centre
- Position: 40px below the member name
- Animation: fade in, opacity 0 → 1, 250ms ease-out, delay 500ms

**Element 5 — Background logo breathing animation**
- The background watermark logo scales from 0.97 to 1.0 over 3000ms, ease-in-out, infinite loop
- Subtle — barely perceptible

**Element 6 — CTA button**
- Position: fixed bottom 0, full width, no border-radius, height 64px
- Background: `--ob-red`
- Text: "SHOW ME AROUND" — Bebas Neue, 22px, letter-spacing 2px, colour white
- Animation: slides up from translateY(64px) to translateY(0), 300ms ease-out, delay 800ms
- On tap: transition to STAGE 3

---

## STAGE 3 — TRAIN OVERLAY

### Trigger
Triggered by tapping "SHOW ME AROUND" on the welcome screen.

### Background
Main app TRAIN tab is visible behind the overlay, at 40% opacity (filter: brightness(0.4)). The real TRAIN tab renders in the background — not a screenshot.

### Skip button
- Position: fixed top 20px right 20px (safe area aware)
- Text: "SKIP" — DM Sans, 13px, font-weight 600, uppercase, letter-spacing 1px, colour `--ob-muted`
- On tap: jump to STAGE 7

### Bottom sheet
Slides up from translateY(100%) to translateY(0), 250ms ease-out.
Position: fixed bottom 0, full width, height `--ob-sheet-height` (42vh)
Background: `--ob-overlay-bg`
Border-top: 3px solid `--ob-red`
Border-radius: 16px 16px 0 0
Padding: 24px 24px 32px

Contents in order:

**Progress bar**
- Position: absolute top 0, left 0, full width, height 3px
- Background: `--ob-red`
- Width: 25% (stage 1 of 4)
- Transition: width changes on each stage advance, 300ms ease-out

**Tab label**
- Text: "TRAIN"
- Font: Bebas Neue, 36px, colour `--ob-text`
- Margin-bottom: 8px

**Description**
- Text (exact): "Your strength and conditioning sessions live here. Choose a workout, log your sets, and track your weights over time. Built around 8RB's programming — start with Squat Day if you're not sure where to begin."
- Font: DM Sans, 15px, colour `--ob-muted`, line-height 1.65
- Margin-bottom: 24px

**NEXT button**
- Position: absolute bottom 32px right 24px
- Text: "NEXT →" — DM Sans, 13px, font-weight 700, uppercase, letter-spacing 1px
- Colour: `--ob-text`
- Background: none
- Border: none
- On tap: advance to STAGE 4

---

## STAGE 4 — BOX OVERLAY

### Trigger
Tapping NEXT on STAGE 3.

### Transition
Bottom sheet exits: translateY(0) → translateY(100%), 200ms ease-in.
App navigates to BOX tab behind the overlay.
New bottom sheet enters: translateY(100%) → translateY(0), 250ms ease-out.
Total transition: 300ms.

### Background
BOX tab visible at 40% opacity.

### Bottom sheet contents

**Progress bar**
Width: 50%

**Tab label**
Text: "BOX"
Font: Bebas Neue, 36px, colour `--ob-text`

**Description**
Text (exact): "Your virtual boxing coach. FREESTYLE gives you a round timer for bag work and shadow boxing. DRILL calls combinations for you to follow — start with Basics. LEARN is your technique library. Use it at the gym or anywhere you can shadow box."
Font: DM Sans, 15px, colour `--ob-muted`, line-height 1.65

**NEXT button**
Same styling as STAGE 3. On tap: advance to STAGE 5.

---

## STAGE 5 — PROGRESS OVERLAY

### Trigger
Tapping NEXT on STAGE 4.

### Transition
Same pattern as STAGE 3 → 4. App navigates to PROGRESS tab.

### Background
PROGRESS tab visible at 40% opacity.

### Bottom sheet contents

**Progress bar**
Width: 75%

**Tab label**
Text: "PROGRESS"
Font: Bebas Neue, 36px, colour `--ob-text`

**Description**
Text (exact): "Nothing here yet — and that's exactly right. Every session you log shows up here. Your weights, your streaks, your personal bests. Check back after your first workout and you'll start to see your journey take shape."
Font: DM Sans, 15px, colour `--ob-muted`, line-height 1.65

**NEXT button**
Same styling. On tap: advance to STAGE 6.

---

## STAGE 6 — PROFILE OVERLAY

### Trigger
Tapping NEXT on STAGE 5.

### Transition
Same pattern. App navigates to PROFILE tab.

### Background
PROFILE tab visible at 40% opacity.

### Bottom sheet contents

**Progress bar**
Width: 100%

**Tab label**
Text: "PROFILE"
Font: Bebas Neue, 36px, colour `--ob-text`

**Description**
Text (exact): "Your account, your settings, your data. Change your units, update your display name, or sign out here. Your training data is securely backed up to the cloud and follows you across devices."
Font: DM Sans, 15px, colour `--ob-muted`, line-height 1.65

**NEXT button**
Text: "LET'S GO →" instead of "NEXT →". Same styling. On tap: advance to STAGE 7.

---

## STAGE 7 — FINAL SCREEN

### Trigger
Tapping "LET'S GO →" on STAGE 6, or tapping SKIP from any stage.

### Transition
Bottom sheet exits downward. App fades to full opacity then immediately fades to black as the final screen fades in. Total: 400ms.

### Layout
Full screen takeover. Background: `--ob-bg` with the 8RB logo watermark at `--ob-logo-opacity`, same as welcome screen.

Vertical composition, centred:

**Element 1 — Small label**
- Text: "8RB BY 8 ROUNDS BOXING"
- Font: DM Sans, 11px, font-weight 600, uppercase, letter-spacing 4px, colour `--ob-dim`
- Animation: fade in, 250ms, delay 100ms

**Element 2 — Member name**
- Text: user's displayName, uppercase
- Font: Bebas Neue, clamp(48px, 18vw, 120px), same dynamic sizing as welcome screen
- Colour: `--ob-text`
- Animation: fade in + scale 0.92 → 1.0, 300ms ease-out, delay 200ms

**Element 3 — Headline**
- Text: "NOW GO GET IT."
- Font: Bebas Neue, 52px
- Colour: `--ob-red`
- Animation: fade in, 250ms, delay 400ms

**Element 4 — Subtext**
- Text: "Your first session is one tap away."
- Font: DM Sans, 15px, colour `--ob-muted`
- Animation: fade in, 250ms, delay 550ms

**Element 5 — Light sweep effect**
- A subtle linear gradient highlight sweeps across the member name once
- From: translateX(-100%) to translateX(200%), width 40% of name width
- Gradient: transparent → rgba(255,255,255,0.12) → transparent
- Duration: 1200ms, ease-in-out, plays once, delay 700ms
- Clip to name element only (overflow: hidden on name container)

**Element 6 — CTA button**
- Position: fixed bottom 0, full width, no border-radius, height 64px
- Background: `--ob-red`
- Text: "START TRAINING" — Bebas Neue, 22px, letter-spacing 2px, colour white
- Animation: slides up from translateY(64px) to translateY(0), 300ms ease-out, delay 800ms
- On tap:
  1. Write `onboarded: true` to user's Firestore profile document
  2. Navigate to TRAIN tab
  3. Final screen fades out, app fades in, 300ms

---

## SKIP BEHAVIOUR

When SKIP is tapped from any stage (3–6):

1. Bottom sheet exits downward, 200ms
2. App navigates to TRAIN tab (not the current tab)
3. Final screen (STAGE 7) plays in full — SKIP does not bypass stage 7
4. `onboarded: true` written to Firestore on START TRAINING tap

Rationale: stage 7 is not a tutorial step, it's a motivational moment. All members see it regardless of whether they skipped the tour.

---

## ACCESSIBILITY

- All text meets WCAG AA contrast ratio (4.5:1 minimum) against `--ob-bg`
- All tap targets minimum 48px height and 48px width
- SKIP button minimum 44px tap target despite small visual size — use padding
- `prefers-reduced-motion`: all transitions set to 0ms duration, no scale animations, no light sweep
- Screen reader: each stage has an `aria-label` on the bottom sheet describing the stage number and total ("Step 2 of 5: Train")

---

## IMPLEMENTATION NOTES

- The onboarding overlay system must sit above all app content — z-index: 10000
- The main app must be fully initialised before onboarding starts — all Firebase reads complete, user profile loaded
- Do not show onboarding until the app is ready to display — no half-loaded states visible in the background
- If the Firestore write of `onboarded: true` fails, still proceed to the app — retry the write silently in the background. Do not block the user.
- The onboarding state check happens in `resolveAuth` after profile is loaded — if `profile.onboarded !== true`, trigger onboarding before `showApp()`
- Test on mobile Chrome at 390px viewport width as primary target
- Test with both short names (3 chars) and long names (15+ chars) to verify dynamic font sizing

---

## VERSION
Bump to 10.1.0 on completion.
Update CLAUDE.md.

---

## TESTING CHECKLIST
1. Create a new account — confirm onboarding plays automatically
2. Stage 2: member name displays correctly, large, dynamic sizing works
3. Stage 2: welcomeMessage reads from Firestore (or shows default)
4. Stages 3–6: real app tab visible behind overlay at reduced opacity
5. Stages 3–6: SKIP button visible and functional
6. Progress bar advances correctly across all four stages
7. Stage 7: name displays large, light sweep plays once, "NOW GO GET IT." in red
8. Stage 7: START TRAINING writes onboarded:true to Firestore, navigates to TRAIN
9. Sign out, sign back in — onboarding does NOT play again
10. Sign in on a second device — onboarding does NOT play again (Firestore check)
11. Test with reduced motion enabled — all animations instant
12. Test with a name longer than 12 characters — font size caps correctly
13. Test with displayName unavailable — "CHAMPION" fallback displays
14. Run acorn on all affected files
