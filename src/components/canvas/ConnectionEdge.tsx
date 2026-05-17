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
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--text-tertiary)" />
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
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--border-active)" />
        </marker>
      </defs>
      <BaseEdge
        path={edgePath}
        markerEnd={selected ? 'url(#edge-arrow-selected)' : 'url(#edge-arrow)'}
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

export const MemoizedConnectionEdge = memo(ConnectionEdge)
