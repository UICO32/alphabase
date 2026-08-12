import { lazy, Suspense, useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo } from 'react'
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
import { MultiSelectContext } from './utils/multiSelectContext'

import { ErrorBoundary } from '../ErrorBoundary'

import { CardNode } from './CardNode'
import { MediaNode } from './MediaNode'
import { FrameNode } from './FrameNode'
import { TextAnnotationNode } from './TextAnnotationNode'
import { CardEditDialog } from '../ui/CardEditDialog'
import { useViewStore } from '../../stores/viewStore'
import { useThemeStore } from '../../stores/themeStore'
import { useLibraryStore } from '../../stores/libraryStore'
import { useCardStore } from '../../stores/cardStore'
import { useBoardStore } from '../../stores/boardStore'
import { useCanvasPresenceStore } from '../../stores/canvasPresenceStore'
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
import { useFrameInteraction, exitLassoMode, setLassoRect, setLassoSelectedCardIds, exitTextToolMode, setAutoEditAnnoId } from './utils/frameInteraction'
import { CardNodeData, DEFAULT_CARD_WIDTH, DEFAULT_CARD_HEIGHT, DEFAULT_ANNOTATION_WIDTH, DEFAULT_ANNOTATION_HEIGHT, DEFAULT_ANNOTATION_CONTENT } from '../../types/card'
import { createCanvasSpatialIndex, isBoundsCenterInsideRect } from './utils/canvasSpatialIndex'
import { getVisibleCanvasEdges } from './utils/visibleCanvasEdges'
import { getDensityOverviewProgress, OVERVIEW_INTERACTION_PROGRESS } from './densityOverview/densityOverviewModel'
import { MultiSelectionScaler, MultiSelectWatcher } from './MultiSelectionScaler'
import type { BoardViewport } from '../../utils/workspace/types'

const DensityOverviewLayer = lazy(() => import('./densityOverview/DensityOverviewLayer').then(module => ({
  default: module.DensityOverviewLayer,
})))

const nodeTypes = {
  card: CardNode,
  frame: FrameNode,
  media: MediaNode,
  text: TextAnnotationNode,
}

const edgeTypes = {
  connection: MemoizedConnectionEdge,
}

