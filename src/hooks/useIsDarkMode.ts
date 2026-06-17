import { useThemeStore } from '../stores/themeStore'

export function useIsDarkMode() {
  return useThemeStore(s => s.isDarkMode)
}
