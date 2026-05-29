import { useState, useRef, useEffect, useMemo, memo } from 'react'
import { ChevronDown, ArrowUpRight, PanelRight, MoreHorizontal } from 'lucide-react'
import { useLibraryStore } from '../../../stores/libraryStore'
import { connectionMediator } from '../../../utils/connectionMediator'
import { renderBlocksToHTML } from '../../../converters/renderBlocks'
import { type CardColor } from '../../../types/card'
import { MoreActionsMenu } from './MoreActionsMenu'

function extractTitle(html: string): string {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const heading = doc.querySelector('h1, h2, h3')
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
  cardContent?: string
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
  cardContent,
  cardPreviewHTML,
}: CardActionBarProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  const html = cardPreviewHTML || renderBlocksToHTML(cardContent || '')
  const displayTitle = cardTitle || useMemo(() => extractTitle(html), [html])

  useEffect(() => {
    if (!moreOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [moreOpen])

  const showIcons = isHovered || selected || isConnecting

  return (
    <div
      className="card-drag-handle flex items-center justify-between px-2"
      style={{ height: 28, cursor: 'grab', userSelect: 'none', position: 'relative' }}
    >
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
            color: 'var(--text-secondary)',
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
        />
        <ActionBarButton
          icon={<PanelRight size={14} />}
          onClick={(e) => {
            e.stopPropagation()
            const store = useLibraryStore.getState()
            if (store.editingCardId === cardId && !store.rightPanelCollapsed) {
              store.setRightPanelCollapsed(true)
            } else {
              store.setEditingCardId(cardId)
              store.setRightPanelActiveTab('editor')
              store.setRightPanelCollapsed(false)
            }
          }}
        />
        <div ref={moreRef} style={{ position: 'relative' }}>
          <ActionBarButton
            icon={<MoreHorizontal size={14} />}
            onClick={(e) => {
              e.stopPropagation()
              setMoreOpen(!moreOpen)
            }}
          />
          {moreOpen && (
            <MoreActionsMenu
              color={color}
              onClose={() => setMoreOpen(false)}
              onRemoveFromBoard={onRemoveFromBoard}
              onMoveToBoard={onMoveToBoard}
              onColorChange={onColorChange}
              triggerRef={moreRef}
            />
          )}
        </div>
      </div>
    </div>
  )
})

function ActionBarButton({
  icon,
  onClick,
  onPointerDown,
}: {
  icon: React.ReactNode
  onClick: (e: React.MouseEvent) => void
  onPointerDown?: (e: React.PointerEvent) => void
}) {
  return (
    <button
      className="flex items-center justify-center rounded-md"
      style={{
        width: 24,
        height: 24,
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        border: 'none',
        background: 'transparent',
      }}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLElement).style.background = 'transparent'
      }}
    >
      {icon}
    </button>
  )
}