// Try different ways to access electron APIs
const result = {};

// Method 1: Direct require
const e1 = require("electron");
result.method1_type = typeof e1;

// Method 2: Check process.type
result.process_type = process.type;

// Method 3: Check if process.electronBinding exists
result.has_electronBinding = typeof process.electronBinding === 'function';

// Method 4: Try process.electronBinding
if (typeof process.electronBinding === 'function') {
  try {
    const binding = process.electronBinding('features');
    result.binding = typeof binding;
  } catch(e) {
    result.binding_error = e.message;
  }
}

// Method 5: Check globalThis
result.has_process_versions_electron = !!process.versions.electron;

require('fs').writeFileSync('test-result2.json', JSON.stringify(result, null, 2));
process.exit(0);
