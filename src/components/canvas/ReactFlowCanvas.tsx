import { useState, useCallback, useRef, useEffect, useSyncExternalStore, useMemo } from 'react'
import { createPortal } from 'react-dom'
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

import { ErrorBoundary } from '../ErrorBoundary'

import { CardNode } from './CardNode'
import { MediaNode } from './MediaNode'
import { FrameNode, type FrameNodeData } from './FrameNode'
import { CardEditDialog } from '../ui/CardEditDialog'
import { useLibraryStore } from '../../stores/libraryStore'
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
import { connectionMediator } from '../../utils/connectionMediator'
import { kanbanDragPreview } from '../../utils/kanbanDragPreview'
import { useFrameInteraction, exitLassoMode, setLassoRect, setLassoSelectedCardIds } from '../../utils/frameInteraction'
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
  const editingNodeIdRef = useRef<string | null>(null)
  const isDarkMode = useIsDarkMode()
  const setZoom = useLibraryStore((s) => s.setZoom)
  const isLassoMode = useFrameInteraction((s) => s.lassoMode)
  const lassoRect = useFrameInteraction((s) => s.lassoRect)
  const editingCardId = useLibraryStore((s) => s.editingCardId)
  const kanbanEditDialogCardId = useLibraryStore((s) => s.kanbanEditDialogCardId)
  const kanbanEditDialogSourceRect = useLibraryStore((s) => s.kanbanEditDialogSourceRect)
  const closeKanbanEditDialog = useLibraryStore((s) => s.closeKanbanEditDialog)
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

  const setTransform = useLibraryStore((s) => s.setTransform)

  const onMove = useCallback(
    (() => {
      let lastCall = 0
      return (_event: MouseEvent | TouchEvent | null, viewport: { x: number; y: number; zoom: number }) => {
        const now = performance.now()
        if (now - lastCall < 100) return
        lastCall = now
        setZoom(viewport.zoom)
        setTransform([viewport.x, viewport.y, viewport.zoom])
      }
    })(),
    [setZoom, setTransform],
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
    useLibraryStore.getState().setEditingCardId(null)
  }, [setNodes])

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      editingNodeIdRef.current = node.id
      if (node.type === 'card') {
        const cardId = (node.data as Record<string, unknown>)?.cardId as string | undefined
        if (cardId) {
          const libStore = useLibraryStore.getState()
          libStore.setEditingCardId(cardId)
          if (libStore.sortBy !== 'related') {
            libStore.setRightPanelActiveTab('editor')
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

  // 确保 Frame 节点排在数组最前面，DOM 先渲染 = paint 底层，背景不会覆盖卡片
  const sortedNodes = useMemo(() => {
    const frames = nodes.filter(n => n.type === 'frame')
    const others = nodes.filter(n => n.type !== 'frame')
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

  return (
    <ErrorBoundary>
    <div className={`w-full h-full bg-surface-app ${isLassoMode ? 'lasso-mode' : ''}`} ref={canvasRef} onDoubleClick={handleDoubleClick} onContextMenu={(e) => e.preventDefault()}>
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
        panOnDrag={isLassoMode ? false : [2]}
        selectionOnDrag={isLassoMode ? false : !editingCardId}
        selectionMode={SelectionMode.Partial}
        panActivationKeyCode="Space"
        onMove={onMove}
        elevateNodesOnSelect={false}
        fitView
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick={false}
        minZoom={0.1}
        maxZoom={4}
        nodeDragThreshold={3}
      >
        <AdaptiveBackground
          color={isDarkMode ? '#ffffff' : '#18181b'}
        />
        <AlignmentToolbar
          selectedNodes={alignableNodes}
          reactFlowInstance={reactFlowInstance}
          onApplyAlignment={onApplyAlignment}
          isDraggingNode={isDraggingNode}
        />
      </ReactFlow>
      <ConnectionPreview nodesRef={nodesRef} reactFlowInstance={reactFlowInstance} lastMousePosRef={lastMousePosRef} />

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