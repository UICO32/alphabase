import { memo, useState, useCallback, useRef, useEffect, useSyncExternalStore } from 'react'
import { useReactFlow, NodeResizer, type NodeProps } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import { useCardStore, useCard } from '../../stores/cardStore'
import { useViewStore } from '../../stores/viewStore'
import { useLibraryStore } from '../../stores/libraryStore'
import { getCardFill, getCardStroke, getCardTextColor } from './utils/cardStyles'
import { connectionMediator } from './utils/connectionMediator'
import type { CardNodeData } from '../../types/card'
import { COLLAPSED_CARD_HEIGHT, DEFAULT_CARD_WIDTH, DEFAULT_CARD_HEIGHT } from '../../types/card'
import { useIsDarkMode } from '../../hooks/useIsDarkMode'
import { useFrameInteraction } from './utils/frameInteraction'
import { useAIStore } from '../../stores/aiStore'
import { CardHandles } from './card/CardHandles'
import { CardActionBar } from './card/CardActionBar'
import { CardContent } from './card/CardContent'
import { CollapsedContent } from './card/CollapsedContent'
import { MiniCard } from './card/MiniCard'
import { ZoomPreview } from './card/ZoomPreview'
import type { FrameNodeData } from './FrameNode'
import { computeLayout, type FrameLayout } from './utils/frameLayouts'
import { getCardNodeSize } from './utils/cardNodeSize'
import { useCardNodeActions } from './useCardNodeActions'
import { useCardNodeEditing } from './useCardNodeEditing'

type CardNodeType = Node<CardNodeData, 'card'>

