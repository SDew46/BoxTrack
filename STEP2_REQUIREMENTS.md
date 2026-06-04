# Step 2 Requirements — Firebase Backend
## 8RB by 8 Rounds Boxing
## For Claude Code execution — no interpretation required

This document covers the complete Firebase implementation for Step 2. Read entirely before starting. No Firebase code should be written until this document is confirmed correct by Steve.

---

## OVERVIEW

Step 2 adds:
1. Firebase Authentication — Google sign-in and email/password
2. Firestore database — cloud storage replacing localStorage
3. Offline persistence — app works without signal, syncs when connected
4. User profiles and roles — member vs coach
5. Admin route — /admin protected by coach role
6. Coach's Notes POC — first piece of dynamic coach-managed content
7. Account deletion — GDPR self-service

Nothing visible changes for a member except: they now sign in, their data follows them across devices, and they can delete their account.

---

## FIREBASE PROJECT SETUP

### Project configuration
- Project name: 8rb-boxing
- Project ID: 8rb-boxing (or 8rb-boxing-app if taken)
- Default GCP region: europe-west2 (London — closest to Streatham)
- Firestore database: Native mode, region europe-west2
- Authentication: enabled
- Hosting: not required — continue using GitHub Pages

### Firebase config object
Steve creates the Firebase project in the Firebase console and provides the config object. Claude Code adds it to a new file `firebase.js` in the project root:

```javascript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

const firebaseConfig = {
  // Steve provides these values from Firebase console
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Enable offline persistence
enableIndexedDbPersistence(db).catch(err => {
  if (err.code === 'failed-precondition') {
    console.warn('Offline persistence unavailable: multiple tabs open');
  } else if (err.code === 'unimplemented') {
    console.warn('Offline persistence not supported in this browser');
  }
});
```

### Firebase SDK
Use Firebase v9+ modular SDK via CDN import map in index.html. No npm build step — keep the no-build-tool approach:

```html
<script type="importmap">
{
  "imports": {
    "firebase/app": "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js",
    "firebase/auth": "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js",
    "firebase/firestore": "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js"
  }
}
</script>
```

All existing JS files become `type="module"` scripts. firebase.js exports auth and db.

---

## AUTHENTICATION

### Sign-in methods enabled in Firebase console
- Google sign-in: enabled
- Email/password: enabled
- Email verification: required before app access

### Auth flow — new user (email/password)
1. Sign-up screen: display name, email, password (min 8 chars), confirm password
2. Firebase creates Auth record
3. Verification email sent automatically
4. App shows: "Check your email. We've sent a verification link to [email]."
5. RESEND EMAIL button available
6. On verification confirmed: profile document created in Firestore, proceed to onboarding

### Auth flow — new user (Google)
1. Google OAuth popup
2. Firebase creates Auth record
3. No email verification needed — Google account already verified
4. Profile document created in Firestore
5. If first time: proceed to onboarding
6. If returning: proceed to app

### Auth flow — returning user
1. Firebase session persists — user stays signed in indefinitely
2. On app open: check auth state silently
3. If signed in: load app normally
4. If not signed in: show sign-in screen

### Auth flow — sign out
- Sign out option in settings overlay
- On sign out: clear local state, show sign-in screen
- Do NOT clear localStorage data during sign out — keep as fallback

### Sign-in screen design
Full screen. 8RB logo centred, 80px. Below:

- "WELCOME BACK" — Bebas Neue 48px, white
- "8RB by 8 Rounds Boxing" — DM Sans 13px `--muted`
- Google sign-in button — full width, 56px, white background, Google logo + "Continue with Google", DM Sans 14px dark text
- Divider: "or" in `--dim`
- Email input: DM Sans 16px, 56px height, placeholder "Email address"
- Password input: DM Sans 16px, 56px height, placeholder "Password", show/hide toggle
- SIGN IN button: full width, 56px, red background, Bebas Neue 20px
- "Forgot password?" link: DM Sans 13px `--dim`, triggers Firebase password reset email
- "New to 8RB? Create account" link: switches to sign-up form
- "BOXING FOR EVERYONE" — DM Sans 11px uppercase `--dim`, bottom of screen

### Sign-up screen design
Same as sign-in but with:
- Display name input (first)
- Email, password, confirm password
- "CREATE ACCOUNT" button
- "Already have an account? Sign in" link
- Terms line: "By creating an account you agree to our terms of service." DM Sans 11px `--dim`

### Password reset
Firebase handles entirely. "Forgot password?" triggers `sendPasswordResetEmail()`. Show: "Reset link sent to [email]." No custom UI needed.

---

## FIRESTORE DATA STRUCTURE

