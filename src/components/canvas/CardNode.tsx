import { memo, useState, useCallback, useRef, useEffect, useSyncExternalStore } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import { useCardStore } from '../../utils/cardStore'
import { getCardVariantStyles } from '../../theme/cardVariantStyles'
import { connectionMediator } from '../../utils/connectionMediator'
import { CardBlockNoteEditor, type BlockNoteEditorHandle } from '../editor/BlockNoteEditor'
import { renderBlocksToHTML } from '../../utils/renderBlocks'
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
  const [isHovered, setIsHovered] = useState(false)
  const editorRef = useRef<BlockNoteEditorHandle>(null)
  const card = useCardStore((s) => s.cards[data.cardId])
  const updateCard = useCardStore((s) => s.updateCard)
  const styles = getCardVariantStyles(data.color, data.variant, false, !!selected)

  const isConnecting = useSyncExternalStore(
    connectionMediator.subscribe.bind(connectionMediator),
    connectionMediator.isConnecting.bind(connectionMediator),
  )
  const isConnectingSource = useSyncExternalStore(
    connectionMediator.subscribe.bind(connectionMediator),
    () => connectionMediator.isConnectingFrom(data.cardId),
  )
  const isConnectionTarget = isConnecting && !isConnectingSource

  const showHandles = selected || isHovered || isConnecting
  const isBackground = !selected && !isHovered && !isConnecting

  const handleMouseEnter = useCallback(() => setIsHovered(true), [])
  const handleMouseLeave = useCallback(() => setIsHovered(false), [])

  const handleConnectionIconClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    connectionMediator.start(data.cardId, 'connection-icon-source')
  }, [data.cardId])

  const handleTargetClick = useCallback((e: React.MouseEvent) => {
    if (isConnectionTarget) {
      e.stopPropagation()
      connectionMediator.complete(data.cardId, '')
    }
  }, [isConnectionTarget, data.cardId])

  const handleDoubleClick = useCallback(() => {
    if (!card) return
    setIsEditing(true)
  }, [card])

  const handleContentChange = useCallback(
    (content: string) => {
      updateCard(data.cardId, {
        content,
        previewHTML: renderBlocksToHTML(content),
      })
    },
    [data.cardId, updateCard],
  )

  const handleEditorBlur = useCallback(() => {
    setIsEditing(false)
  }, [])

  useEffect(() => {
    if (isEditing && editorRef.current) {
      requestAnimationFrame(() => editorRef.current!.focus())
    }
  }, [isEditing])

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

  const handleBaseClass =
    '!w-3 !h-3 !bg-gray-400 !border-2 !border-white transition-all duration-150 hover:!bg-green-500'

  const outlineWidth = selected ? 2 : 1
  const outlineColor = selected
    ? '#3b82f6'
    : isBackground
      ? 'rgba(0,0,0,0.08)'
      : styles.border

  return (
    <div
      className="relative rounded-2xl shadow-sm transition-shadow"
      style={{
        width: (data.width ?? DEFAULT_CARD_WIDTH) as number,
        height: (data.height ?? DEFAULT_CARD_HEIGHT) as number,
        backgroundColor: styles.cardBg,
        outline: `${outlineWidth}px solid ${outlineColor}`,
        outlineOffset: 0,
        boxShadow: isConnectingSource
          ? '0 0 0 3px rgba(59,130,246,0.45), 0 4px 16px rgba(59,130,246,0.2)'
          : isConnectionTarget && isHovered
            ? '0 0 0 2px rgba(34,197,94,0.4), 0 4px 16px rgba(34,197,94,0.15)'
          : isHovered
            ? '0 8px 28px rgba(15,23,42,0.14)'
            : selected
              ? '0 8px 24px rgba(59,130,246,0.15)'
              : '0 2px 8px rgba(0,0,0,0.06)',
        cursor: isConnectionTarget ? 'crosshair' : 'grab',
      }}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* 连接图标 - 卡片外部右上角 */}
      <Handle
        type="source"
        position={Position.Top}
        id="connection-icon-source"
        className="absolute w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold transition-opacity duration-150 cursor-crosshair z-10 hover:bg-blue-600 shadow-sm !border-0"
        style={{
          top: -22,
          right: 0,
          left: 'auto',
          transform: 'translateX(50%)',
          opacity: showHandles ? 1 : 0,
        }}
        onClick={handleConnectionIconClick}
      >
        +
      </Handle>

      {/* 四角吸附点 - target only */}
      <Handle
        type="target"
        position={Position.Top}
        id="top-target"
        className={
          showHandles ? handleBaseClass : '!opacity-0 !pointer-events-none'
        }
        style={{ top: 0, left: '50%', transform: 'translate(-50%, -50%)' }}
        onClick={handleTargetClick}
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom-target"
        className={
          showHandles ? handleBaseClass : '!opacity-0 !pointer-events-none'
        }
        style={{ bottom: 0, left: '50%', transform: 'translate(-50%, 50%)' }}
        onClick={handleTargetClick}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left-target"
        className={
          showHandles ? handleBaseClass : '!opacity-0 !pointer-events-none'
        }
        style={{ left: 0, top: '50%', transform: 'translate(-50%, -50%)' }}
        onClick={handleTargetClick}
      />
      <Handle
        type="target"
        position={Position.Right}
        id="right-target"
        className={
          showHandles ? handleBaseClass : '!opacity-0 !pointer-events-none'
        }
        style={{ right: 0, top: '50%', transform: 'translate(50%, -50%)' }}
        onClick={handleTargetClick}
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
          <div
            className="h-full overflow-y-auto"
            style={{ fontSize: '13px', lineHeight: '1.5' }}
          >
            <CardBlockNoteEditor
              ref={editorRef}
              content={card.content}
              onChange={handleContentChange}
              onBlur={handleEditorBlur}
              theme="light"
              editable={true}
              showSideMenu={false}
              enforceInitialHeading={card.enforceInitialHeading}
            />
          </div>
        ) : (
          <div
            className="h-full overflow-y-auto"
            style={{
              fontSize: '13px',
              lineHeight: '1.5',
              wordBreak: 'break-word',
            }}
            dangerouslySetInnerHTML={{
              __html:
                card.previewHTML ||
                renderBlocksToHTML(card.content) ||
                '<span style="opacity:0.5">双击编辑...</span>',
            }}
          />
        )}
      </div>
    </div>
  )
})

CardNode.displayName = 'CardNode'
