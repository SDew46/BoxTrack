# BOX Tab Requirements — 8RB by 8 Rounds Boxing
## For Claude Code execution — no interpretation required

This replaces the existing BOX tab architecture entirely. The current TIMER ONLY / TIMER + COACH toggle is removed. The BOX tab has three sections accessed via a tab bar.

---

## NAVIGATION

Three tabs at the top of the BOX screen:

```
[ FREESTYLE ]  [ DRILL ]  [ LEARN ]
```

- Font: DM Sans 13px, font-weight 700, uppercase, letter-spacing 1px
- Active tab: colour `--accent`, border-bottom 2px solid `--accent`
- Inactive tab: colour `--dim`
- Tab bar sits below the screen header, above all content
- Default tab on first open: FREESTYLE

---

## TAB 1 — FREESTYLE

### Purpose
Pure round timer. No combo coaching. User brings their own knowledge to the bag. Clean, focused, one purpose.

### Layout — pre-session
Full screen, centred layout:

1. Round counter dots — current round indicator, same as existing implementation
2. Clock — Bebas Neue, large, centred. Existing implementation kept.
3. "X ROUNDS" label beneath clock
4. RESET / START buttons — existing implementation kept
5. Settings card below buttons:
   - Rounds: stepper − / number / + (1–12, default 6)
   - Round duration: stepper − / number / + in minutes (1–5, default 3)
   - Rest duration: stepper − / number / + in seconds (30, 45, 60, 90, 120 — default 60)
   - Double Round toggle: existing implementation kept

### Layout — active round
Fullscreen takeover. All nav and header hidden. Contains:
1. "ROUND X OF Y" — DM Sans 13px uppercase `--muted`, top centre, 24px from top
2. Clock countdown — Bebas Neue 25vw, white, upper centre
3. Round dots below clock
4. END SESSION button — bottom centre, 48px tap target, DM Sans 13px `--dim`

Nothing else on screen during active round.

### Rest period between rounds
When a round ends, bell sound plays (u_7xr5ffk4oq-opening-bell-421471.mp3).
Rest screen shows:
1. "REST" — Bebas Neue 48px, `--dim`, centred
2. Rest countdown — Bebas Neue 20vw, `--blue`, centred below
3. "ROUND X COMING UP" — DM Sans 14px `--muted`, below countdown
4. Rest countdown bar — thin progress bar depleting across full width, `--blue`

Bell plays again when rest ends and next round begins.
At 10 seconds remaining in any round: sharp double-tone warning using Web Audio API (two short 880hz beeps, 80ms each, 100ms apart). This is the fallback until the clapper audio file is sourced.

### Session complete
When all rounds finish: bell plays once. Screen shows:
- "SESSION DONE" — Bebas Neue 48px
- "X rounds · X minutes" — DM Sans 16px `--muted`
- DONE button — full width, 56px, red
- Tapping DONE logs the session to boxing history (date, rounds completed) and returns to FREESTYLE tab

### Timer persistence
If user switches to DRILL or LEARN tab while FREESTYLE is running, the timer continues running in the background. A small persistent indicator shows at the top of those tabs: "● ROUND X RUNNING" in `--accent` red, 11px. Tapping it returns to FREESTYLE.

---

## TAB 2 — DRILL

### Purpose
Coached combo practice. The app calls the shots. Deliberate skill development.

### Layout

**Combo of the Week card** — top of DRILL tab, always visible
- Gold left border accent
- Label: "COMBO OF THE WEEK" — DM Sans 10px uppercase `--gold` letter-spacing 2px
- Combo displayed in chip notation — same chips as existing implementation
- Combo name below in DM Sans 14px
- TAP TO DRILL button — right aligned, DM Sans 11px `--accent`
- Static placeholder for now. Dynamic in Step 2 via coach admin.

**Tier tabs** — horizontal scrollable tab bar below Combo of the Week:
```
BASICS  AMATEUR  PRO  CHAMPION  LEGENDS  MY COMBOS
```
- Same styling as main tab bar
- Each tier has a one-line description shown below the tab bar when selected:
  - BASICS: "Single punches and fundamental combinations"
  - AMATEUR: "Two and three punch combinations with movement"
  - PRO: "Four and five punch combinations"
  - CHAMPION: "Complex combinations with defensive moves"
  - LEGENDS: "Elite level — championship combinations"
  - MY COMBOS: "Combinations you've built and saved"

**Combo list** — below tier description
Each combo shown as a card:
- Combo name — Bebas Neue 20px
- Chip notation — existing chip implementation
- Coaching cue — DM Sans 13px `--muted`
- DRILL button — right aligned, DM Sans 11px uppercase, border `--border`

