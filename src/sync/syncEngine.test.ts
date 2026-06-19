import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WorkspaceSyncEngine } from './syncEngine'

const {
  mockWriteFile,
  mockDeleteFile,
  mockExists,
  mockMkdir,
  mockRename,
} = vi.hoisted(() => ({
  mockWriteFile: vi.fn().mockResolvedValue(undefined),
  mockDeleteFile: vi.fn().mockResolvedValue(undefined),
  mockExists: vi.fn().mockResolvedValue(true),
  mockMkdir: vi.fn().mockResolvedValue(undefined),
  mockRename: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../utils/workspace/fs', () => ({
  writeFile: mockWriteFile,
  deleteFile: mockDeleteFile,
  exists: mockExists,
  mkdir: mockMkdir,
  rename: mockRename,
}))

vi.mock('../stores/eventBus', () => {
  const mockEmit = vi.fn()
  const mockOn = vi.fn(() => vi.fn())
  return {
    emit: mockEmit,
    on: mockOn,
    useEventBus: { getState: () => ({ emit: mockEmit, on: mockOn }) },
  }
})

describe('WorkspaceSyncEngine', () => {
  let engine: WorkspaceSyncEngine

  beforeEach(async () => {
    vi.clearAllMocks()
    engine = new WorkspaceSyncEngine()
    await engine.init('/test-workspace')
  })

  afterEach(async () => {
    await engine.stop()
  })

  describe('scheduleWriteCard', () => {
    it('防抖后应调用 writeFile + rename（原子写入）', async () => {
      engine.scheduleWriteCard({
        id: 'card-1',
        title: 'Test',
        color: 'white',
        content: '[]',
        createdAt: 1000,
      }, 100)

      await new Promise(r => setTimeout(r, 300))

      expect(mockWriteFile).toHaveBeenCalledWith(
        '/test-workspace/cards/card-1.json.tmp',
        expect.any(String),
      )
      expect(mockRename).toHaveBeenCalledWith(
        '/test-workspace/cards/card-1.json.tmp',
        '/test-workspace/cards/card-1.json',
      )
    })

    it('重复 scheduleWrite 应合并（后者覆盖）', async () => {
      engine.scheduleWriteCard({
        id: 'card-1', title: 'v1', color: 'white', content: '[]', createdAt: 1000,
      }, 100)
      engine.scheduleWriteCard({
        id: 'card-1', title: 'v2', color: 'white', content: '[]', createdAt: 1000,
      }, 100)

      await new Promise(r => setTimeout(r, 300))

      const writeCalls = mockWriteFile.mock.calls.filter(
        (c: string[]) => c[0].includes('card-1.json.tmp'),
      )
      expect(writeCalls.length).toBe(1)
      expect(JSON.parse(writeCalls[0][1]).title).toBe('v2')
    })
  })

  describe('scheduleDeleteCard', () => {
    it('防抖后应调用 deleteFile', async () => {
      engine.scheduleDeleteCard('card-1')

      await new Promise(r => setTimeout(r, 700))

      expect(mockDeleteFile).toHaveBeenCalledWith(
        '/test-workspace/cards/card-1.json',
      )
    })
  })

  describe('拖拽抑制', () => {
    it('isDragging 时 board 不应写入', async () => {
      engine.setDragging(true)
      engine.scheduleWriteBoard('board-1', {
        version: 2, nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 },
      })

      await new Promise(r => setTimeout(r, 100))

      const boardWrites = mockWriteFile.mock.calls.filter(
        (c: string[]) => c[0].includes('board-1'),
      )
      expect(boardWrites.length).toBe(0)
    })

    it('isDragging 时 card 仍应写入', async () => {
      engine.setDragging(true)
      engine.scheduleWriteCard({
        id: 'card-1', title: 'Test', color: 'white', content: '[]', createdAt: 1000,
      }, 100)

      await new Promise(r => setTimeout(r, 300))

      expect(mockWriteFile).toHaveBeenCalled()
    })

    it('拖拽结束后 board 应恢复写入', async () => {
      engine.setDragging(true)
      engine.setDragging(false)
      engine.scheduleWriteBoard('board-1', {
        version: 2, nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 },
      }, 100)

      await new Promise(r => setTimeout(r, 300))

      const boardWrites = mockWriteFile.mock.calls.filter(
        (c: string[]) => c[0].includes('board-1'),
      )
      expect(boardWrites.length).toBe(1)
    })
  })

  describe('flushAll', () => {
    it('应立即写入所有 pending', async () => {
      engine.scheduleWriteCard({
        id: 'c1', title: 'A', color: 'white', content: '[]', createdAt: 1000,
      }, 5000)
      engine.scheduleWriteCard({
        id: 'c2', title: 'B', color: 'white', content: '[]', createdAt: 1000,
      }, 5000)

      await engine.flushAll()

      expect(mockWriteFile).toHaveBeenCalledTimes(2)
    })
  })

  describe('stop', () => {
    it('应调用 flushAll 并停止运行', async () => {
      engine.scheduleWriteCard({
        id: 'c1', title: 'A', color: 'white', content: '[]', createdAt: 1000,
      }, 5000)

      await engine.stop()

      expect(mockWriteFile).toHaveBeenCalled()
      expect(engine.isRunning()).toBe(false)
    })
  })
})
