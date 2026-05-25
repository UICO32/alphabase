import { useLibraryStore } from '../../stores/libraryStore'
import { usePanelSurface } from '../../hooks/usePanelSurface'
import { ChevronLeft } from 'lucide-react'

export function RightPanelCollapsed() {
  const setRightPanelCollapsed = useLibraryStore(s => s.setRightPanelCollapsed)
  const viewMode = useLibraryStore(s => s.viewMode)

  const surface = usePanelSurface()

  if (viewMode !== 'board') {
    return null
  }

  return (
    <button
      onClick={() => setRightPanelCollapsed(false)}
      className="btn-base fixed top-1/2 -translate-y-1/2 right-0 z-50 flex items-center justify-center w-6 h-12 rounded-l-lg glass-panel"
      style={{
        color: surface.text,
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <ChevronLeft size={14} />
    </button>
  )
}
