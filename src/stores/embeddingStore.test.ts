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
    totalCards: 0,
    emptyCount: 0,
    failedCount: 0,
    modelAvailable: false,
    modelDir: '',
    indexError: null,
    downloading: false,
    downloadProgress: 0,
    downloadCurrentFile: '',
  })
})

describe('embeddingStore.initAndEnsureIndexed', () => {
  it('reconciles an existing partial index instead of trusting docCount alone', async () => {
    let complete: ((data: { totalCards: number; indexedCount: number; newIndexed: number; skipped: number; empty: number; failed: number; removed: number }) => void) | undefined
    const indexAll = vi.fn().mockImplementation(async () => {
      complete?.({ totalCards: 43, indexedCount: 43, newIndexed: 1, skipped: 42, empty: 0, failed: 0, removed: 0 })
      return { totalCards: 43, indexedCount: 43, newIndexed: 1, skipped: 42, empty: 0, failed: 0, removed: 0 }
    })
    installEmbeddingApi({
      init: vi.fn().mockResolvedValue({ storeLoaded: true, modelLoaded: false, docCount: 42, totalCards: 43 }),
      getStatus: vi.fn().mockResolvedValue({ initialized: true, modelAvailable: true, docCount: 42, totalCards: 43, modelDir: 'D:/model' }),
      onProgress: vi.fn(() => vi.fn()),
      onComplete: vi.fn((handler) => { complete = handler; return vi.fn() }),
      onError: vi.fn(() => vi.fn()),
      indexAll,
    })

    await embeddingStore.getState().initAndEnsureIndexed('D:/workspace')

    expect(embeddingStore.getState()).toMatchObject({
      indexed: true,
      cardCount: 43,
      totalCards: 43,
      storeLoaded: true,
      indexError: null,
    })
    expect(indexAll).toHaveBeenCalledOnce()
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

  it('retries native initialization and starts indexing when the runtime becomes ready', async () => {
    const retryInit = vi.fn().mockResolvedValue({
      modelLoaded: false,
      storeLoaded: true,
      docCount: 0,
      totalCards: 2,
    })
    installEmbeddingApi({
      retryInit,
      getStatus: vi.fn().mockResolvedValue({
        initialized: true,
        modelAvailable: true,
        initializationError: null,
        docCount: 0,
        totalCards: 2,
        modelDir: 'D:/model',
      }),
    })
    const originalStartIndexing = embeddingStore.getState().startIndexing
    const startIndexing = vi.fn().mockResolvedValue(undefined)
    embeddingStore.setState({ startIndexing, indexError: 'INIT_FAILED: DLL initialization failed' })

    try {
      await embeddingStore.getState().retryModelInitialization()

      expect(retryInit).toHaveBeenCalledOnce()
      expect(startIndexing).toHaveBeenCalledOnce()
      expect(embeddingStore.getState()).toMatchObject({
        initialized: true,
        modelAvailable: true,
        indexError: null,
      })
    } finally {
      embeddingStore.setState({ startIndexing: originalStartIndexing })
    }
  })
})

describe('embeddingStore incremental indexing', () => {
  it('retries queued cards after the model finishes initializing', async () => {
    vi.useFakeTimers()
    let initialized = false
    const indexCard = vi.fn().mockResolvedValue({ success: true, indexed: true, changed: true })
    installEmbeddingApi({
      getStatus: vi.fn().mockImplementation(async () => ({
        initialized,
        modelAvailable: true,
        initializationError: null,
        docCount: 0,
        totalCards: 1,
      })),
      indexCard,
      cluster: vi.fn().mockResolvedValue({ clusters: [], orphanCards: [], computedAt: 1 }),
    })

    try {
      embeddingStore.getState().indexCardDebounced('card-1', 0)
      await vi.runOnlyPendingTimersAsync()
      expect(indexCard).not.toHaveBeenCalled()

      initialized = true
      await vi.advanceTimersByTimeAsync(1000)
      expect(indexCard).toHaveBeenCalledWith('card-1')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('embeddingStore model download', () => {
  it('waits for the downloaded model and starts indexing automatically', async () => {
    const offProgress = vi.fn()
    const offComplete = vi.fn()
    const offError = vi.fn()
    installEmbeddingApi({
      onDownloadProgress: vi.fn(() => offProgress),
      onDownloadComplete: vi.fn(() => offComplete),
      onDownloadError: vi.fn(() => offError),
      downloadModel: vi.fn().mockResolvedValue({ success: true }),
      getStatus: vi.fn().mockResolvedValue({
        initialized: true,
        modelAvailable: true,
        initializationError: null,
        modelDir: 'D:/app-data/embedding',
        docCount: 0,
        totalCards: 2,
      }),
    })
    const originalStartIndexing = embeddingStore.getState().startIndexing
    const startIndexing = vi.fn().mockResolvedValue(undefined)
    embeddingStore.setState({ startIndexing })

    try {
      await embeddingStore.getState().downloadModel()

      expect(startIndexing).toHaveBeenCalledOnce()
      expect(embeddingStore.getState()).toMatchObject({
        downloading: false,
        downloadProgress: 100,
        modelAvailable: true,
        modelLoaded: true,
        modelDir: 'D:/app-data/embedding',
      })
      expect(offProgress).toHaveBeenCalledOnce()
      expect(offComplete).toHaveBeenCalledOnce()
      expect(offError).toHaveBeenCalledOnce()
    } finally {
      embeddingStore.setState({ startIndexing: originalStartIndexing })
    }
  })
})
