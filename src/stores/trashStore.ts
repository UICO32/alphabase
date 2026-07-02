import { create } from 'zustand'
import type { CardColor } from '../types/card'

export interface TrashItem {
  id: string
  cardId: string
  title: string
  deletedAt: number
  expiresAt: number
  content: string
  color: CardColor
  variant?: string
  createdAt: number
  enforceInitialHeading?: boolean
  fixedHeight?: boolean
  collapsed?: boolean
}

const TRASH_EXPIRY_DAYS = 30

interface TrashStore {
  items: TrashItem[]
  addItem: (item: Omit<TrashItem, 'deletedAt' | 'expiresAt'>) => void
  removeItem: (cardId: string) => void
  restoreItem: (cardId: string) => TrashItem | undefined
  clearExpired: () => void
}

export const useTrashStore = create<TrashStore>()((set, get) => ({
  items: [],

  addItem: (item) => {
    const now = Date.now()
    const trashItem: TrashItem = {
      ...item,
      deletedAt: now,
      expiresAt: now + TRASH_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    }
    set((state) => ({ items: [...state.items, trashItem] }))
  },

  removeItem: (cardId) =>
    set((state) => ({
      items: state.items.filter((i) => i.cardId !== cardId),
    })),

  restoreItem: (cardId) => {
    const item = get().items.find((i) => i.cardId === cardId)
    if (item) {
      set((state) => ({ items: state.items.filter((i) => i.cardId !== cardId) }))
    }
    return item
  },

  clearExpired: () => {
    const now = Date.now()
    set((state) => ({
      items: state.items.filter((i) => i.expiresAt > now),
    }))
  },
}))
