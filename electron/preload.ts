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
})
