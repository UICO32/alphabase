import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
    it('writes cards via tmp file rename for atomic writes', async () => {
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

    it('coalesces repeated writes so the last payload wins', async () => {
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
    it('deletes cards after debounce', async () => {
      engine.scheduleDeleteCard('card-1')

      await new Promise(r => setTimeout(r, 700))

      expect(mockDeleteFile).toHaveBeenCalledWith(
        '/test-workspace/cards/card-1.json',
      )
    })
  })

  describe('drag suppression', () => {
    it('skips board writes while dragging', async () => {
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

    it('re-schedules skipped board writes after dragging stops', async () => {
      engine.setDragging(true)
      engine.scheduleWriteBoard('board-1', {
        version: 2, nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 },
      }, 0)

      await engine.flushAll()

      let boardWrites = mockWriteFile.mock.calls.filter(
        (c: string[]) => c[0].includes('board-1'),
      )
      expect(boardWrites.length).toBe(0)

      engine.setDragging(false)
      engine.scheduleWriteBoard('board-1', {
        version: 2, nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 },
      }, 0)

      await engine.flushAll()

      boardWrites = mockWriteFile.mock.calls.filter(
        (c: string[]) => c[0].includes('board-1'),
      )
      expect(boardWrites.length).toBe(1)
    })

    it('still writes cards while dragging', async () => {
      engine.setDragging(true)
      engine.scheduleWriteCard({
        id: 'card-1', title: 'Test', color: 'white', content: '[]', createdAt: 1000,
      }, 100)

      await new Promise(r => setTimeout(r, 300))

      expect(mockWriteFile).toHaveBeenCalled()
    })

    it('restores board writes after dragging stops', async () => {
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
    it('flushes every pending write immediately', async () => {
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
    it('flushes pending writes and marks the engine as stopped', async () => {
      engine.scheduleWriteCard({
        id: 'c1', title: 'A', color: 'white', content: '[]', createdAt: 1000,
      }, 5000)

      await engine.stop()

      expect(mockWriteFile).toHaveBeenCalled()
      expect(engine.isRunning()).toBe(false)
    })
  })
})
