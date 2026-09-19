# LEARN Content Admin Editor Requirements
## 8RB by 8 Rounds Boxing
## For Claude Code execution — no interpretation required

---

## OVERVIEW

Allow the coach to edit the six LEARN cards (title, coaching cue, YouTube URL, credit line) via the /admin route. Members see the coach's chosen videos and text instead of the hardcoded YouTube tutorials currently in data.js.

Videos are hosted on the coach's YouTube channel as unlisted videos. The coach copies the YouTube URL, pastes it into the admin form, and saves. No file uploads, no video hosting infrastructure.

Content is stored in Firestore at `gym/8RB/config/learnCards`. The LEARN tab in BOX reads from Firestore first, falls back to hardcoded data.js content if the Firestore read fails or the document does not exist.

---

## THE SIX LEARN CARDS

The existing six cards (from data.js LEARN_CONTENT) are:
1. Punches
2. Defence
3. Footwork
4. Shadow Boxing
5. Wrapping
6. Combinations

Each card has: title, coaching cue, YouTube embed URL, credit line.
The coach can edit all four fields per card.
The order of the cards is fixed — cannot be reordered.

---

## FIRESTORE DATA STRUCTURE

Document path: `gym/8RB/config/learnCards`

Document structure:
```javascript
{
  cards: [
    {
      id: 'punches',
      title: 'The Punches',
      cue: '...',
      url: 'https://www.youtube.com/embed/VIDEO_ID',
      credit: 'Coach Darren'
    },
    {
      id: 'defence',
      title: 'Defence',
      cue: '...',
      url: '...',
      credit: '...'
    },
    // ... four more
  ],
  updatedAt: timestamp,
  updatedBy: string (coach uid)
}
```

The `id` field is fixed per card and cannot be changed by the coach. It maps to the position in the LEARN tab layout.

---

## FIRESTORE SECURITY RULES

The existing rule for `gym/{gymId}/config` already allows coach write and all authenticated verified users to read. No new rule needed — the learnCards document sits under config and inherits the existing permissions.

Confirm the following rule is in place (from Step 2 requirements). If missing, add it:

```javascript
match /gym/{gymId}/config/{docId} {
  allow read: if isAuthenticated() && isVerified();
  allow write: if isCoach() && isVerified()
    && gymId == get(/databases/$(database)/documents/
       users/$(request.auth.uid)/profile/data).data.gym;
}
```

Deploy any rule changes if needed.

---

## URL VALIDATION

The `isSafeEmbedUrl()` function already exists in app.js. Use it to validate every URL before saving.

```javascript
function isSafeEmbedUrl(url) {
  return typeof url === 'string' &&
    url.startsWith('https://www.youtube.com/embed/');
}
```

The coach will paste a normal YouTube URL, not an embed URL. Add a helper to convert:

```javascript
function normaliseYouTubeUrl(url) {
  if (!url || typeof url !== 'string') return '';
  url = url.trim();
  // Already in embed format
  if (url.startsWith('https://www.youtube.com/embed/')) return url;
  // Standard watch URL: https://www.youtube.com/watch?v=VIDEO_ID
  var watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return 'https://www.youtube.com/embed/' + watchMatch[1];
  // Short URL: https://youtu.be/VIDEO_ID
  var shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return 'https://www.youtube.com/embed/' + shortMatch[1];
  return ''; // invalid or unrecognised
}
```

On save, run every URL through `normaliseYouTubeUrl()`. If the result is empty string, reject the save with an error message identifying which card has the invalid URL.

---

## ADMIN UI — LEARN CONTENT SECTION

Add a new section to the existing /admin route below the current sections (Coach Notes, Members, Session Builder, Assign Session, Assignment History).

### Section header
Label: "LEARN CONTENT"
Subtitle: "Edit the technique videos and coaching cues members see in the LEARN tab."
Style: same as other admin section headers.

### On section load
Read the current learnCards document from Firestore.
If document exists: populate form fields with existing values.
If document does not exist: populate form fields with the hardcoded defaults from data.js LEARN_CONTENT.
Show loading spinner while reading.

### Layout
Six card editor blocks, one per LEARN card. Each block is a distinct container with a subtle border to visually separate.

Container styling:
- Background: `#141414`
- Border: 1px solid `--border`
- Border-radius: 12px
- Padding: 20px
- Margin-bottom: 16px

### Each card editor block contains:

**1. Card position label**
Label: "1. PUNCHES" (or the appropriate card ID, formatted as position + fixed name)
Font: DM Sans, 11px, font-weight 700, uppercase, letter-spacing 2px, colour `--gold`
Margin-bottom: 12px

The position label is fixed — the coach cannot change which slot a card lives in.

**2. Title input**
Label: "TITLE"
Input type: text
Max length: 40 characters
Full width, 44px height
Placeholder: existing default from data.js

**3. Coaching cue textarea**
Label: "COACHING CUE"
Textarea, min-height 100px
Max length: 400 characters
Character counter shown below: "[n]/400"
Placeholder: existing default from data.js

**4. YouTube URL input**
Label: "YOUTUBE URL"
Input type: url
Full width, 44px height
Placeholder: "https://www.youtube.com/watch?v=..."
Helper text below input: "Paste any YouTube URL. Watch, embed, or share links all work."

**5. Credit line input**
Label: "CREDIT"
Input type: text
Max length: 60 characters
Full width, 44px height
Placeholder: "e.g. Coach Darren"

