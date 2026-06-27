import { useLibraryStore } from '../../stores/libraryStore'
import { usePanelStore } from '../../stores/panelStore'
import { useFrameInteraction, enterLassoMode } from '../canvas/utils/frameInteraction'
import { emit } from '../../stores/eventBus'
import { Plus, ZoomIn, ZoomOut, Maximize, Scissors, Frame, Axis3d, GalleryVerticalEnd, Compass } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/shadcn/tooltip'

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
    <TooltipProvider delayDuration={300}>
      {/* 主工具栏 - 底部居中 */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-2.5 py-1.5 rounded-full z-40 glass-card border border-line-default">
        {/* 左组：创建工具 */}
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onAddCard}
                className="btn-base btn-primary p-2 rounded-full"
              >
                <Plus size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">添加卡片</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onClipUrl}
                className="btn-base p-2 rounded-full text-fg-primary"
              >
                <Scissors size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">剪藏网页</TooltipContent>
          </Tooltip>

		          <Tooltip>
		            <TooltipTrigger asChild>
		              <button
		                onClick={() => {
		                  usePanelStore.getState().setRightPanelActiveTab('channels')
		                  usePanelStore.getState().setRightPanelCollapsed(false)
		                }}
		                className="btn-base p-2 rounded-full text-fg-primary"
	              >
	                <Compass size={16} />
	              </button>
	            </TooltipTrigger>
	            <TooltipContent side="top">频道浏览</TooltipContent>
	          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={enterLassoMode}
                className={`btn-base p-2 rounded-full transition-colors text-fg-primary ${isLassoMode ? 'bg-surface-panel-hover text-accent-blue' : ''}`}
              >
                <Frame size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">框选创建 Frame</TooltipContent>
          </Tooltip>
        </div>

        {/* 分隔线 */}
        <div className="w-px h-6 mx-1.5 bg-border-default" />

        {/* 右组：3D 地形滑动开关 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onToggleTopography}
              className="toolbar-toggle"
            >
              <span className="toolbar-toggle-track">
                <span className={`toolbar-toggle-thumb ${showTopography ? 'toolbar-toggle-thumb-end' : ''}`}>
                  <GalleryVerticalEnd size={10} className={`toolbar-toggle-icon ${!showTopography ? 'toolbar-toggle-icon-active' : ''}`} />
                  <Axis3d size={10} className={`toolbar-toggle-icon ${showTopography ? 'toolbar-toggle-icon-active' : ''}`} />
                </span>
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{showTopography ? '返回画布' : '3D 地形视图'}</TooltipContent>
        </Tooltip>
      </div>

      {/* 缩放控件 - 右下角，3D模式下隐藏 */}
      {!showTopography && (
        <div className="fixed bottom-6 right-6 flex items-center gap-0.5 px-2 py-1.5 rounded-full z-40 bg-surface-card shadow-md border border-line-default">
	          <Tooltip>
	            <TooltipTrigger asChild>
	              <button
	                onClick={() => emit('zoom-out', undefined)}
	                className="btn-base p-1.5 rounded-full text-fg-primary"
	              >
	                <ZoomOut size={14} />
	              </button>
	            </TooltipTrigger>
	            <TooltipContent side="top">缩小</TooltipContent>
	          </Tooltip>
	          <span className="text-xs px-1.5 cursor-default tabular-nums text-fg-secondary">
	            {Math.round(zoom * 100)}%
	          </span>
	          <Tooltip>
	            <TooltipTrigger asChild>
	              <button
	                onClick={() => emit('zoom-in', undefined)}
	                className="btn-base p-1.5 rounded-full text-fg-primary"
	              >
	                <ZoomIn size={14} />
	              </button>
	            </TooltipTrigger>
	            <TooltipContent side="top">放大</TooltipContent>
	          </Tooltip>
	          <div className="w-px h-4 mx-0.5 bg-border-default" />
	          <Tooltip>
	            <TooltipTrigger asChild>
	              <button
	                onClick={() => emit('fit-view', undefined)}
	                className="btn-base p-1.5 rounded-full text-fg-primary"
	              >
	                <Maximize size={14} />
	              </button>
	            </TooltipTrigger>
	            <TooltipContent side="top">适应视图</TooltipContent>
	          </Tooltip>
        </div>
      )}
    </TooltipProvider>
  )
}
