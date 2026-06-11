// Member profile mock with one pending assigned session for today

const today = new Date().toISOString().split('T')[0];

const PROFILE_DATA = {
  uid: 'test-uid-playwright',
  email: 'playwright@8roundsboxing.com',
  displayName: 'Playwright Tester',
  role: 'member',
  gym: '8RB',
  joinDate: '2024-01-01',
  onboarded: true,
  unit: 'kg',
  accentColor: '#D63040'
};

const MOCK_DATA = {
  'users/test-uid-playwright/profile/data': PROFILE_DATA,
  'gym/8RB/config/main': { coachNotes: '— Playwright test notes' }
};

const ASSIGNED_SESSION = {
  _firestoreId: 'assigned-doc-1',
  sessionName: 'SGPT Upper A',
  sessionData: { id: 'SGPT1', name: 'SGPT Upper A', cat: 'SGPT', exercises: [] },
  assignedBy: 'coach-uid',
  assignedFor: today,
  status: 'pending'
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
  if (ref._path && ref._path.includes('assignedSessions')) {
    return Promise.resolve({
      docs: [{ id: 'assigned-doc-1', data: () => ASSIGNED_SESSION, exists: () => true }],
      forEach: (fn) => fn({ id: 'assigned-doc-1', data: () => ASSIGNED_SESSION }),
      empty: false,
      size: 1
    });
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
