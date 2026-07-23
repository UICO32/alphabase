// Must run before ANY electron import — if ELECTRON_RUN_AS_NODE is set,
// require('electron') returns the npm package path string instead of the
// built-in module, causing app/BrowserWindow to be undefined.
// NOTE: Vite/Rollup hoists require() above user code, so the renderChunk
// plugin in vite.config.ts injects this delete at the very top of the bundle.
delete process.env.ELECTRON_RUN_AS_NODE

import { app, BrowserWindow, ipcMain, dialog, protocol, shell } from 'electron'
import { startupLog } from './startupLog'
import { join, dirname, isAbsolute, relative, resolve } from 'path'
import { getRegisteredWorkspacePaths, isPathWithinWorkspace, isRegisteredWorkspaceRoot, registerWorkspacePath, isMediaFilenameSafe } from './workspacePaths'
import { isAllowedMainFrameNavigation, isAllowedWebviewUrl } from './navigationSecurity'
import { fileURLToPath, pathToFileURL } from 'url'
import { readFile, writeFile as fsWriteFile, mkdir as fsMkdir, unlink, readdir as fsReaddir, mkdir as fsMkdirDir, stat as fsStat, access, rename as fsRename, rm } from 'fs/promises'
import { dirname as pathDirname } from 'path'
import { createMenu } from './menu'
import { registerClipperHandlers } from './clipper/handler'
import { registerEmbeddingIPC, disposeEmbeddingService } from './embedding'
import { registerAISummaryIPC } from './ai'
import { createTray, setIsQuitting, getIsQuitting, destroyTray } from './tray'
import { auditWorkspaceEvent } from './workspaceAuditLog'
import { Md5 } from 'ts-md5'
import {
  createAutomaticBackup,
  exportCurrentWorkspace,
  exportExistingBackup,
  intendedExportDirectory,
  listAutomaticBackups,
  recentBackupPath,
  restoreBackup,
  validateBackupFolder,
} from './backupService'

const __dirname = dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged

// Disable crashpad to prevent Windows crash on handler disconnect
app.commandLine.appendSwitch('disable-breakpad')
app.commandLine.appendSwitch('enable-font-antialiasing', '1')
app.commandLine.appendSwitch('enable-gpu-rasterization', '1')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows', '1')
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')
app.commandLine.appendSwitch('disable-features', 'NetworkServiceSandbox')
// Run network service in-process to prevent crash/restart loop on Windows (Electron 42+)
app.commandLine.appendSwitch('force-network-service-in-process')

if (isDev) {
  app.setPath('userData', join(__dirname, '..', '.tmp', 'electron-dev-user-data'))
}

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
}

const __t0 = Date.now()
let __t1 = 0
let __t2 = 0
let dataReadyArrived = false


function logInfo(message: string) {
  try {
    if (!app.isPackaged) console.log(message)
  } catch { /* stdout pipe may be closed */ }
  startupLog(message)
}

logInfo(`[startup] main process loaded: ${__t0}`)
startupLog(`main process loaded: ${__t0}, ELECTRON_RUN_AS_NODE=${process.env.ELECTRON_RUN_AS_NODE ?? 'unset'}, app.isPackaged=${app.isPackaged}`)

let mainWindow: BrowserWindow | null = null

function authorizedWorkspacesFile() {
  return join(app.getPath('userData'), 'authorized-workspaces.json')
}

async function restoreAuthorizedWorkspaces() {
  try {
    const raw = await readFile(authorizedWorkspacesFile(), 'utf8')
    const paths: unknown = JSON.parse(raw)
    if (!Array.isArray(paths)) return
    for (const workspacePath of paths) {
      if (typeof workspacePath === 'string') registerWorkspacePath(workspacePath)
    }
  } catch {
    // No saved workspace authorization yet is expected on a first launch.
  }
}

async function authorizeWorkspacePath(workspacePath: string) {
  registerWorkspacePath(workspacePath)
  await fsWriteFile(authorizedWorkspacesFile(), JSON.stringify(getRegisteredWorkspacePaths()))
  auditWorkspaceEvent({
    source: 'main',
    action: 'workspace-authorized',
    workspacePath,
    details: { registeredCount: getRegisteredWorkspacePaths().length },
  })
}

function assertMainWindowSender(event: Electron.IpcMainInvokeEvent) {
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    throw new Error('IPC sender is not the application window')
  }
}

