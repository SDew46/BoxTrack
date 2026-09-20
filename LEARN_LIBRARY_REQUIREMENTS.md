# LEARN Video Library Architecture Requirements
## 8RB by 8 Rounds Boxing
## For Claude Code execution — no interpretation required

---

## OVERVIEW

Restructure LEARN from a fixed set of six cards each holding one video into a proper video library where:
- Topics are fixed (Punches, Defence, Footwork, Shadow Boxing, Wrapping, Combinations)
- Each topic can hold any number of videos
- Videos are individual records with title, description, URL, credit, sort order
- Coach can add new videos, edit existing ones, or delete entirely

This supersedes LEARN_CONTENT_ADMIN_REQUIREMENTS.md. That build allowed editing six fixed cards — this build changes the underlying data model to a proper library.

---

## FIXED TOPICS

The set of topics is defined in code and cannot be changed by the coach:

```javascript
const LEARN_TOPICS = [
  { id: 'punches', label: 'Punches' },
  { id: 'defence', label: 'Defence' },
  { id: 'footwork', label: 'Footwork' },
  { id: 'shadow-boxing', label: 'Shadow Boxing' },
  { id: 'wrapping', label: 'Wrapping' },
  { id: 'combinations', label: 'Combinations' }
];
```

Adding new topics requires a code change. This is intentional for now — keeps the LEARN tab predictable.

---

## FIRESTORE DATA STRUCTURE

### New collection: gym/8RB/learnVideos

Each document is a single video:

```javascript
{
  id: auto-generated,
  topicId: string ('punches', 'defence', 'footwork', etc.),
  title: string (video title, e.g. "The Jab — beginner"),
  description: string (coaching cue or note, max 400 chars),
  url: string (YouTube embed URL, validated with isSafeEmbedUrl),
  credit: string (attribution, max 60 chars, optional),
  sortOrder: number (lower numbers appear first within topic, default: 100),
  active: boolean (default true — soft delete flag),
  createdAt: serverTimestamp(),
  createdBy: string (coach uid),
  updatedAt: serverTimestamp(),
  updatedBy: string (coach uid)
}
```

### Migration from previous structure

The previous build stored six cards at `gym/8RB/config/learnCards`. On first admin login after this build:
1. Read the existing `gym/8RB/config/learnCards` document (if exists)
2. For each card, create a new document in `gym/8RB/learnVideos` with:
   - topicId: mapped from the card's fixed id ('punches', 'defence', etc.)
   - title: card's existing title
   - description: card's existing cue
   - url: card's existing URL
   - credit: card's existing credit
   - sortOrder: 100 (default — coach can reorder later)
   - active: true
3. Delete the `gym/8RB/config/learnCards` document
4. Mark migration complete by writing `learnVideosMigrated: true` to `gym/8RB/config/main`

Migration runs once, silently, in the admin bootstrap.

### Security rules

```
match /gym/{gymId}/learnVideos/{videoId} {
  allow read: if isAuthenticated() && isVerified();
  allow write: if isCoach() && isVerified()
    && gymId == get(/databases/$(database)/documents/
       users/$(request.auth.uid)/profile/data).data.gym;
}
```

Deploy updated rules after implementation.

---

## ADMIN UI — LEARN CONTENT SECTION (COMPLETE REWRITE)

Replace the previous six-card editor entirely.

### Section header
- "LEARN CONTENT" — Bebas Neue 32px
- Subtitle: "Videos your members see in the LEARN tab." — DM Sans 13px --muted
- On the right: "+ ADD VIDEO" button (primary action)

### Video list

Videos grouped by topic. Each topic is a collapsible section:

```
▼ PUNCHES (3)
   ┌────────────────────────────────────────────┐
   │ The Jab                            [EDIT]  │
   │ Sort: 10  ·  Coach Darren           [X]    │
   └────────────────────────────────────────────┘
   ┌────────────────────────────────────────────┐
   │ The Cross                          [EDIT]  │
   │ Sort: 20  ·  Coach Darren           [X]    │
   └────────────────────────────────────────────┘
   ┌────────────────────────────────────────────┐
   │ Hooks and Uppercuts                [EDIT]  │
   │ Sort: 30  ·  Coach Darren           [X]    │
   └────────────────────────────────────────────┘

▼ DEFENCE (1)
   ┌────────────────────────────────────────────┐
   │ Slip and Roll                      [EDIT]  │
   │ Sort: 10                            [X]    │
   └────────────────────────────────────────────┘

▶ FOOTWORK (0)

▶ SHADOW BOXING (2)

▶ WRAPPING (1)

▶ COMBINATIONS (1)
```

Topic header:
- Chevron (▼ open / ▶ closed) + topic label (Bebas Neue 20px) + count of active videos in parentheses
- Tap to expand/collapse
- Default: all topics collapsed on first load
- State persists in localStorage (per topic id)

