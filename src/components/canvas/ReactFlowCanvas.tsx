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
  type NodeChange,
  type EdgeChange,
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
import { useHistory } from '../../hooks/useHistory'
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

  const { canUndo, canRedo, record, undo, redo, clear } = useHistory({ maxHistory: 20 })
  const recordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const recordCurrentState = useCallback((type: 'canvas' | 'structure', description: string, immediate = false) => {
    console.log('[ReactFlowCanvas] recordCurrentState called:', { type, description, immediate, currentNodes: nodesRef.current.length, currentEdges: edgesRef.current.length })
    if (recordTimerRef.current) {
      clearTimeout(recordTimerRef.current)
      recordTimerRef.current = null
    }

    const doRecord = () => {
      console.log('[ReactFlowCanvas] recording state:', { type, description, nodes: nodesRef.current.length, edges: edgesRef.current.length })
      record({
        type,
        description,
        nodes: nodesRef.current.map(n => ({ ...n })),
        edges: edgesRef.current.map(e => ({ ...e })),
      })
    }

    if (immediate) {
      doRecord()
    } else {
      recordTimerRef.current = setTimeout(doRecord, 300)
    }
  }, [record])

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

  // Record initial canvas state after data is loaded
  useEffect(() => {
    const handleDataReady = () => {
      // Wait for nodes/edges to be set
      setTimeout(() => {
        console.log('[ReactFlowCanvas] Recording initial canvas state')
        recordCurrentState('canvas', '初始状态', true)
      }, 100)
    }
    window.addEventListener('hepta-data-ready', handleDataReady)
    return () => window.removeEventListener('hepta-data-ready', handleDataReady)
  }, [recordCurrentState])

  useCanvasPaste({ reactFlowInstance, setNodes, lastMousePosRef })

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    const hasRemove = changes.some(c => c.type === 'remove')
    onNodesChange(changes)
    if (hasRemove) {
      setTimeout(() => {
        recordCurrentState('structure', '删除节点', true)
      }, 0)
    }
  }, [onNodesChange, recordCurrentState])

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    const hasRemove = changes.some(c => c.type === 'remove')
    onEdgesChange(changes)
    if (hasRemove) {
      setTimeout(() => {
        recordCurrentState('structure', '删除连接', true)
      }, 0)
    }
  }, [onEdgesChange, recordCurrentState])

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
        recordCurrentState('structure', '添加卡片', true)
      }, 0)
    }
    window.addEventListener('hepta-add-card-node', onAddCardNode)
    return () => window.removeEventListener('hepta-add-card-node', onAddCardNode)
  }, [setNodes, recordCurrentState])

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
      setTimeout(() => {
        recordCurrentState('structure', '创建连接', true)
      }, 0)
    },
    [setEdges, recordCurrentState],
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
        setTimeout(() => {
          recordCurrentState('structure', '删除连接', true)
        }, 0)
      } else {
        setTimeout(() => {
          recordCurrentState('structure', '重新连接', true)
        }, 0)
      }
      reconnectSuccessRef.current = false
    },
    [setEdges, recordCurrentState],
  )

  const onNodeDragStart = useCallback(() => {
    // No-op: we only record on drag stop
  }, [])

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

  const onNodeDragStop = useCallback((_event: React.MouseEvent, _node: Node, allNodes: Node[]) => {
    console.log('[ReactFlowCanvas] onNodeDragStop called, allNodes count:', allNodes.length)
    setEdges((eds) => [...eds])
    // Use allNodes from callback (latest positions from React Flow)
    record({
      type: 'canvas',
      description: '移动卡片',
      nodes: allNodes.map(n => {
        const { selected, ...rest } = n
        return rest as Node
      }),
      edges: edgesRef.current.map(e => ({ ...e })),
    })
  }, [record])

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

  const handleUndo = useCallback(() => {
    console.log('[ReactFlowCanvas] handleUndo called')
    // Flush any pending history record before undoing
    if (recordTimerRef.current) {
      clearTimeout(recordTimerRef.current)
      recordTimerRef.current = null
      console.log('[ReactFlowCanvas] flushed pending record')
    }
    const entry = undo()
    console.log('[ReactFlowCanvas] undo returned:', entry ? { type: entry.type, desc: entry.description, nodes: entry.nodes.length, edges: entry.edges.length } : null)
    if (entry) {
      setNodes(entry.nodes.map(n => ({ ...n })))
      setEdges(entry.edges.map(e => ({ ...e })))
    }
  }, [undo, setNodes, setEdges])

  const handleRedo = useCallback(() => {
    console.log('[ReactFlowCanvas] handleRedo called')
    // Flush any pending history record before redoing
    if (recordTimerRef.current) {
      clearTimeout(recordTimerRef.current)
      recordTimerRef.current = null
      console.log('[ReactFlowCanvas] flushed pending record')
    }
    const entry = redo()
    console.log('[ReactFlowCanvas] redo returned:', entry ? { type: entry.type, desc: entry.description, nodes: entry.nodes.length, edges: entry.edges.length } : null)
    if (entry) {
      setNodes(entry.nodes.map(n => ({ ...n })))
      setEdges(entry.edges.map(e => ({ ...e })))
    }
  }, [redo, setNodes, setEdges])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey
      if (!isCtrl) return

      // Skip canvas undo/redo if user is editing card content
      const target = e.target as HTMLElement
      const isEditingCard = target?.closest('.ProseMirror, .bn-editor, .card-blocknote-editor, [contenteditable="true"]')
      if (isEditingCard) {
        console.log('[ReactFlowCanvas] Ctrl+Z/Y ignored - user editing card content')
        return
      }

      if (e.key === 'z' && !e.shiftKey) {
        console.log('[ReactFlowCanvas] Ctrl+Z pressed')
        e.preventDefault()
        handleUndo()
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        console.log('[ReactFlowCanvas] Ctrl+Shift+Z or Ctrl+Y pressed')
        e.preventDefault()
        handleRedo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleUndo, handleRedo])

  useEffect(() => {
    const handleWorkspaceChange = () => {
      clear()
    }
    window.addEventListener('hepta-reinit-workspace', handleWorkspaceChange)
    return () => window.removeEventListener('hepta-reinit-workspace', handleWorkspaceChange)
  }, [clear])

  const canvasRef = useRef<HTMLDivElement>(null)

  const onWheelZoom = useCallback(
    (event: React.WheelEvent) => {
      const instance = reactFlowInstance.current
      if (!instance) return

      const { zoom, x, y } = instance.getViewport()
      const delta = event.deltaY
      const isPinch = event.ctrlKey

      if (isPinch) return

      // Use native event to avoid passive listener warning
      if (event.nativeEvent) {
        event.nativeEvent.preventDefault()
        event.nativeEvent.stopImmediatePropagation()
      }

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
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onInit={onInit}
        onPaneClick={onPaneClick}
        onNodeClick={onNodeClick}
        onMouseMove={onMouseMove}
        onNodeDragStart={onNodeDragStart}
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