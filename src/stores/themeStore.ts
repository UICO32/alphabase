import { create } from 'zustand'
import { setTheme, getTheme, resolveTheme, type ThemeMode } from '../theme'
import type { GridPattern } from '../components/canvas/AdaptiveBackground'

interface ThemeStore {
  isDarkMode: boolean
  themeMode: ThemeMode
  gridPattern: GridPattern

  setThemeMode: (mode: ThemeMode) => void
  setDarkMode: (dark: boolean) => void
  syncDarkMode: (v: boolean) => void
  setGridPattern: (pattern: GridPattern) => void
}

const initialThemeMode: ThemeMode = getTheme()
const initialIsDarkMode = resolveTheme(initialThemeMode) === 'dark'

export const useThemeStore = create<ThemeStore>()(
  (set) => ({
    isDarkMode: initialIsDarkMode,
    themeMode: initialThemeMode,
    gridPattern: 'cross',

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
    setGridPattern: (pattern) => set({ gridPattern: pattern }),
  }),
)

export function startSystemThemeSync(): () => void {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const handleChange = () => {
    const state = useThemeStore.getState()
    if (state.themeMode === 'system') {
      const isDark = mediaQuery.matches
      const resolved = isDark ? 'dark' : 'light'
      document.documentElement.setAttribute('data-theme', resolved)
      useThemeStore.setState({ isDarkMode: isDark })
    }
  }
  mediaQuery.addEventListener('change', handleChange)
  return () => mediaQuery.removeEventListener('change', handleChange)
}
