import { useLibraryStore } from '../../utils/libraryStore'
import { getPanelSurface } from '../../theme/panelSurface'
import { ChevronLeft } from 'lucide-react'

export function RightPanelCollapsed() {
  const isDarkMode = useLibraryStore(s => s.isDarkMode)
  const setRightPanelCollapsed = useLibraryStore(s => s.setRightPanelCollapsed)
  const viewMode = useLibraryStore(s => s.viewMode)

  const surface = getPanelSurface(isDarkMode)

  // 只有在 board 模式下才显示折叠按钮
  if (viewMode !== 'board') {
    return null
  }

  return (
    <button
      onClick={() => setRightPanelCollapsed(false)}
      className="fixed top-1/2 -translate-y-1/2 right-0 z-50 flex items-center justify-center w-6 h-12 rounded-l-lg shadow-lg transition-colors hover:opacity-90"
      style={{
        backgroundColor: surface.panelBg,
        color: surface.text,
        border: `1px solid ${surface.divider}`,
        borderRight: 'none',
      }}
    >
      <ChevronLeft size={14} />
    </button>
  )
}
