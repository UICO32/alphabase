const e = require('electron')
console.log('process.type:', process.type)
console.log('typeof electron:', typeof e)
if (typeof e === 'object') {
  console.log('electron keys:', Object.keys(e).join(','))
} else if (typeof e === 'string') {
  console.log('electron is string (path):', e.substring(0, 80))
}
// Write to file since console might not show
const fs = require('fs')
fs.writeFileSync('electron-debug.txt', `type: ${process.type}\nelectron: ${typeof e}\n${typeof e === 'string' ? e : Object.keys(e).join(',')}\n`)
setTimeout(() => { process.exit(0) }, 3000)