# Progress Tab Overhaul Requirements
## 8RB by 8 Rounds Boxing
## For Claude Code execution — no interpretation required

---

## OVERVIEW

Overhaul the Progress tab. Fix the current UI overflow issues, simplify the lift cards, surface PBs and boxing tracking properly, improve the consistency indicator.

No charts, no bodyweight tracking, no volume graphs — those are explicitly out of scope for this build. Focus on getting the existing content clear, legible, and useful.

---

## WHAT STAYS

- The weekly summary banner at the top (the "sessions this week" + forward-looking message + total sessions all time)
- The general structure of lift tracking cards for main compound lifts
- Recent sessions list
- Boxing / freestyle session history
- Session deletion functionality

---

## WHAT CHANGES

### 1. FIX LIFT CARD OVERFLOW
The current lift cards render text that overflows the container (visible in your screenshot: "1KG" pushed off the right edge, cramped multi-line text). This is because too many pieces of information are being crammed into a small horizontal space.

### 2. SIMPLIFY LIFT CARDS
Each lift card currently shows:
- Lift name
- Best set (with kg)
- Session type badge (GROUND UP / TOP DOWN)
- Personal best (PB) with kg
- Estimated 1RM (Epley formula)
- Date of PB
- Data narrative ("Keep going", "Consistent — holding", etc.)

Reduce to:
- Lift name (larger, more prominent)
- Best weight (single number)
- Trend indicator (up arrow / consistent / down arrow with contextual text)
- Tap card to expand — reveals PB, estimated 1RM, PB date, and full narrative in an expanded state

The default collapsed state is clean and scannable. The expanded state is available for members who want detail.

### 3. NEW PERSONAL BESTS SECTION
Above the lift cards, add a new PBs section showing recent achievements. This celebrates progress explicitly.

### 4. IMPROVED CONSISTENCY INDICATOR
Add a "CONSISTENCY" line inside the weekly summary banner. Shows average sessions per week over the last 4 weeks.

### 5. BOXING PROMINENCE
Currently boxing history is buried at the bottom. Give it equal prominence with strength lifts. Show total rounds and total boxing time this month.

---

## NEW PROGRESS TAB LAYOUT

Vertical stack from top to bottom:

### 1. Weekly Summary Banner (existing, with additions)
Layout unchanged. Add one new line below the forward-looking message:

Existing:
- "0 THIS WEEK ... 2 TOTAL"
- "Week's not over. One session changes everything."

Add:
- Small line: "AVG [n.n] SESSIONS/WEEK OVER LAST 4 WEEKS" — DM Sans 11px uppercase letter-spacing 1.5px --dim

Calculation:
```javascript
function getAvgSessionsPerWeek() {
  var now = new Date();
  var fourWeeksAgo = new Date(now);
  fourWeeksAgo.setDate(now.getDate() - 28);
  var count = (userDataCache.sessions || []).filter(function(s) {
    return new Date(s.date) >= fourWeeksAgo;
  }).length;
  count += (userDataCache.boxingSessions || []).filter(function(s) {
    return new Date(s.date) >= fourWeeksAgo;
  }).length;
  return (count / 4).toFixed(1);
}
```

Format: "AVG 1.5 SESSIONS/WEEK OVER LAST 4 WEEKS"
If average is 0: "AVG 0 SESSIONS/WEEK OVER LAST 4 WEEKS"

### 2. Personal Bests Section (NEW)

Header: "PERSONAL BESTS" — Bebas Neue 24px, colour --text
Position: below the weekly banner, above strength lifts

Content: last 3 PRs achieved, most recent first.

A PR is detected by comparing max weight × reps in the current session vs the historical max for that exercise. This logic likely already exists in detectPRs() in app.js — reuse it.

Layout: three cards horizontally on desktop, vertical stack on mobile.

Each PR card:
- Background: `#141414`
- Border: 1px solid --border
- Border-radius: 12px
- Padding: 16px
- Contents:
  - Small trophy icon SVG, 20px, --gold
  - Exercise name: Bebas Neue 18px --text
  - Weight × reps: Bebas Neue 24px --gold (e.g. "80kg × 5")
  - Date: DM Sans 11px --dim (e.g. "12 Sep 2026")

Empty state (no PRs yet):
- Show a single card with text: "Log some sessions to start hitting personal bests." — DM Sans 13px --muted, centred

If more than 3 PRs exist, show only the 3 most recent. A "SEE ALL" link below the cards navigates to a full PR history (not required in this build — can be a placeholder that shows a modal listing all PRs).

### 3. Strength Lifts Section (SIMPLIFIED)

Header: "STRENGTH LIFTS" — Bebas Neue 20px, colour --text
(Same as current)

Each lift card, collapsed state:

Layout: horizontal, 3 columns
- Column 1 (60% width): Lift name, Bebas Neue 20px --text, wrap if needed
- Column 2 (25% width): Best weight, Bebas Neue 22px --gold (e.g. "80kg") — right aligned
- Column 3 (15% width): Trend indicator icon (up arrow, right arrow, down arrow), 20px SVG, coloured per state

