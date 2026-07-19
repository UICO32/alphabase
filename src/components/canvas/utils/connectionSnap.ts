import { Position, type Node, type ReactFlowInstance } from '@xyflow/react'
import type { CanvasSpatialIndex } from './canvasSpatialIndex'
import { edgePointOnRect, positionToHandleId } from './geometry'
import { DEFAULT_CARD_HEIGHT, DEFAULT_CARD_WIDTH } from '../../../types/card'

export const CONNECTION_SNAP_RADIUS = 72

export interface ConnectionSnapCandidate {
  targetNodeId: string
  sourceHandleId: string
  targetHandleId: string
  sourcePoint: { x: number; y: number }
  targetPoint: { x: number; y: number }
  sourcePosition: Position
  targetPosition: Position
}

function getNodeSize(node: Node) {
  const data = node.data as Record<string, unknown>
  return {
    width: (data.width as number | undefined) ?? node.width ?? DEFAULT_CARD_WIDTH,
    height: (data.height as number | undefined) ?? node.height ?? DEFAULT_CARD_HEIGHT,
  }
}

function nearestPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  targetX: number,
  targetY: number,
) {
  const dx = targetX - (x + width / 2)
  const dy = targetY - (y + height / 2)
  return Math.abs(dx) * height > Math.abs(dy) * width
    ? (dx > 0 ? Position.Right : Position.Left)
    : (dy > 0 ? Position.Bottom : Position.Top)
}

export function resolveSourceEndpoint(
  reactFlow: ReactFlowInstance,
  sourceNode: Node,
  mouse: { x: number; y: number },
) {
  const zoom = reactFlow.getViewport().zoom
  const sourceSize = getNodeSize(sourceNode)
  const sourceScreen = reactFlow.flowToScreenPosition(sourceNode.position)
  const sourceWidth = sourceSize.width * zoom
  const sourceHeight = sourceSize.height * zoom
  return {
    point: edgePointOnRect(
      sourceScreen.x,
      sourceScreen.y,
      sourceWidth,
      sourceHeight,
      mouse.x,
      mouse.y,
    ),
    position: nearestPosition(
      sourceScreen.x,
      sourceScreen.y,
      sourceWidth,
      sourceHeight,
      mouse.x,
      mouse.y,
    ),
  }
}

export function resolveConnectionSnap(
  spatialIndex: CanvasSpatialIndex,
  reactFlow: ReactFlowInstance,
  mouse: { x: number; y: number },
  sourceNodeId: string,
  radius = CONNECTION_SNAP_RADIUS,
): ConnectionSnapCandidate | null {
  const sourceNode = reactFlow.getNode(sourceNodeId)
  if (!sourceNode) return null

  const zoom = reactFlow.getViewport().zoom
  const flowPoint = reactFlow.screenToFlowPosition(mouse)
  const candidates = spatialIndex
    .queryPoint(flowPoint, radius / zoom)
    .filter(item => (item.type === 'card' || item.type === 'text') && item.id !== sourceNodeId)

  let targetNode: Node | undefined
  let closestDistance = radius
  for (const item of candidates) {
    const size = getNodeSize(item.node)
    const screen = reactFlow.flowToScreenPosition(item.node.position)
    const width = size.width * zoom
    const height = size.height * zoom
    const nearestX = Math.max(screen.x, Math.min(mouse.x, screen.x + width))
    const nearestY = Math.max(screen.y, Math.min(mouse.y, screen.y + height))
    const distance = Math.hypot(mouse.x - nearestX, mouse.y - nearestY)
    if (distance < closestDistance) {
      closestDistance = distance
      targetNode = item.node
    }
  }
  if (!targetNode) return null

  const sourceEndpoint = resolveSourceEndpoint(reactFlow, sourceNode, mouse)
  const sourcePoint = sourceEndpoint.point
  const sourcePosition = sourceEndpoint.position

  const targetSize = getNodeSize(targetNode)
  const targetScreen = reactFlow.flowToScreenPosition(targetNode.position)
  const targetWidth = targetSize.width * zoom
  const targetHeight = targetSize.height * zoom
  const targetPoint = edgePointOnRect(
    targetScreen.x,
    targetScreen.y,
    targetWidth,
    targetHeight,
    sourcePoint.x,
    sourcePoint.y,
  )
  const targetPosition = nearestPosition(
    targetScreen.x,
    targetScreen.y,
    targetWidth,
    targetHeight,
    sourcePoint.x,
    sourcePoint.y,
  )

  return {
    targetNodeId: targetNode.id,
    sourceHandleId: positionToHandleId(sourcePosition),
    targetHandleId: `${positionToHandleId(targetPosition)}-target`,
    sourcePoint,
    targetPoint,
    sourcePosition,
    targetPosition,
  }
}
