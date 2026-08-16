import { createStore } from 'zustand/vanilla'
import { useStore } from 'zustand'
import { getElectronCapabilities, type ElectronCapabilitiesResult } from '../platform/electronCapabilities'

export interface SearchResult {
  cardId: string
  score: number
  modality: string
}

export interface IndexAllResult {
  totalCards: number
  indexedCount: number
  newIndexed: number
  skipped: number
  empty: number
  failed: number
  removed: number
}

export interface TerrainCluster {
  id: string
  label: string
  centroid: number[]
  cardIds: string[]
  cohesion: number
  cardSimilarities: Record<string, number>
}

export interface ClusterResult {
  clusters: TerrainCluster[]
  orphanCards: string[]
  computedAt: number
}

export interface EmbeddingState {
  initialized: boolean
  modelLoaded: boolean
  storeLoaded: boolean
  indexing: boolean
  indexed: boolean
  progress: number
  total: number
  cardCount: number
  totalCards: number
  emptyCount: number
  failedCount: number
  lastIndexedAt: string | null
  modelAvailable: boolean
  modelDir: string
  indexError: string | null
  searchResults: SearchResult[]
  searchScores: Record<string, number>
  searching: boolean
  dragRelatedScores: Record<string, number>
  threshold: number
  clusterResult: ClusterResult | null

  // Download state
  downloading: boolean
  downloadProgress: number
  downloadCurrentFile: string

  init: (workspacePath: string) => Promise<void>
  initAndEnsureIndexed: (workspacePath: string, timeoutMs?: number) => Promise<void>
  retryModelInitialization: () => Promise<void>
  startIndexing: () => Promise<void>
  cancelIndexing: () => Promise<void>
  indexCard: (cardId: string) => Promise<ElectronCapabilitiesResult<boolean>>
  indexCardDebounced: (cardId: string, delay?: number) => void
  removeVector: (cardId: string) => Promise<ElectronCapabilitiesResult<void>>
  cluster: (minClusterSize?: number, clusterThreshold?: number) => Promise<ClusterResult | null>
  searchRelated: (cardId: string, topK?: number) => Promise<void>
  searchByText: (query: string, topK?: number) => Promise<void>
  previewRelatedForDrag: (cardId: string, candidateCardIds: string[], topK?: number) => Promise<void>
  clearDragRelated: () => void
  clearResults: () => void
  setThreshold: (value: number) => Promise<void>
  checkStatus: () => Promise<void>
  downloadModel: () => Promise<void>
  cancelDownload: () => Promise<void>
  checkDownloadConfig: () => Promise<{ configured: boolean; modelDir: string }>
}

// Module-level debounce state for incremental indexing. Kept outside the
// store shape so it doesn't trigger re-renders on every keystroke.
let indexDebounceTimer: ReturnType<typeof setTimeout> | null = null
const pendingIndexCardIds = new Set<string>()
const pendingIndexRetryCounts = new Map<string, number>()
let isFlushing = false
let dragRelatedRequestId = 0
const MAX_INCREMENTAL_RETRIES = 3
const INCREMENTAL_RETRY_DELAY = 1000

