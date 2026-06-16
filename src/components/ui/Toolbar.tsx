import { useLibraryStore } from '../../stores/libraryStore'
import { useFrameInteraction, enterLassoMode } from '../../utils/frameInteraction'
import { appEvents } from '../../utils/appEvents'
import { Plus, ZoomIn, ZoomOut, Maximize, Scissors, Frame, Goal, GalleryVerticalEnd, Compass } from 'lucide-react'

interface ToolbarProps {
  onAddCard?: () => void
  onClipUrl?: () => void
  showTopography?: boolean
  onToggleTopography?: () => void
}

export function Toolbar({ onAddCard, onClipUrl, showTopography, onToggleTopography }: ToolbarProps) {
  const zoom = useLibraryStore(s => s.zoom)
  const isLassoMode = useFrameInteraction(s => s.lassoMode)

  return (
    <>
      {/* 主工具栏 - 底部居中 */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-1.5 py-1.5 rounded-2xl z-40 glass-card border border-border-default">
        {/* 左组：创建工具 */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={onAddCard}
            className="btn-base btn-primary p-2 rounded-xl"
            title="添加卡片"
          >
            <Plus size={16} />
          </button>

          <button
            onClick={onClipUrl}
            className="btn-base p-2 rounded-xl text-text-primary"
            title="剪藏网页"
          >
            <Scissors size={16} />
          </button>

          <button
            onClick={() => {
              const s = useLibraryStore.getState()
              s.setRightPanelActiveTab('channels')
              s.setRightPanelCollapsed(false)
            }}
            className="btn-base p-2 rounded-xl text-text-primary"
            title="频道浏览"
          >
            <Compass size={16} />
          </button>

          <button
            onClick={enterLassoMode}
            className={`btn-base p-2 rounded-xl transition-colors text-text-primary ${isLassoMode ? 'bg-surface-panel-hover text-accent-blue' : ''}`}
            title="框选创建 Frame"
          >
            <Frame size={16} />
          </button>
        </div>

        {/* 分隔线 */}
        <div className="w-px h-6 mx-1.5 bg-border-default" />

        {/* 右组：3D 地形滑动开关 */}
        <button
          onClick={onToggleTopography}
          className="toolbar-toggle"
          title={showTopography ? '返回画布' : '3D 地形视图'}
        >
          <span className="toolbar-toggle-track">
            <span className={`toolbar-toggle-thumb ${showTopography ? 'toolbar-toggle-thumb-end' : ''}`}>
              <GalleryVerticalEnd size={10} className={`toolbar-toggle-icon ${!showTopography ? 'toolbar-toggle-icon-active' : ''}`} />
              <Goal size={10} className={`toolbar-toggle-icon ${showTopography ? 'toolbar-toggle-icon-active' : ''}`} />
            </span>
          </span>
        </button>
      </div>

      {/* 缩放控件 - 右下角，3D模式下隐藏 */}
      {!showTopography && (
        <div className="fixed bottom-6 right-6 flex items-center gap-0.5 px-1.5 py-1.5 rounded-lg z-40 bg-surface-card shadow-md border border-border-default">
          <button
            onClick={() => appEvents.emit('hepta-zoom-out')}
            className="btn-base p-1.5 rounded-md text-text-primary"
            title="缩小"
          >
            <ZoomOut size={14} />
          </button>
          <span className="text-xs px-1.5 cursor-default tabular-nums text-text-secondary">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => appEvents.emit('hepta-zoom-in')}
            className="btn-base p-1.5 rounded-md text-text-primary"
            title="放大"
          >
            <ZoomIn size={14} />
          </button>
          <div className="w-px h-4 mx-0.5 bg-border-default" />
          <button
            onClick={() => appEvents.emit('hepta-fit-view')}
            className="btn-base p-1.5 rounded-md text-text-primary"
            title="适应视图"
          >
            <Maximize size={14} />
          </button>
        </div>
      )}
    </>
  )
}