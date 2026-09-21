// Auth mock that resolves with null — simulates a user who is not signed in
const TEST_USER = null;

export function getAuth() { return {}; }
export function initializeAuth() { return {}; }
export const browserLocalPersistence = {};
export const browserSessionPersistence = {};

export function onAuthStateChanged(auth, callback) {
  setTimeout(() => callback(TEST_USER), 80);
  return () => {};
}

export function signInWithEmailAndPassword() { return Promise.resolve({ user: TEST_USER }); }
export function createUserWithEmailAndPassword() { return Promise.resolve({ user: TEST_USER }); }
export function signOut() { return Promise.resolve(); }

export class GoogleAuthProvider {
  setCustomParameters() {}
  addScope() {}
}

export function signInWithPopup() { return Promise.resolve({ user: TEST_USER }); }
export function sendEmailVerification() { return Promise.resolve(); }
export function sendPasswordResetEmail() { return Promise.resolve(); }
export function updateProfile() { return Promise.resolve(); }
export function deleteUser() { return Promise.resolve(); }
export function getRedirectResult() { return Promise.resolve(null); }

export class EmailAuthProvider {
  static credential(email, password) { return { email, password }; }
}

export function reauthenticateWithCredential() { return Promise.resolve({ user: TEST_USER }); }
export function reload() { return Promise.resolve(); }