export function ReactFlowCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectionForAlignment, setSelectionForAlignment] = useState<{ nodes: Node[]; edges: Edge[] }>({ nodes: [], edges: [] })
  const [densityOverviewProgress, setDensityOverviewProgress] = useState(0)
  const [densityOverviewLayerMounted, setDensityOverviewLayerMounted] = useState(false)
  const [floatingCardId, setFloatingCardId] = useState<string | null>(null)
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null)
  const editingNodeIdRef = useRef<string | null>(null)
  const isDarkMode = useIsDarkMode()
  const isLassoMode = useFrameInteraction((s) => s.lassoMode)
  const lassoRect = useFrameInteraction((s) => s.lassoRect)
  const isTextToolMode = useFrameInteraction((s) => s.textToolMode)
  const kanbanEditDialogCardId = useViewStore((s) => s.kanbanEditDialogCardId)
  const kanbanEditDialogSourceRect = useViewStore((s) => s.kanbanEditDialogSourceRect)
  const closeKanbanEditDialog = useViewStore((s) => s.closeKanbanEditDialog)
  const gridPattern = useThemeStore((s) => s.gridPattern)
  const previewZoomThreshold = useLibraryStore(s => s.previewZoomThreshold)
  const densityOverviewZoomThreshold = useLibraryStore(s => s.densityOverviewZoomThreshold)
  const boards = useBoardStore((s) => s.boards)
  const activeBoardId = useBoardStore((s) => s.activeBoardId)
  // 多选状态（>1 个选中节点）：由 ReactFlow 内部的 MultiSelectWatcher 计算
  // 并通过回调提升到这里，节点组件经 context 消费——多选时隐藏各节点
  // 自身的选中态（整体缩放框已代表选中范围）
  const [isMultiSelected, setIsMultiSelected] = useState(false)
  const handleMultiSelectChange = useCallback((v: boolean) => {
    setIsMultiSelected(prev => (prev === v ? prev : v))
  }, [])
  // 只在 fan 视图（画布还没有任何节点）订阅全量卡片；board 编辑时打字导致的
  // 内容落盘会替换 cards 引用，若常驻订阅会让整个画布每 400ms 重渲染一次。
  // 非 fan 视图返回稳定空引用，zustand 判定相等，不触发重渲染。
  const isFanView = boards.length > 0 && nodes.length === 0
  const emptyCardsRef = useRef<Record<string, GlobalCard>>({})
  const allCards = useCardStore((s) => (isFanView ? s.cards : emptyCardsRef.current))
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null)
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null)
  const nodesRef = useRef<Node[]>(nodes)
  const edgesRef = useRef<Edge[]>(edges)
  const spatialIndex = useMemo(() => createCanvasSpatialIndex(nodes), [nodes])
  const spatialIndexRef = useRef(spatialIndex)
  const presenceBoardIdRef = useRef<string | null>(null)
  const canvasViewportRef = useRef<BoardViewport | null>(null)
  const [boardViewportRequest, setBoardViewportRequest] = useState<{
    boardId: string
    viewport: BoardViewport | undefined
  } | null>(null)
  const appliedViewportBoardIdRef = useRef<string | null>(null)
  const scheduledViewportRef = useRef<{ boardId: string; raf: number } | null>(null)
  const handleBoardLoaded = useCallback((boardId: string, viewport: BoardViewport | undefined) => {
    const scheduled = scheduledViewportRef.current
    if (scheduled) {
      cancelAnimationFrame(scheduled.raf)
      scheduledViewportRef.current = null
    }
    appliedViewportBoardIdRef.current = null
    setBoardViewportRequest({ boardId, viewport })
  }, [])

  const { record, undo, redo, clear } = useHistory({ maxHistory: 20 })

  useEffect(() => { nodesRef.current = nodes }, [nodes])
  useEffect(() => { edgesRef.current = edges }, [edges])
  useEffect(() => { spatialIndexRef.current = spatialIndex }, [spatialIndex])
  useEffect(() => { setNodesRef(nodes) }, [nodes])
  useLayoutEffect(() => {
    const presenceStore = useCanvasPresenceStore.getState()
    if (!activeBoardId) {
      presenceBoardIdRef.current = null
      presenceStore.clearCanvasPresence()
      return
    }

    if (presenceBoardIdRef.current !== activeBoardId) {
      presenceBoardIdRef.current = activeBoardId
      presenceStore.clearCanvasPresence()
      return
    }

    const cardIds = new Set<string>()
    for (const node of nodes) {
      if (node.type !== 'card') continue
      const cardId = (node.data as Record<string, unknown>)?.cardId
      if (typeof cardId === 'string' && cardId) cardIds.add(cardId)
    }
    presenceStore.setCanvasPresence(activeBoardId, cardIds)
  }, [activeBoardId, nodes])

  useEffect(() => () => {
    useCanvasPresenceStore.getState().clearCanvasPresence()
  }, [])

  useWorkspaceLifecycle({
    setNodes,
    setEdges,
    nodesRef,
    edgesRef,
    viewportRef: canvasViewportRef,
    onBoardLoaded: handleBoardLoaded,
  })
  const saveViewport = useBoardSync({ nodes, edges, viewportRef: canvasViewportRef })
  useFrameSync({ nodes, setNodes })
  useCanvasPaste({ reactFlowInstance, setNodes, lastMousePosRef })

  const canvasRef = useRef<HTMLDivElement>(null)
  const densityOverviewProgressRef = useRef(0)
  const densityOverviewViewportRef = useRef<BoardViewport | null>(null)
  const densityOverviewFrameSchedulerRef = useRef<(() => void) | null>(null)
  const backgroundFrameSchedulerRef = useRef<(() => void) | null>(null)
  const nodeZoomVariablesRef = useRef(false)
  const updateVisualViewport = useCallback((viewport: BoardViewport) => {
    densityOverviewViewportRef.current = viewport
    const overviewProgress = getDensityOverviewProgress(viewport.zoom, densityOverviewZoomThreshold)
    const previewVisible = viewport.zoom <= previewZoomThreshold
    densityOverviewProgressRef.current = overviewProgress

    const canvas = canvasRef.current
    if (canvas) {
      canvas.dataset.densityOverviewProgress = overviewProgress.toFixed(3)
      const previewVisibility = String(previewVisible)
      if (canvas.dataset.zoomPreviewVisible !== previewVisibility) {
        canvas.dataset.zoomPreviewVisible = previewVisibility
      }
      // These inherited variables affect every visible card. Set them once
      // for the current committed viewport; changing them on every animation
      // frame would force a style recalculation across the whole board.
      if (!nodeZoomVariablesRef.current) {
        nodeZoomVariablesRef.current = true
        canvas.style.setProperty('--rf-inv-zoom', String(1 / viewport.zoom))
        canvas.style.setProperty('--rf-zoom', String(viewport.zoom))
      }
    }
    backgroundFrameSchedulerRef.current?.()
    densityOverviewFrameSchedulerRef.current?.()

    const library = useLibraryStore.getState()
    if (library.isZoomPreviewVisible !== previewVisible) {
      library.setZoomPreviewVisible(previewVisible)
    }

  }, [densityOverviewZoomThreshold, previewZoomThreshold])
  const settleVisualViewport = useCallback((viewport: BoardViewport) => {
    nodeZoomVariablesRef.current = false
    updateVisualViewport(viewport)
    const progress = getDensityOverviewProgress(viewport.zoom, densityOverviewZoomThreshold)
    densityOverviewProgressRef.current = progress
    const canvas = canvasRef.current
    if (canvas) {
      canvas.dataset.densityOverviewProgress = progress.toFixed(3)
      canvas.style.setProperty('--density-overview-progress', String(progress))
      canvas.style.setProperty('--rf-inv-zoom', String(1 / viewport.zoom))
      canvas.style.setProperty('--rf-zoom', String(viewport.zoom))
    }
    nodeZoomVariablesRef.current = true
    setDensityOverviewProgress(progress)
    useLibraryStore.setState({ transform: [viewport.x, viewport.y, viewport.zoom] })
    const library = useLibraryStore.getState()
    if (library.zoom !== viewport.zoom) library.setZoom(viewport.zoom)
    saveViewport(viewport)
  }, [densityOverviewZoomThreshold, saveViewport, updateVisualViewport])
  useCanvasZoom({
    canvasRef,
    reactFlowInstance,
    onViewportChange: updateVisualViewport,
    onViewportSettled: settleVisualViewport,
  })

  useEvent('focus-card', (detail) => {
    const node = nodesRef.current.find(n => (n.data as Record<string, unknown>)?.cardId === detail.cardId)
    if (node) {
      reactFlowInstance.current?.fitView({ nodes: [node], duration: 300, padding: 0.3 })
    }
  })
  const { onConnect, onReconnect, onReconnectEnd } = useCanvasConnection({ setEdges })
  const { onNodeDrag, onNodeDragStart: snapDragStart, onNodeDragStop: originalOnNodeDragStop } = useCanvasDrag({
    reactFlowInstance,
    spatialIndexRef,
    setEdges,
    setNodes,
  })
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

  const { handleDoubleClick, handleMouseDown: handleDoubleClickMouseDown } = useCanvasDoubleClick({ nodes, setNodes, reactFlowInstance, recordCurrentState, snapshotNow })

  // 隐藏 ReactFlow 默认框选矩形（使用自定义框选 UI）
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

      const selected = new Set<string>()
      const rect = { x, y, width, height }
      const candidates = spatialIndexRef.current.queryRect(rect)
      for (const item of candidates) {
        if (item.type !== 'card') continue
        if (isBoundsCenterInsideRect(item, rect)) {
          selected.add(item.id)
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

  const applyBoardViewport = useCallback(() => {
    const request = boardViewportRequest
    if (!request || request.boardId !== activeBoardId) return
    if (appliedViewportBoardIdRef.current === request.boardId) return
    if (!request.viewport && nodesRef.current.length === 0) return

    const instance = reactFlowInstance.current
    if (!instance) return

    const scheduled = scheduledViewportRef.current
    if (scheduled?.boardId === request.boardId) return

    const raf = requestAnimationFrame(() => {
      if (scheduledViewportRef.current?.raf === raf) scheduledViewportRef.current = null
      if (useBoardStore.getState().activeBoardId !== request.boardId) return
      if (!request.viewport && nodesRef.current.length === 0) return

      const saveCurrentViewport = () => {
        if (useBoardStore.getState().activeBoardId === request.boardId) {
          const viewport = instance.getViewport()
          settleVisualViewport(viewport)
        }
      }

      appliedViewportBoardIdRef.current = request.boardId
      if (request.viewport) {
        canvasViewportRef.current = request.viewport
        void instance.setViewport(request.viewport, { duration: 0 }).then(saveCurrentViewport)
      } else {
        void instance.fitView({ duration: 0, padding: 0.2 }).then(saveCurrentViewport)
      }
    })
    scheduledViewportRef.current = { boardId: request.boardId, raf }
  }, [activeBoardId, boardViewportRequest, settleVisualViewport])

  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance
    const viewport = instance.getViewport()
    updateVisualViewport(viewport)
    const progress = getDensityOverviewProgress(viewport.zoom, densityOverviewZoomThreshold)
    densityOverviewProgressRef.current = progress
    canvasRef.current?.style.setProperty('--density-overview-progress', String(progress))
    setDensityOverviewProgress(progress)
    applyBoardViewport()
  }, [applyBoardViewport, densityOverviewZoomThreshold, updateVisualViewport])

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    el.style.setProperty('--zoom-preview-threshold', String(previewZoomThreshold))
    const zoom = useLibraryStore.getState().zoom
    const previewVisible = zoom <= previewZoomThreshold
    el.dataset.zoomPreviewVisible = String(previewVisible)
    useLibraryStore.getState().setZoomPreviewVisible(previewVisible)
  }, [previewZoomThreshold])

  useEffect(() => {
    const viewport = densityOverviewViewportRef.current
      ?? reactFlowInstance.current?.getViewport()
      ?? { x: 0, y: 0, zoom: useLibraryStore.getState().zoom }
    updateVisualViewport(viewport)
  }, [densityOverviewZoomThreshold, updateVisualViewport])

  // Restore a saved board viewport, or fit new content once when no viewport exists.
  useEffect(() => {
    applyBoardViewport()
  }, [activeBoardId, applyBoardViewport, boardViewportRequest, nodes.length])

  const onMove = useCallback(
    (() => {
      let lastTransformCall = 0
      return (_event: MouseEvent | TouchEvent | null, viewport: { x: number; y: number; zoom: number }) => {
        saveViewport(viewport)
        // CSS 变量：zoom 变化时即时更新，无节流
        // ZoomPreview、缩放反比元素依赖此变量渲染，延迟会产生视觉跳变
        updateVisualViewport(viewport)
        // transform 三元组驱动较重的订阅（library、panels），100ms 节流
        const now = performance.now()
        if (now - lastTransformCall < 100) return
        lastTransformCall = now
        useLibraryStore.setState({ transform: [viewport.x, viewport.y, viewport.zoom] })
      }
    })(),
    [saveViewport, updateVisualViewport],
  )
  const onMoveEnd = useCallback(
    (_event: MouseEvent | TouchEvent | null, viewport: BoardViewport) => {
      settleVisualViewport(viewport)
    },
    [settleVisualViewport],
  )

  const onPaneClick = useCallback((event: React.MouseEvent) => {
    if (event.button !== 0) return
    if (densityOverviewProgress >= OVERVIEW_INTERACTION_PROGRESS) return

    // 文本注释工具：点击空白处放置一个文本注释节点并自动进入编辑
    if (isTextToolMode) {
      const instance = reactFlowInstance.current
      if (!instance) return
      snapshotNow()
      const position = instance.screenToFlowPosition({ x: event.clientX, y: event.clientY })
      const annoId = crypto.randomUUID()
      setNodes((nds) => [
        ...nds,
        {
          id: annoId,
          type: 'text',
          position,
          data: {
            content: DEFAULT_ANNOTATION_CONTENT,
            fontSize: 'md',
            align: 'left',
            color: 'white',
            width: DEFAULT_ANNOTATION_WIDTH,
            height: DEFAULT_ANNOTATION_HEIGHT,
          },
          style: {
            width: DEFAULT_ANNOTATION_WIDTH,
            minWidth: DEFAULT_ANNOTATION_WIDTH,
          },
          zIndex: 10,
        },
      ])
      exitTextToolMode()
      setAutoEditAnnoId(annoId)
      setTimeout(() => recordCurrentState(), 0)
      return
    }

    connectionMediator.clear()
    kanbanDragPreview.clear()
    setSelectionForAlignment({ nodes: [], edges: [] })

    // Auto-delete empty autoEdit card when clicking blank area
    const { autoEditCardId } = useViewStore.getState()
    if (autoEditCardId) {
      useViewStore.getState().setAutoEditCardId(null)
      const cardData = useCardStore.getState().cards[autoEditCardId]
      if (cardData) {
        emit('remove-card-from-board', { cardId: autoEditCardId, cardContent: cardData })
      }
      useCardStore.getState().deleteCard(autoEditCardId)
      setNodes((nds) => nds.filter((n) => n.id !== autoEditCardId).map((n) => ({ ...n, selected: false })))
      setEdges((eds) => eds.filter((e) => e.source !== autoEditCardId && e.target !== autoEditCardId))
    } else {
      setNodes((nds) => nds.map((n) => ({ ...n, selected: false })))
    }

    editingNodeIdRef.current = null
    useViewStore.getState().setEditingCardId(null)
    useLibraryStore.getState().exitRelatedSort()

    // Clicking canvas blank area should deselect left panel tabs (boardLibrary/cards → board)
    const currentViewMode = useViewStore.getState().viewMode
    if (currentViewMode !== 'board') {
      useViewStore.getState().setViewMode('board')
    }
  }, [densityOverviewProgress, setNodes, setEdges, isTextToolMode, snapshotNow, recordCurrentState])

  const handleActivateCardEditor = useCallback((cardId: string) => {
    const viewState = useViewStore.getState()
    if (viewState.editingCardId !== cardId) {
      viewState.setEditingCardId(cardId)
    }
  }, [])

  const onSelectionChange = useCallback(({ nodes: selectedNodes, edges: selectedEdges }: { nodes: Node[]; edges: Edge[] }) => {
    if (selectedNodes.length > 0 && selectedEdges.length > 0) {
      const selectedEdgeIds = new Set(selectedEdges.map(e => e.id))
      setEdges(eds => eds.map(e => (
        selectedEdgeIds.has(e.id) ? { ...e, selected: false } : e
      )))
      setSelectionForAlignment({ nodes: selectedNodes, edges: [] })
    } else {
      setSelectionForAlignment({ nodes: selectedNodes, edges: selectedEdges })
    }

    const card = selectedNodes.find(n => n.type === 'card')
    if (card) {
      const cardId = (card.data as Record<string, unknown>)?.cardId as string | undefined
      if (cardId) handleActivateCardEditor(cardId)
    }
  }, [handleActivateCardEditor, setEdges])

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (densityOverviewProgress >= OVERVIEW_INTERACTION_PROGRESS) return
      editingNodeIdRef.current = node.id
      if (node.type === 'card') {
        const cardId = (node.data as Record<string, unknown>)?.cardId as string | undefined
        if (cardId) handleActivateCardEditor(cardId)
      }
    },
    [densityOverviewProgress, handleActivateCardEditor],
  )

  const onMouseMove = useCallback((event: React.MouseEvent) => {
    lastMousePosRef.current = { x: event.clientX, y: event.clientY }
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
  const selectedNodesForAlignment = useMemo(() => {
    if (isDraggingNode) return []
    const nodeIds = new Set(nodes.map(n => n.id))
    return selectionForAlignment.nodes.filter(n => nodeIds.has(n.id))
  }, [isDraggingNode, nodes, selectionForAlignment.nodes])
  const selectedEdgesForAlignment = useMemo(() => {
    if (isDraggingNode) return []
    const edgeIds = new Set(edges.map(e => e.id))
    return selectionForAlignment.edges.filter(e => edgeIds.has(e.id))
  }, [edges, isDraggingNode, selectionForAlignment.edges])

  // 多选整体缩放：组件内部从 store 订阅选中节点（card/media/text），
  // 实时跟随节点尺寸变化（拖动缩放/图片加载等）
  const handleMultiScaleStart = useCallback(() => {
    record({
      nodes: nodesRef.current.map(n => ({ ...n })),
      edges: edgesRef.current.map(e => ({ ...e })),
    })
  }, [record])

  const handleMultiScaleEnd = useCallback(() => {
    record({
      nodes: nodesRef.current.map(n => ({ ...n })),
      edges: edgesRef.current.map(e => ({ ...e })),
    })
  }, [record])

  const onApplyAlignment = useCallback((updates: Map<string, { x: number; y: number }>) => {
    if (recordTimerRef.current) {
      clearTimeout(recordTimerRef.current)
      recordTimerRef.current = null
    }
    const currentNodes = nodesRef.current.map(n => ({ ...n }))
    const currentEdges = edgesRef.current.map(e => ({ ...e }))
    const nextNodes = currentNodes.map((n) => {
      const pos = updates.get(n.id)
      if (!pos) return n
      return { ...n, position: { x: pos.x, y: pos.y } }
    })

    setNodes(nextNodes)
    // Record the pre-alignment state for undo
    record({
      nodes: currentNodes,
      edges: currentEdges,
    })
    record({
      nodes: nextNodes,
      edges: currentEdges,
    })
  }, [setNodes, record])

  const onApplyScale = useCallback((updates: Map<string, { x: number; y: number; width: number; height: number }>) => {
    if (recordTimerRef.current) {
      clearTimeout(recordTimerRef.current)
      recordTimerRef.current = null
    }
    const currentNodes = nodesRef.current.map(n => ({ ...n }))
    const currentEdges = edgesRef.current.map(e => ({ ...e }))
    const nextNodes = currentNodes.map((n) => {
      const pos = updates.get(n.id)
      if (!pos) return n
      return { ...n, position: { x: pos.x, y: pos.y }, width: pos.width, height: pos.height }
    })

    setNodes(nextNodes)
    record({ nodes: currentNodes, edges: currentEdges })
    record({ nodes: nextNodes, edges: currentEdges })
  }, [setNodes, record])

  // 看板 Frame 内的卡片之间隐藏连接线
  const visibleEdges = useMemo(() => getVisibleCanvasEdges(nodes, edges), [nodes, edges])
  const densityOverviewInteractive = densityOverviewProgress >= OVERVIEW_INTERACTION_PROGRESS

  const densityOverviewLayerMountedRef = useRef(false)
  useEffect(() => {
    if (densityOverviewProgress > 0) {
      if (!densityOverviewLayerMountedRef.current) {
        densityOverviewLayerMountedRef.current = true
        setDensityOverviewLayerMounted(true)
      }
      return
    }
    if (!densityOverviewLayerMountedRef.current) return
    const timer = window.setTimeout(() => {
      densityOverviewLayerMountedRef.current = false
      setDensityOverviewLayerMounted(false)
    }, 240)
    return () => window.clearTimeout(timer)
  }, [densityOverviewProgress])

  useEffect(() => {
    if (!densityOverviewInteractive) return
    if (isLassoMode) exitLassoMode()
    if (isTextToolMode) exitTextToolMode()
  }, [densityOverviewInteractive, isLassoMode, isTextToolMode])

  const focusDensitySourceNode = useCallback((nodeId: string) => {
    const node = nodesRef.current.find(candidate => candidate.id === nodeId)
    if (!node) return
    reactFlowInstance.current?.fitView({ nodes: [node], duration: 350, padding: 0.35, maxZoom: 1.15 })
  }, [])

  const suggestedCards = useMemo(() => {
    const boardCardIds = new Set(
      nodes
        .map(node => (node.data as Record<string, unknown>)?.cardId)
        .filter((cardId): cardId is string => typeof cardId === 'string'),
    )

    return Object.values(allCards)
      .filter(card => !card.deletedAt && !boardCardIds.has(card.id))
      .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))
      .slice(0, 5)
  }, [nodes, allCards])

  const fanCardsVisible = isFanView && suggestedCards.length > 0

  const suggestedCardIdsRef = useRef<string[]>([])
  useEffect(() => {
    const ids = suggestedCards.map(card => card.id)
    if (
      ids.length === suggestedCardIdsRef.current.length &&
      ids.every((id, index) => id === suggestedCardIdsRef.current[index])
    ) {
      return
    }

    suggestedCardIdsRef.current = ids
    const missing = suggestedCards
      .filter(card => !card.previewHTML && card.content)
      .map(card => card.id)

    if (missing.length === 0) return

    const scheduleIdle = window.requestIdleCallback ?? ((callback: IdleRequestCallback) => {
      const id = window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 0 }), 1)
      return id as unknown as number
    })
    const cancelIdle = window.cancelIdleCallback ?? window.clearTimeout
    const idleId = scheduleIdle(() => {
      useCardStore.getState().ensurePreviewHTMLBatch(missing)
    })

    return () => cancelIdle(idleId)
  }, [suggestedCards])

  const editingCardId = useViewStore(s => s.editingCardId)

  // 编辑中的卡片抬升 zIndex，使工具栏/悬浮 UI 不被其他卡片遮挡
  const prevEditingCardIdRef = useRef<string | null>(null)
  useEffect(() => {
    const prev = prevEditingCardIdRef.current
    prevEditingCardIdRef.current = editingCardId ?? null
    if (prev === (editingCardId ?? null)) return
    setNodes(nds => nds.map(n => {
      const cardId = (n.data as Record<string, unknown>)?.cardId as string | undefined
      if (cardId === editingCardId) return { ...n, zIndex: 1000 }
      if (cardId === prev && n.zIndex === 1000) return { ...n, zIndex: 10 }
      return n
    }))
  }, [editingCardId, setNodes])

  return (
    <ErrorBoundary>
		    <div
          className={`density-overview-enabled ${densityOverviewInteractive ? 'density-overview-interactive' : ''} w-full h-full bg-surface-app ${isLassoMode ? 'lasso-mode' : ''} ${isTextToolMode ? 'text-tool-mode' : ''}`}
          ref={canvasRef}
          data-density-overview-progress={densityOverviewProgress.toFixed(3)}
          data-density-overview-threshold={densityOverviewZoomThreshold.toFixed(3)}
          onMouseDown={handleDoubleClickMouseDown}
          onDoubleClick={densityOverviewInteractive ? undefined : handleDoubleClick}
          onContextMenu={(e) => e.preventDefault()}
        >
	      <MultiSelectContext.Provider value={isMultiSelected}>
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
        panOnDrag={densityOverviewInteractive ? true : (isLassoMode ? false : fanCardsVisible ? false : [2])}
        selectionOnDrag={!densityOverviewInteractive && !isLassoMode}
        selectionMode={SelectionMode.Partial}
        nodesDraggable={!densityOverviewInteractive}
        nodesConnectable={!densityOverviewInteractive}
        elementsSelectable={!densityOverviewInteractive}
        panActivationKeyCode="Space"
        onMove={onMove}
        onMoveEnd={onMoveEnd}
        elevateNodesOnSelect={false}
        zoomOnScroll={true}
        zoomOnPinch={true}
        zoomOnDoubleClick={false}
        minZoom={0.1}
        maxZoom={4}
        nodeDragThreshold={3}
        >
        <AdaptiveBackground
          color={isDarkMode ? '#ffffff' : '#18181b'}
          pattern={gridPattern}
          visualViewportRef={densityOverviewViewportRef}
          frameSchedulerRef={backgroundFrameSchedulerRef}
        />
        {densityOverviewLayerMounted && (
          <Suspense fallback={null}>
            <DensityOverviewLayer
              nodes={nodes}
              edges={visibleEdges}
              progress={densityOverviewProgress}
              progressRef={densityOverviewProgressRef}
              viewportRef={densityOverviewViewportRef}
              frameSchedulerRef={densityOverviewFrameSchedulerRef}
              isDarkMode={isDarkMode}
              onFocusNode={focusDensitySourceNode}
            />
          </Suspense>
        )}
        <AlignmentToolbar
          selectedNodes={selectedNodesForAlignment}
          selectedEdges={selectedEdgesForAlignment}
          reactFlowInstance={reactFlowInstance}
          onApplyAlignment={onApplyAlignment}
          onApplyScale={onApplyScale}
          isDraggingNode={isDraggingNode}
        />
        <MultiSelectWatcher onChange={handleMultiSelectChange} />
        <MultiSelectionScaler
          onScaleStart={handleMultiScaleStart}
          onScaleEnd={handleMultiScaleEnd}
        />
        </ReactFlow>
      </MultiSelectContext.Provider>
      <ConnectionPreview spatialIndexRef={spatialIndexRef} reactFlowInstance={reactFlowInstance} lastMousePosRef={lastMousePosRef} />

      {boards.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center select-none pointer-events-none" style={{ zIndex: 5 }}>
          <svg width="320" height="200" viewBox="0 0 320 200" fill="none" className="mb-6 opacity-40" style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.06))' }} aria-hidden>
            <rect x="20" y="50" width="100" height="80" rx="10" fill="var(--surface-card)" stroke="var(--line-default)" strokeWidth="1.5" />
            <rect x="34" y="64" width="48" height="6" rx="3" fill="var(--fg-tertiary)" opacity="0.4" />
            <rect x="34" y="78" width="72" height="4" rx="2" fill="var(--fg-quaternary)" opacity="0.25" />
            <rect x="34" y="88" width="56" height="4" rx="2" fill="var(--fg-quaternary)" opacity="0.25" />
            <path d="M120 90 C145 70, 155 70, 180 90" stroke="var(--line-default)" strokeWidth="1.5" fill="none" strokeDasharray="4 3" opacity="0.5" />
            <circle cx="180" cy="90" r="3" fill="var(--brand)" opacity="0.5" />
            <rect x="185" y="50" width="100" height="80" rx="10" fill="var(--surface-card)" stroke="var(--line-default)" strokeWidth="1.5" />
            <rect x="199" y="64" width="60" height="6" rx="3" fill="var(--fg-tertiary)" opacity="0.4" />
            <rect x="199" y="78" width="72" height="4" rx="2" fill="var(--fg-quaternary)" opacity="0.25" />
            <path d="M285 90 C300 120, 70 140, 55 160" stroke="var(--line-default)" strokeWidth="1.5" fill="none" strokeDasharray="4 3" opacity="0.5" />
            <circle cx="55" cy="160" r="3" fill="var(--brand)" opacity="0.5" />
            <rect x="10" y="145" width="90" height="50" rx="10" fill="var(--surface-card)" stroke="var(--line-default)" strokeWidth="1.5" />
            <rect x="24" y="159" width="40" height="5" rx="2.5" fill="var(--fg-tertiary)" opacity="0.4" />
          </svg>
          <h3 className="text-base font-medium text-fg-secondary mb-1.5">开始你的知识探索</h3>
          <p className="text-xs text-fg-tertiary mb-5 max-w-[280px] text-center leading-relaxed">
            创建不同的画布来组织你的主题，<br />在画布上建立卡片和连接
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

      {fanCardsVisible && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ zIndex: 1 }}>
          <p className="text-xs text-fg-secondary mb-5">拖拽或点击卡片添加到画布</p>
          <div className="flex items-end justify-center pointer-events-auto" style={{ perspective: '800px' }}>
            {suggestedCards.map((card, index) => {
              const total = suggestedCards.length
              const offset = index - (total - 1) / 2
              const fanRotation = total <= 4 ? 9 : 7
              const previewHTML = card.previewHTML || useCardStore.getState().getPreviewHTML(card.id) || ''
              const sanitizedHTML = DOMPurify.sanitize(previewHTML, {
                ALLOWED_URI_REGEXP: /^(?:(?:hepta-media|https?|mailto|tel|data):|[^a-zA-Z]|[^a-zA-Z]javascript:)/i,
                ADD_URI_SAFE_ATTR: ['type'],
              }).replace(/<img[^>]*>/gi, '')
              const isFloating = floatingCardId === card.id
              const isHovered = hoveredCardId === card.id
              const fanTransform = `rotate(${offset * fanRotation}deg) translateY(${Math.abs(offset) * 10}px)`
              const hoverTransform = `rotate(${offset * 2}deg) translateY(-8px) translateX(${offset * 6}px) scale(1.06)`

              return (
                <div
                  key={card.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData('application/json', JSON.stringify({
                      type: 'card',
                      cardId: card.id,
                      isNewInstance: event.altKey,
                    }))
                    event.dataTransfer.effectAllowed = 'copy'
                    setFloatingCardId(card.id)
                  }}
                  onDragEnd={() => setFloatingCardId(null)}
                  onMouseEnter={() => { if (!floatingCardId) setHoveredCardId(card.id) }}
                  onMouseLeave={() => setHoveredCardId(null)}
                  onClick={() => {
                    const instance = reactFlowInstance.current
                    if (!instance) return
                    snapshotNow()
                    const center = instance.screenToFlowPosition({
                      x: window.innerWidth / 2,
                      y: window.innerHeight / 2,
                    })
                    setNodes(currentNodes => [
                      ...currentNodes,
                      {
                        id: crypto.randomUUID(),
                        type: 'card',
                        position: { x: center.x + index * 20, y: center.y + index * 20 },
                        data: {
                          cardId: card.id,
                          color: card.color || 'white',
                          width: DEFAULT_CARD_WIDTH,
                          height: DEFAULT_CARD_HEIGHT,
                        },
                        zIndex: 10,
                        className: 'card-node-landing',
                      },
                    ])
                    setTimeout(() => recordCurrentState(), 0)
                  }}
                  aria-label={`将卡片「${card.title || '无标题'}」添加到画布`}
                  className={`suggested-card group flex flex-col bg-surface-card border border-line-default rounded-xl cursor-pointer overflow-hidden ${isFloating ? 'suggested-card-floating' : ''}`}
                  style={{
                    '--fan-index': index,
                    width: 130,
                    aspectRatio: '3/4',
                    marginLeft: index === 0 ? 0 : -(130 * 0.03),
                    ...(isFloating ? {} : {
                      transform: isHovered ? hoverTransform : fanTransform,
                      transformOrigin: 'bottom center',
                      zIndex: isHovered ? 999 : total - Math.abs(Math.round(offset)),
                      boxShadow: isHovered
                        ? 'var(--shadow-lg), 0 0 0 1px color-mix(in srgb, var(--brand) 18%, transparent)'
                        : 'var(--shadow-md)',
                    }),
                  } as React.CSSProperties}
                >
                  <div className="p-2.5 flex flex-col flex-1 min-h-0 overflow-hidden">
                    <div className="text-[11px] font-medium text-fg-primary truncate mb-1">{card.title || '无标题'}</div>
                    <div
                      className="min-h-0 flex-1 overflow-hidden text-[10px] leading-relaxed text-fg-secondary"
                      style={{ WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)', maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)' }}
                      dangerouslySetInnerHTML={{ __html: sanitizedHTML || '无内容' }}
                    />
                  </div>
                  <div className={`absolute inset-0 rounded-xl transition-opacity duration-200 pointer-events-none flex items-center justify-center bg-surface-hover ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
                    <span className="text-[10px] text-fg-secondary bg-surface-panel/90 px-2 py-0.5 rounded shadow-sm">拖拽或点击放置</span>
                  </div>
                </div>
              )
            })}
          </div>
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
