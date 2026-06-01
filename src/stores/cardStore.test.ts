import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useCardStore } from './cardStore'
import type { GlobalCard } from './cardStore'
import { flushActiveSyncEngine } from '../sync/syncEngineRef'

vi.mock('../sync/syncEngineRef', () => ({
  flushActiveSyncEngine: vi.fn(),
}))

vi.mock('../converters/renderBlocks', () => ({
  renderBlocksToHTML: vi.fn(() => '<p>mock</p>'),
}))

function makeCard(overrides: Partial<GlobalCard> = {}): GlobalCard {
  return {
    id: 'card-1',
    content: '[]',
    color: 'white',
    createdAt: 1000,
    ...overrides,
  }
}

describe('CardStore', () => {
  beforeEach(() => {
    useCardStore.setState({
      cards: {},
      isLoaded: false,
      cardHistory: {},
      isUndoingContent: {},
    })
  })

  it('添加卡片后应能在 cards 中找到', () => {
    const card = makeCard()
    useCardStore.getState().addCard(card)
    expect(useCardStore.getState().cards['card-1']).toEqual(card)
  })

  it('添加卡片应调用 flushActiveSyncEngine', () => {
    vi.mocked(flushActiveSyncEngine).mockClear()
    useCardStore.getState().addCard(makeCard())
    expect(flushActiveSyncEngine).toHaveBeenCalled()
  })

  describe('updateCard', () => {
    it('应更新指定属性并设置 updatedAt', () => {
      useCardStore.getState().addCard(makeCard())
      useCardStore.getState().updateCard('card-1', { title: '新标题' })
      const card = useCardStore.getState().cards['card-1']
      expect(card.title).toBe('新标题')
      expect(card.updatedAt).toBeDefined()
    })

    it('更新 content 时应清空 previewHTML', () => {
      useCardStore.getState().addCard(makeCard({ previewHTML: '<p>old</p>' }))
      useCardStore.getState().updateCard('card-1', { content: '[new]' })
      expect(useCardStore.getState().cards['card-1'].previewHTML).toBeUndefined()
    })

    it('更新非 content 属性时不应清空 previewHTML', () => {
      useCardStore.getState().addCard(makeCard({ previewHTML: '<p>old</p>' }))
      useCardStore.getState().updateCard('card-1', { title: '新标题' })
      expect(useCardStore.getState().cards['card-1'].previewHTML).toBe('<p>old</p>')
    })

    it('更新不存在的卡片应返回原状态', () => {
      const before = useCardStore.getState().cards
      useCardStore.getState().updateCard('nonexistent', { title: 'x' })
      expect(useCardStore.getState().cards).toEqual(before)
    })
  })

  describe('deleteCard', () => {
    it('硬删除后卡片不存在', () => {
      useCardStore.getState().addCard(makeCard())
      useCardStore.getState().deleteCard('card-1')
      expect(useCardStore.getState().cards['card-1']).toBeUndefined()
    })
  })

  describe('softDeleteCard', () => {
    it('软删除后卡片仍在，deletedAt 有值', () => {
      useCardStore.getState().addCard(makeCard())
      useCardStore.getState().softDeleteCard('card-1')
      const card = useCardStore.getState().cards['card-1']
      expect(card).toBeDefined()
      expect(card.deletedAt).toBeDefined()
    })

    it('软删除不存在的卡片不应报错', () => {
      const before = useCardStore.getState().cards
      useCardStore.getState().softDeleteCard('nonexistent')
      expect(useCardStore.getState().cards).toEqual(before)
    })
  })

  describe('restoreCard', () => {
    it('恢复后 deletedAt 被移除', () => {
      useCardStore.getState().addCard(makeCard())
      useCardStore.getState().softDeleteCard('card-1')
      useCardStore.getState().restoreCard('card-1')
      expect(useCardStore.getState().cards['card-1'].deletedAt).toBeUndefined()
    })

    it('恢复不存在的卡片不应报错', () => {
      const before = useCardStore.getState().cards
      useCardStore.getState().restoreCard('nonexistent')
      expect(useCardStore.getState().cards).toEqual(before)
    })
  })

  describe('importCards', () => {
    it('应合并到现有 cards', () => {
      useCardStore.getState().addCard(makeCard({ id: 'a' }))
      useCardStore.getState().importCards({
        b: makeCard({ id: 'b' }),
      })
      expect(Object.keys(useCardStore.getState().cards)).toContain('a')
      expect(Object.keys(useCardStore.getState().cards)).toContain('b')
    })
  })

  describe('loadCardsFromDB', () => {
    it('应设置 isLoaded=true', async () => {
      await useCardStore.getState().loadCardsFromDB()
      expect(useCardStore.getState().isLoaded).toBe(true)
    })

    it('传入 cards 时应覆盖', async () => {
      const cards = { x: makeCard({ id: 'x' }) }
      await useCardStore.getState().loadCardsFromDB(cards)
      expect(useCardStore.getState().cards['x']).toBeDefined()
    })

    it('已加载后再次调用不应覆盖', async () => {
      const first = { x: makeCard({ id: 'x' }) }
      await useCardStore.getState().loadCardsFromDB(first)
      const second = { y: makeCard({ id: 'y' }) }
      await useCardStore.getState().loadCardsFromDB(second)
      expect(useCardStore.getState().cards['y']).toBeUndefined()
    })
  })

  describe('undo/redo', () => {
    it('undo 应回退到上一个内容快照', () => {
      useCardStore.getState().addCard(makeCard({ content: 'v1' }))
      useCardStore.getState().recordCardContentSnapshot('card-1')
      useCardStore.getState().updateCard('card-1', { content: 'v2' })
      useCardStore.getState().recordCardContentSnapshot('card-1')
      const result = useCardStore.getState().undoCardContent('card-1')
      expect(result).toBe('v1')
    })

    it('redo 应前进到下一个内容快照', () => {
      useCardStore.getState().addCard(makeCard({ content: 'v1' }))
      useCardStore.getState().recordCardContentSnapshot('card-1')
      useCardStore.getState().updateCard('card-1', { content: 'v2' })
      useCardStore.getState().recordCardContentSnapshot('card-1')
      useCardStore.getState().undoCardContent('card-1')
      const result = useCardStore.getState().redoCardContent('card-1')
      expect(result).toBe('v2')
    })

    it('无历史时 undo 应返回 null', () => {
      useCardStore.getState().addCard(makeCard())
      expect(useCardStore.getState().undoCardContent('card-1')).toBeNull()
    })

    it('clearCardHistory 应清除指定卡片历史', () => {
      useCardStore.getState().addCard(makeCard())
      useCardStore.getState().recordCardContentSnapshot('card-1')
      useCardStore.getState().clearCardHistory('card-1')
      expect(useCardStore.getState().cardHistory['card-1']).toBeUndefined()
    })

    it('clearCardHistory 无参数应清除全部历史', () => {
      useCardStore.getState().addCard(makeCard())
      useCardStore.getState().recordCardContentSnapshot('card-1')
      useCardStore.getState().clearCardHistory()
      expect(Object.keys(useCardStore.getState().cardHistory)).toHaveLength(0)
    })
  })
})
