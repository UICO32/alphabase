import { useState, useCallback, useRef, useEffect, useSyncExternalStore, useMemo } from 'react'
import { createPortal } from 'react-dom'
import DOMPurify from 'dompurify'
import {
  ReactFlow,
  ConnectionMode,
  SelectionMode,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type IsValidConnection,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  RefreshCw,
  Image as ImageIcon,
  FileText,
  StickyNote,
} from 'lucide-react'

import { ErrorBoundary } from '../ErrorBoundary'

import { CardNode } from './CardNode'
import { MediaNode } from './MediaNode'
import { FrameNode, type FrameNodeData } from './FrameNode'
import { CardEditDialog } from '../ui/CardEditDialog'
import { useViewStore } from '../../stores/viewStore'
import { usePanelStore } from '../../stores/panelStore'
import { useThemeStore } from '../../stores/themeStore'
import { useLibraryStore } from '../../stores/libraryStore'
import { useCardStore } from '../../stores/cardStore'
import { useBoardStore } from '../../stores/boardStore'
import { emit } from '../../stores/eventBus'
import { MemoizedConnectionEdge } from './ConnectionEdge'
import { CustomConnectionLine, setNodesRef } from './CustomConnectionLine'
import { AdaptiveBackground } from './AdaptiveBackground'
import { ConnectionPreview } from './ConnectionPreview'
import { AlignmentToolbar } from './AlignmentToolbar'

import { useIsDarkMode } from '../../hooks/useIsDarkMode'
import { useWorkspaceLifecycle } from '../../hooks/useWorkspaceLifecycle'
import { useBoardSync } from '../../hooks/useBoardSync'
import { useFrameSync } from '../../hooks/useFrameSync'
import { useCanvasPaste } from '../../hooks/useCanvasPaste'
import { useDropHandler } from '../../hooks/useDropHandler'
import { useCanvasZoom } from '../../hooks/useCanvasZoom'
import { useCanvasConnection } from '../../hooks/useCanvasConnection'
import { useCanvasDrag } from '../../hooks/useCanvasDrag'
import { useHistory } from '../../hooks/useHistory'
import { useCanvasKeyboard } from '../../hooks/useCanvasKeyboard'
import { useEvent } from '../../hooks/useEvent'
import { useCanvasDoubleClick } from '../../hooks/useCanvasDoubleClick'
import { type GlobalCard } from '../../stores/cardStore'
import { connectionMediator } from './utils/connectionMediator'
import { kanbanDragPreview } from './utils/kanbanDragPreview'
import { useFrameInteraction, exitLassoMode, setLassoRect, setLassoSelectedCardIds } from './utils/frameInteraction'
import { CardNodeData, PROXIMITY_THRESHOLD, DEFAULT_CARD_WIDTH, DEFAULT_CARD_HEIGHT } from '../../types/card'

const nodeTypes = {
  card: CardNode,
  frame: FrameNode,
  media: MediaNode,
}

const edgeTypes = {
  connection: MemoizedConnectionEdge,
}

