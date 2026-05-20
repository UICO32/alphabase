import { useCallback, useRef, useEffect, useSyncExternalStore, useMemo } from 'react'
import {
  ReactFlow,
  ConnectionMode,
  SelectionMode,
  useNodesState,
  useEdgesState,
  useStore,
  type Node,
  type Edge,
  type Connection,
  type IsValidConnection,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { CardNode } from './CardNode'
import { MediaNode } from './MediaNode'
import { SectionNode } from './SectionNode'
import { MemoizedConnectionEdge } from './ConnectionEdge'
import { CustomConnectionLine, setNodesRef } from './CustomConnectionLine'
import { AdaptiveBackground } from './AdaptiveBackground'
import { ConnectionPreview } from './ConnectionPreview'

import { useIsDarkMode } from '../../hooks/useIsDarkMode'
import { usePanelSurface } from '../../hooks/usePanelSurface'
import { useLibraryStore } from '../../stores/libraryStore'
import { useWorkspaceLifecycle } from '../../hooks/useWorkspaceLifecycle'
import { useBoardSync } from '../../hooks/useBoardSync'
import { useSectionSync } from '../../hooks/useSectionSync'
import { useCanvasPaste } from '../../hooks/useCanvasPaste'
import { useDropHandler } from '../../hooks/useDropHandler'
import { useCanvasZoom } from '../../hooks/useCanvasZoom'
import { useCanvasConnection } from '../../hooks/useCanvasConnection'
import { useCanvasDrag } from '../../hooks/useCanvasDrag'
import { useHistory } from '../../hooks/useHistory'
import { useCanvasKeyboard } from '../../hooks/useCanvasKeyboard'
import { connectionMediator } from '../../utils/connectionMediator'

const PROXIMITY_THRESHOLD = 60
const VIEWPORT_BUFFER = 500

function useViewportCulling(nodes: Node[], edges: Edge[]) {
  const transform = useStore((s) => s.transform)
  const [tx, ty, zoom] = transform
  const visibleNodes = useMemo(() => {
    if (nodes.length === 0) return nodes
    const viewWidth = window.innerWidth
    const viewHeight = window.innerHeight
    const buffer = VIEWPORT_BUFFER / zoom
    const left = -tx / zoom - buffer
    const top = -ty / zoom - buffer
    const right = left + viewWidth / zoom + buffer * 2
    const bottom = top + viewHeight / zoom + buffer * 2

    return nodes.filter((node) => {
      const w = ((node.data as Record<string, unknown>).width as number) ?? 280
      const h = ((node.data as Record<string, unknown>).height as number) ?? 200
      const nodeRight = node.position.x + w
      const nodeBottom = node.position.y + h
      return (
        node.position.x < right &&
        nodeRight > left &&
        node.position.y < bottom &&
        nodeBottom > top
      )
    })
  }, [nodes, tx, ty, zoom])

  const visibleNodeIds = useMemo(
    () => new Set(visibleNodes.map((n) => n.id)),
    [visibleNodes],
  )

  const visibleEdges = useMemo(
    () => edges.filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)),
    [edges, visibleNodeIds],
  )

  return { visibleNodes, visibleEdges }
}

const nodeTypes = {
  card: CardNode,
  section: SectionNode,
  media: MediaNode,
}

const edgeTypes = {
  connection: MemoizedConnectionEdge,
}

interface ReactFlowInnerProps {
  nodes: Node[]
  edges: Edge[]
  onNodesChange: ReturnType<typeof useNodesState<Node>>[2]
  onEdgesChange: ReturnType<typeof useEdgesState<Edge>>[2]
  onConnect: (connection: Connection) => void
  onInit: (instance: ReactFlowInstance) => void
  onPaneClick: () => void
  onNodeClick: (event: React.MouseEvent, node: Node) => void
  onMouseMove: (event: React.MouseEvent) => void
  onNodeDrag: (event: React.MouseEvent, node: Node, nodes: Node[]) => void
  onNodeDragStop: (event: React.MouseEvent, node: Node, nodes: Node[]) => void
  onReconnect: (oldEdge: Edge, newConnection: Connection) => void
  onReconnectEnd: (event: MouseEvent | TouchEvent, edge: Edge) => void
  onDragOver: (event: React.DragEvent) => void
  onDrop: (event: React.DragEvent) => void
  connectionLineComponent: (props: any) => React.JSX.Element
  isValidConnection: IsValidConnection
  onMove: (event: any, viewport: { zoom: number }) => void
  isDarkMode: boolean
}

