import {
  BaseEdge,
  getBezierPath,
  type EdgeProps,
  type Node,
  useReactFlow,
  Position,
} from '@xyflow/react'

function getNearestEdgeHandle(
  node: Node | undefined,
  otherX: number,
  otherY: number,
): { x: number; y: number; position: Position; handleId: string } {
  if (!node) return { x: otherX, y: otherY, position: Position.Top, handleId: '' }
  const w = ((node.data as Record<string, unknown>).width as number) ?? 280
  const h = ((node.data as Record<string, unknown>).height as number) ?? 200
  const nx = node.position.x
  const ny = node.position.y
  const centerX = nx + w / 2
  const centerY = ny + h / 2
  const dx = otherX - centerX
  const dy = otherY - centerY
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)

  if (absDx * h > absDy * w) {
    if (dx > 0) {
      return { x: nx + w, y: centerY, position: Position.Right, handleId: 'right' }
    }
    return { x: nx, y: centerY, position: Position.Left, handleId: 'left' }
  }
  if (dy > 0) {
    return { x: centerX, y: ny + h, position: Position.Bottom, handleId: 'bottom' }
  }
  return { x: centerX, y: ny, position: Position.Top, handleId: 'top' }
}

export function ConnectionEdge({
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  selected,
  style = {},
  markerEnd,
}: EdgeProps) {
  const { getNode } = useReactFlow()
  const sourceNode = getNode(source)
  const targetNode = getNode(target)

  const src = getNearestEdgeHandle(sourceNode, targetX, targetY)
  const tgt = getNearestEdgeHandle(targetNode, sourceX, sourceY)

  const [edgePath] = getBezierPath({
    sourceX: src.x,
    sourceY: src.y,
    sourcePosition: src.position,
    targetX: tgt.x,
    targetY: tgt.y,
    targetPosition: tgt.position,
  })

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: selected ? '#3b82f6' : '#94a3b8',
          strokeWidth: selected ? 3 : 2,
          strokeDasharray: selected ? '8,3' : '6,4',
          cursor: 'pointer',
        }}
      />
      <BaseEdge
        path={edgePath}
        style={{
          stroke: selected ? '#bfdbfe' : 'transparent',
          strokeWidth: selected ? 10 : 28,
          fill: 'none',
          pointerEvents: 'stroke',
          cursor: 'pointer',
        }}
      />
    </>
  )
}
