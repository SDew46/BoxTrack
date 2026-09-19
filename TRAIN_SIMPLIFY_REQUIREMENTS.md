# TRAIN Tab Simplification Requirements
## 8RB by 8 Rounds Boxing
## For Claude Code execution — no interpretation required

---

## OVERVIEW

Simplify the TRAIN tab to a single flat session list. Remove the separate SGPT and 1-2-1 sections, remove the progression model, remove the equipment selector from the top of the page.

The member sees one thing: a list of sessions they can start. Coach-assigned sessions appear at the top of that list with visual distinction (yellow border), not as a separate section.

The underlying architecture — SGPT flag, 1-2-1 flag, coach assignment functionality — all remains intact. Only the member-facing UI changes.

---

## WHAT STAYS UNCHANGED

- The coach's ability to push sessions to members via the admin (SGPT, 1-2-1, or individual)
- The `sgpt: true/false` flag on user profiles
- The `assignedSessions` subcollection under each user
- The user's ability to build their own custom sessions
- The user's ability to run any previously used session
- Session log view (opens when a session is started)
- The header: gym name, "STRENGTH & CONDITIONING", brand tagline

---

## WHAT IS REMOVED FROM THE MEMBER TRAIN TAB

- The "YOUR SGPT PROGRAMME" section header and separate card group
- The "YOUR 1-2-1 PROGRAMME" section header and separate card group
- The "FREE TRAIN" section header
- The "PROGRESSION MODEL" section entirely (delete from DOM)
- The "EQUIPMENT" button at the top of the page (moves to a less prominent location — see below)
- The "WHAT ARE WE DOING TODAY?" line (redundant with the session list below it)

---

## NEW TRAIN TAB LAYOUT

Vertical stack from top to bottom:

### Header block (existing, unchanged)
- "STRENGTH & CONDITIONING" — red label, DM Sans 12px uppercase letter-spacing 2px
- "8RB" — Bebas Neue 56px, white
- "BY 8 ROUNDS BOXING" — DM Sans 11px uppercase --dim

### Divider
- 1px solid --border, full width, margin 16px 0

### Session list (single flat list — no section headers)

Order of sessions in the list, top to bottom:

**1. Assigned sessions from coach (if any)**
- Any assignedSessions where status: 'pending' AND assignedFor <= today
- Sorted by assignedFor ascending (oldest first)
- Rendered with yellow border and "ASSIGNED" badge (see Session Card Styling below)

**2. User's previously used custom sessions (if any)**
- Sessions the user has built themselves via the custom session builder
- Sorted by most recently used first
- Rendered with standard card style

**3. User's saved sessions from the standard library**
- Any standard sessions the user has run before
- Sorted by most recently used first
- Rendered with standard card style

**4. Standard session library (all remaining)**
- Standard sessions the user has not yet used
- Rendered with standard card style
- Sorted alphabetically by name

Deduplication: a session appears once. If a user has run a standard session before, it shows in section 3 (used) not section 4 (unused).

### Create session card
Position: sticky at the bottom of the session list, or below the list on scroll.
- Full width, height 64px
- Background: transparent
- Border: 1px dashed --border
- Border-radius: 12px
- Text: "+ CREATE NEW SESSION" — DM Sans 13px, font-weight 700, uppercase, letter-spacing 1px, colour --dim
- On tap: opens the existing custom session builder (unchanged)

### Equipment access
Move the EQUIPMENT button off the top of the page to a bottom sheet trigger.
Add a small icon button (gear icon, 32px) inside the CREATE NEW SESSION area, top right corner.
On tap: opens the existing equipment bottom sheet (unchanged functionality).
This removes visual clutter from the top of the screen without losing the feature.

---

## SESSION CARD STYLING

### Standard card (default)
- Background: `#141414`
- Border: 1px solid --border
- Border-radius: 12px
- Padding: 16px
- Margin-bottom: 8px
- Contents:
  - Session name (left, top): Bebas Neue 22px, white
  - Exercise count or session sub-info (left, below name): DM Sans 12px --muted
  - START button (right, centre-aligned vertically): red border, red text, 40px height, "START" DM Sans 12px letter-spacing 1px

### Assigned session card (coach-pushed)
Same base styling as standard card, plus:
- Border: 2px solid var(--gold) instead of --border
- Badge in top left corner: "ASSIGNED" — DM Sans 9px uppercase font-weight 700 letter-spacing 2px, colour --gold, background rgba(255,193,7,0.1), padding 2px 6px, border-radius 4px
- Small line above session name showing when it was assigned: "For today" or "For [date]" — DM Sans 11px --gold

The visual distinction is subtle but clear. It reads as "this is the one your coach picked for you" without a shouting section header.

### Previously used session card
Same as standard card, plus:
- Small line below session name: "Last run: [date]" — DM Sans 11px --dim

### Custom session card (user built)
Same as standard card, plus:
- Small icon (person icon SVG, 12px, --dim) next to the session name
- Small line below session name: "Your session" — DM Sans 11px --dim

---

## BEHAVIOUR

### Starting a session
Tapping START on any card opens the log view — same behaviour as current.
When starting an assigned session, the existing logic still applies:
- window.activeAssignedSessionId is set
- On save, the assignedSession document status updates to 'completed'
- The card disappears from the list

### Empty state
If a user has zero sessions available (fresh member, no coach assignments, no custom sessions, no history):
Show a centred empty state below the divider:
- Icon: dumbbell SVG, 48px, --dim
- Text: "No sessions yet." — DM Sans 16px --muted
- Subtext: "Create your first session below." — DM Sans 13px --dim
The CREATE NEW SESSION card is still visible below.

