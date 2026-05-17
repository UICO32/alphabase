import electron from 'electron';
import { app, BrowserWindow } from 'electron';
const result = {
  default_type: typeof electron,
  app_type: typeof app,
  BrowserWindow_type: typeof BrowserWindow,
  process_type: process.type,
  versions_electron: process.versions.electron,
};
import { writeFileSync } from 'fs';
writeFileSync('test-result3.json', JSON.stringify(result, null, 2));
process.exit(0);
