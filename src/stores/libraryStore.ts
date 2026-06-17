import { create } from 'zustand'
import type { GridPattern } from '../components/canvas/AdaptiveBackground'

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

  zoom: number
  setZoom: (zoom: number) => void

  transform: [number, number, number]
  setTransform: (transform: [number, number, number]) => void
}

export const useLibraryStore = create<LibraryStore>()(
  (set) => ({
    sortBy: 'updatedAt',
    searchMode: 'hybrid',
    webviewUrl: null,
    webviewSourceCardId: null,
    zoom: 1,
    transform: [0, 0, 1],

    setSortBy: (sortBy) => set({ sortBy }),
    setSearchMode: (mode) => set({ searchMode: mode }),

    setWebviewUrl: (url, cardId) => set({
      webviewUrl: url,
      webviewSourceCardId: cardId ?? null,
    }),

    setZoom: (zoom) => set({ zoom }),
    setTransform: (transform) => set({ transform }),
  }),
)
