// Clear localStorage for the Electron app
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

// Get the user data path
const userDataPath = app.getPath('userData');
console.log('User data path:', userDataPath);

// LocalStorage is stored in a file
const localStoragePath = path.join(userDataPath, 'Local Storage', 'leveldb');
console.log('LocalStorage path:', localStoragePath);

// Check if it exists
if (fs.existsSync(localStoragePath)) {
  console.log('LocalStorage exists');
  // List files
  const files = fs.readdirSync(localStoragePath);
  console.log('Files:', files);
} else {
  console.log('LocalStorage does not exist');
}
