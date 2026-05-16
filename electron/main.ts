import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createMenu } from './menu'

const __dirname = dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#fAfAfA',
      symbolColor: '#18181b',
      height: 36,
    },
  })

  createMenu(mainWindow)

  // Open DevTools for debugging
  mainWindow.webContents.openDevTools()

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// IPC handlers
ipcMain.handle('fs:readFile', async (_event, path: string) => {
  const fs = await import('fs/promises')
  return await fs.readFile(path)
})

ipcMain.handle('fs:writeFile', async (_event, filePath: string, data: string) => {
  console.log('[IPC] writeFile:', filePath, 'data length:', data?.length)
  const fs = await import('fs/promises')
  await fs.writeFile(filePath, data)
})

ipcMain.handle('fs:deleteFile', async (_event, path: string) => {
  const fs = await import('fs/promises')
  await fs.unlink(path)
})

ipcMain.handle('fs:readdir', async (_event, path: string) => {
  const fs = await import('fs/promises')
  return await fs.readdir(path)
})

ipcMain.handle('fs:mkdir', async (_event, path: string) => {
  const fs = await import('fs/promises')
  await fs.mkdir(path, { recursive: true })
})

ipcMain.handle('fs:stat', async (_event, path: string) => {
  const fs = await import('fs/promises')
  const st = await fs.stat(path)
  return { isDirectory: st.isDirectory(), size: st.size, mtimeMs: st.mtimeMs }
})

ipcMain.handle('fs:exists', async (_event, filePath: string) => {
  console.log('[IPC] exists:', filePath)
  const fs = await import('fs/promises')
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
})

ipcMain.handle('fs:rename', async (_event, oldPath: string, newPath: string) => {
  const fs = await import('fs/promises')
  await fs.rename(oldPath, newPath)
})

ipcMain.handle('fs:rmdir', async (_event, path: string) => {
  const fs = await import('fs/promises')
  await fs.rm(path, { recursive: true, force: true })
})

ipcMain.handle('dialog:openDirectory', async () => {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  })
  return result.canceled ? null : result.filePaths[0]
})
