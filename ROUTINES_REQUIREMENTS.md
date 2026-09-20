# Routines Architecture Requirements
## 8RB by 8 Rounds Boxing
## For Claude Code execution — no interpretation required

---

## OVERVIEW

Restructure the TRAIN tab from a flat list of every session ever run into a small curated set of **routines** — the sessions the member actually uses regularly. Every logged session moves to a **History** view accessible from Progress. The two concepts stop being conflated.

This addresses the flat-list-growing-forever problem while matching the pattern the market has converged on (Strong, Hevy, Fitbod all use routines as the primary object).

---

## KEY CONCEPTS

### Routine
A saved template the member has chosen to keep visible on TRAIN. Small, curated set (typically 4-8). This is the main way a member starts training.

Sources of routines:
- User-built custom sessions (become routines automatically when created)
- Coach-assigned sessions the user has completed and saved as a routine
- Standard library sessions the user has added to their routines list
- Silent migration: on first open after this build, the user's 5 most recently used unique sessions become routines automatically

Routines live in Firestore at `users/{uid}/routines/{routineId}`.

### Session (logged)
An instance of a completed workout. Historical record only. Contains actual weights, reps, sets performed. Does not appear on TRAIN. Appears in History (accessible from Progress tab).

Sessions live in Firestore at `users/{uid}/sessions/{sessionId}` — unchanged from current structure.

### Assigned session
A coach-pushed session appearing at the top of TRAIN. Not a routine (unless the user explicitly saves it as one after completing). Behaviour unchanged from current implementation.

### Standard library
Pre-built sessions defined in `SESSIONS` array in data.js. Members browse these to add to their routines list. They do not appear directly on TRAIN unless added as a routine.

---

## FIRESTORE — NEW COLLECTION

### users/{uid}/routines/{routineId}

Document structure:
```javascript
{
  id: auto-generated string,
  name: string (routine display name),
  source: 'custom' | 'assigned' | 'standard',
  sourceRef: string (optional — references the original standard session id or assigned session id),
  exercises: array of exercise objects (same structure as sessions),
  createdAt: serverTimestamp(),
  lastUsedAt: serverTimestamp() (updated on each session logged from this routine),
  useCount: number (incremented on each session logged from this routine),
  order: number (for user-defined ordering, default = createdAt)
}
```

### Security rules for routines

```
match /users/{userId}/routines/{routineId} {
  allow read, write: if isAuthenticated() && isVerified() && isOwner(userId);
}
```

Deploy updated rules after implementation.

---

## MIGRATION (RUNS ONCE PER USER)

On first sign-in after this build deploys, run migration silently in the background:

```javascript
async function migrateToRoutines(uid) {
  // Check if migration already ran
  var profileRef = doc(db, 'users', uid, 'profile', 'data');
  var profile = await getDoc(profileRef);
  if (profile.exists() && profile.data().routinesMigrated === true) return;
  
  // Get user's sessions history
  var sessions = userDataCache.sessions || [];
  if (sessions.length === 0) {
    // No history — mark migrated and exit
    await updateDoc(profileRef, { routinesMigrated: true });
    return;
  }
  
  // Group sessions by session name, count occurrences, find most recent per name
  var byName = {};
  sessions.forEach(function(s) {
    var name = s.sessionName || s.name || 'Untitled Session';
    if (!byName[name]) {
      byName[name] = { count: 0, mostRecent: s, exercises: s.exercises };
    }
    byName[name].count++;
    if (new Date(s.date) > new Date(byName[name].mostRecent.date)) {
      byName[name].mostRecent = s;
      byName[name].exercises = s.exercises;
    }
  });
  
  // Sort by most recent, take top 5 unique
  var routineCandidates = Object.keys(byName)
    .map(function(name) { return { name: name, ...byName[name] }; })
    .sort(function(a, b) { 
      return new Date(b.mostRecent.date) - new Date(a.mostRecent.date); 
    })
    .slice(0, 5);
  
  // Create routine documents
  var batch = writeBatch(db);
  routineCandidates.forEach(function(r, i) {
    var routineRef = doc(collection(db, 'users', uid, 'routines'));
    batch.set(routineRef, {
      name: r.name,
      source: 'migrated',
      exercises: sanitiseExercisesForRoutine(r.exercises),
      createdAt: serverTimestamp(),
      lastUsedAt: new Date(r.mostRecent.date),
      useCount: r.count,
      order: i
    });
  });
  
  // Mark migration complete
  batch.update(profileRef, { routinesMigrated: true });
  await batch.commit();
  
  // Log to console for visibility
  if (DEBUG) console.log('[8RB] Migrated ' + routineCandidates.length + ' routines');
}
```

