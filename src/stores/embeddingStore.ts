import { createStore } from 'zustand/vanilla'
import { useStore } from 'zustand'

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

  init: (workspacePath: string) => Promise<void>
  startIndexing: () => Promise<void>
  cancelIndexing: () => Promise<void>
  indexCard: (cardId: string) => Promise<boolean>
  cluster: (minClusterSize?: number, clusterThreshold?: number) => Promise<ClusterResult | null>
  searchRelated: (cardId: string, topK?: number) => Promise<void>
  searchByText: (query: string, topK?: number) => Promise<void>
  clearResults: () => void
  setThreshold: (value: number) => Promise<void>
  checkStatus: () => Promise<void>
}

export const embeddingStore = createStore<EmbeddingState>()((set, _get) => ({
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

  init: async (workspacePath: string) => {
    try {
      const result = await window.electronAPI.embedding.init(workspacePath)
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
    set({ indexing: true, progress: 0, total: 0 })

    const offProgress = window.electronAPI.embedding.onProgress((data) => {
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

    const offComplete = window.electronAPI.embedding.onComplete((data) => {
      set({
        indexing: false,
        indexed: true,
        cardCount: data.newIndexed,
        lastIndexedAt: new Date().toISOString(),
      })
      cleanup()
    })

    const offError = window.electronAPI.embedding.onError((data) => {
      console.error('[embeddingStore] error:', data.message)
      set({ indexing: false })
      cleanup()
    })

    const result = await window.electronAPI.embedding.indexAll()
    if (result.error) {
      console.error('[embeddingStore] indexAll error:', result.error)
      set({ indexing: false })
      cleanup()
    }
  },

  cancelIndexing: async () => {
    await window.electronAPI.embedding.cancel()
    set({ indexing: false })
  },

  indexCard: async (cardId: string) => {
    try {
      const result = await window.electronAPI.embedding.indexCard(cardId)
      return result.success
    } catch {
      return false
    }
  },

  cluster: async (minClusterSize = 2, clusterThreshold?: number) => {
    try {
      const result = await window.electronAPI.embedding.cluster(minClusterSize, clusterThreshold)
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
      const { results } = await window.electronAPI.embedding.search(cardId, topK)
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
      const { results } = await window.electronAPI.embedding.searchByText(query, topK)
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
    await window.electronAPI.embedding.setThreshold(value)
  },

  checkStatus: async () => {
    try {
      const status = await window.electronAPI.embedding.getStatus()
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
}))

export function useEmbeddingStore(): EmbeddingState {
  return useStore(embeddingStore)
}
