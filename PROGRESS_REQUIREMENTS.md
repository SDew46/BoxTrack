# Progress Tab Requirements
## 8RB by 8 Rounds Boxing
## For Claude Code execution — no interpretation required

---

## OVERVIEW

Three changes to the Progress tab:
1. Bug fix — data narrative negative progress string
2. Bug fix — freestyle sessions missing delete button
3. New feature — weekly summary banner at top of Progress tab

---

## FIX 1 — DATA NARRATIVE NEGATIVE PROGRESS

### Location
`progress.js` — `buildNarrative()` function, `diff < 0` branch

### Current behaviour
When best weight in last 28 days is lower than best weight before that window, the function falls through to the same string as `diff === 0`: "Consistent — holding Xkg"

### Required behaviour
When `diff < 0`:
- String: "↓ [X]kg in the last 4 weeks — keep pushing"
- Colour: `--muted` (not red — this is not a failure state, just information)
- X = absolute value of the difference, formatted with `fmtWt()`

Full updated logic:
```javascript
if (diff > 0) return '<span style="color:var(--green)">↑ ' + fmtWt(diff) + ' added in the last 4 weeks</span>';
if (diff < 0) return '<span style="color:var(--muted)">↓ ' + fmtWt(Math.abs(diff)) + ' in the last 4 weeks — keep pushing</span>';
if (diff === 0) return '<span style="color:var(--muted)">Consistent — holding ' + fmtWt(best) + '</span>';
```

---

## FIX 2 — FREESTYLE SESSIONS DELETE BUTTON

### Location
`progress.js` — `renderFreestyleSessions()` function

### Current behaviour
Freestyle session rows have no delete button. Boxing class rows have a delete button. Inconsistent.

### Required behaviour
Each freestyle session row gets a delete button matching the existing boxing class delete button implementation exactly:
- Position: right side of row
- Visual: same style as existing delete button on boxing class rows
- On tap: confirmation required — "Delete this session?" with CANCEL / DELETE buttons
- On confirm: remove session from Firestore (freestyle sessions subcollection) and localStorage, re-render the section

---

## NEW FEATURE — WEEKLY SUMMARY BANNER

### Position
Top of Progress tab, above all existing content. Full width.

### What a "week" means
Monday 00:00 to Sunday 23:59. Same definition used throughout the app for streak logic.

### Data sources
- Gym sessions: count documents in `users/{uid}/sessions` where `date` falls within current week
- Boxing/freestyle sessions: count documents in `users/{uid}/boxingSessions` where `date` falls within current week
- Total all-time sessions: count of all documents across both subcollections
- "Never trained" state: total all-time sessions === 0

Sessions this week = gym sessions this week + boxing sessions this week combined.

### Layout

**Outer container**
Width: 100%, padding: 20px 16px
Background: `#141414`
Border-bottom: 1px solid `--border`
Margin-bottom: 0 (Progress tab content sits directly below)

**Row 1 — Session count and total**
Display: flex, justify-content: space-between, align-items: baseline
Margin-bottom: 8px

Left side:
- Number: sessions this week count — Bebas Neue, 48px, colour `--text`
- Label: "THIS WEEK" — DM Sans, 10px, font-weight 700, uppercase, letter-spacing 2px, colour `--dim`, margin-left 6px, vertical-align bottom

Right side:
- Number: total sessions all time — Bebas Neue, 24px, colour `--gold`
- Label: "TOTAL" — DM Sans, 10px, font-weight 700, uppercase, letter-spacing 2px, colour `--dim`, margin-left 4px

**Row 2 — Forward-looking message**
Font: DM Sans, 15px, colour `--muted`, line-height 1.5

Message selected by this logic (evaluated in order, first match wins):

```javascript
function getWeekMessage(sessionsThisWeek, totalSessions, dayOfWeek) {
  // dayOfWeek: 0=Sunday, 1=Monday ... 6=Saturday
  if (totalSessions === 0) return "Your first session is waiting. Let's go.";
  if (sessionsThisWeek === 0 && (dayOfWeek === 1 || dayOfWeek === 2 || dayOfWeek === 3)) 
    return "New week. What are we doing today?";
  if (sessionsThisWeek === 0 && (dayOfWeek === 4 || dayOfWeek === 5)) 
    return "Week's not over. One session changes everything.";
  if (sessionsThisWeek === 0 && (dayOfWeek === 0 || dayOfWeek === 6)) 
    return "Still time. Make it count.";
  if (sessionsThisWeek === 1) return "Good start. Build on it.";
  if (sessionsThisWeek === 2) return "Momentum building. Keep going.";
  if (sessionsThisWeek === 3) return "Strong week. Finish it well.";
  if (sessionsThisWeek >= 4) return "Exceptional week. Your coach would be proud.";
}
```

These exact strings. No variation.

**Row 3 — Session type breakdown (optional detail)**
Display: flex, gap: 16px
Margin-top: 10px

Two small pills, shown only when sessionsThisWeek > 0:
- Gym: "[n] GYM" — DM Sans, 11px, colour `--dim`, background `#1e1e1e`, padding 3px 8px, border-radius 20px
- Boxing: "[n] BOXING" — same styling

If either count is 0, that pill is not shown.

### Loading state
While Firestore data is being fetched, show:
- Session count as "—" in `--dim`
- Message as "Loading your week..." in `--dim`
No spinner — keep it subtle.

### Empty state
If user has never trained (total === 0):
- Session count: "0"
- Message: "Your first session is waiting. Let's go."
- No type breakdown pills shown

### Offline behaviour
If Firestore read fails (offline), fall back to localStorage data for the count. If localStorage also has no data, show the never-trained empty state. Never show an error message in the banner.

---

## PROGRESS TAB LAYOUT ORDER (after these changes)

Top to bottom:
1. Weekly summary banner (NEW)
2. Strength lifts section (existing — unchanged)
3. Recent sessions (existing — unchanged)
4. Freestyle sessions section (existing + delete button fix)
5. Boxing log section (existing — unchanged)

The existing streak card (`renderStreak()`) is removed entirely.
It is replaced by the weekly summary banner.
The TRAINING STREAK label and the three-number card (week streak / gym / boxing) are removed.

---

## VERSION
Bump to 10.5.0 on completion.
Update CLAUDE.md.

---

## TESTING CHECKLIST
1. Data narrative — log a session with lower weight than previous — confirm "↓ Xkg in the last 4 weeks — keep pushing" in muted colour
2. Data narrative — log a session with same weight — confirm "Consistent — holding Xkg"
3. Data narrative — log a session with higher weight — confirm "↑ Xkg added in the last 4 weeks" in green
4. Freestyle delete — delete button appears on freestyle rows
5. Freestyle delete — confirmation modal appears on tap
6. Freestyle delete — session removed from Firestore and list updates
7. Weekly banner — shows 0 and correct day-of-week message when no sessions this week
8. Weekly banner — increments correctly after logging a session
9. Weekly banner — total all-time count shows in gold and increments
10. Weekly banner — type breakdown pills show correctly
11. Weekly banner — loading state shows before data arrives
12. Streak card — completely removed, no remnants
13. Run acorn on all affected files
