# 8RB by 8 Rounds Boxing

## What This Is
A PWA (Progressive Web App) built specifically for 8 Rounds Boxing Gym in Streatham, London. It combines gym session logging, a boxing round timer, and a combo coach in one app. Deployed via GitHub Pages, installed via browser — no app store required.

The app is currently called **8RB by 8 Rounds Boxing**. The underlying product is BoxTrack. If white-labelled to other gyms in future, the pattern is "[Gym Name] by [product name]".

## Current Status
Version 9.0.0. Modular file structure (completed June 2026 — not yet pushed/deployed). BOX tab fully rebuilt per BOX_TAB_REQUIREMENTS.md — FREESTYLE timer, DRILL combo coach, LEARN reference section, My Combos keypad builder, boxing bell audio embedded.

**Modular split status — all complete, acorn clean, not yet pushed:**
- `styles.css` — all CSS (54 KB)
- `data.js` — all data constants (36 KB)
- `app.js` — shared state, storage, nav, branding, settings, service worker (12 KB)
- `train.js` — train tab logic (45 KB)
- `box.js` — box tab logic (60 KB)
- `progress.js` — progress tab logic (12 KB)
- `index.html` — HTML skeleton + script tags only, no inline JS or CSS (34 KB)
- `sw.js` — bumped to v12, all new assets in STATIC_ASSETS pre-cache list

---

## The People We Are Building For

### Steve (Product Owner / Primary User)
- Trains at 8RB. The app started as his personal training tool.
- Background in business analysis, change management, and cyber security.
- Not code-literate — directs Claude to build, reviews and tests output.
- Cares deeply about security. Any decision that touches user data must be flagged to him explicitly.
- Wants this to be something he's proud to put in front of strangers.

### The Coach (8RB Club Owner)
- Runs 8 Rounds Boxing Gym, Streatham.
- Entrepreneurial mindset. Already thinking about how to use the app for his members unprompted.
- Not technical. Won't tolerate complexity or unreliability.
- Wants the app to add genuine value to his club and reflect 8RB's identity.
- Future requirement: a coach/admin interface where he can update sessions, combo of the week, add tutorial videos, and manage content without touching code.
- Does not want gym management software (scheduling, payments) — that is out of scope.

### 8RB Members
- Recipients of the tool. Haven't asked for it. Will judge it as outsiders on first open.
- Range from complete beginners to experienced boxers.
- Will be using it in a gym environment — sweaty hands, phone on a shelf or floor, glancing at it mid-workout.
- Need zero explanation to get started. If it isn't obvious, it's broken.
- Must feel as polished as an app they'd download from the App Store.

---

## Brand Identity — 8 Rounds Boxing

### Voice and Tone
- Tagline: "Boxing for everyone"
- Positioning: inclusive, accessible, all skill levels welcome. Not elite, not intimidating.
- Copy should feel like a good coach: direct, encouraging, no jargon unless explained.
- All caps headers match the website and logo style.

### Visual Identity
- Logo: `8RB.png` in project root — cream/off-white lettermark on black background
- The black background on the logo is effectively transparent against the app's dark theme
- Primary palette: black background, cream/off-white, red accent
- Typography: bold, capitalised headers (Bebas Neue already in use — keep it)
- Style: aggressive but accessible. Sporty, not corporate.

### Session Types
- **Squat Day**
- **Goblet Day**
- **Unilateral Day**
- **Deadlift Day**
- **Push Day**
- **Core Session**
- **Bodyweight Session**

**Rule:** Session names must be defined in a single data object in the code — never hardcoded in multiple places. This supports future coach admin updates without requiring code changes across the app.

---

## Product Vision and Phased Plan

### Step 1 — Current: Get the house in order
Get the app to a standard where an 8RB member who didn't ask for it opens it and immediately trusts it.

