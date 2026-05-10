import { memo, useState, useEffect, useCallback } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import { useCardStore } from '../../utils/cardStore'
import { getCardVariantStyles } from '../../theme/cardVariantStyles'
import { CardBlockNoteEditor } from '../editor/BlockNoteEditor'
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
  const card = useCardStore((s) => s.cards[data.cardId])
  const updateCard = useCardStore((s) => s.updateCard)
  const styles = getCardVariantStyles(data.color, data.variant, false, !!selected)

  useEffect(() => {
    if (selected) {
      setIsEditing(true)
    }
  }, [selected])

  const handleContentChange = useCallback(
    (content: string) => {
      updateCard(data.cardId, { content })
    },
    [data.cardId, updateCard]
  )

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
    >
      {/* 顶部连接点 */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Top}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
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
          <CardBlockNoteEditor
            content={card.content}
            onChange={handleContentChange}
            onBlur={() => setIsEditing(false)}
          />
        ) : (
          <div dangerouslySetInnerHTML={{ __html: '' }} />
        )}
      </div>

      {/* 底部连接点 */}
      <Handle
        type="target"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
      />
    </div>
  )
})

CardNode.displayName = 'CardNode'
