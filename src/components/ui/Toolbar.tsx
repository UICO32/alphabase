import { useLibraryStore } from '../../utils/libraryStore'
import { getPanelSurface } from '../../theme'
import { Plus, ZoomIn, ZoomOut, Maximize } from 'lucide-react'

interface ToolbarProps {
  onAddCard?: () => void
}

export function Toolbar({ onAddCard }: ToolbarProps) {
  const isDarkMode = useLibraryStore(s => s.isDarkMode)
  const zoom = useLibraryStore(s => s.zoom)
  const surface = getPanelSurface(isDarkMode)

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-2 rounded-xl z-40 animate-fadeInUp"
      style={{
        backgroundColor: surface.panelBg,
        border: `1px solid ${surface.divider}`,
        boxShadow: surface.shadow,
      }}
    >
      <button
        onClick={onAddCard}
        className="btn-base btn-primary flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
      >
        <Plus size={14} />
        <span>卡片</span>
      </button>

      <div
        className="w-px h-6 mx-1"
        style={{ backgroundColor: surface.divider }}
      />

      <button
        onClick={() => window.dispatchEvent(new CustomEvent('hepta-zoom-out'))}
        className="btn-base p-2 rounded-lg"
        style={{ color: surface.text }}
        title="缩小"
      >
        <ZoomOut size={16} />
      </button>
      <span
        className="text-sm px-2 cursor-default"
        style={{ color: surface.muted }}
      >
        {Math.round(zoom * 100)}%
      </span>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('hepta-zoom-in'))}
        className="btn-base p-2 rounded-lg"
        style={{ color: surface.text }}
        title="放大"
      >
        <ZoomIn size={16} />
      </button>

      <div
        className="w-px h-6 mx-1"
        style={{ backgroundColor: surface.divider }}
      />

      <button
        onClick={() => window.dispatchEvent(new CustomEvent('hepta-fit-view'))}
        className="btn-base p-2 rounded-lg"
        style={{ color: surface.text }}
        title="适应视图"
      >
        <Maximize size={16} />
      </button>
    </div>
  )
}
