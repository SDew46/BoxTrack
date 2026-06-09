const { test: base } = require('@playwright/test');
const path = require('path');

const MOCKS_DIR = path.resolve(__dirname, 'mocks');

const test = base.extend({
  mockFirebase: async ({ page }, use) => {
    const helper = async (firestoreMockFile) => {
      const appMock = path.join(MOCKS_DIR, 'firebase-app.mock.js');
      const authMock = path.join(MOCKS_DIR, 'firebase-auth.mock.js');
      const firestoreMock = firestoreMockFile
        ? path.join(MOCKS_DIR, firestoreMockFile)
        : path.join(MOCKS_DIR, 'firebase-firestore.mock.js');

      await page.route('**/firebase-app.js', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'text/javascript; charset=utf-8',
          path: appMock,
        });
      });

      await page.route('**/firebase-auth.js', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'text/javascript; charset=utf-8',
          path: authMock,
        });
      });

      await page.route('**/firebase-firestore.js', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'text/javascript; charset=utf-8',
          path: firestoreMock,
        });
      });
    };

    await use(helper);
  },
});

const { expect } = require('@playwright/test');
module.exports = { test, expect };