Tapping DRILL opens the drill view for that combo.

**Drill view**
Full screen. Contains:
1. Combo name — Bebas Neue 28px, top centre
2. Tier badge — DM Sans 10px uppercase
3. Punch chips — large, centred, lighting up sequentially as called. Bebas Neue 64px minimum per chip.
4. Tempo slider — SLOW to SPARRING, existing implementation
5. Call punches by: NUMBERS / NAMES toggle — existing implementation
6. SURPRISE ME toggle — existing implementation
7. START DRILL button — full width, 56px, gold background, Bebas Neue 20px
8. NEXT button — skip to next combo in tier

When drill is running:
- Fullscreen takeover — all nav hidden
- Active punch chip: scales to 40vw, colour `--accent` red, glow effect
- Inactive chips: `#2a2a2a`
- Round indicator if rounds are set
- END DRILL button: bottom centre, 48px tap target

Leaving DRILL tab stops any active drill.

### Legends combos — expansion required
Current Legends combos are insufficient. Expand to minimum 20 combinations covering:
- Championship-level sequences (8+ punches)
- Combinations incorporating all defensive moves (slip, roll, step out)
- Body shot combinations (using B prefix notation)
- Southpaw-aware combinations where relevant
- Each with a proper name and coaching cue

### Body shots in chip notation
Body modifier button exists in My Combos builder (see below). In the drill display, body shots shown as chips with "B" prefix — B1, B2, B3 etc. Chip colour: `--gold` to distinguish from head shots. Existing head shot chips remain `--accent` red when active.

---

## TAB 3 — LEARN

### Purpose
Technique reference for complete beginners. Static content for now. Coach-populated in Step 2.

### Layout
Six category sections, each collapsible (expanded by default on first open, collapsed on return visits):

1. **PUNCHES** — The Jab, The Cross, The Lead Hook, The Rear Hook, The Lead Uppercut, The Rear Uppercut
2. **DEFENCE** — Slip, Roll Left, Roll Right, Step Out
3. **FOOTWORK** — Basic Stance, Step and Slide, The Pivot
4. **COMBINATIONS** — How combinations work, reading the numbers
5. **WRAPPING** — How to wrap your hands
6. **SPARRING** — Reading your opponent, ring craft basics

### Content card structure
Each item is a card containing:
- Title — Bebas Neue 24px
- Category badge — DM Sans 10px uppercase, `--dim`
- Video placeholder — 16:9 ratio box, background `#141414`, centred icon (play button SVG, 48px, `--dim`), text "VIDEO COMING SOON" DM Sans 13px `--muted`
- When a YouTube URL is present (Step 2): render as embedded iframe, 16:9 ratio
- Coaching cue / description — DM Sans 15px, line-height 1.6, 2-3 sentences maximum

### Placeholder coaching cues — exact copy

**The Jab (1)**
"Your fastest weapon. Snap it out from your guard, bring it straight back. Never drop your rear hand."

**The Cross (2)**
"Power punch. Drive from your rear foot, rotate your hip, extend fully. Return to guard immediately."

**The Lead Hook (3)**
"Short arc, elbow at 90 degrees. Turn your lead foot and hip into it. Keep your chin down."

**The Rear Hook (4)**
"Less common but devastating. Same mechanics as the lead hook from the other side. Don't overextend."

**The Lead Uppercut (5)**
"Bend your knees slightly, drive upward. Short and sharp — not a big swing. Works best at close range."

**The Rear Uppercut (6)**
"Your power uppercut. Dip your rear shoulder, explode upward through the target. Guard stays up."

**Slip**
"Move your head off the centreline. Bend at the knees, not the waist. Weight stays balanced."

**Roll Left / Roll Right**
"Duck under a hook by bending your knees and rolling through. Come up on the outside ready to counter."

**Step Out**
"Exit range by stepping to the side. Angle off, reset your stance, don't run straight back."

**Basic Stance**
"Feet shoulder-width apart, lead foot forward, weight balanced 50/50. Guard up, chin down, eyes on target."

**How combinations work**
"Every punch has a number: 1 Jab, 2 Cross, 3 Lead Hook, 4 Rear Hook, 5 Lead Uppercut, 6 Rear Uppercut. A 1-2 is a jab-cross. A 1-2-3 adds a lead hook. Body shots are prefixed with B — B2 is a body cross."

**How to wrap your hands**
"Wrapping protects your knuckles and wrist. Always wrap before hitting the bag or pads. Ask your coach to show you the first time — it takes a few sessions to get right."

---

## MY COMBOS — DIALPAD BUILDER

Accessed via MY COMBOS tier tab in DRILL. Two views: the saved combos list, and the builder.

