import { create } from 'zustand'
import { useWorkspaceStore } from './workspaceStore'
import { flushActiveSyncEngine } from '../sync/syncEngineRef'

interface EmbeddingState {
  indexing: boolean
  progress: number
  total: number
  currentCardId: string
  indexed: boolean
  cardCount: number
  lastIndexedAt: string | null
  modelAvailable: boolean
  modelDir: string
  searchResults: Array<{ cardId: string; score: number }>
  searchScores: Record<string, number>
  searching: boolean
  threshold: number

  initEmbedding: (workspacePath: string) => Promise<void>
  startIndexing: () => Promise<void>
  cancelIndexing: () => Promise<void>
  searchRelated: (cardId: string, topK?: number) => Promise<void>
  searchByText: (query: string, topK?: number) => Promise<void>
  clearResults: () => void
  setThreshold: (value: number) => Promise<void>
  checkStatus: () => Promise<void>
}

export const useEmbeddingStore = create<EmbeddingState>((set) => ({
  indexing: false,
  progress: 0,
  total: 0,
  currentCardId: '',
  indexed: false,
  cardCount: 0,
  lastIndexedAt: null,
  modelAvailable: false,
  modelDir: '',
  searchResults: [],
  searchScores: {},
  searching: false,
  threshold: 0.75,

  initEmbedding: async (workspacePath: string) => {
    const result = await window.electronAPI.embedding.init(workspacePath)
    // [需谨慎] 保留 error 检查，生产环境仍需感知初始化失败
    if (result.error) console.error('[embeddingStore] init failed:', result.error)
  },

  startIndexing: async () => {
    set({ indexing: true, progress: 0, total: 0 })

    await flushActiveSyncEngine()

    const offProgress = window.electronAPI.embedding.onProgress((data) => {
      set({ progress: data.current, total: data.total })
    })

    // 提取统一的 cleanup 函数，避免正常/错误路径重复调用 offProgress+offComplete+offError
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
        cardCount: data.indexed,
        lastIndexedAt: new Date().toISOString(),
      })
      cleanup()
    })

    const offError = window.electronAPI.embedding.onError((data) => {
      console.error('[embeddingStore] error:', data.message)
      set({ indexing: false })
      cleanup()
    })

    let result = await window.electronAPI.embedding.indexAll()
    if (result.error === 'NOT_INITIALIZED') {
      const workspacePath = useWorkspaceStore.getState().currentWorkspace?.path
        || localStorage.getItem('hepta-last-workspace-path')
      if (workspacePath) {
        const initResult = await window.electronAPI.embedding.init(workspacePath)
        if (!initResult.error) {
          result = await window.electronAPI.embedding.indexAll()
        }
      }
    }
    if (result.error) {
      console.error('[embeddingStore] indexAll error:', result.error)
      set({ indexing: false })
      if (result.error === 'MODEL_MISSING') {
        set({ modelAvailable: false })
      }
      cleanup()
    }
  },

  cancelIndexing: async () => {
    await window.electronAPI.embedding.cancel()
    set({ indexing: false })
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
        indexed: status.docCount > 0,
        modelAvailable: status.modelAvailable ?? false,
        modelDir: status.modelDir ?? '',
      })
    } catch {
      // checkStatus 失败不影响主流程，静默处理
    }
  },
}))