export const embeddingStore = createStore<EmbeddingState>()((set, get) => {
  const getEmbedding = () => {
    const capabilities = getElectronCapabilities()
    return capabilities.ok ? capabilities.value.embedding : null
  }
  const schedulePendingIndexFlush = (delay: number) => {
    if (indexDebounceTimer || pendingIndexCardIds.size === 0) return
    indexDebounceTimer = setTimeout(() => {
      void flushPendingIndex()
    }, delay)
  }
  const waitForModelReady = async (timeoutMs = 30000): Promise<boolean> => {
    const embedding = getEmbedding()
    if (!embedding) return false
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const status = await embedding.getStatus()
      set({
        initialized: status.initialized,
        modelLoaded: status.initialized,
        modelAvailable: status.modelAvailable ?? false,
        modelDir: status.modelDir ?? '',
        indexError: status.initializationError ?? null,
      })
      if (status.initializationError) return false
      if (status.initialized) return true
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    set({ indexError: 'model-timeout' })
    return false
  }
  // Flush all pending incremental index cards, then re-cluster so the 3D
  // view picks up the new vectors. If the model isn't ready yet, the ids
  // are put back into pending for the next flush to retry.
  const flushPendingIndex = async () => {
    if (isFlushing) return
    isFlushing = true
    indexDebounceTimer = null
    const ids = [...pendingIndexCardIds]
    pendingIndexCardIds.clear()
    if (ids.length === 0) { isFlushing = false; return }

    let retryDelay: number | null = null
    try {
      const embedding = getEmbedding()
      if (!embedding) {
        for (const id of ids) pendingIndexCardIds.add(id)
        return
      }
      const status = await embedding.getStatus()
      if (!status.initialized) {
        // Model not ready yet — retain work and retry while initialization is in progress.
        for (const id of ids) pendingIndexCardIds.add(id)
        if (status.modelAvailable && !status.initializationError) {
          retryDelay = INCREMENTAL_RETRY_DELAY
        }
        return
      }

      let anyChange = false
      for (const id of ids) {
        try {
          const result = await embedding.indexCard(id)
          if (!result.success) throw new Error(result.error || 'index-card-failed')
          pendingIndexRetryCounts.delete(id)
          if (result.changed) anyChange = true
        } catch (error) {
          const attempts = (pendingIndexRetryCounts.get(id) ?? 0) + 1
          pendingIndexRetryCounts.set(id, attempts)
          if (attempts <= MAX_INCREMENTAL_RETRIES) {
            pendingIndexCardIds.add(id)
            retryDelay = Math.max(retryDelay ?? 0, INCREMENTAL_RETRY_DELAY * attempts)
          } else {
            console.warn(`[embeddingStore] incremental index failed for ${id}:`, error)
            set({ indexError: 'incremental-index-failed' })
          }
        }
      }
      if (anyChange) {
        await get().cluster()
      }
    } catch (err) {
      console.warn('[embeddingStore] flush index failed:', err)
    } finally {
      isFlushing = false
      if (retryDelay !== null) schedulePendingIndexFlush(retryDelay)
    }
  }

  return {
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
  lastIndexedAt: null,
  modelAvailable: false,
  modelDir: '',
  indexError: null,
  searchResults: [],
  searchScores: {},
  searching: false,
  dragRelatedScores: {},
  threshold: 0.45,
  clusterResult: null,

  downloading: false,
  downloadProgress: 0,
  downloadCurrentFile: '',

  init: async (workspacePath: string) => {
    const embedding = getEmbedding()
    if (!embedding) return
    try {
      const result = await embedding.init(workspacePath)
      set({
        initialized: result.storeLoaded,
        modelLoaded: result.modelLoaded,
        storeLoaded: result.storeLoaded,
        modelAvailable: result.modelLoaded,
        cardCount: result.docCount,
        totalCards: result.totalCards ?? result.docCount,
        indexed: result.storeLoaded && result.docCount > 0,
        modelDir: '',
        indexError: null,
      })
    } catch (err: any) {
      console.error('[embeddingStore] init failed:', err.message)
      set({ initialized: false, indexError: 'init-failed' })
    }
  },

  initAndEnsureIndexed: async (workspacePath: string, timeoutMs = 30000) => {
    await get().init(workspacePath)

    const embedding = getEmbedding()
    if (!embedding) {
      set({ indexError: 'unavailable' })
      return
    }

    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      try {
        const status = await embedding.getStatus()
        set({
          initialized: status.initialized,
          modelLoaded: status.initialized,
          modelAvailable: status.modelAvailable ?? false,
          modelDir: status.modelDir ?? '',
          indexed: status.docCount > 0,
          cardCount: status.docCount,
          totalCards: status.totalCards ?? status.docCount,
        })
        if (status.initializationError) {
          set({ indexError: status.initializationError })
          return
        }
        if (!status.modelAvailable) {
          set({ indexError: 'model-missing' })
          return
        }
        if (status.initialized) {
          set({ indexError: null })
          await get().startIndexing()
          return
        }
      } catch (error) {
        console.warn('[embeddingStore] status check failed:', error)
      }
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    set({ indexError: 'model-timeout' })
  },

  retryModelInitialization: async () => {
    const embedding = getEmbedding()
    if (!embedding) return
    set({ indexError: null })
    try {
      const result = await embedding.retryInit()
      if (result.error) {
        set({ indexError: result.error })
        return
      }
      const ready = await waitForModelReady()
      if (ready) await get().startIndexing()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      set({ indexError: message || 'model-retry-failed' })
    }
  },

  startIndexing: async () => {
    const embedding = getEmbedding()
    if (!embedding) return
    const status = await embedding.getStatus()
    if (!status.initialized) {
      set({
        indexing: false,
        indexError: status.initializationError || 'model-not-initialized',
      })
      return
    }
    set({ indexing: true, progress: 0, total: 0, indexError: null })

    const offProgress = embedding.onProgress((data) => {
      set({ progress: data.current, total: data.total })
    })

    let cleanedUp = false
    const cleanup = () => {
      if (cleanedUp) return
      cleanedUp = true
      offProgress()
      offComplete()
      offError()
    }

    const offComplete = embedding.onComplete((data) => {
      set({
        indexing: false,
        indexed: true,
        cardCount: data.indexedCount ?? data.newIndexed,
        totalCards: data.totalCards ?? data.newIndexed,
        emptyCount: data.empty ?? 0,
        failedCount: data.failed ?? 0,
        lastIndexedAt: new Date().toISOString(),
        indexError: (data.failed ?? 0) > 0 ? 'partial-index-failure' : null,
      })
      schedulePendingIndexFlush(0)
      cleanup()
    })

    const offError = embedding.onError((data) => {
      console.error('[embeddingStore] error:', data.message)
      set({ indexing: false, indexError: data.message || 'index-failed' })
      cleanup()
    })

    try {
      const result = await embedding.indexAll()
      if (!result.error) return
      console.error('[embeddingStore] indexAll error:', result.error)
      set({ indexing: false, indexError: result.error })
      cleanup()
    } catch (error) {
      console.error('[embeddingStore] indexAll failed:', error)
      set({ indexing: false, indexError: 'index-failed' })
      cleanup()
    }
  },

  cancelIndexing: async () => {
    const embedding = getEmbedding()
    if (embedding) await embedding.cancel()
    set({ indexing: false })
  },

  indexCard: async (cardId: string) => {
    const capabilities = getElectronCapabilities()
    if (!capabilities.ok) return capabilities
    try {
      const result = await capabilities.value.embedding.indexCard(cardId)
      if (!result.success) return { ok: false, reason: 'ipc-error', error: result.error }
      return { ok: true, value: result.indexed ?? false }
    } catch (error) {
      return { ok: false, reason: 'ipc-error', error }
    }
  },

  cluster: async (minClusterSize = 2, clusterThreshold?: number) => {
    const embedding = getEmbedding()
    if (!embedding) return null
    try {
      const result = await embedding.cluster(minClusterSize, clusterThreshold)
      if (result.error) {
        console.error('[embeddingStore] cluster error:', result.error)
        return null
      }
      set({ clusterResult: result })
      return result
    } catch (err: any) {
      console.error('[embeddingStore] cluster failed:', err.message)
      return null
    }
  },

  searchRelated: async (cardId: string, topK = 20) => {
    set({ searching: true, searchResults: [], searchScores: {} })
    try {
      const embedding = getEmbedding()
      if (!embedding) throw new Error('unavailable')
      const { results } = await embedding.search(cardId, topK)
      const scores: Record<string, number> = {}
      for (const r of (results || [])) {
        scores[r.cardId] = r.score
      }
      set({ searchResults: results || [], searchScores: scores, searching: false })
    } catch {
      set({ searchResults: [], searchScores: {}, searching: false })
    }
  },

  searchByText: async (query: string, topK = 20) => {
    set({ searching: true, searchResults: [], searchScores: {} })
    try {
      const embedding = getEmbedding()
      if (!embedding) throw new Error('unavailable')
      const { results } = await embedding.searchByText(query, topK)
      const scores: Record<string, number> = {}
      for (const r of (results || [])) {
        scores[r.cardId] = r.score
      }
      set({ searchResults: results || [], searchScores: scores, searching: false })
    } catch {
      set({ searchResults: [], searchScores: {}, searching: false })
    }
  },

  previewRelatedForDrag: async (cardId: string, candidateCardIds: string[], topK = 4) => {
    const requestId = ++dragRelatedRequestId
    if (!get().indexed || candidateCardIds.length === 0) {
      set({ dragRelatedScores: {} })
      return
    }

    try {
      const embedding = getEmbedding()
      if (!embedding) throw new Error('unavailable')
      const candidateSet = new Set(candidateCardIds)
      candidateSet.delete(cardId)
      const { results } = await embedding.search(cardId, Math.max(topK * 3, 12))
      if (requestId !== dragRelatedRequestId) return

      const scores: Record<string, number> = {}
      let accepted = 0
      for (const result of results || []) {
        if (!candidateSet.has(result.cardId)) continue
        scores[result.cardId] = result.score
        accepted += 1
        if (accepted >= topK) break
      }
      set({ dragRelatedScores: scores })
    } catch {
      if (requestId === dragRelatedRequestId) set({ dragRelatedScores: {} })
    }
  },

  clearDragRelated: () => {
    dragRelatedRequestId += 1
    set({ dragRelatedScores: {} })
  },

  clearResults: () => set({ searchResults: [], searchScores: {}, searching: false }),

  setThreshold: async (value: number) => {
    set({ threshold: value })
    const embedding = getEmbedding()
    if (embedding) await embedding.setThreshold(value)
  },

  checkStatus: async () => {
    try {
      const embedding = getEmbedding()
      if (!embedding) return
      const status = await embedding.getStatus()
      set((state) => ({
        initialized: status.initialized,
        modelLoaded: status.initialized,
        modelAvailable: status.modelAvailable ?? false,
        modelDir: status.modelDir ?? '',
        indexed: status.docCount > 0,
        cardCount: status.docCount,
        totalCards: status.totalCards ?? status.docCount,
        indexError: status.initializationError ?? state.indexError,
      }))
    } catch {
      // checkStatus 失败不影响主流程
    }
  },

  indexCardDebounced: (cardId: string, delay = 1500) => {
    pendingIndexCardIds.add(cardId)
    pendingIndexRetryCounts.delete(cardId)
    if (indexDebounceTimer) clearTimeout(indexDebounceTimer)
    indexDebounceTimer = null
    schedulePendingIndexFlush(delay)
  },

  removeVector: async (cardId: string) => {
    const capabilities = getElectronCapabilities()
    if (!capabilities.ok) return capabilities
    const embedding = capabilities.value.embedding

    try {
      await embedding.removeVector(cardId)
      const status = await embedding.getStatus()
      if (status.docCount > 0 || status.initialized) {
        await get().cluster()
      }
      return { ok: true, value: undefined }
    } catch (err) {
      return { ok: false, reason: 'ipc-error', error: err }
    }
  },

  downloadModel: async () => {
    const embedding = getEmbedding()
    if (!embedding) return
    set({ downloading: true, downloadProgress: 0, downloadCurrentFile: '', indexError: null })

    const offProgress = embedding.onDownloadProgress((data) => {
      set({ downloadProgress: data.progress, downloadCurrentFile: data.currentFile })
    })

    let cleanedUp = false
    const cleanup = () => {
      if (cleanedUp) return
      cleanedUp = true
      offProgress()
      offComplete()
      offError()
    }

    const offComplete = embedding.onDownloadComplete((data) => {
      set({ downloading: false, modelAvailable: data.success, downloadProgress: 100 })
    })

    const offError = embedding.onDownloadError((data) => {
      console.error('[embeddingStore] download error:', data.message)
      set({ downloading: false, downloadProgress: 0 })
      cleanup()
    })

    try {
      const result = await embedding.downloadModel()
      if (result.error) {
        console.error('[embeddingStore] downloadModel error:', result.error)
        set({ downloading: false, downloadProgress: 0, indexError: result.error })
        cleanup()
        return
      }

      set({ downloading: false, modelAvailable: true, downloadProgress: 100 })
      const ready = await waitForModelReady()
      cleanup()
      if (ready) await get().startIndexing()
    } catch (error) {
      console.error('[embeddingStore] downloadModel failed:', error)
      set({ downloading: false, downloadProgress: 0, indexError: 'model-download-failed' })
      cleanup()
    }
  },

  cancelDownload: async () => {
    const embedding = getEmbedding()
    if (embedding) await embedding.cancelDownload()
    set({ downloading: false, downloadProgress: 0 })
  },

  checkDownloadConfig: async () => {
    const embedding = getEmbedding()
    return embedding
      ? await embedding.getDownloadConfig()
      : { configured: false, modelDir: '' }
  },
  }
})

export function useEmbeddingStore(): EmbeddingState {
  return useStore(embeddingStore)
}
