// Must run before ANY electron import — if ELECTRON_RUN_AS_NODE is set,
// require('electron') returns the npm package path string instead of the
// built-in module, causing contextBridge/ipcRenderer to be undefined.
delete process.env.ELECTRON_RUN_AS_NODE

import { contextBridge, ipcRenderer, webUtils } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  fs: {
    readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
    writeFile: (path: string, data: Uint8Array | string) => ipcRenderer.invoke('fs:writeFile', path, data),
    deleteFile: (path: string) => ipcRenderer.invoke('fs:deleteFile', path),
    readdir: (path: string) => ipcRenderer.invoke('fs:readdir', path),
    readDirFiles: (dirPath: string) => ipcRenderer.invoke('fs:readDirFiles', dirPath),
    mkdir: (path: string) => ipcRenderer.invoke('fs:mkdir', path),
    stat: (path: string) => ipcRenderer.invoke('fs:stat', path),
    exists: (path: string) => ipcRenderer.invoke('fs:exists', path),
    rename: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:rename', oldPath, newPath),
    rmdir: (path: string) => ipcRenderer.invoke('fs:rmdir', path),
  },
  media: {
    store: (workspacePath: string, input: { bytes: Uint8Array; mimeType: string; name: string }) =>
      ipcRenderer.invoke('media:store', workspacePath, input),
    storeFile: (workspacePath: string, file: File) => {
      const sourcePath = webUtils.getPathForFile(file)
      if (!sourcePath) return Promise.resolve(null)
      return ipcRenderer.invoke('media:storeFile', workspacePath, {
        sourcePath,
        mimeType: file.type,
        name: file.name,
      })
    },
  },
  dialog: {
    openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  },
  backup: {
    selectExternal: () => ipcRenderer.invoke('backup:selectExternal'),
    createAutomatic: (workspacePath: string) => ipcRenderer.invoke('backup:createAutomatic', workspacePath),
    listRecent: (workspacePath: string) => ipcRenderer.invoke('backup:listRecent', workspacePath),
    exportCurrent: (workspacePath: string) => ipcRenderer.invoke('backup:exportCurrent', workspacePath),
    exportRecent: (workspacePath: string, timestamp: string) => ipcRenderer.invoke('backup:exportRecent', workspacePath, timestamp),
    restoreExternal: (workspacePath: string, sourcePath: string) => ipcRenderer.invoke('backup:restoreExternal', workspacePath, sourcePath),
    restoreRecent: (workspacePath: string, timestamp: string) => ipcRenderer.invoke('backup:restoreRecent', workspacePath, timestamp),
    openExportDirectory: (directoryPath: string) => ipcRenderer.invoke('backup:openExportDirectory', directoryPath),
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  },
  clipper: {
    clip: (url: string, workspacePath?: string) => ipcRenderer.invoke('clipper:clip', { url, workspacePath }),
    agentReachBrowse: (req: any) => ipcRenderer.invoke('clipper:agentReachBrowse', req),
  },
  flomo: {
    login: (email: string, password: string) => ipcRenderer.invoke('flomo:login', { email, password }),
    fetchMemos: (accessToken: string, lastSyncTime?: string) => ipcRenderer.invoke('flomo:fetchMemos', { accessToken, lastSyncTime }),
    downloadImg: (url: string, destPath: string) => ipcRenderer.invoke('flomo:downloadImg', { url, destPath }),
  },
  embedding: {
    init: (workspacePath: string) => ipcRenderer.invoke('embedding:init', workspacePath),
    retryInit: () => ipcRenderer.invoke('embedding:retryInit'),
    indexAll: () => ipcRenderer.invoke('embedding:indexAll'),
    indexCard: (cardId: string) => ipcRenderer.invoke('embedding:indexCard', cardId),
    removeVector: (cardId: string) => ipcRenderer.invoke('embedding:removeVector', cardId),
    cluster: (minClusterSize?: number) => ipcRenderer.invoke('embedding:cluster', minClusterSize),
    search: (cardId: string, topK?: number) => ipcRenderer.invoke('embedding:search', { cardId, topK }),
    searchByText: (query: string, topK?: number) => ipcRenderer.invoke('embedding:searchByText', { query, topK }),
    cancel: () => ipcRenderer.invoke('embedding:cancel'),
    getStatus: () => ipcRenderer.invoke('embedding:getStatus'),
    checkModel: () => ipcRenderer.invoke('embedding:checkModel'),
    setThreshold: (value: number) => ipcRenderer.invoke('embedding:setThreshold', { value }),
    downloadModel: () => ipcRenderer.invoke('embedding:downloadModel'),
    cancelDownload: () => ipcRenderer.invoke('embedding:cancelDownload'),
    getDownloadConfig: () => ipcRenderer.invoke('embedding:getDownloadConfig'),
    onProgress: (callback: (data: any) => void) => {
      const handler = (_e: any, data: any) => callback(data)
      ipcRenderer.on('embedding:progress', handler)
      return () => ipcRenderer.removeListener('embedding:progress', handler as any)
    },
    onComplete: (callback: (data: any) => void) => {
      const handler = (_e: any, data: any) => callback(data)
      ipcRenderer.on('embedding:complete', handler)
      return () => ipcRenderer.removeListener('embedding:complete', handler as any)
    },
    onError: (callback: (data: any) => void) => {
      const handler = (_e: any, data: any) => callback(data)
      ipcRenderer.on('embedding:error', handler)
      return () => ipcRenderer.removeListener('embedding:error', handler as any)
    },
    onDownloadProgress: (callback: (data: { progress: number; currentFile: string }) => void) => {
      const handler = (_e: any, data: any) => callback(data)
      ipcRenderer.on('embedding:download-progress', handler)
      return () => ipcRenderer.removeListener('embedding:download-progress', handler as any)
    },
    onDownloadComplete: (callback: (data: { success: boolean }) => void) => {
      const handler = (_e: any, data: any) => callback(data)
      ipcRenderer.on('embedding:download-complete', handler)
      return () => ipcRenderer.removeListener('embedding:download-complete', handler as any)
    },
    onDownloadError: (callback: (data: { message: string; cancelled?: boolean }) => void) => {
      const handler = (_e: any, data: any) => callback(data)
      ipcRenderer.on('embedding:download-error', handler)
      return () => ipcRenderer.removeListener('embedding:download-error', handler as any)
    },
  },
  ai: {
    generateSummary: (content: string, format?: string, customQuestion?: string) => ipcRenderer.invoke('ai:generateSummary', content, format, customQuestion),
    generateClusterName: (titles: string[]) => ipcRenderer.invoke('ai:generateClusterName', titles),
    getConfig: () => ipcRenderer.invoke('ai:getConfig'),
    setConfig: (config: any) => ipcRenderer.invoke('ai:setConfig', config),
    testConnection: () => ipcRenderer.invoke('ai:testConnection'),
    onSummaryChunk: (callback: (data: { chunk: string }) => void) => {
      const handler = (_e: any, data: any) => callback(data)
      ipcRenderer.on('ai:summary-chunk', handler)
      return () => ipcRenderer.removeListener('ai:summary-chunk', handler as any)
    },
    onSummaryComplete: (callback: (data: { summary: string }) => void) => {
      const handler = (_e: any, data: any) => callback(data)
      ipcRenderer.on('ai:summary-complete', handler)
      return () => ipcRenderer.removeListener('ai:summary-complete', handler as any)
    },
    onSummaryError: (callback: (data: { message: string }) => void) => {
      const handler = (_e: any, data: any) => callback(data)
      ipcRenderer.on('ai:summary-error', handler)
      return () => ipcRenderer.removeListener('ai:summary-error', handler as any)
    },
  },
  startup: {
    log: (data: any) => ipcRenderer.invoke('startup:log', data),
    notifyProgress: (data: { step: string; progress: number; total: number }) => {
      ipcRenderer.send('startup:progress', data)
    },
    notifyDataReady: () => {
      ipcRenderer.send('startup:data-ready')
    },
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    readChangelog: () => ipcRenderer.invoke('app:readChangelog'),
  },
  workspace: {
    auditEvent: (payload: any) => ipcRenderer.invoke('workspace:auditEvent', payload),
  },
  onFlushBeforeClose: (callback: () => Promise<void>) => {
    ipcRenderer.on('flush-before-close', async () => {
      await callback()
      ipcRenderer.invoke('flush-and-close-ready')
    })
    return () => ipcRenderer.removeAllListeners('flush-before-close')
  },
})
