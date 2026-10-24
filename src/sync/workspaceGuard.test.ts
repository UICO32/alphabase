import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setFSAdapter } from '../utils/workspace/fs'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { WorkspaceSyncEngine } from './syncEngine'
import { setActiveSyncEngine } from './syncEngineRef'
import { isWorkspaceActive } from './workspaceGuard'

function installPassiveAdapter() {
  setFSAdapter({
    readFile: async () => new Uint8Array(),
    writeFile: async () => {},
    deleteFile: async () => {},
    readdir: async () => [],
    readDirFiles: async () => null,
    mkdir: async () => {},
    stat: async () => ({ isDirectory: true, size: 0, mtimeMs: 1 }),
    exists: async () => true,
    rename: async () => {},
    rmdir: async () => {},
  })
}

function openWorkspace(path: string) {
  useWorkspaceStore.getState().setCurrentWorkspace({ path, name: 'ws', lastOpened: Date.now() })
}

beforeEach(() => {
  installPassiveAdapter()
  useWorkspaceStore.setState({ currentWorkspace: null, recentWorkspaces: [] })
  setActiveSyncEngine(null)
})

afterEach(() => {
  setActiveSyncEngine(null)
})

describe('isWorkspaceActive', () => {
  it('returns false before any engine is attached', () => {
    openWorkspace('D:/ws')
    expect(isWorkspaceActive('D:/ws')).toBe(false)
  })

  it('returns true when store and engine both point at the same workspace', async () => {
    const engine = new WorkspaceSyncEngine()
    await engine.init('D:/ws')
    setActiveSyncEngine(engine)
    openWorkspace('D:/ws')

    expect(isWorkspaceActive('D:/ws')).toBe(true)
  })

  it('returns false after the app switches to another workspace', async () => {
    const engine = new WorkspaceSyncEngine()
    await engine.init('D:/ws')
    setActiveSyncEngine(engine)
    openWorkspace('D:/other')

    expect(isWorkspaceActive('D:/ws')).toBe(false)
  })

  it('returns false when the captured path is empty', () => {
    expect(isWorkspaceActive('')).toBe(false)
  })
})
