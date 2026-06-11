# SGPT Pilot Features — Complete Requirements
## 8RB by 8 Rounds Boxing v11.0.0
## For Claude Code execution — no interpretation required

Read CLAUDE.md for project context, coding standards, colour system, 
and JS rules before starting. The requirements below are self-contained 
and do not depend on CLAUDE.md having SGPT content yet — CLAUDE.md 
will be updated as the final step of this build.

Work through all sections in order. Run acorn on all affected JS files 
after every section. Report completion of each section before moving 
to the next. Do not stop between sections unless a section fails.

---

## SECTION 1 — ROLE SYSTEM EXPANSION

### 1a. Firestore security rules update

Expand all role checks to support three roles: member, sgpt, coach.

Update firestore.rules with the following additions and changes:

```javascript
// Updated isCoach() — unchanged
function isCoach() {
  return isAuthenticated() && isVerified() &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)/profile/data)
      .data.role == 'coach';
}

// New helper
function isSgptOrCoach() {
  return isAuthenticated() && isVerified() &&
    (get(/databases/$(database)/documents/users/$(request.auth.uid)/profile/data)
      .data.role == 'sgpt' ||
     get(/databases/$(database)/documents/users/$(request.auth.uid)/profile/data)
      .data.role == 'coach');
}

// SGPT sessions — sgpt and coach can read, coach only can write
match /gym/{gymId}/sgptSessions/{sessionId} {
  allow read: if isSgptOrCoach();
  allow write: if isCoach() && isVerified()
    && gymId == get(/databases/$(database)/documents/
       users/$(request.auth.uid)/profile/data).data.gym;
}

// Assigned sessions — member reads own, member updates status only, coach reads/writes all
match /users/{userId}/assignedSessions/{sessionId} {
  allow read: if isAuthenticated() && isVerified() && isOwner(userId);
  allow create: if isCoach() && isVerified();
  allow update: if isAuthenticated() && isVerified() && isOwner(userId)
    && request.resource.data.diff(resource.data).affectedKeys()
        .hasOnly(['status', 'completedAt']);
  allow delete: if isCoach() && isVerified();
}

// Profile update — role field protection updated to allow coach to change member/sgpt roles
// The existing immutable role rule on self-update stays — coaches update OTHER users' roles
// via a separate admin write path that does not go through the user's own update rule.
// Coach can write to any user's profile/data document to update role field only:
match /users/{userId}/profile/data {
  // Existing rules stay unchanged for self-reads and self-updates
  // Add: coach can update role field on other users' profiles
  allow update: if isCoach() && isVerified()
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['role']);
}
```

Deploy updated rules to Firebase immediately after this section:
firebase deploy --only firestore:rules --project rb-boxing

### 1b. Profile creation — role field
In createUserProfile() and ensureUserProfile() in app.js:
Default role on creation remains 'member'. No changes needed — 
sgpt role is only assigned by coach via admin interface, never on signup.

---

## SECTION 2 — SESSION AUDIENCE SYSTEM

### 2a. data.js — audience field on all sessions

Add audience field to every session object in SESSIONS array in data.js:
- All existing sessions: add `audience: ['all']`
- New SGPT sessions below: `audience: ['sgpt']`

Add source field to all sessions:
- All existing sessions: `source: 'standard'`
- New SGPT sessions: `source: 'coach'`

Add active field to all sessions:
- All existing sessions: `active: true`
- New SGPT sessions: `active: true`

### 2b. data.js — SGPT placeholder sessions

Add the following three sessions to the SESSIONS array in data.js.
These are placeholder sessions for testing — real coach content 
will replace them when provided.

