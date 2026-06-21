import { create } from 'zustand'
import { useCallback } from 'react'
import { renderBlocksToHTML } from '../converters/renderBlocks'
import { flushActiveSyncEngine } from '../sync/syncEngineRef'
import { useEditorHistoryStore } from './editorHistoryStore'
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
  sourceUrl?: string
  viewMode?: 'editor' | 'web'
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
  reloadFromDB: (cards?: Record<string, GlobalCard>) => Promise<void>
  getPreviewHTML: (cardId: string) => string | undefined
  ensurePreviewHTMLBatch: (cardIds: string[]) => void
  schedulePreviewHTMLGeneration: () => void
}

export const useCardStore = create<CardStore>()(
  (set, get) => ({
    cards: {},
    isLoaded: false,

    addCard: (card) => {
      set((state) => ({ cards: { ...state.cards, [card.id]: card } }))
      flushActiveSyncEngine()
    },

    updateCard: (id, props) => {
      useEditorHistoryStore.getState().consumeUndoFlag(id)
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

    // 强制重新加载：忽略 isLoaded 守卫，用磁盘上的最新数据覆盖 store。
    // 用于合并/备份恢复后重新加载（此时 isLoaded 仍为 true，loadCardsFromDB 会提前返回）。
    reloadFromDB: async (cards) => {
      if (cards) {
        set({ cards, isLoaded: true })
      } else {
        set({ cards: {}, isLoaded: true })
      }
    },

    getPreviewHTML: (cardId) => {
      const card = get().cards[cardId]
      if (!card) return undefined
      if (card.previewHTML) return card.previewHTML
      if (!card.content) return undefined
      return renderBlocksToHTML(card.content)
    },

    // Generate previewHTML for a batch of cards (e.g. visible in library)
    ensurePreviewHTMLBatch: (cardIds) => {
      const state = get()
      const updates: Record<string, GlobalCard> = {}
      for (const id of cardIds) {
        const card = state.cards[id]
        if (card && !card.previewHTML && card.content) {
          updates[id] = { ...card, previewHTML: renderBlocksToHTML(card.content) }
        }
      }
      if (Object.keys(updates).length > 0) {
        set((s) => ({ cards: { ...s.cards, ...updates } }))
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
  }),
)

export function useCard(cardId: string) {
  return useCardStore(
    useCallback((s) => s.cards[cardId], [cardId])
  )
}
