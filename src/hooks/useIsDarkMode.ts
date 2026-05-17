import { useLibraryStore } from '../utils/libraryStore'

export function useIsDarkMode() {
  return useLibraryStore(s => s.isDarkMode)
}
