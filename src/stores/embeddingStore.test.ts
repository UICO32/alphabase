// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { embeddingStore } from './embeddingStore'

function installEmbeddingApi(overrides: Record<string, unknown>) {
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { embedding: overrides },
  })
}

beforeEach(() => {
  embeddingStore.setState({
    initialized: false,
    modelLoaded: false,
    storeLoaded: false,
    indexing: false,
    indexed: false,
    progress: 0,
    total: 0,
    cardCount: 0,
    modelAvailable: false,
    modelDir: '',
    indexError: null,
  })
})

describe('embeddingStore.initAndEnsureIndexed', () => {
  it('restores an existing index without rebuilding it', async () => {
    const indexAll = vi.fn()
    installEmbeddingApi({
      init: vi.fn().mockResolvedValue({ storeLoaded: true, modelLoaded: false, docCount: 42 }),
      indexAll,
    })

    await embeddingStore.getState().initAndEnsureIndexed('D:/workspace')

    expect(embeddingStore.getState()).toMatchObject({
      indexed: true,
      cardCount: 42,
      storeLoaded: true,
      indexError: null,
    })
    expect(indexAll).not.toHaveBeenCalled()
  })

  it('starts a full index when the model is ready and the store is empty', async () => {
    let complete: ((data: { newIndexed: number }) => void) | undefined
    const indexAll = vi.fn().mockImplementation(async () => {
      complete?.({ newIndexed: 3 })
      return { totalCards: 3, newIndexed: 3, skipped: 0, removed: 0 }
    })
    installEmbeddingApi({
      init: vi.fn().mockResolvedValue({ storeLoaded: false, modelLoaded: false, docCount: 0 }),
      getStatus: vi.fn().mockResolvedValue({ initialized: true, modelAvailable: true, docCount: 0, modelDir: 'D:/model' }),
      onProgress: vi.fn(() => vi.fn()),
      onComplete: vi.fn((handler) => { complete = handler; return vi.fn() }),
      onError: vi.fn(() => vi.fn()),
      indexAll,
    })

    await embeddingStore.getState().initAndEnsureIndexed('D:/workspace', 100)

    expect(indexAll).toHaveBeenCalledOnce()
    expect(embeddingStore.getState()).toMatchObject({
      indexed: true,
      indexing: false,
      cardCount: 3,
      indexError: null,
    })
  })

  it('reports a missing model instead of remaining in a preparing state', async () => {
    installEmbeddingApi({
      init: vi.fn().mockResolvedValue({ storeLoaded: false, modelLoaded: false, docCount: 0 }),
      getStatus: vi.fn().mockResolvedValue({ initialized: false, modelAvailable: false, docCount: 0, modelDir: 'D:/model' }),
    })

    await embeddingStore.getState().initAndEnsureIndexed('D:/workspace', 100)

    expect(embeddingStore.getState()).toMatchObject({
      indexed: false,
      indexing: false,
      indexError: 'model-missing',
    })
  })

  it('surfaces native runtime initialization failure without calling indexAll', async () => {
    const indexAll = vi.fn()
    installEmbeddingApi({
      init: vi.fn().mockResolvedValue({ storeLoaded: false, modelLoaded: false, docCount: 0 }),
      getStatus: vi.fn().mockResolvedValue({
        initialized: false,
        modelAvailable: true,
        initializationError: 'INIT_FAILED: DLL initialization failed',
        docCount: 0,
        modelDir: 'D:/model',
      }),
      indexAll,
    })

    await embeddingStore.getState().initAndEnsureIndexed('D:/workspace', 100)

    expect(indexAll).not.toHaveBeenCalled()
    expect(embeddingStore.getState()).toMatchObject({
      indexing: false,
      indexError: 'INIT_FAILED: DLL initialization failed',
    })
  })
})

describe('embeddingStore.startIndexing', () => {
  it('does not call indexAll unless the native model is initialized', async () => {
    const indexAll = vi.fn()
    installEmbeddingApi({
      getStatus: vi.fn().mockResolvedValue({
        initialized: false,
        modelAvailable: true,
        initializationError: 'INIT_FAILED: DLL initialization failed',
        docCount: 0,
        modelDir: 'D:/model',
      }),
      indexAll,
    })

    await embeddingStore.getState().startIndexing()

    expect(indexAll).not.toHaveBeenCalled()
    expect(embeddingStore.getState().indexError).toBe('INIT_FAILED: DLL initialization failed')
  })
})
