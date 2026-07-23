import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useCardStore } from './cardStore'
import type { GlobalCard } from './cardStore'
import { flushActiveSyncEngine } from '../sync/syncEngineRef'
import { embeddingStore } from './embeddingStore'

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

function restoreElectronAPI(descriptor: PropertyDescriptor | undefined) {
  if (descriptor) Object.defineProperty(window, 'electronAPI', descriptor)
  else Reflect.deleteProperty(window, 'electronAPI')
}

describe('CardStore', () => {
  beforeEach(() => {
    useCardStore.setState({
      cards: {},
      isLoaded: false,
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

    it('does not report an error when Electron capabilities are unavailable', async () => {
      const originalElectronAPI = Object.getOwnPropertyDescriptor(window, 'electronAPI')
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      Reflect.deleteProperty(window, 'electronAPI')

      try {
        useCardStore.getState().addCard(makeCard())
        useCardStore.getState().deleteCard('card-1')
        await expect(embeddingStore.getState().removeVector('card-1')).resolves.toEqual({
          ok: false,
          reason: 'unavailable',
        })
        expect(errorSpy).not.toHaveBeenCalled()
        expect(warnSpy).not.toHaveBeenCalled()
      } finally {
        restoreElectronAPI(originalElectronAPI)
        errorSpy.mockRestore()
        warnSpy.mockRestore()
      }
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

    it('does not report an error when Electron capabilities are unavailable', async () => {
      const originalElectronAPI = Object.getOwnPropertyDescriptor(window, 'electronAPI')
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      Reflect.deleteProperty(window, 'electronAPI')

      try {
        useCardStore.getState().addCard(makeCard())
        useCardStore.getState().softDeleteCard('card-1')
        await Promise.resolve()
        expect(errorSpy).not.toHaveBeenCalled()
        expect(warnSpy).not.toHaveBeenCalled()
      } finally {
        restoreElectronAPI(originalElectronAPI)
        errorSpy.mockRestore()
        warnSpy.mockRestore()
      }
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

  describe('previewHTML', () => {
    it('ensurePreviewHTMLBatch 后卡片对象引用应变化', () => {
      useCardStore.getState().addCard(makeCard({ id: 'preview-test', content: '[test]' }))
      const before = useCardStore.getState().cards['preview-test']
      useCardStore.getState().ensurePreviewHTMLBatch(['preview-test'])
      const after = useCardStore.getState().cards['preview-test']
      expect(after).not.toBe(before)
      expect(after.previewHTML).toBe('<p>mock</p>')
    })

    it('getPreviewHTML 后引用不变且不写 previewHTML', () => {
      useCardStore.getState().addCard(makeCard({ id: 'preview-test-2', content: '[test]' }))
      const before = useCardStore.getState().cards['preview-test-2']
      const html = useCardStore.getState().getPreviewHTML('preview-test-2')
      expect(html).toBe('<p>mock</p>')
      const after = useCardStore.getState().cards['preview-test-2']
      expect(after).toBe(before)
      expect(after.previewHTML).toBeUndefined()
    })
  })

})

describe('EmbeddingStore browser fallback', () => {
  it('returns unavailable without throwing or writing stderr when indexing a card', async () => {
    const originalElectronAPI = Object.getOwnPropertyDescriptor(window, 'electronAPI')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    Reflect.deleteProperty(window, 'electronAPI')

    try {
      await expect(embeddingStore.getState().indexCard('card-1')).resolves.toEqual({
        ok: false,
        reason: 'unavailable',
      })
      expect(errorSpy).not.toHaveBeenCalled()
      expect(warnSpy).not.toHaveBeenCalled()
    } finally {
      restoreElectronAPI(originalElectronAPI)
      errorSpy.mockRestore()
      warnSpy.mockRestore()
    }
  })

  it('returns ipc-error without writing stderr when card indexing rejects', async () => {
    const originalElectronAPI = Object.getOwnPropertyDescriptor(window, 'electronAPI')
    const error = new Error('ipc failed')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    window.electronAPI = {
      embedding: { indexCard: vi.fn().mockRejectedValue(error) },
    } as unknown as Window['electronAPI']

    try {
      await expect(embeddingStore.getState().indexCard('card-1')).resolves.toEqual({
        ok: false,
        reason: 'ipc-error',
        error,
      })
      expect(errorSpy).not.toHaveBeenCalled()
      expect(warnSpy).not.toHaveBeenCalled()
    } finally {
      restoreElectronAPI(originalElectronAPI)
      errorSpy.mockRestore()
      warnSpy.mockRestore()
    }
  })


  it('recovers indexing state and subscriptions when indexAll rejects', async () => {
    const originalElectronAPI = Object.getOwnPropertyDescriptor(window, 'electronAPI')
    const error = new Error('index failed')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const offProgress = vi.fn()
    const offComplete = vi.fn()
    const offError = vi.fn()
    window.electronAPI = {
      embedding: {
        getStatus: vi.fn().mockResolvedValue({ initialized: true }),
        onProgress: vi.fn(() => offProgress),
        onComplete: vi.fn(() => offComplete),
        onError: vi.fn(() => offError),
        indexAll: vi.fn().mockRejectedValue(error),
      },
    } as unknown as Window['electronAPI']

    try {
      await expect(embeddingStore.getState().startIndexing()).resolves.toBeUndefined()
      expect(embeddingStore.getState().indexing).toBe(false)
      expect(offProgress).toHaveBeenCalledOnce()
      expect(offComplete).toHaveBeenCalledOnce()
      expect(offError).toHaveBeenCalledOnce()
      expect(errorSpy).toHaveBeenCalledWith('[embeddingStore] indexAll failed:', error)
    } finally {
      restoreElectronAPI(originalElectronAPI)
      errorSpy.mockRestore()
    }
  })

  it('recovers download state and subscriptions when downloadModel rejects', async () => {
    const originalElectronAPI = Object.getOwnPropertyDescriptor(window, 'electronAPI')
    const error = new Error('download failed')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const offProgress = vi.fn()
    const offComplete = vi.fn()
    const offError = vi.fn()
    window.electronAPI = {
      embedding: {
        onDownloadProgress: vi.fn(() => offProgress),
        onDownloadComplete: vi.fn(() => offComplete),
        onDownloadError: vi.fn(() => offError),
        downloadModel: vi.fn().mockRejectedValue(error),
      },
    } as unknown as Window['electronAPI']

    try {
      await expect(embeddingStore.getState().downloadModel()).resolves.toBeUndefined()
      expect(embeddingStore.getState().downloading).toBe(false)
      expect(embeddingStore.getState().downloadProgress).toBe(0)
      expect(offProgress).toHaveBeenCalledOnce()
      expect(offComplete).toHaveBeenCalledOnce()
      expect(offError).toHaveBeenCalledOnce()
      expect(errorSpy).toHaveBeenCalledWith('[embeddingStore] downloadModel failed:', error)
    } finally {
      restoreElectronAPI(originalElectronAPI)
      errorSpy.mockRestore()
    }
  })

  it('reports business errors returned by indexing and download requests', async () => {
    const originalElectronAPI = Object.getOwnPropertyDescriptor(window, 'electronAPI')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const unsubscribe = () => vi.fn()

    try {
      window.electronAPI = {
        embedding: {
          getStatus: vi.fn().mockResolvedValue({ initialized: true }),
          onProgress: vi.fn(unsubscribe),
          onComplete: vi.fn(unsubscribe),
          onError: vi.fn(unsubscribe),
          indexAll: vi.fn().mockResolvedValue({ error: 'index business error' }),
        },
      } as unknown as Window['electronAPI']
      await embeddingStore.getState().startIndexing()

      window.electronAPI = {
        embedding: {
          onDownloadProgress: vi.fn(unsubscribe),
          onDownloadComplete: vi.fn(unsubscribe),
          onDownloadError: vi.fn(unsubscribe),
          downloadModel: vi.fn().mockResolvedValue({ error: 'download business error' }),
        },
      } as unknown as Window['electronAPI']
      await embeddingStore.getState().downloadModel()

      expect(errorSpy).toHaveBeenCalledWith('[embeddingStore] indexAll error:', 'index business error')
      expect(errorSpy).toHaveBeenCalledWith('[embeddingStore] downloadModel error:', 'download business error')
      expect(embeddingStore.getState().indexing).toBe(false)
      expect(embeddingStore.getState().downloading).toBe(false)
    } finally {
      restoreElectronAPI(originalElectronAPI)
      errorSpy.mockRestore()
    }
  })
})

