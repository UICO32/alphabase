import { describe, expect, it } from 'vitest'
import { setFSAdapter } from '../utils/workspace/fs'
import type { CardFile } from '../utils/workspace/types'
import { WorkspaceSyncEngine } from './syncEngine'

function installRecordingAdapter(writes: string[]) {
  setFSAdapter({
    readFile: async () => new Uint8Array(),
    writeFile: async (path) => { writes.push(path) },
    deleteFile: async (path) => { writes.push(`delete:${path}`) },
    readdir: async () => [],
    readDirFiles: async () => null,
    mkdir: async () => {},
    stat: async () => ({ isDirectory: false, size: 0, mtimeMs: 0 }),
    exists: async () => false,
    rename: async (from, to) => { writes.push(`rename:${from}->${to}`) },
    rmdir: async () => {},
  })
}

const card: CardFile = {
  id: 'card-1',
  content: '[]',
  color: 'white',
  title: '卡片',
  createdAt: 1,
  updatedAt: 1,
} as CardFile

describe('WorkspaceSyncEngine discard', () => {
  it('exposes the workspace path it was initialized with', async () => {
    installRecordingAdapter([])
    const engine = new WorkspaceSyncEngine()
    await engine.init('D:/ws')
    expect(engine.getWorkspacePath()).toBe('D:/ws')
  })

  it('drops pending writes without touching the disk', async () => {
    const writes: string[] = []
    installRecordingAdapter(writes)
    const engine = new WorkspaceSyncEngine()
    await engine.init('D:/ws')

    engine.scheduleWriteCard(card, 30)
    engine.discard()
    await new Promise(resolve => setTimeout(resolve, 60))

    expect(writes).toEqual([])
    expect(engine.isRunning()).toBe(false)
  })
})
