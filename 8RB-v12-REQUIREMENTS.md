# 8RB v12 — Requirements

**Target version:** 12.0.0
**Prerequisite:** iOS dead-button fix spec (`iOS-dead-button-fix-spec.md`) merged and verified at v11.4.0
**Project root:** `C:\Users\Steve D\botrack app\BoxTrack`
**Wireframe reference:** `8rb-admin-wireframe.html` (admin layout sketch)

---

## 1. Overview

This release adds the **1-2-1 PT tier**, restructures the Train tab into three permanent sections, replaces the existing single-page admin with a desktop-first redesign, and brings the admin session builder to full feature parity with the in-app Custom Session Builder.

### In scope

- New `pt121` profile flag (granular access tier alongside `sgpt`)
- Unified sessions collection (`gym/8RB/sessions`) replacing the existing `gym/8RB/sgptSessions`
- Train tab restructure: Free Train / SGPT / 1-2-1 PT, with locked states
- Admin redesign: sidebar nav, dashboard, members table, sessions split view, assignments, settings
- Session builder full CSB parity (session types, exercise types, AMRAP/EMOM extras, finisher)
- Locked-panel teaser editor with live preview (heading, body, signup URL — both tiers)
- Assignment workflow: coach can push any session to any combination of members for a given date

### Out of scope (backlog — see §9)

- Box tab paywall / locked content
- Video upload UI in admin
- Custom club-recorded videos replacing existing YouTube embeds
- Payment integration
- Coach role assignment via UI (remains Firestore-console-only, per CLAUDE.md)

### Phasing (recommended order — but not mandated)

Each phase is independently shippable. Build in order, ship after each.

| Phase | Scope | Visible to user? |
|-------|-------|------------------|
| **A** | Unified sessions collection + migration + security rules + composite indexes | No (foundational) |
| **B** | `pt121` profile flag wired through auth, app, admin toggle | No (no UI consumers yet) |
| **C** | Train tab restructured — three sections with locked states | **Yes** |
| **D** | Locked-panel config + teaser editor in admin Settings | **Yes** |
| **E** | Admin redesign — sidebar shell, all sections wired | **Yes** (coach only) |
| **F** | Session builder full CSB parity in admin | **Yes** (coach only) |
| **G** | Assignment workflow extended to any-member, any-session | **Yes** |

---

## 2. Architecture Changes

### 2.1 Unified sessions collection

**New path:** `gym/8RB/sessions/{sessionId}`

**Document shape:**

```
{
  // Identity
  name: string                    // required, 1-80 chars, trimmed
  visibility: 'sgpt' | 'pt121'    // required, immutable after create (use duplicate to change)
  assignedTo: string[]            // required field; empty array for sgpt, uid array for pt121

  // Session-level structure (matches in-app CSB)
  sessionType: 'straight_sets' | 'circuit' | 'amrap' | 'emom'  // required
  exercises: ExerciseEntry[]      // required, min 1, max 30
  finisher: string                // optional, max 500 chars; '' if not set

  // AMRAP-only fields (must be null/undefined if sessionType != 'amrap')
  amrapCap: number | null         // seconds, max 3600
  amrapTargetRounds: number | null

  // EMOM-only fields (must be null/undefined if sessionType != 'emom')
  emomDur: number | null          // total duration in minutes, max 60
  emomInterval: 30 | 60 | 90 | 120 | null  // seconds

  // Lifecycle
  active: boolean                 // default true; false = archived
  createdAt: serverTimestamp
  createdBy: uid                  // coach uid
  updatedAt: serverTimestamp
}
```

**ExerciseEntry shape:**

```
{
  name: string                    // required, the canonical exercise name (matches EXERCISE_LIBRARY where possible)
  displayName: string             // optional override; falls back to name
  exerciseType: 'standard' | 'superset' | 'amrap' | 'ladder' | 'pyramid' | 'drop_set'

  // Scheme fields — required for standard/superset/drop_set
  sets: number | null             // 1-20
  reps: string | null             // string to allow ranges like '8-12'; max 20 chars
  rest: number | null             // seconds; 0-600

  // AMRAP-exercise-only (when exerciseType == 'amrap')
  amrapTime: number | null        // seconds, 30-1200

  // Free notes
  notes: string                   // optional, max 200 chars; '' if not set
}
```