```javascript
{
  id: 'SGPT1',
  name: 'SGPT Upper A',
  cat: 'SGPT',
  category: 'upper',
  audience: ['sgpt'],
  source: 'coach',
  active: true,
  description: 'Coach-programmed upper body session',
  exercises: [
    { name: 'Barbell Bench Press', displayName: 'Barbell Bench Press', sets: 3, reps: 5, rest: 90 },
    { name: 'Barbell Row', displayName: 'Barbell Row', sets: 3, reps: 5, rest: 90 },
    { name: 'Overhead Press', displayName: 'Overhead Press', sets: 3, reps: 8, rest: 90 },
    { name: 'Weighted Pull-Up', displayName: 'Weighted Pull-Up', sets: 3, reps: 6, rest: 90 },
    { name: 'DB Hammer Curl', displayName: 'DB Hammer Curl', sets: 3, reps: 10, rest: 60 },
    { name: 'Overhead Tricep Extension', displayName: 'Overhead Tricep Extension', sets: 3, reps: 10, rest: 60 }
  ]
},
{
  id: 'SGPT2',
  name: 'SGPT Lower A',
  cat: 'SGPT',
  category: 'lower',
  audience: ['sgpt'],
  source: 'coach',
  active: true,
  description: 'Coach-programmed lower body session',
  exercises: [
    { name: 'Back Squat', displayName: 'Back Squat', sets: 3, reps: 5, rest: 120 },
    { name: 'Romanian Deadlift', displayName: 'Romanian Deadlift', sets: 3, reps: 8, rest: 90 },
    { name: 'Bulgarian Split Squat', displayName: 'Bulgarian Split Squat', sets: 3, reps: 8, rest: 90 },
    { name: 'KB Swing', displayName: 'KB Swing', sets: 3, reps: 15, rest: 60 },
    { name: 'Single Leg Glute Bridge', displayName: 'Single Leg Glute Bridge', sets: 3, reps: 12, rest: 60 }
  ]
},
{
  id: 'SGPT3',
  name: 'SGPT Conditioning',
  cat: 'SGPT',
  category: 'conditioning',
  audience: ['sgpt'],
  source: 'coach',
  active: true,
  description: 'Coach-programmed conditioning circuit',
  exercises: [
    { name: 'Burpee', displayName: 'Burpee', sets: 3, reps: 10, rest: 45 },
    { name: 'KB Swing', displayName: 'KB Swing', sets: 3, reps: 15, rest: 45 },
    { name: 'Mountain Climber', displayName: 'Mountain Climber', sets: 3, reps: 20, rest: 45 },
    { name: 'Squat Jump', displayName: 'Squat Jump', sets: 3, reps: 10, rest: 45 },
    { name: 'Push-Up', displayName: 'Push-Up', sets: 3, reps: 15, rest: 60 }
  ]
}
```

### 2c. train.js — session filtering by audience

Update renderLibrary() to filter sessions based on current user role.
Read role from userProfile (loaded in app.js after sign-in).

Filtering logic:
```javascript
function sessionVisibleToUser(session) {
  var role = (window.userProfile && window.userProfile.role) || 'member';
  if (role === 'coach') return true;
  if (role === 'sgpt') return session.audience.includes('all') || 
                              session.audience.includes('sgpt');
  return session.audience.includes('all');
}
```

Apply sessionVisibleToUser() when building the session library.
Sessions where active === false are never shown to members or sgpt.
Sessions where active === false ARE shown to coach (greyed out, 
with INACTIVE badge).

### 2d. TRAIN tab — SGPT section

Add SGPT section to TRAIN tab. Visible only to users with role 
sgpt or coach. Members with role member never see this section — 
not hidden, not locked, completely absent from the DOM.

Position: below standard session categories, above progression model.

Header:
- Label: "SGPT" — Bebas Neue 28px, colour --accent
- Subtext: "Your coach's programming" — DM Sans 13px --muted

Category filter tabs below header (horizontal scroll):
ALL / UPPER / LOWER / FULL / CONDITIONING / RECOVERY
Default selected: ALL
Tapping a tab filters the session list to that category.
ALL shows all active SGPT sessions.

Session cards: same style as existing session cards.
Sessions with active: false hidden from sgpt members.
Sessions with active: false shown to coach with INACTIVE badge 
and reduced opacity (0.5).

If no SGPT sessions exist yet: show placeholder card:
- Title: "Sessions coming soon"
- Subtext: "Your coach is setting up your programming."
- Style: same as empty state cards elsewhere in the app

---

## SECTION 3 — ASSIGNED SESSIONS INFRASTRUCTURE

### 3a. Firestore data structure

