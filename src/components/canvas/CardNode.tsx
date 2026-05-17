import { memo, useState, useCallback, useRef, useEffect, useSyncExternalStore } from 'react'
import { useReactFlow, NodeResizer, type NodeProps } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import { useCardStore } from '../../utils/cardStore'
import { getCardFill, getCardStroke, getCardTextColor, getCardMutedTextColor } from '../../utils/cardStyles'
import { connectionMediator } from '../../utils/connectionMediator'
import { renderBlocksToHTML } from '../../utils/renderBlocks'
import type { CardColor } from '../../types/card'
import { useLibraryStore } from '../../utils/libraryStore'
import { CardHandles } from './card/CardHandles'
import { ConnectionButton } from './card/ConnectionButton'
import { CardContent } from './card/CardContent'

export interface CardNodeData extends Record<string, unknown> {
  cardId: string
  color: CardColor
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
  const editorRef = useRef<import('../editor/BlockNoteEditor').BlockNoteEditorHandle>(null)
  const clickCoordsRef = useRef<{ x: number; y: number } | null>(null)
  const { setNodes, getNode } = useReactFlow()
  const isDarkMode = useLibraryStore(s => s.isDarkMode)

  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === data.cardId
          ? { ...n, dragHandle: isEditing ? '.card-drag-handle' : undefined }
          : n,
      ),
    )
  }, [isEditing, data.cardId, setNodes])

  const card = useCardStore((s) => s.cards[data.cardId])
  const updateCard = useCardStore((s) => s.updateCard)

  const isConnecting = useSyncExternalStore(
    connectionMediator.subscribe.bind(connectionMediator),
    connectionMediator.isConnecting.bind(connectionMediator),
  )
  const isConnectingSource = useSyncExternalStore(
    connectionMediator.subscribe.bind(connectionMediator),
    () => connectionMediator.isConnectingFrom(data.cardId),
  )
  const isConnectionTarget = isConnecting && !isConnectingSource
  const isNearbyTarget = useSyncExternalStore(
    connectionMediator.subscribe.bind(connectionMediator),
    () => connectionMediator.getNearbyTarget() === data.cardId,
  )

  const showConnectionIcon = selected || isHovered || isConnecting

  const handleMouseEnter = useCallback(() => setIsHovered(true), [])
  const handleMouseLeave = useCallback(() => setIsHovered(false), [])

  const handleConnectionIconClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    connectionMediator.start(data.cardId, 'top')
  }, [data.cardId])

  const handleCardClick = useCallback(
    (e: React.MouseEvent) => {
      if (isConnectionTarget || isNearbyTarget) {
        e.stopPropagation()
        const pending = connectionMediator.getPending()
        const sourceNode = pending ? getNode(pending.sourceNodeId) : undefined
        const targetNode = getNode(data.cardId)
        if (sourceNode && targetNode) {
          const sw = ((sourceNode.data as Record<string, unknown>).width as number) ?? 280
          const sh = ((sourceNode.data as Record<string, unknown>).height as number) ?? 200
          const tw = ((targetNode.data as Record<string, unknown>).width as number) ?? 280
          const th = ((targetNode.data as Record<string, unknown>).height as number) ?? 200
          connectionMediator.complete(
            data.cardId,
            '',
            sourceNode.position,
            { w: sw, h: sh },
            targetNode.position,
            { w: tw, h: th },
          )
        } else {
          connectionMediator.complete(data.cardId, '')
        }
        return
      }
      if (!isEditing && selected && card) {
        clickCoordsRef.current = { x: e.clientX, y: e.clientY }
        setIsEditing(true)
      }
    },
    [isConnectionTarget, isNearbyTarget, data.cardId, selected, card, isEditing, getNode],
  )

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
      const coords = clickCoordsRef.current
      clickCoordsRef.current = null
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (coords) {
            editorRef.current!.focusAtCoords(coords)
          } else {
            editorRef.current!.focus()
          }
        })
      })
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

  const outlineWidth = selected ? 2 : 1
  const outlineColor = selected
    ? 'var(--border-active)'
    : isHovered
      ? 'var(--border-hover)'
      : getCardStroke(data.color)

  const cardBg = getCardFill(data.color, isDarkMode)
  const textColor = getCardTextColor(data.color, isDarkMode)
  const mutedTextColor = getCardMutedTextColor(data.color, isDarkMode)

  const cursor = isEditing ? 'text'
    : (isConnectionTarget || isNearbyTarget) ? 'crosshair'
    : isHovered ? 'pointer'
    : 'default'

  const cardClasses = [
    'card-node-default',
    'relative',
    'rounded-2xl',
    isConnectingSource ? 'card-node-connecting-source' : '',
    isNearbyTarget ? 'card-node-nearby-target' : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={cardClasses}
      style={{
        width: (data.width ?? DEFAULT_CARD_WIDTH) as number,
        height: (data.height ?? DEFAULT_CARD_HEIGHT) as number,
        backgroundColor: cardBg,
        outline: `${outlineWidth}px solid ${outlineColor}`,
        outlineOffset: 0,
        boxShadow: isConnectingSource
          ? 'var(--shadow-glow-blue)'
          : isNearbyTarget
            ? 'var(--shadow-glow-green)'
          : isConnectionTarget && isHovered
            ? 'var(--shadow-glow-green)'
          : isHovered
            ? 'var(--shadow-lg)'
          : selected
            ? 'var(--shadow-glow-blue)'
            : 'var(--shadow-sm)',
        cursor,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleCardClick}
    >
      {selected && (
        <NodeResizer
          minWidth={200}
          minHeight={120}
          isVisible={selected}
          handleClassName="!w-3 !h-3 !bg-blue-500 !border-2 !border-white !rounded-sm !shadow-sm"
          lineClassName="!bg-transparent"
          onResize={(_, params) => {
            setNodes((nds) =>
              nds.map((n) =>
                n.id === data.cardId
                  ? {
                      ...n,
                      data: { ...n.data, width: params.width, height: params.height },
                      width: params.width,
                      height: params.height,
                    }
                  : n,
              ),
            )
          }}
        />
      )}

      <CardHandles />

      <ConnectionButton visible={showConnectionIcon} onClick={handleConnectionIconClick} />

      <div
        className="card-drag-handle flex items-center justify-end px-3"
        style={{
          height: 28,
          cursor: 'grab',
          color: mutedTextColor,
          fontSize: 11,
          userSelect: 'none',
        }}
      >
        {isEditing ? '⋮⋮ 拖拽移动' : ''}
      </div>

      <CardContent
        isEditing={isEditing}
        isSelected={selected}
        content={card.content}
        previewHTML={card.previewHTML}
        enforceInitialHeading={card.enforceInitialHeading}
        onChange={handleContentChange}
        onBlur={handleEditorBlur}
        editorRef={editorRef}
        textColor={textColor}
      />
    </div>
  )
})
