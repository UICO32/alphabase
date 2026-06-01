import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useBoardStore } from './boardStore'
import type { BoardMeta } from '../utils/workspace/types'

vi.mock('../sync/syncEngineRef', () => ({
  flushActiveSyncEngine: vi.fn(),
}))

import { flushActiveSyncEngine } from '../sync/syncEngineRef'

function makeBoard(overrides: Partial<BoardMeta> = {}): BoardMeta {
  return {
    id: 'board-1',
    name: '测试画板',
    createdAt: 1000,
    updatedAt: 2000,
    ...overrides,
  }
}

describe('BoardStore', () => {
  beforeEach(() => {
    useBoardStore.setState({
      boards: [],
      activeBoardId: null,
      isLoaded: false,
      boardData: {},
    })
    vi.mocked(flushActiveSyncEngine).mockClear()
  })

  describe('setBoards', () => {
    it('应设置 boards 并标记 isLoaded', () => {
      const boards = [makeBoard()]
      useBoardStore.getState().setBoards(boards)
      expect(useBoardStore.getState().boards).toEqual(boards)
      expect(useBoardStore.getState().isLoaded).toBe(true)
    })
  })

  describe('addBoard', () => {
    it('应追加到 boards 数组', () => {
      useBoardStore.getState().setBoards([makeBoard({ id: 'b1' })])
      useBoardStore.getState().addBoard(makeBoard({ id: 'b2' }))
      expect(useBoardStore.getState().boards).toHaveLength(2)
    })

    it('应调用 flushActiveSyncEngine', () => {
      useBoardStore.getState().addBoard(makeBoard())
      expect(flushActiveSyncEngine).toHaveBeenCalled()
    })
  })

  describe('updateBoard', () => {
    it('应更新指定画板属性', () => {
      useBoardStore.getState().setBoards([makeBoard()])
      useBoardStore.getState().updateBoard('board-1', { name: '新名称' })
      expect(useBoardStore.getState().boards[0].name).toBe('新名称')
    })

    it('不应影响其他画板', () => {
      useBoardStore.getState().setBoards([
        makeBoard({ id: 'b1', name: 'A' }),
        makeBoard({ id: 'b2', name: 'B' }),
      ])
      useBoardStore.getState().updateBoard('b1', { name: 'A+' })
      expect(useBoardStore.getState().boards[1].name).toBe('B')
    })
  })

  describe('deleteBoard', () => {
    it('应从 boards 移除', () => {
      useBoardStore.getState().setBoards([makeBoard()])
      useBoardStore.getState().deleteBoard('board-1')
      expect(useBoardStore.getState().boards).toHaveLength(0)
    })

    it('应清除对应 boardData', () => {
      useBoardStore.getState().setBoards([makeBoard()])
      useBoardStore.getState().saveBoardData('board-1', { nodes: [], edges: [] })
      useBoardStore.getState().deleteBoard('board-1')
      expect(useBoardStore.getState().boardData['board-1']).toBeUndefined()
    })

    it('删除当前活跃画板应重置 activeBoardId', () => {
      useBoardStore.getState().setBoards([makeBoard()])
      useBoardStore.getState().setActiveBoard('board-1')
      useBoardStore.getState().deleteBoard('board-1')
      expect(useBoardStore.getState().activeBoardId).toBeNull()
    })

    it('删除非活跃画板不应影响 activeBoardId', () => {
      useBoardStore.getState().setBoards([
        makeBoard({ id: 'b1' }),
        makeBoard({ id: 'b2' }),
      ])
      useBoardStore.getState().setActiveBoard('b1')
      useBoardStore.getState().deleteBoard('b2')
      expect(useBoardStore.getState().activeBoardId).toBe('b1')
    })
  })

  describe('setActiveBoard', () => {
    it('应设置 activeBoardId', () => {
      useBoardStore.getState().setActiveBoard('board-1')
      expect(useBoardStore.getState().activeBoardId).toBe('board-1')
    })

    it('传 null 应重置', () => {
      useBoardStore.getState().setActiveBoard('board-1')
      useBoardStore.getState().setActiveBoard(null)
      expect(useBoardStore.getState().activeBoardId).toBeNull()
    })
  })

  describe('boardData', () => {
    it('saveBoardData + getBoardData 应存取一致', () => {
      const data = { nodes: [{ id: 'n1', type: 'card', position: { x: 0, y: 0 }, data: {} }], edges: [] }
      useBoardStore.getState().saveBoardData('board-1', data)
      expect(useBoardStore.getState().getBoardData('board-1')).toEqual(data)
    })

    it('getBoardData 不存在时应返回 undefined', () => {
      expect(useBoardStore.getState().getBoardData('nonexistent')).toBeUndefined()
    })
  })
})
