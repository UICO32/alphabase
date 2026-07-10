import { useLibraryStore } from '../../stores/libraryStore'
import { usePanelStore } from '../../stores/panelStore'
import { useFrameInteraction, enterLassoMode, enterTextToolMode } from '../canvas/utils/frameInteraction'
import { emit } from '../../stores/eventBus'
import { Plus, ZoomIn, ZoomOut, Maximize, Scissors, Frame, Axis3d, GalleryVerticalEnd, Compass, Type } from 'lucide-react'
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
  const isTextToolMode = useFrameInteraction(s => s.textToolMode)

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
                className="action-icon-btn"
                style={{
                  width: 34,
                  height: 34,
                  padding: 0,
                  borderRadius: 999,
                  backgroundColor: '#000',
                  color: '#fff',
                  flexShrink: 0,
                }}
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
                className="action-icon-btn p-2 rounded-full"
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
		                className="action-icon-btn p-2 rounded-full"
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
                className={`action-icon-btn p-2 rounded-full ${isLassoMode ? 'bg-surface-card-active text-accent-blue' : ''}`}
              >
                <Frame size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">框选创建 Frame</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={enterTextToolMode}
                className={`action-icon-btn p-2 rounded-full ${isTextToolMode ? 'bg-surface-card-active text-accent-blue' : ''}`}
              >
                <Type size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">文本注释（点击画布放置）</TooltipContent>
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
        <div className="fixed bottom-6 right-6 flex items-center gap-0.5 px-2 py-1.5 rounded-full z-40 glass-card border border-line-default">
	          <Tooltip>
	            <TooltipTrigger asChild>
	              <button
	                onClick={() => emit('zoom-out', undefined)}
	                className="action-icon-btn p-1.5 rounded-full"
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
	                className="action-icon-btn p-1.5 rounded-full"
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
	                className="action-icon-btn p-1.5 rounded-full"
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
