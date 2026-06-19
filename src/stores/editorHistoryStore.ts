import { create } from 'zustand'

interface CardHistoryState {
  entries: string[]
  index: number
}

interface EditorHistoryStore {
  cardHistory: Record<string, CardHistoryState>
  isUndoingContent: Record<string, boolean>
  recordSnapshot: (cardId: string, content: string) => void
  undoContent: (cardId: string) => string | null
  redoContent: (cardId: string) => string | null
  clearHistory: (cardId?: string) => void
  consumeUndoFlag: (cardId: string) => void
}

export const useEditorHistoryStore = create<EditorHistoryStore>()(
  (set, get) => ({
    cardHistory: {},
    isUndoingContent: {},

    recordSnapshot: (cardId, content) => {
      const history = get().cardHistory[cardId]
      if (history && history.entries[history.index] === content) return
      set((state) => {
        const prev = state.cardHistory[cardId] ?? { entries: [], index: -1 }
        const entries = prev.index < prev.entries.length - 1
          ? [...prev.entries.slice(0, prev.index + 1), content]
          : [...prev.entries, content]
        if (entries.length > 10) entries.shift()
        const index = entries.length - 1
        return { cardHistory: { ...state.cardHistory, [cardId]: { entries, index } } }
      })
    },

    undoContent: (cardId) => {
      const history = get().cardHistory[cardId]
      if (!history || history.index <= 0) return null
      const newIndex = history.index - 1
      set((state) => ({
        cardHistory: { ...state.cardHistory, [cardId]: { ...history, index: newIndex } },
        isUndoingContent: { ...state.isUndoingContent, [cardId]: true },
      }))
      return history.entries[newIndex]
    },

    redoContent: (cardId) => {
      const history = get().cardHistory[cardId]
      if (!history || history.index >= history.entries.length - 1) return null
      const newIndex = history.index + 1
      set((state) => ({
        cardHistory: { ...state.cardHistory, [cardId]: { ...history, index: newIndex } },
        isUndoingContent: { ...state.isUndoingContent, [cardId]: true },
      }))
      return history.entries[newIndex]
    },

    clearHistory: (cardId) => {
      if (cardId) {
        set((state) => {
          const { [cardId]: _, ...rest } = state.cardHistory
          return { cardHistory: rest }
        })
      } else {
        set({ cardHistory: {} })
      }
    },

    consumeUndoFlag: (cardId) => {
      const isUndoing = get().isUndoingContent[cardId]
      if (isUndoing) {
        set((state) => {
          const { [cardId]: _, ...rest } = state.isUndoingContent
          return { isUndoingContent: rest }
        })
      }
    },
  }),
)
