const e = require("electron");
const result = { type: typeof e };
if (typeof e === "object") {
  result.app = typeof e.app;
  result.BrowserWindow = typeof e.BrowserWindow;
} else {
  result.value = String(e).substring(0, 100);
}
require('fs').writeFileSync('test-result.json', JSON.stringify(result, null, 2));
process.exit(0);