function getIpcCaller(event: Electron.IpcMainInvokeEvent): string {
  try {
    return event.senderFrame?.url || event.sender.getURL()
  } catch {
    return 'unknown'
  }
}

function workspaceForPath(filePath: string): string | undefined {
  const normalizedPath = resolve(filePath)
  return getRegisteredWorkspacePaths()
    .map(workspacePath => resolve(workspacePath))
    .sort((a, b) => b.length - a.length)
    .find(workspacePath =>
      normalizedPath === workspacePath
      || normalizedPath.startsWith(workspacePath + '/')
      || normalizedPath.startsWith(workspacePath + '\\')
    )
}

function auditFsIntent(event: Electron.IpcMainInvokeEvent, action: string, path: string, details?: Record<string, unknown>) {
  auditWorkspaceEvent({
    source: 'main',
    action,
    path,
    workspacePath: workspaceForPath(path),
    caller: getIpcCaller(event),
    details,
  })
}

function auditFsResult(event: Electron.IpcMainInvokeEvent, action: string, path: string, ok: boolean, error?: unknown, details?: Record<string, unknown>) {
  auditWorkspaceEvent({
    level: ok ? 'info' : 'error',
    source: 'main',
    action,
    path,
    workspacePath: workspaceForPath(path),
    caller: getIpcCaller(event),
    ok,
    error: error instanceof Error ? error.message : error ? String(error) : undefined,
    details,
  })
}

function createWindow() {
  const applicationEntryPath = join(__dirname, '../dist/index.html')
  const applicationEntryUrl = pathToFileURL(applicationEntryPath).href
  const winOptions: Electron.BrowserWindowConstructorOptions = {
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    backgroundColor: '#18181b',
    icon: join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: true,
      backgroundThrottling: false,
    },
    titleBarStyle: 'hidden',
  }

  if (process.platform === 'win32') {
    winOptions.backgroundMaterial = 'mica'
  }

  mainWindow = new BrowserWindow(winOptions)

  createMenu(mainWindow)
  registerClipperHandlers()

  // Forward renderer console.log to main process stdout in dev mode
  if (!app.isPackaged) {
    mainWindow.webContents.on('console-message', (_event, _level, message) => {
      if (message.startsWith('[startup')) {
        console.log(`[renderer] ${message}`)
      }
    })
  }

  // Write startup timing to file for CI/testing
  mainWindow.webContents.on('did-finish-load', () => {
    logInfo(`[startup] did-finish-load: ${Date.now() - __t0}ms`)
  })

  // Open DevTools only in development and when explicitly requested
  if (!app.isPackaged && process.env.HEPTA_DEVTOOLS === '1') {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('render-process-gone' as any, (_e: any, details: any) => {
    console.error('[main] render-process-gone:', JSON.stringify(details))
    startupLog(`render-process-gone: reason=${details.reason}, exitCode=${details.exitCode}`)
  })

  mainWindow.webContents.on('crashed' as any, (_e: any, killed: any) => {
    console.error('[main] webContents crashed, killed:', killed)
    startupLog(`webContents crashed: killed=${killed}`)
  })

  mainWindow.webContents.on('console-message', (_e, level, message) => {
    if (level >= 2) { // warning=2, error=3
      startupLog(`renderer console [${level}]: ${message}`)
    }
  })

  mainWindow.once('ready-to-show', () => {
    __t2 = Date.now()
    logInfo(`[startup] ready-to-show: ${__t2 - __t0}ms`)
    startupLog(`ready-to-show: ${__t2 - __t0}ms`)
    mainWindow?.show()
    // If data-ready already arrived before window was visible, dismiss splash now
    if (dataReadyArrived) {
      mainWindow?.webContents.executeJavaScript('window.__dismissSplash && window.__dismissSplash()').catch(() => {})
    }
  })

  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedMainFrameNavigation(url, process.env.VITE_DEV_SERVER_URL, applicationEntryUrl)) {
      event.preventDefault()
    }
  })

  mainWindow.webContents.on('will-attach-webview', (event, webPreferences, params) => {
    delete webPreferences.preload
    webPreferences.nodeIntegration = false
    webPreferences.nodeIntegrationInSubFrames = false
    webPreferences.contextIsolation = true
    webPreferences.sandbox = true
    webPreferences.webSecurity = true
    if (!isAllowedWebviewUrl(params.src)) event.preventDefault()
  })

  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })

  // On window close: flush pending writes, then allow close
  let pendingFlush = false
  mainWindow.on('close', (e) => {
    // 托盘模式：隐藏而非关闭（仅生产构建）
    if (app.isPackaged && !getIsQuitting() && !pendingFlush) {
      e.preventDefault()
      mainWindow?.hide()
      return
    }
    if (pendingFlush) return
    e.preventDefault()
    pendingFlush = true
    // Tell renderer to flush, wait for it to respond, then close
    mainWindow?.webContents.send('flush-before-close')
    // Wait for renderer's flush-and-close-ready IPC, with a 1s timeout fallback
    let closed = false
    const closeAfterFlush = () => {
      if (closed) return
      closed = true
      mainWindow?.close()
    }
    ipcMain.handleOnce('flush-and-close-ready', closeAfterFlush)
    setTimeout(closeAfterFlush, 1000)
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(applicationEntryPath)
  }
}

