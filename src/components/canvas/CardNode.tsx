import { memo, useState, useCallback, useRef, useEffect, useSyncExternalStore } from 'react'
import { useReactFlow, NodeResizer, type NodeProps } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import { useCardStore, useCard } from '../../stores/cardStore'
import { useLibraryStore } from '../../stores/libraryStore'
import { getCardFill, getCardStroke, getCardTextColor } from '../../utils/cardStyles'
import { connectionMediator } from '../../utils/connectionMediator'
import { registerEditorHandle, clearProseMirrorSuppression } from '../../utils/editorHandleRegistry'
import type { CardColor, CardNodeData } from '../../types/card'
import { COLLAPSED_CARD_HEIGHT, DEFAULT_CARD_WIDTH, DEFAULT_CARD_HEIGHT } from '../../types/card'
import { useIsDarkMode } from '../../hooks/useIsDarkMode'
import { useFrameInteraction } from '../../utils/frameInteraction'
import { useBoardStore } from '../../stores/boardStore'
import { getActiveSyncEngine } from '../../sync/syncEngineRef'
import { useEventBus } from '../../stores/eventBus'
import { CardHandles } from './card/CardHandles'
import { CardActionBar } from './card/CardActionBar'
import { CardContent } from './card/CardContent'
import { CollapsedContent } from './card/CollapsedContent'
import { MiniCard } from './card/MiniCard'
import type { FrameNodeData } from './FrameNode'
import type { FrameLayout } from '../../utils/frameLayouts'

type CardNodeType = Node<CardNodeData, 'card'>

