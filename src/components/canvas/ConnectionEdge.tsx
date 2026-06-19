import { memo } from 'react'
import {
  BaseEdge,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react'

function ConnectionEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  style = {},
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
      <defs>
        <marker
          id="edge-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--fg-tertiary)" />
        </marker>
        <marker
          id="edge-arrow-selected"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--brand)" />
        </marker>
      </defs>
      <BaseEdge
        path={edgePath}
        markerEnd={selected ? 'url(#edge-arrow-selected)' : 'url(#edge-arrow)'}
        className={`edge-default${selected ? ' edge-selected' : ''}`}
        style={{
          ...style,
          stroke: selected ? 'var(--brand)' : 'var(--fg-tertiary)',
          strokeWidth: selected ? 2.5 : 2,
          strokeDasharray: selected ? '6 4' : undefined,
          cursor: 'pointer',
        }}
      />
      <BaseEdge
        path={edgePath}
        style={{
          stroke: selected ? 'var(--line-focus)' : 'transparent',
          strokeWidth: selected ? 10 : 28,
          fill: 'none',
          pointerEvents: 'stroke',
          cursor: 'pointer',
        }}
      />
    </>
  )
}

export const MemoizedConnectionEdge = memo(ConnectionEdge)
