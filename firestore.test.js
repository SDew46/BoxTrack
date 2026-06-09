'use strict';

const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { readFileSync } = require('fs');
const { doc, getDoc, setDoc, updateDoc, collection, getDocs } = require('firebase/firestore');

const PROJECT_ID = 'rb-boxing';
const RULES_PATH = 'C:\\Users\\Steve D\\botrack app\\BoxTrack\\firestore.rules';
const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 8080;

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host: EMULATOR_HOST,
      port: EMULATOR_PORT,
    },
  });
}, 30000);

afterAll(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
}, 30000);

beforeEach(async () => {
  await testEnv.clearFirestore();
});

// ─── Context helpers ───────────────────────────────────────────────────────────

function getAnonymousContext() {
  return testEnv.unauthenticatedContext().firestore();
}

function getUnverifiedContext(uid) {
  return testEnv.authenticatedContext(uid, {
    email_verified: false,
    email: uid + '@test.com',
  }).firestore();
}

function getVerifiedMemberContext(uid) {
  return testEnv.authenticatedContext(uid, {
    email_verified: true,
    email: uid + '@test.com',
  }).firestore();
}

function getCoachContext(uid) {
  return testEnv.authenticatedContext(uid, {
    email_verified: true,
    email: uid + '@test.com',
  }).firestore();
}

async function seedMemberProfile(uid, extra) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', uid, 'profile', 'data'), {
      displayName: 'Test User ' + uid,
      role: 'member',
      gym: '8RB',
      joinDate: '2024-01-01',
      email: uid + '@test.com',
      onboarded: true,
      unit: 'kg',
      accentColor: '#E63946',
      ...extra,
    });
  });
}

async function seedCoachProfile(uid) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', uid, 'profile', 'data'), {
      displayName: 'Coach ' + uid,
      role: 'coach',
      gym: '8RB',
      joinDate: '2024-01-01',
      email: uid + '@test.com',
      onboarded: true,
    });
  });
}

async function seedGymConfig() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'gym', '8RB', 'config', 'main'), {
      coachNote: 'Welcome to 8RB!',
      updatedAt: new Date().toISOString(),
    });
  });
}

async function seedSession(uid, sessionId) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', uid, 'sessions', sessionId), {
      type: 'Squat Day',
      date: '2024-06-01',
    });
  });
}

// ─── EXTERNAL ATTACKS (anonymous) ─────────────────────────────────────────────

describe('EXTERNAL ATTACKS (anonymous)', () => {

  test('T01: Anonymous reads users collection — DENY', async () => {
    const db = getAnonymousContext();
    await assertFails(getDocs(collection(db, 'users')));
  });

  test('T02: Anonymous reads users/user1/profile/data — DENY', async () => {
    await seedMemberProfile('user1');
    const db = getAnonymousContext();
    await assertFails(getDoc(doc(db, 'users', 'user1', 'profile', 'data')));
  });

  test('T03: Anonymous reads gym/8RB/config/main — DENY', async () => {
    await seedGymConfig();
    const db = getAnonymousContext();
    await assertFails(getDoc(doc(db, 'gym', '8RB', 'config', 'main')));
  });

  test('T04: Anonymous writes to users/user1/profile/data — DENY', async () => {
    const db = getAnonymousContext();
    await assertFails(setDoc(doc(db, 'users', 'user1', 'profile', 'data'), {
      displayName: 'Hacker',
      role: 'member',
      gym: '8RB',
    }));
  });

  test('T05: Anonymous writes to gym/8RB/config/main — DENY', async () => {
    const db = getAnonymousContext();
    await assertFails(setDoc(doc(db, 'gym', '8RB', 'config', 'main'), {
      coachNote: 'Hacked!',
    }));
  });

  test('T06: Anonymous reads users/user1/sessions/sess1 — DENY', async () => {
    await seedSession('user1', 'sess1');
    const db = getAnonymousContext();
    await assertFails(getDoc(doc(db, 'users', 'user1', 'sessions', 'sess1')));
  });

});

// ─── AUTHENTICATED NON-MEMBER (auth but no profile doc, not verified) ─────────

