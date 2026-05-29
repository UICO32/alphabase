import type { GlobalCard } from '../stores/cardStore'
import { useCardStore } from '../stores/cardStore'
import { useTrashStore } from '../stores/trashStore'
import type { TrashItem } from '../stores/trashStore'
import type { CardColor } from '../types/card'

interface CreateCardOptions {
  content?: string
  color?: CardColor
  title?: string
  x?: number
  y?: number
  w?: number
  h?: number
}

interface APIResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

declare global {
  interface Window {
    heptabaseAPI: typeof heptabaseAPI
  }
}

export const heptabaseAPI = {
  cards: {
    list: (): APIResponse<GlobalCard[]> => {
      try {
        const cards = Object.values(useCardStore.getState().cards)
        return { success: true, data: cards }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    },

    get: (id: string): APIResponse<GlobalCard | null> => {
      try {
        const card = useCardStore.getState().cards[id]
        return { success: true, data: card || null }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    },

    create: (options: CreateCardOptions = {}): APIResponse<GlobalCard> => {
      try {
        const id = `card_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
        const card: GlobalCard = {
          id,
          content: options.content || '',
          color: options.color || 'white',
          createdAt: Date.now(),
          ...(options.title ? { title: options.title } : {}),
        }
        useCardStore.getState().addCard(card)
        return { success: true, data: card }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    },

    update: (id: string, props: Partial<GlobalCard>): APIResponse<GlobalCard> => {
      try {
        const store = useCardStore.getState()
        const existing = store.cards[id]
        if (!existing) {
          return { success: false, error: `Card ${id} not found` }
        }
        store.updateCard(id, props)
        const updated = useCardStore.getState().cards[id]
        return { success: true, data: updated }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    },

    delete: (id: string): APIResponse<void> => {
      try {
        const store = useCardStore.getState()
        if (!store.cards[id]) {
          return { success: false, error: `Card ${id} not found` }
        }
        store.deleteCard(id)
        return { success: true }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    },

    clear: (): APIResponse<void> => {
      try {
        const store = useCardStore.getState()
        const cards = Object.keys(store.cards)
        for (const id of cards) {
          store.deleteCard(id)
        }
        return { success: true }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    },

    softDelete: (id: string): APIResponse<void> => {
      try {
        const store = useCardStore.getState()
        if (!store.cards[id]) {
          return { success: false, error: `Card ${id} not found` }
        }
        const card = store.cards[id]
        store.softDeleteCard(id)
        useTrashStore.getState().addItem({
          id: `trash-${id}`,
          cardId: id,
          title: card.title || '无标题',
          content: card.content,
          color: card.color,
          createdAt: card.createdAt,
          enforceInitialHeading: card.enforceInitialHeading,
          fixedHeight: card.fixedHeight,
          collapsed: card.collapsed,
        })
        return { success: true }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    },

    restore: (id: string): APIResponse<void> => {
      try {
        const store = useCardStore.getState()
        if (!store.cards[id]) {
          return { success: false, error: `Card ${id} not found` }
        }
        store.restoreCard(id)
        useTrashStore.getState().removeItem(id)
        return { success: true }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    },
  },

  trash: {
    list: (): APIResponse<TrashItem[]> => {
      try {
        return { success: true, data: useTrashStore.getState().items }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    },

    permanentDelete: (cardId: string): APIResponse<void> => {
      try {
        useTrashStore.getState().removeItem(cardId)
        useCardStore.getState().deleteCard(cardId)
        return { success: true }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    },
  },

  canvas: {
    getShapes: (): APIResponse<unknown[]> => {
      try {
        const editor = (window as unknown as { __tldraw_editor?: unknown }).__tldraw_editor
        if (!editor || typeof (editor as { getCurrentPageShapes?: () => unknown[] }).getCurrentPageShapes !== 'function') {
          return { success: false, error: 'Editor not available' }
        }
        const shapes = (editor as { getCurrentPageShapes: () => unknown[] }).getCurrentPageShapes()
        return { success: true, data: shapes }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    },

    createCardShape: (options: CreateCardOptions = {}): APIResponse<{ shapeId: string; cardId: string }> => {
      try {
        const editor = (window as unknown as { __tldraw_editor?: unknown }).__tldraw_editor
        if (!editor) {
          return { success: false, error: 'Editor not available' }
        }

        const cardResult = heptabaseAPI.cards.create(options)
        if (!cardResult.success || !cardResult.data) {
          return { success: false, error: cardResult.error || 'Failed to create card' }
        }

        const card = cardResult.data
        const shapeId = `shape:${card.id}`

        const ed = editor as {
          createShapes: (shapes: unknown[]) => void
        }

        ed.createShapes([{
          id: shapeId,
          type: 'card',
          x: options.x ?? 100,
          y: options.y ?? 100,
          props: {
            w: options.w ?? 280,
            h: options.h ?? 200,
            cardId: card.id,
          },
        }])

        return { success: true, data: { shapeId, cardId: card.id } }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    },

    exportSnapshot: (): APIResponse<unknown> => {
      try {
        const editor = (window as unknown as { __tldraw_editor?: unknown }).__tldraw_editor
        if (!editor || typeof (editor as { getSnapshot?: () => unknown }).getSnapshot !== 'function') {
          return { success: false, error: 'Editor not available' }
        }
        const snapshot = (editor as { getSnapshot: () => unknown }).getSnapshot()
        return { success: true, data: snapshot }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    },
  },

  info: () => ({
    name: 'Heptabase Canvas API',
    version: '0.1.0',
    commands: [
      'heptabaseAPI.cards.list()',
      'heptabaseAPI.cards.get(id)',
      'heptabaseAPI.cards.create(options)',
      'heptabaseAPI.cards.update(id, props)',
      'heptabaseAPI.cards.delete(id)',
      'heptabaseAPI.cards.softDelete(id)',
      'heptabaseAPI.cards.restore(id)',
      'heptabaseAPI.cards.clear()',
      'heptabaseAPI.trash.list()',
      'heptabaseAPI.trash.permanentDelete(cardId)',
      'heptabaseAPI.canvas.getShapes()',
      'heptabaseAPI.canvas.createCardShape(options)',
      'heptabaseAPI.canvas.exportSnapshot()',
    ],
  }),
}

export function initAPI() {
  if (typeof window !== 'undefined') {
    window.heptabaseAPI = heptabaseAPI
  }
}