assignedSessions subcollection under each user:
```
users/{userId}/assignedSessions/{docId}
  sessionData: object — full session object copied at time of assignment
  sessionName: string — denormalised for easy display
  assignedBy: string — coach uid
  assignedAt: timestamp
  assignedFor: string — YYYY-MM-DD format
  status: 'pending' | 'completed' | 'expired'
  completedAt: timestamp (optional, set on completion)
```

### 3b. app.js — load assigned sessions

Add assignedSessions to loadUserData():
```javascript
var assignedSnap = await getDocs(
  collection(db, 'users', uid, 'assignedSessions')
);
userDataCache.assignedSessions = assignedSnap.docs.map(function(d) {
  return Object.assign({_firestoreId: d.id}, d.data());
});
```

Add assignedSessions: null to userDataCache object initialisation.

### 3c. app.js — expiry check on load

In showApp(), after loadUserData() completes, run expiry check:
```javascript
async function expireOldAssignedSessions(uid) {
  var cache = userDataCache.assignedSessions || [];
  var sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  var toExpire = cache.filter(function(s) {
    return s.status === 'pending' && 
           new Date(s.assignedFor) < sevenDaysAgo;
  });
  for (var i = 0; i < toExpire.length; i++) {
    try {
      await updateDoc(
        doc(db, 'users', uid, 'assignedSessions', toExpire[i]._firestoreId),
        { status: 'expired' }
      );
      toExpire[i].status = 'expired';
    } catch(e) {}
  }
}
```

Import updateDoc from firebase/firestore at top of app.js.

### 3d. TRAIN tab — ASSIGNED BY YOUR COACH section

Position: very top of TRAIN tab, above everything else including 
standard sessions and SGPT section.

Visibility: shown only when there is at least one assigned session 
where status === 'pending' AND assignedFor <= today's date (YYYY-MM-DD).
If no qualifying assigned sessions: section completely absent from DOM.

For each qualifying assigned session, show a card:
- Label: "ASSIGNED BY YOUR COACH" — DM Sans 10px uppercase 
  letter-spacing 2px colour --gold
- Session name: Bebas Neue 28px colour --text
- "For [formatted date]" — DM Sans 13px colour --muted
  If assignedFor === today: show "For today" not the date
  If assignedFor < today: show "For [date] — complete when ready"
- START SESSION button: full width, 56px height, red background, 
  Bebas Neue 20px

Multiple pending assigned sessions: show each as a separate card, 
ordered by assignedFor date ascending (oldest first).

On START SESSION tap:
1. Load the sessionData from the assigned session document
2. Open the normal log view with that session
3. Store the assignedSession _firestoreId in window.activeAssignedSessionId
4. On session save (saveSession() in train.js), after saving to 
   users/{uid}/sessions, also update the assigned session:
   - status: 'completed'
   - completedAt: serverTimestamp()
   - Clear window.activeAssignedSessionId

---

## SECTION 4 — COACH ADMIN EXPANSION

The existing /admin route already has coach notes. Add two new 
sections below it. Keep existing coach notes section unchanged.

### 4a. MEMBERS section

Header: "MEMBERS" — Bebas Neue 32px

On load: read all user profile documents from Firestore.
Query: getDocs(collectionGroup(db, 'profile')) — 
or iterate known user UIDs if collectionGroup is not available.
Alternative approach if collectionGroup unavailable: store a 
members registry at gym/8RB/members/{uid} with basic profile 
info, written when each member signs up. Use this for the admin list.

Note: implement whichever approach works with current security rules.
If using members registry, update ensureUserProfile() in app.js to 
also write to gym/8RB/members/{uid} with:
  displayName, email, joinDate, role
Update this registry document whenever role changes.

For each member show a card:
- Display name: Bebas Neue 20px
- Email: DM Sans 13px --muted
- Join date: DM Sans 12px --dim, formatted as "Joined [date]"
- Role badge: 
  MEMBER — grey background
  SGPT — gold background, dark text
  COACH — red background, white text
- Action button (right aligned):
  If role is member: "ASSIGN SGPT" button — gold border, gold text
  If role is sgpt: "REMOVE SGPT" button — border --border, --dim text
  If role is coach: no action button
  Coach cannot see action button on their own card