function ReactFlowInner({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onInit,
  onPaneClick,
  onNodeClick,
  onMouseMove,
  onNodeDrag,
  onNodeDragStop,
  onReconnect,
  onReconnectEnd,
  onDragOver,
  onDrop,
  connectionLineComponent,
  isValidConnection,
  onMove,
  isDarkMode,
}: ReactFlowInnerProps) {
  const { visibleNodes, visibleEdges } = useViewportCulling(nodes, edges)

  return (
    <ReactFlow
      nodes={visibleNodes}
      edges={visibleEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onInit={onInit}
      onPaneClick={onPaneClick}
      onNodeClick={onNodeClick}
      onMouseMove={onMouseMove}
      onNodeDrag={onNodeDrag}
      onNodeDragStop={onNodeDragStop}
      onReconnect={(oldEdge, newConn) => onReconnect(oldEdge, newConn)}
      onReconnectEnd={(e, edge) => onReconnectEnd(e, edge)}
      onDragOver={onDragOver}
      onDrop={onDrop}
      edgesReconnectable
      connectionMode={ConnectionMode.Loose}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      connectionLineComponent={connectionLineComponent}
      isValidConnection={isValidConnection}
      autoPanOnNodeDrag={false}
      panOnDrag={[2]}
      selectionOnDrag
      selectionMode={SelectionMode.Partial}
      panActivationKeyCode="Space"
      onMove={onMove}
      fitView
      zoomOnScroll
      zoomOnPinch
      zoomOnDoubleClick={false}
      minZoom={0.1}
      maxZoom={4}
    >
      <AdaptiveBackground
        color={isDarkMode ? '#ffffff' : '#18181b'}
      />
    </ReactFlow>
  )
}

export function ReactFlowCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const editingNodeIdRef = useRef<string | null>(null)
  const isDarkMode = useIsDarkMode()
  const setZoom = useLibraryStore((s) => s.setZoom)
  const surface = usePanelSurface()
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null)
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null)
  const nodesRef = useRef<Node[]>(nodes)
  const edgesRef = useRef<Edge[]>(edges)

  const { canUndo, canRedo, record, undo, redo, clear } = useHistory({ maxHistory: 20 })

  useEffect(() => { nodesRef.current = nodes }, [nodes])
  useEffect(() => { edgesRef.current = edges }, [edges])
  useEffect(() => { setNodesRef(nodes) }, [nodes])
  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  const isConnecting = useSyncExternalStore(
    connectionMediator.subscribe.bind(connectionMediator),
    connectionMediator.isConnecting.bind(connectionMediator),
  )

  useWorkspaceLifecycle({ setNodes, setEdges, nodesRef, edgesRef })
  useBoardSync({ nodes, edges })
  useSectionSync({ nodes, setNodes })
  useCanvasPaste({ reactFlowInstance, setNodes, lastMousePosRef })

  const canvasRef = useRef<HTMLDivElement>(null)
  useCanvasZoom({ canvasRef, reactFlowInstance })
  const { onConnect, onReconnect, onReconnectEnd } = useCanvasConnection({ setEdges })
  const { onNodeDrag, onNodeDragStop: originalOnNodeDragStop } = useCanvasDrag({ reactFlowInstance, setEdges })

  const recordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const recordCurrentState = useCallback((type: 'canvas' | 'structure', description: string) => {
    if (recordTimerRef.current) {
      clearTimeout(recordTimerRef.current)
    }
    recordTimerRef.current = setTimeout(() => {
      record({
        type,
        description,
        nodes: nodesRef.current.map(n => ({ ...n })),
        edges: edgesRef.current.map(e => ({ ...e })),
      })
    }, 300)
  }, [record])

  const onNodeDragStop = useCallback((_event: React.MouseEvent, _node: Node, _nodes: Node[]) => {
    originalOnNodeDragStop()
    recordCurrentState('canvas', '移动卡片')
  }, [originalOnNodeDragStop, recordCurrentState])

  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = '.react-flow__nodesselection-rect{display:none!important}'
    document.head.appendChild(style)
    return () => { document.head.removeChild(style) }
  }, [])

  const { handleDragOver, handleDrop } = useDropHandler({ reactFlowInstance, setNodes })

  useEffect(() => {
    const onAddCardNode = (e: Event) => {
      const { cardId, color } = (e as CustomEvent).detail
      const instance = reactFlowInstance.current
      if (!instance) return
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
          data: { cardId, color, width: 280, height: 200 },
        },
      ])
      // Record after state update
      setTimeout(() => {
        recordCurrentState('structure', '添加卡片')
      }, 0)
    }
    window.addEventListener('hepta-add-card-node', onAddCardNode)
    return () => window.removeEventListener('hepta-add-card-node', onAddCardNode)
  }, [setNodes, recordCurrentState])

  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance
  }, [])

  const onMove = useCallback(
    (_event: any, viewport: { zoom: number }) => {
      setZoom(viewport.zoom)
    },
    [setZoom],
  )

  useCanvasKeyboard({ undo, redo, setNodes, setEdges, clear })

  const onPaneClick = useCallback(() => {
    connectionMediator.clear()
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        selected: false,
      })),
    )
    editingNodeIdRef.current = null
  }, [setNodes])

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      editingNodeIdRef.current = node.id
      if (node.type === 'card') {
        const cardId = (node.data as Record<string, unknown>)?.cardId as string | undefined
        if (cardId) {
          const libStore = useLibraryStore.getState()
          libStore.setEditingCardId(cardId)
          libStore.setRightPanelActiveTab('editor')
        }
      }
    },
    [],
  )

  const rafRef = useRef<number | null>(null)
  const pendingMouseEventRef = useRef<React.MouseEvent | null>(null)

  const onMouseMove = useCallback((event: React.MouseEvent) => {
    lastMousePosRef.current = { x: event.clientX, y: event.clientY }
    if (!isConnecting) return
    // Store the latest mouse event and schedule a single RAF
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
  }, [isConnecting])

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

  return (
    <div className="w-full h-full" style={{ backgroundColor: surface.appBg }} ref={canvasRef}>
      <ReactFlowInner
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={onInit}
        onPaneClick={onPaneClick}
        onNodeClick={onNodeClick}
        onMouseMove={onMouseMove}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onReconnect={onReconnect}
        onReconnectEnd={onReconnectEnd}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        connectionLineComponent={connectionLineComponent}
        isValidConnection={isValidConnection}
        onMove={onMove}
        isDarkMode={isDarkMode}
      />
      <ConnectionPreview nodesRef={nodesRef} reactFlowInstance={reactFlowInstance} lastMousePosRef={lastMousePosRef} />

      {/* Undo/Redo Status Indicator */}
      {(canUndo || canRedo) && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium pointer-events-none"
          style={{
            backgroundColor: surface.surface,
            color: surface.muted,
            border: `1px solid ${surface.divider}`,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            zIndex: 10,
          }}
        >
          <span className={canUndo ? 'opacity-100' : 'opacity-40'}>
            Ctrl+Z 撤销
          </span>
          <span style={{ color: surface.divider }}>|</span>
          <span className={canRedo ? 'opacity-100' : 'opacity-40'}>
            Ctrl+Shift+Z 重做
          </span>
        </div>
      )}
    </div>
  )
}
