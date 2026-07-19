import { useSyncExternalStore, useState, useEffect } from 'react'
import { connectionMediator } from './utils/connectionMediator'
import { getBezierPath, Position } from '@xyflow/react'
import type { ReactFlowInstance } from '@xyflow/react'
import type { CanvasSpatialIndex } from './utils/canvasSpatialIndex'
import { CONNECTION_SNAP_RADIUS, resolveConnectionSnap, resolveSourceEndpoint } from './utils/connectionSnap'

interface ConnectionPreviewProps {
  spatialIndexRef: React.RefObject<CanvasSpatialIndex>
  reactFlowInstance: React.RefObject<ReactFlowInstance | null>
  lastMousePosRef: React.RefObject<{ x: number; y: number } | null>
}

export function findConnectionPreviewTarget(
  spatialIndex: CanvasSpatialIndex,
  reactFlowInstance: ReactFlowInstance,
  mouse: { x: number; y: number },
  sourceNodeId: string,
  zoom: number,
) {
  const flowPoint = reactFlowInstance.screenToFlowPosition(mouse)
  return spatialIndex
    .queryPoint(flowPoint, CONNECTION_SNAP_RADIUS / zoom)
    .find(item => item.id !== sourceNodeId)
    ?.node
}

export function ConnectionPreview({ spatialIndexRef, reactFlowInstance, lastMousePosRef }: ConnectionPreviewProps) {
  const isConnecting = useSyncExternalStore(
    connectionMediator.subscribe.bind(connectionMediator),
    connectionMediator.isConnecting.bind(connectionMediator),
  )
  const [previewPath, setPreviewPath] = useState<string | null>(null)

  useEffect(() => {
    if (!isConnecting) {
      setPreviewPath(null)
      return
    }
    let raf = 0
    let lastCalcTime = 0
    const THROTTLE_MS = 16 // ~60fps cap
    const tick = () => {
      const now = performance.now()
      if (now - lastCalcTime >= THROTTLE_MS) {
        lastCalcTime = now
        const pending = connectionMediator.getPending()
        const rf = reactFlowInstance.current
        const mouse = lastMousePosRef.current
        if (pending && rf && mouse) {
          const spatialIndex = spatialIndexRef.current
          const candidate = spatialIndex
            ? resolveConnectionSnap(spatialIndex, rf, mouse, pending.sourceNodeId)
            : null
          connectionMediator.setPreviewCandidate(candidate)
          connectionMediator.setNearbyTarget(candidate?.targetNodeId ?? null)
          const srcNode = rf.getNode(pending.sourceNodeId)
          if (srcNode) {
            const sourceEndpoint = candidate
              ? { point: candidate.sourcePoint, position: candidate.sourcePosition }
              : resolveSourceEndpoint(rf, srcNode, mouse)
            const sourceX = sourceEndpoint.point.x
            const sourceY = sourceEndpoint.point.y
            const sourcePosition = sourceEndpoint.position
            const targetX = candidate?.targetPoint.x ?? mouse.x
            const targetY = candidate?.targetPoint.y ?? mouse.y
            const targetPosition = candidate?.targetPosition ?? Position.Top

            const [path] = getBezierPath({
              sourceX,
              sourceY,
              sourcePosition,
              targetX,
              targetY,
              targetPosition,
            })

            setPreviewPath(path)
          }
        } else {
          connectionMediator.setPreviewCandidate(null)
          connectionMediator.setNearbyTarget(null)
          setPreviewPath(null)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isConnecting, spatialIndexRef, reactFlowInstance, lastMousePosRef])

  if (!previewPath) return null

  return (
    <svg
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 'var(--z-sticky)',
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
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--brand)" />
        </marker>
      </defs>
      <path
        d={previewPath}
        fill="none"
        stroke="var(--brand)"
        strokeWidth={2}
        strokeDasharray="6,4"
        markerEnd="url(#preview-arrow)"
      />
    </svg>
  )
}
