# Exercise Reference Requirements
## 8RB by 8 Rounds Boxing
## For Claude Code execution — no interpretation required

---

## OVERVIEW

An optional quick-reference overlay accessible from within the session log. Allows a member to check exercise technique without leaving their active session. The session remains fully intact underneath the overlay at all times.

This is not a full tutorial system. It provides:
- One coaching cue (single sentence)
- One YouTube embed playing inline

If no reference is defined for an exercise, no UI element appears. No broken states, no empty placeholders.

---

## DATA STRUCTURE CHANGE — data.js

Each exercise object in EXERCISE_LIBRARY gains an optional `ref` field:

```javascript
{
  name: 'Back Squat',
  cat: 'GU',
  equip: ['barbell'],
  muscles: 'Quads, glutes, hamstrings',
  ref: {
    cue: 'Chest up, knees track toes, break parallel.',
    url: 'https://www.youtube.com/embed/VIDEO_ID',
    credit: 'CrossFit' // optional — shown as attribution below video
  }
}
```

Rules:
- `ref` field is entirely optional — exercises without it behave identically to before
- `url` must use YouTube embed format: `https://www.youtube.com/embed/VIDEO_ID` not the watch URL
- `cue` maximum 60 characters — enforced in data, not UI
- Adding a reference to any exercise in future requires only a data.js change — no UI code changes needed

---

## EXERCISE REFERENCES — initial data

Add `ref` field to the following exercises in EXERCISE_LIBRARY.
Steve to verify each YouTube URL is live before deployment — URLs marked VERIFY below.

```javascript
// Back Squat
ref: {
  cue: 'Chest up, knees track toes, break parallel.',
  url: 'https://www.youtube.com/embed/ultWZbUMPL8' // VERIFY
}

// Barbell Deadlift  
ref: {
  cue: 'Bar over mid-foot, hinge at hips, push the floor away.',
  url: 'https://www.youtube.com/embed/op9kVnSso6Q' // VERIFY - Alan Thrall deadlift
}

// Romanian Deadlift
ref: {
  cue: 'Soft knees, hinge at hips, feel the hamstring stretch.',
  url: 'https://www.youtube.com/embed/KhjNjzrm93c' // VERIFY - Jeff Nippard RDL
}

// Barbell Bench Press
ref: {
  cue: 'Shoulder blades pinched, bar to lower chest, drive up.',
  url: 'https://www.youtube.com/embed/gBZkSn-zsD0' // VERIFY
}

// KB Goblet Squat
ref: {
  cue: 'Hold at chest, elbows inside knees, sit tall.',
  url: 'https://www.youtube.com/embed/VERIFY_URL' // Steve to find: Alan Thrall goblet squat
}

// KB Romanian Deadlift
ref: {
  cue: 'Keep KB close to legs, hinge back not down.',
  url: 'https://www.youtube.com/embed/VERIFY_URL' // Steve to find: OPEX KB RDL
}

// Split Squat / Bulgarian Split Squat
ref: {
  cue: 'Front foot flat, back knee drops straight down.',
  url: 'https://www.youtube.com/embed/VERIFY_URL' // Steve to find: RP split squat
}

// Weighted Pull-Up / Pull-Up
ref: {
  cue: 'Dead hang start, squeeze shoulder blades, chin over bar.',
  url: 'https://www.youtube.com/embed/Y3ntNsIS2Q8' // VERIFY - FitnessFAQs
}

// Dumbbell Bench Press
ref: {
  cue: 'Dumbbells at chest, controlled path, squeeze at top.',
  url: 'https://www.youtube.com/embed/VERIFY_URL' // Steve to find: Scott Herman DB bench
}

// Landmine Press
ref: {
  cue: 'Single arm, slight forward lean, press to full extension.',
  url: 'https://www.youtube.com/embed/VERIFY_URL' // Steve to find: Alan Thrall landmine press
}
```

All other exercises in EXERCISE_LIBRARY: no `ref` field added at this stage.

---

## UI — INFO BUTTON ON EXERCISE HEADER

### Trigger element
Appears on the exercise card header in the session log, only when `exercise.ref` exists.

Position: right of exercise name, left of TYPE button
Element: circular button, 28px diameter
Icon: "?" — DM Sans, 13px, font-weight 700, colour `--dim`
Background: `#1e1e1e`
Border: 1px solid `--border`
Minimum tap target: 44px × 44px (use padding to extend tap area beyond visual size)
Aria-label: `"Technique reference for ${exercise.name}"`

