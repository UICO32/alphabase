import { useLibraryStore } from '../../stores/libraryStore'
import { usePanelSurface } from '../../hooks/usePanelSurface'
import { useFrameInteraction, enterLassoMode } from '../../utils/frameInteraction'
import { appEvents } from '../../utils/appEvents'
import { Plus, ZoomIn, ZoomOut, Maximize, Scissors, LayoutGrid } from 'lucide-react'

interface ToolbarProps {
  onAddCard?: () => void
  onClipUrl?: () => void
}

export function Toolbar({ onAddCard, onClipUrl }: ToolbarProps) {
  const zoom = useLibraryStore(s => s.zoom)
  const surface = usePanelSurface()
  const isLassoMode = useFrameInteraction(s => s.lassoMode)

  return (
    <>
      {/* 主工具栏 - 底部居中 */}
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
          className="btn-base btn-primary p-2 rounded-lg"
          title="添加卡片"
        >
          <Plus size={16} />
        </button>

        <button
          onClick={onClipUrl}
          className="btn-base p-2 rounded-lg"
          style={{ color: surface.text }}
          title="剪藏网页"
        >
          <Scissors size={16} />
        </button>

        <div
          className="w-px h-5 mx-0.5"
          style={{ backgroundColor: surface.divider }}
        />

        <button
          onClick={enterLassoMode}
          className={`btn-base p-2 rounded-lg transition-colors ${isLassoMode ? 'bg-indigo-100 text-indigo-600' : ''}`}
          style={{ color: isLassoMode ? undefined : surface.text }}
          title="框选创建 Frame"
        >
          <LayoutGrid size={16} />
        </button>
      </div>

      {/* 缩放控件 - 右下角 */}
      <div
        className="fixed bottom-6 right-6 flex items-center gap-0.5 px-1.5 py-1.5 rounded-lg z-40 animate-fadeInUp"
        style={{
          backgroundColor: surface.surface,
          boxShadow: 'var(--shadow-md)',
          border: `1px solid ${surface.divider}`,
        }}
      >
        <button
          onClick={() => appEvents.emit('hepta-zoom-out')}
          className="btn-base p-1.5 rounded-md"
          style={{ color: surface.text }}
          title="缩小"
        >
          <ZoomOut size={14} />
        </button>
        <span
          className="text-xs px-1.5 cursor-default tabular-nums"
          style={{ color: surface.muted }}
        >
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => appEvents.emit('hepta-zoom-in')}
          className="btn-base p-1.5 rounded-md"
          style={{ color: surface.text }}
          title="放大"
        >
          <ZoomIn size={14} />
        </button>
        <div
          className="w-px h-4 mx-0.5"
          style={{ backgroundColor: surface.divider }}
        />
        <button
          onClick={() => appEvents.emit('hepta-fit-view')}
          className="btn-base p-1.5 rounded-md"
          style={{ color: surface.text }}
          title="适应视图"
        >
          <Maximize size={14} />
        </button>
      </div>
    </>
  )
}