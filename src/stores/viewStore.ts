import { create } from 'zustand'

export type ViewMode = 'board' | 'cards' | 'boardLibrary'

interface ViewStore {
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void

  editingCardId: string | null
  setEditingCardId: (cardId: string | null) => void
  openCardEditor: (cardId: string) => void
  closeCardEditor: () => void

  /** Card created by double-click — auto-deleted on pane click if still empty */
  autoEditCardId: string | null
  setAutoEditCardId: (cardId: string | null) => void

  kanbanEditDialogCardId: string | null
  kanbanEditDialogSourceRect: DOMRect | null
  openKanbanEditDialog: (cardId: string, sourceRect: DOMRect | null) => void
  closeKanbanEditDialog: () => void
}

export const useViewStore = create<ViewStore>()(
  (set) => ({
    viewMode: 'board',
    editingCardId: null,
    autoEditCardId: null,
    kanbanEditDialogCardId: null,
    kanbanEditDialogSourceRect: null,

    setViewMode: (mode) => set({ viewMode: mode }),

    openCardEditor: (cardId) => set({ editingCardId: cardId }),
    closeCardEditor: () => set({ editingCardId: null }),
    setEditingCardId: (cardId) => set({ editingCardId: cardId }),
    setAutoEditCardId: (cardId) => set({ autoEditCardId: cardId }),

    openKanbanEditDialog: (cardId, sourceRect) =>
      set({ kanbanEditDialogCardId: cardId, kanbanEditDialogSourceRect: sourceRect }),
    closeKanbanEditDialog: () =>
      set({ kanbanEditDialogCardId: null, kanbanEditDialogSourceRect: null }),
  }),
)