Empty topic:
- Shown with (0) count and grey styling
- Expanded state shows: "No videos yet. Tap + ADD VIDEO to add one." — DM Sans 13px --dim, centred

Video row:
- Background: `#141414`
- Border: 1px solid --border
- Border-radius: 8px
- Padding: 12px
- Margin-bottom: 6px
- Contents:
  - Left: Title (Bebas Neue 16px --text) + meta line "Sort: [n] · [credit]" (DM Sans 11px --dim)
  - Right: EDIT button (small, outline style) + DELETE button (small, red X icon)

Tapping EDIT opens the video editor modal (see below).
Tapping DELETE opens confirmation: "Delete '[video title]'? This cannot be undone." CANCEL / DELETE.
On confirm delete: remove document from Firestore, refresh list.

### + ADD VIDEO button behaviour

Opens the video editor modal in "new" mode (all fields blank, topic dropdown shown).

### VIDEO EDITOR MODAL

Full-screen or centred modal (whichever fits the existing admin design).

Header: "ADD VIDEO" or "EDIT VIDEO" depending on mode.
Close button (X) top right.

Form fields, in order:

**1. TOPIC**
Label: "TOPIC"
Dropdown/select showing all fixed topics (Punches, Defence, Footwork, Shadow Boxing, Wrapping, Combinations)
Required. Cannot be blank.
Default in edit mode: current topic. Default in new mode: blank with placeholder "Choose a topic".

**2. TITLE**
Label: "TITLE"
Input type: text
Max length: 60 characters
Required.
Placeholder: "e.g. The Jab — beginner"

**3. DESCRIPTION**
Label: "DESCRIPTION"
Textarea, min-height 100px
Max length: 400 characters
Character counter shown below: "[n]/400"
Optional but recommended.
Placeholder: "Coaching cue or short description of what the video covers."

**4. YOUTUBE URL**
Label: "YOUTUBE URL"
Input type: url
Full width, 44px height
Required.
Placeholder: "https://www.youtube.com/watch?v=..."
Helper text: "Paste any YouTube URL. Watch, embed, or share links all work."

**5. CREDIT**
Label: "CREDIT"
Input type: text
Max length: 60 characters
Optional.
Placeholder: "e.g. Coach Darren"

**6. SORT ORDER**
Label: "SORT ORDER"
Input type: number
Default: 100 in new mode, existing value in edit mode
Helper text: "Lower numbers appear first within the topic. Use gaps (10, 20, 30) for easy reordering."
Range: 0-9999
Optional.

### Modal action buttons

**PREVIEW VIDEO** (secondary, left)
Only enabled when URL field has a valid value.
On tap: opens a small player showing the embedded video.
If URL invalid: button disabled with tooltip "Enter a valid YouTube URL first".

**SAVE** (primary, right)
Text in new mode: "ADD VIDEO"
Text in edit mode: "SAVE CHANGES"
Disabled when: topic, title, or URL are blank OR URL is invalid.

On save:
1. Validate URL with `normaliseYouTubeUrl()` (existing helper from previous build — reuse)
2. If invalid: show error toast "Invalid YouTube URL", do not save
3. Write document to Firestore:
   - New mode: create new document in `gym/8RB/learnVideos`
   - Edit mode: update existing document with matching id
   - Set updatedAt and updatedBy on both create and edit
   - Set createdAt and createdBy on create only
4. Success toast: "Video added" or "Video saved"
5. Close modal, refresh video list

**CANCEL** (tertiary, right)
Closes modal without saving.
If form has unsaved changes: confirmation "Discard changes?" YES / CANCEL.

---

## MEMBER VIEW — LEARN TAB (COMPLETE REWRITE)

Replace the previous six-card layout with a topic-based browsable layout.

### Layout

At the top of the LEARN section, show topics as collapsible sections (same accordion pattern as admin, but member-facing styling):

```
▼ PUNCHES

  ┌──────────────────────────────────────┐
  │  THE JAB                             │
  │  Straight lead punch, keep it snap.  │
  │  ▶ Play                              │
  └──────────────────────────────────────┘
  ┌──────────────────────────────────────┐
  │  THE CROSS                           │
  │  Straight from the rear hand.        │
  │  ▶ Play                              │
  └──────────────────────────────────────┘

▶ DEFENCE

▶ FOOTWORK

▶ SHADOW BOXING

▶ WRAPPING

▶ COMBINATIONS
```

Topic header:
- Chevron + label (Bebas Neue 20px --text) + count if > 0
- Tap to expand/collapse
- Default: all collapsed
- Empty topics (count = 0): show topic header but expansion reveals empty state

