import { create } from 'zustand'
import type { CardColor, CardVariant } from '../types/card'
import { saveCard, loadAllCards, deleteCard as deleteCardFromDB } from './db'

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
    saveCard(card).catch((e) => console.warn('Failed to save card to IndexedDB:', e))
  },

  updateCard: (id, props) => {
    set((state) => {
      const existing = state.cards[id]
      if (!existing) return state
      const updated = { ...existing, ...props }
      saveCard(updated).catch((e) => console.warn('Failed to update card in IndexedDB:', e))
      return { cards: { ...state.cards, [id]: updated } }
    })
  },

  deleteCard: (id) => {
    set((state) => {
      const next = { ...state.cards }
      delete next[id]
      deleteCardFromDB(id).catch((e) => console.warn('Failed to delete card from IndexedDB:', e))
      return { cards: next }
    })
  },

  importCards: (cards) => {
    set((state) => {
      const merged = { ...state.cards, ...cards }
      for (const card of Object.values(cards)) {
        saveCard(card).catch((e) => console.warn('Failed to import card to IndexedDB:', e))
      }
      return { cards: merged }
    })
  },

  loadCardsFromDB: async () => {
    if (get().isLoaded) return
    try {
      const cardsArray = await loadAllCards() as GlobalCard[]
      const cards: Record<string, GlobalCard> = {}
      for (const card of cardsArray) {
        cards[card.id] = card
      }
      set({ cards, isLoaded: true })
    } catch (e) {
      console.warn('Failed to load cards from IndexedDB:', e)
      set({ isLoaded: true })
    }
  },
}))
