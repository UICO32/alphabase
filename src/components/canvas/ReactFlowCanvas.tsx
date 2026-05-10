import { useCallback, useRef, useEffect, useState, useSyncExternalStore } from 'react'
import {
  ReactFlow,
  Controls,
  ConnectionMode,
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
import { DotPatternBackground } from './DotPatternBackground'

import { useLibraryStore } from '../../utils/libraryStore'
import { getPanelSurface } from '../../theme/panelSurface'
import { useWorkspaceLifecycle } from '../../hooks/useWorkspaceLifecycle'
import { useBoardSync } from '../../hooks/useBoardSync'
import { useSectionSync } from '../../hooks/useSectionSync'
import { useCanvasPaste } from '../../hooks/useCanvasPaste'
import { useDropHandler } from '../../hooks/useDropHandler'
import { connectionMediator } from '../../utils/connectionMediator'

const PROXIMITY_THRESHOLD = 60

function edgePointOnRect(
  rx: number, ry: number, rw: number, rh: number,
  cx: number, cy: number,
): { x: number; y: number } {
  const centerX = rx + rw / 2
  const centerY = ry + rh / 2
  const dx = cx - centerX
  const dy = cy - centerY
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)
  if (absDx * rh > absDy * rw) {
    return { x: dx > 0 ? rx + rw : rx, y: centerY }
  }
  return { x: centerX, y: dy > 0 ? ry + rh : ry }
}

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
  const surface = getPanelSurface(isDarkMode)
  const reconnectSuccessRef = useRef(false)
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null)
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null)
  const nodesRef = useRef<Node[]>(nodes)

  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  useEffect(() => {
    setNodesRef(nodes)
  }, [nodes])

  const isConnecting = useSyncExternalStore(
    connectionMediator.subscribe.bind(connectionMediator),
    connectionMediator.isConnecting.bind(connectionMediator),
  )
  const [previewLine, setPreviewLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)

  // 连接线预览：用 rAF 持续更新
  useEffect(() => {
    if (!isConnecting) {
      setPreviewLine(null)
      return
    }
    let raf = 0
    const tick = () => {
      const pending = connectionMediator.getPending()
      const rf = reactFlowInstance.current
      const mouse = lastMousePosRef.current
      if (!pending || !rf || !mouse) {
        raf = requestAnimationFrame(tick)
        return
      }
      const srcNode = nodesRef.current.find((n) => n.id === pending.sourceNodeId)
      if (!srcNode) {
        raf = requestAnimationFrame(tick)
        return
      }
      const w = ((srcNode.data as Record<string, unknown>).width as number) ?? 280
      const h = ((srcNode.data as Record<string, unknown>).height as number) ?? 200
      const zoom = rf.getViewport().zoom
      // 源卡片在屏幕上的位置
      const srcScreen = rf.flowToScreenPosition(srcNode.position)
      const scaledW = w * zoom
      const scaledH = h * zoom
      const srcEdge = edgePointOnRect(srcScreen.x, srcScreen.y, scaledW, scaledH, mouse.x, mouse.y)
      setPreviewLine({ x1: srcEdge.x, y1: srcEdge.y, x2: mouse.x, y2: mouse.y })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isConnecting])

  useWorkspaceLifecycle({ setNodes, setEdges, nodesRef })
  useBoardSync({ nodes, edges })
  useSectionSync({ nodes, setNodes })

  useCanvasPaste({ reactFlowInstance, setNodes, lastMousePosRef })
  const { handleDragOver, handleDrop } = useDropHandler({ reactFlowInstance, setNodes })

  useEffect(() => {
    const onAddCardNode = (e: Event) => {
      const { cardId, color, variant } = (e as CustomEvent).detail
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
          data: { cardId, color, variant, width: 280, height: 200 },
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
          sourceHandle: request.sourceHandleId,
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
    // 连接模式下检测光标是否接近某卡片
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

  return (
    <div className="w-full h-full" style={{ backgroundColor: surface.appBg }}>
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
        translateExtent={[[-2000, -2000], [2000, 2000]]}
        fitView
      >
        <DotPatternBackground />
        <Controls />
      </ReactFlow>
      {/* 连接线预览 SVG */}
      {previewLine && (
        <svg
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            pointerEvents: 'none',
            zIndex: 9999,
          }}
        >
          <defs>
            <marker
              id="preview-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" />
            </marker>
          </defs>
          <line
            x1={previewLine.x1}
            y1={previewLine.y1}
            x2={previewLine.x2}
            y2={previewLine.y2}
            stroke="#3b82f6"
            strokeWidth={2}
            strokeDasharray="6,4"
            markerEnd="url(#preview-arrow)"
          />
        </svg>
      )}
    </div>
  )
}
