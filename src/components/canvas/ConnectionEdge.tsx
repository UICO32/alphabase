import { memo } from 'react'
import {
  BaseEdge,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react'

export const ConnectionEdge = memo(
  ({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    selected,
    style = {},
    markerEnd,
  }: EdgeProps) => {
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
  },
)

ConnectionEdge.displayName = 'ConnectionEdge'