export function ReactFlowCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [suggestionPage, setSuggestionPage] = useState(0)
  const editingNodeIdRef = useRef<string | null>(null)
  const isDarkMode = useIsDarkMode()
  const isLassoMode = useFrameInteraction((s) => s.lassoMode)
  const lassoRect = useFrameInteraction((s) => s.lassoRect)
  const editingCardId = useViewStore((s) => s.editingCardId)
  const kanbanEditDialogCardId = useViewStore((s) => s.kanbanEditDialogCardId)
  const kanbanEditDialogSourceRect = useViewStore((s) => s.kanbanEditDialogSourceRect)
  const closeKanbanEditDialog = useViewStore((s) => s.closeKanbanEditDialog)
  const gridPattern = useThemeStore((s) => s.gridPattern)
  const boards = useBoardStore((s) => s.boards)
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null)
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null)
  const nodesRef = useRef<Node[]>(nodes)
  const edgesRef = useRef<Edge[]>(edges)

  const { record, undo, redo, clear } = useHistory({ maxHistory: 20 })

  useEffect(() => { nodesRef.current = nodes }, [nodes])
  useEffect(() => { edgesRef.current = edges }, [edges])
  useEffect(() => { setNodesRef(nodes) }, [nodes])

  // 合并 RAF 清理到 nodesRef 的 effect 中，避免单独的 cleanup effect
  const rafRef = useRef<number | null>(null)
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const isConnecting = useSyncExternalStore(
    connectionMediator.subscribe.bind(connectionMediator),
    connectionMediator.isConnecting.bind(connectionMediator),
  )

  useWorkspaceLifecycle({ setNodes, setEdges, nodesRef, edgesRef })
  useBoardSync({ nodes, edges })
  useFrameSync({ nodes, setNodes })
  useCanvasPaste({ reactFlowInstance, setNodes, lastMousePosRef })

  const canvasRef = useRef<HTMLDivElement>(null)
  useCanvasZoom({ canvasRef, reactFlowInstance })

  useEvent('focus-card', (detail) => {
    const node = nodesRef.current.find(n => (n.data as Record<string, unknown>)?.cardId === detail.cardId)
    if (node) {
      reactFlowInstance.current?.fitView({ nodes: [node], duration: 300, padding: 0.3 })
    }
  })
  const { onConnect, onReconnect, onReconnectEnd } = useCanvasConnection({ setEdges })
  const { onNodeDrag, onNodeDragStart: snapDragStart, onNodeDragStop: originalOnNodeDragStop } = useCanvasDrag({ reactFlowInstance, setEdges, setNodes })
  useCanvasKeyboard({ undo, redo, setNodes, setEdges, clear, getNodes: () => nodesRef.current })

  const recordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const recordCurrentState = useCallback((deletedCardsContent?: Record<string, GlobalCard>) => {
    if (recordTimerRef.current) {
      clearTimeout(recordTimerRef.current)
    }
    recordTimerRef.current = setTimeout(() => {
      const nodes = nodesRef.current.map(n => ({ ...n }))
      const edges = edgesRef.current.map(e => ({ ...e }))
      record({
        nodes,
        edges,
        deletedCardsContent,
        _size: nodes.length * 500 + edges.length * 100,
      })
    }, 500)
  }, [record])

  // 操作前立即记录当前状态（无 debounce），确保 undo 能回到操作前
  const snapshotNow = useCallback((deletedCardsContent?: Record<string, GlobalCard>) => {
    if (recordTimerRef.current) {
      clearTimeout(recordTimerRef.current)
      recordTimerRef.current = null
    }
    const nodes = nodesRef.current.map(n => ({ ...n }))
    const edges = edgesRef.current.map(e => ({ ...e }))
    record({
      nodes,
      edges,
      deletedCardsContent,
      _size: nodes.length * 500 + edges.length * 100,
    })
  }, [record])

  // Bug1: 拖拽 Frame 时禁用 backdrop-filter 避免遮盖卡片
  // 拖拽开始前立即记录当前状态（无 debounce），确保 undo 能回到拖拽前位置
  const onNodeDragStart = useCallback((event: React.MouseEvent, node: Node) => {
    setIsDraggingNode(true)
    snapDragStart(event, node)
    snapshotNow()
    if (node.type === 'frame') {
      const el = document.querySelector(`[data-id="${node.id}"]`)
      if (el) el.classList.add('frame-dragging')
    }
  }, [snapDragStart, snapshotNow])

  const onNodeDragStopWithCleanup = useCallback((_event: React.MouseEvent, _node: Node, _nodes: Node[]) => {
    setIsDraggingNode(false)
    // Bug1: 拖拽结束后恢复 backdrop-filter
    document.querySelectorAll('.frame-dragging').forEach((el) => el.classList.remove('frame-dragging'))

    originalOnNodeDragStop(_event, _node)
    recordCurrentState()
  }, [originalOnNodeDragStop, recordCurrentState])

  const { handleDoubleClick } = useCanvasDoubleClick({ nodes, setNodes, reactFlowInstance, recordCurrentState, snapshotNow })

  useEffect(() => {
    const id = 'rf-hide-selection-rect'
    if (document.getElementById(id)) return
    const style = document.createElement('style')
    style.id = id
    style.textContent = '.react-flow__nodesselection-rect{display:none!important}'
    document.head.appendChild(style)
  }, [])

  const { handleDragOver, handleDrop } = useDropHandler({ reactFlowInstance, setNodes })

  useEvent('add-card-node', (detail) => {
    const { cardId, color } = detail
    const instance = reactFlowInstance.current
    if (!instance) return
    snapshotNow()
    const center = instance.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })
    setNodes((nds) => [
      ...nds,
      {
        id: cardId,
        type: 'card',
        position: center,
        data: { cardId, color, width: DEFAULT_CARD_WIDTH, height: DEFAULT_CARD_HEIGHT },
        zIndex: 10,
      },
    ])
    setTimeout(() => {
      recordCurrentState()
    }, 0)
  }, [setNodes, recordCurrentState, snapshotNow])

  // 框选模式：鼠标拖拽创建 Frame
  const lassoStartRef = useRef<{ x: number; y: number } | null>(null)
  const lassoActiveRef = useRef(false)

  useEffect(() => {
    if (!isLassoMode) {
      lassoStartRef.current = null
      lassoActiveRef.current = false
      return
    }

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      const instance = reactFlowInstance.current
      if (!instance) return
      const flowPos = instance.screenToFlowPosition({ x: e.clientX, y: e.clientY })
      lassoStartRef.current = { x: flowPos.x, y: flowPos.y }
      lassoActiveRef.current = true
      setLassoRect({ x: flowPos.x, y: flowPos.y, width: 0, height: 0 })
      setLassoSelectedCardIds(new Set())
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!lassoActiveRef.current || !lassoStartRef.current) return
      const instance = reactFlowInstance.current
      if (!instance) return
      const flowPos = instance.screenToFlowPosition({ x: e.clientX, y: e.clientY })
      const start = lassoStartRef.current
      const x = Math.min(start.x, flowPos.x)
      const y = Math.min(start.y, flowPos.y)
      const width = Math.abs(flowPos.x - start.x)
      const height = Math.abs(flowPos.y - start.y)
      setLassoRect({ x, y, width, height })

      const allNodes = instance.getNodes()
      const selected = new Set<string>()
      for (const node of allNodes) {
        if (node.type !== 'card') continue
        const nd = node.data as CardNodeData
        const nw = nd.width ?? DEFAULT_CARD_WIDTH
        const nh = nd.collapsed ? 44 : (nd.height ?? DEFAULT_CARD_HEIGHT)
        const cx = node.position.x + nw / 2
        const cy = node.position.y + nh / 2
        if (cx >= x && cx <= x + width && cy >= y && cy <= y + height) {
          selected.add(node.id)
        }
      }
      setLassoSelectedCardIds(selected)
    }

    const handleMouseUp = () => {
      if (!lassoActiveRef.current) return
      lassoActiveRef.current = false

      const state = useFrameInteraction.getState()
      const rect = state.lassoRect
      const selectedCardIds = state.lassoSelectedCardIds

      if (!rect || (rect.width < 30 && rect.height < 30)) {
        exitLassoMode()
        return
      }

      snapshotNow()

      const padding = 40
      const frameX = rect.x - padding
      const frameY = rect.y - padding
      const frameW = rect.width + padding * 2
      const frameH = rect.height + padding * 2

      const frameId = crypto.randomUUID()

      setNodes((nds) => {
        const updatedNodes = nds.map((n) => {
          if (!selectedCardIds.has(n.id)) return n
          const localX = n.position.x - frameX
          const localY = n.position.y - frameY
          const cardData = n.data as CardNodeData
          return {
            ...n,
            data: {
              ...n.data,
              frameId,
              frameLayout: 'free',
              localX,
              localY,
              layoutSnapshots: {
                ...cardData.layoutSnapshots,
                free: { localX, localY, width: cardData.width, height: cardData.height },
              },
            },
          }
        })

        return [
          ...updatedNodes,
          {
            id: frameId,
            type: 'frame',
            position: { x: frameX, y: frameY },
            data: {
              name: 'Frame',
              layout: 'free',
              width: frameW,
              height: frameH,
              childCardIds: [],
            },
            zIndex: -10,
            dragHandle: '.frame-drag-handle',
          },
        ]
      })

      exitLassoMode()
      setTimeout(() => recordCurrentState(), 0)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exitLassoMode()
    }

    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isLassoMode, setNodes, snapshotNow, recordCurrentState])

  // 删除卡片时立即记录操作前状态（含墓碑），然后 debounced 记录操作后状态
  useEvent('remove-card-from-board', (detail) => {
    const { cardId, cardContent } = detail
    snapshotNow({ [cardId]: cardContent as Record<string, GlobalCard>[string] })
  }, [snapshotNow])

  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance
  }, [])

  const onMove = useCallback(
    (() => {
      let lastTransformCall = 0
      let lastZoom = 0
      return (_event: MouseEvent | TouchEvent | null, viewport: { x: number; y: number; zoom: number }) => {
        // CSS 变量：zoom 变化时即时更新，无节流
        // ZoomPreview、缩放反比元素依赖此变量渲染，延迟会产生视觉跳变
        if (viewport.zoom !== lastZoom && canvasRef.current) {
          lastZoom = viewport.zoom
          canvasRef.current.style.setProperty('--rf-inv-zoom', String(1 / viewport.zoom))
          canvasRef.current.style.setProperty('--rf-zoom', String(viewport.zoom))
          // zoom 标量只驱动轻量订阅（ZoomPreview），即时更新
          useLibraryStore.setState({ zoom: viewport.zoom })
        }
        // transform 三元组驱动较重的订阅（library、panels），100ms 节流
        const now = performance.now()
        if (now - lastTransformCall < 100) return
        lastTransformCall = now
        useLibraryStore.setState({ transform: [viewport.x, viewport.y, viewport.zoom] })
      }
    })(),
    [],
  )

  const onPaneClick = useCallback(() => {
    connectionMediator.clear()
    kanbanDragPreview.clear()
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        selected: false,
      })),
    )
    editingNodeIdRef.current = null
    useViewStore.getState().setEditingCardId(null)
  }, [setNodes])

  const onSelectionChange = useCallback(({ nodes: selectedNodes }: { nodes: Node[] }) => {
    const card = selectedNodes.find(n => n.type === 'card')
    if (card) {
      const cardId = (card.data as Record<string, unknown>)?.cardId as string | undefined
      if (cardId) {
        const viewState = useViewStore.getState()
        if (viewState.editingCardId !== cardId) {
          viewState.setEditingCardId(cardId)
          const libraryState = useLibraryStore.getState()
          if (libraryState.sortBy !== 'related') {
            usePanelStore.getState().setRightPanelActiveTab('editor')
          }
        }
      }
    }
  }, [])

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      editingNodeIdRef.current = node.id
      if (node.type === 'card') {
        const cardId = (node.data as Record<string, unknown>)?.cardId as string | undefined
        if (cardId) {
          useViewStore.getState().setEditingCardId(cardId)
          const libraryState = useLibraryStore.getState()
          if (libraryState.sortBy !== 'related') {
            usePanelStore.getState().setRightPanelActiveTab('editor')
          }
        }
      }
    },
    [],
  )

  const pendingMouseEventRef = useRef<React.MouseEvent | null>(null)

  const isConnectingRef = useRef(isConnecting)
  useEffect(() => { isConnectingRef.current = isConnecting }, [isConnecting])

  const onMouseMove = useCallback((event: React.MouseEvent) => {
    lastMousePosRef.current = { x: event.clientX, y: event.clientY }
    if (!isConnectingRef.current) return
    pendingMouseEventRef.current = event
    if (rafRef.current !== null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const evt = pendingMouseEventRef.current
      if (!evt) return
      const rf = reactFlowInstance.current
      if (!rf) return
      const pending = connectionMediator.getPending()
      if (!pending) return
      let closestId: string | null = null
      let closestDist = PROXIMITY_THRESHOLD
      for (const node of nodesRef.current) {
        if (node.id === pending.sourceNodeId) continue
        if (node.type !== 'card') continue
        const w = ((node.data as Record<string, unknown>).width as number) ?? 280
        const h = ((node.data as Record<string, unknown>).height as number) ?? 200
        const zoom = rf.getViewport().zoom
        const screen = rf.flowToScreenPosition(node.position)
        const scaledW = w * zoom
        const scaledH = h * zoom
        const nearestX = Math.max(screen.x, Math.min(evt.clientX, screen.x + scaledW))
        const nearestY = Math.max(screen.y, Math.min(evt.clientY, screen.y + scaledH))
        const dist = Math.hypot(evt.clientX - nearestX, evt.clientY - nearestY)
        if (dist < closestDist) {
          closestDist = dist
          closestId = node.id
        }
      }
      connectionMediator.setNearbyTarget(closestId)
    })
  }, [])

  const connectionLineComponent = useCallback(
    (props: Parameters<typeof CustomConnectionLine>[0]) => (
      <CustomConnectionLine {...props} />
    ),
    [],
  )

  const isValidConnection: IsValidConnection = useCallback((connection) => {
    if ('source' in connection && 'target' in connection) {
      return (connection as Connection).source !== (connection as Connection).target
    }
    return true
  }, [])

  // 确保 Frame 节点排在数组最前面，DOM 先渲染 = paint 底层，背景不会覆盖卡片。
  // React Flow 也通过 zIndex 控制层级（frame=-10, card=10），数组顺序作为额外保障。
  const sortedNodes = useMemo(() => {
    const frames: Node[] = []
    const others: Node[] = []
    for (const n of nodes) (n.type === 'frame' ? frames : others).push(n)
    return [...frames, ...others]
  }, [nodes])

  const [isDraggingNode, setIsDraggingNode] = useState(false)
  const alignableNodes = useMemo(() => {
    if (isDraggingNode) return []
    return nodes.filter(n => n.selected && (n.type === 'card' || n.type === 'media'))
  }, [nodes, isDraggingNode])

  const onApplyAlignment = useCallback((updates: Map<string, { x: number; y: number }>) => {
    const currentNodes = nodesRef.current.map(n => ({ ...n }))
    const currentEdges = edgesRef.current.map(e => ({ ...e }))
    setNodes((nds) =>
      nds.map((n) => {
        const pos = updates.get(n.id)
        if (!pos) return n
        return { ...n, position: { x: pos.x, y: pos.y } }
      }),
    )
    // Record the pre-alignment state for undo
    record({
      nodes: currentNodes,
      edges: currentEdges,
    })
    recordCurrentState()
  }, [setNodes, record, recordCurrentState])

  // 看板 Frame 内的卡片之间隐藏连接线
  const visibleEdges = useMemo(() => {
    const kanbanFrameIds = new Set(
      nodes
        .filter(n => n.type === 'frame' && (n.data as FrameNodeData).layout === 'kanban')
        .map(n => n.id),
    )
    if (kanbanFrameIds.size === 0) return edges

    const nodeFrameMap = new Map<string, string>()
    for (const n of nodes) {
      const nd = n.data as Record<string, unknown>
      if (nd.frameId && kanbanFrameIds.has(nd.frameId as string)) {
        nodeFrameMap.set(n.id, nd.frameId as string)
      }
    }

    return edges.filter(e => {
      const sFrame = nodeFrameMap.get(e.source)
      const tFrame = nodeFrameMap.get(e.target)
      if (sFrame && tFrame && sFrame === tFrame) return false
      return true
    })
  }, [nodes, edges])

  const emptyBoardSuggestionMode = boards.length > 0 && nodes.length === 0
  const noBoardIntroMode = boards.length === 0
  const lockCanvasMovement = noBoardIntroMode || emptyBoardSuggestionMode

  // 建议卡片列表：取最近修改且不在当前画布上的卡片
  const allCards = useCardStore(s => s.cards)
  const suggestedCards = useMemo(() => {
    const boardCardIds = new Set(nodes.map(n => (n.data as Record<string, unknown>)?.cardId).filter(Boolean))
    const candidates = Object.values(allCards)
      .filter(c => !c.deletedAt && !boardCardIds.has(c.id))
      .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))
    if (candidates.length <= 3) return candidates
    const start = (suggestionPage * 3) % candidates.length
    return Array.from({ length: 3 }, (_, i) => candidates[(start + i) % candidates.length])
  }, [nodes, allCards, suggestionPage])
  const canShuffleSuggestions = useMemo(() => {
    const boardCardIds = new Set(nodes.map(n => (n.data as Record<string, unknown>)?.cardId).filter(Boolean))
    return Object.values(allCards).filter(c => !c.deletedAt && !boardCardIds.has(c.id)).length > 3
  }, [nodes, allCards])

  // 预生成建议卡片的 previewHTML（避免在 render 中调用触发 flushSync）
  const suggestedCardIdsRef = useRef<string[]>([])
  useEffect(() => {
    const ids = suggestedCards.map(c => c.id)
    // 仅在集合变化时才触发预生成
    if (ids.length === suggestedCardIdsRef.current.length && ids.every((id, i) => id === suggestedCardIdsRef.current[i])) return
    suggestedCardIdsRef.current = ids
    const missing = suggestedCards.filter(c => !c.previewHTML && c.content).map(c => c.id)
    if (missing.length > 0) {
      ;(requestIdleCallback || setTimeout)(() => {
        useCardStore.getState().ensurePreviewHTMLBatch(missing)
      })
    }
  }, [suggestedCards])

  return (
    <ErrorBoundary>
	    <div className={`w-full h-full bg-surface-app ${isLassoMode ? 'lasso-mode' : ''}`} ref={canvasRef} onDoubleClick={handleDoubleClick} onContextMenu={(e) => e.preventDefault()}>
	      <style>{`
		        .suggested-card {
		          will-change: transform, opacity;
		          backface-visibility: hidden;
		        }
		        .suggested-card.is-dragging {
		          opacity: 0;
		          pointer-events: none;
		        }
		        .suggested-card:hover {
		          z-index: 999 !important;
		        }
	        @keyframes card-land {
	          0% { transform: scale(0.9); opacity: 0.6; filter: brightness(1.1); }
	          60% { transform: scale(1.03); opacity: 1; filter: brightness(1.02); }
	          100% { transform: scale(1); opacity: 1; filter: brightness(1); }
	        }
	        .card-node-landing .card-node-default {
	          animation: card-land 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
	        }
	      `}</style>
      <ReactFlow
        nodes={sortedNodes}
        edges={visibleEdges}
        onlyRenderVisibleElements
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={onInit}
        onPaneClick={onPaneClick}
        onNodeClick={onNodeClick}
        onSelectionChange={onSelectionChange}
        onMouseMove={onMouseMove}
        onNodeDrag={onNodeDrag}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStopWithCleanup}
        onReconnect={onReconnect}
        onReconnectEnd={onReconnectEnd}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        edgesReconnectable
        connectionMode={ConnectionMode.Loose}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionLineComponent={connectionLineComponent}
        isValidConnection={isValidConnection}
        autoPanOnNodeDrag={false}
        panOnDrag={lockCanvasMovement ? false : (isLassoMode ? false : [2])}
        selectionOnDrag={lockCanvasMovement ? false : (isLassoMode ? false : !editingCardId)}
        selectionMode={SelectionMode.Partial}
        panActivationKeyCode="Space"
        onMove={onMove}
        elevateNodesOnSelect={false}
        fitView
        zoomOnScroll={!lockCanvasMovement}
        zoomOnPinch={!lockCanvasMovement}
        zoomOnDoubleClick={false}
        minZoom={0.1}
        maxZoom={4}
        nodeDragThreshold={3}
      >
        {!noBoardIntroMode && (
          <AdaptiveBackground
            color={isDarkMode ? '#ffffff' : '#18181b'}
            pattern={gridPattern}
          />
        )}
        <AlignmentToolbar
          selectedNodes={alignableNodes}
          reactFlowInstance={reactFlowInstance}
          onApplyAlignment={onApplyAlignment}
          isDraggingNode={isDraggingNode}
        />
      </ReactFlow>
      <ConnectionPreview nodesRef={nodesRef} reactFlowInstance={reactFlowInstance} lastMousePosRef={lastMousePosRef} />

      {/* ── 无画布：引导创建首个画布 ── */}
      {boards.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center select-none pointer-events-none" style={{ zIndex: 5 }}>
          <div className="relative mb-8 h-44 w-80">
            <div className="absolute left-2 top-10 w-28 rotate-[-8deg] rounded-2xl bg-surface-card p-3 shadow-lg">
              <div className="mb-3 flex h-16 items-center justify-center rounded-xl bg-gradient-to-br from-blue-400/25 to-cyan-400/20">
                <ImageIcon size={30} className="text-blue-500" />
              </div>
              <div className="h-2 w-16 rounded-full bg-fg-tertiary/30" />
              <div className="mt-2 h-1.5 w-20 rounded-full bg-fg-quaternary/30" />
            </div>
            <div className="absolute left-24 top-0 w-32 rounded-2xl bg-surface-card p-3 shadow-xl">
              <div className="mb-3 flex items-center gap-2">
                <StickyNote size={18} className="text-[var(--brand)]" />
                <div className="h-2 w-14 rounded-full bg-fg-tertiary/35" />
              </div>
              <div className="space-y-2">
                <div className="h-1.5 w-full rounded-full bg-fg-quaternary/35" />
                <div className="h-1.5 w-4/5 rounded-full bg-fg-quaternary/30" />
                <div className="h-1.5 w-3/5 rounded-full bg-fg-quaternary/25" />
              </div>
            </div>
            <div className="absolute right-2 top-12 w-28 rotate-[9deg] rounded-2xl bg-surface-card p-3 shadow-lg">
              <div className="mb-3 flex h-16 items-center justify-center rounded-xl bg-gradient-to-br from-rose-400/25 to-orange-400/20">
                <FileText size={30} className="text-rose-500" />
              </div>
              <div className="h-2 w-12 rounded-full bg-fg-tertiary/30" />
              <div className="mt-2 h-1.5 w-20 rounded-full bg-fg-quaternary/30" />
            </div>
            <svg className="absolute inset-x-0 bottom-1 mx-auto h-20 w-64 opacity-40" viewBox="0 0 256 80" fill="none">
              <path d="M62 40 C92 12, 122 12, 152 40 S206 70, 226 38" stroke="var(--line-default)" strokeWidth="2" strokeDasharray="5 5" />
              <circle cx="62" cy="40" r="4" fill="var(--brand)" />
              <circle cx="152" cy="40" r="4" fill="var(--brand)" />
              <circle cx="226" cy="38" r="4" fill="var(--brand)" />
            </svg>
          </div>
          <h3 className="text-base font-medium text-fg-secondary mb-1.5">开始你的知识探索</h3>
          <p className="text-xs text-fg-tertiary mb-5 max-w-[280px] text-center leading-relaxed">
            创建不同的画布来组织你的主题，<br/>在画布上建立卡片和连接
          </p>
          <button
            className="pointer-events-auto px-4 py-2 rounded-lg text-sm font-medium bg-brand text-white hover:brightness-110 active:brightness-95 transition-all"
            onClick={() => {
              const boardStore = useBoardStore.getState()
              const newBoard = {
                id: crypto.randomUUID(),
                name: '新画布',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              }
              boardStore.addBoard(newBoard)
              boardStore.saveBoardData(newBoard.id, { nodes: [], edges: [] })
              emit('switch-board', { boardId: newBoard.id })
            }}
          >
            + 新建画布
          </button>
        </div>
      )}

      {/* ── 空画布有卡片：扇形建议卡片 ── */}
      {emptyBoardSuggestionMode && suggestedCards.length > 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ zIndex: 1 }}>
          <p className="text-xs text-fg-tertiary mb-4 pointer-events-none">从卡片库拖入，或点击添加到画布</p>
          <div className="flex items-end justify-center pointer-events-auto" style={{ perspective: '900px' }}>
            {suggestedCards.map((sc, scIdx) => {
              const total = suggestedCards.length
              const centerIdx = (total - 1) / 2
              const offset = scIdx - centerIdx
              const rotation = offset * 8
              const yOffset = Math.abs(offset) * 12
              const xOverlap = scIdx === 0 ? 0 : -34
              const zIdx = 10 - Math.abs(Math.round(offset))

              const previewHTML = sc.previewHTML || useCardStore.getState().getPreviewHTML(sc.id) || ''
              const sanitizedHTML = DOMPurify.sanitize(previewHTML, {
                ALLOWED_URI_REGEXP: /^(?:(?:hepta-media|https?|mailto|tel|data):|[^a-zA-Z]|[^a-zA-Z]javascript:)/i
              }).replace(/<img[^>]*>/gi, '')

              return (
                <div
                  key={sc.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify({
                      type: 'card',
                      cardId: sc.id,
                      isNewInstance: e.altKey,
                      dragOffset: { x: 65, y: 86 },
                    }))
                    e.dataTransfer.effectAllowed = 'copy'
                    const ghost = e.currentTarget.cloneNode(true) as HTMLElement
                    ghost.style.position = 'fixed'
                    ghost.style.left = '-10000px'
                    ghost.style.top = '-10000px'
                    ghost.style.width = '130px'
                    ghost.style.opacity = '0.95'
                    ghost.style.transform = 'rotate(0deg) scale(1.05)'
                    ghost.style.boxShadow = '0 22px 48px rgba(0,0,0,0.24)'
                    ghost.style.borderRadius = '12px'
                    document.body.appendChild(ghost)
                    e.dataTransfer.setDragImage(ghost, 65, 86)
                    requestAnimationFrame(() => document.body.removeChild(ghost))
                    e.currentTarget.classList.add('is-dragging')
                  }}
                  onDragEnd={(e) => {
                    e.currentTarget.classList.remove('is-dragging')
                  }}
                  onClick={() => {
                    const instance = reactFlowInstance.current
                    if (!instance) return
                    snapshotNow()
                    const center = instance.screenToFlowPosition({
                      x: window.innerWidth / 2,
                      y: window.innerHeight / 2,
                    })
                    const fanOffset = (scIdx - (suggestedCards.length - 1) / 2) * 28
                    setNodes((nds) => [
                      ...nds,
                      {
                        id: crypto.randomUUID(),
                        type: 'card',
                        position: { x: center.x + fanOffset, y: center.y - 40 + Math.abs(fanOffset) * 0.18 },
                        data: { cardId: sc.id, color: sc.color || 'white', width: DEFAULT_CARD_WIDTH, height: DEFAULT_CARD_HEIGHT },
                        zIndex: 10,
                        className: 'card-node-landing',
                      },
                    ])
                    setTimeout(() => recordCurrentState(), 0)
                  }}
                  className="suggested-card group flex flex-col bg-surface-card border border-line-default rounded-xl cursor-grab active:cursor-grabbing overflow-hidden transition-[transform,box-shadow,opacity] duration-200 ease-out hover:shadow-xl hover:z-[999]"
                  style={{
                    width: 130,
                    aspectRatio: '3/4',
                    transform: `translateY(${yOffset}px) rotate(${rotation}deg)`,
                    transformOrigin: '50% 115%',
                    marginLeft: xOverlap,
                    zIndex: zIdx,
                    boxShadow: 'var(--shadow-md)',
                  }}
                >
                  {/* 内容：复用卡片库样式 */}
                  <div className="p-2.5 flex flex-col h-full overflow-hidden transition-transform duration-200 ease-out group-hover:-translate-y-3">
                    <div className="text-[11px] font-medium text-fg-primary truncate mb-1">
                      {sc.title || '无标题'}
                    </div>
                    <div
                      className="min-h-0 flex-1 overflow-hidden text-[10px] leading-relaxed text-fg-secondary"
                      style={{
                        WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
                        maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
                      }}
                      dangerouslySetInnerHTML={{ __html: sanitizedHTML || '无内容' }}
                    />
                  </div>
                  {/* Hover 提示 */}
                  <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.03)' }}>
                    <span className="text-[10px] text-fg-secondary bg-surface-panel/90 px-2 py-0.5 rounded shadow-sm">拖拽或点击放置</span>
                  </div>
                </div>
              )
            })}
          </div>
          {canShuffleSuggestions && (
            <button
              className="pointer-events-auto mt-5 inline-flex items-center gap-1.5 rounded-full bg-surface-card px-3 py-1.5 text-xs text-fg-secondary shadow-sm transition-all hover:-translate-y-0.5 hover:bg-surface-card-hover hover:text-fg-primary hover:shadow-md"
              onClick={() => setSuggestionPage(p => p + 1)}
            >
              <RefreshCw size={13} />
              换一换
            </button>
          )}
        </div>
      )}

      {/* 框选矩形 */}
      {isLassoMode && lassoRect && lassoRect.width > 0 && lassoRect.height > 0 && (() => {
        const rf = reactFlowInstance.current
        if (!rf) return null
        const topLeft = rf.flowToScreenPosition({ x: lassoRect.x, y: lassoRect.y })
        const bottomRight = rf.flowToScreenPosition({ x: lassoRect.x + lassoRect.width, y: lassoRect.y + lassoRect.height })
        const screenW = bottomRight.x - topLeft.x
        const screenH = bottomRight.y - topLeft.y
        return (
          <div
            style={{
              position: 'fixed',
              left: topLeft.x,
              top: topLeft.y,
              width: screenW,
              height: screenH,
              border: '2px dashed rgba(99,102,241,0.6)',
              background: 'rgba(99,102,241,0.08)',
              borderRadius: 8,
              pointerEvents: 'none',
              zIndex: 9998,
            }}
          />
        )
      })()}

      {/* Bug4: 看板视图下点击 MiniCard 唤起居中编辑弹窗 */}
      {kanbanEditDialogCardId && createPortal(
        <CardEditDialog
          cardId={kanbanEditDialogCardId}
          sourceRect={kanbanEditDialogSourceRect}
          onClose={closeKanbanEditDialog}
        />,
        document.body,
      )}

    </div>
    </ErrorBoundary>
  )
}