**6. Preview button (optional but useful)**
Text: "PREVIEW VIDEO"
Small button, right aligned within the block
On tap: opens a modal showing the YouTube embed with the current URL from the form field
This lets the coach verify the URL before saving.
If URL field is empty or invalid: button disabled and shows tooltip "Enter a valid YouTube URL first"

### Save controls at bottom of section

**SAVE ALL CHANGES button**
Position: below the six card blocks, full width
Height: 56px
Background: `--accent` red
Text: "SAVE ALL CHANGES" — Bebas Neue 20px, letter-spacing 2px, white
Disabled state: greyed out, when no changes have been made or when any URL is invalid

**Change indicator**
Show a small badge on any card block that has unsaved changes.
Badge text: "UNSAVED"
Badge style: `--gold` background, dark text, 10px font, padding 2px 6px, border-radius 4px
Position: top right of card block

**On save**
1. Validate all six URLs via `normaliseYouTubeUrl()`
2. If any URL is invalid: show error toast identifying which card, do not save
3. If all URLs valid: normalise them all and write to Firestore at `gym/8RB/config/learnCards` with:
   - cards: array of six objects (id, title, cue, url, credit)
   - updatedAt: serverTimestamp()
   - updatedBy: auth.currentUser.uid
4. On success: toast "LEARN content updated", clear unsaved change indicators
5. On error: toast "Save failed — try again", keep form state intact

**Discard button**
Position: next to SAVE button, but smaller, secondary style
Text: "DISCARD CHANGES"
Only visible when there are unsaved changes
On tap: confirmation "Discard all changes since last save?" YES / CANCEL
On confirm: re-read from Firestore and reset form fields

---

## LEARN TAB — READ FROM FIRESTORE

Update `renderLearnTab()` in box.js to read learn card content from Firestore instead of data.js.

### On BOX tab load (or LEARN section load)

```javascript
async function loadLearnCards() {
  try {
    var docRef = doc(db, 'gym', '8RB', 'config', 'learnCards');
    var snap = await getDoc(docRef);
    if (snap.exists()) {
      var data = snap.data();
      if (data.cards && Array.isArray(data.cards) && data.cards.length === 6) {
        return data.cards;
      }
    }
  } catch(e) {
    console.warn('Failed to load LEARN cards from Firestore:', e.message);
  }
  // Fallback to hardcoded content
  return LEARN_CONTENT;
}
```

Cache the loaded cards in `userDataCache.learnCards` alongside other cached data.

Cache expiry: refresh from Firestore no more than every 5 minutes. Store `lastLearnCardsRead` timestamp and only re-read if more than 5 minutes have passed.

### Rendering
The existing renderLearnTab() rendering logic stays the same — it just reads from `userDataCache.learnCards` (or the fallback) instead of hardcoded LEARN_CONTENT.

Every field is passed through `sanitise()` before being inserted into innerHTML — same XSS protection pattern used elsewhere.

Video embed URL is not sanitised (would break the URL) but is validated with `isSafeEmbedUrl()` before being inserted into the iframe src. If invalid, show the existing "Video unavailable" fallback instead of the iframe.

---

## FALLBACK BEHAVIOUR

If Firestore read fails or the document does not exist yet:
- Fall back to `LEARN_CONTENT` from data.js (existing hardcoded content)
- Do not show an error to the user
- Log warning to console for developer visibility

If a single card in the Firestore data has an invalid URL:
- Show that specific card with the "Video unavailable" fallback message
- Other cards continue to work normally
- Do not fail the entire LEARN tab

---

## OFFLINE BEHAVIOUR

Firestore offline persistence (already enabled) handles this automatically.
The learn cards document is cached locally on first successful read.
Subsequent loads while offline serve from cache.
Coach cannot save while offline — save button shows toast "You're offline — changes will save when connected" and queues the write.

---

## ACCESSIBILITY

- All form inputs have proper `<label>` elements with `for` attributes
- Save and discard buttons have `aria-label` describing action
- Character counter uses `aria-live="polite"` to announce updates
- Preview modal traps focus and returns focus on close
- Every YouTube embed iframe has `aria-label="Technique video for [card title]"`

---

## VERSION
Bump to 11.4.0 on completion.
Update CLAUDE.md with:
- New Firestore path: gym/8RB/config/learnCards
- LEARN tab now reads from Firestore with fallback to data.js
- Coach can edit LEARN content via admin

---

## TESTING CHECKLIST
1. Coach opens admin — LEARN CONTENT section loads with hardcoded defaults on first visit
2. Coach edits a title, coaching cue, URL, and credit — UNSAVED badge appears on that card
3. Coach pastes a standard YouTube watch URL — SAVE button becomes enabled
4. Coach pastes an invalid URL (e.g. Vimeo) — SAVE button disabled, error indication on the card
5. Coach clicks PREVIEW VIDEO — modal opens with embed playing correctly
6. Coach clicks SAVE ALL CHANGES — toast confirms, changes persist after page reload
7. Coach opens app as member (or different account) — new videos and text appear in LEARN tab
8. Member opens LEARN tab offline — cached content displays correctly
9. Member with Firestore document missing — falls back to hardcoded data.js content
10. Coach clicks DISCARD CHANGES — confirmation shown, form resets to last saved state
11. Coach pastes short YouTube URL (youtu.be/ID) — normalised correctly, saves successfully
12. Run acorn on all affected files
13. Run Playwright suite — all existing tests still pass
