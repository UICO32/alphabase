import { useLibraryStore } from '../../utils/libraryStore'
import { getPanelSurface } from '../../theme'
import { ChevronLeft } from 'lucide-react'

export function RightPanelCollapsed() {
  const isDarkMode = useLibraryStore(s => s.isDarkMode)
  const setRightPanelCollapsed = useLibraryStore(s => s.setRightPanelCollapsed)
  const viewMode = useLibraryStore(s => s.viewMode)

  const surface = getPanelSurface(isDarkMode)

  if (viewMode !== 'board') {
    return null
  }

  return (
    <button
      onClick={() => setRightPanelCollapsed(false)}
      className="btn-base fixed top-1/2 -translate-y-1/2 right-0 z-50 flex items-center justify-center w-6 h-12 rounded-l-lg"
      style={{
        backgroundColor: surface.panelBg,
        color: surface.text,
        border: `1px solid ${surface.divider}`,
        borderRight: 'none',
        boxShadow: surface.shadow,
      }}
    >
      <ChevronLeft size={14} />
    </button>
  )
}
