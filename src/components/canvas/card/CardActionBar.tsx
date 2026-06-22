import { useMemo, memo, forwardRef } from 'react'
import { ChevronDown, ArrowUpRight, PanelRight, MoreHorizontal, Globe } from 'lucide-react'
import { useLibraryStore } from '../../../stores/libraryStore'
import { useViewStore } from '../../../stores/viewStore'
import { usePanelStore } from '../../../stores/panelStore'
import { useCardStore, useCard } from '../../../stores/cardStore'
import { useAIStore } from '../../../stores/aiStore'
import { connectionMediator } from '../utils/connectionMediator'
import { type CardColor } from '../../../types/card'
import { MoreActionsMenu } from './MoreActionsMenu'
import { SummaryButton } from './SummaryButton'

function extractTitle(html: string): string {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const heading = doc.querySelector('[data-content-type="heading"] .bn-inline-content, h1, h2, h3')
    return heading?.textContent?.trim() || ''
  } catch {
    return ''
  }
}

interface CardActionBarProps {
  cardId: string
  color: CardColor
  collapsed: boolean
  isHovered: boolean
  selected: boolean
  isConnecting: boolean
  onToggleCollapse: () => void
  onRemoveFromBoard: () => void
  onMoveToBoard: (boardId: string) => void
  onColorChange: (color: CardColor) => void
  cardTitle?: string
  cardPreviewHTML?: string
}

export const CardActionBar = memo(function CardActionBar({
  cardId,
  color,
  collapsed,
  isHovered,
  selected,
  isConnecting,
  onToggleCollapse,
  onRemoveFromBoard,
  onMoveToBoard,
  onColorChange,
  cardTitle,
  cardPreviewHTML,
}: CardActionBarProps) {
  const card = useCard(cardId)
  const isClipCard = !!(card?.sourceUrl)
  const webviewUrl = useLibraryStore(s => s.webviewUrl)
  const setWebviewUrl = useLibraryStore(s => s.setWebviewUrl)
  const updateCard = useCardStore(s => s.updateCard)

  const html = cardPreviewHTML || useCardStore.getState().getPreviewHTML(cardId) || ''
  const extractedTitle = useMemo(() => extractTitle(html), [html])
  const displayTitle = cardTitle || extractedTitle

  const showIcons = isHovered || selected || isConnecting
  const streamingCardId = useAIStore(s => s.streamingCardId)
  const showSummary = showIcons || streamingCardId === cardId

  return (
    <div
      className="card-drag-handle flex items-center justify-between px-2"
      style={{ height: 28, cursor: 'grab', userSelect: 'none', position: 'relative' }}
    >
      {/* AI 按钮：absolute 定位，固定宽度 */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: -24,
          right: -36,
          width: 42,
          zIndex: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          opacity: showSummary ? 1 : 0,
          pointerEvents: showSummary ? 'auto' : 'none',
          transition: 'opacity 0.3s',
        }}
      >
        <SummaryButton color={color} visible={showIcons} cardId={cardId} />
      </div>

      <div style={{ opacity: showIcons ? 1 : 0, transition: 'opacity 0.15s', flexShrink: 0 }}>
        <ActionBarButton
          icon={<ChevronDown
            size={14}
            style={{
              transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
            }}
          />}
          onClick={(e) => {
            e.stopPropagation()
            onToggleCollapse()
          }}
          title="折叠/展开"
        />
      </div>

      {collapsed && displayTitle && (
        <span
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--fg-secondary)',
            textAlign: 'center',
            minWidth: 0,
            margin: '0 4px',
          }}
        >
          {displayTitle}
        </span>
      )}

      {!collapsed && <div style={{ flex: 1 }} />}

      <div className="flex items-center gap-0.5" style={{ opacity: showIcons ? 1 : 0, transition: 'opacity 0.15s', flexShrink: 0 }}>
        <ActionBarButton
          icon={<ArrowUpRight size={14} />}
          onClick={(e) => {
            e.stopPropagation()
            connectionMediator.start(cardId, 'top')
          }}
          onPointerDown={(e) => e.stopPropagation()}
          title="发起连接"
        />
        {isClipCard && (
          <ActionBarButton
            icon={<Globe size={14} />}
            onClick={(e) => {
              e.stopPropagation()
              if (webviewUrl) {
                setWebviewUrl(null)
                updateCard(cardId, { viewMode: 'editor' })
              } else {
                setWebviewUrl(card!.sourceUrl!, cardId)
                updateCard(cardId, { viewMode: 'web' })
              }
            }}
            title="网页预览"
          />
        )}
        <ActionBarButton
          icon={<PanelRight size={14} />}
          onClick={(e) => {
            e.stopPropagation()
            const viewState = useViewStore.getState()
            const panelState = usePanelStore.getState()
            if (viewState.editingCardId === cardId && !panelState.rightPanelCollapsed) {
              panelState.setRightPanelCollapsed(true)
            } else {
              viewState.setEditingCardId(cardId)
              panelState.setRightPanelActiveTab('editor')
              panelState.setRightPanelCollapsed(false)
            }
          }}
          title="侧边编辑"
        />
        <MoreActionsMenu
          color={color}
          onRemoveFromBoard={onRemoveFromBoard}
          onMoveToBoard={onMoveToBoard}
          onColorChange={onColorChange}
        >
          <ActionBarButton
            icon={<MoreHorizontal size={14} />}
            onClick={(e) => e.stopPropagation()}
            title="更多操作"
          />
        </MoreActionsMenu>
      </div>
    </div>
  )
})

interface ActionBarButtonProps {
  icon: React.ReactNode
  onClick?: (e: React.MouseEvent) => void
  onPointerDown?: (e: React.PointerEvent) => void
  title?: string
}

const ActionBarButton = forwardRef<HTMLButtonElement, ActionBarButtonProps & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'onPointerDown'>>(
  function ActionBarButton({ icon, onClick, onPointerDown, title, style, className, ...rest }, ref) {
    return (
      <button
        ref={ref}
        className={`action-icon-btn ${className || ''}`}
        style={{ width: 24, height: 24, cursor: 'pointer', ...style }}
        onClick={onClick}
        onPointerDown={onPointerDown}
        title={title}
        {...rest}
      >
        {icon}
      </button>
    )
  }
)
ActionBarButton.displayName = 'ActionBarButton'