**Constraints enforced by the security rule:**

- `visibility == 'sgpt'` → `assignedTo` must be empty array
- `visibility == 'pt121'` → `assignedTo` must have at least 1 uid
- AMRAP fields populated only when `sessionType == 'amrap'`
- EMOM fields populated only when `sessionType == 'emom'`
- Exercise-type restrictions enforced client-side (e.g. EMOM session only allows standard exercises)

### 2.2 User profile additions

`users/{uid}/profile/data`:

- Existing fields unchanged
- **New field:** `pt121: boolean` — defaults `false`, immutable by the user, writable only by coach
- **Migration:** on first read after deploy, if `pt121` is missing, treat as `false` (no destructive backfill required)

### 2.3 Locked-panel config

**New path:** `gym/8RB/config/locked-panels` (single document)

**Shape:**

```
{
  sgpt: {
    heading: string         // max 60 chars
    body: string            // max 400 chars
    url: string             // signup URL, must start with https://
  },
  pt121: {
    heading: string
    body: string
    url: string
  },
  updatedAt: serverTimestamp
  updatedBy: uid
}
```

**Default values** (seeded on first deploy if document doesn't exist):

- SGPT heading: `Small Group Personal Training`
- SGPT body: `Small Group PT is coached strength and conditioning in a small group setting — programming written for you, the same group week to week.`
- SGPT url: `https://8roundsboxing.com` (placeholder — coach edits in Settings)
- 1-2-1 heading: `1-2-1 Personal Training`
- 1-2-1 body: `1-2-1 Personal Training is one-on-one coaching with Darren — your own programme, your own pace, fully tailored.`
- 1-2-1 url: `https://8roundsboxing.com` (placeholder)

### 2.4 Firestore composite indexes

Add to `firestore.indexes.json`:

```
{
  "indexes": [
    {
      "collectionGroup": "sessions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "visibility", "order": "ASCENDING" },
        { "fieldPath": "active", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "sessions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "visibility", "order": "ASCENDING" },
        { "fieldPath": "active", "order": "ASCENDING" },
        { "fieldPath": "assignedTo", "arrayConfig": "CONTAINS" }
      ]
    }
  ]
}
```

Deploy: `firebase deploy --only firestore:indexes`

### 2.5 Migration

**One-off script:** `scripts/migrate-sgpt-to-sessions.js`

For each document in `gym/8RB/sgptSessions/`:

1. Read existing document
2. Write a new document to `gym/8RB/sessions/` with:
   - All existing fields preserved
   - `visibility: 'sgpt'`
   - `assignedTo: []`
   - Default `sessionType: 'straight_sets'` if not present
   - Default `active: true` if not present
   - Migrate each exercise to ensure `exerciseType: 'standard'` is present
3. Log mapping `oldId → newId` to `migration-log.json`
4. Do **not** delete `sgptSessions` until acceptance criteria pass

After verification, archive `sgptSessions` collection (manual export then delete).

**No migration needed for `assignedSessions`** — that collection's shape is unchanged.

---

## 3. Firestore Security Rules

Add to `firestore.rules`:

```
// Helper functions
function isAuthed() { return request.auth != null; }
function isCoach() {
  return isAuthed() &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)/profile/data).data.role == 'coach';
}
function userProfile() {
  return get(/databases/$(database)/documents/users/$(request.auth.uid)/profile/data).data;
}

// Unified sessions
match /gym/8RB/sessions/{sessId} {
  allow read: if isAuthed() && (
    isCoach() ||
    (resource.data.visibility == 'sgpt' && userProfile().sgpt == true && resource.data.active == true) ||
    (resource.data.visibility == 'pt121' && userProfile().pt121 == true && request.auth.uid in resource.data.assignedTo && resource.data.active == true)
  );
  allow create, update, delete: if isCoach();
}

// Locked-panel config — readable by any authed user, writable only by coach
match /gym/8RB/config/locked-panels {
  allow read: if isAuthed();
  allow write: if isCoach();
}

// User profile pt121 field — only coach can write
match /users/{uid}/profile/data {
  // existing read rules unchanged
  allow update: if isCoach() ||
    (request.auth.uid == uid &&
     !request.resource.data.diff(resource.data).affectedKeys().hasAny(['sgpt', 'pt121', 'role']));
}
```

**Deploy:** `firebase deploy --only firestore:rules`

---

## 4. Train Tab Restructure (Member-facing)

### 4.1 Section structure

The Train tab always shows three sections in this fixed order, regardless of the user's access:

1. **FREE TRAIN** — hardcoded sessions from `data.js`. Existing category tabs (GU / TD / Core / BW / Custom). No change to current behaviour.

2. **SGPT** — controlled by `userProfile.sgpt`:
   - If `true`: shows YOUR PROGRAMME card list (Firestore `gym/8RB/sessions` where `visibility == 'sgpt'` and `active == true`)
   - If `false`: locked state (see §4.2)

3. **1-2-1 PT** — controlled by `userProfile.pt121`:
   - If `true`: shows YOUR 1-2-1 PROGRAMME card list (Firestore `gym/8RB/sessions` where `visibility == 'pt121'` and `active == true` and `assignedTo contains uid`)
   - If `false`: locked state (see §4.2)

Section headers use the existing `prog-section-header` styling. Each section is visually distinct (subtle background card or divider).

### 4.2 Locked state behaviour

For each locked section:

- Section title shown (e.g. `1-2-1 PT`)
- Lock icon (SVG, muted colour) displayed next to title
- Below the title, a single tappable card: `Tap to learn more`
- On tap, the card expands into a teaser panel:
  - Heading (from `gym/8RB/config/locked-panels.<tier>.heading`)
  - Body text (from `.body`)
  - Action line: `Sign up: speak to Darren at the gym or [visit our website →]`
  - Tapping the link opens `<tier>.url` in a new tab/external browser

The expanded panel collapses again on second tap or when tapping outside.

No session content is rendered for locked sections. The user cannot see session names, exercise counts, or any other content from locked tiers.

### 4.3 Assigned sessions ("ASSIGNED BY YOUR COACH")

The existing yellow ASSIGNED BY YOUR COACH card at the top of the Train tab remains. Its placement is **above** all three sections (always at the very top of the Train tab when at least one assigned session exists for today).

Assigned sessions can originate from any session in the unified collection, regardless of the user's tier. If the coach assigns Jay's 1-2-1 session to Tom (a member without `pt121`), Tom sees it in the ASSIGNED card and can complete it — the assignment overrides the tier visibility.

This means the assignment workflow is permissive: a coach can push any session to any member, even if that member does not normally have access to that tier.

---

## 5. Admin Redesign (Coach-facing)

The current `admin.html` is replaced. The new admin is a desktop-first single-page app at `/admin` (same URL).

**Wireframe reference:** `8rb-admin-wireframe.html`. The redesign should match the wireframe's layout, structure, and brand palette. Implementation may diverge in detail but not in structure.

### 5.1 Layout shell

- **Header (64px tall):** App title `8RB ADMIN`, user info (avatar + name + role badge), Sign out button.
- **Sidebar (240px wide, left):** Nav items in two groups:
  - **Main:** Dashboard, Members, Sessions, Assignments
  - **Content:** Videos, Settings
  - Active item: red left border, bg slightly elevated
  - Footer: version string + tagline
- **Main area:** scrollable, shows the active section

Minimum supported viewport: 1280px wide. Below that, show a banner: `Admin is designed for laptop or desktop use. Some features may not display correctly on this device.` (Do not block access, just warn.)

### 5.2 Dashboard

Landing page when coach signs in.

- Welcome banner: `Welcome back, [name]` + today's date in long format (e.g. `Friday, 13 June 2026`)
- Stat cards (4-column grid):
  - **Total members** — count of all users with role `member` or above
  - **SGPT members** — count where `sgpt == true`
  - **1-2-1 members** — count where `pt121 == true`
  - **Assigned this week** — count of `assignedSessions` docs with `assignedAt` in the last 7 days
- **Recent Activity feed** (left, 60% width):
  - Last 10 events, newest first
  - Event types: session completed, session assigned, new member joined
  - Each row: dot indicator (green=completed, gold=assigned, blue=new member), text, relative time
- **Quick actions panel** (right, 40% width):
  - "Assign a session" — navigates to Assignments view
  - "Build a session" — navigates to Sessions view with the New Session form open
  - "Manage members" — navigates to Members view

### 5.3 Members

Table view of all members.

**Top controls:**
- Search input (filters by name or email, case-insensitive substring match)
- Filter buttons: All / Member / SGPT / 1-2-1 / Coach (single-select, no multi-filter)
- Count: `Showing X of Y`

**Table columns:**

| Column | Source | Notes |
|--------|--------|-------|
| Name | `displayName` | Bold, primary text |
| Email | `email` | Muted |
| Joined | `createdAt` of profile | Formatted `DD MMM YYYY` |
| Role | `role` + tier badges | Pills: Member / SGPT / 1-2-1 / Coach. A user can have multiple (e.g. SGPT + 1-2-1) |
| SGPT | toggle button | Clicking toggles `profile.sgpt`. Optimistic UI, rollback on Firestore error. Disabled (`N/A`) for coach role. |
| 1-2-1 | toggle button | Same pattern, toggles `profile.pt121`. Disabled for coach role. |

**Toggle UX:**

- Off state: button text `ASSIGN SGPT` / `ASSIGN 1-2-1`, outlined style
- On state: button text `SGPT ON` / `1-2-1 ON`, filled (gold for SGPT, blue for 1-2-1)
- On click, write to Firestore, toast confirms: `SGPT access granted to [name]` / `SGPT access removed from [name]`
- On Firestore error: revert UI, toast error: `Failed to update — try again`

### 5.4 Sessions library + builder (split view)

Two panels, side-by-side. Left panel 380px wide (library); right panel flexes (builder).

**Left panel — Library:**

- Header: `LIBRARY`
- Tab row: SGPT / 1-2-1 / Archived (single-select)
- When tab == `1-2-1`: a member filter dropdown appears: `For: [All 1-2-1 members | <member name>]`. List of 1-2-1 members populates dynamically from users with `pt121 == true`.
- Session cards (renders dynamically based on tab + member filter):
  - Session name (display caps)
  - Meta line: `{N} exercises` · `{Session Type}` · for 1-2-1: `{Member names}`
  - Action buttons: Edit / Duplicate / Archive (or Unarchive on Archived tab)
  - Click anywhere on card (not on a button) loads the session into the builder
- Button at bottom: `+ NEW SGPT SESSION` / `+ NEW 1-2-1 SESSION` (label changes per tab). Disabled on Archived tab.

**Right panel — Builder:**

- Header: `BUILD — NEW SESSION` or `EDIT — {NAME}`
- Sub-header: `New session` (green) or `Editing existing session`
- Form body (see §6 for full spec)
- Footer: Cancel / Duplicate / Save

**Behaviours:**

- **Edit:** load fields, save updates existing doc
- **Duplicate:** copy fields into a new (unsaved) session form, change title to `EDIT — {NAME} (COPY)`, save creates a new doc
- **Archive:** set `active: false`. Session moves to Archived tab.
- **Unarchive:** set `active: true`. Session returns to its visibility's tab (SGPT or 1-2-1).
- **Delete:** not supported. Use Archive.

### 5.5 Assignments

Split view: assignment form (left, 380px), recent assignments table (right).

**Form (left):**

- **Session dropdown** — populated with all active sessions, grouped:
  - SGPT (header) — list
  - 1-2-1 (header) — list
- **For date** — date picker, defaults to today
- **Send to** — toggle row:
  - `All SGPT` — only shown when selected session is SGPT. Sends to all members with `sgpt == true`.
  - `All 1-2-1` — only shown when selected session is 1-2-1. Sends to all members in the session's `assignedTo` array.
  - `Specific members` — always available. Shows a member checklist below.
- **Specific members checklist** (shown when toggled):
  - Search input filters list
  - Tier filter pills (All / SGPT / 1-2-1 / Member)
  - Checkbox per member, with name + email
  - Multi-select supported
  - Coach can select **any** member regardless of tier — assignment is permissive (see §4.3)
- **Help line below toggle:** updates dynamically — e.g. `All 12 SGPT members will receive this session.` or `3 members selected.`
- **Action button:** `ASSIGN` — creates one `assignedSessions` doc per recipient, toasts success: `Assigned to {N} members for {date}`

**Recent assignments table (right):**

- Columns: Member / Session / For Date / Status
- Status values: `Pending` (gold dot), `Completed` (green dot), `Expired` (grey dot — past date, not completed)
- Sortable by date (newest first by default)
- Pagination at 50 rows

### 5.6 Settings

Sections (all on one scrollable page):

**Section 1 — Coach's Notes** (existing functionality, no change to data model)
- Textarea, max 1000 chars
- Character counter + last updated timestamp
- Save button

**Section 2 — SGPT Locked Panel**

Two-column layout: edit form (left), live preview (right).

Edit form fields:
- `Heading` (text input, max 60 chars)
- `Body` (textarea, max 400 chars)
- `Signup URL` (URL input, must start with `https://`)
- `Save SGPT teaser` button

Live preview: renders exactly what a non-SGPT member sees when they tap the locked SGPT section in the Train tab. Updates as the coach types (`input` event, no save needed for preview).

**Section 3 — 1-2-1 Locked Panel**

Identical structure to Section 2, but writes to `gym/8RB/config/locked-panels.pt121`.

### 5.7 Videos (placeholder)

Empty section with placeholder text:

> **Backlog — coming later**
> **VIDEO LIBRARY**
> The Box tab currently uses YouTube embeds defined in code. This section will let the coach paste a YouTube URL, add title, description, and segment (Punches / Defence / Footwork / Combos), and replace existing content with the club's own videos. Scoped for after the SGPT and 1-2-1 work lands.

No active controls. Visible in sidebar nav so its place in the IA is established.

---

## 6. Session Builder — Full CSB Parity

The admin session builder must match every field and behaviour of the in-app Custom Session Builder (`train.js` CSB functions).

### 6.1 Session-level fields

| Field | Type | Required | UI | Validation |
|-------|------|----------|----|------------|
| Visibility | radio (2 cards) | Yes | `SGPT — SHARED` / `1-2-1 — SELECTED` | Required. Immutable after first save. |
| 1-2-1 members | checklist | If visibility=='pt121' | Member checklist | At least 1 must be selected |
| Name | text | Yes | Single-line input | 1-80 chars, trimmed |
| Session type | radio (4 cards) | Yes | `STRAIGHT SETS` / `CIRCUIT` / `AMRAP` / `EMOM` | Required. Switching mid-build keeps compatible exercises and resets incompatible exercise types. |
| Exercises | dynamic list | Yes | See §6.2 | Min 1, max 30 |
| Finisher | textarea | No | Multi-line input | Max 500 chars |
| AMRAP cap | number | If session type=='amrap' | Conditional block | Seconds, 60-3600 |
| AMRAP target rounds | number | If session type=='amrap' | Conditional block | 1-50 |
| EMOM duration | number | If session type=='emom' | Conditional block | Minutes, 1-60 |
| EMOM interval | pill row (30/60/90/120) | If session type=='emom' | Conditional block | One of the four values |

### 6.2 Exercise-level fields

Each exercise row has:

| Field | Type | Required | UI | Notes |
|-------|------|----------|----|-------|
| Number | derived | — | `01`, `02`, ... | Renumbers on add/delete |
| Name | text input with library search | Yes | Type-ahead from `EXERCISE_LIBRARY` (data.js), free text allowed | 1-50 chars |
| Exercise type | pill row | Yes | Pills: Standard / Superset / AMRAP / Ladder / Pyramid / Drop set | Single-select. Restricted by session type — see §6.3 |
| Sets | number | If type in {standard, superset, ladder, pyramid, drop_set} | Inline field | 1-20 |
| Reps | text | If type in {standard, superset, ladder, pyramid, drop_set} | Inline field | Max 20 chars, accepts ranges like `8-12` |
| Rest | number | If type in {standard, superset, drop_set} | Inline field | Seconds, 0-600 |
| AMRAP time | number | If exerciseType=='amrap' | Inline field, replaces Sets/Reps/Rest | Seconds, 30-1200 |
| Notes | text | No | Optional second line below scheme | Max 200 chars |

Action buttons per exercise: delete (`×`).

### 6.3 Conditional sections

**Exercise type restrictions by session type:**

| Session type | Allowed exercise types |
|--------------|------------------------|
| Straight sets | standard, superset, drop_set |
| Circuit | standard, ladder, pyramid |
| AMRAP | standard, amrap |
| EMOM | standard |

When the coach switches session type after adding exercises:
- Compatible exercises stay
- Incompatible exercises have their type silently reset to `standard`
- Toast: `Some exercise types were reset for {sessionType}`

**Drop set warning:**
When exercise type is set to `drop_set`, show a small note below the scheme fields: `Drop sets: enter the heaviest set only — the app will guide subsequent drops.`

---

## 7. Acceptance Criteria

The release is shippable when **all** of the following pass:

### Member-facing (Train tab)

1. A user with `sgpt: false` and `pt121: false` sees three sections: FREE TRAIN (full content), SGPT (locked), 1-2-1 PT (locked).
2. Tapping a locked section expands the teaser panel with heading, body, and a link to the signup URL.
3. The signup URL opens in a new tab/external browser.
4. A user with `sgpt: true` sees SGPT YOUR PROGRAMME content; 1-2-1 remains locked.
5. A user with `pt121: true` sees only sessions where their uid appears in that session's `assignedTo` array.
6. A user with both flags sees both sections unlocked.
7. ASSIGNED BY YOUR COACH cards appear above all three sections when present.
8. An assigned session works regardless of whether the user has tier access to the source session.

### Coach-facing (Admin)

9. The admin loads at `/admin` and renders the sidebar layout on viewports ≥1280px.
10. Dashboard shows accurate live counts for total members, SGPT members, 1-2-1 members, and weekly assignments.
11. Members table search filters live as the coach types.
12. Members role filter buttons filter the table correctly.
13. Toggling SGPT/1-2-1 on a member writes to Firestore and the change persists across a page reload.
14. Sessions library tabs (SGPT/1-2-1/Archived) filter correctly.
15. 1-2-1 tab member filter dropdown filters by `assignedTo`.
16. Clicking a session card loads it into the builder.
17. Builder Save writes a new or updated doc to `gym/8RB/sessions`.
18. Builder Duplicate creates an unsaved copy in the builder.
19. Archive sets `active: false` and the session moves to the Archived tab.
20. Assignment workflow creates `assignedSessions` docs for every selected recipient.
21. Coach can assign any session to any member, regardless of the session's `visibility` or the member's tier flags.
22. Settings → SGPT/1-2-1 teaser editor writes to `gym/8RB/config/locked-panels`.
23. Live preview in Settings updates as the coach types.

### Architecture

24. All sessions in `gym/8RB/sgptSessions` migrated to `gym/8RB/sessions` with `visibility: 'sgpt'`.
25. Migration log written to `migration-log.json`.
26. Firestore security rules updated and deployed.
27. Composite indexes deployed.
28. Acorn parse passes on all JS files: `firebase.js`, `data.js`, `app.js`, `train.js`, `box.js`, `progress.js`, `admin.js` (or whichever file the new admin lives in).
29. Lighthouse PWA audit score remains ≥90.
30. Settings panel and Profile tab display version `12.0.0`.

---

## 8. Build Phases (Recommended Order)

Each phase produces a working, shippable increment. Run the acorn check after every phase. Bump the version after each phase (12.0.0-alpha.1 through 12.0.0).

### Phase A — Foundation (no user-visible changes)

- Create `gym/8RB/sessions` collection
- Write migration script, run against staging first if available, then production
- Update Firestore security rules
- Add composite indexes
- Update `firestore.rules` and `firestore.indexes.json` in the repo

**Done when:** all SGPT sessions visible in the unified collection. Old collection retained for safety.

### Phase B — Profile flag (no user-visible changes)

- Add `pt121` field to user profile reads in `app.js`
- Ensure `loadUserData` queries handle the new field with default `false`
- No UI consumers yet

**Done when:** profile reads no longer break on missing `pt121` field.

### Phase C — Train tab restructure (user-facing)

- Refactor `train.js` `renderProgrammeSection()` (or equivalent) into `renderFreeTrainSection()`, `renderSgptSection()`, `renderPt121Section()`
- Replace existing SGPT query path to use unified collection (`where visibility=='sgpt'`)
- Add 1-2-1 query path (`where visibility=='pt121' and assignedTo array-contains uid`)
- Build locked-state UI for both tiers
- Wire teaser panel expand/collapse
- Read teaser content from `gym/8RB/config/locked-panels`

**Done when:** Train tab acceptance criteria 1-8 pass.

### Phase D — Settings teaser editor (admin)

- This is small enough to fit before the full admin redesign
- Build a temporary "Locked panels" section in the existing `admin.html` until Phase E lands
- Save writes to `gym/8RB/config/locked-panels`

**Done when:** Coach can edit teaser content and it appears in the Train tab.

### Phase E — Admin shell + members + dashboard

- New admin file (suggested: keep at `admin.html` or split into `admin/index.html` + `admin/admin.js`)
- Sidebar nav, dashboard with stats, members table with toggles
- Replace existing admin route

**Done when:** acceptance criteria 9-13 pass.

### Phase F — Admin sessions + builder full CSB parity

- Sessions library split view
- Full builder with every CSB field
- Save/Duplicate/Archive actions

**Done when:** acceptance criteria 14-19 pass.

### Phase G — Assignment workflow extension

- Update assign form to handle any session → any member matrix
- Add "Specific members" checklist with multi-select + filter
- Drop the existing "All SGPT" hardcoded behaviour in favour of the new flexible form

**Done when:** acceptance criteria 20-21 pass.

---

## 9. Out of Scope / Backlog

The following are explicitly **not** in v12. They are tracked for future versions:

1. **Box tab content gating** — putting some Box content behind SGPT/1-2-1 walls. May come in v12.x or v13.
2. **Video upload UI in admin** — coach pastes YouTube URL, sets title/description/segment. Wire to Box tab.
3. **Replace existing YouTube embeds with club-recorded videos** — depends on #2.
4. **Payment integration** — Stripe or similar for direct app sign-ups to SGPT/1-2-1.
5. **Coach role assignment via UI** — remains Firestore-console-only.
6. **Bulk member operations** — e.g. select 10 members and assign SGPT to all at once.
7. **Member profile drill-down** — clicking a member in the admin opens a drawer with their full history.
8. **Templates** — explicit "save as template" feature. Currently covered informally by Duplicate.

---

## 10. Coding Rules Reminder (from CLAUDE.md)

- **Acorn parse check** after every JS change. Command:
  ```
  node -e "const acorn=require('acorn'),fs=require('fs');['firebase.js','data.js','app.js','train.js','box.js','progress.js'].forEach(f=>{const code=fs.readFileSync(f,'utf8');try{acorn.parse(code,{ecmaVersion:2020,sourceType:'module'});console.log(f+' CLEAN');}catch(e){console.log(f+' ERROR line '+(e.loc&&e.loc.line)+': '+e.message);}});"
  ```
  Add any new admin JS files to the list.
- **No nested template literals** inside `${}`.
- **No optional chaining inside template literals.**
- **PowerShell:** commands run separately. No `&&` chaining. Use newlines or `;`.
- **Version bump** in `renderSettingsPanel()` and `renderProfile()` after every meaningful change. Both must match.
- **Update CLAUDE.md Current Status** line after each phase ships.
- **Local dev server:** `python -m http.server 3000` from `C:\Users\Steve D\botrack app`, served at `http://localhost:3000/BoxTrack/`.
- **Firebase project ID:** `rb-boxing`. **Region:** `europe-west2`. **Coach role:** Firebase console only.
- **Service worker:** `sw.js` uses network-first for JS/CSS, so deploys reach users on next reload. Bump `CACHE` constant in `sw.js` after major asset changes.

---

## Document control

- Version: 1.0
- Author: Claude (in chat) — directed by Stephen Dew
- Last updated: 14 June 2026
- Reviewed by: pending
