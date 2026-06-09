import { useMemo } from 'react'
import { useStore } from '@xyflow/react'

export type GridPattern = 'cross' | 'dot' | 'circle' | 'triangle'

const BASE_GAP = 25
const MAX_OPACITY = 1

const gridSteps = [
  { min: -1,   mid: 0.15, step: 27 },
  { min: 0.05, mid: 0.375, step: 9 },
  { min: 0.15, mid: 1,    step: 3 },
  { min: 0.7,  mid: 4,    step: 1 },
]

function modulate(value: number, rangeA: number[], rangeB: number[]) {
  const [fromLow, fromHigh] = rangeA
  const [v0, v1] = rangeB
  return v0 + ((value - fromLow) / (fromHigh - fromLow)) * (v1 - v0)
}

function stepOpacity(z: number, min: number, mid: number) {
  if (z < min) return 0
  if (z >= mid) return 1
  return modulate(z, [min, mid], [0, 1])
}

function PatternShape({ pattern, color, cx, cy, size: _size }: {
  pattern: GridPattern
  color: string
  cx: number
  cy: number
  size: number
}) {
  switch (pattern) {
    case 'cross': {
      const arm = 6
      const w = 0.25
      return (
        <g>
          <rect x={cx - arm / 2} y={cy - w / 2} width={arm} height={w} fill={color} />
          <rect x={cx - w / 2} y={cy - arm / 2} width={w} height={arm} fill={color} />
        </g>
      )
    }
    case 'dot':
      return <rect x={cx - 0.5} y={cy - 0.5} width={1} height={1} fill={color} />
    case 'circle':
      return <circle cx={cx} cy={cy} r={1} fill={color} />
    case 'triangle': {
      const r = 1.5
      const h = r * Math.sqrt(3)
      const top = cy - h * 2 / 3
      const bottom = cy + h / 3
      return (
        <polygon
          points={`${cx},${top} ${cx - r},${bottom} ${cx + r},${bottom}`}
          fill={color}
        />
      )
    }
  }
}

export function AdaptiveBackground({ color, pattern = 'cross' }: { color: string; pattern?: GridPattern }) {
  const transform = useStore((s) => s.transform)
  const patternId = 'hepta-grid-pattern'

  const [tx, ty, z] = transform

  const layers = useMemo(() => {
    return gridSteps
      .map((gs, i) => {
        const opacity = stepOpacity(z, gs.min, gs.mid) * MAX_OPACITY
        if (opacity <= 0) return null
        const scaledGap = gs.step * BASE_GAP * z
        const x = tx % scaledGap
        const y = ty % scaledGap
        const scaledOffset = scaledGap / 2
        return { id: `${patternId}-grid-${i}`, scaledGap, x, y, scaledOffset, opacity }
      })
      .filter(Boolean) as { id: string; scaledGap: number; x: number; y: number; scaledOffset: number; opacity: number }[]
  }, [tx, ty, z, patternId])

  const containerStyle = useMemo(() => ({
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none' as const,
    zIndex: -1,
  }), [])

  return (
    <svg className="react-flow__background" style={containerStyle}>
      {layers.map((layer) => (
        <pattern
          key={layer.id}
          id={layer.id}
          x={layer.x}
          y={layer.y}
          width={layer.scaledGap}
          height={layer.scaledGap}
          patternUnits="userSpaceOnUse"
          patternTransform={`translate(-${layer.scaledOffset},-${layer.scaledOffset})`}
        >
          <g opacity={layer.opacity}>
            <PatternShape
              pattern={pattern}
              color={color}
              cx={layer.scaledGap / 2}
              cy={layer.scaledGap / 2}
              size={layer.scaledGap}
            />
          </g>
        </pattern>
      ))}
      {layers.map((layer) => (
        <rect
          key={`${layer.id}-rect`}
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill={`url(#${layer.id})`}
        />
      ))}
    </svg>
  )
}
