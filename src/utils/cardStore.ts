import { create } from 'zustand'
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

export const useCardStore = create<CardStore>()((set, get) => ({
  cards: {},
  isLoaded: false,

  addCard: (card) => {
    set((state) => ({ cards: { ...state.cards, [card.id]: card } }))
  },

  updateCard: (id, props) => {
    set((state) => {
      const existing = state.cards[id]
      if (!existing) return state
      const updated = { ...existing, ...props }
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
      const merged = { ...state.cards, ...cards }
      return { cards: merged }
    })
  },

  loadCardsFromDB: async () => {
    if (get().isLoaded) return
    set({ isLoaded: true })
  },
}))
