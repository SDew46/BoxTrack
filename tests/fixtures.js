const { test: base } = require('@playwright/test');
const path = require('path');

const MOCKS_DIR = path.resolve(__dirname, 'mocks');

function makeRouteFn(firestoreMockFile) {
  return async ({ page }, use) => {
    const helper = async (overrideMockFile) => {
      const appMock = path.join(MOCKS_DIR, 'firebase-app.mock.js');
      const authMock = path.join(MOCKS_DIR, 'firebase-auth.mock.js');
      const fsFile = overrideMockFile || firestoreMockFile || 'firebase-firestore.mock.js';
      const firestoreMock = path.join(MOCKS_DIR, fsFile);

      await page.route('**/firebase-app.js', async route => {
        await route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', path: appMock });
      });
      await page.route('**/firebase-auth.js', async route => {
        await route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', path: authMock });
      });
      await page.route('**/firebase-firestore.js', async route => {
        await route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', path: firestoreMock });
      });
    };
    await use(helper);
  };
}

const test = base.extend({
  // Standard member mock (role: member, onboarded: true)
  mockFirebase: makeRouteFn('firebase-firestore.mock.js'),

  // SGPT member mock (role: sgpt, onboarded: true)
  mockFirebaseAsSgpt: makeRouteFn('firebase-firestore-sgpt.mock.js'),
});

const { expect } = require('@playwright/test');
module.exports = { test, expect };
