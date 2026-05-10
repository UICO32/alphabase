import { create } from 'zustand'

export type ViewMode = 'board' | 'cards' | 'boardLibrary'

interface LibraryStore {
  viewMode: ViewMode
  isLeftPanelOpen: boolean
  isDarkMode: boolean
  setViewMode: (mode: ViewMode) => void
  setLeftPanelOpen: (open: boolean) => void
  toggleLeftPanel: () => void
  setDarkMode: (dark: boolean) => void
}

export const useLibraryStore = create<LibraryStore>()((set) => ({
  viewMode: 'board',
  isLeftPanelOpen: true,
  isDarkMode: false,
  setViewMode: (mode) => set({ viewMode: mode }),
  setLeftPanelOpen: (open) => set({ isLeftPanelOpen: open }),
  toggleLeftPanel: () => set((state) => ({ isLeftPanelOpen: !state.isLeftPanelOpen })),
  setDarkMode: (dark) => set({ isDarkMode: dark }),
}))
