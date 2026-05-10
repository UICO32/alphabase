import { memo, useState, useCallback } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import { useCardStore } from '../../utils/cardStore'
import { getCardVariantStyles } from '../../theme/cardVariantStyles'
import type { CardColor, CardVariant } from '../../types/card'

export interface CardNodeData extends Record<string, unknown> {
  cardId: string
  color: CardColor
  variant: CardVariant
  collapsed?: boolean
  fixedHeight?: boolean
  width?: number
  height?: number
}

type CardNodeType = Node<CardNodeData, 'card'>

const DEFAULT_CARD_WIDTH = 280
const DEFAULT_CARD_HEIGHT = 200

export const CardNode = memo(({ data, selected }: NodeProps<CardNodeType>) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [isHovered, setIsHovered] = useState(false)
  const card = useCardStore((s) => s.cards[data.cardId])
  const updateCard = useCardStore((s) => s.updateCard)
  const styles = getCardVariantStyles(data.color, data.variant, false, !!selected)

  const handleMouseEnter = useCallback(() => setIsHovered(true), [])
  const handleMouseLeave = useCallback(() => setIsHovered(false), [])
  const showHandles = selected || isHovered

  const handleDoubleClick = useCallback(() => {
    if (!card) return
    setEditTitle(card.title || '')
    setEditContent(card.content || '')
    setIsEditing(true)
  }, [card])

  const handleSave = useCallback(() => {
    if (card) {
      updateCard(data.cardId, {
        title: editTitle,
        content: editContent,
      })
    }
    setIsEditing(false)
  }, [card, data.cardId, editTitle, editContent, updateCard])

  const handleCancel = useCallback(() => {
    setIsEditing(false)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }, [handleSave, handleCancel])

  if (!card) {
    return (
      <div
        className="rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center"
        style={{
          width: (data.width ?? DEFAULT_CARD_WIDTH) as number,
          height: (data.height ?? DEFAULT_CARD_HEIGHT) as number,
        }}
      >
        <span className="text-gray-400 text-sm">Card not found</span>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl overflow-hidden shadow-sm transition-shadow"
      style={{
        width: (data.width ?? DEFAULT_CARD_WIDTH) as number,
        height: (data.height ?? DEFAULT_CARD_HEIGHT) as number,
        backgroundColor: styles.cardBg,
        border: styles.border,
        boxShadow: selected ? `0 0 0 2px #3b82f6` : styles.boxShadow,
      }}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* 顶部连接点 */}
      <Handle
        type="target"
        position={Position.Top}
        id="top-target"
        className={showHandles ? '!w-3 !h-3 !bg-gray-400 !border-2 !border-white' : '!opacity-0 !pointer-events-none'}
      />
      <Handle
        type="source"
        position={Position.Top}
        id="top-source"
        className={showHandles ? '!w-3 !h-3 !bg-gray-400 !border-2 !border-white' : '!opacity-0 !pointer-events-none'}
      />

      {/* 卡片头部 */}
      <div
        className="px-3 py-2 text-sm font-medium truncate"
        style={{ color: styles.textColor }}
      >
        {card.title || 'Untitled'}
      </div>

      {/* 卡片内容 */}
      <div
        className="px-3 pb-3 overflow-hidden"
        style={{
          height: `calc(100% - 36px)`,
          color: styles.textColor,
        }}
      >
        {isEditing ? (
          <div className="flex flex-col gap-2 h-full">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="标题"
              className="w-full px-2 py-1 text-sm rounded border border-gray-300 focus:outline-none focus:border-blue-500"
              style={{ backgroundColor: styles.cardBg, color: styles.textColor }}
              autoFocus
            />
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="内容..."
              className="flex-1 w-full px-2 py-1 text-sm rounded border border-gray-300 focus:outline-none focus:border-blue-500 resize-none"
              style={{ backgroundColor: styles.cardBg, color: styles.textColor }}
              onKeyDown={handleKeyDown}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleCancel}
                className="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-100"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                className="px-2 py-1 text-xs rounded bg-blue-500 text-white hover:bg-blue-600"
              >
                保存
              </button>
            </div>
          </div>
        ) : (
          <div className="text-sm whitespace-pre-wrap break-words">
            {card.content || <span className="opacity-50">双击编辑...</span>}
          </div>
        )}
      </div>

      {/* 底部连接点 */}
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom-target"
        className={showHandles ? '!w-3 !h-3 !bg-gray-400 !border-2 !border-white' : '!opacity-0 !pointer-events-none'}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-source"
        className={showHandles ? '!w-3 !h-3 !bg-gray-400 !border-2 !border-white' : '!opacity-0 !pointer-events-none'}
      />

      {/* 左侧连接点 */}
      <Handle
        type="target"
        position={Position.Left}
        id="left-target"
        className={showHandles ? '!w-3 !h-3 !bg-gray-400 !border-2 !border-white' : '!opacity-0 !pointer-events-none'}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left-source"
        className={showHandles ? '!w-3 !h-3 !bg-gray-400 !border-2 !border-white' : '!opacity-0 !pointer-events-none'}
      />

      {/* 右侧连接点 */}
      <Handle
        type="target"
        position={Position.Right}
        id="right-target"
        className={showHandles ? '!w-3 !h-3 !bg-gray-400 !border-2 !border-white' : '!opacity-0 !pointer-events-none'}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right-source"
        className={showHandles ? '!w-3 !h-3 !bg-gray-400 !border-2 !border-white' : '!opacity-0 !pointer-events-none'}
      />
    </div>
  )
})

CardNode.displayName = 'CardNode'
