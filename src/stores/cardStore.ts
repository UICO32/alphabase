import { create } from 'zustand'
import { useCallback } from 'react'
import { renderBlocksToHTML } from '../converters/renderBlocks'
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
  recordCardContentSnapshot: (cardId: string) => void
  undoCardContent: (cardId: string) => string | null
  redoCardContent: (cardId: string) => string | null
  clearCardHistory: (cardId?: string) => void
}

function ensurePreviewHTML(card: GlobalCard): GlobalCard {
  if (!card.previewHTML && card.content) {
    return { ...card, previewHTML: renderBlocksToHTML(card.content) }
  }
  return card
}

export const useCardStore = create<CardStore>()(
  (set, get) => ({
      cards: {},
      isLoaded: false,
      cardHistory: {},
      isUndoingContent: {},

      addCard: (card) => {
        set((state) => ({ cards: { ...state.cards, [card.id]: ensurePreviewHTML(card) } }))
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
            updated.previewHTML = renderBlocksToHTML(updated.content)
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
          const withPreviews: Record<string, GlobalCard> = {}
          for (const [id, card] of Object.entries(cards)) {
            withPreviews[id] = ensurePreviewHTML(card)
          }
          const merged = { ...state.cards, ...withPreviews }
          return { cards: merged }
        })
      },

      loadCardsFromDB: async (cards) => {
        if (get().isLoaded) return
        if (cards) {
          const withPreviews: Record<string, GlobalCard> = {}
          for (const [id, card] of Object.entries(cards)) {
            withPreviews[id] = ensurePreviewHTML(card)
          }
          set({ cards: withPreviews, isLoaded: true })
        } else {
          set({ isLoaded: true })
        }
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
