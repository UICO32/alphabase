import { create } from 'zustand'

interface EmbeddingState {
  indexing: boolean
  progress: number
  total: number
  currentCardId: string
  indexed: boolean
  cardCount: number
  lastIndexedAt: string | null
  modelAvailable: boolean
  searchResults: Array<{ cardId: string; score: number }>
  searching: boolean
  threshold: number

  initEmbedding: (workspacePath: string) => Promise<void>
  startIndexing: () => Promise<void>
  cancelIndexing: () => Promise<void>
  searchRelated: (cardId: string, topK?: number) => Promise<void>
  clearResults: () => void
  setThreshold: (value: number) => Promise<void>
  checkStatus: () => Promise<void>
}

export const useEmbeddingStore = create<EmbeddingState>((set, get) => ({
  indexing: false,
  progress: 0,
  total: 0,
  currentCardId: '',
  indexed: false,
  cardCount: 0,
  lastIndexedAt: null,
  modelAvailable: false,
  searchResults: [],
  searching: false,
  threshold: 0.75,

  initEmbedding: async (workspacePath: string) => {
    await window.electronAPI.embedding.init(workspacePath)
  },

  startIndexing: async () => {
    set({ indexing: true, progress: 0, total: 0 })

    const offProgress = window.electronAPI.embedding.onProgress((data) => {
      set({ progress: data.current, total: data.total })
    })

    const offComplete = window.electronAPI.embedding.onComplete((data) => {
      set({
        indexing: false,
        indexed: true,
        cardCount: data.indexed,
        lastIndexedAt: new Date().toISOString(),
      })
      offProgress()
      offComplete()
    })

    const offError = window.electronAPI.embedding.onError((data) => {
      set({ indexing: false })
      console.error('Embedding error:', data.message)
      offProgress()
      offComplete()
      offError()
    })

    const result = await window.electronAPI.embedding.indexAll()
    if (result.error) {
      set({ indexing: false })
      if (result.error === 'MODEL_MISSING') {
        set({ modelAvailable: false })
      }
      offProgress()
      offComplete()
      offError()
    }
  },

  cancelIndexing: async () => {
    await window.electronAPI.embedding.cancel()
    set({ indexing: false })
  },

  searchRelated: async (cardId: string, topK = 20) => {
    set({ searching: true, searchResults: [] })
    try {
      const { results } = await window.electronAPI.embedding.search(cardId, topK)
      set({ searchResults: results || [], searching: false })
    } catch {
      set({ searchResults: [], searching: false })
    }
  },

  clearResults: () => set({ searchResults: [], searching: false }),

  setThreshold: async (value: number) => {
    set({ threshold: value })
    await window.electronAPI.embedding.setThreshold(value)
  },

  checkStatus: async () => {
    try {
      const status = await window.electronAPI.embedding.getStatus()
      set({
        indexed: status.docCount > 0,
        modelAvailable: status.modelAvailable ?? false,
      })
    } catch { /* not initialized yet */ }
  },
}))