export const CardNode = memo(({ data, selected }: NodeProps<CardNodeType>) => {
  const isCollapsed = data.collapsed ?? false
  const isInFrame = !!data.frameId
  const isLassoSelected = useFrameInteraction(s => s.lassoSelectedCardIds.has(data.cardId))

  const [isEditing, setIsEditing] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const editorRef = useRef<import('../editor/BlockNoteEditor').BlockNoteEditorHandle>(null)
  const clickCoordsRef = useRef<{ x: number; y: number } | null>(null)
  const { setNodes, setEdges, getNode } = useReactFlow()
  const isDarkMode = useIsDarkMode()

  // 注册/注销编辑器 handle，供 useCanvasKeyboard 查询 canUndo
  useEffect(() => {
    registerEditorHandle(data.cardId, editorRef.current ?? null)
    return () => registerEditorHandle(data.cardId, null)
  }, [data.cardId, isEditing, selected])

  const frameLayout: FrameLayout = (() => {
    if (!data.frameId) return 'free'
    const frameNode = getNode(data.frameId)
    if (!frameNode) return 'free'
    return (frameNode.data as FrameNodeData).layout ?? 'free'
  })()
  const showMiniCard = isInFrame && frameLayout === 'kanban' && !isEditing

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

  const getNodeSize = useCallback((node: Node) => {
    const d = node.data as CardNodeData
    const w = d.width ?? DEFAULT_CARD_WIDTH
    const h = d.collapsed ? COLLAPSED_CARD_HEIGHT : (d.height ?? DEFAULT_CARD_HEIGHT)
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
      if (isCollapsed) return
      if (isHovered && !selected && card) {
        clickCoordsRef.current = { x: e.clientX, y: e.clientY }
        setIsEditing(true)
      } else if (!isEditing && selected && card) {
        clickCoordsRef.current = { x: e.clientX, y: e.clientY }
        setIsEditing(true)
      }
    },
    [isConnectionTarget, isNearbyTarget, data.cardId, selected, card, isEditing, isCollapsed, isHovered, getNode, getNodeSize],
  )

  const handleContentChange = useCallback(
    (content: string) => {
      clearProseMirrorSuppression(data.cardId)
      updateCard(data.cardId, { content })
    },
    [data.cardId, updateCard],
  )

  const handleEditorFocus = useCallback(() => {
    useCardStore.getState().recordCardContentSnapshot(data.cardId)
    useLibraryStore.getState().setEditingCardId(data.cardId)
  }, [data.cardId])

  const handleEditorBlur = useCallback(() => {
    useCardStore.getState().recordCardContentSnapshot(data.cardId)
    setIsEditing(false)
  }, [data.cardId])

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
        const prevHeight = (n.data as CardNodeData).prevHeight as number | undefined
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

  const emit = useEventBus(s => s.emit)

  const handleRemoveFromBoard = useCallback(() => {
    const cardData = useCardStore.getState().cards[data.cardId]
    if (cardData) {
      emit('remove-card-from-board', { cardId: data.cardId, cardContent: cardData })
    }
    setNodes((nds) => nds.filter((n) => n.id !== data.cardId))
    setEdges((eds) => eds.filter((e) => e.source !== data.cardId && e.target !== data.cardId))
  }, [data.cardId, setNodes, setEdges, emit])

  const handleMoveToBoard = useCallback((boardId: string) => {
    const node = getNode(data.cardId)
    if (!node) return

    const nodeData = node.data as CardNodeData
    const nodeWidth = nodeData.width
    const nodeHeight = nodeData.height

    setNodes((nds) => nds.filter((n) => n.id !== data.cardId))
    setEdges((eds) => {
      const relatedEdges = eds.filter((e) => e.source === data.cardId || e.target === data.cardId)
      const remainingEdges = eds.filter((e) => e.source !== data.cardId && e.target !== data.cardId)

      const boardStore = useBoardStore.getState()
      const targetData = boardStore.getBoardData(boardId) || { nodes: [], edges: [] }
      targetData.nodes.push({
        id: node.id,
        type: (node.type || 'card') as 'card' | 'frame' | 'media',
        position: { x: node.position.x, y: node.position.y },
        data: { ...node.data },
        width: nodeWidth,
        height: nodeHeight,
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

      const syncEngine = getActiveSyncEngine()
      if (syncEngine) {
        syncEngine.scheduleWriteBoard(boardId, {
          version: 2,
          nodes: targetData.nodes.map(n => ({
            id: n.id,
            type: (n.type === 'card' || n.type === 'frame' || n.type === 'media') ? n.type as 'card' | 'frame' | 'media' : 'card',
            position: { x: n.position.x, y: n.position.y },
            data: n.data as Record<string, unknown>,
            width: n.width,
            height: n.height,
          })),
          edges: targetData.edges.map(e => ({
            id: e.id,
            source: e.source,
            target: e.target,
            type: 'connection' as const,
            sourceHandle: e.sourceHandle ?? undefined,
            targetHandle: e.targetHandle ?? undefined,
          })),
          viewport: { x: 0, y: 0, zoom: 1 },
        })
      }

      return remainingEdges
    })
  }, [data.cardId, getNode, setNodes, setEdges])

  if (!card) {
    return (
      <div
        className="rounded-2xl border-2 border-dashed border-border-default flex items-center justify-center"
        style={{
          width: (data.width ?? DEFAULT_CARD_WIDTH) as number,
          height: (data.height ?? DEFAULT_CARD_HEIGHT) as number,
        }}
      >
        <span className="text-text-tertiary text-sm">Card not found</span>
      </div>
    )
  }

  if (showMiniCard) {
    return (
      <MiniCard
        cardId={data.cardId}
        width={data.width}
        height={data.height}
      />
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
    : 'default'

  const cardClasses = [
    'card-node-default',
    'relative',
    'rounded-2xl',
    (isEditing || selected) ? 'overflow-visible' : 'overflow-hidden',
    isConnectingSource ? 'card-node-connecting-source' : '',
    isNearbyTarget ? 'card-node-nearby-target' : '',
    isLassoSelected ? 'card-node-lasso-selected' : '',
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
      onContextMenu={(e) => e.preventDefault()}
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
        cardPreviewHTML={card.previewHTML}
      />

      {isCollapsed ? (
        <CollapsedContent
          cardId={data.cardId}
          content={card.content}
          previewHTML={card.previewHTML}
          textColor={textColor}
        />
      ) : (
        <CardContent
          isEditing={isEditing}
          isSelected={!!selected}
          cardId={data.cardId}
          content={card.content}
          previewHTML={card.previewHTML}
          enforceInitialHeading={card.enforceInitialHeading}
          onChange={handleContentChange}
          onFocus={handleEditorFocus}
          onBlur={handleEditorBlur}
          editorRef={editorRef}
          textColor={textColor}
        />
      )}
    </div>
  )
})
