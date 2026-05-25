import { memo, useState, useCallback, useRef, useEffect, useSyncExternalStore } from 'react'
import { useReactFlow, NodeResizer, type NodeProps } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import { useCardStore, useCard } from '../../stores/cardStore'
import { getCardFill, getCardStroke, getCardTextColor } from '../../utils/cardStyles'
import { connectionMediator } from '../../utils/connectionMediator'
import { renderBlocksToHTML } from '../../converters/renderBlocks'
import type { CardColor } from '../../types/card'
import { COLLAPSED_CARD_HEIGHT, DEFAULT_CARD_WIDTH, DEFAULT_CARD_HEIGHT } from '../../types/card'
import { useIsDarkMode } from '../../hooks/useIsDarkMode'
import { useBoardStore } from '../../stores/boardStore'
import { CardHandles } from './card/CardHandles'
import { CardActionBar } from './card/CardActionBar'
import { CardContent } from './card/CardContent'
import { CollapsedContent } from './card/CollapsedContent'

export interface CardNodeData extends Record<string, unknown> {
  cardId: string
  color: CardColor
  collapsed?: boolean
  fixedHeight?: boolean
  width?: number
  height?: number
}

type CardNodeType = Node<CardNodeData, 'card'>

export const CardNode = memo(({ data, selected }: NodeProps<CardNodeType>) => {
  const [isEditing, setIsEditing] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const editorRef = useRef<import('../editor/BlockNoteEditor').BlockNoteEditorHandle>(null)
  const clickCoordsRef = useRef<{ x: number; y: number } | null>(null)
  const { setNodes, setEdges, getNode } = useReactFlow()
  const isDarkMode = useIsDarkMode()

  const isCollapsed = data.collapsed ?? false

  // 合并 dragHandle 和 collapsed height 的更新，避免两次 setNodes 遍历
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== data.cardId) return n
        return {
          ...n,
          dragHandle: isEditing ? '.card-drag-handle' : undefined,
          ...(isCollapsed ? { height: COLLAPSED_CARD_HEIGHT } : {}),
        }
      }),
    )
  }, [isEditing, isCollapsed, data.cardId, setNodes])

  const card = useCard(data.cardId)
  const updateCard = useCardStore((s) => s.updateCard)

  const isConnecting = useSyncExternalStore(
    connectionMediator.subscribe.bind(connectionMediator),
    connectionMediator.isConnecting.bind(connectionMediator),
  )
  const isConnectingSource = useSyncExternalStore(
    (fn) => connectionMediator.subscribeCard(data.cardId, fn),
    () => connectionMediator.isConnectingFrom(data.cardId),
  )
  const isConnectionTarget = isConnecting && !isConnectingSource
  const isNearbyTarget = useSyncExternalStore(
    (fn) => connectionMediator.subscribeCard(data.cardId, fn),
    () => connectionMediator.getNearbyTarget() === data.cardId,
  )

  const handleMouseEnter = useCallback(() => setIsHovered(true), [])
  const handleMouseLeave = useCallback(() => setIsHovered(false), [])

  // 提取节点尺寸计算为独立函数，避免 inline 的 Record<string, unknown> 类型断言重复
  const getNodeSize = useCallback((node: Node) => {
    const d = node.data as Record<string, unknown>
    const w = (d.width as number) ?? DEFAULT_CARD_WIDTH
    const h = d.collapsed ? COLLAPSED_CARD_HEIGHT : ((d.height as number) ?? DEFAULT_CARD_HEIGHT)
    return { w, h }
  }, [])

  const handleCardClick = useCallback(
    (e: React.MouseEvent) => {
      if (isConnectionTarget || isNearbyTarget) {
        e.stopPropagation()
        const pending = connectionMediator.getPending()
        const sourceNode = pending ? getNode(pending.sourceNodeId) : undefined
        const targetNode = getNode(data.cardId)
        if (sourceNode && targetNode) {
          const ss = getNodeSize(sourceNode)
          const ts = getNodeSize(targetNode)
          connectionMediator.complete(
            data.cardId,
            '',
            sourceNode.position,
            { w: ss.w, h: ss.h },
            targetNode.position,
            { w: ts.w, h: ts.h },
          )
        } else {
          connectionMediator.complete(data.cardId, '')
        }
        return
      }
      if (!isEditing && selected && card && !isCollapsed) {
        clickCoordsRef.current = { x: e.clientX, y: e.clientY }
        setIsEditing(true)
      }
    },
    // getNodeSize 是 stable ref，不影响依赖列表
    [isConnectionTarget, isNearbyTarget, data.cardId, selected, card, isEditing, isCollapsed, getNode, getNodeSize],
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

  const handleDragBlocksOutside = useCallback((blocks: unknown[]) => {
    if (!card) return
    const currentNode = getNode(data.cardId)
    if (!currentNode) return

    const newCardId = crypto.randomUUID()
    const newContent = JSON.stringify(blocks)

    useCardStore.getState().addCard({
      id: newCardId,
      content: newContent,
      color: card.color,
      createdAt: Date.now(),
    })

    const offsetX = 320
    const offsetY = 0
    setNodes((nds) => [
      ...nds,
      {
        id: newCardId,
        type: 'card',
        position: {
          x: currentNode.position.x + offsetX,
          y: currentNode.position.y + offsetY,
        },
        data: {
          cardId: newCardId,
          color: card.color,
          width: data.width ?? 280,
          height: data.height ?? 200,
        },
      },
    ])
  }, [data.cardId, card, data.width, data.height, getNode, setNodes])

  useEffect(() => {
    if (!isEditing || !editorRef.current) return
    const coords = clickCoordsRef.current
    clickCoordsRef.current = null
    if (coords) {
      editorRef.current.focusAtCoords(coords)
    } else {
      editorRef.current.focus()
    }
  }, [isEditing])

  const handleToggleCollapse = useCallback(() => {
    const newCollapsed = !isCollapsed
    updateCard(data.cardId, { collapsed: newCollapsed })
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== data.cardId) return n
        if (newCollapsed) {
          const prevHeight = n.height ?? n.measured?.height ?? DEFAULT_CARD_HEIGHT
          return {
            ...n,
            data: { ...n.data, collapsed: true, prevHeight },
            height: COLLAPSED_CARD_HEIGHT,
          }
        }
        const prevHeight = (n.data as Record<string, unknown>).prevHeight as number | undefined
        return {
          ...n,
          data: { ...n.data, collapsed: false },
          height: prevHeight ?? DEFAULT_CARD_HEIGHT,
        }
      }),
    )
  }, [data.cardId, isCollapsed, updateCard, setNodes])

  const handleColorChange = useCallback((newColor: CardColor) => {
    updateCard(data.cardId, { color: newColor })
    setNodes((nds) =>
      nds.map((n) =>
        n.id === data.cardId
          ? { ...n, data: { ...n.data, color: newColor } }
          : n,
      ),
    )
  }, [data.cardId, updateCard, setNodes])

  const handleRemoveFromBoard = useCallback(() => {
    setNodes((nds) => nds.filter((n) => n.id !== data.cardId))
    setEdges((eds) => eds.filter((e) => e.source !== data.cardId && e.target !== data.cardId))
  }, [data.cardId, setNodes, setEdges])

  const handleMoveToBoard = useCallback((boardId: string) => {
    const node = getNode(data.cardId)
    if (!node) return

    setNodes((nds) => nds.filter((n) => n.id !== data.cardId))
    setEdges((eds) => {
      const relatedEdges = eds.filter((e) => e.source === data.cardId || e.target === data.cardId)
      const remainingEdges = eds.filter((e) => e.source !== data.cardId && e.target !== data.cardId)

      const boardStore = useBoardStore.getState()
      const targetData = boardStore.getBoardData(boardId) || { nodes: [], edges: [] }
      targetData.nodes.push({
        id: node.id,
        type: node.type || 'card',
        position: { x: node.position.x, y: node.position.y },
        data: { ...node.data },
        width: (node.data as Record<string, unknown>).width as number | undefined,
        height: (node.data as Record<string, unknown>).height as number | undefined,
      })
      targetData.edges.push(...relatedEdges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? undefined,
        targetHandle: e.targetHandle ?? undefined,
        type: e.type,
      })))
      boardStore.saveBoardData(boardId, targetData)

      return remainingEdges
    })
  }, [data.cardId, getNode, setNodes, setEdges])

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
    : getCardStroke(data.color)

  const cardBg = getCardFill(data.color, isDarkMode)
  const textColor = getCardTextColor(data.color, isDarkMode)

  const hoverOutline = isHovered && !selected
    ? `0 0 0 3px ${getCardStroke(data.color)}33`
    : ''

  const cursor = isCollapsed ? 'grab'
    : isEditing ? 'text'
    : (isConnectionTarget || isNearbyTarget) ? 'crosshair'
    : isHovered ? 'pointer'
    : 'default'

  const cardClasses = [
    'card-node-default',
    'relative',
    'rounded-2xl',
    (isEditing || selected) ? 'overflow-visible' : 'overflow-hidden',
    isConnectingSource ? 'card-node-connecting-source' : '',
    isNearbyTarget ? 'card-node-nearby-target' : '',
  ].filter(Boolean).join(' ')

  const nodeHeight = isCollapsed ? COLLAPSED_CARD_HEIGHT : (data.height ?? DEFAULT_CARD_HEIGHT) as number

  return (
    <div
      className={cardClasses}
      style={{
        width: (data.width ?? DEFAULT_CARD_WIDTH) as number,
        height: nodeHeight,
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
            ? `${hoverOutline}, var(--shadow-lg)`
          : selected
            ? 'var(--shadow-glow-blue)'
            : 'var(--shadow-sm)',
        cursor,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleCardClick}
    >
      {selected && !isCollapsed && (
        <NodeResizer
          minWidth={200}
          minHeight={120}
          isVisible={selected}
          handleClassName="!w-4 !h-4 !bg-transparent !border-0 !rounded-sm"
          lineClassName="!bg-transparent !border-0 !w-3 !cursor-col-resize"
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

      <CardActionBar
        cardId={data.cardId}
        color={data.color}
        collapsed={isCollapsed}
        isHovered={isHovered}
        selected={!!selected}
        isConnecting={isConnecting}
        onToggleCollapse={handleToggleCollapse}
        onRemoveFromBoard={handleRemoveFromBoard}
        onMoveToBoard={handleMoveToBoard}
        onColorChange={handleColorChange}
        cardTitle={card.title}
        cardContent={card.content}
        cardPreviewHTML={card.previewHTML}
      />

      {isCollapsed ? (
        <CollapsedContent
          content={card.content}
          previewHTML={card.previewHTML}
          textColor={textColor}
        />
      ) : (
        <CardContent
          isEditing={isEditing}
          isSelected={!!selected}
          content={card.content}
          previewHTML={card.previewHTML}
          enforceInitialHeading={card.enforceInitialHeading}
          onChange={handleContentChange}
          onBlur={handleEditorBlur}
          editorRef={editorRef}
          textColor={textColor}
          onDragBlocksOutside={handleDragBlocksOutside}
        />
      )}
    </div>
  )
})