**UI priorities (in order):**
1. Splash screen with 8RB logo animation on app open
2. Rename — app presents as "8RB by 8 Rounds Boxing"
3. Full UI scale-up — fonts, tap targets, spacing. Everything currently too small for gym use.
4. Plain English session naming — "Ground Up" and "Top Down" mean nothing to a new user
5. Fullscreen punch drill mode — number must fill majority of screen, readable from 2 metres
6. One exercise at a time log view — current all-at-once layout is overwhelming
7. Empty states — new user should never land on a blank screen wondering what to do
8. Onboarding — brief, skippable, explains the three sections (Train / Box / Progress)

**Technical hygiene (already done in v7):**
- Settings as proper overlay ✓
- Colour system cleaned up ✓
- Session log redesigned (pre-filled inputs, checkmark, auto-rest) ✓
- Larger punch chips ✓
- Acorn syntax check in place ✓

### Step 2 — Backend and accounts (Firebase)
- User authentication (sign in / sign up)
- Cloud sync — data moves off localStorage onto Firestore
- User roles: member vs coach/admin
- Coach admin interface — dynamic content management
- Auto-updates already handled by service worker

### Step 3 — Coach admin interface
- Update sessions and programming
- Set combo of the week
- Add/manage tutorial videos (embed YouTube/Vimeo)
- View member activity (aggregate, not invasive)

### Step 4 — Future / white-label
- Package for other gyms
- Branding configuration per gym
- Assess whether app store submission makes sense at that point

---

## Security — Non-Negotiable
Steve has a cyber security background and this is a hard requirement, not an afterthought.

- **Flag any decision that touches user data to Steve before implementing**
- Data minimisation — only collect what is genuinely needed
- Firebase auth handles encryption in transit and at rest — use it, don't roll custom auth
- Role-based access — coach admin must be completely inaccessible to members
- GDPR considerations — members are in the UK, data deletion must be possible
- Never store sensitive data in localStorage once backend exists
- When in doubt, do less and ask

---

## Technical Stack

### Current
- Multi-file structure: `index.html` (HTML only) + `styles.css` + `data.js` + `app.js` + `train.js` + `box.js` + `progress.js`
- Plain `<script src="...">` tags — no ES modules, no build step, global scope shared across files
- Load order: data.js → app.js → train.js → box.js → progress.js → inline INIT block
- CSS custom properties for theming
- localStorage for all data persistence
- GitHub Pages deployment
- PWA via service worker (cache-first, updates on next open after push)

### Planned (Step 2)
- Firebase Auth for user accounts
- Firestore for cloud data sync
- Firebase Hosting or continue GitHub Pages (TBD)
- Keep vanilla JS — no framework rewrite unless there is a compelling reason

---

## Colour System — Strictly Enforced
- `--accent` / red `#E63946` — primary actions, active nav, CTA buttons, headers
- `--gold` `#E6A817` — all data values (KG weights, streak numbers, progress)
- `--green` `#2ECC71` — positive/progress states (overload suggestion, set complete)
- `--blue` `#457B9D` — rest timer, informational states
- `--dim` — inactive/secondary text only

**Rules:**
- Never use arbitrary colours for data
- All KG values = gold. All streak stats = gold. No red/blue alternating on data
- Colour must mean something consistent — if it's gold it's a number, if it's red it's an action

---

## JS Rules — Critical

### 1. Always run acorn syntax check after any JS change

Run from the project directory (`C:\Users\Steve D\botrack app\BoxTrack`):
```
node -e "const acorn=require('acorn'),fs=require('fs'),path=require('path');['data.js','app.js','train.js','box.js','progress.js'].forEach(f=>{const code=fs.readFileSync(f,'utf8');try{acorn.parse(code,{ecmaVersion:2020});console.log(f+' CLEAN');}catch(e){console.log(f+' ERROR line '+(e.loc&&e.loc.line)+': '+e.message);}});"
```

Or save a temp file `acorn_check.js` in the project dir and run `node acorn_check.js` (avoids path-with-spaces issues in PowerShell).

