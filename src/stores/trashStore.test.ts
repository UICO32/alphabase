import { describe, it, expect, beforeEach } from 'vitest'
import { useTrashStore } from './trashStore'
import type { TrashItem } from './trashStore'

const TRASH_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000

function makeTrashItem(overrides: Partial<TrashItem> = {}): Omit<TrashItem, 'deletedAt' | 'expiresAt'> {
  return {
    id: 'trash-1',
    cardId: 'card-1',
    title: '测试卡片',
    content: '[]',
    color: 'white',
    createdAt: 1000,
    ...overrides,
  }
}

describe('TrashStore', () => {
  beforeEach(() => {
    useTrashStore.setState({ items: [] })
  })

  describe('addItem', () => {
    it('应自动填充 deletedAt 和 expiresAt', () => {
      const before = Date.now()
      useTrashStore.getState().addItem(makeTrashItem())
      const item = useTrashStore.getState().items[0]
      expect(item.deletedAt).toBeGreaterThanOrEqual(before)
      expect(item.expiresAt).toBe(item.deletedAt + TRASH_EXPIRY_MS)
    })

    it('应追加到 items 数组', () => {
      useTrashStore.getState().addItem(makeTrashItem({ cardId: 'c1' }))
      useTrashStore.getState().addItem(makeTrashItem({ cardId: 'c2' }))
      expect(useTrashStore.getState().items).toHaveLength(2)
    })
  })

  describe('removeItem', () => {
    it('应从 items 中移除指定卡片', () => {
      useTrashStore.getState().addItem(makeTrashItem({ cardId: 'c1' }))
      useTrashStore.getState().addItem(makeTrashItem({ cardId: 'c2' }))
      useTrashStore.getState().removeItem('c1')
      expect(useTrashStore.getState().items).toHaveLength(1)
      expect(useTrashStore.getState().items[0].cardId).toBe('c2')
    })

    it('移除不存在的卡片不应报错', () => {
      useTrashStore.getState().addItem(makeTrashItem())
      useTrashStore.getState().removeItem('nonexistent')
      expect(useTrashStore.getState().items).toHaveLength(1)
    })
  })

  describe('restoreItem', () => {
    it('应返回 item 并从 items 中移除', () => {
      useTrashStore.getState().addItem(makeTrashItem({ cardId: 'c1' }))
      const item = useTrashStore.getState().restoreItem('c1')
      expect(item).toBeDefined()
      expect(item!.cardId).toBe('c1')
      expect(useTrashStore.getState().items).toHaveLength(0)
    })

    it('恢复不存在的卡片应返回 undefined', () => {
      const item = useTrashStore.getState().restoreItem('nonexistent')
      expect(item).toBeUndefined()
    })
  })

  describe('clearExpired', () => {
    it('应清除过期项', () => {
      useTrashStore.getState().addItem(makeTrashItem({ cardId: 'expired' }))
      // 手动设置过期时间在过去
      const items = useTrashStore.getState().items
      items[0].expiresAt = Date.now() - 1000
      useTrashStore.setState({ items: [...items] })

      useTrashStore.getState().addItem(makeTrashItem({ cardId: 'valid' }))
      useTrashStore.getState().clearExpired()
      expect(useTrashStore.getState().items).toHaveLength(1)
      expect(useTrashStore.getState().items[0].cardId).toBe('valid')
    })

    it('未过期项应保留', () => {
      useTrashStore.getState().addItem(makeTrashItem({ cardId: 'valid' }))
      useTrashStore.getState().clearExpired()
      expect(useTrashStore.getState().items).toHaveLength(1)
    })
  })
})
