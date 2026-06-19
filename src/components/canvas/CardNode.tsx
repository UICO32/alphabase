import { memo, useState, useCallback, useRef, useEffect, useSyncExternalStore } from 'react'
import { useReactFlow, NodeResizer, type NodeProps } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import { useCardStore, useCard } from '../../stores/cardStore'
import { useEditorHistoryStore } from '../../stores/editorHistoryStore'
import { useViewStore } from '../../stores/viewStore'
import { getCardFill, getCardStroke, getCardTextColor } from './utils/cardStyles'
import { connectionMediator } from './utils/connectionMediator'
import { registerEditorHandle, clearProseMirrorSuppression } from '../editor/utils/editorHandleRegistry'
import type { CardColor, CardNodeData } from '../../types/card'
import { COLLAPSED_CARD_HEIGHT, DEFAULT_CARD_WIDTH, DEFAULT_CARD_HEIGHT } from '../../types/card'
import { useIsDarkMode } from '../../hooks/useIsDarkMode'
import { useFrameInteraction } from './utils/frameInteraction'
import { useBoardStore } from '../../stores/boardStore'
import { emit } from '../../stores/eventBus'
import { useAIStore } from '../../stores/aiStore'
import { CardHandles } from './card/CardHandles'
import { CardActionBar } from './card/CardActionBar'
import { CardContent } from './card/CardContent'
import { CollapsedContent } from './card/CollapsedContent'
import { MiniCard } from './card/MiniCard'
import { SummaryButton } from './card/SummaryButton'
import { ZoomPreview } from './card/ZoomPreview'
import type { FrameNodeData } from './FrameNode'
import { computeLayout, type FrameLayout } from './utils/frameLayouts'

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

  const miniCardRef = useRef<HTMLDivElement>(null)
  const measuredHeightRef = useRef<number>(0)

  useEffect(() => {
    if (!showMiniCard || !miniCardRef.current || !data.frameId) return
    const el = miniCardRef.current
    measuredHeightRef.current = data.height ?? 0
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const measuredH = Math.round(entry.contentRect.height)
        if (measuredH < 10) return
        const currentH = measuredHeightRef.current
        if (Math.abs(measuredH - currentH) > 5) {
          measuredHeightRef.current = measuredH
          setNodes(nds => {
            const frameNode = nds.find(n => n.id === data.frameId)
            if (!frameNode) return nds
            const fd = frameNode.data as FrameNodeData
            if (fd.layout !== 'kanban') return nds

            let updated = nds.map(n =>
              n.id === data.cardId
                ? { ...n, data: { ...n.data, height: measuredH } }
                : n
            )

            const uf = updated.find(n => n.id === data.frameId)!
            const children = updated.filter(n => {
              const nd = n.data as Record<string, unknown>
              return nd.frameId === data.frameId && n.id !== data.frameId
            })
            const result = computeLayout(uf, children, 'kanban')

            return updated.map(n => {
              if (n.id === data.frameId) return n
              const pos = result.positions[n.id]
              if (pos) {
                return {
                  ...n,
                  position: { x: uf.position.x + pos.x, y: uf.position.y + pos.y },
                  data: {
                    ...n.data,
                    localX: pos.x,
                    localY: pos.y,
                    ...(pos.width ? { width: pos.width } : {}),
                  },
                }
              }
              return n
            })
          })
        }
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [showMiniCard, data.frameId, data.cardId, setNodes])

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
  const hasSummaryBubble = useAIStore(s => s.streamingCardId === data.cardId && (s.isStreaming || !!s.streamingText))

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

  const handleNavigateToCard = useCallback((targetCardId: string) => {
    useViewStore.getState().openCardEditor(targetCardId)
  }, [])

  const handleTagClick = useCallback((_tagName: string) => {
    // Future: navigate to tag filter view
  }, [])

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
      // 点击编辑器内部时（ProseMirror contenteditable），不拦截
      const target = e.target as HTMLElement
      if (target.closest('[contenteditable="true"]')) return
      if (isEditing) {
        editorRef.current?.focusAtCoords({ x: e.clientX, y: e.clientY })
        return
      }
      if (card) {
        clickCoordsRef.current = { x: e.clientX, y: e.clientY }
        setIsEditing(true)
      }
    },
    [isConnectionTarget, isNearbyTarget, data.cardId, card, isEditing, isCollapsed, getNode, getNodeSize],
  )

  const handleContentChange = useCallback(
    (content: string) => {
      clearProseMirrorSuppression(data.cardId)
      updateCard(data.cardId, { content })
    },
    [data.cardId, updateCard],
  )

  const handleEditorFocus = useCallback(() => {
    const content = useCardStore.getState().cards[data.cardId]?.content
    if (content) useEditorHistoryStore.getState().recordSnapshot(data.cardId, content)
    useViewStore.getState().setEditingCardId(data.cardId)
  }, [data.cardId])

  const handleEditorBlur = useCallback(() => {
    const content = useCardStore.getState().cards[data.cardId]?.content
    if (content) useEditorHistoryStore.getState().recordSnapshot(data.cardId, content)
    setIsEditing(false)
  }, [data.cardId])

  useEffect(() => {
    if (!isEditing) return

    const coords = clickCoordsRef.current
    let cancelled = false
    let rafId = 0

    const tryFocus = () => {
      if (cancelled) return
      if (!editorRef.current) {
        rafId = requestAnimationFrame(tryFocus)
        return
      }
      clickCoordsRef.current = null
      if (coords) {
        editorRef.current.focusAtCoords(coords)
      } else {
        editorRef.current.focus()
      }
    }

    tryFocus()

    return () => {
      cancelled = true
      if (rafId) cancelAnimationFrame(rafId)
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

      return remainingEdges
    })
  }, [data.cardId, getNode, setNodes, setEdges])

  // Cache card data for SummaryButton to read when clicked
  useEffect(() => {
    const win = window as any
    if (!win.__cardDataCache) win.__cardDataCache = {}
    const cardData = useCardStore.getState().cards[data.cardId]
    if (cardData) {
      win.__cardDataCache[data.cardId] = {
        content: cardData.content,
        previewHTML: cardData.previewHTML || useCardStore.getState().getPreviewHTML(data.cardId) || '',
        color: cardData.color,
      }
    }
  }, [data.cardId, card?.content, card?.previewHTML])

  if (!card) {
    return (
      <div
        className="rounded-xl border-2 border-dashed border-line-default flex items-center justify-center"
        style={{
          width: (data.width ?? DEFAULT_CARD_WIDTH) as number,
          height: (data.height ?? DEFAULT_CARD_HEIGHT) as number,
        }}
      >
        <span className="text-fg-tertiary text-sm">Card not found</span>
      </div>
    )
  }

  if (showMiniCard) {
    return (
      <div ref={miniCardRef} style={{ width: '100%', height: 'auto' }}>
        <MiniCard
          cardId={data.cardId}
          width={data.width}
          height={undefined}
        />
      </div>
    )
  }

  const borderWidth = selected ? 2 : 1
  const borderColor = selected
    ? 'var(--card-selected-border)'
    : isEditing
      ? 'var(--line-active)'
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
    'rounded-xl',
    (isEditing || selected || isHovered || hasSummaryBubble) ? 'overflow-visible' : 'overflow-hidden',
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
        border: `${borderWidth}px solid ${borderColor}`,
        boxShadow: isConnectingSource
          ? 'var(--shadow-glow-accent)'
          : isNearbyTarget
            ? 'var(--shadow-glow-green)'
          : isConnectionTarget && isHovered
            ? 'var(--shadow-glow-green)'
          : isHovered
            ? `${hoverOutline}, var(--shadow-lg)`
          : selected
            ? 'var(--card-selected-shadow)'
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
          handleClassName="!w-8 !h-8 !bg-transparent !border-0"
          lineClassName="!bg-transparent !border-0 !w-8"
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

      <SummaryButton
        color={data.color}
        visible={isHovered || !!selected}
        cardId={data.cardId}
      />

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
        <>
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
            onNavigateToCard={handleNavigateToCard}
            onTagClick={handleTagClick}
          />
          <ZoomPreview
            cardId={data.cardId}
            content={card.content}
            previewHTML={card.previewHTML}
          />
        </>
      )}
    </div>
  )
})
