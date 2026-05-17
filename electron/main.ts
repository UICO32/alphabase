import { app, BrowserWindow, ipcMain, dialog, protocol } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readFile, writeFile as fsWriteFile, mkdir as fsMkdir } from 'fs/promises'
import { dirname as pathDirname } from 'path'
import { createMenu } from './menu'
import { registerClipperHandlers } from './clipper/handler'
import { Md5 } from 'ts-md5'

const __dirname = dirname(fileURLToPath(import.meta.url))

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'hepta-media',
    privileges: { bypassCSP: true, stream: true, supportFetchAPI: false },
  },
])

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
      color: '#f4f4f5',
      symbolColor: '#18181b',
      height: 28,
    },
  })

  createMenu(mainWindow)
  registerClipperHandlers()

  // Open DevTools for debugging
  mainWindow.webContents.openDevTools()

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  protocol.handle('hepta-media', async (request) => {
    try {
      const url = new URL(request.url)
      const filename = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
      const workspacePath = url.searchParams.get('workspace') || ''
      const filePath = join(workspacePath, 'media', filename)
      const data = await readFile(filePath)
      const ext = filename.split('.').pop()?.toLowerCase() || 'jpg'
      const mimeMap: Record<string, string> = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
        webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', avif: 'image/avif',
      }
      return new Response(data, {
        headers: { 'content-type': mimeMap[ext] || 'application/octet-stream' },
      })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })

  createWindow()
})

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

// Flomo sync IPC handlers
const FLOMO_SIGN_KEY = 'dbbc3dd73364b4084c3a69346e0ce2b2'

function signFlomoParams(params: Record<string, string>): string {
  const keys = Object.keys(params).sort()
  let str = ''
  for (const k of keys) {
    const v = params[k]
    if (v === undefined || v === null || v === '') continue
    if (Array.isArray(v)) {
      const sorted = [...v].sort()
      for (const item of sorted) str += `${k}[]=${item}&`
    } else {
      str += `${k}=${v}&`
    }
  }
  str = str.slice(0, -1)
  return Md5.hashStr(str + FLOMO_SIGN_KEY) as string
}

ipcMain.handle('flomo:login', async (_event, { email, password }: { email: string; password: string }) => {
  const ts = String(Math.floor(Date.now() / 1000))
  const params: Record<string, string> = {
    api_key: 'flomo_web',
    app_version: '2.0',
    email,
    password,
    timestamp: ts,
    webp: '1',
  }
  params.sign = signFlomoParams(params)

  const resp = await fetch('https://flomoapp.com/api/v1/user/login_by_email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  const data = await resp.json()
  if (data.code !== 0) {
    throw new Error(data.message || '登录失败')
  }
  return { accessToken: data.data.access_token }
})

ipcMain.handle('flomo:fetchMemos', async (_event, { accessToken, lastSyncTime }: { accessToken: string; lastSyncTime?: string }) => {
  const allMemos: any[] = []
  let latestSlug = ''
  let latestUpdatedAt = lastSyncTime || ''

  while (true) {
    const ts = String(Math.floor(Date.now() / 1000))
    const params: Record<string, string> = {
      api_key: 'flomo_web',
      app_version: '2.0',
      limit: '200',
      timestamp: ts,
      tz: '8:0',
      webp: '1',
    }
    if (latestSlug) {
      params.latest_slug = latestSlug
      params.latest_updated_at = latestUpdatedAt
    }
    params.sign = signFlomoParams(params)

    const url = `https://flomoapp.com/api/v1/memo/updated?${new URLSearchParams(params).toString()}`
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const data = await resp.json()

    if (data.code === -10) throw new Error('TOKEN_EXPIRED')
    if (data.code !== 0) throw new Error(data.message || '获取 memo 失败')

    const records = data.data || []
    allMemos.push(...records)
    if (records.length < 200) break

    const last = records[records.length - 1]
    latestSlug = last.slug
    latestUpdatedAt = last.updated_at
  }

  return { memos: allMemos }
})

ipcMain.handle('flomo:downloadImg', async (_event, { url, destPath }: { url: string; destPath: string }) => {
  try {
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const buffer = Buffer.from(await resp.arrayBuffer())
    await fsMkdir(pathDirname(destPath), { recursive: true })
    await fsWriteFile(destPath, buffer)
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
})
