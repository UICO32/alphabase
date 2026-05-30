/**
 * Electron IPC FS adapter.
 * Communicates with main process via contextBridge API.
 */
import { setFSAdapter, type FSAdapter } from './fs'

type ReadDirFilesFn = (dirPath: string) => Promise<Record<string, string> | null>

interface ElectronFS {
  readFile: (path: string) => Promise<Uint8Array>
  writeFile: (path: string, data: Uint8Array | string) => Promise<void>
  deleteFile: (path: string) => Promise<void>
  readdir: (path: string) => Promise<string[]>
  readDirFiles?: ReadDirFilesFn
  mkdir: (path: string) => Promise<void>
  stat: (path: string) => Promise<{ isDirectory: boolean; size: number; mtimeMs: number }>
  exists: (path: string) => Promise<boolean>
  rename: (oldPath: string, newPath: string) => Promise<void>
  rmdir: (path: string) => Promise<void>
}

const electronAPI = (window as unknown as { electronAPI?: { fs: ElectronFS } }).electronAPI

export function initElectronFSAdapter() {
  if (!electronAPI?.fs) {
    return false
  }

  const rawFs = electronAPI.fs
  const adapter: FSAdapter = {
    readFile: (path) => rawFs.readFile(path),
    writeFile: (path, data) => rawFs.writeFile(path, data),
    deleteFile: (path) => rawFs.deleteFile(path),
    readdir: (path) => rawFs.readdir(path),
    readDirFiles: rawFs.readDirFiles ? rawFs.readDirFiles : async () => null,
    mkdir: (path) => rawFs.mkdir(path),
    stat: (path) => rawFs.stat(path),
    exists: (path) => rawFs.exists(path),
    rename: (oldPath, newPath) => rawFs.rename(oldPath, newPath),
    rmdir: (path) => rawFs.rmdir(path),
  }

  setFSAdapter(adapter)
  return true
}
