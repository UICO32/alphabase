import { useCallback, useRef, useEffect, useSyncExternalStore } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  ConnectionMode,
  SelectionMode,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type IsValidConnection,
  type ReactFlowInstance,
  addEdge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { CardNode } from './CardNode'
import { MediaNode } from './MediaNode'
import { SectionNode } from './SectionNode'
import { ConnectionEdge } from './ConnectionEdge'
import { CustomConnectionLine, setNodesRef } from './CustomConnectionLine'
import { ConnectionPreview } from './ConnectionPreview'

import { useLibraryStore } from '../../utils/libraryStore'
import { getPanelSurface } from '../../theme'
import { useWorkspaceLifecycle } from '../../hooks/useWorkspaceLifecycle'
import { useBoardSync } from '../../hooks/useBoardSync'
import { useSectionSync } from '../../hooks/useSectionSync'
import { useCanvasPaste } from '../../hooks/useCanvasPaste'
import { useDropHandler } from '../../hooks/useDropHandler'
import { connectionMediator } from '../../utils/connectionMediator'

const PROXIMITY_THRESHOLD = 60

const nodeTypes = {
  card: CardNode,
  section: SectionNode,
  media: MediaNode,
}

const edgeTypes = {
  connection: ConnectionEdge,
}

export function ReactFlowCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const editingNodeIdRef = useRef<string | null>(null)
  const isDarkMode = useLibraryStore((s) => s.isDarkMode)
  const setZoom = useLibraryStore((s) => s.setZoom)
  const surface = getPanelSurface(isDarkMode)
  const reconnectSuccessRef = useRef(false)
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null)
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null)
  const nodesRef = useRef<Node[]>(nodes)
  const edgesRef = useRef<Edge[]>(edges)

  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  useEffect(() => {
    edgesRef.current = edges
  }, [edges])

  useEffect(() => {
    setNodesRef(nodes)
  }, [nodes])

  const isConnecting = useSyncExternalStore(
    connectionMediator.subscribe.bind(connectionMediator),
    connectionMediator.isConnecting.bind(connectionMediator),
  )

  useWorkspaceLifecycle({ setNodes, setEdges, nodesRef, edgesRef })

  useBoardSync({ nodes, edges })
  useSectionSync({ nodes, setNodes })

  useCanvasPaste({ reactFlowInstance, setNodes, lastMousePosRef })

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
    }

    window.addEventListener('hepta-add-card-node', onAddCardNode)
    return () => window.removeEventListener('hepta-add-card-node', onAddCardNode)
  }, [setNodes])

  useEffect(() => {
    const onZoomIn = () => reactFlowInstance.current?.zoomIn({ duration: 200 })
    const onZoomOut = () => reactFlowInstance.current?.zoomOut({ duration: 200 })
    const onFitView = () => reactFlowInstance.current?.fitView({ duration: 200 })

    window.addEventListener('hepta-zoom-in', onZoomIn)
    window.addEventListener('hepta-zoom-out', onZoomOut)
    window.addEventListener('hepta-fit-view', onFitView)
    return () => {
      window.removeEventListener('hepta-zoom-in', onZoomIn)
      window.removeEventListener('hepta-zoom-out', onZoomOut)
      window.removeEventListener('hepta-fit-view', onFitView)
    }
  }, [])

  useEffect(() => {
    connectionMediator.onComplete((request) => {
      setEdges((eds) => {
        const edge: Edge = {
          id: `edge-${request.sourceNodeId}-${request.targetNodeId}-${Date.now()}`,
          source: request.sourceNodeId,
          target: request.targetNodeId,
          sourceHandle: request.sourceHandleId || undefined,
          targetHandle: request.targetHandleId || undefined,
          type: 'connection',
        }
        return addEdge(edge, eds)
      })
    })
  }, [setEdges])

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => {
        const edge: Edge = {
          id: `edge-${params.source}-${params.target}-${Date.now()}`,
          source: params.source!,
          target: params.target!,
          sourceHandle: params.sourceHandle ?? undefined,
          targetHandle: params.targetHandle ?? undefined,
          type: 'connection',
        }
        return addEdge(edge, eds)
      })
    },
    [setEdges],
  )

  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance
  }, [])

  const onMove = useCallback(
    (_event: any, viewport: { zoom: number }) => {
      setZoom(viewport.zoom)
    },
    [setZoom],
  )

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

  const onMouseMove = useCallback((event: React.MouseEvent) => {
    lastMousePosRef.current = { x: event.clientX, y: event.clientY }
    if (!isConnecting) return
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
      const nearestX = Math.max(screen.x, Math.min(event.clientX, screen.x + scaledW))
      const nearestY = Math.max(screen.y, Math.min(event.clientY, screen.y + scaledH))
      const dist = Math.hypot(event.clientX - nearestX, event.clientY - nearestY)
      if (dist < closestDist) {
        closestDist = dist
        closestId = node.id
      }
    }
    connectionMediator.setNearbyTarget(closestId)
  }, [isConnecting])

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      reconnectSuccessRef.current = true
      setEdges((eds) =>
        eds.map((e) =>
          e.id === oldEdge.id
            ? {
                ...e,
                source: newConnection.source!,
                target: newConnection.target!,
                sourceHandle: newConnection.sourceHandle ?? undefined,
                targetHandle: newConnection.targetHandle ?? undefined,
              }
            : e,
        ),
      )
    },
    [setEdges],
  )

  const onReconnectEnd = useCallback(
    (_event: MouseEvent | TouchEvent, edge: Edge) => {
      if (!reconnectSuccessRef.current) {
        setEdges((eds) => eds.filter((e) => e.id !== edge.id))
      }
      reconnectSuccessRef.current = false
    },
    [setEdges],
  )

  const onNodeDrag = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setEdges((eds) =>
        eds.map((e) =>
          e.source === node.id || e.target === node.id ? { ...e } : e,
        ),
      )
    },
    [setEdges],
  )

  const onNodeDragStop = useCallback(() => {
    setEdges((eds) => [...eds])
  }, [setEdges])

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

  const canvasRef = useRef<HTMLDivElement>(null)

  const onWheelZoom = useCallback(
    (event: React.WheelEvent) => {
      const instance = reactFlowInstance.current
      if (!instance) return

      const { zoom, x, y } = instance.getViewport()
      const delta = event.deltaY
      const isPinch = event.ctrlKey

      if (isPinch) return

      event.preventDefault()
      event.stopPropagation()

      const factor = delta > 0 ? 1 - 0.03 : 1 + 0.03
      const nextZoom = Math.min(4, Math.max(0.1, zoom * factor))

      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return

      const mouseX = event.clientX - rect.left
      const mouseY = event.clientY - rect.top

      const scale = nextZoom / zoom
      const nextX = mouseX - (mouseX - x) * scale
      const nextY = mouseY - (mouseY - y) * scale

      instance.setViewport({ x: nextX, y: nextY, zoom: nextZoom })
    },
    [],
  )

  return (
    <div className="w-full h-full" style={{ backgroundColor: surface.appBg }} ref={canvasRef} onWheel={onWheelZoom}>
      <ReactFlow
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
        zoomOnScroll={false}
        zoomOnPinch
        zoomOnDoubleClick={false}
        minZoom={0.1}
        maxZoom={4}
      >
        <Background
          variant={BackgroundVariant.Dots}
          color={isDarkMode ? '#ffffff' : '#18181b'}
          gap={40}
          size={1.2}
        />
      </ReactFlow>
      <ConnectionPreview nodesRef={nodesRef} reactFlowInstance={reactFlowInstance} lastMousePosRef={lastMousePosRef} />
    </div>
  )
}