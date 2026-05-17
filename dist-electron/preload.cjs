"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  fs: {
    readFile: (path) => electron.ipcRenderer.invoke("fs:readFile", path),
    writeFile: (path, data) => electron.ipcRenderer.invoke("fs:writeFile", path, data),
    deleteFile: (path) => electron.ipcRenderer.invoke("fs:deleteFile", path),
    readdir: (path) => electron.ipcRenderer.invoke("fs:readdir", path),
    mkdir: (path) => electron.ipcRenderer.invoke("fs:mkdir", path),
    stat: (path) => electron.ipcRenderer.invoke("fs:stat", path),
    exists: (path) => electron.ipcRenderer.invoke("fs:exists", path),
    rename: (oldPath, newPath) => electron.ipcRenderer.invoke("fs:rename", oldPath, newPath),
    rmdir: (path) => electron.ipcRenderer.invoke("fs:rmdir", path)
  },
  dialog: {
    openDirectory: () => electron.ipcRenderer.invoke("dialog:openDirectory")
  },
  clipper: {
    clip: (url, workspacePath) => electron.ipcRenderer.invoke("clipper:clip", { url, workspacePath })
  },
  flomo: {
    login: (email, password) => electron.ipcRenderer.invoke("flomo:login", { email, password }),
    fetchMemos: (accessToken, lastSyncTime) => electron.ipcRenderer.invoke("flomo:fetchMemos", { accessToken, lastSyncTime }),
    downloadImg: (url, destPath) => electron.ipcRenderer.invoke("flomo:downloadImg", { url, destPath })
  }
});
