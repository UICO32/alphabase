import { create } from 'zustand'
import { renderBlocksToHTML } from './renderBlocks'
import type { CardColor, CardVariant } from '../types/card'

export interface GlobalCard {
  id: string
  content: string
  color: CardColor
  variant: CardVariant
  createdAt: number
  enforceInitialHeading?: boolean
  fixedHeight?: boolean
  collapsed?: boolean
  title?: string
  previewHTML?: string
  [key: string]: unknown
}

interface CardStore {
  cards: Record<string, GlobalCard>
  isLoaded: boolean
  addCard: (card: GlobalCard) => void
  updateCard: (id: string, props: Partial<GlobalCard>) => void
  deleteCard: (id: string) => void
  importCards: (cards: Record<string, GlobalCard>) => void
  loadCardsFromDB: () => Promise<void>
}

function ensurePreviewHTML(card: GlobalCard): GlobalCard {
  if (!card.previewHTML && card.content) {
    return { ...card, previewHTML: renderBlocksToHTML(card.content) }
  }
  return card
}

export const useCardStore = create<CardStore>()((set, get) => ({
  cards: {},
  isLoaded: false,

  addCard: (card) => {
    set((state) => ({ cards: { ...state.cards, [card.id]: ensurePreviewHTML(card) } }))
  },

  updateCard: (id, props) => {
    set((state) => {
      const existing = state.cards[id]
      if (!existing) return state
      const updated = { ...existing, ...props }
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

  loadCardsFromDB: async () => {
    if (get().isLoaded) return
    set({ isLoaded: true })
  },
}))
