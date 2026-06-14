# 8RB iOS Dead Button — Diagnostic Fix Spec

**Target version:** 11.4.0
**Type:** Diagnostic + defensive. Root-cause fix follows once we capture the toast text on iOS.

## Background

On iOS (PWA installed from Safari), tapping START SESSION on SGPT or assigned-by-coach sessions does nothing — the button is dead. Same device, FREE TRAIN session buttons work fine. Persists across full PWA close/reopen. Root cause is unknown.

Both `useSgptSession` and `startAssignedSession` contain `if(!sess) return;` patterns that silently fail with no UI feedback. This spec replaces those silent returns with explicit toasts and console logs so the failure mode is observable, and adds a global error listener to catch any inline-onclick errors.

## Files to modify

- `train.js` — replace two functions
- `app.js` — add global error listeners, bump version string
- `CLAUDE.md` — update Current Status line

## Change 1 — `train.js`: replace `useSgptSession`

Locate the existing `useSgptSession` function (around line 117). Replace the entire function with:

```js
function useSgptSession(firestoreId){
  try {
    if(!firestoreId){
      console.error('[8RB SGPT] useSgptSession called with empty firestoreId');
      toast('Session ID missing — please refresh',true);
      return;
    }
    var all=userDataCache.sgptSessions||[];
    console.log('[8RB SGPT] useSgptSession id='+firestoreId+' cache='+all.length);
    var sess=all.find(function(s){return s._firestoreId===firestoreId;});
    if(!sess){
      var ids=all.map(function(s){return s._firestoreId||'NONE';}).join(',');
      console.error('[8RB SGPT] Session not found. id='+firestoreId+' available=['+ids+']');
      toast('Session not found — please refresh',true);
      return;
    }
    window.activeLogSession={
      id:firestoreId,
      cat:'SGPT',
      name:sess.name,
      custom:false,
      warmup:[],
      exercises:(sess.exercises||[]).map(function(ex){
        return Object.assign({},ex,{scheme:ex.scheme||(ex.sets+'×'+ex.reps),displayName:ex.displayName||ex.name,swapped:false});
      })
    };
    sv('activeLogSession',window.activeLogSession);
    restTimers={};sessionStartTime=null;setTypeState={};clearInterval(durInterval);
    showLogView();
  } catch(err) {
    console.error('[8RB SGPT] useSgptSession failed:',err);
    toast('Failed to start: '+(err.message||'unknown error'),true);
  }
}
```

The `window.useSgptSession=useSgptSession;` line that follows this function must remain unchanged.

## Change 2 — `train.js`: replace `startAssignedSession`

Locate the existing `startAssignedSession` function (around line 181). Replace the entire function with:

```js
function startAssignedSession(firestoreId){
  try {
    if(!firestoreId){
      console.error('[8RB ASSIGN] startAssignedSession called with empty firestoreId');
      toast('Assignment ID missing — please refresh',true);
      return;
    }
    var all=userDataCache.assignedSessions||[];
    console.log('[8RB ASSIGN] startAssignedSession id='+firestoreId+' cache='+all.length);
    var s=all.find(function(a){return a._firestoreId===firestoreId;});
    if(!s){
      var ids=all.map(function(a){return a._firestoreId||'NONE';}).join(',');
      console.error('[8RB ASSIGN] Assignment not found. id='+firestoreId+' available=['+ids+']');
      toast('Assigned session not found — please refresh',true);
      return;
    }
    if(!s.sessionData){
      console.error('[8RB ASSIGN] sessionData missing. id='+firestoreId+' keys=['+Object.keys(s).join(',')+']');
      toast('Session data missing — contact your coach',true);
      return;
    }
    window.activeAssignedSessionId=firestoreId;
    var sd=s.sessionData;
    window.activeLogSession={
      id:sd.id||'assigned-'+firestoreId,
      cat:sd.cat||'SGPT',
      name:s.sessionName||sd.name||'Assigned Session',
      custom:false,
      warmup:sd.warmup||[],
      exercises:(sd.exercises||[]).map(function(ex){
        return Object.assign({},ex,{
          scheme:ex.scheme||(ex.sets+'×'+ex.reps),
          displayName:ex.displayName||ex.name,
          swapped:false
        });
      })
    };
    sv('activeLogSession',window.activeLogSession);
    restTimers={};sessionStartTime=null;setTypeState={};clearInterval(durInterval);
    showLogView();
  } catch(err) {
    console.error('[8RB ASSIGN] startAssignedSession failed:',err);
    toast('Failed to start: '+(err.message||'unknown error'),true);
  }
}
```

## Change 3 — `app.js`: add global error listeners

Add these two listeners early in `app.js`, after the import statements and before any other top-level code. They catch errors from inline `onclick` handlers and unhandled promise rejections, which currently fail silently on iOS Safari.