Video card (member view, expanded state):
- Background: `#141414`
- Border-radius: 12px
- Padding: 16px
- Margin-bottom: 8px
- Contents:
  - Title — Bebas Neue 20px --text
  - Description — DM Sans 14px --muted, line-height 1.5
  - Video embed (16:9 iframe, embedded inline OR play button that expands the iframe on tap)
  - Credit line below embed — DM Sans 11px --dim, right-aligned

Sort videos within a topic by `sortOrder` ascending, then by `createdAt` ascending as tiebreaker.
Only show videos where `active: true`.

### Empty topic message
"No videos in this topic yet. Check back soon." — DM Sans 13px --muted, centred.

### Data loading

Load videos once on LEARN tab first open (or if cache is stale):
```javascript
async function loadLearnVideos() {
  try {
    var snap = await getDocs(
      query(collection(db, 'gym', '8RB', 'learnVideos'),
            where('active', '==', true))
    );
    userDataCache.learnVideos = snap.docs.map(function(d) {
      return Object.assign({ _firestoreId: d.id }, d.data());
    });
    userDataCache.learnVideosLoadedAt = Date.now();
  } catch(e) {
    console.warn('Failed to load LEARN videos:', e.message);
    if (!userDataCache.learnVideos) userDataCache.learnVideos = [];
  }
}
```

Cache expiry: refresh no more than every 5 minutes.

If Firestore read fails and cache is empty: show a "Unable to load videos. Check your connection." message. Do not fall back to hardcoded content — the previous six-card fallback is deleted along with this build.

Group videos in memory by topicId for rendering:
```javascript
function groupVideosByTopic(videos) {
  var grouped = {};
  LEARN_TOPICS.forEach(function(t) { grouped[t.id] = []; });
  videos.forEach(function(v) {
    if (grouped[v.topicId]) grouped[v.topicId].push(v);
  });
  Object.keys(grouped).forEach(function(k) {
    grouped[k].sort(function(a, b) {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
  });
  return grouped;
}
```

---

## SANITISATION

All video fields displayed via innerHTML must pass through `sanitise()` before rendering:
- title
- description
- credit

The URL is not sanitised (would break the URL) but is validated with `isSafeEmbedUrl()` before being inserted into iframe src. If invalid: show fallback "Video unavailable — coach has been notified" — DM Sans 12px --dim.

---

## OLD LEARN_CONTENT DATA IN data.js

Delete the `LEARN_CONTENT` array from data.js entirely. It is no longer used as fallback since videos come from Firestore.

If Firestore has zero videos (e.g. very early state before coach has added any), the LEARN tab shows:
"Your coach is setting up the video library. Check back soon." — DM Sans 14px --muted, centred in the LEARN section.

---

## FILES TO CHANGE

- `admin.html` — replace LEARN CONTENT section with new video library UI, add editor modal
- `box.js` — rewrite `renderLearnTab()` to use new topic-grouped layout
- `data.js` — delete `LEARN_CONTENT` array, add `LEARN_TOPICS` constant
- `app.js` — update loadUserData to fetch learnVideos, run migration on admin bootstrap
- `firestore.rules` — add rules for gym/{gymId}/learnVideos
- `styles.css` — add styles for accordion topic sections, video editor modal

---

## VERSION
Bump to 12.1.0 on completion.
Update CLAUDE.md:
- New Firestore collection: gym/8RB/learnVideos
- LEARN_CONTENT in data.js deprecated
- Fixed set of six topics, unlimited videos per topic
- Migration from old learnCards structure runs once

---

## TESTING CHECKLIST
1. Coach opens admin — LEARN CONTENT section shows six topics collapsed with counts
2. Migration ran silently and previous six cards now appear as videos under correct topics
3. Old learnCards document deleted from Firestore
4. Coach taps + ADD VIDEO — editor modal opens with all fields blank, topic dropdown shows six options
5. Coach fills all fields, pastes YouTube watch URL — URL normalises correctly on save
6. Coach saves new video — appears in the correct topic section
7. Coach taps EDIT on existing video — modal opens with current values, edits save correctly
8. Coach taps DELETE — confirmation shown, on confirm video removed from Firestore and UI
9. Coach taps PREVIEW VIDEO — embed plays inline in modal
10. Coach saves video with invalid URL (e.g. Vimeo) — error toast, save blocked
11. Member opens LEARN tab — all six topics visible, correct video counts shown
12. Member expands a topic — videos display in sortOrder ascending
13. Member expands empty topic — sees "No videos yet" message
14. Member sees credit line under each video
15. Firestore read failure — shows connection error, does not crash
16. Zero videos in Firestore — shows "Coach is setting up" message
17. Sort order changes reflect immediately in member view after coach saves
18. Run acorn on all JS files
19. Run Playwright suite — update tests that referenced old six-card LEARN layout
