// Minimal Electron app to test require('electron')
const { app } = require('electron')

app.whenReady().then(() => {
  console.log('App is ready!')
  console.log('process.type:', process.type)

  const { BrowserWindow } = require('electron')
  const win = new BrowserWindow({ width: 400, height: 300 })
  win.loadURL('about:blank')

  setTimeout(() => {
    console.log('SUCCESS: Electron is working!')
    app.quit()
  }, 2000)
})

app.on('window-all-closed', () => app.quit())