export const CardNode = memo(({ data, selected }: NodeProps<CardNodeType>) => {
  const isCollapsed = data.collapsed ?? false
  const isInFrame = !!data.frameId
  const isLassoSelected = useFrameInteraction(s => s.lassoSelectedCardIds.has(data.cardId))

  const [isHovered, setIsHovered] = useState(false)
  const { setNodes, setEdges, getNode } = useReactFlow()
  const isDarkMode = useIsDarkMode()
  const card = useCard(data.cardId)
  const updateCard = useCardStore((s) => s.updateCard)
  const hasSummaryBubble = useAIStore(s => s.streamingCardId === data.cardId && (s.isStreaming || !!s.streamingText))
  const {
    isEditing,
    editorRef,
    beginEditingAt,
    handleContentChange,
    handleEditorFocus,
    handleEditorBlur,
  } = useCardNodeEditing({
    cardId: data.cardId,
    selected: !!selected,
    updateCard,
  })

  // 直接读取下沉到 card data 的 frameLayout，避免每次 render 调用 getNode(frameId)
  // —— useReactFlow().getNode 订阅整个 nodes store，会让所有卡片在任何节点变化时重渲染。
  // frameLayout 由 FrameNode.handleLayoutChange 维护并写入子卡 data。
  const frameLayout: FrameLayout = data.frameLayout ?? 'free'
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

            const updated = nds.map(n =>
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
    setNodes((nds) => {
      const idx = nds.findIndex((n) => n.id === data.cardId)
      if (idx === -1) return nds
      const me = nds[idx]
      const newDragHandle = isEditing ? '.card-drag-handle' : undefined
      const newHeight = isCollapsed ? COLLAPSED_CARD_HEIGHT : undefined
      // 守卫：状态未实际变化时直接返回原数组，避免每次挂载/更新都触发 store 更新
      // —— 否则 100 张卡首次挂载会产生 O(n²) 的级联 setNodes（每张卡的重渲染又触发此 effect）。
      if (me.dragHandle === newDragHandle && (newHeight === undefined || me.height === newHeight)) {
        return nds
      }
      const next = [...nds]
      next[idx] = {
        ...me,
        ...(me.dragHandle !== newDragHandle ? { dragHandle: newDragHandle } : {}),
        ...(newHeight !== undefined && me.height !== newHeight ? { height: newHeight } : {}),
      }
      return next
    })
  }, [isEditing, isCollapsed, data.cardId, setNodes])

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

  const handleTagClick = useCallback((tagName: string) => {
    useLibraryStore.getState().setTagFilter(tagName)
    useViewStore.getState().setViewMode('cards')
  }, [])

  const handleCardClick = useCallback(
    (e: React.MouseEvent) => {
      if (isConnectionTarget || isNearbyTarget) {
        e.stopPropagation()
        const pending = connectionMediator.getPending()
        const sourceNode = pending ? getNode(pending.sourceNodeId) : undefined
        const targetNode = getNode(data.cardId)
        if (sourceNode && targetNode) {
          const ss = getCardNodeSize(sourceNode)
          const ts = getCardNodeSize(targetNode)
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
      // 点击划词工具栏、图片工具栏等编辑器浮层时，不要把光标移到点击坐标——
      // 这些按钮有自己的行为，focusAtCoords 会破坏当前选区并把光标插到按钮下方。
      if (target.closest('.bn-formatting-toolbar, .bn-link-toolbar, .bn-suggestion-menu, .bn-ui-container, .image-toolbar')) return
      if (isEditing) {
        editorRef.current?.focusAtCoords({ x: e.clientX, y: e.clientY })
        return
      }
      if (card) {
        beginEditingAt({ x: e.clientX, y: e.clientY })
      }
    },
    [isConnectionTarget, isNearbyTarget, data.cardId, card, isEditing, isCollapsed, getNode, beginEditingAt, editorRef],
  )

  const {
    handleToggleCollapse,
    handleColorChange,
    handleRemoveFromBoard,
    handleMoveToBoard,
  } = useCardNodeActions({
    cardId: data.cardId,
    isCollapsed,
    updateCard,
    setNodes,
    setEdges,
    getNode,
  })

  // SummaryButton/SummaryBubble 通过 zustand selector 直接读 cardStore，
  // 不需要全局缓存。之前残留的 __cardDataCache 全局对象已废弃。

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

  const borderWidth = 1
  const activeBorderColor = selected
    ? 'var(--card-selected-border)'
    : isEditing
      ? 'var(--line-active)'
      : getCardStroke(data.color)

  const cardBg = getCardFill(data.color, isDarkMode)
  const textColor = getCardTextColor(data.color, isDarkMode)

  const hoverOutline = isHovered
    ? `0 0 0 3px ${getCardStroke(data.color)}33`
    : ''

  const selectedShadow = '0 0 0 1px var(--card-selected-border), 0 0 0 2px var(--brand-ring), 0 4px 16px color-mix(in srgb, var(--brand) 14%, transparent)'
  const editingShadow = '0 0 0 1px var(--line-active), 0 0 0 2px color-mix(in srgb, var(--line-active) 18%, transparent)'
  const activeShadow = selected ? selectedShadow : isEditing ? editingShadow : ''

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
        border: `${borderWidth}px solid ${activeBorderColor}`,
        boxShadow: isConnectingSource
          ? 'var(--shadow-glow-accent)'
          : isNearbyTarget
            ? 'var(--shadow-glow-green)'
          : isConnectionTarget && isHovered
            ? 'var(--shadow-glow-green)'
          : isHovered && activeShadow
            ? `${activeShadow}, ${hoverOutline}`
          : isHovered
            ? `${hoverOutline}, var(--shadow-lg)`
          : activeShadow
            ? activeShadow
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

      {/*
        AI 按钮悬停热区：覆盖卡片右上角外部（AI 按钮所在区域），
        作为卡片的子元素，鼠标进入此区域不会触发卡片的 mouseleave，
        从而在移向 AI 按钮时保持 hover 态。
        仅在可交互时渲染，避免遮挡相邻卡片。
      */}
      {(isHovered || selected || hasSummaryBubble) && (
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
