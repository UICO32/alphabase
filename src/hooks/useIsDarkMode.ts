import { useLibraryStore } from '../stores/libraryStore'

export function useIsDarkMode() {
  return useLibraryStore(s => s.isDarkMode)
}