On ASSIGN SGPT tap:
- Write role: 'sgpt' to users/{uid}/profile/data
- Write role: 'sgpt' to gym/8RB/members/{uid} if registry exists
- Update badge immediately in UI
- Success toast: "SGPT access granted"
- Error toast: "Update failed — try again"

On REMOVE SGPT tap:
- Write role: 'member' to users/{uid}/profile/data
- Write role: 'member' to gym/8RB/members/{uid} if registry exists
- Update badge immediately in UI
- Success toast: "SGPT access removed"
- Error toast: "Update failed — try again"

Security enforced by Firestore rules — coach cannot change own role,
coach cannot demote another coach.

### 4b. ASSIGN SESSION section

Header: "ASSIGN SESSION" — Bebas Neue 32px

Form elements in order:

1. Session selector — dropdown
   Options: all SGPT sessions where active: true from data.js
   Format: "[session name] — [category]"
   Placeholder: "Select a session"

2. Date picker — labelled "FOR DATE"
   Default: today's date
   Minimum: today (cannot assign to the past)
   Format: YYYY-MM-DD

3. Send to toggle — two options:
   "ALL SGPT MEMBERS" (default) | "SPECIFIC MEMBERS"
   Toggle styled same as existing segmented controls in app

4. Member checklist — shown only when SPECIFIC MEMBERS selected
   Lists all users with role sgpt from the members registry
   Each row: checkbox + display name + email
   Minimum one member must be selected to enable ASSIGN button

5. ASSIGN button — full width, 56px, red background, Bebas Neue 20px
   Disabled until session selected and at least one recipient chosen
   On tap:
   - Determine recipient UIDs (all sgpt members or selected)
   - For each recipient, write to users/{uid}/assignedSessions:
     sessionData: full session object from data.js
     sessionName: session.name
     assignedBy: auth.currentUser.uid
     assignedAt: serverTimestamp()
     assignedFor: selected date string
     status: 'pending'
   - Success toast: "Session assigned to [n] members"
   - Error toast: "Assignment failed — try again"
   - Reset form after success

6. Assignment history table below form
   Header: "RECENT ASSIGNMENTS"
   Shows last 20 assignments across all members
   Read from members' assignedSessions subcollections
   Columns: MEMBER / SESSION / DATE / STATUS
   Status display:
     pending: grey clock icon + "Pending"
     completed: green tick + "Done [date]"
     expired: red X + "Expired"
   Sorted by assignedAt descending (most recent first)
   Refresh button to reload the history

---

## SECTION 5 — iOS GOOGLE SIGN-IN FLASH FIX

On iOS, signInWithRedirect sends the user to Google and back.
On return, the app briefly shows the sign-in form before 
auth state resolves, creating a visible flash.

Fix in app.js:

1. In handleGoogleSignIn(), before calling signInWithRedirect:
```javascript
sessionStorage.setItem('googleRedirectPending', '1');
```

2. At the very start of app initialisation (before onAuthStateChanged), 
   check for the flag:
```javascript
if (sessionStorage.getItem('googleRedirectPending')) {
  // Show loading screen immediately — don't show sign-in form
  showGoogleLoadingScreen();
}
```

3. Add showGoogleLoadingScreen() function:
```javascript
function showGoogleLoadingScreen() {
  var authEl = document.getElementById('auth-screen');
  var appEl = document.getElementById('app-content');
  if (appEl) appEl.style.display = 'none';
  if (authEl) {
    authEl.style.display = 'flex';
    authEl.innerHTML = 
      '<div style="display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;height:100%;gap:16px">' +
      '<img src="8RB.webp" style="width:80px;opacity:0.8;' +
      'animation:obBreathe 3s ease-in-out infinite">' +
      '<div style="font-family:\'DM Sans\',sans-serif;font-size:14px;' +
      'color:var(--muted)">Signing you in...</div>' +
      '</div>';
  }
}
```

4. After getRedirectResult() resolves (success or failure), 
   clear the flag:
```javascript
sessionStorage.removeItem('googleRedirectPending');
```

5. If getRedirectResult() returns no user and flag was set 
   (user cancelled or error), restore the normal sign-in screen:
```javascript
showSignInScreen();
```

---

## SECTION 6 — PLAYWRIGHT TEST UPDATES

Update existing Firebase mock to support role-based testing.

