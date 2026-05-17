const e = require('electron')
console.log('type:', typeof e)
console.log('process.type:', process.type)
if (typeof e === 'object') {
  console.log('keys:', Object.keys(e).join(','))
  console.log('has protocol:', 'protocol' in e)
}
setTimeout(() => { process.exit(0) }, 2000)
