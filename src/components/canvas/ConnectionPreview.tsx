import { useSyncExternalStore, useState, useEffect } from 'react'
import { connectionMediator } from './utils/connectionMediator'
import { edgePointOnRect } from './utils/geometry'
import { getBezierPath, Position } from '@xyflow/react'
import type { Node, ReactFlowInstance } from '@xyflow/react'
import type { CardNodeData } from '../../types/card'
import { DEFAULT_CARD_WIDTH, DEFAULT_CARD_HEIGHT } from '../../types/card'

interface ConnectionPreviewProps {
  nodesRef: React.RefObject<Node[]>
  reactFlowInstance: React.RefObject<ReactFlowInstance | null>
  lastMousePosRef: React.RefObject<{ x: number; y: number } | null>
}

function getNearestPosition(
  nodeX: number, nodeY: number, nodeW: number, nodeH: number,
  targetX: number, targetY: number,
): Position {
  const centerX = nodeX + nodeW / 2
  const centerY = nodeY + nodeH / 2
  const dx = targetX - centerX
  const dy = targetY - centerY
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)
  if (absDx * nodeH > absDy * nodeW) {
    return dx > 0 ? Position.Right : Position.Left
  }
  return dy > 0 ? Position.Bottom : Position.Top
}

export function ConnectionPreview({ nodesRef, reactFlowInstance, lastMousePosRef }: ConnectionPreviewProps) {
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
          const srcNode = nodesRef.current?.find((n) => n.id === pending.sourceNodeId)
          if (srcNode) {
            const data = srcNode.data as CardNodeData
            const w = data.width ?? DEFAULT_CARD_WIDTH
            const h = data.height ?? DEFAULT_CARD_HEIGHT
            const zoom = rf.getViewport().zoom
            const srcScreen = rf.flowToScreenPosition(srcNode.position)
            const scaledW = w * zoom
            const scaledH = h * zoom
            const srcEdge = edgePointOnRect(srcScreen.x, srcScreen.y, scaledW, scaledH, mouse.x, mouse.y)
            const srcPos = getNearestPosition(srcScreen.x, srcScreen.y, scaledW, scaledH, mouse.x, mouse.y)

            let targetX = mouse.x
            let targetY = mouse.y
            let targetPos: Position = Position.Top

            for (const node of nodesRef.current ?? []) {
              if (node.id === pending.sourceNodeId) continue
              const nw = ((node.data as Record<string, unknown>).width as number) ?? DEFAULT_CARD_WIDTH
              const nh = ((node.data as Record<string, unknown>).height as number) ?? DEFAULT_CARD_HEIGHT
              const nodeScreen = rf.flowToScreenPosition(node.position)
              const scaledNW = nw * zoom
              const scaledNH = nh * zoom

              if (
                mouse.x >= nodeScreen.x - 50 &&
                mouse.x <= nodeScreen.x + scaledNW + 50 &&
                mouse.y >= nodeScreen.y - 50 &&
                mouse.y <= nodeScreen.y + scaledNH + 50
              ) {
                const snap = edgePointOnRect(nodeScreen.x, nodeScreen.y, scaledNW, scaledNH, srcEdge.x, srcEdge.y)
                targetX = snap.x
                targetY = snap.y
                targetPos = getNearestPosition(nodeScreen.x, nodeScreen.y, scaledNW, scaledNH, srcEdge.x, srcEdge.y)
                break
              }
            }

            const [path] = getBezierPath({
              sourceX: srcEdge.x,
              sourceY: srcEdge.y,
              sourcePosition: srcPos,
              targetX,
              targetY,
              targetPosition: targetPos,
            })

            setPreviewPath(path)
          }
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isConnecting, nodesRef, reactFlowInstance, lastMousePosRef])

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