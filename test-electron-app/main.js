const { app } = require('electron')

app.whenReady().then(() => {
  console.log('SUCCESS: App is ready!')
  console.log('process.type:', process.type)
  app.quit()
})