describe('AUTHENTICATED NON-MEMBER (auth but no profile doc)', () => {

  test('T07: Auth user (uid=user2) reads users/user1/profile/data — DENY', async () => {
    await seedMemberProfile('user1');
    // user2 has no profile and is unverified
    const db = getUnverifiedContext('user2');
    await assertFails(getDoc(doc(db, 'users', 'user1', 'profile', 'data')));
  });

  test('T08: Auth user (uid=user2) reads gym/8RB/config/main — DENY (not verified)', async () => {
    await seedGymConfig();
    // user2 is authenticated but NOT email-verified — isVerified() returns false
    const db = getUnverifiedContext('user2');
    await assertFails(getDoc(doc(db, 'gym', '8RB', 'config', 'main')));
  });

  test('T09: Auth user (uid=user2) writes to gym/8RB/config/main — DENY', async () => {
    // user2 is unverified, has no profile, definitely not coach
    const db = getUnverifiedContext('user2');
    await assertFails(setDoc(doc(db, 'gym', '8RB', 'config', 'main'), {
      coachNote: 'Injected',
    }));
  });

});

// ─── AUTHENTICATED UNVERIFIED MEMBER ──────────────────────────────────────────

describe('AUTHENTICATED UNVERIFIED MEMBER', () => {

  test('T10: Unverified member reads own users/user3/profile/data — DENY', async () => {
    await seedMemberProfile('user3');
    const db = getUnverifiedContext('user3');
    await assertFails(getDoc(doc(db, 'users', 'user3', 'profile', 'data')));
  });

  test('T11: Unverified member writes own users/user3/profile/data — DENY', async () => {
    const db = getUnverifiedContext('user3');
    await assertFails(setDoc(doc(db, 'users', 'user3', 'profile', 'data'), {
      displayName: 'User3',
      role: 'member',
      gym: '8RB',
      joinDate: '2024-01-01',
    }));
  });

  test('T12: Unverified member reads gym/8RB/config/main — DENY', async () => {
    await seedGymConfig();
    const db = getUnverifiedContext('user3');
    await assertFails(getDoc(doc(db, 'gym', '8RB', 'config', 'main')));
  });

});

// ─── AUTHENTICATED VERIFIED MEMBER — OWN DATA ─────────────────────────────────

