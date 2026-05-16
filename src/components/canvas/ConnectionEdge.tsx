import {
  BaseEdge,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react'

export function ConnectionEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  style = {},
  markerEnd,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        className="edge-default"
        style={{
          ...style,
          stroke: selected ? 'var(--border-active)' : 'var(--text-tertiary)',
          strokeWidth: selected ? 3 : 2,
          cursor: 'pointer',
        }}
      />
      <BaseEdge
        path={edgePath}
        style={{
          stroke: selected ? 'var(--border-focus)' : 'transparent',
          strokeWidth: selected ? 10 : 28,
          fill: 'none',
          pointerEvents: 'stroke',
          cursor: 'pointer',
        }}
      />
    </>
  )
}