`sanitiseExercisesForRoutine()` strips per-set actual values (kg, reps completed) and keeps only the template structure (name, target sets, target reps, rest, set type).

Migration runs after `ensureUserProfile()` completes, before `showApp()`. Failure is silent — logs to console but does not block the user.

---

## TRAIN TAB — NEW LAYOUT

### Header (unchanged)
- "STRENGTH & CONDITIONING" red label
- "8RB" title
- "BY 8 ROUNDS BOXING" subtitle

Remove the "WHAT ARE WE DOING TODAY?" line.

### Divider
1px solid --border, full width, margin 16px 0.

### Assigned Section (if any)
Coach-pushed sessions where status: 'pending' AND assignedFor <= today.
Rendered as expandable cards with yellow border and "ASSIGNED" badge.
Layout details as per TRAIN_SIMPLIFY_REQUIREMENTS.md — that spec still applies here.

Below the assigned card(s), the routines list begins directly (no header, no visual separator beyond the assigned card's own bottom margin).

### Routines List

Header: not shown (the routines simply list under the assigned section, or at the top if no assigned).

Each routine card, collapsed state:

```
┌──────────────────────────────────────────────┐
│ ROUTINE NAME                        [START]  │
│ 6 exercises · Last: 12 Sep                   │
└──────────────────────────────────────────────┘
```

- Background: `#141414`
- Border: 1px solid --border
- Border-radius: 12px
- Padding: 16px
- Margin-bottom: 8px

Contents:
- Left column (flex 1):
  - Routine name — Bebas Neue 22px --text
  - Sub-line — DM Sans 12px --muted: "[n] exercises · Last: [date]"
    - If never used: "[n] exercises · New routine" instead
- Right column:
  - START button — red border, red text, 40px height, "START" DM Sans 12px letter-spacing 1px

Tap anywhere on the card (except START) to expand.

### Expanded state

Card expands vertically to show:
- Exercise list — each exercise as a row:
  - Exercise name — Bebas Neue 15px --text
  - Sets × reps target — DM Sans 12px --muted (e.g. "3 × 8" or "5 × 5")
  - Rest interval — DM Sans 11px --dim (e.g. "90s rest")
- Bottom row:
  - COLLAPSE ▲ button (left) — DM Sans 11px --dim
  - EDIT button (right, small) — DM Sans 11px --muted, opens the routine in the custom builder for modification
  - DELETE button (right, small, red) — removes routine from list (with confirmation)

Only one routine card can be expanded at a time — tapping another collapses the previous.

Delete confirmation: "Delete this routine? Your session history is unaffected." YES / CANCEL.

### Add Routine Card

Position: below the routines list, sticky or scrolling with list.
- Full width, height 64px
- Background: transparent
- Border: 1px dashed --border
- Border-radius: 12px
- Text: "+ ADD ROUTINE" — DM Sans 13px, font-weight 700, uppercase, letter-spacing 1px, colour --dim
- On tap: opens the ADD ROUTINE modal (see below)

### ADD ROUTINE MODAL

Full-screen overlay with three options presented as large tap targets:

```
┌──────────────────────────────────────────────┐
│  BROWSE STANDARD LIBRARY                     │
│  Pre-built sessions from 8RB                 │
├──────────────────────────────────────────────┤
│  BUILD CUSTOM ROUTINE                        │
│  Design your own                             │
├──────────────────────────────────────────────┤
│  SAVE FROM HISTORY                           │
│  Turn a past session into a routine          │
└──────────────────────────────────────────────┘
```

Each option is 88px tall, background `#141414`, border 1px --border, border-radius 12px.

**BROWSE STANDARD LIBRARY**
Opens a scrollable list of all sessions from `SESSIONS` in data.js (filtered by user role — coaches see all, SGPT sees SGPT + standard, standard members see standard).

Each entry: session name, exercise count, and a "+ ADD" button.
Tapping "+ ADD" copies the session template to `users/{uid}/routines/` with source: 'standard' and sourceRef: session id.
User gets a toast: "Added to your routines". Modal closes.

**BUILD CUSTOM ROUTINE**
Opens the existing custom session builder (CSB) — unchanged from current implementation, except the save destination is `users/{uid}/routines/` not `users/{uid}/customSessions/`.

**SAVE FROM HISTORY**
Opens a list of the user's recent unique session names (from session history), each with "+ ADD" button.
Tapping "+ ADD" creates a routine from the most recent instance of that session template.
Useful for recovering something from before migration or for adding a session they did once and want to repeat.

---

## SESSION HISTORY VIEW (NEW)

Move all session history to a new dedicated view accessible from Progress tab.

### Access point
On the Progress tab, add a link/button at the bottom of the RECENT SESSIONS section:
- Text: "SEE ALL SESSIONS →" — DM Sans 12px --muted, letter-spacing 1px
- On tap: opens the session history view (either as a modal overlay or a full-screen view — see below)

### History view layout

Full-screen overlay or dedicated view. Header:
- Back arrow left
- Title: "SESSION HISTORY" — Bebas Neue 24px --text
- Filter icon right (opens filter options — see below)

Below header, a list of sessions grouped by month:

```
SEPTEMBER 2026

Monday 15 Sep    Push Day A
                 5 exercises · 42 min

Friday 12 Sep    SGPT Upper A (Assigned)
                 6 exercises · 38 min

Wednesday 10 Sep  Push Day A
                 5 exercises · 41 min

AUGUST 2026
...
```

Each session row:
- Background: transparent
- Border-bottom: 1px solid --border (very subtle)
- Padding: 12px 16px
- Left: Date (day + short date) — DM Sans 13px --muted
- Middle: Session name — Bebas Neue 15px --text
- Below name: exercise count + duration — DM Sans 11px --dim
- Right: chevron ▸ or nothing (tap opens session detail — future feature, out of scope here)

Tap a row to view session detail (out of scope for this build — placeholder alert "Session detail coming soon" is fine).

### Filter options
Small pop-up when filter icon tapped:
- By session name (dropdown of unique names)
- By date range (last 7 days, last 30 days, all time)
- Default: all time

### Empty state
"No sessions logged yet. Complete your first session to see it here." — centred, DM Sans 14px --muted.

---

## PROGRESS TAB CHANGES

The existing "RECENT SESSIONS" section stays as-is — it shows the last 5 sessions with delete buttons. Add the "SEE ALL SESSIONS →" link below it as described above.

The "FREESTYLE SESSIONS" and "BOXING LOG" sections stay unchanged.

---

## COACH-ASSIGNED SESSION FLOW

Existing behaviour preserved:
- Coach assigns session via admin
- Session appears at top of TRAIN with yellow border
- User taps START, logs the session, saves
- Session is written to `users/{uid}/sessions/` as normal
- Assigned session document status updates to 'completed'

New addition:
- After the session save success screen, add a button: "SAVE AS ROUTINE"
- Tapping it copies the assigned session template to `users/{uid}/routines/` with source: 'assigned' and sourceRef: assigned session id
- Toast: "Saved to your routines"
- If not tapped, the session lives only in history — as before

---

## CUSTOM SESSION BUILDER CHANGES

The existing CSB currently saves to `users/{uid}/customSessions/`. Change target to `users/{uid}/routines/` with source: 'custom'.

Delete the `customSessions` subcollection references from the codebase (loadUserData, session library rendering, etc). Custom sessions are now routines, no separate concept.

Migration for existing customSessions: on first sign-in, migrate any documents from `users/{uid}/customSessions/` into `users/{uid}/routines/` with source: 'custom'. Delete the customSessions documents after successful migration.

---

## RENDERLIBRARY() COMPLETE REFACTOR

The renderLibrary() function that TRAIN_SIMPLIFY_REQUIREMENTS.md specified is now further simplified:

```javascript
function renderLibrary() {
  var container = document.getElementById('session-list');
  container.innerHTML = '';
  
  var today = fmtDate(new Date());
  
  // 1. Assigned sessions (unchanged)
  var assigned = (userDataCache.assignedSessions || []).filter(function(s) {
    return s.status === 'pending' && s.assignedFor <= today;
  });
  assigned.sort(function(a, b) { return a.assignedFor.localeCompare(b.assignedFor); });
  assigned.forEach(function(a) {
    container.appendChild(renderAssignedCard(a));
  });
  
  // 2. Routines
  var routines = (userDataCache.routines || []).slice();
  routines.sort(function(a, b) {
    // Sort by order field ascending, then by lastUsedAt descending
    if (a.order !== b.order) return a.order - b.order;
    return (b.lastUsedAt || 0) - (a.lastUsedAt || 0);
  });
  routines.forEach(function(r) {
    container.appendChild(renderRoutineCard(r));
  });
  
  // 3. Empty state (if no assigned AND no routines)
  if (assigned.length === 0 && routines.length === 0) {
    container.appendChild(renderEmptyState());
  }
  
  // 4. Add routine card (always shown)
  container.appendChild(renderAddRoutineCard());
}
```

Delete all functions that previously rendered SGPT sections, 1-2-1 sections, FREE TRAIN sections, standard library lists, progression model. The TRAIN tab no longer renders any of these.

---

## LOADUSERDATA() UPDATE

Add routines to the initial load:

```javascript
try {
  var routinesSnap = await getDocs(
    collection(db, 'users', uid, 'routines')
  );
  userDataCache.routines = routinesSnap.docs.map(function(d) {
    return Object.assign({ _firestoreId: d.id }, d.data());
  });
} catch(e) {
  userDataCache.routines = [];
}
```

Add `routines: []` to userDataCache initialisation.

Remove customSessions from loadUserData() after migration is complete (either don't fetch it, or fetch and log a warning if any exist — indicates migration failure).

---

## STARTING A SESSION FROM A ROUTINE

When user taps START on a routine card:
1. Load the routine's exercise template into the log view
2. Set window.activeRoutineId = routine._firestoreId (used for tracking which routine was used)
3. Log view opens with the exercise template pre-populated

On save (saveSession()):
1. Session is written to `users/{uid}/sessions/` as normal
2. If window.activeRoutineId is set: update the routine document:
   - lastUsedAt: serverTimestamp()
   - useCount: increment(1)
3. Clear window.activeRoutineId

---

## CUSTOM SESSION FLOW UNCHANGED FROM USER PERSPECTIVE

The user still taps "+ ADD ROUTINE" → "BUILD CUSTOM ROUTINE" → uses the CSB → saves. Their new routine appears in the list. Behaviour is the same as before conceptually — only the storage location has changed.

---

## FILES TO CHANGE

- `train.js` — refactor renderLibrary(), add renderRoutineCard(), renderAddRoutineCard(), routine expand/collapse logic, delete routine logic
- `app.js` — add migrateToRoutines() function, call after ensureUserProfile(), update loadUserData() for routines
- `progress.js` — add "SEE ALL SESSIONS →" link, build session history view
- `firestore.rules` — add routines collection rules
- `styles.css` — update card styles, add history view styles
- `data.js` — no changes

---

## VERSION
Bump to 12.0.0 on completion (major version — architecture change).
Update CLAUDE.md with:
- New routines collection at users/{uid}/routines/
- Session vs routine distinction
- Migration behaviour
- customSessions collection deprecated

---

## TESTING CHECKLIST
1. Fresh user (no history) sees empty state and ADD ROUTINE button
2. User with existing session history has top 5 unique sessions auto-migrated as routines
3. Migration only runs once — routinesMigrated flag prevents re-run
4. Custom session builder saves to routines/, not customSessions/
5. Routines list shows correctly with name, exercise count, last used date
6. Tap routine card expands to show exercises inline
7. Tapping another routine collapses the previous
8. START button on routine opens log view with template pre-populated
9. Saving a session updates the routine's lastUsedAt and useCount
10. DELETE on a routine shows confirmation and removes it
11. Coach-assigned session shows at top with yellow border
12. After completing assigned session, "SAVE AS ROUTINE" button offered
13. Tapping SAVE AS ROUTINE creates a routine with source: 'assigned'
14. ADD ROUTINE modal shows three options
15. BROWSE STANDARD LIBRARY shows sessions from data.js, "+ ADD" copies to routines
16. Progress tab shows SEE ALL SESSIONS link
17. History view groups sessions by month
18. History view filter opens filter options
19. Run acorn on all JS files
20. Run Playwright suite — update tests that referenced old TRAIN structure
21. All existing session data preserved — nothing lost from users/{uid}/sessions/