describe('AUTHENTICATED VERIFIED MEMBER — OWN DATA', () => {

  test('T13: Verified member reads own users/user4/profile/data — ALLOW', async () => {
    await seedMemberProfile('user4');
    const db = getVerifiedMemberContext('user4');
    await assertSucceeds(getDoc(doc(db, 'users', 'user4', 'profile', 'data')));
  });

  test('T14: Verified member updates displayName in own profile — ALLOW', async () => {
    await seedMemberProfile('user4');
    const db = getVerifiedMemberContext('user4');
    await assertSucceeds(updateDoc(doc(db, 'users', 'user4', 'profile', 'data'), {
      displayName: 'New Name',
    }));
  });

  test('T15: Verified member updates unit in own profile — ALLOW', async () => {
    await seedMemberProfile('user4');
    const db = getVerifiedMemberContext('user4');
    await assertSucceeds(updateDoc(doc(db, 'users', 'user4', 'profile', 'data'), {
      unit: 'lbs',
    }));
  });

  test('T16: Verified member attempts to change own role to "coach" — DENY', async () => {
    await seedMemberProfile('user4');
    const db = getVerifiedMemberContext('user4');
    await assertFails(updateDoc(doc(db, 'users', 'user4', 'profile', 'data'), {
      role: 'coach',
    }));
  });

  test('T17: Verified member attempts to change own gym field — DENY', async () => {
    await seedMemberProfile('user4');
    const db = getVerifiedMemberContext('user4');
    await assertFails(updateDoc(doc(db, 'users', 'user4', 'profile', 'data'), {
      gym: 'OTHER_GYM',
    }));
  });

  test('T18: Verified member attempts to change own joinDate — DENY', async () => {
    await seedMemberProfile('user4');
    const db = getVerifiedMemberContext('user4');
    await assertFails(updateDoc(doc(db, 'users', 'user4', 'profile', 'data'), {
      joinDate: '2020-01-01',
    }));
  });

  test('T19: Verified member creates profile with role: "coach" on first write — DENY', async () => {
    // No pre-seeded profile — this is a first-time create
    const db = getVerifiedMemberContext('user4new');
    await assertFails(setDoc(doc(db, 'users', 'user4new', 'profile', 'data'), {
      displayName: 'Hacker Coach',
      role: 'coach',
      gym: '8RB',
      joinDate: '2024-01-01',
      email: 'user4new@test.com',
    }));
  });

  test('T20: Verified member creates profile with gym: "OTHER_GYM" — DENY', async () => {
    const db = getVerifiedMemberContext('user4b');
    await assertFails(setDoc(doc(db, 'users', 'user4b', 'profile', 'data'), {
      displayName: 'Gym Hopper',
      role: 'member',
      gym: 'OTHER_GYM',
      joinDate: '2024-01-01',
      email: 'user4b@test.com',
    }));
  });

  test('T21: Verified member tries to overwrite profile when doc already exists — checked (update path tested separately)', async () => {
    // The create rule only applies when the doc does NOT exist yet.
    // When it already exists, setDoc triggers an update, not a create.
    // We test that setting role=coach on an existing doc is DENIED (update path).
    await seedMemberProfile('user4c');
    const db = getVerifiedMemberContext('user4c');
    // Attempting to overwrite entire doc with role: member, gym: 8RB (valid create data but via update path)
    // setDoc on an existing doc = merge=false triggers update rule;
    // trying to change role in the write data while doc exists => DENY (affectedKeys check)
    // A full setDoc that doesn't change role/gym/joinDate should ALLOW:
    // Actually: setDoc with merge:false replaces the doc - if role stays 'member' and gym stays '8RB' and joinDate unchanged, it should ALLOW.
    // If role is attempted to change to 'coach' -> DENY.
    await assertFails(setDoc(doc(db, 'users', 'user4c', 'profile', 'data'), {
      displayName: 'Changed',
      role: 'coach',
      gym: '8RB',
      joinDate: '2024-01-01',
      email: 'user4c@test.com',
    }));
  });

  test('T22: Verified member reads own users/user4/sessions/sess1 — ALLOW', async () => {
    await seedSession('user4', 'sess1');
    const db = getVerifiedMemberContext('user4');
    await assertSucceeds(getDoc(doc(db, 'users', 'user4', 'sessions', 'sess1')));
  });

  test('T23: Verified member writes own session to users/user4/sessions/newSess — ALLOW', async () => {
    await seedMemberProfile('user4');
    const db = getVerifiedMemberContext('user4');
    await assertSucceeds(setDoc(doc(db, 'users', 'user4', 'sessions', 'newSess'), {
      type: 'Goblet Day',
      date: '2024-06-10',
      exercises: [],
    }));
  });

  test('T24: Verified member reads own users/user4/boxingSessions/bs1 — ALLOW', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users', 'user4', 'boxingSessions', 'bs1'), {
        rounds: 6,
        date: '2024-06-01',
      });
    });
    const db = getVerifiedMemberContext('user4');
    await assertSucceeds(getDoc(doc(db, 'users', 'user4', 'boxingSessions', 'bs1')));
  });

  test('T25: Verified member writes own boxing session to users/user4/boxingSessions/newBs — ALLOW', async () => {
    const db = getVerifiedMemberContext('user4');
    await assertSucceeds(setDoc(doc(db, 'users', 'user4', 'boxingSessions', 'newBs'), {
      rounds: 8,
      date: '2024-06-10',
    }));
  });

  test('T26: Verified member reads own users/user4/customCombos/cc1 — ALLOW', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users', 'user4', 'customCombos', 'cc1'), {
        name: 'My Combo',
        punches: [1, 2, 3],
      });
    });
    const db = getVerifiedMemberContext('user4');
    await assertSucceeds(getDoc(doc(db, 'users', 'user4', 'customCombos', 'cc1')));
  });

  test('T27: Verified member writes own custom combo to users/user4/customCombos/newCc — ALLOW', async () => {
    const db = getVerifiedMemberContext('user4');
    await assertSucceeds(setDoc(doc(db, 'users', 'user4', 'customCombos', 'newCc'), {
      name: 'Power Combo',
      punches: [1, 2, 3, 2],
    }));
  });

});

// ─── AUTHENTICATED VERIFIED MEMBER — OTHER USERS DATA ─────────────────────────

describe('AUTHENTICATED VERIFIED MEMBER — OTHER USERS DATA', () => {

  test('T28: Verified member reads users/user5/profile/data (different user) — DENY', async () => {
    await seedMemberProfile('user5');
    const db = getVerifiedMemberContext('user4');
    await assertFails(getDoc(doc(db, 'users', 'user5', 'profile', 'data')));
  });

  test('T29: Verified member writes to users/user5/profile/data — DENY', async () => {
    await seedMemberProfile('user5');
    const db = getVerifiedMemberContext('user4');
    await assertFails(setDoc(doc(db, 'users', 'user5', 'profile', 'data'), {
      displayName: 'Hijacked',
      role: 'member',
      gym: '8RB',
      joinDate: '2024-01-01',
    }));
  });

  test('T30: Verified member reads users/user5/sessions/sess1 — DENY', async () => {
    await seedSession('user5', 'sess1');
    const db = getVerifiedMemberContext('user4');
    await assertFails(getDoc(doc(db, 'users', 'user5', 'sessions', 'sess1')));
  });

  test('T31: Verified member writes to users/user5/sessions/newSess — DENY', async () => {
    const db = getVerifiedMemberContext('user4');
    await assertFails(setDoc(doc(db, 'users', 'user5', 'sessions', 'newSess'), {
      type: 'Push Day',
      date: '2024-06-10',
    }));
  });

  test('T32: Verified member queries users collection (list all) — DENY', async () => {
    const db = getVerifiedMemberContext('user4');
    await assertFails(getDocs(collection(db, 'users')));
  });

  test('T33: Verified member queries users/user5/sessions collection — DENY', async () => {
    await seedSession('user5', 'sess1');
    const db = getVerifiedMemberContext('user4');
    await assertFails(getDocs(collection(db, 'users', 'user5', 'sessions')));
  });

});

