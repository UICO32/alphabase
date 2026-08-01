import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import { useContext } from 'react'
import { NodeResizer } from '@xyflow/react'
import type { ResizeParamsWithDirection } from '@xyflow/react'
import { MultiSelectContext } from '../utils/multiSelectContext'
import type { CardColor } from '../../../types/card'
import { getCardFill, getCardStroke } from '../utils/cardStyles'
import { CardActionBar } from './CardActionBar'
import { CardHandles } from './CardHandles'

interface CardNodeChromeProps {
  cardId: string
  color: CardColor
  collapsed: boolean
  collapsedTitle: string
  selected: boolean
  editing: boolean
  hovered: boolean
  hasSummaryBubble: boolean
  connecting: boolean
  connectingSource: boolean
  connectionTarget: boolean
  nearbyTarget: boolean
  lassoSelected: boolean
  darkMode: boolean
  width: number
  height: number
  onMouseEnter: () => void
  onMouseLeave: () => void
  onClick: (event: MouseEvent<HTMLDivElement>) => void
  onResize: (params: ResizeParamsWithDirection) => void
  onToggleCollapse: () => void
  onRemoveFromBoard: () => void
  onMoveToBoard: (boardId: string) => void
  onColorChange: (color: CardColor) => void
  children: ReactNode
}

export function CardNodeChrome({
  cardId,
  color,
  collapsed,
  collapsedTitle,
  selected,
  editing,
  hovered,
  hasSummaryBubble,
  connecting,
  connectingSource,
  connectionTarget,
  nearbyTarget,
  lassoSelected,
  darkMode,
  width,
  height,
  onMouseEnter,
  onMouseLeave,
  onClick,
  onResize,
  onToggleCollapse,
  onRemoveFromBoard,
  onMoveToBoard,
  onColorChange,
  children,
}: CardNodeChromeProps) {
  // 多选状态由画布统一计算（context），避免每张卡各自 filter 节点
  const multiSelected = useContext(MultiSelectContext)
  // 多选时隐藏卡片自身的选中态蓝色边框/阴影（整体缩放框已代表选中范围）
  const showSelected = selected && !multiSelected
  const borderWidth = 1
  const activeBorderColor = showSelected
    ? 'var(--card-selected-border)'
    : editing
      ? 'var(--line-active)'
      : getCardStroke(color)

  const hoverOutline = hovered
    ? `0 0 0 3px ${getCardStroke(color)}33`
    : ''

  const selectedShadow = '0 0 0 1px var(--card-selected-border), 0 0 0 2px var(--brand-ring), 0 4px 16px color-mix(in srgb, var(--brand) 14%, transparent)'
  const editingShadow = '0 0 0 1px var(--line-active), 0 0 0 2px color-mix(in srgb, var(--line-active) 18%, transparent)'
  const activeShadow = showSelected ? selectedShadow : editing ? editingShadow : ''

  const cursor = collapsed ? 'grab'
    : editing ? 'text'
    : (connectionTarget || nearbyTarget) ? 'crosshair'
    : 'default'

  const cardClasses = [
    'card-node-default',
    'relative',
    'rounded-xl',
    (editing || selected || hovered || hasSummaryBubble) ? 'overflow-visible' : 'overflow-hidden',
    connectingSource ? 'card-node-connecting-source' : '',
    nearbyTarget ? 'card-node-nearby-target' : '',
    lassoSelected ? 'card-node-lasso-selected' : '',
  ].filter(Boolean).join(' ')

  const style: CSSProperties = {
    width,
    height,
    backgroundColor: getCardFill(color, darkMode),
    border: `${borderWidth}px solid ${activeBorderColor}`,
    boxShadow: connectingSource
      ? 'var(--shadow-glow-accent)'
      : nearbyTarget
        ? 'var(--shadow-glow-green)'
        : connectionTarget && hovered
          ? 'var(--shadow-glow-green)'
          : hovered && activeShadow
            ? `${activeShadow}, ${hoverOutline}`
            : hovered
              ? `${hoverOutline}, var(--shadow-lg)`
              : activeShadow
                ? activeShadow
                : 'var(--shadow-sm)',
    cursor,
  }

  return (
    <div
      className={cardClasses}
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      onContextMenu={(e) => e.preventDefault()}
    >
      {selected && !multiSelected && !collapsed && (
        <NodeResizer
          minWidth={200}
          minHeight={120}
          keepAspectRatio
          isVisible={selected}
          handleClassName="!w-8 !h-8 !bg-transparent !border-0"
          lineClassName="!bg-transparent !border-0 !w-8"
          onResize={(_, params) => onResize(params)}
        />
      )}

      <CardHandles />

      {(hovered || selected || hasSummaryBubble) && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: -32,
            right: -44,
            width: 56,
            height: 40,
            zIndex: 199,
            pointerEvents: 'auto',
          }}
        />
      )}

      <CardActionBar
        cardId={cardId}
        color={color}
        collapsed={collapsed}
        collapsedTitle={collapsedTitle}
        isHovered={hovered}
        selected={selected}
        isConnecting={connecting}
        onToggleCollapse={onToggleCollapse}
        onRemoveFromBoard={onRemoveFromBoard}
        onMoveToBoard={onMoveToBoard}
        onColorChange={onColorChange}
      />

      {children}
    </div>
  )
}
