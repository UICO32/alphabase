import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  fs: {
    readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
    writeFile: (path: string, data: string) => ipcRenderer.invoke('fs:writeFile', path, data),
    deleteFile: (path: string) => ipcRenderer.invoke('fs:deleteFile', path),
    readdir: (path: string) => ipcRenderer.invoke('fs:readdir', path),
    mkdir: (path: string) => ipcRenderer.invoke('fs:mkdir', path),
    stat: (path: string) => ipcRenderer.invoke('fs:stat', path),
    exists: (path: string) => ipcRenderer.invoke('fs:exists', path),
    rename: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:rename', oldPath, newPath),
    rmdir: (path: string) => ipcRenderer.invoke('fs:rmdir', path),
  },
  dialog: {
    openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  },
  clipper: {
    clip: (url: string, workspacePath?: string) => ipcRenderer.invoke('clipper:clip', { url, workspacePath }),
  },
  flomo: {
    login: (email: string, password: string) => ipcRenderer.invoke('flomo:login', { email, password }),
    fetchMemos: (accessToken: string, lastSyncTime?: string) => ipcRenderer.invoke('flomo:fetchMemos', { accessToken, lastSyncTime }),
    downloadImg: (url: string, destPath: string) => ipcRenderer.invoke('flomo:downloadImg', { url, destPath }),
  },
  embedding: {
    init: (workspacePath: string) => ipcRenderer.invoke('embedding:init', workspacePath),
    indexAll: () => ipcRenderer.invoke('embedding:indexAll'),
    search: (cardId: string, topK?: number) => ipcRenderer.invoke('embedding:search', { cardId, topK }),
    cancel: () => ipcRenderer.invoke('embedding:cancel'),
    getStatus: () => ipcRenderer.invoke('embedding:getStatus'),
    checkModel: () => ipcRenderer.invoke('embedding:checkModel'),
    setThreshold: (value: number) => ipcRenderer.invoke('embedding:setThreshold', { value }),
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
  },
})
