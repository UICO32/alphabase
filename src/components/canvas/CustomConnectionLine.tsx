import { getBezierPath, BaseEdge, type Node, type ConnectionLineComponentProps, Position } from '@xyflow/react'
import { DEFAULT_CARD_WIDTH, DEFAULT_CARD_HEIGHT } from '../../types/card'

const SNAP_THRESHOLD = 50

let nodesRef: Node[] = []

export function setNodesRef(nodes: Node[]) {
  nodesRef = nodes
}

// 读取节点尺寸（card / media / text 通用，统一从 data.width/height 取，缺省回退默认值）
function getNodeSize(node: Node): { w: number; h: number } {
  const d = node.data as Record<string, unknown>
  const w = (d.width as number) ?? (node.width as number) ?? DEFAULT_CARD_WIDTH
  const h = (d.height as number) ?? (node.height as number) ?? DEFAULT_CARD_HEIGHT
  return { w, h }
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

  const { w, h } = getNodeSize(fromNode)

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
    const size = getNodeSize(node)
    const nx = node.position.x
    const ny = node.position.y

    if (
      toX >= nx - SNAP_THRESHOLD &&
      toX <= nx + size.w + SNAP_THRESHOLD &&
      toY >= ny - SNAP_THRESHOLD &&
      toY <= ny + size.h + SNAP_THRESHOLD
    ) {
      const snap = getNearestEdgePoint(nx, ny, size.w, size.h, fromX, fromY)
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
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--brand)" />
        </marker>
      </defs>
      <BaseEdge
        path={edgePath}
        style={{
          stroke: 'var(--brand)',
          strokeWidth: 2,
          strokeDasharray: '6,4',
          fill: 'none',
        }}
        markerEnd="url(#arrow-drawing)"
      />
    </g>
  )
}
