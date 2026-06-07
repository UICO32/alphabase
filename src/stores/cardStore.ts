import { create } from 'zustand'
import { useCallback } from 'react'
import { renderBlocksToHTML } from '../converters/renderBlocks'
import { flushActiveSyncEngine } from '../sync/syncEngineRef'
import type { CardColor } from '../types/card'

export interface GlobalCard {
  id: string
  content: string
  color: CardColor
  createdAt: number
  updatedAt?: number
  enforceInitialHeading?: boolean
  fixedHeight?: boolean
  collapsed?: boolean
  title?: string
  previewHTML?: string
  deletedAt?: number
  tags?: string[]
  flomoSlug?: string
  sourceUrl?: string  // clip 来源 URL
}

interface CardHistoryState {
  entries: string[]
  index: number
}

interface CardStore {
  cards: Record<string, GlobalCard>
  isLoaded: boolean
  cardHistory: Record<string, CardHistoryState>
  isUndoingContent: Record<string, boolean>
  addCard: (card: GlobalCard) => void
  updateCard: (id: string, props: Partial<GlobalCard>) => void
  deleteCard: (id: string) => void
  softDeleteCard: (id: string) => void
  restoreCard: (id: string) => void
  importCards: (cards: Record<string, GlobalCard>) => void
  loadCardsFromDB: (cards?: Record<string, GlobalCard>) => Promise<void>
  getPreviewHTML: (cardId: string) => string | undefined
  ensurePreviewHTMLBatch: (cardIds: string[]) => void
  schedulePreviewHTMLGeneration: () => void
  recordCardContentSnapshot: (cardId: string) => void
  undoCardContent: (cardId: string) => string | null
  redoCardContent: (cardId: string) => string | null
  clearCardHistory: (cardId?: string) => void
}

export const useCardStore = create<CardStore>()(
  (set, get) => ({
    cards: {},
    isLoaded: false,
    cardHistory: {},
    isUndoingContent: {},

    addCard: (card) => {
      set((state) => ({ cards: { ...state.cards, [card.id]: card } }))
      flushActiveSyncEngine()
    },

    updateCard: (id, props) => {
      const isUndoing = get().isUndoingContent[id]
      if (isUndoing) {
        set((state) => {
          const { [id]: _, ...rest } = state.isUndoingContent
          return { isUndoingContent: rest }
        })
      }
      set((state) => {
        const existing = state.cards[id]
        if (!existing) return state
        const updated = { ...existing, ...props, updatedAt: Date.now() }
        if ('content' in props) {
          updated.previewHTML = undefined
        }
        return { cards: { ...state.cards, [id]: updated } }
      })
    },

    deleteCard: (id) => {
      set((state) => {
        const next = { ...state.cards }
        delete next[id]
        return { cards: next }
      })
    },

    softDeleteCard: (id) => {
      set((state) => {
        const existing = state.cards[id]
        if (!existing) return state
        return { cards: { ...state.cards, [id]: { ...existing, deletedAt: Date.now() } } }
      })
    },

    restoreCard: (id) => {
      set((state) => {
        const existing = state.cards[id]
        if (!existing) return state
        const { deletedAt, ...rest } = existing
        return { cards: { ...state.cards, [id]: rest as GlobalCard } }
      })
    },

    importCards: (cards) => {
      set((state) => {
        const merged = { ...state.cards, ...cards }
        return { cards: merged }
      })
    },

    loadCardsFromDB: async (cards) => {
      if (get().isLoaded) return
      if (cards) {
        // Store cards without previewHTML — generation is deferred
        set({ cards, isLoaded: true })
      } else {
        set({ isLoaded: true })
      }
    },

    getPreviewHTML: (cardId) => {
      const card = get().cards[cardId]
      if (!card) return undefined
      if (card.previewHTML) return card.previewHTML
      // Generate on demand and cache
      const html = renderBlocksToHTML(card.content)
      // Mutate + shallow set to avoid re-creating all cards
      card.previewHTML = html
      return html
    },

    // Generate previewHTML for a batch of cards (e.g. visible in library)
    ensurePreviewHTMLBatch: (cardIds) => {
      const state = get()
      let anyChanged = false
      for (const id of cardIds) {
        const card = state.cards[id]
        if (card && !card.previewHTML && card.content) {
          card.previewHTML = renderBlocksToHTML(card.content)
          anyChanged = true
        }
      }
      if (anyChanged) {
        // Trigger re-render by shallow copying the cards record
        set({ cards: { ...state.cards } })
      }
    },

    // Schedule background generation of all missing previewHTML
    // Generates first BATCH_SIZE immediately, then yields via requestIdleCallback
    schedulePreviewHTMLGeneration: () => {
      const BATCH_SIZE = 16
      const state = get()
      const missingIds = Object.keys(state.cards).filter(
        id => !state.cards[id].previewHTML && state.cards[id].content
      )
      if (missingIds.length === 0) return

      // First batch: generate immediately for responsive UI
      const firstBatch = missingIds.slice(0, BATCH_SIZE)
      get().ensurePreviewHTMLBatch(firstBatch)

      // Remaining batches: generate during idle time
      const remaining = missingIds.slice(BATCH_SIZE)
      if (remaining.length === 0) return

      let idx = 0
      const generateNext = () => {
        const batch = remaining.slice(idx, idx + BATCH_SIZE)
        if (batch.length === 0) return
        idx += BATCH_SIZE
        get().ensurePreviewHTMLBatch(batch)
        if (idx < remaining.length) {
          (requestIdleCallback || setTimeout)(generateNext)
        }
      }
      (requestIdleCallback || setTimeout)(generateNext)
    },

    recordCardContentSnapshot: (cardId) => {
      const card = get().cards[cardId]
      if (!card) return
      const content = card.content
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

    undoCardContent: (cardId) => {
      const history = get().cardHistory[cardId]
      if (!history || history.index <= 0) return null
      const newIndex = history.index - 1
      set((state) => ({
        cardHistory: { ...state.cardHistory, [cardId]: { ...history, index: newIndex } },
        isUndoingContent: { ...state.isUndoingContent, [cardId]: true },
      }))
      return history.entries[newIndex]
    },

    redoCardContent: (cardId) => {
      const history = get().cardHistory[cardId]
      if (!history || history.index >= history.entries.length - 1) return null
      const newIndex = history.index + 1
      set((state) => ({
        cardHistory: { ...state.cardHistory, [cardId]: { ...history, index: newIndex } },
        isUndoingContent: { ...state.isUndoingContent, [cardId]: true },
      }))
      return history.entries[newIndex]
    },

    clearCardHistory: (cardId) => {
      if (cardId) {
        set((state) => {
          const { [cardId]: _, ...rest } = state.cardHistory
          return { cardHistory: rest }
        })
      } else {
        set({ cardHistory: {} })
      }
    },
  }),
)

export function useCard(cardId: string) {
  return useCardStore(
    useCallback((s) => s.cards[cardId], [cardId])
  )
}