### 2. No nested template literals inside ${} expressions
Use string concatenation or extract to a variable instead of nesting backtick template literals.

### 3. No optional chaining (?.) inside template literals or new Function()
Use explicit checks: obj && obj.prop not obj?.prop in these contexts.

### 4. No && chaining in PowerShell terminal
Steve is on Windows/PowerShell. Run commands separately, not chained with &&.

### 5. Version bump on every meaningful change
Update version number in the settings overlay. Current: 7.0.0.

---

## Current Architecture

`index.html` — HTML skeleton only: splash, nav, all tab HTML, overlays, onboarding. No inline JS or CSS.

`styles.css` — all CSS custom properties, component styles, animations.

`data.js` — all static data constants: SESSION_NAMES, EXERCISE_LIBRARY, SESSIONS, CAT_META, TRACKED_LIFTS, EQUIP_OPTIONS, PUNCH_NAMES, DEF_DISP, DEF_CALL, COMBO_TIERS, LEGEND_COMBOS, TIER_DESCS, CORNER_QUOTES, ACCENT_COLORS.

`app.js` — shared state declarations, localStorage utils (ld/sv), formatting helpers (fmtWt/fmtDate/fmtSecs), toast, nav (showPage/openOverlay/closeOverlay), branding (initBranding/applyBranding/setAccent), settings panel render, data export/import/clear, service worker registration.

`train.js` — deload, equipment picker, session library, swap modal, log view, plan ref overlay, warmup timer, log form (sets/reps/weights/rest), history, session complete, custom session builder (CSB).

`box.js` — box tab navigation, freestyle round timer (FREESTYLE), drill combo coach (DRILL), combo learn reference (LEARN), combo builder keypad, voice coach, bell audio.

`progress.js` — streak, lift PRs with chart, recent sessions, boxing log, boxing session delete.

## Tracked Lifts — all use gold, display full session name not abbreviation
- Back Squat — Ground Up
- Barbell Deadlift — Top Down
- Barbell Bench Press — Top Down
- Romanian Deadlift — Ground Up
- Weighted Pull-Ups — Top Down

## Punch Chips — do not reduce these sizes
- .pc-lg — 96x96px, 64px font (main drill display)
- .pc-sm — 80x80px, 52px font
- .pc-def-sm — 70x70px, 22px font (slip/roll/step)
- Readable at arm's length. A fullscreen drill mode is a Step 1 priority.

---

## Local Testing

To test locally, open a terminal in the parent folder `C:\Users\Steve D\botrack app` and run:

```
python -m http.server 3000
```

Then open Chrome incognito (`Ctrl+Shift+N`) and go to:
```
http://localhost:3000/BoxTrack/
```

To see the splash screen again, close and reopen the incognito window.

Note: `npx serve` does not work — npm folder missing on this machine.

### Service Worker Update Behaviour
Confirmed working as of v9.0.0. `skipWaiting()` and `clients.claim()` implemented in `sw.js`. Updates reach the installed PWA within one or two app opens after a push — no manual cache clearing required for users.

For development: Chrome DevTools `F12` → Application → Service Workers → tick **Update on reload** to force SW updates on every refresh during active development. Untick when done.

---

## Deployment
- Repo path: C:\Users\Steve D\botrack app\BoxTrack
- Branch: main -> GitHub Actions -> GitHub Pages (auto deploy on push)
- After push: check GitHub Actions tab to confirm deployment ran
- Service worker: cache-first, updates activate on next app open after push
- Test new versions in Chrome incognito to bypass service worker cache

---

## What Makes This Different — Do Not Lose These
- Only app combining gym S&C programming with boxing-specific training
- Combo coach with tier progression (Basics to Amateur to Pro to Champion to Legends)
- Built for a real boxing gym by someone who actually trains there
- White-label branding capability already exists
- PWA — zero friction, share a URL, installs in two taps, no app store
