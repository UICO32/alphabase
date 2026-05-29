import { app, BrowserWindow, ipcMain, dialog, protocol } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readFile, writeFile as fsWriteFile, mkdir as fsMkdir } from 'fs/promises'
import { dirname as pathDirname } from 'path'
import { createMenu } from './menu'
import { registerClipperHandlers } from './clipper/handler'
import { registerEmbeddingIPC, disposeEmbeddingService } from './embedding'
import { Md5 } from 'ts-md5'

// Disable crashpad to prevent Windows crash on handler disconnect
app.commandLine.appendSwitch('disable-breakpad')

const __dirname = dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    icon: join(__dirname, '..', 'build', 'icon.ico'),
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
  registerEmbeddingIPC()

  // Open DevTools only in development
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

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
      // hepta-media://filename?workspace=... — filename is parsed as hostname, not pathname
      const filename = url.pathname.replace(/^\/+/, '') || url.hostname
      const workspacePath = (url.searchParams.get('workspace') || '').split('/').join('\\')
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

app.on('before-quit', async () => {
  await disposeEmbeddingService()
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
  let latestUpdatedAt = ''
  let pageCount = 0
  const MAX_PAGES = 100

  console.log(`[flomo] fetchMemos start, lastSyncTime: ${lastSyncTime || 'none'}`)

  while (true) {
    pageCount++
    if (pageCount > MAX_PAGES) {
      console.log(`[flomo] fetchMemos reached max pages (${MAX_PAGES}), stopping`)
      break
    }

    const ts = String(Math.floor(Date.now() / 1000))
    const params: Record<string, string> = {
      api_key: 'flomo_web',
      app_version: '2.0',
      limit: '200',
      timestamp: ts,
      tz: '8:0',
      webp: '1',
    }
    if (pageCount > 1 && latestSlug) {
      params.latest_slug = latestSlug
      params.latest_updated_at = latestUpdatedAt
    }
    params.sign = signFlomoParams(params)

    const url = `https://flomoapp.com/api/v1/memo/updated?${new URLSearchParams(params).toString()}`
    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })
    const text = await resp.text()
    let data: any
    try {
      data = JSON.parse(text)
    } catch {
      console.error(`[flomo] fetchMemos response: ${text.slice(0, 500)}`)
      throw new Error('flomo API 返回非 JSON 数据')
    }

    if (data.code === -10) throw new Error('TOKEN_EXPIRED')
    if (data.code !== 0) throw new Error(data.message || '获取 memo 失败')

    const records = data.data || []
    allMemos.push(...records)
    console.log(`[flomo] page ${pageCount}: ${records.length} memos, total: ${allMemos.length}`)
    if (records.length < 200) break

    const last = records[records.length - 1]
    latestSlug = last.slug
    latestUpdatedAt = String(Math.floor(new Date(last.updated_at).getTime() / 1000))
  }

  console.log(`[flomo] fetchMemos done, total: ${allMemos.length} memos`)
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
