import { getBezierPath, BaseEdge, type Node, type ConnectionLineComponentProps } from '@xyflow/react'

const SNAP_THRESHOLD = 50

let nodesRef: Node[] = []

export function setNodesRef(nodes: Node[]) {
  nodesRef = nodes
}

function isNearNode(
  toX: number,
  toY: number,
  excludeNodeId: string,
): { near: boolean; nodeId: string } {
  for (const node of nodesRef) {
    if (node.id === excludeNodeId) continue
    const w = ((node.data as Record<string, unknown>).width as number) ?? 280
    const h = ((node.data as Record<string, unknown>).height as number) ?? 200
    const x = node.position.x
    const y = node.position.y
    if (
      toX >= x - SNAP_THRESHOLD &&
      toX <= x + w + SNAP_THRESHOLD &&
      toY >= y - SNAP_THRESHOLD &&
      toY <= y + h + SNAP_THRESHOLD
    ) {
      return { near: true, nodeId: node.id }
    }
  }
  return { near: false, nodeId: '' }
}

export function CustomConnectionLine({
  fromX,
  fromY,
  fromPosition,
  toX,
  toY,
  toPosition,
  fromNode,
}: ConnectionLineComponentProps<Node>) {
  const { near: isNearTarget } = isNearNode(
    toX,
    toY,
    fromNode?.id ?? '',
  )

  const [edgePath] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
  })

  return (
    <g className="react-flow__connectionline">
      <defs>
        <marker
          id="arrow-default"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
        </marker>
        <marker
          id="arrow-active"
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
          stroke: isNearTarget ? '#3b82f6' : '#94a3b8',
          strokeWidth: isNearTarget ? 3 : 2,
          strokeDasharray: isNearTarget ? 'none' : '6,4',
          fill: 'none',
        }}
        markerEnd={`url(#arrow-${isNearTarget ? 'active' : 'default'})`}
      />
    </g>
  )
}