if (gotSingleInstanceLock) {
  app.whenReady().then(async () => {
  __t1 = Date.now()
  logInfo(`[startup] app.whenReady: ${__t1 - __t0}ms`)
  startupLog(`app.whenReady: ${__t1 - __t0}ms, userData=${app.getPath('userData')}`)
  await restoreAuthorizedWorkspaces()
  protocol.handle('hepta-media', async (request) => {
    try {
      const url = new URL(request.url)
      const filename = url.pathname.replace(/^\/+/, '') || url.hostname
      const requestedWorkspacePath = (url.searchParams.get('workspace') || '').split('/').join('\\')

      if (!isMediaFilenameSafe(filename)) {
        return new Response('Forbidden', { status: 403 })
      }

      const candidateWorkspaces = requestedWorkspacePath
        ? [requestedWorkspacePath]
        : getRegisteredWorkspacePaths()

      let resolvedFilePath: string | null = null
      for (const workspacePath of candidateWorkspaces) {
        const filePath = join(workspacePath, 'media', filename)
        const resolvedMediaDir = resolve(join(workspacePath, 'media'))
        const nextResolvedFilePath = resolve(filePath)
        if (
          nextResolvedFilePath !== resolvedMediaDir &&
          !nextResolvedFilePath.startsWith(resolvedMediaDir + '/') &&
          !nextResolvedFilePath.startsWith(resolvedMediaDir + '\\')
        ) {
          continue
        }

        try {
          await access(nextResolvedFilePath)
          resolvedFilePath = nextResolvedFilePath
          break
        } catch {
          continue
        }
      }

      if (!resolvedFilePath) {
        return new Response('Not found', { status: 404 })
      }

      const data = await readFile(resolvedFilePath)
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

  if (app.isPackaged) {
    createTray(mainWindow!)
  }

  ipcMain.on('startup:data-ready', () => {
    logInfo(`[startup] data-ready: ${Date.now() - __t0}ms`)
    dataReadyArrived = true
    if (mainWindow?.isVisible()) {
      mainWindow.webContents.executeJavaScript('window.__dismissSplash && window.__dismissSplash()').catch(() => {})
    }
  })

  ipcMain.on('startup:progress', (_event, data: { step: string; progress: number; total: number }) => {
    logInfo(`[startup] progress: step="${data.step}" ${data.progress}/${data.total}`)
    const stepIndex = Math.min(data.progress, data.total)
    mainWindow?.webContents.executeJavaScript(`window.__updateSplashProgress && window.__updateSplashProgress(${stepIndex})`).catch(() => {})
  })

  // Defer embedding IPC registration — onnxruntime-node is heavy (~500ms)
  setTimeout(() => {
    registerEmbeddingIPC()
    registerAISummaryIPC()
  }, 0)
  })
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  }
})

app.on('window-all-closed', () => {
  if (getIsQuitting()) {
    if (process.platform !== 'darwin') {
      setTimeout(() => app.quit(), 100)
    }
  }
})

app.on('before-quit', async () => {
  setIsQuitting(true)
  await disposeEmbeddingService()
  destroyTray()
})

// Give renderer time to flush pending writes before the window closes
ipcMain.handle('sync:flushAndQuit', async () => {
  return true
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  } else {
    mainWindow?.show()
    mainWindow?.focus()
  }
})

