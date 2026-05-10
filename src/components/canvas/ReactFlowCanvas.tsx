import { useCallback, useRef, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  ConnectionMode,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type IsValidConnection,
  addEdge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { CardNode } from './CardNode'
import { SectionNode } from './SectionNode'
import { ConnectionEdge } from './ConnectionEdge'
import { CustomConnectionLine, setNodesRef } from './CustomConnectionLine'

import { useWorkspaceLifecycle } from '../../hooks/useWorkspaceLifecycle'
import { useBoardSync } from '../../hooks/useBoardSync'
import { useSectionSync } from '../../hooks/useSectionSync'
import { connectionMediator } from '../../utils/connectionMediator'

const nodeTypes = {
  card: CardNode,
  section: SectionNode,
}

const edgeTypes = {
  connection: ConnectionEdge,
}

export function ReactFlowCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const editingNodeIdRef = useRef<string | null>(null)
  const reconnectSuccessRef = useRef(false)

  useEffect(() => {
    setNodesRef(nodes)
  }, [nodes])

  useWorkspaceLifecycle({ setNodes, setEdges })
  useBoardSync({ nodes, edges })
  useSectionSync({ nodes, setNodes })

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
    },
    [],
  )

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
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        onNodeClick={onNodeClick}
        onReconnect={onReconnect}
        onReconnectEnd={onReconnectEnd}
        edgesReconnectable
        connectionMode={ConnectionMode.Loose}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionLineComponent={connectionLineComponent}
        isValidConnection={isValidConnection}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  )
}
