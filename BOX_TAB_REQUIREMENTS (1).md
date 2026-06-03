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
At 10 seconds remaining in any round: sharp double-tone warning using Web Audio API:
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
// TODO: replace with clapper audio file when sourced

### Session complete
When all rounds finish: bell plays once. Screen shows:
- "SESSION DONE" — Bebas Neue 48px
- "X rounds · X minutes" — DM Sans 16px `--muted`
- DONE button — full width, 56px, red
- Tapping DONE logs the session to boxing history (date, rounds completed) and returns to FREESTYLE tab

### Timer persistence
If user switches to DRILL or LEARN tab while FREESTYLE is running, the timer continues running in the background. A small persistent indicator shows at the top of those tabs: "● ROUND X RUNNING" in `--accent` red, 11px. Tapping it returns to FREESTYLE.

### Mobile audio unlock
Audio on mobile requires a user gesture before it will play. On first START tap, unlock audio context silently:
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
- Placeholder combo: 1-2-3-2 "The Classic" · "Your bread and butter. Master this first."

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
Expand to minimum 20 combinations. Must include:
- Championship-level sequences (8+ punches)
- Combinations with defensive moves (slip, roll, step out)
- Body shot combinations using B prefix notation
- Each with a proper name and coaching cue

### Body shots in chip notation
Body modifier exists in My Combos builder. In drill display, body shots shown as chips with "B" prefix — B1, B2, B3 etc. Chip colour: `--gold` to distinguish from head shots.

---

## TAB 3 — LEARN

### Purpose
Technique reference for complete beginners. YouTube embeds now, coach's own videos in Step 2. The embed container accepts any YouTube URL — swapping to custom coach videos in Step 2 is a single URL change per card via the admin interface.

### Important
All video embeds use YouTube's standard embed format:
`https://www.youtube.com/embed/VIDEO_ID`

Each card must handle embed failure gracefully — if a video fails to load, show the placeholder state (play button icon + "VIDEO UNAVAILABLE — check back soon") rather than a broken iframe.

### Content structure
Six category cards. Each card is collapsible (expanded by default on first open, collapsed on return). Each contains:
- Category label — DM Sans 10px uppercase `--dim`
- Title — Bebas Neue 28px
- Video embed — 16:9 iframe, border-radius 8px, no border
- Coaching cue — DM Sans 15px line-height 1.6, maximum 3 sentences

### Content — exact titles, videos, and coaching cues

---

**Card 1 — THE PUNCHES**
Category: FOUNDATION
Video: `https://www.youtube.com/embed/SedKFKgpgbk`
*(Source: "How To Punch For Beginners" — covers all six punches clearly)*

Coaching cue:
"Every punch has a number: 1 Jab, 2 Cross, 3 Lead Hook, 4 Rear Hook, 5 Lead Uppercut, 6 Rear Uppercut. Learn these numbers — your coach will call them out and the app uses them throughout. Start with 1 and 2 before anything else."

---

**Card 2 — DEFENCE**
Category: DEFENCE
Video: `https://www.youtube.com/embed/i17tNtv8N2I`
*(Source: Skye Nicolson — Olympic medallist, slip and roll technique)*

Coaching cue:
"Defence keeps you safe and sets up your counters. Slip off the centreline rather than leaning back. Roll under hooks by bending your knees, not your waist. Good defence makes your offence twice as effective."

---

**Card 3 — FOOTWORK**
Category: MOVEMENT
Video: `https://www.youtube.com/embed/zhWfajP4EVU`
*(Source: "Boxing Footwork Drills for Beginners" — simple, effective)*

Coaching cue:
"Your feet are the foundation of everything. Stay on the balls of your feet, never cross your legs, and move the foot closest to your direction first. Good footwork puts you in range to punch and out of range to get hit."

---

**Card 4 — SHADOW BOXING**
Category: TRAINING
Video: `https://www.youtube.com/embed/J4j3AOVWuHE`
*(Source: Tony Jeffries, Olympian — 3 minute beginner guide)*

Coaching cue:
"Shadow boxing is how you build muscle memory between sessions. Throw every punch with intention — pretend your opponent is there. Use it to warm up before bag work and to practise combinations you've been drilling."

---

**Card 5 — HAND WRAPPING**
Category: PREPARATION
Video: `https://www.youtube.com/embed/KAjzx7IajQc`
*(Source: most-viewed beginner wrapping tutorial)*

Coaching cue:
"Always wrap before hitting the bag or pads — no exceptions. Wraps protect your knuckles, wrist, and the small bones in your hand. Ask your coach to check your wrapping technique the first few times."

---

**Card 6 — COMBINATIONS**
Category: COMBINATIONS
Video: `https://www.youtube.com/embed/stM-RjSq_ws`
*(Source: "Boxing Technique Tutorial" — jab, cross, hook, uppercut combinations)*

Coaching cue:
"Combinations are sequences of punches thrown together. A 1-2 is a jab followed by a cross — the most fundamental combination in boxing. In the Drill tab, combinations are shown as numbers: 1-2-3 means jab, cross, lead hook. Start in Basics and work upward."

---