### Assigned session expiry
Existing 7-day expiry logic remains unchanged.
Expired assigned sessions do not appear in the list.

---

## DATA — WHAT COMES FROM WHERE

- Assigned sessions: userDataCache.assignedSessions (from Firestore, filtered where status: 'pending' AND assignedFor <= today)
- User's custom sessions: userDataCache.customSessions (from Firestore)
- Standard sessions: SESSIONS array in data.js
- User's session history: userDataCache.sessions (from Firestore, used to determine "previously used" flag on standard sessions)

No new Firestore reads required. All data already loaded by loadUserData() on sign-in.

---

## COACH VIEW (ADMIN AND MEMBER MODES)

The coach account has role: 'coach'. When the coach opens the TRAIN tab (member view, not admin), they see:
- All SGPT sessions they have created (from gym/8RB/sgptSessions where active: true) — as available sessions
- All standard sessions
- Any assigned sessions to their own account
- Their own custom sessions

Effectively the coach sees everything the app has. This is for their own testing and personal training.

The admin functionality remains at /admin — no changes to admin routes or admin UI in this build.

---

## RENDERLIBRARY() REFACTOR

The existing renderLibrary() function in train.js contains all the section-based rendering logic. Refactor to produce a single flat list.

Pseudocode:

```javascript
function renderLibrary() {
  var container = document.getElementById('session-list');
  container.innerHTML = '';
  
  var today = fmtDate(new Date());
  var sessions = [];
  
  // 1. Assigned sessions pending and due
  var assigned = (userDataCache.assignedSessions || []).filter(function(s) {
    return s.status === 'pending' && s.assignedFor <= today;
  });
  assigned.sort(function(a, b) { return a.assignedFor.localeCompare(b.assignedFor); });
  assigned.forEach(function(a) {
    sessions.push({ 
      type: 'assigned', 
      data: a, 
      sortDate: a.assignedFor 
    });
  });
  
  // 2. Custom sessions
  var custom = userDataCache.customSessions || [];
  custom.sort(function(a, b) { 
    return (b.lastUsed || b.createdAt) - (a.lastUsed || a.createdAt); 
  });
  custom.forEach(function(c) {
    sessions.push({ type: 'custom', data: c });
  });
  
  // 3. Previously used standard sessions (deduplicated)
  var usedNames = getUsedSessionNames(); // returns Set of session names user has logged
  var standardUsed = SESSIONS.filter(function(s) {
    return sessionVisibleToUser(s) && usedNames.has(s.name);
  });
  standardUsed.sort(function(a, b) { 
    return getLastUsedDate(b.name) - getLastUsedDate(a.name); 
  });
  standardUsed.forEach(function(s) {
    sessions.push({ type: 'used', data: s });
  });
  
  // 4. Standard sessions not yet used
  var standardUnused = SESSIONS.filter(function(s) {
    return sessionVisibleToUser(s) && !usedNames.has(s.name);
  });
  standardUnused.sort(function(a, b) { return a.name.localeCompare(b.name); });
  standardUnused.forEach(function(s) {
    sessions.push({ type: 'standard', data: s });
  });
  
  // Render
  sessions.forEach(function(item) {
    container.appendChild(renderSessionCard(item));
  });
}

function renderSessionCard(item) {
  // returns a DOM element styled per the session type
}
```

Remove the following functions or refactor them into renderSessionCard():
- Any function that renders the SGPT section header
- Any function that renders the 1-2-1 section header
- Any function that renders the "YOUR PROGRAMME" section
- Any function that renders the "FREE TRAIN" section header
- Any function that renders the progression model

Delete the progression model DOM entirely.

---

## FILES TO CHANGE

- `train.js` — refactor renderLibrary() and all session rendering
- `index.html` — remove progression model DOM if it lives here, remove equipment button from top of TRAIN tab
- `styles.css` — remove unused section header styles, remove progression model styles, add new assigned card border styling if not already present
- `data.js` — no changes required (SESSIONS array unchanged, existing audience/source fields still used by coach view logic)

---

## ACCESSIBILITY

- Each session card is a `<button>` element with clear aria-label: "Start session: [name]"
- Assigned cards have aria-label prefix: "Assigned by coach. Start session: [name]"
- The empty state has aria-live="polite" so screen readers announce it
- CREATE NEW SESSION card has aria-label: "Create a new custom session"
- Equipment icon has aria-label: "Open equipment settings"

---

## VERSION
Bump to 11.5.0 on completion.
Update CLAUDE.md to reflect the new flat list architecture.

---

## TESTING CHECKLIST
1. Member with no coach assignments sees a flat list starting with any previously used sessions, then the standard library
2. Member with a coach-pushed session sees it at the top with yellow border and ASSIGNED badge
3. Member with two coach-pushed sessions sees both at the top, ordered by assignedFor date
4. Starting an assigned session marks it complete on save and removes it from the list
5. Coach sees SGPT sessions plus standard sessions plus any assignments to their own account
6. Fresh member with no history sees empty state and CREATE NEW SESSION card
7. Progression model no longer appears anywhere on the TRAIN tab
8. Equipment button no longer appears at top of page — icon accessible from CREATE area
9. Custom sessions appear with "Your session" label and icon
10. Section headers ("YOUR SGPT PROGRAMME", etc.) removed entirely
11. Run acorn on all JS files
12. Run Playwright suite — update any tests that referenced removed section headers
