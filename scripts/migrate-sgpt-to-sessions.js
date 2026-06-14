/**
 * Phase A migration: gym/8RB/sgptSessions → gym/8RB/sessions
 *
 * BEFORE RUNNING:
 *   1. Download a Firebase service account key from:
 *      Firebase console → Project settings → Service accounts → Generate new private key
 *   2. Save it as scripts/serviceAccountKey.json (already gitignored via .gitignore)
 *   3. Run from the project root:
 *        node scripts/migrate-sgpt-to-sessions.js
 *
 * The script READS from sgptSessions and WRITES to sessions.
 * It does NOT delete sgptSessions — delete manually after verifying the migration log.
 * Output: migration-log.json in the project root.
 */

'use strict';

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const KEY_PATH = path.join(__dirname, 'serviceAccountKey.json');
const LOG_PATH = path.join(__dirname, '..', 'migration-log.json');
const GYM_ID = '8RB';

if (!fs.existsSync(KEY_PATH)) {
  console.error('ERROR: scripts/serviceAccountKey.json not found.');
  console.error('Download it from Firebase console → Project settings → Service accounts.');
  process.exit(1);
}

const serviceAccount = require(KEY_PATH);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://rb-boxing.firebaseio.com'
});

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

async function migrate() {
  const sourceRef = db.collection('gym').doc(GYM_ID).collection('sgptSessions');
  const destRef   = db.collection('gym').doc(GYM_ID).collection('sessions');

  console.log('Reading gym/' + GYM_ID + '/sgptSessions ...');
  const snap = await sourceRef.get();

  if (snap.empty) {
    console.log('No documents found in sgptSessions. Nothing to migrate.');
    process.exit(0);
  }

  console.log('Found ' + snap.docs.length + ' document(s). Migrating...');

  var log = [];
  var errors = [];

  for (var i = 0; i < snap.docs.length; i++) {
    var doc = snap.docs[i];
    var oldId = doc.id;
    var data  = doc.data();

    // Build the new document
    var newDoc = Object.assign({}, data);

    // Required new fields
    newDoc.visibility = 'sgpt';
    newDoc.assignedTo = [];

    // Defaults for fields that may be absent in old schema
    if (!newDoc.sessionType) {
      newDoc.sessionType = 'straight_sets';
    }
    if (typeof newDoc.active !== 'boolean') {
      newDoc.active = true;
    }
    if (!newDoc.finisher) {
      newDoc.finisher = '';
    }

    // Ensure each exercise has exerciseType
    if (Array.isArray(newDoc.exercises)) {
      newDoc.exercises = newDoc.exercises.map(function(ex) {
        if (!ex.exerciseType) {
          return Object.assign({}, ex, { exerciseType: 'standard' });
        }
        return ex;
      });
    }

    // updatedAt — carry forward createdAt if updatedAt missing
    if (!newDoc.updatedAt) {
      newDoc.updatedAt = newDoc.createdAt || admin.firestore.FieldValue.serverTimestamp();
    }

    try {
      var newDocRef = destRef.doc(); // auto-generated id
      await newDocRef.set(newDoc);
      var entry = { oldId: oldId, newId: newDocRef.id, name: data.name || '(unnamed)' };
      log.push(entry);
      console.log('  [OK] ' + oldId + ' → ' + newDocRef.id + ' (' + (data.name || 'unnamed') + ')');
    } catch (err) {
      var errEntry = { oldId: oldId, name: data.name || '(unnamed)', error: err.message };
      errors.push(errEntry);
      console.error('  [ERR] ' + oldId + ': ' + err.message);
    }
  }

  var result = {
    migratedAt: new Date().toISOString(),
    sourceCollection: 'gym/' + GYM_ID + '/sgptSessions',
    destCollection:   'gym/' + GYM_ID + '/sessions',
    totalSource:  snap.docs.length,
    totalSuccess: log.length,
    totalError:   errors.length,
    migrations: log,
    errors: errors
  };

  fs.writeFileSync(LOG_PATH, JSON.stringify(result, null, 2), 'utf8');

  console.log('');
  console.log('Done. ' + log.length + ' migrated, ' + errors.length + ' error(s).');
  console.log('Migration log written to migration-log.json');

  if (errors.length > 0) {
    console.error('ERRORS occurred — do NOT delete sgptSessions until errors are resolved.');
    process.exit(1);
  } else {
    console.log('');
    console.log('Next steps:');
    console.log('  1. Verify sessions appear in Train tab (YOUR PROGRAMME)');
    console.log('  2. Check migration-log.json for oldId → newId mapping');
    console.log('  3. Only then manually export + delete gym/' + GYM_ID + '/sgptSessions');
  }

  process.exit(0);
}

migrate().catch(function(err) {
  console.error('Fatal error:', err);
  process.exit(1);
});
