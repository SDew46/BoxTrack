// SGPT member profile mock — role: 'member', sgpt: true, onboarded: true

const SGPT_PROFILE = {
  uid: 'test-uid-playwright',
  email: 'playwright@8roundsboxing.com',
  displayName: 'SGPT Tester',
  role: 'member',
  sgpt: true,
  gym: '8RB',
  joinDate: '2024-01-01',
  onboarded: true,
  unit: 'kg',
  accentColor: '#D63040'
};

const MOCK_SGPT_SESSIONS = [
  { id: 'mock-sgpt-1', data: () => ({
    name: 'SGPT Upper A',
    exercises: [
      { name: 'Barbell Bench Press', displayName: 'Barbell Bench Press', sets: 3, reps: 5, scheme: '3x5', rest: 90, type: 'Standard', note: '', alts: [] }
    ],
    active: true, audience: ['sgpt'], source: 'coach'
  })}
];

const MOCK_DATA = {
  'users/test-uid-playwright/profile/data': SGPT_PROFILE,
  'gym/8RB/config/main': { coachNotes: '— Playwright test notes' }
};

export function getFirestore() { return {}; }
export function initializeFirestore() { return {}; }
export const persistentLocalCache = () => ({});
export const persistentMultipleTabManager = () => ({});

export function doc(db, ...segments) {
  return { _path: segments.join('/'), type: 'document' };
}
export function collection(db, ...segments) {
  return { _path: segments.join('/'), type: 'collection' };
}

export function getDoc(ref) {
  const data = MOCK_DATA[ref._path];
  if (data) return Promise.resolve({ exists: () => true, data: () => Object.assign({}, data), id: ref._path.split('/').pop() });
  return Promise.resolve({ exists: () => false, data: () => null, id: ref._path.split('/').pop() });
}

export function getDocs(ref) {
  var path = ref && ref._path;
  if (path && path.includes('sgptSessions')) {
    return Promise.resolve({ docs: MOCK_SGPT_SESSIONS, forEach: (fn) => MOCK_SGPT_SESSIONS.forEach(fn), empty: false, size: MOCK_SGPT_SESSIONS.length });
  }
  return Promise.resolve({ docs: [], forEach: () => {}, empty: true, size: 0 });
}

export function setDoc() { return Promise.resolve(); }
export function addDoc() { return Promise.resolve({ id: 'mock-id' }); }
export function updateDoc() { return Promise.resolve(); }
export function deleteDoc() { return Promise.resolve(); }

export function onSnapshot(ref, callback) {
  const data = MOCK_DATA[ref._path];
  setTimeout(() => callback({ exists: () => !!data, data: () => data ? Object.assign({}, data) : null, docs: [], forEach: () => {} }), 0);
  return () => {};
}

export function query(ref) { return ref; }
export function where() { return {}; }
export function orderBy() { return {}; }
export function limit() { return {}; }
export function serverTimestamp() { return new Date().toISOString(); }
export class Timestamp {
  constructor(s, ns) { this.seconds = s; this.nanoseconds = ns || 0; }
  toDate() { return new Date(this.seconds * 1000); }
  static now() { return new Timestamp(Math.floor(Date.now() / 1000)); }
  static fromDate(d) { return new Timestamp(Math.floor(d.getTime() / 1000)); }
}
export function deleteField() { return { _delete: true }; }
export function writeBatch() { return { set: () => {}, update: () => {}, delete: () => {}, commit: () => Promise.resolve() }; }