Add to firebase-auth.mock.js — a second mock user profile for sgpt:
```javascript
// Standard member mock (existing)
var memberProfile = { role: 'member', onboarded: true, ... };

// SGPT member mock (new)  
var sgptProfile = { role: 'sgpt', onboarded: true, ... };
```

Update tests/fixtures.js to support mockFirebaseAsSgpt() helper 
that uses the sgpt profile mock.

Add two new tests to tests/app.spec.js:

Test 11: SGPT member sees SGPT section in TRAIN tab
- Use mockFirebaseAsSgpt() fixture
- Navigate to TRAIN tab
- Assert SGPT section is visible in DOM
- Assert at least one SGPT session card is visible

Test 12: Standard member does not see SGPT section
- Use standard mockFirebase() fixture (role: member)
- Navigate to TRAIN tab  
- Assert SGPT section is NOT present in DOM

Also add:
Test 13: Assigned session appears at top of TRAIN tab
- Mock an assigned session in Firestore mock with 
  status: 'pending', assignedFor: today's date
- Assert "ASSIGNED BY YOUR COACH" section is visible
- Assert START SESSION button is present

Run full Playwright suite after updates.
All 13 tests must pass before proceeding to final steps.

---

## FINAL STEPS — run after all sections complete

1. Run acorn on ALL JS files:
   node -e "const acorn=require('acorn');const fs=require('fs');
   ['app.js','train.js','box.js','progress.js','data.js',
   'onboarding.js'].forEach(f=>{try{
   acorn.parse(fs.readFileSync(f,'utf8'),{ecmaVersion:2020,
   sourceType:'module'});console.log(f+' CLEAN');
   }catch(e){console.log(f+' ERROR:',e.message);}});"

2. Run full Playwright suite — all 13 tests must pass

3. Deploy updated Firestore rules:
   firebase deploy --only firestore:rules --project rb-boxing

4. Bump version to 11.0.0 in:
   - profile tab version string in app.js
   - settings panel version string in app.js

5. Update CLAUDE.md with the following additions:

   Under "Current Status": Version 11.0.0

   Add new section "Role System":
   Three roles: member, sgpt, coach
   - member: sees standard sessions only, no SGPT content
   - sgpt: sees standard + SGPT sessions, sees assigned sessions
   - coach: sees everything, accesses /admin
   Role assigned by coach in /admin Members section
   Default on signup: member
   Role field immutable by self — only coach can change other users roles

   Add new section "SGPT System":
   Sessions have audience: ['all'] or ['sgpt'] field
   SGPT sessions also have: source: 'coach', active: true/false, 
   category: upper/lower/full/conditioning/recovery
   Filtering in renderLibrary() via sessionVisibleToUser()
   
   Add new section "Assigned Sessions":
   Firestore path: users/{uid}/assignedSessions/{docId}
   Fields: sessionData, sessionName, assignedBy, assignedAt, 
           assignedFor (YYYY-MM-DD), status, completedAt
   Expiry: pending sessions older than 7 days auto-expire on app load
   Completion: status updates to completed when session is saved

   Add to backlog:
   - Dynamic SGPT sessions from Firestore (currently hardcoded in data.js)
   - Individual session notes from coach per assignment
   - Member completion analytics for coach
   - Firebase App Check (bot/spam protection)
   - Shared Firebase admin email setup

6. Commit and push:
   git add -A
   git commit -m "SGPT pilot features v11.0.0"
   git push origin main

---

## TESTING CHECKLIST — verify manually after push

1. Sign in as standard member — SGPT section absent from TRAIN tab
2. Sign in as coach — SGPT section visible, all three placeholder sessions show
3. Coach assigns SGPT role to a test member in /admin
4. Sign in as that member — SGPT section now visible
5. Coach assigns a session to that member for today
6. Member sees "ASSIGNED BY YOUR COACH" at top of TRAIN tab
7. Member taps START SESSION — log view opens with assigned session
8. Member saves session — assigned session status updates to completed
9. "ASSIGNED BY YOUR COACH" section disappears after completion
10. Coach sees completed status in assignment history
11. iOS: Google sign-in shows loading screen not sign-in flash
12. All 13 Playwright tests pass
