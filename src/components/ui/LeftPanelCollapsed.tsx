import { useLibraryStore } from '../../utils/libraryStore'
import { usePanelSurface } from '../../hooks/usePanelSurface'
import { ChevronRight } from 'lucide-react'

export function LeftPanelCollapsed() {
  const setLeftPanelCollapsed = useLibraryStore(s => s.setLeftPanelCollapsed)
  const surface = usePanelSurface()

  return (
    <button
      onClick={() => setLeftPanelCollapsed(false)}
      className="btn-base fixed top-1/2 -translate-y-1/2 left-0 z-50 flex items-center justify-center w-6 h-10 rounded-r-lg hover:shadow-xl"
      style={{
        backgroundColor: surface.panelBg,
        color: surface.text,
        boxShadow: '2px 0 8px rgba(0,0,0,0.15)',
      }}
    >
      <ChevronRight size={14} />
    </button>
  )
}
