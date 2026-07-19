import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  clampDensityOverviewZoomThreshold,
  DEFAULT_DENSITY_OVERVIEW_ZOOM_THRESHOLD,
} from '../components/canvas/densityOverview/densityOverviewConfig'

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

  previewZoomThreshold: number
  setPreviewZoomThreshold: (threshold: number) => void

  densityOverviewZoomThreshold: number
  setDensityOverviewZoomThreshold: (threshold: number) => void

  transform: [number, number, number]
  setTransform: (transform: [number, number, number]) => void
}

export const useLibraryStore = create<LibraryStore>()(
  persist((set) => ({
    sortBy: 'updatedAt',
    searchMode: 'hybrid',
    webviewUrl: null,
    webviewSourceCardId: null,
    tagFilter: null,
    zoom: 1,
    isZoomPreviewVisible: false,
    previewZoomThreshold: 0.55,
    densityOverviewZoomThreshold: DEFAULT_DENSITY_OVERVIEW_ZOOM_THRESHOLD,
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
    setPreviewZoomThreshold: (threshold) => set({
      previewZoomThreshold: Math.min(0.9, Math.max(0.25, threshold)),
    }),
    setDensityOverviewZoomThreshold: (threshold) => set({
      densityOverviewZoomThreshold: clampDensityOverviewZoomThreshold(threshold),
    }),
    setTransform: (transform) => set({ transform }),
  }), {
    name: 'hepta-library-ui-prefs',
    partialize: (state) => ({
      previewZoomThreshold: state.previewZoomThreshold,
      densityOverviewZoomThreshold: state.densityOverviewZoomThreshold,
    }),
  }),
)