If `exercise.ref` does not exist: this button is not rendered. No empty space, no disabled state.

---

## UI — REFERENCE OVERLAY

### Trigger
Tapping the "?" button opens the reference overlay.

### Behaviour
- Session log remains fully visible and functional underneath
- Rest timers continue running
- No navigation change — user is still in their session
- Overlay dismisses on: tap backdrop, tap CLOSE button, or swipe down

### Animation
Slides up from bottom: translateY(100%) → translateY(0), 250ms ease-out
Dismisses: translateY(0) → translateY(100%), 200ms ease-in

### Layout
Position: fixed bottom 0, full width
Height: 52vh
Background: `#111111`
Border-top: 3px solid `--accent`
Border-radius: 16px 16px 0 0
z-index: 5000 (below onboarding at 10000, above everything else)

**Drag handle**
Width: 36px, height: 4px, background: `--border`, border-radius: 2px
Centred horizontally, 10px from top

**Exercise name**
Font: Bebas Neue, 28px, colour `--text`
Margin: 24px 20px 4px

**Coaching cue**
Text: `exercise.ref.cue`
Font: DM Sans, 14px, colour `--muted`, line-height 1.5
Margin: 0 20px 12px

**Video embed**
16:9 ratio iframe
Width: calc(100% - 40px), margin: 0 20px
Border-radius: 8px
Border: none
`allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"`
`allowfullscreen`
URL: `exercise.ref.url`
Loading: lazy

**Attribution line**
Below the video embed, full width, text-align right:
"Video: [channel name]" — DM Sans, 11px, colour `--dim`, padding-right 4px
Channel name sourced from a `credit` field on the `ref` object:
```javascript
ref: {
  cue: '...',
  url: '...',
  credit: 'Jeff Nippard' // channel name, shown as attribution
}
```
If `credit` field is absent: attribution line not shown.

**Embed failure handling**
If iframe fails to load (video removed, network error):
Hide iframe, show fallback:
- Icon: play button SVG, 32px, `--dim`, centred
- Text: "Video unavailable" — DM Sans, 13px, `--muted`, centred
- Subtext: "Ask your coach for a demo" — DM Sans, 12px, `--dim`, centred

**CLOSE button**
Position: absolute top 16px right 16px
Text: "CLOSE" — DM Sans, 11px, font-weight 700, uppercase, letter-spacing 1px, colour `--dim`
Background: none, border: none
Minimum tap target: 44px × 44px

**Backdrop**
Position: fixed, full screen, behind overlay
Background: rgba(0,0,0,0.5)
z-index: 4999
Tap to dismiss overlay

---

## ACCESSIBILITY

- Overlay receives focus when opened — first focusable element is CLOSE button
- Escape key dismisses overlay on desktop
- `aria-modal="true"` on overlay container
- `aria-label` on iframe: `"Technique video for ${exercise.name}"`
- Return focus to "?" button when overlay closes

---

## FUTURE COACH ADMIN INTEGRATION (Step 3)

When the coach admin interface is built in Step 3:
- Coach can update `ref.url` per exercise via admin UI
- Coach can update `ref.cue` per exercise
- Changes write to `gym/8RB/exerciseRefs/{exerciseName}` in Firestore
- App reads from Firestore first, falls back to data.js values if not found
- This means coach can override any reference without a code deployment

No Firestore reading required for Step 2 — data.js values are sufficient until Step 3.

---

## VERSION
Bump to 10.4.0 on completion.
Update CLAUDE.md.

---

## TESTING CHECKLIST
1. Exercise with `ref` defined — "?" button appears in header
2. Exercise without `ref` — "?" button does not appear, no empty space
3. Tap "?" — overlay slides up correctly
4. Coaching cue displays correctly
5. YouTube video embeds and plays inline
6. Session log is still functional underneath — tap a set, it works
7. Rest timer continues running while overlay is open
8. Tap backdrop — overlay dismisses
9. Tap CLOSE — overlay dismisses
10. Swipe down on overlay — overlay dismisses
11. Video failure state — fallback message shows correctly
12. Minimum tap target verified on "?" button — 44px × 44px
13. Run acorn on all affected files
