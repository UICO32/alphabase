const { _electron: electron } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  // Connect to running Electron app
  const electronApp = await electron.connect({
    wsEndpoint: 'ws://127.0.0.1:9222',
  });

  const page = await electronApp.firstWindow();

  // Listen to console messages
  page.on('console', msg => {
    console.log(`[${msg.type()}] ${msg.text()}`);
  });

  // Wait for app to load
  await page.waitForTimeout(3000);

  // Take screenshot
  await page.screenshot({ path: 'test-results/electron-debug.png' });

  // Check if window.electronAPI exists
  const hasElectronAPI = await page.evaluate(() => {
    return typeof (window as any).electronAPI !== 'undefined';
  });
  console.log('Has electronAPI:', hasElectronAPI);

  if (hasElectronAPI) {
    const fsMethods = await page.evaluate(() => {
      const api = (window as any).electronAPI;
      return {
        hasFS: !!api.fs,
        fsMethods: api.fs ? Object.keys(api.fs) : [],
        hasDialog: !!api.dialog,
      };
    });
    console.log('electronAPI structure:', fsMethods);
  }

  // Check localStorage
  const localStorage = await page.evaluate(() => {
    return {
      lastWorkspace: localStorage.getItem('hepta-last-workspace-path'),
      keys: Object.keys(localStorage),
    };
  });
  console.log('localStorage:', localStorage);

  // Close
  await electronApp.close();
})();
