import { useLibraryStore } from '../../utils/libraryStore'
import { getPanelSurface } from '../../theme/panelSurface'
import { Plus, ZoomIn, ZoomOut, Maximize } from 'lucide-react'

interface ToolbarProps {
  onAddCard?: () => void
}

export function Toolbar({ onAddCard }: ToolbarProps) {
  const isDarkMode = useLibraryStore(s => s.isDarkMode)
  const surface = getPanelSurface(isDarkMode)

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-2 rounded-xl shadow-lg z-40"
      style={{
        backgroundColor: surface.panelBg,
        border: `1px solid ${surface.divider}`,
      }}
    >
      <button
        onClick={onAddCard}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors hover:opacity-90"
        style={{
          backgroundColor: '#3b82f6',
          color: '#ffffff',
        }}
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
        className="p-2 rounded-lg transition-colors hover:opacity-70"
        style={{ color: surface.text }}
        title="缩小"
      >
        <ZoomOut size={16} />
      </button>
      <span
        className="text-sm px-2 cursor-default"
        style={{ color: surface.muted }}
      >
        100%
      </span>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('hepta-zoom-in'))}
        className="p-2 rounded-lg transition-colors hover:opacity-70"
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
        className="p-2 rounded-lg transition-colors hover:opacity-70"
        style={{ color: surface.text }}
        title="适应视图"
      >
        <Maximize size={16} />
      </button>
    </div>
  )
}
