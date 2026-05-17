import { useCallback, useRef, useEffect } from 'react'
import { type Edge, type Connection } from '@xyflow/react'
import { addEdge } from '@xyflow/react'
import { connectionMediator } from '../utils/connectionMediator'

interface UseCanvasConnectionOptions {
  setEdges: (updater: Edge[] | ((edges: Edge[]) => Edge[])) => void
}

export function useCanvasConnection({ setEdges }: UseCanvasConnectionOptions) {
  const reconnectSuccessRef = useRef(false)

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

  return { onConnect, onReconnect, onReconnectEnd }
}