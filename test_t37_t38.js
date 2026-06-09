'use strict';

/**
 * Standalone runner for T37 and T38 — gym config write access.
 *
 * Prerequisites:
 *   1. Java installed and on PATH (firebase emulator requires it)
 *   2. In a separate terminal, start the emulator FIRST:
 *        firebase emulators:start --only firestore --project rb-boxing
 *      Wait for "All emulators ready!" before running this script.
 *   3. Run this script:
 *        node test_t37_t38.js
 *
 * T37 — Coach writes to gym/8RB/config/main          → expect ALLOW
 * T38 — Coach writes to gym/OTHER_GYM/config/main    → expect DENY
 */

const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { readFileSync } = require('fs');
const { doc, setDoc } = require('firebase/firestore');

const PROJECT_ID   = 'rb-boxing';
const RULES_PATH   = 'C:\\Users\\Steve D\\botrack app\\BoxTrack\\firestore.rules';
const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 8080;

async function run() {
  console.log('\n=== T37 / T38 gym-scoping test ===\n');

  // ── Init test environment ─────────────────────────────────────────────
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host: EMULATOR_HOST,
      port: EMULATOR_PORT,
    },
  });

  await testEnv.clearFirestore();

  // ── Seed coach profile (bypasses security rules) ──────────────────────
  // coach1 belongs to gym '8RB' with role 'coach'.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', 'coach1', 'profile', 'data'), {
      displayName: 'Coach 8RB',
      role: 'coach',
      gym: '8RB',
      joinDate: '2024-01-01',
      email: 'coach1@test.com',
      onboarded: true,
    });
  });
  console.log('Seeded: users/coach1/profile/data  { role:"coach", gym:"8RB" }');

  // ── Coach context (email-verified) ───────────────────────────────────
  const coachDb = testEnv.authenticatedContext('coach1', {
    email_verified: true,
    email: 'coach1@test.com',
  }).firestore();

  let t37Pass = false;
  let t37Error = null;

  let t38Pass = false;
  let t38Error = null;

  // ── T37 — Write to OWN gym (8RB) — expect ALLOW ──────────────────────
  try {
    await assertSucceeds(setDoc(doc(coachDb, 'gym', '8RB', 'config', 'main'), {
      coachNote: 'Drill hard this week.',
      updatedAt: new Date().toISOString(),
    }));
    t37Pass = true;
  } catch (e) {
    t37Error = e.message;
  }

  // ── T38 — Write to OTHER gym — expect DENY ────────────────────────────
  try {
    await assertFails(setDoc(doc(coachDb, 'gym', 'OTHER_GYM', 'config', 'main'), {
      coachNote: 'Cross-gym injection',
    }));
    t38Pass = true;
  } catch (e) {
    t38Error = e.message;
  }

  // ── Report ─────────────────────────────────────────────────────────────
  console.log('\n--- Results ---\n');

  if (t37Pass) {
    console.log('T37: PASS — coach write to gym/8RB/config/main → ALLOWED');
    console.log('     Rule: isCoach() && isVerified() && gymId == profile.gym');
    console.log('     gymId "8RB" == coach1.gym "8RB" → condition satisfied');
  } else {
    console.log('T37: FAIL — expected ALLOW but got denial or error');
    console.log('     Error:', t37Error);
  }

  console.log('');

  if (t38Pass) {
    console.log('T38: PASS — coach write to gym/OTHER_GYM/config/main → DENIED');
    console.log('     Rule: isCoach() && isVerified() && gymId == profile.gym');
    console.log('     gymId "OTHER_GYM" != coach1.gym "8RB" → condition fails → DENY');
  } else {
    console.log('T38: FAIL — expected DENY but write was allowed or unexpected error');
    console.log('     Error:', t38Error);
  }

  const allPassed = t37Pass && t38Pass;
  console.log('\n--- Gym-scoping fix: ' + (allPassed ? 'WORKING CORRECTLY' : 'ISSUE DETECTED') + ' ---\n');

  await testEnv.cleanup();
  process.exit(allPassed ? 0 : 1);
}

run().catch((err) => {
  console.error('\nFatal error:', err.message);
  if (err.message && err.message.includes('ECONNREFUSED')) {
    console.error('Emulator is not running. Start it first:');
    console.error('  firebase emulators:start --only firestore --project rb-boxing');
  }
  process.exit(1);
});
