import { memo, useState, useCallback, useRef, useEffect, useSyncExternalStore } from 'react'
import { Handle, Position, useReactFlow, NodeResizer, type NodeProps } from '@xyflow/react'
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

const handleClassName = '!opacity-0 !pointer-events-none !w-3 !h-3 !border-0'

export const CardNode = memo(({ data, selected }: NodeProps<CardNodeType>) => {
  const [isEditing, setIsEditing] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const editorRef = useRef<BlockNoteEditorHandle>(null)
  const clickCoordsRef = useRef<{ x: number; y: number } | null>(null)
  const { setNodes } = useReactFlow()

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
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
        const clickX = e.clientX - rect.left
        const clickY = e.clientY - rect.top
        const w = rect.width
        const h = rect.height
        const centerX = w / 2
        const centerY = h / 2
        const dx = clickX - centerX
        const dy = clickY - centerY
        const absDx = Math.abs(dx)
        const absDy = Math.abs(dy)
        let targetHandle = 'top-target'
        if (absDx * h > absDy * w) {
          targetHandle = dx > 0 ? 'right-target' : 'left-target'
        } else {
          targetHandle = dy > 0 ? 'bottom-target' : 'top-target'
        }
        connectionMediator.complete(data.cardId, targetHandle)
        return
      }
      if (!isEditing && selected && card) {
        clickCoordsRef.current = { x: e.clientX, y: e.clientY }
        console.debug('[CardNode] click-to-edit', {
          cardId: data.cardId,
          clientX: e.clientX,
          clientY: e.clientY,
          pageX: e.pageX,
          pageY: e.pageY,
        })
        setIsEditing(true)
      }
    },
    [isConnectionTarget, data.cardId, selected, card, isEditing],
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
            const pmEl = document.querySelector('.ProseMirror') as HTMLElement | null
            const pmRect = pmEl?.getBoundingClientRect()
            console.debug('[CardNode] focusAtCoords debug', {
              inputCoords: coords,
              pmRect: pmRect ? { top: pmRect.top, left: pmRect.left, width: pmRect.width, height: pmRect.height } : null,
              clientToPm: pmRect ? { x: coords.x - pmRect.left, y: coords.y - pmRect.top } : null,
              pageToPm: pmRect ? { x: coords.x - pmRect.left + window.scrollX, y: coords.y - pmRect.top + window.scrollY } : null,
            })
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
    ? '#3b82f6'
    : isHovered
      ? 'rgba(0,0,0,0.12)'
      : 'rgba(0,0,0,0.08)'

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
          : isNearbyTarget
            ? '0 0 0 3px rgba(34,197,94,0.5), 0 4px 20px rgba(34,197,94,0.2)'
          : isConnectionTarget && isHovered
            ? '0 0 0 2px rgba(34,197,94,0.4), 0 4px 16px rgba(34,197,94,0.15)'
          : isHovered
            ? '0 8px 28px rgba(15,23,42,0.14)'
            : selected
              ? '0 8px 24px rgba(59,130,246,0.15)'
              : '0 2px 8px rgba(0,0,0,0.06)',
        cursor: isConnectionTarget || isNearbyTarget ? 'crosshair' : 'grab',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleCardClick}
    >
      {/* 缩放控制 - 选中时显示四角抓手，四边透明但可拖拽 */}
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

      {/* 四边连接锚点 - 不可见，仅作为连接点 */}
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        className={handleClassName}
        style={{ top: 0, left: '50%', transform: 'translate(-50%, -50%)' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className={handleClassName}
        style={{ bottom: 0, left: '50%', transform: 'translate(-50%, 50%)' }}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        className={handleClassName}
        style={{ left: 0, top: '50%', transform: 'translate(-50%, -50%)' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className={handleClassName}
        style={{ right: 0, top: '50%', transform: 'translate(50%, -50%)' }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top-target"
        className={handleClassName}
        style={{ top: 0, left: '50%', transform: 'translate(-50%, -50%)' }}
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom-target"
        className={handleClassName}
        style={{ bottom: 0, left: '50%', transform: 'translate(-50%, 50%)' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left-target"
        className={handleClassName}
        style={{ left: 0, top: '50%', transform: 'translate(-50%, -50%)' }}
      />
      <Handle
        type="target"
        position={Position.Right}
        id="right-target"
        className={handleClassName}
        style={{ right: 0, top: '50%', transform: 'translate(50%, -50%)' }}
      />

      {/* 连接按钮 - 卡片外部右上角 */}
      <button
        className="absolute flex items-center justify-center rounded-full cursor-crosshair z-10 transition-all duration-150 shadow-md"
        style={{
          top: -14,
          right: -14,
          width: 28,
          height: 28,
          backgroundColor: '#3b82f6',
          color: '#fff',
          fontSize: 18,
          fontWeight: 700,
          lineHeight: 1,
          border: '3px solid #fff',
          opacity: showConnectionIcon ? 1 : 0,
          pointerEvents: showConnectionIcon ? 'auto' : 'none',
        }}
        onClick={handleConnectionIconClick}
        onPointerDown={(e) => e.stopPropagation()}
      >
        +
      </button>

      {/* 拖拽把手 + 顶部间距 */}
      <div
        className="card-drag-handle flex items-center justify-end px-3"
        style={{
          height: 28,
          cursor: 'grab',
          color: styles.mutedTextColor,
          fontSize: 11,
          userSelect: 'none',
        }}
      >
        {isEditing ? '⋮⋮ 拖拽移动' : ''}
      </div>

      {/* 卡片内容 */}
      <div
        className="pb-3"
        style={{
          height: 'calc(100% - 28px)',
          color: styles.textColor,
          overflow: isEditing ? 'visible' : 'hidden',
        }}
      >
        {isEditing ? (
          <div
            className="h-full px-6"
            style={{ fontSize: '13px', lineHeight: '1.5', overflow: 'visible' }}
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
            className="h-full overflow-y-auto px-6"
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
