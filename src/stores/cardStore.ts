import { create } from 'zustand'
import { useCallback } from 'react'
import { renderBlocksToHTML } from '../converters/renderBlocks'
import { flushActiveSyncEngine } from '../sync/syncEngineRef'
import { useEditorHistoryStore } from './editorHistoryStore'
import { embeddingStore } from './embeddingStore'
import type { CardColor } from '../types/card'

/**
 * 模块级 HTML 渲染缓存。
 *
 * 为什么不用 cardId 做键：内容变化时缓存键必须随之失效，
 * 用 content 字符串本身做键，内容一变自然落到新键，旧键无需手动清除。
 *
 * 为什么不用 store state 持久化：getPreviewHTML 在多个组件 render body 中
 * 被调用（CardContent / CardActionBar / MiniCard / CollapsedContent），
 * 写回 store 会触发额外的 setState → 订阅重渲染，反而抵消缓存收益。
 * 模块级 Map 是被动读取、零订阅开销。
 *
 * 仅在缓存未命中时计算一次 renderBlocksToHTML（含 JSON parse + 块序列化），
 * 命中后所有组件共享同一份 HTML 字符串。
 *
 * 容量上限：编辑时每次键入的中间态都会作为新键写入且永不主动清理，
 * 长期使用会让缓存无限膨胀。用 Map 的插入顺序做近似 LRU，
 * 超出上限时淘汰最早插入的键（set 已存在的键会刷新其位置）。
 */
const previewHTMLCache = new Map<string, string>()
const PREVIEW_HTML_CACHE_LIMIT = 300

function cachePreviewHTML(content: string, html: string) {
  previewHTMLCache.set(content, html)
  if (previewHTMLCache.size > PREVIEW_HTML_CACHE_LIMIT) {
    const oldest = previewHTMLCache.keys().next().value
    if (oldest !== undefined) previewHTMLCache.delete(oldest)
  }
}

function scheduleIdle(callback: () => void) {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(() => callback())
    return
  }
  setTimeout(callback, 16)
}

function dropStoredPreviewHTML(card: GlobalCard): GlobalCard {
  if (!card.previewHTML) return card
  return { ...card, previewHTML: undefined }
}

function dropStoredPreviewHTMLBatch(cards: Record<string, GlobalCard>): Record<string, GlobalCard> {
  let changed = false
  const normalized: Record<string, GlobalCard> = {}
  for (const [id, card] of Object.entries(cards)) {
    const next = dropStoredPreviewHTML(card)
    normalized[id] = next
    if (next !== card) changed = true
  }
  return changed ? normalized : cards
}

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
  variant?: string
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
      // New card — queue incremental indexing
      embeddingStore.getState().indexCardDebounced(card.id)
    },

    updateCard: (id, props) => {
      useEditorHistoryStore.getState().consumeUndoFlag(id)
      const contentOrTitleChanged = 'content' in props || 'title' in props
      set((state) => {
        const card = state.cards[id]
        if (!card) return state
        const updated = { ...card, ...props, updatedAt: Date.now() }
        if ('content' in props) {
          updated.previewHTML = undefined
        }
        return { cards: { ...state.cards, [id]: updated } }
      })
      // Content/title changes affect the vector — debounced re-index
      if (contentOrTitleChanged) {
        embeddingStore.getState().indexCardDebounced(id)
      }
    },

    deleteCard: (id) => {
      set((state) => {
        const next = { ...state.cards }
        delete next[id]
        return { cards: next }
      })
      // Clear the vector immediately so 3D clustering drops the ghost house
      void embeddingStore.getState().removeVector(id)
    },

    softDeleteCard: (id) => {
      set((state) => {
        const existing = state.cards[id]
        if (!existing) return state
        return { cards: { ...state.cards, [id]: { ...existing, deletedAt: Date.now() } } }
      })
      void embeddingStore.getState().removeVector(id)
    },

    restoreCard: (id) => {
      set((state) => {
        const existing = state.cards[id]
        if (!existing) return state
        const { deletedAt, ...rest } = existing
        return { cards: { ...state.cards, [id]: rest as GlobalCard } }
      })
      // Restored card needs to be re-vectorized
      embeddingStore.getState().indexCardDebounced(id)
    },

    importCards: (cards) => {
      set((state) => {
        const merged = dropStoredPreviewHTMLBatch({ ...state.cards, ...cards })
        return { cards: merged }
      })
    },

    loadCardsFromDB: async (cards) => {
      if (get().isLoaded) return
      if (cards) {
        // Drop stale generated previews; current previewHTML is regenerated lazily.
        set({ cards: dropStoredPreviewHTMLBatch(cards), isLoaded: true })
      } else {
        set({ isLoaded: true })
      }
    },

    // 强制重新加载：忽略 isLoaded 守卫，用磁盘上的最新数据覆盖 store。
    // 用于合并/备份恢复后重新加载（此时 isLoaded 仍为 true，loadCardsFromDB 会提前返回）。
    reloadFromDB: async (cards) => {
      if (cards) {
        set({ cards: dropStoredPreviewHTMLBatch(cards), isLoaded: true })
      } else {
        set({ cards: {}, isLoaded: true })
      }
    },

    getPreviewHTML: (cardId) => {
      const card = get().cards[cardId]
      if (!card) return undefined
      // 1) card 上已持久化的 previewHTML 优先（来自本次运行的 schedulePreviewHTMLGeneration 预生成）
      if (card.previewHTML) return card.previewHTML
      if (!card.content) return undefined
      // 2) 模块级缓存：用 content 字符串做键，内容变化自动失效
      const cached = previewHTMLCache.get(card.content)
      if (cached !== undefined) {
        // 命中时刷新插入位置，让 Map 保持近似 LRU 淘汰顺序
        previewHTMLCache.delete(card.content)
        previewHTMLCache.set(card.content, cached)
        return cached
      }
      // 3) 未命中：计算一次并写回缓存（带容量上限的近似 LRU）
      const html = renderBlocksToHTML(card.content)
      cachePreviewHTML(card.content, html)
      return html
    },

    // Generate previewHTML for a batch of cards (e.g. visible in library)
    ensurePreviewHTMLBatch: (cardIds) => {
      const state = get()
      const updates: Record<string, GlobalCard> = {}
      for (const id of cardIds) {
        const card = state.cards[id]
        if (card && !card.previewHTML && card.content) {
          // 复用 getPreviewHTML 的缓存路径，避免此处独立计算
          const html = get().getPreviewHTML(id)
          if (html !== undefined) {
            updates[id] = { ...card, previewHTML: html }
          }
        }
      }
      if (Object.keys(updates).length > 0) {
        set((s) => ({ cards: { ...s.cards, ...updates } }))
      }
    },

    // Schedule background generation of all missing previewHTML
    // Generates first BATCH_SIZE immediately, then yields via requestIdleCallback
    schedulePreviewHTMLGeneration: () => {
      const BATCH_SIZE = 4
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
          scheduleIdle(generateNext)
        }
      }
      scheduleIdle(generateNext)
    },
  }),
)

export function useCard(cardId: string) {
  return useCardStore(
    useCallback((s) => s.cards[cardId], [cardId])
  )
}
