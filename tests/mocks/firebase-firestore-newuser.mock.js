// Variant mock: all getDoc calls return exists()===false, simulating a brand-new user.
// This causes ensureUserProfile to create a new profile with onboarded:false,
// which triggers startOnboarding() instead of showApp().

export function getFirestore() { return {}; }
export function initializeFirestore() { return {}; }
export const persistentLocalCache = () => ({});
export const persistentMultipleTabManager = () => ({});

export function doc(db, ...segments) {
  const path = segments.join('/');
  return { _path: path, type: 'document' };
}

export function collection(db, ...segments) {
  const path = segments.join('/');
  return { _path: path, type: 'collection' };
}

export function getDoc(ref) {
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
  setTimeout(() => callback({
    exists: () => false,
    data: () => null,
    docs: [],
    forEach: () => {}
  }), 0);
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