// ─── GYM CONFIG ACCESS ─────────────────────────────────────────────────────────

describe('GYM CONFIG ACCESS', () => {

  test('T34: Verified member reads gym/8RB/config/main — ALLOW', async () => {
    await seedGymConfig();
    await seedMemberProfile('user4');
    const db = getVerifiedMemberContext('user4');
    await assertSucceeds(getDoc(doc(db, 'gym', '8RB', 'config', 'main')));
  });

  test('T35: Verified member writes to gym/8RB/config/main — DENY', async () => {
    await seedMemberProfile('user4');
    const db = getVerifiedMemberContext('user4');
    await assertFails(setDoc(doc(db, 'gym', '8RB', 'config', 'main'), {
      coachNote: 'Member injection',
    }));
  });

  test('T36: Coach reads gym/8RB/config/main — ALLOW', async () => {
    await seedGymConfig();
    await seedCoachProfile('coach1');
    const db = getCoachContext('coach1');
    await assertSucceeds(getDoc(doc(db, 'gym', '8RB', 'config', 'main')));
  });

  test('T37: Coach writes to gym/8RB/config/main — ALLOW', async () => {
    await seedCoachProfile('coach1');
    const db = getCoachContext('coach1');
    await assertSucceeds(setDoc(doc(db, 'gym', '8RB', 'config', 'main'), {
      coachNote: 'Drill hard this week.',
      updatedAt: new Date().toISOString(),
    }));
  });

  test('T38: Coach writes to gym/OTHER_GYM/config/main — DENY', async () => {
    await seedCoachProfile('coach1');
    const db = getCoachContext('coach1');
    // The write rule now enforces gym scoping:
    //   isCoach() && isVerified()
    //   && gymId == get(.../users/$(uid)/profile/data).data.gym
    // coach1's profile has gym:'8RB', so gymId 'OTHER_GYM' != '8RB' → DENY.
    await assertFails(setDoc(doc(db, 'gym', 'OTHER_GYM', 'config', 'main'), {
      coachNote: 'Cross-gym injection',
    }));
  });

});

// ─── PRIVILEGE ESCALATION ──────────────────────────────────────────────────────

describe('PRIVILEGE ESCALATION', () => {

  test('T39: Verified member writes to someRandomPath/doc (uncovered path) — DENY', async () => {
    const db = getVerifiedMemberContext('user4');
    await assertFails(setDoc(doc(db, 'someRandomPath', 'doc'), {
      data: 'arbitrary',
    }));
  });

  test('T40: Verified member writes to admin/config — DENY', async () => {
    const db = getVerifiedMemberContext('user4');
    await assertFails(setDoc(doc(db, 'admin', 'config'), {
      elevate: true,
    }));
  });

  test('T41: Verified member writes large document to own sessions — report actual behaviour', async () => {
    // Rules have no field-count or size limits; Firestore has a 1MB doc limit (server enforced)
    // but that is not a security rule. This test writes a document with 100 fields.
    // Expected: ALLOW (no size rule in firestore.rules)
    const db = getVerifiedMemberContext('user4');
    const bigData = { type: 'Squat Day', date: '2024-06-01' };
    for (let i = 0; i < 100; i++) {
      bigData['field' + i] = 'value' + i;
    }
    // We use assertSucceeds because the rules do not restrict document size
    await assertSucceeds(setDoc(doc(db, 'users', 'user4', 'sessions', 'bigDoc'), bigData));
  });

  test('T42: Verified member reads users/someGuessedUID/profile/data (different from own UID) — DENY', async () => {
    await seedMemberProfile('someGuessedUID');
    const db = getVerifiedMemberContext('user4');
    await assertFails(getDoc(doc(db, 'users', 'someGuessedUID', 'profile', 'data')));
  });

});
