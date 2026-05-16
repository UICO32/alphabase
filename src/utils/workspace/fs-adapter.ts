/**
 * Electron IPC FS adapter.
 * Communicates with main process via contextBridge API.
 */
import { setFSAdapter, type FSAdapter } from './fs'

const electronAPI = (window as unknown as { electronAPI?: { fs: FSAdapter } }).electronAPI

export function initElectronFSAdapter() {
  console.log('initElectronFSAdapter called, electronAPI:', !!electronAPI, 'fs:', !!electronAPI?.fs)
  if (!electronAPI?.fs) {
    console.warn('Electron FS adapter not available, using fallback')
    return false
  }

  setFSAdapter(electronAPI.fs)
  console.log('Electron FS adapter set successfully')
  return true
}