## MY COMBOS — DIALPAD BUILDER

Accessed via MY COMBOS tier tab in DRILL. Two views: saved combos list and the builder.

### Builder — phone keypad layout

Accessed via "+ BUILD COMBO" button at top of My Combos list.

**Combo display strip** — top of builder, full width, minimum 64px height
Shows chips as user builds the combo. Same chip style as drill view.
Placeholder when empty: "TAP BELOW TO BUILD" — DM Sans 13px `--dim` centred

**Keypad grid** — 3 columns, each key minimum 64px height

Row 1:
```
[ 1        ]  [ 2        ]  [ 3         ]
[ JAB      ]  [ CROSS    ]  [ LEAD HOOK ]
```

Row 2:
```
[ 4         ]  [ 5         ]  [ 6        ]
[ REAR HOOK ]  [ LEAD UPP  ]  [ REAR UPP ]
```

Row 3:
```
[ BODY      ]  [ ← DEL    ]  [ CLEAR     ]
```

Row 4:
```
[ SLIP      ]  [ ROLL-L    ]  [ ROLL-R    ]
```

Row 5:
```
[        OUT (STEP OUT)                   ]
```

**Key styling:**
- Number/main label: Bebas Neue 28px
- Sub-label: DM Sans 10px `--dim`
- Background: `#1e1e1e`
- Border: `--border`
- Border-radius: 8px
- Active/pressed state: background `#2a2a2a`, border `--accent`

**BODY modifier behaviour:**
- BODY button toggles active state (highlighted `--gold`)
- While BODY active: tapping 1-6 adds B1, B2 etc. — chip shown in `--gold`
- BODY auto-deactivates after one punch added
- BODY cannot combine with defensive moves — if BODY active and defensive move tapped, deactivate BODY and add defensive move normally

**Defensive move chips:**
- SLIP, ROLL-L, ROLL-R, OUT — added directly as named chips
- Chip colour: `--blue`
- No number notation

**DELETE:** removes last chip
**CLEAR:** clears entire combo — confirmation required: "Clear this combo?" YES / CANCEL

**SAVE button:**
- Appears when combo has 2 or more moves
- Full width, 56px, `--gold` background, Bebas Neue 20px, "SAVE COMBO"
- Tapping opens name input overlay:
  - Title: "NAME THIS COMBO" — Bebas Neue 28px
  - Text input: DM Sans 16px, 56px height, placeholder "e.g. The Sunday Special"
  - SAVE button: full width, red, 56px
- Saved combos appear in My Combos tier with full drill functionality
- Maximum 50 saved combos — if exceeded, show: "You've reached the limit. Delete a combo to save a new one."

---

## AUDIO

### Bell — round start and end
File: `u_7xr5ffk4oq-opening-bell-421471.mp3` — in project root
Base64 encode and embed as data URI in index.html
Plays on: round start, round end, rest end
Implementation:
```javascript
const bellAudio = new Audio('data:audio/mp3;base64,ENCODED_DATA_HERE');
function playBell() { bellAudio.currentTime = 0; bellAudio.play(); }
```

### 10 second warning — Web Audio API fallback
Use until clapper audio file is sourced. Two sharp beeps at 880hz.
Mark in code with: `// TODO: replace with clapper audio file`

### Mobile audio unlock — mandatory
Must be implemented or audio silently fails on iOS:
```javascript
let audioUnlocked = false;
function unlockAudio() {
  if(audioUnlocked) return;
  const ctx = new AudioContext();
  const buf = ctx.createBuffer(1,1,22050);
  const src = ctx.createBufferSource();
  src.buffer = buf; src.connect(ctx.destination); src.start(0);
  audioUnlocked = true;
}
document.addEventListener('touchstart', unlockAudio, {once: true});
document.addEventListener('click', unlockAudio, {once: true});
```

---

## BOXING HISTORY

On FREESTYLE session complete, log to localStorage:
```javascript
{ date, rounds, roundDurationMins, restDurationSecs, totalMins }
```

On PROGRESS tab, under "BOXING SESSIONS" section:
- Last 5 sessions as rows: date / rounds / total time
- Total rounds all time shown in streak card alongside GYM count
- No further analytics for now

---

## VERSION
Bump to 9.0.0 on completion of this build.
Update settings overlay and CLAUDE.md.

---

## TESTING CHECKLIST
1. Run acorn syntax check
2. Start local server from parent folder
3. FREESTYLE: timer runs, bell plays on round end, rest screen shows correctly, 10 second warning fires, timer persists when switching tabs
4. FREESTYLE → DRILL: "ROUND X RUNNING" indicator visible, tapping returns to FREESTYLE with timer intact
5. DRILL: all tier tabs work, drill view opens, chips light up sequentially in fullscreen
6. DRILL: Combo of the Week card shows at top
7. LEARN: all 6 cards show, videos embed correctly, fallback shows if video unavailable
8. My Combos: keypad builds combo correctly, BODY modifier works, defensive chips appear in blue, save flow completes, saved combo appears in My Combos tier
9. Audio: bell plays on round start/end, warning fires at 10 seconds, works on mobile
10. Test on mobile Chrome incognito
