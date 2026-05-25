import { getBezierPath, BaseEdge, type Node, type ConnectionLineComponentProps, Position } from '@xyflow/react'
import { DEFAULT_CARD_WIDTH, DEFAULT_CARD_HEIGHT } from '../../types/card'

const SNAP_THRESHOLD = 50

let nodesRef: Node[] = []

export function setNodesRef(nodes: Node[]) {
  nodesRef = nodes
}

function getNearestEdgePoint(
  nodeX: number,
  nodeY: number,
  nodeWidth: number,
  nodeHeight: number,
  cursorX: number,
  cursorY: number,
): { x: number; y: number; position: Position } {
  const centerX = nodeX + nodeWidth / 2
  const centerY = nodeY + nodeHeight / 2
  const dx = cursorX - centerX
  const dy = cursorY - centerY

  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)

  if (absDx * nodeHeight > absDy * nodeWidth) {
    if (dx > 0) {
      return { x: nodeX + nodeWidth, y: centerY, position: Position.Right }
    }
    return { x: nodeX, y: centerY, position: Position.Left }
  }
  if (dy > 0) {
    return { x: centerX, y: nodeY + nodeHeight, position: Position.Bottom }
  }
  return { x: centerX, y: nodeY, position: Position.Top }
}

export function CustomConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
  fromNode,
}: ConnectionLineComponentProps<Node>) {
  if (!fromNode) return null

  const w = ((fromNode.data as Record<string, unknown>).width as number) ?? DEFAULT_CARD_WIDTH
  const h = ((fromNode.data as Record<string, unknown>).height as number) ?? DEFAULT_CARD_HEIGHT

  const sourcePoint = getNearestEdgePoint(
    fromNode.position.x,
    fromNode.position.y,
    w,
    h,
    toX,
    toY,
  )

  let targetX = toX
  let targetY = toY
  let targetPosition = Position.Top

  for (const node of nodesRef) {
    if (node.id === fromNode.id) continue
    const nw = ((node.data as Record<string, unknown>).width as number) ?? 280
    const nh = ((node.data as Record<string, unknown>).height as number) ?? 200
    const nx = node.position.x
    const ny = node.position.y

    if (
      toX >= nx - SNAP_THRESHOLD &&
      toX <= nx + nw + SNAP_THRESHOLD &&
      toY >= ny - SNAP_THRESHOLD &&
      toY <= ny + nh + SNAP_THRESHOLD
    ) {
      const snap = getNearestEdgePoint(nx, ny, nw, nh, fromX, fromY)
      targetX = snap.x
      targetY = snap.y
      targetPosition = snap.position
      break
    }
  }

  const [edgePath] = getBezierPath({
    sourceX: sourcePoint.x,
    sourceY: sourcePoint.y,
    sourcePosition: sourcePoint.position,
    targetX,
    targetY,
    targetPosition,
  })

  return (
    <g className="react-flow__connectionline">
      <defs>
        <marker
          id="arrow-drawing"
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
      <BaseEdge
        path={edgePath}
        style={{
          stroke: '#3b82f6',
          strokeWidth: 2,
          strokeDasharray: '6,4',
          fill: 'none',
        }}
        markerEnd="url(#arrow-drawing)"
      />
    </g>
  )
}