Below the horizontal row, a small text line:
- Trend narrative: DM Sans 12px, one of:
  - "↑ Up 5kg in 4 weeks" (green)
  - "Consistent — holding 80kg" (--muted)
  - "↓ Down 2.5kg in 4 weeks — keep pushing" (--muted)
  - "Log this lift to start tracking" (--dim, italic)

Empty lift cards (no data yet):
- Name still shown
- Best weight column: "—"
- Trend column: hidden
- Bottom text: "Log this lift to start tracking" italic --dim

Tap to expand:
- Card expands vertically to show additional detail
- Reveals: Session type badge, Personal best with date, Estimated 1RM (Epley)
- Small "COLLAPSE ▲" affordance at bottom right
- Only one card can be expanded at a time — tapping another collapses the previous

Card styling:
- Background: `#141414`
- Border: 1px solid --border
- Border-radius: 12px
- Padding: 16px
- Margin-bottom: 8px

### 4. Boxing Section (PROMOTED)

Header: "BOXING" — Bebas Neue 24px, colour --text
Position: after Strength Lifts, above Recent Sessions

Summary card at top of section:
- Background: `#141414`
- Border: 1px solid --border
- Border-radius: 12px
- Padding: 20px
- Contents (horizontal layout, 2 columns):
  - Left: 
    - Large number: total rounds this month, Bebas Neue 42px --gold
    - Label: "ROUNDS THIS MONTH" — DM Sans 11px uppercase letter-spacing 2px --dim
  - Right:
    - Large number: total boxing minutes this month, Bebas Neue 42px --gold
    - Label: "MINUTES THIS MONTH" — DM Sans 11px uppercase letter-spacing 2px --dim

Below the summary card, keep the existing freestyle sessions list and boxing class log (both already have delete buttons after prior fixes).

Empty state (no boxing sessions ever):
- Summary card shows "—" for both numbers
- Below the card: "Your boxing history will show here after your first session." — DM Sans 13px --muted

### 5. Recent Sessions Section

Existing implementation. Layout unchanged.

Position: after Boxing section.

### 6. Freestyle Sessions (already exists)

Kept as-is.

### 7. Boxing Log (already exists)

Kept as-is.

---

## LAYOUT ORDER (final)

Top to bottom:
1. Weekly summary banner (with new consistency line)
2. Personal Bests section
3. Strength Lifts section (simplified cards, collapsed by default)
4. Boxing section (with new month summary card at top)
5. Recent Sessions
6. Freestyle Sessions
7. Boxing Log

---

## MOBILE RESPONSIVE

- PB cards stack vertically on screens narrower than 480px
- Lift cards remain single column (already are)
- Boxing summary card 2 columns remains — the two numbers are short enough to fit
- All text wraps correctly, no overflow

---

## BUG FIXES INCLUDED

The overflow visible in the current UI (weight text pushed off screen, "1KG" cut off, cramped narrative wrapping mid-word) is caused by:
- Multiple numeric fields competing for horizontal space
- Fixed-width columns not accounting for longer content
- Narrative text using inline layout that wraps mid-word

The simplification above fixes this by:
- Reducing to 3 columns with clear width allocations
- Moving narrative to its own line below the horizontal row
- Setting max-width and word-break: normal on all text elements
- Testing on the smallest viewport width (mobile 375px)

---

## DATA — WHAT COMES FROM WHERE

- Weekly banner counts: userDataCache.sessions + userDataCache.boxingSessions
- PBs: detected via existing PR detection logic, stored per-lift in localStorage or Firestore (whichever already exists)
- Lift best weights: derived from userDataCache.sessions
- Boxing month stats: derived from userDataCache.boxingSessions filtered by current calendar month

No new Firestore reads. All data already available in cache.

---

## FILES TO CHANGE

- `progress.js` — refactor renderStreak(), renderLifts(), and add renderPBs() and renderBoxingSummary()
- `styles.css` — update lift card layout to 3-column, add PB card styles, add expanded state styles
- `data.js` — no changes required

---

## ACCESSIBILITY

- Each lift card is a `<button>` element (expandable on tap) with aria-expanded state
- PB cards have aria-label describing the achievement
- The consistency line is announced by screen readers on page load
- All numbers have contextual labels for screen readers (e.g. "80 kilograms" not just "80")

---

## VERSION
Bump to 11.6.0 on completion.
Update CLAUDE.md.

---

## TESTING CHECKLIST
1. Weekly banner shows correct "AVG X SESSIONS/WEEK" line
2. PBs section shows up to 3 recent PRs with correct data
3. Empty PBs state shows correct message
4. Lift cards render in single row with no overflow on 375px viewport
5. Tapping a lift card expands it, showing PB and 1RM details
6. Only one lift card expanded at a time
7. Boxing section shows correct month totals (rounds and minutes)
8. Boxing summary shows "—" when no data
9. Lift cards with no data show "Log this lift to start tracking"
10. Trend narrative shows correct colour per state (green/muted/muted)
11. Run acorn on all JS files
12. Run Playwright suite — update any tests that referenced old Progress tab layout
