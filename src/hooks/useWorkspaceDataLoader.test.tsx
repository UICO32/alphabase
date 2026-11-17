// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// 加载流程的重依赖全部替身化：这里要验证的是“连续切换时只有最新运行能写 store/引擎”，
// 而不是真实文件读写。
const h = vi.hoisted(() => ({
  gatedPath: null as string | null,
  gate: null as Promise<void> | null,
  release: null as (() => void) | null,
  discardedEngines: [] as string[],
  createdEngines: [] as string[],
}))

vi.mock('../services/WorkspaceService', () => {
  class WorkspaceService {
    private path = ''
    setWorkspacePath(path: string) { this.path = path }
    async loadManifest() {
      return { boards: [{ id: `board-${this.path}`, name: this.path, createdAt: 1, updatedAt: 1 }] }
    }
    async loadAllCards() {
      if (h.gatedPath === this.path && h.gate) await h.gate
      return []
    }
    async loadMetadata() { return null }
    async loadAllProjects() { return new Map() }
    async loadAllBoards() { return new Map() }
    async loadAllTrash() { return [] }
    async cleanExpiredTrash() {}
    async saveMetadata() {}
  }
  return { WorkspaceService }
})

vi.mock('../sync/syncEngine', () => {
  class WorkspaceSyncEngine {
    private path = ''
    async init(path: string) {
      this.path = path
      h.createdEngines.push(path)
    }
    discard() { h.discardedEngines.push(this.path) }
    async stop() {}
    async flushAll() {}
    scheduleWriteBoard() {}
    scheduleWriteCard() {}
    getWorkspacePath() { return this.path }
    isRunning() { return true }
  }
  return { WorkspaceSyncEngine }
})

vi.mock('../utils/workspace', () => ({
  initElectronFSAdapter: vi.fn(async () => {}),
  cardFileToGlobalCard: (card: unknown) => card,
}))

vi.mock('../utils/workspace/fs', () => ({
  exists: vi.fn(async () => false),
  readFile: vi.fn(async () => ''),
  writeFile: vi.fn(async () => {}),
  deleteFile: vi.fn(async () => {}),
  readdir: vi.fn(async () => []),
  readDirFiles: vi.fn(async () => null),
  mkdir: vi.fn(async () => {}),
  stat: vi.fn(async () => ({ isDirectory: false, size: 0, mtimeMs: 0 })),
  rename: vi.fn(async () => {}),
  rmdir: vi.fn(async () => {}),
  readJSON: vi.fn(async () => null),
  writeJSON: vi.fn(async () => {}),
}))

vi.mock('../utils/workspace/audit', () => ({
  auditWorkspaceEvent: vi.fn(),
  auditWorkspaceHealth: vi.fn(async () => {}),
}))

vi.mock('../utils/workspace/migrateFromLocalStorage', () => ({
  migrateFromLocalStorageIfNeeded: vi.fn(),
}))

vi.mock('../stores/backupStore', () => ({
  createFileSystemBackup: vi.fn(async () => null),
  startAutoBackup: vi.fn(),
  stopAutoBackup: vi.fn(),
  listFileSystemBackups: vi.fn(async () => []),
  restoreFromBackup: vi.fn(async () => ({ success: true })),
  getFileSystemBackupSummary: vi.fn(async () => null),
  listRestoreResidues: vi.fn(async () => []),
}))

vi.mock('../media/migrateInlineImages', () => ({
  migrateInlineImagesForWorkspace: vi.fn(async () => ({ changed: false, content: '' })),
}))

vi.mock('../media/migrateInlineMediaNodes', () => ({
  hasInlineMediaNodes: () => false,
  migrateInlineMediaNodes: vi.fn(async () => ({ changed: false, nodes: [] })),
}))

vi.mock('../media/imagePipeline', () => ({
  storeImageDataUrlForWorkspace: vi.fn(async () => null),
}))

vi.mock('../components/editor/cardEditorLoader', () => ({
  preloadCardEditor: vi.fn(),
}))

vi.mock('../platform/electronCapabilities', () => ({
  getStartupCapabilities: () => ({ ok: false, reason: 'unavailable' }),
  getElectronCapabilities: () => ({ ok: false, reason: 'unavailable' }),
}))

vi.mock('../utils/notify', () => ({
  notifyError: vi.fn(),
}))

vi.mock('../stores/embeddingStore', () => ({
  embeddingStore: {
    getState: () => ({
      initAndEnsureIndexed: vi.fn(async () => {}),
      indexCardDebounced: vi.fn(),
    }),
  },
}))

import { useWorkspaceDataLoader } from './useWorkspaceDataLoader'
import { emit } from '../stores/eventBus'
import { useBoardStore } from '../stores/boardStore'
import { useCardStore } from '../stores/cardStore'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { getActiveSyncEngine, setActiveSyncEngine } from '../sync/syncEngineRef'

const LAST_WORKSPACE_KEY = 'hepta-last-workspace-path'
const WORKSPACE_A = 'D:/ws-a'
const WORKSPACE_B = 'D:/ws-b'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((r) => { resolve = r })
  return { promise, resolve }
}

async function flush() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

beforeEach(() => {
  h.gatedPath = null
  h.gate = null
  h.release = null
  h.discardedEngines.length = 0
  h.createdEngines.length = 0
  localStorage.setItem(LAST_WORKSPACE_KEY, WORKSPACE_A)
  useBoardStore.setState({ boards: [], activeBoardId: null, isLoaded: false, boardData: {} })
  useCardStore.setState({ cards: {}, isLoaded: false })
})

afterEach(() => {
  cleanup()
  setActiveSyncEngine(null)
  useWorkspaceStore.getState().setCurrentWorkspace(null)
  localStorage.removeItem(LAST_WORKSPACE_KEY)
})

describe('useWorkspaceDataLoader 连续切换工作区', () => {
  it('旧运行在切换后放弃，不覆盖新工作区的 store 与引擎', async () => {
    const gate = deferred()
    h.gatedPath = WORKSPACE_A
    h.gate = gate.promise
    h.release = gate.resolve

    const { result } = renderHook(() => useWorkspaceDataLoader())
    await flush()

    // 第一次加载卡在读卡片阶段（模拟慢磁盘）。
    expect(h.createdEngines).toEqual([WORKSPACE_A])

    // 用户改选 B：新的切换作废在途运行 A。
    await act(async () => {
      emit('reinit-workspace', { path: WORKSPACE_B })
    })
    await flush()

    expect(h.createdEngines).toEqual([WORKSPACE_A, WORKSPACE_B])
    expect(useBoardStore.getState().boards.map(board => board.id)).toEqual([`board-${WORKSPACE_B}`])
    expect(getActiveSyncEngine()?.getWorkspacePath()).toBe(WORKSPACE_B)
    expect(result.current.dataReady).toBe(true)

    // 放行 A：它必须自行放弃，不得写回 store 或抢走引擎。
    await act(async () => {
      h.release!()
      await gate.promise
    })
    await flush()

    expect(h.discardedEngines).toContain(WORKSPACE_A)
    expect(useBoardStore.getState().boards.map(board => board.id)).toEqual([`board-${WORKSPACE_B}`])
    expect(getActiveSyncEngine()?.getWorkspacePath()).toBe(WORKSPACE_B)
    expect(useCardStore.getState().isLoaded).toBe(true)
  })
})
