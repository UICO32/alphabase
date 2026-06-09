import { create } from 'zustand'
import { setTheme, getTheme, resolveTheme, type ThemeMode } from '../theme'
import type { GridPattern } from '../components/canvas/AdaptiveBackground'
export type ViewMode = 'board' | 'cards' | 'boardLibrary'
export type SortBy = 'updatedAt' | 'createdAt' | 'title' | 'related'
export type SearchMode = 'hybrid' | 'keyword' | 'semantic'

interface LibraryStore {
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void

  editingCardId: string | null
  setEditingCardId: (cardId: string | null) => void
  openCardEditor: (cardId: string) => void
  closeCardEditor: () => void

  kanbanEditDialogCardId: string | null
  kanbanEditDialogSourceRect: DOMRect | null
  openKanbanEditDialog: (cardId: string, sourceRect: DOMRect | null) => void
  closeKanbanEditDialog: () => void

  isDarkMode: boolean
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => void
  setDarkMode: (dark: boolean) => void
  syncDarkMode: (v: boolean) => void

  leftPanelCollapsed: boolean
  setLeftPanelCollapsed: (collapsed: boolean) => void

  rightPanelCollapsed: boolean
  setRightPanelCollapsed: (collapsed: boolean) => void
  rightPanelWidth: number
  setRightPanelWidth: (width: number) => void
  rightPanelActiveTab: 'library' | 'editor'
  setRightPanelActiveTab: (tab: 'library' | 'editor') => void

  userSwitchedTab: boolean
  markUserSwitchedTab: () => void
  resetUserSwitchedTab: () => void

  toggleAllSidebars: () => void

  zoom: number
  setZoom: (zoom: number) => void

  transform: [number, number, number]
  setTransform: (transform: [number, number, number]) => void

  sortBy: SortBy
  setSortBy: (sortBy: SortBy) => void

  searchMode: SearchMode
  setSearchMode: (mode: SearchMode) => void

  webviewUrl: string | null
  webviewSourceCardId: string | null
  setWebviewUrl: (url: string | null, cardId?: string | null) => void

  gridPattern: GridPattern
  setGridPattern: (pattern: GridPattern) => void
}

const SIDEBAR_WIDTH_MIN = 260
const SIDEBAR_WIDTH_MAX = 600
const SIDEBAR_WIDTH_DEFAULT = 360

const initialThemeMode: ThemeMode = (() => {
  return getTheme()
})()

const initialIsDarkMode = resolveTheme(initialThemeMode) === 'dark'

export const useLibraryStore = create<LibraryStore>()(
  (set, get) => ({
      viewMode: 'board',
      editingCardId: null,
      kanbanEditDialogCardId: null,
      kanbanEditDialogSourceRect: null,
      themeMode: initialThemeMode,
      isDarkMode: initialIsDarkMode,
      leftPanelCollapsed: false,
      rightPanelCollapsed: false,
      rightPanelWidth: SIDEBAR_WIDTH_DEFAULT,
      rightPanelActiveTab: 'library',
      userSwitchedTab: false,
      zoom: 1,
      transform: [0, 0, 1],
      sortBy: 'updatedAt',
      searchMode: 'hybrid',
      webviewUrl: null,
      webviewSourceCardId: null,
      gridPattern: 'cross',

      setViewMode: (mode) => set({ viewMode: mode }),
      setZoom: (zoom) => set({ zoom }),
      setTransform: (transform) => set({ transform }),
      setSortBy: (sortBy) => set({ sortBy }),
      setSearchMode: (mode) => set({ searchMode: mode }),
      setWebviewUrl: (url, cardId) => set({
        webviewUrl: url,
        webviewSourceCardId: cardId ?? null,
        ...(url ? { rightPanelActiveTab: 'editor', rightPanelCollapsed: false } : {}),
      }),
      setGridPattern: (pattern) => set({ gridPattern: pattern }),
      openCardEditor: (cardId) => set({ editingCardId: cardId }),
      closeCardEditor: () => set({ editingCardId: null }),

      openKanbanEditDialog: (cardId, sourceRect) =>
        set({ kanbanEditDialogCardId: cardId, kanbanEditDialogSourceRect: sourceRect }),
      closeKanbanEditDialog: () =>
        set({ kanbanEditDialogCardId: null, kanbanEditDialogSourceRect: null }),
      setEditingCardId: (cardId) => set({ editingCardId: cardId }),

      setThemeMode: (mode) => {
        setTheme(mode)
        const isDark = resolveTheme(mode) === 'dark'
        set({ themeMode: mode, isDarkMode: isDark })
      },
      setDarkMode: (dark) => {
        const mode: ThemeMode = dark ? 'dark' : 'light'
        setTheme(mode)
        set({ themeMode: mode, isDarkMode: dark })
      },
      syncDarkMode: (v) => {
        const mode: ThemeMode = v ? 'dark' : 'light'
        setTheme(mode)
        set({ themeMode: mode, isDarkMode: v })
      },

      setLeftPanelCollapsed: (collapsed) => set({ leftPanelCollapsed: collapsed }),

      setRightPanelCollapsed: (collapsed) => set({ rightPanelCollapsed: collapsed }),
      setRightPanelWidth: (width) => {
        const clamped = Math.max(SIDEBAR_WIDTH_MIN, Math.min(SIDEBAR_WIDTH_MAX, width))
        set({ rightPanelWidth: clamped })
      },
      setRightPanelActiveTab: (tab) => set({ rightPanelActiveTab: tab }),

      markUserSwitchedTab: () => set({ userSwitchedTab: true }),
      resetUserSwitchedTab: () => set({ userSwitchedTab: false }),

      toggleAllSidebars: () => {
        const { leftPanelCollapsed } = get()
        const newState = !leftPanelCollapsed
        set({
          leftPanelCollapsed: newState,
          rightPanelCollapsed: newState,
        })
      },
  }),
)

export { SIDEBAR_WIDTH_MIN, SIDEBAR_WIDTH_MAX, SIDEBAR_WIDTH_DEFAULT }

export function startSystemThemeSync(): () => void {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const handleChange = () => {
    const state = useLibraryStore.getState()
    if (state.themeMode === 'system') {
      const isDark = mediaQuery.matches
      const resolved = isDark ? 'dark' : 'light'
      document.documentElement.setAttribute('data-theme', resolved)
      useLibraryStore.setState({ isDarkMode: isDark })
    }
  }
  mediaQuery.addEventListener('change', handleChange)
  return () => mediaQuery.removeEventListener('change', handleChange)
}