### Builder — phone keypad layout

Accessed via "+ BUILD COMBO" button at top of My Combos list.

**Combo display strip** — top of builder, full width
Shows chips as user builds the combo. Same chip style as drill view.
Placeholder text when empty: "TAP BELOW TO BUILD" in `--dim`

**Keypad grid** — 3 columns

Row 1:
```
[ 1        ]  [ 2        ]  [ 3        ]
[ JAB      ]  [ CROSS    ]  [ LEAD HOOK]
```

Row 2:
```
[ 4        ]  [ 5        ]  [ 6        ]
[ REAR HOOK]  [ LEAD UPP ]  [ REAR UPP ]
```

Row 3:
```
[ BODY     ]  [ ← DEL   ]  [ CLEAR    ]
```

Row 4:
```
[ SLIP     ]  [ ROLL-L   ]  [ ROLL-R   ]
```

Row 5:
```
[          OUT (STEP OUT)              ]
```

**Key sizing:** each key minimum 64px height, Bebas Neue 28px for number/main label, DM Sans 10px for sub-label beneath. Background `#1e1e1e`, border `--border`, border-radius 8px.

**BODY modifier behaviour:**
- BODY button toggles on (highlighted gold) / off
- While BODY is active, tapping 1-6 adds B1, B2 etc. to the combo
- BODY auto-deactivates after one punch is added
- BODY cannot be combined with defensive moves

**Defensive move buttons (SLIP, ROLL-L, ROLL-R, OUT):**
- Add directly to combo as named chips
- Chip colour: `--blue` to distinguish from punch chips
- No number notation — shown as text chip: SLIP, ROLL-L, ROLL-R, OUT

**DELETE:** removes last chip added
**CLEAR:** clears entire combo with confirmation "Clear this combo? YES / CANCEL"

**SAVE button:** appears when combo has 2 or more moves
- Full width, 56px, gold background, Bebas Neue 20px, "SAVE COMBO"
- Tapping opens name input: "NAME THIS COMBO" — DM Sans 16px, text input, 48px height
- SAVE confirms and adds to My Combos list
- Saved combos appear in My Combos tier with full drill functionality

---

## AUDIO

### Bell — round start and end
File: `u_7xr5ffk4oq-opening-bell-421471.mp3` — already in project root
Base64 encode and embed as data URI in index.html
Plays on: round start, round end, rest end
Implementation: `const bell = new Audio('data:audio/mp3;base64,...'); bell.play();`

### 10 second warning
Until clapper audio file is sourced: use Web Audio API to generate two sharp beeps
```javascript
function playWarning() {
  const ctx = new AudioContext();
  [0, 0.18].forEach(t => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.3, ctx.currentTime + t);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.08);
    o.start(ctx.currentTime + t);
    o.stop(ctx.currentTime + t + 0.08);
  });
}
```
Replace with audio file when sourced. Note in code with comment: // TODO: replace with clapper audio file

### Mobile audio unlock
Audio on mobile requires a user gesture before it will play. On first START tap in FREESTYLE, unlock audio context silently:
```javascript
document.addEventListener('touchstart', unlockAudio, {once: true});
function unlockAudio() {
  const ctx = new AudioContext();
  const buf = ctx.createBuffer(1,1,22050);
  const src = ctx.createBufferSource();
  src.buffer = buf; src.connect(ctx.destination); src.start(0);
}
```
This must be implemented or audio will silently fail on iOS.

---

## BOXING HISTORY

On session complete in FREESTYLE, log to localStorage:
```javascript
{date, rounds, roundDuration, totalMinutes}
```

On PROGRESS tab, under a new section "BOXING SESSIONS":
- Show last 5 sessions as simple rows: date / rounds / duration
- Show total rounds all time as a stat in the streak card alongside GYM and BOXING counts
- No further analytics for now

---

## VERSION
Bump to 9.0.0 on completion of this build.
Update settings overlay and CLAUDE.md.

---

## TESTING CHECKLIST
After all changes, before committing:
1. Run acorn syntax check
2. Start local server from parent folder: `python -m http.server 8888` (use whichever port works)
3. Test FREESTYLE: timer runs, rest screen shows, bell plays on round end, warning beeps at 10 seconds
4. Test FREESTYLE persistence: switch to DRILL mid-round, confirm indicator shows, return to FREESTYLE, timer still running
5. Test DRILL: combos display, drill view opens, chips light up sequentially
6. Test My Combos builder: keypad works, BODY modifier works, defensive moves add correctly, save flow works
7. Test LEARN: all cards show, placeholder copy correct
8. Test on mobile in Chrome incognito