// IPC handlers
// Startup timing IPC
ipcMain.handle('startup:log', async (_event, data: { totalMs: number; steps: { name: string; ms: number }[] }) => {
  const wallClock = Date.now() - __t0
  logInfo(`[startup-renderer] total data load: ${data.totalMs}ms`)
  logInfo(`[startup-renderer] breakdown: ${data.steps.map(s => `${s.name}=${s.ms}`).join(', ')}`)
  logInfo(`[startup] === FULL TIMELINE ===`)
  logInfo(`[startup] main-process-loaded: 0ms`)
  logInfo(`[startup] app.whenReady: ${__t1 - __t0}ms`)
  logInfo(`[startup] ready-to-show: ${__t2 - __t0}ms`)
  logInfo(`[startup] renderer-data-ready: ${wallClock}ms (wall clock from main start)`)
  logInfo(`[startup] ==========================`)
  // Write to file for automated testing
  const report = {
    mainProcessLoaded: 0,
    appWhenReady: __t1 - __t0,
    readyToShow: __t2 - __t0,
    rendererDataReady: wallClock,
    dataLoadMs: data.totalMs,
    steps: data.steps,
    timestamp: new Date().toISOString(),
  }
  try {
    await fsWriteFile(join(app.getPath('userData'), 'startup-report.json'), JSON.stringify(report, null, 2))
  } catch { /* noop */ }
  return true
})

ipcMain.handle('fs:readFile', async (event, path: string) => {
  assertMainWindowSender(event)
  if (!isPathWithinWorkspace(path)) throw new Error(`Path outside workspace: ${path}`)
  return await readFile(path)
})

ipcMain.handle('fs:writeFile', async (event, filePath: string, data: Uint8Array | number[] | string) => {
  assertMainWindowSender(event)
  if (!isPathWithinWorkspace(filePath)) throw new Error(`Path outside workspace: ${filePath}`)
  await fsWriteFile(filePath, typeof data === 'string' ? data : Buffer.from(data))
})

ipcMain.handle('fs:deleteFile', async (event, path: string) => {
  assertMainWindowSender(event)
  if (!isPathWithinWorkspace(path)) throw new Error(`Path outside workspace: ${path}`)
  auditFsIntent(event, 'fs-deleteFile-start', path)
  try {
    await unlink(path)
    auditFsResult(event, 'fs-deleteFile-end', path, true)
  } catch (err) {
    auditFsResult(event, 'fs-deleteFile-end', path, false, err)
    throw err
  }
})

ipcMain.handle('fs:readdir', async (event, path: string) => {
  assertMainWindowSender(event)
  if (!isPathWithinWorkspace(path)) throw new Error(`Path outside workspace: ${path}`)
  return await fsReaddir(path)
})

ipcMain.handle('fs:readDirFiles', async (event, dirPath: string) => {
  assertMainWindowSender(event)
  if (!isPathWithinWorkspace(dirPath)) throw new Error(`Path outside workspace: ${dirPath}`)
  try {
    const files = await fsReaddir(dirPath)
    const jsonFiles = files.filter(f => f.endsWith('.json'))
    auditFsResult(event, 'fs-readDirFiles', dirPath, true, undefined, { fileCount: files.length, jsonFileCount: jsonFiles.length })
    const results: Record<string, string> = {}
    await Promise.all(jsonFiles.map(async file => {
      try {
        const data = await readFile(join(dirPath, file))
        results[file] = new TextDecoder().decode(data)
      } catch { /* skip unreadable files */ }
    }))
    return results
  } catch (err) {
    auditFsResult(event, 'fs-readDirFiles', dirPath, false, err)
    return null
  }
})

ipcMain.handle('fs:mkdir', async (event, path: string) => {
  assertMainWindowSender(event)
  if (!isPathWithinWorkspace(path)) throw new Error(`Path outside workspace: ${path}`)
  auditFsIntent(event, 'fs-mkdir-start', path)
  try {
    await fsMkdirDir(path, { recursive: true })
    auditFsResult(event, 'fs-mkdir-end', path, true)
  } catch (err) {
    auditFsResult(event, 'fs-mkdir-end', path, false, err)
    throw err
  }
})

ipcMain.handle('fs:stat', async (event, path: string) => {
  assertMainWindowSender(event)
  if (!isPathWithinWorkspace(path)) throw new Error(`Path outside workspace: ${path}`)
  const st = await fsStat(path)
  return { isDirectory: st.isDirectory(), size: st.size, mtimeMs: st.mtimeMs }
})

ipcMain.handle('fs:exists', async (event, filePath: string) => {
  assertMainWindowSender(event)
  if (!isPathWithinWorkspace(filePath)) {
    logInfo(`[security] fs:exists rejected path: ${filePath}`)
    throw new Error(`Path outside workspace: ${filePath}`)
  }
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
})