### User documents
```
users/
  {userId}/
    profile (document):
      displayName: string
      email: string
      gym: "8RB"
      role: "member" | "coach"
      joinDate: timestamp
      unit: "kg" | "lbs"
      accentColour: string
      onboarded: boolean

    sessions/ (subcollection):
      {sessionId} (document):
        date: string (YYYY-MM-DD)
        sessionId: string (GU1, TD1 etc.)
        sessionName: string
        sessionCat: string
        duration: number (minutes)
        notes: string
        exercises: array [
          {
            name: string,
            setType: string,
            sets: array [{reps, kg, completed}]
          }
        ]
        createdAt: timestamp

    boxingSessions/ (subcollection):
      {sessionId} (document):
        date: string
        rounds: number
        roundDurationMins: number
        restDurationSecs: number
        totalMins: number
        createdAt: timestamp

    customCombos/ (subcollection):
      {comboId} (document):
        name: string
        sequence: array
        createdAt: timestamp

    customSessions/ (subcollection):
      {sessionId} (document):
        name: string
        sessionType: string
        exercises: array
        createdAt: timestamp
```

### Gym documents
```
gym/
  8RB/ (document):
    config (document):
      coachNotes: string
      coachNotesUpdatedAt: timestamp
      coachNotesUpdatedBy: string
      comboOfTheWeek: {name, sequence, cue}
      appName: "8RB by 8 Rounds Boxing"

    announcements/ (subcollection):
      {announcementId} (document):
        text: string
        createdAt: timestamp
        createdBy: string
```

---

## SECURITY RULES

Deploy these rules exactly. No deviation.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return request.auth.uid == userId;
    }

    function isCoach() {
      return isAuthenticated() &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)/profile)
          .data.role == 'coach';
    }

    function isVerified() {
      return request.auth.token.email_verified == true;
    }

    // User profile — field-level protection
    match /users/{userId}/profile {
      allow read: if isAuthenticated() && isOwner(userId);

      // On creation: role must be member, gym must be 8RB
      allow create: if isAuthenticated()
        && isOwner(userId)
        && isVerified()
        && request.resource.data.role == 'member'
        && request.resource.data.gym == '8RB';

      // On update: role, gym, joinDate are immutable
      allow update: if isAuthenticated()
        && isOwner(userId)
        && isVerified()
        && !request.resource.data.diff(resource.data)
            .affectedKeys()
            .hasAny(['role', 'gym', 'joinDate']);
    }

    // User subcollections — owner only
    match /users/{userId}/sessions/{sessionId} {
      allow read, write: if isAuthenticated()
        && isOwner(userId)
        && isVerified();
    }

    match /users/{userId}/boxingSessions/{sessionId} {
      allow read, write: if isAuthenticated()
        && isOwner(userId)
        && isVerified();
    }

    match /users/{userId}/customCombos/{comboId} {
      allow read, write: if isAuthenticated()
        && isOwner(userId)
        && isVerified();
    }

    match /users/{userId}/customSessions/{sessionId} {
      allow read, write: if isAuthenticated()
        && isOwner(userId)
        && isVerified();
    }

    // Gym config — all verified members read, coach only write
    match /gym/{gymId}/config {
      allow read: if isAuthenticated() && isVerified();
      allow write: if isCoach() && isVerified();
    }

    // Announcements — all verified members read, coach only write
    match /gym/{gymId}/announcements/{announcementId} {
      allow read: if isAuthenticated() && isVerified();
      allow write: if isCoach() && isVerified();
    }

    // Deny everything else explicitly
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### Important — coach role assignment
The coach role is NEVER set through the app. It is set manually in the Firebase console by Steve:
1. Coach creates account normally (gets role: "member" automatically)
2. Steve goes to Firebase console → Firestore → users → coach's userId → profile document
3. Steve manually changes role field from "member" to "coach"
4. Done — coach now has admin access

This is the only way to elevate a role. The security rules make it impossible to do through the app.

---

## OFFLINE PERSISTENCE

Firebase IndexedDB persistence enabled in firebase.js (see above).

### Behaviour when offline
- All reads served from local cache
- All writes queued locally and synced automatically when connection returns
- App shows no error — behaves identically to online

### Offline indicator
A subtle indicator when offline — not an error, just information:
- Small dot in header: grey when offline, invisible when online
- Tooltip on tap: "You're offline. Changes will sync when connected."
- Do not block any functionality when offline

### Conflict resolution
Firebase last-write-wins by default. For workout sessions this is acceptable — a member is unlikely to log the same session simultaneously on two devices. Document this assumption in CLAUDE.md.

---

## DATA MIGRATION — localStorage to Firestore

When a member signs in for the first time on a device that has existing localStorage data:

1. Detect existing localStorage session data
2. Show one-time prompt: "We found existing session data on this device. Import it to your account?" YES / NO
3. If YES: migrate sessions, boxing sessions, custom combos, custom sessions to Firestore
4. If NO: leave localStorage data, proceed without migrating
5. After migration attempt (success or failure): clear localStorage data
6. Show result: "X sessions imported successfully" or "Import failed — your data is still on this device"

Migration runs once per device. Store migration status in localStorage: `migrationComplete: true`

---

## ADMIN ROUTE — /admin

### Access
URL: `{github-pages-url}/admin` or `{github-pages-url}/#/admin`

### Auth check on load
1. Check Firebase auth state
2. If not signed in: redirect to sign-in screen with return URL
3. If signed in but role !== "coach": redirect to main app with toast "Access denied"
4. If signed in and role === "coach": load admin UI

