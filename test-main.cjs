const e = require("electron");
console.log("type:", typeof e);
if (typeof e === "object") {
  console.log("app:", typeof e.app);
  console.log("SUCCESS: require('electron') returns API object");
} else {
  console.log("FAIL: require('electron') returns:", String(e).substring(0, 100));
}
process.exit(0);