```js
window.addEventListener('error', function(e) {
  console.error('[8RB GLOBAL ERROR]', e.message, 'at', (e.filename||'?')+':'+(e.lineno||'?')+':'+(e.colno||'?'), e.error);
});
window.addEventListener('unhandledrejection', function(e) {
  console.error('[8RB UNHANDLED REJECTION]', e.reason);
});
```

No `toast` call here — these are diagnostic logs only. We don't want every minor warning showing as a user-facing error.

## Change 4 — `app.js`: version bump

In `app.js`, find the version string in both `renderSettingsPanel()` and `renderProfile()` and update from `11.3.0` to `11.4.0`. Both must match.

## Change 5 — `CLAUDE.md`: update Current Status

Change the Current Status line from:

```
Version 11.3.0. SGPT session builder added to admin; sessions load from Firestore; auth cache clears on sign out.
```

To:

```
Version 11.4.0. Diagnostic instrumentation added for iOS dead-button bug on SGPT/assigned sessions: silent returns replaced with explicit toasts, global error listener added in app.js.
```

## Acceptance criteria

1. Tapping START on an SGPT or assigned session either launches the session or shows a specific toast. The button is never silently dead.
2. Every SGPT or assigned launch attempt emits a console log of the form `[8RB SGPT] useSgptSession id=... cache=N` or `[8RB ASSIGN] startAssignedSession id=... cache=N`.
3. Failure branches emit `console.error` lines with enough state to identify which guard fired and what the cache contained.
4. Global `window.error` and `unhandledrejection` events emit `[8RB GLOBAL ERROR]` / `[8RB UNHANDLED REJECTION]` logs.
5. Acorn parse check passes on all six JS files.
6. Settings panel and Profile tab both display version `11.4.0`.

## Acorn check (mandatory after JS changes)

Run from `C:\Users\Steve D\botrack app\BoxTrack`:

```
node -e "const acorn=require('acorn'),fs=require('fs');['firebase.js','data.js','app.js','train.js','box.js','progress.js'].forEach(f=>{const code=fs.readFileSync(f,'utf8');try{acorn.parse(code,{ecmaVersion:2020,sourceType:'module'});console.log(f+' CLEAN');}catch(e){console.log(f+' ERROR line '+(e.loc&&e.loc.line)+': '+e.message);}});"
```

All six files must report CLEAN.

## Testing

**Desktop (Chrome incognito):**

1. Start the local server: `python -m http.server 3000` from `C:\Users\Steve D\botrack app`
2. Open `http://localhost:3000/BoxTrack/` in a fresh incognito window
3. Sign in as an SGPT member
4. Open DevTools console
5. Tap START on a YOUR PROGRAMME session — should launch as before
6. Console should show: `[8RB SGPT] useSgptSession id=... cache=N`
7. Tap START on an ASSIGNED BY YOUR COACH card — should launch as before
8. Console should show: `[8RB ASSIGN] startAssignedSession id=... cache=N`

If both work and the logs appear, the desktop side is good.

**iOS PWA (the actual reproduction):**

1. Push to GitHub: `git add -A` then on a new line `git commit -m "11.4.0 — iOS diagnostic instrumentation"` then on a new line `git push origin main` (no `&&` chaining — PowerShell)
2. Wait for the GitHub Actions deploy to go green
3. On the iPhone, fully close the 8RB PWA (swipe up from app switcher)
4. Reopen the PWA — let it refresh
5. Sign in if needed, navigate to the SGPT/assigned session that previously didn't launch
6. Tap START
7. **Expected outcome:** a red toast appears with ONE of:
   - `Session not found — please refresh`
   - `Session data missing — contact your coach`
   - `Failed to start: [error message]`
   - `Session ID missing — please refresh`
   - `Assignment ID missing — please refresh`
   - `Assigned session not found — please refresh`

Screenshot the toast. Note which session type triggered it (YOUR PROGRAMME vs ASSIGNED BY YOUR COACH). Send back to Claude in chat for the root-cause fix spec.

**If a Mac is available for Safari Web Inspector:**

1. iPhone: Settings → Safari → Advanced → Web Inspector ON
2. Plug iPhone into Mac via cable
3. Mac Safari → Develop menu → select the iPhone → select the 8RB PWA
4. Reproduce the tap
5. Copy the full console output (especially the `[8RB SGPT]` / `[8RB ASSIGN]` / `[8RB GLOBAL ERROR]` lines)
6. Send the log back to Claude in chat

## What this does NOT fix

This is diagnostic only. The actual root cause — likely Firestore IndexedDB persistence behaviour on iOS Safari PWAs, or a cache hydration timing issue — is not addressed here. The follow-up spec will target whichever guard the toast indicates fired.

## Rules reminder

- Acorn check after every JS change ✓ (specified above)
- No nested template literals inside `${}` — none used in this spec
- No optional chaining in template literals — none used
- PowerShell: separate commands, no `&&` chaining
- Version bump on every meaningful change — bumped to 11.4.0
