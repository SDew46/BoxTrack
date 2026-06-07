# Complete Exercise Reference Data
## For Claude Code — add ref field to these exercises in data.js
## Steve to verify URLs are live before pushing

---

## ALREADY VERIFIED BY STEVE

```javascript
// Back Squat
ref: { cue: 'Chest up, knees track toes, break parallel.', url: 'https://www.youtube.com/embed/ultWZbUMPL8', credit: 'CrossFit' }

// Barbell Deadlift
ref: { cue: 'Bar over mid-foot, hinge at hips, push the floor away.', url: 'https://www.youtube.com/embed/op9kVnSso6Q', credit: 'Alan Thrall' }

// Romanian Deadlift (Barbell)
ref: { cue: 'Soft knees, hinge at hips, feel the hamstring stretch.', url: 'https://www.youtube.com/embed/KhjNjzrm93c', credit: 'Jeff Nippard' }

// Barbell Bench Press
ref: { cue: 'Shoulder blades pinched, bar to lower chest, drive up.', url: 'https://www.youtube.com/embed/gBZkSn-zsD0', credit: 'Buff Dudes' }

// KB Goblet Squat
ref: { cue: 'Hold at chest, elbows inside knees, sit tall.', url: 'https://www.youtube.com/embed/sIX71MwChNg', credit: 'Cat & Chau Kettlebell' }

// KB Romanian Deadlift
ref: { cue: 'Keep KB close to legs, hinge back not down.', url: 'https://www.youtube.com/embed/BMyoKmywN40', credit: 'iRnsca' }

// Split Squat / Bulgarian Split Squat
ref: { cue: 'Front foot flat, back knee drops straight down.', url: 'https://www.youtube.com/embed/2C-uNgKwPLE', credit: 'Jeremy Ethier' }

// Weighted Pull-Up / Pull-Up
ref: { cue: 'Dead hang start, squeeze shoulder blades, chin over bar.', url: 'https://www.youtube.com/embed/Y3ntNsIS2Q8', credit: 'FitnessFAQs' }

// Dumbbell Bench Press
ref: { cue: 'Dumbbells at chest, controlled path, squeeze at top.', url: 'https://www.youtube.com/embed/QsYre__-aro', credit: 'ScottHermanFitness' }

// Landmine Press
ref: { cue: 'Single arm, slight forward lean, press to full extension.', url: 'https://www.youtube.com/embed/9OW4SONxuGI', credit: 'Sean Hyson' }
```

---

## NEW — VERIFY THESE BEFORE PUSHING

```javascript
// Conventional Deadlift
ref: { cue: 'Bar over mid-foot, neutral spine, push the floor away.', url: 'https://www.youtube.com/embed/VL5Ab0T07e4', credit: 'Jeff Nippard' }

// Trap Bar Deadlift
ref: { cue: 'Stand inside the bar, hinge and sit back, drive through heels.', url: 'https://www.youtube.com/embed/Vu4oXIRzx7w', credit: 'PureGym' }

// KB Swing
ref: { cue: 'Hip hinge not a squat, snap the hips, bell floats to chest.', url: 'https://www.youtube.com/embed/6cXVxLqTQM8', credit: 'Pat Flynn' }

// DB Romanian Deadlift
ref: { cue: 'Soft knees, push hips back, feel the hamstring stretch.', url: 'https://www.youtube.com/embed/uUjqvxEWcbo', credit: 'Physique Development' }

// Overhead Press (Barbell or DB)
ref: { cue: 'Core tight, press straight up, shrug at the top.', url: 'https://www.youtube.com/embed/_RlRDWO2jfg', credit: 'Jeff Nippard' }

// DB Goblet Squat (if separate from KB version)
ref: { cue: 'Hold at chest, elbows inside knees, sit tall.', url: 'https://www.youtube.com/embed/sIX71MwChNg', credit: 'Cat & Chau Kettlebell' }
```

---

## EXERCISES WITHOUT REFS — leave no ref field

Any exercise not listed above should have no ref field added.
This includes all bodyweight exercises, core exercises, and any
exercise where no suitable tutorial video was found.
The ? button will simply not appear for these exercises.

---

## INSTRUCTIONS FOR CLAUDE CODE

1. Open data.js
2. For each exercise listed above, find the matching entry 
   in EXERCISE_LIBRARY by name
3. Add the ref field exactly as shown
4. Do not add ref fields to any other exercises
5. Run acorn when done
6. Note: exercise names in data.js may differ slightly — 
   match by closest name (e.g. "Barbell RDL" matches 
   "Romanian Deadlift (Barbell)")