ipcMain.handle('fs:rename', async (event, oldPath: string, newPath: string) => {
  assertMainWindowSender(event)
  if (!isPathWithinWorkspace(oldPath) || !isPathWithinWorkspace(newPath)) throw new Error(`Path outside workspace: old=${oldPath} new=${newPath}`)
  auditWorkspaceEvent({
    source: 'main',
    action: 'fs-rename-start',
    oldPath,
    newPath,
    workspacePath: workspaceForPath(oldPath) ?? workspaceForPath(newPath),
    caller: getIpcCaller(event),
  })
  try {
    await fsRename(oldPath, newPath)
    auditWorkspaceEvent({
      source: 'main',
      action: 'fs-rename-end',
      oldPath,
      newPath,
      workspacePath: workspaceForPath(oldPath) ?? workspaceForPath(newPath),
      caller: getIpcCaller(event),
      ok: true,
    })
  } catch (err) {
    auditWorkspaceEvent({
      level: 'error',
      source: 'main',
      action: 'fs-rename-end',
      oldPath,
      newPath,
      workspacePath: workspaceForPath(oldPath) ?? workspaceForPath(newPath),
      caller: getIpcCaller(event),
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
})

ipcMain.handle('fs:rmdir', async (event, path: string) => {
  assertMainWindowSender(event)
  if (!isPathWithinWorkspace(path)) throw new Error(`Path outside workspace: ${path}`)
  auditFsIntent(event, 'fs-rmdir-start', path, { recursive: true, force: true })
  try {
    await rm(path, { recursive: true, force: true })
    auditFsResult(event, 'fs-rmdir-end', path, true, undefined, { recursive: true, force: true })
  } catch (err) {
    auditFsResult(event, 'fs-rmdir-end', path, false, err, { recursive: true, force: true })
    throw err
  }
})

ipcMain.handle('dialog:openDirectory', async (event) => {
  assertMainWindowSender(event)
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  })
  if (result.canceled) return null
  const workspacePath = result.filePaths[0]
  await authorizeWorkspacePath(workspacePath)
  return workspacePath
})

function assertWorkspaceRoot(workspacePath: string): void {
  if (!isRegisteredWorkspaceRoot(workspacePath)) {
    throw new Error(`Workspace is not authorized: ${workspacePath}`)
  }
}

ipcMain.handle('backup:selectExternal', async (event) => {
  assertMainWindowSender(event)
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
  if (result.canceled || !result.filePaths[0]) return null
  const selectedPath = result.filePaths[0]
  try {
    return { success: true, summary: await validateBackupFolder(selectedPath), path: selectedPath }
  } catch (error) {
    return {
      success: false,
      stage: 'validation',
      error: error instanceof Error ? error.message : String(error),
      path: selectedPath,
    }
  }
})

ipcMain.handle('backup:createAutomatic', async (event, workspacePath: string) => {
  assertMainWindowSender(event)
  assertWorkspaceRoot(workspacePath)
  return createAutomaticBackup(workspacePath)
})

ipcMain.handle('backup:listRecent', async (event, workspacePath: string) => {
  assertMainWindowSender(event)
  assertWorkspaceRoot(workspacePath)
  return listAutomaticBackups(workspacePath)
})

ipcMain.handle('backup:exportCurrent', async (event, workspacePath: string) => {
  assertMainWindowSender(event)
  assertWorkspaceRoot(workspacePath)
  return exportCurrentWorkspace(workspacePath, app.getPath('downloads'))
})

ipcMain.handle('backup:exportRecent', async (event, workspacePath: string, timestamp: string) => {
  assertMainWindowSender(event)
  assertWorkspaceRoot(workspacePath)
  return exportExistingBackup(recentBackupPath(workspacePath, timestamp), app.getPath('downloads'))
})

ipcMain.handle('backup:restoreExternal', async (event, workspacePath: string, sourcePath: string) => {
  assertMainWindowSender(event)
  assertWorkspaceRoot(workspacePath)
  auditWorkspaceEvent({
    source: 'main',
    action: 'backup-restore-external-start',
    workspacePath,
    path: sourcePath,
    caller: getIpcCaller(event),
  })
  const result = await restoreBackup(workspacePath, sourcePath)
  auditWorkspaceEvent({
    level: result.success ? 'info' : 'error',
    source: 'main',
    action: 'backup-restore-external-end',
    workspacePath,
    path: sourcePath,
    caller: getIpcCaller(event),
    ok: result.success,
    error: result.error,
    details: { stage: result.stage, safetyBackupPath: result.safetyBackupPath },
  })
  return result
})

ipcMain.handle('backup:restoreRecent', async (event, workspacePath: string, timestamp: string) => {
  assertMainWindowSender(event)
  assertWorkspaceRoot(workspacePath)
  const sourcePath = recentBackupPath(workspacePath, timestamp)
  auditWorkspaceEvent({
    source: 'main',
    action: 'backup-restore-recent-start',
    workspacePath,
    path: sourcePath,
    caller: getIpcCaller(event),
  })
  const result = await restoreBackup(workspacePath, sourcePath)
  auditWorkspaceEvent({
    level: result.success ? 'info' : 'error',
    source: 'main',
    action: 'backup-restore-recent-end',
    workspacePath,
    path: sourcePath,
    caller: getIpcCaller(event),
    ok: result.success,
    error: result.error,
    details: { stage: result.stage, safetyBackupPath: result.safetyBackupPath },
  })
  return result
})

ipcMain.handle('backup:openExportDirectory', async (event, directoryPath: string) => {
  assertMainWindowSender(event)
  const exportRoot = resolve(intendedExportDirectory(app.getPath('downloads')))
  const target = resolve(directoryPath)
  const rel = relative(exportRoot, target)
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Export directory is outside the backup destination')
  const error = await shell.openPath(target)
  if (error) throw new Error(error)
})

ipcMain.handle('workspace:auditEvent', async (event, payload: unknown) => {
  assertMainWindowSender(event)
  if (!payload || typeof payload !== 'object') return
  const data = payload as Record<string, unknown>
  auditWorkspaceEvent({
    level: data.level === 'warn' || data.level === 'error' ? data.level : 'info',
    source: 'renderer',
    action: typeof data.action === 'string' ? data.action : 'renderer-event',
    workspacePath: typeof data.workspacePath === 'string' ? data.workspacePath : undefined,
    path: typeof data.path === 'string' ? data.path : undefined,
    caller: getIpcCaller(event),
    ok: typeof data.ok === 'boolean' ? data.ok : undefined,
    details: data.details && typeof data.details === 'object' ? data.details as Record<string, unknown> : undefined,
    error: typeof data.error === 'string' ? data.error : undefined,
  })
})

ipcMain.handle('shell:openExternal', async (_event, url: string) => {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Disallowed protocol: ${parsed.protocol}`)
    }
  } catch (err) {
    throw new Error(`Invalid or disallowed URL: ${url}`)
  }
  await shell.openExternal(url)
})

ipcMain.handle('window:minimize', () => { mainWindow?.minimize() })
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.handle('window:close', () => { mainWindow?.close() })
ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false)

ipcMain.handle('app:readChangelog', async () => {
  try {
    const asarPath = join(process.resourcesPath, 'app.asar', 'CHANGELOG.md')
    const devPath = join(__dirname, '..', 'CHANGELOG.md')
    let useAsar = false
    try { await access(asarPath); useAsar = true } catch { useAsar = false }
    const changelogPath = useAsar ? asarPath : devPath
    startupLog(`[readChangelog] path=${changelogPath}`)
    const content = await readFile(changelogPath, 'utf-8')
    startupLog(`[readChangelog] read ${content.length} chars`)
    return content
  } catch (e: any) {
    startupLog(`[readChangelog] error: ${e.message}`)
    return ''
  }
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

  logInfo(`[flomo] fetchMemos start, lastSyncTime: ${lastSyncTime || 'none'}`)

  while (true) {
    pageCount++
    if (pageCount > MAX_PAGES) {
      logInfo(`[flomo] fetchMemos reached max pages (${MAX_PAGES}), stopping`)
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
    logInfo(`[flomo] page ${pageCount}: ${records.length} memos, total: ${allMemos.length}`)
    if (records.length < 200) break

    const last = records[records.length - 1]
    latestSlug = last.slug
    latestUpdatedAt = String(Math.floor(new Date(last.updated_at).getTime() / 1000))
  }

  logInfo(`[flomo] fetchMemos done, total: ${allMemos.length} memos`)
  return { memos: allMemos }
})

ipcMain.handle('flomo:downloadImg', async (event, { url, destPath }: { url: string; destPath: string }) => {
  assertMainWindowSender(event)
  if (!isPathWithinWorkspace(destPath)) return { success: false, error: 'Destination path outside workspace' }
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
