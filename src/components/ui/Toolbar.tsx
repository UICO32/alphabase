import { useLibraryStore } from '../../stores/libraryStore'
import { usePanelSurface } from '../../hooks/usePanelSurface'
import { appEvents } from '../../utils/appEvents'
import { Plus, ZoomIn, ZoomOut, Maximize, Scissors } from 'lucide-react'

interface ToolbarProps {
  onAddCard?: () => void
  onClipUrl?: () => void
}

export function Toolbar({ onAddCard, onClipUrl }: ToolbarProps) {
  const zoom = useLibraryStore(s => s.zoom)
  const surface = usePanelSurface()

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-2 rounded-xl z-40 animate-fadeInUp"
      style={{
        backgroundColor: surface.surface,
        boxShadow: 'var(--shadow-lg)',
        border: `1px solid ${surface.divider}`,
      }}
    >
      <button
        onClick={onAddCard}
        className="btn-base btn-primary flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
      >
        <Plus size={14} />
        <span className="toolbar-label">卡片</span>
      </button>

      <button
        onClick={onClipUrl}
        className="btn-base flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
        style={{ color: surface.text }}
        title="剪藏网页"
      >
        <Scissors size={14} />
        <span className="toolbar-label">剪藏</span>
      </button>

      <div
        className="w-px h-6 mx-1"
        style={{ backgroundColor: surface.divider }}
      />

      <button
        onClick={() => appEvents.emit('hepta-zoom-out')}
        className="btn-base p-2 rounded-lg"
        style={{ color: surface.text }}
        title="缩小"
      >
        <ZoomOut size={16} />
      </button>
      <span
        className="text-sm px-2 cursor-default toolbar-label"
        style={{ color: surface.muted }}
      >
        {Math.round(zoom * 100)}%
      </span>
      <button
        onClick={() => appEvents.emit('hepta-zoom-in')}
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
        onClick={() => appEvents.emit('hepta-fit-view')}
        className="btn-base p-2 rounded-lg"
        style={{ color: surface.text }}
        title="适应视图"
      >
        <Maximize size={16} />
      </button>
    </div>
  )
}