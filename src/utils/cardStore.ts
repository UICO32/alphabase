import { create } from 'zustand'
import { renderBlocksToHTML } from './renderBlocks'
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
}

interface CardStore {
  cards: Record<string, GlobalCard>
  isLoaded: boolean
  addCard: (card: GlobalCard) => void
  updateCard: (id: string, props: Partial<GlobalCard>) => void
  deleteCard: (id: string) => void
  softDeleteCard: (id: string) => void
  restoreCard: (id: string) => void
  importCards: (cards: Record<string, GlobalCard>) => void
  loadCardsFromDB: (cards?: Record<string, GlobalCard>) => Promise<void>
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

      addCard: (card) => {
        set((state) => ({ cards: { ...state.cards, [card.id]: ensurePreviewHTML(card) } }))
      },

      updateCard: (id, props) => {
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
  }),
)