### Admin UI — Step 2 scope (Coach's Notes POC only)

Header:
- "8RB ADMIN" — Bebas Neue 36px
- Signed in as: [coach display name] — DM Sans 13px `--muted`
- SIGN OUT button — top right

Single section: COACH'S NOTES

```
COACH'S NOTES
─────────────────────────────
[Large textarea — current content pre-loaded]
[Character count: X / 1000]

Last updated: [date] by [name]

[ SAVE CHANGES ]
```

- Textarea: DM Sans 15px, min-height 200px, border `--border`, background `#1e1e1e`
- Character limit: 1000
- SAVE CHANGES: full width, 56px, red background, Bebas Neue 20px
- On save: write to `gym/8RB/config.coachNotes`, update `coachNotesUpdatedAt` and `coachNotesUpdatedBy`
- Success toast: "COACH'S NOTES UPDATED"
- Error toast: "SAVE FAILED — TRY AGAIN"

### How members see coach's notes
In the TRAIN tab, the existing Coach's Notes section reads from `gym/8RB/config.coachNotes` instead of hardcoded content. Falls back to hardcoded content if Firestore read fails.

---

## ACCOUNT DELETION — GDPR

In settings overlay, under Data section:

New row: "Delete Account" — label in red, subtext "Permanently deletes your account and all data. Cannot be undone."

DELETE ACCOUNT button — red border, red text, NOT filled (to distinguish from primary actions).

On tap — confirmation modal:
- Title: "DELETE YOUR ACCOUNT"
- Body: "This will permanently delete your account, all session logs, progress data, and custom content. This cannot be undone."
- Two buttons: CANCEL (outline) / DELETE EVERYTHING (red filled)

On confirm:
1. Delete all Firestore subcollections under users/{userId}
2. Delete users/{userId}/profile document
3. Delete Firebase Auth record
4. Clear localStorage
5. Show sign-in screen with message: "Your account has been deleted."

Note: Firestore does not automatically delete subcollections when a parent document is deleted. Each subcollection must be deleted explicitly. Use a batched write to delete all documents.

---

## STEP 3 SECURITY BACKLOG
Add to CLAUDE.md — do not implement in Step 2:

- MFA for coach account (TOTP via Google Authenticator/Authy, SMS, WhatsApp)
- Optional MFA for members who want extra security
- Optional biometric prompt on app open for members
- Admin activity logging (who changed what and when)
- Login anomaly detection

MFA note for Step 3: Firebase supports multiple simultaneous MFA factors. Coach should be required to register minimum two factors (TOTP as primary, SMS as backup). SMS MFA is a paid Firebase feature — negligible cost at one coach account.

---

## APP.JS CHANGES

### Auth state listener
Add to app.js init:

```javascript
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase.js';

onAuthStateChanged(auth, user => {
  if (user && user.emailVerified) {
    // User signed in and verified
    loadUserProfile(user.uid).then(() => {
      showApp();
    });
  } else if (user && !user.emailVerified) {
    // Signed in but not verified
    showEmailVerificationScreen(user.email);
  } else {
    // Not signed in
    showSignInScreen();
  }
});
```

### Profile loading
On sign-in, load user profile from Firestore and merge with localStorage settings:
- Unit preference
- Accent colour
- Onboarded status

### Graceful degradation
If Firebase is unavailable (network error on initial load): fall back to localStorage mode with toast "Running in offline mode. Sign in when connected to sync your data."

---

## TRAIN.JS / BOX.JS / PROGRESS.JS CHANGES

All localStorage reads and writes for session data must be updated to read/write Firestore instead. The localStorage functions `ld()` and `sv()` remain for non-session data (settings, preferences) but session-related storage moves to Firestore.

Specifically:
- `saveSession()` in train.js — write to Firestore sessions subcollection
- `saveBoxingClass()` in train.js — write to Firestore boxingSessions subcollection  
- `saveCustomCombo()` in box.js — write to Firestore customCombos subcollection
- `saveCustomSess()` in train.js — write to Firestore customSessions subcollection
- All history reads in progress.js — read from Firestore instead of localStorage

---

## CLAUDE.MD UPDATES REQUIRED

After Step 2 completion, update CLAUDE.md with:
- New file: firebase.js
- Firebase project ID
- Firestore region: europe-west2
- Coach role assignment process (manual via console)
- Step 3 security backlog items
- Conflict resolution assumption documented
- Admin route URL

---

## VERSION
Bump to 10.0.0 on completion of Step 2.

---

## TESTING CHECKLIST
Before pushing Step 2:
1. Sign up with email/password — verify email flow works
2. Sign up with Google — profile created correctly in Firestore
3. Sign in returning user — data loads correctly
4. Log a session — appears in Firestore console
5. Log session offline — appears after reconnect
6. Coach role — set manually in console, verify admin route accessible
7. Member tries /admin — verify redirect occurs
8. Coach's notes — update in admin, verify appears in TRAIN tab
9. Account deletion — verify all Firestore data deleted, Auth record deleted
10. Security rules — verify member cannot read another member's data
11. Run acorn on all JS files
12. Test on mobile Chrome incognito
