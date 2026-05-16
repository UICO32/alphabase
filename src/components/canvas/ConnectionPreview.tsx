import { useSyncExternalStore, useState, useEffect } from 'react'
import { connectionMediator } from '../../utils/connectionMediator'
import { edgePointOnRect } from '../../utils/geometry'
import type { Node, ReactFlowInstance } from '@xyflow/react'

interface ConnectionPreviewProps {
  nodesRef: React.RefObject<Node[]>
  reactFlowInstance: React.RefObject<ReactFlowInstance | null>
  lastMousePosRef: React.RefObject<{ x: number; y: number } | null>
}

export function ConnectionPreview({ nodesRef, reactFlowInstance, lastMousePosRef }: ConnectionPreviewProps) {
  const isConnecting = useSyncExternalStore(
    connectionMediator.subscribe.bind(connectionMediator),
    connectionMediator.isConnecting.bind(connectionMediator),
  )
  const [previewLine, setPreviewLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)

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
      if (pending && rf && mouse) {
        const srcNode = nodesRef.current?.find((n) => n.id === pending.sourceNodeId)
        if (srcNode) {
          const w = ((srcNode.data as Record<string, unknown>).width as number) ?? 280
          const h = ((srcNode.data as Record<string, unknown>).height as number) ?? 200
          const zoom = rf.getViewport().zoom
          const srcScreen = rf.flowToScreenPosition(srcNode.position)
          const scaledW = w * zoom
          const scaledH = h * zoom
          const srcEdge = edgePointOnRect(srcScreen.x, srcScreen.y, scaledW, scaledH, mouse.x, mouse.y)
          setPreviewLine({ x1: srcEdge.x, y1: srcEdge.y, x2: mouse.x, y2: mouse.y })
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isConnecting, nodesRef, reactFlowInstance, lastMousePosRef])

  if (!previewLine) return null

  return (
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
  )
}