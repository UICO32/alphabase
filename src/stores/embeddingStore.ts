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
  newIndexed: number
  skipped: number
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
  lastIndexedAt: string | null
  modelAvailable: boolean
  modelDir: string
  searchResults: SearchResult[]
  searchScores: Record<string, number>
  searching: boolean
  threshold: number
  clusterResult: ClusterResult | null

  // Download state
  downloading: boolean
  downloadProgress: number
  downloadCurrentFile: string

  init: (workspacePath: string) => Promise<void>
  startIndexing: () => Promise<void>
  cancelIndexing: () => Promise<void>
  indexCard: (cardId: string) => Promise<ElectronCapabilitiesResult<boolean>>
  indexCardDebounced: (cardId: string, delay?: number) => void
  removeVector: (cardId: string) => Promise<ElectronCapabilitiesResult<void>>
  cluster: (minClusterSize?: number, clusterThreshold?: number) => Promise<ClusterResult | null>
  searchRelated: (cardId: string, topK?: number) => Promise<void>
  searchByText: (query: string, topK?: number) => Promise<void>
  clearResults: () => void
  setThreshold: (value: number) => Promise<void>
  checkStatus: () => Promise<void>
  ensureIndexed: (workspacePath: string, timeoutMs?: number) => Promise<void>
  downloadModel: () => Promise<void>
  cancelDownload: () => Promise<void>
  checkDownloadConfig: () => Promise<{ configured: boolean; modelDir: string }>
}

// Module-level debounce state for incremental indexing. Kept outside the
// store shape so it doesn't trigger re-renders on every keystroke.
let indexDebounceTimer: ReturnType<typeof setTimeout> | null = null
const pendingIndexCardIds = new Set<string>()
let isFlushing = false

export const embeddingStore = createStore<EmbeddingState>()((set, get) => {
  const getEmbedding = () => {
    const capabilities = getElectronCapabilities()
    return capabilities.ok ? capabilities.value.embedding : null
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

    try {
      const embedding = getEmbedding()
      if (!embedding) {
        for (const id of ids) pendingIndexCardIds.add(id)
        return
      }
      const status = await embedding.getStatus()
      if (!status.initialized) {
        // Model not ready yet — put ids back so the next flush retries
        for (const id of ids) pendingIndexCardIds.add(id)
        return
      }

      let anySuccess = false
      for (const id of ids) {
        try {
          const result = await embedding.indexCard(id)
          if (result.success) anySuccess = true
        } catch {
          // A single card failing shouldn't abort the rest
        }
      }
      if (anySuccess) {
        await get().cluster()
      }
    } catch (err) {
      console.warn('[embeddingStore] flush index failed:', err)
    } finally {
      isFlushing = false
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
  lastIndexedAt: null,
  modelAvailable: false,
  modelDir: '',
  searchResults: [],
  searchScores: {},
  searching: false,
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
        indexed: result.storeLoaded && result.docCount > 0,
        modelDir: '',
      })
    } catch (err: any) {
      console.error('[embeddingStore] init failed:', err.message)
      set({ initialized: false })
    }
  },

  startIndexing: async () => {
    const embedding = getEmbedding()
    if (!embedding) return
    set({ indexing: true, progress: 0, total: 0 })

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
        cardCount: data.newIndexed,
        lastIndexedAt: new Date().toISOString(),
      })
      cleanup()
    })

    const offError = embedding.onError((data) => {
      console.error('[embeddingStore] error:', data.message)
      set({ indexing: false })
      cleanup()
    })

    try {
      const result = await embedding.indexAll()
      if (!result.error) return
      console.error('[embeddingStore] indexAll error:', result.error)
      set({ indexing: false })
      cleanup()
    } catch (error) {
      console.error('[embeddingStore] indexAll failed:', error)
      set({ indexing: false })
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
      return { ok: true, value: result.success }
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
      set({
        initialized: status.initialized,
        modelLoaded: status.initialized,
        modelAvailable: status.modelAvailable ?? false,
        modelDir: status.modelDir ?? '',
        indexed: status.docCount > 0,
        cardCount: status.docCount,
      })
    } catch {
      // checkStatus 失败不影响主流程
    }
  },

  indexCardDebounced: (cardId: string, delay = 1500) => {
    pendingIndexCardIds.add(cardId)
    if (indexDebounceTimer) clearTimeout(indexDebounceTimer)
    indexDebounceTimer = setTimeout(() => {
      void flushPendingIndex()
    }, delay)
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

  ensureIndexed: async (_workspacePath: string, timeoutMs = 30000) => {
    const store = get()
    if (store.indexing) return

    const deadline = Date.now() + timeoutMs
    const embedding = getEmbedding()
    if (!embedding) return
    while (Date.now() < deadline) {
      const status = await embedding.getStatus()
      if (status.initialized) break
      await new Promise(r => setTimeout(r, 500))
    }

    const latest = get()
    if (!latest.indexed && !latest.indexing) {
      try {
        await latest.startIndexing()
      } catch (err: any) {
        console.warn('[embeddingStore] ensureIndexed failed:', err.message)
      }
    }
  },

  downloadModel: async () => {
    const embedding = getEmbedding()
    if (!embedding) return
    set({ downloading: true, downloadProgress: 0, downloadCurrentFile: '' })

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
      cleanup()
    })

    const offError = embedding.onDownloadError((data) => {
      console.error('[embeddingStore] download error:', data.message)
      set({ downloading: false, downloadProgress: 0 })
      cleanup()
    })

    try {
      const result = await embedding.downloadModel()
      if (!result.error) return
      console.error('[embeddingStore] downloadModel error:', result.error)
      set({ downloading: false, downloadProgress: 0 })
      cleanup()
    } catch (error) {
      console.error('[embeddingStore] downloadModel failed:', error)
      set({ downloading: false, downloadProgress: 0 })
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
