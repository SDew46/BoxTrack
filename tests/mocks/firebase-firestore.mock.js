const PROFILE_DATA = {
  uid: 'test-uid-playwright',
  email: 'playwright@8roundsboxing.com',
  displayName: 'Playwright Tester',
  role: 'member',
  sgpt: false,
  gym: '8RB',
  joinDate: '2024-01-01',
  onboarded: true,
  unit: 'kg',
  accentColor: '#D63040'
};

const COACHES_NOTES_DATA = {
  coachNotes: '— Playwright test notes'
};

const MOCK_DATA = {
  'users/test-uid-playwright/profile/data': PROFILE_DATA,
  'gym/8RB/config/main': COACHES_NOTES_DATA
};

function makeDocRef(path) {
  return { _path: path, type: 'document' };
}

function makeCollectionRef(path) {
  return { _path: path, type: 'collection' };
}

export function getFirestore() { return {}; }
export function initializeFirestore() { return {}; }
export const persistentLocalCache = () => ({});
export const persistentMultipleTabManager = () => ({});

export function doc(db, ...segments) {
  const path = segments.join('/');
  return makeDocRef(path);
}

export function collection(db, ...segments) {
  const path = segments.join('/');
  return makeCollectionRef(path);
}

export function getDoc(ref) {
  const data = MOCK_DATA[ref._path];
  if (data) {
    return Promise.resolve({
      exists: () => true,
      data: () => Object.assign({}, data),
      id: ref._path.split('/').pop()
    });
  }
  return Promise.resolve({
    exists: () => false,
    data: () => null,
    id: ref._path.split('/').pop()
  });
}

export function getDocs(ref) {
  return Promise.resolve({
    docs: [],
    forEach: () => {},
    empty: true,
    size: 0
  });
}

export function setDoc() { return Promise.resolve(); }
export function addDoc() { return Promise.resolve({ id: 'mock-id' }); }
export function updateDoc() { return Promise.resolve(); }
export function deleteDoc() { return Promise.resolve(); }

export function onSnapshot(ref, callback) {
  const data = ref._path ? MOCK_DATA[ref._path] : null;
  if (data) {
    setTimeout(() => callback({
      exists: () => true,
      data: () => Object.assign({}, data),
      docs: [],
      forEach: () => {}
    }), 0);
  } else {
    setTimeout(() => callback({
      exists: () => false,
      data: () => null,
      docs: [],
      forEach: () => {}
    }), 0);
  }
  return () => {};
}

export function query(ref) { return ref; }
export function where() { return {}; }
export function orderBy() { return {}; }
export function limit() { return {}; }
export function serverTimestamp() { return new Date().toISOString(); }

export class Timestamp {
  constructor(seconds, nanoseconds) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds || 0;
  }
  toDate() { return new Date(this.seconds * 1000); }
  static now() { return new Timestamp(Math.floor(Date.now() / 1000)); }
  static fromDate(date) { return new Timestamp(Math.floor(date.getTime() / 1000)); }
}

export function deleteField() { return { _delete: true }; }
export function writeBatch() {
  return {
    set: () => {},
    update: () => {},
    delete: () => {},
    commit: () => Promise.resolve()
  };
}
