import { useIsDarkMode } from './useIsDarkMode'
import { getPanelSurface } from '../theme'

export function usePanelSurface() {
  const isDarkMode = useIsDarkMode()
  return getPanelSurface(isDarkMode)
}
