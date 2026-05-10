/**
 * Electron IPC FS adapter.
 * Communicates with main process via contextBridge API.
 */
import { setFSAdapter, type FSAdapter } from './fs'

const electronAPI = (window as unknown as { electronAPI?: { fs: FSAdapter } }).electronAPI

export function initElectronFSAdapter() {
  if (!electronAPI?.fs) {
    console.warn('Electron FS adapter not available, using fallback')
    return false
  }

  setFSAdapter(electronAPI.fs)
  return true
}
