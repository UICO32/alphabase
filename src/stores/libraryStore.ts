import { create } from 'zustand'

export type SortBy = 'updatedAt' | 'createdAt' | 'title' | 'related'
export type SearchMode = 'hybrid' | 'keyword' | 'semantic'

interface LibraryStore {
  sortBy: SortBy
  setSortBy: (sortBy: SortBy) => void

  searchMode: SearchMode
  setSearchMode: (mode: SearchMode) => void

  webviewUrl: string | null
  webviewSourceCardId: string | null
  setWebviewUrl: (url: string | null, cardId?: string | null) => void

  tagFilter: string | null
  setTagFilter: (tag: string | null) => void

  zoom: number
  setZoom: (zoom: number) => void

  isZoomPreviewVisible: boolean
  setZoomPreviewVisible: (visible: boolean) => void

  transform: [number, number, number]
  setTransform: (transform: [number, number, number]) => void
}

export const useLibraryStore = create<LibraryStore>()(
  (set) => ({
    sortBy: 'updatedAt',
    searchMode: 'hybrid',
    webviewUrl: null,
    webviewSourceCardId: null,
    tagFilter: null,
    zoom: 1,
    isZoomPreviewVisible: false,
    transform: [0, 0, 1],

    setSortBy: (sortBy) => set({ sortBy }),
    setSearchMode: (mode) => set({ searchMode: mode }),

    setWebviewUrl: (url, cardId) => set((state) => {
      const webviewSourceCardId = cardId ?? null
      if (state.webviewUrl === url && state.webviewSourceCardId === webviewSourceCardId) {
        return state
      }
      return { webviewUrl: url, webviewSourceCardId }
    }),

    setTagFilter: (tag) => set({ tagFilter: tag }),

    setZoom: (zoom) => set({ zoom }),
    setZoomPreviewVisible: (visible) => set((state) => (
      state.isZoomPreviewVisible === visible ? state : { isZoomPreviewVisible: visible }
    )),
    setTransform: (transform) => set({ transform }),
  }),
)
