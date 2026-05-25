import { useLibraryStore } from '../../stores/libraryStore'
import { usePanelSurface } from '../../hooks/usePanelSurface'
import { ChevronRight } from 'lucide-react'

export function LeftPanelCollapsed() {
  const setLeftPanelCollapsed = useLibraryStore(s => s.setLeftPanelCollapsed)
  const surface = usePanelSurface()

  return (
    <button
      onClick={() => setLeftPanelCollapsed(false)}
      className="btn-base fixed top-1/2 -translate-y-1/2 left-0 z-50 flex items-center justify-center w-6 h-10 rounded-r-lg hover:shadow-xl glass-panel"
      style={{
        color: surface.text,
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <ChevronRight size={14} />
    </button>
  )
}
